from unicon.eal.dialogs import Dialog, Statement
from .base import BaseActivationStrategy
from .registry import ActivationStrategyRegistry


# Disabled for future implementation
# @ActivationStrategyRegistry.register
class NexusActivationStrategy(BaseActivationStrategy):
    
    supported_models = [
    ]
    
    supported_platforms = ['xxxxx']
    
    def execute(self, genie_device):
        return 'failed', "Not implemented"
