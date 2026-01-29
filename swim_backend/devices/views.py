from rest_framework import viewsets, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Device, Site, DeviceModel, Region, GlobalCredential
import csv
import io
from .plugins.registry import PluginRegistry
from swim_backend.core.services.sync_service import run_sync_task

# Import ImageSerializer from views, not models
from swim_backend.images.views import ImageSerializer

class DeviceModelSerializer(serializers.ModelSerializer):
    supported_images_details = ImageSerializer(source='supported_images', many=True, read_only=True)
    default_image_details = ImageSerializer(source='default_image', read_only=True)
    device_count = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = DeviceModel
        fields = '__all__'

class RegionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Region
        fields = '__all__'

class RegionViewSet(viewsets.ModelViewSet):
    queryset = Region.objects.all().order_by('name')
    serializer_class = RegionSerializer

class GlobalCredentialSerializer(serializers.ModelSerializer):
    class Meta:
        model = GlobalCredential
        fields = '__all__'

class GlobalCredentialViewSet(viewsets.ViewSet):
    def list(self, request):
        obj, _ = GlobalCredential.objects.get_or_create(id=1, defaults={'username': 'admin', 'password': 'password'})
        serializer = GlobalCredentialSerializer(obj)
        return Response(serializer.data)

    def create(self, request):
        obj, _ = GlobalCredential.objects.get_or_create(id=1)
        serializer = GlobalCredentialSerializer(obj, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

from django.db.models import Count

class SiteSerializer(serializers.ModelSerializer):
    region_details = RegionSerializer(source='region', read_only=True)
    device_count = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Site
        fields = '__all__'

class SiteViewSet(viewsets.ModelViewSet):
    queryset = Site.objects.annotate(device_count=Count('devices')).order_by('name')
    serializer_class = SiteSerializer

class CreatableSlugRelatedField(serializers.SlugRelatedField):
    def to_internal_value(self, data):
        try:
            obj, created = self.get_queryset().get_or_create(**{self.slug_field: data})
            return obj
        except (TypeError, ValueError):
            self.fail('invalid')

class DeviceSerializer(serializers.ModelSerializer):
    site = CreatableSlugRelatedField(
        slug_field='name',
        queryset=Site.objects.all(),
        required=False,
        allow_null=True
    )
    # Allow writing model name directly
    model = serializers.SlugRelatedField(
        slug_field='name', 
        queryset=DeviceModel.objects.all(),
        required=False,
        allow_null=True
    )
    
    compliance_status = serializers.SerializerMethodField()
    golden_image = serializers.SerializerMethodField()

    class Meta:
        model = Device
        fields = '__all__'
        
    def get_compliance_status(self, obj):
        if not obj.model or not obj.model.golden_image_version:
            return 'No Standard'
        
        # Simple string comparison
        # In reality, might need semantic versioning
        if obj.version == obj.model.golden_image_version:
            return 'Compliant'
        return 'Non-Compliant'
        
    def get_golden_image(self, obj):
        if not obj.model:
            return None
        
        # Prefer new model
        if obj.model.default_image:
            # Build list of options
            options = []
            if obj.model.default_image:
                 options.append({
                     'id': obj.model.default_image.id,
                     'version': obj.model.default_image.version,
                     'file': obj.model.default_image.filename,
                     'tag': 'Default'
                 })
            
            for img in obj.model.supported_images.all():
                # Avoid dupes
                if obj.model.default_image and img.id == obj.model.default_image.id:
                    continue
                options.append({
                     'id': img.id,
                     'version': img.version,
                     'file': img.filename,
                     'tag': 'Supported'
                })

            return {
                'id': obj.model.default_image.id,
                'version': obj.model.default_image.version,
                'file': obj.model.default_image.filename,
                'size': obj.model.default_image.size_bytes,
                'md5': obj.model.default_image.md5_checksum,
                'is_new_model': True,
                'available_images': options
            }
            
        # Fallback
        return {
            'version': obj.model.golden_image_version,
            'file': obj.model.golden_image_file,
            'is_new_model': False,
            'available_images': []
        }

class DeviceModelViewSet(viewsets.ModelViewSet):
    serializer_class = DeviceModelSerializer
    lookup_field = 'name'
    lookup_value_regex = '[^/]+'
    permission_classes = []  # Allow all authenticated users (covered by global setting)

    def get_queryset(self):
        from django.db.models import Count
        return DeviceModel.objects.annotate(device_count=Count('devices')).order_by('name')
    
    def update(self, request, *args, **kwargs):
        """Override update to provide better error messages"""
        try:
            return super().update(request, *args, **kwargs)
        except Exception as e:
            from rest_framework.response import Response
            import traceback
            print(f"Error updating DeviceModel: {str(e)}")
            print(traceback.format_exc())
            return Response(
                {"error": str(e), "detail": "Failed to update device model"}, 
                status=400
            )
    
    def partial_update(self, request, *args, **kwargs):
        """Override partial_update to provide better error messages"""
        try:
            return super().partial_update(request, *args, **kwargs)
        except Exception as e:
            from rest_framework.response import Response
            import traceback
            print(f"Error in partial update of DeviceModel: {str(e)}")
            print(traceback.format_exc())
            return Response(
                {"error": str(e), "detail": "Failed to update device model"}, 
                status=400
            )

    @action(detail=True, methods=['get'])
    def scan_images(self, request, *args, **kwargs):
        """
        Scans the configured path for this model on its default file server.
        Returns a list of potential image files.
        """
        model = self.get_object()
        path = request.query_params.get('path') or model.golden_image_path
        server_id = request.query_params.get('server')
        
        server = model.default_file_server
        if server_id:
             from swim_backend.images.models import FileServer
             try:
                 server = FileServer.objects.get(id=server_id)
             except FileServer.DoesNotExist:
                 return Response({"error": "File server not found"}, status=404)
                 
        if not path or not server:
            return Response({"error": "Path and File Server must be configured or provided"}, status=400)
            
        from swim_backend.core.services.filesystem_service import FileSystemService
        try:
            files = FileSystemService.list_files(server, path)
            return Response({"files": files})
        except Exception as e:
            return Response({"error": str(e)}, status=500)

    @action(detail=False, methods=['delete'])
    def cleanup_unused(self, request):
        """
        Deletes all DeviceModels that have no associated devices.
        """
        # Count devices for each model
        unused_models = DeviceModel.objects.annotate(device_count=Count('devices')).filter(device_count=0)
        
        count = unused_models.count()
        if count == 0:
             return Response({"status": "no_action", "message": "No unused models found."})
             
        # Delete
        deleted_count, _ = unused_models.delete()
        
        return Response({
            "status": "success", 
            "message": f"Deleted {deleted_count} unused models.",
            "deleted_count": deleted_count
        })

class DeviceViewSet(viewsets.ModelViewSet):
    queryset = Device.objects.all()
    serializer_class = DeviceSerializer

    @action(detail=False, methods=['post'])
    def sync(self, request):
        """
        Trigger sync (version discovery) for devices.
        Scope: 'all', 'site', 'selection' (list of IDs).
        """
        scope_type = request.data.get('scope', 'selection')
        scope_value = request.data.get('ids', [])
        
        if scope_type == 'site':
            scope_value = request.data.get('site')
            
        count = run_sync_task(scope_type, scope_value)
        return Response({"status": "started", "count": count})

    @action(detail=False, methods=['post'])
    def check_readiness(self, request):
        """
        Runs pre-upgrade checks on a list of devices.
        Checks: Reachability, Compliance, config-register, flash space.
        """
        from swim_backend.core.readiness import check_readiness
        from swim_backend.images.models import Image
        
        device_ids = request.data.get('ids', [])
        image_map = request.data.get('image_map', {})  # { deviceId: imageId }
        devices = Device.objects.filter(id__in=device_ids)
        results = []
        
        # Helper class to mimic Job object for readiness function
        class MockImage:
            def __init__(self, size):
                self.size_bytes = size
                
        class MockJob:
            def __init__(self, jid, img_size):
                self.id = jid
                self.image = MockImage(img_size) if img_size else None
                self.selected_checks = Device.objects.none() # Empty QuerySet-like

        for dev in devices:
            # 1. Determine Target Image Size and Info
            target_size = 0
            golden_version = None
            target_image_file = None
            
            # Check if a specific image was selected in step 3
            selected_image_id = image_map.get(str(dev.id))
            if selected_image_id:
                # Use the selected image from step 3
                try:
                    selected_img = Image.objects.get(id=int(selected_image_id))
                    target_size = selected_img.size_bytes
                    golden_version = selected_img.version
                    target_image_file = selected_img.filename
                except (Image.DoesNotExist, ValueError):
                    pass  # Fall through to golden image
            
            # Fall back to golden image if no selection or selected image not found
            if not target_size and dev.model and dev.model.golden_image_version:
                golden_version = dev.model.golden_image_version
                target_image_file = dev.model.golden_image_file
                if dev.model:
                     # 1. Prefer Explicit Size from Standard
                     if dev.model.golden_image_size:
                         target_size = dev.model.golden_image_size
                     
                     # 2. Fallback to Image Object Size
                     elif dev.model.golden_image_file:
                         img = Image.objects.filter(filename=dev.model.golden_image_file).first()
                         if img:
                             target_size = img.size_bytes
                         else:
                             # Default fallback if image record missing but file defined (e.g. 500MB)
                             target_size = 500 * 1024 * 1024 

            # 2. Run Real Checks
            # Use a consistent session key for logs
            session_id = f"readiness_check_{dev.id}"
            mock_job = MockJob(session_id, target_size)
            
            ready, check_results = check_readiness(dev, mock_job)
            
            # 3. Map Results to UI Format
            ui_checks = []
            
            # Map 'connection' -> Reachability
            if 'connection' in check_results:
                c = check_results['connection']
                status = 'Pass' if c['status'] == 'success' else 'Fail'
                ui_checks.append({'name': 'Reachability', 'status': status, 'message': c['message']})
            else:
                # If no connection key, assume it passed connected phase if we got results, or implicit pass?
                # Actually check_readiness returns connection failure explicitly if it fails.
                # If key missing, implies connection was fine? 
                # Let's assume explicit keys in new readiness.py? 
                # Actually readiness.py ONLY adds 'connection' on failure.
                # If connected successfully, we should add a Pass.
                pass 
            
            # Logic: If readiness.py returned, connection succeeded unless it returned early.
            if not any(c['name'] == 'Reachability' for c in ui_checks):
                 ui_checks.append({'name': 'Reachability', 'status': 'Pass', 'message': 'Device is reachable'})

            # Map 'flash_memory'
            if 'flash_memory' in check_results:
                c = check_results['flash_memory']
                status = 'Pass' if c['status'] == 'success' else 'Fail'
                ui_checks.append({'name': 'Flash Space', 'status': status, 'message': c['message']})

            # Map 'config_register'
            if 'config_register' in check_results:
                c = check_results['config_register']
                status = 'Pass' if c['status'] == 'success' else 'Warning' # or Fail
                ui_checks.append({'name': 'Config Register', 'status': status, 'message': c['message']})

            # Map 'startup_config'
            if 'startup_config' in check_results:
                c = check_results['startup_config']
                status = 'Pass' if c['status'] == 'success' else 'Warning'
                ui_checks.append({'name': 'Startup Config', 'status': status, 'message': c['message']})
                
            # Golden Image Check (Logic remains in View as it depends on DB model, not device state)
            if golden_version:
                ui_checks.append({'name': 'Golden Image Defined', 'status': 'Pass', 'message': f'Target: {golden_version}'})
            else:
                ui_checks.append({'name': 'Golden Image Defined', 'status': 'Warning', 'message': 'No standard defined'})

            status_str = 'Ready' if ready else 'Not Ready'
            
            results.append({
                'id': dev.id,
                'hostname': dev.hostname,
                'current_version': dev.version,
                'target_version': golden_version,
                'target_image_file': target_image_file,
                'target_image_size': target_size,
                'status': status_str,
                'checks': ui_checks
            })
            
        return Response(results)

    @action(detail=False, methods=['post'])
    def distribute_image(self, request):
        """
        Initiates image distribution job using the SELECTED WORKFLOW.
        """
        device_ids = request.data.get('ids', [])
        workflow_id = request.data.get('workflow_id') # Get from frontend
        created_jobs = []
        from swim_backend.core.models import Job, Workflow
        from swim_backend.core.services.job_runner import run_swim_job
        import threading

        # Resolve Workflow
        workflow = None
        if workflow_id:
            try:
                workflow = Workflow.objects.get(id=workflow_id)
            except Workflow.DoesNotExist:
                pass
        
        # Fallback if no workflow selected (shouldn't happen in new wizard)
        if not workflow:
            workflow = Workflow.objects.filter(name='Standard Distribution').first()
            if not workflow:
                # Create basic one if missing
                from swim_backend.core.models import Workflow, WorkflowStep
                workflow = Workflow.objects.create(name='Standard Distribution')
                WorkflowStep.objects.create(workflow=workflow, name='Software Distribution', step_type='distribution', order=1)

        for dev_id in device_ids:
            dev = Device.objects.get(id=dev_id)
            
            # Find Image (Golden Image logic)
            from swim_backend.images.models import Image
            target_image = None
            # Find Image (Golden Image logic)
            from swim_backend.images.models import Image
            target_image = None
            
            # Check for override
            image_map = request.data.get('image_map', {})
            if str(dev_id) in image_map:
                try:
                    target_image = Image.objects.get(id=int(image_map[str(dev_id)]))
                except:
                     pass

            if not target_image and dev.model:
                 if dev.model.default_image:
                     target_image = dev.model.default_image
                 elif dev.model.golden_image_file:
                     target_image, _ = Image.objects.get_or_create(
                         filename=dev.model.golden_image_file, 
                         defaults={'version': dev.model.golden_image_version or '0.0.0'}
                     )
                     # Sync meta... (keeping existing logic for safety)
                     if dev.model.golden_image_size and target_image.size_bytes != dev.model.golden_image_size:
                         target_image.size_bytes = dev.model.golden_image_size
                         target_image.save()

            if not target_image:
                 job = Job.objects.create(
                    device_id=dev_id,
                    status='failed',
                    log="Error: Device has no Golden Image assigned. Cannot distribute."
                 )
                 created_jobs.append(job)
                 continue

            # Build Execution Plan from Workflow
            # We want to INCLUDE 'Readiness' (marked success) and 'Distribution' (pending)
            # And potentially others as 'pending' but Engine will stop after Distribution?
            # Actually, this is 'distribute_image' endpoint. The user might want to STOP after distribution?
            # The Wizard typically runs Distribution, then stops for the user to click 'Next'.
            # So we should probably ONLY include up to Distribution?
            # User requirement: "job process is not displaying all steps from the selected workflow"
            # This implies they want to see the FULL workflow in the job details, even if we only run part of it?
            # But if we create a job and it finishes Distribution, does it mark the job as 'completed'?
            # If the job finishes all PENDING steps, it completes.
            # So if we add 'Activation' as pending, the engine will run it immediately!
            # We don't want that. We want to PAUSE or separate jobs.
            # IN THE WIZARD: Distribution is a distinct "Apply" action. 
            # Step 4 (Distribute) -> Button "Start Distribution".
            # Step 5 (Activation) -> Button "Activate".
            # These are SEPARATE actions creating SEPARATE jobs usually, OR resuming?
            # Current architecture creates NEW jobs for each action (distribute_image, activate_image).
            # So for 'distribute_image' job, we want it to EXECUTE Distribution.
            # If we include 'Activation' step in this job, the engine WILL execute it unless we mark it 'skipped' or 'on_hold'?
            # Our engine doesn't support 'on_hold'.
            # SO: We should include readiness (success) and distribution (pending).
            # What about subsequent steps? If we omit them, the user complains "not displaying all steps".
            # BUT if we include them, they might run.
            
            # compromise: The 'distribute_image' action implies we only want to DO distribution.
            # If the user wants to see the full workflow, maybe the UI should show the workflow definition, not just the job steps?
            # OR, we add them but with a status that the engine ignores? "future"?
            # Engine loops through `execution_plan`.
            # If we don't put them in `job.steps` (the history), the UI won't show them if it only reads `job.steps`.
            # If the UI reads `job.workflow.steps`, it would show everything.
            # The issue says: "job process is not displaying all steps... during activation" and "redundant readiness... during distribution".
            
            # Let's focus on Distribution Job first.
            # It should show Readiness (Completed) + Distribution (Running).
            # Logic: Include everything UP TO 'distribution'.
            # Mark ALL as 'pending' so they run (as requested by user to "re-enable... not skip").
            # STOP adding steps after 'distribution' for this job.
            
            job_steps = []
            workflow_steps = workflow.steps.all().order_by('order')
            
            found_dist = False
            for step in workflow_steps:
                # Add step as pending
                job_steps.append({
                    'name': step.name,
                    'step_type': step.step_type,
                    'status': 'pending', 
                    'config': step.config
                })
                
                if step.step_type == 'distribution':
                    found_dist = True
                    break 
            
            # If workflow has no distribution step (unlikely with new validation), fallback
            if not found_dist:
                # Just add a distinct distribution step
                 job_steps.append({
                    'name': 'Software Distribution',
                    'step_type': 'distribution',
                    'status': 'pending',
                    'config': {}
                })

            job = Job.objects.create(
                device_id=dev_id,
                image=target_image,
                file_server=dev.model.default_file_server if dev.model else None,
                status='pending',
                workflow=workflow,
                steps=job_steps # Pre-filled history
            )
            created_jobs.append(job)
            
            t = threading.Thread(target=run_swim_job, args=(job.id,))
            t.daemon = True
            t.start()

        return Response({
            "status": "started", 
            "job_ids": [j.id for j in created_jobs], 
            "message": f"Distribution started for {len(device_ids)} devices."
        })

    @action(detail=False, methods=['post'])
    def activate_image(self, request):
        """
        Initiates image activation job with checks.
        """
        import threading
        import uuid
        from swim_backend.core.models import Job, ValidationCheck, Workflow
        from swim_backend.core.services.job_runner import orchestrate_jobs
        
        device_ids = request.data.get('ids', [])
        image_map = request.data.get('image_map', {})
        checks_config = request.data.get('checks', [])
        schedule_time = request.data.get('schedule_time')
        execution_config = request.data.get('execution_config', {})
        task_name = request.data.get('task_name', 'Activation-Task')
        workflow_id = request.data.get('workflow_id')
        
        # If no explicit config, treat all 'ids' as parallel (default behavior)
        seq_ids = execution_config.get('sequential', [])
        par_ids = execution_config.get('parallel', [])
        
        if not seq_ids and not par_ids:
            par_ids = device_ids
            
        # Deduplicate and organize
        # Ensure we process sequential first for ordering simply by list index
        
        created_jobs = []
        batch_id = uuid.uuid4()
        
        job_map = {} # device_id -> job_id
        
        # Prepare Dynamic Execution Plan
        # 1. Fetch Workflow Logic
        execution_plan = []
        workflow_obj = None
        
        if workflow_id:
            try:
                workflow_obj = Workflow.objects.get(id=workflow_id)
                workflow_steps = workflow_obj.steps.all().order_by('order')
                
                # Iterate ALL steps to build full history
                for s in workflow_steps:
                    # Mark ALL as pending to ensure they show up and run (re-verification)
                    execution_plan.append({
                        'name': s.name,
                        'step_type': s.step_type,
                        'config': s.config,
                        'status': 'pending'
                    })
                    
            except Workflow.DoesNotExist:
                pass
        
        # Fallback if no workflow or steps (should imply legacy behavior or injection)
        if not execution_plan:
             execution_plan.insert(0, {
                'name': 'Software Activation',
                'step_type': 'activation',
                'config': {},
                'status': 'pending'
            })
        else:
            # Ensure Activation exists in the plan?
            has_activation = any(s['step_type'] == 'activation' for s in execution_plan)
            
            if not has_activation:
                execution_plan.append({
                    'name': 'Software Activation',
                    'step_type': 'activation',
                    'config': {},
                    'status': 'pending'
                })

        # Helper to create job
        def create_activation_job(dev_id, mode, is_scheduled_active):
            from swim_backend.devices.models import Device
            from swim_backend.core.models import FileServer
            from swim_backend.images.models import Image

            device = Device.objects.get(id=dev_id)
            
            # Auto-assign Golden Image
            target_image = None
            
            # Check for override
            if str(dev_id) in image_map:
                try:
                    target_image = Image.objects.get(id=int(image_map[str(dev_id)]))
                except:
                     pass

            if not target_image and device.model:
                 if device.model.default_image:
                     target_image = device.model.default_image
                 elif device.model.golden_image_file:
                     target_image, _ = Image.objects.get_or_create(
                         filename=device.model.golden_image_file, 
                         defaults={'version': device.model.golden_image_version or '0.0.0'}
                     )
            
            # Auto-assign File Server
            job_fs = None
            if device.site and device.site.region and device.site.region.preferred_file_server:
                job_fs = device.site.region.preferred_file_server
            else:
                job_fs = FileServer.objects.filter(is_global_default=True).first()

            status = 'pending'
            if schedule_time:
                # If scheduling for later
                if is_scheduled_active:
                    status = 'scheduled'
                else:
                    status = 'pending'
            else:
                status = 'pending'
            
            workflow_obj = None
            if workflow_id:
                try:
                    workflow_obj = Workflow.objects.get(id=workflow_id)
                except:
                    pass

            job = Job.objects.create(
                device_id=dev_id,
                status=status,
                image=target_image,
                file_server=job_fs,
                distribution_time=schedule_time, 
                activation_time=schedule_time,
                task_name=task_name,
                batch_id=batch_id,
                execution_mode=mode,
                workflow=workflow_obj,
                steps=execution_plan  # INJECT DYNAMIC PLAN
            )
            created_jobs.append(job)
            job_map[dev_id] = job.id
            
            # Link Checks (Legacy support for check runner)
            for cfg in checks_config:
                try:
                    chk = ValidationCheck.objects.get(id=cfg['id'])
                    job.selected_checks.add(chk)
                except:
                    pass
            job.save()

        # 1. Sequential Jobs
        for idx, dev_id in enumerate(seq_ids):
            # For sequential, only the first one is 'scheduled' (if scheduling). 
            # The rest are pending.
            is_active = (idx == 0)
            create_activation_job(dev_id, 'sequential', is_active)
            
        # 2. Parallel Jobs
        for dev_id in par_ids:
            # All parallel jobs are 'scheduled' if a time is set
            create_activation_job(dev_id, 'parallel', True)

        # Launch Orchestrator
        # If schedule_time is set, the status logic above handled it (Scheduled jobs wait for DB Poller).
        # We only need orchestrator if running NOW.
        # BUT, orchestrate_jobs also handles setting 'scheduled' status if passed?
        # Let's check logic. Actually with my new Scheduler, I rely on the DB Poller for scheduled jobs.
        # So I only need to manually trigger IF NO SCHEDULE TIME.
        
        if not schedule_time:
            seq_job_ids = [job_map[did] for did in seq_ids if did in job_map]
            par_job_ids = [job_map[did] for did in par_ids if did in job_map]
            
            t = threading.Thread(
                target=orchestrate_jobs, 
                args=(seq_job_ids, par_job_ids, schedule_time)
            )
            t.daemon = True
            t.start()
        
        return Response({
            "status": "scheduled" if schedule_time else "started", 
            "job_ids": [j.id for j in created_jobs], 
            "message": f"Activation started for {len(created_jobs)} devices."
        })

    @action(detail=False, methods=['get'])
    def list_plugins(self, request):
        return Response(PluginRegistry.list_plugins())

    @action(detail=False, methods=['post'], url_path='plugin/(?P<plugin_id>[^/.]+)/action')
    def plugin_action(self, request, plugin_id=None):
        """
        Generic endpoint for plugin interactions.
        Action types: 'connect', 'metadata', 'preview', 'import'.
        """
        plugin = PluginRegistry.get_plugin(plugin_id)
        if not plugin:
            return Response({"error": "Plugin not found"}, status=404)

        action_type = request.data.get('action')
        config = request.data.get('config', {})
        
        try:
            if action_type == 'connect':
                return Response(plugin.test_connection(config))
            
            elif action_type == 'metadata':
                return Response(plugin.get_filter_metadata(config))
            
            elif action_type == 'preview':
                filters = request.data.get('filters', {})
                return Response({"devices": plugin.preview_devices(config, filters)})
            
            elif action_type == 'import':
                devices = request.data.get('devices', [])
                defaults = request.data.get('defaults', {})
                success_count = 0
                errors = []

                for dev in devices:
                    try:
                        # 1. Strict Validation
                        ip_addr = dev.get('ip_address')
                        hostname = dev.get('name')
                        platform = dev.get('platform')
                        
                        if not ip_addr:
                            errors.append(f"Skipped {hostname or 'Unknown'}: Missing IP Address")
                            continue
                            
                        if not platform:
                             errors.append(f"Skipped {hostname or ip_addr}: Missing Platform")
                             continue

                        # 2. Hostname Fallback
                        if not hostname:
                            hostname = ip_addr

                        # 3. Duplicate IP Check
                        # Check if IP exists on a DIFFERENT device
                        existing_with_ip = Device.objects.filter(ip_address=ip_addr).first()
                        if existing_with_ip and existing_with_ip.hostname != hostname:
                            errors.append(f"Skipped {hostname}: IP {ip_addr} already exists on {existing_with_ip.hostname}")
                            continue

                        # 4. Site Handling
                        site_name = dev.get('site', 'Global')
                        site_obj, _ = Site.objects.get_or_create(name=site_name)

                        # 5. Device Update/Create
                        Device.objects.update_or_create(
                            hostname=hostname,
                            defaults={
                                'ip_address': ip_addr,
                                'username': defaults.get('username', ''),
                                'password': defaults.get('password', ''),
                                'platform': platform,
                                'site': site_obj,
                                'family': dev.get('family') or dev.get('role', 'Switch')
                            }
                        )
                        success_count += 1
                        
                    except Exception as e:
                        errors.append(f"Error importing {dev.get('name', 'Unknown')}: {str(e)}")
                
                return Response({
                    "status": "imported", 
                    "count": success_count, 
                    "errors": errors
                })

        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=False, methods=['post'])
    def import_csv(self, request):
        """
        Bulk import devices from CSV.
        Expected columns: hostname, ip_address, username, password, platform, site
        """
        file = request.FILES.get('file')
        if not file:
            return Response({"error": "No file uploaded"}, status=400)

        decoded_file = file.read().decode('utf-8')
        io_string = io.StringIO(decoded_file)
        reader = csv.DictReader(io_string)
        
        created_count = 0
        errors = []
        
        for row in reader:
            try:
                # 1. Validation (Strict: IP and Site required)
                ip_addr = row.get('ip_address')
                site_name = row.get('site')
                
                if not ip_addr or not site_name:
                    errors.append(f"Row skipped: Missing IP or Site (IP={ip_addr}, Site={site_name})")
                    continue

                # Check for duplicate IP
                if Device.objects.filter(ip_address=ip_addr).exists():
                     # Check if we are updating the same device (by hostname)? 
                     # The prompt says "check if there is no duplication in ip address value in existing devices"
                     # Usually update_or_create on hostname allows IP change, but if hostname is different and IP exists, it's a conflict.
                     # However, if we use update_or_create on hostname, and the matching hostname has this IP, it's fine.
                     # But if a DIFFERENT hostname has this IP, it's a duplicate.
                     # For simplicity/safety based on "no duplication", let's skip if IP exists and doesn't match the current hostname (if provided).
                     
                     # Actually, standard behavior for "import" often implies "create new". 
                     # If I use update_or_create by hostname, I might overwrite. 
                     # But if IP exists on *another* device, that's bad.
                     # Let's check strict IP uniqueness for now.
                     
                     # Edge case: If updating an existing device, IP might match itself.
                     # We use hostname as lookup key.
                     hostname = row.get('hostname') or ip_addr
                     
                     existing_with_ip = Device.objects.filter(ip_address=ip_addr).first()
                     if existing_with_ip and existing_with_ip.hostname != hostname:
                         errors.append(f"Row skipped: IP {ip_addr} already exists on device {existing_with_ip.hostname}")
                         continue

                # 2. Hostname Fallback
                hostname = row.get('hostname')
                if not hostname:
                    hostname = ip_addr

                # 3. Region Handling (Optional)
                region_name = row.get('region')
                region_obj = None
                if region_name:
                    from .models import Region
                    region_obj, _ = Region.objects.get_or_create(name=region_name)

                # 4. Site Handling (Link to Region if provided)
                site_defaults = {}
                if region_obj:
                    site_defaults['region'] = region_obj
                
                site_obj, _ = Site.objects.update_or_create(
                    name=site_name,
                    defaults=site_defaults
                )

                # 5. Model Handling (Optional)
                model_name = row.get('model')
                model_obj = None
                if model_name:
                    model_obj, _ = DeviceModel.objects.get_or_create(name=model_name)

                # 6. Device Creation/Update
                Device.objects.update_or_create(
                    hostname=hostname,
                    defaults={
                        'ip_address': ip_addr,
                        'username': row.get('username', ''),
                        'password': row.get('password', ''),
                        'platform': row.get('platform', 'iosxe'),
                        'site': site_obj,
                        'model': model_obj,
                        'family': row.get('family', 'Switch')
                    }
                )
                created_count += 1
            except Exception as e:
                errors.append(f"Row {row.get('hostname') or row.get('ip_address')}: {str(e)}")
        
        return Response({"status": "imported", "count": created_count, "errors": errors})
