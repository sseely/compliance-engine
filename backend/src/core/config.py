"""
Application configuration using Pydantic Settings
Secure configuration management with environment variable support
"""

from typing import List, Optional
from pydantic import Field, validator
from pydantic_settings import BaseSettings
import secrets


class Settings(BaseSettings):
    """Application settings with security-first defaults"""
    
    # Application Information
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = Field(default="development", description="Environment: development, qa, production")
    API_PREFIX: str = "/api/v1"
    DEBUG: bool = Field(default=False, description="Enable debug mode")
    
    # Database Configuration
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/compliance_engine",
        description="PostgreSQL database URL"
    )
    DATABASE_POOL_SIZE: int = Field(default=10, description="Database connection pool size")
    DATABASE_MAX_OVERFLOW: int = Field(default=20, description="Maximum database connection overflow")
    DATABASE_POOL_TIMEOUT: int = Field(default=30, description="Database connection timeout in seconds")
    
    # Security Configuration
    SECRET_KEY: str = Field(default_factory=lambda: secrets.token_urlsafe(32), description="Secret key for JWT tokens")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30, description="Access token expiration in minutes")
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7, description="Refresh token expiration in days")
    
    # API Security
    ALLOWED_ORIGINS: List[str] = Field(default=["http://localhost:3000"], description="CORS allowed origins")
    RATE_LIMIT_REQUESTS: int = Field(default=100, description="Rate limit requests per minute")
    RATE_LIMIT_WINDOW: int = Field(default=60, description="Rate limit window in seconds")
    
    # External APIs
    CLAUDE_API_KEY: Optional[str] = Field(default=None, description="Claude API key for AI operations")
    
    # AWS Configuration
    AWS_REGION: str = Field(default="us-east-1", description="AWS region")
    AWS_ACCESS_KEY_ID: Optional[str] = Field(default=None, description="AWS access key ID")
    AWS_SECRET_ACCESS_KEY: Optional[str] = Field(default=None, description="AWS secret access key")
    AWS_ENDPOINT_URL: Optional[str] = Field(default=None, description="AWS endpoint URL (for LocalStack)")
    
    # S3 Configuration
    S3_BUCKET_DOCUMENTS: str = Field(default="compliance-documents-dev", description="S3 bucket for documents")
    S3_BUCKET_LOGS: str = Field(default="compliance-logs-dev", description="S3 bucket for logs")
    
    # Logging Configuration
    LOG_LEVEL: str = Field(default="INFO", description="Logging level")
    LOG_FORMAT: str = Field(default="json", description="Log format: json or text")
    
    # Monitoring Configuration
    ENABLE_METRICS: bool = Field(default=True, description="Enable Prometheus metrics")
    METRICS_PORT: int = Field(default=8001, description="Metrics server port")
    
    # Feature Flags
    ENABLE_API_DOCS: bool = Field(default=True, description="Enable API documentation endpoints")
    ENABLE_RATE_LIMITING: bool = Field(default=True, description="Enable API rate limiting")
    ENABLE_CIRCUIT_BREAKER: bool = Field(default=True, description="Enable circuit breaker for external APIs")
    
    # Business Configuration
    LICENSE_CACHE_TTL_SECONDS: int = Field(default=3600, description="License verification cache TTL")
    MAX_DOCUMENT_SIZE_MB: int = Field(default=10, description="Maximum document upload size in MB")
    SUPPORTED_STATES: List[str] = Field(
        default=[
            "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
            "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
            "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
            "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
            "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC"
        ],
        description="Supported US states and territories"
    )
    
    @validator('ENVIRONMENT')
    def validate_environment(cls, v):
        allowed = ['development', 'qa', 'production']
        if v not in allowed:
            raise ValueError(f'Environment must be one of {allowed}')
        return v
    
    @validator('LOG_LEVEL')
    def validate_log_level(cls, v):
        allowed = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']
        if v.upper() not in allowed:
            raise ValueError(f'Log level must be one of {allowed}')
        return v.upper()
    
    @validator('DATABASE_URL')
    def validate_database_url(cls, v):
        if not v.startswith(('postgresql://', 'postgresql+asyncpg://')):
            raise ValueError('Database URL must be a PostgreSQL connection string')
        return v
    
    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"
    
    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"
    
    @property
    def database_url_sync(self) -> str:
        """Synchronous database URL for Alembic migrations"""
        return self.DATABASE_URL.replace("+asyncpg", "")
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "forbid"  # Prevent unknown configuration values


# Global settings instance
settings = Settings()


# Database-specific settings for stored procedures
class DatabaseSettings:
    """Database configuration specific to stored procedure architecture"""
    
    # Schema names
    SCHEMA_PUBLIC = "public"
    SCHEMA_AUDIT = "audit"
    SCHEMA_CACHE = "cache"
    
    # Function naming conventions
    FUNCTION_PREFIX_READ = "get_"
    FUNCTION_PREFIX_WRITE = "upsert_"
    FUNCTION_PREFIX_DELETE = "delete_"
    FUNCTION_PREFIX_AUDIT = "audit_"
    
    # Security settings
    EXECUTE_TIMEOUT_SECONDS = 30
    MAX_ROWS_RETURNED = 10000
    REQUIRE_SECURITY_DEFINER = True
    
    # Allowed stored procedure patterns (whitelist approach)
    ALLOWED_PROCEDURES = [
        # License verification procedures
        "verify_business_license",
        "get_license_history", 
        "update_license_status",
        "audit_license_verification",
        
        # Permit management procedures
        "create_permit_application",
        "get_permit_status",
        "update_permit_workflow",
        "get_permit_requirements",
        
        # Fleet tracking procedures
        "register_vehicle",
        "update_vehicle_status",
        "get_fleet_compliance",
        "audit_vehicle_inspection",
        
        # Professional verification procedures
        "verify_professional_license",
        "get_certification_status",
        "update_professional_record",
        
        # User management procedures
        "authenticate_user",
        "create_api_key",
        "revoke_api_key",
        "audit_user_activity",
        
        # Health check procedures
        "health_check_database",
        "health_check_connections",
    ]


# Database settings instance
db_settings = DatabaseSettings()