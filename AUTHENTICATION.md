# Authentication Implementation

## Overview
Django session-based authentication has been implemented to secure the SWIM application. Now all API endpoints require authentication, and users must log in to access the frontend.

## Backend Changes

### 1. Authentication Views (`swim_backend/core/auth_views.py`)
Added the following API endpoints:
- `POST /api/auth/login/` - Login with username/password
- `POST /api/auth/logout/` - Logout current user
- `GET /api/auth/csrf/` - Get CSRF token
- `GET /api/auth/me/` - Get current user info

### 2. Settings (`swim_backend/settings.py`)
Updated authentication configuration:
```python
# CORS - Allow frontend origin with credentials
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]
CORS_ALLOW_CREDENTIALS = True

# CSRF Configuration
CSRF_TRUSTED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]
CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_HTTPONLY = False  # Allow JavaScript to read CSRF token
SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_HTTPONLY = True

# REST Framework - Require authentication
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}
```

### 3. URL Routing (`swim_backend/api_router.py`)
Added authentication endpoints to the API router.

## Frontend Changes

### 1. Login Page (`ui/src/pages/Login.jsx`)
- Clean login form with username/password fields
- CSRF token handling
- Error messages for invalid credentials
- Redirects to dashboard on successful login

### 2. Auth Context (`ui/src/context/AuthContext.jsx`)
- React context for managing authentication state
- `useAuth()` hook for accessing user info
- Auto-checks authentication on app load
- Provides logout function

### 3. Protected Routes (`ui/src/components/ProtectedRoute.jsx`)
- Wrapper component that redirects to login if not authenticated
- Shows loading state while checking authentication

### 4. Layout Updates (`ui/src/Layout.jsx`)
- Added logout button in sidebar
- Uses AuthContext for user state

### 5. App Routes (`ui/src/App.jsx`)
- Wrapped all routes with `<ProtectedRoute>`
- Added `/login` route
- Wrapped app in `<AuthProvider>`

### 6. API Utility (`ui/src/utils/api.js`)
- Axios instance configured with credentials
- Automatically adds CSRF tokens to requests
- Redirects to login on 401 responses

## How to Use

### Login
1. Navigate to `http://localhost:5173`
2. You'll be redirected to `/login`
3. Enter credentials:
   - Username: `admin`
   - Password: `admin`
4. Click "Sign in"

### Logout
Click the "Logout" button in the sidebar (bottom left)

### API Requests
All API requests now:
- Include session cookies automatically
- Add CSRF tokens for non-GET requests
- Redirect to login if authentication expires

## Security Features
✅ Session-based authentication
✅ CSRF protection
✅ HttpOnly session cookies
✅ Protected API endpoints
✅ Protected frontend routes
✅ Secure cookie settings
✅ CORS properly configured

## Testing
1. Try accessing `http://localhost:5173` without logging in → redirects to login
2. Login with admin/admin → access granted
3. Try accessing API directly without session → 401 Unauthorized
4. Logout → redirected to login page
5. Try to access protected routes → redirected to login

## Next Steps (Optional Enhancements)
- Add "Remember Me" functionality
- Implement password reset
- Add session timeout warnings
- Integrate with LDAP for enterprise authentication
- Add two-factor authentication (2FA)
- Add user registration (if needed)
- Implement role-based access control (RBAC) for different user types
