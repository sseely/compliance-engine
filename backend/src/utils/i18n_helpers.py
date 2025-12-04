"""
Internationalization Helper Functions

This module provides enhanced i18n functionality that integrates with fastapi-babel
and the string constants system to provide:
1. Type-safe translation functions
2. Usage tracking and analytics
3. Fallback handling
4. Context-aware translations

Usage:
    from utils.i18n_helpers import t, t_with_context, get_translator
    from constants.strings import STRINGS
    
    # Basic translation with usage tracking
    message = t(STRINGS.COMMON.SUCCESS)
    
    # Context-aware translation
    translator = get_translator(request)
    message = translator.success()
    
    # Translation with context for better accuracy
    message = t_with_context(STRINGS.AUTH.ACCESS_DENIED, context="admin_panel")
"""

from typing import Optional, Dict, Any, Callable
from functools import wraps
import structlog
from fastapi import Request
from fastapi_babel import _, BabelMiddleware

from constants.strings import STRINGS, _track_usage

logger = structlog.get_logger(__name__)


class TranslationContext:
    """
    Context-aware translator that provides commonly used translations
    with automatic usage tracking and type safety.
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
        """Get localized success message"""
        return t(STRINGS.COMMON.SUCCESS)
    
    def error(self) -> str:
        """Get localized error message"""
        return t(STRINGS.COMMON.ERROR)
    
    def healthy(self) -> str:
        """Get localized healthy status"""
        return t(STRINGS.COMMON.HEALTHY)
    
    def unhealthy(self) -> str:
        """Get localized unhealthy status"""
        return t(STRINGS.COMMON.UNHEALTHY)
    
    def operational(self) -> str:
        """Get localized operational status"""
        return t(STRINGS.COMMON.OPERATIONAL)
    
    def status(self) -> str:
        """Get localized status label"""
        return t(STRINGS.COMMON.STATUS)
    
    # Authentication messages
    def auth_failed(self) -> str:
        """Get localized authentication failed message"""
        return t(STRINGS.AUTH.AUTHENTICATION_FAILED)
    
    def auth_required(self) -> str:
        """Get localized authentication required message"""
        return t(STRINGS.AUTH.AUTHENTICATION_REQUIRED)
    
    def access_denied(self) -> str:
        """Get localized access denied message"""
        return t(STRINGS.AUTH.ACCESS_DENIED)
    
    def insufficient_permissions(self) -> str:
        """Get localized insufficient permissions message"""
        return t(STRINGS.AUTH.INSUFFICIENT_PERMISSIONS)
    
    def token_expired(self) -> str:
        """Get localized token expired message"""
        return t(STRINGS.AUTH.TOKEN_EXPIRED)
    
    def token_invalid(self) -> str:
        """Get localized token invalid message"""
        return t(STRINGS.AUTH.TOKEN_INVALID)
    
    # Validation messages
    def validation_error(self) -> str:
        """Get localized validation error message"""
        return t(STRINGS.VALIDATION.VALIDATION_ERROR)
    
    def invalid_input(self) -> str:
        """Get localized invalid input message"""
        return t(STRINGS.VALIDATION.INVALID_INPUT)
    
    def required_field(self) -> str:
        """Get localized required field message"""
        return t(STRINGS.VALIDATION.REQUIRED_FIELD)
    
    def invalid_format(self) -> str:
        """Get localized invalid format message"""
        return t(STRINGS.VALIDATION.INVALID_FORMAT)
    
    # Database messages
    def database_error(self) -> str:
        """Get localized database error message"""
        return t(STRINGS.DATABASE.DATABASE_ERROR)
    
    def record_not_found(self) -> str:
        """Get localized record not found message"""
        return t(STRINGS.DATABASE.RECORD_NOT_FOUND)
    
    def record_created(self) -> str:
        """Get localized record created message"""
        return t(STRINGS.DATABASE.RECORD_CREATED)
    
    def record_updated(self) -> str:
        """Get localized record updated message"""
        return t(STRINGS.DATABASE.RECORD_UPDATED)
    
    def record_deleted(self) -> str:
        """Get localized record deleted message"""
        return t(STRINGS.DATABASE.RECORD_DELETED)
    
    # OIDC messages
    def verification_successful(self) -> str:
        """Get localized verification successful message"""
        return t(STRINGS.OIDC.VERIFICATION_SUCCESSFUL)
    
    def verification_failed(self) -> str:
        """Get localized verification failed message"""
        return t(STRINGS.OIDC.VERIFICATION_FAILED)
    
    def deployment_allowed(self) -> str:
        """Get localized deployment allowed message"""
        return t(STRINGS.OIDC.DEPLOYMENT_ALLOWED)
    
    def deployment_blocked(self) -> str:
        """Get localized deployment blocked message"""
        return t(STRINGS.OIDC.DEPLOYMENT_BLOCKED)
    
    # I18n messages
    def locale_set(self) -> str:
        """Get localized locale set message"""
        return t(STRINGS.I18N.LOCALE_SET)
    
    def locale_supported(self) -> str:
        """Get localized locale supported message"""
        return t(STRINGS.I18N.LOCALE_SUPPORTED)
    
    def locale_not_supported(self) -> str:
        """Get localized locale not supported message"""
        return t(STRINGS.I18N.LOCALE_NOT_SUPPORTED)
    
    def compliance_engine_api(self) -> str:
        """Get localized API title"""
        return t(STRINGS.I18N.COMPLIANCE_ENGINE_API)
    
    def system_operating_normally(self) -> str:
        """Get localized system operating normally message"""
        return t(STRINGS.COMMON.SYSTEM_OPERATING_NORMALLY)


def t(key: str, **kwargs) -> str:
    """
    Enhanced translation function with usage tracking
    
    Args:
        key: Translation key (preferably from STRINGS constants)
        **kwargs: Additional parameters for string formatting
    
    Returns:
        Translated string
    """
    _track_usage(key)
    
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
        # Return the key as fallback
        return key


def t_with_context(key: str, context: str, **kwargs) -> str:
    """
    Translation with context for better accuracy
    
    Args:
        key: Translation key
        context: Context information (e.g., "admin_panel", "user_dashboard")
        **kwargs: Additional parameters for string formatting
    
    Returns:
        Translated string
    """
    # Try context-specific key first (e.g., "admin_panel.success")
    context_key = f"{context}.{key}"
    _track_usage(context_key)
    
    try:
        result = _(context_key)
        if result == context_key:  # No translation found for context-specific key
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
    Get a translator instance for the current request context
    
    Args:
        request: FastAPI request object (optional)
    
    Returns:
        TranslationContext instance
    """
    return TranslationContext(request)


