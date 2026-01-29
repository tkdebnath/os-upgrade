from django.contrib import admin
from .models import Device, Site, DeviceModel, Region, GlobalCredential

@admin.register(Device)
class DeviceAdmin(admin.ModelAdmin):
    list_display = ('hostname', 'ip_address', 'platform', 'version', 'site', 'reachability')
    list_filter = ('platform', 'reachability', 'site', 'model')
    search_fields = ('hostname', 'ip_address')
    readonly_fields = ('last_sync_time',)

@admin.register(Site)
class SiteAdmin(admin.ModelAdmin):
    list_display = ('name', 'region', 'preferred_file_server')
    list_filter = ('region',)
    search_fields = ('name', 'address')

@admin.register(DeviceModel)
class DeviceModelAdmin(admin.ModelAdmin):
    list_display = ('name', 'golden_image_version', 'default_image', 'default_file_server')
    search_fields = ('name',)

@admin.register(Region)
class RegionAdmin(admin.ModelAdmin):
    list_display = ('name', 'preferred_file_server')
    search_fields = ('name',)

@admin.register(GlobalCredential)
class GlobalCredentialAdmin(admin.ModelAdmin):
    list_display = ('username',)
    readonly_fields = ('password', 'secret')
    
    def has_add_permission(self, request):
        # Only allow one global credential
        return not GlobalCredential.objects.exists()
