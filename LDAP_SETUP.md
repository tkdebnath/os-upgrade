# LDAP Authentication Setup Guide

## Overview
This guide explains how to enable LDAP/Active Directory authentication in SWIM for enterprise user management, group-based access control, and role-based permissions.

## Current Status
✅ Session-based authentication is working with local database users
✅ The `django-auth-ldap` package is already installed
⏳ LDAP configuration needs to be enabled in settings.py

## Quick Start

### 1. Test Current Authentication
Your **admin:admin** credentials should now work. The frontend authentication has been fixed:
- Fixed: AuthContext now properly handles 403 responses when not authenticated
- Fixed: Login component now updates auth state after successful login
- Fixed: Session cookies are properly configured with CORS

Visit `http://localhost:5173` and login with:
- Username: `admin`
- Password: `admin`

### 2. Enable LDAP Authentication

Edit `/home/tdebnath/swim/swim_backend/settings.py` and add these configurations:

```python
# At the top of settings.py, add:
import ldap
from django_auth_ldap.config import LDAPSearch, GroupOfNamesType

# LDAP Configuration
AUTH_LDAP_SERVER_URI = "ldap://your-ldap-server.com"
AUTH_LDAP_BIND_DN = "cn=admin,dc=example,dc=com"
AUTH_LDAP_BIND_PASSWORD = "your-ldap-password"

AUTH_LDAP_USER_SEARCH = LDAPSearch(
    "ou=users,dc=example,dc=com",
    ldap.SCOPE_SUBTREE,
    "(uid=%(user)s)"
)

AUTH_LDAP_USER_ATTR_MAP = {
    "first_name": "givenName",
    "last_name": "sn",
    "email": "mail",
}

AUTH_LDAP_GROUP_SEARCH = LDAPSearch(
    "ou=groups,dc=example,dc=com",
    ldap.SCOPE_SUBTREE,
    "(objectClass=groupOfNames)"
)
AUTH_LDAP_GROUP_TYPE = GroupOfNamesType()

AUTH_LDAP_USER_FLAGS_BY_GROUP = {
    "is_active": "cn=active_users,ou=groups,dc=example,dc=com",
    "is_staff": "cn=network_staff,ou=groups,dc=example,dc=com",
    "is_superuser": "cn=network_admins,ou=groups,dc=example,dc=com",
}

AUTH_LDAP_MIRROR_GROUPS = True
AUTH_LDAP_ALWAYS_UPDATE_USER = True

# Authentication Backends - Add LDAP before ModelBackend
AUTHENTICATION_BACKENDS = [
    'django_auth_ldap.backend.LDAPBackend',
    'django.contrib.auth.backends.ModelBackend',  # Fallback
]
```

### 3. For Active Directory (Microsoft AD)

If using Active Directory, use this configuration instead:

```python
import ldap
from django_auth_ldap.config import LDAPSearch, NestedActiveDirectoryGroupType

AUTH_LDAP_SERVER_URI = "ldap://ad.yourcompany.com"
AUTH_LDAP_BIND_DN = "CN=ServiceAccount,OU=Service Accounts,DC=yourcompany,DC=com"
AUTH_LDAP_BIND_PASSWORD = "service-password"

AUTH_LDAP_USER_SEARCH = LDAPSearch(
    "DC=yourcompany,DC=com",
    ldap.SCOPE_SUBTREE,
    "(sAMAccountName=%(user)s)"  # AD uses sAMAccountName
)

AUTH_LDAP_GROUP_SEARCH = LDAPSearch(
    "DC=yourcompany,DC=com",
    ldap.SCOPE_SUBTREE,
    "(objectClass=group)"
)
AUTH_LDAP_GROUP_TYPE = NestedActiveDirectoryGroupType()

AUTH_LDAP_USER_FLAGS_BY_GROUP = {
    "is_active": "CN=Active_Users,OU=Groups,DC=yourcompany,DC=com",
    "is_staff": "CN=Network_Staff,OU=Groups,DC=yourcompany,DC=com",
    "is_superuser": "CN=Network_Admins,OU=Groups,DC=yourcompany,DC=com",
}

AUTHENTICATION_BACKENDS = [
    'django_auth_ldap.backend.LDAPBackend',
    'django.contrib.auth.backends.ModelBackend',
]
```

## Group-Based Access Control

### Automatic Group Mapping
With `AUTH_LDAP_MIRROR_GROUPS = True`, LDAP groups are automatically synced to Django:
- LDAP group `network_admins` → Django group `network_admins`
- LDAP group `network_operators` → Django group `network_operators`
- LDAP group `read_only_users` → Django group `read_only_users`

### Permission Examples

#### In Django Admin
Assign permissions to groups:
1. Go to http://localhost:8000/admin/auth/group/
2. Create groups: `network_admins`, `network_operators`, `read_only_users`
3. Assign permissions to each group

