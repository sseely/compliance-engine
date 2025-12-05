# Zero Downtime Deployment Strategy

## Overview

Our zero downtime deployment strategy ensures vCurrent and vNext can run simultaneously during deployments with no service interruption.

## Architecture Components

### 1. Rolling Deployment Configuration

**ECS Service Settings:**
- `minHealthyPercent: 100` - Never drop below full capacity
- `maxHealthyPercent: 200` - Allow double capacity during rollout  
- `deploymentCircuitBreaker: enabled` - Auto-rollback on failures

**Timeline:**
1. New tasks start alongside existing ones (200% capacity)
2. New tasks pass health checks (90-120 seconds)
3. Load balancer begins routing to new tasks
4. Old tasks drain connections (300 seconds)
5. Old tasks terminate after drain completion

### 2. Health Check Strategy

**Three-Tier Health Checks:**

1. **Container Liveness** (`/health/live`)
   - Basic process health check
   - Fast response (<100ms)
   - Used by ECS for container restart decisions

2. **Application Readiness** (`/health/ready`)  
   - Database connectivity check
   - External service dependency check
   - Used by ALB for traffic routing
   - May take longer during startup (database migrations)

3. **Deep Health Check** (`/health/deep`)
   - Full system validation
   - Used by monitoring and manual verification
   - Not used for automated decisions

### 3. Database Migration Strategy

**Backward Compatible Migrations Only:**

✅ **Safe Operations:**
- Adding new tables
- Adding new columns with defaults
- Adding new indexes (with `CONCURRENTLY`)
- Creating new stored procedures
- Adding new enum values at the end

❌ **Dangerous Operations:**
- Dropping columns (use deprecation instead)
- Renaming columns (use aliasing)
- Changing column types (use new column + migration)
- Dropping tables (use soft deletion)
- Removing enum values

**Migration Process:**
1. **Phase 1**: Deploy schema changes that are backward compatible
2. **Phase 2**: Deploy application code that uses new schema
3. **Phase 3**: (Later) Clean up deprecated columns/tables

### 4. API Versioning Strategy

**Header-Based Versioning:**
```
X-API-Version: 2024-01-15
```

**Compatibility Matrix:**
- Each API version supported for minimum 6 months
- vCurrent handles N and N-1 API versions
- vNext handles N+1, N, and N-1 API versions
- Overlapping support during deployment

### 5. Feature Flag Integration

**Runtime Feature Toggles:**
```python
@feature_flag("new_license_validation")
async def enhanced_license_check():
    # New implementation
    pass

async def standard_license_check():
    # Current implementation  
    pass
```

**Benefits:**
- Instant rollback without deployment
- Gradual rollout to percentage of traffic
- A/B testing capabilities
- Safe validation of new features

### 6. Connection Draining

**ALB Configuration:**
- Deregistration delay: 300 seconds
- Keep-alive timeout: 60 seconds
- Idle timeout: 60 seconds

**Application Graceful Shutdown:**
```python
import signal
import asyncio

class GracefulShutdown:
    def __init__(self):
        self.shutdown = False
        signal.signal(signal.SIGTERM, self._shutdown_handler)
    
    def _shutdown_handler(self, signum, frame):
        self.shutdown = True
        
    async def shutdown_sequence(self):
        # Stop accepting new requests
        # Finish processing existing requests
        # Close database connections
        # Exit
```

### 7. Circuit Breaker Pattern

**Implementation:**
```python
from circuitbreaker import circuit

@circuit(failure_threshold=5, recovery_timeout=30)
async def external_api_call():
    # API call that might fail
    pass
```

**Applied To:**
- External license verification APIs
- Database connection issues
- File upload services
- Email sending services

### 8. Monitoring During Deployments

**Key Metrics:**
- Response time P95/P99
- Error rate by endpoint
- Active connection count
- Task health status
- Database connection pool usage

**Automated Rollback Triggers:**
- Error rate > 1% for 2 minutes
- Response time P95 > 2 seconds for 3 minutes
- Health check failure rate > 10%

## Deployment Process

### 1. Pre-Deployment Validation
```bash
# Run database migration tests
./scripts/test-migrations.sh

# Validate API compatibility  
./scripts/test-api-compatibility.sh

# Check feature flag configuration
./scripts/validate-feature-flags.sh
```

### 2. Deployment Execution
```bash
# 1. Deploy database migrations (backward compatible)
./scripts/migrate-database.sh

# 2. Update ECS service with new task definition
aws ecs update-service \
  --cluster compliance-engine-prod \
  --service compliance-engine-prod \
  --task-definition compliance-engine:123

# 3. Monitor deployment
./scripts/monitor-deployment.sh

# 4. Validate health
./scripts/validate-deployment.sh
```

### 3. Post-Deployment Verification
```bash
# API functionality tests
./scripts/test-api-endpoints.sh

# Performance baseline comparison
./scripts/performance-baseline.sh

# Business logic validation
./scripts/test-business-workflows.sh
```

## Rollback Strategy

### Automatic Rollback (Circuit Breaker)
- Triggered by ECS deployment circuit breaker
- Reverts to previous task definition
- Completes within 5 minutes

### Manual Rollback
```bash
# Immediate rollback to previous version
./scripts/rollback.sh --version previous

# Rollback to specific version
./scripts/rollback.sh --version v1.2.3

# Emergency stop (scale to 0, then restore)
./scripts/emergency-stop.sh
```

### Database Rollback Strategy
- **Schema changes**: Cannot be automatically rolled back
- **Data changes**: Use transaction logs for point-in-time recovery
- **Prevention**: Extensive testing in staging environment

## Testing Strategy

### 1. Staging Environment
- Identical to production infrastructure
- Test full deployment pipeline
- Load testing with production-like data volume

### 2. Canary Deployments (Future)
- Deploy to single AZ first
- Monitor metrics for 15 minutes
- Gradually expand to remaining AZs

### 3. Blue/Green Deployments (Future)
- Maintain two identical environments
- Switch traffic at DNS/ALB level
- Instant rollback capability

## Cost Implications

**During Deployment (5-10 minutes):**
- Double compute capacity: ~$50-200/deployment
- Double database connections: Minimal impact
- Monitoring overhead: ~$1-5/deployment

**Annual Cost:**
- 100 deployments/year × $100 average = $10,000
- Cost of downtime avoided: $50,000-500,000/incident
- **ROI**: 5x-50x positive

## Implementation Checklist

- [x] ECS rolling deployment configuration
- [x] Enhanced health check endpoints  
- [x] ALB connection draining
- [ ] Database migration validation scripts
- [ ] Feature flag framework
- [ ] Circuit breaker implementation
- [ ] Deployment monitoring dashboard
- [ ] Automated rollback triggers
- [ ] API versioning framework
- [ ] Performance baseline tracking

This strategy ensures true zero downtime deployments while maintaining system reliability and providing multiple safety nets for rapid recovery.