# Load Balancing Strategy for Compliance APIs

## AWS Load Balancing Options

### Application Load Balancer (ALB) - Recommended

**Why ALB for API Load Balancing**:
✅ **Layer 7 routing** (HTTP/HTTPS with path-based routing)  
✅ **Health checks** with custom endpoints  
✅ **SSL termination** (manage certificates centrally)  
✅ **WebSocket support** (for real-time features)  
✅ **AWS ecosystem integration** (ECS, Lambda, EC2)  
✅ **Cost-effective** (~$20/month + data processing)  

### Load Balancing Architecture

```
Internet → Route 53 → CloudFront CDN → ALB → ECS Fargate Services
                                      ↓
                           Health Check Endpoints
                                      ↓
                              Auto Scaling Groups
```

## Implementation Strategy

### Phase 1: Single Region ALB (MVP)
```yaml
# Target: 0-10K requests/day
Infrastructure:
  - Single ALB in us-east-1
  - 2 ECS Fargate tasks (minimum)
  - Health checks on /health endpoint
  - SSL certificate via ACM

Cost: ~$25/month
Handles: 100K+ requests/day easily
```

### Phase 2: Multi-AZ with Auto Scaling
```yaml
# Target: 10K-100K requests/day  
Infrastructure:
  - ALB across 3 availability zones
  - ECS Auto Scaling (2-10 tasks)
  - CloudWatch metrics triggering
  - Application health monitoring

Cost: ~$50-100/month
Handles: 1M+ requests/day
```

### Phase 3: Multi-Region with Global Load Balancing
```yaml
# Target: 100K+ requests/day
Infrastructure:
  - Route 53 weighted routing
  - ALBs in us-east-1 and us-west-2
  - Cross-region RDS read replicas
  - Global CloudFront distribution

Cost: ~$200-400/month
Handles: 10M+ requests/day
```

## ALB Configuration

### Target Group Setup
```python
# Infrastructure as Code (CDK)
from aws_cdk import (
    aws_elasticloadbalancingv2 as elbv2,
    aws_ecs as ecs,
    aws_ec2 as ec2
)

class ComplianceAPILoadBalancer(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs):
        super().__init__(scope, construct_id, **kwargs)
        
        # VPC and subnets
        vpc = ec2.Vpc(self, "ComplianceVPC",
            max_azs=3,
            enable_dns_hostnames=True,
            enable_dns_support=True
        )
        
        # Application Load Balancer
        alb = elbv2.ApplicationLoadBalancer(self, "ComplianceALB",
            vpc=vpc,
            internet_facing=True,
            load_balancer_name="compliance-api-alb"
        )
        
        # Target group for FastAPI containers
        target_group = elbv2.ApplicationTargetGroup(self, "FastAPITargets",
            port=8000,
            protocol=elbv2.ApplicationProtocol.HTTP,
            target_type=elbv2.TargetType.IP,
            vpc=vpc,
            health_check=elbv2.HealthCheck(
                enabled=True,
                healthy_threshold_count=2,
                interval=Duration.seconds(30),
                path="/health",
                protocol=elbv2.Protocol.HTTP,
                timeout=Duration.seconds(5),
                unhealthy_threshold_count=3
            )
        )
        
        # HTTPS listener
        listener = alb.add_listener("HTTPSListener",
            port=443,
            protocol=elbv2.ApplicationProtocol.HTTPS,
            certificates=[certificate],
            default_target_groups=[target_group]
        )
        
        # Path-based routing for different APIs
        listener.add_action("LicenseAPIRoute",
            priority=100,
            conditions=[
                elbv2.ListenerCondition.path_patterns(["/api/v1/license/*"])
            ],
            action=elbv2.ListenerAction.forward([license_target_group])
        )
        
        listener.add_action("PermitAPIRoute", 
            priority=200,
            conditions=[
                elbv2.ListenerCondition.path_patterns(["/api/v1/permit/*"])
            ],
            action=elbv2.ListenerAction.forward([permit_target_group])
        )
```

### Health Check Implementation
```python
# FastAPI health check endpoint
from fastapi import FastAPI, status
from fastapi.responses import JSONResponse
import asyncio
import time

app = FastAPI()

@app.get("/health")
async def health_check():
    """ALB health check endpoint"""
    health_status = {
        "status": "healthy",
        "timestamp": time.time(),
        "checks": {}
    }
    
    # Database connectivity check
    try:
        await check_database_connection()
        health_status["checks"]["database"] = "healthy"
    except Exception as e:
        health_status["checks"]["database"] = "unhealthy"
        health_status["status"] = "unhealthy"
    
    # External API connectivity (optional)
    try:
        await check_external_apis()
        health_status["checks"]["external_apis"] = "healthy"
    except Exception:
        health_status["checks"]["external_apis"] = "degraded"
        # Don't mark as unhealthy for external API issues
    
    # Return appropriate status code
    if health_status["status"] == "healthy":
        return JSONResponse(content=health_status, status_code=200)
    else:
        return JSONResponse(content=health_status, status_code=503)

@app.get("/health/ready")
async def readiness_check():
    """Kubernetes-style readiness check"""
    # More strict - must be ready to serve traffic
    await check_database_connection()
    await verify_migrations_current()
    return {"status": "ready"}

@app.get("/health/live") 
async def liveness_check():
    """Kubernetes-style liveness check"""
    # Basic - just verify process is responsive
    return {"status": "alive", "timestamp": time.time()}
```

