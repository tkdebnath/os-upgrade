from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, BasePermission, SAFE_METHODS
from .models import (
    Job,
    GoldenImage,
    ValidationCheck,
    CheckRun,
    Workflow,
    WorkflowStep,
    ZTPWorkflow,
)
from swim_backend.devices.models import Device, Site, DeviceModel
from .logic import run_swim_job, log_update
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter
import threading
import os


class ZTPPermission(BasePermission):
    """
    Custom permission for Zero Touch Provisioning.
    Requires explicit ZTP permissions - staff/superuser status alone is not sufficient.
    """

    def has_permission(self, request, view):
        # Must be authenticated
        if not request.user or not request.user.is_authenticated:
            return False

        # Superusers always have access
        if request.user.is_superuser:
            return True

        # Check specific ZTP permissions based on action
        if request.method in SAFE_METHODS:  # GET, HEAD, OPTIONS
            # Require explicit view permission
            return request.user.has_perm("core.can_view_ztp")
        elif request.method == "POST":
            if view.action == "provision_device":
                # Execute permission for webhook/provisioning
                return request.user.has_perm("core.can_execute_ztp")
            else:
                # Manage permission for creating workflows
                return request.user.has_perm("core.can_manage_ztp")
        elif request.method in ["PUT", "PATCH"]:
            # Manage permission for editing
            return request.user.has_perm("core.can_manage_ztp")
        elif request.method == "DELETE":
            # Delete permission required
            return request.user.has_perm("core.can_delete_ztp")

        return False

    def has_object_permission(self, request, view, obj):
        # Same logic as has_permission
        return self.has_permission(request, view)


class GoldenImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = GoldenImage
        fields = "__all__"


class GoldenImageViewSet(viewsets.ModelViewSet):
    queryset = GoldenImage.objects.all()
    serializer_class = GoldenImageSerializer


class CheckRunSerializer(serializers.ModelSerializer):
    check_name = serializers.CharField(source="validation_check.name", read_only=True)
    check_type = serializers.CharField(
        source="validation_check.check_type", read_only=True
    )
    check_command = serializers.CharField(
        source="validation_check.command", read_only=True
    )
    device_hostname = serializers.CharField(source="device.hostname", read_only=True)
    output = serializers.SerializerMethodField()
    phase = serializers.SerializerMethodField()

    class Meta:
        model = CheckRun
        fields = [
            "id",
            "status",
            "output",
            "created_at",
            "check_name",
            "check_type",
            "check_command",
            "device_hostname",
            "phase",
        ]

    def get_phase(self, obj):
        """Extract phase (pre/post) from output field"""
        output_str = obj.output or ""
        if output_str.startswith("precheck:"):
            return "pre"
        elif output_str.startswith("postcheck:"):
            return "post"
        return "both"

    def get_output(self, obj):
        """Read actual file content from disk"""
        import os

        output_str = obj.output or ""

        # Check if output contains file path info (format: "precheck:path:name:category:command")
        if output_str.startswith(("precheck:", "postcheck:")):
            try:
                parts = output_str.split(":", 5)
                if len(parts) >= 5:
                    phase = parts[0]  # precheck or postcheck
                    log_dir = parts[1]
                    check_name = parts[2]
                    category = parts[3]
                    command = parts[4]

                    # Build filename based on check type
                    if category == "genie":
                        # Genie format: {feature}_{os}_{hostname}_ops.txt
                        device = obj.device
                        filename = f"{command}_iosxe_{device.hostname}_ops.txt"
                    else:
                        # Command format: sanitized check name
                        safe_name = "".join(
                            c if c.isalnum() else "_" for c in check_name
                        )
                        filename = f"{safe_name}.txt"

                    file_path = os.path.join(log_dir, phase, filename)

                    if os.path.exists(file_path):
                        with open(file_path, "r") as f:
                            return f.read()
            except Exception as e:
                return f"Error reading check file: {e}"

        # Fallback to stored output
        return output_str


class WorkflowStepSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkflowStep
        fields = "__all__"


class WorkflowSerializer(serializers.ModelSerializer):
    steps = WorkflowStepSerializer(many=True, read_only=True)

    class Meta:
        model = Workflow
        fields = "__all__"


class UpdateStepsSerializer(serializers.Serializer):
    """Serializer for workflow update_steps action"""

    name = serializers.CharField(help_text="Step name")
    step_type = serializers.CharField(
        help_text="Step type (readiness, upgrade, validation, etc.)"
    )
    order = serializers.IntegerField(help_text="Step execution order")
    config = serializers.JSONField(
        required=False, default=dict, help_text="Step configuration"
    )


class WorkflowViewSet(viewsets.ModelViewSet):
    queryset = Workflow.objects.all()
    serializer_class = WorkflowSerializer

    def destroy(self, request, *args, **kwargs):
        if Workflow.objects.count() <= 1:
            return Response(
                {
                    "error": "Cannot delete the last remaining workflow. At least one workflow is required."
                },
                status=400,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def set_default(self, request, pk=None):
        """
        Sets this workflow as default, unsets others.
        """
        workflow = self.get_object()
        Workflow.objects.all().update(is_default=False)
        workflow.is_default = True
        workflow.save()
        return Response({"status": "default_set", "workflow": workflow.name})

    @action(detail=True, methods=["post"], serializer_class=UpdateStepsSerializer)
    def update_steps(self, request, pk=None):
        """
        Full replace of steps for a workflow.
        """
        workflow = self.get_object()
        steps_data = request.data

        # Clear existing
        workflow.steps.all().delete()

        # Create new
        new_steps = []
        for s in steps_data:
            new_steps.append(
                WorkflowStep(
                    workflow=workflow,
                    name=s.get("name"),
                    step_type=s.get("step_type"),
                    order=s.get("order"),
                    config=s.get("config", {}),
                )
            )
        WorkflowStep.objects.bulk_create(new_steps)

        return Response({"status": "updated", "count": len(new_steps)})


class WorkflowStepViewSet(viewsets.ModelViewSet):
    queryset = WorkflowStep.objects.all()
    serializer_class = WorkflowStepSerializer


class ValidationCheckSerializer(serializers.ModelSerializer):
    class Meta:
        model = ValidationCheck
        fields = "__all__"


class JobSerializer(serializers.ModelSerializer):
    device_hostname = serializers.CharField(source="device.hostname", read_only=True)
    image_filename = serializers.CharField(source="image.filename", read_only=True)
    
    # New Fields
    target_version = serializers.CharField(source="image.version", read_only=True)
    target_image = serializers.CharField(source="image.filename", read_only=True) 

    workflow_name = serializers.CharField(source="workflow.name", read_only=True)
    check_runs = CheckRunSerializer(many=True, read_only=True)

    # Enhanced Details
    file_server_name = serializers.CharField(source="file_server.name", read_only=True)
    file_server_address = serializers.CharField(
        source="file_server.address", read_only=True
    )
    selected_checks_details = ValidationCheckSerializer(
        source="selected_checks", many=True, read_only=True
    )

    file_path = serializers.SerializerMethodField()

    def get_file_path(self, obj):
        if obj.file_server and obj.image:
            base = obj.file_server.base_path or ""
            # Clean slashes
            base = base.strip("/")
            return f"/{base}/{obj.image.filename}" if base else f"/{obj.image.filename}"
        return None

    class Meta:
        model = Job
        fields = "__all__"


class BulkCreateJobSerializer(serializers.Serializer):
    """Serializer for bulk job creation"""

    devices = serializers.ListField(
        child=serializers.IntegerField(), help_text="List of device IDs to upgrade"
    )
    execution_mode = serializers.ChoiceField(
        choices=["parallel", "sequential"],
        default="parallel",
        help_text="Execution mode: parallel or sequential",
    )
    image = serializers.IntegerField(
        required=False, allow_null=True, help_text="Golden image ID"
    )
    selected_checks = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        default=list,
        help_text="List of validation check IDs",
    )
    distribution_time = serializers.DateTimeField(
        required=False, allow_null=True, help_text="Schedule distribution time"
    )
    activation_time = serializers.DateTimeField(
        required=False, allow_null=True, help_text="Schedule activation time"
    )
    activate_after_distribute = serializers.BooleanField(
        default=True, help_text="Auto-activate after distribution"
    )
    cleanup_flash = serializers.BooleanField(
        default=False, help_text="Clean up flash after upgrade"
    )
    task_name = serializers.CharField(
        default="Distribution-Task", help_text="Task name"
    )


