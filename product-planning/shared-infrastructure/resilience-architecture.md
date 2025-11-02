# Resilience Architecture & Graceful Degradation

## CAP Theorem Strategy

For compliance systems, we prioritize **Availability** and **Partition Tolerance** over strict **Consistency**.

**Rationale**: A construction project halted by a down license verification API costs thousands per day. Serving license data that's 1 hour stale is better than being completely unavailable.

**Design principle**: Always return a response, even if degraded.

## Failure Scenarios & Mitigation

### 1. External API Failures

#### Claude API Unavailable
**Impact**: Document extraction fails, permit generation broken

**Circuit Breaker Implementation**:
```python
from circuitbreaker import circuit

@circuit(failure_threshold=5, recovery_timeout=30, expected_exception=Exception)
async def extract_with_claude(document: bytes) -> ExtractionResult:
    """Circuit breaker for Claude API calls"""
    response = await claude_client.extract_document(document)
    return parse_claude_response(response)

async def extract_document_with_fallback(document: bytes) -> ExtractionResult:
    """Primary extraction with graceful degradation"""
    try:
        return await extract_with_claude(document)
    except CircuitBreakerOpenException:
        # Fallback: Return cached template or manual review flag
        return ExtractionResult(
            status="degraded",
            message="Automatic extraction unavailable, manual review required",
            confidence=0.0,
            requires_manual_review=True
        )
```

**Graceful Degradation**:
- **Level 1**: Return cached extraction templates for common document types
- **Level 2**: Flag documents for manual review (queue for later processing)
- **Level 3**: Provide document upload with "processing delayed" message

#### State Licensing Website Failures
**Impact**: License verification returns stale or unavailable data

**Circuit Breaker + Caching Strategy**:
```python
@circuit(failure_threshold=3, recovery_timeout=60)
async def scrape_license_data(state: str, license_number: str) -> LicenseData:
    """Circuit breaker for state website scraping"""
    return await state_scraper.get_license(state, license_number)

async def verify_license_with_fallback(
    license_number: str, 
    state: str
) -> LicenseVerificationResult:
    """License verification with multi-level fallback"""
    
    # Try real-time verification
    try:
        fresh_data = await scrape_license_data(state, license_number)
        await cache_license_data(fresh_data, ttl=3600)  # Cache for 1 hour
        return LicenseVerificationResult(
            status=fresh_data.status,
            confidence=1.0,
            data_age=0,
            source="real_time"
        )
    except CircuitBreakerOpenException:
        pass
    
    # Fallback to cached data
    cached_data = await get_cached_license_data(license_number, state)
    if cached_data and cached_data.age < timedelta(days=7):
        return LicenseVerificationResult(
            status=cached_data.status,
            confidence=0.8,
            data_age=cached_data.age.total_seconds(),
            source="cached",
            warning="Data may be up to 7 days old"
        )
    
    # Final fallback: Manual verification flag
    return LicenseVerificationResult(
        status="unknown",
        confidence=0.0,
        source="unavailable",
        error="Verification service temporarily unavailable",
        manual_verification_required=True
    )
```

### 2. Database Failures

#### PostgreSQL Connection Loss
**Impact**: All data access fails, complete service disruption

**Connection Pool Resilience**:
```python
from sqlalchemy.pool import QueuePool
from tenacity import retry, stop_after_attempt, wait_exponential

class ResilientDatabase:
    def __init__(self):
        self.engine = create_async_engine(
            DATABASE_URL,
            poolclass=QueuePool,
            pool_size=5,
            max_overflow=10,
            pool_pre_ping=True,  # Validate connections
            pool_recycle=3600    # Recycle connections hourly
        )
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def execute_query(self, query: str, params: dict = None):
        """Execute query with automatic retry"""
        async with self.engine.begin() as conn:
            return await conn.execute(text(query), params)
    
    async def get_with_fallback(self, key: str) -> Optional[dict]:
        """Get data with local cache fallback"""
        try:
            return await self.execute_query("SELECT * FROM cache WHERE key = :key", {"key": key})
        except Exception as e:
            logger.warning(f"Database unavailable, using local cache: {e}")
            return self.local_cache.get(key)
```

