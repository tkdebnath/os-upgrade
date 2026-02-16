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
        
        # Start the background scheduler for scheduled jobs
        import os
        run_main = os.environ.get('RUN_MAIN', None)
        
        # In dev server with reloader: RUN_MAIN='true' on the reloaded process
        # In production (gunicorn): RUN_MAIN is never set
        # We want to start scheduler in both cases, but avoid double-start in dev
        if run_main == 'true' or run_main is None:
            from .scheduler import start_scheduler
            start_scheduler()
