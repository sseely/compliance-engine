"""
Security manager for Compliance Engine API
Handles authentication, authorization, CORS, and security policies
"""

import re
import secrets
from typing import Dict, List, Optional, Set, Tuple
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse
import structlog
from jose import JWTError, jwt
from passlib.context import CryptContext
from passlib.hash import bcrypt
from fastapi import Request, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from .config import settings
from .database import database_manager
from .exceptions import (
    AuthenticationError,
    AuthorizationError,
    SecurityViolationError,
    ValidationError
)
from .logging_config import audit_logger
from utils.request_helpers import get_client_ip

logger = structlog.get_logger(__name__)


class CORSManager:
    """
    Dynamic CORS management based on customer credentials
    Provides security through customer-specific origin whitelisting
    """
    
    def __init__(self):
        self.default_allowed_origins = [
            "http://localhost:3000",  # Development frontend
            "http://localhost:3001",  # Alternative dev port
        ]
        self.cache = {}  # Simple in-memory cache for performance
        self.cache_ttl = 300  # 5 minutes
    
    async def get_allowed_origins_for_customer(self, customer_id: str) -> List[str]:
        """Get allowed origins for a specific customer"""
        cache_key = f"cors:{customer_id}"
        
        # Check cache first
        if cache_key in self.cache:
            cached_data, timestamp = self.cache[cache_key]
            if datetime.now(timezone.utc) - timestamp < timedelta(seconds=self.cache_ttl):
                return cached_data
        
        try:
            # Get customer CORS settings from database
            result = await database_manager.execute_procedure(
                "get_customer_cors_settings",
                {"customer_id": customer_id}
            )
            
            if result:
                allowed_origins = result[0].get("allowed_origins", [])
                cors_policy = result[0].get("cors_policy", "strict")
                
                # Validate origins
                validated_origins = self._validate_origins(allowed_origins)
                
                # Cache the result
                self.cache[cache_key] = (validated_origins, datetime.now(timezone.utc))
                
                logger.info(
                    "customer_cors_loaded",
                    customer_id=customer_id,
                    origins_count=len(validated_origins),
                    policy=cors_policy
                )
                
                return validated_origins
            else:
                # Customer not found or no CORS settings
                return self.default_allowed_origins
                
        except Exception as e:
            logger.error("cors_settings_fetch_failed", customer_id=customer_id, error=str(e))
            return self.default_allowed_origins
    
    def _validate_origins(self, origins: List[str]) -> List[str]:
        """Validate and normalize origin URLs"""
        validated = []
        
        for origin in origins:
            try:
                parsed = urlparse(origin)
                
                # Security validations
                if not parsed.scheme in ['http', 'https']:
                    logger.warning("invalid_origin_scheme", origin=origin)
                    continue
                
                if not parsed.netloc:
                    logger.warning("invalid_origin_netloc", origin=origin)
                    continue
                
                # Reconstruct normalized origin
                normalized = f"{parsed.scheme}://{parsed.netloc}"
                
                # Additional security checks
                if self._is_suspicious_origin(normalized):
                    logger.warning("suspicious_origin_blocked", origin=normalized)
                    continue
                
                validated.append(normalized)
                
            except Exception as e:
                logger.warning("origin_validation_failed", origin=origin, error=str(e))
                continue
        
        return validated
    
    def _is_suspicious_origin(self, origin: str) -> bool:
        """Check if origin appears suspicious"""
        suspicious_patterns = [
            r'.*\.ngrok\.io$',  # Tunneling services (unless explicitly allowed)
            r'.*\.serveo\.net$',
            r'.*\.localtunnel\.me$',
            r'.*[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+.*',  # Raw IP addresses
        ]
        
        # Allow localhost and development environments
        if settings.is_development:
            return False
        
        for pattern in suspicious_patterns:
            if re.match(pattern, origin, re.IGNORECASE):
                return True
        
        return False
    
    async def is_origin_allowed(self, origin: str, customer_id: str = None) -> bool:
        """Check if an origin is allowed for a customer"""
        if not origin:
            return False
        
        if customer_id:
            allowed_origins = await self.get_allowed_origins_for_customer(customer_id)
        else:
            allowed_origins = self.default_allowed_origins
        
        return origin in allowed_origins
    
    async def get_cors_headers(self, request: Request, customer_id: str = None) -> Dict[str, str]:
        """Generate CORS headers for a request"""
        origin = request.headers.get("origin")
        headers = {}
        
        if origin:
            is_allowed = await self.is_origin_allowed(origin, customer_id)
            
            if is_allowed:
                headers.update({
                    "Access-Control-Allow-Origin": origin,
                    "Access-Control-Allow-Credentials": "true",
                    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization, Api-Key, CE-Request-ID, CE-Client-Version",
                    "Access-Control-Max-Age": "86400",  # 24 hours
                })
                
                # Log allowed CORS request for audit
                audit_logger.log_user_action(
                    user_id=customer_id or "anonymous",
                    action="cors_allowed",
                    resource="api_access",
                    ip_address=get_client_ip(request),
                    details={"origin": origin}
                )
            else:
                # Log blocked CORS request for security monitoring
                logger.warning(
                    "cors_origin_blocked",
                    origin=origin,
                    customer_id=customer_id,
                    ip_address=get_client_ip(request)
                )

                audit_logger.log_user_action(
                    user_id=customer_id or "anonymous",
                    action="cors_blocked",
                    resource="api_access",
                    ip_address=get_client_ip(request),
                    details={"origin": origin, "reason": "origin_not_allowed"}
                )
        
        return headers


