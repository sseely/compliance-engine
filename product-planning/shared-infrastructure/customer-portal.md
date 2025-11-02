# Customer Portal Architecture

## Overview

A comprehensive self-service portal reduces support burden for a one-person business while providing excellent developer experience. The portal handles documentation, API key management, usage monitoring, and community support.

## Core Components

### 1. API Documentation Portal
**Purpose**: Reduce "how do I" support tickets through excellent documentation

**Features**:
- **Interactive API explorer**: Test endpoints directly in browser
- **Code examples**: Multiple languages (Python, JavaScript, curl, etc.)
- **Response schemas**: Clear data structure documentation
- **Error code reference**: Detailed error explanations and solutions
- **Rate limiting docs**: Clear limits and best practices
- **Webhook documentation**: Event schemas and retry logic
- **SDKs and libraries**: Maintained client libraries for popular languages

**Implementation**:
- **FastAPI automatic docs**: `/docs` and `/redoc` endpoints
- **Custom documentation site**: Additional tutorials and guides
- **Postman collections**: Importable API collections for testing
- **OpenAPI spec**: Machine-readable API definitions

### 2. Customer Dashboard
**Purpose**: Self-service account management and API key administration

**Key Features**:

#### API Key Management
- **Generate/revoke keys**: Instant key creation and management
- **Key scoping**: Limit keys to specific products or endpoints
- **Environment separation**: Separate keys for development/production
- **Key rotation**: Easy key replacement without service disruption
- **Usage tracking per key**: Monitor which keys are used where

#### Usage Monitoring
- **Real-time usage**: Current month API calls, limits, overages
- **Historical trends**: Charts showing usage patterns over time
- **Endpoint breakdown**: Which APIs are used most frequently
- **Response time metrics**: Performance monitoring for customer APIs
- **Error rate tracking**: Failed requests with categorization
- **Geographic usage**: Where requests originate (for debugging)

#### Billing and Subscription
- **Current plan details**: Limits, pricing, next billing date
- **Usage alerts**: Notifications approaching plan limits
- **Upgrade/downgrade**: Self-service plan changes
- **Billing history**: Invoice downloads and payment methods
- **Usage forecasting**: Predict next month's usage based on trends

### 3. API Request/Response Logging
**Purpose**: Enable customer debugging without support tickets

**Features**:

#### Request Logging
- **Recent requests**: Last 1000 requests with full details
- **Request filtering**: Filter by endpoint, status code, time range
- **Request details**: Headers, body, parameters, timestamp
- **Response details**: Status, headers, body, processing time
- **Error categorization**: Client errors vs server errors vs rate limits

#### Debugging Tools
- **Request replay**: Re-send previous requests for testing
- **cURL generation**: Convert logged requests to cURL commands
- **Response validation**: Check responses against expected schemas
- **Performance insights**: Slow request identification and optimization tips

#### Privacy Controls
- **Data retention**: Automatic purging after 30 days
- **Sensitive data masking**: Redact PII from logs automatically
- **Opt-out options**: Disable logging for privacy-sensitive customers

### 4. Support Forum
**Purpose**: Community-driven support reducing direct support load

**Forum Structure**:
- **Product-specific sections**: License API, Permits, Fleet, Professional
- **General discussion**: Feature requests, announcements
- **Developer corner**: Code sharing, integration examples
- **Troubleshooting**: Common issues and solutions

**Moderation Strategy**:
- **Community moderation**: Reward active helpful community members
- **FAQ integration**: Auto-suggest FAQ articles for common questions
- **Founder participation**: Regular but not constant participation
- **Expert recognition**: Highlight particularly helpful community members

**Implementation Options**:
- **Discourse**: Self-hosted, excellent for technical communities
- **GitHub Discussions**: Integrated with code repositories
- **Custom forum**: Built into main application for unified experience

### 5. Status Page and Monitoring
**Purpose**: Proactive communication about service health

**Components**:
- **Service status**: Real-time status of all APIs and services
- **Historical uptime**: 30/90-day uptime statistics
- **Incident reports**: Detailed post-mortems for any outages
- **Maintenance notifications**: Scheduled maintenance announcements
- **Performance metrics**: Average response times and availability

**Implementation**: 
- **StatusPage.io**: Professional hosted solution
- **Custom status page**: Integrated with monitoring systems

## Technical Implementation

