-- Development Seed Data for Compliance Engine
-- This file provides test data for development and testing environments
-- DO NOT RUN IN PRODUCTION

-- =============================================================================
-- CUSTOMERS - Test customer accounts
-- =============================================================================

INSERT INTO customers (
    customer_id,
    business_name,
    contact_email,
    contact_phone,
    billing_address,
    subscription_tier,
    api_rate_limit,
    monthly_quota,
    status
) VALUES 
    (
        '550e8400-e29b-41d4-a716-446655440001'::uuid,
        'Acme Construction LLC',
        'api@acmeconstruction.com',
        '+1-555-0001',
        '{"street": "123 Main St", "city": "Los Angeles", "state": "CA", "zip": "90210"}'::jsonb,
        'professional',
        1000,
        10000,
        'active'
    ),
    (
        '550e8400-e29b-41d4-a716-446655440002'::uuid,
        'Tech Startup Inc',
        'compliance@techstartup.com',
        '+1-555-0002',
        '{"street": "456 Silicon Ave", "city": "San Francisco", "state": "CA", "zip": "94102"}'::jsonb,
        'basic',
        100,
        1000,
        'active'
    ),
    (
        '550e8400-e29b-41d4-a716-446655440003'::uuid,
        'Enterprise Corp',
        'legal@enterprise.com',
        '+1-555-0003',
        '{"street": "789 Business Blvd", "city": "New York", "state": "NY", "zip": "10001"}'::jsonb,
        'enterprise',
        5000,
        100000,
        'active'
    )
ON CONFLICT (customer_id) DO NOTHING;

-- =============================================================================
-- API KEYS - Test API keys for customers
-- =============================================================================

-- API Key for Acme Construction: ce_acme_test_key_2024_secure_12345678
-- Hash is bcrypt of the above key
INSERT INTO api_keys (
    key_id,
    customer_id,
    key_name,
    key_hash,
    key_prefix,
    permissions,
    is_active,
    created_by
) VALUES 
    (
        '660e8400-e29b-41d4-a716-446655440001'::uuid,
        '550e8400-e29b-41d4-a716-446655440001'::uuid,
        'Primary API Key',
        '$2b$12$LQv3c1yqBWVHxkd0LQ4lLu.OlP.iq2KGZe9F.1JhNyLy5G8J5.5.u', -- bcrypt hash
        'ce_acme_test',
        '["license:verify", "license:history", "permit:create"]'::jsonb,
        true,
        'system_seed'
    ),
    (
        '660e8400-e29b-41d4-a716-446655440002'::uuid,
        '550e8400-e29b-41d4-a716-446655440002'::uuid,
        'Development Key',
        '$2b$12$8Z2F3v4HhKdQ5X7yQv9E5u.NqR.yz6PGHe4C.2KiOxNz7H9M8.8.w', -- bcrypt hash
        'ce_tech_test',
        '["license:verify"]'::jsonb,
        true,
        'system_seed'
    ),
    (
        '660e8400-e29b-41d4-a716-446655440003'::uuid,
        '550e8400-e29b-41d4-a716-446655440003'::uuid,
        'Enterprise Production Key',
        '$2b$12$5M8B6w9KkFxR2Y5xTw7A9u.LrS.wx8QGHi6D.3LjQyOx8I7L9.9.z', -- bcrypt hash
        'ce_enter_prod',
        '["license:verify", "license:history", "permit:create", "fleet:track", "professional:verify"]'::jsonb,
        true,
        'system_seed'
    )
ON CONFLICT (key_id) DO NOTHING;

-- =============================================================================
-- CORS SETTINGS - Customer CORS configuration
-- =============================================================================

