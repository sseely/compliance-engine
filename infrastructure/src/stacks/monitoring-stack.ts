/**
 * Monitoring infrastructure stack for Compliance Engine
 * Creates CloudWatch dashboards, alarms, SNS topics, and observability tools
 */

import * as cdk from 'aws-cdk-lib'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions'
import * as sns from 'aws-cdk-lib/aws-sns'
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as iam from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'
import { EnvironmentConfig } from '../config/environments'
import { COMPLIANCE_ENGINE_CONSTANTS } from '../config/constants'
import { ComputeStack } from './compute-stack'
import { DatabaseStack } from './database-stack'

export interface MonitoringStackProps extends cdk.StackProps {
  config: EnvironmentConfig
  compute: ComputeStack
  database: DatabaseStack
}

export class MonitoringStack extends cdk.Stack {
  public readonly alertTopic: sns.Topic
  public readonly dashboard: cloudwatch.Dashboard

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props)

    const { config, compute, database } = props

    // Create SNS topic for alerts
    this.alertTopic = new sns.Topic(this, 'AlertTopic', {
      topicName: `compliance-engine-alerts-${config.name}`,
      displayName: `Compliance Engine Alerts - ${config.name.toUpperCase()}`
    })

    // Subscribe email to alerts
    this.alertTopic.addSubscription(
      new snsSubscriptions.EmailSubscription(config.monitoring.alertEmail)
    )

    // Create CloudWatch dashboard
    this.dashboard = this.createDashboard(config, compute, database)

    // Create comprehensive alarms
    this.createApplicationAlarms(config, compute)
    this.createInfrastructureAlarms(config, compute, database)
    this.createBusinessMetricAlarms(config)

    // Create log insights queries for troubleshooting
    this.createLogInsights(config)

    // Outputs
    this.createOutputs(config)
  }

  private createDashboard(config: EnvironmentConfig, compute: ComputeStack, database: DatabaseStack): cloudwatch.Dashboard {
    const dashboard = new cloudwatch.Dashboard(this, 'ComplianceEngineDashboard', {
      dashboardName: `ComplianceEngine-${config.name}`,
      defaultInterval: cdk.Duration.hours(1)
    })

    // Application Performance Row
    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: `# Compliance Engine ${config.name.toUpperCase()} - Application Performance`,
        width: 24,
        height: 1
      })
    )

    dashboard.addWidgets(
      // API Response Time
      new cloudwatch.GraphWidget({
        title: 'API Response Time',
        left: [
          compute.loadBalancer.metricTargetResponseTime(),
          compute.service.metricCpuUtilization()
        ],
        width: 12,
        height: 6
      }),

      // Request Count and Error Rate
      new cloudwatch.GraphWidget({
        title: 'Request Count & Error Rate',
        left: [compute.loadBalancer.metricRequestCount()],
        right: [
          compute.loadBalancer.metricHttpCodeTarget(
            cloudwatch.HttpCodeTarget.TARGET_4XX_COUNT
          ),
          compute.loadBalancer.metricHttpCodeTarget(
            cloudwatch.HttpCodeTarget.TARGET_5XX_COUNT
          )
        ],
        width: 12,
        height: 6
      })
    )

    // ECS Metrics Row
    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: `## ECS Service Metrics`,
        width: 24,
        height: 1
      })
    )

    dashboard.addWidgets(
      // ECS Service Metrics
      new cloudwatch.GraphWidget({
        title: 'ECS Service - CPU & Memory',
        left: [
          compute.service.metricCpuUtilization(),
          compute.service.metricMemoryUtilization()
        ],
        width: 12,
        height: 6
      }),

      // Task Count
      new cloudwatch.GraphWidget({
        title: 'Running Tasks',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ECS',
            metricName: 'RunningTaskCount',
            dimensionsMap: {
              ServiceName: compute.service.serviceName,
              ClusterName: compute.cluster.clusterName
            }
          })
        ],
        width: 12,
        height: 6
      })
    )

    // Database Metrics Row
    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: `## Database Performance`,
        width: 24,
        height: 1
      })
    )

    dashboard.addWidgets(
      // Database Performance
      new cloudwatch.GraphWidget({
        title: 'Database - CPU & Connections',
        left: [
          database.database.metricCPUUtilization(),
          database.database.metricDatabaseConnections()
        ],
        width: 12,
        height: 6
      }),

      // Database Storage and IOPS
      new cloudwatch.GraphWidget({
        title: 'Database - Storage & IOPS',
        left: [
          database.database.metricFreeStorageSpace(),
          database.database.metricReadIOPS(),
          database.database.metricWriteIOPS()
        ],
        width: 12,
        height: 6
      })
    )

    // Business Metrics Row
    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: `## Business Metrics`,
        width: 24,
        height: 1
      })
    )

    dashboard.addWidgets(
      // API Usage by Customer
      new cloudwatch.GraphWidget({
        title: 'API Calls by Customer',
        left: [
          new cloudwatch.Metric({
            namespace: 'ComplianceEngine/Business',
            metricName: 'ApiCallsPerCustomer',
            statistic: 'Sum'
          })
        ],
        width: 8,
        height: 6
      }),

      // Revenue Metrics
      new cloudwatch.GraphWidget({
        title: 'Daily Revenue',
        left: [
          new cloudwatch.Metric({
            namespace: 'ComplianceEngine/Business',
            metricName: 'DailyRevenue',
            statistic: 'Sum'
          })
        ],
        width: 8,
        height: 6
      }),

      // Error Rate by API
      new cloudwatch.GraphWidget({
        title: 'Error Rate by API Endpoint',
        left: [
          new cloudwatch.Metric({
            namespace: 'ComplianceEngine/Business',
            metricName: 'ErrorRateByEndpoint',
            statistic: 'Average'
          })
        ],
        width: 8,
        height: 6
      })
    )

    return dashboard
  }

  private createApplicationAlarms(config: EnvironmentConfig, compute: ComputeStack): void {
    // High error rate alarm
    const errorRateAlarm = new cloudwatch.Alarm(this, 'HighErrorRateAlarm', {
      alarmName: `compliance-engine-${config.name}-high-error-rate`,
      alarmDescription: 'API error rate is too high',
      metric: compute.loadBalancer.metricHttpCodeTarget(
        cloudwatch.HttpCodeTarget.TARGET_5XX_COUNT
      ),
      threshold: 10,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD
    })
    errorRateAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic))

    // High response time alarm
    const responseTimeAlarm = new cloudwatch.Alarm(this, 'HighResponseTimeAlarm', {
      alarmName: `compliance-engine-${config.name}-high-response-time`,
      alarmDescription: 'API response time is too high',
      metric: compute.loadBalancer.metricTargetResponseTime(),
      threshold: 2, // 2 seconds
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD
    })
    responseTimeAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic))

    // No healthy targets alarm
    const healthyTargetsAlarm = new cloudwatch.Alarm(this, 'NoHealthyTargetsAlarm', {
      alarmName: `compliance-engine-${config.name}-no-healthy-targets`,
      alarmDescription: 'No healthy targets in load balancer',
      metric: compute.loadBalancer.metricHealthyHostCount(),
      threshold: 1,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD
    })
    healthyTargetsAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic))

    // ECS service CPU alarm
    const ecsHighCpuAlarm = new cloudwatch.Alarm(this, 'EcsHighCpuAlarm', {
      alarmName: `compliance-engine-${config.name}-ecs-high-cpu`,
      alarmDescription: 'ECS service CPU utilization is high',
      metric: compute.service.metricCpuUtilization(),
      threshold: 80,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD
    })
    ecsHighCpuAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic))

    // ECS service memory alarm
    const ecsHighMemoryAlarm = new cloudwatch.Alarm(this, 'EcsHighMemoryAlarm', {
      alarmName: `compliance-engine-${config.name}-ecs-high-memory`,
      alarmDescription: 'ECS service memory utilization is high',
      metric: compute.service.metricMemoryUtilization(),
      threshold: 90,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD
    })
    ecsHighMemoryAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic))
  }

  private createInfrastructureAlarms(config: EnvironmentConfig, compute: ComputeStack, database: DatabaseStack): void {
    // Database CPU alarm (already created in database stack, but adding here for completeness)
    const dbCpuAlarm = new cloudwatch.Alarm(this, 'DatabaseHighCpuAlarm', {
      alarmName: `compliance-engine-${config.name}-db-high-cpu`,
      alarmDescription: 'Database CPU utilization is high',
      metric: database.database.metricCPUUtilization(),
      threshold: 80,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD
    })
    dbCpuAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic))

    // Database connection alarm
    const dbConnectionAlarm = new cloudwatch.Alarm(this, 'DatabaseHighConnectionsAlarm', {
      alarmName: `compliance-engine-${config.name}-db-high-connections`,
      alarmDescription: 'Database connection count is high',
      metric: database.database.metricDatabaseConnections(),
      threshold: config.database.instanceType.includes('micro') ? 80 : 150,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD
    })
    dbConnectionAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic))
  }

  private createBusinessMetricAlarms(config: EnvironmentConfig): void {
    // Custom metric for API rate limiting violations
    const rateLimitAlarm = new cloudwatch.Alarm(this, 'RateLimitViolationsAlarm', {
      alarmName: `compliance-engine-${config.name}-rate-limit-violations`,
      alarmDescription: 'High number of rate limit violations detected',
      metric: new cloudwatch.Metric({
        namespace: 'ComplianceEngine/Business',
        metricName: 'RateLimitViolations',
        statistic: 'Sum'
      }),
      threshold: 100,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD
    })
    rateLimitAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic))

    // Daily revenue drop alarm (production only)
    if (config.name === 'production') {
      const revenueDrop = new cloudwatch.Alarm(this, 'DailyRevenueDropAlarm', {
        alarmName: `compliance-engine-${config.name}-revenue-drop`,
        alarmDescription: 'Daily revenue has dropped significantly',
        metric: new cloudwatch.Metric({
          namespace: 'ComplianceEngine/Business',
          metricName: 'DailyRevenue',
          statistic: 'Sum'
        }),
        threshold: 100, // $100 minimum daily revenue
        evaluationPeriods: 1,
        datapointsToAlarm: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.BREACHING
      })
      revenueDrop.addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic))
    }
  }

  private createLogInsights(config: EnvironmentConfig): void {
    // Create log group for API logs (if not already created)
    const apiLogGroup = logs.LogGroup.fromLogGroupName(
      this,
      'ApiLogGroup',
      `/ecs/compliance-engine-${config.name}`
    )

    // Create saved queries for common troubleshooting scenarios
    new logs.CfnQueryDefinition(this, 'ErrorAnalysisQuery', {
      name: `ComplianceEngine-${config.name}-ErrorAnalysis`,
      queryString: `
        fields @timestamp, @message, level, error_type, customer_id, api_endpoint
        | filter level = "ERROR"
        | stats count() by error_type, api_endpoint
        | sort count desc
        | limit 20
      `,
      logGroupNames: [apiLogGroup.logGroupName]
    })

    new logs.CfnQueryDefinition(this, 'SlowQueryAnalysis', {
      name: `ComplianceEngine-${config.name}-SlowQueries`,
      queryString: `
        fields @timestamp, @message, duration_ms, api_endpoint, customer_id
        | filter duration_ms > 1000
        | sort @timestamp desc
        | limit 50
      `,
      logGroupNames: [apiLogGroup.logGroupName]
    })

    new logs.CfnQueryDefinition(this, 'CustomerUsageAnalysis', {
      name: `ComplianceEngine-${config.name}-CustomerUsage`,
      queryString: `
        fields @timestamp, customer_id, api_endpoint, response_code
        | filter ispresent(customer_id)
        | stats count() by customer_id, api_endpoint
        | sort count desc
        | limit 100
      `,
      logGroupNames: [apiLogGroup.logGroupName]
    })
  }

  private createOutputs(config: EnvironmentConfig): void {
    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://${config.region}.console.aws.amazon.com/cloudwatch/home?region=${config.region}#dashboards:name=${this.dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
      exportName: `ComplianceEngine-${config.name}-DashboardUrl`
    })

    new cdk.CfnOutput(this, 'AlertTopicArn', {
      value: this.alertTopic.topicArn,
      description: 'SNS Topic ARN for alerts',
      exportName: `ComplianceEngine-${config.name}-AlertTopicArn`
    })

    new cdk.CfnOutput(this, 'LogGroupName', {
      value: `/ecs/compliance-engine-${config.name}`,
      description: 'CloudWatch Log Group name for the API',
      exportName: `ComplianceEngine-${config.name}-LogGroupName`
    })
  }
}