from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
import json
from .models import Job, ActivityLog, Workflow, WorkflowStep, ValidationCheck, CheckRun, APIToken, ZTPWorkflow

@admin.register(Job)
class JobAdmin(admin.ModelAdmin):
    list_display = ('id', 'device', 'workflow', 'status', 'created_at', 'updated_at')
    list_filter = ('status', 'workflow', 'created_at')
    readonly_fields = ('log', 'created_at', 'updated_at')
    search_fields = ('device__hostname', 'device__ip_address')

@admin.register(Workflow)
class WorkflowAdmin(admin.ModelAdmin):
    list_display = ('name', 'description', 'is_default')
    list_filter = ('is_default',)
    search_fields = ('name', 'description')

@admin.register(WorkflowStep)
class WorkflowStepAdmin(admin.ModelAdmin):
    list_display = ('workflow', 'name', 'step_type', 'order')
    list_filter = ('workflow', 'step_type')
    search_fields = ('workflow__name', 'name')

@admin.register(ValidationCheck)
class ValidationCheckAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'check_type', 'command')
    list_filter = ('category', 'check_type', 'is_default')
    search_fields = ('name', 'command', 'description')

@admin.register(CheckRun)
class CheckRunAdmin(admin.ModelAdmin):
    list_display = ('job', 'validation_check', 'device', 'status', 'created_at')
    list_filter = ('status', 'validation_check__category', 'created_at')
    readonly_fields = ('job', 'validation_check', 'device', 'output', 'created_at')
    search_fields = ('job__device__hostname', 'validation_check__name')

@admin.register(APIToken)
class APITokenAdmin(admin.ModelAdmin):
    list_display = ('user', 'key_preview', 'write_enabled', 'created', 'last_used', 'is_expired')
    list_filter = ('write_enabled', 'created')
    readonly_fields = ('key', 'created', 'last_used')
    search_fields = ('user__username', 'description')
    
    def key_preview(self, obj):
        return f"{obj.key[:8]}..." if obj.key else "—"
    key_preview.short_description = 'Key Preview'
    
    def is_expired(self, obj):
        return obj.is_expired
    is_expired.boolean = True
    is_expired.short_description = 'Expired'


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ('timestamp', 'user_link', 'action_badge', 'content_type', 'object_link', 'changes_preview', 'ip_address')
    list_filter = ('action', 'timestamp', 'user', 'content_type')
    search_fields = ('user__username', 'object_repr', 'ip_address', 'user_agent')
    readonly_fields = ('user', 'action', 'content_type', 'object_id', 'object_repr', 
                      'changes_display', 'ip_address', 'user_agent', 'timestamp')
    date_hierarchy = 'timestamp'
    list_per_page = 25
    
    fieldsets = (
        ('Log Information', {
            'fields': ('timestamp', 'user', 'action', 'ip_address')
        }),
        ('Object Details', {
            'fields': ('content_type', 'object_id', 'object_repr')
        }),
        ('Changes', {
            'fields': ('changes_display',),
            'classes': ('wide',)
        }),
        ('Request Details', {
            'fields': ('user_agent',),
            'classes': ('collapse',)
        }),
    )
    
    def user_link(self, obj):
        if obj.user:
            url = reverse('admin:auth_user_change', args=[obj.user.pk])
            return format_html('<a href="{}">{}</a>', url, obj.user.username)
        return '—'
    user_link.short_description = 'User'
    
    def action_badge(self, obj):
        colors = {
            'create': '#10b981',  # green
            'update': '#3b82f6',  # blue
            'delete': '#ef4444',  # red
            'login': '#8b5cf6',   # purple
            'logout': '#6b7280',  # gray
            'view': '#06b6d4',    # cyan
        }
        color = colors.get(obj.action, '#6b7280')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 2px 8px; '
            'border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase;">{}</span>',
            color, obj.action
        )
    action_badge.short_description = 'Action'
    
    def object_link(self, obj):
        if obj.content_type and obj.object_id:
            try:
                model_class = obj.content_type.model_class()
                admin_url = f'admin:{obj.content_type.app_label}_{obj.content_type.model}_change'
                url = reverse(admin_url, args=[obj.object_id])
                return format_html('<a href="{}">{}</a>', url, obj.object_repr or f'{obj.content_type.model} #{obj.object_id}')
            except:
                return obj.object_repr or '—'
        return obj.object_repr or '—'
    object_link.short_description = 'Object'
    
    def changes_preview(self, obj):
        if obj.changes:
            count = len(obj.changes)
            return format_html(
                '<span style="color: #6b7280;">{} field{} changed</span>',
                count, 's' if count != 1 else ''
            )
        return '—'
    changes_preview.short_description = 'Changes'
    
    def changes_display(self, obj):
        if not obj.changes:
            return '—'
        
        html = '<div style="font-family: monospace; font-size: 12px;">'
        html += '<table style="width: 100%; border-collapse: collapse;">'
        html += '<tr style="background-color: #f3f4f6; font-weight: bold;">'
        html += '<th style="padding: 8px; text-align: left; border: 1px solid #e5e7eb;">Field</th>'
        html += '<th style="padding: 8px; text-align: left; border: 1px solid #e5e7eb;">Old Value</th>'
        html += '<th style="padding: 8px; text-align: left; border: 1px solid #e5e7eb;">New Value</th>'
        html += '</tr>'
        
        for field, change in obj.changes.items():
            old_value = change.get('old', '—')
            new_value = change.get('new', '—')
            
            html += '<tr>'
            html += f'<td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: 600;">{field}</td>'
            html += f'<td style="padding: 8px; border: 1px solid #e5e7eb; background-color: #fee2e2; color: #991b1b;">{old_value}</td>'
            html += f'<td style="padding: 8px; border: 1px solid #e5e7eb; background-color: #dcfce7; color: #166534;">{new_value}</td>'
            html += '</tr>'
        
        html += '</table></div>'
        return mark_safe(html)
    changes_display.short_description = 'Field Changes'
    
    def has_add_permission(self, request):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False
    
    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser


