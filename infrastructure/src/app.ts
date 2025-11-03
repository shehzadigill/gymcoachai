#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { GymCoachAIStack } from './gymcoach-ai-stack';
// import { MonitoringStack } from './monitoring-stack';

const app = new cdk.App();

// Get environment from context or environment variable (default to 'dev')
const environment =
  app.node.tryGetContext('environment') || process.env.DEPLOY_ENV || 'dev';

// Validate environment
if (!['dev', 'prod'].includes(environment)) {
  throw new Error(
    `Invalid environment: ${environment}. Must be 'dev' or 'prod'`
  );
}

console.log(`Deploying GymCoach AI Stack for environment: ${environment}`);

new GymCoachAIStack(app, `GymCoachAIStack-${environment}`, {
  environment: environment as 'dev' | 'prod',
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'eu-west-1',
  },
  tags: {
    Environment: environment,
    Project: 'GymCoach-AI',
  },
});

// new MonitoringStack(app, 'GymCoachAIMonitoringStack', {
//   env: {
//     account: process.env.CDK_DEFAULT_ACCOUNT,
//     region: process.env.CDK_DEFAULT_REGION || 'eu-west-1',
//   },
//   lambdaFunctions: [
//     mainStack.userProfileServiceLambda,
//     mainStack.nutritionServiceLambda,
//     mainStack.workoutServiceLambda,
//     mainStack.analyticsServiceLambda,
//     mainStack.aiServiceLambda,
//   ],
//   dynamoDbTable: mainStack.mainTable,
//   s3Buckets: [
//     mainStack.userUploadsBucket,
//     mainStack.staticAssetsBucket,
//     mainStack.processedImagesBucket,
//     mainStack.progressPhotosBucket,
//   ],
// });
