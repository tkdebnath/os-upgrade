from django.db import models
from rest_framework import serializers, viewsets

class Region(models.Model):
    name = models.CharField(max_length=100, unique=True)
    preferred_file_server = models.ForeignKey('images.FileServer', on_delete=models.SET_NULL, null=True, blank=True, related_name='preferred_regions')

    def __str__(self):
        return self.name

class GlobalCredential(models.Model):
    # Singleton pattern implied by usage (we'll fetch .first())
    username = models.CharField(max_length=255)
    password = models.CharField(max_length=255)
    secret = models.CharField(max_length=255, blank=True, null=True)

    def __str__(self):
        return "Global Credentials"

class Site(models.Model):
    name = models.CharField(max_length=100, unique=True)
    address = models.TextField(blank=True, null=True)
    preferred_file_server = models.ForeignKey('images.FileServer', on_delete=models.SET_NULL, null=True, blank=True, related_name='preferred_sites')
    region = models.ForeignKey(Region, on_delete=models.SET_NULL, null=True, blank=True, related_name='sites')
    
    def __str__(self):
        return self.name

class DeviceModel(models.Model):
    name = models.CharField(max_length=100, unique=True)
    vendor = models.CharField(max_length=50, default='Cisco')
    
    # Golden Image Standards
    golden_image_version = models.CharField(max_length=50, blank=True, null=True)
    golden_image_file = models.CharField(max_length=255, blank=True, null=True)
    golden_image_size = models.BigIntegerField(null=True, blank=True, help_text="Size in bytes")
    golden_image_md5 = models.CharField(max_length=32, null=True, blank=True, help_text="MD5 Checksum")
    
    # Dynamic Scanning
    golden_image_path = models.CharField(max_length=255, blank=True, null=True, help_text="Remote folder path to scan for images")
    default_file_server = models.ForeignKey('images.FileServer', on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return self.name

class Device(models.Model):
    hostname = models.CharField(max_length=255, unique=True)
    ip_address = models.GenericIPAddressField()
    username = models.CharField(max_length=255, blank=True, null=True)
    password = models.CharField(max_length=255, blank=True, null=True) # Encrypt in production
    secret = models.CharField(max_length=255, blank=True, null=True) # Enable secret
    platform = models.CharField(max_length=50, default='iosxe')
    
    # Relationships
    model = models.ForeignKey(DeviceModel, on_delete=models.SET_NULL, null=True, blank=True, related_name='devices')
    version = models.CharField(max_length=50, blank=True, null=True)
    
    # New fields for Feature Parity
    FAMILY_CHOICES = [('Switch', 'Switch'), ('Router', 'Router'), ('AP', 'AP'), ('WLC', 'WLC')]
    family = models.CharField(max_length=20, choices=FAMILY_CHOICES, default='Switch')
    preferred_file_server = models.ForeignKey('images.FileServer', on_delete=models.SET_NULL, null=True, blank=True, related_name='preferred_devices')
    
    REACHABILITY_CHOICES = [('Reachable', 'Reachable'), ('Unreachable', 'Unreachable'), ('Unknown', 'Unknown')]
    reachability = models.CharField(max_length=20, choices=REACHABILITY_CHOICES, default='Unknown')

    # Sync Status
    SYNC_STATUS_CHOICES = [('Pending', 'Pending'), ('In Progress', 'In Progress'), ('Completed', 'Completed'), ('Failed', 'Failed')]
    last_sync_status = models.CharField(max_length=20, choices=SYNC_STATUS_CHOICES, default='Pending')
    last_sync_time = models.DateTimeField(null=True, blank=True)
    
    site = models.ForeignKey(Site, on_delete=models.SET_NULL, null=True, blank=True, related_name='devices')
    
    def __str__(self):
        return self.hostname

    def __str__(self):
        return self.hostname