**Read Replica Failover**:
```python
class DatabaseCluster:
    def __init__(self):
        self.primary = create_engine(PRIMARY_DB_URL)
        self.replicas = [create_engine(url) for url in REPLICA_DB_URLS]
        self.replica_index = 0
    
    async def read_with_failover(self, query: str) -> Any:
        """Read from replica with automatic failover"""
        for attempt in range(len(self.replicas) + 1):  # +1 for primary fallback
            try:
                if attempt < len(self.replicas):
                    engine = self.replicas[(self.replica_index + attempt) % len(self.replicas)]
                else:
                    engine = self.primary  # Final fallback to primary
                
                async with engine.begin() as conn:
                    return await conn.execute(text(query))
            except Exception as e:
                logger.warning(f"Database attempt {attempt + 1} failed: {e}")
                continue
        
        raise DatabaseUnavailableError("All database instances unavailable")
```

### 3. Application-Level Failures

#### Memory/CPU Exhaustion
**Impact**: Slow responses, request timeouts, potential crashes

**Resource Circuit Breakers**:
```python
import psutil
from fastapi import HTTPException

class ResourceCircuitBreaker:
    def __init__(self, cpu_threshold=80, memory_threshold=80):
        self.cpu_threshold = cpu_threshold
        self.memory_threshold = memory_threshold
        self.is_open = False
        self.failure_count = 0
        self.last_failure = None
    
    def check_resources(self):
        """Check system resources and trip circuit breaker if needed"""
        cpu_percent = psutil.cpu_percent(interval=1)
        memory_percent = psutil.virtual_memory().percent
        
        if cpu_percent > self.cpu_threshold or memory_percent > self.memory_threshold:
            self.failure_count += 1
            self.last_failure = datetime.now()
            
            if self.failure_count >= 3:
                self.is_open = True
                raise HTTPException(
                    status_code=503,
                    detail="Service temporarily unavailable due to high load"
                )
        else:
            # Reset on successful check
            self.failure_count = 0
            self.is_open = False

# Middleware to check resources on each request
resource_breaker = ResourceCircuitBreaker()

@app.middleware("http")
async def resource_check_middleware(request: Request, call_next):
    try:
        resource_breaker.check_resources()
        return await call_next(request)
    except HTTPException:
        # Return cached response or simplified version
        return await serve_degraded_response(request)
```

## Graceful Degradation Levels

### Level 1: Full Service (Normal Operation)
- Real-time data from all sources
- Complete feature functionality
- Sub-second response times
- Full accuracy guarantees

### Level 2: Cached Service (Recent Data)
- Cached data up to 1 hour old
- Most features functional
- Response times slightly slower
- 95% accuracy with age warnings

### Level 3: Degraded Service (Stale Data)
- Cached data up to 7 days old
- Limited feature set
- Clear "degraded service" indicators
- Manual verification options provided

### Level 4: Emergency Service (Minimal Function)
- Static responses and error messages
- Manual process instructions
- Contact information for urgent requests
- Service status updates

## Implementation Patterns

### Health Check Endpoints
```python
@app.get("/health")
async def health_check():
    """Basic health check for load balancer"""
    return {"status": "healthy", "timestamp": datetime.utcnow()}

@app.get("/health/detailed")
async def detailed_health_check():
    """Detailed health check for monitoring"""
    checks = {
        "database": await check_database_health(),
        "claude_api": await check_claude_health(),
        "state_scrapers": await check_scraper_health(),
        "disk_space": check_disk_space(),
        "memory": check_memory_usage()
    }
    
    overall_status = "healthy" if all(check["status"] == "healthy" for check in checks.values()) else "degraded"
    
    return {
        "status": overall_status,
        "checks": checks,
        "timestamp": datetime.utcnow()
    }
```

