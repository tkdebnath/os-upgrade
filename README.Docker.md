# SWIM Docker Deployment Guide

## Quick Start

### Prerequisites
- Docker Engine 20.10+
- Docker Compose 2.0+

### Build and Run

1. **Build and start all services:**
   ```bash
   docker-compose up --build
   ```

2. **Run in detached mode (background):**
   ```bash
   docker-compose up -d --build
   ```

3. **Access the application:**
   - Frontend: http://localhost
   - Backend API: http://localhost/api
   - Django Admin: http://localhost/admin

### Initial Setup

After the containers are running, create a superuser for Django admin:

```bash
docker-compose exec backend python manage.py createsuperuser
```

### Seed Demo Data (Optional)

To populate the database with demo data:

```bash
# Seed devices
docker-compose exec backend python manage.py seed_devices

# Seed images
docker-compose exec backend python manage.py seed_images

# Seed validation checks
docker-compose exec backend python manage.py seed_checks

# Seed workflow
docker-compose exec backend python manage.py seed_workflow
```

## Docker Commands

### View logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Stop containers
```bash
docker-compose down
```

### Stop and remove volumes (clean slate)
```bash
docker-compose down -v
```

### Rebuild a specific service
```bash
docker-compose up -d --build backend
docker-compose up -d --build frontend
```

### Execute commands in containers
```bash
# Backend shell
docker-compose exec backend bash

# Run Django management commands
docker-compose exec backend python manage.py migrate
docker-compose exec backend python manage.py collectstatic
```

## Architecture

The Docker setup consists of:

1. **Backend Service** (Django)
   - Python 3.13
   - Runs on port 8000
   - SQLite database (persisted via volume)
   - Includes pyATS/Genie for network automation

2. **Frontend Service** (React + Nginx)
   - Node 20 for building
   - Nginx for serving static files
   - Runs on port 80
   - Proxies API requests to backend

3. **Network**
   - Bridge network connecting frontend and backend
   - Frontend can access backend via `http://backend:8000`

## Volumes

The following directories are persisted:
- `./db.sqlite3` - Database
- `./logs/` - Application logs
- `./media/` - Uploaded files
- `./static/` - Static files

## Environment Variables

You can customize the backend by creating a `.env` file:

```env
DEBUG=False
SECRET_KEY=your-secret-key-here
ALLOWED_HOSTS=localhost,127.0.0.1
```

Then update docker-compose.yml to use the env file:
```yaml
services:
  backend:
    env_file:
      - .env
```

## Production Considerations

For production deployment:

1. **Change SECRET_KEY** in Django settings
2. **Set DEBUG=False**
3. **Configure ALLOWED_HOSTS** properly
4. **Use PostgreSQL** instead of SQLite
5. **Add SSL/TLS** with Let's Encrypt
6. **Configure proper logging**
7. **Set up backup strategy** for database
8. **Use secrets management** for credentials

## Troubleshooting

### Backend won't start
```bash
docker-compose logs backend
```

### Frontend can't connect to backend
- Ensure both containers are on the same network
- Check nginx proxy configuration
- Verify backend is running: `docker-compose ps`

### Permission issues with volumes
```bash
sudo chown -R $USER:$USER ./logs ./media ./static
```

### Database issues
```bash
# Reset database
docker-compose down -v
docker-compose up -d
docker-compose exec backend python manage.py migrate
```

## Development Mode

For development with hot-reload:

1. **Backend:**
   ```bash
   # Mount source code as volume
   docker-compose run --service-ports -v $(pwd):/app backend
   ```

2. **Frontend:**
   ```bash
   # Run Vite dev server locally
   cd ui
   npm run dev
   ```

## Health Checks

Monitor container health:
```bash
docker-compose ps
docker stats
```

## Updating

To update the application:
```bash
git pull
docker-compose down
docker-compose up -d --build
```
