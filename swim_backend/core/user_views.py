from django.contrib.auth.models import User, Group, Permission
from django.contrib.contenttypes.models import ContentType
from rest_framework import viewsets, serializers, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser
from drf_spectacular.utils import extend_schema_field
from typing import List

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)
    groups = serializers.PrimaryKeyRelatedField(many=True, queryset=Group.objects.all(), required=False)
    group_names = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'password', 
                  'groups', 'group_names', 'is_active', 'is_staff', 'is_superuser', 'date_joined', 'last_login']
        read_only_fields = ['date_joined', 'last_login']
    
    @extend_schema_field(serializers.ListField(child=serializers.CharField()))
    def get_group_names(self, obj) -> List[str]:
        return [group.name for group in obj.groups.all()]
    
    def create(self, validated_data):
        password = validated_data.pop('password', None)
        groups = validated_data.pop('groups', [])
        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        user.groups.set(groups)
        return user
    
    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        groups = validated_data.pop('groups', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        if password:
            instance.set_password(password)
        
        instance.save()
        
        if groups is not None:
            instance.groups.set(groups)
        
        return instance

class PermissionSerializer(serializers.ModelSerializer):
    content_type_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Permission
        fields = ['id', 'name', 'codename', 'content_type', 'content_type_name']
    
    def get_content_type_name(self, obj):
        return str(obj.content_type)
    
    def validate_codename(self, value):
        """Ensure codename follows Django conventions"""
        if not value.replace('_', '').isalnum():
            raise serializers.ValidationError("Codename can only contain letters, numbers, and underscores")
        return value.lower()
    
    def validate(self, data):
        """Check for duplicate permissions"""
        content_type = data.get('content_type')
        codename = data.get('codename')
        
        # When updating, exclude current instance
        instance_id = self.instance.id if self.instance else None
        
        if Permission.objects.filter(content_type=content_type, codename=codename).exclude(id=instance_id).exists():
            raise serializers.ValidationError({
                'codename': 'A permission with this codename already exists for this content type.'
            })
        
        return data

class GroupSerializer(serializers.ModelSerializer):
    permissions = serializers.PrimaryKeyRelatedField(many=True, queryset=Permission.objects.all(), required=False)
    permission_details = PermissionSerializer(source='permissions', many=True, read_only=True)
    user_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Group
        fields = ['id', 'name', 'permissions', 'permission_details', 'user_count']
    
    def get_user_count(self, obj):
        return obj.user_set.count()

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('-date_joined')
    serializer_class = UserSerializer
    
    def get_permissions(self):
        """Allow users to view/edit their own profile, admins can manage all users"""
        from rest_framework.permissions import BasePermission
        
        class CanManageUser(BasePermission):
            def has_permission(self, request, view):
                # Must be authenticated
                if not request.user or not request.user.is_authenticated:
                    return False
                
                # Superusers can do anything
                if request.user.is_superuser:
                    return True
                
                # For list action, only superusers
                if view.action == 'list':
                    return False
                    
                # For create, only superusers
                if view.action == 'create':
                    return False
                
                # For retrieve/update/partial_update, check if it's their own profile
                return view.action in ['retrieve', 'update', 'partial_update', 'set_password']
            
            def has_object_permission(self, request, view, obj):
                # Superusers can do anything
                if request.user.is_superuser:
                    return True
                
                # Users can only access their own profile
                if view.action in ['retrieve', 'update', 'partial_update', 'set_password']:
                    return obj.id == request.user.id
                
                # All other actions require superuser
                return False
        
        return [CanManageUser()]
    
    def get_queryset(self):
        """Regular users can only see their own profile"""
        if self.request.user.is_superuser:
            return User.objects.all().order_by('-date_joined')
        return User.objects.filter(id=self.request.user.id)
    
    def update(self, request, *args, **kwargs):
        """Override update to restrict what regular users can modify"""
        user = self.get_object()
        
        # Regular users can only update their own profile
        if not request.user.is_superuser and user.id != request.user.id:
            return Response(
                {'error': 'You can only update your own profile'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Regular users can only update specific fields
        if not request.user.is_superuser:
            allowed_fields = ['first_name', 'last_name', 'email']
            restricted_fields = [f for f in request.data.keys() if f not in allowed_fields]
            if restricted_fields:
                return Response(
                    {'error': f'You cannot modify these fields: {", ".join(restricted_fields)}'}, 
                    status=status.HTTP_403_FORBIDDEN
                )
        
        return super().update(request, *args, **kwargs)
    
    def partial_update(self, request, *args, **kwargs):
        """Override partial_update with same restrictions"""
        return self.update(request, *args, **kwargs)
    
    @action(detail=True, methods=['post'])
    def set_password(self, request, pk=None):
        user = self.get_object()
        password = request.data.get('password')
        if not password:
            return Response({'error': 'Password is required'}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(password)
        user.save()
        return Response({'message': 'Password updated successfully'})
    
    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        user = self.get_object()
        user.is_active = not user.is_active
        user.save()
        return Response({'is_active': user.is_active})

class GroupViewSet(viewsets.ModelViewSet):
    queryset = Group.objects.all().order_by('name')
    serializer_class = GroupSerializer
    permission_classes = [IsAdminUser]
    
    @action(detail=False, methods=['get'])
    def available_permissions(self, request):
        permissions = Permission.objects.select_related('content_type').order_by('content_type__app_label', 'codename')
        serializer = PermissionSerializer(permissions, many=True)
        return Response(serializer.data)

class PermissionViewSet(viewsets.ModelViewSet):
    queryset = Permission.objects.select_related('content_type').all().order_by('content_type__app_label', 'codename')
    serializer_class = PermissionSerializer
    permission_classes = [IsAdminUser]
    
    @action(detail=False, methods=['get'])
    def content_types(self, request):
        """Get available content types for creating permissions"""
        content_types = ContentType.objects.all().order_by('app_label', 'model')
        data = [
            {
                'id': ct.id,
                'app_label': ct.app_label,
                'model': ct.model,
                'name': f"{ct.app_label} | {ct.model}"
            }
            for ct in content_types
        ]
        return Response(data)
