# Open Source & SaaS Stack for Non-Differentiating Components

## Subdomain Strategy: Buy vs Build

### Core Principle
**Build only what differentiates you**. Use battle-tested solutions for everything else via subdomains.

```
Subdomain architecture:
├── compliance-engine.com (main site + API)
├── docs.compliance-engine.com (documentation)
├── status.compliance-engine.com (status page)
├── community.compliance-engine.com (forum)
├── blog.compliance-engine.com (content marketing)
└── app.compliance-engine.com (customer dashboard)
```

## Documentation: GitHub Pages + MkDocs

### Why GitHub Pages for Docs
✅ **Free hosting** for open source projects  
✅ **Automatic deployments** from Git commits  
✅ **Custom domain support** (docs.compliance-engine.com)  
✅ **Version control** built-in  
✅ **Global CDN** via GitHub's infrastructure  

### Implementation Stack
```yaml
# Documentation stack
Technology: MkDocs with Material theme
Hosting: GitHub Pages
Domain: docs.compliance-engine.com
Source: /docs folder in main repo

# Features:
- Interactive API documentation
- Code examples with syntax highlighting
- Search functionality
- Mobile responsive
- Dark/light theme toggle
- Version history
```

### Setup
```bash
# Install MkDocs with Material theme
pip install mkdocs-material

# Project structure
docs/
├── mkdocs.yml
├── docs/
│   ├── index.md
│   ├── api/
│   │   ├── license-verification.md
│   │   ├── permit-generation.md
│   │   └── authentication.md
│   ├── guides/
│   │   ├── quick-start.md
│   │   └── integration-examples.md
│   └── reference/
│       ├── error-codes.md
│       └── rate-limits.md
└── overrides/  # Custom templates
```

```yaml
# mkdocs.yml configuration
site_name: Compliance Engine Documentation
site_url: https://docs.compliance-engine.com
theme:
  name: material
  features:
    - navigation.tabs
    - navigation.sections
    - toc.integrate
    - search.suggest
    - search.highlight
    - content.code.annotate
  palette:
    - scheme: default
      primary: blue
      accent: blue
      toggle:
        icon: material/brightness-7
        name: Switch to dark mode
    - scheme: slate
      primary: blue
      accent: blue
      toggle:
        icon: material/brightness-4
        name: Switch to light mode

plugins:
  - search
  - git-revision-date-localized
  - swagger-ui-tag  # For OpenAPI integration

markdown_extensions:
  - pymdownx.highlight
  - pymdownx.superfences
  - pymdownx.tabbed
  - admonition
  - codehilite
```

## Community Forum: Discourse

### Why Discourse
✅ **Open source** with hosted option  
✅ **Developer-friendly** features (code highlighting, GitHub integration)  
✅ **SEO optimized** (unlike Slack/Discord)  
✅ **Mobile responsive**  
✅ **Moderation tools** built-in  

### Implementation Options
```yaml
# Option 1: Self-hosted (cost-effective)
Technology: Discourse Docker
Hosting: AWS ECS or DigitalOcean Droplet
Domain: community.compliance-engine.com
Cost: ~$20-40/month

# Option 2: Discourse hosting (easier)
Technology: Discourse SaaS
Domain: community.compliance-engine.com  
Cost: $100/month for small communities
```

### Configuration
```ruby
# Discourse integration settings
# app.yml for Docker deployment
DISCOURSE_HOSTNAME: community.compliance-engine.com
DISCOURSE_SMTP_ADDRESS: ses.amazonaws.com  # Use AWS SES
DISCOURSE_NOTIFICATION_EMAIL: noreply@compliance-engine.com

# OAuth integration with main app
DISCOURSE_SSO_URL: https://compliance-engine.com/sso/discourse
DISCOURSE_SSO_SECRET: your_secret_here
```

## Status Page: Statuspage.io or Self-Hosted