@admin.register(ZTPWorkflow)
class ZTPWorkflowAdmin(admin.ModelAdmin):
    list_display = ('name', 'workflow', 'target_site', 'status', 'success_rate_display', 'total_devices', 'created_at')
    list_filter = ('status', 'target_site', 'device_family_filter', 'created_at')
    readonly_fields = ('created_by', 'created_at', 'updated_at', 'webhook_token', 'success_rate_display')
    search_fields = ('name', 'description')
    filter_horizontal = ('devices_provisioned', 'precheck_validations', 'postcheck_validations')
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'description', 'status')
        }),
        ('Workflow Configuration', {
            'fields': ('workflow', 'target_site')
        }),
        ('Device Filters (Optional)', {
            'fields': ('device_family_filter', 'platform_filter', 'model_filter'),
            'classes': ('collapse',)
        }),
        ('Validation Checks', {
            'fields': ('precheck_validations', 'postcheck_validations'),
            'classes': ('collapse',)
        }),
        ('Progress Tracking', {
            'fields': ('devices_provisioned', 'total_devices', 'completed_devices', 'failed_devices', 'skipped_devices', 'success_rate_display')
        }),
        ('Webhook Configuration', {
            'fields': ('webhook_token',),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def success_rate_display(self, obj):
        if obj.total_devices == 0:
            return "No devices"
        percentage = int((obj.completed_devices / obj.total_devices) * 100) if obj.total_devices > 0 else 0
        color = '#10B981' if percentage == 100 else '#3B82F6' if percentage > 50 else '#EF4444'
        return format_html(
            '<div style="width:100px; background:#e5e7eb; border-radius:4px; height:20px; position:relative;">'
            '<div style="width:{}%; background:{}; height:100%; border-radius:4px;"></div>'
            '<span style="position:absolute; top:2px; left:50%; transform:translateX(-50%); font-size:11px; font-weight:bold;">{}%</span>'
            '</div>',
            percentage, color, percentage
        )
    success_rate_display.short_description = 'Success Rate'
    
    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
            # Generate webhook token if not set
            if not obj.webhook_token:
                import secrets
                obj.webhook_token = secrets.token_urlsafe(32)
        super().save_model(request, obj, form, change)

