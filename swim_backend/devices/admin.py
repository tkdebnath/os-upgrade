from django.contrib import admin
from .models import Device

@admin.register(Device)
class DeviceAdmin(admin.ModelAdmin):
    list_display = ('hostname', 'ip_address', 'platform', 'version')
    search_fields = ('hostname', 'ip_address')