### Option 1: Statuspage.io (Recommended)
```yaml
Service: Atlassian Statuspage
Domain: status.compliance-engine.com
Cost: $39/month
Features:
  - Incident management
  - Automated monitoring integration  
  - Email/SMS notifications
  - Historical uptime data
  - API for programmatic updates
```

### Option 2: Self-Hosted Alternative
```yaml
Technology: Cachet (open source)
Hosting: AWS ECS Fargate
Domain: status.compliance-engine.com
Cost: ~$15/month
Features:
  - Incident reporting
  - Metric tracking
  - Subscriber notifications
  - API integration
```

## Blog: Ghost or Static Site

### Option 1: Ghost (Recommended for Marketing)
```yaml
Technology: Ghost CMS
Hosting: Ghost Pro or self-hosted
Domain: blog.compliance-engine.com
Cost: $29/month (Ghost Pro) or $15/month (self-hosted)

Benefits:
  - SEO optimized
  - Newsletter integration
  - Membership features
  - Mobile responsive themes
  - Markdown editing
```

### Option 2: Static Blog (Developer-Friendly)
```yaml
Technology: Hugo or Next.js blog
Hosting: Vercel or Netlify  
Domain: blog.compliance-engine.com
Cost: Free (with usage limits)

Benefits:
  - Version controlled content
  - Fast loading
  - Easy to customize
  - Git-based workflow
```

## Customer Dashboard: Custom Build (Differentiator)

### Why Build This In-House
- **Core business logic**: Usage tracking, billing, API management
- **Competitive advantage**: GitHub-style debugging tools
- **Integration requirements**: Deep AWS integration needed
- **Customer experience**: This IS the product for many users

### Technology Stack
```yaml
Frontend: Next.js 14 + TypeScript
Styling: Tailwind CSS + shadcn/ui components
State: React Query + Zustand
Charts: Recharts or Chart.js
Domain: app.compliance-engine.com

Backend: FastAPI (shared with main API)
Database: PostgreSQL (shared)
Authentication: NextAuth.js or Auth0
```

## Authentication: Auth0 or AWS Cognito

### Option 1: Auth0 (Recommended)
```yaml
Service: Auth0
Cost: Free up to 7,000 active users
Features:
  - Social login (GitHub, Google, LinkedIn)
  - Enterprise SSO
  - Multi-factor authentication
  - User management dashboard
  - SDK for all major frameworks

Integration:
  - Main app: Auth0 Next.js SDK
  - API: Auth0 JWT verification
  - Discourse: Auth0 SSO plugin
```

### Option 2: AWS Cognito (AWS-Native)
```yaml
Service: AWS Cognito
Cost: $0.0055 per monthly active user
Features:
  - AWS ecosystem integration
  - Social identity providers
  - User pools and identity pools
  - MFA support
  - Lambda triggers for custom logic
```

## Email: AWS SES + Transactional Service

### Email Stack
```yaml
Transactional emails: AWS SES
Marketing emails: ConvertKit or Mailchimp
Domain: compliance-engine.com
Cost: $0.10 per 1,000 emails (SES)

# Email types:
- API key creation/reset
- Usage alerts  
- Billing notifications
- Support tickets
- Marketing newsletters
```

## Analytics: PostHog (Privacy-Focused)

### Why PostHog
✅ **Open source** with hosted option  
✅ **Privacy-compliant** (GDPR/CCPA)  
✅ **Product analytics** + session recordings  
✅ **Feature flags** built-in  
✅ **A/B testing** capabilities  

```yaml
Service: PostHog Cloud
Cost: Free up to 1M events/month
Features:
  - Event tracking
  - Funnel analysis  
  - Session recordings
  - Feature flags
  - A/B testing
  - Cohort analysis

Integration:
  - Website: PostHog JavaScript SDK
  - API: PostHog Python SDK
  - Customer dashboard: React integration
```

## Error Tracking: Sentry

