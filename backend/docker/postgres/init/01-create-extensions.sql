-- Initialize PostgreSQL with required extensions
-- This script runs automatically when the container is first created

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For similarity searches

-- Create schemas
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS cache;

-- Set default search path
ALTER DATABASE compliance_engine SET search_path = public, audit, cache;

-- Log initialization
SELECT 'Database initialized with extensions and schemas' AS status;