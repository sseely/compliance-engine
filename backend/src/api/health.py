"""
Health check endpoints for zero downtime deployments
Provides liveness, readiness, and deep health checks
"""

from typing import Dict, Any
from datetime import datetime, timezone
import asyncio
import structlog
from fastapi import APIRouter, Response, status, HTTPException
from pydantic import BaseModel

from core.database import database_manager
from core.config import settings
from core.exceptions import DatabaseError
from fastapi_babel import _
from constants.strings import STRINGS
from utils.i18n_helpers import t, get_translator

logger = structlog.get_logger(__name__)

router = APIRouter()


class HealthResponse(BaseModel):
    """Health check response model"""
    status: str
    timestamp: str
    environment: str
    version: str
    checks: Dict[str, Any]


class LivenessResponse(BaseModel):
    """Liveness probe response"""
    status: str
    timestamp: str
    uptime_seconds: float


class ReadinessResponse(BaseModel):
    """Readiness probe response"""
    status: str
    timestamp: str
    checks: Dict[str, Any]


# Track application start time for uptime calculation
_app_start_time = datetime.now(timezone.utc)


@router.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """
    Basic health check endpoint
    Used for general health monitoring
    """
    timestamp = datetime.now(timezone.utc).isoformat()
    
    # Perform basic checks
    checks = {
        "api": t(STRINGS.COMMON.HEALTHY),
        "timestamp": timestamp,
        "environment": settings.ENVIRONMENT,
        "version": settings.VERSION
    }
    
    # Quick database connectivity check
    try:
        db_health = await database_manager.health_check()
        checks["database"] = t(db_health["status"])
    except Exception as e:
        logger.error("health_check_database_failed", error=str(e))
        checks["database"] = t(STRINGS.COMMON.UNHEALTHY)
    
    healthy_status = t(STRINGS.COMMON.HEALTHY)
    unhealthy_status = t(STRINGS.COMMON.UNHEALTHY)
    
    overall_status = healthy_status if all(
        check == healthy_status for check in checks.values() if isinstance(check, str)
    ) else unhealthy_status
    
    return HealthResponse(
        status=overall_status,
        timestamp=timestamp,
        environment=settings.ENVIRONMENT,
        version=settings.VERSION,
        checks=checks
    )


@router.get("/health/live", response_model=LivenessResponse, tags=["Health"])
async def liveness_probe():
    """
    Liveness probe for container health checks
    Used by ECS to determine if container should be restarted
    Should be fast and only check if the process is responsive
    """
    current_time = datetime.now(timezone.utc)
    uptime = (current_time - _app_start_time).total_seconds()
    
    return LivenessResponse(
        status=_("healthy"),
        timestamp=current_time.isoformat(),
        uptime_seconds=uptime
    )


@router.get("/health/ready", response_model=ReadinessResponse, tags=["Health"])
async def readiness_probe(response: Response):
    """
    Readiness probe for load balancer health checks
    Used by ALB to determine if container should receive traffic
    Checks all critical dependencies
    """
    timestamp = datetime.now(timezone.utc).isoformat()
    checks = {}
    overall_healthy = True
    
    # Database connectivity and stored procedures
    try:
        db_result = await database_manager.health_check()
        checks["database"] = {
            "status": db_result["status"],
            "response_time_ms": db_result.get("response_time_ms", 0)
        }
        if db_result["status"] != "healthy":
            overall_healthy = False
    except Exception as e:
        logger.error("readiness_database_check_failed", error=str(e))
        checks["database"] = {"status": _("unhealthy"), "error": str(e)}
        overall_healthy = False
    
    # Check stored procedure accessibility
    try:
        # Test a simple stored procedure call
        await database_manager.execute_procedure("health_check_database", fetch_mode="one")
        checks["stored_procedures"] = {"status": _("healthy")}
    except Exception as e:
        logger.error("readiness_stored_procedures_failed", error=str(e))
        checks["stored_procedures"] = {"status": _("unhealthy"), "error": str(e)}
        overall_healthy = False
    
    # Check configuration
    checks["configuration"] = {
        "status": _("healthy"),
        "environment": settings.ENVIRONMENT,
        "database_pool_size": settings.DATABASE_POOL_SIZE
    }
    
    # Memory usage check (basic)
    try:
        import psutil
        memory_percent = psutil.virtual_memory().percent
        checks["memory"] = {
            "status": "healthy" if memory_percent < 90 else "warning",
            "usage_percent": memory_percent
        }
        if memory_percent >= 95:
            overall_healthy = False
    except ImportError:
        # psutil not available, skip memory check
        checks["memory"] = {"status": "unavailable"}
    except Exception as e:
        checks["memory"] = {"status": "error", "error": str(e)}
    
    status_code = status.HTTP_200_OK if overall_healthy else status.HTTP_503_SERVICE_UNAVAILABLE
    response.status_code = status_code
    
    result_status = "ready" if overall_healthy else "not_ready"
    
    # Log readiness check result
    logger.info(
        "readiness_check",
        status=result_status,
        database_status=checks.get("database", {}).get("status"),
        sp_status=checks.get("stored_procedures", {}).get("status")
    )
    
    return ReadinessResponse(
        status=result_status,
        timestamp=timestamp,
        checks=checks
    )


