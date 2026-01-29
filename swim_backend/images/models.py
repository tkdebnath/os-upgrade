from django.db import models
import os
import hashlib

# ... existing code ...

class FileServer(models.Model):
    PROTOCOL_CHOICES = [('scp', 'SCP'), ('sftp', 'SFTP'), ('http', 'HTTP'), ('https', 'HTTPS'), ('ftp', 'FTP')]
    
    name = models.CharField(max_length=100)
    protocol = models.CharField(max_length=10, choices=PROTOCOL_CHOICES, default='scp')
    address = models.CharField(max_length=255, help_text="Hostname or IP (e.g. 10.1.1.5)")
    port = models.IntegerField(default=22)
    base_path = models.CharField(max_length=255, default='/', help_text="Root path for images")
    
    username = models.CharField(max_length=255, blank=True)
    password = models.CharField(max_length=255, blank=True) # Encrypt in production
    
    city = models.CharField(max_length=100, blank=True, help_text="For regional mapping")
    is_global_default = models.BooleanField(default=False, help_text="Fallback server if regional one fails")
    
    def __str__(self):
        return f"{self.name} ({self.protocol}://{self.address})"

def image_upload_path(instance, filename):
    return f'images/{filename}'

class Image(models.Model):
    filename = models.CharField(max_length=255)  # Removed unique=True - same filename allowed for different models
    version = models.CharField(max_length=50)
    file = models.FileField(upload_to=image_upload_path, blank=True, null=True)
    size_bytes = models.BigIntegerField(default=0)
    md5_checksum = models.CharField(max_length=32, blank=True, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    # Remote Image Fields
    is_remote = models.BooleanField(default=False)
    file_server = models.ForeignKey('FileServer', on_delete=models.SET_NULL, null=True, blank=True)
    remote_path = models.CharField(max_length=255, blank=True, null=True)

    def save(self, *args, **kwargs):
        # Calculate size and MD5 before saving if file is present
        if self.file:
            self.file.open('rb')
            content = self.file.read()
            self.size_bytes = len(content)
            self.md5_checksum = hashlib.md5(content).hexdigest()
            self.filename = os.path.basename(self.file.name)
        elif self.is_remote and not self.filename:
             # For remote images, ensure filename is set if not provided (usually checking remote_path)
             if self.remote_path:
                 self.filename = os.path.basename(self.remote_path)
                 
        super().save(*args, **kwargs)

    def __str__(self):
        return self.filename
