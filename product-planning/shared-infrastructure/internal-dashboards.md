# Internal Monitoring Dashboards & Alerts

## Dashboard Architecture

### 1. Business Health Dashboard
**Primary audience**: Founder/business stakeholders  
**Update frequency**: Real-time with 5-minute aggregation

```python
# Key Business Metrics
dashboard_metrics = {
    'revenue': {
        'mrr_current': 'Current month recurring revenue',
        'mrr_growth': 'Month-over-month growth %',
        'arr_projection': 'Annual recurring revenue projection',
        'churn_rate': 'Monthly customer churn %'
    },
    'customers': {
        'active_customers': 'Customers with API calls this month',
        'new_signups': 'New customer registrations',
        'churned_customers': 'Customers who cancelled',
        'expansion_revenue': 'Existing customers upgrading plans'
    },
    'usage': {
        'api_calls_total': 'Total API calls across all products',
        'api_calls_by_product': 'Breakdown by License/Permit/Fleet/Professional',
        'usage_per_customer': 'Average API calls per customer',
        'free_tier_conversions': 'Free to paid conversion rate'
    }
}
```

**Grafana dashboard configuration**:
```json
{
  "dashboard": {
    "title": "Business Health",
    "tags": ["business", "revenue"],
    "panels": [
      {
        "title": "Monthly Recurring Revenue",
        "type": "stat",
        "targets": [
          {
            "expr": "sum(customer_mrr_total)",
            "legendFormat": "Current MRR"
          }
        ],
        "fieldConfig": {
          "unit": "currencyUSD",
          "thresholds": {
            "steps": [
              {"color": "red", "value": 0},
              {"color": "yellow", "value": 5000},
              {"color": "green", "value": 15000}
            ]
          }
        }
      },
      {
        "title": "API Usage Trends",
        "type": "timeseries",
        "targets": [
          {
            "expr": "rate(api_requests_total[5m])",
            "legendFormat": "{{product}}"
          }
        ]
      }
    ]
  }
}
```

### 2. Operations Dashboard
**Primary audience**: Technical operations (founder initially)  
**Update frequency**: Real-time

```python
# Operational Health Metrics
ops_metrics = {
    'availability': {
        'api_uptime': 'Service availability %',
        'response_time_p99': '99th percentile response time',
        'error_rate': 'Error rate by endpoint',
        'external_dependency_health': 'Claude API, state services status'
    },
    'performance': {
        'database_connections': 'Active DB connections',
        'memory_usage': 'Application memory usage',
        'cpu_usage': 'CPU utilization',
        'cache_hit_ratio': 'Cache effectiveness'
    },
    'costs': {
        'daily_aws_spend': 'Current day AWS costs',
        'claude_token_usage': 'LLM API token consumption',
        'monthly_projection': 'Projected monthly infrastructure cost'
    }
}
```

### 3. Customer Success Dashboard
**Primary audience**: Customer success (founder + future team)  
**Update frequency**: Hourly aggregation

```python
# Customer Success Metrics
customer_metrics = {
    'health_scores': {
        'usage_trends': 'Increasing/decreasing API usage',
        'error_rates_by_customer': 'Customers experiencing issues',
        'support_ticket_volume': 'Support requests by customer',
        'time_to_first_success': 'New customer onboarding speed'
    },
    'expansion_opportunities': {
        'approaching_limits': 'Customers near plan limits',
        'multi_product_candidates': 'Single-product customers for upsell',
        'api_adoption_depth': 'Which endpoints customers use',
        'integration_completeness': 'Successful vs. abandoned integrations'
    }
}
```

## Alert Configuration

### Critical Production Alerts (PagerDuty)
```python
CRITICAL_ALERTS = {
    'api_down': {
        'condition': 'avg(up{job="compliance-api"}) < 0.8',
        'duration': '2m',
        'severity': 'critical',
        'runbook': 'https://docs.internal/runbooks/api-down'
    },
    'high_error_rate': {
        'condition': 'rate(http_requests_total{status=~"5.."}[5m]) > 0.05',
        'duration': '5m', 
        'severity': 'critical',
        'runbook': 'https://docs.internal/runbooks/high-errors'
    },
    'database_unavailable': {
        'condition': 'up{job="postgres"} == 0',
        'duration': '1m',
        'severity': 'critical',
        'runbook': 'https://docs.internal/runbooks/db-down'
    },
    'payment_processing_failed': {
        'condition': 'increase(payment_failures_total[10m]) > 3',
        'duration': '0s',
        'severity': 'critical',
        'runbook': 'https://docs.internal/runbooks/payment-issues'
    }
}

WARNING_ALERTS = {
    'high_response_time': {
        'condition': 'histogram_quantile(0.99, http_request_duration_seconds) > 5',
        'duration': '10m',
        'severity': 'warning',
        'channel': 'slack'
    },
    'external_api_degraded': {
        'condition': 'rate(external_api_errors_total[10m]) > 0.1',
        'duration': '5m',
        'severity': 'warning',
        'channel': 'slack'
    },
    'customer_churn_spike': {
        'condition': 'increase(customer_cancellations_total[1h]) > 5',
        'duration': '0s',
        'severity': 'warning',
        'channel': 'slack'
    }
}
```

