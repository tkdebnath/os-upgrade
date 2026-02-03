#!/bin/bash

set -e

echo "Deploying SWIM..."

if [ ! -f .env ]; then
    echo ".env missing, copying from example"
    cp .env.example .env
    echo "Update .env before deploying"
    exit 1
fi

COMPOSE_FILE="docker-compose.yml"
BUILD_FLAG=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --prod|--production)
            COMPOSE_FILE="docker-compose.prod.yml"
            echo "Using prod config"
            shift
            ;;
        --rebuild)
            BUILD_FLAG="--build"
            echo "Rebuilding images"
            shift
            ;;
        --help)
            echo "Usage: ./deploy.sh [--prod] [--rebuild]"
            exit 0
            ;;
        *)
            echo "Unknown: $1"
            exit 1
            ;;
    esac
done

echo "Stopping containers..."
docker compose -f $COMPOSE_FILE down

echo "Starting..."
docker compose -f $COMPOSE_FILE up -d $BUILD_FLAG

echo "Waiting for backend..."
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if docker compose -f $COMPOSE_FILE exec -T backend python -c "import requests; requests.get('http://localhost:8000/api/', timeout=5)" 2>/dev/null; then
        echo "Backend ready"
        break
    fi
    attempt=$((attempt + 1))
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo "Backend failed to start, check logs:"
    echo "  docker compose -f $COMPOSE_FILE logs backend"
    exit 1
fi

# Auto-create admin user in dev
if [ "$COMPOSE_FILE" = "docker-compose.yml" ]; then
    docker compose -f $COMPOSE_FILE exec -T backend python manage.py shell -c "
from django.contrib.auth import get_user_model;
User = get_user_model();
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@swim.local', 'admin');
    print('Created admin user: admin/admin')
" 2>/dev/null || true
fi

echo ""
echo "Deployed!"
docker compose -f $COMPOSE_FILE ps
echo ""
echo "Access:"
echo "  UI:    http://localhost"
echo "  Admin: http://localhost:8000/admin"
echo ""
