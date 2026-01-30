from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from swim_backend.images.models import Image
from swim_backend.devices.models import Device
from swim_backend.core.models import GoldenImage, Job
from swim_backend.core.views import JobSerializer
from .logic import run_swim_job
import threading

class SwimParityView(APIView):
    """
    Endpoints matching Cisco DNA Center SWIM API structure.
    """

    def get_images(self, request):
        """GET /image/importation"""
        images = Image.objects.all()
        data = [{"id": img.id, "name": img.filename, "version": img.version, "family": img.family} for img in images]
        return Response(data)

    def get_family_identifiers(self, request):
        """GET /image/importation/device-family-identifiers"""
        families = Device.objects.values_list('family', flat=True).distinct()
        return Response({"response": list(families)})

    def import_local_image(self, request):
        """POST /image/importation/source/file"""
        # Simplistic implementation passing to existing logic
        return Response({"message": "Use /api/images/ for multipart upload"}, status=status.HTTP_501_NOT_IMPLEMENTED)

    def tag_golden(self, request):
        """POST /image/importation/golden"""
        image_id = request.data.get('image_id')
        platform = request.data.get('platform', 'iosxe')
        site_id = request.data.get('site_id', 'Global')
        
        image = get_object_or_404(Image, id=image_id)
        
        golden, created = GoldenImage.objects.update_or_create(
            platform=platform,
            site=site_id,
            defaults={'image': image}
        )
        return Response({"status": "success", "golden_id": golden.id})

    def trigger_distribution(self, request):
        """POST /image/distribution"""
        device_id = request.data.get('deviceUuid') # Matching DNA Center param name style often used
        if not device_id:
             device_id = request.data.get('device_id') # Fallback

        image_id = request.data.get('imageUuid')
        if not image_id:
            image_id = request.data.get('image_id')

        device = get_object_or_404(Device, id=device_id)
        image = get_object_or_404(Image, id=image_id)
        
        # Create Job
        job = Job.objects.create(
            device=device,
            image=image,
            activate_after_distribute=False # Distribution only
        )
        
        # Trigger
        t = threading.Thread(target=run_swim_job, args=(job.id,))
        t.daemon = True
        t.start()
        
        return Response(JobSerializer(job).data)
        
    def trigger_activation(self, request):
        """POST /image/activation/device"""
        device_id = request.data.get('device_id')
        device = get_object_or_404(Device, id=device_id)
        
        # Find latest distributed job
        job = Job.objects.filter(device=device, status='distributed').last()
        if not job:
             return Response({"error": "No distributed image found ready for activation"}, status=404)
        
        job.status = 'activating'
        job.activate_after_distribute = True
        job.save()
        
        t = threading.Thread(target=run_swim_job, args=(job.id,))
        t.daemon = True
        t.start()
        
        return Response({"status": "Activation triggered", "job_id": job.id})

    def get_golden_status(self, request, site_id, family_id, role_id, image_id):
        """GET /image/importation/golden/..."""
        is_golden = GoldenImage.objects.filter(
            site=site_id,
            platform=family_id, # Mapping family to platform
            image__id=image_id
        ).exists()
        return Response({"golden": is_golden})

    def delete_golden_tag(self, request, site_id, family_id, role_id, image_id):
        """DELETE /image/importation/golden/..."""
        deleted, _ = GoldenImage.objects.filter(
            site=site_id,
            platform=family_id,
            image__id=image_id
        ).delete()
        return Response({"status": "deleted" if deleted else "not_found"})