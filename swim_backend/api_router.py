from rest_framework import routers
from swim_backend.devices.views import DeviceViewSet, DeviceModelViewSet, SiteViewSet, RegionViewSet, GlobalCredentialViewSet
from swim_backend.images.views import ImageViewSet, FileServerViewSet

from swim_backend.core.views import JobViewSet, GoldenImageViewSet, ValidationCheckViewSet
from swim_backend.core.auth_views import UserPermissionsView
from swim_backend.core.user_views import UserViewSet, GroupViewSet
from django.urls import path

router = routers.DefaultRouter()
router.register(r'devices', DeviceViewSet)
router.register(r'device-models', DeviceModelViewSet)
router.register(r'images', ImageViewSet)
router.register(r'file-servers', FileServerViewSet)
router.register(r'sites', SiteViewSet)
router.register(r'regions', RegionViewSet)
# Global Credentials (manual URL routing handled by ViewSet or we use basename)
router.register(r'global-credentials', GlobalCredentialViewSet, basename='global-credentials')

from swim_backend.core.reports import ReportViewSet
from swim_backend.core.views import JobViewSet, GoldenImageViewSet, ValidationCheckViewSet, CheckRunViewSet, DashboardViewSet, WorkflowViewSet, WorkflowStepViewSet

router.register(r'jobs', JobViewSet)
router.register(r'golden-images', GoldenImageViewSet)
router.register(r'checks', ValidationCheckViewSet)
router.register(r'check-runs', CheckRunViewSet)
router.register(r'workflows', WorkflowViewSet)
router.register(r'workflow-steps', WorkflowStepViewSet)
router.register(r'users', UserViewSet)
router.register(r'groups', GroupViewSet)
router.register(r'reports', ReportViewSet, basename='report')
router.register(r'dashboard', DashboardViewSet, basename='dashboard')

urlpatterns = [
    path('auth/me/', UserPermissionsView.as_view(), name='user-permissions'),
] + router.urls
