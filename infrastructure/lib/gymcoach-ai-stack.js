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
// Removed MonitoringStack import to avoid CloudWatch costs
class GymCoachAIStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // DynamoDB Table with Single Table Design
        this.mainTable = new dynamodb.Table(this, 'GymCoachAITable', {
            tableName: 'gymcoach-ai-main',
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
        this.mainTable.addGlobalSecondaryIndex({
            indexName: 'GSI2',
            partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'GSI2SK', type: dynamodb.AttributeType.STRING },
        });
        // Create Cognito User Pool
        this.userPool = new cognito.UserPool(this, 'GymCoachAIUserPool', {
            userPoolName: 'gymcoach-ai-users',
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
            userPoolClientName: 'gymcoach-ai-web-client',
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
                domainPrefix: `gymcoach-ai-${this.account}`,
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
            topicName: 'gymcoach-ai-workout-reminders',
            displayName: 'Workout Reminders',
        });
        const nutritionRemindersTopic = new sns.Topic(this, 'NutritionRemindersTopic', {
            topicName: 'gymcoach-ai-nutrition-reminders',
            displayName: 'Nutrition Reminders',
        });
        const achievementTopic = new sns.Topic(this, 'AchievementTopic', {
            topicName: 'gymcoach-ai-achievements',
            displayName: 'Achievement Notifications',
        });
        const aiSuggestionsTopic = new sns.Topic(this, 'AISuggestionsTopic', {
            topicName: 'gymcoach-ai-suggestions',
            displayName: 'AI Suggestions',
        });
        // Create EventBridge Rules for scheduled notifications
        const workoutReminderRule = new events.Rule(this, 'WorkoutReminderRule', {
            ruleName: 'gymcoach-ai-workout-reminders',
            description: 'Triggers workout reminder notifications',
            schedule: events.Schedule.cron({
                minute: '0',
                hour: '8', // 8 AM UTC - will be adjusted per user timezone
            }),
        });
        const nutritionReminderRule = new events.Rule(this, 'NutritionReminderRule', {
            ruleName: 'gymcoach-ai-nutrition-reminders',
            description: 'Triggers nutrition reminder notifications',
            schedule: events.Schedule.cron({
                minute: '0',
                hour: '12', // 12 PM UTC - will be adjusted per user timezone
            }),
        });
        const waterReminderRule = new events.Rule(this, 'WaterReminderRule', {
            ruleName: 'gymcoach-ai-water-reminders',
            description: 'Triggers water intake reminder notifications',
            schedule: events.Schedule.cron({
                minute: '0',
                hour: '*', // Every hour
            }),
        });
        const progressPhotoRule = new events.Rule(this, 'ProgressPhotoRule', {
            ruleName: 'gymcoach-ai-progress-photos',
            description: 'Triggers weekly progress photo reminders',
            schedule: events.Schedule.cron({
                minute: '0',
                hour: '18', // 6 PM UTC on Sundays
                weekDay: 'SUN',
            }),
        });
        // Proactive Coaching EventBridge Rules
        const proactiveCheckInRule = new events.Rule(this, 'ProactiveCheckInRule', {
            ruleName: 'gymcoach-ai-proactive-checkins',
            description: 'Triggers proactive AI coach check-ins',
            schedule: events.Schedule.cron({
                minute: '0',
                hour: '9', // 9 AM UTC daily
            }),
        });
        const progressMonitorRule = new events.Rule(this, 'ProgressMonitorRule', {
            ruleName: 'gymcoach-ai-progress-monitoring',
            description: 'Monitors user progress and triggers interventions',
            schedule: events.Schedule.cron({
                minute: '0',
                hour: '6', // 6 AM UTC daily
            }),
        });
        const plateauDetectionRule = new events.Rule(this, 'PlateauDetectionRule', {
            ruleName: 'gymcoach-ai-plateau-detection',
            description: 'Detects workout plateaus and suggests changes',
            schedule: events.Schedule.cron({
                minute: '0',
                hour: '20', // 8 PM UTC on Sundays
                weekDay: 'SUN',
            }),
        });
        const motivationBoostRule = new events.Rule(this, 'MotivationBoostRule', {
            ruleName: 'gymcoach-ai-motivation-boost',
            description: 'Sends motivational messages based on user patterns',
            schedule: events.Schedule.cron({
                minute: '0',
                hour: '7', // 7 AM UTC on Mondays
                weekDay: 'MON',
            }),
        });
        const weeklyReviewRule = new events.Rule(this, 'WeeklyReviewRule', {
            ruleName: 'gymcoach-ai-weekly-review',
            description: 'Generates weekly progress reviews and recommendations',
            schedule: events.Schedule.cron({
                minute: '0',
                hour: '19', // 7 PM UTC on Sundays
                weekDay: 'SUN',
            }),
        });
        // Create S3 Buckets (needed by Lambdas)
        this.userUploadsBucket = new s3.Bucket(this, 'UserUploadsBucket', {
            bucketName: `gymcoach-ai-user-uploads-${this.account}`,
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: new s3.BlockPublicAccess({
                blockPublicAcls: false,
                blockPublicPolicy: false,
                ignorePublicAcls: false,
                restrictPublicBuckets: false,
            }),
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
        // Add bucket policy to allow public read access to uploaded images
        this.userUploadsBucket.addToResourcePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            principals: [new iam.AnyPrincipal()],
            actions: ['s3:GetObject'],
            resources: [`${this.userUploadsBucket.bucketArn}/user-profiles/*`],
        }));
        this.staticAssetsBucket = new s3.Bucket(this, 'StaticAssetsBucket', {
            bucketName: `gymcoach-ai-static-assets-${this.account}`,
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            publicReadAccess: false,
        });
        this.processedImagesBucket = new s3.Bucket(this, 'ProcessedImagesBucket', {
            bucketName: `gymcoach-ai-processed-images-${this.account}`,
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // Create dedicated Progress Photos S3 Bucket with enhanced security
        this.progressPhotosBucket = new s3.Bucket(this, 'ProgressPhotosBucket', {
            bucketName: `gymcoach-ai-progress-photos-${this.account}`,
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
        // Create CloudFront Origin Access Identity for secure S3 access
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
            bucketName: `gymcoach-ai-frontend-${this.account}`,
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
            bucketName: `gymcoach-ai-vectors-${this.account}`,
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
            CLOUDFRONT_DOMAIN: '', // Update manually after first deployment
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
            reservedConcurrentExecutions: 20, // Increased for development/testing
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
                BEDROCK_MODEL_ID: 'deepseek.v3-v1:0', // DeepSeek model available in eu-north-1
                RATE_LIMIT_FREE_TIER: '10', // Requests per day for free tier
                RATE_LIMIT_PREMIUM_TIER: '50', // Requests per day for premium tier
                RATE_LIMIT_HARD_LIMIT: '100', // Hard limit to prevent abuse
                CONVERSATION_TTL_DAYS: '30', // TTL for conversation history
                RATE_LIMIT_TTL_DAYS: '7', // TTL for rate limit records
            },
            timeout: cdk.Duration.minutes(5), // AI functions may need more time
            memorySize: 1024, // AI functions need more memory
            reservedConcurrentExecutions: 20, // Increased for development/testing
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3ltY29hY2gtYWktc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvZ3ltY29hY2gtYWktc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBQ25DLGlEQUFpRDtBQUNqRCx5REFBeUQ7QUFDekQsOERBQThEO0FBRTlELHFEQUFxRDtBQUNyRCwyQ0FBMkM7QUFDM0MsbURBQW1EO0FBRW5ELHlDQUF5QztBQUN6QywyQ0FBMkM7QUFDM0MsaURBQWlEO0FBQ2pELDBEQUEwRDtBQUcxRCwyREFBMkQ7QUFFM0QsTUFBYSxlQUFnQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBZTVDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDOUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsMENBQTBDO1FBQzFDLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRTtZQUMzRCxTQUFTLEVBQUUsa0JBQWtCO1lBQzdCLFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQ2pFLE9BQU8sRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQzVELFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7WUFDakQsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztZQUN4QyxpRUFBaUU7U0FDbEUsQ0FBQyxDQUFDO1FBRUgsd0NBQXdDO1FBQ3hDLElBQUksQ0FBQyxTQUFTLENBQUMsdUJBQXVCLENBQUM7WUFDckMsU0FBUyxFQUFFLE1BQU07WUFDakIsWUFBWSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFB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Q0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDO1lBQ2hELFdBQVcsRUFBRSw2Q0FBNkM7U0FDM0QsQ0FBQyxDQUFDO1FBQ0gsT0FBTyxJQUFJLENBQUMsZUFBZSxDQUFDO0lBQzlCLENBQUM7Q0F1QkY7QUE5M0NELDBDQTgzQ0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgY2xvdWRmcm9udCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udCc7XG5pbXBvcnQgKiBhcyBvcmlnaW5zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250LW9yaWdpbnMnO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSc7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgY29nbml0byBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY29nbml0byc7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XG5pbXBvcnQgKiBhcyBzbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNucyc7XG5pbXBvcnQgKiBhcyBldmVudHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cyc7XG5pbXBvcnQgKiBhcyB0YXJnZXRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMtdGFyZ2V0cyc7XG5pbXBvcnQgKiBhcyB3YWZ2MiBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtd2FmdjInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG4vLyBSZW1vdmVkIE1vbml0b3JpbmdTdGFjayBpbXBvcnQgdG8gYXZvaWQgQ2xvdWRXYXRjaCBjb3N0c1xuXG5leHBvcnQgY2xhc3MgR3ltQ29hY2hBSVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IHVzZXJQb29sOiBjb2duaXRvLlVzZXJQb29sO1xuICBwdWJsaWMgcmVhZG9ubHkgdXNlclBvb2xDbGllbnQ6IGNvZ25pdG8uVXNlclBvb2xDbGllbnQ7XG4gIHB1YmxpYyByZWFkb25seSB1c2VyUG9vbERvbWFpbjogY29nbml0by5Vc2VyUG9vbERvbWFpbjtcbiAgcHVibGljIHJlYWRvbmx5IG1haW5UYWJsZTogZHluYW1vZGIuVGFibGU7XG4gIHB1YmxpYyByZWFkb25seSBkaXN0cmlidXRpb246IGNsb3VkZnJvbnQuRGlzdHJpYnV0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgdXNlclVwbG9hZHNCdWNrZXQ6IHMzLkJ1Y2tldDtcbiAgcHVibGljIHJlYWRvbmx5IHN0YXRpY0Fzc2V0c0J1Y2tldDogczMuQnVja2V0O1xuICBwdWJsaWMgcmVhZG9ubHkgcHJvY2Vzc2VkSW1hZ2VzQnVja2V0OiBzMy5CdWNrZXQ7XG4gIHB1YmxpYyByZWFkb25seSBwcm9ncmVzc1Bob3Rvc0J1Y2tldDogczMuQnVja2V0O1xuICBwdWJsaWMgcmVhZG9ubHkgZnJvbnRlbmRCdWNrZXQ6IHMzLkJ1Y2tldDtcbiAgcHVibGljIHJlYWRvbmx5IHZlY3RvcnNCdWNrZXQ6IHMzLkJ1Y2tldDtcbiAgcHJpdmF0ZSBhdXRoTGF5ZXI/OiBsYW1iZGEuTGF5ZXJWZXJzaW9uO1xuICBwcml2YXRlIHB5dGhvbkF1dGhMYXllcj86IGxhbWJkYS5MYXllclZlcnNpb247XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBjZGsuU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gRHluYW1vREIgVGFibGUgd2l0aCBTaW5nbGUgVGFibGUgRGVzaWduXG4gICAgdGhpcy5tYWluVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ0d5bUNvYWNoQUlUYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogJ2d5bWNvYWNoLWFpLW1haW4nLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdQSycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdTSycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIC8vIFJlbW92ZWQgcG9pbnRJblRpbWVSZWNvdmVyeSB0byBhdm9pZCBjb3N0cyAoMjAlIG9mIHRhYmxlIGNvc3QpXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgR1NJIGZvciBkaWZmZXJlbnQgYWNjZXNzIHBhdHRlcm5zXG4gICAgdGhpcy5tYWluVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnR1NJMScsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ0dTSTFQSycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdHU0kxU0snLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgIH0pO1xuXG4gICAgdGhpcy5tYWluVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnR1NJMicsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ0dTSTJQSycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdHU0kyU0snLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIENvZ25pdG8gVXNlciBQb29sXG4gICAgdGhpcy51c2VyUG9vbCA9IG5ldyBjb2duaXRvLlVzZXJQb29sKHRoaXMsICdHeW1Db2FjaEFJVXNlclBvb2wnLCB7XG4gICAgICB1c2VyUG9vbE5hbWU6ICdneW1jb2FjaC1haS11c2VycycsXG4gICAgICBzZWxmU2lnblVwRW5hYmxlZDogdHJ1ZSxcbiAgICAgIHNpZ25JbkFsaWFzZXM6IHtcbiAgICAgICAgZW1haWw6IHRydWUsXG4gICAgICAgIHVzZXJuYW1lOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIGF1dG9WZXJpZnk6IHtcbiAgICAgICAgZW1haWw6IHRydWUsXG4gICAgICB9LFxuICAgICAgc3RhbmRhcmRBdHRyaWJ1dGVzOiB7XG4gICAgICAgIGVtYWlsOiB7XG4gICAgICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgZ2l2ZW5OYW1lOiB7XG4gICAgICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgZmFtaWx5TmFtZToge1xuICAgICAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgIG11dGFibGU6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgY3VzdG9tQXR0cmlidXRlczoge1xuICAgICAgICBmaXRuZXNzR29hbHM6IG5ldyBjb2duaXRvLlN0cmluZ0F0dHJpYnV0ZSh7XG4gICAgICAgICAgbWluTGVuOiAxLFxuICAgICAgICAgIG1heExlbjogMTAwLFxuICAgICAgICAgIG11dGFibGU6IHRydWUsXG4gICAgICAgIH0pLFxuICAgICAgICBleHBlcmllbmNlTGV2ZWw6IG5ldyBjb2duaXRvLlN0cmluZ0F0dHJpYnV0ZSh7XG4gICAgICAgICAgbWluTGVuOiAxLFxuICAgICAgICAgIG1heExlbjogMjAsXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcbiAgICAgICAgfSksXG4gICAgICAgIHN1YnNjcmlwdGlvblRpZXI6IG5ldyBjb2duaXRvLlN0cmluZ0F0dHJpYnV0ZSh7XG4gICAgICAgICAgbWluTGVuOiAxLFxuICAgICAgICAgIG1heExlbjogMjAsXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcbiAgICAgICAgfSksXG4gICAgICB9LFxuICAgICAgcGFzc3dvcmRQb2xpY3k6IHtcbiAgICAgICAgbWluTGVuZ3RoOiA4LFxuICAgICAgICByZXF1aXJlTG93ZXJjYXNlOiB0cnVlLFxuICAgICAgICByZXF1aXJlVXBwZXJjYXNlOiB0cnVlLFxuICAgICAgICByZXF1aXJlRGlnaXRzOiB0cnVlLFxuICAgICAgICByZXF1aXJlU3ltYm9sczogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBtZmE6IGNvZ25pdG8uTWZhLk9QVElPTkFMLFxuICAgICAgbWZhU2Vjb25kRmFjdG9yOiB7XG4gICAgICAgIHNtczogdHJ1ZSxcbiAgICAgICAgb3RwOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIGRldmljZVRyYWNraW5nOiB7XG4gICAgICAgIGNoYWxsZW5nZVJlcXVpcmVkT25OZXdEZXZpY2U6IHRydWUsXG4gICAgICAgIGRldmljZU9ubHlSZW1lbWJlcmVkT25Vc2VyUHJvbXB0OiBmYWxzZSxcbiAgICAgIH0sXG4gICAgICBhY2NvdW50UmVjb3Zlcnk6IGNvZ25pdG8uQWNjb3VudFJlY292ZXJ5LkVNQUlMX09OTFksXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIFVzZXIgUG9vbCBDbGllbnQgZm9yIFdlYiBBcHBcbiAgICB0aGlzLnVzZXJQb29sQ2xpZW50ID0gbmV3IGNvZ25pdG8uVXNlclBvb2xDbGllbnQodGhpcywgJ1dlYkFwcENsaWVudCcsIHtcbiAgICAgIHVzZXJQb29sOiB0aGlzLnVzZXJQb29sLFxuICAgICAgdXNlclBvb2xDbGllbnROYW1lOiAnZ3ltY29hY2gtYWktd2ViLWNsaWVudCcsXG4gICAgICBnZW5lcmF0ZVNlY3JldDogZmFsc2UsXG4gICAgICBhdXRoRmxvd3M6IHtcbiAgICAgICAgdXNlclBhc3N3b3JkOiB0cnVlLFxuICAgICAgICB1c2VyU3JwOiB0cnVlLFxuICAgICAgICBjdXN0b206IHRydWUsXG4gICAgICB9LFxuICAgICAgb0F1dGg6IHtcbiAgICAgICAgZmxvd3M6IHtcbiAgICAgICAgICBhdXRob3JpemF0aW9uQ29kZUdyYW50OiB0cnVlLFxuICAgICAgICAgIGltcGxpY2l0Q29kZUdyYW50OiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICBzY29wZXM6IFtcbiAgICAgICAgICBjb2duaXRvLk9BdXRoU2NvcGUuRU1BSUwsXG4gICAgICAgICAgY29nbml0by5PQXV0aFNjb3BlLk9QRU5JRCxcbiAgICAgICAgICBjb2duaXRvLk9BdXRoU2NvcGUuUFJPRklMRSxcbiAgICAgICAgXSxcbiAgICAgICAgY2FsbGJhY2tVcmxzOiBbXG4gICAgICAgICAgJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMC9hdXRoL2NhbGxiYWNrJyxcbiAgICAgICAgICAnaHR0cHM6Ly8qLmNsb3VkZnJvbnQubmV0L2F1dGgvY2FsbGJhY2snLFxuICAgICAgICBdLFxuICAgICAgICBsb2dvdXRVcmxzOiBbXG4gICAgICAgICAgJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMC9hdXRoL2xvZ291dCcsXG4gICAgICAgICAgJ2h0dHBzOi8vKi5jbG91ZGZyb250Lm5ldC9hdXRoL2xvZ291dCcsXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgICAgcmVmcmVzaFRva2VuVmFsaWRpdHk6IGNkay5EdXJhdGlvbi5kYXlzKDMwKSxcbiAgICAgIGFjY2Vzc1Rva2VuVmFsaWRpdHk6IGNkay5EdXJhdGlvbi5ob3VycygxKSxcbiAgICAgIGlkVG9rZW5WYWxpZGl0eTogY2RrLkR1cmF0aW9uLmhvdXJzKDEpLFxuICAgICAgcHJldmVudFVzZXJFeGlzdGVuY2VFcnJvcnM6IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgVXNlciBQb29sIERvbWFpblxuICAgIHRoaXMudXNlclBvb2xEb21haW4gPSB0aGlzLnVzZXJQb29sLmFkZERvbWFpbignQ29nbml0b0RvbWFpbicsIHtcbiAgICAgIGNvZ25pdG9Eb21haW46IHtcbiAgICAgICAgZG9tYWluUHJlZml4OiBgZ3ltY29hY2gtYWktJHt0aGlzLmFjY291bnR9YCxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgVXNlciBHcm91cHMgZm9yIFJvbGUtQmFzZWQgQWNjZXNzIENvbnRyb2xcbiAgICBjb25zdCBhZG1pbkdyb3VwID0gbmV3IGNvZ25pdG8uQ2ZuVXNlclBvb2xHcm91cCh0aGlzLCAnQWRtaW5Hcm91cCcsIHtcbiAgICAgIHVzZXJQb29sSWQ6IHRoaXMudXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgIGdyb3VwTmFtZTogJ2FkbWluJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQWRtaW5pc3RyYXRvcnMgd2l0aCBmdWxsIGFjY2VzcycsXG4gICAgICBwcmVjZWRlbmNlOiAxLFxuICAgIH0pO1xuXG4gICAgY29uc3QgY29hY2hHcm91cCA9IG5ldyBjb2duaXRvLkNmblVzZXJQb29sR3JvdXAodGhpcywgJ0NvYWNoR3JvdXAnLCB7XG4gICAgICB1c2VyUG9vbElkOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICBncm91cE5hbWU6ICdjb2FjaCcsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvYWNoZXMgd2l0aCBhY2Nlc3MgdG8gdXNlciBkYXRhIGZvciBjb2FjaGluZycsXG4gICAgICBwcmVjZWRlbmNlOiAyLFxuICAgIH0pO1xuXG4gICAgY29uc3QgdXNlckdyb3VwID0gbmV3IGNvZ25pdG8uQ2ZuVXNlclBvb2xHcm91cCh0aGlzLCAnVXNlckdyb3VwJywge1xuICAgICAgdXNlclBvb2xJZDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgZ3JvdXBOYW1lOiAndXNlcicsXG4gICAgICBkZXNjcmlwdGlvbjogJ1JlZ3VsYXIgdXNlcnMgd2l0aCBhY2Nlc3MgdG8gdGhlaXIgb3duIGRhdGEnLFxuICAgICAgcHJlY2VkZW5jZTogMyxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBTTlMgVG9waWNzIGZvciBkaWZmZXJlbnQgbm90aWZpY2F0aW9uIHR5cGVzXG4gICAgY29uc3Qgd29ya291dFJlbWluZGVyc1RvcGljID0gbmV3IHNucy5Ub3BpYyh0aGlzLCAnV29ya291dFJlbWluZGVyc1RvcGljJywge1xuICAgICAgdG9waWNOYW1lOiAnZ3ltY29hY2gtYWktd29ya291dC1yZW1pbmRlcnMnLFxuICAgICAgZGlzcGxheU5hbWU6ICdXb3Jrb3V0IFJlbWluZGVycycsXG4gICAgfSk7XG5cbiAgICBjb25zdCBudXRyaXRpb25SZW1pbmRlcnNUb3BpYyA9IG5ldyBzbnMuVG9waWMoXG4gICAgICB0aGlzLFxuICAgICAgJ051dHJpdGlvblJlbWluZGVyc1RvcGljJyxcbiAgICAgIHtcbiAgICAgICAgdG9waWNOYW1lOiAnZ3ltY29hY2gtYWktbnV0cml0aW9uLXJlbWluZGVycycsXG4gICAgICAgIGRpc3BsYXlOYW1lOiAnTnV0cml0aW9uIFJlbWluZGVycycsXG4gICAgICB9XG4gICAgKTtcblxuICAgIGNvbnN0IGFjaGlldmVtZW50VG9waWMgPSBuZXcgc25zLlRvcGljKHRoaXMsICdBY2hpZXZlbWVudFRvcGljJywge1xuICAgICAgdG9waWNOYW1lOiAnZ3ltY29hY2gtYWktYWNoaWV2ZW1lbnRzJyxcbiAgICAgIGRpc3BsYXlOYW1lOiAnQWNoaWV2ZW1lbnQgTm90aWZpY2F0aW9ucycsXG4gICAgfSk7XG5cbiAgICBjb25zdCBhaVN1Z2dlc3Rpb25zVG9waWMgPSBuZXcgc25zLlRvcGljKHRoaXMsICdBSVN1Z2dlc3Rpb25zVG9waWMnLCB7XG4gICAgICB0b3BpY05hbWU6ICdneW1jb2FjaC1haS1zdWdnZXN0aW9ucycsXG4gICAgICBkaXNwbGF5TmFtZTogJ0FJIFN1Z2dlc3Rpb25zJyxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBFdmVudEJyaWRnZSBSdWxlcyBmb3Igc2NoZWR1bGVkIG5vdGlmaWNhdGlvbnNcbiAgICBjb25zdCB3b3Jrb3V0UmVtaW5kZXJSdWxlID0gbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdXb3Jrb3V0UmVtaW5kZXJSdWxlJywge1xuICAgICAgcnVsZU5hbWU6ICdneW1jb2FjaC1haS13b3Jrb3V0LXJlbWluZGVycycsXG4gICAgICBkZXNjcmlwdGlvbjogJ1RyaWdnZXJzIHdvcmtvdXQgcmVtaW5kZXIgbm90aWZpY2F0aW9ucycsXG4gICAgICBzY2hlZHVsZTogZXZlbnRzLlNjaGVkdWxlLmNyb24oe1xuICAgICAgICBtaW51dGU6ICcwJyxcbiAgICAgICAgaG91cjogJzgnLCAvLyA4IEFNIFVUQyAtIHdpbGwgYmUgYWRqdXN0ZWQgcGVyIHVzZXIgdGltZXpvbmVcbiAgICAgIH0pLFxuICAgIH0pO1xuXG4gICAgY29uc3QgbnV0cml0aW9uUmVtaW5kZXJSdWxlID0gbmV3IGV2ZW50cy5SdWxlKFxuICAgICAgdGhpcyxcbiAgICAgICdOdXRyaXRpb25SZW1pbmRlclJ1bGUnLFxuICAgICAge1xuICAgICAgICBydWxlTmFtZTogJ2d5bWNvYWNoLWFpLW51dHJpdGlvbi1yZW1pbmRlcnMnLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ1RyaWdnZXJzIG51dHJpdGlvbiByZW1pbmRlciBub3RpZmljYXRpb25zJyxcbiAgICAgICAgc2NoZWR1bGU6IGV2ZW50cy5TY2hlZHVsZS5jcm9uKHtcbiAgICAgICAgICBtaW51dGU6ICcwJyxcbiAgICAgICAgICBob3VyOiAnMTInLCAvLyAxMiBQTSBVVEMgLSB3aWxsIGJlIGFkanVzdGVkIHBlciB1c2VyIHRpbWV6b25lXG4gICAgICAgIH0pLFxuICAgICAgfVxuICAgICk7XG5cbiAgICBjb25zdCB3YXRlclJlbWluZGVyUnVsZSA9IG5ldyBldmVudHMuUnVsZSh0aGlzLCAnV2F0ZXJSZW1pbmRlclJ1bGUnLCB7XG4gICAgICBydWxlTmFtZTogJ2d5bWNvYWNoLWFpLXdhdGVyLXJlbWluZGVycycsXG4gICAgICBkZXNjcmlwdGlvbjogJ1RyaWdnZXJzIHdhdGVyIGludGFrZSByZW1pbmRlciBub3RpZmljYXRpb25zJyxcbiAgICAgIHNjaGVkdWxlOiBldmVudHMuU2NoZWR1bGUuY3Jvbih7XG4gICAgICAgIG1pbnV0ZTogJzAnLFxuICAgICAgICBob3VyOiAnKicsIC8vIEV2ZXJ5IGhvdXJcbiAgICAgIH0pLFxuICAgIH0pO1xuXG4gICAgY29uc3QgcHJvZ3Jlc3NQaG90b1J1bGUgPSBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ1Byb2dyZXNzUGhvdG9SdWxlJywge1xuICAgICAgcnVsZU5hbWU6ICdneW1jb2FjaC1haS1wcm9ncmVzcy1waG90b3MnLFxuICAgICAgZGVzY3JpcHRpb246ICdUcmlnZ2VycyB3ZWVrbHkgcHJvZ3Jlc3MgcGhvdG8gcmVtaW5kZXJzJyxcbiAgICAgIHNjaGVkdWxlOiBldmVudHMuU2NoZWR1bGUuY3Jvbih7XG4gICAgICAgIG1pbnV0ZTogJzAnLFxuICAgICAgICBob3VyOiAnMTgnLCAvLyA2IFBNIFVUQyBvbiBTdW5kYXlzXG4gICAgICAgIHdlZWtEYXk6ICdTVU4nLFxuICAgICAgfSksXG4gICAgfSk7XG5cbiAgICAvLyBQcm9hY3RpdmUgQ29hY2hpbmcgRXZlbnRCcmlkZ2UgUnVsZXNcbiAgICBjb25zdCBwcm9hY3RpdmVDaGVja0luUnVsZSA9IG5ldyBldmVudHMuUnVsZSh0aGlzLCAnUHJvYWN0aXZlQ2hlY2tJblJ1bGUnLCB7XG4gICAgICBydWxlTmFtZTogJ2d5bWNvYWNoLWFpLXByb2FjdGl2ZS1jaGVja2lucycsXG4gICAgICBkZXNjcmlwdGlvbjogJ1RyaWdnZXJzIHByb2FjdGl2ZSBBSSBjb2FjaCBjaGVjay1pbnMnLFxuICAgICAgc2NoZWR1bGU6IGV2ZW50cy5TY2hlZHVsZS5jcm9uKHtcbiAgICAgICAgbWludXRlOiAnMCcsXG4gICAgICAgIGhvdXI6ICc5JywgLy8gOSBBTSBVVEMgZGFpbHlcbiAgICAgIH0pLFxuICAgIH0pO1xuXG4gICAgY29uc3QgcHJvZ3Jlc3NNb25pdG9yUnVsZSA9IG5ldyBldmVudHMuUnVsZSh0aGlzLCAnUHJvZ3Jlc3NNb25pdG9yUnVsZScsIHtcbiAgICAgIHJ1bGVOYW1lOiAnZ3ltY29hY2gtYWktcHJvZ3Jlc3MtbW9uaXRvcmluZycsXG4gICAgICBkZXNjcmlwdGlvbjogJ01vbml0b3JzIHVzZXIgcHJvZ3Jlc3MgYW5kIHRyaWdnZXJzIGludGVydmVudGlvbnMnLFxuICAgICAgc2NoZWR1bGU6IGV2ZW50cy5TY2hlZHVsZS5jcm9uKHtcbiAgICAgICAgbWludXRlOiAnMCcsXG4gICAgICAgIGhvdXI6ICc2JywgLy8gNiBBTSBVVEMgZGFpbHlcbiAgICAgIH0pLFxuICAgIH0pO1xuXG4gICAgY29uc3QgcGxhdGVhdURldGVjdGlvblJ1bGUgPSBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ1BsYXRlYXVEZXRlY3Rpb25SdWxlJywge1xuICAgICAgcnVsZU5hbWU6ICdneW1jb2FjaC1haS1wbGF0ZWF1LWRldGVjdGlvbicsXG4gICAgICBkZXNjcmlwdGlvbjogJ0RldGVjdHMgd29ya291dCBwbGF0ZWF1cyBhbmQgc3VnZ2VzdHMgY2hhbmdlcycsXG4gICAgICBzY2hlZHVsZTogZXZlbnRzLlNjaGVkdWxlLmNyb24oe1xuICAgICAgICBtaW51dGU6ICcwJyxcbiAgICAgICAgaG91cjogJzIwJywgLy8gOCBQTSBVVEMgb24gU3VuZGF5c1xuICAgICAgICB3ZWVrRGF5OiAnU1VOJyxcbiAgICAgIH0pLFxuICAgIH0pO1xuXG4gICAgY29uc3QgbW90aXZhdGlvbkJvb3N0UnVsZSA9IG5ldyBldmVudHMuUnVsZSh0aGlzLCAnTW90aXZhdGlvbkJvb3N0UnVsZScsIHtcbiAgICAgIHJ1bGVOYW1lOiAnZ3ltY29hY2gtYWktbW90aXZhdGlvbi1ib29zdCcsXG4gICAgICBkZXNjcmlwdGlvbjogJ1NlbmRzIG1vdGl2YXRpb25hbCBtZXNzYWdlcyBiYXNlZCBvbiB1c2VyIHBhdHRlcm5zJyxcbiAgICAgIHNjaGVkdWxlOiBldmVudHMuU2NoZWR1bGUuY3Jvbih7XG4gICAgICAgIG1pbnV0ZTogJzAnLFxuICAgICAgICBob3VyOiAnNycsIC8vIDcgQU0gVVRDIG9uIE1vbmRheXNcbiAgICAgICAgd2Vla0RheTogJ01PTicsXG4gICAgICB9KSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHdlZWtseVJldmlld1J1bGUgPSBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ1dlZWtseVJldmlld1J1bGUnLCB7XG4gICAgICBydWxlTmFtZTogJ2d5bWNvYWNoLWFpLXdlZWtseS1yZXZpZXcnLFxuICAgICAgZGVzY3JpcHRpb246ICdHZW5lcmF0ZXMgd2Vla2x5IHByb2dyZXNzIHJldmlld3MgYW5kIHJlY29tbWVuZGF0aW9ucycsXG4gICAgICBzY2hlZHVsZTogZXZlbnRzLlNjaGVkdWxlLmNyb24oe1xuICAgICAgICBtaW51dGU6ICcwJyxcbiAgICAgICAgaG91cjogJzE5JywgLy8gNyBQTSBVVEMgb24gU3VuZGF5c1xuICAgICAgICB3ZWVrRGF5OiAnU1VOJyxcbiAgICAgIH0pLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIFMzIEJ1Y2tldHMgKG5lZWRlZCBieSBMYW1iZGFzKVxuICAgIHRoaXMudXNlclVwbG9hZHNCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdVc2VyVXBsb2Fkc0J1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGBneW1jb2FjaC1haS11c2VyLXVwbG9hZHMtJHt0aGlzLmFjY291bnR9YCxcbiAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBuZXcgczMuQmxvY2tQdWJsaWNBY2Nlc3Moe1xuICAgICAgICBibG9ja1B1YmxpY0FjbHM6IGZhbHNlLFxuICAgICAgICBibG9ja1B1YmxpY1BvbGljeTogZmFsc2UsXG4gICAgICAgIGlnbm9yZVB1YmxpY0FjbHM6IGZhbHNlLFxuICAgICAgICByZXN0cmljdFB1YmxpY0J1Y2tldHM6IGZhbHNlLFxuICAgICAgfSksXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgY29yczogW1xuICAgICAgICB7XG4gICAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBbXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5HRVQsXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5QVVQsXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5QT1NULFxuICAgICAgICAgICAgczMuSHR0cE1ldGhvZHMuREVMRVRFLFxuICAgICAgICAgICAgczMuSHR0cE1ldGhvZHMuSEVBRCxcbiAgICAgICAgICBdLFxuICAgICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcbiAgICAgICAgICBleHBvc2VkSGVhZGVyczogWydFVGFnJ10sXG4gICAgICAgICAgbWF4QWdlOiAzMDAwLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ0RlbGV0ZUluY29tcGxldGVNdWx0aXBhcnRVcGxvYWRzJyxcbiAgICAgICAgICBhYm9ydEluY29tcGxldGVNdWx0aXBhcnRVcGxvYWRBZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoNyksXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ1RyYW5zaXRpb25Ub0lBJyxcbiAgICAgICAgICB0cmFuc2l0aW9uczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBzdG9yYWdlQ2xhc3M6IHMzLlN0b3JhZ2VDbGFzcy5JTkZSRVFVRU5UX0FDQ0VTUyxcbiAgICAgICAgICAgICAgdHJhbnNpdGlvbkFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cygzMCksXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ1RyYW5zaXRpb25Ub0dsYWNpZXInLFxuICAgICAgICAgIHRyYW5zaXRpb25zOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHN0b3JhZ2VDbGFzczogczMuU3RvcmFnZUNsYXNzLkdMQUNJRVIsXG4gICAgICAgICAgICAgIHRyYW5zaXRpb25BZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoOTApLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIEFkZCBidWNrZXQgcG9saWN5IHRvIGFsbG93IHB1YmxpYyByZWFkIGFjY2VzcyB0byB1cGxvYWRlZCBpbWFnZXNcbiAgICB0aGlzLnVzZXJVcGxvYWRzQnVja2V0LmFkZFRvUmVzb3VyY2VQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgcHJpbmNpcGFsczogW25ldyBpYW0uQW55UHJpbmNpcGFsKCldLFxuICAgICAgICBhY3Rpb25zOiBbJ3MzOkdldE9iamVjdCddLFxuICAgICAgICByZXNvdXJjZXM6IFtgJHt0aGlzLnVzZXJVcGxvYWRzQnVja2V0LmJ1Y2tldEFybn0vdXNlci1wcm9maWxlcy8qYF0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICB0aGlzLnN0YXRpY0Fzc2V0c0J1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ1N0YXRpY0Fzc2V0c0J1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGBneW1jb2FjaC1haS1zdGF0aWMtYXNzZXRzLSR7dGhpcy5hY2NvdW50fWAsXG4gICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIHB1YmxpY1JlYWRBY2Nlc3M6IGZhbHNlLFxuICAgIH0pO1xuXG4gICAgdGhpcy5wcm9jZXNzZWRJbWFnZXNCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdQcm9jZXNzZWRJbWFnZXNCdWNrZXQnLCB7XG4gICAgICBidWNrZXROYW1lOiBgZ3ltY29hY2gtYWktcHJvY2Vzc2VkLWltYWdlcy0ke3RoaXMuYWNjb3VudH1gLFxuICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgZGVkaWNhdGVkIFByb2dyZXNzIFBob3RvcyBTMyBCdWNrZXQgd2l0aCBlbmhhbmNlZCBzZWN1cml0eVxuICAgIHRoaXMucHJvZ3Jlc3NQaG90b3NCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdQcm9ncmVzc1Bob3Rvc0J1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGBneW1jb2FjaC1haS1wcm9ncmVzcy1waG90b3MtJHt0aGlzLmFjY291bnR9YCxcbiAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgY29yczogW1xuICAgICAgICB7XG4gICAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBbXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5HRVQsXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5QVVQsXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5QT1NULFxuICAgICAgICAgICAgczMuSHR0cE1ldGhvZHMuREVMRVRFLFxuICAgICAgICAgICAgczMuSHR0cE1ldGhvZHMuSEVBRCxcbiAgICAgICAgICBdLFxuICAgICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcbiAgICAgICAgICBleHBvc2VkSGVhZGVyczogWydFVGFnJ10sXG4gICAgICAgICAgbWF4QWdlOiAzMDAwLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ0RlbGV0ZUluY29tcGxldGVNdWx0aXBhcnRVcGxvYWRzJyxcbiAgICAgICAgICBhYm9ydEluY29tcGxldGVNdWx0aXBhcnRVcGxvYWRBZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoMSksXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ1RyYW5zaXRpb25Qcm9ncmVzc1Bob3Rvc1RvSUEnLFxuICAgICAgICAgIHRyYW5zaXRpb25zOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHN0b3JhZ2VDbGFzczogczMuU3RvcmFnZUNsYXNzLklORlJFUVVFTlRfQUNDRVNTLFxuICAgICAgICAgICAgICB0cmFuc2l0aW9uQWZ0ZXI6IGNkay5EdXJhdGlvbi5kYXlzKDMwKSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAnQXJjaGl2ZU9sZFByb2dyZXNzUGhvdG9zJyxcbiAgICAgICAgICB0cmFuc2l0aW9uczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBzdG9yYWdlQ2xhc3M6IHMzLlN0b3JhZ2VDbGFzcy5HTEFDSUVSLFxuICAgICAgICAgICAgICB0cmFuc2l0aW9uQWZ0ZXI6IGNkay5EdXJhdGlvbi5kYXlzKDM2NSksXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIENsb3VkRnJvbnQgT3JpZ2luIEFjY2VzcyBJZGVudGl0eSBmb3Igc2VjdXJlIFMzIGFjY2Vzc1xuICAgIGNvbnN0IHByb2dyZXNzUGhvdG9zT0FJID0gbmV3IGNsb3VkZnJvbnQuT3JpZ2luQWNjZXNzSWRlbnRpdHkoXG4gICAgICB0aGlzLFxuICAgICAgJ1Byb2dyZXNzUGhvdG9zT0FJJyxcbiAgICAgIHtcbiAgICAgICAgY29tbWVudDogJ09yaWdpbiBBY2Nlc3MgSWRlbnRpdHkgZm9yIFByb2dyZXNzIFBob3RvcyBidWNrZXQgdjInLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBHcmFudCBDbG91ZEZyb250IE9BSSBhY2Nlc3MgdG8gcHJvZ3Jlc3MgcGhvdG9zIGJ1Y2tldFxuICAgIHRoaXMucHJvZ3Jlc3NQaG90b3NCdWNrZXQuYWRkVG9SZXNvdXJjZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBwcmluY2lwYWxzOiBbcHJvZ3Jlc3NQaG90b3NPQUkuZ3JhbnRQcmluY2lwYWxdLFxuICAgICAgICBhY3Rpb25zOiBbJ3MzOkdldE9iamVjdCddLFxuICAgICAgICByZXNvdXJjZXM6IFtgJHt0aGlzLnByb2dyZXNzUGhvdG9zQnVja2V0LmJ1Y2tldEFybn0vKmBdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gQ3JlYXRlIENsb3VkRnJvbnQgT3JpZ2luIEFjY2VzcyBJZGVudGl0eSBmb3IgZnJvbnRlbmQgYnVja2V0XG4gICAgY29uc3QgZnJvbnRlbmRPQUkgPSBuZXcgY2xvdWRmcm9udC5PcmlnaW5BY2Nlc3NJZGVudGl0eShcbiAgICAgIHRoaXMsXG4gICAgICAnRnJvbnRlbmRPQUknLFxuICAgICAge1xuICAgICAgICBjb21tZW50OiAnT3JpZ2luIEFjY2VzcyBJZGVudGl0eSBmb3IgRnJvbnRlbmQgYnVja2V0JyxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gQ3JlYXRlIEZyb250ZW5kIFMzIEJ1Y2tldCBmb3Igc3RhdGljIGFzc2V0c1xuICAgIHRoaXMuZnJvbnRlbmRCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdGcm9udGVuZEJ1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGBneW1jb2FjaC1haS1mcm9udGVuZC0ke3RoaXMuYWNjb3VudH1gLFxuICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgcHVibGljUmVhZEFjY2VzczogZmFsc2UsIC8vIE9ubHkgQ2xvdWRGcm9udCBPQUkgc2hvdWxkIGFjY2Vzc1xuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCwgLy8gQmxvY2sgYWxsIHB1YmxpYyBhY2Nlc3NcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBDbG91ZEZyb250IE9BSSBhY2Nlc3MgdG8gZnJvbnRlbmQgYnVja2V0XG4gICAgdGhpcy5mcm9udGVuZEJ1Y2tldC5hZGRUb1Jlc291cmNlUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIHByaW5jaXBhbHM6IFtmcm9udGVuZE9BSS5ncmFudFByaW5jaXBhbF0sXG4gICAgICAgIGFjdGlvbnM6IFsnczM6R2V0T2JqZWN0J10sXG4gICAgICAgIHJlc291cmNlczogW2Ake3RoaXMuZnJvbnRlbmRCdWNrZXQuYnVja2V0QXJufS8qYF0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBDcmVhdGUgUzMgVmVjdG9ycyBCdWNrZXQgZm9yIEFJIEtub3dsZWRnZSBCYXNlXG4gICAgdGhpcy52ZWN0b3JzQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnVmVjdG9yc0J1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGBneW1jb2FjaC1haS12ZWN0b3JzLSR7dGhpcy5hY2NvdW50fWAsXG4gICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIGNvcnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGFsbG93ZWRIZWFkZXJzOiBbJyonXSxcbiAgICAgICAgICBhbGxvd2VkTWV0aG9kczogW1xuICAgICAgICAgICAgczMuSHR0cE1ldGhvZHMuR0VULFxuICAgICAgICAgICAgczMuSHR0cE1ldGhvZHMuUFVULFxuICAgICAgICAgICAgczMuSHR0cE1ldGhvZHMuUE9TVCxcbiAgICAgICAgICAgIHMzLkh0dHBNZXRob2RzLkRFTEVURSxcbiAgICAgICAgICAgIHMzLkh0dHBNZXRob2RzLkhFQUQsXG4gICAgICAgICAgXSxcbiAgICAgICAgICBhbGxvd2VkT3JpZ2luczogWycqJ10sXG4gICAgICAgICAgZXhwb3NlZEhlYWRlcnM6IFsnRVRhZyddLFxuICAgICAgICAgIG1heEFnZTogMzAwMCxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgICBsaWZlY3ljbGVSdWxlczogW1xuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdEZWxldGVJbmNvbXBsZXRlTXVsdGlwYXJ0VXBsb2FkcycsXG4gICAgICAgICAgYWJvcnRJbmNvbXBsZXRlTXVsdGlwYXJ0VXBsb2FkQWZ0ZXI6IGNkay5EdXJhdGlvbi5kYXlzKDEpLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdUcmFuc2l0aW9uVmVjdG9yc1RvSUEnLFxuICAgICAgICAgIHRyYW5zaXRpb25zOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHN0b3JhZ2VDbGFzczogczMuU3RvcmFnZUNsYXNzLklORlJFUVVFTlRfQUNDRVNTLFxuICAgICAgICAgICAgICB0cmFuc2l0aW9uQWZ0ZXI6IGNkay5EdXJhdGlvbi5kYXlzKDMwKSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAnQXJjaGl2ZU9sZFZlY3RvcnMnLFxuICAgICAgICAgIHRyYW5zaXRpb25zOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHN0b3JhZ2VDbGFzczogczMuU3RvcmFnZUNsYXNzLkdMQUNJRVIsXG4gICAgICAgICAgICAgIHRyYW5zaXRpb25BZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoOTApLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBMYW1iZGEgQXV0aG9yaXplclxuICAgIGNvbnN0IGF1dGhvcml6ZXJMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdBdXRob3JpemVyTGFtYmRhJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKGBcbiAgICAgICAgY29uc3Qgand0ID0gcmVxdWlyZSgnanNvbndlYnRva2VuJyk7XG4gICAgICAgIGNvbnN0IGp3a3NDbGllbnQgPSByZXF1aXJlKCdqd2tzLXJzYScpO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgY2xpZW50ID0gandrc0NsaWVudCh7XG4gICAgICAgICAgandrc1VyaTogJ2h0dHBzOi8vY29nbml0by1pZHAuJHt0aGlzLnJlZ2lvbn0uYW1hem9uYXdzLmNvbS8ke3RoaXMudXNlclBvb2wudXNlclBvb2xJZH0vLndlbGwta25vd24vandrcy5qc29uJ1xuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIGZ1bmN0aW9uIGdldEtleShoZWFkZXIsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgY2xpZW50LmdldFNpZ25pbmdLZXkoaGVhZGVyLmtpZCwgKGVyciwga2V5KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBzaWduaW5nS2V5ID0ga2V5LnB1YmxpY0tleSB8fCBrZXkucnNhUHVibGljS2V5O1xuICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgc2lnbmluZ0tleSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGV4cG9ydHMuaGFuZGxlciA9IGFzeW5jIChldmVudCkgPT4ge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdBdXRob3JpemVyIGV2ZW50OicsIEpTT04uc3RyaW5naWZ5KGV2ZW50LCBudWxsLCAyKSk7XG4gICAgICAgICAgXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHRva2VuID0gZXZlbnQuaGVhZGVycy5hdXRob3JpemF0aW9uPy5yZXBsYWNlKCdCZWFyZXIgJywgJycpO1xuICAgICAgICAgICAgaWYgKCF0b2tlbikge1xuICAgICAgICAgICAgICByZXR1cm4gZ2VuZXJhdGVQb2xpY3koJ3VzZXInLCAnRGVueScsIGV2ZW50Lm1ldGhvZEFybik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IGRlY29kZWQgPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICAgIGp3dC52ZXJpZnkodG9rZW4sIGdldEtleSwgeyBhbGdvcml0aG1zOiBbJ1JTMjU2J10gfSwgKGVyciwgZGVjb2RlZCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgIGVsc2UgcmVzb2x2ZShkZWNvZGVkKTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uc29sZS5sb2coJ0RlY29kZWQgdG9rZW46JywgZGVjb2RlZCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiBnZW5lcmF0ZVBvbGljeShkZWNvZGVkLnN1YiwgJ0FsbG93JywgZXZlbnQubWV0aG9kQXJuLCBkZWNvZGVkKTtcbiAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignQXV0aG9yaXphdGlvbiBlcnJvcjonLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4gZ2VuZXJhdGVQb2xpY3koJ3VzZXInLCAnRGVueScsIGV2ZW50Lm1ldGhvZEFybik7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBcbiAgICAgICAgZnVuY3Rpb24gZ2VuZXJhdGVQb2xpY3kocHJpbmNpcGFsSWQsIGVmZmVjdCwgcmVzb3VyY2UsIGNvbnRleHQgPSB7fSkge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBwcmluY2lwYWxJZCxcbiAgICAgICAgICAgIHBvbGljeURvY3VtZW50OiB7XG4gICAgICAgICAgICAgIFZlcnNpb246ICcyMDEyLTEwLTE3JyxcbiAgICAgICAgICAgICAgU3RhdGVtZW50OiBbe1xuICAgICAgICAgICAgICAgIEFjdGlvbjogJ2V4ZWN1dGUtYXBpOkludm9rZScsXG4gICAgICAgICAgICAgICAgRWZmZWN0OiBlZmZlY3QsXG4gICAgICAgICAgICAgICAgUmVzb3VyY2U6IHJlc291cmNlXG4gICAgICAgICAgICAgIH1dXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgY29udGV4dFxuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgIGApLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgVVNFUl9QT09MX0lEOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICAgIFVTRVJfUE9PTF9DTElFTlRfSUQ6IHRoaXMudXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcbiAgICAgICAgVEFCTEVfTkFNRTogdGhpcy5tYWluVGFibGUudGFibGVOYW1lLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IHBlcm1pc3Npb25zIHRvIGF1dGhvcml6ZXJcbiAgICB0aGlzLm1haW5UYWJsZS5ncmFudFJlYWREYXRhKGF1dGhvcml6ZXJMYW1iZGEpO1xuXG4gICAgLy8gQ3JlYXRlIExhbWJkYSBmdW5jdGlvbnMgZm9yIGVhY2ggc2VydmljZVxuICAgIC8vIGNvbnN0IHVzZXJTZXJ2aWNlTGFtYmRhID0gdGhpcy5jcmVhdGVMYW1iZGFGdW5jdGlvbihcbiAgICAvLyAgICdVc2VyU2VydmljZScsXG4gICAgLy8gICAndXNlci1zZXJ2aWNlJ1xuICAgIC8vICk7XG4gICAgY29uc3QgdXNlclByb2ZpbGVTZXJ2aWNlTGFtYmRhID0gdGhpcy5jcmVhdGVMYW1iZGFGdW5jdGlvbihcbiAgICAgICdVc2VyUHJvZmlsZVNlcnZpY2UnLFxuICAgICAgJ3VzZXItcHJvZmlsZS1zZXJ2aWNlJ1xuICAgICk7XG4gICAgY29uc3Qgd29ya291dFNlcnZpY2VMYW1iZGEgPSB0aGlzLmNyZWF0ZUxhbWJkYUZ1bmN0aW9uKFxuICAgICAgJ1dvcmtvdXRTZXJ2aWNlJyxcbiAgICAgICd3b3Jrb3V0LXNlcnZpY2UnXG4gICAgKTtcbiAgICBjb25zdCBjb2FjaGluZ1NlcnZpY2VMYW1iZGEgPSB0aGlzLmNyZWF0ZUxhbWJkYUZ1bmN0aW9uKFxuICAgICAgJ0NvYWNoaW5nU2VydmljZScsXG4gICAgICAnY29hY2hpbmctc2VydmljZSdcbiAgICApO1xuICAgIGNvbnN0IGFuYWx5dGljc1NlcnZpY2VMYW1iZGEgPSB0aGlzLmNyZWF0ZUxhbWJkYUZ1bmN0aW9uKFxuICAgICAgJ0FuYWx5dGljc1NlcnZpY2UnLFxuICAgICAgJ2FuYWx5dGljcy1zZXJ2aWNlJyxcbiAgICAgIHtcbiAgICAgICAgLy8gQWRkIENsb3VkRnJvbnQgZG9tYWluIHBsYWNlaG9sZGVyIC0gd2lsbCBiZSB1cGRhdGVkIGFmdGVyIGRlcGxveW1lbnRcbiAgICAgICAgQ0xPVURGUk9OVF9ET01BSU46ICcnLCAvLyBVcGRhdGUgbWFudWFsbHkgYWZ0ZXIgZmlyc3QgZGVwbG95bWVudFxuICAgICAgfVxuICAgICk7XG4gICAgY29uc3QgbnV0cml0aW9uU2VydmljZUxhbWJkYSA9IHRoaXMuY3JlYXRlTGFtYmRhRnVuY3Rpb24oXG4gICAgICAnTnV0cml0aW9uU2VydmljZScsXG4gICAgICAnbnV0cml0aW9uLXNlcnZpY2UnXG4gICAgKTtcbiAgICBjb25zdCBhaVNlcnZpY2VMYW1iZGEgPSB0aGlzLmNyZWF0ZVB5dGhvbkxhbWJkYUZ1bmN0aW9uKFxuICAgICAgJ0FJU2VydmljZScsXG4gICAgICAnYWktc2VydmljZS1weXRob24nXG4gICAgKTtcblxuICAgIC8vIENyZWF0ZSBOb3RpZmljYXRpb24gU2VydmljZSBMYW1iZGFcbiAgICBjb25zdCBub3RpZmljYXRpb25TZXJ2aWNlTGFtYmRhID0gdGhpcy5jcmVhdGVMYW1iZGFGdW5jdGlvbihcbiAgICAgICdOb3RpZmljYXRpb25TZXJ2aWNlJyxcbiAgICAgICdub3RpZmljYXRpb24tc2VydmljZScsXG4gICAgICB7XG4gICAgICAgIFdPUktPVVRfUkVNSU5ERVJTX1RPUElDX0FSTjogd29ya291dFJlbWluZGVyc1RvcGljLnRvcGljQXJuLFxuICAgICAgICBOVVRSSVRJT05fUkVNSU5ERVJTX1RPUElDX0FSTjogbnV0cml0aW9uUmVtaW5kZXJzVG9waWMudG9waWNBcm4sXG4gICAgICAgIEFDSElFVkVNRU5UX1RPUElDX0FSTjogYWNoaWV2ZW1lbnRUb3BpYy50b3BpY0FybixcbiAgICAgICAgQUlfU1VHR0VTVElPTlNfVE9QSUNfQVJOOiBhaVN1Z2dlc3Rpb25zVG9waWMudG9waWNBcm4sXG4gICAgICAgIEZDTV9TRVJWRVJfS0VZOiBwcm9jZXNzLmVudi5GQ01fU0VSVkVSX0tFWSB8fCAncGxhY2Vob2xkZXInLFxuICAgICAgICBGSVJFQkFTRV9QUk9KRUNUX0lEOlxuICAgICAgICAgIHByb2Nlc3MuZW52LkZJUkVCQVNFX1BST0pFQ1RfSUQgfHwgJ2d5bWNvYWNoLTczNTI4JyxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gQ3JlYXRlIE5vdGlmaWNhdGlvbiBTY2hlZHVsZXIgTGFtYmRhXG4gICAgY29uc3Qgbm90aWZpY2F0aW9uU2NoZWR1bGVyTGFtYmRhID0gdGhpcy5jcmVhdGVMYW1iZGFGdW5jdGlvbihcbiAgICAgICdOb3RpZmljYXRpb25TY2hlZHVsZXInLFxuICAgICAgJ25vdGlmaWNhdGlvbi1zY2hlZHVsZXInLFxuICAgICAge1xuICAgICAgICBOT1RJRklDQVRJT05fU0VSVklDRV9GVU5DVElPTl9BUk46ICcnLCAvLyBXaWxsIGJlIHNldCBhZnRlciBjcmVhdGlvblxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBVcGRhdGUgbm90aWZpY2F0aW9uIHNjaGVkdWxlciB3aXRoIHRoZSBjb3JyZWN0IGZ1bmN0aW9uIEFSTlxuICAgIG5vdGlmaWNhdGlvblNjaGVkdWxlckxhbWJkYS5hZGRFbnZpcm9ubWVudChcbiAgICAgICdOT1RJRklDQVRJT05fU0VSVklDRV9GVU5DVElPTl9BUk4nLFxuICAgICAgbm90aWZpY2F0aW9uU2VydmljZUxhbWJkYS5mdW5jdGlvbkFyblxuICAgICk7XG5cbiAgICAvLyBFbmFibGUgTGFtYmRhIEZ1bmN0aW9uIFVSTHNcbiAgICAvLyBjb25zdCB1c2VyU2VydmljZVVybCA9IHVzZXJTZXJ2aWNlTGFtYmRhLmFkZEZ1bmN0aW9uVXJsKHtcbiAgICAvLyAgIGF1dGhUeXBlOiBsYW1iZGEuRnVuY3Rpb25VcmxBdXRoVHlwZS5OT05FLFxuICAgIC8vICAgY29yczoge1xuICAgIC8vICAgICBhbGxvd0NyZWRlbnRpYWxzOiBmYWxzZSxcbiAgICAvLyAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxuICAgIC8vICAgICBhbGxvd2VkTWV0aG9kczogW2xhbWJkYS5IdHRwTWV0aG9kLkFMTF0sXG4gICAgLy8gICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcbiAgICAvLyAgIH0sXG4gICAgLy8gfSk7XG5cbiAgICBjb25zdCB1c2VyUHJvZmlsZVNlcnZpY2VVcmwgPSB1c2VyUHJvZmlsZVNlcnZpY2VMYW1iZGEuYWRkRnVuY3Rpb25Vcmwoe1xuICAgICAgYXV0aFR5cGU6IGxhbWJkYS5GdW5jdGlvblVybEF1dGhUeXBlLk5PTkUsXG4gICAgICBjb3JzOiB7XG4gICAgICAgIGFsbG93Q3JlZGVudGlhbHM6IGZhbHNlLFxuICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXG4gICAgICAgIGFsbG93ZWRNZXRob2RzOiBbbGFtYmRhLkh0dHBNZXRob2QuQUxMXSxcbiAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHdvcmtvdXRTZXJ2aWNlVXJsID0gd29ya291dFNlcnZpY2VMYW1iZGEuYWRkRnVuY3Rpb25Vcmwoe1xuICAgICAgYXV0aFR5cGU6IGxhbWJkYS5GdW5jdGlvblVybEF1dGhUeXBlLk5PTkUsXG4gICAgICBjb3JzOiB7XG4gICAgICAgIGFsbG93Q3JlZGVudGlhbHM6IGZhbHNlLFxuICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXG4gICAgICAgIGFsbG93ZWRNZXRob2RzOiBbbGFtYmRhLkh0dHBNZXRob2QuQUxMXSxcbiAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGNvYWNoaW5nU2VydmljZVVybCA9IGNvYWNoaW5nU2VydmljZUxhbWJkYS5hZGRGdW5jdGlvblVybCh7XG4gICAgICBhdXRoVHlwZTogbGFtYmRhLkZ1bmN0aW9uVXJsQXV0aFR5cGUuTk9ORSxcbiAgICAgIGNvcnM6IHtcbiAgICAgICAgYWxsb3dDcmVkZW50aWFsczogZmFsc2UsXG4gICAgICAgIGFsbG93ZWRIZWFkZXJzOiBbJyonXSxcbiAgICAgICAgYWxsb3dlZE1ldGhvZHM6IFtsYW1iZGEuSHR0cE1ldGhvZC5BTExdLFxuICAgICAgICBhbGxvd2VkT3JpZ2luczogWycqJ10sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgY29uc3QgYW5hbHl0aWNzU2VydmljZVVybCA9IGFuYWx5dGljc1NlcnZpY2VMYW1iZGEuYWRkRnVuY3Rpb25Vcmwoe1xuICAgICAgYXV0aFR5cGU6IGxhbWJkYS5GdW5jdGlvblVybEF1dGhUeXBlLk5PTkUsXG4gICAgICBjb3JzOiB7XG4gICAgICAgIGFsbG93Q3JlZGVudGlhbHM6IGZhbHNlLFxuICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXG4gICAgICAgIGFsbG93ZWRNZXRob2RzOiBbbGFtYmRhLkh0dHBNZXRob2QuQUxMXSxcbiAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IG51dHJpdGlvblNlcnZpY2VVcmwgPSBudXRyaXRpb25TZXJ2aWNlTGFtYmRhLmFkZEZ1bmN0aW9uVXJsKHtcbiAgICAgIGF1dGhUeXBlOiBsYW1iZGEuRnVuY3Rpb25VcmxBdXRoVHlwZS5OT05FLFxuICAgICAgY29yczoge1xuICAgICAgICBhbGxvd0NyZWRlbnRpYWxzOiBmYWxzZSxcbiAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxuICAgICAgICBhbGxvd2VkTWV0aG9kczogW2xhbWJkYS5IdHRwTWV0aG9kLkFMTF0sXG4gICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCBhaVNlcnZpY2VVcmwgPSBhaVNlcnZpY2VMYW1iZGEuYWRkRnVuY3Rpb25Vcmwoe1xuICAgICAgYXV0aFR5cGU6IGxhbWJkYS5GdW5jdGlvblVybEF1dGhUeXBlLk5PTkUsXG4gICAgICBjb3JzOiB7XG4gICAgICAgIGFsbG93Q3JlZGVudGlhbHM6IGZhbHNlLFxuICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXG4gICAgICAgIGFsbG93ZWRNZXRob2RzOiBbbGFtYmRhLkh0dHBNZXRob2QuQUxMXSxcbiAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IG5vdGlmaWNhdGlvblNlcnZpY2VVcmwgPSBub3RpZmljYXRpb25TZXJ2aWNlTGFtYmRhLmFkZEZ1bmN0aW9uVXJsKHtcbiAgICAgIGF1dGhUeXBlOiBsYW1iZGEuRnVuY3Rpb25VcmxBdXRoVHlwZS5OT05FLFxuICAgICAgY29yczoge1xuICAgICAgICBhbGxvd0NyZWRlbnRpYWxzOiBmYWxzZSxcbiAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxuICAgICAgICBhbGxvd2VkTWV0aG9kczogW2xhbWJkYS5IdHRwTWV0aG9kLkFMTF0sXG4gICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgQ2xvdWRGcm9udCBEaXN0cmlidXRpb24gd2l0aCBMYW1iZGEgRnVuY3Rpb24gVVJMcyBhcyBvcmlnaW5zXG4gICAgY29uc3QgdXNlclByb2ZpbGVEb21haW4gPSBjZGsuRm4uc2VsZWN0KFxuICAgICAgMixcbiAgICAgIGNkay5Gbi5zcGxpdCgnLycsIHVzZXJQcm9maWxlU2VydmljZVVybC51cmwpXG4gICAgKTtcbiAgICBjb25zdCB3b3Jrb3V0RG9tYWluID0gY2RrLkZuLnNlbGVjdChcbiAgICAgIDIsXG4gICAgICBjZGsuRm4uc3BsaXQoJy8nLCB3b3Jrb3V0U2VydmljZVVybC51cmwpXG4gICAgKTtcbiAgICBjb25zdCBjb2FjaGluZ0RvbWFpbiA9IGNkay5Gbi5zZWxlY3QoXG4gICAgICAyLFxuICAgICAgY2RrLkZuLnNwbGl0KCcvJywgY29hY2hpbmdTZXJ2aWNlVXJsLnVybClcbiAgICApO1xuICAgIGNvbnN0IGFuYWx5dGljc0RvbWFpbiA9IGNkay5Gbi5zZWxlY3QoXG4gICAgICAyLFxuICAgICAgY2RrLkZuLnNwbGl0KCcvJywgYW5hbHl0aWNzU2VydmljZVVybC51cmwpXG4gICAgKTtcbiAgICBjb25zdCBudXRyaXRpb25Eb21haW4gPSBjZGsuRm4uc2VsZWN0KFxuICAgICAgMixcbiAgICAgIGNkay5Gbi5zcGxpdCgnLycsIG51dHJpdGlvblNlcnZpY2VVcmwudXJsKVxuICAgICk7XG4gICAgY29uc3QgYWlEb21haW4gPSBjZGsuRm4uc2VsZWN0KDIsIGNkay5Gbi5zcGxpdCgnLycsIGFpU2VydmljZVVybC51cmwpKTtcbiAgICBjb25zdCBub3RpZmljYXRpb25Eb21haW4gPSBjZGsuRm4uc2VsZWN0KFxuICAgICAgMixcbiAgICAgIGNkay5Gbi5zcGxpdCgnLycsIG5vdGlmaWNhdGlvblNlcnZpY2VVcmwudXJsKVxuICAgICk7XG5cbiAgICAvLyBXQUYgV2ViIEFDTCAtIENPTU1FTlRFRCBPVVQgKHJlcXVpcmVzIHVzLWVhc3QtMSByZWdpb24gZm9yIENsb3VkRnJvbnQpXG4gICAgLy8gVE9ETzogQ3JlYXRlIFdBRiBpbiB1cy1lYXN0LTEgcmVnaW9uIHNlcGFyYXRlbHkgb3IgdXNlIGNyb3NzLXJlZ2lvbiBhcHByb2FjaFxuICAgIC8vIGNvbnN0IHdhZldlYkFjbCA9IG5ldyB3YWZ2Mi5DZm5XZWJBQ0wodGhpcywgJ0d5bUNvYWNoQUlXQUYnLCB7XG4gICAgLy8gICBuYW1lOiAnZ3ltY29hY2gtYWktd2FmLWJhc2ljJyxcbiAgICAvLyAgIGRlc2NyaXB0aW9uOiAnQmFzaWMgV0FGIGZvciBHeW1Db2FjaCBBSSAtIEVzc2VudGlhbCBwcm90ZWN0aW9uIG9ubHkgKGNvc3Qtb3B0aW1pemVkKScsXG4gICAgLy8gICBzY29wZTogJ0NMT1VERlJPTlQnLFxuICAgIC8vICAgZGVmYXVsdEFjdGlvbjogeyBhbGxvdzoge30gfSxcbiAgICAvLyAgIHJ1bGVzOiBbXG4gICAgLy8gICAgIC8vIEJhc2ljIHJhdGUgbGltaXRpbmcgcnVsZSAtIEVTU0VOVElBTCAoa2VlcHMgY29zdHMgbG93KVxuICAgIC8vICAgICB7XG4gICAgLy8gICAgICAgbmFtZTogJ0Jhc2ljUmF0ZUxpbWl0UnVsZScsXG4gICAgLy8gICAgICAgcHJpb3JpdHk6IDEsXG4gICAgLy8gICAgICAgYWN0aW9uOiB7IGJsb2NrOiB7fSB9LFxuICAgIC8vICAgICAgIHN0YXRlbWVudDoge1xuICAgIC8vICAgICAgICAgcmF0ZUJhc2VkU3RhdGVtZW50OiB7XG4gICAgLy8gICAgICAgICAgIGxpbWl0OiA1MDAwLCAvLyA1MDAwIHJlcXVlc3RzIHBlciA1IG1pbnV0ZXNcbiAgICAvLyAgICAgICAgICAgYWdncmVnYXRlS2V5VHlwZTogJ0lQJyxcbiAgICAvLyAgICAgICAgIH0sXG4gICAgLy8gICAgICAgfSxcbiAgICAvLyAgICAgICB2aXNpYmlsaXR5Q29uZmlnOiB7XG4gICAgLy8gICAgICAgICBzYW1wbGVkUmVxdWVzdHNFbmFibGVkOiBmYWxzZSxcbiAgICAvLyAgICAgICAgIGNsb3VkV2F0Y2hNZXRyaWNzRW5hYmxlZDogZmFsc2UsXG4gICAgLy8gICAgICAgICBtZXRyaWNOYW1lOiAnQmFzaWNSYXRlTGltaXRNZXRyaWMnLFxuICAgIC8vICAgICAgIH0sXG4gICAgLy8gICAgIH0sXG4gICAgLy8gICBdLFxuICAgIC8vICAgdmlzaWJpbGl0eUNvbmZpZzoge1xuICAgIC8vICAgICBzYW1wbGVkUmVxdWVzdHNFbmFibGVkOiBmYWxzZSxcbiAgICAvLyAgICAgY2xvdWRXYXRjaE1ldHJpY3NFbmFibGVkOiBmYWxzZSxcbiAgICAvLyAgICAgbWV0cmljTmFtZTogJ0d5bUNvYWNoQUlXQUZCYXNpY01ldHJpYycsXG4gICAgLy8gICB9LFxuICAgIC8vIH0pO1xuXG4gICAgLy8gQ3JlYXRlIENsb3VkRnJvbnQgRnVuY3Rpb24gZm9yIFVSTCByZXdyaXRpbmcgKGhhbmRsZXMgU1BBIHJvdXRpbmcpXG4gICAgY29uc3QgdXJsUmV3cml0ZUZ1bmN0aW9uID0gbmV3IGNsb3VkZnJvbnQuRnVuY3Rpb24oXG4gICAgICB0aGlzLFxuICAgICAgJ1VybFJld3JpdGVGdW5jdGlvbicsXG4gICAgICB7XG4gICAgICAgIGZ1bmN0aW9uTmFtZTogJ3VybC1yZXdyaXRlLWZ1bmN0aW9uJyxcbiAgICAgICAgY29kZTogY2xvdWRmcm9udC5GdW5jdGlvbkNvZGUuZnJvbUlubGluZShgXG4gICAgICAgIGZ1bmN0aW9uIGhhbmRsZXIoZXZlbnQpIHtcbiAgICAgICAgICB2YXIgcmVxdWVzdCA9IGV2ZW50LnJlcXVlc3Q7XG4gICAgICAgICAgdmFyIHVyaSA9IHJlcXVlc3QudXJpO1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIEhhbmRsZSByb290IHBhdGggLSByZWRpcmVjdCB0byAvZW4gKGRlZmF1bHQgbG9jYWxlKVxuICAgICAgICAgIGlmICh1cmkgPT09ICcvJyB8fCB1cmkgPT09ICcnKSB7XG4gICAgICAgICAgICAvLyBDaGVjayBmb3IgcHJlZmVycmVkIGxvY2FsZSBpbiBjb29raWVcbiAgICAgICAgICAgIHZhciBjb29raWVzID0gcmVxdWVzdC5jb29raWVzO1xuICAgICAgICAgICAgdmFyIHByZWZlcnJlZExvY2FsZSA9ICdlbic7IC8vIGRlZmF1bHRcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKGNvb2tpZXMucHJlZmVycmVkTG9jYWxlICYmIGNvb2tpZXMucHJlZmVycmVkTG9jYWxlLnZhbHVlKSB7XG4gICAgICAgICAgICAgIHZhciBsb2NhbGUgPSBjb29raWVzLnByZWZlcnJlZExvY2FsZS52YWx1ZTtcbiAgICAgICAgICAgICAgdmFyIHN1cHBvcnRlZExvY2FsZXMgPSBbJ2VuJywgJ2FyJywgJ3N2J107XG4gICAgICAgICAgICAgIGlmIChzdXBwb3J0ZWRMb2NhbGVzLmluZGV4T2YobG9jYWxlKSAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICBwcmVmZXJyZWRMb2NhbGUgPSBsb2NhbGU7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gUmVkaXJlY3QgdG8gdGhlIHByZWZlcnJlZCBsb2NhbGVcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIHN0YXR1c0NvZGU6IDMwMixcbiAgICAgICAgICAgICAgc3RhdHVzRGVzY3JpcHRpb246ICdGb3VuZCcsXG4gICAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgICBsb2NhdGlvbjogeyB2YWx1ZTogJy8nICsgcHJlZmVycmVkTG9jYWxlIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgLy8gSWYgVVJJIGhhcyBhIGZpbGUgZXh0ZW5zaW9uLCByZXR1cm4gYXMtaXNcbiAgICAgICAgICBpZiAoL1xcXFwuW2EtekEtWjAtOV0rJC8udGVzdCh1cmkpKSB7XG4gICAgICAgICAgICByZXR1cm4gcmVxdWVzdDtcbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgLy8gSGFuZGxlIGxvY2FsZSByb3V0ZXMgKGUuZy4sIC9lbiwgL2FyLCAvc3YpXG4gICAgICAgICAgdmFyIHN1cHBvcnRlZExvY2FsZXMgPSBbJ2VuJywgJ2FyJywgJ3N2J107XG4gICAgICAgICAgdmFyIHBhdGhTZWdtZW50cyA9IHVyaS5zcGxpdCgnLycpLmZpbHRlcihmdW5jdGlvbihzZWdtZW50KSB7IHJldHVybiBzZWdtZW50Lmxlbmd0aCA+IDA7IH0pO1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIElmIHRoZSBmaXJzdCBzZWdtZW50IGlzIGEgc3VwcG9ydGVkIGxvY2FsZVxuICAgICAgICAgIGlmIChwYXRoU2VnbWVudHMubGVuZ3RoID4gMCAmJiBzdXBwb3J0ZWRMb2NhbGVzLmluZGV4T2YocGF0aFNlZ21lbnRzWzBdKSAhPT0gLTEpIHtcbiAgICAgICAgICAgIC8vIEZvciBsb2NhbGUgcm91dGVzLCBzZXJ2ZSB0aGUgc3BlY2lmaWMgcm91dGUncyBpbmRleC5odG1sXG4gICAgICAgICAgICBpZiAocGF0aFNlZ21lbnRzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgICAvLyBSb290IGxvY2FsZSByb3V0ZSAoZS5nLiwgL2VuKVxuICAgICAgICAgICAgICByZXF1ZXN0LnVyaSA9ICcvJyArIHBhdGhTZWdtZW50c1swXSArICcvaW5kZXguaHRtbCc7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyBOZXN0ZWQgbG9jYWxlIHJvdXRlIChlLmcuLCAvZW4vcHJvZmlsZSlcbiAgICAgICAgICAgICAgcmVxdWVzdC51cmkgPSB1cmkgKyAnL2luZGV4Lmh0bWwnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHJlcXVlc3Q7XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIC8vIElmIFVSSSBlbmRzIHdpdGggLywgYXBwZW5kIGluZGV4Lmh0bWxcbiAgICAgICAgICBpZiAodXJpLmVuZHNXaXRoKCcvJykpIHtcbiAgICAgICAgICAgIHJlcXVlc3QudXJpICs9ICdpbmRleC5odG1sJztcbiAgICAgICAgICAgIHJldHVybiByZXF1ZXN0O1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICAvLyBGb3IgcGF0aHMgd2l0aG91dCBleHRlbnNpb24gYW5kIHdpdGhvdXQgdHJhaWxpbmcgc2xhc2gsXG4gICAgICAgICAgLy8gY2hlY2sgaWYgaXQncyBsaWtlbHkgYSByb3V0ZSAobm90IGEgZmlsZSlcbiAgICAgICAgICBpZiAoIXVyaS5pbmNsdWRlcygnLicpKSB7XG4gICAgICAgICAgICAvLyBGb3Igc3RhdGljIGV4cG9ydCwgYWx3YXlzIHNlcnZlIHRoZSBzcGVjaWZpYyByb3V0ZSdzIGluZGV4Lmh0bWxcbiAgICAgICAgICAgIHJlcXVlc3QudXJpID0gdXJpICsgJy9pbmRleC5odG1sJztcbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgcmV0dXJuIHJlcXVlc3Q7XG4gICAgICAgIH1cbiAgICAgIGApLFxuICAgICAgICBjb21tZW50OlxuICAgICAgICAgICdVUkwgcmV3cml0ZSBmdW5jdGlvbiBmb3IgU1BBIHJvdXRpbmcgd2l0aCBpMThuIHN1cHBvcnQgLSBzZXJ2ZXMgaW5kZXguaHRtbCBmb3IgYWxsIHJvdXRlcyBpbmNsdWRpbmcgbG9jYWxlIHJvdXRlcyBhbmQgaGFuZGxlcyBsb2NhbGUgcmVkaXJlY3Rpb24gZnJvbSByb290JyxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgdGhpcy5kaXN0cmlidXRpb24gPSBuZXcgY2xvdWRmcm9udC5EaXN0cmlidXRpb24oXG4gICAgICB0aGlzLFxuICAgICAgJ0d5bUNvYWNoQUlEaXN0cmlidXRpb24nLFxuICAgICAge1xuICAgICAgICBkZWZhdWx0Um9vdE9iamVjdDogJ2luZGV4Lmh0bWwnLFxuICAgICAgICAvLyB3ZWJBY2xJZDogd2FmV2ViQWNsLmF0dHJBcm4sIC8vIENvbW1lbnRlZCBvdXQgLSBXQUYgcmVxdWlyZXMgdXMtZWFzdC0xIHJlZ2lvblxuICAgICAgICBkZWZhdWx0QmVoYXZpb3I6IHtcbiAgICAgICAgICBvcmlnaW46IG9yaWdpbnMuUzNCdWNrZXRPcmlnaW4ud2l0aE9yaWdpbkFjY2Vzc0lkZW50aXR5KFxuICAgICAgICAgICAgdGhpcy5mcm9udGVuZEJ1Y2tldCxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgb3JpZ2luQWNjZXNzSWRlbnRpdHk6IGZyb250ZW5kT0FJLFxuICAgICAgICAgICAgfVxuICAgICAgICAgICksXG4gICAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6XG4gICAgICAgICAgICBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0dFVF9IRUFEX09QVElPTlMsXG4gICAgICAgICAgY2FjaGVQb2xpY3k6IG5ldyBjbG91ZGZyb250LkNhY2hlUG9saWN5KHRoaXMsICdGcm9udGVuZENhY2hlUG9saWN5Jywge1xuICAgICAgICAgICAgY2FjaGVQb2xpY3lOYW1lOiAnZnJvbnRlbmQtY2FjaGUtcG9saWN5JyxcbiAgICAgICAgICAgIGRlZmF1bHRUdGw6IGNkay5EdXJhdGlvbi5ob3VycygyNCksXG4gICAgICAgICAgICBtYXhUdGw6IGNkay5EdXJhdGlvbi5kYXlzKDM2NSksXG4gICAgICAgICAgICBtaW5UdGw6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDApLFxuICAgICAgICAgICAgaGVhZGVyQmVoYXZpb3I6IGNsb3VkZnJvbnQuQ2FjaGVIZWFkZXJCZWhhdmlvci5hbGxvd0xpc3QoXG4gICAgICAgICAgICAgICdDbG91ZEZyb250LVZpZXdlci1Db3VudHJ5J1xuICAgICAgICAgICAgKSxcbiAgICAgICAgICAgIHF1ZXJ5U3RyaW5nQmVoYXZpb3I6IGNsb3VkZnJvbnQuQ2FjaGVRdWVyeVN0cmluZ0JlaGF2aW9yLmFsbCgpLFxuICAgICAgICAgICAgY29va2llQmVoYXZpb3I6IGNsb3VkZnJvbnQuQ2FjaGVDb29raWVCZWhhdmlvci5ub25lKCksXG4gICAgICAgICAgfSksXG4gICAgICAgICAgZnVuY3Rpb25Bc3NvY2lhdGlvbnM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgZnVuY3Rpb246IHVybFJld3JpdGVGdW5jdGlvbixcbiAgICAgICAgICAgICAgZXZlbnRUeXBlOiBjbG91ZGZyb250LkZ1bmN0aW9uRXZlbnRUeXBlLlZJRVdFUl9SRVFVRVNULFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgICBhZGRpdGlvbmFsQmVoYXZpb3JzOiB7XG4gICAgICAgICAgLy8gJy9hcGkvdXNlcnMvKic6IHtcbiAgICAgICAgICAvLyAgIG9yaWdpbjogbmV3IG9yaWdpbnMuSHR0cE9yaWdpbih1c2VyU2VydmljZVVybC51cmwpLFxuICAgICAgICAgIC8vICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6XG4gICAgICAgICAgLy8gICAgIGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgICAgLy8gICBhbGxvd2VkTWV0aG9kczogY2xvdWRmcm9udC5BbGxvd2VkTWV0aG9kcy5BTExPV19BTEwsXG4gICAgICAgICAgLy8gICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX0RJU0FCTEVELFxuICAgICAgICAgIC8vICAgb3JpZ2luUmVxdWVzdFBvbGljeTpcbiAgICAgICAgICAvLyAgICAgY2xvdWRmcm9udC5PcmlnaW5SZXF1ZXN0UG9saWN5LkFMTF9WSUVXRVJfRVhDRVBUX0hPU1RfSEVBREVSLFxuICAgICAgICAgIC8vIH0sXG4gICAgICAgICAgJy9hcGkvdXNlci1wcm9maWxlcy8qJzoge1xuICAgICAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5IdHRwT3JpZ2luKHVzZXJQcm9maWxlRG9tYWluKSxcbiAgICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OlxuICAgICAgICAgICAgICBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfQUxMLFxuICAgICAgICAgICAgY2FjaGVQb2xpY3k6IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3kuQ0FDSElOR19ESVNBQkxFRCxcbiAgICAgICAgICAgIG9yaWdpblJlcXVlc3RQb2xpY3k6XG4gICAgICAgICAgICAgIGNsb3VkZnJvbnQuT3JpZ2luUmVxdWVzdFBvbGljeS5BTExfVklFV0VSX0VYQ0VQVF9IT1NUX0hFQURFUixcbiAgICAgICAgICB9LFxuICAgICAgICAgICcvYXBpL3dvcmtvdXRzLyonOiB7XG4gICAgICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLkh0dHBPcmlnaW4od29ya291dERvbWFpbiksXG4gICAgICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTpcbiAgICAgICAgICAgICAgY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0FMTCxcbiAgICAgICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfRElTQUJMRUQsXG4gICAgICAgICAgICBvcmlnaW5SZXF1ZXN0UG9saWN5OlxuICAgICAgICAgICAgICBjbG91ZGZyb250Lk9yaWdpblJlcXVlc3RQb2xpY3kuQUxMX1ZJRVdFUl9FWENFUFRfSE9TVF9IRUFERVIsXG4gICAgICAgICAgfSxcbiAgICAgICAgICAnL2FwaS9jb2FjaGluZy8qJzoge1xuICAgICAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5IdHRwT3JpZ2luKGNvYWNoaW5nRG9tYWluKSxcbiAgICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OlxuICAgICAgICAgICAgICBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfQUxMLFxuICAgICAgICAgICAgY2FjaGVQb2xpY3k6IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3kuQ0FDSElOR19ESVNBQkxFRCxcbiAgICAgICAgICAgIG9yaWdpblJlcXVlc3RQb2xpY3k6XG4gICAgICAgICAgICAgIGNsb3VkZnJvbnQuT3JpZ2luUmVxdWVzdFBvbGljeS5BTExfVklFV0VSX0VYQ0VQVF9IT1NUX0hFQURFUixcbiAgICAgICAgICB9LFxuICAgICAgICAgICcvYXBpL2FuYWx5dGljcy8qJzoge1xuICAgICAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5IdHRwT3JpZ2luKGFuYWx5dGljc0RvbWFpbiksXG4gICAgICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTpcbiAgICAgICAgICAgICAgY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0FMTCxcbiAgICAgICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfRElTQUJMRUQsXG4gICAgICAgICAgICBvcmlnaW5SZXF1ZXN0UG9saWN5OlxuICAgICAgICAgICAgICBjbG91ZGZyb250Lk9yaWdpblJlcXVlc3RQb2xpY3kuQUxMX1ZJRVdFUl9FWENFUFRfSE9TVF9IRUFERVIsXG4gICAgICAgICAgfSxcbiAgICAgICAgICAnL2FwaS9udXRyaXRpb24vKic6IHtcbiAgICAgICAgICAgIG9yaWdpbjogbmV3IG9yaWdpbnMuSHR0cE9yaWdpbihudXRyaXRpb25Eb21haW4pLFxuICAgICAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6XG4gICAgICAgICAgICAgIGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgICAgICBhbGxvd2VkTWV0aG9kczogY2xvdWRmcm9udC5BbGxvd2VkTWV0aG9kcy5BTExPV19BTEwsXG4gICAgICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX0RJU0FCTEVELFxuICAgICAgICAgICAgb3JpZ2luUmVxdWVzdFBvbGljeTpcbiAgICAgICAgICAgICAgY2xvdWRmcm9udC5PcmlnaW5SZXF1ZXN0UG9saWN5LkFMTF9WSUVXRVJfRVhDRVBUX0hPU1RfSEVBREVSLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgJy9hcGkvYWkvKic6IHtcbiAgICAgICAgICAgIG9yaWdpbjogbmV3IG9yaWdpbnMuSHR0cE9yaWdpbihhaURvbWFpbiwge1xuICAgICAgICAgICAgICBjb25uZWN0aW9uVGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTApLFxuICAgICAgICAgICAgICBjb25uZWN0aW9uQXR0ZW1wdHM6IDMsXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OlxuICAgICAgICAgICAgICBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfQUxMLFxuICAgICAgICAgICAgY2FjaGVQb2xpY3k6IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3kuQ0FDSElOR19ESVNBQkxFRCxcbiAgICAgICAgICAgIG9yaWdpblJlcXVlc3RQb2xpY3k6XG4gICAgICAgICAgICAgIGNsb3VkZnJvbnQuT3JpZ2luUmVxdWVzdFBvbGljeS5BTExfVklFV0VSX0VYQ0VQVF9IT1NUX0hFQURFUixcbiAgICAgICAgICB9LFxuICAgICAgICAgICcvYXBpL25vdGlmaWNhdGlvbnMvKic6IHtcbiAgICAgICAgICAgIG9yaWdpbjogbmV3IG9yaWdpbnMuSHR0cE9yaWdpbihub3RpZmljYXRpb25Eb21haW4pLFxuICAgICAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6XG4gICAgICAgICAgICAgIGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgICAgICBhbGxvd2VkTWV0aG9kczogY2xvdWRmcm9udC5BbGxvd2VkTWV0aG9kcy5BTExPV19BTEwsXG4gICAgICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX0RJU0FCTEVELFxuICAgICAgICAgICAgb3JpZ2luUmVxdWVzdFBvbGljeTpcbiAgICAgICAgICAgICAgY2xvdWRmcm9udC5PcmlnaW5SZXF1ZXN0UG9saWN5LkFMTF9WSUVXRVJfRVhDRVBUX0hPU1RfSEVBREVSLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgJy9wcm9ncmVzcy1waG90b3MvKic6IHtcbiAgICAgICAgICAgIG9yaWdpbjogb3JpZ2lucy5TM0J1Y2tldE9yaWdpbi53aXRoT3JpZ2luQWNjZXNzSWRlbnRpdHkoXG4gICAgICAgICAgICAgIHRoaXMucHJvZ3Jlc3NQaG90b3NCdWNrZXQsXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBvcmlnaW5BY2Nlc3NJZGVudGl0eTogcHJvZ3Jlc3NQaG90b3NPQUksXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICksXG4gICAgICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTpcbiAgICAgICAgICAgICAgY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0dFVF9IRUFELFxuICAgICAgICAgICAgY2FjaGVQb2xpY3k6IG5ldyBjbG91ZGZyb250LkNhY2hlUG9saWN5KFxuICAgICAgICAgICAgICB0aGlzLFxuICAgICAgICAgICAgICAnUHJvZ3Jlc3NQaG90b3NDYWNoZVBvbGljeScsXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjYWNoZVBvbGljeU5hbWU6ICdwcm9ncmVzcy1waG90b3MtY2FjaGUtcG9saWN5JyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0VHRsOiBjZGsuRHVyYXRpb24uaG91cnMoMjQpLFxuICAgICAgICAgICAgICAgIG1heFR0bDogY2RrLkR1cmF0aW9uLmRheXMoMzY1KSxcbiAgICAgICAgICAgICAgICBtaW5UdGw6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDApLFxuICAgICAgICAgICAgICAgIGhlYWRlckJlaGF2aW9yOiBjbG91ZGZyb250LkNhY2hlSGVhZGVyQmVoYXZpb3IuYWxsb3dMaXN0KFxuICAgICAgICAgICAgICAgICAgJ0Nsb3VkRnJvbnQtVmlld2VyLUNvdW50cnknXG4gICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICBxdWVyeVN0cmluZ0JlaGF2aW9yOiBjbG91ZGZyb250LkNhY2hlUXVlcnlTdHJpbmdCZWhhdmlvci5ub25lKCksXG4gICAgICAgICAgICAgICAgY29va2llQmVoYXZpb3I6IGNsb3VkZnJvbnQuQ2FjaGVDb29raWVCZWhhdmlvci5ub25lKCksXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICksXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgY29tbWVudDogJ0d5bUNvYWNoIEFJIENsb3VkRnJvbnQgRGlzdHJpYnV0aW9uJyxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gQWRkIENsb3VkRnJvbnQgZG9tYWluIHRvIGFuYWx5dGljcyBzZXJ2aWNlIGVudmlyb25tZW50XG4gICAgLy8gVGhpcyBtdXN0IGJlIGRvbmUgdmlhIENESyBvdXRwdXQgYW5kIG1hbnVhbCB1cGRhdGUgdG8gYXZvaWQgY2lyY3VsYXIgZGVwZW5kZW5jeVxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDbG91ZEZyb250RG9tYWluRm9yQW5hbHl0aWNzJywge1xuICAgICAgdmFsdWU6IHRoaXMuZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjpcbiAgICAgICAgJ0Nsb3VkRnJvbnQgZG9tYWluIC0gdXNlIHRoaXMgdG8gdXBkYXRlIEFuYWx5dGljc1NlcnZpY2UgTGFtYmRhIENMT1VERlJPTlRfRE9NQUlOIGVudiB2YXInLFxuICAgICAgZXhwb3J0TmFtZTogJ0d5bUNvYWNoQUktQ2xvdWRGcm9udERvbWFpbicsXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBwZXJtaXNzaW9ucyB0byBMYW1iZGEgZnVuY3Rpb25zIGZvciBTMyBhY2Nlc3NcbiAgICB0aGlzLnVzZXJVcGxvYWRzQnVja2V0LmdyYW50UmVhZFdyaXRlKHVzZXJQcm9maWxlU2VydmljZUxhbWJkYSk7XG4gICAgdGhpcy51c2VyVXBsb2Fkc0J1Y2tldC5ncmFudFJlYWRXcml0ZSh3b3Jrb3V0U2VydmljZUxhbWJkYSk7XG4gICAgdGhpcy51c2VyVXBsb2Fkc0J1Y2tldC5ncmFudFJlYWRXcml0ZShhbmFseXRpY3NTZXJ2aWNlTGFtYmRhKTtcblxuICAgIHRoaXMucHJvY2Vzc2VkSW1hZ2VzQnVja2V0LmdyYW50UmVhZFdyaXRlKHVzZXJQcm9maWxlU2VydmljZUxhbWJkYSk7XG4gICAgdGhpcy5wcm9jZXNzZWRJbWFnZXNCdWNrZXQuZ3JhbnRSZWFkV3JpdGUod29ya291dFNlcnZpY2VMYW1iZGEpO1xuICAgIHRoaXMucHJvY2Vzc2VkSW1hZ2VzQnVja2V0LmdyYW50UmVhZFdyaXRlKGFuYWx5dGljc1NlcnZpY2VMYW1iZGEpO1xuXG4gICAgLy8gR3JhbnQgYW5hbHl0aWNzIHNlcnZpY2UgZnVsbCBhY2Nlc3MgdG8gcHJvZ3Jlc3MgcGhvdG9zIGJ1Y2tldFxuICAgIHRoaXMucHJvZ3Jlc3NQaG90b3NCdWNrZXQuZ3JhbnRSZWFkV3JpdGUoYW5hbHl0aWNzU2VydmljZUxhbWJkYSk7XG5cbiAgICAvLyBHcmFudCBBSSBzZXJ2aWNlIGFjY2VzcyB0byB2ZWN0b3JzIGJ1Y2tldFxuICAgIHRoaXMudmVjdG9yc0J1Y2tldC5ncmFudFJlYWRXcml0ZShhaVNlcnZpY2VMYW1iZGEpO1xuXG4gICAgLy8gQWxsb3cgc2VydmljZSB0byByZWFkIGZyb20gdGhlIG1haW4gRHluYW1vREIgdGFibGVcbiAgICB0aGlzLm1haW5UYWJsZS5ncmFudFJlYWREYXRhKGFuYWx5dGljc1NlcnZpY2VMYW1iZGEpO1xuICAgIHRoaXMubWFpblRhYmxlLmdyYW50UmVhZERhdGEobnV0cml0aW9uU2VydmljZUxhbWJkYSk7XG4gICAgdGhpcy5tYWluVGFibGUuZ3JhbnRSZWFkRGF0YSh1c2VyUHJvZmlsZVNlcnZpY2VMYW1iZGEpO1xuICAgIHRoaXMubWFpblRhYmxlLmdyYW50UmVhZERhdGEod29ya291dFNlcnZpY2VMYW1iZGEpO1xuICAgIHRoaXMubWFpblRhYmxlLmdyYW50UmVhZERhdGEoY29hY2hpbmdTZXJ2aWNlTGFtYmRhKTtcbiAgICB0aGlzLm1haW5UYWJsZS5ncmFudFJlYWREYXRhKGFpU2VydmljZUxhbWJkYSk7XG4gICAgdGhpcy5tYWluVGFibGUuZ3JhbnRXcml0ZURhdGEoYW5hbHl0aWNzU2VydmljZUxhbWJkYSk7XG4gICAgdGhpcy5tYWluVGFibGUuZ3JhbnRXcml0ZURhdGEobnV0cml0aW9uU2VydmljZUxhbWJkYSk7XG4gICAgdGhpcy5tYWluVGFibGUuZ3JhbnRXcml0ZURhdGEodXNlclByb2ZpbGVTZXJ2aWNlTGFtYmRhKTtcbiAgICB0aGlzLm1haW5UYWJsZS5ncmFudFdyaXRlRGF0YSh3b3Jrb3V0U2VydmljZUxhbWJkYSk7XG4gICAgdGhpcy5tYWluVGFibGUuZ3JhbnRXcml0ZURhdGEoY29hY2hpbmdTZXJ2aWNlTGFtYmRhKTtcbiAgICB0aGlzLm1haW5UYWJsZS5ncmFudFdyaXRlRGF0YShhaVNlcnZpY2VMYW1iZGEpO1xuXG4gICAgLy8gRW5zdXJlIG51dHJpdGlvbiBzZXJ2aWNlIGNhbiBRdWVyeSBHU0lzIGV4cGxpY2l0bHlcbiAgICBudXRyaXRpb25TZXJ2aWNlTGFtYmRhLmFkZFRvUm9sZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbJ2R5bmFtb2RiOlF1ZXJ5JywgJ2R5bmFtb2RiOkdldEl0ZW0nXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgdGhpcy5tYWluVGFibGUudGFibGVBcm4sXG4gICAgICAgICAgYCR7dGhpcy5tYWluVGFibGUudGFibGVBcm59L2luZGV4LypgLFxuICAgICAgICBdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gR3JhbnQgQUkgc2VydmljZSBCZWRyb2NrIHBlcm1pc3Npb25zXG4gICAgYWlTZXJ2aWNlTGFtYmRhLmFkZFRvUm9sZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgJ2JlZHJvY2s6SW52b2tlTW9kZWwnLFxuICAgICAgICAgICdiZWRyb2NrOkludm9rZU1vZGVsV2l0aFJlc3BvbnNlU3RyZWFtJyxcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgJ2Fybjphd3M6YmVkcm9jazoqOjpmb3VuZGF0aW9uLW1vZGVsL2RlZXBzZWVrLnYzLXYxOjAnLFxuICAgICAgICAgICdhcm46YXdzOmJlZHJvY2s6Kjo6Zm91bmRhdGlvbi1tb2RlbC9hbWF6b24udGl0YW4tZW1iZWQtdGV4dC12MScsXG4gICAgICAgICAgJ2Fybjphd3M6YmVkcm9jazoqOjpmb3VuZGF0aW9uLW1vZGVsL2FtYXpvbi50aXRhbi1lbWJlZC10ZXh0LXYyOjAnLFxuICAgICAgICAgICdhcm46YXdzOmJlZHJvY2s6Kjo6Zm91bmRhdGlvbi1tb2RlbC9jb2hlcmUuZW1iZWQtZW5nbGlzaC12MycsXG4gICAgICAgIF0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBHcmFudCBBSSBzZXJ2aWNlIENvZ25pdG8gcGVybWlzc2lvbnNcbiAgICBhaVNlcnZpY2VMYW1iZGEuYWRkVG9Sb2xlUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAnY29nbml0by1pZHA6QWRtaW5MaXN0R3JvdXBzRm9yVXNlcicsXG4gICAgICAgICAgJ2NvZ25pdG8taWRwOkFkbWluR2V0VXNlcicsXG4gICAgICAgICAgJ2NvZ25pdG8taWRwOkxpc3RVc2VycycsXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogW3RoaXMudXNlclBvb2wudXNlclBvb2xBcm5dLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gR3JhbnQgbm90aWZpY2F0aW9uIHNlcnZpY2UgcGVybWlzc2lvbnNcbiAgICBub3RpZmljYXRpb25TZXJ2aWNlTGFtYmRhLmFkZFRvUm9sZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgJ3NuczpQdWJsaXNoJyxcbiAgICAgICAgICAnc25zOkNyZWF0ZVBsYXRmb3JtRW5kcG9pbnQnLFxuICAgICAgICAgICdzbnM6RGVsZXRlRW5kcG9pbnQnLFxuICAgICAgICAgICdzbnM6R2V0RW5kcG9pbnRBdHRyaWJ1dGVzJyxcbiAgICAgICAgICAnc25zOlNldEVuZHBvaW50QXR0cmlidXRlcycsXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgIHdvcmtvdXRSZW1pbmRlcnNUb3BpYy50b3BpY0FybixcbiAgICAgICAgICBudXRyaXRpb25SZW1pbmRlcnNUb3BpYy50b3BpY0FybixcbiAgICAgICAgICBhY2hpZXZlbWVudFRvcGljLnRvcGljQXJuLFxuICAgICAgICAgIGFpU3VnZ2VzdGlvbnNUb3BpYy50b3BpY0FybixcbiAgICAgICAgICAnKicsIC8vIEFsbG93IGFjY2VzcyB0byBhbGwgU05TIHBsYXRmb3JtIGFwcGxpY2F0aW9uc1xuICAgICAgICBdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gR3JhbnQgbm90aWZpY2F0aW9uIHNjaGVkdWxlciBwZXJtaXNzaW9uc1xuICAgIG5vdGlmaWNhdGlvblNjaGVkdWxlckxhbWJkYS5hZGRUb1JvbGVQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogWydsYW1iZGE6SW52b2tlRnVuY3Rpb24nXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbbm90aWZpY2F0aW9uU2VydmljZUxhbWJkYS5mdW5jdGlvbkFybl0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBBZGQgRXZlbnRCcmlkZ2UgdGFyZ2V0c1xuICAgIHdvcmtvdXRSZW1pbmRlclJ1bGUuYWRkVGFyZ2V0KFxuICAgICAgbmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24obm90aWZpY2F0aW9uU2NoZWR1bGVyTGFtYmRhKVxuICAgICk7XG4gICAgbnV0cml0aW9uUmVtaW5kZXJSdWxlLmFkZFRhcmdldChcbiAgICAgIG5ldyB0YXJnZXRzLkxhbWJkYUZ1bmN0aW9uKG5vdGlmaWNhdGlvblNjaGVkdWxlckxhbWJkYSlcbiAgICApO1xuICAgIHdhdGVyUmVtaW5kZXJSdWxlLmFkZFRhcmdldChcbiAgICAgIG5ldyB0YXJnZXRzLkxhbWJkYUZ1bmN0aW9uKG5vdGlmaWNhdGlvblNjaGVkdWxlckxhbWJkYSlcbiAgICApO1xuICAgIHByb2dyZXNzUGhvdG9SdWxlLmFkZFRhcmdldChcbiAgICAgIG5ldyB0YXJnZXRzLkxhbWJkYUZ1bmN0aW9uKG5vdGlmaWNhdGlvblNjaGVkdWxlckxhbWJkYSlcbiAgICApO1xuXG4gICAgLy8gUHJvYWN0aXZlIENvYWNoaW5nIEV2ZW50QnJpZGdlIHRhcmdldHNcbiAgICBwcm9hY3RpdmVDaGVja0luUnVsZS5hZGRUYXJnZXQoXG4gICAgICBuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbihhaVNlcnZpY2VMYW1iZGEsIHtcbiAgICAgICAgZXZlbnQ6IGV2ZW50cy5SdWxlVGFyZ2V0SW5wdXQuZnJvbU9iamVjdCh7XG4gICAgICAgICAgc291cmNlOiAncHJvYWN0aXZlLWNoZWNraW4nLFxuICAgICAgICAgIGFjdGlvbjogJ2NoZWNraW4nLFxuICAgICAgICAgIHRpbWVzdGFtcDogZXZlbnRzLkV2ZW50RmllbGQuZnJvbVBhdGgoJyQudGltZScpLFxuICAgICAgICB9KSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIHByb2dyZXNzTW9uaXRvclJ1bGUuYWRkVGFyZ2V0KFxuICAgICAgbmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24oYWlTZXJ2aWNlTGFtYmRhLCB7XG4gICAgICAgIGV2ZW50OiBldmVudHMuUnVsZVRhcmdldElucHV0LmZyb21PYmplY3Qoe1xuICAgICAgICAgIHNvdXJjZTogJ3Byb2dyZXNzLW1vbml0b3InLFxuICAgICAgICAgIGFjdGlvbjogJ21vbml0b3InLFxuICAgICAgICAgIHRpbWVzdGFtcDogZXZlbnRzLkV2ZW50RmllbGQuZnJvbVBhdGgoJyQudGltZScpLFxuICAgICAgICB9KSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIHBsYXRlYXVEZXRlY3Rpb25SdWxlLmFkZFRhcmdldChcbiAgICAgIG5ldyB0YXJnZXRzLkxhbWJkYUZ1bmN0aW9uKGFpU2VydmljZUxhbWJkYSwge1xuICAgICAgICBldmVudDogZXZlbnRzLlJ1bGVUYXJnZXRJbnB1dC5mcm9tT2JqZWN0KHtcbiAgICAgICAgICBzb3VyY2U6ICdwbGF0ZWF1LWRldGVjdGlvbicsXG4gICAgICAgICAgYWN0aW9uOiAnZGV0ZWN0LXBsYXRlYXVzJyxcbiAgICAgICAgICB0aW1lc3RhbXA6IGV2ZW50cy5FdmVudEZpZWxkLmZyb21QYXRoKCckLnRpbWUnKSxcbiAgICAgICAgfSksXG4gICAgICB9KVxuICAgICk7XG5cbiAgICBtb3RpdmF0aW9uQm9vc3RSdWxlLmFkZFRhcmdldChcbiAgICAgIG5ldyB0YXJnZXRzLkxhbWJkYUZ1bmN0aW9uKGFpU2VydmljZUxhbWJkYSwge1xuICAgICAgICBldmVudDogZXZlbnRzLlJ1bGVUYXJnZXRJbnB1dC5mcm9tT2JqZWN0KHtcbiAgICAgICAgICBzb3VyY2U6ICdtb3RpdmF0aW9uLWJvb3N0JyxcbiAgICAgICAgICBhY3Rpb246ICdtb3RpdmF0ZScsXG4gICAgICAgICAgdGltZXN0YW1wOiBldmVudHMuRXZlbnRGaWVsZC5mcm9tUGF0aCgnJC50aW1lJyksXG4gICAgICAgIH0pLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgd2Vla2x5UmV2aWV3UnVsZS5hZGRUYXJnZXQoXG4gICAgICBuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbihhaVNlcnZpY2VMYW1iZGEsIHtcbiAgICAgICAgZXZlbnQ6IGV2ZW50cy5SdWxlVGFyZ2V0SW5wdXQuZnJvbU9iamVjdCh7XG4gICAgICAgICAgc291cmNlOiAnd2Vla2x5LXJldmlldycsXG4gICAgICAgICAgYWN0aW9uOiAncmV2aWV3JyxcbiAgICAgICAgICB0aW1lc3RhbXA6IGV2ZW50cy5FdmVudEZpZWxkLmZyb21QYXRoKCckLnRpbWUnKSxcbiAgICAgICAgfSksXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBSZW1vdmVkIENsb3VkV2F0Y2ggTG9nIEdyb3VwcyB0byBhdm9pZCBjb3N0c1xuICAgIC8vIExhbWJkYSBmdW5jdGlvbnMgd2lsbCB1c2UgZGVmYXVsdCBsb2cgZ3JvdXBzIChmcmVlIHRpZXI6IDVHQi9tb250aClcblxuICAgIC8vIE91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclBvb2xJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvZ25pdG8gVXNlciBQb29sIElEJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVc2VyUG9vbENsaWVudElkJywge1xuICAgICAgdmFsdWU6IHRoaXMudXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ29nbml0byBVc2VyIFBvb2wgQ2xpZW50IElEJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVc2VyUG9vbERvbWFpbicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnVzZXJQb29sRG9tYWluLmRvbWFpbk5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvZ25pdG8gVXNlciBQb29sIERvbWFpbicsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ2xvdWRGcm9udFVybCcsIHtcbiAgICAgIHZhbHVlOiBgaHR0cHM6Ly8ke3RoaXMuZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWV9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ2xvdWRGcm9udCBEaXN0cmlidXRpb24gVVJMJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdUYWJsZU5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5tYWluVGFibGUudGFibGVOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdEeW5hbW9EQiBUYWJsZSBOYW1lJyxcbiAgICB9KTtcblxuICAgIC8vIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVc2VyU2VydmljZVVybCcsIHtcbiAgICAvLyAgIHZhbHVlOiB1c2VyU2VydmljZVVybC51cmwsXG4gICAgLy8gICBkZXNjcmlwdGlvbjogJ1VzZXIgU2VydmljZSBMYW1iZGEgRnVuY3Rpb24gVVJMJyxcbiAgICAvLyB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVc2VyUHJvZmlsZVNlcnZpY2VVcmwnLCB7XG4gICAgICB2YWx1ZTogdXNlclByb2ZpbGVTZXJ2aWNlVXJsLnVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVXNlciBQcm9maWxlIFNlcnZpY2UgTGFtYmRhIEZ1bmN0aW9uIFVSTCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnV29ya291dFNlcnZpY2VVcmwnLCB7XG4gICAgICB2YWx1ZTogd29ya291dFNlcnZpY2VVcmwudXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdXb3Jrb3V0IFNlcnZpY2UgTGFtYmRhIEZ1bmN0aW9uIFVSTCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ29hY2hpbmdTZXJ2aWNlVXJsJywge1xuICAgICAgdmFsdWU6IGNvYWNoaW5nU2VydmljZVVybC51cmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvYWNoaW5nIFNlcnZpY2UgTGFtYmRhIEZ1bmN0aW9uIFVSTCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQW5hbHl0aWNzU2VydmljZVVybCcsIHtcbiAgICAgIHZhbHVlOiBhbmFseXRpY3NTZXJ2aWNlVXJsLnVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQW5hbHl0aWNzIFNlcnZpY2UgTGFtYmRhIEZ1bmN0aW9uIFVSTCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnTnV0cml0aW9uU2VydmljZVVybCcsIHtcbiAgICAgIHZhbHVlOiBudXRyaXRpb25TZXJ2aWNlVXJsLnVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnTnV0cml0aW9uIFNlcnZpY2UgTGFtYmRhIEZ1bmN0aW9uIFVSTCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQUlTZXJ2aWNlVXJsJywge1xuICAgICAgdmFsdWU6IGFpU2VydmljZVVybC51cmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FJIFNlcnZpY2UgTGFtYmRhIEZ1bmN0aW9uIFVSTCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnTm90aWZpY2F0aW9uU2VydmljZVVybCcsIHtcbiAgICAgIHZhbHVlOiBub3RpZmljYXRpb25TZXJ2aWNlVXJsLnVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnTm90aWZpY2F0aW9uIFNlcnZpY2UgTGFtYmRhIEZ1bmN0aW9uIFVSTCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclVwbG9hZHNCdWNrZXROYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMudXNlclVwbG9hZHNCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVXNlciBVcGxvYWRzIFMzIEJ1Y2tldCBOYW1lJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTdGF0aWNBc3NldHNCdWNrZXROYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMuc3RhdGljQXNzZXRzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1N0YXRpYyBBc3NldHMgUzMgQnVja2V0IE5hbWUnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1Byb2Nlc3NlZEltYWdlc0J1Y2tldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5wcm9jZXNzZWRJbWFnZXNCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUHJvY2Vzc2VkIEltYWdlcyBTMyBCdWNrZXQgTmFtZScsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRnJvbnRlbmRCdWNrZXROYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMuZnJvbnRlbmRCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRnJvbnRlbmQgUzMgQnVja2V0IE5hbWUnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1ZlY3RvcnNCdWNrZXROYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMudmVjdG9yc0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdTMyBWZWN0b3JzIEJ1Y2tldCBOYW1lIGZvciBBSSBLbm93bGVkZ2UgQmFzZScsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ2xvdWRGcm9udERpc3RyaWJ1dGlvblVSTCcsIHtcbiAgICAgIHZhbHVlOiBgaHR0cHM6Ly8ke3RoaXMuZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWV9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ2xvdWRGcm9udCBEaXN0cmlidXRpb24gVVJMJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdQb3N0RGVwbG95bWVudEluc3RydWN0aW9ucycsIHtcbiAgICAgIHZhbHVlOlxuICAgICAgICAnQWZ0ZXIgZGVwbG95bWVudCwgc2V0IENMT1VERlJPTlRfRE9NQUlOIGVudmlyb25tZW50IHZhcmlhYmxlIGluIEFuYWx5dGljc1NlcnZpY2UgTGFtYmRhIGZ1bmN0aW9uJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnTWFudWFsIHN0ZXAgcmVxdWlyZWQgYWZ0ZXIgZGVwbG95bWVudCcsXG4gICAgfSk7XG5cbiAgICAvLyBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnV0FGV2ViQUNMQXJuJywge1xuICAgIC8vICAgdmFsdWU6IHdhZldlYkFjbC5hdHRyQXJuLFxuICAgIC8vICAgZGVzY3JpcHRpb246ICdXQUYgV2ViIEFDTCBBUk4gZm9yIENsb3VkRnJvbnQgcHJvdGVjdGlvbicsXG4gICAgLy8gfSk7XG5cbiAgICAvLyBSZW1vdmVkIG1vbml0b3Jpbmcgc3RhY2sgdG8gYXZvaWQgQ2xvdWRXYXRjaCBjb3N0c1xuICAgIC8vIHRoaXMuY3JlYXRlTW9uaXRvcmluZ1N0YWNrKCk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUxhbWJkYUZ1bmN0aW9uKFxuICAgIG5hbWU6IHN0cmluZyxcbiAgICBzZXJ2aWNlTmFtZTogc3RyaW5nLFxuICAgIGFkZGl0aW9uYWxFbnZWYXJzPzogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfVxuICApOiBsYW1iZGEuRnVuY3Rpb24ge1xuICAgIGNvbnN0IGJhc2VFbnZWYXJzID0ge1xuICAgICAgVEFCTEVfTkFNRTogdGhpcy5tYWluVGFibGUudGFibGVOYW1lLFxuICAgICAgRFlOQU1PREJfVEFCTEU6IHRoaXMubWFpblRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIFVTRVJfUE9PTF9JRDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgVVNFUl9QT09MX0NMSUVOVF9JRDogdGhpcy51c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkLFxuICAgICAgVVNFUl9VUExPQURTX0JVQ0tFVDogdGhpcy51c2VyVXBsb2Fkc0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgU1RBVElDX0FTU0VUU19CVUNLRVQ6IHRoaXMuc3RhdGljQXNzZXRzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBQUk9DRVNTRURfSU1BR0VTX0JVQ0tFVDogdGhpcy5wcm9jZXNzZWRJbWFnZXNCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIFBST0dSRVNTX1BIT1RPU19CVUNLRVQ6IHRoaXMucHJvZ3Jlc3NQaG90b3NCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIEpXVF9TRUNSRVQ6ICd5b3VyLWp3dC1zZWNyZXQtaGVyZScsIC8vIEluIHByb2R1Y3Rpb24sIHVzZSBBV1MgU2VjcmV0cyBNYW5hZ2VyXG4gICAgICBDT0dOSVRPX1JFR0lPTjogdGhpcy5yZWdpb24sXG4gICAgICBDT0dOSVRPX1VTRVJfUE9PTF9JRDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgUlVTVF9MT0c6ICdpbmZvJyxcbiAgICAgIFJVU1RfQkFDS1RSQUNFOiAnMScsXG4gICAgfTtcblxuICAgIGNvbnN0IGVudlZhcnMgPSBhZGRpdGlvbmFsRW52VmFyc1xuICAgICAgPyB7IC4uLmJhc2VFbnZWYXJzLCAuLi5hZGRpdGlvbmFsRW52VmFycyB9XG4gICAgICA6IGJhc2VFbnZWYXJzO1xuXG4gICAgcmV0dXJuIG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgYCR7bmFtZX1MYW1iZGFgLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QUk9WSURFRF9BTDIsXG4gICAgICBoYW5kbGVyOiAnYm9vdHN0cmFwJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChgLi4vdGFyZ2V0L2xhbWJkYS8ke3NlcnZpY2VOYW1lfWApLFxuICAgICAgZW52aXJvbm1lbnQ6IGVudlZhcnMsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsIC8vIE9wdGltaXplZCBmb3IgY29sZCBzdGFydHNcbiAgICAgIHJlc2VydmVkQ29uY3VycmVudEV4ZWN1dGlvbnM6IDIwLCAvLyBJbmNyZWFzZWQgZm9yIGRldmVsb3BtZW50L3Rlc3RpbmdcbiAgICAgIC8vIFJlbW92ZWQgbG9nIHJldGVudGlvbiB0byB1c2UgZnJlZSB0aWVyIGRlZmF1bHRzICg1R0IvbW9udGggZnJlZSlcbiAgICAgIC8vIFJlbW92ZWQgWC1SYXkgdHJhY2luZyB0byBhdm9pZCBjb3N0cyAoJDUgcGVyIDFNIHRyYWNlcylcbiAgICAgIGxheWVyczogW3RoaXMuY3JlYXRlQXV0aExheWVyKCldLFxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVQeXRob25MYW1iZGFGdW5jdGlvbihcbiAgICBuYW1lOiBzdHJpbmcsXG4gICAgc2VydmljZU5hbWU6IHN0cmluZ1xuICApOiBsYW1iZGEuRnVuY3Rpb24ge1xuICAgIHJldHVybiBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsIGAke25hbWV9TGFtYmRhYCwge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTEsXG4gICAgICBoYW5kbGVyOiAnbGFtYmRhX2Z1bmN0aW9uLmxhbWJkYV9oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChgLi4vc2VydmljZXMvJHtzZXJ2aWNlTmFtZX1gKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIERZTkFNT0RCX1RBQkxFOiB0aGlzLm1haW5UYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIFVTRVJfUE9PTF9JRDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgICBVU0VSX1BPT0xfQ0xJRU5UX0lEOiB0aGlzLnVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXG4gICAgICAgIFVTRVJfVVBMT0FEU19CVUNLRVQ6IHRoaXMudXNlclVwbG9hZHNCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgU1RBVElDX0FTU0VUU19CVUNLRVQ6IHRoaXMuc3RhdGljQXNzZXRzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgIFBST0NFU1NFRF9JTUFHRVNfQlVDS0VUOiB0aGlzLnByb2Nlc3NlZEltYWdlc0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBQUk9HUkVTU19QSE9UT1NfQlVDS0VUOiB0aGlzLnByb2dyZXNzUGhvdG9zQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgIFZFQ1RPUlNfQlVDS0VUOiB0aGlzLnZlY3RvcnNCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgSldUX1NFQ1JFVDogJ3lvdXItand0LXNlY3JldC1oZXJlJywgLy8gSW4gcHJvZHVjdGlvbiwgdXNlIEFXUyBTZWNyZXRzIE1hbmFnZXJcbiAgICAgICAgQ09HTklUT19SRUdJT046IHRoaXMucmVnaW9uLFxuICAgICAgICBDT0dOSVRPX1VTRVJfUE9PTF9JRDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgICBQWVRIT05QQVRIOiAnL3Zhci9ydW50aW1lOi92YXIvdGFzaycsXG4gICAgICAgIC8vIEFJIFNlcnZpY2Ugc3BlY2lmaWMgZW52aXJvbm1lbnQgdmFyaWFibGVzXG4gICAgICAgIEJFRFJPQ0tfTU9ERUxfSUQ6ICdkZWVwc2Vlay52My12MTowJywgLy8gRGVlcFNlZWsgbW9kZWwgYXZhaWxhYmxlIGluIGV1LW5vcnRoLTFcbiAgICAgICAgUkFURV9MSU1JVF9GUkVFX1RJRVI6ICcxMCcsIC8vIFJlcXVlc3RzIHBlciBkYXkgZm9yIGZyZWUgdGllclxuICAgICAgICBSQVRFX0xJTUlUX1BSRU1JVU1fVElFUjogJzUwJywgLy8gUmVxdWVzdHMgcGVyIGRheSBmb3IgcHJlbWl1bSB0aWVyXG4gICAgICAgIFJBVEVfTElNSVRfSEFSRF9MSU1JVDogJzEwMCcsIC8vIEhhcmQgbGltaXQgdG8gcHJldmVudCBhYnVzZVxuICAgICAgICBDT05WRVJTQVRJT05fVFRMX0RBWVM6ICczMCcsIC8vIFRUTCBmb3IgY29udmVyc2F0aW9uIGhpc3RvcnlcbiAgICAgICAgUkFURV9MSU1JVF9UVExfREFZUzogJzcnLCAvLyBUVEwgZm9yIHJhdGUgbGltaXQgcmVjb3Jkc1xuICAgICAgfSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLCAvLyBBSSBmdW5jdGlvbnMgbWF5IG5lZWQgbW9yZSB0aW1lXG4gICAgICBtZW1vcnlTaXplOiAxMDI0LCAvLyBBSSBmdW5jdGlvbnMgbmVlZCBtb3JlIG1lbW9yeVxuICAgICAgcmVzZXJ2ZWRDb25jdXJyZW50RXhlY3V0aW9uczogMjAsIC8vIEluY3JlYXNlZCBmb3IgZGV2ZWxvcG1lbnQvdGVzdGluZ1xuICAgICAgLy8gUmVtb3ZlZCBsb2cgcmV0ZW50aW9uIHRvIHVzZSBmcmVlIHRpZXIgZGVmYXVsdHMgKDVHQi9tb250aCBmcmVlKVxuICAgICAgLy8gUmVtb3ZlZCBYLVJheSB0cmFjaW5nIHRvIGF2b2lkIGNvc3RzICgkNSBwZXIgMU0gdHJhY2VzKVxuICAgICAgLy8gbGF5ZXJzOiBbdGhpcy5jcmVhdGVQeXRob25BdXRoTGF5ZXIoKV0sIC8vIFRlbXBvcmFyaWx5IGRpc2FibGVkXG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUF1dGhMYXllcigpOiBsYW1iZGEuTGF5ZXJWZXJzaW9uIHtcbiAgICBpZiAodGhpcy5hdXRoTGF5ZXIpIHtcbiAgICAgIHJldHVybiB0aGlzLmF1dGhMYXllcjtcbiAgICB9XG4gICAgdGhpcy5hdXRoTGF5ZXIgPSBuZXcgbGFtYmRhLkxheWVyVmVyc2lvbih0aGlzLCAnQXV0aExheWVyJywge1xuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9zZXJ2aWNlcy9hdXRoLWxheWVyL2xheWVyJyksXG4gICAgICBjb21wYXRpYmxlUnVudGltZXM6IFtsYW1iZGEuUnVudGltZS5QUk9WSURFRF9BTDJdLFxuICAgICAgZGVzY3JpcHRpb246XG4gICAgICAgICdBdXRoZW50aWNhdGlvbiBhbmQgYXV0aG9yaXphdGlvbiBsYXllciBmb3IgR3ltQ29hY2ggQUkgc2VydmljZXMnLFxuICAgIH0pO1xuICAgIHJldHVybiB0aGlzLmF1dGhMYXllcjtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlUHl0aG9uQXV0aExheWVyKCk6IGxhbWJkYS5MYXllclZlcnNpb24ge1xuICAgIGlmICh0aGlzLnB5dGhvbkF1dGhMYXllcikge1xuICAgICAgcmV0dXJuIHRoaXMucHl0aG9uQXV0aExheWVyO1xuICAgIH1cbiAgICB0aGlzLnB5dGhvbkF1dGhMYXllciA9IG5ldyBsYW1iZGEuTGF5ZXJWZXJzaW9uKHRoaXMsICdQeXRob25BdXRoTGF5ZXInLCB7XG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uL3NlcnZpY2VzL2FpLXNlcnZpY2UtcHl0aG9uL2xheWVyJyksXG4gICAgICBjb21wYXRpYmxlUnVudGltZXM6IFtsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMV0sXG4gICAgICBkZXNjcmlwdGlvbjogJ1B5dGhvbiBhdXRoZW50aWNhdGlvbiBsYXllciBmb3IgQUkgc2VydmljZXMnLFxuICAgIH0pO1xuICAgIHJldHVybiB0aGlzLnB5dGhvbkF1dGhMYXllcjtcbiAgfVxuXG4gIC8vIFJlbW92ZWQgY3JlYXRlTW9uaXRvcmluZ1N0YWNrIG1ldGhvZCB0byBhdm9pZCBDbG91ZFdhdGNoIGNvc3RzXG4gIC8vIHByaXZhdGUgY3JlYXRlTW9uaXRvcmluZ1N0YWNrKCkge1xuICAvLyAgIC8vIENyZWF0ZSBtb25pdG9yaW5nIHN0YWNrXG4gIC8vICAgbmV3IE1vbml0b3JpbmdTdGFjayh0aGlzLCAnTW9uaXRvcmluZ1N0YWNrJywge1xuICAvLyAgICAgbGFtYmRhRnVuY3Rpb25zOiBbXG4gIC8vICAgICAgIHRoaXMudXNlclNlcnZpY2VMYW1iZGEsXG4gIC8vICAgICAgIHRoaXMudXNlclByb2ZpbGVTZXJ2aWNlTGFtYmRhLFxuICAvLyAgICAgICB0aGlzLndvcmtvdXRTZXJ2aWNlTGFtYmRhLFxuICAvLyAgICAgICB0aGlzLmNvYWNoaW5nU2VydmljZUxhbWJkYSxcbiAgLy8gICAgICAgdGhpcy5hbmFseXRpY3NTZXJ2aWNlTGFtYmRhLFxuICAvLyAgICAgICB0aGlzLm51dHJpdGlvblNlcnZpY2VMYW1iZGEsXG4gIC8vICAgICAgIHRoaXMuYWlTZXJ2aWNlTGFtYmRhLFxuICAvLyAgICAgXSxcbiAgLy8gICAgIGR5bmFtb0RiVGFibGU6IHRoaXMubWFpblRhYmxlLFxuICAvLyAgICAgczNCdWNrZXRzOiBbXG4gIC8vICAgICAgIHRoaXMudXNlclVwbG9hZHNCdWNrZXQsXG4gIC8vICAgICAgIHRoaXMuc3RhdGljQXNzZXRzQnVja2V0LFxuICAvLyAgICAgICB0aGlzLnByb2Nlc3NlZEltYWdlc0J1Y2tldCxcbiAgLy8gICAgIF0sXG4gIC8vICAgfSk7XG4gIC8vIH1cbn1cbiJdfQ==