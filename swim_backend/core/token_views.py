from rest_framework import viewsets, serializers, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth.models import User
from django.utils import timezone
from swim_backend.core.models import APIToken
from drf_spectacular.utils import extend_schema_field, extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes


class APITokenSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.username', read_only=True)
    is_expired = serializers.BooleanField(read_only=True)
    key_preview = serializers.SerializerMethodField()
    
    class Meta:
        model = APIToken
        fields = [
            'id', 'user', 'user_name', 'key', 'key_preview',
            'write_enabled', 'expires', 'description', 'allowed_ips',
            'created', 'last_used', 'is_expired'
        ]
        read_only_fields = ['created', 'last_used', 'user', 'key']
    
    @extend_schema_field(serializers.CharField)
    def get_key_preview(self, obj) -> str:
        """Return only first 8 characters for security"""
        return f"{obj.key[:8]}..." if obj.key else None
    
    def to_representation(self, instance):
        """Only show full key on creation"""
        ret = super().to_representation(instance)
        # Only include full key if this is a newly created token
        if not self.context.get('show_full_key', False):
            ret.pop('key', None)
        return ret


class APITokenViewSet(viewsets.ModelViewSet):
    serializer_class = APITokenSerializer
    permission_classes = [IsAuthenticated]
    lookup_value_regex = '[0-9]+'  # Specify that id is numeric
    
    def get_permissions(self):
        """Only superusers can create/delete tokens. Regular users can only view their own."""
        from rest_framework.permissions import BasePermission
        
        class CanManageToken(BasePermission):
            def has_permission(self, request, view):
                if not request.user or not request.user.is_authenticated:
                    return False
                
                # Only superusers can create or delete tokens
                if view.action in ['create', 'destroy']:
                    return request.user.is_superuser
                
                # All authenticated users can list and view
                return True
            
            def has_object_permission(self, request, view, obj):
                # Superusers can do anything
                if request.user.is_superuser:
                    return True
                
                # Users can only view their own tokens
                if view.action in ['retrieve', 'list']:
                    return obj.user == request.user
                
                # Only superusers can update/delete
                return False
        
        return [CanManageToken()]
    
    def get_queryset(self):
        """Users can only see their own tokens"""
        if self.request.user.is_superuser:
            return APIToken.objects.all()
        return APIToken.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        """Ensure token is created for the requesting user"""
        # Always set the user to the requesting user
        serializer.save(user=self.request.user)
    
    def create(self, request, *args, **kwargs):
        """Override to show full key only once"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Create the token
        self.perform_create(serializer)
        
        # Get the saved instance and serialize it with full key
        instance = serializer.instance
        response_serializer = self.get_serializer(instance)
        response_serializer.context['show_full_key'] = True
        headers = self.get_success_headers(response_serializer.data)
        
        return Response(
            response_serializer.data,
            status=status.HTTP_201_CREATED,
            headers=headers
        )
    
    @action(detail=True, methods=['post'])
    def regenerate(self, request, pk=None):
        """Regenerate token key"""
        token = self.get_object()
        
        # Generate new key
        import secrets
        import string
        alphabet = string.ascii_letters + string.digits
        token.key = ''.join(secrets.choice(alphabet) for _ in range(40))
        token.save()
        
        # Return with full key
        serializer = self.get_serializer(token)
        serializer.context['show_full_key'] = True
        
        return Response(serializer.data)
