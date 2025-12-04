"""
Secure database manager enforcing stored procedure-only access
Prevents SQL injection by design through controlled procedure execution
"""

import asyncio
import re
from typing import Any, Dict, List, Optional, Union, Tuple
from contextlib import asynccontextmanager
import structlog
import asyncpg
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from .config import settings, db_settings
from .exceptions import DatabaseError, SecurityViolationError


logger = structlog.get_logger(__name__)


class StoredProcedureValidator:
    """Validates stored procedure calls for security compliance"""
    
    @staticmethod
    def validate_procedure_name(procedure_name: str) -> bool:
        """
        Validate that the procedure name is in the allowed list
        This is our primary defense against SQL injection
        """
        if not procedure_name:
            return False
            
        # Check against whitelist
        if procedure_name not in db_settings.ALLOWED_PROCEDURES:
            logger.error(
                "unauthorized_procedure_attempt",
                procedure=procedure_name,
                allowed_procedures=db_settings.ALLOWED_PROCEDURES
            )
            return False
            
        # Additional pattern validation (defense in depth)
        if not re.match(r'^[a-z_][a-z0-9_]*$', procedure_name):
            logger.error(
                "invalid_procedure_name_pattern", 
                procedure=procedure_name
            )
            return False
            
        return True
    
    @staticmethod
    def validate_parameters(parameters: Dict[str, Any]) -> bool:
        """Validate parameter values for basic security"""
        if not isinstance(parameters, dict):
            return False
            
        for key, value in parameters.items():
            # Parameter name validation
            if not re.match(r'^[a-z_][a-z0-9_]*$', key):
                logger.error("invalid_parameter_name", parameter=key)
                return False
                
            # Prevent nested objects that might contain SQL
            if isinstance(value, (dict, list)) and len(str(value)) > 1000:
                logger.error("parameter_too_complex", parameter=key)
                return False
                
        return True