### Business Alerts (Slack/Email)
```python
BUSINESS_ALERTS = {
    'revenue_milestones': {
        'condition': 'mrr_total > 10000',  # $10K MRR milestone
        'severity': 'info',
        'channel': 'slack-general'
    },
    'large_customer_signup': {
        'condition': 'customer_plan_value > 500',  # $500+ monthly plan
        'severity': 'info', 
        'channel': 'slack-sales'
    },
    'cost_budget_exceeded': {
        'condition': 'daily_aws_spend * 30 > monthly_budget',
        'severity': 'warning',
        'channel': 'slack-ops'
    }
}
```

## Implementation Tasks

### Phase 1: Core Infrastructure (Week 1-2)
```bash
# Prometheus configuration
# File: prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  - job_name: 'compliance-api'
    static_configs:
      - targets: ['api:8000']
    metrics_path: '/metrics'
    
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres:5432']
```

```yaml
# Alert rules configuration  
# File: alert_rules.yml
groups:
  - name: api_alerts
    rules:
      - alert: APIDown
        expr: up{job="compliance-api"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "API is down"
          description: "The compliance API has been down for more than 2 minutes"
          
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High API error rate"
          description: "API error rate is {{ $value }} over the last 5 minutes"
```

### Phase 2: Business Metrics (Week 3-4)
```python
# Customer usage tracking service
class BusinessMetricsCollector:
    def __init__(self, prometheus_registry, database):
        self.registry = prometheus_registry
        self.db = database
        
        # Business metrics
        self.mrr_gauge = Gauge('monthly_recurring_revenue', 'Current MRR', registry=self.registry)
        self.active_customers = Gauge('active_customers_total', 'Active customers', registry=self.registry)
        self.api_usage = Counter('customer_api_usage_total', 'API usage by customer', 
                               ['customer_id', 'product', 'plan_type'], registry=self.registry)
    
    async def update_business_metrics(self):
        """Update business metrics every hour"""
        # Calculate MRR
        mrr = await self.calculate_current_mrr()
        self.mrr_gauge.set(mrr)
        
        # Active customers (customers with API calls this month)
        active_count = await self.count_active_customers()
        self.active_customers.set(active_count)
    
    async def calculate_current_mrr(self) -> float:
        """Calculate monthly recurring revenue"""
        query = """
        SELECT SUM(plan_amount) 
        FROM organizations 
        WHERE status = 'active' 
        AND plan_type != 'free'
        """
        result = await self.db.fetch_one(query)
        return float(result[0] or 0)
    
    async def track_api_usage(self, customer_id: str, product: str, plan_type: str):
        """Track customer API usage for business analytics"""
        self.api_usage.labels(
            customer_id=customer_id,
            product=product, 
            plan_type=plan_type
        ).inc()
```

### Phase 3: Advanced Dashboards (Week 5-6)
```python
# Grafana dashboard provisioning
# File: grafana/dashboards/business-health.json
{
  "dashboard": {
    "title": "Business Health Overview",
    "panels": [
      {
        "title": "Revenue Metrics",
        "type": "row",
        "panels": [
          {
            "title": "Monthly Recurring Revenue",
            "type": "stat",
            "targets": [{"expr": "monthly_recurring_revenue"}],
            "fieldConfig": {
              "unit": "currencyUSD",
              "custom": {"displayMode": "basic"}
            }
          },
          {
            "title": "MRR Growth Rate",
            "type": "stat", 
            "targets": [{"expr": "rate(monthly_recurring_revenue[30d]) * 100"}],
            "fieldConfig": {
              "unit": "percent",
              "thresholds": {
                "steps": [
                  {"color": "red", "value": 0},
                  {"color": "yellow", "value": 10},
                  {"color": "green", "value": 20}
                ]
              }
            }
          }
        ]
      },
      {
        "title": "Customer Metrics",
        "type": "row",
        "panels": [
          {
            "title": "Active Customers",
            "type": "timeseries",
            "targets": [{"expr": "active_customers_total"}]
          },
          {
            "title": "Customer Churn Rate",
            "type": "stat",
            "targets": [{"expr": "rate(customer_cancellations_total[30d]) * 100"}]
          }
        ]
      }
    ]
  }
}
```

## Alerting Integration

### PagerDuty Configuration
```python
# PagerDuty webhook integration
class PagerDutyAlerts:
    def __init__(self, integration_key: str):
        self.integration_key = integration_key
        self.api_url = "https://events.pagerduty.com/v2/enqueue"
    
    async def send_critical_alert(self, summary: str, details: dict):
        """Send critical alert to PagerDuty"""
        payload = {
            "routing_key": self.integration_key,
            "event_action": "trigger",
            "payload": {
                "summary": summary,
                "severity": "critical",
                "source": "compliance-engine",
                "custom_details": details
            }
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(self.api_url, json=payload)
            return response.status_code == 202
```

### Slack Integration
```python
# Slack webhook for non-critical alerts
class SlackAlerts:
    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url
    
    async def send_business_alert(self, message: str, channel: str = "#general"):
        """Send business metrics to Slack"""
        payload = {
            "channel": channel,
            "text": message,
            "username": "Compliance Monitor",
            "icon_emoji": ":chart_with_upwards_trend:"
        }
        
        async with httpx.AsyncClient() as client:
            await client.post(self.webhook_url, json=payload)
    
    async def send_milestone_alert(self, milestone: str, value: float):
        """Celebrate business milestones"""
        message = f"🎉 Milestone achieved: {milestone} - ${value:,.2f}"
        await self.send_business_alert(message, "#general")
```

This creates a comprehensive internal monitoring system with clear escalation paths and business-focused metrics alongside operational ones.