### Timeout Management
```python
import asyncio
from contextlib import asynccontextmanager

@asynccontextmanager
async def timeout_context(seconds: int):
    """Context manager for operation timeouts"""
    try:
        async with asyncio.timeout(seconds):
            yield
    except asyncio.TimeoutError:
        logger.warning(f"Operation timed out after {seconds} seconds")
        raise TimeoutError(f"Operation exceeded {seconds} second timeout")

async def license_verification_with_timeout(license_number: str, state: str):
    """License verification with timeout protection"""
    try:
        async with timeout_context(10):  # 10 second timeout
            return await verify_license(license_number, state)
    except TimeoutError:
        # Return cached data or degraded response
        return await get_cached_license_with_fallback(license_number, state)
```

### Bulkhead Pattern
```python
import asyncio
from asyncio import Semaphore

class ServiceBulkhead:
    """Isolate failures using resource pools"""
    def __init__(self):
        self.claude_semaphore = Semaphore(5)      # Max 5 concurrent Claude calls
        self.scraper_semaphore = Semaphore(10)    # Max 10 concurrent scraper calls
        self.database_semaphore = Semaphore(20)   # Max 20 concurrent DB operations
    
    async def claude_operation(self, operation):
        async with self.claude_semaphore:
            return await operation()
    
    async def scraper_operation(self, operation):
        async with self.scraper_semaphore:
            return await operation()
    
    async def database_operation(self, operation):
        async with self.database_semaphore:
            return await operation()

# Usage
bulkhead = ServiceBulkhead()

async def extract_document(document):
    return await bulkhead.claude_operation(
        lambda: extract_with_claude(document)
    )
```

## Monitoring & Alerting

### Key Metrics to Track
```python
# Circuit breaker metrics
circuit_breaker_open_total = Counter('circuit_breaker_open_total', ['service'])
circuit_breaker_requests_total = Counter('circuit_breaker_requests_total', ['service', 'outcome'])

# Degradation metrics
service_degradation_level = Gauge('service_degradation_level', ['service'])
cache_hit_ratio = Histogram('cache_hit_ratio', ['cache_type'])

# Resource metrics
resource_usage = Gauge('resource_usage_percent', ['resource_type'])
request_timeout_total = Counter('request_timeout_total', ['endpoint'])
```

### Alert Conditions
- **Circuit breaker open** for >5 minutes → Page immediately
- **Service degradation** Level 3+ → Alert within 15 minutes  
- **Cache hit ratio** <60% → Investigate data freshness
- **Timeout rate** >5% → Check resource constraints
- **Error rate** >1% → Check external dependencies

## Recovery Strategies

### Automatic Recovery
```python
class AutoRecovery:
    async def monitor_and_recover(self):
        """Background task for automatic recovery"""
        while True:
            try:
                # Check circuit breaker states
                await self.attempt_circuit_breaker_recovery()
                
                # Refresh critical cached data
                await self.refresh_critical_cache()
                
                # Validate data consistency
                await self.validate_data_consistency()
                
                # Sleep before next check
                await asyncio.sleep(60)
                
            except Exception as e:
                logger.error(f"Recovery process failed: {e}")
                await asyncio.sleep(300)  # Wait longer on failure
    
    async def attempt_circuit_breaker_recovery(self):
        """Try to close open circuit breakers"""
        for service_name, breaker in self.circuit_breakers.items():
            if breaker.is_open and breaker.should_attempt_reset():
                try:
                    await self.test_service_health(service_name)
                    breaker.close()
                    logger.info(f"Circuit breaker closed for {service_name}")
                except Exception:
                    logger.debug(f"Service {service_name} still unhealthy")
```

### Manual Recovery Procedures
1. **Database failover**: Switch to read replica, promote to primary
2. **Cache warming**: Pre-populate cache with critical data after recovery
3. **Gradual traffic resumption**: Slowly increase traffic to recovered services
4. **Data consistency checks**: Validate data integrity after partition recovery

