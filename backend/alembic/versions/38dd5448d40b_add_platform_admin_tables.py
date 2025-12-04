"""Add platform admin tables

Revision ID: 38dd5448d40b
Revises: e5179840af0f
Create Date: 2025-11-02 14:48:15.318078

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
revision: str = '38dd5448d40b'
down_revision: Union[str, Sequence[str], None] = 'e5179840af0f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Apply forward migration changes.
    All changes must be backward compatible.
    """
    
    # Platform admin users table
    op.create_table('platform_admins',
        sa.Column('id', sa.UUID, primary_key=True, server_default=sa.text('compliance_uuid()')),
        sa.Column('email', sa.String(255), unique=True, nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('is_active', sa.Boolean, nullable=False, default=True),
        sa.Column('permissions', sa.JSON, nullable=False, default=['platform:admin']),
        sa.Column('last_login_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Index('idx_platform_admins_email', 'email'),
        sa.Index('idx_platform_admins_active', 'is_active')
    )
    
    # Platform admin sessions table
    op.create_table('platform_admin_sessions',
        sa.Column('id', sa.UUID, primary_key=True, server_default=sa.text('compliance_uuid()')),
        sa.Column('admin_id', sa.UUID, sa.ForeignKey('platform_admins.id', ondelete='CASCADE'), nullable=False),
        sa.Column('session_token', sa.String(255), unique=True, nullable=False),
        sa.Column('ip_address', sa.String(45), nullable=True),  # Support IPv6
        sa.Column('user_agent', sa.Text, nullable=True),
        sa.Column('expires_at', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Index('idx_platform_admin_sessions_token', 'session_token'),
        sa.Index('idx_platform_admin_sessions_admin', 'admin_id'),
        sa.Index('idx_platform_admin_sessions_expires', 'expires_at')
    )


def downgrade() -> None:
    """
    Rollback migration changes.
    Should only undo additive changes, never remove data.
    """
    # Drop tables in reverse order due to foreign key constraints
    op.drop_table('platform_admin_sessions')
    op.drop_table('platform_admins')
