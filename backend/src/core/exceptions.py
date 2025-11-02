"""
Custom exceptions for the Compliance Engine API
Provides structured error handling with security considerations
"""

from typing import Any, Dict, Optional
from fastapi import Request, status
from fastapi.responses import JSONResponse
import structlog

logger = structlog.get_logger(__name__)


class ComplianceEngineException(Exception):
    """Base exception for all Compliance Engine errors"""
    
    def __init__(
        self,
        message: str,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        error_code: str = "INTERNAL_ERROR",
        details: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        self.details = details or {}
        super().__init__(self.message)


class ValidationError(ComplianceEngineException):
    """Raised when input validation fails"""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            error_code="VALIDATION_ERROR",
            details=details
        )


class AuthenticationError(ComplianceEngineException):
    """Raised when authentication fails"""
    
    def __init__(self, message: str = "Authentication failed"):
        super().__init__(
            message=message,
            status_code=status.HTTP_401_UNAUTHORIZED,
            error_code="AUTHENTICATION_ERROR"
        )


class AuthorizationError(ComplianceEngineException):
    """Raised when authorization fails"""
    
    def __init__(self, message: str = "Insufficient permissions"):
        super().__init__(
            message=message,
            status_code=status.HTTP_403_FORBIDDEN,
            error_code="AUTHORIZATION_ERROR"
        )


class SecurityViolationError(ComplianceEngineException):
    """Raised when a security violation is detected"""
    
    def __init__(self, message: str):
        super().__init__(
            message="Security violation detected",  # Never expose internal details
            status_code=status.HTTP_403_FORBIDDEN,
            error_code="SECURITY_VIOLATION"
        )
        # Log the actual violation details securely
        logger.critical("security_violation", violation=message)


class DatabaseError(ComplianceEngineException):
    """Raised when database operations fail"""
    
    def __init__(self, message: str):
        # Don't expose database details to clients
        super().__init__(
            message="Database operation failed",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            error_code="DATABASE_ERROR"
        )
        # Log the actual error securely
        logger.error("database_error", error=message)


class ExternalServiceError(ComplianceEngineException):
    """Raised when external service calls fail"""
    
    def __init__(self, service: str, message: str = "External service unavailable"):
        super().__init__(
            message=f"Service {service} is currently unavailable",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            error_code="EXTERNAL_SERVICE_ERROR",
            details={"service": service}
        )


class RateLimitError(ComplianceEngineException):
    """Raised when rate limits are exceeded"""
    
    def __init__(self, message: str = "Rate limit exceeded"):
        super().__init__(
            message=message,
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            error_code="RATE_LIMIT_EXCEEDED"
        )


class BusinessLogicError(ComplianceEngineException):
    """Raised when business logic validation fails"""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="BUSINESS_LOGIC_ERROR",
            details=details
        )


class NotFoundError(ComplianceEngineException):
    """Raised when a resource is not found"""
    
    def __init__(self, resource: str, identifier: str):
        super().__init__(
            message=f"{resource} not found",
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="RESOURCE_NOT_FOUND",
            details={"resource": resource, "identifier": identifier}
        )


class ConflictError(ComplianceEngineException):
    """Raised when a resource conflict occurs"""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_409_CONFLICT,
            error_code="RESOURCE_CONFLICT",
            details=details
        )


async def compliance_exception_handler(request: Request, exc: ComplianceEngineException) -> JSONResponse:
    """
    Global exception handler for ComplianceEngineException
    Ensures consistent error response format
    """
    
    # Log the exception with context
    logger.error(
        "api_exception",
        error_code=exc.error_code,
        status_code=exc.status_code,
        message=exc.message,
        path=request.url.path,
        method=request.method,
        client_ip=request.client.host if request.client else None,
        details=exc.details
    )
    
    # Prepare error response
    error_response = {
        "error": {
            "code": exc.error_code,
            "message": exc.message,
            "timestamp": logger._context.get("timestamp"),
            "path": request.url.path
        }
    }
    
    # Include details for non-security errors
    if exc.details and not isinstance(exc, SecurityViolationError):
        error_response["error"]["details"] = exc.details
    
    # Add request ID if available
    if hasattr(request.state, "request_id"):
        error_response["error"]["request_id"] = request.state.request_id
    
    return JSONResponse(
        status_code=exc.status_code,
        content=error_response
    )