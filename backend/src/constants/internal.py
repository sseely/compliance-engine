"""
Internal String Constants

These strings are used for logging, diagnostics, internal systems, and admin-only
interfaces. They do NOT need translation - English is fine for:
- Log messages
- Trace/debug output
- Database status messages
- Security audit entries
- System health internals
- Proper nouns (provider names, etc.)

Usage:
    from constants.internal import INTERNAL

    logger.info(INTERNAL.DB.CONNECTED)
"""

from typing import Final


class DatabaseStatus:
    """Database connection and operation status (logs only)"""
    CONNECTED: Final[str] = "Database connected"
    DISCONNECTED: Final[str] = "Database disconnected"
    CONNECTION_FAILED: Final[str] = "Database connection failed"
    CONNECTION_TIMEOUT: Final[str] = "Database connection timeout"
    TRANSACTION_FAILED: Final[str] = "Database transaction failed"
    QUERY_FAILED: Final[str] = "Database query failed"
    CONSTRAINT_VIOLATION: Final[str] = "Database constraint violation"
    POOL_EXHAUSTED: Final[str] = "Connection pool exhausted"


class SecurityEvents:
    """Security event messages (audit logs, never shown to users)"""
    VIOLATION_DETECTED: Final[str] = "Security violation detected"
    SUSPICIOUS_ACTIVITY: Final[str] = "Suspicious activity detected"
    IP_BLOCKED: Final[str] = "IP address blocked"
    BRUTE_FORCE_DETECTED: Final[str] = "Brute force attempt detected"
    INVALID_SIGNATURE: Final[str] = "Invalid request signature"
    CORS_BLOCKED: Final[str] = "CORS request blocked"
    CORS_ALLOWED: Final[str] = "CORS request allowed"


class SystemStatus:
    """System status messages (admin/ops only)"""
    MAINTENANCE_MODE: Final[str] = "System is in maintenance mode"
    STARTING: Final[str] = "System starting"
    SHUTTING_DOWN: Final[str] = "System shutting down"
    READY: Final[str] = "System ready"
    DEGRADED: Final[str] = "System degraded"


class OAuthProviders:
    """OAuth provider names (proper nouns, no translation)"""
    GOOGLE: Final[str] = "Google"
    MICROSOFT: Final[str] = "Microsoft"
    LINKEDIN: Final[str] = "LinkedIn"
    APPLE: Final[str] = "Apple"
    GITHUB: Final[str] = "GitHub"


class OAuthStatus:
    """OAuth verification status (internal/admin)"""
    VERIFICATION_SUCCESSFUL: Final[str] = "OAuth verification successful"
    VERIFICATION_FAILED: Final[str] = "OAuth verification failed"
    PROVIDER_NOT_CONFIGURED: Final[str] = "OAuth provider not configured"
    INVALID_PROVIDER: Final[str] = "Invalid OAuth provider"
    DEPLOYMENT_ALLOWED: Final[str] = "Deployment allowed - all providers verified"
    DEPLOYMENT_BLOCKED: Final[str] = "Deployment blocked - verification required"
    VERIFICATION_EXPIRED: Final[str] = "Verification expired"
    TEST_SUCCESSFUL: Final[str] = "OAuth test successful"
    TEST_FAILED: Final[str] = "OAuth test failed"
    TEST_IN_PROGRESS: Final[str] = "OAuth test in progress"


class AuditActions:
    """Audit log action names (never user-facing)"""
    LOGIN: Final[str] = "login"
    LOGOUT: Final[str] = "logout"
    API_CALL: Final[str] = "api_call"
    DATA_ACCESS: Final[str] = "data_access"
    DATA_MODIFY: Final[str] = "data_modify"
    PERMISSION_CHANGE: Final[str] = "permission_change"
    CONFIG_CHANGE: Final[str] = "config_change"


class HttpMethods:
    """HTTP method names"""
    GET: Final[str] = "GET"
    POST: Final[str] = "POST"
    PUT: Final[str] = "PUT"
    PATCH: Final[str] = "PATCH"
    DELETE: Final[str] = "DELETE"
    OPTIONS: Final[str] = "OPTIONS"


class INTERNAL:
    """Main container for internal constants"""
    DB = DatabaseStatus()
    SECURITY = SecurityEvents()
    SYSTEM = SystemStatus()
    OAUTH_PROVIDERS = OAuthProviders()
    OAUTH = OAuthStatus()
    AUDIT = AuditActions()
    HTTP = HttpMethods()
