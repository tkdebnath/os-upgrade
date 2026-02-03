# HTTPS Setup

## Current Setup

Already configured with self-signed cert:
- HTTP: `http://your-ip/`
- HTTPS: `https://your-ip/`

Cert location: `ssl/cert.pem` and `ssl/key.pem`

## Self-Signed Cert (Development)

Browser will complain about untrusted cert. This is normal.

Click through the warning:
- Chrome: "Advanced" → "Proceed"
- Firefox: "Advanced" → "Accept Risk"

### Regenerate Cert

```bash
./generate-ssl.sh
```

Or manually:
```bash
cd ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout key.pem -out cert.pem \
    -subj "/CN=yourdomain.com" \
    -addext "subjectAltName=DNS:yourdomain.com,IP:YOUR_IP"
chmod 644 *.pem
cd ..
docker compose restart frontend
```

## Production (Let's Encrypt)

Free trusted certs from Let's Encrypt:

```bash
# Stop app
docker compose down

# Install certbot
sudo apt install certbot

# Get cert (port 80 must be free)
sudo certbot certonly --standalone -d yourdomain.com

# Copy to ssl dir
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ssl/key.pem
sudo chown $(whoami):$(whoami) ssl/*.pem
chmod 644 ssl/*.pem

# Restart
docker compose up -d

# Auto-renewal cron
sudo crontab -e
# Add: 0 3 * * * certbot renew --quiet && cp /etc/letsencrypt/live/yourdomain.com/*.pem /path/to/swim/ssl/ && docker compose -f /path/to/swim/docker-compose.prod.yml restart frontend
```

## Force HTTPS Only

Edit `ui/nginx.conf` to redirect HTTP to HTTPS:

```nginx
server {
    listen 80;
    return 301 https://$host$request_uri;
}
```

Then restart:
```bash
docker compose restart frontend
```

## Custom Certificate

Got your own cert? Replace these files:
- `ssl/cert.pem` - Full chain certificate
- `ssl/key.pem` - Private key

Make sure they're readable:
```bash
chmod 644 ssl/*.pem
docker compose restart frontend
```

## Troubleshooting

**HTTPS not working:**
- Check cert files exist: `ls -la ssl/`
- Check nginx logs: `docker compose logs frontend`
- Verify port 443 is open: `netstat -tlnp | grep 443`

**Browser still shows warning with Let's Encrypt:**
- Make sure you copied fullchain.pem, not just cert.pem
- Check cert expiry: `openssl x509 -in ssl/cert.pem -noout -dates`
- Restart browser after updating cert
