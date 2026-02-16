from rest_framework import viewsets, serializers, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser
from rest_framework.filters import SearchFilter
from django_filters.rest_framework import DjangoFilterBackend
from django_filters import rest_framework as django_filters
from .models import Device, Site, DeviceModel, Region, GlobalCredential
import csv
import io
import os
from .plugins.registry import PluginRegistry
from swim_backend.core.services.sync_service import run_sync_task

# Pull Image details from images app
from swim_backend.images.views import ImageSerializer


# Custom FilterSets to avoid 'model' field conflicts
class DeviceFilter(django_filters.FilterSet):
    # Standard filters (case-sensitive)
    hostname = django_filters.CharFilter(lookup_expr="exact")
    ip_address = django_filters.CharFilter(lookup_expr="icontains")
    platform = django_filters.CharFilter(lookup_expr="exact")
    version = django_filters.CharFilter(lookup_expr="exact")
    family = django_filters.ChoiceFilter(choices=Device.FAMILY_CHOICES)
    reachability = django_filters.CharFilter(lookup_expr="iexact")
    last_sync_status = django_filters.CharFilter(lookup_expr="iexact")
    mac_address = django_filters.CharFilter(lookup_expr="contains")
    boot_method = django_filters.CharFilter(lookup_expr="contains")
    site = django_filters.NumberFilter(field_name="site__id")
    site__name = django_filters.CharFilter(field_name="site__name", lookup_expr="exact")
    device_model = django_filters.NumberFilter(field_name="model__id")

    # Additional filters: case-insensitive exact match (__ie)
    hostname__ie = django_filters.CharFilter(
        field_name="hostname", lookup_expr="iexact"
    )
    mac_address__ie = django_filters.CharFilter(
        field_name="mac_address", lookup_expr="iexact"
    )
    boot_method__ie = django_filters.CharFilter(
        field_name="boot_method", lookup_expr="iexact"
    )
    platform__ie = django_filters.CharFilter(
        field_name="platform", lookup_expr="iexact"
    )
    version__ie = django_filters.CharFilter(field_name="version", lookup_expr="iexact")
    site__name__ie = django_filters.CharFilter(
        field_name="site__name", lookup_expr="iexact"
    )

    # Additional filters: case-insensitive contains (__ic)
    hostname__ic = django_filters.CharFilter(
        field_name="hostname", lookup_expr="icontains"
    )
    mac_address__ic = django_filters.CharFilter(
        field_name="mac_address", lookup_expr="icontains"
    )
    boot_method__ic = django_filters.CharFilter(
        field_name="boot_method", lookup_expr="icontains"
    )
    platform__ic = django_filters.CharFilter(
        field_name="platform", lookup_expr="icontains"
    )
    version__ic = django_filters.CharFilter(
        field_name="version", lookup_expr="icontains"
    )
    site__name__ic = django_filters.CharFilter(
        field_name="site__name", lookup_expr="icontains"
    )

    class Meta:
        model = Device
        fields = [
            "hostname",
            "ip_address",
            "platform",
            "version",
            "family",
            "reachability",
            "last_sync_status",
            "mac_address",
            "boot_method",
            "site",
            "site__name",
            "device_model",
        ]


class DeviceModelFilter(django_filters.FilterSet):
    name = django_filters.CharFilter(lookup_expr="icontains")
    vendor = django_filters.CharFilter(lookup_expr="icontains")
    golden_image_version = django_filters.CharFilter(lookup_expr="icontains")

    class Meta:
        model = DeviceModel
        fields = ["name", "vendor", "golden_image_version"]


class DeviceModelSerializer(serializers.ModelSerializer):
    supported_images_details = ImageSerializer(
        source="supported_images", many=True, read_only=True
    )
    default_image_details = ImageSerializer(source="default_image", read_only=True)
    device_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = DeviceModel
        fields = "__all__"


class RegionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Region
        fields = "__all__"


class RegionViewSet(viewsets.ModelViewSet):
    queryset = Region.objects.all().order_by("name")
    serializer_class = RegionSerializer


class GlobalCredentialSerializer(serializers.ModelSerializer):
    # Override password and secret fields to never return actual values
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    secret = serializers.CharField(write_only=True, required=False, allow_blank=True)

    # Add read-only fields to indicate if password/secret are set
    has_password = serializers.SerializerMethodField()
    has_secret = serializers.SerializerMethodField()

    class Meta:
        model = GlobalCredential
        fields = ["id", "username", "password", "secret", "has_password", "has_secret"]

    def get_has_password(self, obj):
        return bool(obj.password)

    def get_has_secret(self, obj):
        return bool(obj.secret)


