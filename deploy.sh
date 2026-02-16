#!/bin/bash

set -e

echo "Deploying SWIM..."

# Check for environment files
if [ ! -f "env/app.prod.env" ] && [ ! -f "env/app.env" ]; then
    echo "Error: No environment file found!"
    echo "Please create one of:"
    echo "  - env/app.prod.env (production)"
    echo "  - env/app.env (development)"
    echo ""
    echo "Copy from example:"
    echo "  cp env/app.prod.env.example env/app.prod.env"
    exit 1
fi

COMPOSE_FILE="docker-compose.yml"
BUILD_FLAG=""
COMPOSE_PROJECT="swim"

while [[ $# -gt 0 ]]; do
    case $1 in
        --prod|--production)
            COMPOSE_FILE="docker-compose.yml"
            echo "Using production config"
            shift
            ;;
        --dev|--development)
            COMPOSE_FILE="docker-compose.dev.yml"
            echo "Using dev config"
            shift
            ;;
        --rebuild)
            BUILD_FLAG="--build"
            echo "Rebuilding images"
            shift
            ;;
        --help|-h)
            echo "Usage: ./deploy.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --prod, --production   Use production config (PostgreSQL)"
            echo "  --dev, --development  Use development config (SQLite)"
            echo "  --rebuild             Rebuild Docker images"
            echo "  --help, -h            Show this help message"
            echo ""
            echo "Environment files:"
            echo "  env/app.prod.env - Production settings"
            echo "  env/app.env      - Development settings"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo "Stopping containers..."
docker compose -f $COMPOSE_FILE down

echo "Building and starting containers..."
docker compose -f $COMPOSE_FILE up -d $BUILD_FLAG

echo "Waiting for backend..."
max_attempts=60
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if docker compose -f $COMPOSE_FILE exec -T backend python -c "import requests; requests.get('http://localhost:8000/api/', timeout=5)" 2>/dev/null; then
        echo "Backend ready"
        break
    fi
    attempt=$((attempt + 1))
    echo "Waiting for backend... ($attempt/$max_attempts)"
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo "Backend failed to start, check logs:"
    echo "  docker compose -f $COMPOSE_FILE logs backend"
    exit 1
fi

echo ""
echo "=========================================="
echo "Deployed successfully!"
echo "=========================================="
docker compose -f $COMPOSE_FILE ps
echo ""
echo "Access:"
echo "  UI:    http://localhost"
echo "  Admin: http://localhost:8000/admin"
echo ""
echo "Superuser (if configured):"
echo "  Username: admin (or DJANGO_SUPERUSER_USERNAME)"
echo "  Password: (from DJANGO_SUPERUSER_PASSWORD)"
echo ""
