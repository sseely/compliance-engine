# Infrastructure as Code Architecture

## AWS CDK Strategy for Compliance Engine

### Core Principles

**100% Infrastructure as Code**: Every AWS resource defined in TypeScript CDK code
- No manual AWS console configuration
- All changes go through code review and CI/CD
- Complete audit trail of infrastructure changes
- Reproducible across dev/staging/production environments

**Security by Default**: Infrastructure code enforces security policies
- Least privilege IAM roles
- Encrypted data at rest and in transit
- Private subnets for databases and internal services
- Security groups with minimal required access

## CDK Project Structure

```typescript
infrastructure/
├── src/
│   ├── stacks/
│   │   ├── network-stack.ts          # VPC, subnets, NAT gateways
│   │   ├── database-stack.ts         # RDS PostgreSQL with security
│   │   ├── compute-stack.ts          # ECS cluster and services
│   │   ├── api-stack.ts              # ALB, API Gateway, Lambda
│   │   ├── storage-stack.ts          # S3 buckets with encryption
│   │   ├── monitoring-stack.ts       # CloudWatch, alarms, dashboards
│   │   ├── cdn-stack.ts              # CloudFront distributions
│   │   └── security-stack.ts         # WAF, IAM roles, secrets
│   ├── constructs/
│   │   ├── compliance-api.ts         # Reusable FastAPI service
│   │   ├── secure-database.ts        # RDS with best practices
│   │   ├── monitoring-dashboard.ts   # Business metrics dashboard
│   │   └── customer-portal.ts        # Static site with CDN
│   └── config/
│       ├── dev.ts                    # Development environment
│       ├── staging.ts                # Staging environment
│       └── production.ts             # Production environment
├── cdk.json                          # CDK configuration
├── package.json                      # Dependencies
└── tsconfig.json                     # TypeScript configuration
```

## Environment-Specific Configuration

```typescript
// infrastructure/src/config/environment.ts
export interface EnvironmentConfig {
  readonly name: string
  readonly account: string
  readonly region: string
  readonly domainName: string
  readonly certificateArn: string
  readonly database: DatabaseConfig
  readonly compute: ComputeConfig
  readonly monitoring: MonitoringConfig
}

interface DatabaseConfig {
  readonly instanceType: string
  readonly allocatedStorage: number
  readonly backupRetention: number
  readonly multiAz: boolean
  readonly deletionProtection: boolean
}

interface ComputeConfig {
  readonly minCapacity: number
  readonly maxCapacity: number
  readonly desiredCapacity: number
  readonly cpu: number
  readonly memory: number
}

// Environment-specific configs
export const DEV_CONFIG: EnvironmentConfig = {
  name: 'dev',
  account: '123456789012',
  region: 'us-east-1', 
  domainName: 'dev.compliance-engine.com',
  certificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/dev-cert',
  database: {
    instanceType: 't3.micro',
    allocatedStorage: 20,
    backupRetention: 7,
    multiAz: false,
    deletionProtection: false
  },
  compute: {
    minCapacity: 1,
    maxCapacity: 3,
    desiredCapacity: 1,
    cpu: 256,
    memory: 512
  },
  monitoring: {
    alertingEmail: 'dev-alerts@compliance-engine.com',
    enableDetailedMonitoring: false
  }
}

export const PRODUCTION_CONFIG: EnvironmentConfig = {
  name: 'production',
  account: '987654321098',
  region: 'us-east-1',
  domainName: 'compliance-engine.com',
  certificateArn: 'arn:aws:acm:us-east-1:987654321098:certificate/prod-cert',
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
    desiredCapacity: 3,
    cpu: 512,
    memory: 1024
  },
  monitoring: {
    alertingEmail: 'alerts@compliance-engine.com',
    enableDetailedMonitoring: true
  }
}
```

## Core Infrastructure Stacks

### 1. Network Stack
```typescript
// infrastructure/src/stacks/network-stack.ts
import { Stack, StackProps } from 'aws-cdk-lib'
import { Vpc, SubnetType, InterfaceVpcEndpoint } from 'aws-cdk-lib/aws-ec2'
import { Construct } from 'constructs'

export class NetworkStack extends Stack {
  public readonly vpc: Vpc
  
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)
    
    // VPC with public and private subnets across 3 AZs
    this.vpc = new Vpc(this, 'ComplianceVPC', {
      maxAzs: 3,
      natGateways: 2, // High availability with cost optimization
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: SubnetType.PUBLIC,
          cidrMask: 24
        },
        {
          name: 'Private',
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24
        },
        {
          name: 'Database',
          subnetType: SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24
        }
      ],
      enableDnsHostnames: true,
      enableDnsSupport: true
    })
    
    // VPC Endpoints for AWS services (avoid NAT gateway costs)
    new InterfaceVpcEndpoint(this, 'S3Endpoint', {
      vpc: this.vpc,
      service: {
        name: 's3',
        port: 443
      }
    })
    
    new InterfaceVpcEndpoint(this, 'SecretsManagerEndpoint', {
      vpc: this.vpc,
      service: {
        name: 'secretsmanager',
        port: 443
      }
    })
  }
}
```

