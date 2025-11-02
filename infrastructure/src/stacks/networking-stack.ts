/**
 * Networking infrastructure stack for Compliance Engine
 * Creates VPC, subnets, NAT gateways, and security groups
 */

import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as logs from 'aws-cdk-lib/aws-logs'
import { Construct } from 'constructs'
import { EnvironmentConfig } from '../config/environments'
import { COMPLIANCE_ENGINE_CONSTANTS } from '../config/constants'

export interface NetworkingStackProps extends cdk.StackProps {
  config: EnvironmentConfig
}

export class NetworkingStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc
  public readonly albSecurityGroup: ec2.SecurityGroup
  public readonly ecsSecurityGroup: ec2.SecurityGroup
  public readonly rdsSecurityGroup: ec2.SecurityGroup

  constructor(scope: Construct, id: string, props: NetworkingStackProps) {
    super(scope, id, props)

    const { config } = props

    // Create VPC with public and private subnets
    this.vpc = new ec2.Vpc(this, 'ComplianceEngineVpc', {
      vpcName: `compliance-engine-vpc-${config.name}`,
      ipAddresses: ec2.IpAddresses.cidr(COMPLIANCE_ENGINE_CONSTANTS.VPC_CIDR),
      maxAzs: COMPLIANCE_ENGINE_CONSTANTS.MAX_AVAILABILITY_ZONES,
      
      subnetConfiguration: [
        {
          cidrMask: COMPLIANCE_ENGINE_CONSTANTS.PUBLIC_SUBNET_CIDR_MASK,
          name: 'PublicSubnet',
          subnetType: ec2.SubnetType.PUBLIC
        },
        {
          cidrMask: COMPLIANCE_ENGINE_CONSTANTS.PRIVATE_SUBNET_CIDR_MASK,
          name: 'PrivateSubnet',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
        },
        {
          cidrMask: COMPLIANCE_ENGINE_CONSTANTS.DATABASE_SUBNET_CIDR_MASK,
          name: 'DatabaseSubnet',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED
        }
      ],

      // NAT gateway configuration based on environment
      natGateways: config.networking.natGateways,
      
      // Enable DNS
      enableDnsHostnames: config.networking.enableDnsHostnames,
      enableDnsSupport: config.networking.enableDnsSupport,

      // Gateway endpoints for cost optimization
      gatewayEndpoints: {
        S3: {
          service: ec2.GatewayVpcEndpointAwsService.S3
        },
        DynamoDB: {
          service: ec2.GatewayVpcEndpointAwsService.DYNAMODB
        }
      }
    })

    // VPC Flow Logs for security monitoring
    if (config.networking.enableVpcFlowLogs) {
      const flowLogGroup = new logs.LogGroup(this, 'VpcFlowLogGroup', {
        logGroupName: `/aws/vpc/flowlogs/${config.name}`,
        retention: logs.RetentionDays.ONE_WEEK,
        removalPolicy: config.isTransient ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN
      })

      new ec2.FlowLog(this, 'VpcFlowLog', {
        resourceType: ec2.FlowLogResourceType.fromVpc(this.vpc),
        destination: ec2.FlowLogDestination.toCloudWatchLogs(flowLogGroup),
        trafficType: ec2.FlowLogTrafficType.ALL
      })
    }

    // Security Groups
    this.createSecurityGroups(config)

    // Add VPC endpoints for AWS services to reduce NAT gateway costs
    this.createVpcEndpoints(config)

    // Tagging
    cdk.Tags.of(this.vpc).add('Name', `compliance-engine-vpc-${config.name}`)
    cdk.Tags.of(this.vpc).add('Environment', config.name)

    // Export security group IDs for other stacks
    new cdk.CfnOutput(this, 'AlbSecurityGroupId', {
      value: this.albSecurityGroup.securityGroupId,
      description: 'ALB Security Group ID',
      exportName: `ComplianceEngine-${config.name}-AlbSecurityGroupId`
    })

    new cdk.CfnOutput(this, 'EcsSecurityGroupId', {
      value: this.ecsSecurityGroup.securityGroupId,
      description: 'ECS Security Group ID',
      exportName: `ComplianceEngine-${config.name}-EcsSecurityGroupId`
    })

    new cdk.CfnOutput(this, 'RdsSecurityGroupId', {
      value: this.rdsSecurityGroup.securityGroupId,
      description: 'RDS Security Group ID',
      exportName: `ComplianceEngine-${config.name}-RdsSecurityGroupId`
    })
  }

  private createSecurityGroups(config: EnvironmentConfig): void {

    // Application Load Balancer Security Group
    this.albSecurityGroup = new ec2.SecurityGroup(this, 'AlbSecurityGroup', {
      vpc: this.vpc,
      securityGroupName: `compliance-alb-sg-${config.name}`,
      description: 'Security group for Application Load Balancer',
      allowAllOutbound: false
    })

    // Allow HTTPS traffic from internet
    this.albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS traffic from internet'
    )

    // Allow HTTP traffic for redirect to HTTPS
    this.albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP traffic for redirect to HTTPS'
    )

    // Allow outbound to ECS on API port
    this.albSecurityGroup.addEgressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(COMPLIANCE_ENGINE_CONSTANTS.API_PORT),
      'Allow outbound traffic to ECS containers'
    )

    // ECS Security Group
    this.ecsSecurityGroup = new ec2.SecurityGroup(this, 'EcsSecurityGroup', {
      vpc: this.vpc,
      securityGroupName: `compliance-ecs-sg-${config.name}`,
      description: 'Security group for ECS containers',
      allowAllOutbound: true // Containers need internet access for external APIs
    })

    // Allow traffic from ALB
    this.ecsSecurityGroup.addIngressRule(
      this.albSecurityGroup,
      ec2.Port.tcp(COMPLIANCE_ENGINE_CONSTANTS.API_PORT),
      'Allow traffic from Application Load Balancer'
    )

    // RDS Security Group
    this.rdsSecurityGroup = new ec2.SecurityGroup(this, 'RdsSecurityGroup', {
      vpc: this.vpc,
      securityGroupName: `compliance-rds-sg-${config.name}`,
      description: 'Security group for RDS PostgreSQL database',
      allowAllOutbound: false
    })

    // Allow PostgreSQL traffic from ECS
    this.rdsSecurityGroup.addIngressRule(
      this.ecsSecurityGroup,
      ec2.Port.tcp(COMPLIANCE_ENGINE_CONSTANTS.DATABASE_PORT),
      'Allow PostgreSQL traffic from ECS containers'
    )
  }

  private createVpcEndpoints(config: EnvironmentConfig): void {

    // Interface endpoints for AWS services to reduce NAT gateway usage
    const endpointSecurityGroup = new ec2.SecurityGroup(this, 'VpcEndpointSecurityGroup', {
      vpc: this.vpc,
      securityGroupName: `compliance-vpc-endpoints-sg-${config.name}`,
      description: 'Security group for VPC endpoints',
      allowAllOutbound: false
    })

    endpointSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.tcp(443),
      'Allow HTTPS from VPC'
    )

    // ECR endpoints for container image pulls
    this.vpc.addInterfaceEndpoint('EcrEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.ECR
    })

    this.vpc.addInterfaceEndpoint('EcrDkrEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER
    })

    // CloudWatch endpoints for logging and monitoring
    this.vpc.addInterfaceEndpoint('CloudWatchLogsEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS
    })

    this.vpc.addInterfaceEndpoint('CloudWatchEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH
    })

    // Secrets Manager endpoint for secure configuration
    this.vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER
    })

    // SQS endpoint for message queues
    this.vpc.addInterfaceEndpoint('SqsEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SQS
    })
  }
}