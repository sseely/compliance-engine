# Container Security Best Practices

## Base Image Security Analysis (2024)

### Current Landscape

**Alpine Linux** (traditionally minimal choice):
- ❌ **musl libc compatibility issues** with some Python packages
- ❌ **Slower security updates** compared to major distros
- ❌ **Package availability gaps** for complex dependencies
- ✅ Small size (~5MB base)
- ✅ Good for simple applications

**python:3.11-slim** (Debian-based):
- ✅ **Excellent compatibility** with Python ecosystem
- ✅ **Fast security updates** from Debian team
- ✅ **Well-maintained** by Docker official images team
- ❌ Larger size (~45MB base)
- ✅ Great for development

**Distroless** (Google's minimal approach):
- ✅ **No shell, package manager, or unnecessary binaries**
- ✅ **Minimal attack surface** - only runtime dependencies
- ✅ **Regular security updates** with vulnerability scanning
- ✅ **Excellent for production** compliance requirements
- ❌ **Debugging challenges** (no shell access)
- ❌ **More complex builds** (multi-stage required)

**Chainguard Images** (Commercial security focus):
- ✅ **Security-first design** with daily vulnerability scanning
- ✅ **Minimal packages** with SBOM (Software Bill of Materials)
- ✅ **Frequent updates** and proactive patching
- ❌ **Commercial offering** (free tier available)
- ✅ **Excellent documentation** and transparency

## Recommended Strategy

### Development: python:3.11-slim
```dockerfile
FROM python:3.11-slim

# Reasons:
# - Fast builds and debugging
# - Full compatibility with Python packages
# - Shell access for troubleshooting
# - Package manager available for dev tools
```

### Production: Distroless
```dockerfile
FROM gcr.io/distroless/python3-debian12:latest

# Reasons:
# - Minimal attack surface (no shell, package manager)
# - Compliance-friendly for regulated environments
# - Regular security updates
# - Excellent for automated deployments
```

### Lambda: AWS Official Base
```dockerfile
FROM public.ecr.aws/lambda/python:3.11

# Reasons:
# - Optimized for Lambda runtime
# - AWS-maintained security updates
# - Pre-configured with Lambda runtime interface
# - Already minimal and secure
```

## Security Hardening Practices

### 1. Non-Root User Configuration

**Development (with shell access):**
```dockerfile
# Create specific user with controlled permissions
RUN groupadd -r compliance && useradd -r -g compliance compliance
RUN chown -R compliance:compliance /app
USER compliance
```

**Production (distroless):**
```dockerfile
# Distroless automatically uses non-root user 65532
USER 65532
```

### 2. Minimal Dependencies
```dockerfile
# Only install what's absolutely necessary
RUN apt-get update && apt-get install -y \
    gcc \  # Only for building packages with C extensions
    curl \ # Only for health checks
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean
```

### 3. Multi-Stage Builds (Production)
```dockerfile
# Stage 1: Build dependencies
FROM python:3.11-slim as builder
RUN pip install poetry
RUN poetry install --only=main

# Stage 2: Runtime (distroless)
FROM gcr.io/distroless/python3-debian12:latest
COPY --from=builder /app/dependencies /app/dependencies
# Final image contains only runtime dependencies
```

### 4. Vulnerability Scanning Integration

**Docker Compose with Trivy:**
```yaml
# docker-compose.security.yml
version: '3.8'
services:
  security-scan:
    image: aquasec/trivy:latest
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    command: >
      image --severity HIGH,CRITICAL 
      compliance-api:latest
```

**Makefile security commands:**
```makefile
security-scan: ## Scan containers for vulnerabilities
	docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
		aquasec/trivy:latest image --severity HIGH,CRITICAL \
		compliance-api:latest

security-scan-all: ## Scan all project images
	@echo "Scanning API container..."
	@make security-scan
	@echo "Scanning Lambda container..."
	docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
		aquasec/trivy:latest image --severity HIGH,CRITICAL \
		compliance-lambda:latest

security-report: ## Generate security report
	docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
		-v $(PWD):/output \
		aquasec/trivy:latest image --format json \
		--output /output/security-report.json \
		compliance-api:latest
```

## Image Size Comparison

**Base Image Sizes:**
- `alpine:3.18`: ~5MB
- `python:3.11-alpine`: ~50MB  
- `python:3.11-slim`: ~45MB
- `gcr.io/distroless/python3-debian12`: ~25MB
- `chainguard/python:latest`: ~20MB

**With Application (estimated):**
- Alpine-based: ~80MB
- Slim-based: ~120MB
- Distroless: ~60MB
- Chainguard: ~55MB

## Development vs Production Tradeoffs

### Development Priorities
```dockerfile
FROM python:3.11-slim
# Optimize for:
# - Fast build times
# - Easy debugging (shell access)
# - Package compatibility
# - Development tool availability
```

### Production Priorities
```dockerfile
FROM gcr.io/distroless/python3-debian12:latest
# Optimize for:
# - Minimal attack surface
# - Security compliance
# - Automated deployments
# - Runtime performance
```

## CI/CD Security Pipeline

### GitHub Actions Security Workflow
```yaml
name: Container Security
on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build containers
        run: |
          docker build -f Dockerfile.dev -t compliance-api:dev .
          docker build -f Dockerfile.prod -t compliance-api:prod .
      
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'compliance-api:prod'
          format: 'sarif'
          output: 'trivy-results.sarif'
      
      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'
      
      - name: Fail on HIGH/CRITICAL vulnerabilities
        run: |
          docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
            aquasec/trivy:latest image --exit-code 1 \
            --severity HIGH,CRITICAL compliance-api:prod
```

## Monitoring and Updates

### Automated Dependency Updates
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"
    
  - package-ecosystem: "pip"
    directory: "/"
    schedule:
      interval: "daily"
```

### Base Image Update Strategy
1. **Weekly** base image updates in development
2. **Bi-weekly** base image updates in production (after testing)
3. **Immediate** updates for critical vulnerabilities
4. **Automated** vulnerability scanning in CI/CD

## Compliance Considerations

For compliance requirements (SOC2, HIPAA, etc.):

✅ **Distroless images** provide minimal attack surface  
✅ **Non-root users** reduce privilege escalation risks  
✅ **Vulnerability scanning** demonstrates security posture  
✅ **Automated updates** show proactive security management  
✅ **SBOM generation** provides transparency for audits

This approach balances security, compliance, and development velocity while minimizing container vulnerabilities.