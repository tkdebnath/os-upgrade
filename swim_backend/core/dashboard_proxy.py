"""
Proxy model to provide custom permissions for Dashboard.
This allows dashboard access to be controlled via Django's permission system.
"""
from django.db import models


class DashboardProxy(models.Model):
    """
    Proxy model that doesn't create a database table but provides custom permissions.
    Used to control dashboard access through Django's permission system.
    """
    
    class Meta:
        managed = False  # Don't create a database table
        default_permissions = ()  # Don't create default add/change/delete permissions
        permissions = [
            ('view_dashboard', 'Can view dashboard'),
        ]
        verbose_name = 'Dashboard'
        verbose_name_plural = 'Dashboard'
