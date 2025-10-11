#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { GymCoachAIStack } from './gymcoach-ai-stack';
// import { MonitoringStack } from './monitoring-stack';

const app = new cdk.App();

new GymCoachAIStack(app, 'GymCoachAIStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'eu-north-1',
  },
});

// new MonitoringStack(app, 'GymCoachAIMonitoringStack', {
//   env: {
//     account: process.env.CDK_DEFAULT_ACCOUNT,
//     region: process.env.CDK_DEFAULT_REGION || 'eu-north-1',
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
