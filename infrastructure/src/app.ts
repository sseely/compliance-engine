#!/usr/bin/env node
/**
 * AWS CDK App entry point for Compliance Engine infrastructure
 */

import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { NetworkingStack } from './stacks/networking-stack'
import { DatabaseStack } from './stacks/database-stack'
import { ComputeStack } from './stacks/compute-stack'
import { MonitoringStack } from './stacks/monitoring-stack'
import { ComplianceStack } from './stacks/compliance-stack'
import { getEnvironmentConfig, getCommonTags } from './config/environments'
import { COMPLIANCE_ENGINE_CONSTANTS } from './config/constants'

const app = new cdk.App()

// Get environment from context or default to dev
const environmentName = app.node.tryGetContext('environment') || 'dev'
const config = getEnvironmentConfig(environmentName)
const commonTags = getCommonTags(config)

// Environment for CDK deployment
const env = {
  account: config.account,
  region: config.region
}

console.log(`Deploying to ${environmentName} environment in ${config.region}`)

// Core infrastructure stacks with dependencies
const networkingStack = new NetworkingStack(app, `ComplianceEngine-Networking-${config.name}`, {
  env,
  config,
  tags: commonTags,
  description: `Networking infrastructure for Compliance Engine ${config.name} environment`
})

const databaseStack = new DatabaseStack(app, `ComplianceEngine-Database-${config.name}`, {
  env,
  config,
  vpc: networkingStack.vpc,
  tags: commonTags,
  description: `Database infrastructure for Compliance Engine ${config.name} environment`
})

const computeStack = new ComputeStack(app, `ComplianceEngine-Compute-${config.name}`, {
  env,
  config,
  vpc: networkingStack.vpc,
  database: databaseStack.database,
  tags: commonTags,
  description: `Compute infrastructure for Compliance Engine ${config.name} environment`
})

const monitoringStack = new MonitoringStack(app, `ComplianceEngine-Monitoring-${config.name}`, {
  env,
  config,
  compute: computeStack,
  database: databaseStack,
  tags: commonTags,
  description: `Monitoring infrastructure for Compliance Engine ${config.name} environment`
})

const complianceStack = new ComplianceStack(app, `ComplianceEngine-Compliance-${config.name}`, {
  env,
  config,
  alertTopic: monitoringStack.alertTopic,
  tags: commonTags,
  description: `Compliance and security infrastructure for Compliance Engine ${config.name} environment`
})

// Add stack dependencies
databaseStack.addDependency(networkingStack)
computeStack.addDependency(databaseStack)
monitoringStack.addDependency(computeStack)
complianceStack.addDependency(monitoringStack)

// Add termination protection for production
if (config.name === 'production') {
  networkingStack.terminationProtection = true
  databaseStack.terminationProtection = true
  computeStack.terminationProtection = true
  monitoringStack.terminationProtection = true
  complianceStack.terminationProtection = true
}

// Output important information
new cdk.CfnOutput(networkingStack, 'VpcId', {
  value: networkingStack.vpc.vpcId,
  description: 'VPC ID for the environment',
  exportName: `ComplianceEngine-${config.name}-VpcId`
})

new cdk.CfnOutput(computeStack, 'LoadBalancerDNS', {
  value: computeStack.loadBalancer.loadBalancerDnsName,
  description: 'Load Balancer DNS name',
  exportName: `ComplianceEngine-${config.name}-LoadBalancerDNS`
})

new cdk.CfnOutput(computeStack, 'ApiUrl', {
  value: `https://${config.domainName}${COMPLIANCE_ENGINE_CONSTANTS.API_PREFIX}`,
  description: 'API base URL',
  exportName: `ComplianceEngine-${config.name}-ApiUrl`
})