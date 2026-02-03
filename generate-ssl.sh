#!/bin/bash

set -e

echo "Generating Self-Signed SSL Certificate for SWIM..."

mkdir -p ssl

# Generate certificate
cd ssl

# Check if certificate already exists
if [ -f "cert.pem" ] && [ -f "key.pem" ]; then
    echo "SSL certificates already exist!"
    read -p "Do you want to regenerate them? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Using existing certificates"
        exit 0
    fi
fi

# Get domain/hostname
read -p "Enter domain name or IP address (default: localhost): " DOMAIN
DOMAIN=${DOMAIN:-localhost}

echo "Generating certificate for: $DOMAIN"

# Generate self-signed certificate valid for 365 days
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout key.pem \
    -out cert.pem \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=$DOMAIN" \
    -addext "subjectAltName=DNS:$DOMAIN,DNS:localhost,DNS:127.0.0.1,IP:127.0.0.1"

# Set proper permissions
chmod 644 cert.pem key.pem

cd ..

echo "SSL Certificate generated successfully!"
echo ""
echo "Certificate Details:"
openssl x509 -in ssl/cert.pem -text -noout | grep -E "Subject:|Issuer:|Not Before|Not After|Subject Alternative Name" -A 1
