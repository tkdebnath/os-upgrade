#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'swim_backend.settings')
django.setup()

from swim_backend.devices.models import DeviceModel

count = DeviceModel.objects.count()
print(f"Total Device Models: {count}")

if count > 0:
    print("\nModels in database:")
    for model in DeviceModel.objects.all():
        print(f"  - {model.name} (Vendor: {model.vendor})")
else:
    print("\n⚠️  No device models found in the database!")
    print("This is why the models page appears blank.")
