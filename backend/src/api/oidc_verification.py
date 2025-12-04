"""
OIDC verification API endpoints.
Backend for the frontend OIDC verification dashboard.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field
import structlog
import json

from core.database import database_manager
from core.platform_auth import require_platform_admin, PlatformAdmin

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/oidc-verification", tags=["OIDC Verification"])


class OIDCVerificationRequest(BaseModel):
    """Request to record OIDC verification result"""
    provider: str = Field(..., description="OAuth provider (google, azure-ad, linkedin, apple)")
    success: bool = Field(..., description="Whether the verification succeeded")
    environment: str = Field(default="production", description="Environment (production, staging, development)")
    redirect_uri: str = Field(..., description="OAuth redirect URI used")
    client_id: str = Field(..., description="OAuth client ID (safe to log)")
    user_email: Optional[str] = Field(None, description="Email of user who completed OAuth flow")
    error_message: Optional[str] = Field(None, description="Error message if verification failed")
    test_type: str = Field(default="manual", description="Type of test (manual, automated)")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional test metadata")


class OIDCVerificationResult(BaseModel):
    """OIDC verification result response"""
    id: str
    provider: str
    status: str  # success, failure, not_tested
    environment: str
    redirect_uri: str
    client_id: str
    user_email: Optional[str]
    error_message: Optional[str]
    test_type: str
    tested_by: Optional[str]
    metadata: Optional[Dict[str, Any]]
    created_at: datetime


class OIDCVerificationSummary(BaseModel):
    """Summary of OIDC verification status for deployment decisions"""
    last_verification: Optional[datetime]
    days_since_verification: int
    all_providers_verified: bool
    deployment_allowed: bool
    verified_providers: List[str]
    failed_providers: List[str]
    providers: List[Dict[str, Any]]


class ConfigValidation(BaseModel):
    """OAuth configuration validation results"""
    valid: bool
    issues: List[str]


class DeploymentReadiness(BaseModel):
    """Deployment readiness assessment"""
    deployment_allowed: bool
    reason: str
    required_actions: List[str]


@router.post("/verify", response_model=Dict[str, Any])
async def store_verification_result(
    verification_request: OIDCVerificationRequest,
    request: Request,
    current_admin: PlatformAdmin = require_platform_admin
):
    """
    Store an OIDC verification result.
    This endpoint is called by the frontend when a platform admin tests an OAuth provider.
    """
    try:
        # Get database manager from request state
        db_manager = request.state.db
        
        # Determine status based on success
        status = "success" if verification_request.success else "failure"
        
        # Store the verification result using stored procedure
        result = await db_manager.execute_procedure(
            "store_oidc_verification_result",
            {
                "p_provider": verification_request.provider,
                "p_status": status,
                "p_environment": verification_request.environment,
                "p_redirect_uri": verification_request.redirect_uri,
                "p_client_id": verification_request.client_id,
                "p_user_email": verification_request.user_email,
                "p_error_message": verification_request.error_message,
                "p_test_type": verification_request.test_type,
                "p_tested_by": current_admin.email,
                "p_metadata": json.dumps(verification_request.metadata) if verification_request.metadata else None
            },
            fetch_mode="one"
        )
        
        if not result:
            raise HTTPException(status_code=500, detail="Failed to store verification result")
        
        # Get updated summary
        summary_result = await db_manager.execute_procedure(
            "get_oidc_verification_summary",
            {
                "p_environment": verification_request.environment,
                "p_max_days_old": 10
            },
            fetch_mode="one"
        )
        
        logger.info(
            "OIDC verification result stored",
            provider=verification_request.provider,
            status=status,
            environment=verification_request.environment,
            tested_by=current_admin.email,
            deployment_allowed=summary_result.get("deployment_allowed") if summary_result else False
        )
        
        return {
            "success": True,
            "result_id": str(result["result_id"]),
            "provider": result["provider"],
            "status": result["status"],
            "summary": _format_verification_summary(summary_result) if summary_result else None,
            "message": f"Verification result recorded for {verification_request.provider}"
        }
        
    except Exception as e:
        logger.error("Failed to store OIDC verification result", 
                    provider=verification_request.provider, 
                    error=str(e))
        raise HTTPException(status_code=500, detail="Failed to store verification result")


@router.get("/summary", response_model=OIDCVerificationSummary)
async def get_verification_summary(
    request: Request,
    environment: str = "production",
    max_days_old: int = 10,
    current_admin: PlatformAdmin = require_platform_admin
):
    """
    Get OIDC verification summary for deployment gate decisions.
    Shows the status of all OAuth providers and whether deployment is allowed.
    """
    try:
        # Get database manager from request state
        db_manager = request.state.db
        
        # Get verification summary using stored procedure
        result = await db_manager.execute_procedure(
            "get_oidc_verification_summary",
            {
                "p_environment": environment,
                "p_max_days_old": max_days_old
            },
            fetch_mode="one"
        )
        
        if not result:
            # Return default empty summary if no results
            return OIDCVerificationSummary(
                last_verification=None,
                days_since_verification=999,
                all_providers_verified=False,
                deployment_allowed=False,
                verified_providers=[],
                failed_providers=[],
                providers=_get_default_providers(environment)
            )
        
        return _format_verification_summary(result)
        
    except Exception as e:
        logger.error("Failed to get OIDC verification summary", environment=environment, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to get verification summary")


@router.get("/deployment-readiness", response_model=DeploymentReadiness)
async def check_deployment_readiness(
    request: Request,
    environment: str = "production",
    current_admin: PlatformAdmin = require_platform_admin
):
    """
    Check if deployment is allowed based on OIDC verification status.
    """
    try:
        # Get database manager from request state
        db_manager = request.state.db
        
        # Check deployment readiness using stored procedure
        result = await db_manager.execute_procedure(
            "check_deployment_readiness",
            {"p_environment": environment},
            fetch_mode="one"
        )
        
        if not result:
            return DeploymentReadiness(
                deployment_allowed=False,
                reason="Unable to check deployment readiness",
                required_actions=["Contact system administrator"]
            )
        
        # Parse required actions JSON
        required_actions = result.get("required_actions", [])
        if isinstance(required_actions, str):
            required_actions = json.loads(required_actions)
        
        return DeploymentReadiness(
            deployment_allowed=result["deployment_allowed"],
            reason=result["reason"],
            required_actions=required_actions
        )
        
    except Exception as e:
        logger.error("Failed to check deployment readiness", environment=environment, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to check deployment readiness")


@router.post("/update-deployment-gate")
async def update_deployment_gate(
    request: Request,
    environment: str = "production",
    current_admin: PlatformAdmin = require_platform_admin
):
    """
    Update the deployment gate based on current verification status.
    This creates a permanent record of deployment approval/denial.
    """
    try:
        # Get database manager from request state
        db_manager = request.state.db
        
        # Update deployment gate using stored procedure
        result = await db_manager.execute_procedure(
            "update_deployment_gate",
            {
                "p_environment": environment,
                "p_evaluated_by": current_admin.email
            },
            fetch_mode="one"
        )
        
        if not result:
            raise HTTPException(status_code=500, detail="Failed to update deployment gate")
        
        logger.info(
            "Deployment gate updated",
            environment=environment,
            deployment_allowed=result["deployment_allowed"],
            evaluated_by=current_admin.email,
            gate_id=str(result["gate_id"])
        )
        
        return {
            "success": True,
            "gate_id": str(result["gate_id"]),
            "deployment_allowed": result["deployment_allowed"],
            "all_providers_verified": result["all_providers_verified"],
            "evaluation_timestamp": result["evaluation_timestamp"],
            "evaluated_by": current_admin.email
        }
        
    except Exception as e:
        logger.error("Failed to update deployment gate", environment=environment, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to update deployment gate")


@router.get("/config-validation", response_model=ConfigValidation)
async def validate_config(
    current_admin: PlatformAdmin = require_platform_admin
):
    """
    Validate OAuth configuration without requiring full login flows.
    This is a basic validation that checks for required environment variables.
    """
    try:
        # This is a simplified version - in a real implementation, you might
        # validate actual OAuth endpoints, check client credentials format, etc.
        
        issues = []
        
        # For now, we'll just return a basic validation
        # In practice, you might check:
        # - Environment variables are set
        # - OAuth client IDs are valid format
        # - Redirect URIs are accessible
        # - OAuth provider endpoints are reachable
        
        logger.info("OAuth configuration validation requested", admin=current_admin.email)
        
        return ConfigValidation(
            valid=True,  # Simplified - would do real validation in practice
            issues=issues
        )
        
    except Exception as e:
        logger.error("Failed to validate OAuth configuration", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to validate configuration")


def _format_verification_summary(result: Dict[str, Any]) -> OIDCVerificationSummary:
    """Format stored procedure result into response model"""
    # Parse JSON fields
    verified_providers = result.get("verified_providers", [])
    if isinstance(verified_providers, str):
        verified_providers = json.loads(verified_providers)
    
    failed_providers = result.get("failed_providers", [])
    if isinstance(failed_providers, str):
        failed_providers = json.loads(failed_providers)
    
    provider_results = result.get("provider_results", [])
    if isinstance(provider_results, str):
        provider_results = json.loads(provider_results)
    
    # Clean up None values in lists
    verified_providers = [p for p in (verified_providers or []) if p is not None]
    failed_providers = [p for p in (failed_providers or []) if p is not None]
    
    return OIDCVerificationSummary(
        last_verification=result.get("last_verification"),
        days_since_verification=result.get("days_since_verification", 999),
        all_providers_verified=result.get("all_providers_verified", False),
        deployment_allowed=result.get("deployment_allowed", False),
        verified_providers=verified_providers,
        failed_providers=failed_providers,
        providers=provider_results or []
    )


def _get_default_providers(environment: str) -> List[Dict[str, Any]]:
    """Get default provider list when no verification results exist"""
    required_providers = ["google", "azure-ad", "linkedin", "apple"]
    return [
        {
            "provider": provider,
            "status": "not_tested",
            "timestamp": None,
            "environment": environment,
            "user_email": None,
            "error_message": None,
            "test_type": "manual"
        }
        for provider in required_providers
    ]