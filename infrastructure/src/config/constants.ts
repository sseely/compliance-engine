/**
 * Shared constants for Compliance Engine infrastructure
 * Follows DRY principle - define once, use everywhere
 */

export const COMPLIANCE_ENGINE_CONSTANTS = {
  // Database Configuration
  DATABASE_NAME: 'compliance_engine',
  DATABASE_PORT: 5432,
  DATABASE_BACKUP_WINDOW: '02:00-03:00',
  DATABASE_MAINTENANCE_WINDOW: 'sun:03:00-sun:04:00',
  
  // API Configuration  
  API_PORT: 8000,
  API_PREFIX: '/api/v1',
  HEALTH_CHECK_PATH: '/health',
  HEALTH_CHECK_LIVE_PATH: '/health/live',
  HEALTH_CHECK_READY_PATH: '/health/ready', 
  HEALTH_CHECK_DEEP_PATH: '/health/deep',
  HEALTH_CHECK_INTERVAL_SECONDS: 30,
  HEALTH_CHECK_TIMEOUT_SECONDS: 5,
  HEALTH_CHECK_HEALTHY_THRESHOLD: 2,
  HEALTH_CHECK_UNHEALTHY_THRESHOLD: 3,
  
  // Security Configuration
  MIN_TLS_VERSION: '1.2',
  ENCRYPTION_AT_REST_ENABLED: true,
  ENCRYPTION_IN_TRANSIT_ENABLED: true,
  
  // Monitoring Configuration
  LOG_RETENTION_DAYS: 30,
  ALARM_EVALUATION_PERIODS: 2,
  ALARM_DATAPOINTS_TO_ALARM: 2,
  
  // Auto Scaling Configuration
  DEFAULT_MIN_CAPACITY: 1,
  DEFAULT_MAX_CAPACITY: 20,
  TARGET_CPU_UTILIZATION_PERCENT: 70,
  TARGET_MEMORY_UTILIZATION_PERCENT: 80,
  SCALE_IN_COOLDOWN_SECONDS: 300,  // 5 minutes
  SCALE_OUT_COOLDOWN_SECONDS: 120, // 2 minutes
  
  // Networking Configuration
  VPC_CIDR: '10.0.0.0/16',
  MAX_AVAILABILITY_ZONES: 3,
  PUBLIC_SUBNET_CIDR_MASK: 24,
  PRIVATE_SUBNET_CIDR_MASK: 24,
  DATABASE_SUBNET_CIDR_MASK: 24,
  
  // Load Balancer Configuration
  ALB_IDLE_TIMEOUT_SECONDS: 60,
  ALB_DELETION_PROTECTION_ENABLED: true, // Will be overridden for transient environments
  ALB_DEREGISTRATION_DELAY_SECONDS: 300, // 5 minutes for graceful shutdown
  
  // Container Configuration
  CONTAINER_CPU_UNITS: {
    SMALL: 256,
    MEDIUM: 512, 
    LARGE: 1024,
    XLARGE: 2048
  },
  
  CONTAINER_MEMORY_MB: {
    SMALL: 512,
    MEDIUM: 1024,
    LARGE: 2048,
    XLARGE: 4096
  },
  
  // S3 Configuration
  S3_VERSIONING_ENABLED: true,
  S3_ENCRYPTION_ENABLED: true,
  S3_BLOCK_PUBLIC_ACCESS: true,
  
  // CloudWatch Configuration
  CLOUDWATCH_DETAILED_MONITORING_ENABLED: false, // Will be overridden per environment
  
  // Cost Optimization
  NAT_GATEWAY_COUNT: {
    TRANSIENT: 1,    // Single NAT for dev/qa
    PERSISTENT: 2    // HA NAT for production
  },
  
  // Compliance and Audit
  ENABLE_ACCESS_LOGGING: true,
  ENABLE_VPC_FLOW_LOGS: true,
  ENABLE_CLOUDTRAIL: true,
  
  // Performance
  RDS_PERFORMANCE_INSIGHTS_RETENTION_DAYS: 7,
  
  // Zero Downtime Deployment Configuration
  DEPLOYMENT_MIN_HEALTHY_PERCENT: 100,
  DEPLOYMENT_MAX_HEALTHY_PERCENT: 200,
  DEPLOYMENT_CIRCUIT_BREAKER_ENABLED: true,
  DEPLOYMENT_TIMEOUT_MINUTES: 15,
  
  // Backup and Recovery
  RDS_BACKUP_RETENTION_DAYS: {
    MINIMUM: 1,
    DEVELOPMENT: 7,
    PRODUCTION: 30
  },
  
  // Tags
  REQUIRED_TAGS: {
    PROJECT: 'ComplianceEngine',
    MANAGED_BY: 'CDK',
    COST_CENTER: 'Engineering'
  }
} as const

/**
 * Environment-specific overrides for constants
 */
export const ENVIRONMENT_OVERRIDES = {
  dev: {
    ALB_DELETION_PROTECTION_ENABLED: false,
    RDS_DELETION_PROTECTION_ENABLED: false,
    RDS_MULTI_AZ_ENABLED: false,
    CLOUDWATCH_DETAILED_MONITORING_ENABLED: false,
    NAT_GATEWAY_COUNT: COMPLIANCE_ENGINE_CONSTANTS.NAT_GATEWAY_COUNT.TRANSIENT
  },
  
  qa: {
    ALB_DELETION_PROTECTION_ENABLED: false,
    RDS_DELETION_PROTECTION_ENABLED: false, 
    RDS_MULTI_AZ_ENABLED: false,
    CLOUDWATCH_DETAILED_MONITORING_ENABLED: true,
    NAT_GATEWAY_COUNT: COMPLIANCE_ENGINE_CONSTANTS.NAT_GATEWAY_COUNT.TRANSIENT
  },
  
  production: {
    ALB_DELETION_PROTECTION_ENABLED: true,
    RDS_DELETION_PROTECTION_ENABLED: true,
    RDS_MULTI_AZ_ENABLED: true,
    CLOUDWATCH_DETAILED_MONITORING_ENABLED: true,
    NAT_GATEWAY_COUNT: COMPLIANCE_ENGINE_CONSTANTS.NAT_GATEWAY_COUNT.PERSISTENT
  }
} as const

/**
 * Get environment-specific constant value
 */
export function getEnvironmentConstant<T>(
  constantName: keyof typeof ENVIRONMENT_OVERRIDES.dev,
  environment: keyof typeof ENVIRONMENT_OVERRIDES
): T {
  const override = ENVIRONMENT_OVERRIDES[environment]
  if (!override) {
    throw new Error(`Unknown environment: ${environment}`)
  }
  
  return override[constantName] as T
}