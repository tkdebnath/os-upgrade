"""
Readiness Strategy Registry

This module provides a plugin-based architecture for device-specific readiness checks.
Each device model/family can have its own readiness check strategy.
"""

from .base import BaseReadinessStrategy
from .registry import ReadinessStrategyRegistry

# Import strategies to register them
from .catalyst9300_strategy import Catalyst9300ReadinessStrategy
from .lab_device_strategy import LabDeviceReadinessStrategy
from .default_strategy import DefaultReadinessStrategy

__all__ = ["BaseReadinessStrategy", "ReadinessStrategyRegistry"]
