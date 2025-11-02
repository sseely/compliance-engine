/**
 * Compliance infrastructure stack for SOC 2 and ISO 27001 readiness
 * Creates AWS Config, CloudTrail, GuardDuty, and compliance monitoring
 */

import * as cdk from 'aws-cdk-lib'
import * as config from 'aws-cdk-lib/aws-config'
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail'
import * as guardduty from 'aws-cdk-lib/aws-guardduty'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as kms from 'aws-cdk-lib/aws-kms'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as sns from 'aws-cdk-lib/aws-sns'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as events from 'aws-cdk-lib/aws-events'
import * as eventsTargets from 'aws-cdk-lib/aws-events-targets'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import { Construct } from 'constructs'
import { EnvironmentConfig } from '../config/environments'

export interface ComplianceStackProps extends cdk.StackProps {
  config: EnvironmentConfig
  alertTopic: sns.Topic
}

export class ComplianceStack extends cdk.Stack {
  public readonly cloudTrail: cloudtrail.Trail
  public readonly auditBucket: s3.Bucket

  constructor(scope: Construct, id: string, props: ComplianceStackProps) {
    super(scope, id, props)

    const { config: envConfig, alertTopic } = props

    // Create KMS key for encryption
    const complianceKey = this.createComplianceKmsKey(envConfig)

    // Create audit log bucket
    this.auditBucket = this.createAuditBucket(envConfig, complianceKey)

    // Set up CloudTrail for API auditing
    this.cloudTrail = this.createCloudTrail(envConfig, complianceKey)

    // Set up AWS Config for compliance monitoring
    this.setupAwsConfig(envConfig, complianceKey)

    // Set up GuardDuty for threat detection (production only)
    if (envConfig.name === 'production') {
      this.setupGuardDuty(envConfig, alertTopic)
    }

    // Create compliance rules and monitoring
    this.createComplianceRules(envConfig, alertTopic)

    // Set up automated incident response
    this.setupIncidentResponse(envConfig, alertTopic)

    this.createOutputs(envConfig)
  }

