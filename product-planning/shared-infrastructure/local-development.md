# Local Development Environment

## Overview

Complete local development setup using Docker Compose to mirror production environment. Developers can run the entire stack locally including all services, databases, and external service mocks.

## Docker Compose Setup

### docker-compose.yml
```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: compliance_dev
      POSTGRES_USER: compliance
      POSTGRES_PASSWORD: dev_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init-db.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U compliance -d compliance_dev"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis Cache
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  # LocalStack (AWS Services Mock)
  localstack:
    image: localstack/localstack:3.0
    ports:
      - "4566:4566"
    environment:
      - SERVICES=s3,sqs,lambda,cloudwatch,events
      - DEBUG=1
      - LAMBDA_EXECUTOR=docker
      - DOCKER_HOST=unix:///var/run/docker.sock
      - LAMBDA_RUNTIME_ENVIRONMENT_TIMEOUT=60
    volumes:
      - "/var/run/docker.sock:/var/run/docker.sock"
      - "./scripts/localstack-init.sh:/etc/localstack/init/ready.d/init.sh"
      - "./lambda-functions:/tmp/lambda-functions"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4566/_localstack/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Lambda Function Development Environment
  lambda-dev:
    build:
      context: .
      dockerfile: Dockerfile.lambda
    volumes:
      - ./lambda-functions:/app/lambda-functions
      - ./src:/app/src  # Shared code between API and Lambda
    environment:
      - AWS_ENDPOINT_URL=http://localstack:4566
      - AWS_ACCESS_KEY_ID=test
      - AWS_SECRET_ACCESS_KEY=test
      - AWS_DEFAULT_REGION=us-east-1
      - CLAUDE_API_KEY=${CLAUDE_API_KEY:-test-key}
    depends_on:
      - localstack

  # Main API Service
  api:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://compliance:dev_password@postgres:5432/compliance_dev
      - REDIS_URL=redis://redis:6379/0
      - AWS_ENDPOINT_URL=http://localstack:4566
      - AWS_ACCESS_KEY_ID=test
      - AWS_SECRET_ACCESS_KEY=test
      - AWS_DEFAULT_REGION=us-east-1
      - CLAUDE_API_KEY=${CLAUDE_API_KEY:-test-key}
      - DEBUG=true
    volumes:
      - .:/app
      - /app/.venv  # Don't mount .venv
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      localstack:
        condition: service_healthy
    command: uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
    develop:
      watch:
        - action: sync
          path: ./src
          target: /app/src
          ignore:
            - __pycache__/
        - action: rebuild
          path: pyproject.toml

volumes:
  postgres_data:
  redis_data:
```

### docker-compose.test.yml
```yaml
version: '3.8'

services:
  # Test PostgreSQL Database
  postgres-test:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: compliance_test
      POSTGRES_USER: compliance
      POSTGRES_PASSWORD: test_password
    ports:
      - "5433:5432"
    tmpfs:
      - /var/lib/postgresql/data  # In-memory for faster tests
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U compliance -d compliance_test"]
      interval: 5s
      timeout: 3s
      retries: 3

  # Test Redis
  redis-test:
    image: redis:7-alpine
    ports:
      - "6380:6379"
    tmpfs:
      - /data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 3

  # Test Runner
  test-runner:
    build:
      context: .
      dockerfile: Dockerfile.dev
    environment:
      - DATABASE_URL=postgresql://compliance:test_password@postgres-test:5432/compliance_test
      - REDIS_URL=redis://redis-test:6379/0
      - AWS_ENDPOINT_URL=http://localstack:4566
      - AWS_ACCESS_KEY_ID=test
      - AWS_SECRET_ACCESS_KEY=test
      - TESTING=true
    volumes:
      - .:/app
      - coverage_data:/app/htmlcov
    depends_on:
      postgres-test:
        condition: service_healthy
      redis-test:
        condition: service_healthy
    command: >
      sh -c "
        pytest tests/ 
        --cov=src 
        --cov-report=html 
        --cov-report=term 
        --cov-report=xml 
        --cov-fail-under=90
        -v
      "

volumes:
  coverage_data:
```