class BulkRescheduleSerializer(serializers.Serializer):
    """Serializer for bulk job rescheduling"""

    ids = serializers.ListField(
        child=serializers.IntegerField(), help_text="List of job IDs to reschedule"
    )
    distribution_time = serializers.DateTimeField(help_text="New distribution time")


class JobViewSet(viewsets.ModelViewSet):
    queryset = Job.objects.all().order_by("-created_at")
    serializer_class = JobSerializer

    def perform_create(self, serializer):
        job = serializer.save()
        if not job.distribution_time and not job.activation_time:
            t = threading.Thread(target=run_swim_job, args=(job.id,))
            t.daemon = True
            t.start()

    from rest_framework.decorators import action
    from rest_framework.response import Response
    from .logic import run_sequential_batch

    @action(detail=True, methods=["get"])
    def download_artifacts(self, request, pk=None):
        """
        Download job logs and validation outputs.
        Query Param: type=[report|pre|post|diff|all]
        """
        job = self.get_object()
        type = request.query_params.get("type", "report")

        import io
        import os
        import zipfile
        from django.http import HttpResponse

        if type == "report":
            # Simple Text Report
            content = f"Job Report {job.id} for {job.device.hostname}\n"
            content += f"Status: {job.status}\n"
            content += f"Device: {job.device.hostname}\n"
            content += f"Image: {job.image.filename if job.image else 'N/A'}\n"
            content += "=" * 30 + "\n\n"
            content += job.log

            response = HttpResponse(content, content_type="text/plain")
            response["Content-Disposition"] = (
                f'attachment; filename="job_{job.id}_report.txt"'
            )
            return response

        elif type == "diff":
            content = "Diff content unavailable or not generated."
            log_dir = f"logs/{job.device.id}/{job.id}/"
            if os.path.exists(os.path.join(log_dir, "diff_summary.txt")):
                with open(os.path.join(log_dir, "diff_summary.txt"), "r") as f:
                    content = f.read()

            response = HttpResponse(content, content_type="text/plain")
            response["Content-Disposition"] = (
                f'attachment; filename="job_{job.id}_diff.txt"'
            )
            return response

        # For Zip downloads (pre, post, all)
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as zip_file:
            log_dir = f"logs/{job.device.id}/{job.id}/"

            # Add entire directories to preserve folder structure
            if type == "pre":
                # Add precheck folder
                precheck_dir = os.path.join(log_dir, "precheck")
                if os.path.exists(precheck_dir):
                    for root, dirs, files in os.walk(precheck_dir):
                        for file in files:
                            file_path = os.path.join(root, file)
                            arcname = os.path.relpath(file_path, log_dir)
                            zip_file.write(file_path, arcname)

            elif type == "post":
                # Add postcheck folder
                postcheck_dir = os.path.join(log_dir, "postcheck")
                if os.path.exists(postcheck_dir):
                    for root, dirs, files in os.walk(postcheck_dir):
                        for file in files:
                            file_path = os.path.join(root, file)
                            arcname = os.path.relpath(file_path, log_dir)
                            zip_file.write(file_path, arcname)

            elif type == "all":
                # Add job report at root
                zip_file.writestr("job_report.txt", job.log)

                # Add precheck folder
                precheck_dir = os.path.join(log_dir, "precheck")
                if os.path.exists(precheck_dir):
                    for root, dirs, files in os.walk(precheck_dir):
                        for file in files:
                            file_path = os.path.join(root, file)
                            arcname = os.path.relpath(file_path, log_dir)
                            zip_file.write(file_path, arcname)

                # Add postcheck folder
                postcheck_dir = os.path.join(log_dir, "postcheck")
                if os.path.exists(postcheck_dir):
                    for root, dirs, files in os.walk(postcheck_dir):
                        for file in files:
                            file_path = os.path.join(root, file)
                            arcname = os.path.relpath(file_path, log_dir)
                            zip_file.write(file_path, arcname)

                # Add diffs folder
                diffs_dir = os.path.join(log_dir, "diffs")
                if os.path.exists(diffs_dir):
                    for root, dirs, files in os.walk(diffs_dir):
                        for file in files:
                            file_path = os.path.join(root, file)
                            arcname = os.path.relpath(file_path, log_dir)
                            zip_file.write(file_path, arcname)

                # Add diff_summary.txt if it exists at root of log_dir
                diff_summary = os.path.join(log_dir, "diff_summary.txt")
                if os.path.exists(diff_summary):
                    zip_file.write(diff_summary, "diff_summary.txt")

        buffer.seek(0)
        response = HttpResponse(buffer, content_type="application/zip")
        filename = f"job_{job.id}_{type}_artifacts.zip"
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response

    @action(detail=False, methods=["post"], serializer_class=BulkCreateJobSerializer)
    def bulk_create(self, request):
        """
        Batch upgrade multiple devices - run all at once or one-by-one.
        """
        device_ids = request.data.get("devices", [])
        execution_mode = request.data.get("execution_mode", "parallel")

        # Common params
        image_id = request.data.get("image")
        selected_checks = request.data.get("selected_checks", [])
        distribution_time = request.data.get("distribution_time")
        activation_time = request.data.get("activation_time")
        activate_after_distribute = request.data.get("activate_after_distribute", True)
        cleanup_flash = request.data.get("cleanup_flash", False)
        task_name = request.data.get("task_name", "Distribution-Task")

        # New Params
        import uuid

        batch_id = uuid.uuid4()

        created_jobs = []
        for index, dev_id in enumerate(device_ids):
            # If sequential AND scheduled:
            # - First job gets the distribution_time and status='scheduled'
            # - Others get status='pending' (scheduler will ignore them until triggered)

            job_status = "pending"
            job_sched_time = distribution_time

            if distribution_time:
                # If Scheduled
                if execution_mode == "sequential":
                    if index == 0:
                        job_status = "scheduled"
                    else:
                        job_status = "pending"  # Waiting for previous to finish
                        # We keep distribution_time on them so we know when they *should* have run (or to track sequence)
                        # But status 'pending' keeps them out of scheduler loop
                else:
                    # Parallel
                    job_status = "scheduled"

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
                status=job_status,
            )
            if selected_checks:
                job.selected_checks.set(selected_checks)
            created_jobs.append(job)

        # Trigger job execution
        if not distribution_time:
            if execution_mode == "sequential":
                # Upgrade devices one at a time
                job_ids = [j.id for j in created_jobs]
                t = threading.Thread(target=run_sequential_batch, args=(job_ids,))
                t.daemon = True
                t.start()
            else:
                # Hit all devices at once
                for job in created_jobs:
                    t = threading.Thread(target=run_swim_job, args=(job.id,))
                    t.daemon = True
                    t.start()

        return Response(
            {
                "status": "jobs_created",
                "count": len(created_jobs),
                "mode": execution_mode,
            }
        )

        return Response(
            {
                "status": "jobs_created",
                "count": len(created_jobs),
                "mode": execution_mode,
            }
        )

    @action(detail=True, methods=["get"])
    def download_diffs(self, request, pk=None):
        """
        Zips and returns all diff files for the job.
        """
        import zipfile
        import os
        from django.http import HttpResponse
        from io import BytesIO

        job = self.get_object()
        log_dir = f"logs/{job.device.id}/{job.id}/"

        if not os.path.exists(log_dir):
            return Response({"error": "No logs found for this job"}, status=404)

        byte_stream = BytesIO()
        with zipfile.ZipFile(byte_stream, "w") as zf:
            # Add all diff files
            has_diffs = False
            for root, dirs, files in os.walk(log_dir):
                for file in files:
                    if (
                        file.startswith("diff_")
                        or file.startswith("precheck_")
                        or file.startswith("postcheck_")
                    ):
                        zf.write(os.path.join(root, file), arcname=file)
                        has_diffs = True

            if not has_diffs:
                zf.writestr(
                    "info.txt", "No pre/post check diffs generated for this job."
                )

        response = HttpResponse(byte_stream.getvalue(), content_type="application/zip")
        response["Content-Disposition"] = (
            f'attachment; filename="job_{job.id}_diffs.zip"'
        )
        return response

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        job = self.get_object()
        job.status = "cancelled"
        job.log += f"\n[{threading.current_thread().name}] Job cancelled by user."
        job.save()
        return Response(
            {"status": "cancelled", "message": "Job cancellation requested."}
        )

    @action(detail=False, methods=["post"], serializer_class=BulkRescheduleSerializer)
    def bulk_reschedule(self, request):
        """
        Reschedules multiple jobs to a new time.
        """
        job_ids = request.data.get("ids", [])
        new_time = request.data.get("distribution_time")

        if not job_ids or not new_time:
            return Response({"error": "ids and distribution_time required"}, status=400)

        jobs = Job.objects.filter(id__in=job_ids)
        updated_count = jobs.update(distribution_time=new_time, status="scheduled")

        # Log the update for each job
        for job in jobs:
            log_update(job.id, f"Rescheduled to {new_time} by user.")

        return Response({"status": "rescheduled", "count": updated_count})


