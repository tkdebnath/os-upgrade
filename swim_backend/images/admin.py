from django.contrib import admin
from .models import Image

@admin.register(Image)
class ImageAdmin(admin.ModelAdmin):
    list_display = ('filename', 'version', 'size_bytes', 'uploaded_at')
    readonly_fields = ('size_bytes', 'md5_checksum', 'uploaded_at')
