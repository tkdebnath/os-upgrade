# SWIM - Software Image Management

Network device upgrade automation for Cisco gear. Built this to stop babysitting switch upgrades at 2 AM.

## What it does

- Upload IOS images and set golden versions per device model
- Push images to devices via SCP
- Activate new images (handles Cat9K install mode, stack reloads, etc.)
- Schedule upgrades for maintenance windows
- Track everything in a web UI

## Quick Start

### Development

```bash
# Clone and setup
cp env/app.env.example env/app.env
# Edit env/app.env with your settings

# Start containers
docker compose up -d

# Create admin user
docker compose exec backend python manage.py createsuperuser

# Access
http://localhost:3000  # UI
http://localhost:8000/admin  # Django admin
```

### Production

```bash
# Edit prod env
cp env/app.prod.env.example env/app.prod.env

# Deploy
bash deploy.sh --prod

# Runs on ports 80/443 with SSL
```

## How upgrades work

1. **Upload Image** - Add IOS bin files, mark golden for device models
2. **Create Job** - Select devices, workflow kicks off
3. **Readiness Check** - Verifies connectivity, space, etc.
4. **Distribution** - SCPs image to device flash
5. **Activation** - Runs install commands, device reloads

Jobs can run parallel (blast 50 switches at once) or sequential (one by one).

## API for automation

Trigger upgrades from your scripts/Ansible:

```bash
curl -X POST https://swim.example.com/api/upgrade/trigger/ \
  -H "Authorization: Token YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "devices": ["sw1", "sw2", "sw3"],
    "auto_select_image": true,
    "execution_mode": "parallel"
  }'
```

Check [UPGRADE_API.md](UPGRADE_API.md) for details.

## LDAP Integration

Set in `env/app.env`:
```
LDAP_ENABLED=True
LDAP_SERVER_URI=ldap://dc.example.com
LDAP_BIND_DN=cn=swimuser,ou=ServiceAccounts,dc=example,dc=com
LDAP_USER_SEARCH_BASE=ou=Users,dc=example,dc=com
```

Groups auto-create on login. See [README_LDAP.md](README_LDAP.md).

## Device Support

Currently handles:
- **Catalyst 9300** - Install mode, stack reloads
- **ASR1K/9K** - Lab devices (adjust timeout if needed)

To add support for new models, create a strategy in:
`swim_backend/core/services/workflow/activation_strategies/`

Look at `catalyst9k_strategy.py` as an example.

## Tech Stack

- **Backend**: Django + DRF + Celery
- **Frontend**: React + Vite
- **Network**: pyATS/Genie for device automation
- **Database**: PostgreSQL
- **Queue**: Redis

## Common Issues

**Job stuck?**
Check celery worker logs:
```bash
docker compose logs celery-worker
```

**Device unreachable?**
Verify credentials in device settings or Global Credentials.

**Image distribution fails?**
Make sure SCP is enabled on devices and there's enough flash space.

## License

Built for managing Cisco upgrades. Use at your own risk, test in lab first.
