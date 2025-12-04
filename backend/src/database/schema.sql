-- Compliance Engine Database Schema
-- PostgreSQL 18+ schema with security-first design and modern optimizations
-- All access through stored procedures only
-- 
-- PostgreSQL 18 Features Used:
-- - UUIDv7 for temporally sortable identifiers
-- - Skip scan indexes for flexible multi-column queries
-- - Enhanced trigram similarity searches
-- - Improved SQL function plan caching

-- Extension setup
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Use UUIDv7 for time-ordered UUIDs (PostgreSQL 18 feature)
-- Fallback to uuid_generate_v4() if UUIDv7 is not available
CREATE OR REPLACE FUNCTION compliance_uuid() RETURNS UUID AS $$
BEGIN
    -- Try UUIDv7 first (PostgreSQL 18+)
    BEGIN
        RETURN uuidv7();
    EXCEPTION WHEN undefined_function THEN
        -- Fallback to v4 for older versions
        RETURN uuid_generate_v4();
    END;
END;
$$ LANGUAGE plpgsql;

-- Create schemas for organization
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS cache;

-- Set search path
SET search_path = public, audit, cache;

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- Customers table - manages API access
CREATE TABLE IF NOT EXISTS customers (
    customer_id UUID PRIMARY KEY DEFAULT compliance_uuid(),
    business_name VARCHAR(200) NOT NULL,
    contact_email VARCHAR(255) NOT NULL UNIQUE,
    contact_phone VARCHAR(20),
    billing_address JSONB,
    subscription_tier VARCHAR(50) NOT NULL DEFAULT 'basic',
    api_rate_limit INTEGER NOT NULL DEFAULT 100,
    monthly_quota INTEGER NOT NULL DEFAULT 1000,
    current_usage INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- API Keys table - secure key management
CREATE TABLE IF NOT EXISTS api_keys (
    key_id UUID PRIMARY KEY DEFAULT compliance_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    key_name VARCHAR(100) NOT NULL,
    key_hash VARCHAR(255) NOT NULL UNIQUE, -- bcrypt hash of the key
    key_prefix VARCHAR(20) NOT NULL, -- First 8 chars for identification
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of permission strings
    rate_limit_override INTEGER, -- Override customer default
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    last_used_ip INET,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- CORS settings per customer
CREATE TABLE IF NOT EXISTS customer_cors_settings (
    customer_id UUID PRIMARY KEY REFERENCES customers(customer_id) ON DELETE CASCADE,
    allowed_origins TEXT[] NOT NULL DEFAULT ARRAY['*'],
    allowed_methods TEXT[] NOT NULL DEFAULT ARRAY['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowed_headers TEXT[] NOT NULL DEFAULT ARRAY['*'],
    max_age INTEGER NOT NULL DEFAULT 3600,
    allow_credentials BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- LICENSE VERIFICATION TABLES
-- =============================================================================

-- License sources - state authorities and databases
CREATE TABLE IF NOT EXISTS license_sources (
    source_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_name VARCHAR(100) NOT NULL UNIQUE,
    state_code CHAR(2) NOT NULL,
    source_type VARCHAR(50) NOT NULL, -- 'state_database', 'third_party', 'manual'
    api_endpoint VARCHAR(500),
    api_key_encrypted TEXT, -- Encrypted API keys for external sources
    rate_limit_per_minute INTEGER DEFAULT 60,
    reliability_score DECIMAL(3,2) DEFAULT 0.95,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- License types supported
CREATE TABLE IF NOT EXISTS license_types (
    license_type_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type_name VARCHAR(50) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL, -- 'business', 'professional', 'contractor', etc.
    description TEXT,
    verification_complexity VARCHAR(20) DEFAULT 'standard', -- 'simple', 'standard', 'complex'
    average_verification_time_ms INTEGER DEFAULT 2000
);

-- License records - verified business licenses
CREATE TABLE IF NOT EXISTS license_records (
    license_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_number VARCHAR(100) NOT NULL,
    business_name VARCHAR(200) NOT NULL,
    license_type_id UUID NOT NULL REFERENCES license_types(license_type_id),
    state_code CHAR(2) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('valid', 'expired', 'suspended', 'revoked', 'pending')),
    issue_date DATE,
    expiration_date DATE,
    issuing_authority VARCHAR(200) NOT NULL,
    business_address JSONB,
    business_phone VARCHAR(20),
    business_email VARCHAR(255),
    verification_source_id UUID REFERENCES license_sources(source_id),
    last_verified TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    verification_count INTEGER NOT NULL DEFAULT 1,
    confidence_score DECIMAL(3,2) NOT NULL DEFAULT 0.95,
    raw_data JSONB, -- Store original response from verification source
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Unique constraint to prevent duplicates
    UNIQUE(license_number, state_code, license_type_id)
);

-- License verification requests - audit trail
CREATE TABLE IF NOT EXISTS license_verification_requests (
    request_id VARCHAR(100) PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES customers(customer_id),
    business_name VARCHAR(200) NOT NULL,
    state_code CHAR(2) NOT NULL,
    license_type VARCHAR(50) NOT NULL,
    license_number VARCHAR(100),
    verification_status VARCHAR(20) NOT NULL,
    licenses_found INTEGER NOT NULL DEFAULT 0,
    confidence_score DECIMAL(3,2),
    data_sources_checked TEXT[],
    response_time_ms INTEGER,
    requester_ip INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    result_data JSONB -- Store full response for debugging
);

-- =============================================================================
-- AUDIT SCHEMA TABLES
-- =============================================================================

-- User activity audit log
CREATE TABLE IF NOT EXISTS audit.user_activity_log (
    log_id UUID PRIMARY KEY DEFAULT compliance_uuid(),
    user_id VARCHAR(100) NOT NULL, -- Could be customer_id or API key
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    resource_id VARCHAR(100),
    ip_address INET,
    user_agent TEXT,
    request_details JSONB,
    response_status INTEGER,
    response_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    session_id VARCHAR(100),
    api_key_id UUID REFERENCES api_keys(key_id)
);

-- Data access audit log
CREATE TABLE IF NOT EXISTS audit.data_access_log (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(100) NOT NULL,
    data_type VARCHAR(100) NOT NULL,
    operation VARCHAR(50) NOT NULL, -- 'read', 'write', 'delete'
    record_count INTEGER,
    query_params JSONB,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    api_key_id UUID REFERENCES api_keys(key_id)
);

-- System events audit log
CREATE TABLE IF NOT EXISTS audit.system_events_log (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    event_category VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'info',
    message TEXT NOT NULL,
    details JSONB,
    source_system VARCHAR(100) DEFAULT 'compliance-engine',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- CACHE SCHEMA TABLES  
-- =============================================================================

-- License verification cache
CREATE TABLE IF NOT EXISTS cache.license_verification_cache (
    cache_key VARCHAR(255) PRIMARY KEY,
    business_name_hash VARCHAR(64) NOT NULL, -- SHA256 hash for privacy
    state_code CHAR(2) NOT NULL,
    license_type VARCHAR(50) NOT NULL,
    verification_result JSONB NOT NULL,
    confidence_score DECIMAL(3,2) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    hit_count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- API rate limiting cache
CREATE TABLE IF NOT EXISTS cache.rate_limit_cache (
    key_identifier VARCHAR(255) PRIMARY KEY, -- customer_id:endpoint or api_key:endpoint
    request_count INTEGER NOT NULL DEFAULT 1,
    window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Customer indexes
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at);

-- API key indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_customer_id ON api_keys(customer_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_keys_expires_at ON api_keys(expires_at) WHERE expires_at IS NOT NULL;

-- License record indexes
CREATE INDEX IF NOT EXISTS idx_license_records_license_number ON license_records(license_number);
CREATE INDEX IF NOT EXISTS idx_license_records_business_name ON license_records USING gin(to_tsvector('english', business_name));
CREATE INDEX IF NOT EXISTS idx_license_records_state_type ON license_records(state_code, license_type_id);
CREATE INDEX IF NOT EXISTS idx_license_records_status ON license_records(status);
CREATE INDEX IF NOT EXISTS idx_license_records_expiration ON license_records(expiration_date) WHERE expiration_date IS NOT NULL;

-- PostgreSQL 18 skip scan optimization: Multi-column index for flexible queries
-- Allows queries to efficiently use this index even when early columns are not restricted
CREATE INDEX IF NOT EXISTS idx_license_records_skip_scan ON license_records(state_code, license_type_id, status, expiration_date, business_name);

-- Optimized index for similarity searches (PostgreSQL 18 performance improvements)
CREATE INDEX IF NOT EXISTS idx_license_records_similarity ON license_records USING gin(business_name gin_trgm_ops) WHERE status IN ('valid', 'pending');

-- Audit indexes
CREATE INDEX IF NOT EXISTS idx_user_activity_log_user_id ON audit.user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_created_at ON audit.user_activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_action ON audit.user_activity_log(action);

-- Cache indexes
CREATE INDEX IF NOT EXISTS idx_license_cache_business_hash ON cache.license_verification_cache(business_name_hash);
CREATE INDEX IF NOT EXISTS idx_license_cache_expires_at ON cache.license_verification_cache(expires_at);

-- =============================================================================
-- ROW LEVEL SECURITY (Future Enhancement)
-- =============================================================================

-- Enable RLS on sensitive tables (commented out for initial implementation)
-- ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE license_verification_requests ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================================================

-- Function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_license_records_updated_at BEFORE UPDATE ON license_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cors_settings_updated_at BEFORE UPDATE ON customer_cors_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- INITIAL DATA
-- =============================================================================

-- Insert default license types
INSERT INTO license_types (type_name, category, description) VALUES
    ('business', 'business', 'General business license'),
    ('professional', 'professional', 'Professional service license'),
    ('contractor', 'contractor', 'Contractor license'),
    ('reseller', 'business', 'Reseller permit'),
    ('vendor', 'business', 'Vendor permit')
ON CONFLICT (type_name) DO NOTHING;

-- Insert common license sources (sample)
INSERT INTO license_sources (source_name, state_code, source_type) VALUES
    ('California SOS Business Search', 'CA', 'state_database'),
    ('Texas Comptroller Business Search', 'TX', 'state_database'),
    ('New York Department of State', 'NY', 'state_database'),
    ('Florida Division of Corporations', 'FL', 'state_database')
ON CONFLICT (source_name) DO NOTHING;

COMMIT;