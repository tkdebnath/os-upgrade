from django.core.management.base import BaseCommand
from swim_backend.devices.models import Device, Site, DeviceModel
import random

class Command(BaseCommand):
    help = 'Seeds dummy C9300Uxm devices with various software versions'

    def handle(self, *args, **options):
        versions = ['17.9.4a', '16.12.5', '17.6.3', '17.3.4', '17.9.2']
        sites = ['San Jose', 'Bangalore', 'London', 'Sydney']
        
        self.stdout.write("Seeding devices...")
        
        # Pre-create sites and model
        site_objs = {name: Site.objects.get_or_create(name=name)[0] for name in sites}
        model_name = 'C9300Uxm'
        model_obj, _ = DeviceModel.objects.get_or_create(name=model_name)
        
        for i in range(1, 11):
            hostname = f"C9300Uxm-Switch-{i}"
            version = random.choice(versions)
            site_name = random.choice(sites)
            site_obj = site_objs[site_name]
            
            reachability = 'Reachable' if i % 10 != 0 else 'Unreachable' # Make one unreachable
            
            Device.objects.get_or_create(
                hostname=hostname,
                defaults={
                    'ip_address': f"10.10.10.{i}",
                    'platform': 'iosxe', # generic platform type
                    'model': model_obj,   # Specific hardware model object
                    'version': version,
                    'reachability': reachability,
                    'site': site_obj,
                    'username': 'admin',
                    'password': 'password'
                }
            )
            
        self.stdout.write(self.style.SUCCESS(f'Successfully seeded 10 C9300Uxm devices'))
