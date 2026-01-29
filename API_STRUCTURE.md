# SWIM API Structure - NetBox Style

## Overview
The SWIM API has been restructured to follow NetBox's organizational pattern, grouping endpoints by functional domain rather than having a flat structure.

## API Organization

### Root API Endpoint
- **URL**: `http://127.0.0.1:8000/api/`
- **Purpose**: API discovery - lists all available API namespaces

### API Namespaces

#### 1. DCIM (Data Center Infrastructure Management)
**Base Path**: `/api/dcim/`

**Endpoints**:
- `GET /api/dcim/` - DCIM API root (lists all DCIM endpoints)
- `GET /api/dcim/devices/` - List all devices
- `GET /api/dcim/devices/{id}/` - Get device details
- `POST /api/dcim/devices/` - Create new device
- `PATCH /api/dcim/devices/{id}/` - Update device
- `DELETE /api/dcim/devices/{id}/` - Delete device
- `POST /api/dcim/devices/sync/` - Sync devices (custom action)
- `POST /api/dcim/devices/import_csv/` - Import devices from CSV
- `GET /api/dcim/devices/list_plugins/` - List available import plugins
- `POST /api/dcim/devices/plugin/{plugin_name}/action/` - Execute plugin action

**Device Models**:
- `GET /api/dcim/device-models/` - List all device models
- `GET /api/dcim/device-models/{name}/` - Get model details
- `POST /api/dcim/device-models/` - Create new model
- `PATCH /api/dcim/device-models/{name}/` - Update model
- `DELETE /api/dcim/device-models/{name}/` - Delete model
- `DELETE /api/dcim/device-models/cleanup_unused/` - Cleanup unused models
- `GET /api/dcim/device-models/{name}/scan_images/` - Scan for images

**Sites & Regions**:
- `GET /api/dcim/sites/` - List all sites
- `GET /api/dcim/sites/{id}/` - Get site details
- `POST /api/dcim/sites/` - Create new site
- `PATCH /api/dcim/sites/{id}/` - Update site
- `DELETE /api/dcim/sites/{id}/` - Delete site

- `GET /api/dcim/regions/` - List all regions
- `GET /api/dcim/regions/{id}/` - Get region details
- `POST /api/dcim/regions/` - Create new region
- `PATCH /api/dcim/regions/{id}/` - Update region
- `DELETE /api/dcim/regions/{id}/` - Delete region

**Credentials**:
- `GET /api/dcim/global-credentials/` - List global credentials
- `POST /api/dcim/global-credentials/` - Create credentials
- `PATCH /api/dcim/global-credentials/{id}/` - Update credentials
- `DELETE /api/dcim/global-credentials/{id}/` - Delete credentials

#### 2. Images (Software Image Management)
**Base Path**: `/api/images/`

**Endpoints**:
- `GET /api/images/` - Images API root
- `GET /api/images/images/` - List all software images
- `GET /api/images/images/{id}/` - Get image details
- `POST /api/images/images/` - Create new image
- `PATCH /api/images/images/{id}/` - Update image
- `DELETE /api/images/images/{id}/` - Delete image

**File Servers**:
- `GET /api/images/file-servers/` - List all file servers
- `GET /api/images/file-servers/{id}/` - Get file server details
- `POST /api/images/file-servers/` - Create new file server
- `PUT /api/images/file-servers/{id}/` - Update file server (full update)
- `PATCH /api/images/file-servers/{id}/` - Update file server (partial)
- `DELETE /api/images/file-servers/{id}/` - Delete file server

**Golden Images**:
- `GET /api/images/golden-images/` - List golden images
- `GET /api/images/golden-images/{id}/` - Get golden image details
- `POST /api/images/golden-images/` - Create golden image
- `PATCH /api/images/golden-images/{id}/` - Update golden image
- `DELETE /api/images/golden-images/{id}/` - Delete golden image

#### 3. Core (System Functions)
**Base Path**: `/api/core/`

**Endpoints**:
- `GET /api/core/` - Core API root

**Jobs**:
- `GET /api/core/jobs/` - List all jobs
- `GET /api/core/jobs/{id}/` - Get job details
- `POST /api/core/jobs/` - Create new job
- `PATCH /api/core/jobs/{id}/` - Update job
- `DELETE /api/core/jobs/{id}/` - Delete job
- `POST /api/core/jobs/{id}/cancel/` - Cancel job
- `POST /api/core/jobs/bulk_reschedule/` - Reschedule multiple jobs
- `GET /api/core/jobs/{id}/download_artifacts/` - Download job artifacts

**Workflows**:
- `GET /api/core/workflows/` - List all workflows
- `GET /api/core/workflows/{id}/` - Get workflow details
- `POST /api/core/workflows/` - Create new workflow
- `PATCH /api/core/workflows/{id}/` - Update workflow
- `DELETE /api/core/workflows/{id}/` - Delete workflow
- `POST /api/core/workflows/{id}/update_steps/` - Update workflow steps
- `POST /api/core/workflows/{id}/set_default/` - Set as default workflow

**Workflow Steps**:
- `GET /api/core/workflow-steps/` - List workflow steps
- `GET /api/core/workflow-steps/{id}/` - Get step details
- `POST /api/core/workflow-steps/` - Create step
- `PATCH /api/core/workflow-steps/{id}/` - Update step
- `DELETE /api/core/workflow-steps/{id}/` - Delete step

**Validation Checks**:
- `GET /api/core/checks/` - List all validation checks
- `GET /api/core/checks/{id}/` - Get check details
- `POST /api/core/checks/` - Create new check
- `PATCH /api/core/checks/{id}/` - Update check
- `DELETE /api/core/checks/{id}/` - Delete check

**Check Runs**:
- `GET /api/core/check-runs/` - List check run results
- `GET /api/core/check-runs/{id}/` - Get check run details

