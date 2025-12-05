# CI/CD Pipeline with Transient Environments

## Pipeline Strategy

### Environment Flow
```
develop branch → dev (transient) → qa (transient) → merge to main → production (persistent)
     ↓              ↓                   ↓                    ↓                ↓
   commit        auto-deploy        auto-promote      PR merge to main    manual approve
                 + build test       + integration                        + production
                                   + unit tests                            deploy
```

### Cost Optimization with Transient Environments
- **Dev**: Spun up on commit, destroyed after 4 hours or on success
- **QA**: Spun up after dev success, destroyed after tests complete  
- **Production**: Always running, only updated after QA passes
- **Estimated savings**: 70-80% on non-production infrastructure costs

## GitHub Actions Workflow

### Environment Configuration
```yaml
# .github/environments.yml
environments:
  development:
    protection_rules:
      - required_reviewers: 0
      - wait_timer: 0
    deployment_branch_policy:
      protected_branches: false
      custom_branch_policies: true
      custom_branches: ["develop"]
    
  qa:
    protection_rules:
      - required_reviewers: 0
      - wait_timer: 0
    deployment_branch_policy:
      protected_branches: false
      custom_branch_policies: true
      custom_branches: ["develop"]
    
  production:
    protection_rules:
      - required_reviewers: 1
      - wait_timer: 300  # 5 minute delay
    deployment_branch_policy:
      protected_branches: true
      custom_branch_policies: false
```

