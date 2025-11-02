"""
Structured logging configuration for Compliance Engine
Provides secure, auditable logging for compliance requirements
"""

import logging
import sys
from typing import Any, Dict
from datetime import datetime, timezone
import structlog
from pythonjsonlogger import jsonlogger

from .config import settings


def setup_logging():
    """Configure structured logging for the application"""
    
    # Clear any existing handlers
    logging.root.handlers = []
    
    # Configure timestamper
    timestamper = structlog.processors.TimeStamper(fmt="ISO")
    
    # Configure processors based on environment
    if settings.LOG_FORMAT == "json":
        processors = [
            structlog.processors.add_log_level,
            structlog.processors.StackInfoRenderer(),
            timestamper,
            structlog.dev.set_exc_info,
            SecurityLogProcessor(),
            ComplianceLogProcessor(),
            structlog.processors.JSONRenderer()
        ]
    else:
        processors = [
            structlog.processors.add_log_level,
            timestamper,
            structlog.dev.set_exc_info,
            SecurityLogProcessor(),
            ComplianceLogProcessor(),
            structlog.dev.ConsoleRenderer(colors=settings.is_development)
        ]
    
    # Configure structlog
    structlog.configure(
        processors=processors,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )
    
    # Configure standard library logging
    formatter = jsonlogger.JsonFormatter(
        fmt='%(asctime)s %(name)s %(levelname)s %(message)s',
        datefmt='%Y-%m-%dT%H:%M:%S'
    ) if settings.LOG_FORMAT == "json" else logging.Formatter(
        fmt='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    
    # Set log level
    log_level = getattr(logging, settings.LOG_LEVEL.upper())
    handler.setLevel(log_level)
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.addHandler(handler)
    root_logger.setLevel(log_level)
    
    # Reduce noise from third-party libraries
    logging.getLogger("uvicorn").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("asyncpg").setLevel(logging.WARNING)
    
    # Security: Disable SQL echo in production
    if settings.is_production:
        logging.getLogger("sqlalchemy.engine").setLevel(logging.ERROR)


class SecurityLogProcessor:
    """
    Processor to ensure sensitive data is not logged
    Critical for compliance and security
    """
    
    SENSITIVE_FIELDS = {
        'password', 'passwd', 'secret', 'token', 'key', 'authorization',
        'credit_card', 'ssn', 'social_security', 'api_key', 'private_key',
        'jwt', 'session', 'cookie', 'auth', 'credential'
    }
    
    def __call__(self, logger, method_name, event_dict):
        """Remove or mask sensitive information from logs"""
        
        # Recursively sanitize the event dictionary
        self._sanitize_dict(event_dict)
        
        return event_dict
    
    def _sanitize_dict(self, data: Dict[str, Any]) -> None:
        """Recursively sanitize a dictionary"""
        if not isinstance(data, dict):
            return
            
        for key, value in list(data.items()):
            key_lower = key.lower()
            
            # Check if field name contains sensitive keywords
            if any(sensitive in key_lower for sensitive in self.SENSITIVE_FIELDS):
                data[key] = "[REDACTED]"
            elif isinstance(value, dict):
                self._sanitize_dict(value)
            elif isinstance(value, list):
                for item in value:
                    if isinstance(item, dict):
                        self._sanitize_dict(item)
            elif isinstance(value, str) and len(value) > 20:
                # Check if value looks like a token or key
                if self._looks_like_secret(value):
                    data[key] = f"[REDACTED:{len(value)} chars]"
    
    def _looks_like_secret(self, value: str) -> bool:
        """Heuristic to detect if a string looks like a secret"""
        # Check for common secret patterns
        if len(value) > 30 and any(c.isdigit() and c.isupper() for c in value):
            return True
        
        # Check for base64-like patterns
        if len(value) > 20 and value.replace('+', '').replace('/', '').replace('=', '').isalnum():
            return True
            
        return False


class ComplianceLogProcessor:
    """
    Processor to add compliance-related metadata to logs
    Ensures audit trail requirements are met
    """
    
    def __call__(self, logger, method_name, event_dict):
        """Add compliance metadata to log events"""
        
        # Add environment and application context
        event_dict.setdefault("environment", settings.ENVIRONMENT)
        event_dict.setdefault("application", "compliance-engine")
        event_dict.setdefault("version", settings.VERSION)
        
        # Add ISO 8601 timestamp for compliance
        if "timestamp" not in event_dict:
            event_dict["timestamp"] = datetime.now(timezone.utc).isoformat()
        
        # Add log level if not present
        if "level" not in event_dict and "log_level" in event_dict:
            event_dict["level"] = event_dict["log_level"]
        
        # For audit events, ensure required fields are present
        if event_dict.get("event_type") == "audit":
            self._ensure_audit_fields(event_dict)
        
        # For security events, add security context
        if "security" in str(event_dict.get("event", "")).lower():
            event_dict["event_category"] = "security"
            event_dict["requires_investigation"] = True
        
        return event_dict
    
    def _ensure_audit_fields(self, event_dict: Dict[str, Any]) -> None:
        """Ensure audit events have required fields for compliance"""
        required_fields = [
            "user_id", "action", "resource", "timestamp", "ip_address"
        ]
        
        for field in required_fields:
            if field not in event_dict:
                event_dict[field] = "unknown"
        
        # Mark as audit event for log aggregation
        event_dict["audit_event"] = True


class AuditLogger:
    """
    Specialized logger for audit events
    Ensures compliance with audit logging requirements
    """
    
    def __init__(self):
        self.logger = structlog.get_logger("audit")
    
    def log_user_action(
        self,
        user_id: str,
        action: str,
        resource: str,
        resource_id: str = None,
        ip_address: str = None,
        user_agent: str = None,
        details: Dict[str, Any] = None
    ):
        """Log a user action for audit purposes"""
        
        audit_data = {
            "event_type": "audit",
            "user_id": user_id,
            "action": action,
            "resource": resource,
            "resource_id": resource_id,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "details": details or {},
            "compliance_event": True
        }
        
        # Remove None values
        audit_data = {k: v for k, v in audit_data.items() if v is not None}
        
        self.logger.info("user_action", **audit_data)
    
    def log_api_access(
        self,
        endpoint: str,
        method: str,
        user_id: str = None,
        api_key_id: str = None,
        ip_address: str = None,
        response_status: int = None,
        response_time_ms: float = None
    ):
        """Log API access for audit purposes"""
        
        audit_data = {
            "event_type": "audit",
            "event_category": "api_access",
            "endpoint": endpoint,
            "method": method,
            "user_id": user_id,
            "api_key_id": api_key_id,
            "ip_address": ip_address,
            "response_status": response_status,
            "response_time_ms": response_time_ms,
            "compliance_event": True
        }
        
        # Remove None values
        audit_data = {k: v for k, v in audit_data.items() if v is not None}
        
        self.logger.info("api_access", **audit_data)
    
    def log_data_access(
        self,
        user_id: str,
        data_type: str,
        operation: str,
        record_count: int = None,
        query_params: Dict[str, Any] = None,
        ip_address: str = None
    ):
        """Log data access for compliance"""
        
        audit_data = {
            "event_type": "audit", 
            "event_category": "data_access",
            "user_id": user_id,
            "data_type": data_type,
            "operation": operation,
            "record_count": record_count,
            "query_params": query_params,
            "ip_address": ip_address,
            "compliance_event": True
        }
        
        # Remove None values
        audit_data = {k: v for k, v in audit_data.items() if v is not None}
        
        self.logger.info("data_access", **audit_data)


# Global audit logger instance
audit_logger = AuditLogger()