from rest_framework.authentication import SessionAuthentication, BaseAuthentication
from rest_framework import exceptions

class CsrfExemptSessionAuthentication(SessionAuthentication):
    """
    SessionAuthentication without CSRF validation.
    Use this for API endpoints that are accessed from the same origin.
    """
    def enforce_csrf(self, request):
        return  # To not perform the csrf check previously happening


class APIKeyAuthentication(BaseAuthentication):
    """
    Custom authentication class for APIToken model.
    Checks for 'Authorization: Token <token>' header.
    """
    keyword = 'Token'

    def authenticate(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        
        if not auth_header.startswith(f'{self.keyword} '):
            return None
        
        try:
            key = auth_header.split(' ', 1)[1]
        except IndexError:
            return None
        
        return self.authenticate_credentials(key)

    def authenticate_credentials(self, key):
        # Lazy import to avoid circular import
        from swim_backend.core.models import APIToken
        
        try:
            api_token = APIToken.objects.select_related('user').get(key=key)
        except APIToken.DoesNotExist:
            raise exceptions.AuthenticationFailed('Invalid API key')
        
        if api_token.is_expired:
            raise exceptions.AuthenticationFailed('API key has expired')
        
        if not api_token.user.is_active:
            raise exceptions.AuthenticationFailed('User account is disabled')
        
        # Update last_used timestamp
        from django.utils import timezone
        api_token.last_used = timezone.now()
        api_token.save(update_fields=['last_used'])
        
        # Return (user, auth) tuple - DRF requires user object
        return (api_token.user, api_token)

    def authenticate_header(self, request):
        return self.keyword