INSERT INTO customer_cors_settings (
    customer_id,
    allowed_origins,
    allowed_methods,
    allowed_headers,
    max_age,
    allow_credentials
) VALUES 
    (
        '550e8400-e29b-41d4-a716-446655440001'::uuid,
        ARRAY['https://acmeconstruction.com', 'https://app.acmeconstruction.com'],
        ARRAY['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        ARRAY['Authorization', 'Content-Type', 'X-API-Key'],
        3600,
        false
    ),
    (
        '550e8400-e29b-41d4-a716-446655440002'::uuid,
        ARRAY['http://localhost:3000', 'https://dev.techstartup.com'],
        ARRAY['GET', 'POST', 'OPTIONS'],
        ARRAY['*'],
        3600,
        false
    ),
    (
        '550e8400-e29b-41d4-a716-446655440003'::uuid,
        ARRAY['https://enterprise.com', 'https://portal.enterprise.com', 'https://api.enterprise.com'],
        ARRAY['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
        ARRAY['Authorization', 'Content-Type', 'X-API-Key', 'X-Request-ID'],
        7200,
        true
    )
ON CONFLICT (customer_id) DO NOTHING;

-- =============================================================================
-- LICENSE SOURCES - Test license authority sources
-- =============================================================================

INSERT INTO license_sources (
    source_id,
    source_name,
    state_code,
    source_type,
    api_endpoint,
    rate_limit_per_minute,
    reliability_score,
    is_active
) VALUES 
    (
        '770e8400-e29b-41d4-a716-446655440001'::uuid,
        'California Secretary of State',
        'CA',
        'state_database',
        'https://bizfileonline.sos.ca.gov/api/v1',
        30,
        0.98,
        true
    ),
    (
        '770e8400-e29b-41d4-a716-446655440002'::uuid,
        'Texas Comptroller of Public Accounts',
        'TX',
        'state_database',
        'https://mycpa.cpa.state.tx.us/api/v1',
        60,
        0.95,
        true
    ),
    (
        '770e8400-e29b-41d4-a716-446655440003'::uuid,
        'New York Department of State',
        'NY',
        'state_database',
        'https://appext20.dos.ny.gov/api/v1',
        45,
        0.97,
        true
    ),
    (
        '770e8400-e29b-41d4-a716-446655440004'::uuid,
        'Florida Division of Corporations',
        'FL',
        'state_database',
        'https://search.sunbiz.org/api/v1',
        40,
        0.96,
        true
    )
ON CONFLICT (source_id) DO NOTHING;

-- =============================================================================
-- LICENSE TYPES - Additional test license types
-- =============================================================================

INSERT INTO license_types (
    license_type_id,
    type_name,
    category,
    description,
    verification_complexity,
    average_verification_time_ms
) VALUES 
    (
        '880e8400-e29b-41d4-a716-446655440001'::uuid,
        'general_contractor',
        'contractor',
        'General contractor license for construction work',
        'complex',
        3500
    ),
    (
        '880e8400-e29b-41d4-a716-446655440002'::uuid,
        'electrical_contractor',
        'contractor',
        'Electrical contractor license',
        'complex',
        4000
    ),
    (
        '880e8400-e29b-41d4-a716-446655440003'::uuid,
        'plumbing_contractor',
        'contractor',
        'Plumbing contractor license',
        'complex',
        3800
    ),
    (
        '880e8400-e29b-41d4-a716-446655440004'::uuid,
        'sales_tax_permit',
        'business',
        'Sales tax permit for retail businesses',
        'standard',
        2000
    )
ON CONFLICT (license_type_id) DO NOTHING;

-- =============================================================================
-- LICENSE RECORDS - Sample verified licenses
-- =============================================================================

INSERT INTO license_records (
    license_id,
    license_number,
    business_name,
    license_type_id,
    state_code,
    status,
    issue_date,
    expiration_date,
    issuing_authority,
    business_address,
    business_phone,
    business_email,
    verification_source_id,
    confidence_score
) VALUES 
    (
        '990e8400-e29b-41d4-a716-446655440001'::uuid,
        'CA-BUS-123456789',
        'Acme Construction LLC',
        (SELECT license_type_id FROM license_types WHERE type_name = 'business'),
        'CA',
        'valid',
        '2023-01-15',
        '2025-01-15',
        'California Secretary of State',
        '{"street": "123 Main St", "city": "Los Angeles", "state": "CA", "zip": "90210"}'::jsonb,
        '+1-555-0001',
        'contact@acmeconstruction.com',
        '770e8400-e29b-41d4-a716-446655440001'::uuid,
        0.98
    ),
    (
        '990e8400-e29b-41d4-a716-446655440002'::uuid,
        'CA-GC-987654321',
        'Acme Construction LLC',
        '880e8400-e29b-41d4-a716-446655440001'::uuid, -- general_contractor
        'CA',
        'valid',
        '2023-03-01',
        '2025-03-01',
        'California Contractors State License Board',
        '{"street": "123 Main St", "city": "Los Angeles", "state": "CA", "zip": "90210"}'::jsonb,
        '+1-555-0001',
        'license@acmeconstruction.com',
        '770e8400-e29b-41d4-a716-446655440001'::uuid,
        0.97
    ),
    (
        '990e8400-e29b-41d4-a716-446655440003'::uuid,
        'TX-BUS-456789123',
        'Lone Star Builders Inc',
        (SELECT license_type_id FROM license_types WHERE type_name = 'business'),
        'TX',
        'valid',
        '2023-06-10',
        '2024-12-31',
        'Texas Secretary of State',
        '{"street": "456 Ranch Rd", "city": "Austin", "state": "TX", "zip": "78701"}'::jsonb,
        '+1-512-555-0100',
        'info@lonestarbuilders.com',
        '770e8400-e29b-41d4-a716-446655440002'::uuid,
        0.95
    ),
    (
        '990e8400-e29b-41d4-a716-446655440004'::uuid,
        'NY-PROF-789123456',
        'Empire Engineering PLLC',
        (SELECT license_type_id FROM license_types WHERE type_name = 'professional'),
        'NY',
        'valid',
        '2022-09-15',
        '2025-09-15',
        'New York State Department of Education',
        '{"street": "789 Broadway", "city": "New York", "state": "NY", "zip": "10003"}'::jsonb,
        '+1-212-555-0200',
        'contact@empireengineering.com',
        '770e8400-e29b-41d4-a716-446655440003'::uuid,
        0.99
    ),
    (
        '990e8400-e29b-41d4-a716-446655440005'::uuid,
        'FL-CONT-321654987',
        'Sunshine Electrical Services',
        '880e8400-e29b-41d4-a716-446655440002'::uuid, -- electrical_contractor
        'FL',
        'expired',
        '2022-01-01',
        '2024-01-01',
        'Florida Department of Business & Professional Regulation',
        '{"street": "321 Ocean Dr", "city": "Miami", "state": "FL", "zip": "33139"}'::jsonb,
        '+1-305-555-0300',
        'service@sunshineelectrical.com',
        '770e8400-e29b-41d4-a716-446655440004'::uuid,
        0.92
    )
ON CONFLICT (license_id) DO NOTHING;

-- =============================================================================
-- CACHE DATA - Sample cache entries for testing
-- =============================================================================

INSERT INTO cache.license_verification_cache (
    cache_key,
    business_name_hash,
    state_code,
    license_type,
    verification_result,
    confidence_score,
    expires_at,
    hit_count
) VALUES 
    (
        'license:acme_hash:CA:business:any',
        'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4',
        'CA',
        'business',
        '{"status": "valid", "licenses": [{"license_id": "990e8400-e29b-41d4-a716-446655440001", "license_number": "CA-BUS-123456789"}], "source": "database_search"}'::jsonb,
        0.98,
        NOW() + INTERVAL '1 hour',
        3
    ),
    (
        'license:lonestar_hash:TX:business:any',
        'b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5',
        'TX',
        'business',
        '{"status": "valid", "licenses": [{"license_id": "990e8400-e29b-41d4-a716-446655440003", "license_number": "TX-BUS-456789123"}], "source": "database_search"}'::jsonb,
        0.95,
        NOW() + INTERVAL '45 minutes',
        1
    )
ON CONFLICT (cache_key) DO NOTHING;

-- =============================================================================
-- SAMPLE AUDIT DATA - Test audit trail entries
-- =============================================================================

INSERT INTO audit.user_activity_log (
    log_id,
    user_id,
    action,
    resource,
    resource_id,
    ip_address,
    request_details,
    response_status,
    response_time_ms,
    api_key_id
) VALUES 
    (
        'aa0e8400-e29b-41d4-a716-446655440001'::uuid,
        '550e8400-e29b-41d4-a716-446655440001',
        'license_verification',
        'business_license',
        'lv_20241101_143022_550e8400',
        '192.168.1.100'::inet,
        '{"business_name": "Acme Construction LLC", "state": "CA", "license_type": "business"}'::jsonb,
        200,
        1250,
        '660e8400-e29b-41d4-a716-446655440001'::uuid
    ),
    (
        'aa0e8400-e29b-41d4-a716-446655440002'::uuid,
        '550e8400-e29b-41d4-a716-446655440002',
        'license_verification',
        'business_license',
        'lv_20241101_151545_550e8400',
        '10.0.1.50'::inet,
        '{"business_name": "Tech Startup Inc", "state": "CA", "license_type": "business"}'::jsonb,
        200,
        2100,
        '660e8400-e29b-41d4-a716-446655440002'::uuid
    )
ON CONFLICT (log_id) DO NOTHING;

-- =============================================================================
-- USAGE TRACKING - Sample usage data
-- =============================================================================

-- Update customer usage counters
UPDATE customers 
SET current_usage = 
    CASE customer_id
        WHEN '550e8400-e29b-41d4-a716-446655440001'::uuid THEN 150
        WHEN '550e8400-e29b-41d4-a716-446655440002'::uuid THEN 45
        WHEN '550e8400-e29b-41d4-a716-446655440003'::uuid THEN 892
        ELSE current_usage
    END
WHERE customer_id IN (
    '550e8400-e29b-41d4-a716-446655440001'::uuid,
    '550e8400-e29b-41d4-a716-446655440002'::uuid,
    '550e8400-e29b-41d4-a716-446655440003'::uuid
);

COMMIT;