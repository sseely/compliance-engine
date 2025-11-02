# Customer API Usage Tracking & Analytics

## AWS-Native Customer Analytics

### 1. CloudWatch Custom Metrics for Business Intelligence

```python
import boto3
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import json

class CustomerUsageTracker:
    """Track customer API usage using CloudWatch custom metrics"""
    
    def __init__(self):
        self.cloudwatch = boto3.client('cloudwatch')
        self.namespace = 'ComplianceEngine/Customer'
    
    async def track_api_usage(
        self, 
        customer_id: str, 
        organization_id: str,
        api_endpoint: str, 
        plan_type: str,
        processing_time: float,
        status_code: int
    ):
        """Track individual API call with business context"""
        
        # Determine API category for cost analysis
        api_category = self._categorize_endpoint(api_endpoint)
        
        metric_data = [
            {
                'MetricName': 'APICall',
                'Dimensions': [
                    {'Name': 'CustomerId', 'Value': customer_id},
                    {'Name': 'OrganizationId', 'Value': organization_id},
                    {'Name': 'APICategory', 'Value': api_category},
                    {'Name': 'PlanType', 'Value': plan_type}
                ],
                'Value': 1,
                'Unit': 'Count',
                'Timestamp': datetime.utcnow()
            },
            {
                'MetricName': 'APILatency',
                'Dimensions': [
                    {'Name': 'APICategory', 'Value': api_category},
                    {'Name': 'PlanType', 'Value': plan_type}
                ],
                'Value': processing_time,
                'Unit': 'Seconds',
                'Timestamp': datetime.utcnow()
            }
        ]
        
        # Track errors separately for customer health monitoring
        if status_code >= 400:
            metric_data.append({
                'MetricName': 'APIError',
                'Dimensions': [
                    {'Name': 'CustomerId', 'Value': customer_id},
                    {'Name': 'APICategory', 'Value': api_category},
                    {'Name': 'StatusCode', 'Value': str(status_code)}
                ],
                'Value': 1,
                'Unit': 'Count',
                'Timestamp': datetime.utcnow()
            })
        
        # Send to CloudWatch
        await self._send_metrics(metric_data)
    
    async def track_business_event(
        self, 
        customer_id: str, 
        event_type: str, 
        value: float = 1.0,
        metadata: Dict = None
    ):
        """Track business events (signups, upgrades, cancellations)"""
        
        metric_data = [{
            'MetricName': event_type,
            'Dimensions': [
                {'Name': 'CustomerId', 'Value': customer_id}
            ],
            'Value': value,
            'Unit': 'Count' if value == 1.0 else 'None',
            'Timestamp': datetime.utcnow()
        }]
        
        await self._send_metrics(metric_data)
        
        # Store detailed event in CloudWatch Logs for analysis
        if metadata:
            await self._log_business_event(customer_id, event_type, metadata)
    
    def _categorize_endpoint(self, endpoint: str) -> str:
        """Categorize API endpoints for cost and usage analysis"""
        if '/license' in endpoint:
            return 'license_verification'
        elif '/permit' in endpoint:
            return 'permit_generation'
        elif '/fleet' in endpoint:
            return 'fleet_compliance'
        elif '/professional' in endpoint:
            return 'professional_tracking'
        else:
            return 'other'
    
    async def _send_metrics(self, metric_data: List[Dict]):
        """Send metrics to CloudWatch with error handling"""
        try:
            # CloudWatch limits to 20 metrics per call
            for i in range(0, len(metric_data), 20):
                batch = metric_data[i:i+20]
                self.cloudwatch.put_metric_data(
                    Namespace=self.namespace,
                    MetricData=batch
                )
        except Exception as e:
            # Don't fail API calls due to metrics issues
            logger.error(f"Failed to send metrics: {e}")
    
    async def _log_business_event(self, customer_id: str, event_type: str, metadata: Dict):
        """Log business events for detailed analysis"""
        log_data = {
            'timestamp': datetime.utcnow().isoformat(),
            'customer_id': customer_id,
            'event_type': event_type,
            'metadata': metadata
        }
        
        # Send to CloudWatch Logs for analysis
        logger.info(json.dumps(log_data))
```

### 2. Customer Usage Dashboard Data