  private createComplianceKmsKey(config: EnvironmentConfig): kms.Key {
    return new kms.Key(this, 'ComplianceKey', {
      alias: `compliance-engine-${config.name}`,
      description: `Compliance encryption key for ${config.name} environment`,
      enableKeyRotation: true,
      keySpec: kms.KeySpec.SYMMETRIC_DEFAULT,
      keyUsage: kms.KeyUsage.ENCRYPT_DECRYPT,
      removalPolicy: config.isTransient ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
      policy: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            sid: 'EnableRootAccess',
            effect: iam.Effect.ALLOW,
            principals: [new iam.AccountRootPrincipal()],
            actions: ['kms:*'],
            resources: ['*']
          }),
          new iam.PolicyStatement({
            sid: 'AllowCloudTrailEncryption',
            effect: iam.Effect.ALLOW,
            principals: [new iam.ServicePrincipal('cloudtrail.amazonaws.com')],
            actions: [
              'kms:GenerateDataKey*',
              'kms:DescribeKey',
              'kms:Encrypt',
              'kms:ReEncrypt*',
              'kms:Decrypt'
            ],
            resources: ['*']
          }),
          new iam.PolicyStatement({
            sid: 'AllowConfigEncryption',
            effect: iam.Effect.ALLOW,
            principals: [new iam.ServicePrincipal('config.amazonaws.com')],
            actions: [
              'kms:GenerateDataKey*',
              'kms:DescribeKey',
              'kms:Encrypt',
              'kms:Decrypt'
            ],
            resources: ['*']
          })
        ]
      })
    })
  }

  private createAuditBucket(config: EnvironmentConfig, kmsKey: kms.Key): s3.Bucket {
    return new s3.Bucket(this, 'AuditBucket', {
      bucketName: `compliance-engine-audit-logs-${config.name}-${config.account}`,
      versioned: true,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: kmsKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      
      // Lifecycle rules for SOC 2 compliance (7 years retention)
      lifecycleRules: [
        {
          id: 'ComplianceRetention',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30)
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90)
            },
            {
              storageClass: s3.StorageClass.DEEP_ARCHIVE,
              transitionAfter: cdk.Duration.days(365)
            }
          ],
          expiration: cdk.Duration.days(2555) // 7 years
        }
      ],
      
      // Enable access logging for the audit bucket itself
      serverAccessLogsBucket: this.createAccessLogBucket(config, kmsKey),
      
      // Notification for unauthorized access attempts
      notificationsHandlerRole: this.createNotificationRole(),
      
      removalPolicy: config.isTransient ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN
    })
  }

  private createAccessLogBucket(config: EnvironmentConfig, kmsKey: kms.Key): s3.Bucket {
    return new s3.Bucket(this, 'AccessLogBucket', {
      bucketName: `compliance-engine-access-logs-${config.name}-${config.account}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: kmsKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      lifecycleRules: [
        {
          id: 'AccessLogRetention',
          enabled: true,
          expiration: cdk.Duration.days(90)
        }
      ],
      removalPolicy: config.isTransient ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN
    })
  }

  private createNotificationRole(): iam.Role {
    return new iam.Role(this, 'BucketNotificationRole', {
      assumedBy: new iam.ServicePrincipal('s3.amazonaws.com'),
      inlinePolicies: {
        NotificationPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'sns:Publish'
              ],
              resources: ['*']
            })
          ]
        })
      }
    })
  }

  private createCloudTrail(config: EnvironmentConfig, kmsKey: kms.Key): cloudtrail.Trail {
    return new cloudtrail.Trail(this, 'ComplianceCloudTrail', {
      trailName: `compliance-engine-${config.name}`,
      bucket: this.auditBucket,
      s3KeyPrefix: 'cloudtrail-logs',
      
      // Encryption
      encryptionKey: kmsKey,
      
      // Event configuration for SOC 2 compliance
      includeGlobalServiceEvents: true,
      isMultiRegionTrail: true,
      enableFileValidation: true,
      
      // Data events for sensitive operations
      dataEvents: [
        {
          resources: [`${this.auditBucket.bucketArn}/*`],
          includeManagementEvents: true,
          readWriteType: cloudtrail.ReadWriteType.ALL
        }
      ],
      
      // Insight events for unusual activity
      insightEvents: [
        cloudtrail.InsightType.API_CALL_RATE
      ],
      
      // CloudWatch integration
      sendToCloudWatchLogs: true,
      cloudWatchLogGroup: this.createCloudTrailLogGroup(config),
      cloudWatchLogsRetention: cdk.aws_logs.RetentionDays.ONE_YEAR
    })
  }

  private createCloudTrailLogGroup(config: EnvironmentConfig): cdk.aws_logs.LogGroup {
    return new cdk.aws_logs.LogGroup(this, 'CloudTrailLogGroup', {
      logGroupName: `/aws/cloudtrail/compliance-engine-${config.name}`,
      retention: cdk.aws_logs.RetentionDays.ONE_YEAR,
      removalPolicy: config.isTransient ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN
    })
  }

  private setupAwsConfig(config: EnvironmentConfig, kmsKey: kms.Key): void {
    // Configuration recorder
    const configRole = new iam.Role(this, 'ConfigRole', {
      assumedBy: new iam.ServicePrincipal('config.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/ConfigRole')
      ]
    })

    new config.CfnConfigurationRecorder(this, 'ConfigRecorder', {
      name: `compliance-engine-${envConfig.name}`,
      roleArn: configRole.roleArn,
      recordingGroup: {
        allSupported: true,
        includeGlobalResourceTypes: true,
        resourceTypes: []
      }
    })

    // Delivery channel
    new config.CfnDeliveryChannel(this, 'ConfigDeliveryChannel', {
      name: `compliance-engine-${envConfig.name}`,
      s3BucketName: this.auditBucket.bucketName,
      s3KeyPrefix: 'config-logs',
      configSnapshotDeliveryProperties: {
        deliveryFrequency: 'TwentyFour_Hours'
      }
    })

    // Compliance rules for SOC 2
    this.createSoc2ComplianceRules()
  }

  private createSoc2ComplianceRules(): void {
    // Encryption at rest rule
    new config.ManagedRule(this, 'EncryptedVolumesRule', {
      identifier: config.ManagedRuleIdentifiers.EC2_EBS_ENCRYPTION_BY_DEFAULT,
      description: 'Checks that Amazon EBS encryption is enabled by default'
    })

    // RDS encryption rule
    new config.ManagedRule(this, 'RdsEncryptionRule', {
      identifier: config.ManagedRuleIdentifiers.RDS_STORAGE_ENCRYPTED,
      description: 'Checks that RDS instances are encrypted'
    })

    // S3 bucket encryption rule
    new config.ManagedRule(this, 'S3EncryptionRule', {
      identifier: config.ManagedRuleIdentifiers.S3_BUCKET_SERVER_SIDE_ENCRYPTION_ENABLED,
      description: 'Checks that S3 buckets have encryption enabled'
    })

    // IAM password policy rule
    new config.ManagedRule(this, 'IamPasswordPolicyRule', {
      identifier: config.ManagedRuleIdentifiers.IAM_PASSWORD_POLICY,
      description: 'Checks the password policy for IAM users'
    })

    // CloudTrail enabled rule
    new config.ManagedRule(this, 'CloudTrailEnabledRule', {
      identifier: config.ManagedRuleIdentifiers.CLOUD_TRAIL_ENABLED,
      description: 'Checks that CloudTrail is enabled'
    })

    // Root access key check
    new config.ManagedRule(this, 'RootAccessKeyRule', {
      identifier: config.ManagedRuleIdentifiers.IAM_ROOT_ACCESS_KEY_CHECK,
      description: 'Checks that root access keys do not exist'
    })
  }

  private setupGuardDuty(config: EnvironmentConfig, alertTopic: sns.Topic): void {
    // Enable GuardDuty
    const detector = new guardduty.CfnDetector(this, 'GuardDutyDetector', {
      enable: true,
      findingPublishingFrequency: 'FIFTEEN_MINUTES'
    })

    // Create EventBridge rule to forward GuardDuty findings to SNS
    const guardDutyRule = new events.Rule(this, 'GuardDutyFindingsRule', {
      eventPattern: {
        source: ['aws.guardduty'],
        detailType: ['GuardDuty Finding']
      }
    })

    guardDutyRule.addTarget(new eventsTargets.SnsTopic(alertTopic))

    // High severity findings get immediate alerts
    const highSeverityRule = new events.Rule(this, 'GuardDutyHighSeverityRule', {
      eventPattern: {
        source: ['aws.guardduty'],
        detailType: ['GuardDuty Finding'],
        detail: {
          severity: [7, 8, 9, 10] // High and Critical severity
        }
      }
    })

    highSeverityRule.addTarget(new eventsTargets.SnsTopic(alertTopic))
  }

  private createComplianceRules(config: EnvironmentConfig, alertTopic: sns.Topic): void {
    // Monitor for console logins without MFA
    const mfaRule = new events.Rule(this, 'ConsoleLoginWithoutMfaRule', {
      eventPattern: {
        source: ['aws.signin'],
        detailType: ['AWS Console Sign In via CloudTrail'],
        detail: {
          responseElements: {
            ConsoleLogin: ['Success']
          },
          additionalEventData: {
            MFAUsed: ['No']
          }
        }
      }
    })

    mfaRule.addTarget(new eventsTargets.SnsTopic(alertTopic))

    // Monitor for root account usage
    const rootUsageRule = new events.Rule(this, 'RootAccountUsageRule', {
      eventPattern: {
        source: ['aws.signin'],
        detailType: ['AWS Console Sign In via CloudTrail'],
        detail: {
          userIdentity: {
            type: ['Root']
          }
        }
      }
    })

    rootUsageRule.addTarget(new eventsTargets.SnsTopic(alertTopic))

    // Monitor for failed login attempts
    const failedLoginRule = new events.Rule(this, 'FailedLoginRule', {
      eventPattern: {
        source: ['aws.signin'],
        detailType: ['AWS Console Sign In via CloudTrail'],
        detail: {
          responseElements: {
            ConsoleLogin: ['Failure']
          }
        }
      }
    })

    failedLoginRule.addTarget(new eventsTargets.SnsTopic(alertTopic))
  }

  private setupIncidentResponse(config: EnvironmentConfig, alertTopic: sns.Topic): void {
    // Lambda function for automated incident response
    const incidentResponseFunction = new lambda.Function(this, 'IncidentResponseFunction', {
      functionName: `compliance-engine-incident-response-${config.name}`,
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
import json
import boto3
import os

def handler(event, context):
    """
    Automated incident response for security events
    """
    print(f"Processing incident: {json.dumps(event)}")
    
    # Parse the incident type
    source = event.get('source', '')
    detail_type = event.get('detail-type', '')
    
    # Initialize AWS clients
    sns = boto3.client('sns')
    
    # Create incident ticket (placeholder for ServiceNow/Jira integration)
    incident_id = f"INC-{context.aws_request_id[:8]}"
    
    # Send detailed alert
    message = {
        "incident_id": incident_id,
        "severity": "HIGH",
        "source": source,
        "detail_type": detail_type,
        "timestamp": event.get('time', ''),
        "account": event.get('account', ''),
        "region": event.get('region', ''),
        "details": event.get('detail', {})
    }
    
    sns.publish(
        TopicArn=os.environ['ALERT_TOPIC_ARN'],
        Subject=f"Security Incident {incident_id} - {detail_type}",
        Message=json.dumps(message, indent=2)
    )
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'incident_id': incident_id,
            'status': 'processed'
        })
    }
      `),
      environment: {
        ALERT_TOPIC_ARN: alertTopic.topicArn
      },
      timeout: cdk.Duration.minutes(5)
    })

    // Grant permissions
    alertTopic.grantPublish(incidentResponseFunction)

    // EventBridge rules for automated response
    const securityEventRule = new events.Rule(this, 'SecurityEventRule', {
      eventPattern: {
        source: ['aws.guardduty', 'aws.config'],
        detailType: ['GuardDuty Finding', 'Config Rules Compliance Change']
      }
    })

    securityEventRule.addTarget(new eventsTargets.LambdaFunction(incidentResponseFunction))
  }

  private createOutputs(config: EnvironmentConfig): void {
    new cdk.CfnOutput(this, 'CloudTrailArn', {
      value: this.cloudTrail.trailArn,
      description: 'CloudTrail ARN for audit logging',
      exportName: `ComplianceEngine-${config.name}-CloudTrailArn`
    })

    new cdk.CfnOutput(this, 'AuditBucketName', {
      value: this.auditBucket.bucketName,
      description: 'S3 bucket for audit logs',
      exportName: `ComplianceEngine-${config.name}-AuditBucketName`
    })

    new cdk.CfnOutput(this, 'ComplianceDashboard', {
      value: `https://${config.region}.console.aws.amazon.com/config/home?region=${config.region}#/dashboard`,
      description: 'AWS Config compliance dashboard URL',
      exportName: `ComplianceEngine-${config.name}-ComplianceDashboard`
    })
  }
}