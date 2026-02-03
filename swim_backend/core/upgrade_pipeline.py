from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import serializers
from django.shortcuts import get_object_or_404
from swim_backend.devices.models import Device
from swim_backend.core.models import Job, Workflow
from swim_backend.images.models import Image
from swim_backend.core.services.job_runner import run_swim_job
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiExample
from drf_spectacular.types import OpenApiTypes
import threading
import logging

logger = logging.getLogger(__name__)


class TriggerUpgradeSerializer(serializers.Serializer):
    """Serializer for triggering device upgrades"""
    devices = serializers.ListField(
        child=serializers.CharField(),
        help_text="List of device IDs or hostnames to upgrade"
    )
    image_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="Golden image ID (optional - auto-selected if not provided)"
    )
    workflow_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="Workflow ID (optional - uses default workflow if not provided)"
    )
    execution_mode = serializers.ChoiceField(
        choices=['parallel', 'sequential'],
        default='parallel',
        help_text="Execution mode: parallel or sequential"
    )
    schedule_time = serializers.DateTimeField(
        required=False,
        allow_null=True,
        help_text="Schedule upgrade for later (ISO 8601 format)"
    )
    activate_after_distribute = serializers.BooleanField(
        default=True,
        help_text="Auto-activate after distribution completes"
    )
    cleanup_flash = serializers.BooleanField(
        default=False,
        help_text="Clean up flash storage after upgrade"
    )
    auto_select_image = serializers.BooleanField(
        default=True,
        help_text="Automatically select appropriate golden image per device"
    )


class CancelUpgradeSerializer(serializers.Serializer):
    """Serializer for canceling upgrade jobs"""
    job_ids = serializers.ListField(
        child=serializers.IntegerField(),
        help_text="List of job IDs to cancel"
    )


