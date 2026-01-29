#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'swim_backend.settings')
django.setup()

from django.contrib.auth.models import User
from swim_backend.core.models import APIToken

# Create a test token directly
user = User.objects.get(username='admin')
token = APIToken.objects.create(
    user=user,
    description='Test Token',
    write_enabled=True,
    allowed_ips='192.168.1.100'
)

print(f"✓ Token created successfully!")
print(f"  ID: {token.id}")
print(f"  Key: {token.key}")
print(f"  Preview: {token.key[:8]}...")
print(f"  User: {token.user.username}")
print(f"  Description: {token.description}")
print(f"  Write Enabled: {token.write_enabled}")
