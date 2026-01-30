#!/bin/bash
# Deployment script for SWIM application

set -e

echo "🚀 SWIM Deployment Script"
echo "=========================="

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Copying from .env.example..."
    cp .env.example .env
    echo "✅ Created .env file. Please update it with your settings before deploying."
    exit 1
fi

# Parse command line arguments
COMPOSE_FILE="docker-compose.yml"
BUILD_FLAG=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --prod|--production)
            COMPOSE_FILE="docker-compose.prod.yml"
            echo "📦 Using production configuration"
            shift
            ;;
        --rebuild)
            BUILD_FLAG="--build"
            echo "🔨 Will rebuild images"
            shift
            ;;
        --help)
            echo "Usage: ./deploy.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --prod, --production    Use production docker-compose (PostgreSQL + Redis)"
            echo "  --rebuild               Rebuild Docker images"
            echo "  --help                  Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./deploy.sh                    # Development deployment"
            echo "  ./deploy.sh --prod             # Production deployment"
            echo "  ./deploy.sh --prod --rebuild   # Rebuild and deploy production"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Stop any running containers
echo "🛑 Stopping existing containers..."
docker-compose -f $COMPOSE_FILE down

# Build and start containers
echo "🏗️  Building and starting containers..."
docker-compose -f $COMPOSE_FILE up -d $BUILD_FLAG

# Wait for backend to be healthy
echo "⏳ Waiting for backend to be ready..."
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if docker-compose -f $COMPOSE_FILE exec -T backend python -c "import requests; requests.get('http://localhost:8000/api/', timeout=5)" 2>/dev/null; then
        echo "✅ Backend is ready!"
        break
    fi
    attempt=$((attempt + 1))
    echo "   Attempt $attempt/$max_attempts..."
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo "❌ Backend failed to start. Check logs:"
    echo "   docker-compose -f $COMPOSE_FILE logs backend"
    exit 1
fi

# Create superuser if needed (only in dev)
if [ "$COMPOSE_FILE" = "docker-compose.yml" ]; then
    echo "👤 Checking for superuser..."
    docker-compose -f $COMPOSE_FILE exec -T backend python manage.py shell -c "
from django.contrib.auth import get_user_model;
User = get_user_model();
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@swim.local', 'admin');
    print('✅ Created superuser: admin/admin')
else:
    print('✅ Superuser already exists')
" 2>/dev/null || echo "⚠️  Could not check/create superuser"
fi

# Show running containers
echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Container Status:"
docker-compose -f $COMPOSE_FILE ps

echo ""
echo "🌐 Access Points:"
echo "   Frontend: http://localhost:${FRONTEND_PORT:-80}"
echo "   Backend:  http://localhost:8000"
echo "   Admin:    http://localhost:8000/admin"
echo ""
echo "📝 Useful Commands:"
echo "   View logs:    docker-compose -f $COMPOSE_FILE logs -f"
echo "   Stop:         docker-compose -f $COMPOSE_FILE down"
echo "   Restart:      docker-compose -f $COMPOSE_FILE restart"
echo "   Shell:        docker-compose -f $COMPOSE_FILE exec backend bash"
echo ""
