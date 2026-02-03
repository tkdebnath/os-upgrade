"""
Activation Strategy Registry

This module provides a plugin-based architecture for device-specific activation logic.
Each device model/family can have its own activation strategy.
"""

from .base import BaseActivationStrategy
from .registry import ActivationStrategyRegistry

__all__ = ['BaseActivationStrategy', 'ActivationStrategyRegistry']