## Testing Resilience

### Chaos Engineering
```python
# Chaos testing middleware for development
class ChaosMiddleware:
    def __init__(self, failure_rate=0.05):
        self.failure_rate = failure_rate
    
    async def __call__(self, scope, receive, send):
        if random.random() < self.failure_rate:
            # Simulate random failures in development
            failure_type = random.choice([
                "timeout", "connection_error", "high_latency", "partial_failure"
            ])
            await self.simulate_failure(failure_type)
        
        return await self.app(scope, receive, send)
```

### Resilience Testing Checklist
- [ ] Circuit breakers trip and recover correctly
- [ ] Graceful degradation maintains basic functionality
- [ ] Cache fallbacks provide reasonable user experience
- [ ] Resource exhaustion doesn't crash the service
- [ ] Database failover completes within SLA
- [ ] Monitoring alerts fire at appropriate thresholds

## Additional Resilience Patterns

### 1. Retry Patterns with Exponential Backoff
**Problem**: Transient failures in external services (state websites, Claude API)

```python
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
import random

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10) + wait_random(0, 2),  # Add jitter
    retry=retry_if_exception_type((ConnectionError, TimeoutError))
)
async def scrape_with_retry(url: str) -> dict:
    """Scrape with exponential backoff and jitter"""
    return await scraper.get(url)

# Custom retry for rate-limited APIs
@retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=2, min=60, max=300),  # Back off more aggressively
    retry=retry_if_exception_type(RateLimitError)
)
async def claude_api_with_retry(prompt: str) -> str:
    """Claude API calls with rate limit handling"""
    return await claude_client.complete(prompt)
```

### 2. Rate Limiting and Throttling
**Problem**: Protect your APIs from overuse and respect external API limits

```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)

# Per-customer rate limiting
@limiter.limit("100/minute")  # Free tier
@limiter.limit("1000/minute", per_method=True, methods=["POST"])  # Paid tier
@app.post("/api/v1/verify")
async def verify_license(request: Request, license_data: LicenseRequest):
    """Rate-limited license verification"""
    return await license_service.verify(license_data)

# Adaptive rate limiting based on downstream health
class AdaptiveRateLimiter:
    def __init__(self):
        self.base_limit = 1000
        self.current_limit = 1000
        self.error_rate_threshold = 0.05
    
    async def adjust_limit_based_on_errors(self, error_rate: float):
        """Reduce rate limit when downstream is struggling"""
        if error_rate > self.error_rate_threshold:
            self.current_limit = max(self.base_limit * 0.5, 100)
        else:
            self.current_limit = min(self.current_limit * 1.1, self.base_limit)
```

### 3. Load Shedding
**Problem**: System overwhelmed, need to prioritize important requests

```python
import asyncio
from enum import Enum

class RequestPriority(Enum):
    CRITICAL = 1    # Paid customers, critical compliance checks
    NORMAL = 2      # Regular API calls
    LOW = 3         # Free tier, background processing

class LoadShedder:
    def __init__(self, max_queue_size=1000):
        self.max_queue_size = max_queue_size
        self.current_load = 0
        
    async def should_accept_request(self, priority: RequestPriority) -> bool:
        """Decide whether to accept request based on current load"""
        load_percentage = self.current_load / self.max_queue_size
        
        if load_percentage < 0.7:
            return True  # Accept all requests
        elif load_percentage < 0.9:
            return priority != RequestPriority.LOW  # Drop low priority
        else:
            return priority == RequestPriority.CRITICAL  # Only critical requests

@app.middleware("http")
async def load_shedding_middleware(request: Request, call_next):
    priority = determine_request_priority(request)
    
    if not await load_shedder.should_accept_request(priority):
        return JSONResponse(
            status_code=503,
            content={"error": "Service temporarily overloaded, please retry"}
        )
    
    return await call_next(request)
```

### 4. Idempotency Patterns
**Problem**: Critical for compliance - ensure operations can be safely retried

