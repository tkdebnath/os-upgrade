from django.db import models
from swim_backend.images.models import Image

class GoldenImage(models.Model):
    platform = models.CharField(max_length=50) # e.g. "iosxe" or "CAT9K"
    site = models.CharField(max_length=100, default='Global')
    image = models.ForeignKey(Image, on_delete=models.CASCADE)
    
    class Meta:
        unique_together = ('platform', 'site')

    def __str__(self):
        return f"Golden Image for {self.platform} at {self.site}: {self.image.version}"