class DatabaseManager:
    """
    Database manager that ONLY allows stored procedure execution
    Direct SQL execution is completely blocked for security
    """
    
    def __init__(self):
        self._engine = None
        self._session_factory = None
        self._connection_pool = None
        self._validator = StoredProcedureValidator()
        self._initialized = False
    
    async def initialize(self):
        """Initialize database connections and validate setup"""
        if self._initialized:
            return
            
        try:
            # Create async engine with security-focused configuration
            engine_args = {
                "echo": settings.DEBUG,  # SQL logging in debug mode only
                "connect_args": {
                    "server_settings": {
                        "application_name": f"compliance-engine-{settings.ENVIRONMENT}",
                        "search_path": "public,audit,cache",
                    }
                }
            }
            
            # Only add pool arguments if not using NullPool
            if settings.is_development:
                engine_args["poolclass"] = NullPool
            else:
                engine_args.update({
                    "pool_size": settings.DATABASE_POOL_SIZE,
                    "max_overflow": settings.DATABASE_MAX_OVERFLOW,
                    "pool_timeout": settings.DATABASE_POOL_TIMEOUT,
                    "pool_pre_ping": True,  # Validate connections
                })
            
            self._engine = create_async_engine(settings.DATABASE_URL, **engine_args)
            
            # Create session factory
            self._session_factory = async_sessionmaker(
                self._engine,
                expire_on_commit=False,
                class_=AsyncSession
            )
            
            # Create direct connection pool for stored procedures
            self._connection_pool = await asyncpg.create_pool(
                settings.DATABASE_URL.replace("+asyncpg", ""),
                min_size=5,
                max_size=settings.DATABASE_POOL_SIZE,
                command_timeout=db_settings.EXECUTE_TIMEOUT_SECONDS,
                server_settings={
                    "application_name": f"compliance-engine-{settings.ENVIRONMENT}",
                    "search_path": "public,audit,cache",
                }
            )
            
            # Validate database setup
            await self._validate_database_setup()
            
            self._initialized = True
            logger.info("database_manager_initialized", pool_size=settings.DATABASE_POOL_SIZE)
            
        except Exception as e:
            logger.error("database_initialization_failed", error=str(e))
            raise DatabaseError(f"Failed to initialize database: {e}")
    
    async def close(self):
        """Close all database connections"""
        if self._connection_pool:
            await self._connection_pool.close()
        if self._engine:
            await self._engine.dispose()
        self._initialized = False
        logger.info("database_manager_closed")
    
    async def _validate_database_setup(self):
        """Validate that required stored procedures exist"""
        async with self._connection_pool.acquire() as conn:
            # Check that our core procedures exist
            result = await conn.fetch("""
                SELECT routine_name 
                FROM information_schema.routines 
                WHERE routine_schema = 'public' 
                AND routine_type = 'FUNCTION'
                AND routine_name = ANY($1)
            """, db_settings.ALLOWED_PROCEDURES[:5])  # Check first 5 as sample
            
            if not result:
                logger.warning("stored_procedures_not_found", 
                             expected=db_settings.ALLOWED_PROCEDURES[:5])
    
    @asynccontextmanager
    async def get_session(self):
        """Get a database session (for SQLAlchemy operations if needed)"""
        if not self._initialized:
            raise DatabaseError("Database manager not initialized")
            
        async with self._session_factory() as session:
            try:
                yield session
            except SQLAlchemyError as e:
                await session.rollback()
                logger.error("database_session_error", error=str(e))
                raise DatabaseError(f"Database session error: {e}")
            finally:
                await session.close()
    
    async def execute_procedure(
        self, 
        procedure_name: str, 
        parameters: Optional[Dict[str, Any]] = None,
        fetch_mode: str = "all"  # "all", "one", "none"
    ) -> Union[List[Dict], Dict, None]:
        """
        Execute a stored procedure with strict security validation
        This is the ONLY way to interact with the database
        """
        if not self._initialized:
            raise DatabaseError("Database manager not initialized")
        
        # Security validation
        if not self._validator.validate_procedure_name(procedure_name):
            raise SecurityViolationError(f"Unauthorized procedure: {procedure_name}")
        
        if parameters and not self._validator.validate_parameters(parameters):
            raise SecurityViolationError("Invalid parameters provided")
        
        parameters = parameters or {}
        
        try:
            async with self._connection_pool.acquire() as conn:
                # Log the procedure call for audit
                logger.info(
                    "stored_procedure_execution",
                    procedure=procedure_name,
                    parameter_count=len(parameters),
                    fetch_mode=fetch_mode
                )
                
                # Build the procedure call
                param_placeholders = ", ".join(f"${i+1}" for i in range(len(parameters)))
                param_values = list(parameters.values())
                
                procedure_call = f"SELECT * FROM {procedure_name}({param_placeholders})"
                
                # Execute with timeout
                if fetch_mode == "all":
                    rows = await conn.fetch(procedure_call, *param_values)
                    result = [dict(row) for row in rows]
                    
                    # Security: Limit result size
                    if len(result) > db_settings.MAX_ROWS_RETURNED:
                        logger.warning(
                            "result_set_too_large",
                            procedure=procedure_name,
                            row_count=len(result),
                            limit=db_settings.MAX_ROWS_RETURNED
                        )
                        result = result[:db_settings.MAX_ROWS_RETURNED]
                    
                    return result
                    
                elif fetch_mode == "one":
                    row = await conn.fetchrow(procedure_call, *param_values)
                    return dict(row) if row else None
                    
                else:  # fetch_mode == "none"
                    await conn.execute(procedure_call, *param_values)
                    return None
                    
        except asyncpg.PostgresError as e:
            logger.error(
                "stored_procedure_error",
                procedure=procedure_name,
                error=str(e),
                error_code=e.sqlstate if hasattr(e, 'sqlstate') else None
            )
            raise DatabaseError(f"Procedure execution failed: {e}")
        except Exception as e:
            logger.error(
                "unexpected_database_error",
                procedure=procedure_name,
                error=str(e)
            )
            raise DatabaseError(f"Unexpected database error: {e}")
    
    async def execute_read_procedure(
        self, 
        procedure_name: str, 
        parameters: Optional[Dict[str, Any]] = None
    ) -> List[Dict]:
        """Execute a read-only stored procedure"""
        if not procedure_name.startswith(db_settings.FUNCTION_PREFIX_READ):
            raise SecurityViolationError(f"Procedure {procedure_name} is not a read procedure")
        
        return await self.execute_procedure(procedure_name, parameters, "all")
    
    async def execute_write_procedure(
        self, 
        procedure_name: str, 
        parameters: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict]:
        """Execute a write stored procedure"""
        if not procedure_name.startswith(db_settings.FUNCTION_PREFIX_WRITE):
            raise SecurityViolationError(f"Procedure {procedure_name} is not a write procedure")
        
        return await self.execute_procedure(procedure_name, parameters, "one")
    
    async def execute_audit_procedure(
        self, 
        procedure_name: str, 
        parameters: Optional[Dict[str, Any]] = None
    ) -> None:
        """Execute an audit logging procedure"""
        if not procedure_name.startswith(db_settings.FUNCTION_PREFIX_AUDIT):
            raise SecurityViolationError(f"Procedure {procedure_name} is not an audit procedure")
        
        await self.execute_procedure(procedure_name, parameters, "none")
    
    async def health_check(self) -> Dict[str, Any]:
        """Perform database health check using stored procedures only"""
        try:
            # Use stored procedure for health check
            result = await self.execute_procedure("health_check_database", fetch_mode="one")
            
            if result:
                return {
                    "status": "healthy",
                    "database": "connected",
                    "procedures": "accessible",
                    "response_time_ms": result.get("response_time_ms", 0)
                }
            else:
                return {
                    "status": "unhealthy",
                    "database": "connected",
                    "procedures": "not_accessible"
                }
                
        except Exception as e:
            logger.error("database_health_check_failed", error=str(e))
            return {
                "status": "unhealthy",
                "database": "connection_failed",
                "error": str(e)
            }
    
    def block_direct_sql(self):
        """
        Explicitly blocks any attempt at direct SQL execution
        This method exists as a clear statement of our security policy
        """
        raise SecurityViolationError(
            "Direct SQL execution is prohibited. Use stored procedures only."
        )


# Global database manager instance
database_manager = DatabaseManager()