```python
import hashlib
from typing import Optional

class IdempotencyKey:
    def __init__(self, redis_client):
        self.redis = redis_client
        self.ttl = 3600  # 1 hour
    
    def generate_key(self, user_id: str, operation: str, parameters: dict) -> str:
        """Generate deterministic idempotency key"""
        content = f"{user_id}:{operation}:{sorted(parameters.items())}"
        return hashlib.sha256(content.encode()).hexdigest()
    
    async def get_cached_result(self, key: str) -> Optional[dict]:
        """Get previously computed result"""
        cached = await self.redis.get(f"idempotency:{key}")
        return json.loads(cached) if cached else None
    
    async def cache_result(self, key: str, result: dict):
        """Cache result for future identical requests"""
        await self.redis.setex(
            f"idempotency:{key}", 
            self.ttl, 
            json.dumps(result)
        )

@app.post("/api/v1/permits/generate")
async def generate_permit(permit_request: PermitRequest, user: User = Depends(get_user)):
    """Idempotent permit generation"""
    idempotency_key = IdempotencyKey.generate_key(
        user.id, 
        "generate_permit", 
        permit_request.dict()
    )
    
    # Check for existing result
    cached_result = await idempotency.get_cached_result(idempotency_key)
    if cached_result:
        return cached_result
    
    # Generate new permit
    result = await permit_service.generate(permit_request)
    
    # Cache for future identical requests
    await idempotency.cache_result(idempotency_key, result)
    
    return result
```

### 5. Event Sourcing for Audit Trails
**Problem**: Compliance requires complete audit trails of all changes

```python
from dataclasses import dataclass
from typing import List
import json

@dataclass
class DomainEvent:
    event_type: str
    aggregate_id: str
    event_data: dict
    timestamp: datetime
    user_id: str
    correlation_id: str

class EventStore:
    def __init__(self, postgres_pool):
        self.db = postgres_pool
    
    async def append_events(self, events: List[DomainEvent]):
        """Append events atomically"""
        async with self.db.begin() as conn:
            for event in events:
                await conn.execute(
                    """
                    INSERT INTO event_store (
                        event_type, aggregate_id, event_data, 
                        timestamp, user_id, correlation_id
                    ) VALUES ($1, $2, $3, $4, $5, $6)
                    """,
                    event.event_type, event.aggregate_id, 
                    json.dumps(event.event_data), event.timestamp,
                    event.user_id, event.correlation_id
                )

# Usage in license verification
async def verify_license_with_audit(license_request: LicenseRequest, user: User):
    """License verification with complete audit trail"""
    correlation_id = str(uuid.uuid4())
    
    # Record verification attempt
    events = [
        DomainEvent(
            event_type="LicenseVerificationRequested",
            aggregate_id=license_request.license_number,
            event_data={
                "license_number": license_request.license_number,
                "state": license_request.state,
                "requested_by": user.id
            },
            timestamp=datetime.utcnow(),
            user_id=user.id,
            correlation_id=correlation_id
        )
    ]
    
    try:
        result = await license_service.verify(license_request)
        
        # Record successful verification
        events.append(
            DomainEvent(
                event_type="LicenseVerificationCompleted",
                aggregate_id=license_request.license_number,
                event_data={
                    "result": result.status,
                    "confidence": result.confidence,
                    "data_source": result.source
                },
                timestamp=datetime.utcnow(),
                user_id=user.id,
                correlation_id=correlation_id
            )
        )
        
    except Exception as e:
        # Record failure
        events.append(
            DomainEvent(
                event_type="LicenseVerificationFailed",
                aggregate_id=license_request.license_number,
                event_data={
                    "error": str(e),
                    "error_type": type(e).__name__
                },
                timestamp=datetime.utcnow(),
                user_id=user.id,
                correlation_id=correlation_id
            )
        )
        raise
    
    finally:
        # Always record events for audit
        await event_store.append_events(events)
    
    return result
```

### 6. Dead Letter Queues
**Problem**: Failed background processing shouldn't lose data

