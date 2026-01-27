from django.core.management.base import BaseCommand
from swim_backend.core.models import ValidationCheck

class Command(BaseCommand):
    help = 'Seeds standard activation checks'

    def handle(self, *args, **options):
        checks = [
            {"name": "Spanning Tree Summary Check", "category": "genie", "command": "spanning_tree", "description": "Verifies spanning tree topology stability."},
            {"name": "CDP Neighbors Check", "category": "genie", "command": "cdp_neighbors", "description": "Verifies expected neighbors match."},
            {"name": "Interface Check", "category": "genie", "command": "interface", "description": "Checks interface status and errors."},
            {"name": "Fabric Device Upgrade Check", "category": "script", "command": "check_fabric_ready", "description": "Verifies fabric nodes state."},
            {"name": "Config Register Check", "category": "system", "command": "check_config_register", "description": "Ensures config-register is 0x2102."},
            {"name": "Startup Config Check", "category": "system", "command": "check_startup_config", "description": "Verifies startup-config exists and is valid."},
            {"name": "Ping DNAC", "category": "script", "command": "ping_controller", "description": "Checks connectivity to controller."},
            {"name": "ShowVlanBrief", "category": "genie", "command": "vlan", "description": "Captures VLAN database state."},
        ]
        
        created_count = 0
        for check_data in checks:
            obj, created = ValidationCheck.objects.get_or_create(
                name=check_data['name'],
                defaults={
                    'category': check_data['category'],
                    'command': check_data['command'],
                    'description': check_data['description'],
                    'check_type': 'both'
                }
            )
            if created:
                created_count += 1
                
        self.stdout.write(self.style.SUCCESS(f"Seeded {created_count} validation checks."))
