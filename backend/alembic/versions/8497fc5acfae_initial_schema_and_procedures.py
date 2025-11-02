"""initial_schema_and_procedures

Revision ID: 8497fc5acfae
Revises: 
Create Date: 2025-11-02 05:27:34.525215

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8497fc5acfae'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Execute our schema SQL file
    schema_sql = open('src/database/schema.sql', 'r').read()
    op.execute(schema_sql)
    
    # Execute our procedures SQL file  
    procedures_sql = open('src/database/procedures.sql', 'r').read()
    op.execute(procedures_sql)


def downgrade() -> None:
    """Downgrade schema."""
    # Drop all procedures
    op.execute("DROP FUNCTION IF EXISTS authenticate_user CASCADE;")
    op.execute("DROP FUNCTION IF EXISTS create_api_key CASCADE;")
    op.execute("DROP FUNCTION IF EXISTS revoke_api_key CASCADE;")
    op.execute("DROP FUNCTION IF EXISTS verify_business_license CASCADE;")
    op.execute("DROP FUNCTION IF EXISTS get_license_history CASCADE;")
    op.execute("DROP FUNCTION IF EXISTS audit_license_verification CASCADE;")
    op.execute("DROP FUNCTION IF EXISTS audit_user_activity CASCADE;")
    op.execute("DROP FUNCTION IF EXISTS health_check_database CASCADE;")
    op.execute("DROP FUNCTION IF EXISTS health_check_connections CASCADE;")
    op.execute("DROP FUNCTION IF EXISTS get_customer_cors_settings CASCADE;")
    
    # Drop triggers
    op.execute("DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;")
    op.execute("DROP TRIGGER IF EXISTS update_license_records_updated_at ON license_records;")
    op.execute("DROP TRIGGER IF EXISTS update_cors_settings_updated_at ON customer_cors_settings;")
    op.execute("DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;")
    
    # Drop tables in reverse dependency order
    op.execute("DROP TABLE IF EXISTS cache.rate_limit_cache CASCADE;")
    op.execute("DROP TABLE IF EXISTS cache.license_verification_cache CASCADE;")
    op.execute("DROP TABLE IF EXISTS audit.system_events_log CASCADE;")
    op.execute("DROP TABLE IF EXISTS audit.data_access_log CASCADE;")
    op.execute("DROP TABLE IF EXISTS audit.user_activity_log CASCADE;")
    op.execute("DROP TABLE IF EXISTS license_verification_requests CASCADE;")
    op.execute("DROP TABLE IF EXISTS license_records CASCADE;")
    op.execute("DROP TABLE IF EXISTS license_sources CASCADE;")
    op.execute("DROP TABLE IF EXISTS license_types CASCADE;")
    op.execute("DROP TABLE IF EXISTS customer_cors_settings CASCADE;")
    op.execute("DROP TABLE IF EXISTS api_keys CASCADE;")
    op.execute("DROP TABLE IF EXISTS customers CASCADE;")
    
    # Drop schemas
    op.execute("DROP SCHEMA IF EXISTS cache CASCADE;")
    op.execute("DROP SCHEMA IF EXISTS audit CASCADE;")
