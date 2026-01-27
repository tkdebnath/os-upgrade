from rest_framework import viewsets, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Device, Site, DeviceModel, Region, GlobalCredential
import csv
import io
from .plugins.registry import PluginRegistry
from swim_backend.core.services.sync_service import run_sync_task

class DeviceModelSerializer(serializers.ModelSerializer):
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
        return {
            'version': obj.model.golden_image_version,
            'file': obj.model.golden_image_file
        }

class DeviceModelViewSet(viewsets.ModelViewSet):
    queryset = DeviceModel.objects.all().order_by('name')
    serializer_class = DeviceModelSerializer

    @action(detail=True, methods=['get'])
    def scan_images(self, request, pk=None):
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
        device_ids = request.data.get('ids', [])
        devices = Device.objects.filter(id__in=device_ids)
        results = []
        
        for dev in devices:
            # Mock Logic
            checks = []
            
            # 1. Reachability
            if dev.reachability == 'Reachable':
                checks.append({'name': 'Reachability', 'status': 'Pass', 'message': 'Device is reachable'})
            else:
                checks.append({'name': 'Reachability', 'status': 'Fail', 'message': 'Device is unreachable'})
                
            # 2. Flash Check (Mock)
            # Randomly maintain some failures for demo if needed, but for now pass
            checks.append({'name': 'Flash Space', 'status': 'Pass', 'message': 'Free space: 4.2GB'})
            
            # 3. Config Register (Mock)
            checks.append({'name': 'Config Register', 'status': 'Pass', 'message': '0x2102'})
            
            # 4. Golden Image
            golden = None
            if dev.model and dev.model.golden_image_version:
                golden = dev.model.golden_image_version
                checks.append({'name': 'Golden Image Defined', 'status': 'Pass', 'message': f'Target: {golden}'})
            else:
                checks.append({'name': 'Golden Image Defined', 'status': 'Warning', 'message': 'No standard defined'})
                
            status = 'Ready' if all(c['status'] == 'Pass' for c in checks) else 'Not Ready'
            
            results.append({
                'id': dev.id,
                'hostname': dev.hostname,
                'current_version': dev.version,
                'target_version': golden,
                'status': status,
                'checks': checks
            })
            
        return Response(results)

    @action(detail=False, methods=['post'])
    def distribute_image(self, request):
        """
        Initiates image distribution job.
        """
        device_ids = request.data.get('ids', [])
        created_jobs = []
        from swim_backend.core.models import Job
        from swim_backend.core.services.job_runner import run_swim_job
        import threading

        for dev_id in device_ids:
            # Find the target image from device model
            dev = Device.objects.get(id=dev_id)
            # Find Image object matching the golden_image_file logic if possible
            # For prototype, we just link the device, image link is optional or we find it
            # We need to set 'image' if we want job_runner to work fully (it uses job.image.filename)
            # Let's mock finding or creating an Image object for the golden image
            from swim_backend.images.models import Image
            target_image = None
            if dev.model and dev.model.golden_image_file:
                 target_image, _ = Image.objects.get_or_create(
                     filename=dev.model.golden_image_file, 
                     defaults={'version': dev.model.golden_image_version or '0.0.0'}
                 )

            job = Job.objects.create(
                device_id=dev_id,
                image=target_image,
                file_server=dev.model.default_file_server if dev.model else None,
                status='pending'
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
        from swim_backend.core.models import Job, ValidationCheck
        from swim_backend.core.services.job_runner import orchestrate_jobs
        
        device_ids = request.data.get('ids', [])
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
        
        # Helper to create job
        def create_activation_job(dev_id, mode, is_scheduled_active):
            status = 'pending'
            if schedule_time:
                # If scheduling for later
                if is_scheduled_active:
                    status = 'scheduled'
                else:
                    status = 'pending'
            else:
                # Run Now - dealt with by orchestrator, usually 'pending' then triggered
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
                distribution_time=schedule_time, # Set distribution time to schedule time for UI visibility
                activation_time=schedule_time,
                task_name=task_name,
                batch_id=batch_id,
                execution_mode=mode,
                workflow=workflow_obj
            )
            created_jobs.append(job)
            job_map[dev_id] = job.id
            
            # Link Checks
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
