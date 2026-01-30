# SWIM Docker Deployment Guide

## Quick Start

### Development Deployment (SQLite)
```bash
# 1. Copy environment template
cp .env.example .env

# 2. Optional: Configure LDAP authentication
cp .env.ldap.example .env.ldap
nano .env.ldap

# 3. Edit .env with your settings
nano .env

# 4. Deploy
./deploy.sh
```

### Production Deployment (PostgreSQL + Redis)
```bash
# 1. Set up environment
cp .env.example .env
nano .env  # Update SECRET_KEY, ALLOWED_HOSTS, DB credentials

# 2. Optional: Configure LDAP
cp .env.ldap.example .env.ldap
nano .env.ldap

# 3. Deploy with production config
./deploy.sh --prod

# 3. Create admin user
docker-compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser
```

## Configuration Files

### docker-compose.yml (Development)
- SQLite database
- Django dev server
- Single container setup
- Hot reload enabled

### docker-compose.prod.yml (Production)
- PostgreSQL database
- Gunicorn WSGI server
- Redis for caching/async tasks
- Celery workers for IOS upgrades
- Nginx reverse proxy
- Health checks and auto-restart

## Environment Variables

Required variables in `.env`:

```bash
# Security
SECRET_KEY=your-secret-key-here
DEBUG=False
ALLOWED_HOSTS=*

# Database (Production)
DB_USER=swimuser
DB_PASSWORD=strong-password-here

# Network Device Defaults
GLOBAL_DEVICE_USERNAME=admin
GLOBAL_DEVICE_PASSWORD=cisco
GLOBAL_DEVICE_SECRET=cisco
```

**LDAP Configuration (Optional):**

Create `.env.ldap` for Active Directory/OpenLDAP integration:

```bash
# Copy LDAP template
cp .env.ldap.example .env.ldap

# Edit with your LDAP settings
LDAP_SERVER_URI=ldaps://ad.company.com:636
LDAP_BIND_DN=CN=svc_swim,OU=Service Accounts,DC=company,DC=com
LDAP_BIND_PASSWORD=ldap-password
LDAP_USER_SEARCH_BASE=OU=Users,DC=company,DC=com
```

See `.env.ldap.example` for complete configuration options and examples.

## Docker Commands

### Build and Start
```bash
# Development
docker-compose up -d

# Production
docker-compose -f docker-compose.prod.yml up -d --build

# Rebuild images
./deploy.sh --rebuild
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f celery-worker
```

### Access Containers
```bash
# Backend shell
docker-compose exec backend bash

# Django shell
docker-compose exec backend python manage.py shell

# Database shell (production)
docker-compose -f docker-compose.prod.yml exec db psql -U swimuser -d swimdb
```

### Stop and Clean
```bash
# Stop containers
docker-compose down

# Stop and remove volumes (WARNING: deletes data)
docker-compose down -v

# Clean everything
docker-compose down -v --rmi all
```

## Network Architecture

```
Internet → [Nginx Frontend :80] → [Backend :8000]
                                      ↓
                              [PostgreSQL :5432]
                                      ↓
                              [Redis :6379]
                                      ↓
                              [Celery Workers]
```

## Port Mapping

| Service  | Internal | External | Purpose                |
|----------|----------|----------|------------------------|
| Frontend | 80       | 80       | Web UI (Nginx)        |
| Backend  | 8000     | 8000     | Django API/Admin      |
| Database | 5432     | -        | PostgreSQL (internal) |
| Redis    | 6379     | -        | Cache/Tasks (internal)|

## Persistent Data

### Development Volumes
- `./db.sqlite3` - Database
- `./logs` - Application logs
- `./media` - Uploaded files
- `./static` - Static assets

### Production Volumes
- `postgres-data` - Database
- `redis-data` - Redis persistence
- `./logs` - Application logs
- `./media` - Uploaded IOS images
- `static-data` - Collected static files

## Health Checks

Both backend and frontend have built-in health checks:
- **Backend**: HTTP GET to `/api/`
- **Frontend**: wget to nginx root

View health status:
```bash
docker ps  # Shows health status in STATUS column
docker inspect swim-backend | grep -A5 Health
```

## Troubleshooting

### Backend won't start
```bash
# Check logs
docker-compose logs backend

# Common issues:
# - Missing SECRET_KEY in .env
# - Database connection failed
# - Port 8000 already in use
```

### Frontend 502 Bad Gateway
```bash
# Backend not ready yet - wait a few seconds
docker-compose ps  # Check backend health

# If still failing:
docker-compose restart backend
```

### Database migration errors
```bash
# Run migrations manually
docker-compose exec backend python manage.py migrate

# Reset database (WARNING: deletes all data)
docker-compose down -v
docker-compose up -d
```

### Permission errors on logs/media
```bash
# Fix permissions
sudo chown -R 1000:1000 logs/ media/ static/
```

## Production Checklist

- [ ] Set strong SECRET_KEY
- [ ] Set DEBUG=False
- [ ] Configure ALLOWED_HOSTS
- [ ] Set database passwords
- [ ] Enable HTTPS/SSL
- [ ] Configure backup strategy
- [ ] Set up monitoring
- [ ] Configure LDAP (if needed)
- [ ] Review security settings
- [ ] Test failover procedures

## Backup and Restore

### Backup (Production)
```bash
# Database backup
docker-compose -f docker-compose.prod.yml exec db pg_dump -U swimuser swimdb > backup.sql

# Files backup
tar -czf swim-backup-$(date +%Y%m%d).tar.gz logs/ media/
```

### Restore
```bash
# Database restore
cat backup.sql | docker-compose -f docker-compose.prod.yml exec -T db psql -U swimuser -d swimdb

# Files restore
tar -xzf swim-backup-20260130.tar.gz
```

## Scaling

### Increase Celery Workers
```bash
# Edit docker-compose.prod.yml
celery-worker:
  deploy:
    replicas: 4  # Run 4 worker instances
```

### Add Load Balancer
Use nginx or HAProxy in front of multiple frontend containers.

## Monitoring

View container stats:
```bash
docker stats

# Specific container
docker stats swim-backend
```

## Support

For issues:
1. Check logs: `docker-compose logs`
2. Verify .env configuration
3. Check network connectivity to devices
4. Verify pyATS/Genie can reach Cisco devices
