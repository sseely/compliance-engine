"""Fix ambiguous column reference in validate_platform_admin_session

Revision ID: 56b08fdb9953
Revises: 6c97e73ed607
Create Date: 2025-11-02 14:59:00.570519

MIGRATION SAFETY CHECKLIST:
- [ ] Changes are backward compatible with previous app version
- [ ] No columns/tables are dropped that current code uses
- [ ] New columns have appropriate defaults or are nullable
- [ ] Stored procedure signatures maintained for existing functions
- [ ] Migration can be safely rolled back
- [ ] Database changes tested with current application code

ROLLBACK STRATEGY:
- Application rollback: Traffic shift to previous version
- Database rollback: Only additive changes, no breaking removals
- Emergency: Point-in-time restore available with <5min RPO

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '56b08fdb9953'
down_revision: Union[str, Sequence[str], None] = '6c97e73ed607'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Apply forward migration changes.
    Fix ambiguous column reference in validate_platform_admin_session procedure.
    """
    
    # Fix the validate_platform_admin_session procedure
    op.execute("""
        CREATE OR REPLACE FUNCTION validate_platform_admin_session(p_session_token TEXT)
        RETURNS TABLE(
            admin_id UUID,
            email VARCHAR(255),
            name VARCHAR(255),
            permissions JSON,
            session_id UUID,
            expires_at TIMESTAMPTZ
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
            -- Clean up expired sessions first
            DELETE FROM platform_admin_sessions WHERE platform_admin_sessions.expires_at < NOW();
            
            RETURN QUERY
            SELECT 
                pa.id,
                pa.email,
                pa.name,
                pa.permissions,
                pas.id,
                pas.expires_at
            FROM platform_admin_sessions pas
            JOIN platform_admins pa ON pas.admin_id = pa.id
            WHERE pas.session_token = p_session_token
            AND pas.expires_at > NOW()
            AND pa.is_active = true;
        END;
        $$;
    """)


def downgrade() -> None:
    """
    Rollback migration changes.
    Restore original stored procedure.
    """
    # Restore the original procedure with the ambiguous reference
    op.execute("""
        CREATE OR REPLACE FUNCTION validate_platform_admin_session(p_session_token TEXT)
        RETURNS TABLE(
            admin_id UUID,
            email VARCHAR(255),
            name VARCHAR(255),
            permissions JSON,
            session_id UUID,
            expires_at TIMESTAMPTZ
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
            -- Clean up expired sessions first
            DELETE FROM platform_admin_sessions WHERE expires_at < NOW();
            
            RETURN QUERY
            SELECT 
                pa.id,
                pa.email,
                pa.name,
                pa.permissions,
                pas.id,
                pas.expires_at
            FROM platform_admin_sessions pas
            JOIN platform_admins pa ON pas.admin_id = pa.id
            WHERE pas.session_token = p_session_token
            AND pas.expires_at > NOW()
            AND pa.is_active = true;
        END;
        $$;
    """)
