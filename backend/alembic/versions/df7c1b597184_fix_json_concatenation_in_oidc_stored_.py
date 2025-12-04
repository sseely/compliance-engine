"""Fix JSON concatenation in OIDC stored procedures

Revision ID: df7c1b597184
Revises: 6fdbe902fceb
Create Date: 2025-11-02 15:08:35.644588

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
revision: str = 'df7c1b597184'
down_revision: Union[str, Sequence[str], None] = '6fdbe902fceb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Apply forward migration changes.
    Fix JSON concatenation issues in OIDC stored procedures.
    """
    
    # Fix the get_oidc_verification_summary procedure with proper JSON handling
    op.execute("""
        CREATE OR REPLACE FUNCTION get_oidc_verification_summary(
            p_environment TEXT DEFAULT 'production',
            p_max_days_old INTEGER DEFAULT 10
        )
        RETURNS TABLE(
            last_verification TIMESTAMPTZ,
            days_since_verification INTEGER,
            all_providers_verified BOOLEAN,
            deployment_allowed BOOLEAN,
            verified_providers JSON,
            failed_providers JSON,
            provider_results JSON
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        DECLARE
            v_last_verification TIMESTAMPTZ;
            v_days_since INTEGER;
            v_all_verified BOOLEAN := false;
            v_deployment_allowed BOOLEAN := false;
            v_verified_providers JSON;
            v_failed_providers JSON;
            v_provider_results JSON;
            v_required_providers TEXT[] := ARRAY['google', 'azure-ad', 'linkedin', 'apple'];
            v_provider TEXT;
            v_provider_results_array JSON[] := ARRAY[]::JSON[];
        BEGIN
            -- Get the most recent verification result for each provider in this environment
            WITH latest_per_provider AS (
                SELECT DISTINCT ON (provider) 
                    provider, status, created_at, user_email, error_message, test_type
                FROM oidc_verification_results 
                WHERE environment = p_environment
                ORDER BY provider, created_at DESC
            ),
            provider_summary AS (
                SELECT 
                    provider,
                    status,
                    created_at,
                    user_email,
                    error_message,
                    test_type,
                    CASE WHEN status = 'success' THEN provider ELSE NULL END as verified_provider,
                    CASE WHEN status = 'failure' THEN provider ELSE NULL END as failed_provider
                FROM latest_per_provider
            )
            SELECT 
                MAX(created_at),
                COALESCE(EXTRACT(DAYS FROM (NOW() - MAX(created_at)))::INTEGER, 999),
                COUNT(*) FILTER (WHERE status = 'success') = array_length(v_required_providers, 1),
                (COUNT(*) FILTER (WHERE status = 'success') = array_length(v_required_providers, 1) 
                 AND COALESCE(EXTRACT(DAYS FROM (NOW() - MAX(created_at)))::INTEGER, 999) <= p_max_days_old),
                JSON_AGG(verified_provider) FILTER (WHERE verified_provider IS NOT NULL),
                JSON_AGG(failed_provider) FILTER (WHERE failed_provider IS NOT NULL),
                JSON_AGG(JSON_BUILD_OBJECT(
                    'provider', provider,
                    'status', status,
                    'timestamp', created_at,
                    'environment', p_environment,
                    'user_email', user_email,
                    'error_message', error_message,
                    'test_type', test_type
                ))
            INTO v_last_verification, v_days_since, v_all_verified, v_deployment_allowed, 
                 v_verified_providers, v_failed_providers, v_provider_results
            FROM provider_summary;
            
            -- Add missing providers as not_tested using array concatenation
            FOR v_provider IN SELECT unnest(v_required_providers) LOOP
                IF NOT EXISTS (
                    SELECT 1 FROM oidc_verification_results 
                    WHERE provider = v_provider AND environment = p_environment
                ) THEN
                    v_provider_results_array := v_provider_results_array || JSON_BUILD_OBJECT(
                        'provider', v_provider,
                        'status', 'not_tested',
                        'timestamp', NULL,
                        'environment', p_environment,
                        'user_email', NULL,
                        'error_message', NULL,
                        'test_type', 'manual'
                    );
                END IF;
            END LOOP;
            
            -- Combine existing results with missing providers
            IF array_length(v_provider_results_array, 1) > 0 THEN
                IF v_provider_results IS NULL THEN
                    v_provider_results := array_to_json(v_provider_results_array);
                ELSE
                    -- Combine the arrays
                    SELECT JSON_AGG(elem)
                    INTO v_provider_results
                    FROM (
                        SELECT elem FROM JSON_ARRAY_ELEMENTS(v_provider_results) AS elem
                        UNION ALL
                        SELECT elem FROM JSON_ARRAY_ELEMENTS(array_to_json(v_provider_results_array)) AS elem
                    ) combined(elem);
                END IF;
            END IF;
            
            -- Set defaults if no results
            v_last_verification := COALESCE(v_last_verification, NULL);
            v_days_since := COALESCE(v_days_since, 999);
            v_verified_providers := COALESCE(v_verified_providers, '[]'::JSON);
            v_failed_providers := COALESCE(v_failed_providers, '[]'::JSON);
            v_provider_results := COALESCE(v_provider_results, '[]'::JSON);
            
            RETURN QUERY
            SELECT v_last_verification, v_days_since, v_all_verified, v_deployment_allowed,
                   v_verified_providers, v_failed_providers, v_provider_results;
        END;
        $$;
    """)


def downgrade() -> None:
    """
    Rollback migration changes.
    Restore original stored procedure.
    """
    # The original procedure will be restored by the previous migration's downgrade
