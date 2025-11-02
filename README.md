# Compliance Engine

Enterprise-grade compliance engine for business license verification, permit management, and regulatory compliance tracking.

## 🚀 Overview

The Compliance Engine is a comprehensive platform designed to streamline regulatory compliance workflows for businesses of all sizes. Built with security-first principles and enterprise scalability in mind, it provides real-time license verification, permit management, and compliance tracking capabilities.

### Key Features

- **Business License Verification**: Real-time verification across all 50 US states
- **Permit Management**: Streamlined permit application and tracking workflows  
- **Fleet Compliance**: Vehicle registration and inspection compliance monitoring
- **Professional Licensing**: Professional certification and license tracking
- **Audit Trail**: Complete SOC 2 and ISO 27001 compliant audit logging
- **API-First Design**: RESTful APIs with comprehensive documentation
- **Enterprise Security**: Role-based access control, encryption at rest and in transit

## 🏗️ Architecture

### Technology Stack

- **Backend**: Python 3.13+ with FastAPI
- **Database**: PostgreSQL 18 with stored procedure security model
- **Infrastructure**: AWS CDK (TypeScript) for Infrastructure as Code
- **Frontend**: Next.js 14+ with TypeScript (planned)
- **Authentication**: API Key + JWT with role-based permissions
- **Monitoring**: CloudWatch, Prometheus, structured logging

### Security Architecture

- **Zero SQL Injection**: All database access through whitelisted stored procedures
- **API Security**: Rate limiting, CORS management, request validation
- **Data Encryption**: AES-256 encryption for sensitive data
- **Audit Compliance**: Every action logged for SOC 2 compliance
- **Network Security**: VPC isolation, security groups, WAF protection

## 🛠️ Development Setup

### Prerequisites

- Python 3.13+
- Docker and Docker Compose
- Node.js 18+ (for infrastructure)
- PostgreSQL 18 (via Docker)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/sseely/compliance-engine.git
   cd compliance-engine
   ```

2. **Set up the backend**
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Start the database**
   ```bash
   ./scripts/dev-db.sh start
   ```

4. **Run migrations and seed data**
   ```bash
   ./scripts/dev-db.sh migrate
   ./scripts/dev-db.sh seed
   ```

5. **Start the API server**
   ```bash
   uvicorn src.main:app --reload
   ```

The API will be available at `http://localhost:8000` with interactive docs at `/docs`.

### Database Management

The project includes a convenient database management script:

```bash
# Start PostgreSQL container
./scripts/dev-db.sh start

# Stop the database
./scripts/dev-db.sh stop

# View database logs
./scripts/dev-db.sh logs

# Open PostgreSQL shell
./scripts/dev-db.sh shell

# Run migrations
./scripts/dev-db.sh migrate

# Load seed data
./scripts/dev-db.sh seed

# Reset database (destroys all data!)
./scripts/dev-db.sh reset
```

## 📊 Business Model

### Product Lines

1. **License Verification API** - Real-time business license verification
2. **Permit Generator** - Automated permit application workflows
3. **Fleet Tracker** - Vehicle compliance and inspection management
4. **Professional Tracker** - Professional license and certification management

### Pricing Strategy

- Usage-based pricing model
- Tiered plans from $99/month to enterprise
- Target: $300K+ ARR within 18 months
- Premium features for enterprise customers

## 🔧 API Endpoints

### License Verification

```http
POST /api/v1/licenses/verify
Authorization: ApiKey your-api-key

{
  "business_name": "ACME Corporation",
  "state_code": "CA",
  "license_type": "business"
}
```

### Health Checks

```http
GET /health/live     # Liveness probe
GET /health/ready    # Readiness probe  
GET /health/deep     # Deep health check with database
```

## 🚀 Deployment

### Infrastructure as Code

All infrastructure is defined using AWS CDK in TypeScript:

```bash
cd infrastructure
npm install
npm run build
cdk deploy --all
```

### Deployment Stacks

- **Networking**: VPC, subnets, security groups
- **Database**: RDS PostgreSQL with encryption
- **Compute**: ECS Fargate with auto-scaling
- **Monitoring**: CloudWatch dashboards and alarms
- **Compliance**: CloudTrail, Config, GuardDuty

### Zero-Downtime Deployments

- Rolling updates with health checks
- Database migrations with backward compatibility
- Circuit breakers for external dependencies
- Automated rollback on failure

## 📈 Monitoring & Observability

- **Metrics**: Prometheus metrics with Grafana dashboards
- **Logging**: Structured JSON logging with correlation IDs
- **Tracing**: Request tracing across all services
- **Alerts**: CloudWatch alarms with SNS notifications
- **Health Checks**: Multi-level health monitoring

## 🔒 Compliance & Security

### SOC 2 Type II Ready

- Complete audit trail for all operations
- Data encryption at rest and in transit
- Role-based access controls
- Regular security assessments
- Incident response procedures

### Data Privacy

- GDPR and CCPA compliant data handling
- Data retention policies
- Right to deletion implementation
- Privacy by design architecture

## 🤝 Contributing

This is currently a private project under active development. Contribution guidelines will be published when the project enters open development.

## 📄 License

Proprietary - All rights reserved.

## 🆘 Support

For support inquiries, please contact: [support@compliance-engine.com](mailto:support@compliance-engine.com)

---

**Built with ❤️ for regulatory compliance professionals**