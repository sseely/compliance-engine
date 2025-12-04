"""
String Constants for Backend Internationalization

This module provides centralized string constants for translation lookups in the FastAPI backend.
By using constants instead of magic strings, we can:
1. See how many times each translation is used across the codebase
2. Avoid typos in translation keys
3. Enable IDE autocomplete and type checking
4. Easily refactor translation keys when needed
5. Identify opportunities to consolidate similar translations

Usage:
    from constants.strings import STRINGS
    from fastapi_babel import _
    
    # Use with translation function
    message = _(STRINGS.COMMON.SUCCESS)
    
    # Or use the helper functions
    from constants.strings import t_success, t_error
    success_msg = t_success()
    error_msg = t_error()
"""

from typing import Final, Dict, Any
import os

# Track string usage in development mode
_string_usage: Dict[str, int] = {}

def _track_usage(key: str) -> None:
    """Track string usage for analytics in development mode"""
    if os.getenv("ENVIRONMENT", "development").lower() == "development":
        _string_usage[key] = _string_usage.get(key, 0) + 1
        count = _string_usage[key]
        
        # Log high-usage strings for potential consolidation
        if count in [5, 10, 25, 50] or count % 100 == 0:
            import structlog
            logger = structlog.get_logger(__name__)
            logger.debug(
                "string_usage_milestone",
                key=key,
                count=count,
                suggestion="Consider if this string can be consolidated"
            )

def get_string_usage_stats() -> Dict[str, int]:
    """Get current string usage statistics (development only)"""
    return dict(_string_usage)

def print_usage_stats() -> None:
    """Print string usage statistics sorted by frequency"""
    if not _string_usage:
        print("No string usage data collected (not in development mode or no usage yet)")
        return
    
    print("\n=== String Usage Statistics ===")
    sorted_usage = sorted(_string_usage.items(), key=lambda x: x[1], reverse=True)
    
    print(f"{'Translation Key':<50} {'Count':>8}")
    print("-" * 60)
    for key, count in sorted_usage[:20]:  # Top 20
        print(f"{key:<50} {count:>8}")
    
    total_keys = len(sorted_usage)
    total_usage = sum(_string_usage.values())
    avg_usage = total_usage / total_keys if total_keys > 0 else 0
    
    print(f"\nTotal unique strings: {total_keys}")
    print(f"Total usage count: {total_usage}")
    print(f"Average usage per string: {avg_usage:.1f}")


class CommonStrings:
    """Common UI strings used throughout the API"""
    
    # Status indicators
    HEALTHY: Final[str] = "healthy"
    UNHEALTHY: Final[str] = "unhealthy"
    OPERATIONAL: Final[str] = "operational"
    STATUS: Final[str] = "status"
    SUCCESS: Final[str] = "success"
    ERROR: Final[str] = "error"
    FAILED: Final[str] = "failed"
    PENDING: Final[str] = "pending"
    ACTIVE: Final[str] = "active"
    INACTIVE: Final[str] = "inactive"
    
    # Actions
    CREATED: Final[str] = "created"
    UPDATED: Final[str] = "updated"
    DELETED: Final[str] = "deleted"
    VALIDATED: Final[str] = "validated"
    PROCESSED: Final[str] = "processed"
    SUBMITTED: Final[str] = "submitted"
    APPROVED: Final[str] = "approved"
    REJECTED: Final[str] = "rejected"
    
    # System messages
    SYSTEM_OPERATING_NORMALLY: Final[str] = "System is operating normally"
    SERVICE_UNAVAILABLE: Final[str] = "Service temporarily unavailable"
    MAINTENANCE_MODE: Final[str] = "System is in maintenance mode"


class AuthStrings:
    """Authentication and authorization related strings"""
    
    # Authentication
    AUTHENTICATION_REQUIRED: Final[str] = "Authentication required"
    AUTHENTICATION_FAILED: Final[str] = "Authentication failed"
    INVALID_CREDENTIALS: Final[str] = "Invalid credentials"
    TOKEN_EXPIRED: Final[str] = "Token has expired"
    TOKEN_INVALID: Final[str] = "Invalid token"
    SESSION_EXPIRED: Final[str] = "Session has expired"
    LOGIN_SUCCESSFUL: Final[str] = "Login successful"
    LOGOUT_SUCCESSFUL: Final[str] = "Logout successful"
    
    # Authorization
    INSUFFICIENT_PERMISSIONS: Final[str] = "Insufficient permissions"
    ACCESS_DENIED: Final[str] = "Access denied"
    AUTHORIZATION_FAILED: Final[str] = "Authorization failed"
    PERMISSION_REQUIRED: Final[str] = "Permission required"
    ADMIN_ACCESS_REQUIRED: Final[str] = "Administrator access required"
    
    # Security
    SECURITY_VIOLATION: Final[str] = "Security violation detected"
    SUSPICIOUS_ACTIVITY: Final[str] = "Suspicious activity detected"
    RATE_LIMIT_EXCEEDED: Final[str] = "Rate limit exceeded"
    IP_BLOCKED: Final[str] = "IP address blocked"


