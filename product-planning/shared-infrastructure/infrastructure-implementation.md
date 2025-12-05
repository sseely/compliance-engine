# Infrastructure Implementation Plan

## Phase 1: Core CDK Project Setup

### Project Structure
```
infrastructure/
├── src/
│   ├── app.ts                    # CDK App entry point
│   ├── stacks/
│   │   ├── network-stack.ts      # VPC, subnets, security groups
│   │   ├── database-stack.ts     # RDS PostgreSQL with encryption
│   │   ├── compute-stack.ts      # ECS Fargate cluster and services
│   │   ├── api-stack.ts          # ALB with SSL termination
│   │   ├── storage-stack.ts      # S3 buckets for documents/logs
│   │   └── monitoring-stack.ts   # CloudWatch dashboards/alarms
│   ├── constructs/
│   │   ├── secure-database.ts    # Reusable RDS with best practices
│   │   ├── compliance-api.ts     # FastAPI ECS service
│   │   └── environment-config.ts # Environment-specific settings
│   └── config/
│       ├── environments.ts       # Dev/QA/Prod configurations
│       └── constants.ts          # Shared constants (DRY principle)
├── test/
│   ├── infrastructure.test.ts    # CDK unit tests
│   └── __snapshots__/           # Jest snapshots
├── cdk.json                     # CDK configuration
├── package.json                 # Dependencies and scripts
├── tsconfig.json               # TypeScript configuration
└── README.md                   # Setup and deployment instructions
```

### Implementation Steps

#### Step 1: Initialize CDK Project
```bash
# Create infrastructure directory
mkdir infrastructure
cd infrastructure

# Initialize CDK project
npx aws-cdk@latest init app --language=typescript

# Install additional dependencies
npm install @aws-cdk/aws-ec2 @aws-cdk/aws-ecs @aws-cdk/aws-rds @aws-cdk/aws-elasticloadbalancingv2
npm install @aws-cdk/aws-s3 @aws-cdk/aws-cloudwatch @aws-cdk/aws-logs @aws-cdk/aws-secretsmanager
npm install --save-dev @types/jest jest ts-jest
```

#### Step 2: Environment Configuration
```typescript
// src/config/constants.ts
export const COMPLIANCE_ENGINE_CONSTANTS = {
  // Database
  DATABASE_NAME: 'compliance_engine',
  DATABASE_PORT: 5432,
  
  // API
  API_PORT: 8000,
  HEALTH_CHECK_PATH: '/health',
  
  // Security
  MIN_TLS_VERSION: '1.2',
  ENCRYPTION_AT_REST: true,
  
  // Monitoring
  LOG_RETENTION_DAYS: 30,
  ALARM_EVALUATION_PERIODS: 2,
  
  // Auto Scaling
  MIN_CAPACITY: 1,
  MAX_CAPACITY: 20,
  TARGET_CPU_UTILIZATION: 70,
  
  // Networking
  VPC_CIDR: '10.0.0.0/16',
  MAX_AZS: 3
} as const
```

```typescript
// src/config/environments.ts
export interface EnvironmentConfig {
  readonly name: string
  readonly account: string
  readonly region: string
  readonly domainName: string
  readonly isTransient: boolean
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
  readonly performanceInsights: boolean
}

interface ComputeConfig {
  readonly cpu: number
  readonly memory: number
  readonly minCapacity: number
  readonly maxCapacity: number
  readonly desiredCapacity: number
}

interface MonitoringConfig {
  readonly enableDetailedMonitoring: boolean
  readonly alertEmail: string
  readonly logLevel: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG'
}

export const ENVIRONMENT_CONFIGS: Record<string, EnvironmentConfig> = {
  dev: {
    name: 'dev',
    account: process.env.AWS_DEV_ACCOUNT_ID || '123456789012',
    region: 'us-east-1',
    domainName: 'dev.compliance-engine.com',
    isTransient: true,
    database: {
      instanceType: 't3.micro',
      allocatedStorage: 20,
      backupRetention: 1,
      multiAz: false,
      deletionProtection: false,
      performanceInsights: false
    },
    compute: {
      cpu: 256,
      memory: 512,
      minCapacity: 1,
      maxCapacity: 3,
      desiredCapacity: 1
    },
    monitoring: {
      enableDetailedMonitoring: false,
      alertEmail: 'dev-alerts@compliance-engine.com',
      logLevel: 'DEBUG'
    }
  },
  
  qa: {
    name: 'qa',
    account: process.env.AWS_QA_ACCOUNT_ID || '123456789012',
    region: 'us-east-1', 
    domainName: 'qa.compliance-engine.com',
    isTransient: true,
    database: {
      instanceType: 't3.small',
      allocatedStorage: 50,
      backupRetention: 3,
      multiAz: false,
      deletionProtection: false,
      performanceInsights: true
    },
    compute: {
      cpu: 512,
      memory: 1024,
      minCapacity: 1,
      maxCapacity: 5,
      desiredCapacity: 2
    },
    monitoring: {
      enableDetailedMonitoring: true,
      alertEmail: 'qa-alerts@compliance-engine.com',
      logLevel: 'INFO'
    }
  },
  
  production: {
    name: 'production',
    account: process.env.AWS_PROD_ACCOUNT_ID || '987654321098',
    region: 'us-east-1',
    domainName: 'compliance-engine.com',
    isTransient: false,
    database: {
      instanceType: 't3.medium',
      allocatedStorage: 100,
      backupRetention: 30,
      multiAz: true,
      deletionProtection: true,
      performanceInsights: true
    },
    compute: {
      cpu: 1024,
      memory: 2048,
      minCapacity: 2,
      maxCapacity: 20,
      desiredCapacity: 3
    },
    monitoring: {
      enableDetailedMonitoring: true,
      alertEmail: 'alerts@compliance-engine.com',
      logLevel: 'WARN'
    }
  }
}

export function getEnvironmentConfig(environmentName: string): EnvironmentConfig {
  const config = ENVIRONMENT_CONFIGS[environmentName]
  if (!config) {
    throw new Error(`Unknown environment: ${environmentName}. Available: ${Object.keys(ENVIRONMENT_CONFIGS).join(', ')}`)
  }
  return config
}
```

