"""Fix ambiguous column reference in stored procedure

Revision ID: 6c97e73ed607
Revises: 9bda9a859773
Create Date: 2025-11-02 14:56:31.268467

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
revision: str = '6c97e73ed607'
down_revision: Union[str, Sequence[str], None] = '9bda9a859773'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Apply forward migration changes.
    Fix ambiguous column reference in create_platform_admin_session procedure.
    """
    
    # Fix the create_platform_admin_session procedure
    op.execute("""
        CREATE OR REPLACE FUNCTION create_platform_admin_session(
            p_admin_id UUID,
            p_session_token TEXT,
            p_ip_address TEXT DEFAULT NULL,
            p_user_agent TEXT DEFAULT NULL,
            p_expires_hours INTEGER DEFAULT 24
        )
        RETURNS TABLE(
            session_id UUID,
            session_token TEXT,
            expires_at TIMESTAMPTZ
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        DECLARE
            v_session_id UUID;
            v_expires_at TIMESTAMPTZ;
        BEGIN
            v_session_id := compliance_uuid();
            v_expires_at := NOW() + (p_expires_hours || ' hours')::INTERVAL;
            
            -- Clean up any existing sessions for this admin (optional - limit concurrent sessions)
            DELETE FROM platform_admin_sessions 
            WHERE admin_id = p_admin_id 
            AND platform_admin_sessions.expires_at < NOW();
            
            -- Insert new session
            INSERT INTO platform_admin_sessions (
                id, admin_id, session_token, ip_address, user_agent, expires_at
            ) VALUES (
                v_session_id, p_admin_id, p_session_token, p_ip_address, p_user_agent, v_expires_at
            );
            
            -- Update last login time
            UPDATE platform_admins 
            SET last_login_at = NOW() 
            WHERE id = p_admin_id;
            
            RETURN QUERY
            SELECT v_session_id, p_session_token, v_expires_at;
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
        CREATE OR REPLACE FUNCTION create_platform_admin_session(
            p_admin_id UUID,
            p_session_token TEXT,
            p_ip_address TEXT DEFAULT NULL,
            p_user_agent TEXT DEFAULT NULL,
            p_expires_hours INTEGER DEFAULT 24
        )
        RETURNS TABLE(
            session_id UUID,
            session_token TEXT,
            expires_at TIMESTAMPTZ
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        DECLARE
            v_session_id UUID;
            v_expires_at TIMESTAMPTZ;
        BEGIN
            v_session_id := compliance_uuid();
            v_expires_at := NOW() + (p_expires_hours || ' hours')::INTERVAL;
            
            -- Clean up any existing sessions for this admin (optional - limit concurrent sessions)
            DELETE FROM platform_admin_sessions 
            WHERE admin_id = p_admin_id 
            AND expires_at < NOW();
            
            -- Insert new session
            INSERT INTO platform_admin_sessions (
                id, admin_id, session_token, ip_address, user_agent, expires_at
            ) VALUES (
                v_session_id, p_admin_id, p_session_token, p_ip_address, p_user_agent, v_expires_at
            );
            
            -- Update last login time
            UPDATE platform_admins 
            SET last_login_at = NOW() 
            WHERE id = p_admin_id;
            
            RETURN QUERY
            SELECT v_session_id, p_session_token, v_expires_at;
        END;
        $$;
    """)