### Implementation
```yaml
Service: Sentry
Cost: Free up to 5,000 errors/month
Features:
  - Real-time error reporting
  - Performance monitoring
  - Release tracking
  - User context
  - Slack integration

Stack integration:
  - FastAPI: Sentry Python SDK
  - Next.js: Sentry JavaScript SDK  
  - Background jobs: Automatic capture
```

## Search: Algolia or Self-Hosted

### For Documentation Search
```yaml
# Option 1: Algolia DocSearch (Free for open source docs)
Service: Algolia DocSearch
Cost: Free for documentation
Integration: MkDocs plugin

# Option 2: Self-hosted search
Technology: Meilisearch or ElasticSearch
Hosting: AWS OpenSearch Service
Cost: ~$50/month for small index
```

## Payment Processing: Stripe

### Why Stripe
✅ **Developer-friendly** APIs  
✅ **Usage-based billing** support  
✅ **Invoice generation**  
✅ **Tax handling** (Stripe Tax)  
✅ **Global payment methods**  

```python
# Stripe integration for usage-based billing
import stripe

# Track usage for customer
stripe.SubscriptionItem.create_usage_record(
    subscription_item='si_...',
    quantity=api_calls_count,
    timestamp=billing_period_end
)

# Automatic invoicing based on usage
# Perfect for API pricing models
```

## Monitoring: AWS CloudWatch + Grafana

### Monitoring Stack (As Designed)
```yaml
Metrics: AWS CloudWatch + custom metrics
Dashboards: Grafana (self-hosted on ECS)
Alerting: CloudWatch Alarms → SNS → Slack
Tracing: AWS X-Ray
Logs: CloudWatch Logs

Cost: $50-100/month at moderate scale
```

## Package Recommendations by Category

### Python Backend Packages
```bash
# Core API framework
fastapi[all]
uvicorn[standard]

# Database
sqlalchemy[postgresql]
alembic
asyncpg

# Authentication & Security  
python-jose[cryptography]
passlib[bcrypt]
python-multipart

# AWS Integration
boto3
aws-xray-sdk
aiobotocore

# Monitoring & Observability
prometheus-client
structlog
sentry-sdk

# Testing
pytest
pytest-asyncio
httpx
factory-boy
coverage

# Background Jobs
celery[redis]  # or
arq  # async alternative

# API Documentation
fastapi-users  # authentication
fastapi-pagination
fastapi-limiter
```

### Frontend Packages  
```bash
# Core Next.js stack
next@latest
typescript
@types/react
@types/node

# UI Components
@headlessui/react
@heroicons/react
tailwindcss
@tailwindcss/forms
@tailwindcss/typography

# Data Fetching
@tanstack/react-query
axios

# Charts & Visualization
recharts
react-chartjs-2

# Authentication
next-auth
@auth0/nextjs-auth0

# Analytics
posthog-js

# Error Tracking  
@sentry/nextjs

# Utilities
clsx
date-fns
zod  # validation
react-hook-form
```

## Implementation Priority

### Phase 1: Core Infrastructure (Weeks 1-2)
1. **Documentation site**: GitHub Pages + MkDocs
2. **Main website**: Next.js on Vercel
3. **Authentication**: Auth0 setup
4. **Database**: PostgreSQL on AWS RDS

### Phase 2: Customer Features (Weeks 3-4)  
1. **Customer dashboard**: Next.js app
2. **API backend**: FastAPI with authentication
3. **Payment processing**: Stripe integration
4. **Monitoring**: CloudWatch + basic dashboards

### Phase 3: Community & Support (Weeks 5-6)
1. **Status page**: Statuspage.io
2. **Community forum**: Discourse setup
3. **Blog**: Ghost or static site
4. **Analytics**: PostHog integration

This approach lets you focus on building the differentiating compliance APIs while leveraging battle-tested solutions for everything else. Each subdomain can be independently deployed and scaled.