"""
License Verification API
Secure license verification using stored procedures only
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, date
from enum import Enum
import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, validator
from slowapi import Limiter
from slowapi.util import get_remote_address

from core.database import database_manager
from core.security import security_manager
from core.exceptions import (
    ValidationError,
    BusinessLogicError, 
    NotFoundError,
    AuthenticationError
)
from core.config import settings
from core.logging_config import audit_logger
from fastapi_babel import _

logger = structlog.get_logger(__name__)
router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


class LicenseType(str, Enum):
    """Supported license types"""
    BUSINESS = "business"
    PROFESSIONAL = "professional" 
    CONTRACTOR = "contractor"
    RESELLER = "reseller"
    VENDOR = "vendor"


class LicenseStatus(str, Enum):
    """License verification status"""
    VALID = "valid"
    EXPIRED = "expired"
    SUSPENDED = "suspended"
    REVOKED = "revoked"
    NOT_FOUND = "not_found"
    PENDING = "pending"


class LicenseVerificationRequest(BaseModel):
    """License verification request model"""
    business_name: str = Field(..., min_length=2, max_length=200, description="Business name to verify")
    state: str = Field(..., min_length=2, max_length=2, description="Two-letter state code")
    license_type: LicenseType = Field(..., description="Type of license to verify")
    license_number: Optional[str] = Field(None, max_length=50, description="Specific license number (optional)")
    
    @validator('state')
    def validate_state(cls, v):
        if v.upper() not in settings.SUPPORTED_STATES:
            raise ValueError(f'State {v} is not supported')
        return v.upper()
    
    @validator('business_name')
    def validate_business_name(cls, v):
        # Basic sanitization and validation
        if not v.strip():
            raise ValueError('Business name cannot be empty')
        # Remove potentially dangerous characters
        cleaned = ''.join(c for c in v if c.isalnum() or c in ' .-,&')
        return cleaned.strip()


class LicenseInfo(BaseModel):
    """License information response"""
    license_id: str
    license_number: str
    business_name: str
    license_type: LicenseType
    status: LicenseStatus
    issue_date: Optional[date]
    expiration_date: Optional[date]
    issuing_authority: str
    verification_source: str
    last_verified: datetime


class LicenseVerificationResponse(BaseModel):
    """License verification response model"""
    request_id: str
    business_name: str
    state: str
    license_type: LicenseType
    verification_status: LicenseStatus
    licenses_found: List[LicenseInfo]
    verification_timestamp: datetime
    data_sources_checked: List[str]
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Verification confidence (0-1)")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            date: lambda v: v.isoformat()
        }


class LicenseHistoryRequest(BaseModel):
    """License history request model"""
    license_id: str = Field(..., description="License ID to get history for")
    start_date: Optional[date] = Field(None, description="Start date for history")
    end_date: Optional[date] = Field(None, description="End date for history")


class LicenseHistoryEntry(BaseModel):
    """License history entry"""
    event_id: str
    event_type: str
    event_date: datetime
    description: str
    source: str
    details: Optional[Dict[str, Any]]


class LicenseHistoryResponse(BaseModel):
    """License history response"""
    license_id: str
    business_name: str
    history: List[LicenseHistoryEntry]
    total_events: int


async def get_authenticated_customer(request: Request) -> Dict:
    """Dependency to get authenticated customer information"""
    customer_data = await security_manager.authenticate_request(request)
    
    if not customer_data:
        raise AuthenticationError("Valid API key required")
    
    # Check if customer has license verification permission
    has_permission = await security_manager.check_permissions(
        customer_data, 
        "license:verify"
    )
    
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions for license verification"
        )
    
    return customer_data


@router.post(
    "/verify",
    response_model=LicenseVerificationResponse,
    summary="Verify Business License",
    description="Verify a business license using stored procedures for maximum security"
)
@limiter.limit("10/minute")
async def verify_license(
    request: Request,
    verification_request: LicenseVerificationRequest,
    customer: Dict = Depends(get_authenticated_customer)
):
    """
    Verify a business license across multiple authoritative sources
    Uses stored procedures exclusively for database access
    """
    
    logger.info(
        "license_verification_requested",
        customer_id=customer["customer_id"],
        state=verification_request.state,
        license_type=verification_request.license_type.value,
        business_name_length=len(verification_request.business_name)
    )
    
    try:
        # Generate request ID for tracking
        request_id = f"lv_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{customer['customer_id'][:8]}"
        
        # Execute license verification stored procedure
        verification_result = await database_manager.execute_procedure(
            "verify_business_license",
            {
                "p_request_id": request_id,
                "p_customer_id": customer["customer_id"],
                "p_business_name": verification_request.business_name,
                "p_state_code": verification_request.state,
                "p_license_type": verification_request.license_type.value,
                "p_license_number": verification_request.license_number,
                "p_requester_ip": request.client.host if request.client else None
            }
        )
        
        if not verification_result:
            raise BusinessLogicError("License verification failed - no results returned")
        
        result_data = verification_result[0]
        
        # Parse licenses found
        licenses_found = []
        if result_data.get("licenses_data"):
            for license_data in result_data["licenses_data"]:
                licenses_found.append(LicenseInfo(
                    license_id=license_data["license_id"],
                    license_number=license_data["license_number"],
                    business_name=license_data["business_name"],
                    license_type=LicenseType(license_data["license_type"]),
                    status=LicenseStatus(license_data["status"]),
                    issue_date=license_data.get("issue_date"),
                    expiration_date=license_data.get("expiration_date"),
                    issuing_authority=license_data["issuing_authority"],
                    verification_source=license_data["verification_source"],
                    last_verified=license_data["last_verified"]
                ))
        
        # Log the verification for audit
        await database_manager.execute_audit_procedure(
            "audit_license_verification",
            {
                "p_request_id": request_id,
                "p_customer_id": customer["customer_id"],
                "p_verification_status": result_data["verification_status"],
                "p_licenses_found_count": len(licenses_found),
                "p_confidence_score": result_data["confidence_score"],
                "p_ip_address": request.client.host if request.client else None
            }
        )
        
        # Audit log for compliance
        audit_logger.log_user_action(
            user_id=customer["customer_id"],
            action="license_verification",
            resource="business_license",
            resource_id=request_id,
            ip_address=request.client.host if request.client else None,
            details={
                "state": verification_request.state,
                "license_type": verification_request.license_type.value,
                "verification_status": result_data["verification_status"],
                "licenses_found": len(licenses_found)
            }
        )
        
        response = LicenseVerificationResponse(
            request_id=request_id,
            business_name=verification_request.business_name,
            state=verification_request.state,
            license_type=verification_request.license_type,
            verification_status=LicenseStatus(result_data["verification_status"]),
            licenses_found=licenses_found,
            verification_timestamp=result_data["verification_timestamp"],
            data_sources_checked=result_data.get("data_sources_checked", []),
            confidence_score=result_data["confidence_score"]
        )
        
        logger.info(
            "license_verification_completed",
            request_id=request_id,
            customer_id=customer["customer_id"],
            verification_status=response.verification_status.value,
            licenses_found=len(licenses_found),
            confidence_score=response.confidence_score
        )
        
        return response
        
    except Exception as e:
        logger.error(
            "license_verification_failed",
            customer_id=customer["customer_id"],
            error=str(e),
            business_name=verification_request.business_name[:20]  # Truncated for privacy
        )
        
        # Still audit the failed attempt
        audit_logger.log_user_action(
            user_id=customer["customer_id"],
            action="license_verification_failed",
            resource="business_license",
            ip_address=request.client.host if request.client else None,
            details={
                "error": str(e),
                "state": verification_request.state,
                "license_type": verification_request.license_type.value
            }
        )
        
        raise BusinessLogicError(f"License verification failed: {str(e)}")


@router.post(
    "/history",
    response_model=LicenseHistoryResponse,
    summary="Get License History",
    description="Retrieve historical information for a specific license"
)
@limiter.limit("20/minute")
async def get_license_history(
    request: Request,
    history_request: LicenseHistoryRequest,
    customer: Dict = Depends(get_authenticated_customer)
):
    """
    Get historical information for a license
    Provides audit trail and status changes over time
    """
    
    logger.info(
        "license_history_requested",
        customer_id=customer["customer_id"],
        license_id=history_request.license_id
    )
    
    try:
        # Execute license history stored procedure
        history_result = await database_manager.execute_read_procedure(
            "get_license_history",
            {
                "p_license_id": history_request.license_id,
                "p_customer_id": customer["customer_id"],
                "p_start_date": history_request.start_date.isoformat() if history_request.start_date else None,
                "p_end_date": history_request.end_date.isoformat() if history_request.end_date else None
            }
        )
        
        if not history_result:
            raise NotFoundError("license", history_request.license_id)
        
        # Parse history entries
        history_entries = []
        business_name = ""
        
        for entry in history_result:
            if not business_name:
                business_name = entry.get("business_name", "")
                
            history_entries.append(LicenseHistoryEntry(
                event_id=entry["event_id"],
                event_type=entry["event_type"],
                event_date=entry["event_date"],
                description=entry["description"],
                source=entry["source"],
                details=entry.get("details")
            ))
        
        # Audit the history access
        audit_logger.log_data_access(
            user_id=customer["customer_id"],
            data_type="license_history",
            operation="read",
            record_count=len(history_entries),
            query_params={
                "license_id": history_request.license_id,
                "start_date": history_request.start_date.isoformat() if history_request.start_date else None,
                "end_date": history_request.end_date.isoformat() if history_request.end_date else None
            },
            ip_address=request.client.host if request.client else None
        )
        
        response = LicenseHistoryResponse(
            license_id=history_request.license_id,
            business_name=business_name,
            history=history_entries,
            total_events=len(history_entries)
        )
        
        logger.info(
            "license_history_retrieved",
            customer_id=customer["customer_id"],
            license_id=history_request.license_id,
            events_count=len(history_entries)
        )
        
        return response
        
    except NotFoundError:
        raise
    except Exception as e:
        logger.error(
            "license_history_failed",
            customer_id=customer["customer_id"],
            license_id=history_request.license_id,
            error=str(e)
        )
        raise BusinessLogicError(f"Failed to retrieve license history: {str(e)}")


@router.get(
    "/status/{license_id}",
    response_model=LicenseInfo,
    summary="Get License Status",
    description="Get current status of a specific license"
)
@limiter.limit("30/minute")
async def get_license_status(
    license_id: str,
    request: Request,
    customer: Dict = Depends(get_authenticated_customer)
):
    """
    Get current status and details for a specific license
    """
    
    try:
        # Execute license status stored procedure
        status_result = await database_manager.execute_read_procedure(
            "get_license_status",
            {
                "p_license_id": license_id,
                "p_customer_id": customer["customer_id"]
            }
        )
        
        if not status_result:
            raise NotFoundError("license", license_id)
        
        license_data = status_result[0]
        
        # Audit the status check
        audit_logger.log_data_access(
            user_id=customer["customer_id"],
            data_type="license_status",
            operation="read",
            query_params={"license_id": license_id},
            ip_address=request.client.host if request.client else None
        )
        
        return LicenseInfo(
            license_id=license_data["license_id"],
            license_number=license_data["license_number"],
            business_name=license_data["business_name"],
            license_type=LicenseType(license_data["license_type"]),
            status=LicenseStatus(license_data["status"]),
            issue_date=license_data.get("issue_date"),
            expiration_date=license_data.get("expiration_date"),
            issuing_authority=license_data["issuing_authority"],
            verification_source=license_data["verification_source"],
            last_verified=license_data["last_verified"]
        )
        
    except NotFoundError:
        raise
    except Exception as e:
        logger.error(
            "license_status_failed",
            customer_id=customer["customer_id"],
            license_id=license_id,
            error=str(e)
        )
        raise BusinessLogicError(f"Failed to get license status: {str(e)}")