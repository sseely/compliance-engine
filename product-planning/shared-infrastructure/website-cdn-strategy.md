# Website CDN Strategy

## Static Site Generation for CDN Deployment

### Next.js Static Export Configuration

```typescript
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',          // Enable static export
  trailingSlash: true,       // Required for S3/CloudFront
  images: {
    unoptimized: true        // Disable Next.js image optimization for static export
  },
  
  // CDN asset prefix for production
  assetPrefix: process.env.NODE_ENV === 'production' 
    ? 'https://cdn.compliance-engine.com' 
    : '',
    
  // Custom build ID for cache busting
  generateBuildId: async () => {
    return process.env.BUILD_ID || 'dev-build'
  }
}

export default nextConfig
```

### Architecture: Hybrid Static + Dynamic

```
Static Assets (CDN):
├── Marketing pages (compliance-engine.com)
├── Documentation (docs.compliance-engine.com)  
├── Blog (blog.compliance-engine.com)
└── Static customer portal shell

Dynamic APIs (ALB + ECS):
├── FastAPI backend (api.compliance-engine.com)
├── Authentication endpoints
├── Customer dashboard APIs
└── Usage tracking APIs
```

## CDN Deployment Options

### Option 1: Vercel (Recommended for Speed)
```yaml
Service: Vercel
Domain: compliance-engine.com
Cost: $0 (Hobby) to $20/month (Pro)
Benefits:
  - Automatic static optimization
  - Global CDN included
  - Zero configuration
  - Perfect Next.js integration
  - Built-in analytics

Bandwidth costs:
  - Free: 100GB/month
  - Overage: $0.15/GB (expensive at scale)

Source: Vercel pricing page
https://vercel.com/pricing
```

### Option 2: AWS CloudFront + S3 (Cost-Optimized)
```yaml
Service: AWS S3 + CloudFront
Domain: compliance-engine.com
Cost: ~$5-15/month base + bandwidth
Benefits:
  - Much cheaper bandwidth ($0.085/GB vs $0.15/GB)
  - Full AWS ecosystem integration
  - Custom cache behaviors
  - Lambda@Edge for customization

Bandwidth costs:
  - First 1TB: $0.085/GB
  - Next 9TB: $0.080/GB

Source: AWS CloudFront pricing
https://aws.amazon.com/cloudfront/pricing/
```

### Recommendation: Hybrid Approach
```
Phase 1 (MVP): Vercel for speed and simplicity
Phase 2 (Scale): Move to CloudFront when bandwidth > 500GB/month
```

## Implementation Strategy

### 1. Static Site Structure
```
websites/
├── marketing/          # Next.js static export
│   ├── pages/
│   │   ├── index.tsx              # Homepage
│   │   ├── license-api.tsx        # Product pages
│   │   ├── permit-generator.tsx
│   │   └── pricing.tsx
│   ├── components/
│   └── public/
├── docs/              # MkDocs (GitHub Pages)
└── customer-portal/   # Next.js with API integration
    ├── pages/
    │   ├── dashboard.tsx          # Dynamic content
    │   ├── usage.tsx
    │   └── api-keys.tsx
    └── components/
```

### 2. Build Process for CDN
```bash
# Static export build script
#!/bin/bash

# Build static marketing site
cd marketing
npm run build
npm run export

# Upload to CDN
aws s3 sync out/ s3://compliance-engine-static --delete
aws cloudfront create-invalidation --distribution-id $CDN_ID --paths "/*"

# Build customer portal (dynamic)
cd ../customer-portal  
npm run build
# Deploy to Vercel or ECS
```

### 3. CDN Cache Configuration
```typescript
// CloudFront cache behaviors
const cacheConfigurations = {
  // Static assets - long cache
  "/_next/static/*": {
    cachePolicyId: "managed-CachingOptimized",
    ttl: 31536000  // 1 year
  },
  
  // HTML pages - shorter cache with revalidation
  "*.html": {
    cachePolicyId: "managed-CachingOptimizedForUncompressedObjects", 
    ttl: 86400,    // 1 day
    revalidate: true
  },
  
  // API calls - no cache
  "/api/*": {
    cachePolicyId: "managed-CachingDisabled",
    originRequestPolicy: "managed-AllViewerExceptHostHeader"
  }
}
```

## Dynamic Content Strategy

