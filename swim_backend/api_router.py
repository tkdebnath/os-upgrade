from rest_framework import routers
from swim_backend.devices.views import DeviceViewSet, DeviceModelViewSet, SiteViewSet, RegionViewSet, GlobalCredentialViewSet
from swim_backend.images.views import ImageViewSet, FileServerViewSet

from swim_backend.core.views import JobViewSet, GoldenImageViewSet, ValidationCheckViewSet
from swim_backend.core.auth_views import UserPermissionsView, LoginView, LogoutView, GetCSRFTokenView
from swim_backend.core.user_views import UserViewSet, GroupViewSet, PermissionViewSet
from swim_backend.core.rbac_views import PermissionBundleViewSet
from swim_backend.core.token_views import APITokenViewSet
from swim_backend.core.activity_views import ActivityLogViewSet
from django.urls import path

router = routers.DefaultRouter()
router.register(r'devices', DeviceViewSet)
router.register(r'device-models', DeviceModelViewSet, basename='devicemodel')
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
router.register(r'permissions', PermissionViewSet)
router.register(r'permission-bundles', PermissionBundleViewSet)
router.register(r'api-tokens', APITokenViewSet, basename='apitoken')
router.register(r'activity-logs', ActivityLogViewSet, basename='activitylog')
router.register(r'reports', ReportViewSet, basename='report')
router.register(r'dashboard', DashboardViewSet, basename='dashboard')

urlpatterns = [
    path('auth/csrf/', GetCSRFTokenView.as_view(), name='get-csrf-token'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/me/', UserPermissionsView.as_view(), name='user-permissions'),
] + router.urls
