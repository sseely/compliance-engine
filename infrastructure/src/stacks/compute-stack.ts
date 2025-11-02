/**
 * Compute infrastructure stack for Compliance Engine
 * Creates ECS Fargate cluster, services, load balancer, and auto-scaling
 */

import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as rds from 'aws-cdk-lib/aws-rds'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager'
import * as route53 from 'aws-cdk-lib/aws-route53'
import * as route53targets from 'aws-cdk-lib/aws-route53-targets'
import { Construct } from 'constructs'
import { EnvironmentConfig } from '../config/environments'
import { COMPLIANCE_ENGINE_CONSTANTS } from '../config/constants'

export interface ComputeStackProps extends cdk.StackProps {
  config: EnvironmentConfig
  vpc: ec2.Vpc
  database: rds.DatabaseInstance
}

export class ComputeStack extends cdk.Stack {
  public readonly cluster: ecs.Cluster
  public readonly service: ecs.FargateService
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer
  public readonly taskDefinition: ecs.FargateTaskDefinition

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props)

    const { config, vpc, database } = props

    // Create ECS cluster
    this.cluster = new ecs.Cluster(this, 'EcsCluster', {
      clusterName: `compliance-engine-${config.name}`,
      vpc,
      containerInsights: config.monitoring.enableContainerInsights
    })

    // Create Application Load Balancer
    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'ApplicationLoadBalancer', {
      loadBalancerName: `compliance-engine-alb-${config.name}`,
      vpc,
      internetFacing: true,
      securityGroup: this.getAlbSecurityGroup(vpc, config),
      idleTimeout: cdk.Duration.seconds(COMPLIANCE_ENGINE_CONSTANTS.ALB_IDLE_TIMEOUT_SECONDS),
      deletionProtection: !config.isTransient
    })

    // Create SSL certificate for HTTPS
    const certificate = this.createSslCertificate(config)

    // Create task definition
    this.taskDefinition = this.createTaskDefinition(config, database)

    // Create Fargate service
    this.service = this.createFargateService(config, vpc)

    // Configure load balancer listeners and target groups
    this.configureLoadBalancer(certificate, config)

    // Set up auto-scaling
    this.setupAutoScaling(config)

    // Configure DNS
    this.configureDns(config)

    // Outputs
    this.createOutputs(config)
  }

  private getAlbSecurityGroup(vpc: ec2.Vpc, config: EnvironmentConfig): ec2.SecurityGroup {
    return ec2.SecurityGroup.fromSecurityGroupId(
      this,
      'ImportedAlbSecurityGroup',
      cdk.Fn.importValue(`ComplianceEngine-${config.name}-AlbSecurityGroupId`)
    )
  }

  private createSslCertificate(config: EnvironmentConfig): certificatemanager.Certificate {
    // Create or import SSL certificate for the domain
    return new certificatemanager.Certificate(this, 'SslCertificate', {
      domainName: config.domainName,
      subjectAlternativeNames: [`*.${config.domainName}`],
      validation: certificatemanager.CertificateValidation.fromDns()
    })
  }

  private createTaskDefinition(config: EnvironmentConfig, database: rds.DatabaseInstance): ecs.FargateTaskDefinition {
    // Create task execution role
    const executionRole = new iam.Role(this, 'TaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')
      ]
    })

    // Grant access to Secrets Manager
    database.secret?.grantRead(executionRole)

    // Create task role for application permissions
    const taskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      inlinePolicies: {
        ComplianceEngineTaskPolicy: new iam.PolicyDocument({
          statements: [
            // S3 permissions for document storage
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject'
              ],
              resources: [`arn:aws:s3:::compliance-documents-${config.name}/*`]
            }),
            // CloudWatch permissions for custom metrics
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'cloudwatch:PutMetricData'
              ],
              resources: ['*']
            }),
            // SQS permissions for background jobs
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'sqs:SendMessage',
                'sqs:ReceiveMessage',
                'sqs:DeleteMessage'
              ],
              resources: [`arn:aws:sqs:${config.region}:${config.account}:compliance-jobs-${config.name}`]
            })
          ]
        })
      }
    })

    // Create task definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDefinition', {
      family: `compliance-engine-${config.name}`,
      cpu: config.compute.cpu,
      memoryLimitMiB: config.compute.memory,
      executionRole,
      taskRole
    })

    // Create log group
    const logGroup = new logs.LogGroup(this, 'ApiLogGroup', {
      logGroupName: `/ecs/compliance-engine-${config.name}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: config.isTransient ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN
    })

    // Add container to task definition
    const container = taskDefinition.addContainer('ApiContainer', {
      containerName: 'compliance-engine-api',
      image: ecs.ContainerImage.fromRegistry('compliance-engine/api:latest'), // Will be updated by CI/CD
      
      // Environment variables
      environment: {
        ENVIRONMENT: config.name,
        AWS_REGION: config.region,
        LOG_LEVEL: config.monitoring.logLevel,
        API_PREFIX: COMPLIANCE_ENGINE_CONSTANTS.API_PREFIX
      },
      
      // Secrets from Secrets Manager
      secrets: {
        DATABASE_URL: ecs.Secret.fromSecretsManager(database.secret!, 'url')
      },
      
      // Logging
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'compliance-engine-api',
        logGroup
      }),
      
      // Health check - liveness probe for container restart
      healthCheck: {
        command: [
          'CMD-SHELL',
          `curl -f http://localhost:${COMPLIANCE_ENGINE_CONSTANTS.API_PORT}/health/live || exit 1`
        ],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(90) // Give more time for database migrations
      }
    })

    // Expose the API port
    container.addPortMappings({
      containerPort: COMPLIANCE_ENGINE_CONSTANTS.API_PORT,
      protocol: ecs.Protocol.TCP
    })

    return taskDefinition
  }

  private createFargateService(config: EnvironmentConfig, vpc: ec2.Vpc): ecs.FargateService {
    const service = new ecs.FargateService(this, 'FargateService', {
      serviceName: `compliance-engine-${config.name}`,
      cluster: this.cluster,
      taskDefinition: this.taskDefinition,
      
      // Capacity configuration
      desiredCount: config.compute.desiredCapacity,
      
      // Zero downtime deployment configuration
      minHealthyPercent: 100,  // Always keep 100% capacity during deployments
      maxHealthyPercent: 200,  // Allow double capacity during rolling updates
      
      // Deployment configuration for zero downtime
      deploymentConfiguration: {
        minimumHealthyPercent: 100,
        maximumPercent: 200,
        deploymentCircuitBreaker: {
          enable: true,
          rollback: true
        }
      },
      
      // Network configuration
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
      },
      securityGroups: [this.getEcsSecurityGroup(vpc, config)],
      
      // Deployment configuration
      enableExecuteCommand: config.compute.enableExecuteCommand,
      
      // Platform version
      platformVersion: ecs.FargatePlatformVersion.LATEST
    })

    return service
  }

  private getEcsSecurityGroup(vpc: ec2.Vpc, config: EnvironmentConfig): ec2.SecurityGroup {
    return ec2.SecurityGroup.fromSecurityGroupId(
      this,
      'ImportedEcsSecurityGroup',
      cdk.Fn.importValue(`ComplianceEngine-${config.name}-EcsSecurityGroupId`)
    )
  }

  private configureLoadBalancer(certificate: certificatemanager.Certificate, config: EnvironmentConfig): void {
    // Create target group
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'ApiTargetGroup', {
      targetGroupName: `compliance-api-${config.name}`,
      port: COMPLIANCE_ENGINE_CONSTANTS.API_PORT,
      protocol: elbv2.ApplicationProtocol.HTTP,
      vpc: this.cluster.vpc,
      targetType: elbv2.TargetType.IP,
      
      // Zero downtime deployment configuration
      deregistrationDelay: cdk.Duration.seconds(COMPLIANCE_ENGINE_CONSTANTS.ALB_DEREGISTRATION_DELAY_SECONDS),
      
      // Health check configuration for zero downtime
      healthCheck: {
        enabled: true,
        path: '/health/ready', // Use readiness probe for load balancer
        protocol: elbv2.Protocol.HTTP,
        port: COMPLIANCE_ENGINE_CONSTANTS.API_PORT.toString(),
        healthyThresholdCount: 3,  // More strict for zero downtime
        unhealthyThresholdCount: 2, // Faster unhealthy detection
        timeout: cdk.Duration.seconds(10), // Longer timeout for startup
        interval: cdk.Duration.seconds(15), // More frequent checks
        healthyHttpCodes: '200',
        matcher: elbv2.HealthCheckMatcher.httpCodeMatcher('200')
      }
    })

    // Attach service to target group
    this.service.attachToApplicationTargetGroup(targetGroup)

    // HTTPS listener
    this.loadBalancer.addListener('HttpsListener', {
      port: 443,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      certificates: [certificate],
      sslPolicy: elbv2.SslPolicy.TLS12_EXT,
      defaultAction: elbv2.ListenerAction.forward([targetGroup])
    })

    // HTTP listener (redirect to HTTPS)
    this.loadBalancer.addListener('HttpListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: elbv2.ListenerAction.redirect({
        protocol: 'HTTPS',
        port: '443',
        permanent: true
      })
    })
  }

  private setupAutoScaling(config: EnvironmentConfig): void {
    const scaling = this.service.autoScaleTaskCount({
      minCapacity: config.compute.minCapacity,
      maxCapacity: config.compute.maxCapacity
    })

    // CPU-based scaling
    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: COMPLIANCE_ENGINE_CONSTANTS.TARGET_CPU_UTILIZATION_PERCENT,
      scaleInCooldown: cdk.Duration.seconds(COMPLIANCE_ENGINE_CONSTANTS.SCALE_IN_COOLDOWN_SECONDS),
      scaleOutCooldown: cdk.Duration.seconds(COMPLIANCE_ENGINE_CONSTANTS.SCALE_OUT_COOLDOWN_SECONDS)
    })

    // Memory-based scaling
    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: COMPLIANCE_ENGINE_CONSTANTS.TARGET_MEMORY_UTILIZATION_PERCENT,
      scaleInCooldown: cdk.Duration.seconds(COMPLIANCE_ENGINE_CONSTANTS.SCALE_IN_COOLDOWN_SECONDS),
      scaleOutCooldown: cdk.Duration.seconds(COMPLIANCE_ENGINE_CONSTANTS.SCALE_OUT_COOLDOWN_SECONDS)
    })
  }

  private configureDns(config: EnvironmentConfig): void {
    // Note: This assumes Route53 hosted zone exists
    // In production, you'd import the existing hosted zone
    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: config.domainName.split('.').slice(-2).join('.')
    })

    // Create A record pointing to the load balancer
    new route53.ARecord(this, 'AliasRecord', {
      zone: hostedZone,
      recordName: config.domainName,
      target: route53.RecordTarget.fromAlias(new route53targets.LoadBalancerTarget(this.loadBalancer))
    })
  }

  private createOutputs(config: EnvironmentConfig): void {
    new cdk.CfnOutput(this, 'LoadBalancerDnsName', {
      value: this.loadBalancer.loadBalancerDnsName,
      description: 'Load Balancer DNS name',
      exportName: `ComplianceEngine-${config.name}-LoadBalancerDnsName`
    })

    new cdk.CfnOutput(this, 'ClusterName', {
      value: this.cluster.clusterName,
      description: 'ECS Cluster name',
      exportName: `ComplianceEngine-${config.name}-ClusterName`
    })

    new cdk.CfnOutput(this, 'ServiceName', {
      value: this.service.serviceName,
      description: 'ECS Service name',
      exportName: `ComplianceEngine-${config.name}-ServiceName`
    })
  }
}