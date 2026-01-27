from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Job, GoldenImage, ValidationCheck, CheckRun, Workflow, WorkflowStep
from .logic import run_swim_job, log_update
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter
import threading

class GoldenImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = GoldenImage
        fields = '__all__'

class GoldenImageViewSet(viewsets.ModelViewSet):
    queryset = GoldenImage.objects.all()
    serializer_class = GoldenImageSerializer

class CheckRunSerializer(serializers.ModelSerializer):
    check_name = serializers.CharField(source='validation_check.name', read_only=True)
    check_type = serializers.CharField(source='validation_check.check_type', read_only=True)
    check_command = serializers.CharField(source='validation_check.command', read_only=True)
    device_hostname = serializers.CharField(source='device.hostname', read_only=True)

    class Meta:
        model = CheckRun
        fields = ['id', 'status', 'output', 'created_at', 'check_name', 'check_type', 'check_command', 'device_hostname']

class WorkflowStepSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkflowStep
        fields = '__all__'

class WorkflowSerializer(serializers.ModelSerializer):
    steps = WorkflowStepSerializer(many=True, read_only=True)
    
    class Meta:
        model = Workflow
        fields = '__all__'

class WorkflowViewSet(viewsets.ModelViewSet):
    queryset = Workflow.objects.all()
    serializer_class = WorkflowSerializer

    def destroy(self, request, *args, **kwargs):
        if Workflow.objects.count() <= 1:
            return Response(
                {"error": "Cannot delete the last remaining workflow. At least one workflow is required."},
                status=400
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def set_default(self, request, pk=None):
        """
        Sets this workflow as default, unsets others.
        """
        workflow = self.get_object()
        Workflow.objects.all().update(is_default=False)
        workflow.is_default = True
        workflow.save()
        return Response({"status": "default_set", "workflow": workflow.name})

    @action(detail=True, methods=['post'])
    def update_steps(self, request, pk=None):
        """
        Full replace of steps for a workflow.
        Body: [{ "name": "Step 1", "type": "readiness", "order": 1, "config": {} }, ...]
        """
        workflow = self.get_object()
        steps_data = request.data
        
        # Clear existing
        workflow.steps.all().delete()
        
        # Create new
        new_steps = []
        for s in steps_data:
            new_steps.append(WorkflowStep(
                workflow=workflow,
                name=s.get('name'),
                step_type=s.get('step_type'),
                order=s.get('order'),
                config=s.get('config', {})
            ))
        WorkflowStep.objects.bulk_create(new_steps)
        
        return Response({"status": "updated", "count": len(new_steps)})

class WorkflowStepViewSet(viewsets.ModelViewSet):
    queryset = WorkflowStep.objects.all()
    serializer_class = WorkflowStepSerializer

class JobSerializer(serializers.ModelSerializer):
    device_hostname = serializers.CharField(source='device.hostname', read_only=True)
    image_filename = serializers.CharField(source='image.filename', read_only=True)
    workflow_name = serializers.CharField(source='workflow.name', read_only=True)
    check_runs = CheckRunSerializer(many=True, read_only=True)

    class Meta:
        model = Job
        fields = '__all__'

class JobViewSet(viewsets.ModelViewSet):
    queryset = Job.objects.all().order_by('-created_at')
    serializer_class = JobSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['status', 'device', 'task_name']
    search_fields = ['device__hostname', 'device__ip_address', 'status', 'task_name']
    
    def perform_create(self, serializer):
        job = serializer.save()
        # If scheduled for later, we wouldn't run it now. 
        # For prototype simplicity, we run immediately if no schedule provided.
        if not job.distribution_time and not job.activation_time:
            t = threading.Thread(target=run_swim_job, args=(job.id,))
            t.daemon = True
            t.start()
            
    from rest_framework.decorators import action
    from rest_framework.response import Response
    from .logic import run_sequential_batch

    @action(detail=True, methods=['get'])
    def download_artifacts(self, request, pk=None):
        """
        Download various job artifacts (pre/post checks, diff, full report).
        Query Param: type=[report|pre|post|diff|all]
        """
        job = self.get_object()
        type = request.query_params.get('type', 'report')
        
        import io
        import zipfile
        from django.http import HttpResponse

        if type == 'report':
            # Simple Text Report
            content = f"Job Report {job.id} for {job.device_hostname}\n"
            content += f"Status: {job.status}\n"
            content += f"Device: {job.device_hostname}\n"
            content += f"Image: {job.image_filename}\n"
            content += "="*30 + "\n\n"
            content += job.log
            
            response = HttpResponse(content, content_type='text/plain')
            response['Content-Disposition'] = f'attachment; filename="job_{job.id}_report.txt"'
            return response
            
        elif type == 'diff':
            # Mock Diff content if file not found
            content = "Diff content unavailable or not generated."
            # Ideally we check /logs/.../diff_summary.txt
            log_dir = f"logs/{job.device_hostname}/{job.id}/"
            import os
            if os.path.exists(os.path.join(log_dir, 'diff_summary.txt')):
                 with open(os.path.join(log_dir, 'diff_summary.txt'), 'r') as f:
                     content = f.read()
            
            response = HttpResponse(content, content_type='text/plain')
            response['Content-Disposition'] = f'attachment; filename="job_{job.id}_diff.txt"'
            return response

        # For Zip downloads (pre, post, all)
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w') as zip_file:
            
            checks = job.check_runs.all()
            if type == 'pre':
                checks = checks.filter(check_type='pre')
            elif type == 'post':
                checks = checks.filter(check_type='post')
            # else 'all' -> all checks
            
            # Add Check Outputs
            for check in checks:
                safe_cmd = (check.check_command or "unknown").replace(' ','_')
                filename = f"{check.check_type}_{safe_cmd}_{check.id}.txt"
                zip_file.writestr(filename, check.output or "No Output")
                
            # If 'all', also add diff and report
            if type == 'all':
                zip_file.writestr("job_report.txt", job.log)
                # Try to add Diff file
                log_dir = f"logs/{job.device_hostname}/{job.id}/"
                import os
                if os.path.exists(os.path.join(log_dir, 'diff_summary.txt')):
                     zip_file.write(os.path.join(log_dir, 'diff_summary.txt'), arcname="diff_summary.txt")
        
        buffer.seek(0)
        response = HttpResponse(buffer, content_type='application/zip')
        filename = f"job_{job.id}_{type}_artifacts.zip"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        """
        Creates multiple jobs and handles execution mode (Parallel vs Sequential).
        Body: {
            "devices": [1, 2],
            "execution_mode": "parallel" | "sequential",
            "selected_checks": [1, 3],
            ... other job params
        }
        """
        device_ids = request.data.get('devices', [])
        execution_mode = request.data.get('execution_mode', 'parallel')
        
        # Common params
        image_id = request.data.get('image')
        selected_checks = request.data.get('selected_checks', [])
        distribution_time = request.data.get('distribution_time')
        activation_time = request.data.get('activation_time')
        activate_after_distribute = request.data.get('activate_after_distribute', True)
        cleanup_flash = request.data.get('cleanup_flash', False)
        task_name = request.data.get('task_name', 'Upgrade-Task')
        
        # New Params
        import uuid
        batch_id = uuid.uuid4()
        
        created_jobs = []
        for index, dev_id in enumerate(device_ids):
            # If sequential AND scheduled:
            # - First job gets the distribution_time and status='scheduled'
            # - Others get status='pending' (scheduler will ignore them until triggered)
            
            job_status = 'pending'
            job_sched_time = distribution_time
            
            if distribution_time:
                # If Scheduled
                if execution_mode == 'sequential':
                    if index == 0:
                        job_status = 'scheduled'
                    else:
                        job_status = 'pending' # Waiting for previous to finish
                        # We keep distribution_time on them so we know when they *should* have run (or to track sequence)
                        # But status 'pending' keeps them out of scheduler loop
                else:
                    # Parallel
                    job_status = 'scheduled'
            
            # If NOT scheduled (run now), status defaults to pending and we trigger below
            
            job = Job.objects.create(
                device_id=dev_id,
                image_id=image_id,
                distribution_time=job_sched_time,
                activation_time=activation_time,
                activate_after_distribute=activate_after_distribute,
                cleanup_flash=cleanup_flash,
                task_name=task_name,
                batch_id=batch_id,
                execution_mode=execution_mode,
                status=job_status
            )
            if selected_checks:
                job.selected_checks.set(selected_checks)
            created_jobs.append(job)

        # Trigger Execution
        # If scheduled for later, we do nothing (scheduler picks up).
        # We only trigger if NOT scheduled (i.e. Run Now)
        if not distribution_time: 
            if execution_mode == 'sequential':
                # Run in a single background thread sequentially
                job_ids = [j.id for j in created_jobs]
                t = threading.Thread(target=run_sequential_batch, args=(job_ids,))
                t.daemon = True
                t.start()
            else:
                # Parallel: Spawn thread for each (or use pool)
                for job in created_jobs:
                    t = threading.Thread(target=run_swim_job, args=(job.id,))
                    t.daemon = True
                    t.start()
        
        return Response({"status": "jobs_created", "count": len(created_jobs), "mode": execution_mode})
        
        return Response({"status": "jobs_created", "count": len(created_jobs), "mode": execution_mode})

    @action(detail=True, methods=['get'])
    def download_diffs(self, request, pk=None):
        """
        Zips and returns all diff files for the job.
        """
        import zipfile
        import os
        from django.http import HttpResponse
        from io import BytesIO
        
        job = self.get_object()
        log_dir = f"logs/{job.device.hostname}/{job.id}/"
        
        if not os.path.exists(log_dir):
            return Response({"error": "No logs found for this job"}, status=404)
            
        byte_stream = BytesIO()
        with zipfile.ZipFile(byte_stream, 'w') as zf:
            # Add all diff files
            has_diffs = False
            for root, dirs, files in os.walk(log_dir):
                for file in files:
                   if file.startswith("diff_") or file.startswith("precheck_") or file.startswith("postcheck_"):
                       zf.write(os.path.join(root, file), arcname=file)
                       has_diffs = True
                       
            if not has_diffs:
                 zf.writestr("info.txt", "No pre/post check diffs generated for this job.")
        
        response = HttpResponse(byte_stream.getvalue(), content_type='application/zip')
        response['Content-Disposition'] = f'attachment; filename="job_{job.id}_diffs.zip"'
        return response

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        job = self.get_object()
        job.status = 'cancelled'
        job.log += f"\n[{threading.current_thread().name}] Job cancelled by user."
        job.save()
        return Response({"status": "cancelled", "message": "Job cancellation requested."})

    @action(detail=False, methods=['post'])
    def bulk_reschedule(self, request):
        """
        Reschedules multiple jobs to a new time.
        Body: { "ids": [1, 2], "distribution_time": "2023-10-27T10:00:00Z" }
        """
        job_ids = request.data.get('ids', [])
        new_time = request.data.get('distribution_time')
        
        if not job_ids or not new_time:
            return Response({"error": "ids and distribution_time required"}, status=400)
            
        jobs = Job.objects.filter(id__in=job_ids)
        updated_count = jobs.update(distribution_time=new_time, status='scheduled')
        
        # Log the update for each job
        for job in jobs:
            log_update(job.id, f"Rescheduled to {new_time} by user.")
            
        # Re-trigger orchestrator if needed (simplified: we just update DB, scheduler picks up)
        from .services.job_runner import orchestrate_jobs
        # In a real system we might need to cancel existing threads or update them.
        # For this prototype, the scheduler loop (if implemented) or simple periodic checks would handle it.
        # Check if we need to wake up any threads? 
        # Current logic: `orchestrate_jobs` sleeps. Updating variable in thread is hard.
        # Best approach for prototype: Just update DB. 
        # If the job was already run and waiting in `orchestrate_jobs` -> `time.sleep`, it won't see this change easily.
        # BUT, if status is 'scheduled', it implies it hasn't started 'running' or 'distributing' yet.
        
        return Response({"status": "rescheduled", "count": updated_count})

class ValidationCheckSerializer(serializers.ModelSerializer):
    class Meta:
        model = ValidationCheck
        fields = '__all__'

class ValidationCheckViewSet(viewsets.ModelViewSet):
    queryset = ValidationCheck.objects.all()
    serializer_class = ValidationCheckSerializer

from .models import CheckRun
class CheckRunSerializer(serializers.ModelSerializer):
    device_hostname = serializers.CharField(source='device.hostname', read_only=True)
    check_name = serializers.CharField(source='validation_check.name', read_only=True)
    
    class Meta:
        model = CheckRun
        fields = '__all__'

class CheckRunViewSet(viewsets.ModelViewSet):
    """
    API for managing standalone check executions.
    """
    queryset = CheckRun.objects.all().order_by('-created_at')
    serializer_class = CheckRunSerializer
    
    @action(detail=False, methods=['post'])
    def run_readiness(self, request):
        """
        Triggers Readiness Checks (System Checks) on a scope.
        Scope: 'all', 'site', 'selection'.
        """
        from swim_backend.devices.models import Device
        from .logic import run_swim_job # We reuse job logic or specialized check logic. 
        # Actually readiness is part of a Job in current logic. 
        # To run just readiness, we create a Job with 'check_only' mode? 
        # Or we create CheckRuns for specific 'System' checks?
        # Let's create CheckRuns for specific checks mapped to readiness (Flash, ConfigReg).
        # Assuming we have validation checks for these.
        
        scope_type = request.data.get('scope', 'selection')
        scope_value = request.data.get('ids', [])
        site = request.data.get('site')

        devices = []
        if scope_type == 'all':
            devices = Device.objects.all()
        elif scope_type == 'site':
            devices = Device.objects.filter(site=site)
        else:
            devices = Device.objects.filter(id__in=scope_value)
            
        # Get Readiness Checks (Assumption: Category='system')
        checks = ValidationCheck.objects.filter(category='system')
        if not checks.exists():
            # Create default system checks if missing for demo
            from .models import ValidationCheck
            c1 = ValidationCheck.objects.create(name="Flash Verify", command="check_flash", category="system")
            c2 = ValidationCheck.objects.create(name="Config Register", command="check_config_reg", category="system")
            checks = [c1, c2]

        created_runs = []
        from .services.check_runner import run_standalone_check
        
        for dev in devices:
            for check in checks:
                run = CheckRun.objects.create(
                    device=dev,
                    validation_check=check,
                    created_by=request.user if request.user.is_authenticated else None
                )
                created_runs.append(run)
                t = threading.Thread(target=run_standalone_check, args=(run.id,))
                t.daemon = True
                t.start()
                
        return Response({"status": "initiated", "devices": len(devices), "checks_per_device": len(checks)})

    @action(detail=False, methods=['post'])
    def run(self, request):
        """
        Triggers checks on devices.
        Body: { "devices": [1, 2], "checks": [1, 5] }
        """
        device_ids = request.data.get('devices', [])
        check_ids = request.data.get('checks', [])
        
        created_runs = []
        from .logic import run_standalone_check
        
        for dev_id in device_ids:
            for check_id in check_ids:
                run = CheckRun.objects.create(
                    device_id=dev_id,
                    validation_check_id=check_id,
                    created_by=request.user if request.user.is_authenticated else None
                )
                created_runs.append(run)
                
                # Run async
                t = threading.Thread(target=run_standalone_check, args=(run.id,))
                t.daemon = True
                t.start()
        
        return Response({"status": "initiated", "count": len(created_runs)})

class DashboardViewSet(viewsets.ViewSet):
    """
    API for Dashboard aggregations.
    """
    @action(detail=False, methods=['get'])
    def stats(self, request):
        from swim_backend.devices.models import Device
        from .models import Job
        from django.utils import timezone
        import datetime

        total_devices = Device.objects.count()
        sites_qs = Device.objects.values('site').distinct()
        site_count = sites_qs.count()
        
        reachable_count = Device.objects.filter(reachability='Reachable').count()
        unreachable_count = Device.objects.filter(reachability='Unreachable').count()
        
        last_24h = timezone.now() - datetime.timedelta(days=1)
        critical_issues = Job.objects.filter(status='failed', created_at__gte=last_24h).count()
        
        # Calculate health percentage
        health_percentage = 0
        if total_devices > 0:
            health_percentage = int((reachable_count / total_devices) * 100)
            
        from django.db.models import Count

        # Aggregations for Graphs
        devices_per_site = list(Device.objects.values('site__name').annotate(value=Count('id')).order_by('-value'))
        devices_per_model = list(Device.objects.values('model__name').annotate(value=Count('id')).order_by('-value'))
        devices_per_version = list(Device.objects.values('version').annotate(value=Count('id')).order_by('-value'))

        # Compliance Basic Heuristic (Checking if version matches a GoldenImage for that platform)
        # 1. Get map of platform -> golden_version
        golden_map = {}
        for gi in GoldenImage.objects.all():
            golden_map[gi.platform] = gi.image.version if gi.image else None
            
        compliant_count = 0
        non_compliant_count = 0
        
        for dev in Device.objects.all():
            target_version = golden_map.get(dev.platform)
            if target_version and dev.version == target_version:
                compliant_count += 1
            else:
                non_compliant_count += 1

        # Job Status Breakdown
        jobs_running = Job.objects.filter(status__in=['running', 'distributing', 'activating']).count()
        jobs_scheduled = Job.objects.filter(status__in=['scheduled', 'pending']).count()
        jobs_failed = Job.objects.filter(status='failed').count()
        jobs_success = Job.objects.filter(status__in=['success', 'distributed']).count()

        return Response({
            "health": {
                "percentage": health_percentage,
                "reachable": reachable_count,
                "unreachable": unreachable_count,
            },
            "issues": {
                "critical": critical_issues,
                "warning": 0 # Placeholder
            },
            "network": {
                "sites": site_count,
                "devices": total_devices,
                "unprovisioned": 0, # Placeholder
                "unclaimed": 0
            },
            "analytics": {
                "by_site": [{"name": d['site__name'] or 'Unknown', "value": d['value']} for d in devices_per_site],
                "by_model": [{"name": d['model__name'] or 'Unknown', "value": d['value']} for d in devices_per_model],
                "by_version": [{"name": d['version'] or 'Unknown', "value": d['value']} for d in devices_per_version],
                "compliance": [
                    {"name": "Compliant", "value": compliant_count},
                    {"name": "Non-Compliant", "value": non_compliant_count}
                ],
                "job_status": [
                    {"name": "Running", "value": jobs_running},
                    {"name": "Scheduled", "value": jobs_scheduled},
                    {"name": "Failed", "value": jobs_failed},
                    {"name": "Success", "value": jobs_success}
                ]
            }
        })