class GlobalCredentialViewSet(viewsets.ViewSet):
    def get_permissions(self):
        """Only admins can see/change global device credentials"""
        from rest_framework.permissions import BasePermission

        class IsSuperUser(BasePermission):
            def has_permission(self, request, view):
                return (
                    request.user
                    and request.user.is_authenticated
                    and request.user.is_superuser
                )

        return [IsSuperUser()]

    def list(self, request):
        # Get credentials from environment variables as defaults
        default_username = os.getenv("GLOBAL_DEVICE_USERNAME", "admin")
        default_password = os.getenv("GLOBAL_DEVICE_PASSWORD", "password")
        default_secret = os.getenv("GLOBAL_DEVICE_SECRET", "")

        obj, _ = GlobalCredential.objects.get_or_create(
            id=1,
            defaults={
                "username": default_username,
                "password": default_password,
                "secret": default_secret,
            },
        )
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
    region_details = RegionSerializer(source="region", read_only=True)
    device_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Site
        fields = "__all__"


class SiteViewSet(viewsets.ModelViewSet):
    queryset = Site.objects.annotate(device_count=Count("devices")).order_by("name")
    serializer_class = SiteSerializer


class CreatableSlugRelatedField(serializers.SlugRelatedField):
    def to_internal_value(self, data):
        try:
            obj, created = self.get_queryset().get_or_create(**{self.slug_field: data})
            return obj
        except (TypeError, ValueError):
            self.fail("invalid")


class DeviceSerializer(serializers.ModelSerializer):
    site = CreatableSlugRelatedField(
        slug_field="name", queryset=Site.objects.all(), required=False, allow_null=True
    )
    # Allow writing model name directly
    model = serializers.SlugRelatedField(
        slug_field="name",
        queryset=DeviceModel.objects.all(),
        required=False,
        allow_null=True,
    )

    # Add ID fields for frontend routing
    site_id = serializers.IntegerField(
        source="site.id", read_only=True, allow_null=True
    )
    model_id = serializers.IntegerField(
        source="model.id", read_only=True, allow_null=True
    )

    compliance_status = serializers.SerializerMethodField()
    golden_image = serializers.SerializerMethodField()

    class Meta:
        model = Device
        fields = "__all__"

    def get_compliance_status(self, obj):
        if not obj.model:
            return "No Standard"

        # Get golden version from either the new default_image or old golden_image_version field
        golden_version = None
        if obj.model.default_image:
            golden_version = obj.model.default_image.version
        elif obj.model.golden_image_version:
            golden_version = obj.model.golden_image_version

        if not golden_version:
            return "No Standard"

        # Version comparison to match dashboard logic
        def compare_versions(v1, v2):
            """Returns: -1 (v1 < v2), 0 (equal), 1 (v1 > v2), None (error)"""
            if not v1 or not v2:
                return None
            try:
                p1 = str(v1).replace("-", ".").split(".")
                p2 = str(v2).replace("-", ".").split(".")
                for i in range(max(len(p1), len(p2))):
                    val1 = p1[i] if i < len(p1) else "0"
                    val2 = p2[i] if i < len(p2) else "0"
                    try:
                        n1 = int("".join(filter(str.isdigit, val1)) or "0")
                        n2 = int("".join(filter(str.isdigit, val2)) or "0")
                        if n1 > n2:
                            return 1
                        elif n1 < n2:
                            return -1
                    except ValueError:
                        if val1 > val2:
                            return 1
                        elif val1 < val2:
                            return -1
                return 0
            except:
                return None

        comparison = compare_versions(obj.version, golden_version)
        if comparison is None or comparison < 0:
            return "Non-Compliant"  # Outdated or unparseable
        elif comparison == 0:
            return "Compliant"  # Up to Date
        else:  # comparison > 0
            return "Ahead"  # Newer than golden

    def get_golden_image(self, obj):
        if not obj.model:
            return None

        # Prefer new model
        if obj.model.default_image:
            # Build list of options
            options = []
            if obj.model.default_image:
                options.append(
                    {
                        "id": obj.model.default_image.id,
                        "version": obj.model.default_image.version,
                        "file": obj.model.default_image.filename,
                        "tag": "Default",
                    }
                )

            for img in obj.model.supported_images.all():
                # Avoid dupes
                if obj.model.default_image and img.id == obj.model.default_image.id:
                    continue
                options.append(
                    {
                        "id": img.id,
                        "version": img.version,
                        "file": img.filename,
                        "tag": "Supported",
                    }
                )

            return {
                "id": obj.model.default_image.id,
                "version": obj.model.default_image.version,
                "file": obj.model.default_image.filename,
                "size": obj.model.default_image.size_bytes,
                "md5": obj.model.default_image.md5_checksum,
                "is_new_model": True,
                "available_images": options,
            }

        # Fallback
        return {
            "version": obj.model.golden_image_version,
            "file": obj.model.golden_image_file,
            "is_new_model": False,
            "available_images": [],
        }


