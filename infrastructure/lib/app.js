#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("source-map-support/register");
const cdk = require("aws-cdk-lib");
const gymcoach_ai_stack_1 = require("./gymcoach-ai-stack");
// import { MonitoringStack } from './monitoring-stack';
const app = new cdk.App();
new gymcoach_ai_stack_1.GymCoachAIStack(app, 'GymCoachAIStack', {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2FwcC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSx1Q0FBcUM7QUFDckMsbUNBQW1DO0FBQ25DLDJEQUFzRDtBQUN0RCx3REFBd0Q7QUFFeEQsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7QUFFMUIsSUFBSSxtQ0FBZSxDQUFDLEdBQUcsRUFBRSxpQkFBaUIsRUFBRTtJQUMxQyxHQUFHLEVBQUU7UUFDSCxPQUFPLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUI7UUFDeEMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCLElBQUksWUFBWTtLQUN2RDtDQUNGLENBQUMsQ0FBQztBQUVILDBEQUEwRDtBQUMxRCxXQUFXO0FBQ1gsZ0RBQWdEO0FBQ2hELDhEQUE4RDtBQUM5RCxPQUFPO0FBQ1AsdUJBQXVCO0FBQ3ZCLDBDQUEwQztBQUMxQyx3Q0FBd0M7QUFDeEMsc0NBQXNDO0FBQ3RDLHdDQUF3QztBQUN4QyxpQ0FBaUM7QUFDakMsT0FBTztBQUNQLHdDQUF3QztBQUN4QyxpQkFBaUI7QUFDakIsbUNBQW1DO0FBQ25DLG9DQUFvQztBQUNwQyx1Q0FBdUM7QUFDdkMsc0NBQXNDO0FBQ3RDLE9BQU87QUFDUCxNQUFNIiwic291cmNlc0NvbnRlbnQiOlsiIyEvdXNyL2Jpbi9lbnYgbm9kZVxuaW1wb3J0ICdzb3VyY2UtbWFwLXN1cHBvcnQvcmVnaXN0ZXInO1xuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IEd5bUNvYWNoQUlTdGFjayB9IGZyb20gJy4vZ3ltY29hY2gtYWktc3RhY2snO1xuLy8gaW1wb3J0IHsgTW9uaXRvcmluZ1N0YWNrIH0gZnJvbSAnLi9tb25pdG9yaW5nLXN0YWNrJztcblxuY29uc3QgYXBwID0gbmV3IGNkay5BcHAoKTtcblxubmV3IEd5bUNvYWNoQUlTdGFjayhhcHAsICdHeW1Db2FjaEFJU3RhY2snLCB7XG4gIGVudjoge1xuICAgIGFjY291bnQ6IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX0FDQ09VTlQsXG4gICAgcmVnaW9uOiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9SRUdJT04gfHwgJ2V1LW5vcnRoLTEnLFxuICB9LFxufSk7XG5cbi8vIG5ldyBNb25pdG9yaW5nU3RhY2soYXBwLCAnR3ltQ29hY2hBSU1vbml0b3JpbmdTdGFjaycsIHtcbi8vICAgZW52OiB7XG4vLyAgICAgYWNjb3VudDogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfQUNDT1VOVCxcbi8vICAgICByZWdpb246IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX1JFR0lPTiB8fCAnZXUtbm9ydGgtMScsXG4vLyAgIH0sXG4vLyAgIGxhbWJkYUZ1bmN0aW9uczogW1xuLy8gICAgIG1haW5TdGFjay51c2VyUHJvZmlsZVNlcnZpY2VMYW1iZGEsXG4vLyAgICAgbWFpblN0YWNrLm51dHJpdGlvblNlcnZpY2VMYW1iZGEsXG4vLyAgICAgbWFpblN0YWNrLndvcmtvdXRTZXJ2aWNlTGFtYmRhLFxuLy8gICAgIG1haW5TdGFjay5hbmFseXRpY3NTZXJ2aWNlTGFtYmRhLFxuLy8gICAgIG1haW5TdGFjay5haVNlcnZpY2VMYW1iZGEsXG4vLyAgIF0sXG4vLyAgIGR5bmFtb0RiVGFibGU6IG1haW5TdGFjay5tYWluVGFibGUsXG4vLyAgIHMzQnVja2V0czogW1xuLy8gICAgIG1haW5TdGFjay51c2VyVXBsb2Fkc0J1Y2tldCxcbi8vICAgICBtYWluU3RhY2suc3RhdGljQXNzZXRzQnVja2V0LFxuLy8gICAgIG1haW5TdGFjay5wcm9jZXNzZWRJbWFnZXNCdWNrZXQsXG4vLyAgICAgbWFpblN0YWNrLnByb2dyZXNzUGhvdG9zQnVja2V0LFxuLy8gICBdLFxuLy8gfSk7XG4iXX0=