### Customer Portal Application
```python
# Customer portal as separate FastAPI application
# Route: portal.compliance-engine.com

@app.get("/dashboard")
async def dashboard(user: User = Depends(get_current_user)):
    """Main customer dashboard"""
    usage_stats = await get_usage_stats(user.organization_id)
    api_keys = await get_api_keys(user.organization_id)
    recent_requests = await get_recent_requests(user.organization_id, limit=10)
    
    return {
        "usage": usage_stats,
        "api_keys": api_keys,
        "recent_activity": recent_requests,
        "plan_details": user.organization.plan
    }

@app.post("/api-keys")
async def create_api_key(
    key_request: APIKeyRequest,
    user: User = Depends(get_current_user)
):
    """Generate new API key with scoping"""
    api_key = await create_scoped_api_key(
        organization_id=user.organization_id,
        name=key_request.name,
        scopes=key_request.scopes,
        environment=key_request.environment
    )
    
    # Log key creation for audit
    await log_api_key_event("created", api_key.id, user.id)
    
    return {"api_key": api_key.key, "key_id": api_key.id}
```

### Request Logging System
```python
# Middleware to log all API requests for customer debugging
class RequestLoggingMiddleware:
    def __init__(self, app, retention_days: int = 30):
        self.app = app
        self.retention_days = retention_days
    
    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            # Capture request details
            request = Request(scope, receive)
            organization_id = await extract_organization_id(request)
            
            start_time = time.time()
            
            # Process request and capture response
            response = await self.app(scope, receive, send)
            
            processing_time = time.time() - start_time
            
            # Log request/response (async to avoid blocking)
            await log_api_request({
                "organization_id": organization_id,
                "method": request.method,
                "path": request.url.path,
                "headers": dict(request.headers),
                "query_params": dict(request.query_params),
                "status_code": response.status_code,
                "processing_time": processing_time,
                "timestamp": datetime.utcnow(),
                "request_id": str(uuid.uuid4())
            })
```

### Usage Analytics
```python
# Real-time usage tracking and alerting
class UsageTracker:
    def __init__(self, redis_client, postgres_pool):
        self.redis = redis_client
        self.postgres = postgres_pool
    
    async def track_request(self, organization_id: str, endpoint: str):
        """Track API usage in real-time"""
        current_month = datetime.now().strftime("%Y-%m")
        
        # Increment counters
        await self.redis.hincrby(
            f"usage:{organization_id}:{current_month}",
            endpoint,
            1
        )
        
        # Check for usage alerts
        total_usage = await self.get_monthly_usage(organization_id)
        plan_limit = await self.get_plan_limit(organization_id)
        
        if total_usage > plan_limit * 0.8:  # 80% threshold
            await self.send_usage_alert(organization_id, total_usage, plan_limit)
```

## Self-Service Features

### Automated Onboarding
1. **Account creation**: Email verification and organization setup
2. **API key generation**: Automatic test key creation
3. **Documentation walkthrough**: Interactive tutorial
4. **First API call**: Guided experience making first request
5. **Integration examples**: Working code samples in multiple languages

### Troubleshooting Automation
- **Common error detection**: Automatic suggestions for frequent error codes
- **Integration health checks**: Verify API keys and permissions
- **Response validation**: Check API responses against expected schemas
- **Performance recommendations**: Suggest optimizations for slow requests

### Community-Driven Support
- **FAQ auto-generation**: Convert common support tickets into FAQ entries
- **Community answers**: Allow experienced users to answer questions
- **Reputation system**: Reward helpful community members
- **Expert escalation**: Clear path to founder for complex issues

## Metrics and KPIs

### Support Reduction Metrics
- **Ticket deflection rate**: % of users who find answers without creating tickets
- **Self-service completion rate**: % of tasks completed without support intervention
- **Documentation page views**: Most accessed documentation sections
- **Forum activity**: Posts, responses, resolution rates

### Customer Success Metrics
- **Time to first API call**: How quickly customers get started
- **API adoption rate**: % of customers actively using APIs after onboarding
- **Feature discovery**: Which portal features are most used
- **Customer satisfaction**: Portal usability and effectiveness scores

### Business Impact Metrics
- **Support cost per customer**: Direct support time vs. portal usage
- **Customer retention**: Correlation between portal usage and retention
- **Expansion revenue**: Portal usage leading to plan upgrades
- **Community growth**: Forum membership and engagement trends

## Implementation Priority

### Phase 1 (MVP - Months 1-2)
- Basic customer dashboard with API key management
- Simple usage tracking and billing information
- Essential API documentation with examples
- Basic request/response logging (last 100 requests)

### Phase 2 (Enhanced - Months 3-4)
- Interactive API documentation and testing
- Advanced usage analytics and alerting
- Support forum implementation
- Status page and service monitoring

### Phase 3 (Advanced - Months 5-6)
- AI-powered troubleshooting suggestions
- Advanced analytics and insights
- Community reputation system
- Integration health monitoring

This customer portal architecture provides comprehensive self-service capabilities that scale with the business while maintaining the personal touch of a boutique compliance provider.