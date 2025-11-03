#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("source-map-support/register");
const cdk = require("aws-cdk-lib");
const gymcoach_ai_stack_1 = require("./gymcoach-ai-stack");
// import { MonitoringStack } from './monitoring-stack';
const app = new cdk.App();
// Get environment from context or environment variable (default to 'dev')
const environment = app.node.tryGetContext('environment') || process.env.DEPLOY_ENV || 'dev';
// Validate environment
if (!['dev', 'prod'].includes(environment)) {
    throw new Error(`Invalid environment: ${environment}. Must be 'dev' or 'prod'`);
}
console.log(`Deploying GymCoach AI Stack for environment: ${environment}`);
new gymcoach_ai_stack_1.GymCoachAIStack(app, `GymCoachAIStack-${environment}`, {
    environment: environment,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2FwcC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSx1Q0FBcUM7QUFDckMsbUNBQW1DO0FBQ25DLDJEQUFzRDtBQUN0RCx3REFBd0Q7QUFFeEQsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7QUFFMUIsMEVBQTBFO0FBQzFFLE1BQU0sV0FBVyxHQUNmLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsVUFBVSxJQUFJLEtBQUssQ0FBQztBQUUzRSx1QkFBdUI7QUFDdkIsSUFBSSxDQUFDLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDO0lBQzNDLE1BQU0sSUFBSSxLQUFLLENBQ2Isd0JBQXdCLFdBQVcsMkJBQTJCLENBQy9ELENBQUM7QUFDSixDQUFDO0FBRUQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxnREFBZ0QsV0FBVyxFQUFFLENBQUMsQ0FBQztBQUUzRSxJQUFJLG1DQUFlLENBQUMsR0FBRyxFQUFFLG1CQUFtQixXQUFXLEVBQUUsRUFBRTtJQUN6RCxXQUFXLEVBQUUsV0FBNkI7SUFDMUMsR0FBRyxFQUFFO1FBQ0gsT0FBTyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CO1FBQ3hDLE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixJQUFJLFdBQVc7S0FDdEQ7SUFDRCxJQUFJLEVBQUU7UUFDSixXQUFXLEVBQUUsV0FBVztRQUN4QixPQUFPLEVBQUUsYUFBYTtLQUN2QjtDQUNGLENBQUMsQ0FBQztBQUVILDBEQUEwRDtBQUMxRCxXQUFXO0FBQ1gsZ0RBQWdEO0FBQ2hELDZEQUE2RDtBQUM3RCxPQUFPO0FBQ1AsdUJBQXVCO0FBQ3ZCLDBDQUEwQztBQUMxQyx3Q0FBd0M7QUFDeEMsc0NBQXNDO0FBQ3RDLHdDQUF3QztBQUN4QyxpQ0FBaUM7QUFDakMsT0FBTztBQUNQLHdDQUF3QztBQUN4QyxpQkFBaUI7QUFDakIsbUNBQW1DO0FBQ25DLG9DQUFvQztBQUNwQyx1Q0FBdUM7QUFDdkMsc0NBQXNDO0FBQ3RDLE9BQU87QUFDUCxNQUFNIiwic291cmNlc0NvbnRlbnQiOlsiIyEvdXNyL2Jpbi9lbnYgbm9kZVxuaW1wb3J0ICdzb3VyY2UtbWFwLXN1cHBvcnQvcmVnaXN0ZXInO1xuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IEd5bUNvYWNoQUlTdGFjayB9IGZyb20gJy4vZ3ltY29hY2gtYWktc3RhY2snO1xuLy8gaW1wb3J0IHsgTW9uaXRvcmluZ1N0YWNrIH0gZnJvbSAnLi9tb25pdG9yaW5nLXN0YWNrJztcblxuY29uc3QgYXBwID0gbmV3IGNkay5BcHAoKTtcblxuLy8gR2V0IGVudmlyb25tZW50IGZyb20gY29udGV4dCBvciBlbnZpcm9ubWVudCB2YXJpYWJsZSAoZGVmYXVsdCB0byAnZGV2JylcbmNvbnN0IGVudmlyb25tZW50ID1cbiAgYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgnZW52aXJvbm1lbnQnKSB8fCBwcm9jZXNzLmVudi5ERVBMT1lfRU5WIHx8ICdkZXYnO1xuXG4vLyBWYWxpZGF0ZSBlbnZpcm9ubWVudFxuaWYgKCFbJ2RldicsICdwcm9kJ10uaW5jbHVkZXMoZW52aXJvbm1lbnQpKSB7XG4gIHRocm93IG5ldyBFcnJvcihcbiAgICBgSW52YWxpZCBlbnZpcm9ubWVudDogJHtlbnZpcm9ubWVudH0uIE11c3QgYmUgJ2Rldicgb3IgJ3Byb2QnYFxuICApO1xufVxuXG5jb25zb2xlLmxvZyhgRGVwbG95aW5nIEd5bUNvYWNoIEFJIFN0YWNrIGZvciBlbnZpcm9ubWVudDogJHtlbnZpcm9ubWVudH1gKTtcblxubmV3IEd5bUNvYWNoQUlTdGFjayhhcHAsIGBHeW1Db2FjaEFJU3RhY2stJHtlbnZpcm9ubWVudH1gLCB7XG4gIGVudmlyb25tZW50OiBlbnZpcm9ubWVudCBhcyAnZGV2JyB8ICdwcm9kJyxcbiAgZW52OiB7XG4gICAgYWNjb3VudDogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfQUNDT1VOVCxcbiAgICByZWdpb246IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX1JFR0lPTiB8fCAnZXUtd2VzdC0xJyxcbiAgfSxcbiAgdGFnczoge1xuICAgIEVudmlyb25tZW50OiBlbnZpcm9ubWVudCxcbiAgICBQcm9qZWN0OiAnR3ltQ29hY2gtQUknLFxuICB9LFxufSk7XG5cbi8vIG5ldyBNb25pdG9yaW5nU3RhY2soYXBwLCAnR3ltQ29hY2hBSU1vbml0b3JpbmdTdGFjaycsIHtcbi8vICAgZW52OiB7XG4vLyAgICAgYWNjb3VudDogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfQUNDT1VOVCxcbi8vICAgICByZWdpb246IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX1JFR0lPTiB8fCAnZXUtd2VzdC0xJyxcbi8vICAgfSxcbi8vICAgbGFtYmRhRnVuY3Rpb25zOiBbXG4vLyAgICAgbWFpblN0YWNrLnVzZXJQcm9maWxlU2VydmljZUxhbWJkYSxcbi8vICAgICBtYWluU3RhY2subnV0cml0aW9uU2VydmljZUxhbWJkYSxcbi8vICAgICBtYWluU3RhY2sud29ya291dFNlcnZpY2VMYW1iZGEsXG4vLyAgICAgbWFpblN0YWNrLmFuYWx5dGljc1NlcnZpY2VMYW1iZGEsXG4vLyAgICAgbWFpblN0YWNrLmFpU2VydmljZUxhbWJkYSxcbi8vICAgXSxcbi8vICAgZHluYW1vRGJUYWJsZTogbWFpblN0YWNrLm1haW5UYWJsZSxcbi8vICAgczNCdWNrZXRzOiBbXG4vLyAgICAgbWFpblN0YWNrLnVzZXJVcGxvYWRzQnVja2V0LFxuLy8gICAgIG1haW5TdGFjay5zdGF0aWNBc3NldHNCdWNrZXQsXG4vLyAgICAgbWFpblN0YWNrLnByb2Nlc3NlZEltYWdlc0J1Y2tldCxcbi8vICAgICBtYWluU3RhY2sucHJvZ3Jlc3NQaG90b3NCdWNrZXQsXG4vLyAgIF0sXG4vLyB9KTtcbiJdfQ==