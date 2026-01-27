from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth.models import Group

class UserPermissionsView(APIView):
    # permission_classes = [IsAuthenticated] # Commented out for easier testing without login

    def get(self, request):
        # Mock user for prototype if not logged in
        if not request.user.is_authenticated:
            return Response({
                "username": "guest",
                "is_superuser": True,
                "permissions": [],
                "groups": []
            })
            
        return Response({
            "username": request.user.username,
            "is_superuser": request.user.is_superuser,
            "permissions": list(request.user.get_all_permissions()),
            "groups": list(request.user.groups.values_list('name', flat=True))
        })
