from django.contrib.contenttypes.models import ContentType
from django.db.models.signals import post_save, post_delete, pre_save, m2m_changed
from django.dispatch import receiver
from django.contrib.auth.signals import user_logged_in, user_logged_out
from swim_backend.core.models import ActivityLog
import json


def get_client_ip(request):
    """Extract client IP from request"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


def log_activity(user, action, obj=None, changes=None, request=None):
    """
    Log user activity
    
    Args:
        user: User instance
        action: 'create', 'update', 'delete', 'login', 'logout', 'view'
        obj: The object being acted upon (optional)
        changes: Dictionary of field changes for updates (optional)
        request: HTTP request object (optional)
    """
    if not user or not user.is_authenticated:
        return
    
    content_type = None
    object_id = None
    object_repr = ''
    
    if obj:
        content_type = ContentType.objects.get_for_model(obj)
        object_id = obj.pk
        object_repr = str(obj)[:255]
    
    ip_address = None
    user_agent = ''
    
    if request:
        ip_address = get_client_ip(request)
        user_agent = request.META.get('HTTP_USER_AGENT', '')[:500]
    
    ActivityLog.objects.create(
        user=user,
        action=action,
        content_type=content_type,
        object_id=object_id,
        object_repr=object_repr,
        changes=changes,
        ip_address=ip_address,
        user_agent=user_agent
    )


class ActivityLoggerMiddleware:
    """Middleware to attach request to thread-local storage for signals"""
    _request = None
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        ActivityLoggerMiddleware._request = request
        response = self.get_response(request)
        ActivityLoggerMiddleware._request = None
        return response
    
    @classmethod
    def get_current_request(cls):
        return cls._request


# Signal handlers for login/logout
@receiver(user_logged_in)
def log_user_login(sender, request, user, **kwargs):
    log_activity(user, 'login', request=request)


@receiver(user_logged_out)
def log_user_logout(sender, request, user, **kwargs):
    log_activity(user, 'logout', request=request)


# Track model changes for configured models
TRACKED_MODELS = [
    'Device', 'DeviceModel', 'Site', 'Region', 'GlobalCredential',
    'Image', 'FileServer',
    'Job', 'Workflow', 'ValidationCheck',
    'User', 'Group', 'PermissionBundle', 'APIToken'
]

# Store original values before save
_original_values = {}


@receiver(pre_save)
def store_original_values(sender, instance, **kwargs):
    """Store original values before save for change tracking"""
    if sender.__name__ not in TRACKED_MODELS:
        return
    
    if instance.pk:
        try:
            original = sender.objects.get(pk=instance.pk)
            original_data = {}
            
            # Store regular fields
            for field in sender._meta.fields:
                if not field.name.endswith('_ptr'):
                    original_data[field.name] = getattr(original, field.name)
            
            # Store many-to-many fields
            for field in sender._meta.many_to_many:
                m2m_values = list(getattr(original, field.name).values_list('id', flat=True))
                original_data[field.name] = m2m_values
            
            _original_values[id(instance)] = original_data
        except sender.DoesNotExist:
            pass


@receiver(post_save)
def log_model_save(sender, instance, created, **kwargs):
    """Log create/update actions"""
    if sender.__name__ not in TRACKED_MODELS:
        return
    
    # Skip if this is an ActivityLog to avoid infinite recursion
    if sender.__name__ == 'ActivityLog':
        return
    
    request = ActivityLoggerMiddleware.get_current_request()
    user = getattr(request, 'user', None) if request else None
    
    if not user or not user.is_authenticated:
        return
    
    if created:
        log_activity(user, 'create', obj=instance, request=request)
    else:
        # Track changes
        changes = {}
        instance_id = id(instance)
        
        if instance_id in _original_values:
            original = _original_values[instance_id]
            
            # Check regular fields
            for field in sender._meta.fields:
                if field.name.endswith('_ptr'):
                    continue
                    
                field_name = field.name
                old_value = original.get(field_name)
                new_value = getattr(instance, field_name, None)
                
                if old_value != new_value:
                    # Convert to string for JSON serialization
                    changes[field_name] = {
                        'old': str(old_value) if old_value is not None else None,
                        'new': str(new_value) if new_value is not None else None
                    }
            
            # Check many-to-many fields (compare after save using m2m_changed signal)
            # Store for m2m comparison
            _original_values[f'{instance_id}_m2m_check'] = original
            
            # Clean up regular original values
            del _original_values[instance_id]
        
        if changes:
            log_activity(user, 'update', obj=instance, changes=changes, request=request)


@receiver(post_delete)
def log_model_delete(sender, instance, **kwargs):
    """Log delete actions"""
    if sender.__name__ not in TRACKED_MODELS:
        return
    
    # Skip if this is an ActivityLog
    if sender.__name__ == 'ActivityLog':
        return
    
    request = ActivityLoggerMiddleware.get_current_request()
    user = getattr(request, 'user', None) if request else None
    
    if not user or not user.is_authenticated:
        return
    
    log_activity(user, 'delete', obj=instance, request=request)


@receiver(m2m_changed)
def log_m2m_changes(sender, instance, action, model, pk_set, **kwargs):
    """Log many-to-many field changes"""
    # Only track after the change is complete
    if action not in ['post_add', 'post_remove', 'post_clear']:
        return
    
    # Check if instance's model is tracked
    if instance.__class__.__name__ not in TRACKED_MODELS:
        return
    
    request = ActivityLoggerMiddleware.get_current_request()
    user = getattr(request, 'user', None) if request else None
    
    if not user or not user.is_authenticated:
        return
    
    # Get the field name
    field_name = None
    for field in instance.__class__._meta.many_to_many:
        if field.remote_field.through == sender:
            field_name = field.name
            break
    
    if not field_name:
        return
    
    # Check if we have original values stored
    instance_id = id(instance)
    original_key = f'{instance_id}_m2m_check'
    
    if original_key in _original_values:
        original = _original_values[original_key]
        old_ids = set(original.get(field_name, []))
        new_ids = set(getattr(instance, field_name).values_list('id', flat=True))
        
        if old_ids != new_ids:
            # Get string representations
            old_items = [str(model.objects.get(pk=pk)) for pk in old_ids if model.objects.filter(pk=pk).exists()]
            new_items = [str(model.objects.get(pk=pk)) for pk in new_ids if model.objects.filter(pk=pk).exists()]
            
            changes = {
                field_name: {
                    'old': ', '.join(sorted(old_items)) if old_items else 'None',
                    'new': ', '.join(sorted(new_items)) if new_items else 'None'
                }
            }
            
            log_activity(user, 'update', obj=instance, changes=changes, request=request)
        
        # Clean up
        del _original_values[original_key]

