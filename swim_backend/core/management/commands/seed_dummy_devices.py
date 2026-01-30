from django.core.management.base import BaseCommand
from swim_backend.devices.models import Device, DeviceModel, Site
import random

class Command(BaseCommand):
    help = 'Seeds C9300-48UXM-A devices for testing'

    def handle(self, *args, **options):
        # Create Model
        model, _ = DeviceModel.objects.get_or_create(
            name='C9300-48UXM-A',
            defaults={'vendor': 'Cisco'} 
        )
        self.stdout.write(f"Using Model: {model.name}")

        site_names = ['New York', 'London', 'Tokyo', 'San Francisco', 'Paris']
        
        for i in range(1, 11):
            site_name = random.choice(site_names)
            site, _ = Site.objects.get_or_create(name=site_name, defaults={'address': f"100 {site_name} Ave"})
            
            hostname = f"C9300-48UXM-{site_name[:3].upper()}-{i}"
            ip = f"10.{random.randint(1,255)}.{random.randint(1,255)}.{random.randint(1,254)}"
            
            device, created = Device.objects.get_or_create(
                hostname=hostname,
                defaults={
                    'ip_address': ip,
                    'site': site,
                    'platform': 'IOS-XE',
                    'model': model,  # Pass the instance, not the string name
                    'version': '16.12.1', # Old version to show non-compliant potentially
                    'reachability': 'Reachable',
                    'last_sync_status': 'Completed'
                }
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f"Created {hostname} ({ip}) in {site}"))
            else:
                self.stdout.write(f"Skipped {hostname} (exists)")