class DeviceModelViewSet(viewsets.ModelViewSet):
    serializer_class = DeviceModelSerializer
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_class = DeviceModelFilter
    search_fields = [
        "name",
        "vendor",
        "golden_image_version",
        "golden_image_file",
        "golden_image_path",
        "golden_image_md5",
    ]
    ordering_fields = ["name", "vendor", "golden_image_version"]
    ordering = ["name"]
    # Removed lookup_field to use default 'pk' (ID-based lookups)
    # lookup_value_regex removed as it's no longer needed

    def get_queryset(self):
        from django.db.models import Count

        return DeviceModel.objects.annotate(device_count=Count("devices")).order_by(
            "name"
        )

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
                {"error": str(e), "detail": "Failed to update device model"}, status=400
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
                {"error": str(e), "detail": "Failed to update device model"}, status=400
            )

    @action(detail=True, methods=["get"])
    def scan_images(self, request, *args, **kwargs):
        """
        Scans the configured path for this model on its default file server.
        Returns a list of potential image files.
        """
        model = self.get_object()
        path = request.query_params.get("path") or model.golden_image_path
        server_id = request.query_params.get("server")

        server = model.default_file_server
        if server_id:
            from swim_backend.images.models import FileServer

            try:
                server = FileServer.objects.get(id=server_id)
            except FileServer.DoesNotExist:
                return Response({"error": "File server not found"}, status=404)

        if not path or not server:
            return Response(
                {"error": "Path and File Server must be configured or provided"},
                status=400,
            )

        from swim_backend.core.services.filesystem_service import FileSystemService

        try:
            files = FileSystemService.list_files(server, path)
            return Response({"files": files})
        except Exception as e:
            return Response({"error": str(e)}, status=500)

    @action(detail=False, methods=["delete"])
    def cleanup_unused(self, request):
        """
        Deletes all DeviceModels that have no associated devices.
        """
        # Count devices for each model
        unused_models = DeviceModel.objects.annotate(
            device_count=Count("devices")
        ).filter(device_count=0)

        count = unused_models.count()
        if count == 0:
            return Response(
                {"status": "no_action", "message": "No unused models found."}
            )

        # Delete
        deleted_count, _ = unused_models.delete()

        return Response(
            {
                "status": "success",
                "message": f"Deleted {deleted_count} unused models.",
                "deleted_count": deleted_count,
            }
        )


class DeviceSyncSerializer(serializers.Serializer):
    """Serializer for device sync action"""

    scope = serializers.ChoiceField(
        choices=["all", "site", "selection"],
        default="selection",
        help_text="Sync scope: all devices, by site, or selection",
    )
    ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        default=list,
        help_text="Device IDs (required for 'selection' scope)",
    )
    site = serializers.IntegerField(
        required=False, allow_null=True, help_text="Site ID (required for 'site' scope)"
    )


class DeviceReadinessCheckSerializer(serializers.Serializer):
    """Serializer for device readiness check action"""

    ids = serializers.ListField(
        child=serializers.IntegerField(), help_text="List of device IDs to check"
    )
    image_map = serializers.DictField(
        required=False,
        default=dict,
        help_text="Map of device ID to image ID {deviceId: imageId}",
    )


class DeviceDistributeImageSerializer(serializers.Serializer):
    """Serializer for device image distribution"""

    ids = serializers.ListField(
        child=serializers.IntegerField(), help_text="List of device IDs"
    )
    workflow_id = serializers.IntegerField(
        required=False, allow_null=True, help_text="Workflow ID (optional)"
    )


