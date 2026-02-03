from django.apps import AppConfig

class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'swim_backend.core'

    def ready(self):
        # Import activity logger signals
        import swim_backend.core.activity_logger
        
        # Import LDAP signals if LDAP is enabled (always import - signals need to be registered)
        from django.conf import settings
        if hasattr(settings, 'LDAP_ENABLED') and settings.LDAP_ENABLED:
            try:
                import swim_backend.ldap_signals
                import logging
                logger = logging.getLogger(__name__)
                logger.info("LDAP signals imported successfully in CoreConfig.ready()")
            except ImportError as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Failed to import LDAP signals: {e}")
        
        # Avoid running scheduler during migrations or if autoreload mimics double run
        import os
        if os.environ.get('RUN_MAIN', None) != 'true':
            # This check helps avoid running twice in dev server reloader
            # But we still want signals registered above
            return
            
        from .scheduler import start_scheduler
        start_scheduler()
