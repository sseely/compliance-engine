# Monitoring & Diagnostics Strategy

## Cost vs. Value Principles

### The Monitoring Cost Trap
- **Log volume explosion**: Debug logs in production = $$$
- **Metric cardinality**: High-dimension metrics = exponential costs  
- **Trace sampling**: 100% tracing = bankruptcy at scale
- **Storage retention**: Long retention periods = mounting costs
- **Alert noise**: Too many alerts = ignore important ones

### Strategic Monitoring Goals
1. **Detect revenue-impacting issues** within 5 minutes
2. **Diagnose customer-reported problems** efficiently  
3. **Prevent cascading failures** through early warnings
4. **Maintain compliance audit trails** cost-effectively
5. **Optimize performance** based on real usage patterns

## Tiered Monitoring Strategy

### Phase 1: Essential Monitoring ($20-50/month)
**Revenue threshold**: $0-15K MRR

**Core metrics only**:
```python
# Essential application metrics
request_duration = Histogram('http_request_duration_seconds', ['method', 'endpoint'])
request_count = Counter('http_requests_total', ['method', endpoint', 'status'])
error_rate = Counter('http_errors_total', ['error_type', 'endpoint'])
active_customers = Gauge('active_customers_total')
revenue_impact_errors = Counter('revenue_impact_errors_total', ['error_type'])

# Infrastructure metrics (AWS CloudWatch - free tier)
cpu_utilization = AWS CloudWatch (ECS/Lambda built-in)
memory_utilization = AWS CloudWatch (ECS/Lambda built-in)  
database_connections = AWS CloudWatch (RDS built-in)
```

**Logging strategy**:
- **ERROR and FATAL only** in production
- **CloudWatch Logs** (AWS free tier: 5GB/month)
- **Structured JSON logging** for easy parsing
- **7-day retention** for cost control

**Tools**:
- **AWS CloudWatch** (free tier + minimal overage)
- **Basic Grafana** (self-hosted on ECS)
- **PagerDuty free tier** (5 services)

### Phase 2: Operational Monitoring ($100-200/month)
**Revenue threshold**: $15K-50K MRR

**Enhanced metrics**:
```python
# Business metrics
api_usage_by_customer = Histogram('api_usage_seconds', ['customer_id', 'plan_type'])
compliance_check_success_rate = Histogram('compliance_success_rate', ['jurisdiction', 'check_type'])
claude_token_usage = Counter('claude_tokens_total', ['model', 'operation'])
license_verification_latency = Histogram('license_verification_seconds', ['state', 'source'])

# Detailed infrastructure metrics
database_query_duration = Histogram('db_query_duration_seconds', ['query_type'])
cache_hit_ratio = Histogram('cache_hit_ratio', ['cache_type'])
external_api_latency = Histogram('external_api_duration_seconds', ['service'])
```

**Enhanced logging**:
- **WARN level** in production
- **15-day retention** for debugging
- **Customer request tracing** (sample 10%)

**Tools**:
- **Prometheus + Grafana** (self-hosted)
- **AWS CloudWatch** for infrastructure
- **DataDog** (consider if self-hosting becomes complex)

### Phase 3: Advanced Observability ($300-500/month)
**Revenue threshold**: $50K+ MRR

**Full observability**:
- **Distributed tracing** (1% sampling rate)
- **Application Performance Monitoring**
- **Customer journey analytics**
- **Predictive alerting**

## Cost-Effective Implementation

### 1. Smart Logging Strategy