class APIKeyManager:
    """
    API key management with customer-specific access control
    """
    
    def __init__(self):
        self.cache = {}
        self.cache_ttl = 600  # 10 minutes
    
    async def validate_api_key(self, api_key: str) -> Optional[Dict]:
        """Validate API key and return customer information"""
        if not api_key:
            return None
        
        # Check cache first
        cache_key = f"api_key:{api_key}"
        if cache_key in self.cache:
            cached_data, timestamp = self.cache[cache_key]
            if datetime.now(timezone.utc) - timestamp < timedelta(seconds=self.cache_ttl):
                return cached_data
        
        try:
            # Validate API key using stored procedure
            result = await database_manager.execute_procedure(
                "authenticate_user",
                {"api_key": api_key},
                fetch_mode="one"
            )
            
            if result and result.get("is_active"):
                customer_data = {
                    "customer_id": result["customer_id"],
                    "api_key_id": result["api_key_id"],
                    "permissions": result.get("permissions", []),
                    "rate_limit": result.get("rate_limit", 1000),
                    "expires_at": result.get("expires_at"),
                }
                
                # Cache the result
                self.cache[cache_key] = (customer_data, datetime.now(timezone.utc))
                
                # Log successful authentication
                audit_logger.log_user_action(
                    user_id=customer_data["customer_id"],
                    action="api_key_authenticated",
                    resource="authentication",
                    details={"api_key_id": customer_data["api_key_id"]}
                )
                
                return customer_data
            else:
                # Log failed authentication attempt
                logger.warning("invalid_api_key_attempt", api_key_prefix=api_key[:8])
                return None
                
        except Exception as e:
            logger.error("api_key_validation_error", error=str(e))
            return None
    
    async def generate_api_key(self, customer_id: str, permissions: List[str] = None) -> str:
        """Generate a new API key for a customer"""
        api_key = f"ce_{secrets.token_urlsafe(32)}"
        
        try:
            await database_manager.execute_procedure(
                "create_api_key",
                {
                    "customer_id": customer_id,
                    "api_key": api_key,
                    "permissions": permissions or [],
                    "created_by": "system"
                }
            )
            
            # Clear cache for this customer
            self._clear_customer_cache(customer_id)
            
            audit_logger.log_user_action(
                user_id=customer_id,
                action="api_key_created",
                resource="api_key_management",
                details={"permissions": permissions}
            )
            
            return api_key
            
        except Exception as e:
            logger.error("api_key_generation_failed", customer_id=customer_id, error=str(e))
            raise SecurityViolationError("Failed to generate API key")
    
    async def revoke_api_key(self, api_key_id: str, customer_id: str) -> bool:
        """Revoke an API key"""
        try:
            await database_manager.execute_procedure(
                "revoke_api_key",
                {
                    "api_key_id": api_key_id,
                    "customer_id": customer_id,
                    "revoked_by": "system"
                }
            )
            
            # Clear cache
            self._clear_customer_cache(customer_id)
            
            audit_logger.log_user_action(
                user_id=customer_id,
                action="api_key_revoked",
                resource="api_key_management",
                details={"api_key_id": api_key_id}
            )
            
            return True
            
        except Exception as e:
            logger.error("api_key_revocation_failed", api_key_id=api_key_id, error=str(e))
            return False
    
    def _clear_customer_cache(self, customer_id: str):
        """Clear cache entries for a customer"""
        keys_to_remove = [k for k in self.cache.keys() if customer_id in str(k)]
        for key in keys_to_remove:
            del self.cache[key]