class DeviceActivateImageSerializer(serializers.Serializer):
    """Serializer for device image activation"""

    ids = serializers.ListField(
        child=serializers.IntegerField(), help_text="List of device IDs"
    )
    image_map = serializers.DictField(
        required=False, default=dict, help_text="Map of device ID to image ID"
    )
    checks = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        default=list,
        help_text="Validation check IDs",
    )
    schedule_time = serializers.DateTimeField(
        required=False, allow_null=True, help_text="Schedule activation time"
    )
    execution_config = serializers.DictField(
        required=False,
        default=dict,
        help_text="Execution configuration (sequential/parallel device lists)",
    )
    task_name = serializers.CharField(default="Activation-Task", help_text="Task name")
    workflow_id = serializers.IntegerField(
        required=False, allow_null=True, help_text="Workflow ID"
    )


class DevicePluginActionSerializer(serializers.Serializer):
    """Serializer for plugin actions"""

    action = serializers.ChoiceField(
        choices=["connect", "metadata", "preview", "import"],
        help_text="Plugin action type",
    )
    config = serializers.DictField(
        required=False, default=dict, help_text="Plugin configuration"
    )
    filters = serializers.DictField(
        required=False, default=dict, help_text="Filters for preview action"
    )
    devices = serializers.ListField(
        required=False, default=list, help_text="Devices for import action"
    )
    defaults = serializers.DictField(
        required=False, default=dict, help_text="Default values for import"
    )


