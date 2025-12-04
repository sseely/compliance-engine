"""
Analytics API endpoints for tracking user behavior and preferences.
Separate from core business logic for license verification.

ADMIN ACCESS LEVELS:
- Platform Admin: Compliance Engine employees who manage the entire platform
  * Can see global analytics across all customers
  * Can prioritize features and translations for the platform
  * Access to language request summaries, usage metrics, etc.

- Customer Admin: Admin users within a specific customer organization
  * Can only see their organization's data and settings
  * Cannot see other customers' data or global platform metrics
  * Access to their org's compliance reports, user management, etc.

This file contains PLATFORM ADMIN endpoints unless otherwise noted.
"""

from datetime import datetime
from typing import Optional
import hashlib
import hmac
import os

from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel, Field
import asyncpg

from core.database import database_manager
from core.config import settings
# Note: Platform admin auth will be implemented later


router = APIRouter(prefix="/analytics", tags=["analytics"])


class LanguageRequestCreate(BaseModel):
    """Request model for tracking language support requests."""
    language_code: str = Field(..., min_length=2, max_length=10, description="ISO language code (e.g., 'fr', 'de', 'zh-CN')")
    user_agent: Optional[str] = Field(None, max_length=1000, description="User agent string")
    referrer: Optional[str] = Field(None, max_length=1000, description="Referrer URL")


class LanguageRequestResponse(BaseModel):
    """Response model for language request tracking."""
    success: bool
    message: str


def generate_session_id(request: Request) -> str:
    """Generate a consistent session ID for the user based on IP and User-Agent."""
    # Use IP + User-Agent for basic session tracking
    # This is simple and doesn't require cookies/storage
    ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    
    # Create a hash to anonymize while maintaining consistency
    session_data = f"{ip}:{user_agent}:{datetime.now().strftime('%Y-%m-%d')}"
    session_hash = hashlib.sha256(session_data.encode()).hexdigest()
    return session_hash[:32]  # First 32 chars for readability


@router.post("/language-request", response_model=LanguageRequestResponse)
async def track_language_request(
    request_data: LanguageRequestCreate,
    request: Request,
):
    """
    Track a request for language support.
    
    This endpoint records when users request content in unsupported languages,
    helping prioritize future translation work.
    """
    try:
        # Extract request metadata
        ip_address = request.client.host if request.client else None
        session_id = generate_session_id(request)
        
        # Validate language code format (basic validation)
        lang_code = request_data.language_code.lower().strip()
        if not lang_code or len(lang_code) < 2:
            raise HTTPException(status_code=400, detail="Invalid language code")
        
        # Check if this session has already voted for this language (prevent flooding)
        async with database_manager._connection_pool.acquire() as connection:
            existing_vote = await connection.fetchval("""
                SELECT id FROM analytics_language_requests 
                WHERE session_id = $1 AND language_code = $2
            """, session_id, lang_code)
            
            if existing_vote:
                return LanguageRequestResponse(
                    success=True,
                    message=f"Language request for '{lang_code}' already recorded in this session"
                )
            
            # Insert new vote
            await connection.execute("""
                INSERT INTO analytics_language_requests 
                (language_code, user_agent, ip_address, referrer, session_id)
                VALUES ($1, $2, $3, $4, $5)
            """, 
            lang_code,
            request_data.user_agent,
            ip_address,
            request_data.referrer,
            session_id
            )
        
        return LanguageRequestResponse(
            success=True,
            message=f"Language request for '{lang_code}' recorded successfully"
        )
        
    except asyncpg.PostgresError as e:
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/language-requests/summary")
async def get_language_request_summary():
    # TODO: Re-enable platform admin authentication once implemented
    # current_admin: PlatformAdmin = require_platform_admin,
    """
    Get summary of language support requests.
    
    PLATFORM ADMIN ONLY - Returns aggregated data across ALL customers 
    showing which languages are most requested globally.
    
    This data is used to prioritize translation work for the entire platform.
    Customer admins should NOT have access to this cross-customer data.
    """
    try:
        async with database_manager._connection_pool.acquire() as connection:
            # Use the view we created for easy aggregation
            rows = await connection.fetch("""
                SELECT * FROM analytics_language_request_summary
                WHERE request_count > 0
                ORDER BY request_count DESC
                LIMIT 50
            """)
            
            # Convert to list of dicts
            summary = []
            for row in rows:
                summary.append({
                    "language_code": row["language_code"],
                    "request_count": row["request_count"],
                    "unique_ips": row["unique_ips"],
                    "unique_sessions": row["unique_sessions"],
                    "first_request": row["first_request"].isoformat() if row["first_request"] else None,
                    "last_request": row["last_request"].isoformat() if row["last_request"] else None,
                    "last_request_date": row["last_request_date"].isoformat() if row["last_request_date"] else None
                })
            
            return {
                "success": True,
                "data": summary,
                "total_languages": len(summary)
            }
            
    except asyncpg.PostgresError as e:
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")