"""Add OIDC verification stored procedures

Revision ID: 6fdbe902fceb
Revises: 3a9077211d6e
Create Date: 2025-11-02 15:07:13.798227

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
revision: str = '6fdbe902fceb'
down_revision: Union[str, Sequence[str], None] = '3a9077211d6e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Apply forward migration changes.
    Create OIDC verification stored procedures.
    """
    
    # Store OIDC verification result
    op.execute("""
        CREATE OR REPLACE FUNCTION store_oidc_verification_result(
            p_provider TEXT,
            p_status TEXT,
            p_environment TEXT,
            p_redirect_uri TEXT,
            p_client_id TEXT,
            p_user_email TEXT DEFAULT NULL,
            p_error_message TEXT DEFAULT NULL,
            p_test_type TEXT DEFAULT 'manual',
            p_tested_by TEXT DEFAULT NULL,
            p_metadata JSON DEFAULT NULL
        )
        RETURNS TABLE(
            result_id UUID,
            provider TEXT,
            status TEXT,
            environment TEXT,
            created_at TIMESTAMPTZ
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        DECLARE
            v_result_id UUID;
        BEGIN
            v_result_id := compliance_uuid();
            
            -- Insert the verification result
            INSERT INTO oidc_verification_results (
                id, provider, status, environment, redirect_uri, client_id,
                user_email, error_message, test_type, tested_by, metadata
            ) VALUES (
                v_result_id, p_provider, p_status, p_environment, p_redirect_uri, p_client_id,
                p_user_email, p_error_message, p_test_type, p_tested_by, p_metadata
            );
            
            RETURN QUERY
            SELECT v_result_id, p_provider, p_status, p_environment, NOW();
        END;
        $$;
    """)
    
    # Get OIDC verification summary for deployment gate decisions
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
            v_latest_results JSON := '[]'::JSON;
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
            
            -- Add missing providers as not_tested
            FOR v_provider IN SELECT unnest(v_required_providers) LOOP
                IF NOT EXISTS (
                    SELECT 1 FROM oidc_verification_results 
                    WHERE provider = v_provider AND environment = p_environment
                ) THEN
                    v_provider_results := v_provider_results || JSON_BUILD_OBJECT(
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
    
    # Check deployment readiness
    op.execute("""
        CREATE OR REPLACE FUNCTION check_deployment_readiness(
            p_environment TEXT DEFAULT 'production'
        )
        RETURNS TABLE(
            deployment_allowed BOOLEAN,
            reason TEXT,
            required_actions JSON
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        DECLARE
            v_summary RECORD;
            v_reason TEXT;
            v_actions JSON := '[]'::JSON;
        BEGIN
            -- Get verification summary
            SELECT * INTO v_summary FROM get_oidc_verification_summary(p_environment);
            
            IF v_summary.deployment_allowed THEN
                v_reason := 'All OAuth providers verified and within time limit';
            ELSIF NOT v_summary.all_providers_verified THEN
                v_reason := 'Not all OAuth providers have been successfully verified';
                v_actions := JSON_BUILD_ARRAY(
                    'Test all OAuth providers in the admin dashboard',
                    'Fix any configuration issues',
                    'Ensure all providers return successful authentication'
                );
            ELSIF v_summary.days_since_verification > 10 THEN
                v_reason := FORMAT('Verification is too old (%s days), maximum allowed is 10 days', 
                                 v_summary.days_since_verification);
                v_actions := JSON_BUILD_ARRAY(
                    'Re-test all OAuth providers',
                    'Verification must be completed within 10 days of deployment'
                );
            ELSE
                v_reason := 'Unknown deployment gate issue';
            END IF;
            
            RETURN QUERY
            SELECT v_summary.deployment_allowed, v_reason, v_actions;
        END;
        $$;
    """)
    
    # Update deployment gate status
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
        BEGIN
            -- Get current verification summary
            SELECT * INTO v_summary FROM get_oidc_verification_summary(p_environment);
            
            v_gate_id := compliance_uuid();
            
            -- Insert or update deployment gate
            INSERT INTO oidc_deployment_gates (
                id, environment, deployment_allowed, all_providers_verified,
                days_since_verification, last_verification_at,
                verified_providers, failed_providers, evaluated_by
            ) VALUES (
                v_gate_id, p_environment, v_summary.deployment_allowed, v_summary.all_providers_verified,
                v_summary.days_since_verification, v_summary.last_verification,
                v_summary.verified_providers, v_summary.failed_providers, p_evaluated_by
            );
            
            RETURN QUERY
            SELECT v_gate_id, v_summary.deployment_allowed, v_summary.all_providers_verified, NOW();
        END;
        $$;
    """)


def downgrade() -> None:
    """
    Rollback migration changes.
    Drop OIDC verification stored procedures.
    """
    # Drop stored procedures
    op.execute("DROP FUNCTION IF EXISTS update_deployment_gate(TEXT, TEXT);")
    op.execute("DROP FUNCTION IF EXISTS check_deployment_readiness(TEXT);")
    op.execute("DROP FUNCTION IF EXISTS get_oidc_verification_summary(TEXT, INTEGER);")
    op.execute("DROP FUNCTION IF EXISTS store_oidc_verification_result(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSON);")
