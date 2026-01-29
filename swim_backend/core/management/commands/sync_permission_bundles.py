from django.core.management.base import BaseCommand
from swim_backend.core.rbac_models import PermissionBundle


class Command(BaseCommand):
    help = 'Sync all permission bundles to their assigned groups and users'

    def handle(self, *args, **options):
        bundles = PermissionBundle.objects.filter(enabled=True)
        
        for bundle in bundles:
            self.stdout.write(f"Syncing bundle: {bundle.name}")
            
            # Sync to groups
            bundle.sync_to_groups()
            group_count = bundle.groups.count()
            self.stdout.write(f"  - Synced to {group_count} groups")
            
            # Sync to users
            bundle.sync_to_users()
            user_count = bundle.users.count()
            self.stdout.write(f"  - Synced to {user_count} users")
            
            # Show what permissions were granted
            perms = bundle.get_django_permissions()
            self.stdout.write(f"  - Granted {len(perms)} permissions")
            
        self.stdout.write(self.style.SUCCESS(f"\nSuccessfully synced {bundles.count()} permission bundles"))
