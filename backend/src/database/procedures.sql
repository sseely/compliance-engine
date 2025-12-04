-- Compliance Engine Stored Procedures
-- Security-first design: All database access through procedures only
-- Procedures are defined with SECURITY DEFINER for controlled access

-- =============================================================================
-- AUTHENTICATION & AUTHORIZATION PROCEDURES
-- =============================================================================

-- Authenticate user via API key
CREATE OR REPLACE FUNCTION authenticate_user(
    p_api_key TEXT
)
RETURNS TABLE (
    customer_id UUID,
    customer_name VARCHAR(200),
    permissions JSONB,
    rate_limit INTEGER,
    is_active BOOLEAN,
    key_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_key_hash VARCHAR(255);
    v_customer_record RECORD;
    v_api_key_record RECORD;
BEGIN
    -- Hash the provided API key for comparison
    v_key_hash := crypt(p_api_key, gen_salt('bf', 12));
    
    -- Find the API key and customer
    SELECT 
        ak.key_id,
        ak.customer_id,
        ak.permissions,
        ak.rate_limit_override,
        ak.is_active,
        ak.expires_at,
        c.business_name,
        c.api_rate_limit,
        c.status
    INTO v_api_key_record
    FROM api_keys ak
    JOIN customers c ON ak.customer_id = c.customer_id
    WHERE ak.key_hash = v_key_hash
        AND ak.is_active = true
        AND c.status = 'active'
        AND (ak.expires_at IS NULL OR ak.expires_at > NOW());
    
    -- Return null if not found or invalid
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    -- Update last used timestamp
    UPDATE api_keys 
    SET last_used_at = NOW()
    WHERE key_id = v_api_key_record.key_id;
    
    -- Return customer information
    RETURN QUERY SELECT
        v_api_key_record.customer_id,
        v_api_key_record.business_name,
        v_api_key_record.permissions,
        COALESCE(v_api_key_record.rate_limit_override, v_api_key_record.api_rate_limit),
        v_api_key_record.is_active,
        v_api_key_record.key_id;
END;
$$;

-- Create API key for customer
CREATE OR REPLACE FUNCTION create_api_key(
    p_customer_id UUID,
    p_key_name VARCHAR(100),
    p_permissions JSONB DEFAULT '["license:verify"]'::jsonb,
    p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_created_by VARCHAR(100) DEFAULT 'system'
)
RETURNS TABLE (
    key_id UUID,
    api_key TEXT,
    key_prefix VARCHAR(20)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_api_key TEXT;
    v_key_prefix VARCHAR(20);
    v_key_hash VARCHAR(255);
    v_key_id UUID;
BEGIN
    -- Generate random API key with improved entropy (PostgreSQL 18 optimized)
    v_api_key := 'ce_' || encode(gen_random_bytes(32), 'base64');
    v_api_key := replace(replace(v_api_key, '+', ''), '/', '');
    v_key_prefix := substring(v_api_key, 1, 12);
    
    -- Hash the key for storage
    v_key_hash := crypt(v_api_key, gen_salt('bf', 12));
    
    -- Insert the API key
    INSERT INTO api_keys (
        customer_id,
        key_name,
        key_hash,
        key_prefix,
        permissions,
        expires_at,
        created_by
    ) VALUES (
        p_customer_id,
        p_key_name,
        v_key_hash,
        v_key_prefix,
        p_permissions,
        p_expires_at,
        p_created_by
    ) RETURNING api_keys.key_id INTO v_key_id;
    
    -- Return the key details (API key is only returned once)
    RETURN QUERY SELECT
        v_key_id,
        v_api_key,
        v_key_prefix;
END;
$$;

-- Revoke API key
CREATE OR REPLACE FUNCTION revoke_api_key(
    p_key_id UUID,
    p_customer_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE api_keys 
    SET is_active = false,
        updated_at = NOW()
    WHERE key_id = p_key_id
        AND (p_customer_id IS NULL OR customer_id = p_customer_id);
    
    RETURN FOUND;
END;
$$;

-- =============================================================================
-- LICENSE VERIFICATION PROCEDURES
-- =============================================================================

-- Main license verification procedure
CREATE OR REPLACE FUNCTION verify_business_license(
    p_request_id VARCHAR(100),
    p_customer_id UUID,
    p_business_name VARCHAR(200),
    p_state_code CHAR(2),
    p_license_type VARCHAR(50),
    p_license_number VARCHAR(100) DEFAULT NULL,
    p_requester_ip INET DEFAULT NULL
)
RETURNS TABLE (
    verification_status VARCHAR(20),
    licenses_data JSONB,
    verification_timestamp TIMESTAMP WITH TIME ZONE,
    data_sources_checked TEXT[],
    confidence_score DECIMAL(3,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cache_key VARCHAR(255);
    v_cache_result RECORD;
    v_business_name_hash VARCHAR(64);
    v_licenses JSONB := '[]'::jsonb;
    v_sources TEXT[] := ARRAY[]::TEXT[];
    v_confidence DECIMAL(3,2) := 0.0;
    v_status VARCHAR(20) := 'not_found';
    v_license_type_id UUID;
    v_search_results RECORD;
    v_start_time TIMESTAMP := clock_timestamp();
    v_response_time INTEGER;
BEGIN
    -- Validate inputs
    IF p_business_name IS NULL OR length(trim(p_business_name)) < 2 THEN
        RAISE EXCEPTION 'Business name must be at least 2 characters';
    END IF;
    
    -- Get license type ID
    SELECT license_type_id INTO v_license_type_id
    FROM license_types
    WHERE type_name = p_license_type;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid license type: %', p_license_type;
    END IF;
    
    -- Create cache key and business name hash
    v_business_name_hash := encode(digest(lower(trim(p_business_name)), 'sha256'), 'hex');
    v_cache_key := format('license:%s:%s:%s:%s', 
        v_business_name_hash, p_state_code, p_license_type, 
        COALESCE(p_license_number, 'any'));
    
    -- Check cache first
    SELECT cache.license_verification_cache.verification_result, 
           cache.license_verification_cache.confidence_score, 
           cache.license_verification_cache.expires_at
    INTO v_cache_result
    FROM cache.license_verification_cache
    WHERE cache.license_verification_cache.cache_key = v_cache_key
        AND cache.license_verification_cache.expires_at > NOW();
    
    IF FOUND THEN
        -- Update cache hit count
        UPDATE cache.license_verification_cache
        SET hit_count = hit_count + 1,
            updated_at = NOW()
        WHERE cache_key = v_cache_key;
        
        -- Return cached result
        RETURN QUERY SELECT
            (v_cache_result.verification_result->>'status')::VARCHAR(20),
            v_cache_result.verification_result->'licenses',
            NOW(),
            ARRAY[(v_cache_result.verification_result->>'source')::TEXT],
            v_cache_result.confidence_score;
        RETURN;
    END IF;
    
    -- Search license records
    SELECT COUNT(*), array_agg(DISTINCT vs.source_name)
    INTO v_search_results
    FROM license_records lr
    JOIN license_types lt ON lr.license_type_id = lt.license_type_id
    LEFT JOIN license_sources vs ON lr.verification_source_id = vs.source_id
    WHERE lr.state_code = p_state_code
        AND lt.type_name = p_license_type
        AND (
            similarity(lr.business_name, p_business_name) > 0.6
            OR lr.business_name ILIKE '%' || p_business_name || '%'
            OR p_business_name ILIKE '%' || lr.business_name || '%'
        )
        AND (p_license_number IS NULL OR lr.license_number = p_license_number)
        AND lr.status IN ('valid', 'pending');
    
    v_sources := COALESCE(v_search_results.array_agg, ARRAY['internal_database']);
    
    -- Build licenses JSON array
    SELECT jsonb_agg(
        jsonb_build_object(
            'license_id', lr.license_id,
            'license_number', lr.license_number,
            'business_name', lr.business_name,
            'license_type', lt.type_name,
            'status', lr.status,
            'issue_date', lr.issue_date,
            'expiration_date', lr.expiration_date,
            'issuing_authority', lr.issuing_authority,
            'verification_source', COALESCE(vs.source_name, 'internal'),
            'last_verified', lr.last_verified,
            'confidence_individual', 
                CASE 
                    WHEN lr.license_number = p_license_number THEN 1.0
                    WHEN similarity(lr.business_name, p_business_name) > 0.8 THEN 0.9
                    WHEN similarity(lr.business_name, p_business_name) > 0.6 THEN 0.7
                    ELSE 0.5
                END
        )
    )
    INTO v_licenses
    FROM license_records lr
    JOIN license_types lt ON lr.license_type_id = lt.license_type_id
    LEFT JOIN license_sources vs ON lr.verification_source_id = vs.source_id
    WHERE lr.state_code = p_state_code
        AND lt.type_name = p_license_type
        AND (
            similarity(lr.business_name, p_business_name) > 0.6
            OR lr.business_name ILIKE '%' || p_business_name || '%'
            OR p_business_name ILIKE '%' || lr.business_name || '%'
        )
        AND (p_license_number IS NULL OR lr.license_number = p_license_number)
        AND lr.status IN ('valid', 'pending');
    
    -- Determine status and confidence
    IF v_licenses IS NOT NULL AND jsonb_array_length(v_licenses) > 0 THEN
        v_status := 'valid';
        -- Calculate average confidence from individual license confidences
        SELECT AVG((license->>'confidence_individual')::DECIMAL)
        INTO v_confidence
        FROM jsonb_array_elements(v_licenses) AS license;
    ELSE
        v_licenses := '[]'::jsonb;
        v_confidence := 0.0;
    END IF;
    
    -- Calculate response time
    v_response_time := EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time)) * 1000;
    
    -- Cache the result
    INSERT INTO cache.license_verification_cache (
        cache_key,
        business_name_hash,
        state_code,
        license_type,
        verification_result,
        confidence_score,
        expires_at
    ) VALUES (
        v_cache_key,
        v_business_name_hash,
        p_state_code,
        p_license_type,
        jsonb_build_object(
            'status', v_status,
            'licenses', v_licenses,
            'source', 'database_search'
        ),
        v_confidence,
        NOW() + INTERVAL '1 hour'
    ) ON CONFLICT (cache_key) DO UPDATE SET
        verification_result = EXCLUDED.verification_result,
        confidence_score = EXCLUDED.confidence_score,
        expires_at = EXCLUDED.expires_at,
        hit_count = cache.license_verification_cache.hit_count + 1,
        updated_at = NOW();
    
    -- Log the verification request
    INSERT INTO license_verification_requests (
        request_id,
        customer_id,
        business_name,
        state_code,
        license_type,
        license_number,
        verification_status,
        licenses_found,
        confidence_score,
        data_sources_checked,
        response_time_ms,
        requester_ip,
        result_data
    ) VALUES (
        p_request_id,
        p_customer_id,
        p_business_name,
        p_state_code,
        p_license_type,
        p_license_number,
        v_status,
        jsonb_array_length(v_licenses),
        v_confidence,
        v_sources,
        v_response_time,
        p_requester_ip,
        jsonb_build_object(
            'licenses', v_licenses,
            'sources_checked', v_sources
        )
    );
    
    -- Return verification result
    RETURN QUERY SELECT
        v_status,
        v_licenses,
        NOW(),
        v_sources,
        v_confidence;
END;
$$;

-- Get license history
CREATE OR REPLACE FUNCTION get_license_history(
    p_license_id UUID,
    p_customer_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    event_id UUID,
    event_type VARCHAR(50),
    event_date TIMESTAMP WITH TIME ZONE,
    description TEXT,
    source VARCHAR(100),
    details JSONB,
    business_name VARCHAR(200)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, audit
AS $$
DECLARE
    v_business_name VARCHAR(200);
BEGIN
    -- Get business name for the license
    SELECT lr.business_name INTO v_business_name
    FROM license_records lr
    WHERE lr.license_id = p_license_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'License not found: %', p_license_id;
    END IF;
    
    -- Return audit trail for the license
    RETURN QUERY
    SELECT 
        ual.log_id,
        ual.action,
        ual.created_at,
        CASE 
            WHEN ual.action = 'license_verification' THEN 'License verification performed'
            WHEN ual.action = 'license_status_check' THEN 'License status checked'
            ELSE ual.action
        END,
        COALESCE((ual.request_details->>'source')::VARCHAR(100), 'system'),
        ual.request_details,
        v_business_name
    FROM audit.user_activity_log ual
    WHERE ual.resource = 'business_license'
        AND ual.resource_id = p_license_id::TEXT
        AND (p_start_date IS NULL OR ual.created_at::DATE >= p_start_date)
        AND (p_end_date IS NULL OR ual.created_at::DATE <= p_end_date)
    ORDER BY ual.created_at DESC;
END;
$$;

-- =============================================================================
-- AUDIT PROCEDURES
-- =============================================================================

-- Audit license verification
CREATE OR REPLACE FUNCTION audit_license_verification(
    p_request_id VARCHAR(100),
    p_customer_id UUID,
    p_verification_status VARCHAR(20),
    p_licenses_found_count INTEGER,
    p_confidence_score DECIMAL(3,2),
    p_ip_address INET DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = audit
AS $$
BEGIN
    INSERT INTO audit.user_activity_log (
        user_id,
        action,
        resource,
        resource_id,
        ip_address,
        request_details
    ) VALUES (
        p_customer_id::TEXT,
        'license_verification',
        'business_license',
        p_request_id,
        p_ip_address,
        jsonb_build_object(
            'verification_status', p_verification_status,
            'licenses_found', p_licenses_found_count,
            'confidence_score', p_confidence_score
        )
    );
END;
$$;

-- Audit user activity
CREATE OR REPLACE FUNCTION audit_user_activity(
    p_user_id TEXT,
    p_action VARCHAR(100),
    p_resource VARCHAR(100),
    p_resource_id TEXT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_details JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = audit
AS $$
BEGIN
    INSERT INTO audit.user_activity_log (
        user_id,
        action,
        resource,
        resource_id,
        ip_address,
        request_details
    ) VALUES (
        p_user_id,
        p_action,
        p_resource,
        p_resource_id,
        p_ip_address,
        p_details
    );
END;
$$;

-- =============================================================================
-- HEALTH CHECK PROCEDURES
-- =============================================================================

-- Database health check
CREATE OR REPLACE FUNCTION health_check_database()
RETURNS TABLE (
    status VARCHAR(20),
    response_time_ms INTEGER,
    connection_count INTEGER,
    cache_hit_ratio DECIMAL(5,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cache
AS $$
DECLARE
    v_start_time TIMESTAMP := clock_timestamp();
    v_response_time INTEGER;
    v_connection_count INTEGER;
    v_cache_hits BIGINT;
    v_cache_total BIGINT;
    v_cache_ratio DECIMAL(5,2);
BEGIN
    -- Test basic database connectivity
    PERFORM 1;
    
    -- Get connection count
    SELECT count(*) INTO v_connection_count
    FROM pg_stat_activity
    WHERE state = 'active';
    
    -- Calculate cache hit ratio
    SELECT 
        SUM(hit_count),
        COUNT(*)
    INTO v_cache_hits, v_cache_total
    FROM cache.license_verification_cache
    WHERE created_at > NOW() - INTERVAL '1 hour';
    
    v_cache_ratio := CASE 
        WHEN v_cache_total = 0 THEN 0.0
        ELSE (v_cache_hits::DECIMAL / v_cache_total) * 100
    END;
    
    -- Calculate response time
    v_response_time := EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time)) * 1000;
    
    RETURN QUERY SELECT
        'healthy'::VARCHAR(20),
        v_response_time,
        v_connection_count,
        v_cache_ratio;
END;
$$;

-- Check database connections
CREATE OR REPLACE FUNCTION health_check_connections()
RETURNS TABLE (
    total_connections INTEGER,
    active_connections INTEGER,
    idle_connections INTEGER,
    max_connections INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT count(*) FROM pg_stat_activity)::INTEGER,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active')::INTEGER,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle')::INTEGER,
        (SELECT setting::INTEGER FROM pg_settings WHERE name = 'max_connections');
END;
$$;

-- =============================================================================
-- CUSTOMER MANAGEMENT PROCEDURES
-- =============================================================================

-- Get customer CORS settings
CREATE OR REPLACE FUNCTION get_customer_cors_settings(
    p_customer_id UUID
)
RETURNS TABLE (
    allowed_origins TEXT[],
    allowed_methods TEXT[],
    allowed_headers TEXT[],
    max_age INTEGER,
    allow_credentials BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ccs.allowed_origins,
        ccs.allowed_methods,
        ccs.allowed_headers,
        ccs.max_age,
        ccs.allow_credentials
    FROM customer_cors_settings ccs
    WHERE ccs.customer_id = p_customer_id;
    
    -- Return defaults if no custom settings
    IF NOT FOUND THEN
        RETURN QUERY SELECT
            ARRAY['*']::TEXT[],
            ARRAY['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']::TEXT[],
            ARRAY['*']::TEXT[],
            3600,
            false;
    END IF;
END;
$$;

COMMIT;