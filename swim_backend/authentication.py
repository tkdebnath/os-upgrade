from rest_framework.authentication import SessionAuthentication

class CsrfExemptSessionAuthentication(SessionAuthentication):
    """
    SessionAuthentication without CSRF validation.
    Use this for API endpoints that are accessed from the same origin.
    """
    def enforce_csrf(self, request):
        return  # To not perform the csrf check previously happening