```python
class CustomerAnalytics:
    """Retrieve customer usage data for dashboards and billing"""
    
    def __init__(self):
        self.cloudwatch = boto3.client('cloudwatch')
        self.namespace = 'ComplianceEngine/Customer'
    
    async def get_customer_usage(
        self, 
        customer_id: str, 
        start_date: datetime, 
        end_date: datetime
    ) -> Dict:
        """Get comprehensive customer usage for their dashboard"""
        
        # API call count by category
        api_usage = await self._get_metric_data(
            metric_name='APICall',
            dimensions=[{'Name': 'CustomerId', 'Value': customer_id}],
            start_time=start_date,
            end_time=end_date,
            statistic='Sum'
        )
        
        # Error rates
        error_count = await self._get_metric_data(
            metric_name='APIError',
            dimensions=[{'Name': 'CustomerId', 'Value': customer_id}],
            start_time=start_date,
            end_time=end_date,
            statistic='Sum'
        )
        
        # Average response times
        avg_latency = await self._get_metric_data(
            metric_name='APILatency',
            dimensions=[],  # All customers for comparison
            start_time=start_date,
            end_time=end_date,
            statistic='Average'
        )
        
        return {
            'total_api_calls': sum(api_usage.values()),
            'api_calls_by_category': api_usage,
            'error_count': sum(error_count.values()),
            'error_rate': sum(error_count.values()) / max(sum(api_usage.values()), 1),
            'average_response_time': avg_latency.get('average', 0),
            'usage_trend': await self._calculate_usage_trend(customer_id, start_date, end_date)
        }
    
    async def get_plan_utilization(self, customer_id: str, plan_limit: int) -> Dict:
        """Check customer's plan utilization for billing/alerts"""
        
        current_month_start = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        current_usage = await self.get_customer_usage(
            customer_id, 
            current_month_start, 
            datetime.now()
        )
        
        utilization_percentage = (current_usage['total_api_calls'] / plan_limit) * 100
        
        return {
            'current_usage': current_usage['total_api_calls'],
            'plan_limit': plan_limit,
            'utilization_percentage': utilization_percentage,
            'projected_monthly_usage': self._project_monthly_usage(current_usage['total_api_calls']),
            'days_remaining': (datetime.now().replace(month=datetime.now().month+1, day=1) - datetime.now()).days,
            'needs_upgrade': utilization_percentage > 80
        }
    
    async def _get_metric_data(
        self, 
        metric_name: str, 
        dimensions: List[Dict], 
        start_time: datetime, 
        end_time: datetime,
        statistic: str = 'Sum'
    ) -> Dict:
        """Helper to retrieve CloudWatch metric data"""
        
        try:
            response = self.cloudwatch.get_metric_statistics(
                Namespace=self.namespace,
                MetricName=metric_name,
                Dimensions=dimensions,
                StartTime=start_time,
                EndTime=end_time,
                Period=3600,  # 1 hour buckets
                Statistics=[statistic]
            )
            
            # Process datapoints into useful format
            datapoints = response.get('Datapoints', [])
            return {
                dp['Timestamp'].isoformat(): dp[statistic] 
                for dp in sorted(datapoints, key=lambda x: x['Timestamp'])
            }
            
        except Exception as e:
            logger.error(f"Failed to get metric data: {e}")
            return {}
    
    def _project_monthly_usage(self, current_usage: int) -> int:
        """Project end-of-month usage based on current trends"""
        days_elapsed = datetime.now().day
        days_in_month = 30  # Approximation
        
        if days_elapsed == 0:
            return 0
            
        daily_average = current_usage / days_elapsed
        return int(daily_average * days_in_month)
```

### 3. Customer Dashboard API Endpoints

```python
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timedelta

router = APIRouter(prefix="/customer", tags=["customer-portal"])

@router.get("/usage")
async def get_customer_usage(
    customer: Customer = Depends(get_current_customer),
    days: int = 30
):
    """Customer dashboard - their API usage and metrics"""
    
    analytics = CustomerAnalytics()
    
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    # Get comprehensive usage data
    usage_data = await analytics.get_customer_usage(
        customer.id, 
        start_date, 
        end_date
    )
    
    # Get plan utilization
    plan_data = await analytics.get_plan_utilization(
        customer.id, 
        customer.organization.plan_limit
    )
    
    return {
        "usage": usage_data,
        "plan": plan_data,
        "period": {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "days": days
        }
    }

@router.get("/usage/breakdown")
async def get_usage_breakdown(
    customer: Customer = Depends(get_current_customer),
    category: Optional[str] = None
):
    """Detailed breakdown of API usage by endpoint/category"""
    
    analytics = CustomerAnalytics()
    
    # Get detailed breakdown
    current_month = datetime.now().replace(day=1)
    breakdown = await analytics.get_detailed_breakdown(
        customer.id,
        current_month,
        datetime.now(),
        category
    )
    
    return {
        "breakdown": breakdown,
        "total_calls": sum(breakdown.values()),
        "period": "current_month"
    }

@router.get("/billing/forecast")
async def get_billing_forecast(
    customer: Customer = Depends(get_current_customer)
):
    """Billing forecast based on current usage trends"""
    
    analytics = CustomerAnalytics()
    plan_data = await analytics.get_plan_utilization(
        customer.id,
        customer.organization.plan_limit
    )
    
    # Calculate overage charges if applicable
    projected_usage = plan_data['projected_monthly_usage']
    plan_limit = plan_data['plan_limit']
    
    forecast = {
        "base_charge": customer.organization.plan_amount,
        "projected_usage": projected_usage,
        "plan_limit": plan_limit,
        "overage_amount": 0,
        "total_projected": customer.organization.plan_amount
    }
    
    if projected_usage > plan_limit:
        overage_calls = projected_usage - plan_limit
        overage_rate = 0.01  # $0.01 per call over limit
        forecast["overage_amount"] = overage_calls * overage_rate
        forecast["total_projected"] += forecast["overage_amount"]
    
    return forecast
```