### Main CI/CD Workflow
```yaml
# .github/workflows/deploy-pipeline.yml
name: Compliance Engine CI/CD Pipeline

on:
  push:
    branches: [develop, main]
  pull_request:
    branches: [develop, main]

env:
  AWS_REGION: us-east-1
  
jobs:
  # =================== BUILD & TEST ===================
  build-and-test:
    runs-on: ubuntu-latest
    outputs:
      image-tag: ${{ steps.build.outputs.image-tag }}
      build-id: ${{ steps.build.outputs.build-id }}
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: |
            package-lock.json
            infrastructure/package-lock.json
            
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
          cache: 'pip'
          
      - name: Install dependencies
        run: |
          npm ci
          cd infrastructure && npm ci
          pip install -r backend/requirements.txt
          pip install -r backend/requirements-test.txt
          
      - name: Run backend tests
        run: |
          cd backend
          pytest --cov=. --cov-report=xml --cov-report=term-missing
          
      - name: Run frontend tests  
        run: |
          cd frontend
          npm ci
          npm run test:ci
          npm run build
          
      - name: Run infrastructure tests
        run: |
          cd infrastructure
          npm run test
          npm run synth
          
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
          
      - name: Build and push Docker image
        id: build
        run: |
          IMAGE_TAG="${GITHUB_SHA:0:8}-$(date +%s)"
          BUILD_ID="build-${GITHUB_RUN_NUMBER}-${GITHUB_SHA:0:8}"
          
          # Build backend container
          cd backend
          docker build -t compliance-api:$IMAGE_TAG .
          
          # Push to ECR
          aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin ${{ secrets.ECR_REGISTRY }}
          docker tag compliance-api:$IMAGE_TAG ${{ secrets.ECR_REGISTRY }}/compliance-api:$IMAGE_TAG
          docker push ${{ secrets.ECR_REGISTRY }}/compliance-api:$IMAGE_TAG
          
          echo "image-tag=$IMAGE_TAG" >> $GITHUB_OUTPUT
          echo "build-id=$BUILD_ID" >> $GITHUB_OUTPUT

  # =================== DEPLOY TO DEV ===================
  deploy-dev:
    if: github.ref == 'refs/heads/develop'
    needs: build-and-test
    runs-on: ubuntu-latest
    environment: development
    concurrency: 
      group: dev-deployment
      cancel-in-progress: true
      
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
          
      - name: Deploy infrastructure to dev
        run: |
          cd infrastructure
          npm ci
          export BUILD_ID="${{ needs.build-and-test.outputs.build-id }}"
          export IMAGE_TAG="${{ needs.build-and-test.outputs.image-tag }}"
          npm run deploy:dev
          
      - name: Wait for deployment health check
        run: |
          echo "Waiting for dev environment to be healthy..."
          for i in {1..30}; do
            if curl -f https://api-dev.compliance-engine.com/health; then
              echo "Dev environment is healthy"
              exit 0
            fi
            echo "Attempt $i/30 failed, waiting 30 seconds..."
            sleep 30
          done
          echo "Dev environment failed health check"
          exit 1
          
      - name: Run smoke tests
        run: |
          cd tests/smoke
          python -m pytest smoke_tests.py --env=dev --api-url=https://api-dev.compliance-engine.com

  # =================== DEPLOY TO QA ===================
  deploy-qa:
    needs: [build-and-test, deploy-dev]
    runs-on: ubuntu-latest
    environment: qa
    concurrency:
      group: qa-deployment
      cancel-in-progress: false
      
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        
      - name: Configure AWS credentials  
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
          
      - name: Deploy infrastructure to QA
        run: |
          cd infrastructure
          npm ci
          export BUILD_ID="${{ needs.build-and-test.outputs.build-id }}"
          export IMAGE_TAG="${{ needs.build-and-test.outputs.image-tag }}"
          npm run deploy:qa
          
      - name: Wait for QA deployment
        run: |
          echo "Waiting for QA environment..."
          for i in {1..30}; do
            if curl -f https://api-qa.compliance-engine.com/health; then
              echo "QA environment is ready"
              exit 0
            fi
            sleep 30
          done
          exit 1
          
      - name: Run integration tests
        run: |
          cd tests/integration
          python -m pytest integration_tests.py --env=qa --api-url=https://api-qa.compliance-engine.com
          
      - name: Run load tests
        run: |
          cd tests/load  
          artillery run load-test.yml --target https://api-qa.compliance-engine.com
          
      - name: Run security tests
        run: |
          cd tests/security
          python -m pytest security_tests.py --env=qa --api-url=https://api-qa.compliance-engine.com

  # =================== PROMOTE TO PRODUCTION ===================  
  promote-to-production:
    if: github.ref == 'refs/heads/main'
    needs: [build-and-test, deploy-qa]
    runs-on: ubuntu-latest
    environment: production
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_PROD_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_PROD_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
          
      - name: Deploy to production
        run: |
          cd infrastructure
          npm ci
          export BUILD_ID="${{ needs.build-and-test.outputs.build-id }}"
          export IMAGE_TAG="${{ needs.build-and-test.outputs.image-tag }}"
          npm run deploy:prod
          
      - name: Verify production deployment
        run: |
          echo "Verifying production deployment..."
          for i in {1..20}; do
            if curl -f https://api.compliance-engine.com/health; then
              echo "Production deployment successful"
              exit 0
            fi
            sleep 30
          done
          exit 1
          
      - name: Run production smoke tests
        run: |
          cd tests/smoke
          python -m pytest production_smoke_tests.py --env=prod --api-url=https://api.compliance-engine.com

  # =================== CLEANUP TRANSIENT ENVIRONMENTS ===================
  cleanup-environments:
    if: always()
    needs: [deploy-dev, deploy-qa, promote-to-production]
    runs-on: ubuntu-latest
    
    steps:
      - name: Cleanup dev environment
        if: always()
        run: |
          cd infrastructure
          npm ci
          npm run destroy:dev
          
      - name: Cleanup QA environment  
        if: always()
        run: |
          cd infrastructure
          npm ci
          npm run destroy:qa
          
      - name: Notify deployment status
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          channel: '#deployments'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

## CDK Scripts for Environment Management

### Package.json Scripts
```json
{
  "scripts": {
    "build": "tsc",
    "synth": "cdk synth",
    "test": "jest",
    "deploy:dev": "cdk deploy --all --profile dev --require-approval never --context environment=dev",
    "deploy:qa": "cdk deploy --all --profile qa --require-approval never --context environment=qa", 
    "deploy:prod": "cdk deploy --all --profile prod --context environment=production",
    "destroy:dev": "cdk destroy --all --profile dev --force --context environment=dev",
    "destroy:qa": "cdk destroy --all --profile qa --force --context environment=qa",
    "diff:prod": "cdk diff --profile prod --context environment=production"
  }
}
```

### CDK Environment Configuration
```typescript
// infrastructure/src/config/environments.ts
export const getEnvironmentConfig = (envName: string): EnvironmentConfig => {
  const baseConfig = {
    buildId: process.env.BUILD_ID || 'local',
    imageTag: process.env.IMAGE_TAG || 'latest'
  }
  
  switch (envName) {
    case 'dev':
      return {
        ...baseConfig,
        name: 'dev',
        account: process.env.AWS_DEV_ACCOUNT!,
        region: 'us-east-1',
        domainName: 'dev.compliance-engine.com',
        isTransient: true,
        autoDestroy: true,
        database: {
          instanceType: 't3.micro',
          allocatedStorage: 20,
          backupRetention: 1, // Minimal for transient
          multiAz: false,
          deletionProtection: false
        },
        compute: {
          minCapacity: 1,
          maxCapacity: 2,
          desiredCapacity: 1
        }
      }
      
    case 'qa':
      return {
        ...baseConfig,
        name: 'qa', 
        account: process.env.AWS_QA_ACCOUNT!,
        region: 'us-east-1',
        domainName: 'qa.compliance-engine.com',
        isTransient: true,
        autoDestroy: true,
        database: {
          instanceType: 't3.small',
          allocatedStorage: 50,
          backupRetention: 3,
          multiAz: false,
          deletionProtection: false
        },
        compute: {
          minCapacity: 1,
          maxCapacity: 3,
          desiredCapacity: 2
        }
      }
      
    case 'production':
      return {
        ...baseConfig,
        name: 'production',
        account: process.env.AWS_PROD_ACCOUNT!,
        region: 'us-east-1', 
        domainName: 'compliance-engine.com',
        isTransient: false,
        autoDestroy: false,
        database: {
          instanceType: 't3.medium',
          allocatedStorage: 100,
          backupRetention: 30,
          multiAz: true,
          deletionProtection: true
        },
        compute: {
          minCapacity: 2,
          maxCapacity: 20,
          desiredCapacity: 3
        }
      }
      
    default:
      throw new Error(`Unknown environment: ${envName}`)
  }
}
```

## Test Strategy by Environment

### Dev Environment Tests (Smoke Tests)
```python
# tests/smoke/smoke_tests.py
import pytest
import requests
import os

