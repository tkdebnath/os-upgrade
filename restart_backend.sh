#!/bin/bash
cd /home/tdebnath/swim
docker compose -f docker-compose.yml restart backend
sleep 10
echo "Backend restarted. Testing LDAP..."
docker compose -f docker-compose.yml exec backend python manage.py test_ldap