### 2. Database Stack
```typescript
// infrastructure/src/stacks/database-stack.ts
import { Stack, StackProps, RemovalPolicy, Duration } from 'aws-cdk-lib'
import { 
  DatabaseInstance, 
  DatabaseInstanceEngine, 
  PostgresEngineVersion,
  Credentials,
  SubnetGroup,
  ParameterGroup
} from 'aws-cdk-lib/aws-rds'
import { SecurityGroup, Vpc, Port } from 'aws-cdk-lib/aws-ec2'
import { Secret } from 'aws-cdk-lib/aws-secretsmanager'

export interface DatabaseStackProps extends StackProps {
  readonly vpc: Vpc
  readonly config: EnvironmentConfig
}

export class DatabaseStack extends Stack {
  public readonly database: DatabaseInstance
  public readonly credentials: Secret
  
  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props)
    
    // Database credentials stored in Secrets Manager
    this.credentials = new Secret(this, 'DatabaseCredentials', {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'postgres' }),
        generateStringKey: 'password',
        excludeCharacters: '"@/\\'
      }
    })
    
    // Database security group - only accessible from ECS
    const dbSecurityGroup = new SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for PostgreSQL database',
      allowAllOutbound: false
    })
    
    // Database subnet group
    const subnetGroup = new SubnetGroup(this, 'DatabaseSubnetGroup', {
      vpc: props.vpc,
      description: 'Subnet group for PostgreSQL database',
      vpcSubnets: props.vpc.selectSubnets({
        subnetType: SubnetType.PRIVATE_ISOLATED
      })
    })
    
    // Database parameter group for performance tuning
    const parameterGroup = new ParameterGroup(this, 'DatabaseParameterGroup', {
      engine: DatabaseInstanceEngine.postgres({
        version: PostgresEngineVersion.VER_15
      }),
      parameters: {
        'shared_preload_libraries': 'pg_stat_statements',
        'log_statement': 'all',
        'log_min_duration_statement': '1000', // Log slow queries
        'max_connections': '200'
      }
    })
    
    // PostgreSQL database instance
    this.database = new DatabaseInstance(this, 'PostgreSQLDatabase', {
      engine: DatabaseInstanceEngine.postgres({
        version: PostgresEngineVersion.VER_15
      }),
      instanceType: props.config.database.instanceType,
      allocatedStorage: props.config.database.allocatedStorage,
      storageEncrypted: true,
      multiAz: props.config.database.multiAz,
      credentials: Credentials.fromSecret(this.credentials),
      vpc: props.vpc,
      subnetGroup: subnetGroup,
      securityGroups: [dbSecurityGroup],
      parameterGroup: parameterGroup,
      backupRetention: Duration.days(props.config.database.backupRetention),
      deletionProtection: props.config.database.deletionProtection,
      databaseName: 'compliance_engine',
      
      // Performance insights for monitoring
      enablePerformanceInsights: true,
      performanceInsightRetention: PerformanceInsightRetention.DEFAULT,
      
      // Automated maintenance
      autoMinorVersionUpgrade: true,
      preferredMaintenanceWindow: 'sun:03:00-sun:04:00',
      preferredBackupWindow: '02:00-03:00'
    })
    
    // Apply removal policy based on environment
    if (props.config.name === 'dev') {
      this.database.applyRemovalPolicy(RemovalPolicy.DESTROY)
    } else {
      this.database.applyRemovalPolicy(RemovalPolicy.SNAPSHOT)
    }
  }
  
  public allowConnectionsFrom(securityGroup: SecurityGroup): void {
    this.database.connections.allowFrom(securityGroup, Port.tcp(5432))
  }
}
```

