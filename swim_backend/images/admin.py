from django.contrib import admin
from .models import Image, FileServer

@admin.register(Image)
class ImageAdmin(admin.ModelAdmin):
    list_display = ('filename', 'version', 'size_mb', 'uploaded_at')
    list_filter = ('uploaded_at',)
    search_fields = ('filename', 'version')
    readonly_fields = ('size_bytes', 'md5_checksum', 'uploaded_at')
    
    def size_mb(self, obj):
        return f"{obj.size_bytes / (1024*1024):.2f} MB" if obj.size_bytes else "—"
    size_mb.short_description = 'Size'

@admin.register(FileServer)
class FileServerAdmin(admin.ModelAdmin):
    list_display = ('name', 'protocol', 'address', 'port', 'is_global_default')
    list_filter = ('protocol', 'is_global_default')
    search_fields = ('name', 'address', 'city')
