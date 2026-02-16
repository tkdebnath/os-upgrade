#!/bin/sh
set -e

# Run migrations
echo "Runnning migrations..."
python manage.py migrate --noinput

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput

# Create superuser (custom command)
echo "Creating superuser..."
# Check if the command exists before running to avoid failure loop if removed
if python manage.py help create_superuser > /dev/null 2>&1; then
    python manage.py create_superuser --no-input
else
    echo "create_superuser command not found, skipping."
fi

# Start Gunicorn
echo "Starting Gunicorn..."
exec gunicorn swim_backend.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 4 \
    --threads 2 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile - \
    --log-level info