#### Step 3: Core CDK Application
```typescript
// src/app.ts
#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { NetworkStack } from './stacks/network-stack'
import { DatabaseStack } from './stacks/database-stack'
import { ComputeStack } from './stacks/compute-stack'
import { ApiStack } from './stacks/api-stack'
import { StorageStack } from './stacks/storage-stack'
import { MonitoringStack } from './stacks/monitoring-stack'
import { getEnvironmentConfig } from './config/environments'

const app = new cdk.App()

// Get environment from context
const environmentName = app.node.tryGetContext('environment') || 'dev'
const config = getEnvironmentConfig(environmentName)

// Environment for AWS CDK
const env = {
  account: config.account,
  region: config.region
}

// Stack naming convention
const stackPrefix = `ComplianceEngine-${config.name}`

// Core infrastructure stacks
const networkStack = new NetworkStack(app, `${stackPrefix}-Network`, {
  env,
  config,
  description: `Network infrastructure for Compliance Engine ${config.name} environment`
})

const storageStack = new StorageStack(app, `${stackPrefix}-Storage`, {
  env,
  config,
  vpc: networkStack.vpc,
  description: `Storage infrastructure for Compliance Engine ${config.name} environment`
})

const databaseStack = new DatabaseStack(app, `${stackPrefix}-Database`, {
  env,
  config,
  vpc: networkStack.vpc,
  description: `Database infrastructure for Compliance Engine ${config.name} environment`
})

const computeStack = new ComputeStack(app, `${stackPrefix}-Compute`, {
  env,
  config,
  vpc: networkStack.vpc,
  database: databaseStack.database,
  databaseCredentials: databaseStack.credentials,
  documentBucket: storageStack.documentBucket,
  description: `Compute infrastructure for Compliance Engine ${config.name} environment`
})

const apiStack = new ApiStack(app, `${stackPrefix}-API`, {
  env,
  config,
  vpc: networkStack.vpc,
  ecsService: computeStack.apiService,
  description: `API infrastructure for Compliance Engine ${config.name} environment`
})

const monitoringStack = new MonitoringStack(app, `${stackPrefix}-Monitoring`, {
  env,
  config,
  database: databaseStack.database,
  ecsService: computeStack.apiService,
  loadBalancer: apiStack.loadBalancer,
  description: `Monitoring infrastructure for Compliance Engine ${config.name} environment`
})

// Add tags to all resources
const commonTags = {
  Project: 'ComplianceEngine',
  Environment: config.name,
  ManagedBy: 'CDK',
  CostCenter: 'Engineering'
}

Object.entries(commonTags).forEach(([key, value]) => {
  cdk.Tags.of(app).add(key, value)
})

// Environment-specific tags
if (config.isTransient) {
  cdk.Tags.of(app).add('Transient', 'true')
  cdk.Tags.of(app).add('AutoDestroy', 'true')
}
```

