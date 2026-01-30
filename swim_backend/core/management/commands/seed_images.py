from django.core.management.base import BaseCommand
from swim_backend.images.models import Image, FileServer

class Command(BaseCommand):
    help = 'Seeds mock images and file server'

    def handle(self, *args, **options):
        # Create Mock File Server
        server, created = FileServer.objects.get_or_create(
            name='Cisco Software Central (Mock)',
            defaults={
                'protocol': 'https',
                'address': 'software.cisco.com',
                'base_path': '/download/software/',
                'username': 'mock_user',
                'city': 'San Jose'
            }
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f'Created FileServer: {server.name}'))
        else:
             self.stdout.write(f'FileServer already exists: {server.name}')

        # Seed Images
        mock_images = [
            {'filename': 'cat9k_iosxe.17.09.04a.SPA.bin', 'version': '17.9.4a', 'path': '/cat9k/17.9.4a/cat9k_iosxe.17.09.04a.SPA.bin'},
            {'filename': 'cat9k_iosxe.16.12.01.SPA.bin', 'version': '16.12.1', 'path': '/cat9k/16.12.1/cat9k_iosxe.16.12.01.SPA.bin'},
            {'filename': 'isr4400-universalk9.17.03.04a.SPA.bin', 'version': '17.3.4a', 'path': '/isr4k/17.3.4a/isr4400-universalk9.17.03.04a.SPA.bin'},
            {'filename': 'c9800-universalk9.17.09.03.SPA.bin', 'version': '17.9.3', 'path': '/wlc/17.9.3/c9800-universalk9.17.09.03.SPA.bin'},

             {'filename': 'cat9k_iosxe.17.09.04a.Mock.bin', 'version': '17.9.4a (Mock)', 'path': '/cat9k/17.9.4a/cat9k_iosxe.17.09.04a.Mock.bin'},
        ]

        for img_data in mock_images:
            img, created = Image.objects.get_or_create(
                filename=img_data['filename'],
                defaults={
                    'version': img_data['version'],
                    'file_server': server,
                    'is_remote': True,
                    'remote_path': img_data['path'],
                    'size_bytes': 1024 * 1024 * 500 # 500MB Mock
                }
            )
            if created:
                 self.stdout.write(self.style.SUCCESS(f'Created Image: {img.filename}'))
            else:
                 self.stdout.write(f'Image already exists: {img.filename}')
