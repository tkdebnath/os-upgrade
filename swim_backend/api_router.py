from rest_framework import routers
from django.urls import path, include
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.reverse import reverse

# Import all ViewSets
from swim_backend.devices.views import (
    DeviceViewSet, DeviceModelViewSet, SiteViewSet, 
    RegionViewSet, GlobalCredentialViewSet
)
from swim_backend.images.views import ImageViewSet, FileServerViewSet
from swim_backend.core.views import (
    JobViewSet, GoldenImageViewSet, ValidationCheckViewSet, 
    CheckRunViewSet, DashboardViewSet, WorkflowViewSet, WorkflowStepViewSet,
    ZTPWorkflowViewSet
)
from swim_backend.core.auth_views import (
    UserPermissionsView, LoginView, LogoutView, GetCSRFTokenView
)
from swim_backend.core.user_views import UserViewSet, GroupViewSet, PermissionViewSet
from swim_backend.core.rbac_views import PermissionBundleViewSet
from swim_backend.core.token_views import APITokenViewSet
from swim_backend.core.activity_views import ActivityLogViewSet
from swim_backend.core.reports import ReportViewSet


# ============================================================================
# System Status View
# ============================================================================
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def system_status(request, format=None):
    """System health status including scheduler"""
    from swim_backend.core.scheduler import get_scheduler_status
    return Response({
        'scheduler': get_scheduler_status(),
    })


# ============================================================================
# API Root View - NetBox Style
# ============================================================================
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_root(request, format=None):
    """
    SWIM API Root - NetBox-style organized endpoints
    """
    return Response({
        'dcim': request.build_absolute_uri(reverse('dcim-api-root')),
        'images': request.build_absolute_uri(reverse('images-api-root')),
        'core': request.build_absolute_uri(reverse('core-api-root')),
        'users': request.build_absolute_uri(reverse('users-api-root')),
        'auth': request.build_absolute_uri(reverse('auth-api-root')),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dcim_api_root(request, format=None):
    """Data Center Infrastructure Management endpoints"""
    return Response({
        'devices': request.build_absolute_uri(reverse('dcim-device-list')),
        'device-models': request.build_absolute_uri(reverse('dcim-devicemodel-list')),
        'sites': request.build_absolute_uri(reverse('dcim-site-list')),
        'regions': request.build_absolute_uri(reverse('dcim-region-list')),
        'global-credentials': request.build_absolute_uri(reverse('dcim-global-credentials-list')),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def images_api_root(request, format=None):
    """Software Image Management endpoints"""
    return Response({
        'images': request.build_absolute_uri(reverse('images-image-list')),
        'file-servers': request.build_absolute_uri(reverse('images-fileserver-list')),
        'golden-images': request.build_absolute_uri(reverse('images-goldenimage-list')),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def core_api_root(request, format=None):
    """Core System Functions endpoints"""
    return Response({
        'jobs': request.build_absolute_uri(reverse('core-job-list')),
        'workflows': request.build_absolute_uri(reverse('core-workflow-list')),
        'workflow-steps': request.build_absolute_uri(reverse('core-workflowstep-list')),
        'checks': request.build_absolute_uri(reverse('core-validationcheck-list')),
        'check-runs': request.build_absolute_uri(reverse('core-checkrun-list')),
        'activity-logs': request.build_absolute_uri(reverse('core-activitylog-list')),
        'reports': request.build_absolute_uri(reverse('core-report-list')),
        'ztp-workflows': request.build_absolute_uri(reverse('core-ztpworkflow-list')),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def users_api_root(request, format=None):
    """User & Authentication Management endpoints"""
    return Response({
        'users': request.build_absolute_uri(reverse('users-user-list')),
        'groups': request.build_absolute_uri(reverse('users-group-list')),
        'permissions': request.build_absolute_uri(reverse('users-permission-list')),
        'permission-bundles': request.build_absolute_uri(reverse('users-permissionbundle-list')),
        'tokens': request.build_absolute_uri(reverse('users-apitoken-list')),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def auth_api_root(request, format=None):
    """Authentication endpoints"""
    return Response({
        'csrf': request.build_absolute_uri(reverse('get-csrf-token')),
        'login': request.build_absolute_uri(reverse('login')),
        'logout': request.build_absolute_uri(reverse('logout')),
        'me': request.build_absolute_uri(reverse('user-permissions')),
    })


# ============================================================================
# Routers - NetBox-style Organization
# ============================================================================

# DCIM Router - Data Center Infrastructure Management
dcim_router = routers.DefaultRouter()
dcim_router.register(r'devices', DeviceViewSet, basename='dcim-device')
dcim_router.register(r'device-models', DeviceModelViewSet, basename='dcim-devicemodel')
dcim_router.register(r'sites', SiteViewSet, basename='dcim-site')
dcim_router.register(r'regions', RegionViewSet, basename='dcim-region')
dcim_router.register(r'global-credentials', GlobalCredentialViewSet, basename='dcim-global-credentials')

# Images Router - Software Image Management
images_router = routers.DefaultRouter()
images_router.register(r'images', ImageViewSet, basename='images-image')
images_router.register(r'file-servers', FileServerViewSet, basename='images-fileserver')
images_router.register(r'golden-images', GoldenImageViewSet, basename='images-goldenimage')

# Core Router - Jobs, Workflows, Dashboard
core_router = routers.DefaultRouter()
core_router.register(r'jobs', JobViewSet, basename='core-job')
core_router.register(r'workflows', WorkflowViewSet, basename='core-workflow')
core_router.register(r'workflow-steps', WorkflowStepViewSet, basename='core-workflowstep')
core_router.register(r'checks', ValidationCheckViewSet, basename='core-validationcheck')
core_router.register(r'check-runs', CheckRunViewSet, basename='core-checkrun')
core_router.register(r'dashboard', DashboardViewSet, basename='core-dashboard')
core_router.register(r'activity-logs', ActivityLogViewSet, basename='core-activitylog')
core_router.register(r'reports', ReportViewSet, basename='core-report')
core_router.register(r'ztp-workflows', ZTPWorkflowViewSet, basename='core-ztpworkflow')

# Users Router - Authentication & Authorization
users_router = routers.DefaultRouter()
users_router.register(r'users', UserViewSet, basename='users-user')
users_router.register(r'groups', GroupViewSet, basename='users-group')
users_router.register(r'permissions', PermissionViewSet, basename='users-permission')
users_router.register(r'permission-bundles', PermissionBundleViewSet, basename='users-permissionbundle')
users_router.register(r'tokens', APITokenViewSet, basename='users-apitoken')


# ============================================================================
# URL Patterns
# ============================================================================
urlpatterns = [
    # API Root
    path('', api_root, name='api-root'),
    
    # Authentication endpoints
    path('auth/', auth_api_root, name='auth-api-root'),
    path('auth/csrf/', GetCSRFTokenView.as_view(), name='get-csrf-token'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/me/', UserPermissionsView.as_view(), name='user-permissions'),
    
    # NetBox-style organized endpoints
    path('dcim/', dcim_api_root, name='dcim-api-root'),
    path('dcim/', include(dcim_router.urls)),
    
    path('images/', images_api_root, name='images-api-root'),
    path('images/', include(images_router.urls)),
    
    path('core/', core_api_root, name='core-api-root'),
    path('core/', include(core_router.urls)),
    path('core/system-status/', system_status, name='system-status'),
    
    path('users/', users_api_root, name='users-api-root'),
    path('users/', include(users_router.urls)),
]


