from django.apps import AppConfig

class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'swim_backend.core'

    def ready(self):
        # Import activity logger signals
        import swim_backend.core.activity_logger
        
        # We need to avoid running this during migrations or if autoreload mimics double run
        import os
        if os.environ.get('RUN_MAIN', None) != 'true':
            # This check helps avoid running twice in dev server reloader
            return
            
        from .scheduler import start_scheduler
        start_scheduler()
