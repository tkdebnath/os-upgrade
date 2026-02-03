from unicon.eal.dialogs import Dialog, Statement
from .base import BaseActivationStrategy
from .registry import ActivationStrategyRegistry


# Disabled for future implementation
# @ActivationStrategyRegistry.register
class DefaultActivationStrategy(BaseActivationStrategy):
    supported_platforms = ['xxxxx']
    
    def can_handle(self, device):
        return True
    
    def execute(self, genie_device):
        return 'failed', "Not implemented"
