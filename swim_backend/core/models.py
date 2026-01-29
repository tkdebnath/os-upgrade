from django.db import models
from swim_backend.devices.models import Device
from swim_backend.devices.models import Device
from swim_backend.images.models import Image, FileServer
from swim_backend.core.rbac_models import PermissionBundle
# APIToken is defined below

class APIToken(models.Model):
    """API Token for user authentication"""
    from django.contrib.auth.models import User
    import secrets
    import string
    
    def generate_token():
        """Generate a secure random token (40 characters)"""
        import secrets
        import string
        alphabet = string.ascii_letters + string.digits
        return ''.join(secrets.choice(alphabet) for _ in range(40))
    
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE, related_name='api_tokens')
    key = models.CharField(max_length=100, unique=True, default=generate_token)
    write_enabled = models.BooleanField(default=True, help_text='Permit create/update/delete operations using this key')
    expires = models.DateTimeField(null=True, blank=True, help_text='Token expiration date/time (optional)')
    description = models.CharField(max_length=255, blank=True)
    allowed_ips = models.TextField(blank=True, help_text='Allowed IPv4/IPv6 networks (comma-separated)')
    created = models.DateTimeField(auto_now_add=True)
    last_used = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created']
        verbose_name = 'API Token'
        verbose_name_plural = 'API Tokens'
    
    def __str__(self):
        return f"{self.user.username} - {self.key[:8]}..."
    
    @property
    def is_expired(self):
        """Check if token is expired"""
        if not self.expires:
            return False
        from django.utils import timezone
        return timezone.now() > self.expires

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


class ActivityLog(models.Model):
    """Track all user actions for audit purposes"""
    ACTION_CHOICES = [
        ('create', 'Create'),
        ('update', 'Update'),
        ('delete', 'Delete'),
        ('login', 'Login'),
        ('logout', 'Logout'),
        ('view', 'View'),
    ]
    
    user = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True, related_name='activity_logs')
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    content_type = models.ForeignKey('contenttypes.ContentType', on_delete=models.SET_NULL, null=True, blank=True)
    object_id = models.PositiveIntegerField(null=True, blank=True)
    object_repr = models.CharField(max_length=255, blank=True, help_text='String representation of the object')
    changes = models.JSONField(null=True, blank=True, help_text='Field changes for updates')
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-timestamp']
        verbose_name = 'Activity Log'
        verbose_name_plural = 'Activity Logs'
        indexes = [
            models.Index(fields=['-timestamp']),
            models.Index(fields=['user', '-timestamp']),
            models.Index(fields=['action', '-timestamp']),
        ]
    
    def __str__(self):
        user_name = self.user.username if self.user else 'Unknown'
        return f"{user_name} - {self.action} - {self.object_repr or 'N/A'} - {self.timestamp.strftime('%Y-%m-%d %H:%M')}"
