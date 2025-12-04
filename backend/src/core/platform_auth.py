"""
Platform admin authentication and authorization.
Separate from customer-scoped authentication.
Uses stored procedures only for security compliance.
"""

import os
import uuid
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from fastapi import HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import structlog

from .database import DatabaseManager
from .config import settings

logger = structlog.get_logger(__name__)

# Security scheme for platform admin endpoints
platform_admin_security = HTTPBearer(auto_error=False)


class PlatformAdmin:
    """Platform admin user model"""
    def __init__(self, admin_id: str, email: str, name: str, permissions: list, is_active: bool = True):
        self.id = admin_id
        self.email = email
        self.name = name
        self.permissions = permissions
        self.is_active = is_active


async def get_platform_admin_by_email(email: str, db_manager: DatabaseManager = None) -> Optional[PlatformAdmin]:
    """Get platform admin by email address using stored procedure"""
    try:
        # Import here to avoid circular dependency
        from .database import database_manager
        
        db = db_manager or database_manager
        result = await db.execute_procedure(
            "get_platform_admin_by_email",
            {"p_email": email.lower().strip()},
            fetch_mode="one"
        )
        
        if result:
            # Parse JSON permissions if it's a string
            permissions = result["permissions"]
            if isinstance(permissions, str):
                import json
                permissions = json.loads(permissions)
            
            return PlatformAdmin(
                admin_id=str(result["admin_id"]),
                email=result["email"],
                name=result["name"],
                permissions=permissions,
                is_active=result["is_active"]
            )
        return None
        
    except Exception as e:
        logger.error("Failed to fetch platform admin", email=email, error=str(e))
        return None


async def create_platform_admin_session(
    admin: PlatformAdmin, 
    request: Request,
    expires_hours: int = 24,
    db_manager: DatabaseManager = None
) -> str:
    """Create a new platform admin session and return session token using stored procedure"""
    try:
        # Import here to avoid circular dependency
        from .database import database_manager
        
        # Generate a secure session token
        session_token = secrets.token_urlsafe(64)
        
        # Get request metadata
        ip_address = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")
        
        db = db_manager or database_manager
        result = await db.execute_procedure(
            "create_platform_admin_session",
            {
                "p_admin_id": admin.id,
                "p_session_token": session_token,
                "p_ip_address": ip_address,
                "p_user_agent": user_agent,
                "p_expires_hours": expires_hours
            },
            fetch_mode="one"
        )
        
        if result:
            logger.info("Platform admin session created", 
                       admin_email=admin.email, 
                       session_id=str(result["session_id"]))
            return session_token
        else:
            raise Exception("Failed to create session - no result returned")
        
    except Exception as e:
        logger.error("Failed to create platform admin session", admin_email=admin.email, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to create session")


async def validate_platform_admin_session(session_token: str, db_manager: DatabaseManager = None) -> Optional[PlatformAdmin]:
    """Validate platform admin session using stored procedure"""
    try:
        # Import here to avoid circular dependency
        from .database import database_manager
        
        db = db_manager or database_manager
        result = await db.execute_procedure(
            "validate_platform_admin_session",
            {"p_session_token": session_token},
            fetch_mode="one"
        )
        
        if result:
            # Parse JSON permissions if it's a string
            permissions = result["permissions"]
            if isinstance(permissions, str):
                import json
                permissions = json.loads(permissions)
            
            return PlatformAdmin(
                admin_id=str(result["admin_id"]),
                email=result["email"],
                name=result["name"],
                permissions=permissions,
                is_active=True  # Only active admins are returned by the stored procedure
            )
        return None
        
    except Exception as e:
        logger.error("Failed to validate platform admin session", error=str(e))
        return None


async def get_current_platform_admin(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(platform_admin_security)
) -> PlatformAdmin:
    """
    Dependency to get current authenticated platform admin.
    Use this to protect platform admin endpoints.
    """
    if not credentials:
        raise HTTPException(status_code=401, detail="Platform admin authentication required")
    
    session_token = credentials.credentials
    
    # Get database manager from request state
    db_manager = request.state.db
    
    admin = await validate_platform_admin_session(session_token, db_manager)
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid or expired platform admin session")
    
    return admin


async def cleanup_expired_sessions(db_manager: DatabaseManager = None) -> int:
    """Clean up expired platform admin sessions using stored procedure"""
    try:
        # Import here to avoid circular dependency
        from .database import database_manager
        
        db = db_manager or database_manager
        result = await db.execute_procedure(
            "cleanup_expired_platform_admin_sessions",
            {},
            fetch_mode="one"
        )
        
        deleted_count = result if isinstance(result, int) else 0
        
        if deleted_count > 0:
            logger.info("Cleaned up expired platform admin sessions", count=deleted_count)
        
        return deleted_count
        
    except Exception as e:
        logger.error("Failed to cleanup expired sessions", error=str(e))
        return 0


# Convenience function for checking platform admin access
require_platform_admin = Depends(get_current_platform_admin)