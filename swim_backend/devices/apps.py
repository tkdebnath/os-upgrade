from django.apps import AppConfig

class DevicesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'swim_backend.devices'

    def ready(self):
        # Import plugins to ensure registration
        import swim_backend.devices.plugins.netbox