class ValidationCheckSerializer(serializers.ModelSerializer):
    class Meta:
        model = ValidationCheck
        fields = "__all__"


class ValidationCheckViewSet(viewsets.ModelViewSet):
    queryset = ValidationCheck.objects.all()
    serializer_class = ValidationCheckSerializer


from .models import CheckRun


class CheckRunSerializer(serializers.ModelSerializer):
    device_hostname = serializers.CharField(source="device.hostname", read_only=True)
    check_name = serializers.CharField(source="validation_check.name", read_only=True)

    class Meta:
        model = CheckRun
        fields = "__all__"


class RunReadinessSerializer(serializers.Serializer):
    """Serializer for running readiness checks"""

    scope = serializers.ChoiceField(
        choices=["all", "site", "selection"],
        default="selection",
        help_text="Scope: all devices, by site, or specific selection",
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


class RunChecksSerializer(serializers.Serializer):
    """Serializer for running validation checks"""

    devices = serializers.ListField(
        child=serializers.IntegerField(), help_text="List of device IDs"
    )
    checks = serializers.ListField(
        child=serializers.IntegerField(), help_text="List of validation check IDs"
    )


class CheckRunViewSet(viewsets.ModelViewSet):
    """
    API for managing standalone check executions.
    """

    queryset = CheckRun.objects.all().order_by("-created_at")
    serializer_class = CheckRunSerializer

    @action(detail=False, methods=["post"], serializer_class=RunReadinessSerializer)
    def run_readiness(self, request):
        """
        Run pre-upgrade readiness checks (flash space, boot config, etc.).
        """
        from swim_backend.devices.models import Device
        from .logic import run_swim_job

        scope_type = request.data.get("scope", "selection")
        scope_value = request.data.get("ids", [])
        site = request.data.get("site")

        devices = []
        if scope_type == "all":
            devices = Device.objects.all()
        elif scope_type == "site":
            devices = Device.objects.filter(site=site)
        else:
            devices = Device.objects.filter(id__in=scope_value)

        checks = ValidationCheck.objects.filter(category="system")
        if not checks.exists():
            from .models import ValidationCheck

            c1 = ValidationCheck.objects.create(
                name="Flash Verify", command="check_flash", category="system"
            )
            c2 = ValidationCheck.objects.create(
                name="Config Register", command="check_config_reg", category="system"
            )
            checks = [c1, c2]

        created_runs = []
        from .services.check_runner import run_standalone_check

        for dev in devices:
            for check in checks:
                run = CheckRun.objects.create(
                    device=dev,
                    validation_check=check,
                    created_by=request.user if request.user.is_authenticated else None,
                )
                created_runs.append(run)
                t = threading.Thread(target=run_standalone_check, args=(run.id,))
                t.daemon = True
                t.start()

        return Response(
            {
                "status": "initiated",
                "devices": len(devices),
                "checks_per_device": len(checks),
            }
        )

    @action(detail=False, methods=["post"], serializer_class=RunChecksSerializer)
    def run(self, request):
        """
        Run validation commands on devices (show version, inventory, etc.).
        """
        device_ids = request.data.get("devices", [])
        check_ids = request.data.get("checks", [])

        created_runs = []
        from .logic import run_standalone_check

        for dev_id in device_ids:
            for check_id in check_ids:
                run = CheckRun.objects.create(
                    device_id=dev_id,
                    validation_check_id=check_id,
                    created_by=request.user if request.user.is_authenticated else None,
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
    Users see only data they have permissions for.
    """

    def get_permissions(self):
        """Require view_dashboard permission or superuser status"""
        from rest_framework.permissions import BasePermission

        class CanViewDashboard(BasePermission):
            def has_permission(self, request, view):
                return (
                    request.user
                    and request.user.is_authenticated
                    and (
                        request.user.is_superuser
                        or request.user.has_perm("core.view_dashboard")
                    )
                )

        return [CanViewDashboard()]

    @action(detail=False, methods=["get"])
    def stats(self, request):
        from swim_backend.devices.models import Device
        from .models import Job
        from django.utils import timezone
        import datetime

        # Check user permissions before showing data
        can_view_devices = request.user.is_superuser or request.user.has_perm(
            "devices.view_device"
        )
        can_view_jobs = request.user.is_superuser or request.user.has_perm(
            "core.view_job"
        )

        # Initialize default values
        total_devices = 0
        site_count = 0
        reachable_count = 0
        unreachable_count = 0
        devices_per_site = []
        devices_per_model = []
        devices_per_version = []
        compliant_count = 0
        non_compliant_count = 0

        # Get device data if user has permission
        if can_view_devices:
            total_devices = Device.objects.count()
            sites_qs = Device.objects.values("site").distinct()
            site_count = sites_qs.count()

            reachable_count = Device.objects.filter(reachability="Reachable").count()
            unreachable_count = Device.objects.filter(
                reachability="Unreachable"
            ).count()

            from django.db.models import Count

            # Aggregations for Graphs
            devices_per_site = list(
                Device.objects.values("site__name")
                .annotate(value=Count("id"))
                .order_by("-value")
            )
            devices_per_model = list(
                Device.objects.values("model__name")
                .annotate(value=Count("id"))
                .order_by("-value")
            )
            devices_per_version = list(
                Device.objects.values("version")
                .annotate(value=Count("id"))
                .order_by("-value")
            )

            # Check which devices are running the right IOS version
            compliant_count = 0  # Running golden image
            ahead_count = 0  # Running newer than standard
            non_compliant_count = 0  # Outdated or no standard set

            def compare_versions(v1, v2):
                """Compare IOS version strings. Returns: -1 (older), 0 (same), 1 (newer)"""
                if not v1 or not v2:
                    return None
                try:
                    p1 = str(v1).replace("-", ".").split(".")
                    p2 = str(v2).replace("-", ".").split(".")
                    for i in range(max(len(p1), len(p2))):
                        val1 = p1[i] if i < len(p1) else "0"
                        val2 = p2[i] if i < len(p2) else "0"
                        # Try to compare as integers
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

            for dev in Device.objects.all():
                if not dev.model:
                    non_compliant_count += 1  # No model
                    continue

                # Get golden version from either default_image or golden_image_version
                golden_version = None
                if dev.model.default_image:
                    golden_version = dev.model.default_image.version
                elif dev.model.golden_image_version:
                    golden_version = dev.model.golden_image_version

                if not golden_version:
                    non_compliant_count += 1  # No Standard
                else:
                    comparison = compare_versions(dev.version, golden_version)
                    if comparison is None or comparison < 0:
                        non_compliant_count += 1  # Outdated or unparseable
                    elif comparison == 0:
                        compliant_count += 1  # Up to Date
                    else:  # comparison > 0
                        ahead_count += 1  # Ahead

        # Calculate health percentage
        health_percentage = 0
        if total_devices > 0:
            health_percentage = int((reachable_count / total_devices) * 100)

        # Job data if user has permission
        critical_issues = 0
        jobs_running = 0
        jobs_scheduled = 0
        jobs_failed = 0
        jobs_success = 0

        if can_view_jobs:
            last_24h = timezone.now() - datetime.timedelta(days=1)
            critical_issues = Job.objects.filter(
                status="failed", created_at__gte=last_24h
            ).count()

            # Job Status Breakdown
            jobs_running = Job.objects.filter(
                status__in=["running", "distributing", "activating"]
            ).count()
            jobs_scheduled = Job.objects.filter(
                status__in=["scheduled", "pending"]
            ).count()
            jobs_failed = Job.objects.filter(status="failed").count()
            jobs_success = Job.objects.filter(
                status__in=["success", "distributed"]
            ).count()

        return Response(
            {
                "health": {
                    "percentage": health_percentage,
                    "reachable": reachable_count,
                    "unreachable": unreachable_count,
                },
                "issues": {"critical": critical_issues, "warning": 0},
                "network": {
                    "sites": site_count,
                    "devices": total_devices,
                    "unprovisioned": 0,
                    "unclaimed": 0,
                },
                "analytics": {
                    "by_site": [
                        {"name": d["site__name"] or "Unknown", "value": d["value"]}
                        for d in devices_per_site
                    ],
                    "by_model": [
                        {"name": d["model__name"] or "Unknown", "value": d["value"]}
                        for d in devices_per_model
                    ],
                    "by_version": [
                        {"name": d["version"] or "Unknown", "value": d["value"]}
                        for d in devices_per_version
                    ],
                    "compliance": [
                        {"name": "Compliant", "value": compliant_count},
                        {"name": "Ahead", "value": ahead_count},
                        {"name": "Non-Compliant", "value": non_compliant_count},
                    ],
                    "job_status": [
                        {"name": "Running", "value": jobs_running},
                        {"name": "Scheduled", "value": jobs_scheduled},
                        {"name": "Failed", "value": jobs_failed},
                        {"name": "Success", "value": jobs_success},
                    ],
                },
                "ztp": {
                    "active_workflows": ZTPWorkflow.objects.filter(
                        status="active"
                    ).count(),
                    "paused_workflows": ZTPWorkflow.objects.filter(
                        status="paused"
                    ).count(),
                    "total_provisioned_today": ZTPWorkflow.objects.filter(
                        devices_provisioned__jobs__created_at__gte=timezone.now().replace(
                            hour=0, minute=0, second=0
                        )
                    )
                    .distinct()
                    .count(),
                },
            }
        )

    @action(detail=False, methods=["get"])
    def supported_models(self, request):
        """Get list of supported device models"""
        from django.conf import settings

        return Response(
            {
                "supported_models": settings.SUPPORTED_DEVICE_MODELS,
                "count": len(settings.SUPPORTED_DEVICE_MODELS),
            }
        )

    @action(detail=False, methods=["get"])
    def device_compliance(self, request):
        """Get devices that are NOT in supported models list"""
        from django.conf import settings
        from swim_backend.devices.models import Device

        supported = settings.SUPPORTED_DEVICE_MODELS
        unsupported = Device.objects.exclude(model__name__in=supported).values(
            "id", "hostname", "model__name"
        )

        return Response(
            {
                "supported_count": len(supported),
                "unsupported_devices": list(unsupported),
                "unsupported_count": len(unsupported),
            }
        )


# ============================================================================
# ZTP (Zero Touch Provisioning) ViewSet
# ============================================================================


class ZTPWorkflowSerializer(serializers.ModelSerializer):
    workflow = serializers.PrimaryKeyRelatedField(
        queryset=Workflow.objects.all(), required=False, allow_null=True
    )
    workflow_name = serializers.SerializerMethodField()
    target_site = serializers.PrimaryKeyRelatedField(
        queryset=Site.objects.all(), required=False, allow_null=True
    )
    target_site_name = serializers.SerializerMethodField()
    model_filter = serializers.PrimaryKeyRelatedField(
        queryset=DeviceModel.objects.all(), required=False, allow_null=True
    )
    model_name = serializers.SerializerMethodField()
    devices_provisioned = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Device.objects.all(), required=False
    )
    precheck_validations = serializers.PrimaryKeyRelatedField(
        many=True, queryset=ValidationCheck.objects.all(), required=False
    )
    postcheck_validations = serializers.PrimaryKeyRelatedField(
        many=True, queryset=ValidationCheck.objects.all(), required=False
    )
    provisioned_device_count = serializers.SerializerMethodField()
    progress_percentage = serializers.SerializerMethodField()

    def get_workflow_name(self, obj):
        return obj.workflow.name if obj.workflow else None

    def get_target_site_name(self, obj):
        return obj.target_site.name if obj.target_site else None

    def get_model_name(self, obj):
        return obj.model_filter.name if obj.model_filter else None

    def get_provisioned_device_count(self, obj):
        return obj.devices_provisioned.count()

    def get_progress_percentage(self, obj):
        if obj.total_devices == 0:
            return 0
        return int((obj.completed_devices / obj.total_devices) * 100)

    class Meta:
        model = ZTPWorkflow
        fields = [
            "id",
            "name",
            "description",
            "workflow",
            "workflow_name",
            "target_site",
            "target_site_name",
            "device_family_filter",
            "platform_filter",
            "model_filter",
            "model_name",
            "status",
            "devices_provisioned",
            "precheck_validations",
            "postcheck_validations",
            "total_devices",
            "completed_devices",
            "failed_devices",
            "skipped_devices",
            "provisioned_device_count",
            "progress_percentage",
            "webhook_token",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at", "created_by"]


class ZTPProvisionDeviceSerializer(serializers.Serializer):
    """Serializer for ZTP provision device webhook payload"""

    ip_address = serializers.IPAddressField(
        required=True, help_text="IP address of the device to provision"
    )
    platform = serializers.CharField(
        required=True, help_text="Device platform (iosxe, nxos, iosxr, etc.)"
    )
    username = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="Device username (optional - defaults to global credentials)",
    )
    password = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="Device password (optional)",
    )
    secret = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="Enable password (optional)",
    )
    hostname = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="Device hostname (optional - auto-discovered if not provided)",
    )
    family = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        default="Switch",
        help_text="Device family: Switch/Router/AP/WLC (optional)",
    )
    site = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="Site name (optional)",
    )
    site_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="Site ID - preferred over site name (optional)",
    )


def run_ztp_provisioning(ztp_id, ip_address, username, password, secret, platform, family, site_id, hostname_override, user_id, remarks):
    """
    Background task to handle ZTP provisioning:
    1. Connect to device & get facts
    2. Add/Update device in DB
    3. Sync details
    4. Check compliance
    5. Trigger upgrade job if needed
    """
    from swim_backend.devices.models import Device, DeviceModel, Site
    from swim_backend.core.services.genie_service import create_genie_device
    from swim_backend.core.services.sync_service import sync_device_details
    from swim_backend.core.models import ZTPWorkflow, Job
    from swim_backend.images.models import FileServer
    from django.contrib.auth import get_user_model
    from swim_backend.core.services.job_runner import run_swim_job
    import threading
    import logging

    logger = logging.getLogger(__name__)

    try:
        ztp = ZTPWorkflow.objects.get(pk=ztp_id)
        # Handle user retrieval safely
        User = get_user_model()
        user = User.objects.get(pk=user_id) if user_id else None
    except Exception as e:
        logger.error(f"Failed to load ZTP context in background task: {e}")
        return

    log_update(f"ztp_{ztp_id}", f"ZTP Provision Request from {ip_address}")

    try:
        log_update(f"ztp_{ztp_id}", f"Connecting to {ip_address}...")

        # Build temp device object to test connectivity
        temp_device = Device(
            hostname=f"temp_{ip_address}",
            ip_address=ip_address,
            username=username,
            password=password,
            secret=secret,
            platform=platform,
        )

        dev, _ = create_genie_device(temp_device, f"ztp_{ztp_id}")
        dev.connect(log_stdout=False, learn_hostname=True)

        # Grab hostname from device itself
        hostname = (
            hostname_override or dev.learned_hostname or f"device_{ip_address}"
        )

        # Pull MAC from show version output
        output = dev.parse("show version")
        mac_address = None

        if isinstance(output, dict):
            version_info = output.get("version", {})
            # MAC address field varies by platform (IOS, IOS-XE, NX-OS)
            mac_address = (
                version_info.get("base_ethernet_mac_address")
                or version_info.get("mac_address")
                or version_info.get("system_mac_address")
            )

        dev.disconnect()
        log_update(
            f"ztp_{ztp_id}", f"Discovered: hostname={hostname}, mac={mac_address}"
        )

        existing_device = None
        if mac_address:
            existing_device = Device.objects.filter(
                hostname=hostname, mac_address=mac_address
            ).first()
        else:
            # Some devices don't expose MAC in show version - fallback to hostname
            existing_device = Device.objects.filter(hostname=hostname).first()

        if existing_device:
            log_update(
                f"ztp_{ztp_id}",
                f"Device {hostname} found in inventory (ID: {existing_device.id})",
            )

            # Check if device is already running the right IOS version
            if existing_device.model and existing_device.model.default_image:
                golden_version = existing_device.model.default_image.version

                # Compare running version to golden standard
                if existing_device.version == golden_version:
                    log_update(
                        f"ztp_{ztp_id}",
                        f"Device {hostname} is already compliant with golden image. Skipping.",
                    )
                    ztp.skipped_devices += 1
                    ztp.total_devices += 1
                    ztp.save()
                    return

            device = existing_device
        else:
            log_update(f"ztp_{ztp_id}", f"Adding {hostname} to inventory...")

            # Figure out which site to assign
            if not site_id and ztp.target_site:
                site_id = ztp.target_site.id

            # Add device to database
            device = Device.objects.create(
                hostname=hostname,
                ip_address=ip_address,
                username=username,
                password=password,
                secret=secret,
                platform=platform,
                family=family,
                mac_address=mac_address,
                reachability="Reachable",
                site_id=site_id,
                last_sync_status="Pending",
            )
            log_update(f"ztp_{ztp_id}", f"Device added with ID: {device.id}")

        log_update(f"ztp_{ztp_id}", f"Syncing device {hostname}...")

        try:
            # Pull full device details - model, version, hardware info
            sync_device_details(device.id)
            device.refresh_from_db()
            log_update(
                f"ztp_{ztp_id}",
                f"Sync complete. Model: {device.model}, Version: {device.version}",
            )
        except Exception as e:
            log_update(f"ztp_{ztp_id}", f"Sync failed: {e}")
            ztp.failed_devices += 1
            ztp.total_devices += 1
            ztp.save()
            return

        if not device.model:
            log_update(
                f"ztp_{ztp_id}", f"Can't determine model for {hostname}. Skipping upgrade."
            )
            ztp.skipped_devices += 1
            ztp.total_devices += 1
            ztp.save()
            return

        if not device.model.default_image:
            log_update(
                f"ztp_{ztp_id}",
                f"No golden IOS image configured for {device.model.name}. Can't upgrade.",
            )
            ztp.skipped_devices += 1
            ztp.total_devices += 1
            ztp.save()
            return

        # Verify device matches our deployment criteria
        if ztp.device_family_filter and device.family != ztp.device_family_filter:
            log_update(
                f"ztp_{ztp_id}",
                f"Device family {device.family} does not match filter. Skipping.",
            )
            ztp.skipped_devices += 1
            ztp.total_devices += 1
            ztp.save()
            return

        if ztp.platform_filter and device.platform != ztp.platform_filter:
            log_update(
                f"ztp_{ztp_id}",
                f"Device platform {device.platform} does not match filter. Skipping.",
            )
            ztp.skipped_devices += 1
            ztp.total_devices += 1
            ztp.save()
            return

        if ztp.model_filter and device.model != ztp.model_filter:
            log_update(
                f"ztp_{ztp_id}",
                f"Device model {device.model.name} does not match filter. Skipping.",
            )
            ztp.skipped_devices += 1
            ztp.total_devices += 1
            ztp.save()
            return

        log_update(f"ztp_{ztp_id}", f"Creating upgrade job for {hostname}...")

        # Determine file server (similar to normal upgrade pipeline)
        # Use device preferred, or image default, or fallback to first available
        target_image = device.model.default_image
        file_server = device.preferred_file_server or target_image.file_server
        
        if not file_server:
            # Fallback: try to find a global default file server
            file_server = FileServer.objects.filter(is_global_default=True).first()
            
        if not file_server:
            # Last resort: just take the first one
            file_server = FileServer.objects.first()

        # Build execution plan from workflow
        execution_plan = []
        if ztp.workflow:
            for step in ztp.workflow.steps.all().order_by("order"):
                execution_plan.append(
                    {
                        "name": step.name,
                        "step_type": step.step_type,
                        "config": step.config,
                        "status": "pending",
                    }
                )

        job = Job.objects.create(
            device=device,
            image=target_image,
            file_server=file_server,
            workflow=ztp.workflow,
            task_name=f"ZTP Auto-Provision: {ztp.name}",
            remarks=remarks,
            status="pending",
            steps=execution_plan,
            created_by=user,
        )

        # Attach pre/post checks (show version, inventory, etc.)
        if ztp.precheck_validations.exists():
            job.selected_checks.set(ztp.precheck_validations.all())
        if ztp.postcheck_validations.exists():
            job.selected_checks.add(*ztp.postcheck_validations.all())

        # Add device to provisioned list
        ztp.devices_provisioned.add(device)
        ztp.total_devices += 1
        ztp.save()

        # Kick off the upgrade in the background
        log_update(f"ztp_{ztp_id}", f"Job {job.id} created. Starting execution...")
        t = threading.Thread(target=run_swim_job, args=(job.id,))
        t.daemon = True
        t.start()

    except Exception as e:
        log_update(f"ztp_{ztp_id}", f"ZTP process failed: {e}")
        # Try to increment failure count if we still can
        try:
            ztp = ZTPWorkflow.objects.get(pk=ztp_id)
            ztp.failed_devices += 1
            ztp.total_devices += 1
            ztp.save()
        except:
            pass


class ZTPWorkflowViewSet(viewsets.ModelViewSet):
    queryset = ZTPWorkflow.objects.all()
    serializer_class = ZTPWorkflowSerializer
    permission_classes = [ZTPPermission]
    filter_backends = []  # Explicitly disable filters to prevent 'model' field error

    def perform_create(self, serializer):
        """Create ZTP workflow with current user"""
        import secrets
        import string

        # Generate webhook token
        token = "".join(
            secrets.choice(string.ascii_letters + string.digits) for _ in range(40)
        )
        serializer.save(created_by=self.request.user, webhook_token=token)

    @action(
        detail=True, methods=["post"], serializer_class=ZTPProvisionDeviceSerializer
    )
    def provision_device(self, request, pk=None):
        """
        ZTP webhook endpoint - device boots up and calls this to get auto-upgraded.
        Returns job_id right away so device doesn't have to wait.
        """
        ztp = self.get_object()

        if ztp.status != "active":
            return Response({"error": "ZTP workflow is not active"}, status=400)

        # Pull device credentials from the webhook call
        ip_address = request.data.get("ip_address")
        platform = request.data.get("platform")
        username = request.data.get("username")
        password = request.data.get("password")
        secret = request.data.get("secret", password)  # Enable password
        hostname_override = request.data.get("hostname")  # Use this if provided
        family = request.data.get("family", "Switch")
        site_id = request.data.get("site_id")
        site_name = request.data.get("site")
        remarks = request.data.get("remarks", "ZTP Auto-Provision")

        # Look up site ID from name if that's what they sent
        if not site_id and site_name:
            from swim_backend.devices.models import Site
            try:
                site_obj = Site.objects.get(name=site_name)
                site_id = site_obj.id
                log_update(f"ztp_{pk}", f"Found site '{site_name}' (ID: {site_id})")
            except Site.DoesNotExist:
                log_update(f"ztp_{pk}", f"Warning: Site '{site_name}' not in database. Device will be unassigned.")
                site_id = None

        if not all([ip_address, platform]):
            return Response({"error": "Missing required fields: ip_address, platform"}, status=400)

        # Spawn background processing
        import threading
        t = threading.Thread(
            target=run_ztp_provisioning,
            args=(ztp.id, ip_address, username, password, secret, platform, family, site_id, hostname_override, request.user.id if request.user.is_authenticated else None, remarks),
        )
        t.daemon = True
        t.start()
        
        return Response(
            {
                "status": "queued",
                "message": "ZTP provisioning started in background",
                "device_ip": ip_address,
            },
            status=202,
        )

        # -------------------------------------------------------
        # LEGACY/FALLBACK LOGIC (UNREACHABLE NOW)
        # -------------------------------------------------------


        # Pull device credentials from the webhook call
        ip_address = request.data.get("ip_address")
        platform = request.data.get("platform")
        username = request.data.get("username")
        password = request.data.get("password")
        secret = request.data.get("secret", password)  # Enable password
        hostname_override = request.data.get("hostname")  # Use this if provided
        family = request.data.get("family", "Switch")
        site_id = request.data.get("site_id")
        site_name = request.data.get("site")

        # Look up site ID from name if that's what they sent
        if not site_id and site_name:
            from swim_backend.devices.models import Site

            try:
                site_obj = Site.objects.get(name=site_name)
                site_id = site_obj.id
                log_update(f"ztp_{pk}", f"Found site '{site_name}' (ID: {site_id})")
            except Site.DoesNotExist:
                log_update(
                    f"ztp_{pk}",
                    f"Warning: Site '{site_name}' not in database. Device will be unassigned.",
                )
                site_id = None

        if not all([ip_address, platform]):
            return Response(
                {"error": "Missing required fields: ip_address, platform"}, status=400
            )

        log_update(f"ztp_{pk}", f"ZTP Provision Request from {ip_address}")

        from swim_backend.devices.models import Device, DeviceModel
        from swim_backend.core.services.genie_service import create_genie_device

        try:
            log_update(f"ztp_{pk}", f"Connecting to {ip_address}...")

            # Build temp device object to test connectivity
            temp_device = Device(
                hostname=f"temp_{ip_address}",
                ip_address=ip_address,
                username=username,
                password=password,
                secret=secret,
                platform=platform,
            )

            dev, _ = create_genie_device(temp_device, f"ztp_{pk}")
            dev.connect(log_stdout=False, learn_hostname=True)

            # Grab hostname from device itself
            hostname = (
                hostname_override or dev.learned_hostname or f"device_{ip_address}"
            )

            # Pull MAC from show version output
            output = dev.parse("show version")
            mac_address = None

            if isinstance(output, dict):
                version_info = output.get("version", {})
                # MAC address field varies by platform (IOS, IOS-XE, NX-OS)
                mac_address = (
                    version_info.get("base_ethernet_mac_address")
                    or version_info.get("mac_address")
                    or version_info.get("system_mac_address")
                )

                # Grab version and chassis info while we're here
                current_version = version_info.get("version", "unknown")
                chassis = version_info.get("chassis", "unknown")
                boot_method = version_info.get("system_image")

            dev.disconnect()
            log_update(
                f"ztp_{pk}", f"Discovered: hostname={hostname}, mac={mac_address}"
            )

        except Exception as e:
            log_update(f"ztp_{pk}", f"Connection failed: {e}")
            return Response({"error": f"Failed to connect to device: {e}"}, status=400)

        existing_device = None
        if mac_address:
            existing_device = Device.objects.filter(
                hostname=hostname, mac_address=mac_address
            ).first()
        else:
            # Some devices don't expose MAC in show version - fallback to hostname
            existing_device = Device.objects.filter(hostname=hostname).first()

        if existing_device:
            log_update(
                f"ztp_{pk}",
                f"Device {hostname} found in inventory (ID: {existing_device.id})",
            )

            # Check if device is already running the right IOS version
            if existing_device.model and existing_device.model.default_image:
                golden_version = existing_device.model.default_image.version

                # Compare running version to golden standard
                if existing_device.version == golden_version:
                    log_update(
                        f"ztp_{pk}",
                        f"Device {hostname} is already compliant with golden image. Skipping.",
                    )
                    ztp.skipped_devices += 1
                    ztp.total_devices += 1
                    ztp.save()
                    return Response(
                        {
                            "status": "skipped",
                            "reason": "Device already compliant",
                            "device_id": existing_device.id,
                            "current_version": existing_device.version,
                            "golden_version": golden_version,
                        }
                    )

            device = existing_device
        else:
            log_update(f"ztp_{pk}", f"Adding {hostname} to inventory...")

            # Figure out which site to assign
            if not site_id and ztp.target_site:
                site_id = ztp.target_site.id

            # Add device to database
            device = Device.objects.create(
                hostname=hostname,
                ip_address=ip_address,
                username=username,
                password=password,
                secret=secret,
                platform=platform,
                family=family,
                mac_address=mac_address,
                reachability="Reachable",
                site_id=site_id,
                last_sync_status="Pending",
            )
            log_update(f"ztp_{pk}", f"Device added with ID: {device.id}")

        log_update(f"ztp_{pk}", f"Syncing device {hostname}...")
        from swim_backend.core.services.sync_service import sync_device_details

        try:
            # Pull full device details - model, version, hardware info
            sync_device_details(device.id)
            device.refresh_from_db()
            log_update(
                f"ztp_{pk}",
                f"Sync complete. Model: {device.model}, Version: {device.version}",
            )
        except Exception as e:
            log_update(f"ztp_{pk}", f"Sync failed: {e}")
            ztp.failed_devices += 1
            ztp.total_devices += 1
            ztp.save()
            return Response(
                {"error": f"Device sync failed: {e}", "device_id": device.id},
                status=500,
            )

        if not device.model:
            log_update(
                f"ztp_{pk}", f"Can't determine model for {hostname}. Skipping upgrade."
            )
            ztp.skipped_devices += 1
            ztp.total_devices += 1
            ztp.save()
            return Response(
                {
                    "status": "skipped",
                    "reason": "No model detected",
                    "device_id": device.id,
                }
            )

        if not device.model.default_image:
            log_update(
                f"ztp_{pk}",
                f"No golden IOS image configured for {device.model.name}. Can't upgrade.",
            )
            ztp.skipped_devices += 1
            ztp.total_devices += 1
            ztp.save()
            return Response(
                {
                    "status": "skipped",
                    "reason": "No golden image set for model",
                    "device_id": device.id,
                    "model": device.model.name,
                }
            )

        # Verify device matches our deployment criteria
        if ztp.device_family_filter and device.family != ztp.device_family_filter:
            log_update(
                f"ztp_{pk}",
                f"Device family {device.family} does not match filter. Skipping.",
            )
            ztp.skipped_devices += 1
            ztp.total_devices += 1
            ztp.save()
            return Response(
                {
                    "status": "skipped",
                    "reason": "Device family filter mismatch",
                    "device_id": device.id,
                }
            )

        if ztp.platform_filter and device.platform != ztp.platform_filter:
            log_update(
                f"ztp_{pk}",
                f"Device platform {device.platform} does not match filter. Skipping.",
            )
            ztp.skipped_devices += 1
            ztp.total_devices += 1
            ztp.save()
            return Response(
                {
                    "status": "skipped",
                    "reason": "Platform filter mismatch",
                    "device_id": device.id,
                }
            )

        if ztp.model_filter and device.model != ztp.model_filter:
            log_update(
                f"ztp_{pk}",
                f"Device model {device.model.name} does not match filter. Skipping.",
            )
            ztp.skipped_devices += 1
            ztp.total_devices += 1
            ztp.save()
            return Response(
                {
                    "status": "skipped",
                    "reason": "Model filter mismatch",
                    "device_id": device.id,
                }
            )

        log_update(f"ztp_{pk}", f"Creating upgrade job for {hostname}...")

        # Determine file server (similar to normal upgrade pipeline)
        # Use device preferred, or image default, or fallback to first available
        target_image = device.model.default_image
        file_server = device.preferred_file_server or target_image.file_server
        
        if not file_server:
            # Fallback: try to find a global default file server
            from swim_backend.images.models import FileServer
            file_server = FileServer.objects.filter(is_global_default=True).first()
            
        if not file_server:
            # Last resort: just take the first one
            file_server = FileServer.objects.first()

        # Queue up the IOS upgrade job
        remarks = request.data.get("remarks", "ZTP Auto-Provision")
        job = Job.objects.create(
            device=device,
            image=target_image,
            file_server=file_server,
            workflow=ztp.workflow,
            task_name=f"ZTP Auto-Provision: {ztp.name}",
            remarks=remarks,
            status="pending",
            created_by=request.user,
        )

        # Attach pre/post checks (show version, inventory, etc.)
        if ztp.precheck_validations.exists():
            job.selected_checks.set(ztp.precheck_validations.all())
        if ztp.postcheck_validations.exists():
            job.selected_checks.add(*ztp.postcheck_validations.all())

        # Add device to provisioned list
        ztp.devices_provisioned.add(device)
        ztp.total_devices += 1
        ztp.save()

        # Kick off the upgrade in the background
        log_update(f"ztp_{pk}", f"Job {job.id} created. Starting execution...")
        t = threading.Thread(target=run_swim_job, args=(job.id,))
        t.daemon = True
        t.start()

        # Return job ID so device can check status later
        return Response(
            {
                "status": "accepted",
                "message": "Device provisioning job created successfully",
                "job_id": job.id,
                "device_id": device.id,
                "device_hostname": device.hostname,
                "workflow_name": ztp.workflow.name,
                "target_image": device.model.default_image.filename,
                "target_version": device.model.default_image.version,
                "job_status_url": request.build_absolute_uri(
                    f"/api/core/jobs/{job.id}/"
                ),
            },
            status=202,
        )

    @action(detail=True, methods=["post"])
    def toggle_status(self, request, pk=None):
        """Toggle workflow between active and paused"""
        ztp = self.get_object()
        if ztp.status == "active":
            ztp.status = "paused"
        elif ztp.status == "paused":
            ztp.status = "active"
        ztp.save()
        return Response({"status": ztp.status})

    @action(detail=True, methods=["get"])
    def stats(self, request, pk=None):
        """Get detailed statistics for ZTP workflow"""
        ztp = self.get_object()

        # Get jobs associated with this ZTP
        jobs = Job.objects.filter(
            task_name__startswith=f"ZTP Auto-Provision: {ztp.name}"
        )

        return Response(
            {
                "total_devices": ztp.total_devices,
                "completed": ztp.completed_devices,
                "failed": ztp.failed_devices,
                "skipped": ztp.skipped_devices,
                "in_progress": jobs.filter(
                    status__in=["running", "distributing", "activating"]
                ).count(),
                "pending": jobs.filter(status__in=["pending", "scheduled"]).count(),
                "progress_percentage": int(
                    (ztp.completed_devices / ztp.total_devices * 100)
                )
                if ztp.total_devices > 0
                else 0,
                "webhook_url": request.build_absolute_uri(
                    f"/api/core/ztp-workflows/{pk}/provision_device/"
                ),
                "webhook_token": ztp.webhook_token,
                "devices": [
                    {
                        "job_id": j.id,
                        "device_id": j.device.id,
                        "hostname": j.device.hostname,
                        "ip_address": j.device.ip_address,
                        "status": j.status,
                        "timestamp": j.updated_at,
                        "message": j.log.split('\n')[-1] if j.log else ""
                    }
                    for j in jobs.order_by("-updated_at")[:50]  # Limit to last 50 for performance
                ]
            }
        )
