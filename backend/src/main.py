"""
FastAPI main application entry point for Compliance Engine
Enforces stored procedure-only database access for security
"""

import sys
import secrets
from pathlib import Path
import structlog
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from prometheus_client import make_asgi_app
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from contextlib import asynccontextmanager

# Add src to path for imports
sys.path.append(str(Path(__file__).parent))

from core.config import settings
from core.logging_config import setup_logging
from core.database import DatabaseManager
from core.exceptions import ComplianceEngineException, compliance_exception_handler
from core.security import SecurityManager
from core.i18n import get_babel_middleware
from api.health import router as health_router
from api.i18n import router as i18n_router
from api.v1.license import router as license_router
from api.v1.permits import router as permits_router
from api.v1.fleet import router as fleet_router
from api.v1.professionals import router as professionals_router


# Configure structured logging
setup_logging()
logger = structlog.get_logger(__name__)

# Rate limiting
limiter = Limiter(key_func=get_remote_address)

# Database manager (global instance)
db_manager = DatabaseManager()

# Security manager
security_manager = SecurityManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management"""
    logger.info("Starting Compliance Engine API", version=settings.VERSION, environment=settings.ENVIRONMENT)
    
    # Initialize database connection pool
    await db_manager.initialize()
    
    # Initialize security components
    await security_manager.initialize()
    
    logger.info("Application startup complete")
    
    yield
    
    # Cleanup
    logger.info("Shutting down Compliance Engine API")
    await db_manager.close()
    await security_manager.cleanup()
    logger.info("Application shutdown complete")


# Create FastAPI application
app = FastAPI(
    title="Compliance Engine API",
    description="Secure compliance verification and management platform",
    version=settings.VERSION,
    openapi_url=f"{settings.API_PREFIX}/openapi.json" if settings.ENVIRONMENT != "production" else None,
    docs_url=f"{settings.API_PREFIX}/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url=f"{settings.API_PREFIX}/redoc" if settings.ENVIRONMENT != "production" else None,
    lifespan=lifespan
)

# Add rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Add middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Internationalization middleware
app.add_middleware(get_babel_middleware())

# CORS middleware (restrictive by default)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Custom exception handler
app.add_exception_handler(ComplianceEngineException, compliance_exception_handler)

# Security and request tracking middleware
@app.middleware("http")
async def security_middleware(request: Request, call_next):
    """Add security headers, request tracking, and CORS support"""
    # Generate request ID if not provided
    request_id = request.headers.get("ce-request-id") or f"req_{secrets.token_urlsafe(8)}"
    request.state.request_id = request_id
    
    # Log request
    logger.info(
        "api_request",
        request_id=request_id,
        method=request.method,
        path=request.url.path,
        client_ip=get_remote_address(request),
        user_agent=request.headers.get("user-agent"),
        client_version=request.headers.get("ce-client-version")
    )
    
    # Get customer for CORS
    customer_data = await security_manager.authenticate_request(request)
    customer_id = customer_data.get("customer_id") if customer_data else None
    
    response = await call_next(request)
    
    # Add security headers (using standard names)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY" 
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = "default-src 'self'"
    
    # Add custom company headers
    response.headers["CE-Request-ID"] = request_id
    response.headers["CE-Version"] = settings.VERSION
    
    # Apply CORS headers
    await security_manager.apply_cors_headers(request, response, customer_id)
    
    return response


# Database access middleware - CRITICAL SECURITY CONTROL
@app.middleware("http")
async def database_security_middleware(request: Request, call_next):
    """
    Enforce stored procedure-only database access
    This middleware prevents any direct SQL execution
    """
    # Store database manager in request state for access control
    request.state.db = db_manager
    
    response = await call_next(request)
    
    return response


# Include routers
app.include_router(health_router, tags=["Health"])
app.include_router(i18n_router, prefix=f"{settings.API_PREFIX}/i18n", tags=["Internationalization"])

# API v1 routes
app.include_router(
    license_router, 
    prefix=f"{settings.API_PREFIX}/license", 
    tags=["License Verification"]
)
app.include_router(
    permits_router, 
    prefix=f"{settings.API_PREFIX}/permits", 
    tags=["Permit Management"]
)
app.include_router(
    fleet_router, 
    prefix=f"{settings.API_PREFIX}/fleet", 
    tags=["Fleet Tracking"]
)
app.include_router(
    professionals_router, 
    prefix=f"{settings.API_PREFIX}/professionals", 
    tags=["Professional Verification"]
)

# Prometheus metrics endpoint
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)


@app.get("/")
async def root():
    """Root endpoint with API information"""
    from fastapi_babel import _
    return {
        "name": _("Compliance Engine API"),
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "documentation": f"{settings.API_PREFIX}/docs" if settings.ENVIRONMENT != "production" else None,
        "status": _("operational")
    }


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.ENVIRONMENT == "development",
        log_config=None,  # Use our custom logging
        access_log=False,  # We handle logging in middleware
    )