#### Step 4: Network Stack Implementation
```typescript
// src/stacks/network-stack.ts
import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import { Construct } from 'constructs'
import { EnvironmentConfig } from '../config/environments'
import { COMPLIANCE_ENGINE_CONSTANTS } from '../config/constants'

export interface NetworkStackProps extends cdk.StackProps {
  readonly config: EnvironmentConfig
}

export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc
  public readonly ecsSecurityGroup: ec2.SecurityGroup
  public readonly databaseSecurityGroup: ec2.SecurityGroup
  public readonly albSecurityGroup: ec2.SecurityGroup

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props)

    const { config } = props

    // VPC with public and private subnets across multiple AZs
    this.vpc = new ec2.Vpc(this, 'ComplianceVPC', {
      ipAddresses: ec2.IpAddresses.cidr(COMPLIANCE_ENGINE_CONSTANTS.VPC_CIDR),
      maxAzs: COMPLIANCE_ENGINE_CONSTANTS.MAX_AZS,
      enableDnsHostnames: true,
      enableDnsSupport: true,
      
      // Cost optimization for transient environments
      natGateways: config.isTransient ? 1 : 2,
      
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
          mapPublicIpOnLaunch: false // Security best practice
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24
        },
        {
          name: 'Database',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24
        }
      ]
    })

    // Security group for ALB
    this.albSecurityGroup = new ec2.SecurityGroup(this, 'ALBSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for Application Load Balancer',
      allowAllOutbound: false
    })

    // Allow HTTPS inbound traffic
    this.albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS traffic from internet'
    )

    // Allow HTTP for health checks and redirects
    this.albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP traffic for redirects'
    )

    // Security group for ECS tasks
    this.ecsSecurityGroup = new ec2.SecurityGroup(this, 'ECSSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for ECS Fargate tasks',
      allowAllOutbound: true // Allow outbound for API calls and updates
    })

    // Allow traffic from ALB to ECS
    this.ecsSecurityGroup.addIngressRule(
      this.albSecurityGroup,
      ec2.Port.tcp(COMPLIANCE_ENGINE_CONSTANTS.API_PORT),
      'Allow traffic from ALB'
    )

    // Security group for database
    this.databaseSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for PostgreSQL database',
      allowAllOutbound: false
    })

    // Allow database access from ECS
    this.databaseSecurityGroup.addIngressRule(
      this.ecsSecurityGroup,
      ec2.Port.tcp(COMPLIANCE_ENGINE_CONSTANTS.DATABASE_PORT),
      'Allow database access from ECS'
    )

    // VPC Endpoints for cost optimization (avoid NAT gateway charges)
    this.addVpcEndpoints()

    // Outputs for cross-stack references
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'VPC ID',
      exportName: `${config.name}-vpc-id`
    })

    new cdk.CfnOutput(this, 'PrivateSubnetIds', {
      value: this.vpc.privateSubnets.map(subnet => subnet.subnetId).join(','),
      description: 'Private subnet IDs',
      exportName: `${config.name}-private-subnet-ids`
    })
  }

  private addVpcEndpoints(): void {
    // S3 Gateway endpoint (free)
    this.vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
      subnets: [{ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }]
    })

    // Interface endpoints for common services (cost-optimized)
    const interfaceEndpoints = [
      'secretsmanager',
      'ecr.dkr',
      'ecr.api',
      'logs'
    ]

    interfaceEndpoints.forEach(serviceName => {
      this.vpc.addInterfaceEndpoint(`${serviceName}Endpoint`, {
        service: ec2.InterfaceVpcEndpointAwsService.lookup(serviceName),
        subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        privateDnsEnabled: true
      })
    })
  }
}
```

## Next Implementation Steps

### Immediate Next Actions (This Session)
1. ✅ Create project structure and base configuration
2. ✅ Implement NetworkStack with security groups
3. 🔄 Implement DatabaseStack with RDS PostgreSQL
4. 🔄 Implement StorageStack with S3 buckets
5. ⏳ Create package.json with deployment scripts

### Subsequent Sessions
1. Implement ComputeStack (ECS Fargate)
2. Implement ApiStack (ALB with SSL)
3. Implement MonitoringStack (CloudWatch)
4. Add CDK unit tests
5. Create deployment pipeline integration

### Key Design Decisions Made

**Security First**:
- All security groups follow least privilege principle
- Database in isolated subnets
- VPC endpoints to reduce attack surface
- No direct internet access for containers

**Cost Optimization**:
- Single NAT gateway for transient environments
- VPC endpoints to avoid NAT charges
- Right-sized instances per environment
- Transient environment auto-cleanup

**DRY Principles Applied**:
- Shared constants file prevents magic numbers
- Environment configs eliminate duplication
- Reusable security group patterns
- Common tagging strategy

This foundation provides enterprise-grade security and scalability while keeping costs minimal for development environments.