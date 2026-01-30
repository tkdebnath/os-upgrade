# SWIM Access URLs Guide

## URL Access After Docker Deployment

### Development Setup (docker-compose.yml)

| Service | URL | Description |
|---------|-----|-------------|
| **React Frontend** | http://localhost | Main UI application |
| **Django Admin** | http://localhost/admin/ | Device/job management admin panel |
| **REST API** | http://localhost/api/ | Backend API endpoints |
| **Swagger UI** | http://localhost/api/schema/swagger-ui/ | Interactive API documentation |
| **ReDoc** | http://localhost/api/schema/redoc/ | Alternative API documentation |
| **OpenAPI Schema** | http://localhost/api/schema/ | Raw OpenAPI/Swagger schema |
| **Backend Direct** | http://localhost:8000 | Direct backend access (dev only) |

### Production Setup (docker-compose.prod.yml)

| Service | URL | Description |
|---------|-----|-------------|
| **React Frontend** | http://localhost | Main UI application |
| **Django Admin** | http://localhost/admin/ | Device/job management admin panel |
| **REST API** | http://localhost/api/ | Backend API endpoints |
| **Swagger UI** | http://localhost/api/schema/swagger-ui/ | Interactive API documentation |
| **ReDoc** | http://localhost/api/schema/redoc/ | Alternative API documentation |
| **OpenAPI Schema** | http://localhost/api/schema/ | Raw OpenAPI/Swagger schema |

> **Note:** In production, backend port 8000 is not exposed - all traffic goes through Nginx on port 80/443.

---

## How URL Routing Works

### Nginx Configuration (ui/nginx.conf)

The frontend Nginx container handles all incoming requests and routes them:

```
User Request → Nginx (Port 80) → Routes to appropriate service:
├── /                    → React Frontend (SPA)
├── /admin/              → Django Backend (Admin Panel)
├── /api/                → Django Backend (REST API)
├── /api/schema/         → Django Backend (Swagger/ReDoc)
├── /static/             → Django Backend (Static files)
└── /media/              → Django Backend (Uploaded files)
```

### Why Both Have /admin?

1. **React Frontend `/admin`**: This is just a route in the React router that displays admin UI components in the browser. It's client-side only.

2. **Django Backend `/admin/`**: This is the actual Django admin panel served by the backend with database access.

**The Nginx proxy ensures no conflict:**
- `/admin/` requests are proxied to Django backend
- React handles its own routes internally (no `/admin/` prefix needed in React)

---

## Accessing Each Service

### 1. Django Admin Panel
```
URL: http://localhost/admin/

Default Credentials (Development):
Username: admin
Password: admin

What you can do:
- Manage devices, sites, models
- View/edit jobs and workflows
- Configure validation checks
- Manage users and permissions
- View ZTP workflows
```

### 2. Swagger API Documentation
```
URL: http://localhost/api/schema/swagger-ui/

Features:
- Interactive API explorer
- Try out API endpoints directly
- See request/response schemas
- Authentication testing
- Download OpenAPI spec

Perfect for:
- Testing API endpoints
- Understanding API structure
- Integrating with SWIM
- Writing automation scripts
```

### 3. ReDoc API Documentation
```
URL: http://localhost/api/schema/redoc/

Features:
- Clean, readable API documentation
- Organized by endpoint categories
- Request/response examples
- Model schemas
- Better for reading than testing

Perfect for:
- Learning the API
- Reference documentation
- Sharing with team
```

### 4. React Frontend
```
URL: http://localhost/

Features:
- Device inventory management
- IOS upgrade wizard
- Job monitoring
- ZTP workflow configuration
- Dashboard and analytics
- User management
```

---

## Testing API with Swagger

### Step 1: Deploy the application
```bash
./deploy.sh
```

### Step 2: Create admin user (if needed)
```bash
# Development
docker-compose exec backend python manage.py createsuperuser

# Production
docker-compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser
```

### Step 3: Access Swagger UI
Open browser: http://localhost/api/schema/swagger-ui/

### Step 4: Authenticate
1. Click **"Authorize"** button (top right)
2. Login with your Django admin credentials
3. Session authentication is now active

### Step 5: Test Endpoints
Try these endpoints:
- `GET /api/dcim/devices/` - List all devices
- `GET /api/core/jobs/` - List upgrade jobs
- `GET /api/core/dashboard/stats/` - Dashboard statistics
- `POST /api/core/jobs/` - Create a new job

---