#### In Code (Views)
```python
from django.contrib.auth.decorators import user_passes_test

def is_network_admin(user):
    return user.groups.filter(name='network_admins').exists()

@user_passes_test(is_network_admin)
def upgrade_device_view(request):
    # Only network admins can upgrade devices
    pass
```

#### In REST API (ViewSets)
```python
from rest_framework.permissions import BasePermission

class IsNetworkAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.groups.filter(name='network_admins').exists()

class IsReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in ['GET', 'HEAD', 'OPTIONS']:
            return True
        return request.user.groups.filter(name='network_admins').exists()

class DeviceViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsReadOnly]
    # Read-only users can view, admins can modify
```

### Frontend Role-Based UI
The frontend can check user groups and permissions:

```javascript
// In a component
import { useAuth } from '../context/AuthContext';

function UpgradeButton() {
  const { user } = useAuth();
  
  const canUpgrade = user?.groups?.includes('network_admins') || 
                     user?.is_superuser;
  
  if (!canUpgrade) {
    return null; // Hide button for non-admins
  }
  
  return <button onClick={handleUpgrade}>Upgrade Device</button>;
}
```

## Testing LDAP

### Test LDAP Connection
```bash
cd /home/tdebnath/swim
python manage.py shell

# In Python shell:
from django_auth_ldap.backend import LDAPBackend
backend = LDAPBackend()

# Test authentication
user = backend.authenticate(None, username='testuser', password='testpass')
if user:
    print(f"Success! User: {user.username}")
    print(f"Groups: {list(user.groups.values_list('name', flat=True))}")
else:
    print("Authentication failed")
```

### Enable LDAP Debug Logging
Add to settings.py:
```python
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'loggers': {
        'django_auth_ldap': {
            'level': 'DEBUG',
            'handlers': ['console'],
        },
    },
}
```

## Role Definitions

### Suggested LDAP Groups

| LDAP Group | Django Permission | Access Level |
|------------|------------------|--------------|
| `network_admins` | is_superuser | Full access to all features |
| `network_operators` | is_staff | Can upgrade devices, view configs |
| `network_viewers` | is_active | Read-only access to inventory |
| `security_team` | Custom | View compliance checks, audit logs |

### Custom Permissions
Create custom permissions in models:
```python
class Device(models.Model):
    # ... fields ...
    
    class Meta:
        permissions = [
            ("can_upgrade_device", "Can upgrade device firmware"),
            ("can_view_device_config", "Can view device configuration"),
            ("can_export_inventory", "Can export inventory data"),
        ]
```

Then assign these to groups in Django Admin.

## Troubleshooting

### Issue: "admin:admin not working"
**Fixed!** The AuthContext now properly handles authentication state. Clear browser cookies and try again.

### Issue: LDAP users can't login
1. Check LDAP connection: `ldapsearch -x -H ldap://server -D "cn=admin,dc=example,dc=com" -W`
2. Enable DEBUG logging (see above)
3. Verify search base DN is correct
4. Check firewall rules (LDAP port 389, LDAPS port 636)

### Issue: Groups not syncing
1. Set `AUTH_LDAP_MIRROR_GROUPS = True`
2. Verify `AUTH_LDAP_GROUP_SEARCH` is correct
3. Check group object class matches your LDAP schema

### Issue: Permissions not working
1. User must login again after group changes
2. Check group membership: `user.groups.all()`
3. Verify `AUTH_LDAP_ALWAYS_UPDATE_USER = True`

## Security Best Practices

1. **Use LDAPS (LDAP over SSL)**: `AUTH_LDAP_SERVER_URI = "ldaps://..."`
2. **Service Account**: Create dedicated LDAP service account with minimal permissions
3. **Cache Settings**: Set appropriate `AUTH_LDAP_CACHE_TIMEOUT` (default: 1 hour)
4. **Password Policy**: Enforce via LDAP, not Django
5. **Audit Logging**: Enable Django admin action logging for compliance

## Next Steps

1. ✅ Test login with admin:admin (should work now!)
2. Configure LDAP server details in settings.py
3. Create LDAP groups for different access levels
4. Test LDAP authentication
5. Implement role-based permissions in views
6. Update frontend to show/hide features based on roles

## Files Reference
- LDAP settings template: [swim_backend/ldap_settings.py](swim_backend/ldap_settings.py)
- Authentication views: [swim_backend/core/auth_views.py](swim_backend/core/auth_views.py)
- Main settings: [swim_backend/settings.py](swim_backend/settings.py)
- Auth context: [ui/src/context/AuthContext.jsx](ui/src/context/AuthContext.jsx)
- Login page: [ui/src/pages/Login.jsx](ui/src/pages/Login.jsx)
