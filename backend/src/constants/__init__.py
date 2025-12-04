"""
Constants package for the Compliance Engine backend.

This package contains centralized constants for various aspects of the application,
including string constants for internationalization.
"""

from .strings import STRINGS, t_success, t_error, t_healthy, t_unhealthy

__all__ = ['STRINGS', 't_success', 't_error', 't_healthy', 't_unhealthy']