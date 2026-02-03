from django.db import models
from django.contrib.auth.models import User, Group, Permission
from django.contrib.contenttypes.models import ContentType


class PermissionBundle(models.Model):
    """
    A bundle of permissions that can be assigned to users/groups.
    Similar to NetBox's custom permissions.
    """
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True, null=True)
    enabled = models.BooleanField(default=True)
    
    # Actions
    can_view = models.BooleanField(default=False)
    can_add = models.BooleanField(default=False)
    can_change = models.BooleanField(default=False)
    can_delete = models.BooleanField(default=False)
    
    # Additional custom actions
    additional_actions = models.TextField(
        blank=True, 
        null=True,
        help_text="Comma-separated list of custom actions like 'sync', 'upgrade', 'export'"
    )
    
    # Object types this permission applies to
    object_types = models.ManyToManyField(
        ContentType,
        blank=True,
        related_name='permission_bundles',
        help_text="Models this permission applies to"
    )
    
    # Direct assignment
    groups = models.ManyToManyField(Group, blank=True, related_name='permission_bundles')
    users = models.ManyToManyField(User, blank=True, related_name='permission_bundles')
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
        verbose_name = 'Permission Bundle'
        verbose_name_plural = 'Permission Bundles'
    
    def __str__(self):
        return self.name
    
    def get_actions(self):
        """Return list of all enabled actions"""
        actions = []
        if self.can_view:
            actions.append('view')
        if self.can_add:
            actions.append('add')
        if self.can_change:
            actions.append('change')
        if self.can_delete:
            actions.append('delete')
        
        # Add custom actions
        if self.additional_actions:
            custom = [a.strip() for a in self.additional_actions.split(',') if a.strip()]
            actions.extend(custom)
        
        return actions
    
    def get_django_permissions(self):
        """
        Returns QuerySet of Django Permission objects that this bundle represents.
        Used to sync bundle with actual Django permissions.
        """
        if not self.object_types.exists():
            return Permission.objects.none()
        
        permissions = []
        actions = self.get_actions()
        
        for content_type in self.object_types.all():
            # Get all permissions for this content type
            ct_permissions = Permission.objects.filter(content_type=content_type)
            
            for action in actions:
                # Try different codename formats
                possible_codenames = [
                    action,  # Exact match first (for custom permissions like can_delete_ztp)
                    f"{action}_{content_type.model}",  # Standard: view_device
                ]
                
                # For models with custom permissions, try action_modelname variations
                # e.g., dashboardproxy -> view_dashboard
                model_name = content_type.model
                if model_name.endswith('proxy'):
                    # Remove 'proxy' suffix and try
                    base_name = model_name[:-5]  # Remove 'proxy'
                    possible_codenames.append(f"{action}_{base_name}")
                
                for codename in possible_codenames:
                    try:
                        perm = ct_permissions.get(codename=codename)
                        permissions.append(perm.id)
                        break  # Found it, move to next action
                    except Permission.DoesNotExist:
                        continue
        
        return Permission.objects.filter(id__in=permissions)
    
    def sync_to_groups(self):
        """
        Sync this bundle's permissions to assigned groups.
        Adds the underlying Django permissions to each group.
        """
        if not self.enabled:
            return
        
        django_perms = self.get_django_permissions()
        for group in self.groups.all():
            group.permissions.add(*django_perms)
    
    def sync_to_users(self):
        """
        Sync this bundle's permissions to assigned users.
        """
        if not self.enabled:
            return
        
        django_perms = self.get_django_permissions()
        for user in self.users.all():
            user.user_permissions.add(*django_perms)
