"""
Constants package for the Compliance Engine backend.

This package provides:
- MSG: User-facing messages that require translation
- INTERNAL: Internal constants (logs, diagnostics) that stay in English
"""

from .user_messages import MSG
from .internal import INTERNAL

__all__ = ['MSG', 'INTERNAL']
