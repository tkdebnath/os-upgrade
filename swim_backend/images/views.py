from rest_framework import viewsets, serializers
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
