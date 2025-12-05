# Local Development Environment Setup

## Overview

Local development should mirror production as closely as possible while being fast to start and easy to debug. We'll use Docker Compose to orchestrate services locally.

## Local Development Architecture

```
Local Development Stack:
├── PostgreSQL (Docker container)
├── Redis (Docker container)  
├── LocalStack (AWS services simulation)
├── FastAPI backend (local Python or Docker)
├── Next.js frontend (local Node.js)
├── MkDocs documentation (local)
└── Mailpit (email testing)
```

## Docker Compose Configuration

### Main Compose File
```yaml
# docker-compose.yml
version: '3.8'

services:
  # PostgreSQL database
  postgres:
    image: postgres:15-alpine
    container_name: compliance-postgres
    environment:
      POSTGRES_DB: compliance_engine
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_HOST_AUTH_METHOD: trust
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 30s
      timeout: 10s
      retries: 5
    networks:
      - compliance-network

  # Redis for caching and sessions
  redis:
    image: redis:7-alpine
    container_name: compliance-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 5
    networks:
      - compliance-network

  # LocalStack for AWS services simulation
  localstack:
    image: localstack/localstack:3
    container_name: compliance-localstack
    environment:
      SERVICES: s3,secretsmanager,cloudwatch,logs,sqs
      DEBUG: 1
      DATA_DIR: /tmp/localstack/data
      DOCKER_HOST: unix:///var/run/docker.sock
      HOST_TMP_FOLDER: ${TMPDIR}
    ports:
      - "4566:4566"
      - "4510-4559:4510-4559"
    volumes:
      - "/var/run/docker.sock:/var/run/docker.sock"
      - localstack_data:/tmp/localstack
      - ./localstack/init:/etc/localstack/init/ready.d
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4566/_localstack/health"]
      interval: 30s
      timeout: 10s
      retries: 5
    networks:
      - compliance-network

  # Mailpit for email testing
  mailpit:
    image: axllent/mailpit:latest
    container_name: compliance-mailpit
    ports:
      - "1025:1025"  # SMTP server
      - "8025:8025"  # Web interface
    environment:
      MP_SMTP_AUTH_ACCEPT_ANY: 1
      MP_SMTP_AUTH_ALLOW_INSECURE: 1
    networks:
      - compliance-network

  # FastAPI backend (optional - can run locally too)
  api:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    container_name: compliance-api
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/compliance_engine
      REDIS_URL: redis://redis:6379
      AWS_ENDPOINT_URL: http://localstack:4566
      AWS_ACCESS_KEY_ID: test
      AWS_SECRET_ACCESS_KEY: test
      AWS_DEFAULT_REGION: us-east-1
      ENVIRONMENT: development
      LOG_LEVEL: DEBUG
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
      - /app/.venv  # Anonymous volume for virtual environment
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      localstack:
        condition: service_healthy
    develop:
      watch:
        - action: sync
          path: ./backend/src
          target: /app/src
        - action: rebuild
          path: ./backend/requirements.txt
    networks:
      - compliance-network

volumes:
  postgres_data:
  redis_data:
  localstack_data:

networks:
  compliance-network:
    driver: bridge
```

### Development Override
```yaml
# docker-compose.override.yml (automatically loaded)
version: '3.8'

services:
  api:
    environment:
      PYTHONPATH: /app
      PYTHONDONTWRITEBYTECODE: 1
      PYTHONUNBUFFERED: 1
    command: uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
    
  # Add debugging tools in development
  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: compliance-pgadmin
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@compliance-engine.com
      PGADMIN_DEFAULT_PASSWORD: admin
      PGADMIN_CONFIG_SERVER_MODE: 'False'
    ports:
      - "5050:80"
    depends_on:
      - postgres
    networks:
      - compliance-network
```

## Backend Development Setup

### FastAPI Development Dockerfile
```dockerfile
# backend/Dockerfile.dev
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt requirements-dev.txt ./
RUN pip install --no-cache-dir -r requirements-dev.txt

# Copy application code
COPY . .

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash app && chown -R app:app /app
USER app

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

### Backend Requirements
```txt
# backend/requirements.txt
fastapi[all]==0.104.1
uvicorn[standard]==0.24.0
sqlalchemy[postgresql]==2.0.23
alembic==1.12.1
asyncpg==0.29.0
redis==5.0.1
pydantic==2.5.0
pydantic-settings==2.1.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6
boto3==1.34.0
aiobotocore==2.8.0
structlog==23.2.0
prometheus-client==0.19.0

