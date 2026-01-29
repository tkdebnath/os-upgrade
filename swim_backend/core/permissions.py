from rest_framework.permissions import DjangoModelPermissions


class DjangoModelPermissionsWithView(DjangoModelPermissions):
    """
    Extended DjangoModelPermissions that also checks for view permission.
    By default, DjangoModelPermissions doesn't check view permission for GET requests.
    """
    perms_map = {
        'GET': ['%(app_label)s.view_%(model_name)s'],
        'OPTIONS': [],
        'HEAD': ['%(app_label)s.view_%(model_name)s'],
        'POST': ['%(app_label)s.add_%(model_name)s'],
        'PUT': ['%(app_label)s.change_%(model_name)s'],
        'PATCH': ['%(app_label)s.change_%(model_name)s'],
        'DELETE': ['%(app_label)s.delete_%(model_name)s'],
    }
