"""Add OIDC verification tables

Revision ID: 3a9077211d6e
Revises: 56b08fdb9953
Create Date: 2025-11-02 15:06:44.396159

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
revision: str = '3a9077211d6e'
down_revision: Union[str, Sequence[str], None] = '56b08fdb9953'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Apply forward migration changes.
    Create OIDC verification tracking tables.
    """
    
    # OIDC verification results table
    op.create_table('oidc_verification_results',
        sa.Column('id', sa.UUID, primary_key=True, server_default=sa.text('compliance_uuid()')),
        sa.Column('provider', sa.String(50), nullable=False),  # google, azure-ad, linkedin, apple
        sa.Column('status', sa.String(20), nullable=False),  # success, failure, not_tested
        sa.Column('environment', sa.String(20), nullable=False),  # production, staging, development
        sa.Column('redirect_uri', sa.String(500), nullable=False),
        sa.Column('client_id', sa.String(200), nullable=False),
        sa.Column('user_email', sa.String(255), nullable=True),
        sa.Column('error_message', sa.Text, nullable=True),
        sa.Column('test_type', sa.String(20), nullable=False, default='manual'),  # manual, automated
        sa.Column('tested_by', sa.String(255), nullable=True),  # email of person who ran the test
        sa.Column('metadata', sa.JSON, nullable=True),  # Additional test metadata
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        
        # Indexes for common queries
        sa.Index('idx_oidc_verification_provider_env', 'provider', 'environment'),
        sa.Index('idx_oidc_verification_status', 'status'),
        sa.Index('idx_oidc_verification_created', 'created_at'),
        sa.Index('idx_oidc_verification_environment', 'environment')
    )
    
    # OIDC deployment gates table - tracks deployment approvals
    op.create_table('oidc_deployment_gates',
        sa.Column('id', sa.UUID, primary_key=True, server_default=sa.text('compliance_uuid()')),
        sa.Column('environment', sa.String(20), nullable=False),
        sa.Column('deployment_allowed', sa.Boolean, nullable=False, default=False),
        sa.Column('all_providers_verified', sa.Boolean, nullable=False, default=False),
        sa.Column('days_since_verification', sa.Integer, nullable=True),
        sa.Column('last_verification_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('verified_providers', sa.JSON, nullable=False, default='[]'),  # List of successfully verified providers
        sa.Column('failed_providers', sa.JSON, nullable=False, default='[]'),  # List of failed providers
        sa.Column('required_providers', sa.JSON, nullable=False, default='["google", "azure-ad", "linkedin", "apple"]'),
        sa.Column('max_days_old', sa.Integer, nullable=False, default=10),
        sa.Column('evaluated_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('evaluated_by', sa.String(255), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        
        # Ensure only one active gate per environment
        sa.Index('idx_oidc_deployment_gates_env', 'environment'),
        sa.Index('idx_oidc_deployment_gates_allowed', 'deployment_allowed'),
        sa.Index('idx_oidc_deployment_gates_evaluated', 'evaluated_at')
    )


def downgrade() -> None:
    """
    Rollback migration changes.
    Drop OIDC verification tables.
    """
    # Drop tables in reverse order
    op.drop_table('oidc_deployment_gates')
    op.drop_table('oidc_verification_results')