**Production logging levels**:
```python
import logging
import os

# Cost-conscious logging configuration
PRODUCTION_LOG_LEVEL = os.getenv('LOG_LEVEL', 'ERROR')

logging.basicConfig(
    level=getattr(logging, PRODUCTION_LOG_LEVEL),
    format='{"timestamp": "%(asctime)s", "level": "%(levelname)s", "message": "%(message)s", "module": "%(name)s"}',
    handlers=[
        logging.StreamHandler()  # CloudWatch Logs captures stdout
    ]
)

# Structured logging for easy parsing
logger = logging.getLogger(__name__)

def log_business_event(event_type: str, customer_id: str, details: dict):
    """Log business events for compliance and debugging"""
    if event_type in ['license_verification', 'permit_generation', 'payment_processed']:
        logger.info(json.dumps({
            'event_type': event_type,
            'customer_id': customer_id,
            'timestamp': datetime.utcnow().isoformat(),
            'details': details
        }))

def log_error_with_context(error: Exception, context: dict):
    """Log errors with sufficient context for debugging"""
    logger.error(json.dumps({
        'error_type': type(error).__name__,
        'error_message': str(error),
        'context': context,
        'timestamp': datetime.utcnow().isoformat(),
        'stack_trace': traceback.format_exc() if logger.level <= logging.DEBUG else None
    }))
```

### 2. Efficient Metrics Collection

**Low-cardinality metrics**:
```python
from prometheus_client import Counter, Histogram, Gauge
import time

# Good: Low cardinality
request_duration = Histogram(
    'http_request_duration_seconds',
    'Request duration',
    ['method', 'endpoint_category']  # Not specific endpoint
)

license_verifications = Counter(
    'license_verifications_total',
    'License verification attempts',
    ['state_group', 'result']  # Group states: 'east_coast', 'west_coast', 'midwest'
)

# Bad: High cardinality (expensive)
# request_duration_by_customer = Histogram(
#     'request_duration_seconds',
#     ['customer_id', 'specific_endpoint', 'user_agent']  # Thousands of combinations
# )

# Middleware for request metrics
@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    start_time = time.time()
    
    response = await call_next(request)
    
    # Categorize endpoints to reduce cardinality
    endpoint_category = categorize_endpoint(request.url.path)
    
    request_duration.labels(
        method=request.method,
        endpoint_category=endpoint_category
    ).observe(time.time() - start_time)
    
    return response

def categorize_endpoint(path: str) -> str:
    """Reduce cardinality by grouping similar endpoints"""
    if path.startswith('/api/v1/license'):
        return 'license_api'
    elif path.startswith('/api/v1/permit'):
        return 'permit_api'
    elif path.startswith('/api/v1/fleet'):
        return 'fleet_api'
    else:
        return 'other'
```

### 3. Sampling Strategy for Traces

**Intelligent sampling**:
```python
import random
from opentelemetry import trace
from opentelemetry.exporter.jaeger.thrift import JaegerExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.trace.sampling import TraceIdRatioBased, ParentBased

class BusinessCriticalSampler:
    """Sample more traces for revenue-impacting operations"""
    
    def __init__(self):
        self.base_rate = 0.01  # 1% for normal operations
        self.critical_rate = 0.10  # 10% for critical operations
    
    def should_sample(self, trace_id: int, name: str, context: dict) -> bool:
        # Always sample errors
        if context.get('error'):
            return True
            
        # Higher sampling for revenue operations
        if any(op in name.lower() for op in ['payment', 'license_verify', 'permit_generate']):
            return random.random() < self.critical_rate
            
        # Lower sampling for health checks, metrics
        if any(op in name.lower() for op in ['health', 'metrics', 'ping']):
            return random.random() < 0.001  # 0.1%
            
        return random.random() < self.base_rate

# Configure tracing with cost-conscious sampling
sampler = BusinessCriticalSampler()
trace.set_tracer_provider(TracerProvider(sampler=ParentBased(root=sampler)))
```

### 4. Cost-Effective Alert Strategy

**Alert hierarchy**:
```python
# Immediate alerts (page someone)
CRITICAL_ALERTS = {
    'api_error_rate > 5%': 'Revenue impact',
    'database_down': 'Service unavailable', 
    'payment_processing_failed': 'Revenue loss',
    'claude_api_quota_exceeded': 'Service degraded'
}

# Warning alerts (Slack notification)
WARNING_ALERTS = {
    'api_latency_p99 > 5s': 'Performance degraded',
    'license_verification_success_rate < 90%': 'Data quality issue',
    'memory_usage > 80%': 'Resource constraint',
    'error_rate > 1%': 'Quality degraded'
}

# Info alerts (daily digest)
INFO_ALERTS = {
    'daily_active_customers': 'Business metric',
    'claude_token_usage': 'Cost tracking',
    'api_usage_by_customer': 'Usage patterns'
}
```