## Auto Scaling Configuration

### ECS Auto Scaling
```python
# ECS Service with auto scaling
service = ecs.FargateService(self, "ComplianceAPIService",
    cluster=cluster,
    task_definition=task_definition,
    desired_count=2,  # Minimum 2 for HA
    max_healthy_percent=200,
    min_healthy_percent=50,
    enable_execute_command=True,  # For debugging
    assign_public_ip=False  # Private subnets only
)

# Auto scaling based on CPU and request count
scaling = service.auto_scale_task_count(
    min_capacity=2,
    max_capacity=10
)

# Scale on CPU utilization
scaling.scale_on_cpu_utilization("CPUScaling",
    target_utilization_percent=70,
    scale_in_cooldown=Duration.minutes(5),
    scale_out_cooldown=Duration.minutes(2)
)

# Scale on ALB request count
scaling.scale_on_request_count("RequestCountScaling",
    requests_per_target=1000,  # Requests per container per minute
    target_group=target_group,
    scale_in_cooldown=Duration.minutes(5),
    scale_out_cooldown=Duration.minutes(2)
)
```

### Custom Scaling Metrics
```python
# Custom CloudWatch metrics for business-aware scaling
import boto3

cloudwatch = boto3.client('cloudwatch')

async def track_api_load_metrics():
    """Track business metrics for intelligent scaling"""
    
    # Track by customer tier (scale more aggressively for premium customers)
    premium_customer_requests = await get_premium_customer_request_count()
    
    cloudwatch.put_metric_data(
        Namespace='ComplianceEngine/Business',
        MetricData=[
            {
                'MetricName': 'PremiumCustomerRequests',
                'Value': premium_customer_requests,
                'Unit': 'Count/Minute'
            }
        ]
    )
    
    # Track API success rate (scale up if errors increase)
    error_rate = await calculate_error_rate()
    
    cloudwatch.put_metric_data(
        Namespace='ComplianceEngine/Quality',
        MetricData=[
            {
                'MetricName': 'APIErrorRate',
                'Value': error_rate,
                'Unit': 'Percent'
            }
        ]
    )

# Scale based on business metrics
scaling.scale_on_metric("BusinessMetricScaling",
    metric=cloudwatch.Metric(
        namespace="ComplianceEngine/Business",
        metric_name="PremiumCustomerRequests"
    ),
    scaling_steps=[
        {"upper": 100, "change": +1},
        {"upper": 500, "change": +3},
        {"upper": 1000, "change": +5}
    ]
)
```

## Global Load Balancing (Multi-Region)

### Route 53 Weighted Routing
```python
# Route 53 configuration for global load balancing
route53 = aws_route53.HostedZone(self, "ComplianceZone",
    zone_name="compliance-engine.com"
)

# Primary region (us-east-1)
primary_record = route53.RecordSet(self, "PrimaryAPIRecord",
    zone=route53,
    record_name="api",
    record_type=aws_route53.RecordType.A,
    target=aws_route53.RecordTarget.from_alias(
        aws_route53_targets.LoadBalancerTarget(primary_alb)
    ),
    set_identifier="us-east-1",
    weight=100,  # 100% traffic initially
    health_check_id=primary_health_check.health_check_id
)

# Secondary region (us-west-2) - activated when primary fails
secondary_record = route53.RecordSet(self, "SecondaryAPIRecord", 
    zone=route53,
    record_name="api",
    record_type=aws_route53.RecordType.A,
    target=aws_route53.RecordTarget.from_alias(
        aws_route53_targets.LoadBalancerTarget(secondary_alb)
    ),
    set_identifier="us-west-2", 
    weight=0,  # 0% traffic initially
    health_check_id=secondary_health_check.health_check_id
)
```

### Health Checks for Failover
```python
# Route 53 health checks
primary_health_check = route53.HealthCheck(self, "PrimaryHealthCheck",
    type=aws_route53.HealthCheckType.HTTPS,
    resource_path="/health",
    fqdn="api-primary.compliance-engine.com",
    port=443,
    request_interval=30,
    failure_threshold=3
)

secondary_health_check = route53.HealthCheck(self, "SecondaryHealthCheck",
    type=aws_route53.HealthCheckType.HTTPS, 
    resource_path="/health",
    fqdn="api-secondary.compliance-engine.com",
    port=443,
    request_interval=30,
    failure_threshold=3
)
```

