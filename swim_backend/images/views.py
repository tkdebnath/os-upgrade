from rest_framework import viewsets, serializers
from .models import Image, FileServer

class ImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Image
        fields = '__all__'
        read_only_fields = ('uploaded_at',)

class ImageViewSet(viewsets.ModelViewSet):
    queryset = Image.objects.all()
    serializer_class = ImageSerializer

class FileServerSerializer(serializers.ModelSerializer):
    class Meta:
        model = FileServer
        fields = '__all__'

class FileServerViewSet(viewsets.ModelViewSet):
    queryset = FileServer.objects.all()
    serializer_class = FileServerSerializer
