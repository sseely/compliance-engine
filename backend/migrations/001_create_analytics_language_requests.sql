-- Analytics table for tracking language support requests
-- Prefix: analytics_ to distinguish from core business logic

CREATE TABLE IF NOT EXISTS analytics_language_requests (
    id SERIAL PRIMARY KEY,
    language_code VARCHAR(10) NOT NULL,
    user_agent TEXT,
    ip_address INET,
    referrer TEXT,
    request_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    session_id VARCHAR(255)
);

-- Index for efficient querying by language and time
CREATE INDEX idx_analytics_language_requests_lang_time 
ON analytics_language_requests (language_code, request_timestamp);

-- Index for counting requests by language
CREATE INDEX idx_analytics_language_requests_lang 
ON analytics_language_requests (language_code);

-- Optional: Add a view for easy aggregation
CREATE OR REPLACE VIEW analytics_language_request_summary AS
SELECT 
    language_code,
    COUNT(*) as request_count,
    COUNT(DISTINCT ip_address) as unique_ips,
    COUNT(DISTINCT session_id) as unique_sessions,
    MIN(request_timestamp) as first_request,
    MAX(request_timestamp) as last_request,
    DATE_TRUNC('day', MAX(request_timestamp)) as last_request_date
FROM analytics_language_requests 
GROUP BY language_code
ORDER BY request_count DESC;