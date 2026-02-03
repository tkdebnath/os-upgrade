from rest_framework import viewsets, serializers
from rest_framework.response import Response
from rest_framework.filters import SearchFilter
from django_filters.rest_framework import DjangoFilterBackend
import os
from .models import Image, FileServer

class FileServerSerializer(serializers.ModelSerializer):
    class Meta:
        model = FileServer
        fields = '__all__'
    
    def to_representation(self, instance):
        """Hide sensitive credentials from non-superusers"""
        data = super().to_representation(instance)
        request = self.context.get('request')
        
        # Hide credentials from non-superusers
        if request and not (request.user and request.user.is_superuser):
            data.pop('username', None)
            data.pop('password', None)
        
        return data

class ImageSerializer(serializers.ModelSerializer):
    file_server_details = FileServerSerializer(source='file_server', read_only=True)
    
    class Meta:
        model = Image
        fields = '__all__'
        read_only_fields = ('uploaded_at',)

class ImageViewSet(viewsets.ModelViewSet):
    queryset = Image.objects.all()
    serializer_class = ImageSerializer

class FileServerViewSet(viewsets.ModelViewSet):
    queryset = FileServer.objects.all()
    serializer_class = FileServerSerializer
    
    def list(self, request, *args, **kwargs):
        """
        List all file servers, ensuring a default one exists from environment variables.
        """
        # Get environment variables for default file server
        default_server = os.getenv('DEFAULT_FILE_SERVER', '')
        default_path = os.getenv('FILE_SERVER_BASE_PATH', '/')
        
        # Only create/update if environment variables are set
        if default_server:
            # Parse the server URL
            protocol = 'http'
            address = default_server
            port = 80
            
            if '://' in default_server:
                protocol, rest = default_server.split('://', 1)
                address = rest.rstrip('/')
            
            if protocol == 'https':
                port = 443
            elif protocol == 'http':
                port = 80
            
            # Check if address has port
            if ':' in address and not address.count(':') > 1:  # Not IPv6
                address, port_str = address.rsplit(':', 1)
                try:
                    port = int(port_str)
                except ValueError:
                    pass
            
            # Create or update the default file server
            server, created = FileServer.objects.get_or_create(
                name='Default File Server (from .env)',
                defaults={
                    'protocol': protocol,
                    'address': address,
                    'port': port,
                    'base_path': default_path,
                    'is_global_default': True
                }
            )
            
            # Update if it already exists but values changed
            if not created:
                updated = False
                if server.protocol != protocol:
                    server.protocol = protocol
                    updated = True
                if server.address != address:
                    server.address = address
                    updated = True
                if server.port != port:
                    server.port = port
                    updated = True
                if server.base_path != default_path:
                    server.base_path = default_path
                    updated = True
                if not server.is_global_default:
                    server.is_global_default = True
                    updated = True
                
                if updated:
                    server.save()
        
        # Return standard list response
        return super().list(request, *args, **kwargs)
    
    def get_permissions(self):
        """
        Allow viewing file servers for all authenticated users (needed to display names).
        Only superusers can create/update/delete file servers (sensitive credentials).
        """
        from rest_framework.permissions import BasePermission, IsAuthenticated
        
        class IsSuperUserOrReadOnly(BasePermission):
            def has_permission(self, request, view):
                # Allow read operations (GET, HEAD, OPTIONS) for authenticated users
                if request.method in ['GET', 'HEAD', 'OPTIONS']:
                    return request.user and request.user.is_authenticated
                # Only superusers can modify
                return request.user and request.user.is_authenticated and request.user.is_superuser
        
        return [IsSuperUserOrReadOnly()]
