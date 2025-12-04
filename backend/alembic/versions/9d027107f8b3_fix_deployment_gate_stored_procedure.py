"""fix_deployment_gate_stored_procedure

Revision ID: 9d027107f8b3
Revises: df7c1b597184
Create Date: 2025-11-02 15:13:39.255446

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
revision: str = '9d027107f8b3'
down_revision: Union[str, Sequence[str], None] = 'df7c1b597184'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Apply forward migration changes.
    Fix the update_deployment_gate stored procedure to properly set required_providers and max_days_old.
    """
    # Fix the update_deployment_gate procedure to set all required NOT NULL columns
    op.execute("""
        CREATE OR REPLACE FUNCTION update_deployment_gate(
            p_environment TEXT,
            p_evaluated_by TEXT DEFAULT NULL
        )
        RETURNS TABLE(
            gate_id UUID,
            deployment_allowed BOOLEAN,
            all_providers_verified BOOLEAN,
            evaluation_timestamp TIMESTAMPTZ
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        DECLARE
            v_gate_id UUID;
            v_summary RECORD;
            v_required_providers JSON := JSON_BUILD_ARRAY('google', 'azure-ad', 'linkedin', 'apple');
            v_max_days_old INTEGER := 10;
        BEGIN
            -- Get current verification summary
            SELECT * INTO v_summary FROM get_oidc_verification_summary(p_environment, v_max_days_old);
            
            v_gate_id := compliance_uuid();
            
            -- Insert deployment gate with all required fields
            INSERT INTO oidc_deployment_gates (
                id, environment, deployment_allowed, all_providers_verified,
                days_since_verification, last_verification_at,
                verified_providers, failed_providers, required_providers, max_days_old, evaluated_by
            ) VALUES (
                v_gate_id, p_environment, v_summary.deployment_allowed, v_summary.all_providers_verified,
                v_summary.days_since_verification, v_summary.last_verification,
                v_summary.verified_providers, v_summary.failed_providers, v_required_providers, v_max_days_old, p_evaluated_by
            );
            
            RETURN QUERY
            SELECT v_gate_id, v_summary.deployment_allowed, v_summary.all_providers_verified, NOW();
        END;
        $$;
    """)


def downgrade() -> None:
    """
    Rollback migration changes.
    Restore the original stored procedure.
    """
    # The original procedure will be restored by the previous migration's downgrade
    pass
