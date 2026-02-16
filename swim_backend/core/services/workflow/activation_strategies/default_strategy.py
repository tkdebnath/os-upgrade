from unicon.eal.dialogs import Dialog, Statement
from .base import BaseActivationStrategy
from .registry import ActivationStrategyRegistry


# Disabled for future implementation
# @ActivationStrategyRegistry.register
class DefaultActivationStrategy(BaseActivationStrategy):
    supported_platforms = ['xxxxx']
    
    def can_handle(self, device):
        from django.conf import settings
        
        # Enforce supported models check
        supported_models = getattr(settings, "SUPPORTED_DEVICE_MODELS", [])
        
        if supported_models:
            model_name = device.model.name if device.model else None
            # Case-insensitive check
            if model_name:
                return any(m.lower() == model_name.lower() for m in supported_models)
            return False
            
        return True
    
    def execute(self, genie_device):
        return 'failed', "Not implemented"