@router.get("/health/deep", response_model=HealthResponse, tags=["Health"])
async def deep_health_check():
    """
    Comprehensive health check for system validation
    Used for manual verification and monitoring dashboards
    Not used for automated load balancer decisions
    """
    timestamp = datetime.now(timezone.utc).isoformat()
    checks = {}
    
    # Database comprehensive check
    try:
        start_time = datetime.now(timezone.utc)
        
        # Test database connection pool
        db_health = await database_manager.health_check()
        checks["database_connection"] = db_health
        
        # Test stored procedure execution
        sp_result = await database_manager.execute_procedure("health_check_database")
        checks["stored_procedures"] = {
            "status": "healthy" if sp_result else "unhealthy",
            "test_procedure": "health_check_database",
            "result_count": len(sp_result) if sp_result else 0
        }
        
        # Test database performance
        perf_start = datetime.now(timezone.utc)
        await database_manager.execute_procedure("health_check_connections")
        perf_duration = (datetime.now(timezone.utc) - perf_start).total_seconds() * 1000
        
        checks["database_performance"] = {
            "status": "healthy" if perf_duration < 1000 else "slow",
            "response_time_ms": perf_duration
        }
        
    except Exception as e:
        logger.error("deep_health_database_failed", error=str(e))
        checks["database_connection"] = {"status": "unhealthy", "error": str(e)}
        checks["stored_procedures"] = {"status": "unhealthy", "error": str(e)}
        checks["database_performance"] = {"status": "unhealthy", "error": str(e)}
    
    # Application configuration check
    checks["configuration"] = {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "version": settings.VERSION,
        "database_url_configured": bool(settings.DATABASE_URL),
        "api_prefix": settings.API_PREFIX,
        "log_level": settings.LOG_LEVEL,
        "cors_configured": bool(settings.ALLOWED_ORIGINS)
    }
    
    # System resources
    try:
        import psutil
        
        # CPU usage
        cpu_percent = psutil.cpu_percent(interval=1)
        checks["cpu"] = {
            "status": "healthy" if cpu_percent < 80 else "high",
            "usage_percent": cpu_percent
        }
        
        # Memory usage
        memory = psutil.virtual_memory()
        checks["memory"] = {
            "status": "healthy" if memory.percent < 80 else "high",
            "usage_percent": memory.percent,
            "available_gb": round(memory.available / (1024**3), 2)
        }
        
        # Disk usage
        disk = psutil.disk_usage('/')
        checks["disk"] = {
            "status": "healthy" if disk.percent < 85 else "high",
            "usage_percent": disk.percent,
            "free_gb": round(disk.free / (1024**3), 2)
        }
        
    except ImportError:
        checks["system_resources"] = {"status": "unavailable", "reason": "psutil not installed"}
    except Exception as e:
        checks["system_resources"] = {"status": "error", "error": str(e)}
    
    # External dependencies check (if any)
    checks["external_services"] = await _check_external_dependencies()
    
    # Feature flags and business logic
    checks["business_logic"] = {
        "status": "healthy",
        "supported_states": len(settings.SUPPORTED_STATES),
        "rate_limiting_enabled": settings.ENABLE_RATE_LIMITING,
        "circuit_breaker_enabled": settings.ENABLE_CIRCUIT_BREAKER
    }
    
    # Determine overall health
    unhealthy_checks = []
    for check_name, check_result in checks.items():
        if isinstance(check_result, dict) and check_result.get("status") == "unhealthy":
            unhealthy_checks.append(check_name)
    
    overall_status = "healthy" if not unhealthy_checks else "unhealthy"
    
    if unhealthy_checks:
        checks["overall"] = {
            "status": overall_status,
            "unhealthy_checks": unhealthy_checks
        }
    
    logger.info(
        "deep_health_check_completed",
        status=overall_status,
        unhealthy_checks=unhealthy_checks,
        check_count=len(checks)
    )
    
    return HealthResponse(
        status=overall_status,
        timestamp=timestamp,
        environment=settings.ENVIRONMENT,
        version=settings.VERSION,
        checks=checks
    )


async def _check_external_dependencies() -> Dict[str, Any]:
    """Check external service dependencies"""
    external_checks = {}
    
    # Add external service checks here as needed
    # For example: license verification services, email services, etc.
    
    # Placeholder for future external dependencies
    external_checks["placeholder"] = {
        "status": "healthy",
        "note": "No external dependencies configured yet"
    }
    
    return external_checks


@router.get("/health/startup", tags=["Health"])
async def startup_probe():
    """
    Startup probe for container initialization
    Used during container startup to wait for initialization
    """
    # Check if database manager is initialized
    if not database_manager._initialized:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Application still starting up"
        )
    
    # Quick database check
    try:
        await database_manager.execute_procedure("health_check_database", fetch_mode="one")
        return {"status": "started", "timestamp": datetime.now(timezone.utc).isoformat()}
    except Exception as e:
        logger.error("startup_probe_failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Application startup incomplete"
        )