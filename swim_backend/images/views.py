from rest_framework import viewsets, serializers
from .models import Image, FileServer

class FileServerSerializer(serializers.ModelSerializer):
    class Meta:
        model = FileServer
        fields = '__all__'

class ImageSerializer(serializers.ModelSerializer):
    file_server_details = FileServerSerializer(source='file_server', read_only=True)
    
    class Meta:
        model = Image
        fields = '__all__'
        read_only_fields = ('uploaded_at',)

class ImageViewSet(viewsets.ModelViewSet):
    queryset = Image.objects.all()
    serializer_class = ImageSerializer
    permission_classes = []  # Allow all authenticated users (covered by global setting)

class FileServerViewSet(viewsets.ModelViewSet):
    queryset = FileServer.objects.all()
    serializer_class = FileServerSerializer