class ValidationStrings:
    """Input validation related strings"""
    
    # General validation
    VALIDATION_ERROR: Final[str] = "Validation error"
    INVALID_INPUT: Final[str] = "Invalid input"
    REQUIRED_FIELD: Final[str] = "This field is required"
    INVALID_FORMAT: Final[str] = "Invalid format"
    VALUE_TOO_SHORT: Final[str] = "Value is too short"
    VALUE_TOO_LONG: Final[str] = "Value is too long"
    INVALID_EMAIL: Final[str] = "Invalid email address"
    INVALID_URL: Final[str] = "Invalid URL"
    INVALID_DATE: Final[str] = "Invalid date"
    
    # Specific validations
    INVALID_LICENSE_NUMBER: Final[str] = "Invalid license number"
    INVALID_PHONE_NUMBER: Final[str] = "Invalid phone number"
    INVALID_POSTAL_CODE: Final[str] = "Invalid postal code"
    INVALID_STATE_CODE: Final[str] = "Invalid state code"


class DatabaseStrings:
    """Database operation related strings"""
    
    # Connection
    DATABASE_CONNECTED: Final[str] = "Database connected"
    DATABASE_DISCONNECTED: Final[str] = "Database disconnected" 
    CONNECTION_FAILED: Final[str] = "Database connection failed"
    CONNECTION_TIMEOUT: Final[str] = "Database connection timeout"
    
    # Operations
    RECORD_CREATED: Final[str] = "Record created successfully"
    RECORD_UPDATED: Final[str] = "Record updated successfully"
    RECORD_DELETED: Final[str] = "Record deleted successfully"
    RECORD_NOT_FOUND: Final[str] = "Record not found"
    DUPLICATE_RECORD: Final[str] = "Duplicate record"
    
    # Errors
    DATABASE_ERROR: Final[str] = "Database error occurred"
    TRANSACTION_FAILED: Final[str] = "Database transaction failed"
    QUERY_FAILED: Final[str] = "Database query failed"
    CONSTRAINT_VIOLATION: Final[str] = "Database constraint violation"


class OIDCStrings:
    """OIDC verification related strings"""
    
    # Providers
    GOOGLE: Final[str] = "Google"
    MICROSOFT: Final[str] = "Microsoft"
    LINKEDIN: Final[str] = "LinkedIn"
    APPLE: Final[str] = "Apple"
    
    # Verification results
    VERIFICATION_SUCCESSFUL: Final[str] = "OAuth verification successful"
    VERIFICATION_FAILED: Final[str] = "OAuth verification failed"
    PROVIDER_NOT_CONFIGURED: Final[str] = "OAuth provider not configured"
    INVALID_PROVIDER: Final[str] = "Invalid OAuth provider"
    
    # Deployment gates
    DEPLOYMENT_ALLOWED: Final[str] = "Deployment allowed - all providers verified"
    DEPLOYMENT_BLOCKED: Final[str] = "Deployment blocked - verification required"
    VERIFICATION_EXPIRED: Final[str] = "Verification expired - re-verification required"
    
    # Test results
    TEST_SUCCESSFUL: Final[str] = "OAuth test successful"
    TEST_FAILED: Final[str] = "OAuth test failed"
    TEST_IN_PROGRESS: Final[str] = "OAuth test in progress"


class I18nStrings:
    """Internationalization related strings"""
    
    # Locale management
    LOCALE_SET: Final[str] = "Current locale is set to"
    LOCALE_SUPPORTED: Final[str] = "Locale is supported"
    LOCALE_NOT_SUPPORTED: Final[str] = "Locale is not supported"
    LOCALE_CHANGED: Final[str] = "Locale changed successfully"
    
    # Content
    COMPLIANCE_ENGINE_API: Final[str] = "Compliance Engine API"
    API_DOCUMENTATION: Final[str] = "API Documentation"
    VERSION_INFO: Final[str] = "Version Information"