### Client-Side Data Fetching
```typescript
// Customer dashboard - hybrid approach
import { useEffect, useState } from 'react'

const CustomerDashboard = () => {
  const [usageData, setUsageData] = useState(null)
  
  useEffect(() => {
    // Fetch dynamic data after static page loads
    fetch('/api/customer/usage')
      .then(res => res.json())
      .then(setUsageData)
  }, [])
  
  return (
    <div>
      {/* Static shell loads instantly from CDN */}
      <h1>Customer Dashboard</h1>
      
      {/* Dynamic content loads after */}
      {usageData ? (
        <UsageChart data={usageData} />
      ) : (
        <LoadingSkeleton />
      )}
    </div>
  )
}
```

### API Integration Pattern
```typescript
// API client for CDN-hosted pages
class ComplianceAPIClient {
  private baseURL = 'https://api.compliance-engine.com'
  
  async fetchWithAuth(endpoint: string) {
    const token = localStorage.getItem('auth_token')
    
    return fetch(`${this.baseURL}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
  }
  
  async getUsageData() {
    return this.fetchWithAuth('/api/v1/customer/usage')
  }
}
```

## Performance Optimization

### Image Optimization for CDN
```typescript
// Custom image component for static export
import Image from 'next/image'

const OptimizedImage = ({ src, alt, ...props }) => {
  // Use external image optimization service
  const optimizedSrc = `https://images.compliance-engine.com/${src}?w=800&q=75`
  
  return (
    <Image
      src={optimizedSrc}
      alt={alt}
      unoptimized={false}  // Let CDN handle optimization
      {...props}
    />
  )
}
```

### Code Splitting for CDN
```typescript
// Dynamic imports for better caching
import dynamic from 'next/dynamic'

const APIDocumentation = dynamic(() => import('../components/APIDocumentation'), {
  loading: () => <p>Loading documentation...</p>
})

const InteractiveDemo = dynamic(() => import('../components/InteractiveDemo'), {
  ssr: false  // Client-side only for interactive features
})
```

## SEO Benefits of CDN Static Sites

### Performance Improvements
- **First Contentful Paint**: <1 second globally
- **Time to Interactive**: <2 seconds  
- **Core Web Vitals**: Perfect scores for static content
- **Global latency**: <100ms from edge locations

### SEO Configuration
```typescript
// next-seo configuration
import { NextSeo } from 'next-seo'

const LicenseAPIPage = () => (
  <>
    <NextSeo
      title="License Verification API | Compliance Engine"
      description="Verify contractor licenses across 47 states in under 1 second"
      canonical="https://compliance-engine.com/license-api"
      openGraph={{
        url: 'https://compliance-engine.com/license-api',
        title: 'License Verification API',
        description: 'Verify contractor licenses across 47 states',
        images: [
          {
            url: 'https://cdn.compliance-engine.com/og-license-api.png',
            width: 1200,
            height: 630,
            alt: 'License Verification API'
          }
        ]
      }}
    />
    <LicenseAPIContent />
  </>
)
```

## Cost Analysis: CDN vs Server-Rendered

### Traffic Scenarios
```
Scenario 1: 10K visitors/month
- CDN (Vercel): $0 (within free tier)
- SSR (ECS): ~$25/month (compute costs)

Scenario 2: 100K visitors/month  
- CDN (CloudFront): ~$15/month
- SSR (ECS): ~$100/month (auto-scaling)

Scenario 3: 1M visitors/month
- CDN (CloudFront): ~$85/month  
- SSR (ECS): ~$500/month (multiple instances)
```

## Implementation Phases

### Phase 1: Static Marketing Site (Week 1)
- Next.js static export
- Deploy to Vercel
- Basic landing pages and pricing

### Phase 2: Dynamic Customer Portal (Week 2)  
- Hybrid static shell + API calls
- Authentication integration
- Usage dashboard

### Phase 3: CDN Optimization (Week 3)
- Move to CloudFront for cost savings
- Implement custom caching strategies
- Performance monitoring

### Phase 4: Advanced Features (Week 4)
- Edge functions for personalization  
- A/B testing at CDN level
- Advanced analytics

This CDN-first approach gives you:
- **Global performance** with <100ms latency
- **Cost efficiency** especially at scale  
- **SEO benefits** with perfect Core Web Vitals
- **Reliability** with 99.9%+ uptime
- **Scalability** handling traffic spikes automatically

The static marketing site loads instantly while dynamic features (customer dashboard, API calls) load progressively after the initial page render.