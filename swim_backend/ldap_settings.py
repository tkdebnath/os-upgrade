# LDAP Authentication Configuration
# This file contains LDAP settings for Django authentication
# Uncomment and configure these settings in your settings.py to enable LDAP

"""
# LDAP Authentication Settings

import ldap
from django_auth_ldap.config import LDAPSearch, GroupOfNamesType

# LDAP Server Configuration
AUTH_LDAP_SERVER_URI = "ldap://ldap.example.com"  # Your LDAP server URL
AUTH_LDAP_BIND_DN = "cn=admin,dc=example,dc=com"  # Service account DN
AUTH_LDAP_BIND_PASSWORD = "your-bind-password"     # Service account password

# User Search Configuration
AUTH_LDAP_USER_SEARCH = LDAPSearch(
    "ou=users,dc=example,dc=com",  # Base DN for user search
    ldap.SCOPE_SUBTREE,            # Search scope
    "(uid=%(user)s)"               # Filter to find user by username
)

# Group Search Configuration
AUTH_LDAP_GROUP_SEARCH = LDAPSearch(
    "ou=groups,dc=example,dc=com", # Base DN for group search
    ldap.SCOPE_SUBTREE,            # Search scope
    "(objectClass=groupOfNames)"   # Filter for groups
)
AUTH_LDAP_GROUP_TYPE = GroupOfNamesType()

# Map LDAP groups to Django groups
AUTH_LDAP_MIRROR_GROUPS = True  # Automatically create Django groups from LDAP

# Map LDAP attributes to Django user fields
AUTH_LDAP_USER_ATTR_MAP = {
    "first_name": "givenName",
    "last_name": "sn",
    "email": "mail",
}

# Populate user profile from LDAP
AUTH_LDAP_PROFILE_ATTR_MAP = {
    "employee_number": "employeeNumber",
    "department": "department",
}

# Set user flags based on LDAP groups
AUTH_LDAP_USER_FLAGS_BY_GROUP = {
    "is_active": "cn=active_users,ou=groups,dc=example,dc=com",
    "is_staff": "cn=staff,ou=groups,dc=example,dc=com",
    "is_superuser": "cn=admins,ou=groups,dc=example,dc=com",
}

# Always update user info from LDAP on login
AUTH_LDAP_ALWAYS_UPDATE_USER = True

# Cache LDAP group memberships
AUTH_LDAP_CACHE_TIMEOUT = 3600  # 1 hour

# Connection Options
AUTH_LDAP_CONNECTION_OPTIONS = {
    ldap.OPT_DEBUG_LEVEL: 1,
    ldap.OPT_REFERRALS: 0,
}

# Enable TLS/SSL
AUTH_LDAP_START_TLS = True

# Authentication Backends - Add this to settings.py
AUTHENTICATION_BACKENDS = [
    'django_auth_ldap.backend.LDAPBackend',  # LDAP authentication
    'django.contrib.auth.backends.ModelBackend',  # Fallback to local database
]
"""

# Example Role-Based Access Control (RBAC) using LDAP groups
LDAP_RBAC_EXAMPLE = """
# Map LDAP groups to Django permissions/roles

# In your views.py or permissions.py:
from django.contrib.auth.decorators import user_passes_test

def is_network_admin(user):
    return user.groups.filter(name='network_admins').exists()

def is_read_only(user):
    return user.groups.filter(name='read_only_users').exists()

@user_passes_test(is_network_admin)
def admin_only_view(request):
    # Only accessible to users in 'network_admins' LDAP group
    pass

# Or use Django REST Framework permissions:
from rest_framework.permissions import BasePermission

class IsNetworkAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.groups.filter(name='network_admins').exists()

class NetworkDeviceViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsNetworkAdmin]
    # Only network admins can access this
"""

# Active Directory Example
AD_EXAMPLE = """
# Active Directory Configuration Example

import ldap
from django_auth_ldap.config import LDAPSearch, NestedActiveDirectoryGroupType

AUTH_LDAP_SERVER_URI = "ldap://ad.company.com"
AUTH_LDAP_BIND_DN = "CN=ServiceAccount,OU=Service Accounts,DC=company,DC=com"
AUTH_LDAP_BIND_PASSWORD = "service-account-password"

AUTH_LDAP_USER_SEARCH = LDAPSearch(
    "DC=company,DC=com",
    ldap.SCOPE_SUBTREE,
    "(sAMAccountName=%(user)s)"  # Active Directory username field
)

AUTH_LDAP_GROUP_SEARCH = LDAPSearch(
    "DC=company,DC=com",
    ldap.SCOPE_SUBTREE,
    "(objectClass=group)"
)
AUTH_LDAP_GROUP_TYPE = NestedActiveDirectoryGroupType()

AUTH_LDAP_USER_FLAGS_BY_GROUP = {
    "is_active": "CN=Active_Users,OU=Groups,DC=company,DC=com",
    "is_staff": "CN=IT_Staff,OU=Groups,DC=company,DC=com",
    "is_superuser": "CN=Domain_Admins,CN=Users,DC=company,DC=com",
}

AUTH_LDAP_FIND_GROUP_PERMS = True
AUTH_LDAP_CACHE_TIMEOUT = 3600
"""