class ErrorStrings:
    """Error messages for various scenarios"""
    
    # HTTP errors
    BAD_REQUEST: Final[str] = "Bad request"
    UNAUTHORIZED: Final[str] = "Unauthorized"
    FORBIDDEN: Final[str] = "Forbidden"
    NOT_FOUND: Final[str] = "Not found"
    METHOD_NOT_ALLOWED: Final[str] = "Method not allowed"
    INTERNAL_SERVER_ERROR: Final[str] = "Internal server error"
    SERVICE_UNAVAILABLE: Final[str] = "Service unavailable"
    
    # Business logic errors
    INVALID_OPERATION: Final[str] = "Invalid operation"
    OPERATION_NOT_PERMITTED: Final[str] = "Operation not permitted"
    RESOURCE_LOCKED: Final[str] = "Resource is locked"
    QUOTA_EXCEEDED: Final[str] = "Quota exceeded"
    FEATURE_DISABLED: Final[str] = "Feature is disabled"
    
    # External service errors
    EXTERNAL_SERVICE_ERROR: Final[str] = "External service error"
    NETWORK_ERROR: Final[str] = "Network error"
    TIMEOUT_ERROR: Final[str] = "Request timeout"
    UPSTREAM_ERROR: Final[str] = "Upstream service error"


class STRINGS:
    """Main container for all string constants"""
    COMMON = CommonStrings()
    AUTH = AuthStrings()
    VALIDATION = ValidationStrings()
    DATABASE = DatabaseStrings()
    OIDC = OIDCStrings()
    I18N = I18nStrings()
    ERROR = ErrorStrings()


# Helper functions for commonly used strings with usage tracking
def t_common(key: str) -> str:
    """Get a common string with usage tracking"""
    _track_usage(f"COMMON.{key}")
    return getattr(STRINGS.COMMON, key)

def t_success() -> str:
    """Get success message with usage tracking"""
    _track_usage("COMMON.SUCCESS")
    return STRINGS.COMMON.SUCCESS

def t_error() -> str:
    """Get error message with usage tracking"""
    _track_usage("COMMON.ERROR") 
    return STRINGS.COMMON.ERROR

def t_healthy() -> str:
    """Get healthy status with usage tracking"""
    _track_usage("COMMON.HEALTHY")
    return STRINGS.COMMON.HEALTHY

def t_unhealthy() -> str:
    """Get unhealthy status with usage tracking"""
    _track_usage("COMMON.UNHEALTHY")
    return STRINGS.COMMON.UNHEALTHY

def t_auth_failed() -> str:
    """Get authentication failed message with usage tracking"""
    _track_usage("AUTH.AUTHENTICATION_FAILED")
    return STRINGS.AUTH.AUTHENTICATION_FAILED

def t_access_denied() -> str:
    """Get access denied message with usage tracking"""
    _track_usage("AUTH.ACCESS_DENIED")
    return STRINGS.AUTH.ACCESS_DENIED

def t_validation_error() -> str:
    """Get validation error message with usage tracking"""
    _track_usage("VALIDATION.VALIDATION_ERROR")
    return STRINGS.VALIDATION.VALIDATION_ERROR

def t_database_error() -> str:
    """Get database error message with usage tracking"""
    _track_usage("DATABASE.DATABASE_ERROR")
    return STRINGS.DATABASE.DATABASE_ERROR

def t_record_not_found() -> str:
    """Get record not found message with usage tracking"""
    _track_usage("DATABASE.RECORD_NOT_FOUND")
    return STRINGS.DATABASE.RECORD_NOT_FOUND


# Development utilities
def validate_all_strings() -> bool:
    """Validate that all string constants are properly defined"""
    errors = []
    
    for category_name in ['COMMON', 'AUTH', 'VALIDATION', 'DATABASE', 'OIDC', 'I18N', 'ERROR']:
        category = getattr(STRINGS, category_name)
        category_class = globals()[f"{category_name.title()}Strings"]
        
        # Check all class attributes are strings
        for attr_name in dir(category_class):
            if not attr_name.startswith('_'):
                value = getattr(category, attr_name)
                if not isinstance(value, str):
                    errors.append(f"{category_name}.{attr_name} is not a string: {type(value)}")
                elif not value.strip():
                    errors.append(f"{category_name}.{attr_name} is empty or whitespace only")
    
    if errors:
        print("String validation errors:")
        for error in errors:
            print(f"  - {error}")
        return False
    
    return True


# Export commonly used strings for easy importing
__all__ = [
    'STRINGS',
    't_success', 't_error', 't_healthy', 't_unhealthy',
    't_auth_failed', 't_access_denied', 't_validation_error',
    't_database_error', 't_record_not_found',
    'get_string_usage_stats', 'print_usage_stats', 'validate_all_strings'
]