# Backend Dockerfile
FROM python:3.13-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libldap2-dev \
    libsasl2-dev \
    libssl-dev \
    iputils-ping \
    && rm -rf /var/lib/apt/lists/*

# Set work directory
WORKDIR /app

# Copy project files
COPY pyproject.toml ./
COPY swim_backend ./swim_backend
COPY manage.py ./
COPY main.py ./

# Install Python dependencies
RUN pip install --upgrade pip && \
    pip install -e . && \
    pip install gunicorn whitenoise

# Create necessary directories
RUN mkdir -p logs media static

# Create non-root user for security
RUN useradd -m -u 1000 swimuser && \
    chown -R swimuser:swimuser /app

# Switch to non-root user
USER swimuser

# Expose port
EXPOSE 8000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/api/core/dashboard/stats/', timeout=5)"

# Collect static files and run migrations on startup
CMD python manage.py collectstatic --noinput && \
    python manage.py migrate --noinput && \
    gunicorn swim_backend.wsgi:application \
        --bind 0.0.0.0:8000 \
        --workers 4 \
        --threads 2 \
        --timeout 120 \
        --access-logfile - \
        --error-logfile - \
        --log-level info