```python
import boto3
from dataclasses import dataclass

@dataclass
class ProcessingJob:
    job_id: str
    job_type: str
    payload: dict
    retry_count: int = 0
    max_retries: int = 3

class JobProcessor:
    def __init__(self):
        self.sqs = boto3.client('sqs')
        self.main_queue = "document-processing"
        self.dlq = "document-processing-dlq"
    
    async def process_document_extraction_job(self, job: ProcessingJob):
        """Process document extraction with DLQ handling"""
        try:
            result = await extract_document(job.payload['document_url'])
            await self.mark_job_complete(job.job_id, result)
            
        except Exception as e:
            job.retry_count += 1
            
            if job.retry_count <= job.max_retries:
                # Retry with exponential backoff
                delay = 2 ** job.retry_count * 60  # 2, 4, 8 minutes
                await self.schedule_retry(job, delay)
            else:
                # Send to dead letter queue for manual investigation
                await self.send_to_dlq(job, str(e))
    
    async def send_to_dlq(self, job: ProcessingJob, error_message: str):
        """Send failed job to dead letter queue"""
        dlq_message = {
            "original_job": job.__dict__,
            "error": error_message,
            "failed_at": datetime.utcnow().isoformat(),
            "requires_manual_review": True
        }
        
        await self.sqs.send_message(
            QueueUrl=self.dlq,
            MessageBody=json.dumps(dlq_message)
        )
        
        # Alert operations team
        await self.send_dlq_alert(job, error_message)
```

### 7. Saga Pattern for Multi-Step Processes
**Problem**: Permit generation involves multiple steps that could fail

```python
from abc import ABC, abstractmethod
from typing import List, Optional

class SagaStep(ABC):
    @abstractmethod
    async def execute(self, context: dict) -> dict:
        """Execute the step"""
        pass
    
    @abstractmethod
    async def compensate(self, context: dict) -> dict:
        """Undo the step if saga fails"""
        pass

class PermitGenerationSaga:
    def __init__(self):
        self.steps = [
            ValidateRequirementsStep(),
            ExtractDocumentDataStep(),
            GeneratePermitFormsStep(),
            SubmitToJurisdictionStep(),
            SendNotificationStep()
        ]
    
    async def execute(self, permit_request: PermitRequest) -> PermitResult:
        """Execute saga with compensation on failure"""
        context = {"permit_request": permit_request}
        completed_steps = []
        
        try:
            for step in self.steps:
                result = await step.execute(context)
                context.update(result)
                completed_steps.append(step)
                
                # Save progress for recovery
                await self.save_saga_state(permit_request.id, context)
            
            return PermitResult(
                status="completed",
                permit_documents=context["permit_documents"],
                submission_receipt=context["submission_receipt"]
            )
            
        except Exception as e:
            # Compensate completed steps in reverse order
            for step in reversed(completed_steps):
                try:
                    await step.compensate(context)
                except Exception as comp_error:
                    logger.error(f"Compensation failed for {step}: {comp_error}")
            
            # Mark saga as failed
            await self.mark_saga_failed(permit_request.id, str(e))
            raise PermitGenerationError(f"Permit generation failed: {e}")

class ExtractDocumentDataStep(SagaStep):
    async def execute(self, context: dict) -> dict:
        document_url = context["permit_request"].document_url
        extracted_data = await claude_service.extract_document(document_url)
        return {"extracted_data": extracted_data}
    
    async def compensate(self, context: dict) -> dict:
        # Clean up any temporary files
        if "temp_files" in context:
            await cleanup_temp_files(context["temp_files"])
        return {}
```

### 8. Back Pressure and Flow Control
**Problem**: Slow downstream services cause queue buildup

