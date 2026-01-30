# LDAP Configuration Guide

## Overview

SWIM supports LDAP/Active Directory authentication for centralized user management. All LDAP-related configuration has been separated to `.env.ldap` file for easier management.

## Quick Setup

### 1. Copy Template
```bash
cp .env.ldap.example .env.ldap
```

### 2. Configure Your LDAP Server

Edit `.env.ldap` with your organization's LDAP settings:

**For Active Directory:**
```bash
LDAP_SERVER_URI=ldaps://ad.company.com:636
LDAP_BIND_DN=CN=svc_swim,OU=Service Accounts,DC=company,DC=com
LDAP_BIND_PASSWORD=YourServiceAccountPassword
LDAP_USER_SEARCH_BASE=OU=Users,DC=company,DC=com
LDAP_USER_SEARCH_FILTER=(sAMAccountName=%(user)s)
LDAP_GROUP_SEARCH_BASE=OU=Groups,DC=company,DC=com
LDAP_GROUP_TYPE=ActiveDirectoryGroupType
```

**For OpenLDAP:**
```bash
LDAP_SERVER_URI=ldap://ldap.company.com:389
LDAP_BIND_DN=cn=admin,dc=company,dc=com
LDAP_BIND_PASSWORD=YourAdminPassword
LDAP_USER_SEARCH_BASE=ou=people,dc=company,dc=com
LDAP_USER_SEARCH_FILTER=(uid=%(user)s)
LDAP_START_TLS=True
```

### 3. Deploy

LDAP configuration is automatically loaded if `.env.ldap` exists:

```bash
# Development
./deploy.sh

# Production
./deploy.sh --prod
```

## Configuration Options

### Server Settings

