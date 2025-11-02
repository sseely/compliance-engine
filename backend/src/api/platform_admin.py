"""
Platform admin management endpoints.
These are for Compliance Engine employees to manage the platform.
"""

from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, EmailStr, Field
import asyncpg
import structlog

from ..core.database import get_db_connection
from ..core.platform_auth import (
    require_platform_admin, 
    PlatformAdmin,
    create_platform_admin_session,
    get_platform_admin_by_email
)

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/platform-admin", tags=["Platform Administration"])


class PlatformAdminCreate(BaseModel):
    """Request to create a new platform admin"""
    email: EmailStr
    name: str = Field(..., min_length=2, max_length=255)


class PlatformAdminResponse(BaseModel):
    """Platform admin response model"""
    id: int
    email: str
    name: str
    is_active: bool
    created_at: datetime
    created_by: Optional[str]
    last_login: Optional[datetime]
    login_count: int


class LoginRequest(BaseModel):
    """Platform admin login request"""
    email: EmailStr


class LoginResponse(BaseModel):
    """Platform admin login response"""
    success: bool
    session_token: Optional[str] = None
    admin: Optional[PlatformAdminResponse] = None
    message: str


@router.post("/login", response_model=LoginResponse)
async def platform_admin_login(
    login_data: LoginRequest,
    request: Request,
    db_pool = Depends(get_db_connection)
):
    """
    Platform admin login endpoint.
    
    In production, this should integrate with your SSO/OAuth provider.
    For now, it creates a session for any email in the platform_admins table.
    """
    try:
        admin = await get_platform_admin_by_email(login_data.email, db_pool)
        
        if not admin:
            # Don't reveal whether the email exists or not
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        # Create session
        session_token = await create_platform_admin_session(admin, request, db_pool)
        
        # Get full admin details for response
        async with db_pool.acquire() as connection:
            row = await connection.fetchrow("""
                SELECT id, email, name, is_active, created_at, created_by, last_login, login_count
                FROM platform_admins 
                WHERE id = $1
            """, admin.id)
            
            admin_response = PlatformAdminResponse(**dict(row))
        
        return LoginResponse(
            success=True,
            session_token=session_token,
            admin=admin_response,
            message="Login successful"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Platform admin login failed", email=login_data.email, error=str(e))
        raise HTTPException(status_code=500, detail="Login failed")


@router.get("/me", response_model=PlatformAdminResponse)
async def get_current_admin_info(
    current_admin: PlatformAdmin = require_platform_admin,
    db_pool = Depends(get_db_connection)
):
    """Get current platform admin's information"""
    try:
        async with db_pool.acquire() as connection:
            row = await connection.fetchrow("""
                SELECT id, email, name, is_active, created_at, created_by, last_login, login_count
                FROM platform_admins 
                WHERE id = $1
            """, current_admin.id)
            
            if not row:
                raise HTTPException(status_code=404, detail="Admin not found")
            
            return PlatformAdminResponse(**dict(row))
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get admin info", admin_id=current_admin.id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to get admin information")


@router.get("/admins", response_model=List[PlatformAdminResponse])
async def list_platform_admins(
    current_admin: PlatformAdmin = require_platform_admin,
    db_pool = Depends(get_db_connection)
):
    """List all platform admins (requires platform admin access)"""
    try:
        async with db_pool.acquire() as connection:
            rows = await connection.fetch("""
                SELECT id, email, name, is_active, created_at, created_by, last_login, login_count
                FROM platform_admins 
                ORDER BY created_at ASC
            """)
            
            return [PlatformAdminResponse(**dict(row)) for row in rows]
            
    except Exception as e:
        logger.error("Failed to list platform admins", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to list admins")


@router.post("/admins", response_model=PlatformAdminResponse)
async def create_platform_admin(
    admin_data: PlatformAdminCreate,
    current_admin: PlatformAdmin = require_platform_admin,
    db_pool = Depends(get_db_connection)
):
    """Create a new platform admin (requires existing platform admin access)"""
    try:
        async with db_pool.acquire() as connection:
            # Check if admin already exists
            existing = await connection.fetchval("""
                SELECT id FROM platform_admins WHERE email = $1
            """, admin_data.email.lower())
            
            if existing:
                raise HTTPException(status_code=400, detail="Admin with this email already exists")
            
            # Create new admin
            row = await connection.fetchrow("""
                INSERT INTO platform_admins (email, name, created_by)
                VALUES ($1, $2, $3)
                RETURNING id, email, name, is_active, created_at, created_by, last_login, login_count
            """, admin_data.email.lower(), admin_data.name, current_admin.email)
            
            logger.info("Platform admin created", 
                       new_admin_email=admin_data.email, 
                       created_by=current_admin.email)
            
            return PlatformAdminResponse(**dict(row))
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to create platform admin", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to create admin")


@router.put("/admins/{admin_id}/deactivate")
async def deactivate_platform_admin(
    admin_id: int,
    current_admin: PlatformAdmin = require_platform_admin,
    db_pool = Depends(get_db_connection)
):
    """Deactivate a platform admin (requires platform admin access)"""
    try:
        if admin_id == current_admin.id:
            raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
        
        async with db_pool.acquire() as connection:
            # Deactivate the admin
            result = await connection.execute("""
                UPDATE platform_admins 
                SET is_active = false 
                WHERE id = $1 AND is_active = true
            """, admin_id)
            
            if result == "UPDATE 0":
                raise HTTPException(status_code=404, detail="Admin not found or already deactivated")
            
            # Deactivate all their sessions
            await connection.execute("""
                UPDATE platform_admin_sessions 
                SET is_active = false 
                WHERE admin_id = $1
            """, admin_id)
            
            logger.info("Platform admin deactivated", 
                       deactivated_admin_id=admin_id, 
                       deactivated_by=current_admin.email)
            
            return {"success": True, "message": "Admin deactivated successfully"}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to deactivate platform admin", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to deactivate admin")