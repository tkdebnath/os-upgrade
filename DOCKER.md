# Docker Setup

## Quick Start

**Dev (SQLite):**
```bash
cp .env.example .env
nano .env
./deploy.sh
```

**Prod (Postgres + Redis):**
```bash
cp .env.example .env
nano .env  # Set SECRET_KEY, DB creds, etc.
./deploy.sh --prod
docker compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser
```

## Compose Files

**docker-compose.yml** - Dev mode
- SQLite db
- Django dev server
- Single container

**docker-compose.prod.yml** - Production
- PostgreSQL + Redis
- Gunicorn + Nginx
- Celery workers
- Health checks

## Environment Setup

Required in `.env`:
```bash
SECRET_KEY=changeme
DEBUG=False
ALLOWED_HOSTS=*

# Prod only
DB_USER=swimuser
DB_PASSWORD=strongpass

# Device defaults
GLOBAL_DEVICE_USERNAME=admin
GLOBAL_DEVICE_PASSWORD=cisco
GLOBAL_DEVICE_SECRET=cisco
```

**LDAP (Optional):**
```bash
cp .env.ldap.example .env.ldap
nano .env.ldap
# Fill in your AD/LDAP details
```

## Useful Commands

```bash
# Build and start
docker compose up -d
docker compose -f docker-compose.prod.yml up -d --build

# View logs
docker compose logs -f backend
docker compose logs -f celery-worker

# Shell access
docker compose exec backend bash
docker compose exec backend python manage.py shell

# Restart services
docker compose restart backend
docker compose restart celery-worker

# Stop everything
docker compose down
docker compose -f docker-compose.prod.yml down

# Clean rebuild
docker compose down -v
docker compose up -d --build
```

## Health Checks

Prod setup includes health monitoring:
```bash
docker compose -f docker-compose.prod.yml ps
```

Services auto-restart on failure.

## Backup Database (Prod)

```bash
# Backup
docker compose exec db pg_dump -U swimuser swim > backup.sql

# Restore
cat backup.sql | docker compose exec -T db psql -U swimuser swim
```

## Troubleshooting

**Containers keep restarting:**
- Check logs: `docker compose logs backend`
- Verify DB creds in .env
- Make sure ports 80/443/5432/6379 aren't in use

**Can't connect to devices:**
- Check GLOBAL_DEVICE_* credentials
- Verify device credentials in admin
- Test SSH access from backend container

**Celery jobs not running:**
- Check worker: `docker compose logs celery-worker`
- Restart: `docker compose restart celery-worker celery-beat`
- Verify Redis is up: `docker compose ps redis`

**Database permission errors:**
- Make sure DB_USER/DB_PASSWORD match in .env
- Check PostgreSQL logs: `docker compose logs db`