def t_pluralize(key: str, count: int, **kwargs) -> str:
    """
    Handle pluralization for translations
    
    Args:
        key: Base translation key
        count: Number to determine singular/plural
        **kwargs: Additional parameters for string formatting
    
    Returns:
        Correctly pluralized translation
    """
    # Add count to kwargs for use in translation
    kwargs['count'] = count
    
    # Determine plural form based on count
    if count == 1:
        plural_key = f"{key}_singular"
    else:
        plural_key = f"{key}_plural"
    
    # Try plural-specific key first, fallback to base key
    try:
        result = t(plural_key, **kwargs)
        if result == plural_key:  # No plural-specific translation
            result = t(key, **kwargs)
        return result
    except Exception:
        return t(key, **kwargs)


def track_translation_coverage() -> Dict[str, Any]:
    """
    Analyze translation coverage and usage patterns
    
    Returns:
        Dictionary with coverage statistics
    """
    from constants.strings import get_string_usage_stats
    
    usage_stats = get_string_usage_stats()
    
    # Count defined constants
    total_constants = 0
    used_constants = 0
    
    for category_name in ['COMMON', 'AUTH', 'VALIDATION', 'DATABASE', 'OIDC', 'I18N', 'ERROR']:
        category = getattr(STRINGS, category_name)
        for attr_name in dir(category):
            if not attr_name.startswith('_'):
                total_constants += 1
                const_value = getattr(category, attr_name)
                if const_value in usage_stats:
                    used_constants += 1
    
    coverage_percent = (used_constants / total_constants * 100) if total_constants > 0 else 0
    
    return {
        "total_constants": total_constants,
        "used_constants": used_constants,
        "unused_constants": total_constants - used_constants,
        "coverage_percent": round(coverage_percent, 1),
        "total_usage_count": sum(usage_stats.values()),
        "most_used_strings": dict(
            sorted(usage_stats.items(), key=lambda x: x[1], reverse=True)[:10]
        )
    }


def validate_translations() -> Dict[str, Any]:
    """
    Validate that all string constants have corresponding translations
    
    Returns:
        Validation results
    """
    missing_translations = []
    
    # Check each string constant against available translations
    for category_name in ['COMMON', 'AUTH', 'VALIDATION', 'DATABASE', 'OIDC', 'I18N', 'ERROR']:
        category = getattr(STRINGS, category_name)
        for attr_name in dir(category):
            if not attr_name.startswith('_'):
                const_value = getattr(category, attr_name)
                
                # Test if translation exists
                try:
                    translated = _(const_value)
                    if translated == const_value:
                        # Translation might be missing (or identical to key)
                        missing_translations.append(f"{category_name}.{attr_name}: {const_value}")
                except Exception as e:
                    missing_translations.append(f"{category_name}.{attr_name}: {const_value} (Error: {e})")
    
    return {
        "total_checked": sum(
            len([attr for attr in dir(getattr(STRINGS, cat)) if not attr.startswith('_')])
            for cat in ['COMMON', 'AUTH', 'VALIDATION', 'DATABASE', 'OIDC', 'I18N', 'ERROR']
        ),
        "missing_count": len(missing_translations),
        "missing_translations": missing_translations,
        "validation_passed": len(missing_translations) == 0
    }


# Decorator for automatic translation of response messages
def translate_response(message_key: str):
    """
    Decorator to automatically translate response messages
    
    Args:
        message_key: Key from STRINGS constants to use for translation
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            result = await func(*args, **kwargs)
            
            # If result is a dict with a 'message' field, translate it
            if isinstance(result, dict) and 'message' in result:
                result['message'] = t(message_key)
            
            return result
        return wrapper
    return decorator


# Context manager for temporary locale switching
class TemporaryLocale:
    """Context manager for temporarily switching locale"""
    
    def __init__(self, locale: str):
        self.locale = locale
        self.original_locale = None
    
    def __enter__(self):
        # This would integrate with fastapi-babel's locale switching
        # Implementation depends on how locale is managed in the app
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        # Restore original locale
        pass


# Export main functions
__all__ = [
    't', 't_with_context', 'get_translator', 't_pluralize',
    'TranslationContext', 'track_translation_coverage', 
    'validate_translations', 'translate_response', 'TemporaryLocale'
]