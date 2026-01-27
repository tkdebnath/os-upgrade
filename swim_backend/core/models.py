from django.db import models
from swim_backend.devices.models import Device
from swim_backend.devices.models import Device
from swim_backend.images.models import Image, FileServer

class Workflow(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

class WorkflowStep(models.Model):
    STEP_TYPES = [
        ('readiness', 'Readiness Check'),
        ('distribution', 'Software Distribution'),
        ('precheck', 'Pre-Checks'),
        ('activation', 'Activation'),
        ('postcheck', 'Post-Checks'),
        ('wait', 'Wait Step'),
        ('ping', 'Reachability Check'),
        ('custom', 'Custom Action')
    ]
    
    workflow = models.ForeignKey(Workflow, on_delete=models.CASCADE, related_name='steps')
    name = models.CharField(max_length=100)
    step_type = models.CharField(max_length=50, choices=STEP_TYPES)
    order = models.IntegerField(default=0)
    config = models.JSONField(default=dict, blank=True)
    
    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.order}. {self.name} ({self.workflow.name})"

class Job(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('scheduled', 'Scheduled'),
        ('distributing', 'Distributing'),
        ('distributed', 'Distributed'), # File transferred but not activated
        ('activating', 'Activating'),
        ('success', 'Success'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]

    device = models.ForeignKey(Device, on_delete=models.CASCADE, related_name='jobs')
    device = models.ForeignKey(Device, on_delete=models.CASCADE, related_name='jobs')
    image = models.ForeignKey(Image, on_delete=models.SET_NULL, null=True, blank=True)
    file_server = models.ForeignKey(FileServer, on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    task_name = models.CharField(max_length=100, default='Upgrade-Task')
    
    # Workflow Scheduling
    workflow = models.ForeignKey(Workflow, on_delete=models.SET_NULL, null=True, blank=True)
    execution_mode = models.CharField(max_length=20, default='parallel', choices=[('parallel', 'Parallel'), ('sequential', 'Sequential')])
    batch_id = models.UUIDField(null=True, blank=True)
    
    distribution_time = models.DateTimeField(null=True, blank=True)
    activation_time = models.DateTimeField(null=True, blank=True)
    activate_after_distribute = models.BooleanField(default=True)
    cleanup_flash = models.BooleanField(default=False)
    
    # Custom Checks
    # Custom Checks
    selected_checks = models.ManyToManyField('ValidationCheck', blank=True)
    
    # Detailed Progress tracking
    steps = models.JSONField(default=list, blank=True) # [{'name': 'MD5', 'status': 'success', 'timestamp': '...'}, ...]
    created_by = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True, blank=True)

    log = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Job {self.id} - {self.device.hostname}"

class ValidationCheck(models.Model):
    CHECK_TYPES = [('pre', 'Pre-Check'), ('post', 'Post-Check'), ('both', 'Both')]
    CATEGORIES = [('script', 'Custom Script'), ('genie', 'Genie Feature'), ('command', 'Custom Command')]
    
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    check_type = models.CharField(max_length=10, choices=CHECK_TYPES, default='both')
    category = models.CharField(max_length=20, choices=CATEGORIES, default='script')
    
    # For script: python path. For genie: feature name (e.g. 'bgp')
    command = models.CharField(max_length=255, help_text="Python path or Genie feature name")
    is_default = models.BooleanField(default=False)

    def __str__(self):
        return self.name

class GoldenImage(models.Model):
    platform = models.CharField(max_length=50) # e.g. "iosxe" or "CAT9K"
    site = models.CharField(max_length=100, default='Global')
    image = models.ForeignKey(Image, on_delete=models.CASCADE)
    
    class Meta:
        unique_together = ('platform', 'site')

    def __str__(self):
        return f"Golden Image for {self.platform} at {self.site}: {self.image.version}"

class CheckRun(models.Model):
    STATUS_CHOICES = [('pending', 'Pending'), ('running', 'Running'), ('success', 'Success'), ('failed', 'Failed')]
    
    device = models.ForeignKey(Device, on_delete=models.CASCADE, related_name='check_runs')
    job = models.ForeignKey('Job', on_delete=models.CASCADE, related_name='check_runs', null=True, blank=True)
    validation_check = models.ForeignKey(ValidationCheck, on_delete=models.CASCADE)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    output = models.TextField(blank=True, default='')
    
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return f"CheckRun: {self.validation_check.name} on {self.device.hostname}"
