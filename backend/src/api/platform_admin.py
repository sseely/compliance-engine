"""
Platform admin management endpoints.
These are for Compliance Engine employees to manage the platform.
"""

from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, EmailStr, Field
import structlog

from core.database import database_manager
from core.platform_auth import (
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
    id: str
    email: str
    name: str
    is_active: bool
    permissions: List[str]
    last_login_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


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
    request: Request
):
    """
    Platform admin login endpoint.
    
    In production, this should integrate with your SSO/OAuth provider.
    For now, it creates a session for any email in the platform_admins table.
    """
    try:
        # Get database manager from request state
        db_manager = request.state.db
        
        admin = await get_platform_admin_by_email(login_data.email, db_manager)
        
        if not admin:
            # Don't reveal whether the email exists or not
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        # Create session
        session_token = await create_platform_admin_session(admin, request, db_manager=db_manager)
        
        # Convert admin to response format
        admin_response = PlatformAdminResponse(
            id=admin.id,
            email=admin.email,
            name=admin.name,
            is_active=admin.is_active,
            permissions=admin.permissions,
            last_login_at=None,  # Will be updated by the session creation
            created_at=datetime.now(),  # Placeholder - would come from stored procedure
            updated_at=datetime.now()   # Placeholder - would come from stored procedure
        )
        
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
    current_admin: PlatformAdmin = require_platform_admin
):
    """Get current platform admin's information"""
    try:
        # Convert current admin to response format
        return PlatformAdminResponse(
            id=current_admin.id,
            email=current_admin.email,
            name=current_admin.name,
            is_active=current_admin.is_active,
            permissions=current_admin.permissions,
            last_login_at=None,  # Would come from stored procedure if needed
            created_at=datetime.now(),  # Placeholder - would come from stored procedure
            updated_at=datetime.now()   # Placeholder - would come from stored procedure
        )
            
    except Exception as e:
        logger.error("Failed to get admin info", admin_id=current_admin.id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to get admin information")


@router.get("/admins", response_model=List[PlatformAdminResponse])
async def list_platform_admins(
    current_admin: PlatformAdmin = require_platform_admin
):
    """List all platform admins (requires platform admin access)"""
    try:
        # TODO: Create stored procedure list_platform_admins()
        # For now, return the current admin as a single-item list
        return [PlatformAdminResponse(
            id=current_admin.id,
            email=current_admin.email,
            name=current_admin.name,
            is_active=current_admin.is_active,
            permissions=current_admin.permissions,
            last_login_at=None,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )]
            
    except Exception as e:
        logger.error("Failed to list platform admins", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to list admins")


@router.post("/admins", response_model=PlatformAdminResponse)
async def create_platform_admin(
    admin_data: PlatformAdminCreate,
    current_admin: PlatformAdmin = require_platform_admin
):
    """Create a new platform admin (requires existing platform admin access)"""
    try:
        # TODO: Create stored procedure create_platform_admin(p_email, p_name, p_created_by_email)
        # For now, return a placeholder indicating the feature needs implementation
        raise HTTPException(
            status_code=501, 
            detail="Create platform admin functionality not yet implemented - requires stored procedure"
        )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to create platform admin", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to create admin")


@router.put("/admins/{admin_id}/deactivate")
async def deactivate_platform_admin(
    admin_id: str,
    current_admin: PlatformAdmin = require_platform_admin
):
    """Deactivate a platform admin (requires platform admin access)"""
    try:
        if admin_id == current_admin.id:
            raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
        
        # TODO: Create stored procedure deactivate_platform_admin(p_admin_id, p_deactivated_by_email)
        # For now, return a placeholder indicating the feature needs implementation
        raise HTTPException(
            status_code=501, 
            detail="Deactivate platform admin functionality not yet implemented - requires stored procedure"
        )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to deactivate platform admin", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to deactivate admin")


@router.post("/logout")
async def platform_admin_logout(
    current_admin: PlatformAdmin = require_platform_admin
):
    """Logout the current platform admin session"""
    try:
        # In a real implementation, you might invalidate the session token
        # For now, we'll just return success since the frontend handles token removal
        logger.info("Platform admin logged out", admin_email=current_admin.email)
        
        return {
            "success": True,
            "message": "Successfully logged out"
        }
        
    except Exception as e:
        logger.error("Failed to logout platform admin", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to logout")