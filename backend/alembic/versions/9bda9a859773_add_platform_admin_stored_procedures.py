"""Add platform admin stored procedures

Revision ID: 9bda9a859773
Revises: 38dd5448d40b
Create Date: 2025-11-02 14:48:51.989629

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
revision: str = '9bda9a859773'
down_revision: Union[str, Sequence[str], None] = '38dd5448d40b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Apply forward migration changes.
    All changes must be backward compatible.
    """
    
    # Platform admin lookup by email
    op.execute("""
        CREATE OR REPLACE FUNCTION get_platform_admin_by_email(p_email TEXT)
        RETURNS TABLE(
            admin_id UUID,
            email VARCHAR(255),
            name VARCHAR(255),
            is_active BOOLEAN,
            permissions JSON,
            last_login_at TIMESTAMPTZ
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
            RETURN QUERY
            SELECT 
                pa.id,
                pa.email,
                pa.name,
                pa.is_active,
                pa.permissions,
                pa.last_login_at
            FROM platform_admins pa
            WHERE pa.email = p_email
            AND pa.is_active = true;
        END;
        $$;
    """)
    
    # Create platform admin session
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
    
    # Validate platform admin session
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
    
    # Cleanup expired sessions
    op.execute("""
        CREATE OR REPLACE FUNCTION cleanup_expired_platform_admin_sessions()
        RETURNS INTEGER
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        DECLARE
            v_deleted_count INTEGER;
        BEGIN
            DELETE FROM platform_admin_sessions WHERE expires_at < NOW();
            GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
            RETURN v_deleted_count;
        END;
        $$;
    """)
    
    # Create a default platform admin for development (optional)
    op.execute("""
        INSERT INTO platform_admins (email, name, is_active, permissions)
        VALUES ('admin@compliance-engine.dev', 'Development Admin', true, '["platform:admin", "oidc:verify"]')
        ON CONFLICT (email) DO NOTHING;
    """)


def downgrade() -> None:
    """
    Rollback migration changes.
    Should only undo additive changes, never remove data.
    """
    # Drop stored procedures (safe since they're just functions)
    op.execute("DROP FUNCTION IF EXISTS cleanup_expired_platform_admin_sessions();")
    op.execute("DROP FUNCTION IF EXISTS validate_platform_admin_session(TEXT);")
    op.execute("DROP FUNCTION IF EXISTS create_platform_admin_session(UUID, TEXT, TEXT, TEXT, INTEGER);")
    op.execute("DROP FUNCTION IF EXISTS get_platform_admin_by_email(TEXT);")
