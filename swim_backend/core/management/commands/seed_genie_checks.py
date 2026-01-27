from django.core.management.base import BaseCommand
from swim_backend.core.models import ValidationCheck

class Command(BaseCommand):
    help = 'Seeds Genie learn modules and categorizes checks'

    def handle(self, *args, **options):
        # 1. Seed Genie Learn Modules
        genie_modules = [
            'interface', 'lag', 'vlan', 'vrf', 'platform', 'arp', 'dot1x', 'ntp'
        ]
        
        for module in genie_modules:
            ValidationCheck.objects.update_or_create(
                name=f"Genie Learn {module.capitalize()}",
                defaults={
                    'category': 'genie',
                    'command': f"learn {module}",
                    'description': f"Learns and validates {module} state"
                }
            )
            
        # 2. Categorize existing non-genie checks as 'script'
        # Assume anything not 'genie' is 'script' for now if category is missing or 'standard'
        # But let's be explicit about the standard ones we added before if they exist
        
        standard_scripts = [
            "Spanning Tree Summary", "CDP Neighbors", "Interface Check", 
            "Fabric Device Upgrade", "Config Register", "Startup Config"
        ]
        
        ValidationCheck.objects.filter(name__in=standard_scripts).update(category='script')
            
        self.stdout.write(self.style.SUCCESS(f"Seeded {len(genie_modules)} Genie modules and updated categories."))
