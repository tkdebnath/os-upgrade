from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType
from swim_backend.core.rbac_models import PermissionBundle


class Command(BaseCommand):
    help = 'Create a ReadOnly permission bundle for test user'

    def handle(self, *args, **options):
        # Get or create test user
        test_user, created = User.objects.get_or_create(
            username='test',
            defaults={
                'email': 'test@example.com',
                'is_staff': True,  # Must be staff to access API
                'is_active': True
            }
        )
        
        if created:
            test_user.set_password('test')
            test_user.save()
            self.stdout.write(self.style.SUCCESS(f"Created test user"))
        else:
            # Make sure test user is staff
            if not test_user.is_staff:
                test_user.is_staff = True
                test_user.save()
                self.stdout.write(self.style.SUCCESS(f"Made test user a staff member"))
        
        # Create or get ReadOnly bundle
        bundle, created = PermissionBundle.objects.get_or_create(
            name='ReadOnly',
            defaults={
                'description': 'Read-only access to selected resources',
                'enabled': True,
                'can_view': True,
                'can_add': False,
                'can_change': False,
                'can_delete': False
            }
        )
        
        if created:
            self.stdout.write(self.style.SUCCESS(f"Created ReadOnly bundle"))
        
        # Set object types for common models
        content_types = ContentType.objects.filter(
            app_label__in=['devices', 'images', 'core'],
            model__in=['device', 'devicemodel', 'site', 'region', 
                      'image', 'fileserver', 'job', 'goldenimage', 
                      'validationcheck', 'checkrun', 'workflow']
        )
        
        bundle.object_types.set(content_types)
        self.stdout.write(f"Set {content_types.count()} content types")
        
        # Add test user to bundle
        bundle.users.add(test_user)
        
        # Sync permissions
        bundle.sync_to_users()
        
        # Verify
        perms = test_user.user_permissions.all()
        self.stdout.write(self.style.SUCCESS(
            f"\nSuccessfully configured test user with {perms.count()} permissions"
        ))
        
        self.stdout.write("\nPermissions granted:")
        for perm in perms:
            self.stdout.write(f"  - {perm.content_type.app_label}.{perm.codename}")