## AWS Lambda Local Development

AWS doesn't have a first-party equivalent to Azure Functions Core Tools, but there are several excellent options:

### Option 1: LocalStack + AWS SAM (Recommended)
**Best for**: Full AWS ecosystem simulation with real Lambda runtime

```bash
# Install AWS SAM CLI
brew install aws-sam-cli

# Build and test Lambda locally
sam build
sam local start-api --docker-network compliance-engine_default
sam local invoke DocumentExtractorFunction --event events/test-event.json
```

### Option 2: LocalStack Direct (Current Setup)
**Best for**: Integrated development with other AWS services

LocalStack provides Lambda execution environment that mimics AWS behavior:
- Real container execution
- Environment variables and timeout handling
- Integration with S3, SQS, CloudWatch events
- Hot reload for development

### Option 3: Lambda Runtime Interface Emulator
**Best for**: Testing specific Lambda runtime behavior

```bash
# Run Lambda function locally with AWS RIE
docker run -p 9000:8080 lambda-function:latest

# Invoke function
curl -XPOST "http://localhost:9000/2015-03-31/functions/function/invocations" -d '{}'
```

## Lambda Development Setup

### Dockerfile.lambda
```dockerfile
FROM public.ecr.aws/lambda/python:3.11

# Copy shared code
COPY src/ ${LAMBDA_TASK_ROOT}/src/

# Copy lambda-specific code
COPY lambda-functions/ ${LAMBDA_TASK_ROOT}/lambda-functions/

# Install dependencies
COPY requirements-lambda.txt .
RUN pip install -r requirements-lambda.txt

# Set the CMD to your handler
CMD ["lambda-functions.document_extractor.handler"]
```

### Lambda Function Structure
```
lambda-functions/
├── document_extractor/
│   ├── __init__.py
│   ├── handler.py           # Lambda entry point
│   ├── extractor.py         # Business logic
│   └── requirements.txt     # Lambda-specific deps
├── data_scraper/
│   ├── __init__.py  
│   ├── handler.py
│   └── scraper.py
├── shared/
│   ├── __init__.py
│   └── utils.py            # Shared Lambda utilities
└── events/                 # Test event payloads
    ├── sqs-event.json
    └── s3-event.json
```

## Development Dockerfile

### Container Base Image Recommendations (2024)

**Current best practices for minimal, secure containers:**

1. **Distroless** (Google) - No shell, package manager, or unnecessary binaries
2. **Chainguard Images** - Minimal with security focus, frequent updates
3. **python:3.11-slim** - Still good, Debian-based, well-maintained
4. **Alpine** - Smaller but musl libc compatibility issues, slower security updates

**Recommended: Distroless for production, slim for development**

### Dockerfile.dev (Development)
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Create non-root user
RUN groupadd -r compliance && useradd -r -g compliance compliance

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Install Poetry
RUN pip install --no-cache-dir poetry

# Copy dependency files
COPY pyproject.toml poetry.lock ./

# Configure Poetry and install dependencies
RUN poetry config virtualenvs.create true \
    && poetry config virtualenvs.in-project true \
    && poetry install --no-root

# Copy source code and set ownership
COPY . .
RUN chown -R compliance:compliance /app

