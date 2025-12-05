"""
Internationalization Helper Functions

This module provides enhanced i18n functionality that integrates with fastapi-babel
and the user message constants to provide:
1. Type-safe translation functions
2. Fallback handling
3. Context-aware translations

Usage:
    from utils.i18n_helpers import t, get_translator
    from constants.user_messages import MSG

    # Basic translation
    message = t(MSG.SUCCESS)

    # Context-aware translation
    translator = get_translator(request)
    message = translator.success()
"""

from typing import Optional, Dict, Any, Callable
from functools import wraps
import structlog
from fastapi import Request
from fastapi_babel import _

from constants.user_messages import MSG

logger = structlog.get_logger(__name__)


class TranslationContext:
    """
    Context-aware translator that provides commonly used translations.
    """

    def __init__(self, request: Optional[Request] = None):
        self.request = request
        self._locale = getattr(request.state, 'locale', 'en') if request else 'en'

    @property
    def locale(self) -> str:
        """Get current locale"""
        return self._locale

    # Common status messages
    def success(self) -> str:
        return t(MSG.STATUS.SUCCESS)

    def error(self) -> str:
        return t(MSG.STATUS.ERROR)

    def healthy(self) -> str:
        return t(MSG.STATUS.HEALTHY)

    def unhealthy(self) -> str:
        return t(MSG.STATUS.UNHEALTHY)

    def operational(self) -> str:
        return t(MSG.STATUS.OPERATIONAL)

    def pending(self) -> str:
        return t(MSG.STATUS.PENDING)

    # Authentication messages
    def auth_failed(self) -> str:
        return t(MSG.AUTH.AUTHENTICATION_FAILED)

    def auth_required(self) -> str:
        return t(MSG.AUTH.AUTHENTICATION_REQUIRED)

    def access_denied(self) -> str:
        return t(MSG.AUTH.ACCESS_DENIED)

    def insufficient_permissions(self) -> str:
        return t(MSG.AUTH.INSUFFICIENT_PERMISSIONS)

    def token_expired(self) -> str:
        return t(MSG.AUTH.TOKEN_EXPIRED)

    def token_invalid(self) -> str:
        return t(MSG.AUTH.TOKEN_INVALID)

    def session_expired(self) -> str:
        return t(MSG.AUTH.SESSION_EXPIRED)

    # Validation messages
    def validation_error(self) -> str:
        return t(MSG.VALIDATION.VALIDATION_ERROR)

    def invalid_input(self) -> str:
        return t(MSG.VALIDATION.INVALID_INPUT)

    def required_field(self) -> str:
        return t(MSG.VALIDATION.REQUIRED_FIELD)

    def invalid_format(self) -> str:
        return t(MSG.VALIDATION.INVALID_FORMAT)

    # Record messages
    def record_not_found(self) -> str:
        return t(MSG.RECORD.RECORD_NOT_FOUND)

    def record_created(self) -> str:
        return t(MSG.RECORD.RECORD_CREATED)

    def record_updated(self) -> str:
        return t(MSG.RECORD.RECORD_UPDATED)

    def record_deleted(self) -> str:
        return t(MSG.RECORD.RECORD_DELETED)

    # I18n messages
    def locale_set(self) -> str:
        return t(MSG.I18N.LOCALE_SET)

    def locale_supported(self) -> str:
        return t(MSG.I18N.LOCALE_SUPPORTED)

    def locale_not_supported(self) -> str:
        return t(MSG.I18N.LOCALE_NOT_SUPPORTED)

    def compliance_engine_api(self) -> str:
        return t(MSG.I18N.COMPLIANCE_ENGINE_API)

    def system_operating_normally(self) -> str:
        return t(MSG.I18N.SYSTEM_OPERATING_NORMALLY)


def t(key: str, **kwargs) -> str:
    """
    Translation function.

    Args:
        key: Translation key (from MSG constants)
        **kwargs: Additional parameters for string formatting

    Returns:
        Translated string
    """
    try:
        result = _(key)

        # Handle string formatting if kwargs provided
        if kwargs:
            result = result.format(**kwargs)

        return result
    except Exception as e:
        logger.warning(
            "translation_failed",
            key=key,
            error=str(e),
            fallback=key
        )
        return key


def t_with_context(key: str, context: str, **kwargs) -> str:
    """
    Translation with context for disambiguation.

    Args:
        key: Translation key
        context: Context information (e.g., "admin_panel", "user_dashboard")
        **kwargs: Additional parameters for string formatting

    Returns:
        Translated string
    """
    # Try context-specific key first
    context_key = f"{context}.{key}"

    try:
        result = _(context_key)
        if result == context_key:
            result = t(key, **kwargs)
        elif kwargs:
            result = result.format(**kwargs)
        return result
    except Exception as e:
        logger.warning(
            "contextual_translation_failed",
            key=key,
            context=context,
            error=str(e)
        )
        return t(key, **kwargs)


def get_translator(request: Optional[Request] = None) -> TranslationContext:
    """
    Get a translator instance for the current request context.

    Args:
        request: FastAPI request object (optional)

    Returns:
        TranslationContext instance
    """
    return TranslationContext(request)


def t_pluralize(key: str, count: int, **kwargs) -> str:
    """
    Handle pluralization for translations.

    Args:
        key: Base translation key
        count: Number to determine singular/plural
        **kwargs: Additional parameters for string formatting

    Returns:
        Correctly pluralized translation
    """
    kwargs['count'] = count

    if count == 1:
        plural_key = f"{key}_singular"
    else:
        plural_key = f"{key}_plural"

    try:
        result = t(plural_key, **kwargs)
        if result == plural_key:
            result = t(key, **kwargs)
        return result
    except Exception:
        return t(key, **kwargs)


def translate_response(message_key: str):
    """
    Decorator to automatically translate response messages.

    Args:
        message_key: Key from MSG constants to use for translation
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            result = await func(*args, **kwargs)

            if isinstance(result, dict) and 'message' in result:
                result['message'] = t(message_key)

            return result
        return wrapper
    return decorator


class TemporaryLocale:
    """Context manager for temporarily switching locale"""

    def __init__(self, locale: str):
        self.locale = locale
        self.original_locale = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass


__all__ = [
    't', 't_with_context', 'get_translator', 't_pluralize',
    'TranslationContext', 'translate_response', 'TemporaryLocale'
]