## CloudFront Integration

### CDN for API Endpoints
```python
# CloudFront distribution for API caching and global performance
distribution = cloudfront.Distribution(self, "APIDistribution",
    default_behavior=cloudfront.BehaviorOptions(
        origin=origins.LoadBalancerV2Origin(alb,
            protocol_policy=cloudfront.OriginProtocolPolicy.HTTPS_ONLY
        ),
        viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowed_methods=cloudfront.AllowedMethods.ALLOW_ALL,
        cache_policy=cloudfront.CachePolicy.CACHING_DISABLED,  # APIs typically don't cache
        origin_request_policy=cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER
    ),
    
    # Cache static documentation
    additional_behaviors={
        "/docs/*": cloudfront.BehaviorOptions(
            origin=origins.S3Origin(docs_bucket),
            cache_policy=cloudfront.CachePolicy.CACHING_OPTIMIZED,
            viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS
        )
    },
    
    domain_names=["api.compliance-engine.com"],
    certificate=certificate,
    
    # Geographic restrictions if needed for compliance
    geo_restriction=cloudfront.GeoRestriction.allowlist("US", "CA")
)
```

## Monitoring and Alerting

### ALB Metrics to Monitor
```python
# CloudWatch alarms for load balancer health
target_response_time_alarm = cloudwatch.Alarm(self, "HighResponseTime",
    metric=alb.metric_target_response_time(),
    threshold=1000,  # 1 second
    evaluation_periods=2,
    datapoints_to_alarm=2,
    alarm_description="API response time too high"
)

healthy_host_count_alarm = cloudwatch.Alarm(self, "LowHealthyHosts",
    metric=target_group.metric_healthy_host_count(),
    threshold=1,  # Alert if less than 1 healthy host
    evaluation_periods=2,
    comparison_operator=cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
    alarm_description="Insufficient healthy API hosts"
)

request_count_alarm = cloudwatch.Alarm(self, "HighRequestVolume",
    metric=alb.metric_request_count(),
    threshold=10000,  # 10K requests in 5 minutes
    evaluation_periods=1,
    statistic=cloudwatch.Statistic.SUM,
    period=Duration.minutes(5),
    alarm_description="High API request volume - consider scaling"
)
```

## Cost Optimization

### Load Balancer Cost Analysis
```
ALB Pricing (2024 rates):
- $0.0225 per ALB-hour in US East (Ohio) (~$16.43/month)
- $0.008 per LCU-hour (Load Balancer Capacity Units)

Source: AWS Elastic Load Balancing Pricing
https://aws.amazon.com/elasticloadbalancing/pricing/

LCU calculation (each LCU includes up to):
- 25 new connections per second
- 3,000 active connections per minute  
- 1 GB of processed data per hour
- 1,000 rule evaluations per second

Billing note: You pay for the highest usage dimension in a given hour.

Example costs (24/7 operation):
- Base ALB: $16.43/month (730 hours × $0.0225)
- 1 LCU average: +$5.84/month (730 × $0.008)
- Total for small API: ~$22.27/month

Estimated scaling:
- 1K req/day: ~$25/month (base + minimal LCU)
- 10K req/day: ~$30/month  
- 100K req/day: ~$50/month
- 1M req/day: ~$150/month
```

### Cost Optimization Strategies
```python
# Schedule-based scaling for predictable traffic
schedule_scaling_down = aws_applicationautoscaling.Schedule(self, "ScaleDown",
    schedule=aws_applicationautoscaling.Schedule.cron(
        hour="22",    # 10 PM
        minute="0"
    ),
    min_capacity=1,   # Scale down at night
    max_capacity=3
)

schedule_scaling_up = aws_applicationautoscaling.Schedule(self, "ScaleUp", 
    schedule=aws_applicationautoscaling.Schedule.cron(
        hour="6",     # 6 AM
        minute="0"
    ),
    min_capacity=2,   # Scale up for business hours
    max_capacity=10
)
```

## Implementation Phases

### Phase 1: Basic ALB (Week 1)
- Single ALB with SSL termination
- 2 ECS Fargate tasks minimum
- Basic health checks
- CloudWatch monitoring

### Phase 2: Auto Scaling (Week 2)
- CPU and request-based scaling
- Custom business metrics
- Improved health checks
- Alerting setup

### Phase 3: High Availability (Week 3-4)
- Multi-AZ deployment
- Route 53 health checks
- CloudFront integration
- Advanced monitoring

### Phase 4: Global Scale (Future)
- Multi-region deployment
- Global load balancing
- Cross-region failover
- Performance optimization

This load balancing strategy scales from MVP to enterprise-grade automatically while maintaining cost efficiency at each phase.