### 3. Compute Stack (ECS)
```typescript
// infrastructure/src/stacks/compute-stack.ts
import { Stack, StackProps } from 'aws-cdk-lib'
import { 
  Cluster, 
  FargateService, 
  FargateTaskDefinition,
  ContainerImage,
  LogDriver
} from 'aws-cdk-lib/aws-ecs'
import { SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2'
import { Repository } from 'aws-cdk-lib/aws-ecr'
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs'

export class ComputeStack extends Stack {
  public readonly cluster: Cluster
  public readonly apiService: FargateService
  
  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props)
    
    // ECS Cluster
    this.cluster = new Cluster(this, 'ComplianceCluster', {
      vpc: props.vpc,
      containerInsights: props.config.monitoring.enableDetailedMonitoring
    })
    
    // ECR Repository for FastAPI container
    const apiRepository = new Repository(this, 'ComplianceAPIRepository', {
      repositoryName: 'compliance-api',
      lifecycleRules: [{
        maxImageCount: 10, // Keep last 10 images
        tagStatus: TagStatus.ANY
      }]
    })
    
    // Security group for ECS tasks
    const ecsSecurityGroup = new SecurityGroup(this, 'ECSSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for ECS Fargate tasks'
    })
    
    // CloudWatch log group
    const logGroup = new LogGroup(this, 'APILogGroup', {
      logGroupName: `/aws/ecs/compliance-api-${props.config.name}`,
      retention: RetentionDays.ONE_MONTH
    })
    
    // Task definition
    const taskDefinition = new FargateTaskDefinition(this, 'APITaskDefinition', {
      memoryLimitMiB: props.config.compute.memory,
      cpu: props.config.compute.cpu
    })
    
    // Add container to task definition
    const container = taskDefinition.addContainer('ComplianceAPIContainer', {
      image: ContainerImage.fromEcrRepository(apiRepository, 'latest'),
      environment: {
        ENVIRONMENT: props.config.name,
        DATABASE_HOST: props.database.instanceEndpoint.hostname,
        DATABASE_PORT: props.database.instanceEndpoint.port.toString(),
        DATABASE_NAME: 'compliance_engine'
      },
      secrets: {
        DATABASE_PASSWORD: Secret.fromSecretsManager(props.databaseCredentials, 'password')
      },
      logging: LogDriver.awsLogs({
        logGroup: logGroup,
        streamPrefix: 'api'
      }),
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:8000/health || exit 1'],
        interval: Duration.seconds(30),
        timeout: Duration.seconds(5),
        retries: 3,
        startPeriod: Duration.seconds(60)
      }
    })
    
    container.addPortMappings({
      containerPort: 8000,
      protocol: Protocol.TCP
    })
    
    // Fargate service
    this.apiService = new FargateService(this, 'ComplianceAPIService', {
      cluster: this.cluster,
      taskDefinition: taskDefinition,
      desiredCount: props.config.compute.desiredCapacity,
      assignPublicIp: false,
      securityGroups: [ecsSecurityGroup],
      vpcSubnets: props.vpc.selectSubnets({
        subnetType: SubnetType.PRIVATE_WITH_EGRESS
      }),
      enableExecuteCommand: true, // For debugging
      
      // Health check grace period
      healthCheckGracePeriod: Duration.seconds(120)
    })
    
    // Auto scaling
    const scaling = this.apiService.autoScaleTaskCount({
      minCapacity: props.config.compute.minCapacity,
      maxCapacity: props.config.compute.maxCapacity
    })
    
    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: Duration.minutes(5),
      scaleOutCooldown: Duration.minutes(2)
    })
    
    // Allow database connections
    props.database.allowConnectionsFrom(ecsSecurityGroup)
  }
}
```

## Deployment Pipeline

### GitHub Actions Workflow
```yaml
# .github/workflows/deploy.yml
name: Deploy Infrastructure

on:
  push:
    branches: [main]
    paths: ['infrastructure/**']
  pull_request:
    branches: [main]
    paths: ['infrastructure/**']

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: infrastructure/package-lock.json
      
      - name: Install dependencies
        run: |
          cd infrastructure
          npm ci
      
      - name: Run tests
        run: |
          cd infrastructure
          npm run test
      
      - name: CDK synth
        run: |
          cd infrastructure
          npm run synth
      
      - name: Upload CloudFormation templates
        uses: actions/upload-artifact@v4
        with:
          name: cloudformation-templates
          path: infrastructure/cdk.out/

  deploy-dev:
    if: github.ref == 'refs/heads/main'
    needs: validate
    runs-on: ubuntu-latest
    environment: development
    steps:
      - uses: actions/checkout@v4
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Deploy to development
        run: |
          cd infrastructure
          npm ci
          npm run deploy:dev

  deploy-production:
    if: github.ref == 'refs/heads/main'
    needs: [validate, deploy-dev]
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Deploy to production
        run: |
          cd infrastructure
          npm ci
          npm run deploy:prod
```

## Benefits of This IaC Approach

**Compliance & Audit Ready**:
- Complete infrastructure change history in Git
- Code review for all infrastructure changes
- Automated security policy enforcement
- Reproducible environments for disaster recovery

**Cost Management**:
- Environment-appropriate resource sizing
- Automatic cleanup of development resources
- Infrastructure cost tracking through code

**Security**:
- Security groups defined in code
- IAM policies version controlled
- Encryption enabled by default
- No manual configuration drift

**Reliability**:
- Consistent deployments across environments
- Automated rollback capabilities
- Infrastructure testing before deployment
- Health checks and monitoring built-in

This IaC foundation ensures that your compliance engine infrastructure is auditable, secure, and scalable from day one.