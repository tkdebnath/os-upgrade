"""
Activation Strategy Registry

This module provides a plugin-based architecture for device-specific activation logic.
Each device model/family can have its own activation strategy.
"""

from .base import BaseActivationStrategy
from .registry import ActivationStrategyRegistry

# Import strategies to register them
from .catalyst9300_strategy import Catalyst9300ActivationStrategy
from .catalyst9500_strategy import Catalyst9500ActivationStrategy
from .nexus_strategy import NexusActivationStrategy
from .default_strategy import DefaultActivationStrategy
from .test_lab_switch import LabVirtualDeviceStrategy

__all__ = [
    'BaseActivationStrategy', 
    'ActivationStrategyRegistry',
    'Catalyst9300ActivationStrategy',
    'Catalyst9500ActivationStrategy',
    'NexusActivationStrategy',
    'DefaultActivationStrategy',
    'LabVirtualDeviceStrategy',
]
