# Custom Action Permissions

## Overview

Custom action permissions are **separate** from standard CRUD permissions. A user can have full CRUD access to a model without having access to custom actions.

## Device Custom Actions

The Device model has three custom action permissions that must be explicitly granted:

### Standard CRUD Permissions
- `devices.add_device` - Can create new devices
- `devices.change_device` - Can modify device properties
- `devices.delete_device` - Can delete devices
- `devices.view_device` - Can view devices

### Custom Action Permissions (Require Explicit Grant)
- `devices.sync_device_inventory` - Can trigger sync operations to discover device versions
- `devices.upgrade_device_firmware` - Can initiate firmware upgrade workflows
- `devices.check_device_readiness` - Can run pre-upgrade readiness checks

## Security Model

**Important:** Custom actions are sensitive operations that should be granted carefully:

1. **Sync Operations** - Connects to devices and collects inventory data
2. **Upgrade Operations** - Modifies device firmware (high risk)
3. **Readiness Checks** - Performs compliance and configuration validation

Even if a user has all CRUD permissions on devices, they will NOT automatically be able to:
- Click the "Sync" button
- Access the upgrade wizard
- Trigger readiness checks

## Granting Custom Permissions

### Via Django Admin
1. Go to Users or Groups
2. Select the user/group
3. Add specific custom permissions from the available permissions list
4. Look for "Can sync device inventory", "Can upgrade device firmware", etc.

### Via Permission Bundles
Create a custom bundle that includes these permissions:
```python
from swim_backend.core.rbac_models import PermissionBundle
from django.contrib.auth.models import Permission

bundle = PermissionBundle.objects.create(
    name="Device Operations",
    description="Allows sync and upgrade operations"
)

# Add only the custom action permissions
perms = Permission.objects.filter(
    content_type__app_label='devices',
    content_type__model='device',
    codename__in=['sync_device_inventory', 'upgrade_device_firmware', 'check_device_readiness']
)
bundle.permissions.set(perms)
```

### Via Code
```python
from django.contrib.auth.models import User, Permission

user = User.objects.get(username='operator')

# Grant upgrade permission
upgrade_perm = Permission.objects.get(
    content_type__app_label='devices',
    content_type__model='device',
    codename='upgrade_device_firmware'
)
user.user_permissions.add(upgrade_perm)
```

## Frontend Behavior

The frontend will automatically hide action buttons based on permissions:

- **No sync permission** → Sync button hidden in device list and floating action bar
- **No upgrade permission** → Upgrade button hidden, wizard redirects to device list
- **No delete permission** → Delete button hidden in floating action bar

## Backend Enforcement

All custom actions check permissions before execution:

```python
# In DeviceViewSet
@action(detail=False, methods=['post'])
def sync(self, request):
    if not request.user.has_perm('devices.sync_device_inventory'):
        return Response(
            {'error': 'You do not have permission to sync device inventory'},
            status=403
        )
    # ... sync logic
```

Even if someone bypasses the frontend, the backend will return a 403 Forbidden error.

## Best Practices

1. **Principle of Least Privilege** - Only grant custom action permissions to users who need them
2. **Separate Roles** - Consider creating different permission bundles:
   - "Device Viewer" - Only view permissions
   - "Device Manager" - CRUD + view-only operations
   - "Device Operator" - CRUD + sync + readiness checks
   - "Device Administrator" - Full access including upgrades

3. **Audit Trail** - All custom actions should log to ActivityLog for compliance

4. **Testing** - Always test with a restricted user account to verify permissions work correctly

## Verification

To check if a user has custom action permissions:

```bash
uv run python manage.py shell_plus
```

```python
from django.contrib.auth.models import User

user = User.objects.get(username='test')

print(f"Can view devices: {user.has_perm('devices.view_device')}")
print(f"Can sync: {user.has_perm('devices.sync_device_inventory')}")
print(f"Can upgrade: {user.has_perm('devices.upgrade_device_firmware')}")
print(f"Can check readiness: {user.has_perm('devices.check_device_readiness')}")
```