## Port Configuration

### Development (docker-compose.yml)
```yaml
Frontend: 80  → http://localhost
Backend:  8000 → http://localhost:8000 (direct access)
```

### Production (docker-compose.prod.yml)
```yaml
Frontend: 80   → http://localhost
Frontend: 443  → https://localhost (if SSL configured)
Backend: (internal only - not exposed)
Database: (internal only - not exposed)
Redis: (internal only - not exposed)
```

### Custom Ports

Edit `.env` file to change frontend port:
```bash
FRONTEND_PORT=8080
FRONTEND_SSL_PORT=8443
```

Then access at:
- http://localhost:8080
- http://localhost:8080/api/schema/swagger-ui/

---

## Common Access Patterns

### For Network Engineers
1. **Use React UI** for day-to-day operations:
   - http://localhost
   - Upgrade devices through wizard
   - Monitor job status
   - Check device compliance

2. **Use Django Admin** for configuration:
   - http://localhost/admin/
   - Configure golden IOS images
   - Set up file servers
   - Manage validation checks

### For Automation/Integration
1. **Use Swagger UI** for API exploration:
   - http://localhost/api/schema/swagger-ui/
   - Test API endpoints
   - Get request/response formats

2. **Use REST API** for automation:
   - http://localhost/api/
   - Integrate with existing tools
   - Build custom scripts
   - Trigger upgrades programmatically

### For Developers
1. **Development mode** - Access both:
   - Frontend: http://localhost
   - Backend: http://localhost:8000
   - Swagger: http://localhost:8000/api/schema/swagger-ui/

2. **Production mode** - Use Nginx proxy:
   - Everything through http://localhost
   - Backend not directly accessible

---

## API Authentication

### Session Authentication (Browser)
Already logged in to Django admin? API calls work automatically.

### Token Authentication (Scripts)
```python
import requests

# Login
response = requests.post('http://localhost/api/auth/login/', {
    'username': 'admin',
    'password': 'admin'
})

# Use session for subsequent requests
session = requests.Session()
session.cookies = response.cookies

# Make API call
devices = session.get('http://localhost/api/dcim/devices/')
print(devices.json())
```

### API Key Authentication
1. Create API key in Django admin:
   - http://localhost/admin/rest_framework_api_key/apikey/

2. Use in requests:
```bash
curl -H "Authorization: Api-Key YOUR_API_KEY_HERE" \
     http://localhost/api/dcim/devices/
```

---

## Troubleshooting Access Issues

### Can't access /admin/
**Problem**: Getting React 404 page

**Solution**:
```bash
# Check nginx config is correct
docker-compose exec frontend cat /etc/nginx/conf.d/default.conf

# Restart frontend
docker-compose restart frontend
```

### Swagger UI not loading
**Problem**: 404 or blank page

**Solution**:
```bash
# Check backend is running
docker-compose ps backend

# Check backend logs
docker-compose logs backend

# Verify schema endpoint works
curl http://localhost/api/schema/
```

### CORS errors in browser
**Problem**: API calls blocked by CORS policy

**Solution**: Check ALLOWED_HOSTS in .env:
```bash
ALLOWED_HOSTS=*
```

### Can't login to Django admin
**Problem**: Admin credentials not working

**Solution**:
```bash
# Reset admin password
docker-compose exec backend python manage.py changepassword admin

# Or create new superuser
docker-compose exec backend python manage.py createsuperuser
```

---

## Production Considerations

### Use HTTPS
Add SSL certificate to nginx config and update ports:
```yaml
ports:
  - "443:443"
```

### Custom Domain
Update .env:
```bash
ALLOWED_HOSTS=*
# Or specific domain: ALLOWED_HOSTS=swim.yourcompany.com
```

Access at:
- https://swim.yourcompany.com
- https://swim.yourcompany.com/admin/
- https://swim.yourcompany.com/api/schema/swagger-ui/

### API Rate Limiting
Add to Django settings for production:
```python
REST_FRAMEWORK = {
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle'
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/day',
        'user': '1000/day'
    }
}
```

---

## Quick Reference

**After deployment, access these URLs:**

✅ **Main Application**: http://localhost
✅ **Admin Panel**: http://localhost/admin/
✅ **API Docs (Swagger)**: http://localhost/api/schema/swagger-ui/
✅ **API Docs (ReDoc)**: http://localhost/api/schema/redoc/
✅ **REST API**: http://localhost/api/

**Default Login**: admin / admin (change in production!)
