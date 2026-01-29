from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

def dashboard_callback(request, context):
    from django.contrib.admin.models import LogEntry
    context['log_entries'] = LogEntry.objects.select_related('content_type', 'user')[:10]
    return context

from rest_framework.schemas import get_schema_view
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

from swim_backend.core.parity_views import SwimParityView

# Parity View Instances for routing
swim_view = SwimParityView()

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('swim_backend.api_router')),
    
    # --- API Documentation (OpenAPI/Swagger) ---
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/schema/swagger-ui/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/schema/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    
    # --- SWIM API Parity (Cisco DNA Center Style) ---
    path('image/importation', swim_view.get_images),
    path('image/importation/device-family-identifiers', swim_view.get_family_identifiers),
    path('image/importation/source/file', swim_view.import_local_image),
    path('image/importation/golden', swim_view.tag_golden),
    path('image/distribution', swim_view.trigger_distribution),
    path('image/activation/device', swim_view.trigger_activation),
    path('image/importation/golden/site/<str:site_id>/family/<str:family_id>/role/<str:role_id>/image/<str:image_id>', 
         lambda request, site_id, family_id, role_id, image_id: 
            swim_view.get_golden_status(request, site_id, family_id, role_id, image_id) 
            if request.method == 'GET' else 
            swim_view.delete_golden_tag(request, site_id, family_id, role_id, image_id)
    ),

    path('api/schema/', get_schema_view(
        title="SWIM API",
        description="API for managing network software images and devices",
        version="1.0.0"
    ), name='openapi-schema'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
