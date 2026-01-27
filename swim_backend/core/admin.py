from django.contrib import admin
from .models import Job

@admin.register(Job)
class JobAdmin(admin.ModelAdmin):
    list_display = ('id', 'device', 'status', 'created_at')
    list_filter = ('status', 'created_at')
    readonly_fields = ('log', 'created_at', 'updated_at')