# backend/requirements-dev.txt
-r requirements.txt
pytest==7.4.3
pytest-asyncio==0.21.1
pytest-cov==4.1.0
httpx==0.25.2
factory-boy==3.3.0
black==23.11.0
isort==5.12.0
mypy==1.7.1
ruff==0.1.6
pre-commit==3.6.0
```

### Environment Configuration
```python
# backend/src/config.py
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/compliance_engine"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379"
    
    # AWS (LocalStack for development)
    AWS_ENDPOINT_URL: Optional[str] = None
    AWS_ACCESS_KEY_ID: str = "test"
    AWS_SECRET_ACCESS_KEY: str = "test"
    AWS_DEFAULT_REGION: str = "us-east-1"
    
    # Application
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "DEBUG"
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    API_PREFIX: str = "/api/v1"
    
    # External APIs
    CLAUDE_API_KEY: Optional[str] = None
    
    # Email (Mailpit for development)
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 1025
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
```

## Frontend Development Setup

### Next.js Development Configuration
```typescript
// frontend/next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // API proxy for local development
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*'
      }
    ]
  },
  
  env: {
    NEXT_PUBLIC_API_URL: process.env.NODE_ENV === 'development' 
      ? 'http://localhost:8000'
      : 'https://api.compliance-engine.com',
    NEXT_PUBLIC_ENVIRONMENT: process.env.NODE_ENV || 'development'
  }
}

export default nextConfig
```

### Frontend Package Configuration
```json
{
  "name": "compliance-engine-frontend",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "test": "jest",
    "test:watch": "jest --watch"
  },
  "dependencies": {
    "next": "14.0.4",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@tailwindcss/forms": "^0.5.7",
    "@headlessui/react": "^1.7.17",
    "@heroicons/react": "^2.0.18",
    "clsx": "^2.0.0",
    "date-fns": "^2.30.0"
  },
  "devDependencies": {
    "typescript": "^5.3.2",
    "@types/node": "^20.10.0",
    "@types/react": "^18.2.38",
    "@types/react-dom": "^18.2.17",
    "eslint": "^8.54.0",
    "eslint-config-next": "14.0.4",
    "tailwindcss": "^3.3.6",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32"
  }
}
```

## Development Scripts and Automation

### Makefile for Common Tasks
```makefile
# Makefile
.PHONY: help dev test clean install

# Default values
ENVIRONMENT ?= development
SERVICES ?= postgres redis localstack

help: ## Show this help message
	@echo "Compliance Engine Development Commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-20s %s\n", $$1, $$2}'

install: ## Install all dependencies
	@echo "Installing backend dependencies..."
	cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements-dev.txt
	@echo "Installing frontend dependencies..."
	cd frontend && npm ci
	@echo "Installing infrastructure dependencies..."
	cd infrastructure && npm ci

dev-services: ## Start development services (database, redis, etc.)
	docker-compose up -d $(SERVICES)
	@echo "Waiting for services to be ready..."
	@sleep 10
	@echo "Services started. Access:"
	@echo "  PostgreSQL: localhost:5432"
	@echo "  Redis: localhost:6379"
	@echo "  LocalStack: http://localhost:4566"
	@echo "  Mailpit: http://localhost:8025"

dev-api: ## Start FastAPI backend locally
	cd backend && source .venv/bin/activate && uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

dev-web: ## Start Next.js frontend
	cd frontend && npm run dev

dev: dev-services ## Start full development environment
	@echo "Starting all development services..."
	docker-compose up -d
	@echo "Development environment ready!"
	@echo "  API: http://localhost:8000"
	@echo "  Web: http://localhost:3000"
	@echo "  Docs: http://localhost:8000/docs"
	@echo "  PgAdmin: http://localhost:5050"
	@echo "  Mailpit: http://localhost:8025"

test: ## Run all tests
	@echo "Running backend tests..."
	cd backend && source .venv/bin/activate && pytest
	@echo "Running frontend tests..."
	cd frontend && npm test
	@echo "Running infrastructure tests..."
	cd infrastructure && npm test