**Dashboard & Activity**:
- `GET /api/core/dashboard/` - Dashboard statistics
- `GET /api/core/activity-logs/` - List activity logs
- `GET /api/core/reports/` - List available reports

#### 4. Users (Authentication & Authorization)
**Base Path**: `/api/users/`

**Endpoints**:
- `GET /api/users/` - Users API root

**Users**:
- `GET /api/users/users/` - List all users
- `GET /api/users/users/{id}/` - Get user details
- `POST /api/users/users/` - Create new user
- `PUT /api/users/users/{id}/` - Update user (full)
- `PATCH /api/users/users/{id}/` - Update user (partial)
- `DELETE /api/users/users/{id}/` - Delete user
- `POST /api/users/users/{id}/toggle_active/` - Activate/deactivate user
- `POST /api/users/users/{id}/set_password/` - Change user password

**Groups**:
- `GET /api/users/groups/` - List all groups
- `GET /api/users/groups/{id}/` - Get group details
- `POST /api/users/groups/` - Create new group
- `PUT /api/users/groups/{id}/` - Update group (full)
- `PATCH /api/users/groups/{id}/` - Update group (partial)
- `DELETE /api/users/groups/{id}/` - Delete group

**Permissions**:
- `GET /api/users/permissions/` - List all permissions
- `GET /api/users/permissions/{id}/` - Get permission details
- `POST /api/users/permissions/` - Create custom permission
- `PUT /api/users/permissions/{id}/` - Update permission
- `DELETE /api/users/permissions/{id}/` - Delete permission
- `GET /api/users/permissions/content_types/` - List content types

**Permission Bundles**:
- `GET /api/users/permission-bundles/` - List permission bundles
- `GET /api/users/permission-bundles/{id}/` - Get bundle details
- `POST /api/users/permission-bundles/` - Create bundle
- `PATCH /api/users/permission-bundles/{id}/` - Update bundle
- `DELETE /api/users/permission-bundles/{id}/` - Delete bundle

**API Tokens**:
- `GET /api/users/tokens/` - List user's API tokens
- `GET /api/users/tokens/{id}/` - Get token details
- `POST /api/users/tokens/` - Create new token
- `DELETE /api/users/tokens/{id}/` - Delete token

#### 5. Auth (Authentication Endpoints)
**Base Path**: `/api/auth/`

**Endpoints**:
- `GET /api/auth/` - Auth API root
- `GET /api/auth/csrf/` - Get CSRF token
- `POST /api/auth/login/` - Login with username/password
- `POST /api/auth/logout/` - Logout current user
- `GET /api/auth/me/` - Get current user info and permissions

## Migration from Old Structure

### Removed Legacy Endpoints
All flat API endpoints have been removed. No backward compatibility layer exists.

### Endpoint Mapping

| Old Endpoint | New Endpoint |
|-------------|-------------|
| `/api/devices/` | `/api/dcim/devices/` |
| `/api/device-models/` | `/api/dcim/device-models/` |
| `/api/sites/` | `/api/dcim/sites/` |
| `/api/regions/` | `/api/dcim/regions/` |
| `/api/global-credentials/` | `/api/dcim/global-credentials/` |
| `/api/images/` | `/api/images/images/` |
| `/api/file-servers/` | `/api/images/file-servers/` |
| `/api/golden-images/` | `/api/images/golden-images/` |
| `/api/jobs/` | `/api/core/jobs/` |
| `/api/workflows/` | `/api/core/workflows/` |
| `/api/workflow-steps/` | `/api/core/workflow-steps/` |
| `/api/checks/` | `/api/core/checks/` |
| `/api/check-runs/` | `/api/core/check-runs/` |
| `/api/dashboard/` | `/api/core/dashboard/` |
| `/api/activity-logs/` | `/api/core/activity-logs/` |
| `/api/reports/` | `/api/core/reports/` |
| `/api/users/` | `/api/users/users/` |
| `/api/groups/` | `/api/users/groups/` |
| `/api/permissions/` | `/api/users/permissions/` |
| `/api/permission-bundles/` | `/api/users/permission-bundles/` |
| `/api/api-tokens/` | `/api/users/tokens/` |

## Benefits of NetBox-Style Structure

1. **Logical Organization**: Endpoints are grouped by functional domain (DCIM, Images, Core, Users)
2. **Scalability**: Easy to add new endpoints within appropriate namespaces
3. **API Discovery**: Each namespace has its own root endpoint listing available resources
4. **Industry Standard**: Follows NetBox's proven API design pattern
5. **Better Documentation**: Clear hierarchy makes it easier to understand and document
6. **Separation of Concerns**: Different functional areas are cleanly separated

## API Root Response Example

```json
{
  "dcim": "http://127.0.0.1:8000/api/dcim/",
  "images": "http://127.0.0.1:8000/api/images/",
  "core": "http://127.0.0.1:8000/api/core/",
  "users": "http://127.0.0.1:8000/api/users/",
  "auth": "http://127.0.0.1:8000/api/auth/"
}
```

## Authentication

All endpoints (except auth endpoints) require authentication:
- Session-based authentication for web UI
- Token-based authentication for API clients

### Getting Started

1. Get CSRF token: `GET /api/auth/csrf/`
2. Login: `POST /api/auth/login/` with `{"username": "...", "password": "..."}`
3. Access protected endpoints with session cookie
4. Check current user: `GET /api/auth/me/`

## Frontend Integration

All frontend components have been updated to use the new endpoint structure:
- Device management → `/api/dcim/devices/`
- Image management → `/api/images/`
- Job monitoring → `/api/core/jobs/`
- User administration → `/api/users/users/`
- Authentication → `/api/auth/`

No changes needed in frontend code after this migration is complete.
