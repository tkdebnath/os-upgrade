from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import Group
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.decorators import method_decorator


class LoginView(APIView):
    permission_classes = [AllowAny]
    
    @method_decorator(ensure_csrf_cookie)
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        
        if not username or not password:
            return Response({'error': 'Username and password required'}, status=400)
        
        user = authenticate(request, username=username, password=password)
        
        if user is not None:
            login(request, user)
            return Response({
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'is_staff': user.is_staff,
                'is_superuser': user.is_superuser,
                'groups': list(user.groups.values_list('name', flat=True))
            })
        else:
            return Response({'error': 'Invalid credentials'}, status=401)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        logout(request)
        return Response({'message': 'Logged out successfully'})


class GetCSRFTokenView(APIView):
    permission_classes = [AllowAny]
    
    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        return Response({'detail': 'CSRF cookie set'})


class UserPermissionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            "id": request.user.id,
            "username": request.user.username,
            "email": request.user.email,
            "is_staff": request.user.is_staff,
            "is_superuser": request.user.is_superuser,
            "permissions": list(request.user.get_all_permissions()),
            "groups": list(request.user.groups.values_list('name', flat=True))
        })
