"""
User-Facing Message Constants

These strings are returned to end users in API responses and MUST be translated.
All strings here should have corresponding entries in the .po translation files.

Usage:
    from constants.user_messages import MSG
    from utils.i18n_helpers import t

    # In API response
    return {"message": t(MSG.SUCCESS)}
"""

from typing import Final


class StatusMessages:
    """Status indicators shown to users"""
    HEALTHY: Final[str] = "healthy"
    UNHEALTHY: Final[str] = "unhealthy"
    OPERATIONAL: Final[str] = "operational"
    SUCCESS: Final[str] = "success"
    ERROR: Final[str] = "error"
    PENDING: Final[str] = "pending"


class AuthMessages:
    """Authentication/authorization messages returned to users"""
    AUTHENTICATION_REQUIRED: Final[str] = "Authentication required"
    AUTHENTICATION_FAILED: Final[str] = "Authentication failed"
    INVALID_CREDENTIALS: Final[str] = "Invalid credentials"
    TOKEN_EXPIRED: Final[str] = "Token has expired"
    TOKEN_INVALID: Final[str] = "Invalid token"
    SESSION_EXPIRED: Final[str] = "Session has expired"
    INSUFFICIENT_PERMISSIONS: Final[str] = "Insufficient permissions"
    ACCESS_DENIED: Final[str] = "Access denied"


class ValidationMessages:
    """Validation error messages returned to users"""
    VALIDATION_ERROR: Final[str] = "Validation error"
    INVALID_INPUT: Final[str] = "Invalid input"
    REQUIRED_FIELD: Final[str] = "This field is required"
    INVALID_FORMAT: Final[str] = "Invalid format"
    VALUE_TOO_SHORT: Final[str] = "Value is too short"
    VALUE_TOO_LONG: Final[str] = "Value is too long"
    INVALID_EMAIL: Final[str] = "Invalid email address"
    INVALID_URL: Final[str] = "Invalid URL"
    INVALID_DATE: Final[str] = "Invalid date"
    INVALID_LICENSE_NUMBER: Final[str] = "Invalid license number"
    INVALID_PHONE_NUMBER: Final[str] = "Invalid phone number"
    INVALID_POSTAL_CODE: Final[str] = "Invalid postal code"
    INVALID_STATE_CODE: Final[str] = "Invalid state code"


class RecordMessages:
    """CRUD operation messages returned to users"""
    RECORD_CREATED: Final[str] = "Record created successfully"
    RECORD_UPDATED: Final[str] = "Record updated successfully"
    RECORD_DELETED: Final[str] = "Record deleted successfully"
    RECORD_NOT_FOUND: Final[str] = "Record not found"
    DUPLICATE_RECORD: Final[str] = "Duplicate record"


class ErrorMessages:
    """Error messages returned to users (intentionally vague for security)"""
    BAD_REQUEST: Final[str] = "Bad request"
    NOT_FOUND: Final[str] = "Not found"
    INTERNAL_ERROR: Final[str] = "An error occurred"
    SERVICE_UNAVAILABLE: Final[str] = "Service temporarily unavailable"
    RATE_LIMIT_EXCEEDED: Final[str] = "Rate limit exceeded"
    QUOTA_EXCEEDED: Final[str] = "Quota exceeded"


class I18nMessages:
    """Internationalization-related messages"""
    LOCALE_SET: Final[str] = "Current locale is set to"
    LOCALE_SUPPORTED: Final[str] = "Locale is supported"
    LOCALE_NOT_SUPPORTED: Final[str] = "Locale is not supported"
    LOCALE_CHANGED: Final[str] = "Locale changed successfully"
    COMPLIANCE_ENGINE_API: Final[str] = "Compliance Engine API"
    SYSTEM_OPERATING_NORMALLY: Final[str] = "System is operating normally"


class MSG:
    """Main container for all user-facing messages"""
    STATUS = StatusMessages()
    AUTH = AuthMessages()
    VALIDATION = ValidationMessages()
    RECORD = RecordMessages()
    ERROR = ErrorMessages()
    I18N = I18nMessages()

    # Convenience aliases for common messages
    SUCCESS: Final[str] = StatusMessages.SUCCESS
    HEALTHY: Final[str] = StatusMessages.HEALTHY
    UNHEALTHY: Final[str] = StatusMessages.UNHEALTHY


def get_all_translatable_strings() -> list[str]:
    """Return all strings that need translation entries"""
    strings = []
    for category in [StatusMessages, AuthMessages, ValidationMessages,
                     RecordMessages, ErrorMessages, I18nMessages]:
        for attr in dir(category):
            if not attr.startswith('_') and attr.isupper():
                strings.append(getattr(category, attr))
    return strings