API_URL = os.getenv('API_URL', 'https://api-dev.compliance-engine.com')

def test_health_endpoint():
    """Basic health check"""
    response = requests.get(f"{API_URL}/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_license_verification_endpoint():
    """Test basic license verification"""
    response = requests.post(f"{API_URL}/api/v1/license/verify", json={
        "license_number": "TEST123",
        "state": "CA"
    })
    assert response.status_code in [200, 422]  # 422 for invalid test license

def test_database_connection():
    """Verify database connectivity"""
    response = requests.get(f"{API_URL}/health/detailed")
    assert response.status_code == 200
    health = response.json()
    assert health["checks"]["database"] == "healthy"
```

### QA Environment Tests (Integration + Load)
```python
# tests/integration/integration_tests.py  
import pytest
import requests
import time

class TestLicenseVerificationWorkflow:
    def test_end_to_end_license_verification(self):
        """Test complete license verification workflow"""
        # Create customer account
        customer_response = requests.post(f"{API_URL}/api/v1/customers", json={
            "email": "test@example.com",
            "organization": "Test Company"
        })
        assert customer_response.status_code == 201
        
        # Generate API key  
        api_key_response = requests.post(f"{API_URL}/api/v1/api-keys", 
                                       headers={"Authorization": f"Bearer {customer_response.json()['token']}"})
        api_key = api_key_response.json()["api_key"]
        
        # Verify license
        license_response = requests.post(f"{API_URL}/api/v1/license/verify",
                                       headers={"X-API-Key": api_key},
                                       json={"license_number": "REAL_LICENSE", "state": "CA"})
        assert license_response.status_code == 200
        
        # Check usage tracking
        usage_response = requests.get(f"{API_URL}/api/v1/customer/usage",
                                    headers={"Authorization": f"Bearer {customer_response.json()['token']}"})
        assert usage_response.status_code == 200
        assert usage_response.json()["total_api_calls"] == 1

# tests/load/load-test.yml (Artillery)
config:
  target: https://api-qa.compliance-engine.com
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 180  
      arrivalRate: 50
      name: "Load test"
  defaults:
    headers:
      X-API-Key: "{{ $randomString() }}"

scenarios:
  - name: "License verification load test"
    weight: 80
    flow:
      - post:
          url: "/api/v1/license/verify"
          json:
            license_number: "TEST{{ $randomInt(1000, 9999) }}"
            state: "{{ $randomString() }}"
  
  - name: "Health check"
    weight: 20
    flow:
      - get:
          url: "/health"
```

## Cost Analysis

### Infrastructure Costs by Environment
```
Development (4 hours/day average):
- RDS t3.micro: ~$3/month
- ECS Fargate: ~$8/month
- ALB: ~$6/month
Total: ~$17/month

QA (2 hours/day average):
- RDS t3.small: ~$6/month  
- ECS Fargate: ~$10/month
- ALB: ~$4/month
Total: ~$20/month

Production (24/7):
- RDS t3.medium Multi-AZ: ~$70/month
- ECS Fargate: ~$50/month
- ALB: ~$20/month
Total: ~$140/month

Annual savings vs always-on environments: ~$1,800
```

## Benefits of This Pipeline

**Cost Optimization**:
- 70-80% savings on non-production infrastructure
- Transient environments prevent resource waste
- Automatic cleanup prevents forgotten resources

**Quality Assurance**:
- Multi-stage testing (unit → integration → load → security)
- Automated promotion with gates
- Production deployment only after all tests pass

**Compliance Ready**:
- Complete audit trail of deployments
- Environment parity through IaC
- Automated testing ensures compliance requirements

**Developer Experience**:
- Fast feedback on develop branch commits
- Clear promotion path to production
- Automatic rollback on test failures

This pipeline gives you enterprise-grade CI/CD with cost-conscious transient environments, perfect for a bootstrap compliance startup.

Source: [GitHub Actions Environment Protection Rules](https://docs.github.com/en/actions/deployment/protecting-deployments/configuring-custom-deployment-protection-rules)