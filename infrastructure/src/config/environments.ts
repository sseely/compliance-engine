/**
 * Environment-specific configuration for Compliance Engine infrastructure
 */

export interface EnvironmentConfig {
  readonly name: string
  readonly account: string
  readonly region: string
  readonly domainName: string
  readonly isTransient: boolean
  readonly database: DatabaseConfig
  readonly compute: ComputeConfig
  readonly monitoring: MonitoringConfig
  readonly networking: NetworkingConfig
  readonly storage: StorageConfig
}

export interface DatabaseConfig {
  readonly instanceType: string
  readonly allocatedStorage: number
  readonly maxAllocatedStorage: number
  readonly backupRetention: number
  readonly multiAz: boolean
  readonly deletionProtection: boolean
  readonly performanceInsights: boolean
  readonly performanceInsightsRetention: number
  readonly enableCloudwatchLogsExports: string[]
}

export interface ComputeConfig {
  readonly cpu: number
  readonly memory: number
  readonly minCapacity: number
  readonly maxCapacity: number
  readonly desiredCapacity: number
  readonly enableExecuteCommand: boolean
}

export interface MonitoringConfig {
  readonly enableDetailedMonitoring: boolean
  readonly alertEmail: string
  readonly logLevel: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG'
  readonly logRetentionDays: number
  readonly enableContainerInsights: boolean
}

export interface NetworkingConfig {
  readonly natGateways: number
  readonly enableVpcFlowLogs: boolean
  readonly enableDnsHostnames: boolean
  readonly enableDnsSupport: boolean
}

export interface StorageConfig {
  readonly enableVersioning: boolean
  readonly enableEncryption: boolean
  readonly transitionToIa: number  // Days
  readonly transitionToGlacier: number  // Days
  readonly expirationDays: number
}

/**
 * Environment configurations
 * Each environment has specific resource sizing and feature flags
 */
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
      maxAllocatedStorage: 50,
      backupRetention: 1,
      multiAz: false,
      deletionProtection: false,
      performanceInsights: false,
      performanceInsightsRetention: 7,
      enableCloudwatchLogsExports: ['postgresql']
    },
    
    compute: {
      cpu: 256,
      memory: 512,
      minCapacity: 1,
      maxCapacity: 3,
      desiredCapacity: 1,
      enableExecuteCommand: true  // For debugging
    },
    
    monitoring: {
      enableDetailedMonitoring: false,
      alertEmail: 'dev-alerts@compliance-engine.com',
      logLevel: 'DEBUG',
      logRetentionDays: 7,
      enableContainerInsights: false
    },
    
    networking: {
      natGateways: 1,  // Cost optimization
      enableVpcFlowLogs: false,
      enableDnsHostnames: true,
      enableDnsSupport: true
    },
    
    storage: {
      enableVersioning: false,
      enableEncryption: true,
      transitionToIa: 30,
      transitionToGlacier: 90,
      expirationDays: 365
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
      maxAllocatedStorage: 100,
      backupRetention: 3,
      multiAz: false,
      deletionProtection: false,
      performanceInsights: true,
      performanceInsightsRetention: 7,
      enableCloudwatchLogsExports: ['postgresql', 'upgrade']
    },
    
    compute: {
      cpu: 512,
      memory: 1024,
      minCapacity: 1,
      maxCapacity: 5,
      desiredCapacity: 2,
      enableExecuteCommand: true
    },
    
    monitoring: {
      enableDetailedMonitoring: true,
      alertEmail: 'qa-alerts@compliance-engine.com',
      logLevel: 'INFO',
      logRetentionDays: 14,
      enableContainerInsights: true
    },
    
    networking: {
      natGateways: 1,  // Cost optimization for transient environment
      enableVpcFlowLogs: true,
      enableDnsHostnames: true,
      enableDnsSupport: true
    },
    
    storage: {
      enableVersioning: true,
      enableEncryption: true,
      transitionToIa: 30,
      transitionToGlacier: 90,
      expirationDays: 365
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
      maxAllocatedStorage: 500,
      backupRetention: 30,
      multiAz: true,  // High availability
      deletionProtection: true,
      performanceInsights: true,
      performanceInsightsRetention: 31,  // Longer retention for production
      enableCloudwatchLogsExports: ['postgresql', 'upgrade']
    },
    
    compute: {
      cpu: 1024,
      memory: 2048,
      minCapacity: 2,  // Always have redundancy
      maxCapacity: 20,
      desiredCapacity: 3,
      enableExecuteCommand: false  // Security best practice for production
    },
    
    monitoring: {
      enableDetailedMonitoring: true,
      alertEmail: 'alerts@compliance-engine.com',
      logLevel: 'WARN',
      logRetentionDays: 90,  // Longer retention for compliance
      enableContainerInsights: true
    },
    
    networking: {
      natGateways: 2,  // High availability
      enableVpcFlowLogs: true,
      enableDnsHostnames: true,
      enableDnsSupport: true
    },
    
    storage: {
      enableVersioning: true,
      enableEncryption: true,
      transitionToIa: 30,
      transitionToGlacier: 90,
      expirationDays: 2555  // 7 years for compliance
    }
  }
}

/**
 * Get environment configuration with validation
 */
export function getEnvironmentConfig(environmentName: string): EnvironmentConfig {
  const config = ENVIRONMENT_CONFIGS[environmentName]
  if (!config) {
    throw new Error(
      `Unknown environment: ${environmentName}. Available environments: ${Object.keys(ENVIRONMENT_CONFIGS).join(', ')}`
    )
  }
  
  // Validate required environment variables for production
  if (environmentName === 'production') {
    if (!process.env.AWS_PROD_ACCOUNT_ID) {
      throw new Error('AWS_PROD_ACCOUNT_ID environment variable is required for production deployment')
    }
  }
  
  return config
}

/**
 * Get all available environment names
 */
export function getAvailableEnvironments(): string[] {
  return Object.keys(ENVIRONMENT_CONFIGS)
}

/**
 * Check if environment is transient (auto-destroyed)
 */
export function isTransientEnvironment(environmentName: string): boolean {
  const config = getEnvironmentConfig(environmentName)
  return config.isTransient
}

/**
 * Get environment-specific resource naming
 */
export function getResourceName(baseName: string, environmentName: string): string {
  return `${baseName}-${environmentName}`
}

/**
 * Get common tags for all resources in an environment
 */
export function getCommonTags(config: EnvironmentConfig): Record<string, string> {
  const tags: Record<string, string> = {
    Project: 'ComplianceEngine',
    Environment: config.name,
    ManagedBy: 'CDK',
    CostCenter: 'Engineering'
  }
  
  // Add transient tag for cost tracking
  if (config.isTransient) {
    tags.Transient = 'true'
    tags.AutoDestroy = 'true'
  }
  
  return tags
}