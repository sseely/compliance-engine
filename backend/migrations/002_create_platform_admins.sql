-- Platform admin management tables
-- These are separate from customer-scoped user management

CREATE TABLE IF NOT EXISTS platform_admins (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255), -- Email of admin who created this record
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    login_count INTEGER DEFAULT 0
);

-- Create index for fast lookups during authentication
CREATE INDEX idx_platform_admins_email_active ON platform_admins (email, is_active);

-- Platform admin authentication sessions
CREATE TABLE IF NOT EXISTS platform_admin_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id INTEGER NOT NULL REFERENCES platform_admins(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true
);

-- Index for session cleanup and lookups
CREATE INDEX idx_platform_admin_sessions_expires ON platform_admin_sessions (expires_at);
CREATE INDEX idx_platform_admin_sessions_admin ON platform_admin_sessions (admin_id, is_active);

-- Initialize the first platform admin from environment variable
-- This should be run once during initial deployment
-- The email comes from INITIAL_PLATFORM_ADMIN_EMAIL environment variable

-- Note: This is a placeholder - the actual initialization will be done
-- via a secure initialization script or during deployment
INSERT INTO platform_admins (email, name, created_by) 
VALUES 
    ('admin@compliance-engine.com', 'Initial Platform Admin', 'system_initialization')
ON CONFLICT (email) DO NOTHING;