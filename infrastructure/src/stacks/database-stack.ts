/**
 * Database infrastructure stack for Compliance Engine
 * Creates RDS PostgreSQL instance with backup, monitoring, and security
 */

import * as cdk from 'aws-cdk-lib'
import * as rds from 'aws-cdk-lib/aws-rds'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import * as logs from 'aws-cdk-lib/aws-logs'
import { Construct } from 'constructs'
import { EnvironmentConfig } from '../config/environments'
import { COMPLIANCE_ENGINE_CONSTANTS } from '../config/constants'

export interface DatabaseStackProps extends cdk.StackProps {
  config: EnvironmentConfig
  vpc: ec2.Vpc
}

export class DatabaseStack extends cdk.Stack {
  public readonly database: rds.DatabaseInstance
  public readonly databaseSecret: secretsmanager.Secret
  public readonly subnetGroup: rds.SubnetGroup

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props)

    const { config, vpc } = props

    // Create database credentials secret
    this.databaseSecret = new secretsmanager.Secret(this, 'DatabaseSecret', {
      secretName: `${config.name}/compliance-engine/database`,
      description: `Database credentials for Compliance Engine ${config.name} environment`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'postgres' }),
        generateStringKey: 'password',
        excludeCharacters: '"@/\\'
      }
    })

    // Create subnet group for RDS
    this.subnetGroup = new rds.SubnetGroup(this, 'DatabaseSubnetGroup', {
      subnetGroupName: `compliance-engine-db-subnet-group-${config.name}`,
      description: `Database subnet group for Compliance Engine ${config.name}`,
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED
      }
    })

    // Create parameter group for PostgreSQL optimization
    const parameterGroup = new rds.ParameterGroup(this, 'DatabaseParameterGroup', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15_4
      }),
      description: `PostgreSQL parameter group for Compliance Engine ${config.name}`,
      parameters: {
        // Performance tuning
        'shared_preload_libraries': 'pg_stat_statements',
        'log_statement': 'all',
        'log_duration': 'on',
        'log_min_duration_statement': '1000', // Log slow queries > 1s
        
        // Connection and memory settings
        'max_connections': config.database.instanceType.includes('micro') ? '100' : '200',
        'shared_buffers': config.database.instanceType.includes('micro') ? '128MB' : '256MB',
        
        // Compliance and audit settings
        'log_connections': 'on',
        'log_disconnections': 'on',
        'log_checkpoints': 'on'
      }
    })

    // Create the database instance
    this.database = new rds.DatabaseInstance(this, 'Database', {
      databaseName: COMPLIANCE_ENGINE_CONSTANTS.DATABASE_NAME,
      instanceIdentifier: `compliance-engine-${config.name}`,
      
      // Engine configuration
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15_4
      }),
      instanceType: ec2.InstanceType.of(
        config.database.instanceType.split('.')[0] as ec2.InstanceClass,
        config.database.instanceType.split('.')[1] as ec2.InstanceSize
      ),
      
      // Storage configuration
      allocatedStorage: config.database.allocatedStorage,
      maxAllocatedStorage: config.database.maxAllocatedStorage,
      storageType: rds.StorageType.GP3,
      storageEncrypted: COMPLIANCE_ENGINE_CONSTANTS.ENCRYPTION_AT_REST_ENABLED,
      
      // Network configuration
      vpc,
      subnetGroup: this.subnetGroup,
      securityGroups: [this.getSecurityGroup(vpc, config)],
      port: COMPLIANCE_ENGINE_CONSTANTS.DATABASE_PORT,
      
      // Credentials
      credentials: rds.Credentials.fromSecret(this.databaseSecret),
      
      // Backup configuration
      backupRetention: cdk.Duration.days(config.database.backupRetention),
      preferredBackupWindow: COMPLIANCE_ENGINE_CONSTANTS.DATABASE_BACKUP_WINDOW,
      preferredMaintenanceWindow: COMPLIANCE_ENGINE_CONSTANTS.DATABASE_MAINTENANCE_WINDOW,
      deleteAutomatedBackups: config.isTransient,
      
      // High availability
      multiAz: config.database.multiAz,
      availabilityZone: config.database.multiAz ? undefined : 'us-east-1a',
      
      // Security
      deletionProtection: config.database.deletionProtection,
      
      // Monitoring
      monitoringInterval: config.database.performanceInsights ? cdk.Duration.seconds(60) : undefined,
      enablePerformanceInsights: config.database.performanceInsights,
      performanceInsightRetention: config.database.performanceInsights 
        ? rds.PerformanceInsightRetention.DAYS_7
        : undefined,
      
      // Logging
      cloudwatchLogsExports: config.database.enableCloudwatchLogsExports,
      cloudwatchLogsRetention: logs.RetentionDays.ONE_MONTH,
      
      // Parameter group
      parameterGroup,
      
      // Removal policy
      removalPolicy: config.isTransient ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.SNAPSHOT
    })

    // Enable automated minor version upgrades for security patches
    const cfnDatabase = this.database.node.defaultChild as rds.CfnDBInstance
    cfnDatabase.autoMinorVersionUpgrade = true

    // Create read replica for production
    if (config.name === 'production') {
      new rds.DatabaseInstanceReadReplica(this, 'DatabaseReadReplica', {
        sourceDatabaseInstance: this.database,
        instanceIdentifier: `compliance-engine-${config.name}-replica`,
        instanceType: ec2.InstanceType.of(
          config.database.instanceType.split('.')[0] as ec2.InstanceClass,
          config.database.instanceType.split('.')[1] as ec2.InstanceSize
        ),
        vpc,
        deletionProtection: true,
        publiclyAccessible: false
      })
    }

    // Add alarms for database monitoring
    this.createDatabaseAlarms(config)

    // Outputs
    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: this.database.instanceEndpoint.hostname,
      description: 'Database endpoint hostname',
      exportName: `ComplianceEngine-${config.name}-DatabaseEndpoint`
    })

    new cdk.CfnOutput(this, 'DatabaseSecretArn', {
      value: this.databaseSecret.secretArn,
      description: 'Database credentials secret ARN',
      exportName: `ComplianceEngine-${config.name}-DatabaseSecretArn`
    })
  }

  private getSecurityGroup(vpc: ec2.Vpc, config: EnvironmentConfig): ec2.ISecurityGroup {
    // Import the RDS security group created in NetworkingStack
    return ec2.SecurityGroup.fromSecurityGroupId(
      this,
      'ImportedRdsSecurityGroup',
      cdk.Fn.importValue(`ComplianceEngine-${config.name}-RdsSecurityGroupId`)
    )
  }

  private createDatabaseAlarms(config: EnvironmentConfig): void {
    // CPU utilization alarm
    this.database.metricCPUUtilization().createAlarm(this, 'DatabaseCpuAlarm', {
      alarmName: `compliance-engine-${config.name}-db-cpu-high`,
      alarmDescription: 'Database CPU utilization is high',
      threshold: 80,
      evaluationPeriods: COMPLIANCE_ENGINE_CONSTANTS.ALARM_EVALUATION_PERIODS,
      datapointsToAlarm: COMPLIANCE_ENGINE_CONSTANTS.ALARM_DATAPOINTS_TO_ALARM
    })

    // Database connections alarm
    this.database.metricDatabaseConnections().createAlarm(this, 'DatabaseConnectionsAlarm', {
      alarmName: `compliance-engine-${config.name}-db-connections-high`,
      alarmDescription: 'Database connection count is high',
      threshold: config.database.instanceType.includes('micro') ? 80 : 150,
      evaluationPeriods: COMPLIANCE_ENGINE_CONSTANTS.ALARM_EVALUATION_PERIODS,
      datapointsToAlarm: COMPLIANCE_ENGINE_CONSTANTS.ALARM_DATAPOINTS_TO_ALARM
    })

    // Free storage space alarm
    this.database.metricFreeStorageSpace().createAlarm(this, 'DatabaseStorageAlarm', {
      alarmName: `compliance-engine-${config.name}-db-storage-low`,
      alarmDescription: 'Database free storage space is low',
      threshold: 2 * 1024 * 1024 * 1024, // 2 GB in bytes
      comparisonOperator: cdk.aws_cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      evaluationPeriods: COMPLIANCE_ENGINE_CONSTANTS.ALARM_EVALUATION_PERIODS,
      datapointsToAlarm: COMPLIANCE_ENGINE_CONSTANTS.ALARM_DATAPOINTS_TO_ALARM
    })
  }
}