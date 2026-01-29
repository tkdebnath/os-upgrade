from rest_framework import viewsets, serializers, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser
from django.contrib.contenttypes.models import ContentType
from django.contrib.auth.models import User, Group
from swim_backend.core.rbac_models import PermissionBundle


class ContentTypeSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    
    class Meta:
        model = ContentType
        fields = ['id', 'app_label', 'model', 'display_name']
    
    def get_display_name(self, obj):
        return f"{obj.app_label} | {obj.model}"


class PermissionBundleSerializer(serializers.ModelSerializer):
    object_types_details = ContentTypeSerializer(source='object_types', many=True, read_only=True)
    actions = serializers.SerializerMethodField()
    group_names = serializers.SerializerMethodField()
    user_names = serializers.SerializerMethodField()
    
    class Meta:
        model = PermissionBundle
        fields = [
            'id', 'name', 'description', 'enabled',
            'can_view', 'can_add', 'can_change', 'can_delete',
            'additional_actions', 'object_types', 'object_types_details',
            'groups', 'users', 'group_names', 'user_names', 'actions',
            'created_at', 'updated_at'
        ]
    
    def get_actions(self, obj):
        return obj.get_actions()
    
    def get_group_names(self, obj):
        return [g.name for g in obj.groups.all()]
    
    def get_user_names(self, obj):
        return [u.username for u in obj.users.all()]
    
    def create(self, validated_data):
        object_types = validated_data.pop('object_types', [])
        groups = validated_data.pop('groups', [])
        users = validated_data.pop('users', [])
        
        bundle = PermissionBundle.objects.create(**validated_data)
        bundle.object_types.set(object_types)
        bundle.groups.set(groups)
        bundle.users.set(users)
        
        # Sync permissions to groups and users
        bundle.sync_to_groups()
        bundle.sync_to_users()
        
        return bundle
    
    def update(self, instance, validated_data):
        object_types = validated_data.pop('object_types', None)
        groups = validated_data.pop('groups', None)
        users = validated_data.pop('users', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.save()
        
        if object_types is not None:
            instance.object_types.set(object_types)
        if groups is not None:
            instance.groups.set(groups)
        if users is not None:
            instance.users.set(users)
        
        # Re-sync permissions
        instance.sync_to_groups()
        instance.sync_to_users()
        
        return instance


class PermissionBundleViewSet(viewsets.ModelViewSet):
    queryset = PermissionBundle.objects.all().order_by('name')
    serializer_class = PermissionBundleSerializer
    permission_classes = [IsAdminUser]
    
    @action(detail=False, methods=['get'])
    def content_types(self, request):
        """Get all available content types for object selection"""
        content_types = ContentType.objects.all().order_by('app_label', 'model')
        serializer = ContentTypeSerializer(content_types, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def custom_actions(self, request):
        """Get all custom actions from models (beyond standard CRUD)"""
        from django.contrib.auth.models import Permission
        
        # Standard CRUD actions
        standard_actions = ['add', 'change', 'delete', 'view']
        
        # Get all permissions
        all_permissions = Permission.objects.all().select_related('content_type')
        
        # Extract custom actions
        custom_actions_set = set()
        for perm in all_permissions:
            # Codename format: action_modelname
            parts = perm.codename.split('_', 1)
            if len(parts) == 2:
                action = parts[0]
                if action not in standard_actions and not action.startswith('can_'):
                    continue
                # Extract the base action name
                if perm.codename.startswith('can_'):
                    # Custom permission like can_sync_device
                    action_name = perm.codename.replace('can_', '').rsplit('_', 1)[0]
                    custom_actions_set.add({
                        'codename': perm.codename,
                        'name': perm.name,
                        'action': action_name,
                        'content_type': perm.content_type.id,
                        'content_type_name': str(perm.content_type)
                    })
        
        # Convert set to list (need to handle dict in set differently)
        custom_actions_list = []
        seen = set()
        for perm in all_permissions:
            if perm.codename.startswith('can_'):
                action_name = perm.codename.replace('can_', '').rsplit('_', 1)[0]
                key = f"{action_name}_{perm.content_type.id}"
                if key not in seen:
                    seen.add(key)
                    custom_actions_list.append({
                        'codename': perm.codename,
                        'name': perm.name,
                        'action': action_name,
                        'content_type': perm.content_type.id,
                        'content_type_name': str(perm.content_type)
                    })
        
        return Response(custom_actions_list)
    
    @action(detail=True, methods=['post'])
    def sync_permissions(self, request, pk=None):
        """Manually trigger permission sync for this bundle"""
        bundle = self.get_object()
        bundle.sync_to_groups()
        bundle.sync_to_users()
        return Response({
            'status': 'success',
            'message': f'Permissions synced for {bundle.name}'
        })
    
    @action(detail=True, methods=['post'])
    def toggle_enabled(self, request, pk=None):
        """Toggle enabled status"""
        bundle = self.get_object()
        bundle.enabled = not bundle.enabled
        bundle.save()
        
        if bundle.enabled:
            bundle.sync_to_groups()
            bundle.sync_to_users()
        
        return Response({
            'enabled': bundle.enabled
        })
