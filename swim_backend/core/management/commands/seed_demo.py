from django.core.management.base import BaseCommand
from swim_backend.devices.models import Device, DeviceModel, Site
from swim_backend.images.models import FileServer

class Command(BaseCommand):
    help = 'Seeds test devices for distribution testing'

    def handle(self, *args, **options):
        site, _ = Site.objects.get_or_create(name='Test-Lab')
        
        # Create model with specific Size/MD5
        model, _ = DeviceModel.objects.get_or_create(name='C9300-Test')
        model.golden_image_version = '17.9.4a'
        model.golden_image_file = 'cat9k_iosxe.17.09.04a.SPA.bin'
        model.golden_image_size = 450 * 1024 * 1024
        model.golden_image_md5 = '5d41402abc4b2a76b9719d911017c592'
        
        fs, _ = FileServer.objects.get_or_create(
            name='Test-Server',
            defaults={
                'protocol': 'https',
                'address': 'repo.test.local',
                'port': 443,
                'base_path': '/software/'
            }
        )
        model.default_file_server = fs
        model.save()
        
        devices = [
            {'hostname': 'Demo-Match-1', 'ip': '10.10.10.1'},
            {'hostname': 'Demo-Match-2', 'ip': '10.10.10.2'},
            {'hostname': 'Demo-Missing-1', 'ip': '10.10.10.3'},
            {'hostname': 'Demo-SizeMismatch-1', 'ip': '10.10.10.4'},
            {'hostname': 'Demo-MD5Mismatch-1', 'ip': '10.10.10.5'},
        ]
        
        for d in devices:
            Device.objects.update_or_create(
                hostname=d['hostname'],
                defaults={
                    'ip_address': d['ip'],
                    'site': site,
                    'model': model,
                    'family': 'Switch',
                    'reachability': 'Reachable',
                    'version': '16.12.5' # Older version to justify upgrade
                }
            )
            
        self.stdout.write(self.style.SUCCESS(f"Seeded {len(devices)} demo devices."))
