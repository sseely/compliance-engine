"""
Platform admin authentication and authorization.
Separate from customer-scoped authentication.
"""

import os
import uuid
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import asyncpg
from fastapi import HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import structlog

from .database import get_db_connection
from .config import settings

logger = structlog.get_logger(__name__)

# Security scheme for platform admin endpoints
platform_admin_security = HTTPBearer(auto_error=False)


class PlatformAdmin:
    """Platform admin user model"""
    def __init__(self, id: int, email: str, name: str, is_active: bool = True):
        self.id = id
        self.email = email
        self.name = name
        self.is_active = is_active


async def initialize_platform_admins(db_pool: asyncpg.Pool) -> None:
    """
    Initialize platform admins from environment variables.
    Called during application startup.
    """
    initial_admin_email = os.getenv('INITIAL_PLATFORM_ADMIN_EMAIL')
    initial_admin_name = os.getenv('INITIAL_PLATFORM_ADMIN_NAME', 'Initial Platform Admin')
    
    if not initial_admin_email:
        logger.warning("INITIAL_PLATFORM_ADMIN_EMAIL not set - no initial platform admin will be created")
        return
    
    try:
        async with db_pool.acquire() as connection:
            # Check if any platform admins exist
            admin_count = await connection.fetchval("SELECT COUNT(*) FROM platform_admins WHERE is_active = true")
            
            if admin_count == 0:
                # Create the initial platform admin
                await connection.execute("""
                    INSERT INTO platform_admins (email, name, created_by)
                    VALUES ($1, $2, 'system_initialization')
                    ON CONFLICT (email) DO NOTHING
                """, initial_admin_email, initial_admin_name)
                
                logger.info("Initial platform admin created", email=initial_admin_email)
            else:
                logger.info("Platform admins already exist", count=admin_count)
                
    except Exception as e:
        logger.error("Failed to initialize platform admins", error=str(e))
        raise


async def get_platform_admin_by_email(email: str, db_pool: asyncpg.Pool) -> Optional[PlatformAdmin]:
    """Get platform admin by email address"""
    try:
        async with db_pool.acquire() as connection:
            row = await connection.fetchrow("""
                SELECT id, email, name, is_active 
                FROM platform_admins 
                WHERE email = $1 AND is_active = true
            """, email.lower().strip())
            
            if row:
                return PlatformAdmin(**dict(row))
            return None
            
    except Exception as e:
        logger.error("Failed to fetch platform admin", email=email, error=str(e))
        return None


async def create_platform_admin_session(
    admin: PlatformAdmin, 
    request: Request,
    db_pool: asyncpg.Pool,
    expires_hours: int = 24
) -> str:
    """Create a new platform admin session and return session token"""
    try:
        session_id = str(uuid.uuid4())
        expires_at = datetime.utcnow() + timedelta(hours=expires_hours)
        
        async with db_pool.acquire() as connection:
            await connection.execute("""
                INSERT INTO platform_admin_sessions 
                (id, admin_id, expires_at, ip_address, user_agent)
                VALUES ($1, $2, $3, $4, $5)
            """, 
            session_id,
            admin.id,
            expires_at,
            request.client.host if request.client else None,
            request.headers.get("user-agent")
            )
            
            # Update admin's last login
            await connection.execute("""
                UPDATE platform_admins 
                SET last_login = CURRENT_TIMESTAMP, login_count = login_count + 1
                WHERE id = $1
            """, admin.id)
        
        logger.info("Platform admin session created", admin_email=admin.email, session_id=session_id)
        return session_id
        
    except Exception as e:
        logger.error("Failed to create platform admin session", admin_email=admin.email, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to create session")


async def get_current_platform_admin(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(platform_admin_security),
    db_pool: asyncpg.Pool = Depends(get_db_connection)
) -> PlatformAdmin:
    """
    Dependency to get current authenticated platform admin.
    Use this to protect platform admin endpoints.
    """
    if not credentials:
        raise HTTPException(status_code=401, detail="Platform admin authentication required")
    
    session_token = credentials.credentials
    
    try:
        async with db_pool.acquire() as connection:
            # Get admin info from session
            row = await connection.fetchrow("""
                SELECT pa.id, pa.email, pa.name, pa.is_active
                FROM platform_admin_sessions pas
                JOIN platform_admins pa ON pa.id = pas.admin_id
                WHERE pas.id = $1 
                  AND pas.is_active = true 
                  AND pas.expires_at > CURRENT_TIMESTAMP
                  AND pa.is_active = true
            """, session_token)
            
            if not row:
                raise HTTPException(status_code=401, detail="Invalid or expired platform admin session")
            
            return PlatformAdmin(**dict(row))
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to validate platform admin session", error=str(e))
        raise HTTPException(status_code=500, detail="Authentication error")


async def cleanup_expired_sessions(db_pool: asyncpg.Pool) -> None:
    """Clean up expired platform admin sessions"""
    try:
        async with db_pool.acquire() as connection:
            deleted_count = await connection.fetchval("""
                DELETE FROM platform_admin_sessions 
                WHERE expires_at < CURRENT_TIMESTAMP 
                RETURNING COUNT(*)
            """)
            
            if deleted_count > 0:
                logger.info("Cleaned up expired platform admin sessions", count=deleted_count)
                
    except Exception as e:
        logger.error("Failed to cleanup expired sessions", error=str(e))


# Convenience function for checking platform admin access
require_platform_admin = Depends(get_current_platform_admin)