clean: ## Stop all services and clean up
	docker-compose down -v
	docker system prune -f

logs: ## Show logs for all services
	docker-compose logs -f

db-reset: ## Reset database with fresh data
	docker-compose stop postgres
	docker-compose rm -f postgres
	docker volume rm compliance-engine_postgres_data
	docker-compose up -d postgres
	@sleep 5
	cd backend && source .venv/bin/activate && alembic upgrade head

db-shell: ## Connect to PostgreSQL shell
	docker-compose exec postgres psql -U postgres -d compliance_engine

redis-shell: ## Connect to Redis shell
	docker-compose exec redis redis-cli

# Infrastructure commands
cdk-synth: ## Synthesize CDK templates
	cd infrastructure && npm run synth:dev

cdk-deploy-dev: ## Deploy to development AWS environment
	cd infrastructure && npm run deploy:dev

# Format and lint
format: ## Format all code
	cd backend && source .venv/bin/activate && black . && isort .
	cd frontend && npm run lint:fix
	cd infrastructure && npm run lint:fix

check: ## Run all code quality checks
	cd backend && source .venv/bin/activate && black --check . && isort --check . && mypy .
	cd frontend && npm run type-check && npm run lint
	cd infrastructure && npm run lint
```

## Database Setup and Migrations

### Alembic Configuration
```python
# backend/alembic/env.py
from alembic import context
from sqlalchemy import engine_from_config, pool
from src.database.models import Base
from src.config import settings

# Set target metadata
target_metadata = Base.metadata

def run_migrations_online():
    """Run migrations in 'online' mode."""
    configuration = context.config
    configuration.set_main_option("sqlalchemy.url", settings.DATABASE_URL)
    
    connectable = engine_from_config(
        configuration.get_section(configuration.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, 
            target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()

run_migrations_online()
```

### Database Initialization Script
```sql
-- database/init/01-create-extensions.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create application user
CREATE USER compliance_app WITH PASSWORD 'app_password';
GRANT CONNECT ON DATABASE compliance_engine TO compliance_app;
GRANT USAGE ON SCHEMA public TO compliance_app;
GRANT CREATE ON SCHEMA public TO compliance_app;
```

## LocalStack Configuration

### LocalStack Initialization
```bash
#!/bin/bash
# localstack/init/01-setup-aws-resources.sh

# Create S3 buckets
awslocal s3 mb s3://compliance-documents-dev
awslocal s3 mb s3://compliance-logs-dev

# Create Secrets
awslocal secretsmanager create-secret \
    --name "dev/compliance-engine/database" \
    --description "Database credentials for development" \
    --secret-string '{"username":"postgres","password":"postgres"}'

awslocal secretsmanager create-secret \
    --name "dev/compliance-engine/claude-api-key" \
    --description "Claude API key for development" \
    --secret-string '{"api_key":"test-claude-key"}'

# Create SQS queues
awslocal sqs create-queue --queue-name compliance-jobs-dev
awslocal sqs create-queue --queue-name compliance-jobs-dlq-dev

echo "LocalStack resources initialized successfully!"
```

## VS Code Development Configuration

### VS Code Settings
```json
{
  "files.associations": {
    "*.env.example": "properties"
  },
  "python.defaultInterpreterPath": "./backend/.venv/bin/python",
  "python.linting.enabled": true,
  "python.linting.pylintEnabled": false,
  "python.linting.mypyEnabled": true,
  "python.formatting.provider": "black",
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.organizeImports": true
  },
  "docker.composeCommand": "docker-compose"
}
```

### VS Code Extensions
```json
{
  "recommendations": [
    "ms-python.python",
    "ms-python.black-formatter",
    "charliermarsh.ruff",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "ms-azuretools.vscode-docker",
    "amazonwebservices.aws-toolkit-vscode",
    "ms-vscode.test-adapter-converter"
  ]
}
```

This local development setup provides:

✅ **Complete local AWS simulation** with LocalStack  
✅ **Database development** with PostgreSQL and migrations  
✅ **Email testing** with Mailpit  
✅ **Hot reloading** for both frontend and backend  
✅ **Debugging capabilities** with proper IDE integration  
✅ **One-command startup** via make commands  
✅ **Production parity** using same containers and configs  

Ready to implement the core CDK stacks next, or would you like me to continue with the local development setup?