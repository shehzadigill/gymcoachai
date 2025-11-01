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
            CLOUDFRONT_DOMAIN: `d12pveuxxq3vvn.cloudfront.net`, // Update manually after first deployment
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3ltY29hY2gtYWktc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvZ3ltY29hY2gtYWktc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBQ25DLGlEQUFpRDtBQUNqRCx5REFBeUQ7QUFDekQsOERBQThEO0FBRTlELHFEQUFxRDtBQUNyRCwyQ0FBMkM7QUFDM0MsbURBQW1EO0FBRW5ELHlDQUF5QztBQUN6QywyQ0FBMkM7QUFDM0MsaURBQWlEO0FBQ2pELDBEQUEwRDtBQUcxRCwyREFBMkQ7QUFFM0QsTUFBYSxlQUFnQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBZTVDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDOUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsMENBQTBDO1FBQzFDLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRTtZQUMzRCxTQUFTLEVBQUUsa0JBQWtCO1lBQzdCLFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQ2pFLE9BQU8sRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQzVELFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7WUFDakQsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztZQUN4QyxpRUFBaUU7U0FDbEUsQ0FBQyxDQUFDO1FBRUgsd0NBQXdDO1FBQ3hDLElBQUksQ0FBQyxTQUFTLENBQUMsdUJBQXVCLENBQUM7WUFDckMsU0FBUyxFQUFFLE1BQU07WUFDakIsWUFBWSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFB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TSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUM7WUFDaEQsV0FBVyxFQUFFLDZDQUE2QztTQUMzRCxDQUFDLENBQUM7UUFDSCxPQUFPLElBQUksQ0FBQyxlQUFlLENBQUM7SUFDOUIsQ0FBQztDQXVCRjtBQTkzQ0QsMENBODNDQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBjbG91ZGZyb250IGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250JztcbmltcG9ydCAqIGFzIG9yaWdpbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQtb3JpZ2lucyc7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBjb2duaXRvIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jb2duaXRvJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCAqIGFzIHNucyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc25zJztcbmltcG9ydCAqIGFzIGV2ZW50cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzJztcbmltcG9ydCAqIGFzIHRhcmdldHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cy10YXJnZXRzJztcbmltcG9ydCAqIGFzIHdhZnYyIGZyb20gJ2F3cy1jZGstbGliL2F3cy13YWZ2Mic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbi8vIFJlbW92ZWQgTW9uaXRvcmluZ1N0YWNrIGltcG9ydCB0byBhdm9pZCBDbG91ZFdhdGNoIGNvc3RzXG5cbmV4cG9ydCBjbGFzcyBHeW1Db2FjaEFJU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgdXNlclBvb2w6IGNvZ25pdG8uVXNlclBvb2w7XG4gIHB1YmxpYyByZWFkb25seSB1c2VyUG9vbENsaWVudDogY29nbml0by5Vc2VyUG9vbENsaWVudDtcbiAgcHVibGljIHJlYWRvbmx5IHVzZXJQb29sRG9tYWluOiBjb2duaXRvLlVzZXJQb29sRG9tYWluO1xuICBwdWJsaWMgcmVhZG9ubHkgbWFpblRhYmxlOiBkeW5hbW9kYi5UYWJsZTtcbiAgcHVibGljIHJlYWRvbmx5IGRpc3RyaWJ1dGlvbjogY2xvdWRmcm9udC5EaXN0cmlidXRpb247XG4gIHB1YmxpYyByZWFkb25seSB1c2VyVXBsb2Fkc0J1Y2tldDogczMuQnVja2V0O1xuICBwdWJsaWMgcmVhZG9ubHkgc3RhdGljQXNzZXRzQnVja2V0OiBzMy5CdWNrZXQ7XG4gIHB1YmxpYyByZWFkb25seSBwcm9jZXNzZWRJbWFnZXNCdWNrZXQ6IHMzLkJ1Y2tldDtcbiAgcHVibGljIHJlYWRvbmx5IHByb2dyZXNzUGhvdG9zQnVja2V0OiBzMy5CdWNrZXQ7XG4gIHB1YmxpYyByZWFkb25seSBmcm9udGVuZEJ1Y2tldDogczMuQnVja2V0O1xuICBwdWJsaWMgcmVhZG9ubHkgdmVjdG9yc0J1Y2tldDogczMuQnVja2V0O1xuICBwcml2YXRlIGF1dGhMYXllcj86IGxhbWJkYS5MYXllclZlcnNpb247XG4gIHByaXZhdGUgcHl0aG9uQXV0aExheWVyPzogbGFtYmRhLkxheWVyVmVyc2lvbjtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IGNkay5TdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyBEeW5hbW9EQiBUYWJsZSB3aXRoIFNpbmdsZSBUYWJsZSBEZXNpZ25cbiAgICB0aGlzLm1haW5UYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnR3ltQ29hY2hBSVRhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiAnZ3ltY29hY2gtYWktbWFpbicsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ1BLJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ1NLJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgLy8gUmVtb3ZlZCBwb2ludEluVGltZVJlY292ZXJ5IHRvIGF2b2lkIGNvc3RzICgyMCUgb2YgdGFibGUgY29zdClcbiAgICB9KTtcblxuICAgIC8vIEFkZCBHU0kgZm9yIGRpZmZlcmVudCBhY2Nlc3MgcGF0dGVybnNcbiAgICB0aGlzLm1haW5UYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdHU0kxJyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnR1NJMVBLJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ0dTSTFTSycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgfSk7XG5cbiAgICB0aGlzLm1haW5UYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdHU0kyJyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnR1NJMlBLJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ0dTSTJTSycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgQ29nbml0byBVc2VyIFBvb2xcbiAgICB0aGlzLnVzZXJQb29sID0gbmV3IGNvZ25pdG8uVXNlclBvb2wodGhpcywgJ0d5bUNvYWNoQUlVc2VyUG9vbCcsIHtcbiAgICAgIHVzZXJQb29sTmFtZTogJ2d5bWNvYWNoLWFpLXVzZXJzJyxcbiAgICAgIHNlbGZTaWduVXBFbmFibGVkOiB0cnVlLFxuICAgICAgc2lnbkluQWxpYXNlczoge1xuICAgICAgICBlbWFpbDogdHJ1ZSxcbiAgICAgICAgdXNlcm5hbWU6IHRydWUsXG4gICAgICB9LFxuICAgICAgYXV0b1ZlcmlmeToge1xuICAgICAgICBlbWFpbDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBzdGFuZGFyZEF0dHJpYnV0ZXM6IHtcbiAgICAgICAgZW1haWw6IHtcbiAgICAgICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICBnaXZlbk5hbWU6IHtcbiAgICAgICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICBmYW1pbHlOYW1lOiB7XG4gICAgICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBjdXN0b21BdHRyaWJ1dGVzOiB7XG4gICAgICAgIGZpdG5lc3NHb2FsczogbmV3IGNvZ25pdG8uU3RyaW5nQXR0cmlidXRlKHtcbiAgICAgICAgICBtaW5MZW46IDEsXG4gICAgICAgICAgbWF4TGVuOiAxMDAsXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcbiAgICAgICAgfSksXG4gICAgICAgIGV4cGVyaWVuY2VMZXZlbDogbmV3IGNvZ25pdG8uU3RyaW5nQXR0cmlidXRlKHtcbiAgICAgICAgICBtaW5MZW46IDEsXG4gICAgICAgICAgbWF4TGVuOiAyMCxcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxuICAgICAgICB9KSxcbiAgICAgICAgc3Vic2NyaXB0aW9uVGllcjogbmV3IGNvZ25pdG8uU3RyaW5nQXR0cmlidXRlKHtcbiAgICAgICAgICBtaW5MZW46IDEsXG4gICAgICAgICAgbWF4TGVuOiAyMCxcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxuICAgICAgICB9KSxcbiAgICAgIH0sXG4gICAgICBwYXNzd29yZFBvbGljeToge1xuICAgICAgICBtaW5MZW5ndGg6IDgsXG4gICAgICAgIHJlcXVpcmVMb3dlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVVcHBlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVEaWdpdHM6IHRydWUsXG4gICAgICAgIHJlcXVpcmVTeW1ib2xzOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIG1mYTogY29nbml0by5NZmEuT1BUSU9OQUwsXG4gICAgICBtZmFTZWNvbmRGYWN0b3I6IHtcbiAgICAgICAgc21zOiB0cnVlLFxuICAgICAgICBvdHA6IHRydWUsXG4gICAgICB9LFxuICAgICAgZGV2aWNlVHJhY2tpbmc6IHtcbiAgICAgICAgY2hhbGxlbmdlUmVxdWlyZWRPbk5ld0RldmljZTogdHJ1ZSxcbiAgICAgICAgZGV2aWNlT25seVJlbWVtYmVyZWRPblVzZXJQcm9tcHQ6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIGFjY291bnRSZWNvdmVyeTogY29nbml0by5BY2NvdW50UmVjb3ZlcnkuRU1BSUxfT05MWSxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgVXNlciBQb29sIENsaWVudCBmb3IgV2ViIEFwcFxuICAgIHRoaXMudXNlclBvb2xDbGllbnQgPSBuZXcgY29nbml0by5Vc2VyUG9vbENsaWVudCh0aGlzLCAnV2ViQXBwQ2xpZW50Jywge1xuICAgICAgdXNlclBvb2w6IHRoaXMudXNlclBvb2wsXG4gICAgICB1c2VyUG9vbENsaWVudE5hbWU6ICdneW1jb2FjaC1haS13ZWItY2xpZW50JyxcbiAgICAgIGdlbmVyYXRlU2VjcmV0OiBmYWxzZSxcbiAgICAgIGF1dGhGbG93czoge1xuICAgICAgICB1c2VyUGFzc3dvcmQ6IHRydWUsXG4gICAgICAgIHVzZXJTcnA6IHRydWUsXG4gICAgICAgIGN1c3RvbTogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBvQXV0aDoge1xuICAgICAgICBmbG93czoge1xuICAgICAgICAgIGF1dGhvcml6YXRpb25Db2RlR3JhbnQ6IHRydWUsXG4gICAgICAgICAgaW1wbGljaXRDb2RlR3JhbnQ6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgIHNjb3BlczogW1xuICAgICAgICAgIGNvZ25pdG8uT0F1dGhTY29wZS5FTUFJTCxcbiAgICAgICAgICBjb2duaXRvLk9BdXRoU2NvcGUuT1BFTklELFxuICAgICAgICAgIGNvZ25pdG8uT0F1dGhTY29wZS5QUk9GSUxFLFxuICAgICAgICBdLFxuICAgICAgICBjYWxsYmFja1VybHM6IFtcbiAgICAgICAgICAnaHR0cDovL2xvY2FsaG9zdDozMDAwL2F1dGgvY2FsbGJhY2snLFxuICAgICAgICAgICdodHRwczovLyouY2xvdWRmcm9udC5uZXQvYXV0aC9jYWxsYmFjaycsXG4gICAgICAgIF0sXG4gICAgICAgIGxvZ291dFVybHM6IFtcbiAgICAgICAgICAnaHR0cDovL2xvY2FsaG9zdDozMDAwL2F1dGgvbG9nb3V0JyxcbiAgICAgICAgICAnaHR0cHM6Ly8qLmNsb3VkZnJvbnQubmV0L2F1dGgvbG9nb3V0JyxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgICByZWZyZXNoVG9rZW5WYWxpZGl0eTogY2RrLkR1cmF0aW9uLmRheXMoMzApLFxuICAgICAgYWNjZXNzVG9rZW5WYWxpZGl0eTogY2RrLkR1cmF0aW9uLmhvdXJzKDEpLFxuICAgICAgaWRUb2tlblZhbGlkaXR5OiBjZGsuRHVyYXRpb24uaG91cnMoMSksXG4gICAgICBwcmV2ZW50VXNlckV4aXN0ZW5jZUVycm9yczogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBVc2VyIFBvb2wgRG9tYWluXG4gICAgdGhpcy51c2VyUG9vbERvbWFpbiA9IHRoaXMudXNlclBvb2wuYWRkRG9tYWluKCdDb2duaXRvRG9tYWluJywge1xuICAgICAgY29nbml0b0RvbWFpbjoge1xuICAgICAgICBkb21haW5QcmVmaXg6IGBneW1jb2FjaC1haS0ke3RoaXMuYWNjb3VudH1gLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBVc2VyIEdyb3VwcyBmb3IgUm9sZS1CYXNlZCBBY2Nlc3MgQ29udHJvbFxuICAgIGNvbnN0IGFkbWluR3JvdXAgPSBuZXcgY29nbml0by5DZm5Vc2VyUG9vbEdyb3VwKHRoaXMsICdBZG1pbkdyb3VwJywge1xuICAgICAgdXNlclBvb2xJZDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgZ3JvdXBOYW1lOiAnYWRtaW4nLFxuICAgICAgZGVzY3JpcHRpb246ICdBZG1pbmlzdHJhdG9ycyB3aXRoIGZ1bGwgYWNjZXNzJyxcbiAgICAgIHByZWNlZGVuY2U6IDEsXG4gICAgfSk7XG5cbiAgICBjb25zdCBjb2FjaEdyb3VwID0gbmV3IGNvZ25pdG8uQ2ZuVXNlclBvb2xHcm91cCh0aGlzLCAnQ29hY2hHcm91cCcsIHtcbiAgICAgIHVzZXJQb29sSWQ6IHRoaXMudXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgIGdyb3VwTmFtZTogJ2NvYWNoJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ29hY2hlcyB3aXRoIGFjY2VzcyB0byB1c2VyIGRhdGEgZm9yIGNvYWNoaW5nJyxcbiAgICAgIHByZWNlZGVuY2U6IDIsXG4gICAgfSk7XG5cbiAgICBjb25zdCB1c2VyR3JvdXAgPSBuZXcgY29nbml0by5DZm5Vc2VyUG9vbEdyb3VwKHRoaXMsICdVc2VyR3JvdXAnLCB7XG4gICAgICB1c2VyUG9vbElkOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICBncm91cE5hbWU6ICd1c2VyJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUmVndWxhciB1c2VycyB3aXRoIGFjY2VzcyB0byB0aGVpciBvd24gZGF0YScsXG4gICAgICBwcmVjZWRlbmNlOiAzLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIFNOUyBUb3BpY3MgZm9yIGRpZmZlcmVudCBub3RpZmljYXRpb24gdHlwZXNcbiAgICBjb25zdCB3b3Jrb3V0UmVtaW5kZXJzVG9waWMgPSBuZXcgc25zLlRvcGljKHRoaXMsICdXb3Jrb3V0UmVtaW5kZXJzVG9waWMnLCB7XG4gICAgICB0b3BpY05hbWU6ICdneW1jb2FjaC1haS13b3Jrb3V0LXJlbWluZGVycycsXG4gICAgICBkaXNwbGF5TmFtZTogJ1dvcmtvdXQgUmVtaW5kZXJzJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IG51dHJpdGlvblJlbWluZGVyc1RvcGljID0gbmV3IHNucy5Ub3BpYyhcbiAgICAgIHRoaXMsXG4gICAgICAnTnV0cml0aW9uUmVtaW5kZXJzVG9waWMnLFxuICAgICAge1xuICAgICAgICB0b3BpY05hbWU6ICdneW1jb2FjaC1haS1udXRyaXRpb24tcmVtaW5kZXJzJyxcbiAgICAgICAgZGlzcGxheU5hbWU6ICdOdXRyaXRpb24gUmVtaW5kZXJzJyxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgY29uc3QgYWNoaWV2ZW1lbnRUb3BpYyA9IG5ldyBzbnMuVG9waWModGhpcywgJ0FjaGlldmVtZW50VG9waWMnLCB7XG4gICAgICB0b3BpY05hbWU6ICdneW1jb2FjaC1haS1hY2hpZXZlbWVudHMnLFxuICAgICAgZGlzcGxheU5hbWU6ICdBY2hpZXZlbWVudCBOb3RpZmljYXRpb25zJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IGFpU3VnZ2VzdGlvbnNUb3BpYyA9IG5ldyBzbnMuVG9waWModGhpcywgJ0FJU3VnZ2VzdGlvbnNUb3BpYycsIHtcbiAgICAgIHRvcGljTmFtZTogJ2d5bWNvYWNoLWFpLXN1Z2dlc3Rpb25zJyxcbiAgICAgIGRpc3BsYXlOYW1lOiAnQUkgU3VnZ2VzdGlvbnMnLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIEV2ZW50QnJpZGdlIFJ1bGVzIGZvciBzY2hlZHVsZWQgbm90aWZpY2F0aW9uc1xuICAgIGNvbnN0IHdvcmtvdXRSZW1pbmRlclJ1bGUgPSBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ1dvcmtvdXRSZW1pbmRlclJ1bGUnLCB7XG4gICAgICBydWxlTmFtZTogJ2d5bWNvYWNoLWFpLXdvcmtvdXQtcmVtaW5kZXJzJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVHJpZ2dlcnMgd29ya291dCByZW1pbmRlciBub3RpZmljYXRpb25zJyxcbiAgICAgIHNjaGVkdWxlOiBldmVudHMuU2NoZWR1bGUuY3Jvbih7XG4gICAgICAgIG1pbnV0ZTogJzAnLFxuICAgICAgICBob3VyOiAnOCcsIC8vIDggQU0gVVRDIC0gd2lsbCBiZSBhZGp1c3RlZCBwZXIgdXNlciB0aW1lem9uZVxuICAgICAgfSksXG4gICAgfSk7XG5cbiAgICBjb25zdCBudXRyaXRpb25SZW1pbmRlclJ1bGUgPSBuZXcgZXZlbnRzLlJ1bGUoXG4gICAgICB0aGlzLFxuICAgICAgJ051dHJpdGlvblJlbWluZGVyUnVsZScsXG4gICAgICB7XG4gICAgICAgIHJ1bGVOYW1lOiAnZ3ltY29hY2gtYWktbnV0cml0aW9uLXJlbWluZGVycycsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnVHJpZ2dlcnMgbnV0cml0aW9uIHJlbWluZGVyIG5vdGlmaWNhdGlvbnMnLFxuICAgICAgICBzY2hlZHVsZTogZXZlbnRzLlNjaGVkdWxlLmNyb24oe1xuICAgICAgICAgIG1pbnV0ZTogJzAnLFxuICAgICAgICAgIGhvdXI6ICcxMicsIC8vIDEyIFBNIFVUQyAtIHdpbGwgYmUgYWRqdXN0ZWQgcGVyIHVzZXIgdGltZXpvbmVcbiAgICAgICAgfSksXG4gICAgICB9XG4gICAgKTtcblxuICAgIGNvbnN0IHdhdGVyUmVtaW5kZXJSdWxlID0gbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdXYXRlclJlbWluZGVyUnVsZScsIHtcbiAgICAgIHJ1bGVOYW1lOiAnZ3ltY29hY2gtYWktd2F0ZXItcmVtaW5kZXJzJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVHJpZ2dlcnMgd2F0ZXIgaW50YWtlIHJlbWluZGVyIG5vdGlmaWNhdGlvbnMnLFxuICAgICAgc2NoZWR1bGU6IGV2ZW50cy5TY2hlZHVsZS5jcm9uKHtcbiAgICAgICAgbWludXRlOiAnMCcsXG4gICAgICAgIGhvdXI6ICcqJywgLy8gRXZlcnkgaG91clxuICAgICAgfSksXG4gICAgfSk7XG5cbiAgICBjb25zdCBwcm9ncmVzc1Bob3RvUnVsZSA9IG5ldyBldmVudHMuUnVsZSh0aGlzLCAnUHJvZ3Jlc3NQaG90b1J1bGUnLCB7XG4gICAgICBydWxlTmFtZTogJ2d5bWNvYWNoLWFpLXByb2dyZXNzLXBob3RvcycsXG4gICAgICBkZXNjcmlwdGlvbjogJ1RyaWdnZXJzIHdlZWtseSBwcm9ncmVzcyBwaG90byByZW1pbmRlcnMnLFxuICAgICAgc2NoZWR1bGU6IGV2ZW50cy5TY2hlZHVsZS5jcm9uKHtcbiAgICAgICAgbWludXRlOiAnMCcsXG4gICAgICAgIGhvdXI6ICcxOCcsIC8vIDYgUE0gVVRDIG9uIFN1bmRheXNcbiAgICAgICAgd2Vla0RheTogJ1NVTicsXG4gICAgICB9KSxcbiAgICB9KTtcblxuICAgIC8vIFByb2FjdGl2ZSBDb2FjaGluZyBFdmVudEJyaWRnZSBSdWxlc1xuICAgIGNvbnN0IHByb2FjdGl2ZUNoZWNrSW5SdWxlID0gbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdQcm9hY3RpdmVDaGVja0luUnVsZScsIHtcbiAgICAgIHJ1bGVOYW1lOiAnZ3ltY29hY2gtYWktcHJvYWN0aXZlLWNoZWNraW5zJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVHJpZ2dlcnMgcHJvYWN0aXZlIEFJIGNvYWNoIGNoZWNrLWlucycsXG4gICAgICBzY2hlZHVsZTogZXZlbnRzLlNjaGVkdWxlLmNyb24oe1xuICAgICAgICBtaW51dGU6ICcwJyxcbiAgICAgICAgaG91cjogJzknLCAvLyA5IEFNIFVUQyBkYWlseVxuICAgICAgfSksXG4gICAgfSk7XG5cbiAgICBjb25zdCBwcm9ncmVzc01vbml0b3JSdWxlID0gbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdQcm9ncmVzc01vbml0b3JSdWxlJywge1xuICAgICAgcnVsZU5hbWU6ICdneW1jb2FjaC1haS1wcm9ncmVzcy1tb25pdG9yaW5nJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnTW9uaXRvcnMgdXNlciBwcm9ncmVzcyBhbmQgdHJpZ2dlcnMgaW50ZXJ2ZW50aW9ucycsXG4gICAgICBzY2hlZHVsZTogZXZlbnRzLlNjaGVkdWxlLmNyb24oe1xuICAgICAgICBtaW51dGU6ICcwJyxcbiAgICAgICAgaG91cjogJzYnLCAvLyA2IEFNIFVUQyBkYWlseVxuICAgICAgfSksXG4gICAgfSk7XG5cbiAgICBjb25zdCBwbGF0ZWF1RGV0ZWN0aW9uUnVsZSA9IG5ldyBldmVudHMuUnVsZSh0aGlzLCAnUGxhdGVhdURldGVjdGlvblJ1bGUnLCB7XG4gICAgICBydWxlTmFtZTogJ2d5bWNvYWNoLWFpLXBsYXRlYXUtZGV0ZWN0aW9uJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRGV0ZWN0cyB3b3Jrb3V0IHBsYXRlYXVzIGFuZCBzdWdnZXN0cyBjaGFuZ2VzJyxcbiAgICAgIHNjaGVkdWxlOiBldmVudHMuU2NoZWR1bGUuY3Jvbih7XG4gICAgICAgIG1pbnV0ZTogJzAnLFxuICAgICAgICBob3VyOiAnMjAnLCAvLyA4IFBNIFVUQyBvbiBTdW5kYXlzXG4gICAgICAgIHdlZWtEYXk6ICdTVU4nLFxuICAgICAgfSksXG4gICAgfSk7XG5cbiAgICBjb25zdCBtb3RpdmF0aW9uQm9vc3RSdWxlID0gbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdNb3RpdmF0aW9uQm9vc3RSdWxlJywge1xuICAgICAgcnVsZU5hbWU6ICdneW1jb2FjaC1haS1tb3RpdmF0aW9uLWJvb3N0JyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2VuZHMgbW90aXZhdGlvbmFsIG1lc3NhZ2VzIGJhc2VkIG9uIHVzZXIgcGF0dGVybnMnLFxuICAgICAgc2NoZWR1bGU6IGV2ZW50cy5TY2hlZHVsZS5jcm9uKHtcbiAgICAgICAgbWludXRlOiAnMCcsXG4gICAgICAgIGhvdXI6ICc3JywgLy8gNyBBTSBVVEMgb24gTW9uZGF5c1xuICAgICAgICB3ZWVrRGF5OiAnTU9OJyxcbiAgICAgIH0pLFxuICAgIH0pO1xuXG4gICAgY29uc3Qgd2Vla2x5UmV2aWV3UnVsZSA9IG5ldyBldmVudHMuUnVsZSh0aGlzLCAnV2Vla2x5UmV2aWV3UnVsZScsIHtcbiAgICAgIHJ1bGVOYW1lOiAnZ3ltY29hY2gtYWktd2Vla2x5LXJldmlldycsXG4gICAgICBkZXNjcmlwdGlvbjogJ0dlbmVyYXRlcyB3ZWVrbHkgcHJvZ3Jlc3MgcmV2aWV3cyBhbmQgcmVjb21tZW5kYXRpb25zJyxcbiAgICAgIHNjaGVkdWxlOiBldmVudHMuU2NoZWR1bGUuY3Jvbih7XG4gICAgICAgIG1pbnV0ZTogJzAnLFxuICAgICAgICBob3VyOiAnMTknLCAvLyA3IFBNIFVUQyBvbiBTdW5kYXlzXG4gICAgICAgIHdlZWtEYXk6ICdTVU4nLFxuICAgICAgfSksXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgUzMgQnVja2V0cyAobmVlZGVkIGJ5IExhbWJkYXMpXG4gICAgdGhpcy51c2VyVXBsb2Fkc0J1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ1VzZXJVcGxvYWRzQnVja2V0Jywge1xuICAgICAgYnVja2V0TmFtZTogYGd5bWNvYWNoLWFpLXVzZXItdXBsb2Fkcy0ke3RoaXMuYWNjb3VudH1gLFxuICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IG5ldyBzMy5CbG9ja1B1YmxpY0FjY2Vzcyh7XG4gICAgICAgIGJsb2NrUHVibGljQWNsczogZmFsc2UsXG4gICAgICAgIGJsb2NrUHVibGljUG9saWN5OiBmYWxzZSxcbiAgICAgICAgaWdub3JlUHVibGljQWNsczogZmFsc2UsXG4gICAgICAgIHJlc3RyaWN0UHVibGljQnVja2V0czogZmFsc2UsXG4gICAgICB9KSxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBjb3JzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXG4gICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IFtcbiAgICAgICAgICAgIHMzLkh0dHBNZXRob2RzLkdFVCxcbiAgICAgICAgICAgIHMzLkh0dHBNZXRob2RzLlBVVCxcbiAgICAgICAgICAgIHMzLkh0dHBNZXRob2RzLlBPU1QsXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5ERUxFVEUsXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5IRUFELFxuICAgICAgICAgIF0sXG4gICAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLFxuICAgICAgICAgIGV4cG9zZWRIZWFkZXJzOiBbJ0VUYWcnXSxcbiAgICAgICAgICBtYXhBZ2U6IDMwMDAsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgICAgbGlmZWN5Y2xlUnVsZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAnRGVsZXRlSW5jb21wbGV0ZU11bHRpcGFydFVwbG9hZHMnLFxuICAgICAgICAgIGFib3J0SW5jb21wbGV0ZU11bHRpcGFydFVwbG9hZEFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cyg3KSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAnVHJhbnNpdGlvblRvSUEnLFxuICAgICAgICAgIHRyYW5zaXRpb25zOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHN0b3JhZ2VDbGFzczogczMuU3RvcmFnZUNsYXNzLklORlJFUVVFTlRfQUNDRVNTLFxuICAgICAgICAgICAgICB0cmFuc2l0aW9uQWZ0ZXI6IGNkay5EdXJhdGlvbi5kYXlzKDMwKSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAnVHJhbnNpdGlvblRvR2xhY2llcicsXG4gICAgICAgICAgdHJhbnNpdGlvbnM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgc3RvcmFnZUNsYXNzOiBzMy5TdG9yYWdlQ2xhc3MuR0xBQ0lFUixcbiAgICAgICAgICAgICAgdHJhbnNpdGlvbkFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cyg5MCksXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIGJ1Y2tldCBwb2xpY3kgdG8gYWxsb3cgcHVibGljIHJlYWQgYWNjZXNzIHRvIHVwbG9hZGVkIGltYWdlc1xuICAgIHRoaXMudXNlclVwbG9hZHNCdWNrZXQuYWRkVG9SZXNvdXJjZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBwcmluY2lwYWxzOiBbbmV3IGlhbS5BbnlQcmluY2lwYWwoKV0sXG4gICAgICAgIGFjdGlvbnM6IFsnczM6R2V0T2JqZWN0J10sXG4gICAgICAgIHJlc291cmNlczogW2Ake3RoaXMudXNlclVwbG9hZHNCdWNrZXQuYnVja2V0QXJufS91c2VyLXByb2ZpbGVzLypgXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIHRoaXMuc3RhdGljQXNzZXRzQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnU3RhdGljQXNzZXRzQnVja2V0Jywge1xuICAgICAgYnVja2V0TmFtZTogYGd5bWNvYWNoLWFpLXN0YXRpYy1hc3NldHMtJHt0aGlzLmFjY291bnR9YCxcbiAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgcHVibGljUmVhZEFjY2VzczogZmFsc2UsXG4gICAgfSk7XG5cbiAgICB0aGlzLnByb2Nlc3NlZEltYWdlc0J1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ1Byb2Nlc3NlZEltYWdlc0J1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGBneW1jb2FjaC1haS1wcm9jZXNzZWQtaW1hZ2VzLSR7dGhpcy5hY2NvdW50fWAsXG4gICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBkZWRpY2F0ZWQgUHJvZ3Jlc3MgUGhvdG9zIFMzIEJ1Y2tldCB3aXRoIGVuaGFuY2VkIHNlY3VyaXR5XG4gICAgdGhpcy5wcm9ncmVzc1Bob3Rvc0J1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ1Byb2dyZXNzUGhvdG9zQnVja2V0Jywge1xuICAgICAgYnVja2V0TmFtZTogYGd5bWNvYWNoLWFpLXByb2dyZXNzLXBob3Rvcy0ke3RoaXMuYWNjb3VudH1gLFxuICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBjb3JzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXG4gICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IFtcbiAgICAgICAgICAgIHMzLkh0dHBNZXRob2RzLkdFVCxcbiAgICAgICAgICAgIHMzLkh0dHBNZXRob2RzLlBVVCxcbiAgICAgICAgICAgIHMzLkh0dHBNZXRob2RzLlBPU1QsXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5ERUxFVEUsXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5IRUFELFxuICAgICAgICAgIF0sXG4gICAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLFxuICAgICAgICAgIGV4cG9zZWRIZWFkZXJzOiBbJ0VUYWcnXSxcbiAgICAgICAgICBtYXhBZ2U6IDMwMDAsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgICAgbGlmZWN5Y2xlUnVsZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAnRGVsZXRlSW5jb21wbGV0ZU11bHRpcGFydFVwbG9hZHMnLFxuICAgICAgICAgIGFib3J0SW5jb21wbGV0ZU11bHRpcGFydFVwbG9hZEFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cygxKSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAnVHJhbnNpdGlvblByb2dyZXNzUGhvdG9zVG9JQScsXG4gICAgICAgICAgdHJhbnNpdGlvbnM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgc3RvcmFnZUNsYXNzOiBzMy5TdG9yYWdlQ2xhc3MuSU5GUkVRVUVOVF9BQ0NFU1MsXG4gICAgICAgICAgICAgIHRyYW5zaXRpb25BZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoMzApLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdBcmNoaXZlT2xkUHJvZ3Jlc3NQaG90b3MnLFxuICAgICAgICAgIHRyYW5zaXRpb25zOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHN0b3JhZ2VDbGFzczogczMuU3RvcmFnZUNsYXNzLkdMQUNJRVIsXG4gICAgICAgICAgICAgIHRyYW5zaXRpb25BZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoMzY1KSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgQ2xvdWRGcm9udCBPcmlnaW4gQWNjZXNzIElkZW50aXR5IGZvciBzZWN1cmUgUzMgYWNjZXNzXG4gICAgY29uc3QgcHJvZ3Jlc3NQaG90b3NPQUkgPSBuZXcgY2xvdWRmcm9udC5PcmlnaW5BY2Nlc3NJZGVudGl0eShcbiAgICAgIHRoaXMsXG4gICAgICAnUHJvZ3Jlc3NQaG90b3NPQUknLFxuICAgICAge1xuICAgICAgICBjb21tZW50OiAnT3JpZ2luIEFjY2VzcyBJZGVudGl0eSBmb3IgUHJvZ3Jlc3MgUGhvdG9zIGJ1Y2tldCB2MicsXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIEdyYW50IENsb3VkRnJvbnQgT0FJIGFjY2VzcyB0byBwcm9ncmVzcyBwaG90b3MgYnVja2V0XG4gICAgdGhpcy5wcm9ncmVzc1Bob3Rvc0J1Y2tldC5hZGRUb1Jlc291cmNlUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIHByaW5jaXBhbHM6IFtwcm9ncmVzc1Bob3Rvc09BSS5ncmFudFByaW5jaXBhbF0sXG4gICAgICAgIGFjdGlvbnM6IFsnczM6R2V0T2JqZWN0J10sXG4gICAgICAgIHJlc291cmNlczogW2Ake3RoaXMucHJvZ3Jlc3NQaG90b3NCdWNrZXQuYnVja2V0QXJufS8qYF0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBDcmVhdGUgQ2xvdWRGcm9udCBPcmlnaW4gQWNjZXNzIElkZW50aXR5IGZvciBmcm9udGVuZCBidWNrZXRcbiAgICBjb25zdCBmcm9udGVuZE9BSSA9IG5ldyBjbG91ZGZyb250Lk9yaWdpbkFjY2Vzc0lkZW50aXR5KFxuICAgICAgdGhpcyxcbiAgICAgICdGcm9udGVuZE9BSScsXG4gICAgICB7XG4gICAgICAgIGNvbW1lbnQ6ICdPcmlnaW4gQWNjZXNzIElkZW50aXR5IGZvciBGcm9udGVuZCBidWNrZXQnLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBDcmVhdGUgRnJvbnRlbmQgUzMgQnVja2V0IGZvciBzdGF0aWMgYXNzZXRzXG4gICAgdGhpcy5mcm9udGVuZEJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ0Zyb250ZW5kQnVja2V0Jywge1xuICAgICAgYnVja2V0TmFtZTogYGd5bWNvYWNoLWFpLWZyb250ZW5kLSR7dGhpcy5hY2NvdW50fWAsXG4gICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXG4gICAgICBwdWJsaWNSZWFkQWNjZXNzOiBmYWxzZSwgLy8gT25seSBDbG91ZEZyb250IE9BSSBzaG91bGQgYWNjZXNzXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLCAvLyBCbG9jayBhbGwgcHVibGljIGFjY2Vzc1xuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IENsb3VkRnJvbnQgT0FJIGFjY2VzcyB0byBmcm9udGVuZCBidWNrZXRcbiAgICB0aGlzLmZyb250ZW5kQnVja2V0LmFkZFRvUmVzb3VyY2VQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgcHJpbmNpcGFsczogW2Zyb250ZW5kT0FJLmdyYW50UHJpbmNpcGFsXSxcbiAgICAgICAgYWN0aW9uczogWydzMzpHZXRPYmplY3QnXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbYCR7dGhpcy5mcm9udGVuZEJ1Y2tldC5idWNrZXRBcm59LypgXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIENyZWF0ZSBTMyBWZWN0b3JzIEJ1Y2tldCBmb3IgQUkgS25vd2xlZGdlIEJhc2VcbiAgICB0aGlzLnZlY3RvcnNCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdWZWN0b3JzQnVja2V0Jywge1xuICAgICAgYnVja2V0TmFtZTogYGd5bWNvYWNoLWFpLXZlY3RvcnMtJHt0aGlzLmFjY291bnR9YCxcbiAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgY29yczogW1xuICAgICAgICB7XG4gICAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBbXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5HRVQsXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5QVVQsXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5QT1NULFxuICAgICAgICAgICAgczMuSHR0cE1ldGhvZHMuREVMRVRFLFxuICAgICAgICAgICAgczMuSHR0cE1ldGhvZHMuSEVBRCxcbiAgICAgICAgICBdLFxuICAgICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcbiAgICAgICAgICBleHBvc2VkSGVhZGVyczogWydFVGFnJ10sXG4gICAgICAgICAgbWF4QWdlOiAzMDAwLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ0RlbGV0ZUluY29tcGxldGVNdWx0aXBhcnRVcGxvYWRzJyxcbiAgICAgICAgICBhYm9ydEluY29tcGxldGVNdWx0aXBhcnRVcGxvYWRBZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoMSksXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ1RyYW5zaXRpb25WZWN0b3JzVG9JQScsXG4gICAgICAgICAgdHJhbnNpdGlvbnM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgc3RvcmFnZUNsYXNzOiBzMy5TdG9yYWdlQ2xhc3MuSU5GUkVRVUVOVF9BQ0NFU1MsXG4gICAgICAgICAgICAgIHRyYW5zaXRpb25BZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoMzApLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdBcmNoaXZlT2xkVmVjdG9ycycsXG4gICAgICAgICAgdHJhbnNpdGlvbnM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgc3RvcmFnZUNsYXNzOiBzMy5TdG9yYWdlQ2xhc3MuR0xBQ0lFUixcbiAgICAgICAgICAgICAgdHJhbnNpdGlvbkFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cyg5MCksXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIExhbWJkYSBBdXRob3JpemVyXG4gICAgY29uc3QgYXV0aG9yaXplckxhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0F1dGhvcml6ZXJMYW1iZGEnLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21JbmxpbmUoYFxuICAgICAgICBjb25zdCBqd3QgPSByZXF1aXJlKCdqc29ud2VidG9rZW4nKTtcbiAgICAgICAgY29uc3Qgandrc0NsaWVudCA9IHJlcXVpcmUoJ2p3a3MtcnNhJyk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBjbGllbnQgPSBqd2tzQ2xpZW50KHtcbiAgICAgICAgICBqd2tzVXJpOiAnaHR0cHM6Ly9jb2duaXRvLWlkcC4ke3RoaXMucmVnaW9ufS5hbWF6b25hd3MuY29tLyR7dGhpcy51c2VyUG9vbC51c2VyUG9vbElkfS8ud2VsbC1rbm93bi9qd2tzLmpzb24nXG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgZnVuY3Rpb24gZ2V0S2V5KGhlYWRlciwgY2FsbGJhY2spIHtcbiAgICAgICAgICBjbGllbnQuZ2V0U2lnbmluZ0tleShoZWFkZXIua2lkLCAoZXJyLCBrZXkpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHNpZ25pbmdLZXkgPSBrZXkucHVibGljS2V5IHx8IGtleS5yc2FQdWJsaWNLZXk7XG4gICAgICAgICAgICBjYWxsYmFjayhudWxsLCBzaWduaW5nS2V5KTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgZXhwb3J0cy5oYW5kbGVyID0gYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ0F1dGhvcml6ZXIgZXZlbnQ6JywgSlNPTi5zdHJpbmdpZnkoZXZlbnQsIG51bGwsIDIpKTtcbiAgICAgICAgICBcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgdG9rZW4gPSBldmVudC5oZWFkZXJzLmF1dGhvcml6YXRpb24/LnJlcGxhY2UoJ0JlYXJlciAnLCAnJyk7XG4gICAgICAgICAgICBpZiAoIXRva2VuKSB7XG4gICAgICAgICAgICAgIHJldHVybiBnZW5lcmF0ZVBvbGljeSgndXNlcicsICdEZW55JywgZXZlbnQubWV0aG9kQXJuKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uc3QgZGVjb2RlZCA9IGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgICAgand0LnZlcmlmeSh0b2tlbiwgZ2V0S2V5LCB7IGFsZ29yaXRobXM6IFsnUlMyNTYnXSB9LCAoZXJyLCBkZWNvZGVkKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikgcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgZWxzZSByZXNvbHZlKGRlY29kZWQpO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnRGVjb2RlZCB0b2tlbjonLCBkZWNvZGVkKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIGdlbmVyYXRlUG9saWN5KGRlY29kZWQuc3ViLCAnQWxsb3cnLCBldmVudC5tZXRob2RBcm4sIGRlY29kZWQpO1xuICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdBdXRob3JpemF0aW9uIGVycm9yOicsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiBnZW5lcmF0ZVBvbGljeSgndXNlcicsICdEZW55JywgZXZlbnQubWV0aG9kQXJuKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIFxuICAgICAgICBmdW5jdGlvbiBnZW5lcmF0ZVBvbGljeShwcmluY2lwYWxJZCwgZWZmZWN0LCByZXNvdXJjZSwgY29udGV4dCA9IHt9KSB7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHByaW5jaXBhbElkLFxuICAgICAgICAgICAgcG9saWN5RG9jdW1lbnQ6IHtcbiAgICAgICAgICAgICAgVmVyc2lvbjogJzIwMTItMTAtMTcnLFxuICAgICAgICAgICAgICBTdGF0ZW1lbnQ6IFt7XG4gICAgICAgICAgICAgICAgQWN0aW9uOiAnZXhlY3V0ZS1hcGk6SW52b2tlJyxcbiAgICAgICAgICAgICAgICBFZmZlY3Q6IGVmZmVjdCxcbiAgICAgICAgICAgICAgICBSZXNvdXJjZTogcmVzb3VyY2VcbiAgICAgICAgICAgICAgfV1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjb250ZXh0XG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgYCksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBVU0VSX1BPT0xfSUQ6IHRoaXMudXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgICAgVVNFUl9QT09MX0NMSUVOVF9JRDogdGhpcy51c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkLFxuICAgICAgICBUQUJMRV9OQU1FOiB0aGlzLm1haW5UYWJsZS50YWJsZU5hbWUsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgcGVybWlzc2lvbnMgdG8gYXV0aG9yaXplclxuICAgIHRoaXMubWFpblRhYmxlLmdyYW50UmVhZERhdGEoYXV0aG9yaXplckxhbWJkYSk7XG5cbiAgICAvLyBDcmVhdGUgTGFtYmRhIGZ1bmN0aW9ucyBmb3IgZWFjaCBzZXJ2aWNlXG4gICAgLy8gY29uc3QgdXNlclNlcnZpY2VMYW1iZGEgPSB0aGlzLmNyZWF0ZUxhbWJkYUZ1bmN0aW9uKFxuICAgIC8vICAgJ1VzZXJTZXJ2aWNlJyxcbiAgICAvLyAgICd1c2VyLXNlcnZpY2UnXG4gICAgLy8gKTtcbiAgICBjb25zdCB1c2VyUHJvZmlsZVNlcnZpY2VMYW1iZGEgPSB0aGlzLmNyZWF0ZUxhbWJkYUZ1bmN0aW9uKFxuICAgICAgJ1VzZXJQcm9maWxlU2VydmljZScsXG4gICAgICAndXNlci1wcm9maWxlLXNlcnZpY2UnXG4gICAgKTtcbiAgICBjb25zdCB3b3Jrb3V0U2VydmljZUxhbWJkYSA9IHRoaXMuY3JlYXRlTGFtYmRhRnVuY3Rpb24oXG4gICAgICAnV29ya291dFNlcnZpY2UnLFxuICAgICAgJ3dvcmtvdXQtc2VydmljZSdcbiAgICApO1xuICAgIGNvbnN0IGNvYWNoaW5nU2VydmljZUxhbWJkYSA9IHRoaXMuY3JlYXRlTGFtYmRhRnVuY3Rpb24oXG4gICAgICAnQ29hY2hpbmdTZXJ2aWNlJyxcbiAgICAgICdjb2FjaGluZy1zZXJ2aWNlJ1xuICAgICk7XG4gICAgY29uc3QgYW5hbHl0aWNzU2VydmljZUxhbWJkYSA9IHRoaXMuY3JlYXRlTGFtYmRhRnVuY3Rpb24oXG4gICAgICAnQW5hbHl0aWNzU2VydmljZScsXG4gICAgICAnYW5hbHl0aWNzLXNlcnZpY2UnLFxuICAgICAge1xuICAgICAgICAvLyBBZGQgQ2xvdWRGcm9udCBkb21haW4gcGxhY2Vob2xkZXIgLSB3aWxsIGJlIHVwZGF0ZWQgYWZ0ZXIgZGVwbG95bWVudFxuICAgICAgICBDTE9VREZST05UX0RPTUFJTjogYGQxMnB2ZXV4eHEzdnZuLmNsb3VkZnJvbnQubmV0YCwgLy8gVXBkYXRlIG1hbnVhbGx5IGFmdGVyIGZpcnN0IGRlcGxveW1lbnRcbiAgICAgIH1cbiAgICApO1xuICAgIGNvbnN0IG51dHJpdGlvblNlcnZpY2VMYW1iZGEgPSB0aGlzLmNyZWF0ZUxhbWJkYUZ1bmN0aW9uKFxuICAgICAgJ051dHJpdGlvblNlcnZpY2UnLFxuICAgICAgJ251dHJpdGlvbi1zZXJ2aWNlJ1xuICAgICk7XG4gICAgY29uc3QgYWlTZXJ2aWNlTGFtYmRhID0gdGhpcy5jcmVhdGVQeXRob25MYW1iZGFGdW5jdGlvbihcbiAgICAgICdBSVNlcnZpY2UnLFxuICAgICAgJ2FpLXNlcnZpY2UtcHl0aG9uJ1xuICAgICk7XG5cbiAgICAvLyBDcmVhdGUgTm90aWZpY2F0aW9uIFNlcnZpY2UgTGFtYmRhXG4gICAgY29uc3Qgbm90aWZpY2F0aW9uU2VydmljZUxhbWJkYSA9IHRoaXMuY3JlYXRlTGFtYmRhRnVuY3Rpb24oXG4gICAgICAnTm90aWZpY2F0aW9uU2VydmljZScsXG4gICAgICAnbm90aWZpY2F0aW9uLXNlcnZpY2UnLFxuICAgICAge1xuICAgICAgICBXT1JLT1VUX1JFTUlOREVSU19UT1BJQ19BUk46IHdvcmtvdXRSZW1pbmRlcnNUb3BpYy50b3BpY0FybixcbiAgICAgICAgTlVUUklUSU9OX1JFTUlOREVSU19UT1BJQ19BUk46IG51dHJpdGlvblJlbWluZGVyc1RvcGljLnRvcGljQXJuLFxuICAgICAgICBBQ0hJRVZFTUVOVF9UT1BJQ19BUk46IGFjaGlldmVtZW50VG9waWMudG9waWNBcm4sXG4gICAgICAgIEFJX1NVR0dFU1RJT05TX1RPUElDX0FSTjogYWlTdWdnZXN0aW9uc1RvcGljLnRvcGljQXJuLFxuICAgICAgICBGQ01fU0VSVkVSX0tFWTogcHJvY2Vzcy5lbnYuRkNNX1NFUlZFUl9LRVkgfHwgJ3BsYWNlaG9sZGVyJyxcbiAgICAgICAgRklSRUJBU0VfUFJPSkVDVF9JRDpcbiAgICAgICAgICBwcm9jZXNzLmVudi5GSVJFQkFTRV9QUk9KRUNUX0lEIHx8ICdneW1jb2FjaC03MzUyOCcsXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIENyZWF0ZSBOb3RpZmljYXRpb24gU2NoZWR1bGVyIExhbWJkYVxuICAgIGNvbnN0IG5vdGlmaWNhdGlvblNjaGVkdWxlckxhbWJkYSA9IHRoaXMuY3JlYXRlTGFtYmRhRnVuY3Rpb24oXG4gICAgICAnTm90aWZpY2F0aW9uU2NoZWR1bGVyJyxcbiAgICAgICdub3RpZmljYXRpb24tc2NoZWR1bGVyJyxcbiAgICAgIHtcbiAgICAgICAgTk9USUZJQ0FUSU9OX1NFUlZJQ0VfRlVOQ1RJT05fQVJOOiAnJywgLy8gV2lsbCBiZSBzZXQgYWZ0ZXIgY3JlYXRpb25cbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gVXBkYXRlIG5vdGlmaWNhdGlvbiBzY2hlZHVsZXIgd2l0aCB0aGUgY29ycmVjdCBmdW5jdGlvbiBBUk5cbiAgICBub3RpZmljYXRpb25TY2hlZHVsZXJMYW1iZGEuYWRkRW52aXJvbm1lbnQoXG4gICAgICAnTk9USUZJQ0FUSU9OX1NFUlZJQ0VfRlVOQ1RJT05fQVJOJyxcbiAgICAgIG5vdGlmaWNhdGlvblNlcnZpY2VMYW1iZGEuZnVuY3Rpb25Bcm5cbiAgICApO1xuXG4gICAgLy8gRW5hYmxlIExhbWJkYSBGdW5jdGlvbiBVUkxzXG4gICAgLy8gY29uc3QgdXNlclNlcnZpY2VVcmwgPSB1c2VyU2VydmljZUxhbWJkYS5hZGRGdW5jdGlvblVybCh7XG4gICAgLy8gICBhdXRoVHlwZTogbGFtYmRhLkZ1bmN0aW9uVXJsQXV0aFR5cGUuTk9ORSxcbiAgICAvLyAgIGNvcnM6IHtcbiAgICAvLyAgICAgYWxsb3dDcmVkZW50aWFsczogZmFsc2UsXG4gICAgLy8gICAgIGFsbG93ZWRIZWFkZXJzOiBbJyonXSxcbiAgICAvLyAgICAgYWxsb3dlZE1ldGhvZHM6IFtsYW1iZGEuSHR0cE1ldGhvZC5BTExdLFxuICAgIC8vICAgICBhbGxvd2VkT3JpZ2luczogWycqJ10sXG4gICAgLy8gICB9LFxuICAgIC8vIH0pO1xuXG4gICAgY29uc3QgdXNlclByb2ZpbGVTZXJ2aWNlVXJsID0gdXNlclByb2ZpbGVTZXJ2aWNlTGFtYmRhLmFkZEZ1bmN0aW9uVXJsKHtcbiAgICAgIGF1dGhUeXBlOiBsYW1iZGEuRnVuY3Rpb25VcmxBdXRoVHlwZS5OT05FLFxuICAgICAgY29yczoge1xuICAgICAgICBhbGxvd0NyZWRlbnRpYWxzOiBmYWxzZSxcbiAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxuICAgICAgICBhbGxvd2VkTWV0aG9kczogW2xhbWJkYS5IdHRwTWV0aG9kLkFMTF0sXG4gICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCB3b3Jrb3V0U2VydmljZVVybCA9IHdvcmtvdXRTZXJ2aWNlTGFtYmRhLmFkZEZ1bmN0aW9uVXJsKHtcbiAgICAgIGF1dGhUeXBlOiBsYW1iZGEuRnVuY3Rpb25VcmxBdXRoVHlwZS5OT05FLFxuICAgICAgY29yczoge1xuICAgICAgICBhbGxvd0NyZWRlbnRpYWxzOiBmYWxzZSxcbiAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxuICAgICAgICBhbGxvd2VkTWV0aG9kczogW2xhbWJkYS5IdHRwTWV0aG9kLkFMTF0sXG4gICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCBjb2FjaGluZ1NlcnZpY2VVcmwgPSBjb2FjaGluZ1NlcnZpY2VMYW1iZGEuYWRkRnVuY3Rpb25Vcmwoe1xuICAgICAgYXV0aFR5cGU6IGxhbWJkYS5GdW5jdGlvblVybEF1dGhUeXBlLk5PTkUsXG4gICAgICBjb3JzOiB7XG4gICAgICAgIGFsbG93Q3JlZGVudGlhbHM6IGZhbHNlLFxuICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXG4gICAgICAgIGFsbG93ZWRNZXRob2RzOiBbbGFtYmRhLkh0dHBNZXRob2QuQUxMXSxcbiAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGFuYWx5dGljc1NlcnZpY2VVcmwgPSBhbmFseXRpY3NTZXJ2aWNlTGFtYmRhLmFkZEZ1bmN0aW9uVXJsKHtcbiAgICAgIGF1dGhUeXBlOiBsYW1iZGEuRnVuY3Rpb25VcmxBdXRoVHlwZS5OT05FLFxuICAgICAgY29yczoge1xuICAgICAgICBhbGxvd0NyZWRlbnRpYWxzOiBmYWxzZSxcbiAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxuICAgICAgICBhbGxvd2VkTWV0aG9kczogW2xhbWJkYS5IdHRwTWV0aG9kLkFMTF0sXG4gICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCBudXRyaXRpb25TZXJ2aWNlVXJsID0gbnV0cml0aW9uU2VydmljZUxhbWJkYS5hZGRGdW5jdGlvblVybCh7XG4gICAgICBhdXRoVHlwZTogbGFtYmRhLkZ1bmN0aW9uVXJsQXV0aFR5cGUuTk9ORSxcbiAgICAgIGNvcnM6IHtcbiAgICAgICAgYWxsb3dDcmVkZW50aWFsczogZmFsc2UsXG4gICAgICAgIGFsbG93ZWRIZWFkZXJzOiBbJyonXSxcbiAgICAgICAgYWxsb3dlZE1ldGhvZHM6IFtsYW1iZGEuSHR0cE1ldGhvZC5BTExdLFxuICAgICAgICBhbGxvd2VkT3JpZ2luczogWycqJ10sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgY29uc3QgYWlTZXJ2aWNlVXJsID0gYWlTZXJ2aWNlTGFtYmRhLmFkZEZ1bmN0aW9uVXJsKHtcbiAgICAgIGF1dGhUeXBlOiBsYW1iZGEuRnVuY3Rpb25VcmxBdXRoVHlwZS5OT05FLFxuICAgICAgY29yczoge1xuICAgICAgICBhbGxvd0NyZWRlbnRpYWxzOiBmYWxzZSxcbiAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxuICAgICAgICBhbGxvd2VkTWV0aG9kczogW2xhbWJkYS5IdHRwTWV0aG9kLkFMTF0sXG4gICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCBub3RpZmljYXRpb25TZXJ2aWNlVXJsID0gbm90aWZpY2F0aW9uU2VydmljZUxhbWJkYS5hZGRGdW5jdGlvblVybCh7XG4gICAgICBhdXRoVHlwZTogbGFtYmRhLkZ1bmN0aW9uVXJsQXV0aFR5cGUuTk9ORSxcbiAgICAgIGNvcnM6IHtcbiAgICAgICAgYWxsb3dDcmVkZW50aWFsczogZmFsc2UsXG4gICAgICAgIGFsbG93ZWRIZWFkZXJzOiBbJyonXSxcbiAgICAgICAgYWxsb3dlZE1ldGhvZHM6IFtsYW1iZGEuSHR0cE1ldGhvZC5BTExdLFxuICAgICAgICBhbGxvd2VkT3JpZ2luczogWycqJ10sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIENsb3VkRnJvbnQgRGlzdHJpYnV0aW9uIHdpdGggTGFtYmRhIEZ1bmN0aW9uIFVSTHMgYXMgb3JpZ2luc1xuICAgIGNvbnN0IHVzZXJQcm9maWxlRG9tYWluID0gY2RrLkZuLnNlbGVjdChcbiAgICAgIDIsXG4gICAgICBjZGsuRm4uc3BsaXQoJy8nLCB1c2VyUHJvZmlsZVNlcnZpY2VVcmwudXJsKVxuICAgICk7XG4gICAgY29uc3Qgd29ya291dERvbWFpbiA9IGNkay5Gbi5zZWxlY3QoXG4gICAgICAyLFxuICAgICAgY2RrLkZuLnNwbGl0KCcvJywgd29ya291dFNlcnZpY2VVcmwudXJsKVxuICAgICk7XG4gICAgY29uc3QgY29hY2hpbmdEb21haW4gPSBjZGsuRm4uc2VsZWN0KFxuICAgICAgMixcbiAgICAgIGNkay5Gbi5zcGxpdCgnLycsIGNvYWNoaW5nU2VydmljZVVybC51cmwpXG4gICAgKTtcbiAgICBjb25zdCBhbmFseXRpY3NEb21haW4gPSBjZGsuRm4uc2VsZWN0KFxuICAgICAgMixcbiAgICAgIGNkay5Gbi5zcGxpdCgnLycsIGFuYWx5dGljc1NlcnZpY2VVcmwudXJsKVxuICAgICk7XG4gICAgY29uc3QgbnV0cml0aW9uRG9tYWluID0gY2RrLkZuLnNlbGVjdChcbiAgICAgIDIsXG4gICAgICBjZGsuRm4uc3BsaXQoJy8nLCBudXRyaXRpb25TZXJ2aWNlVXJsLnVybClcbiAgICApO1xuICAgIGNvbnN0IGFpRG9tYWluID0gY2RrLkZuLnNlbGVjdCgyLCBjZGsuRm4uc3BsaXQoJy8nLCBhaVNlcnZpY2VVcmwudXJsKSk7XG4gICAgY29uc3Qgbm90aWZpY2F0aW9uRG9tYWluID0gY2RrLkZuLnNlbGVjdChcbiAgICAgIDIsXG4gICAgICBjZGsuRm4uc3BsaXQoJy8nLCBub3RpZmljYXRpb25TZXJ2aWNlVXJsLnVybClcbiAgICApO1xuXG4gICAgLy8gV0FGIFdlYiBBQ0wgLSBDT01NRU5URUQgT1VUIChyZXF1aXJlcyB1cy1lYXN0LTEgcmVnaW9uIGZvciBDbG91ZEZyb250KVxuICAgIC8vIFRPRE86IENyZWF0ZSBXQUYgaW4gdXMtZWFzdC0xIHJlZ2lvbiBzZXBhcmF0ZWx5IG9yIHVzZSBjcm9zcy1yZWdpb24gYXBwcm9hY2hcbiAgICAvLyBjb25zdCB3YWZXZWJBY2wgPSBuZXcgd2FmdjIuQ2ZuV2ViQUNMKHRoaXMsICdHeW1Db2FjaEFJV0FGJywge1xuICAgIC8vICAgbmFtZTogJ2d5bWNvYWNoLWFpLXdhZi1iYXNpYycsXG4gICAgLy8gICBkZXNjcmlwdGlvbjogJ0Jhc2ljIFdBRiBmb3IgR3ltQ29hY2ggQUkgLSBFc3NlbnRpYWwgcHJvdGVjdGlvbiBvbmx5IChjb3N0LW9wdGltaXplZCknLFxuICAgIC8vICAgc2NvcGU6ICdDTE9VREZST05UJyxcbiAgICAvLyAgIGRlZmF1bHRBY3Rpb246IHsgYWxsb3c6IHt9IH0sXG4gICAgLy8gICBydWxlczogW1xuICAgIC8vICAgICAvLyBCYXNpYyByYXRlIGxpbWl0aW5nIHJ1bGUgLSBFU1NFTlRJQUwgKGtlZXBzIGNvc3RzIGxvdylcbiAgICAvLyAgICAge1xuICAgIC8vICAgICAgIG5hbWU6ICdCYXNpY1JhdGVMaW1pdFJ1bGUnLFxuICAgIC8vICAgICAgIHByaW9yaXR5OiAxLFxuICAgIC8vICAgICAgIGFjdGlvbjogeyBibG9jazoge30gfSxcbiAgICAvLyAgICAgICBzdGF0ZW1lbnQ6IHtcbiAgICAvLyAgICAgICAgIHJhdGVCYXNlZFN0YXRlbWVudDoge1xuICAgIC8vICAgICAgICAgICBsaW1pdDogNTAwMCwgLy8gNTAwMCByZXF1ZXN0cyBwZXIgNSBtaW51dGVzXG4gICAgLy8gICAgICAgICAgIGFnZ3JlZ2F0ZUtleVR5cGU6ICdJUCcsXG4gICAgLy8gICAgICAgICB9LFxuICAgIC8vICAgICAgIH0sXG4gICAgLy8gICAgICAgdmlzaWJpbGl0eUNvbmZpZzoge1xuICAgIC8vICAgICAgICAgc2FtcGxlZFJlcXVlc3RzRW5hYmxlZDogZmFsc2UsXG4gICAgLy8gICAgICAgICBjbG91ZFdhdGNoTWV0cmljc0VuYWJsZWQ6IGZhbHNlLFxuICAgIC8vICAgICAgICAgbWV0cmljTmFtZTogJ0Jhc2ljUmF0ZUxpbWl0TWV0cmljJyxcbiAgICAvLyAgICAgICB9LFxuICAgIC8vICAgICB9LFxuICAgIC8vICAgXSxcbiAgICAvLyAgIHZpc2liaWxpdHlDb25maWc6IHtcbiAgICAvLyAgICAgc2FtcGxlZFJlcXVlc3RzRW5hYmxlZDogZmFsc2UsXG4gICAgLy8gICAgIGNsb3VkV2F0Y2hNZXRyaWNzRW5hYmxlZDogZmFsc2UsXG4gICAgLy8gICAgIG1ldHJpY05hbWU6ICdHeW1Db2FjaEFJV0FGQmFzaWNNZXRyaWMnLFxuICAgIC8vICAgfSxcbiAgICAvLyB9KTtcblxuICAgIC8vIENyZWF0ZSBDbG91ZEZyb250IEZ1bmN0aW9uIGZvciBVUkwgcmV3cml0aW5nIChoYW5kbGVzIFNQQSByb3V0aW5nKVxuICAgIGNvbnN0IHVybFJld3JpdGVGdW5jdGlvbiA9IG5ldyBjbG91ZGZyb250LkZ1bmN0aW9uKFxuICAgICAgdGhpcyxcbiAgICAgICdVcmxSZXdyaXRlRnVuY3Rpb24nLFxuICAgICAge1xuICAgICAgICBmdW5jdGlvbk5hbWU6ICd1cmwtcmV3cml0ZS1mdW5jdGlvbicsXG4gICAgICAgIGNvZGU6IGNsb3VkZnJvbnQuRnVuY3Rpb25Db2RlLmZyb21JbmxpbmUoYFxuICAgICAgICBmdW5jdGlvbiBoYW5kbGVyKGV2ZW50KSB7XG4gICAgICAgICAgdmFyIHJlcXVlc3QgPSBldmVudC5yZXF1ZXN0O1xuICAgICAgICAgIHZhciB1cmkgPSByZXF1ZXN0LnVyaTtcbiAgICAgICAgICBcbiAgICAgICAgICAvLyBIYW5kbGUgcm9vdCBwYXRoIC0gcmVkaXJlY3QgdG8gL2VuIChkZWZhdWx0IGxvY2FsZSlcbiAgICAgICAgICBpZiAodXJpID09PSAnLycgfHwgdXJpID09PSAnJykge1xuICAgICAgICAgICAgLy8gQ2hlY2sgZm9yIHByZWZlcnJlZCBsb2NhbGUgaW4gY29va2llXG4gICAgICAgICAgICB2YXIgY29va2llcyA9IHJlcXVlc3QuY29va2llcztcbiAgICAgICAgICAgIHZhciBwcmVmZXJyZWRMb2NhbGUgPSAnZW4nOyAvLyBkZWZhdWx0XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIChjb29raWVzLnByZWZlcnJlZExvY2FsZSAmJiBjb29raWVzLnByZWZlcnJlZExvY2FsZS52YWx1ZSkge1xuICAgICAgICAgICAgICB2YXIgbG9jYWxlID0gY29va2llcy5wcmVmZXJyZWRMb2NhbGUudmFsdWU7XG4gICAgICAgICAgICAgIHZhciBzdXBwb3J0ZWRMb2NhbGVzID0gWydlbicsICdhcicsICdzdiddO1xuICAgICAgICAgICAgICBpZiAoc3VwcG9ydGVkTG9jYWxlcy5pbmRleE9mKGxvY2FsZSkgIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgcHJlZmVycmVkTG9jYWxlID0gbG9jYWxlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFJlZGlyZWN0IHRvIHRoZSBwcmVmZXJyZWQgbG9jYWxlXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBzdGF0dXNDb2RlOiAzMDIsXG4gICAgICAgICAgICAgIHN0YXR1c0Rlc2NyaXB0aW9uOiAnRm91bmQnLFxuICAgICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgbG9jYXRpb246IHsgdmFsdWU6ICcvJyArIHByZWZlcnJlZExvY2FsZSB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIC8vIElmIFVSSSBoYXMgYSBmaWxlIGV4dGVuc2lvbiwgcmV0dXJuIGFzLWlzXG4gICAgICAgICAgaWYgKC9cXFxcLlthLXpBLVowLTldKyQvLnRlc3QodXJpKSkge1xuICAgICAgICAgICAgcmV0dXJuIHJlcXVlc3Q7XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIC8vIEhhbmRsZSBsb2NhbGUgcm91dGVzIChlLmcuLCAvZW4sIC9hciwgL3N2KVxuICAgICAgICAgIHZhciBzdXBwb3J0ZWRMb2NhbGVzID0gWydlbicsICdhcicsICdzdiddO1xuICAgICAgICAgIHZhciBwYXRoU2VnbWVudHMgPSB1cmkuc3BsaXQoJy8nKS5maWx0ZXIoZnVuY3Rpb24oc2VnbWVudCkgeyByZXR1cm4gc2VnbWVudC5sZW5ndGggPiAwOyB9KTtcbiAgICAgICAgICBcbiAgICAgICAgICAvLyBJZiB0aGUgZmlyc3Qgc2VnbWVudCBpcyBhIHN1cHBvcnRlZCBsb2NhbGVcbiAgICAgICAgICBpZiAocGF0aFNlZ21lbnRzLmxlbmd0aCA+IDAgJiYgc3VwcG9ydGVkTG9jYWxlcy5pbmRleE9mKHBhdGhTZWdtZW50c1swXSkgIT09IC0xKSB7XG4gICAgICAgICAgICAvLyBGb3IgbG9jYWxlIHJvdXRlcywgc2VydmUgdGhlIHNwZWNpZmljIHJvdXRlJ3MgaW5kZXguaHRtbFxuICAgICAgICAgICAgaWYgKHBhdGhTZWdtZW50cy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgICAgLy8gUm9vdCBsb2NhbGUgcm91dGUgKGUuZy4sIC9lbilcbiAgICAgICAgICAgICAgcmVxdWVzdC51cmkgPSAnLycgKyBwYXRoU2VnbWVudHNbMF0gKyAnL2luZGV4Lmh0bWwnO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gTmVzdGVkIGxvY2FsZSByb3V0ZSAoZS5nLiwgL2VuL3Byb2ZpbGUpXG4gICAgICAgICAgICAgIHJlcXVlc3QudXJpID0gdXJpICsgJy9pbmRleC5odG1sJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiByZXF1ZXN0O1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICAvLyBJZiBVUkkgZW5kcyB3aXRoIC8sIGFwcGVuZCBpbmRleC5odG1sXG4gICAgICAgICAgaWYgKHVyaS5lbmRzV2l0aCgnLycpKSB7XG4gICAgICAgICAgICByZXF1ZXN0LnVyaSArPSAnaW5kZXguaHRtbCc7XG4gICAgICAgICAgICByZXR1cm4gcmVxdWVzdDtcbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgLy8gRm9yIHBhdGhzIHdpdGhvdXQgZXh0ZW5zaW9uIGFuZCB3aXRob3V0IHRyYWlsaW5nIHNsYXNoLFxuICAgICAgICAgIC8vIGNoZWNrIGlmIGl0J3MgbGlrZWx5IGEgcm91dGUgKG5vdCBhIGZpbGUpXG4gICAgICAgICAgaWYgKCF1cmkuaW5jbHVkZXMoJy4nKSkge1xuICAgICAgICAgICAgLy8gRm9yIHN0YXRpYyBleHBvcnQsIGFsd2F5cyBzZXJ2ZSB0aGUgc3BlY2lmaWMgcm91dGUncyBpbmRleC5odG1sXG4gICAgICAgICAgICByZXF1ZXN0LnVyaSA9IHVyaSArICcvaW5kZXguaHRtbCc7XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIHJldHVybiByZXF1ZXN0O1xuICAgICAgICB9XG4gICAgICBgKSxcbiAgICAgICAgY29tbWVudDpcbiAgICAgICAgICAnVVJMIHJld3JpdGUgZnVuY3Rpb24gZm9yIFNQQSByb3V0aW5nIHdpdGggaTE4biBzdXBwb3J0IC0gc2VydmVzIGluZGV4Lmh0bWwgZm9yIGFsbCByb3V0ZXMgaW5jbHVkaW5nIGxvY2FsZSByb3V0ZXMgYW5kIGhhbmRsZXMgbG9jYWxlIHJlZGlyZWN0aW9uIGZyb20gcm9vdCcsXG4gICAgICB9XG4gICAgKTtcblxuICAgIHRoaXMuZGlzdHJpYnV0aW9uID0gbmV3IGNsb3VkZnJvbnQuRGlzdHJpYnV0aW9uKFxuICAgICAgdGhpcyxcbiAgICAgICdHeW1Db2FjaEFJRGlzdHJpYnV0aW9uJyxcbiAgICAgIHtcbiAgICAgICAgZGVmYXVsdFJvb3RPYmplY3Q6ICdpbmRleC5odG1sJyxcbiAgICAgICAgLy8gd2ViQWNsSWQ6IHdhZldlYkFjbC5hdHRyQXJuLCAvLyBDb21tZW50ZWQgb3V0IC0gV0FGIHJlcXVpcmVzIHVzLWVhc3QtMSByZWdpb25cbiAgICAgICAgZGVmYXVsdEJlaGF2aW9yOiB7XG4gICAgICAgICAgb3JpZ2luOiBvcmlnaW5zLlMzQnVja2V0T3JpZ2luLndpdGhPcmlnaW5BY2Nlc3NJZGVudGl0eShcbiAgICAgICAgICAgIHRoaXMuZnJvbnRlbmRCdWNrZXQsXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIG9yaWdpbkFjY2Vzc0lkZW50aXR5OiBmcm9udGVuZE9BSSxcbiAgICAgICAgICAgIH1cbiAgICAgICAgICApLFxuICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OlxuICAgICAgICAgICAgY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgICBhbGxvd2VkTWV0aG9kczogY2xvdWRmcm9udC5BbGxvd2VkTWV0aG9kcy5BTExPV19HRVRfSEVBRF9PUFRJT05TLFxuICAgICAgICAgIGNhY2hlUG9saWN5OiBuZXcgY2xvdWRmcm9udC5DYWNoZVBvbGljeSh0aGlzLCAnRnJvbnRlbmRDYWNoZVBvbGljeScsIHtcbiAgICAgICAgICAgIGNhY2hlUG9saWN5TmFtZTogJ2Zyb250ZW5kLWNhY2hlLXBvbGljeScsXG4gICAgICAgICAgICBkZWZhdWx0VHRsOiBjZGsuRHVyYXRpb24uaG91cnMoMjQpLFxuICAgICAgICAgICAgbWF4VHRsOiBjZGsuRHVyYXRpb24uZGF5cygzNjUpLFxuICAgICAgICAgICAgbWluVHRsOiBjZGsuRHVyYXRpb24uc2Vjb25kcygwKSxcbiAgICAgICAgICAgIGhlYWRlckJlaGF2aW9yOiBjbG91ZGZyb250LkNhY2hlSGVhZGVyQmVoYXZpb3IuYWxsb3dMaXN0KFxuICAgICAgICAgICAgICAnQ2xvdWRGcm9udC1WaWV3ZXItQ291bnRyeSdcbiAgICAgICAgICAgICksXG4gICAgICAgICAgICBxdWVyeVN0cmluZ0JlaGF2aW9yOiBjbG91ZGZyb250LkNhY2hlUXVlcnlTdHJpbmdCZWhhdmlvci5hbGwoKSxcbiAgICAgICAgICAgIGNvb2tpZUJlaGF2aW9yOiBjbG91ZGZyb250LkNhY2hlQ29va2llQmVoYXZpb3Iubm9uZSgpLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIGZ1bmN0aW9uQXNzb2NpYXRpb25zOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGZ1bmN0aW9uOiB1cmxSZXdyaXRlRnVuY3Rpb24sXG4gICAgICAgICAgICAgIGV2ZW50VHlwZTogY2xvdWRmcm9udC5GdW5jdGlvbkV2ZW50VHlwZS5WSUVXRVJfUkVRVUVTVCxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgICAgYWRkaXRpb25hbEJlaGF2aW9yczoge1xuICAgICAgICAgIC8vICcvYXBpL3VzZXJzLyonOiB7XG4gICAgICAgICAgLy8gICBvcmlnaW46IG5ldyBvcmlnaW5zLkh0dHBPcmlnaW4odXNlclNlcnZpY2VVcmwudXJsKSxcbiAgICAgICAgICAvLyAgIHZpZXdlclByb3RvY29sUG9saWN5OlxuICAgICAgICAgIC8vICAgICBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgIC8vICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfQUxMLFxuICAgICAgICAgIC8vICAgY2FjaGVQb2xpY3k6IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3kuQ0FDSElOR19ESVNBQkxFRCxcbiAgICAgICAgICAvLyAgIG9yaWdpblJlcXVlc3RQb2xpY3k6XG4gICAgICAgICAgLy8gICAgIGNsb3VkZnJvbnQuT3JpZ2luUmVxdWVzdFBvbGljeS5BTExfVklFV0VSX0VYQ0VQVF9IT1NUX0hFQURFUixcbiAgICAgICAgICAvLyB9LFxuICAgICAgICAgICcvYXBpL3VzZXItcHJvZmlsZXMvKic6IHtcbiAgICAgICAgICAgIG9yaWdpbjogbmV3IG9yaWdpbnMuSHR0cE9yaWdpbih1c2VyUHJvZmlsZURvbWFpbiksXG4gICAgICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTpcbiAgICAgICAgICAgICAgY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0FMTCxcbiAgICAgICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfRElTQUJMRUQsXG4gICAgICAgICAgICBvcmlnaW5SZXF1ZXN0UG9saWN5OlxuICAgICAgICAgICAgICBjbG91ZGZyb250Lk9yaWdpblJlcXVlc3RQb2xpY3kuQUxMX1ZJRVdFUl9FWENFUFRfSE9TVF9IRUFERVIsXG4gICAgICAgICAgfSxcbiAgICAgICAgICAnL2FwaS93b3Jrb3V0cy8qJzoge1xuICAgICAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5IdHRwT3JpZ2luKHdvcmtvdXREb21haW4pLFxuICAgICAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6XG4gICAgICAgICAgICAgIGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgICAgICBhbGxvd2VkTWV0aG9kczogY2xvdWRmcm9udC5BbGxvd2VkTWV0aG9kcy5BTExPV19BTEwsXG4gICAgICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX0RJU0FCTEVELFxuICAgICAgICAgICAgb3JpZ2luUmVxdWVzdFBvbGljeTpcbiAgICAgICAgICAgICAgY2xvdWRmcm9udC5PcmlnaW5SZXF1ZXN0UG9saWN5LkFMTF9WSUVXRVJfRVhDRVBUX0hPU1RfSEVBREVSLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgJy9hcGkvY29hY2hpbmcvKic6IHtcbiAgICAgICAgICAgIG9yaWdpbjogbmV3IG9yaWdpbnMuSHR0cE9yaWdpbihjb2FjaGluZ0RvbWFpbiksXG4gICAgICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTpcbiAgICAgICAgICAgICAgY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0FMTCxcbiAgICAgICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfRElTQUJMRUQsXG4gICAgICAgICAgICBvcmlnaW5SZXF1ZXN0UG9saWN5OlxuICAgICAgICAgICAgICBjbG91ZGZyb250Lk9yaWdpblJlcXVlc3RQb2xpY3kuQUxMX1ZJRVdFUl9FWENFUFRfSE9TVF9IRUFERVIsXG4gICAgICAgICAgfSxcbiAgICAgICAgICAnL2FwaS9hbmFseXRpY3MvKic6IHtcbiAgICAgICAgICAgIG9yaWdpbjogbmV3IG9yaWdpbnMuSHR0cE9yaWdpbihhbmFseXRpY3NEb21haW4pLFxuICAgICAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6XG4gICAgICAgICAgICAgIGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgICAgICBhbGxvd2VkTWV0aG9kczogY2xvdWRmcm9udC5BbGxvd2VkTWV0aG9kcy5BTExPV19BTEwsXG4gICAgICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX0RJU0FCTEVELFxuICAgICAgICAgICAgb3JpZ2luUmVxdWVzdFBvbGljeTpcbiAgICAgICAgICAgICAgY2xvdWRmcm9udC5PcmlnaW5SZXF1ZXN0UG9saWN5LkFMTF9WSUVXRVJfRVhDRVBUX0hPU1RfSEVBREVSLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgJy9hcGkvbnV0cml0aW9uLyonOiB7XG4gICAgICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLkh0dHBPcmlnaW4obnV0cml0aW9uRG9tYWluKSxcbiAgICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OlxuICAgICAgICAgICAgICBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfQUxMLFxuICAgICAgICAgICAgY2FjaGVQb2xpY3k6IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3kuQ0FDSElOR19ESVNBQkxFRCxcbiAgICAgICAgICAgIG9yaWdpblJlcXVlc3RQb2xpY3k6XG4gICAgICAgICAgICAgIGNsb3VkZnJvbnQuT3JpZ2luUmVxdWVzdFBvbGljeS5BTExfVklFV0VSX0VYQ0VQVF9IT1NUX0hFQURFUixcbiAgICAgICAgICB9LFxuICAgICAgICAgICcvYXBpL2FpLyonOiB7XG4gICAgICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLkh0dHBPcmlnaW4oYWlEb21haW4sIHtcbiAgICAgICAgICAgICAgY29ubmVjdGlvblRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDEwKSxcbiAgICAgICAgICAgICAgY29ubmVjdGlvbkF0dGVtcHRzOiAzLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTpcbiAgICAgICAgICAgICAgY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0FMTCxcbiAgICAgICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfRElTQUJMRUQsXG4gICAgICAgICAgICBvcmlnaW5SZXF1ZXN0UG9saWN5OlxuICAgICAgICAgICAgICBjbG91ZGZyb250Lk9yaWdpblJlcXVlc3RQb2xpY3kuQUxMX1ZJRVdFUl9FWENFUFRfSE9TVF9IRUFERVIsXG4gICAgICAgICAgfSxcbiAgICAgICAgICAnL2FwaS9ub3RpZmljYXRpb25zLyonOiB7XG4gICAgICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLkh0dHBPcmlnaW4obm90aWZpY2F0aW9uRG9tYWluKSxcbiAgICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OlxuICAgICAgICAgICAgICBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfQUxMLFxuICAgICAgICAgICAgY2FjaGVQb2xpY3k6IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3kuQ0FDSElOR19ESVNBQkxFRCxcbiAgICAgICAgICAgIG9yaWdpblJlcXVlc3RQb2xpY3k6XG4gICAgICAgICAgICAgIGNsb3VkZnJvbnQuT3JpZ2luUmVxdWVzdFBvbGljeS5BTExfVklFV0VSX0VYQ0VQVF9IT1NUX0hFQURFUixcbiAgICAgICAgICB9LFxuICAgICAgICAgICcvcHJvZ3Jlc3MtcGhvdG9zLyonOiB7XG4gICAgICAgICAgICBvcmlnaW46IG9yaWdpbnMuUzNCdWNrZXRPcmlnaW4ud2l0aE9yaWdpbkFjY2Vzc0lkZW50aXR5KFxuICAgICAgICAgICAgICB0aGlzLnByb2dyZXNzUGhvdG9zQnVja2V0LFxuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgb3JpZ2luQWNjZXNzSWRlbnRpdHk6IHByb2dyZXNzUGhvdG9zT0FJLFxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICApLFxuICAgICAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6XG4gICAgICAgICAgICAgIGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgICAgICBhbGxvd2VkTWV0aG9kczogY2xvdWRmcm9udC5BbGxvd2VkTWV0aG9kcy5BTExPV19HRVRfSEVBRCxcbiAgICAgICAgICAgIGNhY2hlUG9saWN5OiBuZXcgY2xvdWRmcm9udC5DYWNoZVBvbGljeShcbiAgICAgICAgICAgICAgdGhpcyxcbiAgICAgICAgICAgICAgJ1Byb2dyZXNzUGhvdG9zQ2FjaGVQb2xpY3knLFxuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY2FjaGVQb2xpY3lOYW1lOiAncHJvZ3Jlc3MtcGhvdG9zLWNhY2hlLXBvbGljeScsXG4gICAgICAgICAgICAgICAgZGVmYXVsdFR0bDogY2RrLkR1cmF0aW9uLmhvdXJzKDI0KSxcbiAgICAgICAgICAgICAgICBtYXhUdGw6IGNkay5EdXJhdGlvbi5kYXlzKDM2NSksXG4gICAgICAgICAgICAgICAgbWluVHRsOiBjZGsuRHVyYXRpb24uc2Vjb25kcygwKSxcbiAgICAgICAgICAgICAgICBoZWFkZXJCZWhhdmlvcjogY2xvdWRmcm9udC5DYWNoZUhlYWRlckJlaGF2aW9yLmFsbG93TGlzdChcbiAgICAgICAgICAgICAgICAgICdDbG91ZEZyb250LVZpZXdlci1Db3VudHJ5J1xuICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICAgcXVlcnlTdHJpbmdCZWhhdmlvcjogY2xvdWRmcm9udC5DYWNoZVF1ZXJ5U3RyaW5nQmVoYXZpb3Iubm9uZSgpLFxuICAgICAgICAgICAgICAgIGNvb2tpZUJlaGF2aW9yOiBjbG91ZGZyb250LkNhY2hlQ29va2llQmVoYXZpb3Iubm9uZSgpLFxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICApLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIGNvbW1lbnQ6ICdHeW1Db2FjaCBBSSBDbG91ZEZyb250IERpc3RyaWJ1dGlvbicsXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIEFkZCBDbG91ZEZyb250IGRvbWFpbiB0byBhbmFseXRpY3Mgc2VydmljZSBlbnZpcm9ubWVudFxuICAgIC8vIFRoaXMgbXVzdCBiZSBkb25lIHZpYSBDREsgb3V0cHV0IGFuZCBtYW51YWwgdXBkYXRlIHRvIGF2b2lkIGNpcmN1bGFyIGRlcGVuZGVuY3lcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ2xvdWRGcm9udERvbWFpbkZvckFuYWx5dGljcycsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmRpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25Eb21haW5OYW1lLFxuICAgICAgZGVzY3JpcHRpb246XG4gICAgICAgICdDbG91ZEZyb250IGRvbWFpbiAtIHVzZSB0aGlzIHRvIHVwZGF0ZSBBbmFseXRpY3NTZXJ2aWNlIExhbWJkYSBDTE9VREZST05UX0RPTUFJTiBlbnYgdmFyJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdHeW1Db2FjaEFJLUNsb3VkRnJvbnREb21haW4nLFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgcGVybWlzc2lvbnMgdG8gTGFtYmRhIGZ1bmN0aW9ucyBmb3IgUzMgYWNjZXNzXG4gICAgdGhpcy51c2VyVXBsb2Fkc0J1Y2tldC5ncmFudFJlYWRXcml0ZSh1c2VyUHJvZmlsZVNlcnZpY2VMYW1iZGEpO1xuICAgIHRoaXMudXNlclVwbG9hZHNCdWNrZXQuZ3JhbnRSZWFkV3JpdGUod29ya291dFNlcnZpY2VMYW1iZGEpO1xuICAgIHRoaXMudXNlclVwbG9hZHNCdWNrZXQuZ3JhbnRSZWFkV3JpdGUoYW5hbHl0aWNzU2VydmljZUxhbWJkYSk7XG5cbiAgICB0aGlzLnByb2Nlc3NlZEltYWdlc0J1Y2tldC5ncmFudFJlYWRXcml0ZSh1c2VyUHJvZmlsZVNlcnZpY2VMYW1iZGEpO1xuICAgIHRoaXMucHJvY2Vzc2VkSW1hZ2VzQnVja2V0LmdyYW50UmVhZFdyaXRlKHdvcmtvdXRTZXJ2aWNlTGFtYmRhKTtcbiAgICB0aGlzLnByb2Nlc3NlZEltYWdlc0J1Y2tldC5ncmFudFJlYWRXcml0ZShhbmFseXRpY3NTZXJ2aWNlTGFtYmRhKTtcblxuICAgIC8vIEdyYW50IGFuYWx5dGljcyBzZXJ2aWNlIGZ1bGwgYWNjZXNzIHRvIHByb2dyZXNzIHBob3RvcyBidWNrZXRcbiAgICB0aGlzLnByb2dyZXNzUGhvdG9zQnVja2V0LmdyYW50UmVhZFdyaXRlKGFuYWx5dGljc1NlcnZpY2VMYW1iZGEpO1xuXG4gICAgLy8gR3JhbnQgQUkgc2VydmljZSBhY2Nlc3MgdG8gdmVjdG9ycyBidWNrZXRcbiAgICB0aGlzLnZlY3RvcnNCdWNrZXQuZ3JhbnRSZWFkV3JpdGUoYWlTZXJ2aWNlTGFtYmRhKTtcblxuICAgIC8vIEFsbG93IHNlcnZpY2UgdG8gcmVhZCBmcm9tIHRoZSBtYWluIER5bmFtb0RCIHRhYmxlXG4gICAgdGhpcy5tYWluVGFibGUuZ3JhbnRSZWFkRGF0YShhbmFseXRpY3NTZXJ2aWNlTGFtYmRhKTtcbiAgICB0aGlzLm1haW5UYWJsZS5ncmFudFJlYWREYXRhKG51dHJpdGlvblNlcnZpY2VMYW1iZGEpO1xuICAgIHRoaXMubWFpblRhYmxlLmdyYW50UmVhZERhdGEodXNlclByb2ZpbGVTZXJ2aWNlTGFtYmRhKTtcbiAgICB0aGlzLm1haW5UYWJsZS5ncmFudFJlYWREYXRhKHdvcmtvdXRTZXJ2aWNlTGFtYmRhKTtcbiAgICB0aGlzLm1haW5UYWJsZS5ncmFudFJlYWREYXRhKGNvYWNoaW5nU2VydmljZUxhbWJkYSk7XG4gICAgdGhpcy5tYWluVGFibGUuZ3JhbnRSZWFkRGF0YShhaVNlcnZpY2VMYW1iZGEpO1xuICAgIHRoaXMubWFpblRhYmxlLmdyYW50V3JpdGVEYXRhKGFuYWx5dGljc1NlcnZpY2VMYW1iZGEpO1xuICAgIHRoaXMubWFpblRhYmxlLmdyYW50V3JpdGVEYXRhKG51dHJpdGlvblNlcnZpY2VMYW1iZGEpO1xuICAgIHRoaXMubWFpblRhYmxlLmdyYW50V3JpdGVEYXRhKHVzZXJQcm9maWxlU2VydmljZUxhbWJkYSk7XG4gICAgdGhpcy5tYWluVGFibGUuZ3JhbnRXcml0ZURhdGEod29ya291dFNlcnZpY2VMYW1iZGEpO1xuICAgIHRoaXMubWFpblRhYmxlLmdyYW50V3JpdGVEYXRhKGNvYWNoaW5nU2VydmljZUxhbWJkYSk7XG4gICAgdGhpcy5tYWluVGFibGUuZ3JhbnRXcml0ZURhdGEoYWlTZXJ2aWNlTGFtYmRhKTtcblxuICAgIC8vIEVuc3VyZSBudXRyaXRpb24gc2VydmljZSBjYW4gUXVlcnkgR1NJcyBleHBsaWNpdGx5XG4gICAgbnV0cml0aW9uU2VydmljZUxhbWJkYS5hZGRUb1JvbGVQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogWydkeW5hbW9kYjpRdWVyeScsICdkeW5hbW9kYjpHZXRJdGVtJ10sXG4gICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgIHRoaXMubWFpblRhYmxlLnRhYmxlQXJuLFxuICAgICAgICAgIGAke3RoaXMubWFpblRhYmxlLnRhYmxlQXJufS9pbmRleC8qYCxcbiAgICAgICAgXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIEdyYW50IEFJIHNlcnZpY2UgQmVkcm9jayBwZXJtaXNzaW9uc1xuICAgIGFpU2VydmljZUxhbWJkYS5hZGRUb1JvbGVQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICdiZWRyb2NrOkludm9rZU1vZGVsJyxcbiAgICAgICAgICAnYmVkcm9jazpJbnZva2VNb2RlbFdpdGhSZXNwb25zZVN0cmVhbScsXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgICdhcm46YXdzOmJlZHJvY2s6Kjo6Zm91bmRhdGlvbi1tb2RlbC9kZWVwc2Vlay52My12MTowJyxcbiAgICAgICAgICAnYXJuOmF3czpiZWRyb2NrOio6OmZvdW5kYXRpb24tbW9kZWwvYW1hem9uLnRpdGFuLWVtYmVkLXRleHQtdjEnLFxuICAgICAgICAgICdhcm46YXdzOmJlZHJvY2s6Kjo6Zm91bmRhdGlvbi1tb2RlbC9hbWF6b24udGl0YW4tZW1iZWQtdGV4dC12MjowJyxcbiAgICAgICAgICAnYXJuOmF3czpiZWRyb2NrOio6OmZvdW5kYXRpb24tbW9kZWwvY29oZXJlLmVtYmVkLWVuZ2xpc2gtdjMnLFxuICAgICAgICBdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gR3JhbnQgQUkgc2VydmljZSBDb2duaXRvIHBlcm1pc3Npb25zXG4gICAgYWlTZXJ2aWNlTGFtYmRhLmFkZFRvUm9sZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgJ2NvZ25pdG8taWRwOkFkbWluTGlzdEdyb3Vwc0ZvclVzZXInLFxuICAgICAgICAgICdjb2duaXRvLWlkcDpBZG1pbkdldFVzZXInLFxuICAgICAgICAgICdjb2duaXRvLWlkcDpMaXN0VXNlcnMnLFxuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IFt0aGlzLnVzZXJQb29sLnVzZXJQb29sQXJuXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIEdyYW50IG5vdGlmaWNhdGlvbiBzZXJ2aWNlIHBlcm1pc3Npb25zXG4gICAgbm90aWZpY2F0aW9uU2VydmljZUxhbWJkYS5hZGRUb1JvbGVQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICdzbnM6UHVibGlzaCcsXG4gICAgICAgICAgJ3NuczpDcmVhdGVQbGF0Zm9ybUVuZHBvaW50JyxcbiAgICAgICAgICAnc25zOkRlbGV0ZUVuZHBvaW50JyxcbiAgICAgICAgICAnc25zOkdldEVuZHBvaW50QXR0cmlidXRlcycsXG4gICAgICAgICAgJ3NuczpTZXRFbmRwb2ludEF0dHJpYnV0ZXMnLFxuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICB3b3Jrb3V0UmVtaW5kZXJzVG9waWMudG9waWNBcm4sXG4gICAgICAgICAgbnV0cml0aW9uUmVtaW5kZXJzVG9waWMudG9waWNBcm4sXG4gICAgICAgICAgYWNoaWV2ZW1lbnRUb3BpYy50b3BpY0FybixcbiAgICAgICAgICBhaVN1Z2dlc3Rpb25zVG9waWMudG9waWNBcm4sXG4gICAgICAgICAgJyonLCAvLyBBbGxvdyBhY2Nlc3MgdG8gYWxsIFNOUyBwbGF0Zm9ybSBhcHBsaWNhdGlvbnNcbiAgICAgICAgXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIEdyYW50IG5vdGlmaWNhdGlvbiBzY2hlZHVsZXIgcGVybWlzc2lvbnNcbiAgICBub3RpZmljYXRpb25TY2hlZHVsZXJMYW1iZGEuYWRkVG9Sb2xlUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFsnbGFtYmRhOkludm9rZUZ1bmN0aW9uJ10sXG4gICAgICAgIHJlc291cmNlczogW25vdGlmaWNhdGlvblNlcnZpY2VMYW1iZGEuZnVuY3Rpb25Bcm5dLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gQWRkIEV2ZW50QnJpZGdlIHRhcmdldHNcbiAgICB3b3Jrb3V0UmVtaW5kZXJSdWxlLmFkZFRhcmdldChcbiAgICAgIG5ldyB0YXJnZXRzLkxhbWJkYUZ1bmN0aW9uKG5vdGlmaWNhdGlvblNjaGVkdWxlckxhbWJkYSlcbiAgICApO1xuICAgIG51dHJpdGlvblJlbWluZGVyUnVsZS5hZGRUYXJnZXQoXG4gICAgICBuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbihub3RpZmljYXRpb25TY2hlZHVsZXJMYW1iZGEpXG4gICAgKTtcbiAgICB3YXRlclJlbWluZGVyUnVsZS5hZGRUYXJnZXQoXG4gICAgICBuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbihub3RpZmljYXRpb25TY2hlZHVsZXJMYW1iZGEpXG4gICAgKTtcbiAgICBwcm9ncmVzc1Bob3RvUnVsZS5hZGRUYXJnZXQoXG4gICAgICBuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbihub3RpZmljYXRpb25TY2hlZHVsZXJMYW1iZGEpXG4gICAgKTtcblxuICAgIC8vIFByb2FjdGl2ZSBDb2FjaGluZyBFdmVudEJyaWRnZSB0YXJnZXRzXG4gICAgcHJvYWN0aXZlQ2hlY2tJblJ1bGUuYWRkVGFyZ2V0KFxuICAgICAgbmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24oYWlTZXJ2aWNlTGFtYmRhLCB7XG4gICAgICAgIGV2ZW50OiBldmVudHMuUnVsZVRhcmdldElucHV0LmZyb21PYmplY3Qoe1xuICAgICAgICAgIHNvdXJjZTogJ3Byb2FjdGl2ZS1jaGVja2luJyxcbiAgICAgICAgICBhY3Rpb246ICdjaGVja2luJyxcbiAgICAgICAgICB0aW1lc3RhbXA6IGV2ZW50cy5FdmVudEZpZWxkLmZyb21QYXRoKCckLnRpbWUnKSxcbiAgICAgICAgfSksXG4gICAgICB9KVxuICAgICk7XG5cbiAgICBwcm9ncmVzc01vbml0b3JSdWxlLmFkZFRhcmdldChcbiAgICAgIG5ldyB0YXJnZXRzLkxhbWJkYUZ1bmN0aW9uKGFpU2VydmljZUxhbWJkYSwge1xuICAgICAgICBldmVudDogZXZlbnRzLlJ1bGVUYXJnZXRJbnB1dC5mcm9tT2JqZWN0KHtcbiAgICAgICAgICBzb3VyY2U6ICdwcm9ncmVzcy1tb25pdG9yJyxcbiAgICAgICAgICBhY3Rpb246ICdtb25pdG9yJyxcbiAgICAgICAgICB0aW1lc3RhbXA6IGV2ZW50cy5FdmVudEZpZWxkLmZyb21QYXRoKCckLnRpbWUnKSxcbiAgICAgICAgfSksXG4gICAgICB9KVxuICAgICk7XG5cbiAgICBwbGF0ZWF1RGV0ZWN0aW9uUnVsZS5hZGRUYXJnZXQoXG4gICAgICBuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbihhaVNlcnZpY2VMYW1iZGEsIHtcbiAgICAgICAgZXZlbnQ6IGV2ZW50cy5SdWxlVGFyZ2V0SW5wdXQuZnJvbU9iamVjdCh7XG4gICAgICAgICAgc291cmNlOiAncGxhdGVhdS1kZXRlY3Rpb24nLFxuICAgICAgICAgIGFjdGlvbjogJ2RldGVjdC1wbGF0ZWF1cycsXG4gICAgICAgICAgdGltZXN0YW1wOiBldmVudHMuRXZlbnRGaWVsZC5mcm9tUGF0aCgnJC50aW1lJyksXG4gICAgICAgIH0pLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgbW90aXZhdGlvbkJvb3N0UnVsZS5hZGRUYXJnZXQoXG4gICAgICBuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbihhaVNlcnZpY2VMYW1iZGEsIHtcbiAgICAgICAgZXZlbnQ6IGV2ZW50cy5SdWxlVGFyZ2V0SW5wdXQuZnJvbU9iamVjdCh7XG4gICAgICAgICAgc291cmNlOiAnbW90aXZhdGlvbi1ib29zdCcsXG4gICAgICAgICAgYWN0aW9uOiAnbW90aXZhdGUnLFxuICAgICAgICAgIHRpbWVzdGFtcDogZXZlbnRzLkV2ZW50RmllbGQuZnJvbVBhdGgoJyQudGltZScpLFxuICAgICAgICB9KSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIHdlZWtseVJldmlld1J1bGUuYWRkVGFyZ2V0KFxuICAgICAgbmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24oYWlTZXJ2aWNlTGFtYmRhLCB7XG4gICAgICAgIGV2ZW50OiBldmVudHMuUnVsZVRhcmdldElucHV0LmZyb21PYmplY3Qoe1xuICAgICAgICAgIHNvdXJjZTogJ3dlZWtseS1yZXZpZXcnLFxuICAgICAgICAgIGFjdGlvbjogJ3JldmlldycsXG4gICAgICAgICAgdGltZXN0YW1wOiBldmVudHMuRXZlbnRGaWVsZC5mcm9tUGF0aCgnJC50aW1lJyksXG4gICAgICAgIH0pLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gUmVtb3ZlZCBDbG91ZFdhdGNoIExvZyBHcm91cHMgdG8gYXZvaWQgY29zdHNcbiAgICAvLyBMYW1iZGEgZnVuY3Rpb25zIHdpbGwgdXNlIGRlZmF1bHQgbG9nIGdyb3VwcyAoZnJlZSB0aWVyOiA1R0IvbW9udGgpXG5cbiAgICAvLyBPdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1VzZXJQb29sSWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgZGVzY3JpcHRpb246ICdDb2duaXRvIFVzZXIgUG9vbCBJRCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclBvb2xDbGllbnRJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvZ25pdG8gVXNlciBQb29sIENsaWVudCBJRCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclBvb2xEb21haW4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy51c2VyUG9vbERvbWFpbi5kb21haW5OYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdDb2duaXRvIFVzZXIgUG9vbCBEb21haW4nLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Nsb3VkRnJvbnRVcmwnLCB7XG4gICAgICB2YWx1ZTogYGh0dHBzOi8vJHt0aGlzLmRpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25Eb21haW5OYW1lfWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ0Nsb3VkRnJvbnQgRGlzdHJpYnV0aW9uIFVSTCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVGFibGVOYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMubWFpblRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRHluYW1vREIgVGFibGUgTmFtZScsXG4gICAgfSk7XG5cbiAgICAvLyBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclNlcnZpY2VVcmwnLCB7XG4gICAgLy8gICB2YWx1ZTogdXNlclNlcnZpY2VVcmwudXJsLFxuICAgIC8vICAgZGVzY3JpcHRpb246ICdVc2VyIFNlcnZpY2UgTGFtYmRhIEZ1bmN0aW9uIFVSTCcsXG4gICAgLy8gfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclByb2ZpbGVTZXJ2aWNlVXJsJywge1xuICAgICAgdmFsdWU6IHVzZXJQcm9maWxlU2VydmljZVVybC51cmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ1VzZXIgUHJvZmlsZSBTZXJ2aWNlIExhbWJkYSBGdW5jdGlvbiBVUkwnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1dvcmtvdXRTZXJ2aWNlVXJsJywge1xuICAgICAgdmFsdWU6IHdvcmtvdXRTZXJ2aWNlVXJsLnVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnV29ya291dCBTZXJ2aWNlIExhbWJkYSBGdW5jdGlvbiBVUkwnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0NvYWNoaW5nU2VydmljZVVybCcsIHtcbiAgICAgIHZhbHVlOiBjb2FjaGluZ1NlcnZpY2VVcmwudXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdDb2FjaGluZyBTZXJ2aWNlIExhbWJkYSBGdW5jdGlvbiBVUkwnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FuYWx5dGljc1NlcnZpY2VVcmwnLCB7XG4gICAgICB2YWx1ZTogYW5hbHl0aWNzU2VydmljZVVybC51cmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FuYWx5dGljcyBTZXJ2aWNlIExhbWJkYSBGdW5jdGlvbiBVUkwnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ051dHJpdGlvblNlcnZpY2VVcmwnLCB7XG4gICAgICB2YWx1ZTogbnV0cml0aW9uU2VydmljZVVybC51cmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ051dHJpdGlvbiBTZXJ2aWNlIExhbWJkYSBGdW5jdGlvbiBVUkwnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FJU2VydmljZVVybCcsIHtcbiAgICAgIHZhbHVlOiBhaVNlcnZpY2VVcmwudXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdBSSBTZXJ2aWNlIExhbWJkYSBGdW5jdGlvbiBVUkwnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ05vdGlmaWNhdGlvblNlcnZpY2VVcmwnLCB7XG4gICAgICB2YWx1ZTogbm90aWZpY2F0aW9uU2VydmljZVVybC51cmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ05vdGlmaWNhdGlvbiBTZXJ2aWNlIExhbWJkYSBGdW5jdGlvbiBVUkwnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1VzZXJVcGxvYWRzQnVja2V0TmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnVzZXJVcGxvYWRzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1VzZXIgVXBsb2FkcyBTMyBCdWNrZXQgTmFtZScsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnU3RhdGljQXNzZXRzQnVja2V0TmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnN0YXRpY0Fzc2V0c0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdTdGF0aWMgQXNzZXRzIFMzIEJ1Y2tldCBOYW1lJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdQcm9jZXNzZWRJbWFnZXNCdWNrZXROYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMucHJvY2Vzc2VkSW1hZ2VzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1Byb2Nlc3NlZCBJbWFnZXMgUzMgQnVja2V0IE5hbWUnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Zyb250ZW5kQnVja2V0TmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmZyb250ZW5kQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0Zyb250ZW5kIFMzIEJ1Y2tldCBOYW1lJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdWZWN0b3JzQnVja2V0TmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnZlY3RvcnNCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUzMgVmVjdG9ycyBCdWNrZXQgTmFtZSBmb3IgQUkgS25vd2xlZGdlIEJhc2UnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Nsb3VkRnJvbnREaXN0cmlidXRpb25VUkwnLCB7XG4gICAgICB2YWx1ZTogYGh0dHBzOi8vJHt0aGlzLmRpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25Eb21haW5OYW1lfWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ0Nsb3VkRnJvbnQgRGlzdHJpYnV0aW9uIFVSTCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUG9zdERlcGxveW1lbnRJbnN0cnVjdGlvbnMnLCB7XG4gICAgICB2YWx1ZTpcbiAgICAgICAgJ0FmdGVyIGRlcGxveW1lbnQsIHNldCBDTE9VREZST05UX0RPTUFJTiBlbnZpcm9ubWVudCB2YXJpYWJsZSBpbiBBbmFseXRpY3NTZXJ2aWNlIExhbWJkYSBmdW5jdGlvbicsXG4gICAgICBkZXNjcmlwdGlvbjogJ01hbnVhbCBzdGVwIHJlcXVpcmVkIGFmdGVyIGRlcGxveW1lbnQnLFxuICAgIH0pO1xuXG4gICAgLy8gbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1dBRldlYkFDTEFybicsIHtcbiAgICAvLyAgIHZhbHVlOiB3YWZXZWJBY2wuYXR0ckFybixcbiAgICAvLyAgIGRlc2NyaXB0aW9uOiAnV0FGIFdlYiBBQ0wgQVJOIGZvciBDbG91ZEZyb250IHByb3RlY3Rpb24nLFxuICAgIC8vIH0pO1xuXG4gICAgLy8gUmVtb3ZlZCBtb25pdG9yaW5nIHN0YWNrIHRvIGF2b2lkIENsb3VkV2F0Y2ggY29zdHNcbiAgICAvLyB0aGlzLmNyZWF0ZU1vbml0b3JpbmdTdGFjaygpO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVMYW1iZGFGdW5jdGlvbihcbiAgICBuYW1lOiBzdHJpbmcsXG4gICAgc2VydmljZU5hbWU6IHN0cmluZyxcbiAgICBhZGRpdGlvbmFsRW52VmFycz86IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH1cbiAgKTogbGFtYmRhLkZ1bmN0aW9uIHtcbiAgICBjb25zdCBiYXNlRW52VmFycyA9IHtcbiAgICAgIFRBQkxFX05BTUU6IHRoaXMubWFpblRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIERZTkFNT0RCX1RBQkxFOiB0aGlzLm1haW5UYWJsZS50YWJsZU5hbWUsXG4gICAgICBVU0VSX1BPT0xfSUQ6IHRoaXMudXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgIFVTRVJfUE9PTF9DTElFTlRfSUQ6IHRoaXMudXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcbiAgICAgIFVTRVJfVVBMT0FEU19CVUNLRVQ6IHRoaXMudXNlclVwbG9hZHNCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIFNUQVRJQ19BU1NFVFNfQlVDS0VUOiB0aGlzLnN0YXRpY0Fzc2V0c0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgUFJPQ0VTU0VEX0lNQUdFU19CVUNLRVQ6IHRoaXMucHJvY2Vzc2VkSW1hZ2VzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBQUk9HUkVTU19QSE9UT1NfQlVDS0VUOiB0aGlzLnByb2dyZXNzUGhvdG9zQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBKV1RfU0VDUkVUOiAneW91ci1qd3Qtc2VjcmV0LWhlcmUnLCAvLyBJbiBwcm9kdWN0aW9uLCB1c2UgQVdTIFNlY3JldHMgTWFuYWdlclxuICAgICAgQ09HTklUT19SRUdJT046IHRoaXMucmVnaW9uLFxuICAgICAgQ09HTklUT19VU0VSX1BPT0xfSUQ6IHRoaXMudXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgIFJVU1RfTE9HOiAnaW5mbycsXG4gICAgICBSVVNUX0JBQ0tUUkFDRTogJzEnLFxuICAgIH07XG5cbiAgICBjb25zdCBlbnZWYXJzID0gYWRkaXRpb25hbEVudlZhcnNcbiAgICAgID8geyAuLi5iYXNlRW52VmFycywgLi4uYWRkaXRpb25hbEVudlZhcnMgfVxuICAgICAgOiBiYXNlRW52VmFycztcblxuICAgIHJldHVybiBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsIGAke25hbWV9TGFtYmRhYCwge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFJPVklERURfQUwyLFxuICAgICAgaGFuZGxlcjogJ2Jvb3RzdHJhcCcsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoYC4uL3RhcmdldC9sYW1iZGEvJHtzZXJ2aWNlTmFtZX1gKSxcbiAgICAgIGVudmlyb25tZW50OiBlbnZWYXJzLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LCAvLyBPcHRpbWl6ZWQgZm9yIGNvbGQgc3RhcnRzXG4gICAgICByZXNlcnZlZENvbmN1cnJlbnRFeGVjdXRpb25zOiAyMCwgLy8gSW5jcmVhc2VkIGZvciBkZXZlbG9wbWVudC90ZXN0aW5nXG4gICAgICAvLyBSZW1vdmVkIGxvZyByZXRlbnRpb24gdG8gdXNlIGZyZWUgdGllciBkZWZhdWx0cyAoNUdCL21vbnRoIGZyZWUpXG4gICAgICAvLyBSZW1vdmVkIFgtUmF5IHRyYWNpbmcgdG8gYXZvaWQgY29zdHMgKCQ1IHBlciAxTSB0cmFjZXMpXG4gICAgICBsYXllcnM6IFt0aGlzLmNyZWF0ZUF1dGhMYXllcigpXSxcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlUHl0aG9uTGFtYmRhRnVuY3Rpb24oXG4gICAgbmFtZTogc3RyaW5nLFxuICAgIHNlcnZpY2VOYW1lOiBzdHJpbmdcbiAgKTogbGFtYmRhLkZ1bmN0aW9uIHtcbiAgICByZXR1cm4gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCBgJHtuYW1lfUxhbWJkYWAsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzExLFxuICAgICAgaGFuZGxlcjogJ2xhbWJkYV9mdW5jdGlvbi5sYW1iZGFfaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoYC4uL3NlcnZpY2VzLyR7c2VydmljZU5hbWV9YCksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBEWU5BTU9EQl9UQUJMRTogdGhpcy5tYWluVGFibGUudGFibGVOYW1lLFxuICAgICAgICBVU0VSX1BPT0xfSUQ6IHRoaXMudXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgICAgVVNFUl9QT09MX0NMSUVOVF9JRDogdGhpcy51c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkLFxuICAgICAgICBVU0VSX1VQTE9BRFNfQlVDS0VUOiB0aGlzLnVzZXJVcGxvYWRzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgIFNUQVRJQ19BU1NFVFNfQlVDS0VUOiB0aGlzLnN0YXRpY0Fzc2V0c0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBQUk9DRVNTRURfSU1BR0VTX0JVQ0tFVDogdGhpcy5wcm9jZXNzZWRJbWFnZXNCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgUFJPR1JFU1NfUEhPVE9TX0JVQ0tFVDogdGhpcy5wcm9ncmVzc1Bob3Rvc0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBWRUNUT1JTX0JVQ0tFVDogdGhpcy52ZWN0b3JzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgIEpXVF9TRUNSRVQ6ICd5b3VyLWp3dC1zZWNyZXQtaGVyZScsIC8vIEluIHByb2R1Y3Rpb24sIHVzZSBBV1MgU2VjcmV0cyBNYW5hZ2VyXG4gICAgICAgIENPR05JVE9fUkVHSU9OOiB0aGlzLnJlZ2lvbixcbiAgICAgICAgQ09HTklUT19VU0VSX1BPT0xfSUQ6IHRoaXMudXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgICAgUFlUSE9OUEFUSDogJy92YXIvcnVudGltZTovdmFyL3Rhc2snLFxuICAgICAgICAvLyBBSSBTZXJ2aWNlIHNwZWNpZmljIGVudmlyb25tZW50IHZhcmlhYmxlc1xuICAgICAgICBCRURST0NLX01PREVMX0lEOiAnZGVlcHNlZWsudjMtdjE6MCcsIC8vIERlZXBTZWVrIG1vZGVsIGF2YWlsYWJsZSBpbiBldS1ub3J0aC0xXG4gICAgICAgIFJBVEVfTElNSVRfRlJFRV9USUVSOiAnMTAnLCAvLyBSZXF1ZXN0cyBwZXIgZGF5IGZvciBmcmVlIHRpZXJcbiAgICAgICAgUkFURV9MSU1JVF9QUkVNSVVNX1RJRVI6ICc1MCcsIC8vIFJlcXVlc3RzIHBlciBkYXkgZm9yIHByZW1pdW0gdGllclxuICAgICAgICBSQVRFX0xJTUlUX0hBUkRfTElNSVQ6ICcxMDAnLCAvLyBIYXJkIGxpbWl0IHRvIHByZXZlbnQgYWJ1c2VcbiAgICAgICAgQ09OVkVSU0FUSU9OX1RUTF9EQVlTOiAnMzAnLCAvLyBUVEwgZm9yIGNvbnZlcnNhdGlvbiBoaXN0b3J5XG4gICAgICAgIFJBVEVfTElNSVRfVFRMX0RBWVM6ICc3JywgLy8gVFRMIGZvciByYXRlIGxpbWl0IHJlY29yZHNcbiAgICAgIH0sXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSwgLy8gQUkgZnVuY3Rpb25zIG1heSBuZWVkIG1vcmUgdGltZVxuICAgICAgbWVtb3J5U2l6ZTogMTAyNCwgLy8gQUkgZnVuY3Rpb25zIG5lZWQgbW9yZSBtZW1vcnlcbiAgICAgIHJlc2VydmVkQ29uY3VycmVudEV4ZWN1dGlvbnM6IDIwLCAvLyBJbmNyZWFzZWQgZm9yIGRldmVsb3BtZW50L3Rlc3RpbmdcbiAgICAgIC8vIFJlbW92ZWQgbG9nIHJldGVudGlvbiB0byB1c2UgZnJlZSB0aWVyIGRlZmF1bHRzICg1R0IvbW9udGggZnJlZSlcbiAgICAgIC8vIFJlbW92ZWQgWC1SYXkgdHJhY2luZyB0byBhdm9pZCBjb3N0cyAoJDUgcGVyIDFNIHRyYWNlcylcbiAgICAgIC8vIGxheWVyczogW3RoaXMuY3JlYXRlUHl0aG9uQXV0aExheWVyKCldLCAvLyBUZW1wb3JhcmlseSBkaXNhYmxlZFxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVBdXRoTGF5ZXIoKTogbGFtYmRhLkxheWVyVmVyc2lvbiB7XG4gICAgaWYgKHRoaXMuYXV0aExheWVyKSB7XG4gICAgICByZXR1cm4gdGhpcy5hdXRoTGF5ZXI7XG4gICAgfVxuICAgIHRoaXMuYXV0aExheWVyID0gbmV3IGxhbWJkYS5MYXllclZlcnNpb24odGhpcywgJ0F1dGhMYXllcicsIHtcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4vc2VydmljZXMvYXV0aC1sYXllci9sYXllcicpLFxuICAgICAgY29tcGF0aWJsZVJ1bnRpbWVzOiBbbGFtYmRhLlJ1bnRpbWUuUFJPVklERURfQUwyXSxcbiAgICAgIGRlc2NyaXB0aW9uOlxuICAgICAgICAnQXV0aGVudGljYXRpb24gYW5kIGF1dGhvcml6YXRpb24gbGF5ZXIgZm9yIEd5bUNvYWNoIEFJIHNlcnZpY2VzJyxcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcy5hdXRoTGF5ZXI7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZVB5dGhvbkF1dGhMYXllcigpOiBsYW1iZGEuTGF5ZXJWZXJzaW9uIHtcbiAgICBpZiAodGhpcy5weXRob25BdXRoTGF5ZXIpIHtcbiAgICAgIHJldHVybiB0aGlzLnB5dGhvbkF1dGhMYXllcjtcbiAgICB9XG4gICAgdGhpcy5weXRob25BdXRoTGF5ZXIgPSBuZXcgbGFtYmRhLkxheWVyVmVyc2lvbih0aGlzLCAnUHl0aG9uQXV0aExheWVyJywge1xuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9zZXJ2aWNlcy9haS1zZXJ2aWNlLXB5dGhvbi9sYXllcicpLFxuICAgICAgY29tcGF0aWJsZVJ1bnRpbWVzOiBbbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTFdLFxuICAgICAgZGVzY3JpcHRpb246ICdQeXRob24gYXV0aGVudGljYXRpb24gbGF5ZXIgZm9yIEFJIHNlcnZpY2VzJyxcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcy5weXRob25BdXRoTGF5ZXI7XG4gIH1cblxuICAvLyBSZW1vdmVkIGNyZWF0ZU1vbml0b3JpbmdTdGFjayBtZXRob2QgdG8gYXZvaWQgQ2xvdWRXYXRjaCBjb3N0c1xuICAvLyBwcml2YXRlIGNyZWF0ZU1vbml0b3JpbmdTdGFjaygpIHtcbiAgLy8gICAvLyBDcmVhdGUgbW9uaXRvcmluZyBzdGFja1xuICAvLyAgIG5ldyBNb25pdG9yaW5nU3RhY2sodGhpcywgJ01vbml0b3JpbmdTdGFjaycsIHtcbiAgLy8gICAgIGxhbWJkYUZ1bmN0aW9uczogW1xuICAvLyAgICAgICB0aGlzLnVzZXJTZXJ2aWNlTGFtYmRhLFxuICAvLyAgICAgICB0aGlzLnVzZXJQcm9maWxlU2VydmljZUxhbWJkYSxcbiAgLy8gICAgICAgdGhpcy53b3Jrb3V0U2VydmljZUxhbWJkYSxcbiAgLy8gICAgICAgdGhpcy5jb2FjaGluZ1NlcnZpY2VMYW1iZGEsXG4gIC8vICAgICAgIHRoaXMuYW5hbHl0aWNzU2VydmljZUxhbWJkYSxcbiAgLy8gICAgICAgdGhpcy5udXRyaXRpb25TZXJ2aWNlTGFtYmRhLFxuICAvLyAgICAgICB0aGlzLmFpU2VydmljZUxhbWJkYSxcbiAgLy8gICAgIF0sXG4gIC8vICAgICBkeW5hbW9EYlRhYmxlOiB0aGlzLm1haW5UYWJsZSxcbiAgLy8gICAgIHMzQnVja2V0czogW1xuICAvLyAgICAgICB0aGlzLnVzZXJVcGxvYWRzQnVja2V0LFxuICAvLyAgICAgICB0aGlzLnN0YXRpY0Fzc2V0c0J1Y2tldCxcbiAgLy8gICAgICAgdGhpcy5wcm9jZXNzZWRJbWFnZXNCdWNrZXQsXG4gIC8vICAgICBdLFxuICAvLyAgIH0pO1xuICAvLyB9XG59XG4iXX0=