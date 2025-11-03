"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GymCoachAIStack = void 0;
const cdk = require("aws-cdk-lib");
const lambda = require("aws-cdk-lib/aws-lambda");
const cloudfront = require("aws-cdk-lib/aws-cloudfront");
const origins = require("aws-cdk-lib/aws-cloudfront-origins");
const dynamodb = require("aws-cdk-lib/aws-dynamodb");
const iam = require("aws-cdk-lib/aws-iam");
const cognito = require("aws-cdk-lib/aws-cognito");
const s3 = require("aws-cdk-lib/aws-s3");
const sns = require("aws-cdk-lib/aws-sns");
const events = require("aws-cdk-lib/aws-events");
const targets = require("aws-cdk-lib/aws-events-targets");
class GymCoachAIStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Set environment (default to 'dev')
        this.env = props?.environment || 'dev';
        // DynamoDB Table with Single Table Design
        this.mainTable = new dynamodb.Table(this, 'GymCoachAITable', {
            tableName: `gymcoach-ai-main-${this.env}`,
            partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            // Removed pointInTimeRecovery to avoid costs (20% of table cost)
        });
        // Add GSI for different access patterns
        this.mainTable.addGlobalSecondaryIndex({
            indexName: 'GSI1',
            partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
        });
        // Create Cognito User Pool
        this.userPool = new cognito.UserPool(this, 'GymCoachAIUserPool', {
            userPoolName: `gymcoach-ai-users-${this.env}`,
            selfSignUpEnabled: true,
            signInAliases: {
                email: true,
                username: true,
            },
            autoVerify: {
                email: true,
            },
            standardAttributes: {
                email: {
                    required: true,
                    mutable: true,
                },
                givenName: {
                    required: true,
                    mutable: true,
                },
                familyName: {
                    required: true,
                    mutable: true,
                },
            },
            customAttributes: {
                fitnessGoals: new cognito.StringAttribute({
                    minLen: 1,
                    maxLen: 100,
                    mutable: true,
                }),
                experienceLevel: new cognito.StringAttribute({
                    minLen: 1,
                    maxLen: 20,
                    mutable: true,
                }),
                subscriptionTier: new cognito.StringAttribute({
                    minLen: 1,
                    maxLen: 20,
                    mutable: true,
                }),
            },
            passwordPolicy: {
                minLength: 8,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
                requireSymbols: true,
            },
            mfa: cognito.Mfa.OPTIONAL,
            mfaSecondFactor: {
                sms: true,
                otp: true,
            },
            deviceTracking: {
                challengeRequiredOnNewDevice: true,
                deviceOnlyRememberedOnUserPrompt: false,
            },
            accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // Create User Pool Client for Web App
        this.userPoolClient = new cognito.UserPoolClient(this, 'WebAppClient', {
            userPool: this.userPool,
            userPoolClientName: `gymcoach-ai-web-client-${this.env}`,
            generateSecret: false,
            authFlows: {
                userPassword: true,
                userSrp: true,
                custom: true,
            },
            oAuth: {
                flows: {
                    authorizationCodeGrant: true,
                    implicitCodeGrant: true,
                },
                scopes: [
                    cognito.OAuthScope.EMAIL,
                    cognito.OAuthScope.OPENID,
                    cognito.OAuthScope.PROFILE,
                ],
                callbackUrls: [
                    'http://localhost:3000/auth/callback',
                    'https://*.cloudfront.net/auth/callback',
                ],
                logoutUrls: [
                    'http://localhost:3000/auth/logout',
                    'https://*.cloudfront.net/auth/logout',
                ],
            },
            refreshTokenValidity: cdk.Duration.days(30),
            accessTokenValidity: cdk.Duration.hours(1),
            idTokenValidity: cdk.Duration.hours(1),
            preventUserExistenceErrors: true,
        });
        // Create User Pool Domain
        this.userPoolDomain = this.userPool.addDomain('CognitoDomain', {
            cognitoDomain: {
                domainPrefix: `gymcoach-ai-${this.env}-${this.account}`,
            },
        });
        // Create User Groups for Role-Based Access Control
        const adminGroup = new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
            userPoolId: this.userPool.userPoolId,
            groupName: 'admin',
            description: 'Administrators with full access',
            precedence: 1,
        });
        const coachGroup = new cognito.CfnUserPoolGroup(this, 'CoachGroup', {
            userPoolId: this.userPool.userPoolId,
            groupName: 'coach',
            description: 'Coaches with access to user data for coaching',
            precedence: 2,
        });
        const userGroup = new cognito.CfnUserPoolGroup(this, 'UserGroup', {
            userPoolId: this.userPool.userPoolId,
            groupName: 'user',
            description: 'Regular users with access to their own data',
            precedence: 3,
        });
        // Create SNS Topics for different notification types
        const workoutRemindersTopic = new sns.Topic(this, 'WorkoutRemindersTopic', {
            topicName: `gymcoach-ai-workout-reminders-${this.env}`,
            displayName: 'Workout Reminders',
        });
        const nutritionRemindersTopic = new sns.Topic(this, 'NutritionRemindersTopic', {
            topicName: `gymcoach-ai-nutrition-reminders-${this.env}`,
            displayName: 'Nutrition Reminders',
        });
        const achievementTopic = new sns.Topic(this, 'AchievementTopic', {
            topicName: `gymcoach-ai-achievements-${this.env}`,
            displayName: 'Achievement Notifications',
        });
        const aiSuggestionsTopic = new sns.Topic(this, 'AISuggestionsTopic', {
            topicName: `gymcoach-ai-suggestions-${this.env}`,
            displayName: 'AI Suggestions',
        });
        // Create EventBridge Rules for scheduled notifications
        const workoutReminderRule = new events.Rule(this, 'WorkoutReminderRule', {
            ruleName: `gymcoach-ai-workout-reminders-${this.env}`,
            description: 'Triggers workout reminder notifications',
            schedule: events.Schedule.cron({
                minute: '0',
                hour: '8', // 8 AM UTC - will be adjusted per user timezone
            }),
        });
        const nutritionReminderRule = new events.Rule(this, 'NutritionReminderRule', {
            ruleName: `gymcoach-ai-nutrition-reminders-${this.env}`,
            description: 'Triggers nutrition reminder notifications',
            schedule: events.Schedule.cron({
                minute: '0',
                hour: '12', // 12 PM UTC - will be adjusted per user timezone
            }),
        });
        const waterReminderRule = new events.Rule(this, 'WaterReminderRule', {
            ruleName: `gymcoach-ai-water-reminders-${this.env}`,
            description: 'Triggers water intake reminder notifications',
            schedule: events.Schedule.cron({
                minute: '0',
                hour: '*', // Every hour
            }),
        });
        const progressPhotoRule = new events.Rule(this, 'ProgressPhotoRule', {
            ruleName: `gymcoach-ai-progress-photos-${this.env}`,
            description: 'Triggers weekly progress photo reminders',
            schedule: events.Schedule.cron({
                minute: '0',
                hour: '18', // 6 PM UTC on Sundays
                weekDay: 'SUN',
            }),
        });
        // Proactive Coaching EventBridge Rules
        const proactiveCheckInRule = new events.Rule(this, 'ProactiveCheckInRule', {
            ruleName: `gymcoach-ai-proactive-checkins-${this.env}`,
            description: 'Triggers proactive AI coach check-ins',
            schedule: events.Schedule.cron({
                minute: '0',
                hour: '9', // 9 AM UTC daily
            }),
        });
        const progressMonitorRule = new events.Rule(this, 'ProgressMonitorRule', {
            ruleName: `gymcoach-ai-progress-monitoring-${this.env}`,
            description: 'Monitors user progress and triggers interventions',
            schedule: events.Schedule.cron({
                minute: '0',
                hour: '6', // 6 AM UTC daily
            }),
        });
        const plateauDetectionRule = new events.Rule(this, 'PlateauDetectionRule', {
            ruleName: `gymcoach-ai-plateau-detection-${this.env}`,
            description: 'Detects workout plateaus and suggests changes',
            schedule: events.Schedule.cron({
                minute: '0',
                hour: '20', // 8 PM UTC on Sundays
                weekDay: 'SUN',
            }),
        });
        const motivationBoostRule = new events.Rule(this, 'MotivationBoostRule', {
            ruleName: `gymcoach-ai-motivation-boost-${this.env}`,
            description: 'Sends motivational messages based on user patterns',
            schedule: events.Schedule.cron({
                minute: '0',
                hour: '7', // 7 AM UTC on Mondays
                weekDay: 'MON',
            }),
        });
        const weeklyReviewRule = new events.Rule(this, 'WeeklyReviewRule', {
            ruleName: `gymcoach-ai-weekly-review-${this.env}`,
            description: 'Generates weekly progress reviews and recommendations',
            schedule: events.Schedule.cron({
                minute: '0',
                hour: '19', // 7 PM UTC on Sundays
                weekDay: 'SUN',
            }),
        });
        // Create S3 Buckets (needed by Lambdas)
        this.userUploadsBucket = new s3.Bucket(this, 'UserUploadsBucket', {
            bucketName: `gymcoach-ai-user-uploads-${this.env}-${this.account}`,
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, // Block all public access - only CloudFront can access
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            cors: [
                {
                    allowedHeaders: ['*'],
                    allowedMethods: [
                        s3.HttpMethods.GET,
                        s3.HttpMethods.PUT,
                        s3.HttpMethods.POST,
                        s3.HttpMethods.DELETE,
                        s3.HttpMethods.HEAD,
                    ],
                    allowedOrigins: ['*'],
                    exposedHeaders: ['ETag'],
                    maxAge: 3000,
                },
            ],
            lifecycleRules: [
                {
                    id: 'DeleteIncompleteMultipartUploads',
                    abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
                },
                {
                    id: 'TransitionToIA',
                    transitions: [
                        {
                            storageClass: s3.StorageClass.INFREQUENT_ACCESS,
                            transitionAfter: cdk.Duration.days(30),
                        },
                    ],
                },
                {
                    id: 'TransitionToGlacier',
                    transitions: [
                        {
                            storageClass: s3.StorageClass.GLACIER,
                            transitionAfter: cdk.Duration.days(90),
                        },
                    ],
                },
            ],
        });
        this.staticAssetsBucket = new s3.Bucket(this, 'StaticAssetsBucket', {
            bucketName: `gymcoach-ai-static-assets-${this.env}-${this.account}`,
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            publicReadAccess: false,
        });
        this.processedImagesBucket = new s3.Bucket(this, 'ProcessedImagesBucket', {
            bucketName: `gymcoach-ai-processed-images-${this.env}-${this.account}`,
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // Create dedicated Progress Photos S3 Bucket with enhanced security
        this.progressPhotosBucket = new s3.Bucket(this, 'ProgressPhotosBucket', {
            bucketName: `gymcoach-ai-progress-photos-${this.env}-${this.account}`,
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            cors: [
                {
                    allowedHeaders: ['*'],
                    allowedMethods: [
                        s3.HttpMethods.GET,
                        s3.HttpMethods.PUT,
                        s3.HttpMethods.POST,
                        s3.HttpMethods.DELETE,
                        s3.HttpMethods.HEAD,
                    ],
                    allowedOrigins: ['*'],
                    exposedHeaders: ['ETag'],
                    maxAge: 3000,
                },
            ],
            lifecycleRules: [
                {
                    id: 'DeleteIncompleteMultipartUploads',
                    abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
                },
                {
                    id: 'TransitionProgressPhotosToIA',
                    transitions: [
                        {
                            storageClass: s3.StorageClass.INFREQUENT_ACCESS,
                            transitionAfter: cdk.Duration.days(30),
                        },
                    ],
                },
                {
                    id: 'ArchiveOldProgressPhotos',
                    transitions: [
                        {
                            storageClass: s3.StorageClass.GLACIER,
                            transitionAfter: cdk.Duration.days(365),
                        },
                    ],
                },
            ],
        });
        // Create CloudFront Origin Access Identity for user uploads bucket
        const userUploadsOAI = new cloudfront.OriginAccessIdentity(this, 'UserUploadsOAI', {
            comment: 'Origin Access Identity for User Uploads bucket',
        });
        // Grant CloudFront OAI access to user uploads bucket
        this.userUploadsBucket.addToResourcePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            principals: [userUploadsOAI.grantPrincipal],
            actions: ['s3:GetObject'],
            resources: [`${this.userUploadsBucket.bucketArn}/*`],
        }));
        // Create CloudFront Origin Access Identity for progress photos bucket
        const progressPhotosOAI = new cloudfront.OriginAccessIdentity(this, 'ProgressPhotosOAI', {
            comment: 'Origin Access Identity for Progress Photos bucket v2',
        });
        // Grant CloudFront OAI access to progress photos bucket
        this.progressPhotosBucket.addToResourcePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            principals: [progressPhotosOAI.grantPrincipal],
            actions: ['s3:GetObject'],
            resources: [`${this.progressPhotosBucket.bucketArn}/*`],
        }));
        // Create CloudFront Origin Access Identity for frontend bucket
        const frontendOAI = new cloudfront.OriginAccessIdentity(this, 'FrontendOAI', {
            comment: 'Origin Access Identity for Frontend bucket',
        });
        // Create Frontend S3 Bucket for static assets
        this.frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
            bucketName: `gymcoach-ai-frontend-${this.env}-${this.account}`,
            encryption: s3.BucketEncryption.S3_MANAGED,
            publicReadAccess: false, // Only CloudFront OAI should access
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, // Block all public access
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // Grant CloudFront OAI access to frontend bucket
        this.frontendBucket.addToResourcePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            principals: [frontendOAI.grantPrincipal],
            actions: ['s3:GetObject'],
            resources: [`${this.frontendBucket.bucketArn}/*`],
        }));
        // Create S3 Vectors Bucket for AI Knowledge Base
        this.vectorsBucket = new s3.Bucket(this, 'VectorsBucket', {
            bucketName: `gymcoach-ai-vectors-${this.env}-${this.account}`,
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            cors: [
                {
                    allowedHeaders: ['*'],
                    allowedMethods: [
                        s3.HttpMethods.GET,
                        s3.HttpMethods.PUT,
                        s3.HttpMethods.POST,
                        s3.HttpMethods.DELETE,
                        s3.HttpMethods.HEAD,
                    ],
                    allowedOrigins: ['*'],
                    exposedHeaders: ['ETag'],
                    maxAge: 3000,
                },
            ],
            lifecycleRules: [
                {
                    id: 'DeleteIncompleteMultipartUploads',
                    abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
                },
                {
                    id: 'TransitionVectorsToIA',
                    transitions: [
                        {
                            storageClass: s3.StorageClass.INFREQUENT_ACCESS,
                            transitionAfter: cdk.Duration.days(30),
                        },
                    ],
                },
                {
                    id: 'ArchiveOldVectors',
                    transitions: [
                        {
                            storageClass: s3.StorageClass.GLACIER,
                            transitionAfter: cdk.Duration.days(90),
                        },
                    ],
                },
            ],
        });
        // Create Lambda Authorizer
        const authorizerLambda = new lambda.Function(this, 'AuthorizerLambda', {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromInline(`
        const jwt = require('jsonwebtoken');
        const jwksClient = require('jwks-rsa');
        
        const client = jwksClient({
          jwksUri: 'https://cognito-idp.${this.region}.amazonaws.com/${this.userPool.userPoolId}/.well-known/jwks.json'
        });
        
        function getKey(header, callback) {
          client.getSigningKey(header.kid, (err, key) => {
            const signingKey = key.publicKey || key.rsaPublicKey;
            callback(null, signingKey);
          });
        }
        
        exports.handler = async (event) => {
          console.log('Authorizer event:', JSON.stringify(event, null, 2));
          
          try {
            const token = event.headers.authorization?.replace('Bearer ', '');
            if (!token) {
              return generatePolicy('user', 'Deny', event.methodArn);
            }
            
            const decoded = await new Promise((resolve, reject) => {
              jwt.verify(token, getKey, { algorithms: ['RS256'] }, (err, decoded) => {
                if (err) reject(err);
                else resolve(decoded);
              });
            });
            
            console.log('Decoded token:', decoded);
            
            return generatePolicy(decoded.sub, 'Allow', event.methodArn, decoded);
          } catch (error) {
            console.error('Authorization error:', error);
            return generatePolicy('user', 'Deny', event.methodArn);
          }
        };
        
        function generatePolicy(principalId, effect, resource, context = {}) {
          return {
            principalId,
            policyDocument: {
              Version: '2012-10-17',
              Statement: [{
                Action: 'execute-api:Invoke',
                Effect: effect,
                Resource: resource
              }]
            },
            context
          };
        }
      `),
            environment: {
                USER_POOL_ID: this.userPool.userPoolId,
                USER_POOL_CLIENT_ID: this.userPoolClient.userPoolClientId,
                TABLE_NAME: this.mainTable.tableName,
            },
        });
        // Grant permissions to authorizer
        this.mainTable.grantReadData(authorizerLambda);
        // Create Lambda functions for each service
        // const userServiceLambda = this.createLambdaFunction(
        //   'UserService',
        //   'user-service'
        // );
        const userProfileServiceLambda = this.createLambdaFunction('UserProfileService', 'user-profile-service');
        const workoutServiceLambda = this.createLambdaFunction('WorkoutService', 'workout-service');
        const coachingServiceLambda = this.createLambdaFunction('CoachingService', 'coaching-service');
        const analyticsServiceLambda = this.createLambdaFunction('AnalyticsService', 'analytics-service', {
            // Add CloudFront domain placeholder - will be updated after deployment
            CLOUDFRONT_DOMAIN: `d202qmtk8kkxra.cloudfront.net`, // Update manually after first deployment
        });
        const nutritionServiceLambda = this.createLambdaFunction('NutritionService', 'nutrition-service');
        const aiServiceLambda = this.createPythonLambdaFunction('AIService', 'ai-service-python');
        // Create Notification Service Lambda
        const notificationServiceLambda = this.createLambdaFunction('NotificationService', 'notification-service', {
            WORKOUT_REMINDERS_TOPIC_ARN: workoutRemindersTopic.topicArn,
            NUTRITION_REMINDERS_TOPIC_ARN: nutritionRemindersTopic.topicArn,
            ACHIEVEMENT_TOPIC_ARN: achievementTopic.topicArn,
            AI_SUGGESTIONS_TOPIC_ARN: aiSuggestionsTopic.topicArn,
            FCM_SERVER_KEY: process.env.FCM_SERVER_KEY || 'placeholder',
            FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || 'gymcoach-73528',
        });
        // Create Notification Scheduler Lambda
        const notificationSchedulerLambda = this.createLambdaFunction('NotificationScheduler', 'notification-scheduler', {
            NOTIFICATION_SERVICE_FUNCTION_ARN: '', // Will be set after creation
        });
        // Update notification scheduler with the correct function ARN
        notificationSchedulerLambda.addEnvironment('NOTIFICATION_SERVICE_FUNCTION_ARN', notificationServiceLambda.functionArn);
        // Enable Lambda Function URLs
        // const userServiceUrl = userServiceLambda.addFunctionUrl({
        //   authType: lambda.FunctionUrlAuthType.NONE,
        //   cors: {
        //     allowCredentials: false,
        //     allowedHeaders: ['*'],
        //     allowedMethods: [lambda.HttpMethod.ALL],
        //     allowedOrigins: ['*'],
        //   },
        // });
        const userProfileServiceUrl = userProfileServiceLambda.addFunctionUrl({
            authType: lambda.FunctionUrlAuthType.NONE,
            cors: {
                allowCredentials: false,
                allowedHeaders: ['*'],
                allowedMethods: [lambda.HttpMethod.ALL],
                allowedOrigins: ['*'],
            },
        });
        const workoutServiceUrl = workoutServiceLambda.addFunctionUrl({
            authType: lambda.FunctionUrlAuthType.NONE,
            cors: {
                allowCredentials: false,
                allowedHeaders: ['*'],
                allowedMethods: [lambda.HttpMethod.ALL],
                allowedOrigins: ['*'],
            },
        });
        const coachingServiceUrl = coachingServiceLambda.addFunctionUrl({
            authType: lambda.FunctionUrlAuthType.NONE,
            cors: {
                allowCredentials: false,
                allowedHeaders: ['*'],
                allowedMethods: [lambda.HttpMethod.ALL],
                allowedOrigins: ['*'],
            },
        });
        const analyticsServiceUrl = analyticsServiceLambda.addFunctionUrl({
            authType: lambda.FunctionUrlAuthType.NONE,
            cors: {
                allowCredentials: false,
                allowedHeaders: ['*'],
                allowedMethods: [lambda.HttpMethod.ALL],
                allowedOrigins: ['*'],
            },
        });
        const nutritionServiceUrl = nutritionServiceLambda.addFunctionUrl({
            authType: lambda.FunctionUrlAuthType.NONE,
            cors: {
                allowCredentials: false,
                allowedHeaders: ['*'],
                allowedMethods: [lambda.HttpMethod.ALL],
                allowedOrigins: ['*'],
            },
        });
        const aiServiceUrl = aiServiceLambda.addFunctionUrl({
            authType: lambda.FunctionUrlAuthType.NONE,
            cors: {
                allowCredentials: false,
                allowedHeaders: ['*'],
                allowedMethods: [lambda.HttpMethod.ALL],
                allowedOrigins: ['*'],
            },
        });
        const notificationServiceUrl = notificationServiceLambda.addFunctionUrl({
            authType: lambda.FunctionUrlAuthType.NONE,
            cors: {
                allowCredentials: false,
                allowedHeaders: ['*'],
                allowedMethods: [lambda.HttpMethod.ALL],
                allowedOrigins: ['*'],
            },
        });
        // Create CloudFront Distribution with Lambda Function URLs as origins
        const userProfileDomain = cdk.Fn.select(2, cdk.Fn.split('/', userProfileServiceUrl.url));
        const workoutDomain = cdk.Fn.select(2, cdk.Fn.split('/', workoutServiceUrl.url));
        const coachingDomain = cdk.Fn.select(2, cdk.Fn.split('/', coachingServiceUrl.url));
        const analyticsDomain = cdk.Fn.select(2, cdk.Fn.split('/', analyticsServiceUrl.url));
        const nutritionDomain = cdk.Fn.select(2, cdk.Fn.split('/', nutritionServiceUrl.url));
        const aiDomain = cdk.Fn.select(2, cdk.Fn.split('/', aiServiceUrl.url));
        const notificationDomain = cdk.Fn.select(2, cdk.Fn.split('/', notificationServiceUrl.url));
        // WAF Web ACL - COMMENTED OUT (requires us-east-1 region for CloudFront)
        // TODO: Create WAF in us-east-1 region separately or use cross-region approach
        // const wafWebAcl = new wafv2.CfnWebACL(this, 'GymCoachAIWAF', {
        //   name: 'gymcoach-ai-waf-basic',
        //   description: 'Basic WAF for GymCoach AI - Essential protection only (cost-optimized)',
        //   scope: 'CLOUDFRONT',
        //   defaultAction: { allow: {} },
        //   rules: [
        //     // Basic rate limiting rule - ESSENTIAL (keeps costs low)
        //     {
        //       name: 'BasicRateLimitRule',
        //       priority: 1,
        //       action: { block: {} },
        //       statement: {
        //         rateBasedStatement: {
        //           limit: 5000, // 5000 requests per 5 minutes
        //           aggregateKeyType: 'IP',
        //         },
        //       },
        //       visibilityConfig: {
        //         sampledRequestsEnabled: false,
        //         cloudWatchMetricsEnabled: false,
        //         metricName: 'BasicRateLimitMetric',
        //       },
        //     },
        //   ],
        //   visibilityConfig: {
        //     sampledRequestsEnabled: false,
        //     cloudWatchMetricsEnabled: false,
        //     metricName: 'GymCoachAIWAFBasicMetric',
        //   },
        // });
        // Create CloudFront Function for URL rewriting (handles SPA routing)
        const urlRewriteFunction = new cloudfront.Function(this, 'UrlRewriteFunction', {
            functionName: 'url-rewrite-function',
            code: cloudfront.FunctionCode.fromInline(`
        function handler(event) {
          var request = event.request;
          var uri = request.uri;
          
          // Handle root path - redirect to /en (default locale)
          if (uri === '/' || uri === '') {
            // Check for preferred locale in cookie
            var cookies = request.cookies;
            var preferredLocale = 'en'; // default
            
            if (cookies.preferredLocale && cookies.preferredLocale.value) {
              var locale = cookies.preferredLocale.value;
              var supportedLocales = ['en', 'ar', 'sv'];
              if (supportedLocales.indexOf(locale) !== -1) {
                preferredLocale = locale;
              }
            }
            
            // Redirect to the preferred locale
            return {
              statusCode: 302,
              statusDescription: 'Found',
              headers: {
                location: { value: '/' + preferredLocale }
              }
            };
          }
          
          // If URI has a file extension, return as-is
          if (/\\.[a-zA-Z0-9]+$/.test(uri)) {
            return request;
          }
          
          // Handle locale routes (e.g., /en, /ar, /sv)
          var supportedLocales = ['en', 'ar', 'sv'];
          var pathSegments = uri.split('/').filter(function(segment) { return segment.length > 0; });
          
          // If the first segment is a supported locale
          if (pathSegments.length > 0 && supportedLocales.indexOf(pathSegments[0]) !== -1) {
            // For locale routes, serve the specific route's index.html
            if (pathSegments.length === 1) {
              // Root locale route (e.g., /en)
              request.uri = '/' + pathSegments[0] + '/index.html';
            } else {
              // Nested locale route (e.g., /en/profile)
              request.uri = uri + '/index.html';
            }
            return request;
          }
          
          // If URI ends with /, append index.html
          if (uri.endsWith('/')) {
            request.uri += 'index.html';
            return request;
          }
          
          // For paths without extension and without trailing slash,
          // check if it's likely a route (not a file)
          if (!uri.includes('.')) {
            // For static export, always serve the specific route's index.html
            request.uri = uri + '/index.html';
          }
          
          return request;
        }
      `),
            comment: 'URL rewrite function for SPA routing with i18n support - serves index.html for all routes including locale routes and handles locale redirection from root',
        });
        this.distribution = new cloudfront.Distribution(this, 'GymCoachAIDistribution', {
            defaultRootObject: 'index.html',
            // webAclId: wafWebAcl.attrArn, // Commented out - WAF requires us-east-1 region
            defaultBehavior: {
                origin: origins.S3BucketOrigin.withOriginAccessIdentity(this.frontendBucket, {
                    originAccessIdentity: frontendOAI,
                }),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                cachePolicy: new cloudfront.CachePolicy(this, 'FrontendCachePolicy', {
                    cachePolicyName: 'frontend-cache-policy',
                    defaultTtl: cdk.Duration.hours(24),
                    maxTtl: cdk.Duration.days(365),
                    minTtl: cdk.Duration.seconds(0),
                    headerBehavior: cloudfront.CacheHeaderBehavior.allowList('CloudFront-Viewer-Country'),
                    queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
                    cookieBehavior: cloudfront.CacheCookieBehavior.none(),
                }),
                functionAssociations: [
                    {
                        function: urlRewriteFunction,
                        eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
                    },
                ],
            },
            additionalBehaviors: {
                // '/api/users/*': {
                //   origin: new origins.HttpOrigin(userServiceUrl.url),
                //   viewerProtocolPolicy:
                //     cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                //   allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
                //   cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
                //   originRequestPolicy:
                //     cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
                // },
                '/api/user-profiles/*': {
                    origin: new origins.HttpOrigin(userProfileDomain),
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
                    cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
                    originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
                },
                '/api/workouts/*': {
                    origin: new origins.HttpOrigin(workoutDomain),
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
                    cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
                    originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
                },
                '/api/coaching/*': {
                    origin: new origins.HttpOrigin(coachingDomain),
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
                    cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
                    originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
                },
                '/api/analytics/*': {
                    origin: new origins.HttpOrigin(analyticsDomain),
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
                    cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
                    originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
                },
                '/api/nutrition/*': {
                    origin: new origins.HttpOrigin(nutritionDomain),
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
                    cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
                    originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
                },
                '/api/ai/*': {
                    origin: new origins.HttpOrigin(aiDomain, {
                        connectionTimeout: cdk.Duration.seconds(10),
                        connectionAttempts: 3,
                    }),
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
                    cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
                    originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
                },
                '/api/notifications/*': {
                    origin: new origins.HttpOrigin(notificationDomain),
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
                    cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
                    originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
                },
                '/progress-photos/*': {
                    origin: origins.S3BucketOrigin.withOriginAccessIdentity(this.progressPhotosBucket, {
                        originAccessIdentity: progressPhotosOAI,
                    }),
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
                    cachePolicy: new cloudfront.CachePolicy(this, 'ProgressPhotosCachePolicy', {
                        cachePolicyName: 'progress-photos-cache-policy',
                        defaultTtl: cdk.Duration.hours(24),
                        maxTtl: cdk.Duration.days(365),
                        minTtl: cdk.Duration.seconds(0),
                        headerBehavior: cloudfront.CacheHeaderBehavior.allowList('CloudFront-Viewer-Country'),
                        queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
                        cookieBehavior: cloudfront.CacheCookieBehavior.none(),
                    }),
                },
                '/user-uploads/*': {
                    origin: origins.S3BucketOrigin.withOriginAccessIdentity(this.userUploadsBucket, {
                        originAccessIdentity: userUploadsOAI,
                    }),
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
                    cachePolicy: new cloudfront.CachePolicy(this, 'UserUploadsCachePolicy', {
                        cachePolicyName: 'user-uploads-cache-policy',
                        defaultTtl: cdk.Duration.hours(24),
                        maxTtl: cdk.Duration.days(365),
                        minTtl: cdk.Duration.seconds(0),
                        headerBehavior: cloudfront.CacheHeaderBehavior.allowList('CloudFront-Viewer-Country'),
                        queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
                        cookieBehavior: cloudfront.CacheCookieBehavior.none(),
                    }),
                },
            },
            comment: 'GymCoach AI CloudFront Distribution',
        });
        // Add CloudFront domain to analytics service environment
        // This must be done via CDK output and manual update to avoid circular dependency
        new cdk.CfnOutput(this, 'CloudFrontDomainForAnalytics', {
            value: this.distribution.distributionDomainName,
            description: 'CloudFront domain - use this to update AnalyticsService Lambda CLOUDFRONT_DOMAIN env var',
            exportName: 'GymCoachAI-CloudFrontDomain',
        });
        // Grant permissions to Lambda functions for S3 access
        this.userUploadsBucket.grantReadWrite(userProfileServiceLambda);
        this.userUploadsBucket.grantReadWrite(workoutServiceLambda);
        this.userUploadsBucket.grantReadWrite(analyticsServiceLambda);
        this.processedImagesBucket.grantReadWrite(userProfileServiceLambda);
        this.processedImagesBucket.grantReadWrite(workoutServiceLambda);
        this.processedImagesBucket.grantReadWrite(analyticsServiceLambda);
        // Grant analytics service full access to progress photos bucket
        this.progressPhotosBucket.grantReadWrite(analyticsServiceLambda);
        // Grant AI service access to vectors bucket
        this.vectorsBucket.grantReadWrite(aiServiceLambda);
        // Allow service to read from the main DynamoDB table
        this.mainTable.grantReadData(analyticsServiceLambda);
        this.mainTable.grantReadData(nutritionServiceLambda);
        this.mainTable.grantReadData(userProfileServiceLambda);
        this.mainTable.grantReadData(workoutServiceLambda);
        this.mainTable.grantReadData(coachingServiceLambda);
        this.mainTable.grantReadData(aiServiceLambda);
        this.mainTable.grantWriteData(analyticsServiceLambda);
        this.mainTable.grantWriteData(nutritionServiceLambda);
        this.mainTable.grantWriteData(userProfileServiceLambda);
        this.mainTable.grantWriteData(workoutServiceLambda);
        this.mainTable.grantWriteData(coachingServiceLambda);
        this.mainTable.grantWriteData(aiServiceLambda);
        // Ensure nutrition service can Query GSIs explicitly
        nutritionServiceLambda.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['dynamodb:Query', 'dynamodb:GetItem'],
            resources: [
                this.mainTable.tableArn,
                `${this.mainTable.tableArn}/index/*`,
            ],
        }));
        // Grant AI service Bedrock permissions
        aiServiceLambda.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'bedrock:InvokeModel',
                'bedrock:InvokeModelWithResponseStream',
            ],
            resources: [
                'arn:aws:bedrock:*::foundation-model/deepseek.v3-v1:0',
                'arn:aws:bedrock:*::foundation-model/amazon.titan-embed-text-v1',
                'arn:aws:bedrock:*::foundation-model/amazon.titan-embed-text-v2:0',
                'arn:aws:bedrock:*::foundation-model/cohere.embed-english-v3',
            ],
        }));
        // Grant AI service Cognito permissions
        aiServiceLambda.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'cognito-idp:AdminListGroupsForUser',
                'cognito-idp:AdminGetUser',
                'cognito-idp:ListUsers',
            ],
            resources: [this.userPool.userPoolArn],
        }));
        // Grant notification service permissions
        notificationServiceLambda.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'sns:Publish',
                'sns:CreatePlatformEndpoint',
                'sns:DeleteEndpoint',
                'sns:GetEndpointAttributes',
                'sns:SetEndpointAttributes',
            ],
            resources: [
                workoutRemindersTopic.topicArn,
                nutritionRemindersTopic.topicArn,
                achievementTopic.topicArn,
                aiSuggestionsTopic.topicArn,
                '*', // Allow access to all SNS platform applications
            ],
        }));
        // Grant notification scheduler permissions
        notificationSchedulerLambda.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['lambda:InvokeFunction'],
            resources: [notificationServiceLambda.functionArn],
        }));
        // Add EventBridge targets
        workoutReminderRule.addTarget(new targets.LambdaFunction(notificationSchedulerLambda));
        nutritionReminderRule.addTarget(new targets.LambdaFunction(notificationSchedulerLambda));
        waterReminderRule.addTarget(new targets.LambdaFunction(notificationSchedulerLambda));
        progressPhotoRule.addTarget(new targets.LambdaFunction(notificationSchedulerLambda));
        // Proactive Coaching EventBridge targets
        proactiveCheckInRule.addTarget(new targets.LambdaFunction(aiServiceLambda, {
            event: events.RuleTargetInput.fromObject({
                source: 'proactive-checkin',
                action: 'checkin',
                timestamp: events.EventField.fromPath('$.time'),
            }),
        }));
        progressMonitorRule.addTarget(new targets.LambdaFunction(aiServiceLambda, {
            event: events.RuleTargetInput.fromObject({
                source: 'progress-monitor',
                action: 'monitor',
                timestamp: events.EventField.fromPath('$.time'),
            }),
        }));
        plateauDetectionRule.addTarget(new targets.LambdaFunction(aiServiceLambda, {
            event: events.RuleTargetInput.fromObject({
                source: 'plateau-detection',
                action: 'detect-plateaus',
                timestamp: events.EventField.fromPath('$.time'),
            }),
        }));
        motivationBoostRule.addTarget(new targets.LambdaFunction(aiServiceLambda, {
            event: events.RuleTargetInput.fromObject({
                source: 'motivation-boost',
                action: 'motivate',
                timestamp: events.EventField.fromPath('$.time'),
            }),
        }));
        weeklyReviewRule.addTarget(new targets.LambdaFunction(aiServiceLambda, {
            event: events.RuleTargetInput.fromObject({
                source: 'weekly-review',
                action: 'review',
                timestamp: events.EventField.fromPath('$.time'),
            }),
        }));
        // Removed CloudWatch Log Groups to avoid costs
        // Lambda functions will use default log groups (free tier: 5GB/month)
        // Outputs
        new cdk.CfnOutput(this, 'UserPoolId', {
            value: this.userPool.userPoolId,
            description: 'Cognito User Pool ID',
        });
        new cdk.CfnOutput(this, 'UserPoolClientId', {
            value: this.userPoolClient.userPoolClientId,
            description: 'Cognito User Pool Client ID',
        });
        new cdk.CfnOutput(this, 'UserPoolDomain', {
            value: this.userPoolDomain.domainName,
            description: 'Cognito User Pool Domain',
        });
        new cdk.CfnOutput(this, 'CloudFrontUrl', {
            value: `https://${this.distribution.distributionDomainName}`,
            description: 'CloudFront Distribution URL',
        });
        new cdk.CfnOutput(this, 'TableName', {
            value: this.mainTable.tableName,
            description: 'DynamoDB Table Name',
        });
        // new cdk.CfnOutput(this, 'UserServiceUrl', {
        //   value: userServiceUrl.url,
        //   description: 'User Service Lambda Function URL',
        // });
        new cdk.CfnOutput(this, 'UserProfileServiceUrl', {
            value: userProfileServiceUrl.url,
            description: 'User Profile Service Lambda Function URL',
        });
        new cdk.CfnOutput(this, 'WorkoutServiceUrl', {
            value: workoutServiceUrl.url,
            description: 'Workout Service Lambda Function URL',
        });
        new cdk.CfnOutput(this, 'CoachingServiceUrl', {
            value: coachingServiceUrl.url,
            description: 'Coaching Service Lambda Function URL',
        });
        new cdk.CfnOutput(this, 'AnalyticsServiceUrl', {
            value: analyticsServiceUrl.url,
            description: 'Analytics Service Lambda Function URL',
        });
        new cdk.CfnOutput(this, 'NutritionServiceUrl', {
            value: nutritionServiceUrl.url,
            description: 'Nutrition Service Lambda Function URL',
        });
        new cdk.CfnOutput(this, 'AIServiceUrl', {
            value: aiServiceUrl.url,
            description: 'AI Service Lambda Function URL',
        });
        new cdk.CfnOutput(this, 'NotificationServiceUrl', {
            value: notificationServiceUrl.url,
            description: 'Notification Service Lambda Function URL',
        });
        new cdk.CfnOutput(this, 'UserUploadsBucketName', {
            value: this.userUploadsBucket.bucketName,
            description: 'User Uploads S3 Bucket Name',
        });
        new cdk.CfnOutput(this, 'StaticAssetsBucketName', {
            value: this.staticAssetsBucket.bucketName,
            description: 'Static Assets S3 Bucket Name',
        });
        new cdk.CfnOutput(this, 'ProcessedImagesBucketName', {
            value: this.processedImagesBucket.bucketName,
            description: 'Processed Images S3 Bucket Name',
        });
        new cdk.CfnOutput(this, 'FrontendBucketName', {
            value: this.frontendBucket.bucketName,
            description: 'Frontend S3 Bucket Name',
        });
        new cdk.CfnOutput(this, 'VectorsBucketName', {
            value: this.vectorsBucket.bucketName,
            description: 'S3 Vectors Bucket Name for AI Knowledge Base',
        });
        new cdk.CfnOutput(this, 'CloudFrontDistributionURL', {
            value: `https://${this.distribution.distributionDomainName}`,
            description: 'CloudFront Distribution URL',
        });
        new cdk.CfnOutput(this, 'PostDeploymentInstructions', {
            value: 'After deployment, set CLOUDFRONT_DOMAIN environment variable in AnalyticsService Lambda function',
            description: 'Manual step required after deployment',
        });
        // new cdk.CfnOutput(this, 'WAFWebACLArn', {
        //   value: wafWebAcl.attrArn,
        //   description: 'WAF Web ACL ARN for CloudFront protection',
        // });
        // Removed monitoring stack to avoid CloudWatch costs
        // this.createMonitoringStack();
    }
    createLambdaFunction(name, serviceName, additionalEnvVars) {
        const baseEnvVars = {
            TABLE_NAME: this.mainTable.tableName,
            DYNAMODB_TABLE: this.mainTable.tableName,
            USER_POOL_ID: this.userPool.userPoolId,
            USER_POOL_CLIENT_ID: this.userPoolClient.userPoolClientId,
            USER_UPLOADS_BUCKET: this.userUploadsBucket.bucketName,
            STATIC_ASSETS_BUCKET: this.staticAssetsBucket.bucketName,
            PROCESSED_IMAGES_BUCKET: this.processedImagesBucket.bucketName,
            PROGRESS_PHOTOS_BUCKET: this.progressPhotosBucket.bucketName,
            JWT_SECRET: 'your-jwt-secret-here', // In production, use AWS Secrets Manager
            COGNITO_REGION: this.region,
            COGNITO_USER_POOL_ID: this.userPool.userPoolId,
            RUST_LOG: 'info',
            RUST_BACKTRACE: '1',
        };
        const envVars = additionalEnvVars
            ? { ...baseEnvVars, ...additionalEnvVars }
            : baseEnvVars;
        return new lambda.Function(this, `${name}Lambda`, {
            runtime: lambda.Runtime.PROVIDED_AL2,
            handler: 'bootstrap',
            code: lambda.Code.fromAsset(`../target/lambda/${serviceName}`),
            environment: envVars,
            timeout: cdk.Duration.seconds(30),
            memorySize: 256, // Optimized for cold starts
            // Removed reservedConcurrentExecutions due to low account limit (10 total)
            // reservedConcurrentExecutions: 20, // Increased for development/testing
            // Removed log retention to use free tier defaults (5GB/month free)
            // Removed X-Ray tracing to avoid costs ($5 per 1M traces)
            layers: [this.createAuthLayer()],
        });
    }
    createPythonLambdaFunction(name, serviceName) {
        return new lambda.Function(this, `${name}Lambda`, {
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: 'lambda_function.lambda_handler',
            code: lambda.Code.fromAsset(`../services/${serviceName}`),
            environment: {
                DYNAMODB_TABLE: this.mainTable.tableName,
                USER_POOL_ID: this.userPool.userPoolId,
                USER_POOL_CLIENT_ID: this.userPoolClient.userPoolClientId,
                USER_UPLOADS_BUCKET: this.userUploadsBucket.bucketName,
                STATIC_ASSETS_BUCKET: this.staticAssetsBucket.bucketName,
                PROCESSED_IMAGES_BUCKET: this.processedImagesBucket.bucketName,
                PROGRESS_PHOTOS_BUCKET: this.progressPhotosBucket.bucketName,
                VECTORS_BUCKET: this.vectorsBucket.bucketName,
                JWT_SECRET: 'your-jwt-secret-here', // In production, use AWS Secrets Manager
                COGNITO_REGION: this.region,
                COGNITO_USER_POOL_ID: this.userPool.userPoolId,
                PYTHONPATH: '/var/runtime:/var/task',
                // AI Service specific environment variables
                BEDROCK_MODEL_ID: 'us.amazon.nova-micro-v1:0', // Amazon Nova Micro - cheapest model via cross-region inference
                RATE_LIMIT_FREE_TIER: '10', // Requests per day for free tier
                RATE_LIMIT_PREMIUM_TIER: '50', // Requests per day for premium tier
                RATE_LIMIT_HARD_LIMIT: '100', // Hard limit to prevent abuse
                CONVERSATION_TTL_DAYS: '30', // TTL for conversation history
                RATE_LIMIT_TTL_DAYS: '7', // TTL for rate limit records
            },
            timeout: cdk.Duration.minutes(5), // AI functions may need more time
            memorySize: 1024, // AI functions need more memory
            // Removed reservedConcurrentExecutions due to low account limit (10 total)
            // reservedConcurrentExecutions: 20, // Increased for development/testing
            // Removed log retention to use free tier defaults (5GB/month free)
            // Removed X-Ray tracing to avoid costs ($5 per 1M traces)
            // layers: [this.createPythonAuthLayer()], // Temporarily disabled
        });
    }
    createAuthLayer() {
        if (this.authLayer) {
            return this.authLayer;
        }
        this.authLayer = new lambda.LayerVersion(this, 'AuthLayer', {
            code: lambda.Code.fromAsset('../services/auth-layer/layer'),
            compatibleRuntimes: [lambda.Runtime.PROVIDED_AL2],
            description: 'Authentication and authorization layer for GymCoach AI services',
        });
        return this.authLayer;
    }
    createPythonAuthLayer() {
        if (this.pythonAuthLayer) {
            return this.pythonAuthLayer;
        }
        this.pythonAuthLayer = new lambda.LayerVersion(this, 'PythonAuthLayer', {
            code: lambda.Code.fromAsset('../services/ai-service-python/layer'),
            compatibleRuntimes: [lambda.Runtime.PYTHON_3_11],
            description: 'Python authentication layer for AI services',
        });
        return this.pythonAuthLayer;
    }
}
exports.GymCoachAIStack = GymCoachAIStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3ltY29hY2gtYWktc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvZ3ltY29hY2gtYWktc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBQ25DLGlEQUFpRDtBQUNqRCx5REFBeUQ7QUFDekQsOERBQThEO0FBRTlELHFEQUFxRDtBQUNyRCwyQ0FBMkM7QUFDM0MsbURBQW1EO0FBRW5ELHlDQUF5QztBQUN6QywyQ0FBMkM7QUFDM0MsaURBQWlEO0FBQ2pELDBEQUEwRDtBQVMxRCxNQUFhLGVBQWdCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFnQjVDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBNEI7UUFDcEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIscUNBQXFDO1FBQ3JDLElBQUksQ0FBQyxHQUFHLEdBQUcsS0FBSyxFQUFFLFdBQVcsSUFBSSxLQUFLLENBQUM7UUFFdkMsMENBQTBDO1FBQzFDLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRTtZQUMzRCxTQUFTLEVBQUUsb0JBQW9CLElBQUksQ0FBQyxHQUFHLEVBQUU7WUFDekMsWUFBWSxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUU7WUFDakUsT0FBTyxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUU7WUFDNUQsV0FBVyxFQUFFLFFBQVEsQ0FBQyxXQUFXLENBQUMsZUFBZTtZQUNqRCxhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxPQUFPO1lBQ3hDLGlFQUFpRTtTQUNsRSxDQUFDLENBQUM7UUFFSCx3Q0FBd0M7UUFDeEMsSUFBSSxDQUFDLFNBQVMs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Q0FBcUMsQ0FBQztZQUNsRSxrQkFBa0IsRUFBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDO1lBQ2hELFdBQVcsRUFBRSw2Q0FBNkM7U0FDM0QsQ0FBQyxDQUFDO1FBQ0gsT0FBTyxJQUFJLENBQUMsZUFBZSxDQUFDO0lBQzlCLENBQUM7Q0F1QkY7QUE1NUNELDBDQTQ1Q0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgY2xvdWRmcm9udCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udCc7XG5pbXBvcnQgKiBhcyBvcmlnaW5zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250LW9yaWdpbnMnO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSc7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgY29nbml0byBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY29nbml0byc7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XG5pbXBvcnQgKiBhcyBzbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNucyc7XG5pbXBvcnQgKiBhcyBldmVudHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cyc7XG5pbXBvcnQgKiBhcyB0YXJnZXRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMtdGFyZ2V0cyc7XG5pbXBvcnQgKiBhcyB3YWZ2MiBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtd2FmdjInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG4vLyBSZW1vdmVkIE1vbml0b3JpbmdTdGFjayBpbXBvcnQgdG8gYXZvaWQgQ2xvdWRXYXRjaCBjb3N0c1xuXG5leHBvcnQgaW50ZXJmYWNlIEd5bUNvYWNoQUlTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBlbnZpcm9ubWVudD86ICdkZXYnIHwgJ3Byb2QnO1xufVxuXG5leHBvcnQgY2xhc3MgR3ltQ29hY2hBSVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IHVzZXJQb29sOiBjb2duaXRvLlVzZXJQb29sO1xuICBwdWJsaWMgcmVhZG9ubHkgdXNlclBvb2xDbGllbnQ6IGNvZ25pdG8uVXNlclBvb2xDbGllbnQ7XG4gIHB1YmxpYyByZWFkb25seSB1c2VyUG9vbERvbWFpbjogY29nbml0by5Vc2VyUG9vbERvbWFpbjtcbiAgcHVibGljIHJlYWRvbmx5IG1haW5UYWJsZTogZHluYW1vZGIuVGFibGU7XG4gIHB1YmxpYyByZWFkb25seSBkaXN0cmlidXRpb246IGNsb3VkZnJvbnQuRGlzdHJpYnV0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgdXNlclVwbG9hZHNCdWNrZXQ6IHMzLkJ1Y2tldDtcbiAgcHVibGljIHJlYWRvbmx5IHN0YXRpY0Fzc2V0c0J1Y2tldDogczMuQnVja2V0O1xuICBwdWJsaWMgcmVhZG9ubHkgcHJvY2Vzc2VkSW1hZ2VzQnVja2V0OiBzMy5CdWNrZXQ7XG4gIHB1YmxpYyByZWFkb25seSBwcm9ncmVzc1Bob3Rvc0J1Y2tldDogczMuQnVja2V0O1xuICBwdWJsaWMgcmVhZG9ubHkgZnJvbnRlbmRCdWNrZXQ6IHMzLkJ1Y2tldDtcbiAgcHVibGljIHJlYWRvbmx5IHZlY3RvcnNCdWNrZXQ6IHMzLkJ1Y2tldDtcbiAgcHJpdmF0ZSBhdXRoTGF5ZXI/OiBsYW1iZGEuTGF5ZXJWZXJzaW9uO1xuICBwcml2YXRlIHB5dGhvbkF1dGhMYXllcj86IGxhbWJkYS5MYXllclZlcnNpb247XG4gIHByaXZhdGUgcmVhZG9ubHkgZW52OiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBHeW1Db2FjaEFJU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gU2V0IGVudmlyb25tZW50IChkZWZhdWx0IHRvICdkZXYnKVxuICAgIHRoaXMuZW52ID0gcHJvcHM/LmVudmlyb25tZW50IHx8ICdkZXYnO1xuXG4gICAgLy8gRHluYW1vREIgVGFibGUgd2l0aCBTaW5nbGUgVGFibGUgRGVzaWduXG4gICAgdGhpcy5tYWluVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ0d5bUNvYWNoQUlUYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogYGd5bWNvYWNoLWFpLW1haW4tJHt0aGlzLmVudn1gLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdQSycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdTSycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIC8vIFJlbW92ZWQgcG9pbnRJblRpbWVSZWNvdmVyeSB0byBhdm9pZCBjb3N0cyAoMjAlIG9mIHRhYmxlIGNvc3QpXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgR1NJIGZvciBkaWZmZXJlbnQgYWNjZXNzIHBhdHRlcm5zXG4gICAgdGhpcy5tYWluVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnR1NJMScsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ0dTSTFQSycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdHU0kxU0snLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIENvZ25pdG8gVXNlciBQb29sXG4gICAgdGhpcy51c2VyUG9vbCA9IG5ldyBjb2duaXRvLlVzZXJQb29sKHRoaXMsICdHeW1Db2FjaEFJVXNlclBvb2wnLCB7XG4gICAgICB1c2VyUG9vbE5hbWU6IGBneW1jb2FjaC1haS11c2Vycy0ke3RoaXMuZW52fWAsXG4gICAgICBzZWxmU2lnblVwRW5hYmxlZDogdHJ1ZSxcbiAgICAgIHNpZ25JbkFsaWFzZXM6IHtcbiAgICAgICAgZW1haWw6IHRydWUsXG4gICAgICAgIHVzZXJuYW1lOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIGF1dG9WZXJpZnk6IHtcbiAgICAgICAgZW1haWw6IHRydWUsXG4gICAgICB9LFxuICAgICAgc3RhbmRhcmRBdHRyaWJ1dGVzOiB7XG4gICAgICAgIGVtYWlsOiB7XG4gICAgICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgZ2l2ZW5OYW1lOiB7XG4gICAgICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgZmFtaWx5TmFtZToge1xuICAgICAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgIG11dGFibGU6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgY3VzdG9tQXR0cmlidXRlczoge1xuICAgICAgICBmaXRuZXNzR29hbHM6IG5ldyBjb2duaXRvLlN0cmluZ0F0dHJpYnV0ZSh7XG4gICAgICAgICAgbWluTGVuOiAxLFxuICAgICAgICAgIG1heExlbjogMTAwLFxuICAgICAgICAgIG11dGFibGU6IHRydWUsXG4gICAgICAgIH0pLFxuICAgICAgICBleHBlcmllbmNlTGV2ZWw6IG5ldyBjb2duaXRvLlN0cmluZ0F0dHJpYnV0ZSh7XG4gICAgICAgICAgbWluTGVuOiAxLFxuICAgICAgICAgIG1heExlbjogMjAsXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcbiAgICAgICAgfSksXG4gICAgICAgIHN1YnNjcmlwdGlvblRpZXI6IG5ldyBjb2duaXRvLlN0cmluZ0F0dHJpYnV0ZSh7XG4gICAgICAgICAgbWluTGVuOiAxLFxuICAgICAgICAgIG1heExlbjogMjAsXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcbiAgICAgICAgfSksXG4gICAgICB9LFxuICAgICAgcGFzc3dvcmRQb2xpY3k6IHtcbiAgICAgICAgbWluTGVuZ3RoOiA4LFxuICAgICAgICByZXF1aXJlTG93ZXJjYXNlOiB0cnVlLFxuICAgICAgICByZXF1aXJlVXBwZXJjYXNlOiB0cnVlLFxuICAgICAgICByZXF1aXJlRGlnaXRzOiB0cnVlLFxuICAgICAgICByZXF1aXJlU3ltYm9sczogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBtZmE6IGNvZ25pdG8uTWZhLk9QVElPTkFMLFxuICAgICAgbWZhU2Vjb25kRmFjdG9yOiB7XG4gICAgICAgIHNtczogdHJ1ZSxcbiAgICAgICAgb3RwOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIGRldmljZVRyYWNraW5nOiB7XG4gICAgICAgIGNoYWxsZW5nZVJlcXVpcmVkT25OZXdEZXZpY2U6IHRydWUsXG4gICAgICAgIGRldmljZU9ubHlSZW1lbWJlcmVkT25Vc2VyUHJvbXB0OiBmYWxzZSxcbiAgICAgIH0sXG4gICAgICBhY2NvdW50UmVjb3Zlcnk6IGNvZ25pdG8uQWNjb3VudFJlY292ZXJ5LkVNQUlMX09OTFksXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIFVzZXIgUG9vbCBDbGllbnQgZm9yIFdlYiBBcHBcbiAgICB0aGlzLnVzZXJQb29sQ2xpZW50ID0gbmV3IGNvZ25pdG8uVXNlclBvb2xDbGllbnQodGhpcywgJ1dlYkFwcENsaWVudCcsIHtcbiAgICAgIHVzZXJQb29sOiB0aGlzLnVzZXJQb29sLFxuICAgICAgdXNlclBvb2xDbGllbnROYW1lOiBgZ3ltY29hY2gtYWktd2ViLWNsaWVudC0ke3RoaXMuZW52fWAsXG4gICAgICBnZW5lcmF0ZVNlY3JldDogZmFsc2UsXG4gICAgICBhdXRoRmxvd3M6IHtcbiAgICAgICAgdXNlclBhc3N3b3JkOiB0cnVlLFxuICAgICAgICB1c2VyU3JwOiB0cnVlLFxuICAgICAgICBjdXN0b206IHRydWUsXG4gICAgICB9LFxuICAgICAgb0F1dGg6IHtcbiAgICAgICAgZmxvd3M6IHtcbiAgICAgICAgICBhdXRob3JpemF0aW9uQ29kZUdyYW50OiB0cnVlLFxuICAgICAgICAgIGltcGxpY2l0Q29kZUdyYW50OiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICBzY29wZXM6IFtcbiAgICAgICAgICBjb2duaXRvLk9BdXRoU2NvcGUuRU1BSUwsXG4gICAgICAgICAgY29nbml0by5PQXV0aFNjb3BlLk9QRU5JRCxcbiAgICAgICAgICBjb2duaXRvLk9BdXRoU2NvcGUuUFJPRklMRSxcbiAgICAgICAgXSxcbiAgICAgICAgY2FsbGJhY2tVcmxzOiBbXG4gICAgICAgICAgJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMC9hdXRoL2NhbGxiYWNrJyxcbiAgICAgICAgICAnaHR0cHM6Ly8qLmNsb3VkZnJvbnQubmV0L2F1dGgvY2FsbGJhY2snLFxuICAgICAgICBdLFxuICAgICAgICBsb2dvdXRVcmxzOiBbXG4gICAgICAgICAgJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMC9hdXRoL2xvZ291dCcsXG4gICAgICAgICAgJ2h0dHBzOi8vKi5jbG91ZGZyb250Lm5ldC9hdXRoL2xvZ291dCcsXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgICAgcmVmcmVzaFRva2VuVmFsaWRpdHk6IGNkay5EdXJhdGlvbi5kYXlzKDMwKSxcbiAgICAgIGFjY2Vzc1Rva2VuVmFsaWRpdHk6IGNkay5EdXJhdGlvbi5ob3VycygxKSxcbiAgICAgIGlkVG9rZW5WYWxpZGl0eTogY2RrLkR1cmF0aW9uLmhvdXJzKDEpLFxuICAgICAgcHJldmVudFVzZXJFeGlzdGVuY2VFcnJvcnM6IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgVXNlciBQb29sIERvbWFpblxuICAgIHRoaXMudXNlclBvb2xEb21haW4gPSB0aGlzLnVzZXJQb29sLmFkZERvbWFpbignQ29nbml0b0RvbWFpbicsIHtcbiAgICAgIGNvZ25pdG9Eb21haW46IHtcbiAgICAgICAgZG9tYWluUHJlZml4OiBgZ3ltY29hY2gtYWktJHt0aGlzLmVudn0tJHt0aGlzLmFjY291bnR9YCxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgVXNlciBHcm91cHMgZm9yIFJvbGUtQmFzZWQgQWNjZXNzIENvbnRyb2xcbiAgICBjb25zdCBhZG1pbkdyb3VwID0gbmV3IGNvZ25pdG8uQ2ZuVXNlclBvb2xHcm91cCh0aGlzLCAnQWRtaW5Hcm91cCcsIHtcbiAgICAgIHVzZXJQb29sSWQ6IHRoaXMudXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgIGdyb3VwTmFtZTogJ2FkbWluJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQWRtaW5pc3RyYXRvcnMgd2l0aCBmdWxsIGFjY2VzcycsXG4gICAgICBwcmVjZWRlbmNlOiAxLFxuICAgIH0pO1xuXG4gICAgY29uc3QgY29hY2hHcm91cCA9IG5ldyBjb2duaXRvLkNmblVzZXJQb29sR3JvdXAodGhpcywgJ0NvYWNoR3JvdXAnLCB7XG4gICAgICB1c2VyUG9vbElkOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICBncm91cE5hbWU6ICdjb2FjaCcsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvYWNoZXMgd2l0aCBhY2Nlc3MgdG8gdXNlciBkYXRhIGZvciBjb2FjaGluZycsXG4gICAgICBwcmVjZWRlbmNlOiAyLFxuICAgIH0pO1xuXG4gICAgY29uc3QgdXNlckdyb3VwID0gbmV3IGNvZ25pdG8uQ2ZuVXNlclBvb2xHcm91cCh0aGlzLCAnVXNlckdyb3VwJywge1xuICAgICAgdXNlclBvb2xJZDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgZ3JvdXBOYW1lOiAndXNlcicsXG4gICAgICBkZXNjcmlwdGlvbjogJ1JlZ3VsYXIgdXNlcnMgd2l0aCBhY2Nlc3MgdG8gdGhlaXIgb3duIGRhdGEnLFxuICAgICAgcHJlY2VkZW5jZTogMyxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBTTlMgVG9waWNzIGZvciBkaWZmZXJlbnQgbm90aWZpY2F0aW9uIHR5cGVzXG4gICAgY29uc3Qgd29ya291dFJlbWluZGVyc1RvcGljID0gbmV3IHNucy5Ub3BpYyh0aGlzLCAnV29ya291dFJlbWluZGVyc1RvcGljJywge1xuICAgICAgdG9waWNOYW1lOiBgZ3ltY29hY2gtYWktd29ya291dC1yZW1pbmRlcnMtJHt0aGlzLmVudn1gLFxuICAgICAgZGlzcGxheU5hbWU6ICdXb3Jrb3V0IFJlbWluZGVycycsXG4gICAgfSk7XG5cbiAgICBjb25zdCBudXRyaXRpb25SZW1pbmRlcnNUb3BpYyA9IG5ldyBzbnMuVG9waWMoXG4gICAgICB0aGlzLFxuICAgICAgJ051dHJpdGlvblJlbWluZGVyc1RvcGljJyxcbiAgICAgIHtcbiAgICAgICAgdG9waWNOYW1lOiBgZ3ltY29hY2gtYWktbnV0cml0aW9uLXJlbWluZGVycy0ke3RoaXMuZW52fWAsXG4gICAgICAgIGRpc3BsYXlOYW1lOiAnTnV0cml0aW9uIFJlbWluZGVycycsXG4gICAgICB9XG4gICAgKTtcblxuICAgIGNvbnN0IGFjaGlldmVtZW50VG9waWMgPSBuZXcgc25zLlRvcGljKHRoaXMsICdBY2hpZXZlbWVudFRvcGljJywge1xuICAgICAgdG9waWNOYW1lOiBgZ3ltY29hY2gtYWktYWNoaWV2ZW1lbnRzLSR7dGhpcy5lbnZ9YCxcbiAgICAgIGRpc3BsYXlOYW1lOiAnQWNoaWV2ZW1lbnQgTm90aWZpY2F0aW9ucycsXG4gICAgfSk7XG5cbiAgICBjb25zdCBhaVN1Z2dlc3Rpb25zVG9waWMgPSBuZXcgc25zLlRvcGljKHRoaXMsICdBSVN1Z2dlc3Rpb25zVG9waWMnLCB7XG4gICAgICB0b3BpY05hbWU6IGBneW1jb2FjaC1haS1zdWdnZXN0aW9ucy0ke3RoaXMuZW52fWAsXG4gICAgICBkaXNwbGF5TmFtZTogJ0FJIFN1Z2dlc3Rpb25zJyxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBFdmVudEJyaWRnZSBSdWxlcyBmb3Igc2NoZWR1bGVkIG5vdGlmaWNhdGlvbnNcbiAgICBjb25zdCB3b3Jrb3V0UmVtaW5kZXJSdWxlID0gbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdXb3Jrb3V0UmVtaW5kZXJSdWxlJywge1xuICAgICAgcnVsZU5hbWU6IGBneW1jb2FjaC1haS13b3Jrb3V0LXJlbWluZGVycy0ke3RoaXMuZW52fWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ1RyaWdnZXJzIHdvcmtvdXQgcmVtaW5kZXIgbm90aWZpY2F0aW9ucycsXG4gICAgICBzY2hlZHVsZTogZXZlbnRzLlNjaGVkdWxlLmNyb24oe1xuICAgICAgICBtaW51dGU6ICcwJyxcbiAgICAgICAgaG91cjogJzgnLCAvLyA4IEFNIFVUQyAtIHdpbGwgYmUgYWRqdXN0ZWQgcGVyIHVzZXIgdGltZXpvbmVcbiAgICAgIH0pLFxuICAgIH0pO1xuXG4gICAgY29uc3QgbnV0cml0aW9uUmVtaW5kZXJSdWxlID0gbmV3IGV2ZW50cy5SdWxlKFxuICAgICAgdGhpcyxcbiAgICAgICdOdXRyaXRpb25SZW1pbmRlclJ1bGUnLFxuICAgICAge1xuICAgICAgICBydWxlTmFtZTogYGd5bWNvYWNoLWFpLW51dHJpdGlvbi1yZW1pbmRlcnMtJHt0aGlzLmVudn1gLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ1RyaWdnZXJzIG51dHJpdGlvbiByZW1pbmRlciBub3RpZmljYXRpb25zJyxcbiAgICAgICAgc2NoZWR1bGU6IGV2ZW50cy5TY2hlZHVsZS5jcm9uKHtcbiAgICAgICAgICBtaW51dGU6ICcwJyxcbiAgICAgICAgICBob3VyOiAnMTInLCAvLyAxMiBQTSBVVEMgLSB3aWxsIGJlIGFkanVzdGVkIHBlciB1c2VyIHRpbWV6b25lXG4gICAgICAgIH0pLFxuICAgICAgfVxuICAgICk7XG5cbiAgICBjb25zdCB3YXRlclJlbWluZGVyUnVsZSA9IG5ldyBldmVudHMuUnVsZSh0aGlzLCAnV2F0ZXJSZW1pbmRlclJ1bGUnLCB7XG4gICAgICBydWxlTmFtZTogYGd5bWNvYWNoLWFpLXdhdGVyLXJlbWluZGVycy0ke3RoaXMuZW52fWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ1RyaWdnZXJzIHdhdGVyIGludGFrZSByZW1pbmRlciBub3RpZmljYXRpb25zJyxcbiAgICAgIHNjaGVkdWxlOiBldmVudHMuU2NoZWR1bGUuY3Jvbih7XG4gICAgICAgIG1pbnV0ZTogJzAnLFxuICAgICAgICBob3VyOiAnKicsIC8vIEV2ZXJ5IGhvdXJcbiAgICAgIH0pLFxuICAgIH0pO1xuXG4gICAgY29uc3QgcHJvZ3Jlc3NQaG90b1J1bGUgPSBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ1Byb2dyZXNzUGhvdG9SdWxlJywge1xuICAgICAgcnVsZU5hbWU6IGBneW1jb2FjaC1haS1wcm9ncmVzcy1waG90b3MtJHt0aGlzLmVudn1gLFxuICAgICAgZGVzY3JpcHRpb246ICdUcmlnZ2VycyB3ZWVrbHkgcHJvZ3Jlc3MgcGhvdG8gcmVtaW5kZXJzJyxcbiAgICAgIHNjaGVkdWxlOiBldmVudHMuU2NoZWR1bGUuY3Jvbih7XG4gICAgICAgIG1pbnV0ZTogJzAnLFxuICAgICAgICBob3VyOiAnMTgnLCAvLyA2IFBNIFVUQyBvbiBTdW5kYXlzXG4gICAgICAgIHdlZWtEYXk6ICdTVU4nLFxuICAgICAgfSksXG4gICAgfSk7XG5cbiAgICAvLyBQcm9hY3RpdmUgQ29hY2hpbmcgRXZlbnRCcmlkZ2UgUnVsZXNcbiAgICBjb25zdCBwcm9hY3RpdmVDaGVja0luUnVsZSA9IG5ldyBldmVudHMuUnVsZSh0aGlzLCAnUHJvYWN0aXZlQ2hlY2tJblJ1bGUnLCB7XG4gICAgICBydWxlTmFtZTogYGd5bWNvYWNoLWFpLXByb2FjdGl2ZS1jaGVja2lucy0ke3RoaXMuZW52fWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ1RyaWdnZXJzIHByb2FjdGl2ZSBBSSBjb2FjaCBjaGVjay1pbnMnLFxuICAgICAgc2NoZWR1bGU6IGV2ZW50cy5TY2hlZHVsZS5jcm9uKHtcbiAgICAgICAgbWludXRlOiAnMCcsXG4gICAgICAgIGhvdXI6ICc5JywgLy8gOSBBTSBVVEMgZGFpbHlcbiAgICAgIH0pLFxuICAgIH0pO1xuXG4gICAgY29uc3QgcHJvZ3Jlc3NNb25pdG9yUnVsZSA9IG5ldyBldmVudHMuUnVsZSh0aGlzLCAnUHJvZ3Jlc3NNb25pdG9yUnVsZScsIHtcbiAgICAgIHJ1bGVOYW1lOiBgZ3ltY29hY2gtYWktcHJvZ3Jlc3MtbW9uaXRvcmluZy0ke3RoaXMuZW52fWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ01vbml0b3JzIHVzZXIgcHJvZ3Jlc3MgYW5kIHRyaWdnZXJzIGludGVydmVudGlvbnMnLFxuICAgICAgc2NoZWR1bGU6IGV2ZW50cy5TY2hlZHVsZS5jcm9uKHtcbiAgICAgICAgbWludXRlOiAnMCcsXG4gICAgICAgIGhvdXI6ICc2JywgLy8gNiBBTSBVVEMgZGFpbHlcbiAgICAgIH0pLFxuICAgIH0pO1xuXG4gICAgY29uc3QgcGxhdGVhdURldGVjdGlvblJ1bGUgPSBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ1BsYXRlYXVEZXRlY3Rpb25SdWxlJywge1xuICAgICAgcnVsZU5hbWU6IGBneW1jb2FjaC1haS1wbGF0ZWF1LWRldGVjdGlvbi0ke3RoaXMuZW52fWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ0RldGVjdHMgd29ya291dCBwbGF0ZWF1cyBhbmQgc3VnZ2VzdHMgY2hhbmdlcycsXG4gICAgICBzY2hlZHVsZTogZXZlbnRzLlNjaGVkdWxlLmNyb24oe1xuICAgICAgICBtaW51dGU6ICcwJyxcbiAgICAgICAgaG91cjogJzIwJywgLy8gOCBQTSBVVEMgb24gU3VuZGF5c1xuICAgICAgICB3ZWVrRGF5OiAnU1VOJyxcbiAgICAgIH0pLFxuICAgIH0pO1xuXG4gICAgY29uc3QgbW90aXZhdGlvbkJvb3N0UnVsZSA9IG5ldyBldmVudHMuUnVsZSh0aGlzLCAnTW90aXZhdGlvbkJvb3N0UnVsZScsIHtcbiAgICAgIHJ1bGVOYW1lOiBgZ3ltY29hY2gtYWktbW90aXZhdGlvbi1ib29zdC0ke3RoaXMuZW52fWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ1NlbmRzIG1vdGl2YXRpb25hbCBtZXNzYWdlcyBiYXNlZCBvbiB1c2VyIHBhdHRlcm5zJyxcbiAgICAgIHNjaGVkdWxlOiBldmVudHMuU2NoZWR1bGUuY3Jvbih7XG4gICAgICAgIG1pbnV0ZTogJzAnLFxuICAgICAgICBob3VyOiAnNycsIC8vIDcgQU0gVVRDIG9uIE1vbmRheXNcbiAgICAgICAgd2Vla0RheTogJ01PTicsXG4gICAgICB9KSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHdlZWtseVJldmlld1J1bGUgPSBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ1dlZWtseVJldmlld1J1bGUnLCB7XG4gICAgICBydWxlTmFtZTogYGd5bWNvYWNoLWFpLXdlZWtseS1yZXZpZXctJHt0aGlzLmVudn1gLFxuICAgICAgZGVzY3JpcHRpb246ICdHZW5lcmF0ZXMgd2Vla2x5IHByb2dyZXNzIHJldmlld3MgYW5kIHJlY29tbWVuZGF0aW9ucycsXG4gICAgICBzY2hlZHVsZTogZXZlbnRzLlNjaGVkdWxlLmNyb24oe1xuICAgICAgICBtaW51dGU6ICcwJyxcbiAgICAgICAgaG91cjogJzE5JywgLy8gNyBQTSBVVEMgb24gU3VuZGF5c1xuICAgICAgICB3ZWVrRGF5OiAnU1VOJyxcbiAgICAgIH0pLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIFMzIEJ1Y2tldHMgKG5lZWRlZCBieSBMYW1iZGFzKVxuICAgIHRoaXMudXNlclVwbG9hZHNCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdVc2VyVXBsb2Fkc0J1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGBneW1jb2FjaC1haS11c2VyLXVwbG9hZHMtJHt0aGlzLmVudn0tJHt0aGlzLmFjY291bnR9YCxcbiAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsIC8vIEJsb2NrIGFsbCBwdWJsaWMgYWNjZXNzIC0gb25seSBDbG91ZEZyb250IGNhbiBhY2Nlc3NcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBjb3JzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXG4gICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IFtcbiAgICAgICAgICAgIHMzLkh0dHBNZXRob2RzLkdFVCxcbiAgICAgICAgICAgIHMzLkh0dHBNZXRob2RzLlBVVCxcbiAgICAgICAgICAgIHMzLkh0dHBNZXRob2RzLlBPU1QsXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5ERUxFVEUsXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5IRUFELFxuICAgICAgICAgIF0sXG4gICAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLFxuICAgICAgICAgIGV4cG9zZWRIZWFkZXJzOiBbJ0VUYWcnXSxcbiAgICAgICAgICBtYXhBZ2U6IDMwMDAsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgICAgbGlmZWN5Y2xlUnVsZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAnRGVsZXRlSW5jb21wbGV0ZU11bHRpcGFydFVwbG9hZHMnLFxuICAgICAgICAgIGFib3J0SW5jb21wbGV0ZU11bHRpcGFydFVwbG9hZEFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cyg3KSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAnVHJhbnNpdGlvblRvSUEnLFxuICAgICAgICAgIHRyYW5zaXRpb25zOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHN0b3JhZ2VDbGFzczogczMuU3RvcmFnZUNsYXNzLklORlJFUVVFTlRfQUNDRVNTLFxuICAgICAgICAgICAgICB0cmFuc2l0aW9uQWZ0ZXI6IGNkay5EdXJhdGlvbi5kYXlzKDMwKSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAnVHJhbnNpdGlvblRvR2xhY2llcicsXG4gICAgICAgICAgdHJhbnNpdGlvbnM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgc3RvcmFnZUNsYXNzOiBzMy5TdG9yYWdlQ2xhc3MuR0xBQ0lFUixcbiAgICAgICAgICAgICAgdHJhbnNpdGlvbkFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cyg5MCksXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgdGhpcy5zdGF0aWNBc3NldHNCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdTdGF0aWNBc3NldHNCdWNrZXQnLCB7XG4gICAgICBidWNrZXROYW1lOiBgZ3ltY29hY2gtYWktc3RhdGljLWFzc2V0cy0ke3RoaXMuZW52fS0ke3RoaXMuYWNjb3VudH1gLFxuICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBwdWJsaWNSZWFkQWNjZXNzOiBmYWxzZSxcbiAgICB9KTtcblxuICAgIHRoaXMucHJvY2Vzc2VkSW1hZ2VzQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnUHJvY2Vzc2VkSW1hZ2VzQnVja2V0Jywge1xuICAgICAgYnVja2V0TmFtZTogYGd5bWNvYWNoLWFpLXByb2Nlc3NlZC1pbWFnZXMtJHt0aGlzLmVudn0tJHt0aGlzLmFjY291bnR9YCxcbiAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIGRlZGljYXRlZCBQcm9ncmVzcyBQaG90b3MgUzMgQnVja2V0IHdpdGggZW5oYW5jZWQgc2VjdXJpdHlcbiAgICB0aGlzLnByb2dyZXNzUGhvdG9zQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnUHJvZ3Jlc3NQaG90b3NCdWNrZXQnLCB7XG4gICAgICBidWNrZXROYW1lOiBgZ3ltY29hY2gtYWktcHJvZ3Jlc3MtcGhvdG9zLSR7dGhpcy5lbnZ9LSR7dGhpcy5hY2NvdW50fWAsXG4gICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIGNvcnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGFsbG93ZWRIZWFkZXJzOiBbJyonXSxcbiAgICAgICAgICBhbGxvd2VkTWV0aG9kczogW1xuICAgICAgICAgICAgczMuSHR0cE1ldGhvZHMuR0VULFxuICAgICAgICAgICAgczMuSHR0cE1ldGhvZHMuUFVULFxuICAgICAgICAgICAgczMuSHR0cE1ldGhvZHMuUE9TVCxcbiAgICAgICAgICAgIHMzLkh0dHBNZXRob2RzLkRFTEVURSxcbiAgICAgICAgICAgIHMzLkh0dHBNZXRob2RzLkhFQUQsXG4gICAgICAgICAgXSxcbiAgICAgICAgICBhbGxvd2VkT3JpZ2luczogWycqJ10sXG4gICAgICAgICAgZXhwb3NlZEhlYWRlcnM6IFsnRVRhZyddLFxuICAgICAgICAgIG1heEFnZTogMzAwMCxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgICBsaWZlY3ljbGVSdWxlczogW1xuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdEZWxldGVJbmNvbXBsZXRlTXVsdGlwYXJ0VXBsb2FkcycsXG4gICAgICAgICAgYWJvcnRJbmNvbXBsZXRlTXVsdGlwYXJ0VXBsb2FkQWZ0ZXI6IGNkay5EdXJhdGlvbi5kYXlzKDEpLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdUcmFuc2l0aW9uUHJvZ3Jlc3NQaG90b3NUb0lBJyxcbiAgICAgICAgICB0cmFuc2l0aW9uczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBzdG9yYWdlQ2xhc3M6IHMzLlN0b3JhZ2VDbGFzcy5JTkZSRVFVRU5UX0FDQ0VTUyxcbiAgICAgICAgICAgICAgdHJhbnNpdGlvbkFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cygzMCksXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ0FyY2hpdmVPbGRQcm9ncmVzc1Bob3RvcycsXG4gICAgICAgICAgdHJhbnNpdGlvbnM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgc3RvcmFnZUNsYXNzOiBzMy5TdG9yYWdlQ2xhc3MuR0xBQ0lFUixcbiAgICAgICAgICAgICAgdHJhbnNpdGlvbkFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cygzNjUpLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBDbG91ZEZyb250IE9yaWdpbiBBY2Nlc3MgSWRlbnRpdHkgZm9yIHVzZXIgdXBsb2FkcyBidWNrZXRcbiAgICBjb25zdCB1c2VyVXBsb2Fkc09BSSA9IG5ldyBjbG91ZGZyb250Lk9yaWdpbkFjY2Vzc0lkZW50aXR5KFxuICAgICAgdGhpcyxcbiAgICAgICdVc2VyVXBsb2Fkc09BSScsXG4gICAgICB7XG4gICAgICAgIGNvbW1lbnQ6ICdPcmlnaW4gQWNjZXNzIElkZW50aXR5IGZvciBVc2VyIFVwbG9hZHMgYnVja2V0JyxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gR3JhbnQgQ2xvdWRGcm9udCBPQUkgYWNjZXNzIHRvIHVzZXIgdXBsb2FkcyBidWNrZXRcbiAgICB0aGlzLnVzZXJVcGxvYWRzQnVja2V0LmFkZFRvUmVzb3VyY2VQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgcHJpbmNpcGFsczogW3VzZXJVcGxvYWRzT0FJLmdyYW50UHJpbmNpcGFsXSxcbiAgICAgICAgYWN0aW9uczogWydzMzpHZXRPYmplY3QnXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbYCR7dGhpcy51c2VyVXBsb2Fkc0J1Y2tldC5idWNrZXRBcm59LypgXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIENyZWF0ZSBDbG91ZEZyb250IE9yaWdpbiBBY2Nlc3MgSWRlbnRpdHkgZm9yIHByb2dyZXNzIHBob3RvcyBidWNrZXRcbiAgICBjb25zdCBwcm9ncmVzc1Bob3Rvc09BSSA9IG5ldyBjbG91ZGZyb250Lk9yaWdpbkFjY2Vzc0lkZW50aXR5KFxuICAgICAgdGhpcyxcbiAgICAgICdQcm9ncmVzc1Bob3Rvc09BSScsXG4gICAgICB7XG4gICAgICAgIGNvbW1lbnQ6ICdPcmlnaW4gQWNjZXNzIElkZW50aXR5IGZvciBQcm9ncmVzcyBQaG90b3MgYnVja2V0IHYyJyxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gR3JhbnQgQ2xvdWRGcm9udCBPQUkgYWNjZXNzIHRvIHByb2dyZXNzIHBob3RvcyBidWNrZXRcbiAgICB0aGlzLnByb2dyZXNzUGhvdG9zQnVja2V0LmFkZFRvUmVzb3VyY2VQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgcHJpbmNpcGFsczogW3Byb2dyZXNzUGhvdG9zT0FJLmdyYW50UHJpbmNpcGFsXSxcbiAgICAgICAgYWN0aW9uczogWydzMzpHZXRPYmplY3QnXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbYCR7dGhpcy5wcm9ncmVzc1Bob3Rvc0J1Y2tldC5idWNrZXRBcm59LypgXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIENyZWF0ZSBDbG91ZEZyb250IE9yaWdpbiBBY2Nlc3MgSWRlbnRpdHkgZm9yIGZyb250ZW5kIGJ1Y2tldFxuICAgIGNvbnN0IGZyb250ZW5kT0FJID0gbmV3IGNsb3VkZnJvbnQuT3JpZ2luQWNjZXNzSWRlbnRpdHkoXG4gICAgICB0aGlzLFxuICAgICAgJ0Zyb250ZW5kT0FJJyxcbiAgICAgIHtcbiAgICAgICAgY29tbWVudDogJ09yaWdpbiBBY2Nlc3MgSWRlbnRpdHkgZm9yIEZyb250ZW5kIGJ1Y2tldCcsXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIENyZWF0ZSBGcm9udGVuZCBTMyBCdWNrZXQgZm9yIHN0YXRpYyBhc3NldHNcbiAgICB0aGlzLmZyb250ZW5kQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnRnJvbnRlbmRCdWNrZXQnLCB7XG4gICAgICBidWNrZXROYW1lOiBgZ3ltY29hY2gtYWktZnJvbnRlbmQtJHt0aGlzLmVudn0tJHt0aGlzLmFjY291bnR9YCxcbiAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIHB1YmxpY1JlYWRBY2Nlc3M6IGZhbHNlLCAvLyBPbmx5IENsb3VkRnJvbnQgT0FJIHNob3VsZCBhY2Nlc3NcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsIC8vIEJsb2NrIGFsbCBwdWJsaWMgYWNjZXNzXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgQ2xvdWRGcm9udCBPQUkgYWNjZXNzIHRvIGZyb250ZW5kIGJ1Y2tldFxuICAgIHRoaXMuZnJvbnRlbmRCdWNrZXQuYWRkVG9SZXNvdXJjZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBwcmluY2lwYWxzOiBbZnJvbnRlbmRPQUkuZ3JhbnRQcmluY2lwYWxdLFxuICAgICAgICBhY3Rpb25zOiBbJ3MzOkdldE9iamVjdCddLFxuICAgICAgICByZXNvdXJjZXM6IFtgJHt0aGlzLmZyb250ZW5kQnVja2V0LmJ1Y2tldEFybn0vKmBdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gQ3JlYXRlIFMzIFZlY3RvcnMgQnVja2V0IGZvciBBSSBLbm93bGVkZ2UgQmFzZVxuICAgIHRoaXMudmVjdG9yc0J1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ1ZlY3RvcnNCdWNrZXQnLCB7XG4gICAgICBidWNrZXROYW1lOiBgZ3ltY29hY2gtYWktdmVjdG9ycy0ke3RoaXMuZW52fS0ke3RoaXMuYWNjb3VudH1gLFxuICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBjb3JzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXG4gICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IFtcbiAgICAgICAgICAgIHMzLkh0dHBNZXRob2RzLkdFVCxcbiAgICAgICAgICAgIHMzLkh0dHBNZXRob2RzLlBVVCxcbiAgICAgICAgICAgIHMzLkh0dHBNZXRob2RzLlBPU1QsXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5ERUxFVEUsXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5IRUFELFxuICAgICAgICAgIF0sXG4gICAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLFxuICAgICAgICAgIGV4cG9zZWRIZWFkZXJzOiBbJ0VUYWcnXSxcbiAgICAgICAgICBtYXhBZ2U6IDMwMDAsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgICAgbGlmZWN5Y2xlUnVsZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAnRGVsZXRlSW5jb21wbGV0ZU11bHRpcGFydFVwbG9hZHMnLFxuICAgICAgICAgIGFib3J0SW5jb21wbGV0ZU11bHRpcGFydFVwbG9hZEFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cygxKSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAnVHJhbnNpdGlvblZlY3RvcnNUb0lBJyxcbiAgICAgICAgICB0cmFuc2l0aW9uczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBzdG9yYWdlQ2xhc3M6IHMzLlN0b3JhZ2VDbGFzcy5JTkZSRVFVRU5UX0FDQ0VTUyxcbiAgICAgICAgICAgICAgdHJhbnNpdGlvbkFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cygzMCksXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ0FyY2hpdmVPbGRWZWN0b3JzJyxcbiAgICAgICAgICB0cmFuc2l0aW9uczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBzdG9yYWdlQ2xhc3M6IHMzLlN0b3JhZ2VDbGFzcy5HTEFDSUVSLFxuICAgICAgICAgICAgICB0cmFuc2l0aW9uQWZ0ZXI6IGNkay5EdXJhdGlvbi5kYXlzKDkwKSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgTGFtYmRhIEF1dGhvcml6ZXJcbiAgICBjb25zdCBhdXRob3JpemVyTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQXV0aG9yaXplckxhbWJkYScsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUlubGluZShgXG4gICAgICAgIGNvbnN0IGp3dCA9IHJlcXVpcmUoJ2pzb253ZWJ0b2tlbicpO1xuICAgICAgICBjb25zdCBqd2tzQ2xpZW50ID0gcmVxdWlyZSgnandrcy1yc2EnKTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGNsaWVudCA9IGp3a3NDbGllbnQoe1xuICAgICAgICAgIGp3a3NVcmk6ICdodHRwczovL2NvZ25pdG8taWRwLiR7dGhpcy5yZWdpb259LmFtYXpvbmF3cy5jb20vJHt0aGlzLnVzZXJQb29sLnVzZXJQb29sSWR9Ly53ZWxsLWtub3duL2p3a3MuanNvbidcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICBmdW5jdGlvbiBnZXRLZXkoaGVhZGVyLCBjYWxsYmFjaykge1xuICAgICAgICAgIGNsaWVudC5nZXRTaWduaW5nS2V5KGhlYWRlci5raWQsIChlcnIsIGtleSkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgc2lnbmluZ0tleSA9IGtleS5wdWJsaWNLZXkgfHwga2V5LnJzYVB1YmxpY0tleTtcbiAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHNpZ25pbmdLZXkpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBleHBvcnRzLmhhbmRsZXIgPSBhc3luYyAoZXZlbnQpID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnQXV0aG9yaXplciBldmVudDonLCBKU09OLnN0cmluZ2lmeShldmVudCwgbnVsbCwgMikpO1xuICAgICAgICAgIFxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB0b2tlbiA9IGV2ZW50LmhlYWRlcnMuYXV0aG9yaXphdGlvbj8ucmVwbGFjZSgnQmVhcmVyICcsICcnKTtcbiAgICAgICAgICAgIGlmICghdG9rZW4pIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGdlbmVyYXRlUG9saWN5KCd1c2VyJywgJ0RlbnknLCBldmVudC5tZXRob2RBcm4pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zdCBkZWNvZGVkID0gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgICBqd3QudmVyaWZ5KHRva2VuLCBnZXRLZXksIHsgYWxnb3JpdGhtczogWydSUzI1NiddIH0sIChlcnIsIGRlY29kZWQpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICBlbHNlIHJlc29sdmUoZGVjb2RlZCk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdEZWNvZGVkIHRva2VuOicsIGRlY29kZWQpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gZ2VuZXJhdGVQb2xpY3koZGVjb2RlZC5zdWIsICdBbGxvdycsIGV2ZW50Lm1ldGhvZEFybiwgZGVjb2RlZCk7XG4gICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0F1dGhvcml6YXRpb24gZXJyb3I6JywgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIGdlbmVyYXRlUG9saWN5KCd1c2VyJywgJ0RlbnknLCBldmVudC5tZXRob2RBcm4pO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgXG4gICAgICAgIGZ1bmN0aW9uIGdlbmVyYXRlUG9saWN5KHByaW5jaXBhbElkLCBlZmZlY3QsIHJlc291cmNlLCBjb250ZXh0ID0ge30pIHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgcHJpbmNpcGFsSWQsXG4gICAgICAgICAgICBwb2xpY3lEb2N1bWVudDoge1xuICAgICAgICAgICAgICBWZXJzaW9uOiAnMjAxMi0xMC0xNycsXG4gICAgICAgICAgICAgIFN0YXRlbWVudDogW3tcbiAgICAgICAgICAgICAgICBBY3Rpb246ICdleGVjdXRlLWFwaTpJbnZva2UnLFxuICAgICAgICAgICAgICAgIEVmZmVjdDogZWZmZWN0LFxuICAgICAgICAgICAgICAgIFJlc291cmNlOiByZXNvdXJjZVxuICAgICAgICAgICAgICB9XVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNvbnRleHRcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICBgKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFVTRVJfUE9PTF9JRDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgICBVU0VSX1BPT0xfQ0xJRU5UX0lEOiB0aGlzLnVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXG4gICAgICAgIFRBQkxFX05BTUU6IHRoaXMubWFpblRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBwZXJtaXNzaW9ucyB0byBhdXRob3JpemVyXG4gICAgdGhpcy5tYWluVGFibGUuZ3JhbnRSZWFkRGF0YShhdXRob3JpemVyTGFtYmRhKTtcblxuICAgIC8vIENyZWF0ZSBMYW1iZGEgZnVuY3Rpb25zIGZvciBlYWNoIHNlcnZpY2VcbiAgICAvLyBjb25zdCB1c2VyU2VydmljZUxhbWJkYSA9IHRoaXMuY3JlYXRlTGFtYmRhRnVuY3Rpb24oXG4gICAgLy8gICAnVXNlclNlcnZpY2UnLFxuICAgIC8vICAgJ3VzZXItc2VydmljZSdcbiAgICAvLyApO1xuICAgIGNvbnN0IHVzZXJQcm9maWxlU2VydmljZUxhbWJkYSA9IHRoaXMuY3JlYXRlTGFtYmRhRnVuY3Rpb24oXG4gICAgICAnVXNlclByb2ZpbGVTZXJ2aWNlJyxcbiAgICAgICd1c2VyLXByb2ZpbGUtc2VydmljZSdcbiAgICApO1xuICAgIGNvbnN0IHdvcmtvdXRTZXJ2aWNlTGFtYmRhID0gdGhpcy5jcmVhdGVMYW1iZGFGdW5jdGlvbihcbiAgICAgICdXb3Jrb3V0U2VydmljZScsXG4gICAgICAnd29ya291dC1zZXJ2aWNlJ1xuICAgICk7XG4gICAgY29uc3QgY29hY2hpbmdTZXJ2aWNlTGFtYmRhID0gdGhpcy5jcmVhdGVMYW1iZGFGdW5jdGlvbihcbiAgICAgICdDb2FjaGluZ1NlcnZpY2UnLFxuICAgICAgJ2NvYWNoaW5nLXNlcnZpY2UnXG4gICAgKTtcbiAgICBjb25zdCBhbmFseXRpY3NTZXJ2aWNlTGFtYmRhID0gdGhpcy5jcmVhdGVMYW1iZGFGdW5jdGlvbihcbiAgICAgICdBbmFseXRpY3NTZXJ2aWNlJyxcbiAgICAgICdhbmFseXRpY3Mtc2VydmljZScsXG4gICAgICB7XG4gICAgICAgIC8vIEFkZCBDbG91ZEZyb250IGRvbWFpbiBwbGFjZWhvbGRlciAtIHdpbGwgYmUgdXBkYXRlZCBhZnRlciBkZXBsb3ltZW50XG4gICAgICAgIENMT1VERlJPTlRfRE9NQUlOOiBgZDIwMnFtdGs4a2t4cmEuY2xvdWRmcm9udC5uZXRgLCAvLyBVcGRhdGUgbWFudWFsbHkgYWZ0ZXIgZmlyc3QgZGVwbG95bWVudFxuICAgICAgfVxuICAgICk7XG4gICAgY29uc3QgbnV0cml0aW9uU2VydmljZUxhbWJkYSA9IHRoaXMuY3JlYXRlTGFtYmRhRnVuY3Rpb24oXG4gICAgICAnTnV0cml0aW9uU2VydmljZScsXG4gICAgICAnbnV0cml0aW9uLXNlcnZpY2UnXG4gICAgKTtcbiAgICBjb25zdCBhaVNlcnZpY2VMYW1iZGEgPSB0aGlzLmNyZWF0ZVB5dGhvbkxhbWJkYUZ1bmN0aW9uKFxuICAgICAgJ0FJU2VydmljZScsXG4gICAgICAnYWktc2VydmljZS1weXRob24nXG4gICAgKTtcblxuICAgIC8vIENyZWF0ZSBOb3RpZmljYXRpb24gU2VydmljZSBMYW1iZGFcbiAgICBjb25zdCBub3RpZmljYXRpb25TZXJ2aWNlTGFtYmRhID0gdGhpcy5jcmVhdGVMYW1iZGFGdW5jdGlvbihcbiAgICAgICdOb3RpZmljYXRpb25TZXJ2aWNlJyxcbiAgICAgICdub3RpZmljYXRpb24tc2VydmljZScsXG4gICAgICB7XG4gICAgICAgIFdPUktPVVRfUkVNSU5ERVJTX1RPUElDX0FSTjogd29ya291dFJlbWluZGVyc1RvcGljLnRvcGljQXJuLFxuICAgICAgICBOVVRSSVRJT05fUkVNSU5ERVJTX1RPUElDX0FSTjogbnV0cml0aW9uUmVtaW5kZXJzVG9waWMudG9waWNBcm4sXG4gICAgICAgIEFDSElFVkVNRU5UX1RPUElDX0FSTjogYWNoaWV2ZW1lbnRUb3BpYy50b3BpY0FybixcbiAgICAgICAgQUlfU1VHR0VTVElPTlNfVE9QSUNfQVJOOiBhaVN1Z2dlc3Rpb25zVG9waWMudG9waWNBcm4sXG4gICAgICAgIEZDTV9TRVJWRVJfS0VZOiBwcm9jZXNzLmVudi5GQ01fU0VSVkVSX0tFWSB8fCAncGxhY2Vob2xkZXInLFxuICAgICAgICBGSVJFQkFTRV9QUk9KRUNUX0lEOlxuICAgICAgICAgIHByb2Nlc3MuZW52LkZJUkVCQVNFX1BST0pFQ1RfSUQgfHwgJ2d5bWNvYWNoLTczNTI4JyxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gQ3JlYXRlIE5vdGlmaWNhdGlvbiBTY2hlZHVsZXIgTGFtYmRhXG4gICAgY29uc3Qgbm90aWZpY2F0aW9uU2NoZWR1bGVyTGFtYmRhID0gdGhpcy5jcmVhdGVMYW1iZGFGdW5jdGlvbihcbiAgICAgICdOb3RpZmljYXRpb25TY2hlZHVsZXInLFxuICAgICAgJ25vdGlmaWNhdGlvbi1zY2hlZHVsZXInLFxuICAgICAge1xuICAgICAgICBOT1RJRklDQVRJT05fU0VSVklDRV9GVU5DVElPTl9BUk46ICcnLCAvLyBXaWxsIGJlIHNldCBhZnRlciBjcmVhdGlvblxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBVcGRhdGUgbm90aWZpY2F0aW9uIHNjaGVkdWxlciB3aXRoIHRoZSBjb3JyZWN0IGZ1bmN0aW9uIEFSTlxuICAgIG5vdGlmaWNhdGlvblNjaGVkdWxlckxhbWJkYS5hZGRFbnZpcm9ubWVudChcbiAgICAgICdOT1RJRklDQVRJT05fU0VSVklDRV9GVU5DVElPTl9BUk4nLFxuICAgICAgbm90aWZpY2F0aW9uU2VydmljZUxhbWJkYS5mdW5jdGlvbkFyblxuICAgICk7XG5cbiAgICAvLyBFbmFibGUgTGFtYmRhIEZ1bmN0aW9uIFVSTHNcbiAgICAvLyBjb25zdCB1c2VyU2VydmljZVVybCA9IHVzZXJTZXJ2aWNlTGFtYmRhLmFkZEZ1bmN0aW9uVXJsKHtcbiAgICAvLyAgIGF1dGhUeXBlOiBsYW1iZGEuRnVuY3Rpb25VcmxBdXRoVHlwZS5OT05FLFxuICAgIC8vICAgY29yczoge1xuICAgIC8vICAgICBhbGxvd0NyZWRlbnRpYWxzOiBmYWxzZSxcbiAgICAvLyAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxuICAgIC8vICAgICBhbGxvd2VkTWV0aG9kczogW2xhbWJkYS5IdHRwTWV0aG9kLkFMTF0sXG4gICAgLy8gICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcbiAgICAvLyAgIH0sXG4gICAgLy8gfSk7XG5cbiAgICBjb25zdCB1c2VyUHJvZmlsZVNlcnZpY2VVcmwgPSB1c2VyUHJvZmlsZVNlcnZpY2VMYW1iZGEuYWRkRnVuY3Rpb25Vcmwoe1xuICAgICAgYXV0aFR5cGU6IGxhbWJkYS5GdW5jdGlvblVybEF1dGhUeXBlLk5PTkUsXG4gICAgICBjb3JzOiB7XG4gICAgICAgIGFsbG93Q3JlZGVudGlhbHM6IGZhbHNlLFxuICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXG4gICAgICAgIGFsbG93ZWRNZXRob2RzOiBbbGFtYmRhLkh0dHBNZXRob2QuQUxMXSxcbiAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHdvcmtvdXRTZXJ2aWNlVXJsID0gd29ya291dFNlcnZpY2VMYW1iZGEuYWRkRnVuY3Rpb25Vcmwoe1xuICAgICAgYXV0aFR5cGU6IGxhbWJkYS5GdW5jdGlvblVybEF1dGhUeXBlLk5PTkUsXG4gICAgICBjb3JzOiB7XG4gICAgICAgIGFsbG93Q3JlZGVudGlhbHM6IGZhbHNlLFxuICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXG4gICAgICAgIGFsbG93ZWRNZXRob2RzOiBbbGFtYmRhLkh0dHBNZXRob2QuQUxMXSxcbiAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGNvYWNoaW5nU2VydmljZVVybCA9IGNvYWNoaW5nU2VydmljZUxhbWJkYS5hZGRGdW5jdGlvblVybCh7XG4gICAgICBhdXRoVHlwZTogbGFtYmRhLkZ1bmN0aW9uVXJsQXV0aFR5cGUuTk9ORSxcbiAgICAgIGNvcnM6IHtcbiAgICAgICAgYWxsb3dDcmVkZW50aWFsczogZmFsc2UsXG4gICAgICAgIGFsbG93ZWRIZWFkZXJzOiBbJyonXSxcbiAgICAgICAgYWxsb3dlZE1ldGhvZHM6IFtsYW1iZGEuSHR0cE1ldGhvZC5BTExdLFxuICAgICAgICBhbGxvd2VkT3JpZ2luczogWycqJ10sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgY29uc3QgYW5hbHl0aWNzU2VydmljZVVybCA9IGFuYWx5dGljc1NlcnZpY2VMYW1iZGEuYWRkRnVuY3Rpb25Vcmwoe1xuICAgICAgYXV0aFR5cGU6IGxhbWJkYS5GdW5jdGlvblVybEF1dGhUeXBlLk5PTkUsXG4gICAgICBjb3JzOiB7XG4gICAgICAgIGFsbG93Q3JlZGVudGlhbHM6IGZhbHNlLFxuICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXG4gICAgICAgIGFsbG93ZWRNZXRob2RzOiBbbGFtYmRhLkh0dHBNZXRob2QuQUxMXSxcbiAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IG51dHJpdGlvblNlcnZpY2VVcmwgPSBudXRyaXRpb25TZXJ2aWNlTGFtYmRhLmFkZEZ1bmN0aW9uVXJsKHtcbiAgICAgIGF1dGhUeXBlOiBsYW1iZGEuRnVuY3Rpb25VcmxBdXRoVHlwZS5OT05FLFxuICAgICAgY29yczoge1xuICAgICAgICBhbGxvd0NyZWRlbnRpYWxzOiBmYWxzZSxcbiAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxuICAgICAgICBhbGxvd2VkTWV0aG9kczogW2xhbWJkYS5IdHRwTWV0aG9kLkFMTF0sXG4gICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCBhaVNlcnZpY2VVcmwgPSBhaVNlcnZpY2VMYW1iZGEuYWRkRnVuY3Rpb25Vcmwoe1xuICAgICAgYXV0aFR5cGU6IGxhbWJkYS5GdW5jdGlvblVybEF1dGhUeXBlLk5PTkUsXG4gICAgICBjb3JzOiB7XG4gICAgICAgIGFsbG93Q3JlZGVudGlhbHM6IGZhbHNlLFxuICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXG4gICAgICAgIGFsbG93ZWRNZXRob2RzOiBbbGFtYmRhLkh0dHBNZXRob2QuQUxMXSxcbiAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IG5vdGlmaWNhdGlvblNlcnZpY2VVcmwgPSBub3RpZmljYXRpb25TZXJ2aWNlTGFtYmRhLmFkZEZ1bmN0aW9uVXJsKHtcbiAgICAgIGF1dGhUeXBlOiBsYW1iZGEuRnVuY3Rpb25VcmxBdXRoVHlwZS5OT05FLFxuICAgICAgY29yczoge1xuICAgICAgICBhbGxvd0NyZWRlbnRpYWxzOiBmYWxzZSxcbiAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxuICAgICAgICBhbGxvd2VkTWV0aG9kczogW2xhbWJkYS5IdHRwTWV0aG9kLkFMTF0sXG4gICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgQ2xvdWRGcm9udCBEaXN0cmlidXRpb24gd2l0aCBMYW1iZGEgRnVuY3Rpb24gVVJMcyBhcyBvcmlnaW5zXG4gICAgY29uc3QgdXNlclByb2ZpbGVEb21haW4gPSBjZGsuRm4uc2VsZWN0KFxuICAgICAgMixcbiAgICAgIGNkay5Gbi5zcGxpdCgnLycsIHVzZXJQcm9maWxlU2VydmljZVVybC51cmwpXG4gICAgKTtcbiAgICBjb25zdCB3b3Jrb3V0RG9tYWluID0gY2RrLkZuLnNlbGVjdChcbiAgICAgIDIsXG4gICAgICBjZGsuRm4uc3BsaXQoJy8nLCB3b3Jrb3V0U2VydmljZVVybC51cmwpXG4gICAgKTtcbiAgICBjb25zdCBjb2FjaGluZ0RvbWFpbiA9IGNkay5Gbi5zZWxlY3QoXG4gICAgICAyLFxuICAgICAgY2RrLkZuLnNwbGl0KCcvJywgY29hY2hpbmdTZXJ2aWNlVXJsLnVybClcbiAgICApO1xuICAgIGNvbnN0IGFuYWx5dGljc0RvbWFpbiA9IGNkay5Gbi5zZWxlY3QoXG4gICAgICAyLFxuICAgICAgY2RrLkZuLnNwbGl0KCcvJywgYW5hbHl0aWNzU2VydmljZVVybC51cmwpXG4gICAgKTtcbiAgICBjb25zdCBudXRyaXRpb25Eb21haW4gPSBjZGsuRm4uc2VsZWN0KFxuICAgICAgMixcbiAgICAgIGNkay5Gbi5zcGxpdCgnLycsIG51dHJpdGlvblNlcnZpY2VVcmwudXJsKVxuICAgICk7XG4gICAgY29uc3QgYWlEb21haW4gPSBjZGsuRm4uc2VsZWN0KDIsIGNkay5Gbi5zcGxpdCgnLycsIGFpU2VydmljZVVybC51cmwpKTtcbiAgICBjb25zdCBub3RpZmljYXRpb25Eb21haW4gPSBjZGsuRm4uc2VsZWN0KFxuICAgICAgMixcbiAgICAgIGNkay5Gbi5zcGxpdCgnLycsIG5vdGlmaWNhdGlvblNlcnZpY2VVcmwudXJsKVxuICAgICk7XG5cbiAgICAvLyBXQUYgV2ViIEFDTCAtIENPTU1FTlRFRCBPVVQgKHJlcXVpcmVzIHVzLWVhc3QtMSByZWdpb24gZm9yIENsb3VkRnJvbnQpXG4gICAgLy8gVE9ETzogQ3JlYXRlIFdBRiBpbiB1cy1lYXN0LTEgcmVnaW9uIHNlcGFyYXRlbHkgb3IgdXNlIGNyb3NzLXJlZ2lvbiBhcHByb2FjaFxuICAgIC8vIGNvbnN0IHdhZldlYkFjbCA9IG5ldyB3YWZ2Mi5DZm5XZWJBQ0wodGhpcywgJ0d5bUNvYWNoQUlXQUYnLCB7XG4gICAgLy8gICBuYW1lOiAnZ3ltY29hY2gtYWktd2FmLWJhc2ljJyxcbiAgICAvLyAgIGRlc2NyaXB0aW9uOiAnQmFzaWMgV0FGIGZvciBHeW1Db2FjaCBBSSAtIEVzc2VudGlhbCBwcm90ZWN0aW9uIG9ubHkgKGNvc3Qtb3B0aW1pemVkKScsXG4gICAgLy8gICBzY29wZTogJ0NMT1VERlJPTlQnLFxuICAgIC8vICAgZGVmYXVsdEFjdGlvbjogeyBhbGxvdzoge30gfSxcbiAgICAvLyAgIHJ1bGVzOiBbXG4gICAgLy8gICAgIC8vIEJhc2ljIHJhdGUgbGltaXRpbmcgcnVsZSAtIEVTU0VOVElBTCAoa2VlcHMgY29zdHMgbG93KVxuICAgIC8vICAgICB7XG4gICAgLy8gICAgICAgbmFtZTogJ0Jhc2ljUmF0ZUxpbWl0UnVsZScsXG4gICAgLy8gICAgICAgcHJpb3JpdHk6IDEsXG4gICAgLy8gICAgICAgYWN0aW9uOiB7IGJsb2NrOiB7fSB9LFxuICAgIC8vICAgICAgIHN0YXRlbWVudDoge1xuICAgIC8vICAgICAgICAgcmF0ZUJhc2VkU3RhdGVtZW50OiB7XG4gICAgLy8gICAgICAgICAgIGxpbWl0OiA1MDAwLCAvLyA1MDAwIHJlcXVlc3RzIHBlciA1IG1pbnV0ZXNcbiAgICAvLyAgICAgICAgICAgYWdncmVnYXRlS2V5VHlwZTogJ0lQJyxcbiAgICAvLyAgICAgICAgIH0sXG4gICAgLy8gICAgICAgfSxcbiAgICAvLyAgICAgICB2aXNpYmlsaXR5Q29uZmlnOiB7XG4gICAgLy8gICAgICAgICBzYW1wbGVkUmVxdWVzdHNFbmFibGVkOiBmYWxzZSxcbiAgICAvLyAgICAgICAgIGNsb3VkV2F0Y2hNZXRyaWNzRW5hYmxlZDogZmFsc2UsXG4gICAgLy8gICAgICAgICBtZXRyaWNOYW1lOiAnQmFzaWNSYXRlTGltaXRNZXRyaWMnLFxuICAgIC8vICAgICAgIH0sXG4gICAgLy8gICAgIH0sXG4gICAgLy8gICBdLFxuICAgIC8vICAgdmlzaWJpbGl0eUNvbmZpZzoge1xuICAgIC8vICAgICBzYW1wbGVkUmVxdWVzdHNFbmFibGVkOiBmYWxzZSxcbiAgICAvLyAgICAgY2xvdWRXYXRjaE1ldHJpY3NFbmFibGVkOiBmYWxzZSxcbiAgICAvLyAgICAgbWV0cmljTmFtZTogJ0d5bUNvYWNoQUlXQUZCYXNpY01ldHJpYycsXG4gICAgLy8gICB9LFxuICAgIC8vIH0pO1xuXG4gICAgLy8gQ3JlYXRlIENsb3VkRnJvbnQgRnVuY3Rpb24gZm9yIFVSTCByZXdyaXRpbmcgKGhhbmRsZXMgU1BBIHJvdXRpbmcpXG4gICAgY29uc3QgdXJsUmV3cml0ZUZ1bmN0aW9uID0gbmV3IGNsb3VkZnJvbnQuRnVuY3Rpb24oXG4gICAgICB0aGlzLFxuICAgICAgJ1VybFJld3JpdGVGdW5jdGlvbicsXG4gICAgICB7XG4gICAgICAgIGZ1bmN0aW9uTmFtZTogJ3VybC1yZXdyaXRlLWZ1bmN0aW9uJyxcbiAgICAgICAgY29kZTogY2xvdWRmcm9udC5GdW5jdGlvbkNvZGUuZnJvbUlubGluZShgXG4gICAgICAgIGZ1bmN0aW9uIGhhbmRsZXIoZXZlbnQpIHtcbiAgICAgICAgICB2YXIgcmVxdWVzdCA9IGV2ZW50LnJlcXVlc3Q7XG4gICAgICAgICAgdmFyIHVyaSA9IHJlcXVlc3QudXJpO1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIEhhbmRsZSByb290IHBhdGggLSByZWRpcmVjdCB0byAvZW4gKGRlZmF1bHQgbG9jYWxlKVxuICAgICAgICAgIGlmICh1cmkgPT09ICcvJyB8fCB1cmkgPT09ICcnKSB7XG4gICAgICAgICAgICAvLyBDaGVjayBmb3IgcHJlZmVycmVkIGxvY2FsZSBpbiBjb29raWVcbiAgICAgICAgICAgIHZhciBjb29raWVzID0gcmVxdWVzdC5jb29raWVzO1xuICAgICAgICAgICAgdmFyIHByZWZlcnJlZExvY2FsZSA9ICdlbic7IC8vIGRlZmF1bHRcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKGNvb2tpZXMucHJlZmVycmVkTG9jYWxlICYmIGNvb2tpZXMucHJlZmVycmVkTG9jYWxlLnZhbHVlKSB7XG4gICAgICAgICAgICAgIHZhciBsb2NhbGUgPSBjb29raWVzLnByZWZlcnJlZExvY2FsZS52YWx1ZTtcbiAgICAgICAgICAgICAgdmFyIHN1cHBvcnRlZExvY2FsZXMgPSBbJ2VuJywgJ2FyJywgJ3N2J107XG4gICAgICAgICAgICAgIGlmIChzdXBwb3J0ZWRMb2NhbGVzLmluZGV4T2YobG9jYWxlKSAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICBwcmVmZXJyZWRMb2NhbGUgPSBsb2NhbGU7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gUmVkaXJlY3QgdG8gdGhlIHByZWZlcnJlZCBsb2NhbGVcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIHN0YXR1c0NvZGU6IDMwMixcbiAgICAgICAgICAgICAgc3RhdHVzRGVzY3JpcHRpb246ICdGb3VuZCcsXG4gICAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgICBsb2NhdGlvbjogeyB2YWx1ZTogJy8nICsgcHJlZmVycmVkTG9jYWxlIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgLy8gSWYgVVJJIGhhcyBhIGZpbGUgZXh0ZW5zaW9uLCByZXR1cm4gYXMtaXNcbiAgICAgICAgICBpZiAoL1xcXFwuW2EtekEtWjAtOV0rJC8udGVzdCh1cmkpKSB7XG4gICAgICAgICAgICByZXR1cm4gcmVxdWVzdDtcbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgLy8gSGFuZGxlIGxvY2FsZSByb3V0ZXMgKGUuZy4sIC9lbiwgL2FyLCAvc3YpXG4gICAgICAgICAgdmFyIHN1cHBvcnRlZExvY2FsZXMgPSBbJ2VuJywgJ2FyJywgJ3N2J107XG4gICAgICAgICAgdmFyIHBhdGhTZWdtZW50cyA9IHVyaS5zcGxpdCgnLycpLmZpbHRlcihmdW5jdGlvbihzZWdtZW50KSB7IHJldHVybiBzZWdtZW50Lmxlbmd0aCA+IDA7IH0pO1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIElmIHRoZSBmaXJzdCBzZWdtZW50IGlzIGEgc3VwcG9ydGVkIGxvY2FsZVxuICAgICAgICAgIGlmIChwYXRoU2VnbWVudHMubGVuZ3RoID4gMCAmJiBzdXBwb3J0ZWRMb2NhbGVzLmluZGV4T2YocGF0aFNlZ21lbnRzWzBdKSAhPT0gLTEpIHtcbiAgICAgICAgICAgIC8vIEZvciBsb2NhbGUgcm91dGVzLCBzZXJ2ZSB0aGUgc3BlY2lmaWMgcm91dGUncyBpbmRleC5odG1sXG4gICAgICAgICAgICBpZiAocGF0aFNlZ21lbnRzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgICAvLyBSb290IGxvY2FsZSByb3V0ZSAoZS5nLiwgL2VuKVxuICAgICAgICAgICAgICByZXF1ZXN0LnVyaSA9ICcvJyArIHBhdGhTZWdtZW50c1swXSArICcvaW5kZXguaHRtbCc7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyBOZXN0ZWQgbG9jYWxlIHJvdXRlIChlLmcuLCAvZW4vcHJvZmlsZSlcbiAgICAgICAgICAgICAgcmVxdWVzdC51cmkgPSB1cmkgKyAnL2luZGV4Lmh0bWwnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHJlcXVlc3Q7XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIC8vIElmIFVSSSBlbmRzIHdpdGggLywgYXBwZW5kIGluZGV4Lmh0bWxcbiAgICAgICAgICBpZiAodXJpLmVuZHNXaXRoKCcvJykpIHtcbiAgICAgICAgICAgIHJlcXVlc3QudXJpICs9ICdpbmRleC5odG1sJztcbiAgICAgICAgICAgIHJldHVybiByZXF1ZXN0O1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICAvLyBGb3IgcGF0aHMgd2l0aG91dCBleHRlbnNpb24gYW5kIHdpdGhvdXQgdHJhaWxpbmcgc2xhc2gsXG4gICAgICAgICAgLy8gY2hlY2sgaWYgaXQncyBsaWtlbHkgYSByb3V0ZSAobm90IGEgZmlsZSlcbiAgICAgICAgICBpZiAoIXVyaS5pbmNsdWRlcygnLicpKSB7XG4gICAgICAgICAgICAvLyBGb3Igc3RhdGljIGV4cG9ydCwgYWx3YXlzIHNlcnZlIHRoZSBzcGVjaWZpYyByb3V0ZSdzIGluZGV4Lmh0bWxcbiAgICAgICAgICAgIHJlcXVlc3QudXJpID0gdXJpICsgJy9pbmRleC5odG1sJztcbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgcmV0dXJuIHJlcXVlc3Q7XG4gICAgICAgIH1cbiAgICAgIGApLFxuICAgICAgICBjb21tZW50OlxuICAgICAgICAgICdVUkwgcmV3cml0ZSBmdW5jdGlvbiBmb3IgU1BBIHJvdXRpbmcgd2l0aCBpMThuIHN1cHBvcnQgLSBzZXJ2ZXMgaW5kZXguaHRtbCBmb3IgYWxsIHJvdXRlcyBpbmNsdWRpbmcgbG9jYWxlIHJvdXRlcyBhbmQgaGFuZGxlcyBsb2NhbGUgcmVkaXJlY3Rpb24gZnJvbSByb290JyxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgdGhpcy5kaXN0cmlidXRpb24gPSBuZXcgY2xvdWRmcm9udC5EaXN0cmlidXRpb24oXG4gICAgICB0aGlzLFxuICAgICAgJ0d5bUNvYWNoQUlEaXN0cmlidXRpb24nLFxuICAgICAge1xuICAgICAgICBkZWZhdWx0Um9vdE9iamVjdDogJ2luZGV4Lmh0bWwnLFxuICAgICAgICAvLyB3ZWJBY2xJZDogd2FmV2ViQWNsLmF0dHJBcm4sIC8vIENvbW1lbnRlZCBvdXQgLSBXQUYgcmVxdWlyZXMgdXMtZWFzdC0xIHJlZ2lvblxuICAgICAgICBkZWZhdWx0QmVoYXZpb3I6IHtcbiAgICAgICAgICBvcmlnaW46IG9yaWdpbnMuUzNCdWNrZXRPcmlnaW4ud2l0aE9yaWdpbkFjY2Vzc0lkZW50aXR5KFxuICAgICAgICAgICAgdGhpcy5mcm9udGVuZEJ1Y2tldCxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgb3JpZ2luQWNjZXNzSWRlbnRpdHk6IGZyb250ZW5kT0FJLFxuICAgICAgICAgICAgfVxuICAgICAgICAgICksXG4gICAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6XG4gICAgICAgICAgICBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0dFVF9IRUFEX09QVElPTlMsXG4gICAgICAgICAgY2FjaGVQb2xpY3k6IG5ldyBjbG91ZGZyb250LkNhY2hlUG9saWN5KHRoaXMsICdGcm9udGVuZENhY2hlUG9saWN5Jywge1xuICAgICAgICAgICAgY2FjaGVQb2xpY3lOYW1lOiAnZnJvbnRlbmQtY2FjaGUtcG9saWN5JyxcbiAgICAgICAgICAgIGRlZmF1bHRUdGw6IGNkay5EdXJhdGlvbi5ob3VycygyNCksXG4gICAgICAgICAgICBtYXhUdGw6IGNkay5EdXJhdGlvbi5kYXlzKDM2NSksXG4gICAgICAgICAgICBtaW5UdGw6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDApLFxuICAgICAgICAgICAgaGVhZGVyQmVoYXZpb3I6IGNsb3VkZnJvbnQuQ2FjaGVIZWFkZXJCZWhhdmlvci5hbGxvd0xpc3QoXG4gICAgICAgICAgICAgICdDbG91ZEZyb250LVZpZXdlci1Db3VudHJ5J1xuICAgICAgICAgICAgKSxcbiAgICAgICAgICAgIHF1ZXJ5U3RyaW5nQmVoYXZpb3I6IGNsb3VkZnJvbnQuQ2FjaGVRdWVyeVN0cmluZ0JlaGF2aW9yLmFsbCgpLFxuICAgICAgICAgICAgY29va2llQmVoYXZpb3I6IGNsb3VkZnJvbnQuQ2FjaGVDb29raWVCZWhhdmlvci5ub25lKCksXG4gICAgICAgICAgfSksXG4gICAgICAgICAgZnVuY3Rpb25Bc3NvY2lhdGlvbnM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgZnVuY3Rpb246IHVybFJld3JpdGVGdW5jdGlvbixcbiAgICAgICAgICAgICAgZXZlbnRUeXBlOiBjbG91ZGZyb250LkZ1bmN0aW9uRXZlbnRUeXBlLlZJRVdFUl9SRVFVRVNULFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgICBhZGRpdGlvbmFsQmVoYXZpb3JzOiB7XG4gICAgICAgICAgLy8gJy9hcGkvdXNlcnMvKic6IHtcbiAgICAgICAgICAvLyAgIG9yaWdpbjogbmV3IG9yaWdpbnMuSHR0cE9yaWdpbih1c2VyU2VydmljZVVybC51cmwpLFxuICAgICAgICAgIC8vICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6XG4gICAgICAgICAgLy8gICAgIGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgICAgLy8gICBhbGxvd2VkTWV0aG9kczogY2xvdWRmcm9udC5BbGxvd2VkTWV0aG9kcy5BTExPV19BTEwsXG4gICAgICAgICAgLy8gICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX0RJU0FCTEVELFxuICAgICAgICAgIC8vICAgb3JpZ2luUmVxdWVzdFBvbGljeTpcbiAgICAgICAgICAvLyAgICAgY2xvdWRmcm9udC5PcmlnaW5SZXF1ZXN0UG9saWN5LkFMTF9WSUVXRVJfRVhDRVBUX0hPU1RfSEVBREVSLFxuICAgICAgICAgIC8vIH0sXG4gICAgICAgICAgJy9hcGkvdXNlci1wcm9maWxlcy8qJzoge1xuICAgICAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5IdHRwT3JpZ2luKHVzZXJQcm9maWxlRG9tYWluKSxcbiAgICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OlxuICAgICAgICAgICAgICBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfQUxMLFxuICAgICAgICAgICAgY2FjaGVQb2xpY3k6IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3kuQ0FDSElOR19ESVNBQkxFRCxcbiAgICAgICAgICAgIG9yaWdpblJlcXVlc3RQb2xpY3k6XG4gICAgICAgICAgICAgIGNsb3VkZnJvbnQuT3JpZ2luUmVxdWVzdFBvbGljeS5BTExfVklFV0VSX0VYQ0VQVF9IT1NUX0hFQURFUixcbiAgICAgICAgICB9LFxuICAgICAgICAgICcvYXBpL3dvcmtvdXRzLyonOiB7XG4gICAgICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLkh0dHBPcmlnaW4od29ya291dERvbWFpbiksXG4gICAgICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTpcbiAgICAgICAgICAgICAgY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0FMTCxcbiAgICAgICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfRElTQUJMRUQsXG4gICAgICAgICAgICBvcmlnaW5SZXF1ZXN0UG9saWN5OlxuICAgICAgICAgICAgICBjbG91ZGZyb250Lk9yaWdpblJlcXVlc3RQb2xpY3kuQUxMX1ZJRVdFUl9FWENFUFRfSE9TVF9IRUFERVIsXG4gICAgICAgICAgfSxcbiAgICAgICAgICAnL2FwaS9jb2FjaGluZy8qJzoge1xuICAgICAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5IdHRwT3JpZ2luKGNvYWNoaW5nRG9tYWluKSxcbiAgICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OlxuICAgICAgICAgICAgICBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfQUxMLFxuICAgICAgICAgICAgY2FjaGVQb2xpY3k6IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3kuQ0FDSElOR19ESVNBQkxFRCxcbiAgICAgICAgICAgIG9yaWdpblJlcXVlc3RQb2xpY3k6XG4gICAgICAgICAgICAgIGNsb3VkZnJvbnQuT3JpZ2luUmVxdWVzdFBvbGljeS5BTExfVklFV0VSX0VYQ0VQVF9IT1NUX0hFQURFUixcbiAgICAgICAgICB9LFxuICAgICAgICAgICcvYXBpL2FuYWx5dGljcy8qJzoge1xuICAgICAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5IdHRwT3JpZ2luKGFuYWx5dGljc0RvbWFpbiksXG4gICAgICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTpcbiAgICAgICAgICAgICAgY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0FMTCxcbiAgICAgICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfRElTQUJMRUQsXG4gICAgICAgICAgICBvcmlnaW5SZXF1ZXN0UG9saWN5OlxuICAgICAgICAgICAgICBjbG91ZGZyb250Lk9yaWdpblJlcXVlc3RQb2xpY3kuQUxMX1ZJRVdFUl9FWENFUFRfSE9TVF9IRUFERVIsXG4gICAgICAgICAgfSxcbiAgICAgICAgICAnL2FwaS9udXRyaXRpb24vKic6IHtcbiAgICAgICAgICAgIG9yaWdpbjogbmV3IG9yaWdpbnMuSHR0cE9yaWdpbihudXRyaXRpb25Eb21haW4pLFxuICAgICAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6XG4gICAgICAgICAgICAgIGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgICAgICBhbGxvd2VkTWV0aG9kczogY2xvdWRmcm9udC5BbGxvd2VkTWV0aG9kcy5BTExPV19BTEwsXG4gICAgICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX0RJU0FCTEVELFxuICAgICAgICAgICAgb3JpZ2luUmVxdWVzdFBvbGljeTpcbiAgICAgICAgICAgICAgY2xvdWRmcm9udC5PcmlnaW5SZXF1ZXN0UG9saWN5LkFMTF9WSUVXRVJfRVhDRVBUX0hPU1RfSEVBREVSLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgJy9hcGkvYWkvKic6IHtcbiAgICAgICAgICAgIG9yaWdpbjogbmV3IG9yaWdpbnMuSHR0cE9yaWdpbihhaURvbWFpbiwge1xuICAgICAgICAgICAgICBjb25uZWN0aW9uVGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTApLFxuICAgICAgICAgICAgICBjb25uZWN0aW9uQXR0ZW1wdHM6IDMsXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OlxuICAgICAgICAgICAgICBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfQUxMLFxuICAgICAgICAgICAgY2FjaGVQb2xpY3k6IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3kuQ0FDSElOR19ESVNBQkxFRCxcbiAgICAgICAgICAgIG9yaWdpblJlcXVlc3RQb2xpY3k6XG4gICAgICAgICAgICAgIGNsb3VkZnJvbnQuT3JpZ2luUmVxdWVzdFBvbGljeS5BTExfVklFV0VSX0VYQ0VQVF9IT1NUX0hFQURFUixcbiAgICAgICAgICB9LFxuICAgICAgICAgICcvYXBpL25vdGlmaWNhdGlvbnMvKic6IHtcbiAgICAgICAgICAgIG9yaWdpbjogbmV3IG9yaWdpbnMuSHR0cE9yaWdpbihub3RpZmljYXRpb25Eb21haW4pLFxuICAgICAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6XG4gICAgICAgICAgICAgIGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgICAgICBhbGxvd2VkTWV0aG9kczogY2xvdWRmcm9udC5BbGxvd2VkTWV0aG9kcy5BTExPV19BTEwsXG4gICAgICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX0RJU0FCTEVELFxuICAgICAgICAgICAgb3JpZ2luUmVxdWVzdFBvbGljeTpcbiAgICAgICAgICAgICAgY2xvdWRmcm9udC5PcmlnaW5SZXF1ZXN0UG9saWN5LkFMTF9WSUVXRVJfRVhDRVBUX0hPU1RfSEVBREVSLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgJy9wcm9ncmVzcy1waG90b3MvKic6IHtcbiAgICAgICAgICAgIG9yaWdpbjogb3JpZ2lucy5TM0J1Y2tldE9yaWdpbi53aXRoT3JpZ2luQWNjZXNzSWRlbnRpdHkoXG4gICAgICAgICAgICAgIHRoaXMucHJvZ3Jlc3NQaG90b3NCdWNrZXQsXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBvcmlnaW5BY2Nlc3NJZGVudGl0eTogcHJvZ3Jlc3NQaG90b3NPQUksXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICksXG4gICAgICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTpcbiAgICAgICAgICAgICAgY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0dFVF9IRUFELFxuICAgICAgICAgICAgY2FjaGVQb2xpY3k6IG5ldyBjbG91ZGZyb250LkNhY2hlUG9saWN5KFxuICAgICAgICAgICAgICB0aGlzLFxuICAgICAgICAgICAgICAnUHJvZ3Jlc3NQaG90b3NDYWNoZVBvbGljeScsXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjYWNoZVBvbGljeU5hbWU6ICdwcm9ncmVzcy1waG90b3MtY2FjaGUtcG9saWN5JyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0VHRsOiBjZGsuRHVyYXRpb24uaG91cnMoMjQpLFxuICAgICAgICAgICAgICAgIG1heFR0bDogY2RrLkR1cmF0aW9uLmRheXMoMzY1KSxcbiAgICAgICAgICAgICAgICBtaW5UdGw6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDApLFxuICAgICAgICAgICAgICAgIGhlYWRlckJlaGF2aW9yOiBjbG91ZGZyb250LkNhY2hlSGVhZGVyQmVoYXZpb3IuYWxsb3dMaXN0KFxuICAgICAgICAgICAgICAgICAgJ0Nsb3VkRnJvbnQtVmlld2VyLUNvdW50cnknXG4gICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICBxdWVyeVN0cmluZ0JlaGF2aW9yOiBjbG91ZGZyb250LkNhY2hlUXVlcnlTdHJpbmdCZWhhdmlvci5ub25lKCksXG4gICAgICAgICAgICAgICAgY29va2llQmVoYXZpb3I6IGNsb3VkZnJvbnQuQ2FjaGVDb29raWVCZWhhdmlvci5ub25lKCksXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICksXG4gICAgICAgICAgfSxcbiAgICAgICAgICAnL3VzZXItdXBsb2Fkcy8qJzoge1xuICAgICAgICAgICAgb3JpZ2luOiBvcmlnaW5zLlMzQnVja2V0T3JpZ2luLndpdGhPcmlnaW5BY2Nlc3NJZGVudGl0eShcbiAgICAgICAgICAgICAgdGhpcy51c2VyVXBsb2Fkc0J1Y2tldCxcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG9yaWdpbkFjY2Vzc0lkZW50aXR5OiB1c2VyVXBsb2Fkc09BSSxcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKSxcbiAgICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OlxuICAgICAgICAgICAgICBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfR0VUX0hFQUQsXG4gICAgICAgICAgICBjYWNoZVBvbGljeTogbmV3IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3koXG4gICAgICAgICAgICAgIHRoaXMsXG4gICAgICAgICAgICAgICdVc2VyVXBsb2Fkc0NhY2hlUG9saWN5JyxcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNhY2hlUG9saWN5TmFtZTogJ3VzZXItdXBsb2Fkcy1jYWNoZS1wb2xpY3knLFxuICAgICAgICAgICAgICAgIGRlZmF1bHRUdGw6IGNkay5EdXJhdGlvbi5ob3VycygyNCksXG4gICAgICAgICAgICAgICAgbWF4VHRsOiBjZGsuRHVyYXRpb24uZGF5cygzNjUpLFxuICAgICAgICAgICAgICAgIG1pblR0bDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMCksXG4gICAgICAgICAgICAgICAgaGVhZGVyQmVoYXZpb3I6IGNsb3VkZnJvbnQuQ2FjaGVIZWFkZXJCZWhhdmlvci5hbGxvd0xpc3QoXG4gICAgICAgICAgICAgICAgICAnQ2xvdWRGcm9udC1WaWV3ZXItQ291bnRyeSdcbiAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgIHF1ZXJ5U3RyaW5nQmVoYXZpb3I6IGNsb3VkZnJvbnQuQ2FjaGVRdWVyeVN0cmluZ0JlaGF2aW9yLm5vbmUoKSxcbiAgICAgICAgICAgICAgICBjb29raWVCZWhhdmlvcjogY2xvdWRmcm9udC5DYWNoZUNvb2tpZUJlaGF2aW9yLm5vbmUoKSxcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBjb21tZW50OiAnR3ltQ29hY2ggQUkgQ2xvdWRGcm9udCBEaXN0cmlidXRpb24nLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBBZGQgQ2xvdWRGcm9udCBkb21haW4gdG8gYW5hbHl0aWNzIHNlcnZpY2UgZW52aXJvbm1lbnRcbiAgICAvLyBUaGlzIG11c3QgYmUgZG9uZSB2aWEgQ0RLIG91dHB1dCBhbmQgbWFudWFsIHVwZGF0ZSB0byBhdm9pZCBjaXJjdWxhciBkZXBlbmRlbmN5XG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Nsb3VkRnJvbnREb21haW5Gb3JBbmFseXRpY3MnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5kaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uRG9tYWluTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOlxuICAgICAgICAnQ2xvdWRGcm9udCBkb21haW4gLSB1c2UgdGhpcyB0byB1cGRhdGUgQW5hbHl0aWNzU2VydmljZSBMYW1iZGEgQ0xPVURGUk9OVF9ET01BSU4gZW52IHZhcicsXG4gICAgICBleHBvcnROYW1lOiAnR3ltQ29hY2hBSS1DbG91ZEZyb250RG9tYWluJyxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IHBlcm1pc3Npb25zIHRvIExhbWJkYSBmdW5jdGlvbnMgZm9yIFMzIGFjY2Vzc1xuICAgIHRoaXMudXNlclVwbG9hZHNCdWNrZXQuZ3JhbnRSZWFkV3JpdGUodXNlclByb2ZpbGVTZXJ2aWNlTGFtYmRhKTtcbiAgICB0aGlzLnVzZXJVcGxvYWRzQnVja2V0LmdyYW50UmVhZFdyaXRlKHdvcmtvdXRTZXJ2aWNlTGFtYmRhKTtcbiAgICB0aGlzLnVzZXJVcGxvYWRzQnVja2V0LmdyYW50UmVhZFdyaXRlKGFuYWx5dGljc1NlcnZpY2VMYW1iZGEpO1xuXG4gICAgdGhpcy5wcm9jZXNzZWRJbWFnZXNCdWNrZXQuZ3JhbnRSZWFkV3JpdGUodXNlclByb2ZpbGVTZXJ2aWNlTGFtYmRhKTtcbiAgICB0aGlzLnByb2Nlc3NlZEltYWdlc0J1Y2tldC5ncmFudFJlYWRXcml0ZSh3b3Jrb3V0U2VydmljZUxhbWJkYSk7XG4gICAgdGhpcy5wcm9jZXNzZWRJbWFnZXNCdWNrZXQuZ3JhbnRSZWFkV3JpdGUoYW5hbHl0aWNzU2VydmljZUxhbWJkYSk7XG5cbiAgICAvLyBHcmFudCBhbmFseXRpY3Mgc2VydmljZSBmdWxsIGFjY2VzcyB0byBwcm9ncmVzcyBwaG90b3MgYnVja2V0XG4gICAgdGhpcy5wcm9ncmVzc1Bob3Rvc0J1Y2tldC5ncmFudFJlYWRXcml0ZShhbmFseXRpY3NTZXJ2aWNlTGFtYmRhKTtcblxuICAgIC8vIEdyYW50IEFJIHNlcnZpY2UgYWNjZXNzIHRvIHZlY3RvcnMgYnVja2V0XG4gICAgdGhpcy52ZWN0b3JzQnVja2V0LmdyYW50UmVhZFdyaXRlKGFpU2VydmljZUxhbWJkYSk7XG5cbiAgICAvLyBBbGxvdyBzZXJ2aWNlIHRvIHJlYWQgZnJvbSB0aGUgbWFpbiBEeW5hbW9EQiB0YWJsZVxuICAgIHRoaXMubWFpblRhYmxlLmdyYW50UmVhZERhdGEoYW5hbHl0aWNzU2VydmljZUxhbWJkYSk7XG4gICAgdGhpcy5tYWluVGFibGUuZ3JhbnRSZWFkRGF0YShudXRyaXRpb25TZXJ2aWNlTGFtYmRhKTtcbiAgICB0aGlzLm1haW5UYWJsZS5ncmFudFJlYWREYXRhKHVzZXJQcm9maWxlU2VydmljZUxhbWJkYSk7XG4gICAgdGhpcy5tYWluVGFibGUuZ3JhbnRSZWFkRGF0YSh3b3Jrb3V0U2VydmljZUxhbWJkYSk7XG4gICAgdGhpcy5tYWluVGFibGUuZ3JhbnRSZWFkRGF0YShjb2FjaGluZ1NlcnZpY2VMYW1iZGEpO1xuICAgIHRoaXMubWFpblRhYmxlLmdyYW50UmVhZERhdGEoYWlTZXJ2aWNlTGFtYmRhKTtcbiAgICB0aGlzLm1haW5UYWJsZS5ncmFudFdyaXRlRGF0YShhbmFseXRpY3NTZXJ2aWNlTGFtYmRhKTtcbiAgICB0aGlzLm1haW5UYWJsZS5ncmFudFdyaXRlRGF0YShudXRyaXRpb25TZXJ2aWNlTGFtYmRhKTtcbiAgICB0aGlzLm1haW5UYWJsZS5ncmFudFdyaXRlRGF0YSh1c2VyUHJvZmlsZVNlcnZpY2VMYW1iZGEpO1xuICAgIHRoaXMubWFpblRhYmxlLmdyYW50V3JpdGVEYXRhKHdvcmtvdXRTZXJ2aWNlTGFtYmRhKTtcbiAgICB0aGlzLm1haW5UYWJsZS5ncmFudFdyaXRlRGF0YShjb2FjaGluZ1NlcnZpY2VMYW1iZGEpO1xuICAgIHRoaXMubWFpblRhYmxlLmdyYW50V3JpdGVEYXRhKGFpU2VydmljZUxhbWJkYSk7XG5cbiAgICAvLyBFbnN1cmUgbnV0cml0aW9uIHNlcnZpY2UgY2FuIFF1ZXJ5IEdTSXMgZXhwbGljaXRseVxuICAgIG51dHJpdGlvblNlcnZpY2VMYW1iZGEuYWRkVG9Sb2xlUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFsnZHluYW1vZGI6UXVlcnknLCAnZHluYW1vZGI6R2V0SXRlbSddLFxuICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICB0aGlzLm1haW5UYWJsZS50YWJsZUFybixcbiAgICAgICAgICBgJHt0aGlzLm1haW5UYWJsZS50YWJsZUFybn0vaW5kZXgvKmAsXG4gICAgICAgIF0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBHcmFudCBBSSBzZXJ2aWNlIEJlZHJvY2sgcGVybWlzc2lvbnNcbiAgICBhaVNlcnZpY2VMYW1iZGEuYWRkVG9Sb2xlUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAnYmVkcm9jazpJbnZva2VNb2RlbCcsXG4gICAgICAgICAgJ2JlZHJvY2s6SW52b2tlTW9kZWxXaXRoUmVzcG9uc2VTdHJlYW0nLFxuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICAnYXJuOmF3czpiZWRyb2NrOio6OmZvdW5kYXRpb24tbW9kZWwvZGVlcHNlZWsudjMtdjE6MCcsXG4gICAgICAgICAgJ2Fybjphd3M6YmVkcm9jazoqOjpmb3VuZGF0aW9uLW1vZGVsL2FtYXpvbi50aXRhbi1lbWJlZC10ZXh0LXYxJyxcbiAgICAgICAgICAnYXJuOmF3czpiZWRyb2NrOio6OmZvdW5kYXRpb24tbW9kZWwvYW1hem9uLnRpdGFuLWVtYmVkLXRleHQtdjI6MCcsXG4gICAgICAgICAgJ2Fybjphd3M6YmVkcm9jazoqOjpmb3VuZGF0aW9uLW1vZGVsL2NvaGVyZS5lbWJlZC1lbmdsaXNoLXYzJyxcbiAgICAgICAgXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIEdyYW50IEFJIHNlcnZpY2UgQ29nbml0byBwZXJtaXNzaW9uc1xuICAgIGFpU2VydmljZUxhbWJkYS5hZGRUb1JvbGVQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICdjb2duaXRvLWlkcDpBZG1pbkxpc3RHcm91cHNGb3JVc2VyJyxcbiAgICAgICAgICAnY29nbml0by1pZHA6QWRtaW5HZXRVc2VyJyxcbiAgICAgICAgICAnY29nbml0by1pZHA6TGlzdFVzZXJzJyxcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbdGhpcy51c2VyUG9vbC51c2VyUG9vbEFybl0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBHcmFudCBub3RpZmljYXRpb24gc2VydmljZSBwZXJtaXNzaW9uc1xuICAgIG5vdGlmaWNhdGlvblNlcnZpY2VMYW1iZGEuYWRkVG9Sb2xlUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAnc25zOlB1Ymxpc2gnLFxuICAgICAgICAgICdzbnM6Q3JlYXRlUGxhdGZvcm1FbmRwb2ludCcsXG4gICAgICAgICAgJ3NuczpEZWxldGVFbmRwb2ludCcsXG4gICAgICAgICAgJ3NuczpHZXRFbmRwb2ludEF0dHJpYnV0ZXMnLFxuICAgICAgICAgICdzbnM6U2V0RW5kcG9pbnRBdHRyaWJ1dGVzJyxcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgd29ya291dFJlbWluZGVyc1RvcGljLnRvcGljQXJuLFxuICAgICAgICAgIG51dHJpdGlvblJlbWluZGVyc1RvcGljLnRvcGljQXJuLFxuICAgICAgICAgIGFjaGlldmVtZW50VG9waWMudG9waWNBcm4sXG4gICAgICAgICAgYWlTdWdnZXN0aW9uc1RvcGljLnRvcGljQXJuLFxuICAgICAgICAgICcqJywgLy8gQWxsb3cgYWNjZXNzIHRvIGFsbCBTTlMgcGxhdGZvcm0gYXBwbGljYXRpb25zXG4gICAgICAgIF0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBHcmFudCBub3RpZmljYXRpb24gc2NoZWR1bGVyIHBlcm1pc3Npb25zXG4gICAgbm90aWZpY2F0aW9uU2NoZWR1bGVyTGFtYmRhLmFkZFRvUm9sZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbJ2xhbWJkYTpJbnZva2VGdW5jdGlvbiddLFxuICAgICAgICByZXNvdXJjZXM6IFtub3RpZmljYXRpb25TZXJ2aWNlTGFtYmRhLmZ1bmN0aW9uQXJuXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIEFkZCBFdmVudEJyaWRnZSB0YXJnZXRzXG4gICAgd29ya291dFJlbWluZGVyUnVsZS5hZGRUYXJnZXQoXG4gICAgICBuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbihub3RpZmljYXRpb25TY2hlZHVsZXJMYW1iZGEpXG4gICAgKTtcbiAgICBudXRyaXRpb25SZW1pbmRlclJ1bGUuYWRkVGFyZ2V0KFxuICAgICAgbmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24obm90aWZpY2F0aW9uU2NoZWR1bGVyTGFtYmRhKVxuICAgICk7XG4gICAgd2F0ZXJSZW1pbmRlclJ1bGUuYWRkVGFyZ2V0KFxuICAgICAgbmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24obm90aWZpY2F0aW9uU2NoZWR1bGVyTGFtYmRhKVxuICAgICk7XG4gICAgcHJvZ3Jlc3NQaG90b1J1bGUuYWRkVGFyZ2V0KFxuICAgICAgbmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24obm90aWZpY2F0aW9uU2NoZWR1bGVyTGFtYmRhKVxuICAgICk7XG5cbiAgICAvLyBQcm9hY3RpdmUgQ29hY2hpbmcgRXZlbnRCcmlkZ2UgdGFyZ2V0c1xuICAgIHByb2FjdGl2ZUNoZWNrSW5SdWxlLmFkZFRhcmdldChcbiAgICAgIG5ldyB0YXJnZXRzLkxhbWJkYUZ1bmN0aW9uKGFpU2VydmljZUxhbWJkYSwge1xuICAgICAgICBldmVudDogZXZlbnRzLlJ1bGVUYXJnZXRJbnB1dC5mcm9tT2JqZWN0KHtcbiAgICAgICAgICBzb3VyY2U6ICdwcm9hY3RpdmUtY2hlY2tpbicsXG4gICAgICAgICAgYWN0aW9uOiAnY2hlY2tpbicsXG4gICAgICAgICAgdGltZXN0YW1wOiBldmVudHMuRXZlbnRGaWVsZC5mcm9tUGF0aCgnJC50aW1lJyksXG4gICAgICAgIH0pLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgcHJvZ3Jlc3NNb25pdG9yUnVsZS5hZGRUYXJnZXQoXG4gICAgICBuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbihhaVNlcnZpY2VMYW1iZGEsIHtcbiAgICAgICAgZXZlbnQ6IGV2ZW50cy5SdWxlVGFyZ2V0SW5wdXQuZnJvbU9iamVjdCh7XG4gICAgICAgICAgc291cmNlOiAncHJvZ3Jlc3MtbW9uaXRvcicsXG4gICAgICAgICAgYWN0aW9uOiAnbW9uaXRvcicsXG4gICAgICAgICAgdGltZXN0YW1wOiBldmVudHMuRXZlbnRGaWVsZC5mcm9tUGF0aCgnJC50aW1lJyksXG4gICAgICAgIH0pLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgcGxhdGVhdURldGVjdGlvblJ1bGUuYWRkVGFyZ2V0KFxuICAgICAgbmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24oYWlTZXJ2aWNlTGFtYmRhLCB7XG4gICAgICAgIGV2ZW50OiBldmVudHMuUnVsZVRhcmdldElucHV0LmZyb21PYmplY3Qoe1xuICAgICAgICAgIHNvdXJjZTogJ3BsYXRlYXUtZGV0ZWN0aW9uJyxcbiAgICAgICAgICBhY3Rpb246ICdkZXRlY3QtcGxhdGVhdXMnLFxuICAgICAgICAgIHRpbWVzdGFtcDogZXZlbnRzLkV2ZW50RmllbGQuZnJvbVBhdGgoJyQudGltZScpLFxuICAgICAgICB9KSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIG1vdGl2YXRpb25Cb29zdFJ1bGUuYWRkVGFyZ2V0KFxuICAgICAgbmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24oYWlTZXJ2aWNlTGFtYmRhLCB7XG4gICAgICAgIGV2ZW50OiBldmVudHMuUnVsZVRhcmdldElucHV0LmZyb21PYmplY3Qoe1xuICAgICAgICAgIHNvdXJjZTogJ21vdGl2YXRpb24tYm9vc3QnLFxuICAgICAgICAgIGFjdGlvbjogJ21vdGl2YXRlJyxcbiAgICAgICAgICB0aW1lc3RhbXA6IGV2ZW50cy5FdmVudEZpZWxkLmZyb21QYXRoKCckLnRpbWUnKSxcbiAgICAgICAgfSksXG4gICAgICB9KVxuICAgICk7XG5cbiAgICB3ZWVrbHlSZXZpZXdSdWxlLmFkZFRhcmdldChcbiAgICAgIG5ldyB0YXJnZXRzLkxhbWJkYUZ1bmN0aW9uKGFpU2VydmljZUxhbWJkYSwge1xuICAgICAgICBldmVudDogZXZlbnRzLlJ1bGVUYXJnZXRJbnB1dC5mcm9tT2JqZWN0KHtcbiAgICAgICAgICBzb3VyY2U6ICd3ZWVrbHktcmV2aWV3JyxcbiAgICAgICAgICBhY3Rpb246ICdyZXZpZXcnLFxuICAgICAgICAgIHRpbWVzdGFtcDogZXZlbnRzLkV2ZW50RmllbGQuZnJvbVBhdGgoJyQudGltZScpLFxuICAgICAgICB9KSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIFJlbW92ZWQgQ2xvdWRXYXRjaCBMb2cgR3JvdXBzIHRvIGF2b2lkIGNvc3RzXG4gICAgLy8gTGFtYmRhIGZ1bmN0aW9ucyB3aWxsIHVzZSBkZWZhdWx0IGxvZyBncm91cHMgKGZyZWUgdGllcjogNUdCL21vbnRoKVxuXG4gICAgLy8gT3V0cHV0c1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVc2VyUG9vbElkJywge1xuICAgICAgdmFsdWU6IHRoaXMudXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ29nbml0byBVc2VyIFBvb2wgSUQnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1VzZXJQb29sQ2xpZW50SWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy51c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkLFxuICAgICAgZGVzY3JpcHRpb246ICdDb2duaXRvIFVzZXIgUG9vbCBDbGllbnQgSUQnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1VzZXJQb29sRG9tYWluJywge1xuICAgICAgdmFsdWU6IHRoaXMudXNlclBvb2xEb21haW4uZG9tYWluTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ29nbml0byBVc2VyIFBvb2wgRG9tYWluJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDbG91ZEZyb250VXJsJywge1xuICAgICAgdmFsdWU6IGBodHRwczovLyR7dGhpcy5kaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uRG9tYWluTmFtZX1gLFxuICAgICAgZGVzY3JpcHRpb246ICdDbG91ZEZyb250IERpc3RyaWJ1dGlvbiBVUkwnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1RhYmxlTmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLm1haW5UYWJsZS50YWJsZU5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0R5bmFtb0RCIFRhYmxlIE5hbWUnLFxuICAgIH0pO1xuXG4gICAgLy8gbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1VzZXJTZXJ2aWNlVXJsJywge1xuICAgIC8vICAgdmFsdWU6IHVzZXJTZXJ2aWNlVXJsLnVybCxcbiAgICAvLyAgIGRlc2NyaXB0aW9uOiAnVXNlciBTZXJ2aWNlIExhbWJkYSBGdW5jdGlvbiBVUkwnLFxuICAgIC8vIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1VzZXJQcm9maWxlU2VydmljZVVybCcsIHtcbiAgICAgIHZhbHVlOiB1c2VyUHJvZmlsZVNlcnZpY2VVcmwudXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdVc2VyIFByb2ZpbGUgU2VydmljZSBMYW1iZGEgRnVuY3Rpb24gVVJMJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdXb3Jrb3V0U2VydmljZVVybCcsIHtcbiAgICAgIHZhbHVlOiB3b3Jrb3V0U2VydmljZVVybC51cmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ1dvcmtvdXQgU2VydmljZSBMYW1iZGEgRnVuY3Rpb24gVVJMJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDb2FjaGluZ1NlcnZpY2VVcmwnLCB7XG4gICAgICB2YWx1ZTogY29hY2hpbmdTZXJ2aWNlVXJsLnVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ29hY2hpbmcgU2VydmljZSBMYW1iZGEgRnVuY3Rpb24gVVJMJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBbmFseXRpY3NTZXJ2aWNlVXJsJywge1xuICAgICAgdmFsdWU6IGFuYWx5dGljc1NlcnZpY2VVcmwudXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdBbmFseXRpY3MgU2VydmljZSBMYW1iZGEgRnVuY3Rpb24gVVJMJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdOdXRyaXRpb25TZXJ2aWNlVXJsJywge1xuICAgICAgdmFsdWU6IG51dHJpdGlvblNlcnZpY2VVcmwudXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdOdXRyaXRpb24gU2VydmljZSBMYW1iZGEgRnVuY3Rpb24gVVJMJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBSVNlcnZpY2VVcmwnLCB7XG4gICAgICB2YWx1ZTogYWlTZXJ2aWNlVXJsLnVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQUkgU2VydmljZSBMYW1iZGEgRnVuY3Rpb24gVVJMJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdOb3RpZmljYXRpb25TZXJ2aWNlVXJsJywge1xuICAgICAgdmFsdWU6IG5vdGlmaWNhdGlvblNlcnZpY2VVcmwudXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdOb3RpZmljYXRpb24gU2VydmljZSBMYW1iZGEgRnVuY3Rpb24gVVJMJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVc2VyVXBsb2Fkc0J1Y2tldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy51c2VyVXBsb2Fkc0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdVc2VyIFVwbG9hZHMgUzMgQnVja2V0IE5hbWUnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1N0YXRpY0Fzc2V0c0J1Y2tldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5zdGF0aWNBc3NldHNCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU3RhdGljIEFzc2V0cyBTMyBCdWNrZXQgTmFtZScsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUHJvY2Vzc2VkSW1hZ2VzQnVja2V0TmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnByb2Nlc3NlZEltYWdlc0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdQcm9jZXNzZWQgSW1hZ2VzIFMzIEJ1Y2tldCBOYW1lJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdGcm9udGVuZEJ1Y2tldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5mcm9udGVuZEJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdGcm9udGVuZCBTMyBCdWNrZXQgTmFtZScsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVmVjdG9yc0J1Y2tldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy52ZWN0b3JzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1MzIFZlY3RvcnMgQnVja2V0IE5hbWUgZm9yIEFJIEtub3dsZWRnZSBCYXNlJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDbG91ZEZyb250RGlzdHJpYnV0aW9uVVJMJywge1xuICAgICAgdmFsdWU6IGBodHRwczovLyR7dGhpcy5kaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uRG9tYWluTmFtZX1gLFxuICAgICAgZGVzY3JpcHRpb246ICdDbG91ZEZyb250IERpc3RyaWJ1dGlvbiBVUkwnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1Bvc3REZXBsb3ltZW50SW5zdHJ1Y3Rpb25zJywge1xuICAgICAgdmFsdWU6XG4gICAgICAgICdBZnRlciBkZXBsb3ltZW50LCBzZXQgQ0xPVURGUk9OVF9ET01BSU4gZW52aXJvbm1lbnQgdmFyaWFibGUgaW4gQW5hbHl0aWNzU2VydmljZSBMYW1iZGEgZnVuY3Rpb24nLFxuICAgICAgZGVzY3JpcHRpb246ICdNYW51YWwgc3RlcCByZXF1aXJlZCBhZnRlciBkZXBsb3ltZW50JyxcbiAgICB9KTtcblxuICAgIC8vIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdXQUZXZWJBQ0xBcm4nLCB7XG4gICAgLy8gICB2YWx1ZTogd2FmV2ViQWNsLmF0dHJBcm4sXG4gICAgLy8gICBkZXNjcmlwdGlvbjogJ1dBRiBXZWIgQUNMIEFSTiBmb3IgQ2xvdWRGcm9udCBwcm90ZWN0aW9uJyxcbiAgICAvLyB9KTtcblxuICAgIC8vIFJlbW92ZWQgbW9uaXRvcmluZyBzdGFjayB0byBhdm9pZCBDbG91ZFdhdGNoIGNvc3RzXG4gICAgLy8gdGhpcy5jcmVhdGVNb25pdG9yaW5nU3RhY2soKTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlTGFtYmRhRnVuY3Rpb24oXG4gICAgbmFtZTogc3RyaW5nLFxuICAgIHNlcnZpY2VOYW1lOiBzdHJpbmcsXG4gICAgYWRkaXRpb25hbEVudlZhcnM/OiB7IFtrZXk6IHN0cmluZ106IHN0cmluZyB9XG4gICk6IGxhbWJkYS5GdW5jdGlvbiB7XG4gICAgY29uc3QgYmFzZUVudlZhcnMgPSB7XG4gICAgICBUQUJMRV9OQU1FOiB0aGlzLm1haW5UYWJsZS50YWJsZU5hbWUsXG4gICAgICBEWU5BTU9EQl9UQUJMRTogdGhpcy5tYWluVGFibGUudGFibGVOYW1lLFxuICAgICAgVVNFUl9QT09MX0lEOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICBVU0VSX1BPT0xfQ0xJRU5UX0lEOiB0aGlzLnVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXG4gICAgICBVU0VSX1VQTE9BRFNfQlVDS0VUOiB0aGlzLnVzZXJVcGxvYWRzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBTVEFUSUNfQVNTRVRTX0JVQ0tFVDogdGhpcy5zdGF0aWNBc3NldHNCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIFBST0NFU1NFRF9JTUFHRVNfQlVDS0VUOiB0aGlzLnByb2Nlc3NlZEltYWdlc0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgUFJPR1JFU1NfUEhPVE9TX0JVQ0tFVDogdGhpcy5wcm9ncmVzc1Bob3Rvc0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgSldUX1NFQ1JFVDogJ3lvdXItand0LXNlY3JldC1oZXJlJywgLy8gSW4gcHJvZHVjdGlvbiwgdXNlIEFXUyBTZWNyZXRzIE1hbmFnZXJcbiAgICAgIENPR05JVE9fUkVHSU9OOiB0aGlzLnJlZ2lvbixcbiAgICAgIENPR05JVE9fVVNFUl9QT09MX0lEOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICBSVVNUX0xPRzogJ2luZm8nLFxuICAgICAgUlVTVF9CQUNLVFJBQ0U6ICcxJyxcbiAgICB9O1xuXG4gICAgY29uc3QgZW52VmFycyA9IGFkZGl0aW9uYWxFbnZWYXJzXG4gICAgICA/IHsgLi4uYmFzZUVudlZhcnMsIC4uLmFkZGl0aW9uYWxFbnZWYXJzIH1cbiAgICAgIDogYmFzZUVudlZhcnM7XG5cbiAgICByZXR1cm4gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCBgJHtuYW1lfUxhbWJkYWAsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBST1ZJREVEX0FMMixcbiAgICAgIGhhbmRsZXI6ICdib290c3RyYXAnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KGAuLi90YXJnZXQvbGFtYmRhLyR7c2VydmljZU5hbWV9YCksXG4gICAgICBlbnZpcm9ubWVudDogZW52VmFycyxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NiwgLy8gT3B0aW1pemVkIGZvciBjb2xkIHN0YXJ0c1xuICAgICAgLy8gUmVtb3ZlZCByZXNlcnZlZENvbmN1cnJlbnRFeGVjdXRpb25zIGR1ZSB0byBsb3cgYWNjb3VudCBsaW1pdCAoMTAgdG90YWwpXG4gICAgICAvLyByZXNlcnZlZENvbmN1cnJlbnRFeGVjdXRpb25zOiAyMCwgLy8gSW5jcmVhc2VkIGZvciBkZXZlbG9wbWVudC90ZXN0aW5nXG4gICAgICAvLyBSZW1vdmVkIGxvZyByZXRlbnRpb24gdG8gdXNlIGZyZWUgdGllciBkZWZhdWx0cyAoNUdCL21vbnRoIGZyZWUpXG4gICAgICAvLyBSZW1vdmVkIFgtUmF5IHRyYWNpbmcgdG8gYXZvaWQgY29zdHMgKCQ1IHBlciAxTSB0cmFjZXMpXG4gICAgICBsYXllcnM6IFt0aGlzLmNyZWF0ZUF1dGhMYXllcigpXSxcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlUHl0aG9uTGFtYmRhRnVuY3Rpb24oXG4gICAgbmFtZTogc3RyaW5nLFxuICAgIHNlcnZpY2VOYW1lOiBzdHJpbmdcbiAgKTogbGFtYmRhLkZ1bmN0aW9uIHtcbiAgICByZXR1cm4gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCBgJHtuYW1lfUxhbWJkYWAsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzExLFxuICAgICAgaGFuZGxlcjogJ2xhbWJkYV9mdW5jdGlvbi5sYW1iZGFfaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoYC4uL3NlcnZpY2VzLyR7c2VydmljZU5hbWV9YCksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBEWU5BTU9EQl9UQUJMRTogdGhpcy5tYWluVGFibGUudGFibGVOYW1lLFxuICAgICAgICBVU0VSX1BPT0xfSUQ6IHRoaXMudXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgICAgVVNFUl9QT09MX0NMSUVOVF9JRDogdGhpcy51c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkLFxuICAgICAgICBVU0VSX1VQTE9BRFNfQlVDS0VUOiB0aGlzLnVzZXJVcGxvYWRzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgIFNUQVRJQ19BU1NFVFNfQlVDS0VUOiB0aGlzLnN0YXRpY0Fzc2V0c0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBQUk9DRVNTRURfSU1BR0VTX0JVQ0tFVDogdGhpcy5wcm9jZXNzZWRJbWFnZXNCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgUFJPR1JFU1NfUEhPVE9TX0JVQ0tFVDogdGhpcy5wcm9ncmVzc1Bob3Rvc0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBWRUNUT1JTX0JVQ0tFVDogdGhpcy52ZWN0b3JzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgIEpXVF9TRUNSRVQ6ICd5b3VyLWp3dC1zZWNyZXQtaGVyZScsIC8vIEluIHByb2R1Y3Rpb24sIHVzZSBBV1MgU2VjcmV0cyBNYW5hZ2VyXG4gICAgICAgIENPR05JVE9fUkVHSU9OOiB0aGlzLnJlZ2lvbixcbiAgICAgICAgQ09HTklUT19VU0VSX1BPT0xfSUQ6IHRoaXMudXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgICAgUFlUSE9OUEFUSDogJy92YXIvcnVudGltZTovdmFyL3Rhc2snLFxuICAgICAgICAvLyBBSSBTZXJ2aWNlIHNwZWNpZmljIGVudmlyb25tZW50IHZhcmlhYmxlc1xuICAgICAgICBCRURST0NLX01PREVMX0lEOiAndXMuYW1hem9uLm5vdmEtbWljcm8tdjE6MCcsIC8vIEFtYXpvbiBOb3ZhIE1pY3JvIC0gY2hlYXBlc3QgbW9kZWwgdmlhIGNyb3NzLXJlZ2lvbiBpbmZlcmVuY2VcbiAgICAgICAgUkFURV9MSU1JVF9GUkVFX1RJRVI6ICcxMCcsIC8vIFJlcXVlc3RzIHBlciBkYXkgZm9yIGZyZWUgdGllclxuICAgICAgICBSQVRFX0xJTUlUX1BSRU1JVU1fVElFUjogJzUwJywgLy8gUmVxdWVzdHMgcGVyIGRheSBmb3IgcHJlbWl1bSB0aWVyXG4gICAgICAgIFJBVEVfTElNSVRfSEFSRF9MSU1JVDogJzEwMCcsIC8vIEhhcmQgbGltaXQgdG8gcHJldmVudCBhYnVzZVxuICAgICAgICBDT05WRVJTQVRJT05fVFRMX0RBWVM6ICczMCcsIC8vIFRUTCBmb3IgY29udmVyc2F0aW9uIGhpc3RvcnlcbiAgICAgICAgUkFURV9MSU1JVF9UVExfREFZUzogJzcnLCAvLyBUVEwgZm9yIHJhdGUgbGltaXQgcmVjb3Jkc1xuICAgICAgfSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLCAvLyBBSSBmdW5jdGlvbnMgbWF5IG5lZWQgbW9yZSB0aW1lXG4gICAgICBtZW1vcnlTaXplOiAxMDI0LCAvLyBBSSBmdW5jdGlvbnMgbmVlZCBtb3JlIG1lbW9yeVxuICAgICAgLy8gUmVtb3ZlZCByZXNlcnZlZENvbmN1cnJlbnRFeGVjdXRpb25zIGR1ZSB0byBsb3cgYWNjb3VudCBsaW1pdCAoMTAgdG90YWwpXG4gICAgICAvLyByZXNlcnZlZENvbmN1cnJlbnRFeGVjdXRpb25zOiAyMCwgLy8gSW5jcmVhc2VkIGZvciBkZXZlbG9wbWVudC90ZXN0aW5nXG4gICAgICAvLyBSZW1vdmVkIGxvZyByZXRlbnRpb24gdG8gdXNlIGZyZWUgdGllciBkZWZhdWx0cyAoNUdCL21vbnRoIGZyZWUpXG4gICAgICAvLyBSZW1vdmVkIFgtUmF5IHRyYWNpbmcgdG8gYXZvaWQgY29zdHMgKCQ1IHBlciAxTSB0cmFjZXMpXG4gICAgICAvLyBsYXllcnM6IFt0aGlzLmNyZWF0ZVB5dGhvbkF1dGhMYXllcigpXSwgLy8gVGVtcG9yYXJpbHkgZGlzYWJsZWRcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlQXV0aExheWVyKCk6IGxhbWJkYS5MYXllclZlcnNpb24ge1xuICAgIGlmICh0aGlzLmF1dGhMYXllcikge1xuICAgICAgcmV0dXJuIHRoaXMuYXV0aExheWVyO1xuICAgIH1cbiAgICB0aGlzLmF1dGhMYXllciA9IG5ldyBsYW1iZGEuTGF5ZXJWZXJzaW9uKHRoaXMsICdBdXRoTGF5ZXInLCB7XG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uL3NlcnZpY2VzL2F1dGgtbGF5ZXIvbGF5ZXInKSxcbiAgICAgIGNvbXBhdGlibGVSdW50aW1lczogW2xhbWJkYS5SdW50aW1lLlBST1ZJREVEX0FMMl0sXG4gICAgICBkZXNjcmlwdGlvbjpcbiAgICAgICAgJ0F1dGhlbnRpY2F0aW9uIGFuZCBhdXRob3JpemF0aW9uIGxheWVyIGZvciBHeW1Db2FjaCBBSSBzZXJ2aWNlcycsXG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMuYXV0aExheWVyO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVQeXRob25BdXRoTGF5ZXIoKTogbGFtYmRhLkxheWVyVmVyc2lvbiB7XG4gICAgaWYgKHRoaXMucHl0aG9uQXV0aExheWVyKSB7XG4gICAgICByZXR1cm4gdGhpcy5weXRob25BdXRoTGF5ZXI7XG4gICAgfVxuICAgIHRoaXMucHl0aG9uQXV0aExheWVyID0gbmV3IGxhbWJkYS5MYXllclZlcnNpb24odGhpcywgJ1B5dGhvbkF1dGhMYXllcicsIHtcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4vc2VydmljZXMvYWktc2VydmljZS1weXRob24vbGF5ZXInKSxcbiAgICAgIGNvbXBhdGlibGVSdW50aW1lczogW2xhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzExXSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUHl0aG9uIGF1dGhlbnRpY2F0aW9uIGxheWVyIGZvciBBSSBzZXJ2aWNlcycsXG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMucHl0aG9uQXV0aExheWVyO1xuICB9XG5cbiAgLy8gUmVtb3ZlZCBjcmVhdGVNb25pdG9yaW5nU3RhY2sgbWV0aG9kIHRvIGF2b2lkIENsb3VkV2F0Y2ggY29zdHNcbiAgLy8gcHJpdmF0ZSBjcmVhdGVNb25pdG9yaW5nU3RhY2soKSB7XG4gIC8vICAgLy8gQ3JlYXRlIG1vbml0b3Jpbmcgc3RhY2tcbiAgLy8gICBuZXcgTW9uaXRvcmluZ1N0YWNrKHRoaXMsICdNb25pdG9yaW5nU3RhY2snLCB7XG4gIC8vICAgICBsYW1iZGFGdW5jdGlvbnM6IFtcbiAgLy8gICAgICAgdGhpcy51c2VyU2VydmljZUxhbWJkYSxcbiAgLy8gICAgICAgdGhpcy51c2VyUHJvZmlsZVNlcnZpY2VMYW1iZGEsXG4gIC8vICAgICAgIHRoaXMud29ya291dFNlcnZpY2VMYW1iZGEsXG4gIC8vICAgICAgIHRoaXMuY29hY2hpbmdTZXJ2aWNlTGFtYmRhLFxuICAvLyAgICAgICB0aGlzLmFuYWx5dGljc1NlcnZpY2VMYW1iZGEsXG4gIC8vICAgICAgIHRoaXMubnV0cml0aW9uU2VydmljZUxhbWJkYSxcbiAgLy8gICAgICAgdGhpcy5haVNlcnZpY2VMYW1iZGEsXG4gIC8vICAgICBdLFxuICAvLyAgICAgZHluYW1vRGJUYWJsZTogdGhpcy5tYWluVGFibGUsXG4gIC8vICAgICBzM0J1Y2tldHM6IFtcbiAgLy8gICAgICAgdGhpcy51c2VyVXBsb2Fkc0J1Y2tldCxcbiAgLy8gICAgICAgdGhpcy5zdGF0aWNBc3NldHNCdWNrZXQsXG4gIC8vICAgICAgIHRoaXMucHJvY2Vzc2VkSW1hZ2VzQnVja2V0LFxuICAvLyAgICAgXSxcbiAgLy8gICB9KTtcbiAgLy8gfVxufVxuIl19