#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { GymCoachAIStack } from './gymcoach-ai-stack';

const app = new cdk.App();
new GymCoachAIStack(app, 'GymCoachAIStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'eu-north-1',
  },
});
