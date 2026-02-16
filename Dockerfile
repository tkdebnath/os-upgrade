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
    openssh-client \
    && rm -rf /var/lib/apt/lists/*

# Configure SSH to support older Cisco devices
RUN mkdir -p /root/.ssh && \
    cat > /root/.ssh/config << 'EOF'
Host *
KexAlgorithms diffie-hellman-group-exchange-sha1,diffie-hellman-group14-sha1,diffie-hellman-group1-sha1
Ciphers aes256-ctr,aes192-ctr,aes128-ctr
HostKeyAlgorithms +ssh-rsa
EOF

# Set work directory
WORKDIR /app

# Copy project files
COPY pyproject.toml ./
COPY swim_backend ./swim_backend
COPY manage.py ./

# Install Python dependencies
RUN pip install --upgrade pip && \
    pip install -e . && \
    pip install gunicorn whitenoise

# Create necessary directories
RUN mkdir -p logs media static && chmod 777 logs media static

# Expose port
EXPOSE 8000

# Healthcheck - just check if gunicorn is responding
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/', timeout=5)" || exit 1

# Copy entrypoint
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

# Collect static files and run migrations on startup via entrypoint
ENTRYPOINT ["./entrypoint.sh"]

