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
    pip install -e .

# Create necessary directories
RUN mkdir -p logs media static

# Expose port
EXPOSE 8000

# Collect static files and run migrations on startup
CMD python manage.py collectstatic --noinput && \
    python manage.py migrate --noinput && \
    python manage.py runserver 0.0.0.0:8000