@extend_schema(
    request=TriggerUpgradeSerializer,
    responses={201: OpenApiTypes.OBJECT, 400: OpenApiTypes.OBJECT, 403: OpenApiTypes.OBJECT, 404: OpenApiTypes.OBJECT},
    description="Trigger upgrade pipeline for one or more devices. Supports both immediate and scheduled upgrades.",
    examples=[
        OpenApiExample(
            'Parallel Upgrade',
            value={
                'devices': [1, 2, 3],
                'execution_mode': 'parallel',
                'auto_select_image': True
            },
            request_only=True
        )
    ]
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def trigger_upgrade_pipeline(request):
    if not request.user.has_perm('devices.upgrade_device_firmware'):
        return Response({
            'error': 'Permission denied',
            'message': 'You do not have permission to upgrade device firmware'
        }, status=403)
    
    # Parse request
    device_identifiers = request.data.get('devices', [])
    image_id = request.data.get('image_id')
    workflow_id = request.data.get('workflow_id')
    execution_mode = request.data.get('execution_mode', 'parallel')
    schedule_time = request.data.get('schedule_time')
    activate_after_distribute = request.data.get('activate_after_distribute', True)
    cleanup_flash = request.data.get('cleanup_flash', False)
    auto_select_image = request.data.get('auto_select_image', True)
    
    # Validate
    if not device_identifiers:
        return Response({
            'error': 'Missing devices',
            'message': 'Please provide device IDs or hostnames in the "devices" field'
        }, status=400)
    
    # Resolve devices
    devices = []
    for identifier in device_identifiers:
        if isinstance(identifier, int) or (isinstance(identifier, str) and identifier.isdigit()):
            # Device ID
            device = get_object_or_404(Device, id=int(identifier))
            devices.append(device)
        else:
            # Hostname
            device = get_object_or_404(Device, hostname=identifier)
            devices.append(device)
    
    # Resolve workflow
    workflow = None
    if workflow_id:
        try:
            workflow = Workflow.objects.get(id=workflow_id)
        except Workflow.DoesNotExist:
            return Response({
                'error': 'Workflow not found',
                'message': f'Workflow with ID {workflow_id} does not exist'
            }, status=404)
    else:
        # Use default workflow
        workflow = Workflow.objects.filter(is_default=True).first()
        if not workflow:
            # Fallback to first available
            workflow = Workflow.objects.first()
    
    # Resolve image if provided
    target_image = None
    if image_id:
        try:
            target_image = Image.objects.get(id=image_id)
        except Image.DoesNotExist:
            return Response({
                'error': 'Image not found',
                'message': f'Image with ID {image_id} does not exist'
            }, status=404)
    
    # Create jobs
    from datetime import datetime
    from django.utils import timezone
    import uuid
    
    batch_id = uuid.uuid4()
    created_jobs = []
    details = []
    
    job_status = 'scheduled' if schedule_time else 'pending'
    distribution_time = None
    
    if schedule_time:
        try:
            distribution_time = timezone.make_aware(
                datetime.fromisoformat(schedule_time.replace('Z', '+00:00'))
            )
        except (ValueError, TypeError) as e:
            return Response({
                'error': 'Invalid schedule_time',
                'message': f'Please provide schedule_time in ISO format: {str(e)}'
            }, status=400)
    
    for device in devices:
        # Determine image for this device
        device_image = target_image
        
        if auto_select_image and not device_image:
            # Use golden image from device model
            if device.model and device.model.default_image:
                device_image = device.model.default_image
            else:
                # Skip device if no image can be determined
                logger.warning(f"No image found for device {device.hostname}, skipping")
                details.append({
                    'device_id': device.id,
                    'device_hostname': device.hostname,
                    'error': 'No image configured',
                    'message': 'Device model has no golden image set'
                })
                continue
        
        if not device_image:
            details.append({
                'device_id': device.id,
                'device_hostname': device.hostname,
                'error': 'No image specified',
                'message': 'Please provide image_id or set auto_select_image=true'
            })
            continue
        
        # Determine file server (use device's preferred, or image's default)
        file_server = device.preferred_file_server or device_image.file_server
        
        # Build execution plan from workflow
        execution_plan = []
        if workflow:
            for step in workflow.steps.all().order_by('order'):
                execution_plan.append({
                    'name': step.name,
                    'step_type': step.step_type,
                    'config': step.config,
                    'status': 'pending'
                })
        
        # Create job
        job = Job.objects.create(
            device=device,
            image=device_image,
            file_server=file_server,
            workflow=workflow,
            execution_mode=execution_mode,
            batch_id=batch_id,
            distribution_time=distribution_time,
            activate_after_distribute=activate_after_distribute,
            cleanup_flash=cleanup_flash,
            status=job_status,
            steps=execution_plan,
            task_name=f"API Upgrade - {workflow.name if workflow else 'Default'}",
            created_by=request.user
        )
        
        created_jobs.append(job)
        details.append({
            'device_id': device.id,
            'device_hostname': device.hostname,
            'job_id': job.id,
            'image': device_image.filename,
            'workflow': workflow.name if workflow else 'Default',
            'status': job_status
        })
    
    # Trigger execution if not scheduled
    if not schedule_time and created_jobs:
        if execution_mode == 'sequential':
            # Sequential execution - chain jobs
            job_ids = [j.id for j in created_jobs]
            from swim_backend.core.logic import run_sequential_batch
            t = threading.Thread(target=run_sequential_batch, args=(job_ids,))
            t.daemon = True
            t.start()
            logger.info(f"Started sequential upgrade pipeline with {len(job_ids)} jobs")
        else:
            # Parallel execution - run all jobs at once
            for job in created_jobs:
                t = threading.Thread(target=run_swim_job, args=(job.id,))
                t.daemon = True
                t.start()
            logger.info(f"Started parallel upgrade pipeline with {len(created_jobs)} jobs")
    
    return Response({
        'status': 'success',
        'jobs_created': len(created_jobs),
        'job_ids': [j.id for j in created_jobs],
        'execution_mode': execution_mode,
        'scheduled': bool(schedule_time),
        'schedule_time': schedule_time,
        'workflow': workflow.name if workflow else None,
        'details': details
    }, status=201)


@extend_schema(
    parameters=[
        OpenApiParameter(
            name='job_ids',
            type=OpenApiTypes.STR,
            location=OpenApiParameter.QUERY,
            description='Comma-separated list of job IDs (e.g., "1,2,3")',
            required=False
        ),
        OpenApiParameter(
            name='batch_id',
            type=OpenApiTypes.UUID,
            location=OpenApiParameter.QUERY,
            description='Batch UUID to get all jobs in a batch',
            required=False
        )
    ],
    responses={200: OpenApiTypes.OBJECT, 400: OpenApiTypes.OBJECT},
    description="Get status and progress of upgrade jobs by job IDs or batch ID"
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_upgrade_status(request):
    """
    Get status of upgrade jobs
    
    GET /api/upgrade/status/?job_ids=1,2,3
    or
    GET /api/upgrade/status/?batch_id=uuid
    
    Response:
    {
        "jobs": [
            {
                "job_id": 101,
                "device_hostname": "switch-01",
                "status": "success",
                "progress": 100,
                "current_step": "Post-Checks",
                "created_at": "2026-02-02T12:00:00Z",
                "updated_at": "2026-02-02T12:15:00Z"
            }
        ]
    }
    """
    from swim_backend.core.views import JobSerializer
    
    job_ids_param = request.query_params.get('job_ids')
    batch_id_param = request.query_params.get('batch_id')
    
    if job_ids_param:
        # Get specific jobs
        job_ids = [int(id.strip()) for id in job_ids_param.split(',')]
        jobs = Job.objects.filter(id__in=job_ids).order_by('id')
    elif batch_id_param:
        # Get all jobs in a batch
        jobs = Job.objects.filter(batch_id=batch_id_param).order_by('id')
    else:
        return Response({
            'error': 'Missing parameters',
            'message': 'Please provide either job_ids or batch_id'
        }, status=400)
    
    serializer = JobSerializer(jobs, many=True)
    
    # Add progress calculation
    jobs_data = []
    for job_data in serializer.data:
        # Calculate progress based on steps
        steps = job_data.get('steps', [])
        if steps:
            completed = sum(1 for s in steps if s.get('status') == 'success')
            progress = int((completed / len(steps)) * 100) if steps else 0
        else:
            # Fallback to status-based progress
            status = job_data.get('status', 'pending')
            progress_map = {
                'pending': 0,
                'scheduled': 0,
                'distributing': 30,
                'distributed': 50,
                'activating': 75,
                'success': 100,
                'failed': 100,
                'cancelled': 0
            }
            progress = progress_map.get(status, 0)
        
        job_data['progress'] = progress
        
        # Get current step
        if steps:
            current_step = next((s for s in steps if s.get('status') in ['running', 'pending']), None)
            job_data['current_step'] = current_step['name'] if current_step else 'Completed'
        else:
            job_data['current_step'] = job_data.get('status', 'Unknown').title()
        
        jobs_data.append(job_data)
    
    return Response({
        'count': len(jobs_data),
        'jobs': jobs_data
    })


@extend_schema(
    request=CancelUpgradeSerializer,
    responses={200: OpenApiTypes.OBJECT, 400: OpenApiTypes.OBJECT},
    description="Cancel pending or scheduled upgrade jobs",
    examples=[
        OpenApiExample(
            'Cancel Jobs',
            value={'job_ids': [1, 2, 3]},
            request_only=True
        )
    ]
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cancel_upgrade(request):
    """
    Cancel scheduled upgrade jobs
    
    POST /api/upgrade/cancel/
    Body: {
        "job_ids": [1, 2, 3]
    }
    
    Response:
    {
        "status": "success",
        "cancelled": 3,
        "job_ids": [1, 2, 3]
    }
    """
    job_ids = request.data.get('job_ids', [])
    
    if not job_ids:
        return Response({
            'error': 'Missing job_ids',
            'message': 'Please provide job IDs to cancel'
        }, status=400)
    
    jobs = Job.objects.filter(id__in=job_ids, status__in=['pending', 'scheduled'])
    cancelled_count = jobs.update(status='cancelled')
    
    return Response({
        'status': 'success',
        'cancelled': cancelled_count,
        'job_ids': job_ids
    })
