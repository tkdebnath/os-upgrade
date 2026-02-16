from unicon.eal.dialogs import Dialog, Statement
from .base import BaseActivationStrategy
from .registry import ActivationStrategyRegistry


# Disabled for future implementation
# @ActivationStrategyRegistry.register
class Catalyst9500ActivationStrategy(BaseActivationStrategy):
    supported_models = ["Catalyst 9500"]
    supported_platforms = ["iosxe"]

    def execute(self, genie_device):
        return "failed", "Not implemented"
