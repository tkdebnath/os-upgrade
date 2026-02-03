from django.contrib.auth.models import Group
from django.dispatch import receiver
from django_auth_ldap.backend import populate_user
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

logger.info("LDAP signals loaded")


@receiver(populate_user)
def create_permission_groups(sender, user, ldap_user, **kwargs):
    logger.info(f"LDAP user login: {user.username}")
    
    if not hasattr(settings, 'LDAP_PERMISSION_GROUP_NAMES'):
        return
    
    # Ensure user is saved before accessing many-to-many relationships
    if user.pk is None:
        user.save()
    
    try:
        ldap_groups = ldap_user.group_dns if ldap_user else []
    except Exception as e:
        logger.error(f"Error getting LDAP groups: {e}")
        ldap_groups = []
    
    created_groups = []
    added_to_groups = []
    
    for group_name in settings.LDAP_PERMISSION_GROUP_NAMES:
        group, created = Group.objects.get_or_create(name=group_name)
        if created:
            created_groups.append(group_name)
        
        user_is_member = False
        for ldap_group_dn in ldap_groups:
            ldap_group_name = ldap_group_dn.split(',')[0].replace('cn=', '').replace('CN=', '')
            if ldap_group_name.lower() == group_name.lower():
                user_is_member = True
                break
        
        if user_is_member:
            if not user.groups.filter(name=group_name).exists():
                user.groups.add(group)
                added_to_groups.append(group_name)
                logger.info(f"Added {user.username} to {group_name}")
        else:
            if user.groups.filter(name=group_name).exists():
                user.groups.remove(group)
    
    if not added_to_groups:
        logger.warning(f"{user.username} not in any permission groups")