class DeviceViewSet(viewsets.ModelViewSet):
    queryset = Device.objects.all()
    serializer_class = DeviceSerializer
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_class = DeviceFilter
    search_fields = [
        "hostname",
        "ip_address",
        "platform",
        "version",
        "family",
        "boot_method",
        "mac_address",
        "reachability",
        "last_sync_status",
        "site__name",
        "model__name",
    ]
    ordering_fields = [
        "hostname",
        "ip_address",
        "version",
        "family",
        "reachability",
        "last_sync_time",
    ]
    ordering = ["hostname"]

    @action(detail=False, methods=["post"], serializer_class=DeviceSyncSerializer)
    def sync(self, request):
        """
        Trigger sync (version discovery) for devices.
        """
        # Check permission
        if not request.user.has_perm("devices.sync_device_inventory"):
            return Response(
                {"error": "You do not have permission to sync device inventory"},
                status=403,
            )

        scope_type = request.data.get("scope", "selection")
        scope_value = request.data.get("ids", [])

        if scope_type == "site":
            scope_value = request.data.get("site")

        count = run_sync_task(scope_type, scope_value)
        return Response({"status": "started", "count": count})

    @action(
        detail=False, methods=["post"], serializer_class=DeviceReadinessCheckSerializer
    )
    def check_readiness(self, request):
        """
        Runs pre-upgrade checks on a list of devices.
        """
        # Check permission
        if not request.user.has_perm("devices.check_device_readiness"):
            return Response(
                {"error": "You do not have permission to check device readiness"},
                status=403,
            )

        from swim_backend.core.readiness import check_readiness
        from swim_backend.images.models import Image

        device_ids = request.data.get("ids", [])
        image_map = request.data.get("image_map", {})  # { deviceId: imageId }
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
                self.selected_checks = Device.objects.none()  # Empty QuerySet-like

        for dev in devices:
            # Determine Target Image Size and Info
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
            if not target_size and dev.model:
                # First check new default_image FK (set via UI)
                if dev.model.default_image:
                    golden_version = dev.model.default_image.version
                    target_image_file = dev.model.default_image.filename
                    target_size = dev.model.default_image.size_bytes
                # Fall back to old golden_image fields
                elif dev.model.golden_image_version:
                    golden_version = dev.model.golden_image_version
                    target_image_file = dev.model.golden_image_file
                    # Prefer Explicit Size from Standard
                    if dev.model.golden_image_size:
                        target_size = dev.model.golden_image_size
                    # Fallback to Image Object Size
                    elif dev.model.golden_image_file:
                        img = Image.objects.filter(
                            filename=dev.model.golden_image_file
                        ).first()
                        if img:
                            target_size = img.size_bytes
                        else:
                            # Default fallback if image record missing but file defined (e.g. 500MB)
                            target_size = 500 * 1024 * 1024

            # Run Real Checks
            # Use a consistent session key for logs
            session_id = f"readiness_check_{dev.id}"
            mock_job = MockJob(session_id, target_size)

            ready, check_results = check_readiness(dev, mock_job)

            # Map Results to UI Format
            ui_checks = []

            # Map 'connection' -> Reachability
            if "connection" in check_results:
                c = check_results["connection"]
                status = "Pass" if c["status"] == "success" else "Fail"
                ui_checks.append(
                    {"name": "Reachability", "status": status, "message": c["message"]}
                )
            else:
                # If no connection key, assume it passed connected phase if we got results, or implicit pass?
                # Actually check_readiness returns connection failure explicitly if it fails.
                # If key missing, implies connection was fine?
                # Assume explicit keys in new readiness.py
                # Actually readiness.py ONLY adds 'connection' on failure.
                # Connected successfully, adding Pass.
                pass

            # Logic: If readiness.py returned, connection succeeded unless it returned early.
            if not any(c["name"] == "Reachability" for c in ui_checks):
                ui_checks.append(
                    {
                        "name": "Reachability",
                        "status": "Pass",
                        "message": "Device is reachable",
                    }
                )

            # Map 'flash_memory'
            if "flash_memory" in check_results:
                c = check_results["flash_memory"]
                status = "Pass" if c["status"] == "success" else "Fail"
                ui_checks.append(
                    {"name": "Flash Space", "status": status, "message": c["message"]}
                )

            # Map 'config_register'
            if "config_register" in check_results:
                c = check_results["config_register"]
                status = "Pass" if c["status"] == "success" else "Warning"  # or Fail
                ui_checks.append(
                    {
                        "name": "Config Register",
                        "status": status,
                        "message": c["message"],
                    }
                )

            # Map 'startup_config'
            if "startup_config" in check_results:
                c = check_results["startup_config"]
                status = "Pass" if c["status"] == "success" else "Warning"
                ui_checks.append(
                    {
                        "name": "Startup Config",
                        "status": status,
                        "message": c["message"],
                    }
                )

            # Golden Image Check (Logic remains in View as it depends on DB model, not device state)
            if golden_version:
                ui_checks.append(
                    {
                        "name": "Golden Image Defined",
                        "status": "Pass",
                        "message": f"Target: {golden_version}",
                    }
                )
            else:
                ui_checks.append(
                    {
                        "name": "Golden Image Defined",
                        "status": "Warning",
                        "message": "No standard defined",
                    }
                )

            status_str = "Ready" if ready else "Not Ready"

            results.append(
                {
                    "id": dev.id,
                    "hostname": dev.hostname,
                    "current_version": dev.version,
                    "target_version": golden_version,
                    "target_image_file": target_image_file,
                    "target_image_size": target_size,
                    "status": status_str,
                    "checks": ui_checks,
                }
            )

        return Response(results)

    @action(detail=True, methods=["get"])
    def sync_history(self, request, pk=None):
        """
        Get sync history for a specific device.
        """
        from swim_backend.devices.models import DeviceSyncHistory

        device = self.get_object()
        history = DeviceSyncHistory.objects.filter(device=device)[:50]  # Last 50 syncs

        results = []
        for sync in history:
            results.append(
                {
                    "id": sync.id,
                    "timestamp": sync.timestamp,
                    "status": sync.status,
                    "changes": sync.changes,
                    "version_discovered": sync.version_discovered,
                    "model_discovered": sync.model_discovered,
                    "error_message": sync.error_message,
                }
            )

        return Response(results)

    @action(
        detail=False, methods=["post"], serializer_class=DeviceDistributeImageSerializer
    )
    def distribute_image(self, request):
        """
        Initiates image distribution job using the SELECTED WORKFLOW.
        """
        # Check permission
        if not request.user.has_perm("devices.upgrade_device_firmware"):
            return Response(
                {"error": "You do not have permission to upgrade device firmware"},
                status=403,
            )

        device_ids = request.data.get("ids", [])
        workflow_id = request.data.get("workflow_id")  # Get from frontend
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
            workflow = Workflow.objects.filter(name="Standard Distribution").first()
            if not workflow:
                # Create basic one if missing
                from swim_backend.core.models import Workflow, WorkflowStep

                workflow = Workflow.objects.create(name="Standard Distribution")
                WorkflowStep.objects.create(
                    workflow=workflow,
                    name="Software Distribution",
                    step_type="distribution",
                    order=1,
                )

        for dev_id in device_ids:
            dev = Device.objects.get(id=dev_id)

            # Find Image (Golden Image logic)
            from swim_backend.images.models import Image

            target_image = None
            # Find Image (Golden Image logic)
            from swim_backend.images.models import Image

            target_image = None

            # Check for override
            image_map = request.data.get("image_map", {})
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
                        defaults={"version": dev.model.golden_image_version or "0.0.0"},
                    )
                    # Sync meta... (keeping existing logic for safety)
                    if (
                        dev.model.golden_image_size
                        and target_image.size_bytes != dev.model.golden_image_size
                    ):
                        target_image.size_bytes = dev.model.golden_image_size
                        target_image.save()

            if not target_image:
                job = Job.objects.create(
                    device_id=dev_id,
                    status="failed",
                    log="Error: Device has no Golden Image assigned. Cannot distribute.",
                )
                created_jobs.append(job)
                continue

            # Build Execution Plan from Workflow
            # Include readiness (success) and distribution (pending).
            # If the UI reads `job.workflow.steps`, it would show everything.
            # The issue says: "job process is not displaying all steps... during activation" and "redundant readiness... during distribution".

            # Focus on Distribution Job first.
            # It should show Readiness (Completed) + Distribution (Running).
            # Logic: Include everything UP TO 'distribution'.
            # Mark ALL as 'pending' so they run (as requested by user to "re-enable... not skip").
            # STOP adding steps after 'distribution' for this job.

            job_steps = []
            workflow_steps = workflow.steps.all().order_by("order")

            found_dist = False
            for step in workflow_steps:
                # Add step as pending
                job_steps.append(
                    {
                        "name": step.name,
                        "step_type": step.step_type,
                        "status": "pending",
                        "config": step.config,
                    }
                )

                if step.step_type == "distribution":
                    found_dist = True
                    break

            # If workflow has no distribution step (unlikely with new validation), fallback
            if not found_dist:
                # Just add a distinct distribution step
                job_steps.append(
                    {
                        "name": "Software Distribution",
                        "step_type": "distribution",
                        "status": "pending",
                        "config": {},
                    }
                )

            job = Job.objects.create(
                device_id=dev_id,
                image=target_image,
                file_server=dev.model.default_file_server if dev.model else None,
                status="pending",
                workflow=workflow,
                steps=job_steps,  # Pre-filled history
            )
            created_jobs.append(job)

            t = threading.Thread(target=run_swim_job, args=(job.id,))
            t.daemon = True
            t.start()

        return Response(
            {
                "status": "started",
                "job_ids": [j.id for j in created_jobs],
                "message": f"Distribution started for {len(device_ids)} devices.",
            }
        )

    @action(
        detail=False, methods=["post"], serializer_class=DeviceActivateImageSerializer
    )
    def activate_image(self, request):
        """
        Initiates image activation job with checks.
        """
        # Check permission
        if not request.user.has_perm("devices.upgrade_device_firmware"):
            return Response(
                {"error": "You do not have permission to upgrade device firmware"},
                status=403,
            )

        import threading
        import uuid
        from swim_backend.core.models import Job, ValidationCheck, Workflow
        from swim_backend.core.services.job_runner import orchestrate_jobs

        device_ids = request.data.get("ids", [])
        image_map = request.data.get("image_map", {})
        checks_config = request.data.get("checks", [])
        schedule_time = request.data.get("schedule_time")
        execution_config = request.data.get("execution_config", {})
        task_name = request.data.get("task_name", "Activation-Task")
        workflow_id = request.data.get("workflow_id")

        # If no explicit config, treat all 'ids' as parallel (default behavior)
        seq_ids = execution_config.get("sequential", [])
        par_ids = execution_config.get("parallel", [])

        if not seq_ids and not par_ids:
            par_ids = device_ids

        # Deduplicate and organize
        # Ensure we process sequential first for ordering simply by list index

        created_jobs = []
        batch_id = uuid.uuid4()

        job_map = {}  # device_id -> job_id

        # Prepare Dynamic Execution Plan
        # Fetch Workflow Logic
        execution_plan = []
        workflow_obj = None

        if workflow_id:
            try:
                workflow_obj = Workflow.objects.get(id=workflow_id)
                workflow_steps = workflow_obj.steps.all().order_by("order")

                # Iterate ALL steps to build full history
                for s in workflow_steps:
                    # Mark ALL as pending to ensure they show up and run (re-verification)
                    execution_plan.append(
                        {
                            "name": s.name,
                            "step_type": s.step_type,
                            "config": s.config,
                            "status": "pending",
                        }
                    )

            except Workflow.DoesNotExist:
                pass

        # Fallback if no workflow or steps (should imply legacy behavior or injection)
        if not execution_plan:
            execution_plan.insert(
                0,
                {
                    "name": "Software Activation",
                    "step_type": "activation",
                    "config": {},
                    "status": "pending",
                },
            )

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
                        defaults={
                            "version": device.model.golden_image_version or "0.0.0"
                        },
                    )

            # Auto-assign File Server
            job_fs = None
            if (
                device.site
                and device.site.region
                and device.site.region.preferred_file_server
            ):
                job_fs = device.site.region.preferred_file_server
            else:
                job_fs = FileServer.objects.filter(is_global_default=True).first()

            status = "pending"
            if schedule_time:
                # If scheduling for later
                if is_scheduled_active:
                    status = "scheduled"
                else:
                    status = "pending"
            else:
                status = "pending"

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
                steps=execution_plan,  # INJECT DYNAMIC PLAN
            )
            created_jobs.append(job)
            job_map[dev_id] = job.id

            # Link Checks (Legacy support for check runner)
            for cfg in checks_config:
                try:
                    chk = ValidationCheck.objects.get(id=cfg["id"])
                    job.selected_checks.add(chk)
                except:
                    pass
            job.save()

        # Sequential Jobs
        for idx, dev_id in enumerate(seq_ids):
            # For sequential, only the first one is 'scheduled' (if scheduling).
            # The rest are pending.
            is_active = idx == 0
            create_activation_job(dev_id, "sequential", is_active)

        # Parallel Jobs
        for dev_id in par_ids:
            # All parallel jobs are 'scheduled' if a time is set
            create_activation_job(dev_id, "parallel", True)

        # Launch Orchestrator
        # If schedule_time is set, the status logic above handled it (Scheduled jobs wait for DB Poller).
        # We only need orchestrator if running NOW.
        # BUT, orchestrate_jobs also handles setting 'scheduled' status if passed?
        # DB Poller for scheduled jobs.
        # So I only need to manually trigger IF NO SCHEDULE TIME.

        if not schedule_time:
            seq_job_ids = [job_map[did] for did in seq_ids if did in job_map]
            par_job_ids = [job_map[did] for did in par_ids if did in job_map]

            t = threading.Thread(
                target=orchestrate_jobs, args=(seq_job_ids, par_job_ids, schedule_time)
            )
            t.daemon = True
            t.start()

        return Response(
            {
                "status": "scheduled" if schedule_time else "started",
                "job_ids": [j.id for j in created_jobs],
                "message": f"Activation started for {len(created_jobs)} devices.",
            }
        )

    @action(detail=False, methods=["get"])
    def list_plugins(self, request):
        return Response(PluginRegistry.list_plugins())

    @action(
        detail=False,
        methods=["post"],
        url_path="plugin/(?P<plugin_id>[^/.]+)/action",
        serializer_class=DevicePluginActionSerializer,
    )
    def plugin_action(self, request, plugin_id=None):
        """
        Generic endpoint for plugin interactions.
        """
        plugin = PluginRegistry.get_plugin(plugin_id)
        if not plugin:
            return Response({"error": "Plugin not found"}, status=404)

        action_type = request.data.get("action")
        config = request.data.get("config", {})

        try:
            if action_type == "connect":
                return Response(plugin.test_connection(config))

            elif action_type == "metadata":
                return Response(plugin.get_filter_metadata(config))

            elif action_type == "preview":
                filters = request.data.get("filters", {})
                return Response({"devices": plugin.preview_devices(config, filters)})

            elif action_type == "import":
                devices = request.data.get("devices", [])
                defaults = request.data.get("defaults", {})
                success_count = 0
                errors = []

                for dev in devices:
                    try:
                        # Strict Validation
                        ip_addr = dev.get("ip_address")
                        hostname = dev.get("name")
                        platform = dev.get("platform")

                        if not ip_addr:
                            errors.append(
                                f"Skipped {hostname or 'Unknown'}: Missing IP Address"
                            )
                            continue

                        if not platform:
                            errors.append(
                                f"Skipped {hostname or ip_addr}: Missing Platform"
                            )
                            continue

                        # Hostname Fallback
                        if not hostname:
                            hostname = ip_addr

                        # Duplicate IP Check
                        # Check if IP exists on a DIFFERENT device
                        existing_with_ip = Device.objects.filter(
                            ip_address=ip_addr
                        ).first()
                        if existing_with_ip and existing_with_ip.hostname != hostname:
                            errors.append(
                                f"Skipped {hostname}: IP {ip_addr} already exists on {existing_with_ip.hostname}"
                            )
                            continue

                        # Site Handling
                        site_name = dev.get("site", "Global")
                        site_obj, _ = Site.objects.get_or_create(name=site_name)

                        # Device Update/Create
                        Device.objects.update_or_create(
                            hostname=hostname,
                            defaults={
                                "ip_address": ip_addr,
                                "username": defaults.get("username", ""),
                                "password": defaults.get("password", ""),
                                "platform": platform,
                                "site": site_obj,
                                "family": dev.get("family")
                                or dev.get("role", "Switch"),
                            },
                        )
                        success_count += 1

                    except Exception as e:
                        errors.append(
                            f"Error importing {dev.get('name', 'Unknown')}: {str(e)}"
                        )

                return Response(
                    {"status": "imported", "count": success_count, "errors": errors}
                )

        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=False, methods=["post"])
    def import_csv(self, request):
        """
        Bulk import devices from CSV.
        Expected columns: hostname, ip_address, username, password, platform, site
        """
        file = request.FILES.get("file")
        if not file:
            return Response({"error": "No file uploaded"}, status=400)

        decoded_file = file.read().decode("utf-8")
        io_string = io.StringIO(decoded_file)
        reader = csv.DictReader(io_string)

        created_count = 0
        errors = []

        for row in reader:
            try:
                # Validation (Strict: IP and Site required)
                ip_addr = row.get("ip_address")
                site_name = row.get("site")

                if not ip_addr or not site_name:
                    errors.append(
                        f"Row skipped: Missing IP or Site (IP={ip_addr}, Site={site_name})"
                    )
                    continue

                # Check for duplicate IP
                if Device.objects.filter(ip_address=ip_addr).exists():
                    # Check if we are updating the same device (by hostname)?
                    # The prompt says "check if there is no duplication in ip address value in existing devices"
                    # Usually update_or_create on hostname allows IP change, but if hostname is different and IP exists, it's a conflict.
                    # However, if we use update_or_create on hostname, and the matching hostname has this IP, it's fine.
                    # But if a DIFFERENT hostname has this IP, it's a duplicate.
                    # For safety based on no duplication, skip if IP exists and doesn't match hostname.

                    # Actually, standard behavior for "import" often implies "create new".
                    # If I use update_or_create by hostname, I might overwrite.
                    # But if IP exists on *another* device, that's bad.
                    # Check strict IP uniqueness.

                    # Edge case: If updating an existing device, IP might match itself.
                    # We use hostname as lookup key.
                    hostname = row.get("hostname") or ip_addr

                    existing_with_ip = Device.objects.filter(ip_address=ip_addr).first()
                    if existing_with_ip and existing_with_ip.hostname != hostname:
                        errors.append(
                            f"Row skipped: IP {ip_addr} already exists on device {existing_with_ip.hostname}"
                        )
                        continue

                # Hostname Fallback
                hostname = row.get("hostname")
                if not hostname:
                    hostname = ip_addr

                # Region Handling (Optional)
                region_name = row.get("region")
                region_obj = None
                if region_name:
                    from .models import Region

                    region_obj, _ = Region.objects.get_or_create(name=region_name)

                # Site Handling (Link to Region if provided)
                site_defaults = {}
                if region_obj:
                    site_defaults["region"] = region_obj

                site_obj, _ = Site.objects.update_or_create(
                    name=site_name, defaults=site_defaults
                )

                # Model Handling (Optional)
                model_name = row.get("model")
                model_obj = None
                if model_name:
                    model_obj, _ = DeviceModel.objects.get_or_create(name=model_name)

                # Device Creation/Update
                Device.objects.update_or_create(
                    hostname=hostname,
                    defaults={
                        "ip_address": ip_addr,
                        "username": row.get("username", ""),
                        "password": row.get("password", ""),
                        "platform": row.get("platform", "iosxe"),
                        "site": site_obj,
                        "model": model_obj,
                        "family": row.get("family", "Switch"),
                    },
                )
                created_count += 1
            except Exception as e:
                errors.append(
                    f"Row {row.get('hostname') or row.get('ip_address')}: {str(e)}"
                )

        return Response(
            {"status": "imported", "count": created_count, "errors": errors}
        )