# Switch to non-root user
USER compliance

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Default command
CMD ["poetry", "run", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

### Dockerfile.prod (Production - Distroless)
```dockerfile
# Multi-stage build for production
FROM python:3.11-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN pip install --no-cache-dir poetry

# Copy dependency files
COPY pyproject.toml poetry.lock ./

# Install dependencies to local directory
RUN poetry config virtualenvs.create false \
    && poetry install --only=main --no-root \
    && pip install --target=/app/dependencies -r <(poetry export -f requirements.txt --without-hashes)

# Production stage - Distroless
FROM gcr.io/distroless/python3-debian12:latest

WORKDIR /app

# Copy dependencies from builder
COPY --from=builder /app/dependencies /app/dependencies

# Copy application code
COPY src/ /app/src/

# Set Python path
ENV PYTHONPATH=/app/dependencies:/app

# Run as non-root (distroless uses user 65532)
USER 65532

# Expose port
EXPOSE 8000

# Command
CMD ["src.main:app"]
```

### Dockerfile.lambda (AWS Lambda)
```dockerfile
# Use AWS Lambda Python base image (already minimal and optimized)
FROM public.ecr.aws/lambda/python:3.11

# Copy shared code
COPY src/ ${LAMBDA_TASK_ROOT}/src/

# Copy lambda-specific code
COPY lambda-functions/ ${LAMBDA_TASK_ROOT}/lambda-functions/

# Install dependencies
COPY requirements-lambda.txt .
RUN pip install --no-cache-dir -r requirements-lambda.txt

# Lambda functions run as sbx_user1051 by default (non-root)
# No additional security configuration needed

# Set the CMD to your handler
CMD ["lambda-functions.document_extractor.handler.main"]
```

## Development Scripts

### Makefile
```makefile
.PHONY: help dev test test-unit test-integration test-e2e coverage clean lambda-test lambda-deploy

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

dev: ## Start development environment
	docker-compose up -d
	@echo "Development environment started!"
	@echo "API: http://localhost:8000"
	@echo "API Docs: http://localhost:8000/docs"
	@echo "PostgreSQL: localhost:5432"
	@echo "Redis: localhost:6379"
	@echo "LocalStack: http://localhost:4566"

dev-logs: ## Follow development logs
	docker-compose logs -f api

test: ## Run all tests with coverage
	docker-compose -f docker-compose.yml -f docker-compose.test.yml up --build test-runner
	docker cp $$(docker-compose -f docker-compose.test.yml ps -q test-runner):/app/htmlcov ./htmlcov

test-unit: ## Run unit tests only
	docker-compose exec api poetry run pytest tests/unit/ -v

test-integration: ## Run integration tests only
	docker-compose exec api poetry run pytest tests/integration/ -v

test-e2e: ## Run end-to-end tests only
	docker-compose exec api poetry run pytest tests/e2e/ -v

# Lambda-specific commands
lambda-test: ## Test Lambda functions locally
	@echo "Testing document extractor Lambda..."
	docker-compose exec lambda-dev python -m pytest lambda-functions/tests/ -v
	@echo "Invoking Lambda via LocalStack..."
	awslocal lambda invoke --function-name document-extractor --payload file://lambda-functions/events/test-document.json /tmp/response.json
	cat /tmp/response.json | jq

lambda-deploy-local: ## Deploy Lambda functions to LocalStack
	@echo "Deploying Lambda functions to LocalStack..."
	cd lambda-functions && zip -r document-extractor.zip document_extractor/
	awslocal lambda create-function \
		--function-name document-extractor \
		--runtime python3.11 \
		--role arn:aws:iam::000000000000:role/lambda-role \
		--handler document_extractor.handler.main \
		--zip-file fileb://document-extractor.zip

lambda-logs: ## View Lambda logs in LocalStack
	awslocal logs describe-log-groups
	awslocal logs get-log-events --log-group-name /aws/lambda/document-extractor --log-stream-name latest

lambda-shell: ## Open shell in Lambda dev container
	docker-compose exec lambda-dev bash

# AWS SAM commands (if using SAM)
sam-build: ## Build SAM application
	sam build

sam-local-api: ## Start SAM local API
	sam local start-api --docker-network compliance-engine_default

sam-invoke: ## Invoke specific Lambda function with SAM
	sam local invoke DocumentExtractorFunction --event lambda-functions/events/test-document.json

coverage: ## Generate and open coverage report
	@make test
	@command -v open >/dev/null 2>&1 && open htmlcov/index.html || echo "Coverage report generated in htmlcov/index.html"

lint: ## Run linting and formatting
	docker-compose exec api poetry run black src tests lambda-functions
	docker-compose exec api poetry run isort src tests lambda-functions
	docker-compose exec api poetry run flake8 src tests lambda-functions
	docker-compose exec api poetry run mypy src lambda-functions

clean: ## Clean up containers and volumes
	docker-compose down -v
	docker-compose -f docker-compose.test.yml down -v
	docker system prune -f

reset-db: ## Reset development database
	docker-compose exec postgres psql -U compliance -d compliance_dev -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
	docker-compose exec api poetry run alembic upgrade head

shell: ## Open shell in API container
	docker-compose exec api bash

db-shell: ## Open PostgreSQL shell
	docker-compose exec postgres psql -U compliance -d compliance_dev

redis-shell: ## Open Redis shell
	docker-compose exec redis redis-cli
```

## LocalStack Initialization

### scripts/localstack-init.sh
```bash
#!/bin/bash

# Wait for LocalStack to be ready
echo "Waiting for LocalStack to be ready..."
until curl -f http://localhost:4566/_localstack/health; do
  sleep 1
done

echo "Creating S3 buckets..."
awslocal s3 mb s3://compliance-documents
awslocal s3 mb s3://compliance-static

echo "Creating SQS queues..."
awslocal sqs create-queue --queue-name data-extraction-queue
awslocal sqs create-queue --queue-name document-processing-queue

echo "Setting up Lambda functions..."
# Lambda functions will be deployed via CDK in actual development

echo "LocalStack initialization complete!"
```

## Test Configuration

### pytest.ini
```ini
[tool:pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts = 
    -v
    --strict-markers
    --tb=short
    --cov=src
    --cov-report=term-missing
    --cov-report=html
    --cov-fail-under=90
markers =
    unit: Unit tests
    integration: Integration tests
    e2e: End-to-end tests
    slow: Slow running tests
    external: Tests that require external services
```

### conftest.py
```python
import asyncio
import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.main import app
from src.database import Base, get_database
from src.config import get_config, TestConfig

# Test database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_database():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

def override_get_config():
    return TestConfig()

app.dependency_overrides[get_database] = override_get_database
app.dependency_overrides[get_config] = override_get_config

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="function", autouse=True)
def setup_database():
    """Create and tear down test database for each test."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def client():
    """FastAPI test client."""
    return TestClient(app)

@pytest.fixture
def db_session():
    """Database session for tests."""
    session = TestingSessionLocal()
    yield session
    session.close()
```

## Development Workflow

### Daily Development Commands
```bash
# Start development environment
make dev

# Run all tests with coverage
make test

# Run specific test types
make test-unit
make test-integration
make test-e2e

# View coverage report
make coverage

# Code quality checks
make lint

# Database operations
make reset-db
make db-shell

# Cleanup
make clean
```

### IDE Integration

#### VS Code settings.json
```json
{
    "python.defaultInterpreterPath": "./.venv/bin/python",
    "python.testing.pytestEnabled": true,
    "python.testing.pytestArgs": [
        "tests",
        "--cov=src",
        "--cov-report=html"
    ],
    "python.linting.enabled": true,
    "python.linting.flake8Enabled": true,
    "python.formatting.provider": "black",
    "python.sortImports.args": ["--profile", "black"],
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
        "source.organizeImports": true
    }
}
```

## CI/CD Integration

The local development setup mirrors the CI/CD environment:
- Same test commands run locally and in CI
- Same database versions and configurations  
- Same coverage thresholds enforced
- Same code quality tools

This ensures "works on my machine" issues are minimized and CI failures can be reproduced locally.