class SecurityManager:
    """
    Central security manager coordinating all security components
    """
    
    def __init__(self):
        self.cors_manager = CORSManager()
        self.api_key_manager = APIKeyManager()
        self.security_bearer = HTTPBearer(auto_error=False)
        
        # Rate limiting tracking
        self.rate_limit_cache = {}
        self.rate_limit_window = 60  # 1 minute windows
    
    async def initialize(self):
        """Initialize security components"""
        logger.info("security_manager_initialized")
    
    async def cleanup(self):
        """Cleanup security components"""
        logger.info("security_manager_cleanup")
    
    async def authenticate_request(self, request: Request) -> Optional[Dict]:
        """Authenticate a request and return customer information"""
        # Try standard Authorization header first (RFC 7235)
        auth_header = request.headers.get("authorization")
        if auth_header:
            # Support both "ApiKey <key>" and "Bearer <token>" formats
            if auth_header.startswith("ApiKey "):
                api_key = auth_header[7:]  # Remove "ApiKey " prefix
                customer_data = await self.api_key_manager.validate_api_key(api_key)
                if customer_data:
                    return customer_data
            elif auth_header.startswith("Bearer "):
                # JWT token validation would go here
                pass
        
        # Try Api-Key header (common alternative)
        api_key = request.headers.get("api-key")
        if api_key:
            customer_data = await self.api_key_manager.validate_api_key(api_key)
            if customer_data:
                return customer_data
        
        return None
    
    async def check_permissions(self, customer_data: Dict, required_permission: str) -> bool:
        """Check if customer has required permission"""
        if not customer_data:
            return False
        
        permissions = customer_data.get("permissions", [])
        
        # Check for specific permission or admin access
        return required_permission in permissions or "admin" in permissions
    
    async def check_rate_limit(self, customer_id: str, limit: int = None) -> bool:
        """Check if customer is within rate limits"""
        current_time = datetime.now(timezone.utc)
        window_start = current_time.replace(second=0, microsecond=0)
        
        cache_key = f"rate_limit:{customer_id}:{window_start.isoformat()}"
        
        current_count = self.rate_limit_cache.get(cache_key, 0)
        customer_limit = limit or 1000  # Default rate limit
        
        if current_count >= customer_limit:
            logger.warning(
                "rate_limit_exceeded",
                customer_id=customer_id,
                current_count=current_count,
                limit=customer_limit
            )
            return False
        
        # Increment counter
        self.rate_limit_cache[cache_key] = current_count + 1
        
        # Clean old entries (simple cleanup)
        cutoff_time = current_time - timedelta(minutes=5)
        keys_to_remove = [
            k for k in self.rate_limit_cache.keys() 
            if k.startswith("rate_limit:") and cutoff_time.isoformat() in k
        ]
        for key in keys_to_remove:
            del self.rate_limit_cache[key]
        
        return True
    
    async def apply_cors_headers(self, request: Request, response, customer_id: str = None):
        """Apply CORS headers to response"""
        cors_headers = await self.cors_manager.get_cors_headers(request, customer_id)
        
        for header, value in cors_headers.items():
            response.headers[header] = value
    
    async def validate_request_security(self, request: Request) -> Dict:
        """Comprehensive request security validation"""
        # Basic security checks
        self._validate_request_headers(request)
        self._validate_request_size(request)
        
        # Authenticate request
        customer_data = await self.authenticate_request(request)
        
        if customer_data:
            # Check rate limits
            rate_limit_ok = await self.check_rate_limit(
                customer_data["customer_id"],
                customer_data.get("rate_limit")
            )
            
            if not rate_limit_ok:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Rate limit exceeded"
                )
        
        return customer_data or {}
    
    def _validate_request_headers(self, request: Request):
        """Validate request headers for security"""
        # Check for required security headers in certain environments
        if settings.is_production:
            # Ensure HTTPS in production
            if request.url.scheme != "https":
                raise SecurityViolationError("HTTPS required in production")
        
        # Validate User-Agent (basic bot detection)
        user_agent = request.headers.get("user-agent", "")
        if not user_agent or len(user_agent) < 10:
            logger.warning("suspicious_user_agent", user_agent=user_agent)
    
    def _validate_request_size(self, request: Request):
        """Validate request size for DoS protection"""
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                size = int(content_length)
                max_size = settings.MAX_DOCUMENT_SIZE_MB * 1024 * 1024  # Convert to bytes
                
                if size > max_size:
                    raise SecurityViolationError(f"Request too large: {size} bytes")
                    
            except ValueError:
                logger.warning("invalid_content_length", content_length=content_length)


# Global security manager instance
security_manager = SecurityManager()