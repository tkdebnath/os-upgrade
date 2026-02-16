from .base import BaseReadinessStrategy
from .registry import ReadinessStrategyRegistry


# Disabled for future implementation
# @ReadinessStrategyRegistry.register
class Catalyst9500ReadinessStrategy(BaseReadinessStrategy):
    supported_models = ["Catalyst 9500"]
    supported_platforms = ["iosxe"]

    def execute(self, dev):
        return False, {"error": "Not implemented"}
