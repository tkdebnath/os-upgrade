from django.contrib.auth.models import User, Group, Permission
from django.contrib.contenttypes.models import ContentType
from rest_framework import viewsets, serializers, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)
    groups = serializers.PrimaryKeyRelatedField(many=True, queryset=Group.objects.all(), required=False)
    group_names = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'password', 
                  'groups', 'group_names', 'is_active', 'is_staff', 'is_superuser', 'date_joined', 'last_login']
        read_only_fields = ['date_joined', 'last_login']
    
    def get_group_names(self, obj):
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
    permission_classes = [IsAdminUser]
    
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