| Variable | Description | Example |
|----------|-------------|---------|
| `LDAP_SERVER_URI` | LDAP server URL (ldap:// or ldaps://) | `ldaps://ad.company.com:636` |
| `LDAP_BIND_DN` | Service account DN for LDAP queries | `CN=svc_swim,OU=Service Accounts,DC=company,DC=com` |
| `LDAP_BIND_PASSWORD` | Service account password | `SecurePassword123` |
| `LDAP_START_TLS` | Enable TLS for ldap:// connections | `True` |

### User Search

| Variable | Description | Example |
|----------|-------------|---------|
| `LDAP_USER_SEARCH_BASE` | Base DN for user accounts | `OU=Users,DC=company,DC=com` |
| `LDAP_USER_SEARCH_FILTER` | LDAP filter for user lookup | `(sAMAccountName=%(user)s)` |

### Group Management

| Variable | Description | Example |
|----------|-------------|---------|
| `LDAP_GROUP_SEARCH_BASE` | Base DN for groups | `OU=Groups,DC=company,DC=com` |
| `LDAP_GROUP_TYPE` | Group type class | `ActiveDirectoryGroupType` |
| `LDAP_REQUIRE_GROUP` | Restrict access to specific group | `CN=Network_Engineers,OU=Groups,DC=company,DC=com` |
| `LDAP_MIRROR_GROUPS` | Auto-sync LDAP groups to Django | `True` |

### Attribute Mapping

| Variable | Description | Default |
|----------|-------------|---------|
| `LDAP_ATTR_FIRST_NAME` | First name attribute | `givenName` |
| `LDAP_ATTR_LAST_NAME` | Last name attribute | `sn` |
| `LDAP_ATTR_EMAIL` | Email attribute | `mail` |

## Testing LDAP Configuration

### 1. Test Connection
```bash
# From host
docker-compose exec backend python manage.py shell

# In Django shell
from django_auth_ldap.config import LDAPSearch
import ldap

conn = ldap.initialize('ldaps://ad.company.com:636')
conn.simple_bind_s('CN=svc_swim,OU=Service Accounts,DC=company,DC=com', 'password')
print("LDAP connection successful!")
```

### 2. Test User Login
```bash
# Create test user
docker-compose exec backend python manage.py shell

# In shell
from django.contrib.auth import authenticate
user = authenticate(username='testuser', password='testpass')
print(f"Authenticated: {user}")
```

### 3. Enable Debug Logging
Add to `.env.ldap`:
```bash
LDAP_DEBUG=True
```

View logs:
```bash
docker-compose logs -f backend | grep -i ldap
```

## Security Best Practices

### 1. Use LDAPS (SSL/TLS)
Always use `ldaps://` in production:
```bash
LDAP_SERVER_URI=ldaps://ad.company.com:636
```

### 2. Service Account Permissions
Create a dedicated read-only service account:
- Minimum permissions: Read user/group attributes
- No write access needed
- Strong password policy

### 3. Group-Based Access Control
Restrict SWIM access to specific groups:
```bash
LDAP_REQUIRE_GROUP=CN=Network_Engineers,OU=Groups,DC=company,DC=com
```

### 4. Secure Credentials
- Never commit `.env.ldap` to git (already in .gitignore)
- Use secrets management in production (Docker secrets, Vault)
- Rotate service account passwords regularly

## Troubleshooting

### Connection Failed
**Symptom:** Cannot connect to LDAP server

**Solutions:**
1. Check firewall rules (port 389/636)
2. Verify server URI and port
3. Test with ldapsearch:
```bash
docker-compose exec backend ldapsearch -H ldaps://ad.company.com:636 \
  -D "CN=svc_swim,OU=Service Accounts,DC=company,DC=com" \
  -w password -b "DC=company,DC=com" "(objectClass=*)"
```

### Authentication Failed
**Symptom:** Users can't log in with correct credentials

**Solutions:**
1. Check `LDAP_USER_SEARCH_BASE` is correct
2. Verify `LDAP_USER_SEARCH_FILTER`:
   - Active Directory: `(sAMAccountName=%(user)s)`
   - OpenLDAP: `(uid=%(user)s)`
3. Enable debug logging (`LDAP_DEBUG=True`)
4. Check bind DN has read permissions

### Users Not Auto-Created
**Symptom:** LDAP authentication works but no Django user created

**Solution:**
```bash
LDAP_AUTO_CREATE_USERS=True
```

### Groups Not Syncing
**Symptom:** LDAP groups not appearing in Django

**Solutions:**
1. Enable group mirroring:
```bash
LDAP_MIRROR_GROUPS=True
LDAP_GROUP_SEARCH_BASE=OU=Groups,DC=company,DC=com
```

2. Verify group type:
```bash
# For AD
LDAP_GROUP_TYPE=ActiveDirectoryGroupType

# For OpenLDAP
LDAP_GROUP_TYPE=GroupOfNamesType
```

### SSL Certificate Errors
**Symptom:** `CERTIFICATE_VERIFY_FAILED`

**Solutions:**
1. Add CA certificate to container
2. Or disable verification (DEV ONLY):
```python
# In ldap_settings.py
AUTH_LDAP_GLOBAL_OPTIONS = {
    ldap.OPT_X_TLS_REQUIRE_CERT: ldap.OPT_X_TLS_NEVER
}
```

## Disabling LDAP

To disable LDAP authentication:

1. Remove or rename `.env.ldap`:
```bash
mv .env.ldap .env.ldap.disabled
```

2. Restart containers:
```bash
docker-compose restart backend
```

Users will fall back to Django database authentication.

## Mixed Authentication

SWIM supports both LDAP and local Django users simultaneously:

- LDAP users: Authenticate against directory
- Local users: Authenticate against Django database
- Both can coexist

Create local admin for emergencies:
```bash
docker-compose exec backend python manage.py createsuperuser
```

## Environment Files Loading Order

```
1. .env (main configuration)
2. .env.ldap (LDAP overrides - optional)
```

If a variable exists in both files, `.env.ldap` takes precedence.

## Examples

### Full Active Directory Setup
```bash
LDAP_SERVER_URI=ldaps://ad.company.com:636
LDAP_BIND_DN=CN=svc_swim,OU=Service Accounts,DC=company,DC=com
LDAP_BIND_PASSWORD=SecureP@ss123
LDAP_USER_SEARCH_BASE=OU=Users,DC=company,DC=com
LDAP_USER_SEARCH_FILTER=(sAMAccountName=%(user)s)
LDAP_GROUP_SEARCH_BASE=OU=Groups,DC=company,DC=com
LDAP_GROUP_TYPE=ActiveDirectoryGroupType
LDAP_REQUIRE_GROUP=CN=Network_Engineers,OU=Groups,DC=company,DC=com
LDAP_ATTR_FIRST_NAME=givenName
LDAP_ATTR_LAST_NAME=sn
LDAP_ATTR_EMAIL=mail
LDAP_MIRROR_GROUPS=True
LDAP_AUTO_CREATE_USERS=True
```

### OpenLDAP with TLS
```bash
LDAP_SERVER_URI=ldap://ldap.company.com:389
LDAP_START_TLS=True
LDAP_BIND_DN=cn=admin,dc=company,dc=com
LDAP_BIND_PASSWORD=AdminPass123
LDAP_USER_SEARCH_BASE=ou=people,dc=company,dc=com
LDAP_USER_SEARCH_FILTER=(uid=%(user)s)
LDAP_GROUP_SEARCH_BASE=ou=groups,dc=company,dc=com
LDAP_AUTO_CREATE_USERS=True
```

## Support

For LDAP issues:
1. Check logs: `docker-compose logs backend | grep -i ldap`
2. Enable debug: `LDAP_DEBUG=True` in `.env.ldap`
3. Test connectivity: `ldapsearch` from backend container
4. Verify Django LDAP settings: `swim_backend/ldap_settings.py`

See `.env.ldap.example` for all available configuration options.