### 4. Usage Tracking Middleware

```python
from starlette.middleware.base import BaseHTTPMiddleware
import time

class UsageTrackingMiddleware(BaseHTTPMiddleware):
    """Middleware to automatically track all API usage"""
    
    def __init__(self, app):
        super().__init__(app)
        self.usage_tracker = CustomerUsageTracker()
    
    async def dispatch(self, request: Request, call_next):
        # Extract customer context
        customer_id = await self._extract_customer_id(request)
        organization_id = await self._extract_organization_id(request)
        plan_type = await self._extract_plan_type(request)
        
        # Skip tracking for health checks and internal endpoints
        if self._should_skip_tracking(request.url.path):
            return await call_next(request)
        
        start_time = time.time()
        
        # Process request
        response = await call_next(request)
        
        processing_time = time.time() - start_time
        
        # Track usage asynchronously (don't block response)
        if customer_id:
            asyncio.create_task(
                self.usage_tracker.track_api_usage(
                    customer_id=customer_id,
                    organization_id=organization_id,
                    api_endpoint=request.url.path,
                    plan_type=plan_type,
                    processing_time=processing_time,
                    status_code=response.status_code
                )
            )
        
        return response
    
    async def _extract_customer_id(self, request: Request) -> Optional[str]:
        """Extract customer ID from JWT token or API key"""
        try:
            # From JWT token
            token = request.headers.get("authorization", "").replace("Bearer ", "")
            if token:
                payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
                return payload.get("customer_id")
            
            # From API key
            api_key = request.headers.get("x-api-key")
            if api_key:
                customer = await get_customer_by_api_key(api_key)
                return customer.id if customer else None
                
        except Exception:
            return None
    
    def _should_skip_tracking(self, path: str) -> bool:
        """Skip tracking for non-billable endpoints"""
        skip_paths = ['/health', '/metrics', '/docs', '/redoc', '/openapi.json']
        return any(path.startswith(skip) for skip in skip_paths)
```

### 5. Billing Integration

```python
class BillingUsageCalculator:
    """Calculate monthly bills based on CloudWatch usage data"""
    
    def __init__(self):
        self.analytics = CustomerAnalytics()
    
    async def calculate_monthly_bill(
        self, 
        customer_id: str, 
        billing_period_start: datetime,
        billing_period_end: datetime
    ) -> Dict:
        """Calculate customer's bill for the billing period"""
        
        # Get usage data for billing period
        usage_data = await self.analytics.get_customer_usage(
            customer_id,
            billing_period_start,
            billing_period_end
        )
        
        customer = await get_customer(customer_id)
        plan = customer.organization.plan
        
        # Calculate base charges
        base_charge = plan.monthly_amount
        
        # Calculate overage charges
        total_calls = usage_data['total_api_calls']
        included_calls = plan.included_api_calls
        
        overage_calls = max(0, total_calls - included_calls)
        overage_charge = overage_calls * plan.overage_rate
        
        # Calculate by product if different pricing
        product_breakdown = {}
        for category, calls in usage_data['api_calls_by_category'].items():
            rate = self._get_category_rate(category, plan)
            product_breakdown[category] = {
                'calls': calls,
                'rate': rate,
                'amount': calls * rate if calls > included_calls else 0
            }
        
        return {
            'customer_id': customer_id,
            'billing_period': {
                'start': billing_period_start.isoformat(),
                'end': billing_period_end.isoformat()
            },
            'base_charge': base_charge,
            'usage': {
                'total_calls': total_calls,
                'included_calls': included_calls,
                'overage_calls': overage_calls,
                'overage_charge': overage_charge
            },
            'product_breakdown': product_breakdown,
            'total_amount': base_charge + overage_charge
        }
    
    async def generate_usage_alerts(self):
        """Check all customers for usage threshold alerts"""
        
        customers = await get_all_active_customers()
        
        for customer in customers:
            plan_data = await self.analytics.get_plan_utilization(
                customer.id,
                customer.organization.plan_limit
            )
            
            # Send alerts at 80% and 95% usage
            if plan_data['utilization_percentage'] >= 95:
                await self._send_usage_alert(customer, "95_percent", plan_data)
            elif plan_data['utilization_percentage'] >= 80:
                await self._send_usage_alert(customer, "80_percent", plan_data)
    
    def _get_category_rate(self, category: str, plan) -> float:
        """Get per-call rate for different API categories"""
        category_rates = {
            'license_verification': 0.01,
            'permit_generation': 0.05,
            'fleet_compliance': 0.02,
            'professional_tracking': 0.01
        }
        return category_rates.get(category, 0.01)
```

This AWS-native approach gives you:

- **Real-time usage tracking** via CloudWatch custom metrics
- **Customer dashboard data** for self-service portal
- **Automated billing calculations** based on actual usage
- **Cost-effective scaling** ($0.30/metric/month vs. complex infrastructure)
- **Business intelligence** built into AWS ecosystem

The middleware automatically tracks every API call, and customers can see their usage in real-time through their dashboard.