## Self-Hosted vs. Managed Monitoring

### Phase 1: AWS CloudWatch + Self-Hosted Grafana
```yaml
# docker-compose.monitoring.yml (development)
version: '3.8'
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=7d'  # Cost control
      
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=changeme

volumes:
  prometheus_data:
  grafana_data:
```

**Cost**: ~$5-10/month (ECS Fargate micro instances)

### Phase 2: Consider Managed Options
**DataDog**: ~$15/host + $100/month for APM
**New Relic**: ~$25/month for small deployments  
**Honeycomb**: ~$100/month for observability

**Decision criteria**:
- If monitoring complexity > 20% of development time → managed solution
- If alert fatigue > 5 false alarms/day → invest in better tooling
- If debugging production issues > 4 hours/month → upgrade monitoring

## Business-Critical Dashboards

### 1. Revenue Health Dashboard
```python
# Key business metrics
- Active paying customers (real-time)
- API calls by customer tier (hourly)
- Payment processing success rate (daily)
- Customer churn indicators (weekly)
- MRR trend (monthly)
```

### 2. Service Health Dashboard  
```python
# Operational metrics
- API response times (P50, P95, P99)
- Error rates by endpoint
- Database connection pool usage
- External dependency health (Claude, state APIs)
- Infrastructure utilization
```

### 3. Cost Monitoring Dashboard
```python
# Prevent bill shock
- AWS spend by service (daily)
- Claude API token usage (hourly)
- Data transfer costs (daily)
- Storage growth rate (weekly)
- Projected monthly costs
```

## Compliance and Audit Requirements

### 1. Required Audit Logs
```python
# Must retain for compliance
AUDIT_EVENTS = [
    'license_verification_requested',
    'permit_generated',
    'customer_data_accessed',
    'api_key_created',
    'payment_processed',
    'data_export_requested'
]

# Longer retention for audit logs
AUDIT_LOG_RETENTION = '7 years'  # Compliance requirement
OPERATIONAL_LOG_RETENTION = '30 days'  # Cost optimization
```

### 2. Security Monitoring
```python
# Security events (must monitor)
- Failed authentication attempts
- Suspicious API usage patterns  
- Data access outside normal hours
- Admin actions and privilege escalation
- External API rate limiting
```

## Monitoring Runbook

### 1. Alert Response Playbook
```markdown
## Critical Alert: API Error Rate > 5%

**Immediate Actions (0-5 minutes)**:
1. Check service health dashboard
2. Verify database connectivity
3. Check external API status (Claude, state services)
4. Review recent deployments

**Investigation (5-15 minutes)**:
1. Check error logs for common patterns
2. Verify infrastructure metrics (CPU, memory)
3. Check rate limiting on external services
4. Review customer impact scope

**Escalation (15+ minutes)**:
1. Activate incident response
2. Notify customers via status page
3. Implement fallback procedures
4. Coordinate with external service providers
```

### 2. Cost Alert Playbook
```markdown
## Warning: Monthly AWS Bill > Budget

**Immediate Actions**:
1. Check CloudWatch Logs volume
2. Review CloudWatch metrics usage
3. Check data transfer patterns
4. Verify Lambda execution duration

**Cost Optimization**:
1. Reduce log retention periods
2. Implement more aggressive sampling
3. Optimize database queries
4. Review storage lifecycle policies
```

## Implementation Priorities

### Month 1: Foundation
- CloudWatch Logs with ERROR level only
- Basic CloudWatch metrics (CPU, memory, requests)
- Simple Grafana dashboard
- PagerDuty integration for critical alerts

### Month 2: Business Metrics  
- Customer usage tracking
- Revenue-impact error monitoring
- Basic performance metrics
- Cost monitoring dashboard

### Month 3: Operational Excellence
- Comprehensive error categorization
- External dependency monitoring
- Automated alerting rules
- Performance optimization insights

This monitoring strategy balances diagnostic capability with cost control, ensuring you can effectively debug issues without breaking the bank as you scale.