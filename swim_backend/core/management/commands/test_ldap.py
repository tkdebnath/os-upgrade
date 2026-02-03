from django.core.management.base import BaseCommand
from django.conf import settings
import ldap


class Command(BaseCommand):
    help = 'Test LDAP connection and configuration'

    def handle(self, *args, **options):
        if not settings.LDAP_ENABLED:
            self.stdout.write(self.style.ERROR('LDAP is not enabled'))
            return

        self.stdout.write(self.style.SUCCESS('=== LDAP Configuration ==='))
        self.stdout.write(f'Server URI: {settings.AUTH_LDAP_SERVER_URI}')
        self.stdout.write(f'Bind DN: {settings.AUTH_LDAP_BIND_DN}')
        self.stdout.write(f'User Search Base: {settings.AUTH_LDAP_USER_SEARCH.base_dn}')
        self.stdout.write(f'User Search Filter: {settings.AUTH_LDAP_USER_SEARCH.filterstr}')
        
        if hasattr(settings, 'AUTH_LDAP_GROUP_SEARCH'):
            self.stdout.write(f'Group Search Base: {settings.AUTH_LDAP_GROUP_SEARCH.base_dn}')
        
        self.stdout.write('\n=== Testing Connection ===')
        
        try:
            conn = ldap.initialize(settings.AUTH_LDAP_SERVER_URI)
            conn.set_option(ldap.OPT_REFERRALS, 0)
            conn.set_option(ldap.OPT_NETWORK_TIMEOUT, 10.0)
            
            self.stdout.write('Attempting bind...')
            conn.simple_bind_s(settings.AUTH_LDAP_BIND_DN, settings.AUTH_LDAP_BIND_PASSWORD)
            self.stdout.write(self.style.SUCCESS('✓ Bind successful'))
            
            self.stdout.write('\n=== Searching for Users ===')
            search_base = settings.AUTH_LDAP_USER_SEARCH.base_dn
            search_filter = '(objectClass=person)'
            
            try:
                result = conn.search_s(search_base, ldap.SCOPE_SUBTREE, search_filter, ['dn', 'sAMAccountName', 'cn'])
                self.stdout.write(f'Found {len(result)} users in {search_base}')
                
                if result:
                    self.stdout.write('\nFirst 5 users:')
                    for dn, attrs in result[:5]:
                        sam = attrs.get('sAMAccountName', [b''])[0].decode('utf-8')
                        cn = attrs.get('cn', [b''])[0].decode('utf-8')
                        self.stdout.write(f'  - DN: {dn}')
                        self.stdout.write(f'    sAMAccountName: {sam}')
                        self.stdout.write(f'    CN: {cn}')
                else:
                    self.stdout.write(self.style.WARNING('⚠ No users found in this search base!'))
                    self.stdout.write('\nTrying to find where users actually are...')
                    
                    # Search from root
                    root_dn = ','.join(search_base.split(',')[-2:])  # dc=ra-int,dc=com
                    self.stdout.write(f'Searching from root: {root_dn}')
                    result = conn.search_s(root_dn, ldap.SCOPE_SUBTREE, '(sAMAccountName=*)', ['dn', 'sAMAccountName'])
                    
                    if result:
                        self.stdout.write(f'Found {len(result)} users from root')
                        self.stdout.write('\nFirst 5 users:')
                        for dn, attrs in result[:5]:
                            sam = attrs.get('sAMAccountName', [b''])[0].decode('utf-8')
                            self.stdout.write(f'  - {sam}: {dn}')
                        
                        # Find common OUs
                        ous = set()
                        for dn, _ in result:
                            parts = dn.split(',')
                            if len(parts) > 2:
                                ou_part = ','.join(parts[1:])
                                ous.add(ou_part)
                        
                        if ous:
                            self.stdout.write('\nUsers found in these OUs:')
                            for ou in sorted(ous)[:10]:
                                self.stdout.write(f'  - {ou}')
                    
            except ldap.NO_SUCH_OBJECT:
                self.stdout.write(self.style.ERROR(f'✗ Search base "{search_base}" does not exist!'))
                self.stdout.write('\nLooking for organizational units...')
                
                root_dn = ','.join(search_base.split(',')[-2:])
                result = conn.search_s(root_dn, ldap.SCOPE_SUBTREE, '(objectClass=organizationalUnit)', ['dn'])
                self.stdout.write(f'\nFound {len(result)} organizational units:')
                for dn, _ in result[:15]:
                    self.stdout.write(f'  - {dn}')
            
            conn.unbind_s()
            
        except ldap.INVALID_CREDENTIALS:
            self.stdout.write(self.style.ERROR('✗ Invalid bind credentials'))
        except ldap.SERVER_DOWN:
            self.stdout.write(self.style.ERROR(f'✗ Cannot reach LDAP server at {settings.AUTH_LDAP_SERVER_URI}'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'✗ Error: {e}'))
            import traceback
            traceback.print_exc()