```python
import asyncio
from asyncio import Semaphore

class BackPressureController:
    def __init__(self, max_concurrent=10, queue_threshold=100):
        self.semaphore = Semaphore(max_concurrent)
        self.queue = asyncio.Queue(maxsize=queue_threshold)
        self.processing_rate = 0
        self.last_rate_check = time.time()
    
    async def process_with_backpressure(self, operation, *args, **kwargs):
        """Process operation with back pressure control"""
        
        # Check if queue is getting full
        if self.queue.qsize() > self.queue.maxsize * 0.8:
            # Apply back pressure - slow down incoming requests
            await asyncio.sleep(0.1)
        
        async with self.semaphore:
            start_time = time.time()
            try:
                result = await operation(*args, **kwargs)
                self.update_processing_rate(start_time)
                return result
            except Exception as e:
                # Slow down on errors
                await asyncio.sleep(1)
                raise
    
    def update_processing_rate(self, start_time: float):
        """Track processing rate for adaptive throttling"""
        processing_time = time.time() - start_time
        self.processing_rate = 0.9 * self.processing_rate + 0.1 * (1 / processing_time)
        
        # Adjust concurrency based on processing rate
        if self.processing_rate < 5:  # Less than 5 req/sec
            self.semaphore = Semaphore(max(5, self.semaphore._value - 1))
        elif self.processing_rate > 20:  # More than 20 req/sec
            self.semaphore = Semaphore(min(20, self.semaphore._value + 1))
```

### 9. Outbox Pattern for Reliable Messaging
**Problem**: Ensure notifications are sent even if external services fail

```python
class OutboxPattern:
    """Ensure reliable message delivery using transactional outbox"""
    
    async def send_license_verification_notification(
        self, 
        license_result: LicenseResult, 
        user: User
    ):
        """Send notification reliably using outbox pattern"""
        
        # Store notification in outbox within same transaction as business logic
        async with self.db.begin() as transaction:
            # Update license verification result
            await self.save_license_result(license_result, transaction)
            
            # Store outgoing message in outbox table
            outbox_message = {
                "id": str(uuid.uuid4()),
                "event_type": "license_verification_completed",
                "destination": user.email,
                "payload": {
                    "license_number": license_result.license_number,
                    "status": license_result.status,
                    "verification_date": datetime.utcnow().isoformat()
                },
                "created_at": datetime.utcnow(),
                "processed": False
            }
            
            await transaction.execute(
                "INSERT INTO outbox (id, event_type, destination, payload, created_at, processed) "
                "VALUES ($1, $2, $3, $4, $5, $6)",
                outbox_message["id"], outbox_message["event_type"],
                outbox_message["destination"], json.dumps(outbox_message["payload"]),
                outbox_message["created_at"], outbox_message["processed"]
            )
    
    async def process_outbox_messages(self):
        """Background job to process outbox messages"""
        while True:
            try:
                unprocessed = await self.get_unprocessed_messages()
                
                for message in unprocessed:
                    try:
                        await self.send_message(message)
                        await self.mark_message_processed(message["id"])
                    except Exception as e:
                        logger.error(f"Failed to send message {message['id']}: {e}")
                        # Will retry on next cycle
                
                await asyncio.sleep(30)  # Check every 30 seconds
                
            except Exception as e:
                logger.error(f"Outbox processing failed: {e}")
                await asyncio.sleep(60)  # Wait longer on error
```

## Pattern Selection Guide

**Use Circuit Breakers for**: External API failures, downstream service protection
**Use Retry with Backoff for**: Transient network issues, rate-limited APIs  
**Use Rate Limiting for**: API protection, fair usage enforcement
**Use Load Shedding for**: System overload, priority-based request handling
**Use Idempotency for**: Critical operations, payment processing, compliance actions
**Use Event Sourcing for**: Audit trails, compliance requirements, debugging
**Use Dead Letter Queues for**: Background job failures, data loss prevention
**Use Saga Pattern for**: Multi-step business processes, distributed transactions
**Use Back Pressure for**: Queue management, resource protection
**Use Outbox Pattern for**: Reliable notifications, event publishing

This comprehensive resilience architecture ensures your compliance system stays available even when individual components fail, maintaining customer trust and business continuity.