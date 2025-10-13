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
        const analyticsServiceLambda = this.createLambdaFunction('AnalyticsService', 'analytics-service');
        const nutritionServiceLambda = this.createLambdaFunction('NutritionService', 'nutrition-service');
        const aiServiceLambda = this.createPythonLambdaFunction('AIService', 'ai-service-python');
        // Create Notification Service Lambda
        const notificationServiceLambda = this.createLambdaFunction('NotificationService', 'notification-service', {
            WORKOUT_REMINDERS_TOPIC_ARN: workoutRemindersTopic.topicArn,
            NUTRITION_REMINDERS_TOPIC_ARN: nutritionRemindersTopic.topicArn,
            ACHIEVEMENT_TOPIC_ARN: achievementTopic.topicArn,
            AI_SUGGESTIONS_TOPIC_ARN: aiSuggestionsTopic.topicArn,
            FIREBASE_SERVER_KEY: 'YOUR_FIREBASE_SERVER_KEY',
            FIREBASE_PROJECT_ID: 'YOUR_FIREBASE_PROJECT_ID',
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
        // Create CloudFront Function for URL rewriting (handles SPA routing)
        const urlRewriteFunction = new cloudfront.Function(this, 'UrlRewriteFunction', {
            functionName: 'url-rewrite-function',
            code: cloudfront.FunctionCode.fromInline(`
        function handler(event) {
          var request = event.request;
          var uri = request.uri;
          
          // Check if the URI is asking for a file with an extension
          if (uri.includes('.')) {
            return request;
          }
          
          // Handle root path
          if (uri === '/') {
            request.uri = '/index.html';
            return request;
          }
          
          // Check if the URI ends with a slash
          if (uri.endsWith('/')) {
            // URI has trailing slash, append index.html
            request.uri += 'index.html';
          } else {
            // URI doesn't have trailing slash, redirect to version with trailing slash
            // by appending /index.html (equivalent to adding trailing slash + index.html)
            request.uri += '/index.html';
          }
          
          return request;
        }
      `),
            comment: 'URL rewrite function for SPA routing with trailing slash support',
        });
        this.distribution = new cloudfront.Distribution(this, 'GymCoachAIDistribution', {
            defaultRootObject: 'index.html',
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
        // Grant permissions to Lambda functions for S3 access
        this.userUploadsBucket.grantReadWrite(userProfileServiceLambda);
        this.userUploadsBucket.grantReadWrite(workoutServiceLambda);
        this.userUploadsBucket.grantReadWrite(analyticsServiceLambda);
        this.processedImagesBucket.grantReadWrite(userProfileServiceLambda);
        this.processedImagesBucket.grantReadWrite(workoutServiceLambda);
        this.processedImagesBucket.grantReadWrite(analyticsServiceLambda);
        // Grant analytics service full access to progress photos bucket
        this.progressPhotosBucket.grantReadWrite(analyticsServiceLambda);
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
            resources: ['arn:aws:bedrock:*::foundation-model/deepseek.v3-v1:0'],
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
        new cdk.CfnOutput(this, 'CloudFrontDistributionURL', {
            value: `https://${this.distribution.distributionDomainName}`,
            description: 'CloudFront Distribution URL',
        });
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
            code: lambda.Code.fromAsset(`../services/${serviceName}/target/lambda/${serviceName}`),
            environment: envVars,
            timeout: cdk.Duration.seconds(30),
            memorySize: 256, // Optimized for cold starts
            reservedConcurrentExecutions: 10, // Prevent cold starts during high load
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
            reservedConcurrentExecutions: 5, // Limit concurrent executions for AI functions
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3ltY29hY2gtYWktc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvZ3ltY29hY2gtYWktc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBQ25DLGlEQUFpRDtBQUNqRCx5REFBeUQ7QUFDekQsOERBQThEO0FBRTlELHFEQUFxRDtBQUNyRCwyQ0FBMkM7QUFDM0MsbURBQW1EO0FBRW5ELHlDQUF5QztBQUN6QywyQ0FBMkM7QUFDM0MsaURBQWlEO0FBQ2pELDBEQUEwRDtBQUUxRCwyREFBMkQ7QUFFM0QsTUFBYSxlQUFnQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBYzVDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDOUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsMENBQTBDO1FBQzFDLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRTtZQUMzRCxTQUFTLEVBQUUsa0JBQWtCO1lBQzdCLFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQ2pFLE9BQU8sRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQzVELFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7WUFDakQsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztZQUN4QyxpRUFBaUU7U0FDbEUsQ0FBQyxDQUFDO1FBRUgsd0NBQXdDO1FBQ3hDLElBQUksQ0FBQyxTQUFTLENBQUMsdUJBQXVCLENBQUM7WUFDckMsU0FBUyxFQUFFLE1BQU07WUFDakIsWUFBWSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFB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bUVBQW1FO1lBQ25FLDBEQUEwRDtZQUMxRCxrRUFBa0U7U0FDbkUsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVPLGVBQWU7UUFDckIsSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDbkIsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDO1FBQ3hCLENBQUM7UUFDRCxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksTUFBTSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsV0FBVyxFQUFFO1lBQzFELElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyw4QkFBOEIsQ0FBQztZQUMzRCxrQkFBa0IsRUFBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDO1lBQ2pELFdBQVcsRUFDVCxpRUFBaUU7U0FDcEUsQ0FBQyxDQUFDO1FBQ0gsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDO0lBQ3hCLENBQUM7SUFFTyxxQkFBcUI7UUFDM0IsSUFBSSxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDekIsT0FBTyxJQUFJLENBQUMsZUFBZSxDQUFDO1FBQzlCLENBQUM7UUFDRCxJQUFJLENBQUMsZUFBZSxHQUFHLElBQUksTUFBTSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsaUJBQWlCLEVBQUU7WUFDdEUsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLHFDQUFxQyxDQUFDO1lBQ2xFLGtCQUFrQixFQUFFLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUM7WUFDaEQsV0FBVyxFQUFFLDZDQUE2QztTQUMzRCxDQUFDLENBQUM7UUFDSCxPQUFPLElBQUksQ0FBQyxlQUFlLENBQUM7SUFDOUIsQ0FBQztDQXVCRjtBQTduQ0QsMENBNm5DQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBjbG91ZGZyb250IGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250JztcbmltcG9ydCAqIGFzIG9yaWdpbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQtb3JpZ2lucyc7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBjb2duaXRvIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jb2duaXRvJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCAqIGFzIHNucyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc25zJztcbmltcG9ydCAqIGFzIGV2ZW50cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzJztcbmltcG9ydCAqIGFzIHRhcmdldHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cy10YXJnZXRzJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuLy8gUmVtb3ZlZCBNb25pdG9yaW5nU3RhY2sgaW1wb3J0IHRvIGF2b2lkIENsb3VkV2F0Y2ggY29zdHNcblxuZXhwb3J0IGNsYXNzIEd5bUNvYWNoQUlTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSB1c2VyUG9vbDogY29nbml0by5Vc2VyUG9vbDtcbiAgcHVibGljIHJlYWRvbmx5IHVzZXJQb29sQ2xpZW50OiBjb2duaXRvLlVzZXJQb29sQ2xpZW50O1xuICBwdWJsaWMgcmVhZG9ubHkgdXNlclBvb2xEb21haW46IGNvZ25pdG8uVXNlclBvb2xEb21haW47XG4gIHB1YmxpYyByZWFkb25seSBtYWluVGFibGU6IGR5bmFtb2RiLlRhYmxlO1xuICBwdWJsaWMgcmVhZG9ubHkgZGlzdHJpYnV0aW9uOiBjbG91ZGZyb250LkRpc3RyaWJ1dGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IHVzZXJVcGxvYWRzQnVja2V0OiBzMy5CdWNrZXQ7XG4gIHB1YmxpYyByZWFkb25seSBzdGF0aWNBc3NldHNCdWNrZXQ6IHMzLkJ1Y2tldDtcbiAgcHVibGljIHJlYWRvbmx5IHByb2Nlc3NlZEltYWdlc0J1Y2tldDogczMuQnVja2V0O1xuICBwdWJsaWMgcmVhZG9ubHkgcHJvZ3Jlc3NQaG90b3NCdWNrZXQ6IHMzLkJ1Y2tldDtcbiAgcHVibGljIHJlYWRvbmx5IGZyb250ZW5kQnVja2V0OiBzMy5CdWNrZXQ7XG4gIHByaXZhdGUgYXV0aExheWVyPzogbGFtYmRhLkxheWVyVmVyc2lvbjtcbiAgcHJpdmF0ZSBweXRob25BdXRoTGF5ZXI/OiBsYW1iZGEuTGF5ZXJWZXJzaW9uO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIER5bmFtb0RCIFRhYmxlIHdpdGggU2luZ2xlIFRhYmxlIERlc2lnblxuICAgIHRoaXMubWFpblRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdHeW1Db2FjaEFJVGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6ICdneW1jb2FjaC1haS1tYWluJyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnUEsnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAnU0snLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICAvLyBSZW1vdmVkIHBvaW50SW5UaW1lUmVjb3ZlcnkgdG8gYXZvaWQgY29zdHMgKDIwJSBvZiB0YWJsZSBjb3N0KVxuICAgIH0pO1xuXG4gICAgLy8gQWRkIEdTSSBmb3IgZGlmZmVyZW50IGFjY2VzcyBwYXR0ZXJuc1xuICAgIHRoaXMubWFpblRhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ0dTSTEnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdHU0kxUEsnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAnR1NJMVNLJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICB9KTtcblxuICAgIHRoaXMubWFpblRhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ0dTSTInLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdHU0kyUEsnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAnR1NJMlNLJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBDb2duaXRvIFVzZXIgUG9vbFxuICAgIHRoaXMudXNlclBvb2wgPSBuZXcgY29nbml0by5Vc2VyUG9vbCh0aGlzLCAnR3ltQ29hY2hBSVVzZXJQb29sJywge1xuICAgICAgdXNlclBvb2xOYW1lOiAnZ3ltY29hY2gtYWktdXNlcnMnLFxuICAgICAgc2VsZlNpZ25VcEVuYWJsZWQ6IHRydWUsXG4gICAgICBzaWduSW5BbGlhc2VzOiB7XG4gICAgICAgIGVtYWlsOiB0cnVlLFxuICAgICAgICB1c2VybmFtZTogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBhdXRvVmVyaWZ5OiB7XG4gICAgICAgIGVtYWlsOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIHN0YW5kYXJkQXR0cmlidXRlczoge1xuICAgICAgICBlbWFpbDoge1xuICAgICAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgIG11dGFibGU6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgIGdpdmVuTmFtZToge1xuICAgICAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgIG11dGFibGU6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgIGZhbWlseU5hbWU6IHtcbiAgICAgICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIGN1c3RvbUF0dHJpYnV0ZXM6IHtcbiAgICAgICAgZml0bmVzc0dvYWxzOiBuZXcgY29nbml0by5TdHJpbmdBdHRyaWJ1dGUoe1xuICAgICAgICAgIG1pbkxlbjogMSxcbiAgICAgICAgICBtYXhMZW46IDEwMCxcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxuICAgICAgICB9KSxcbiAgICAgICAgZXhwZXJpZW5jZUxldmVsOiBuZXcgY29nbml0by5TdHJpbmdBdHRyaWJ1dGUoe1xuICAgICAgICAgIG1pbkxlbjogMSxcbiAgICAgICAgICBtYXhMZW46IDIwLFxuICAgICAgICAgIG11dGFibGU6IHRydWUsXG4gICAgICAgIH0pLFxuICAgICAgICBzdWJzY3JpcHRpb25UaWVyOiBuZXcgY29nbml0by5TdHJpbmdBdHRyaWJ1dGUoe1xuICAgICAgICAgIG1pbkxlbjogMSxcbiAgICAgICAgICBtYXhMZW46IDIwLFxuICAgICAgICAgIG11dGFibGU6IHRydWUsXG4gICAgICAgIH0pLFxuICAgICAgfSxcbiAgICAgIHBhc3N3b3JkUG9saWN5OiB7XG4gICAgICAgIG1pbkxlbmd0aDogOCxcbiAgICAgICAgcmVxdWlyZUxvd2VyY2FzZTogdHJ1ZSxcbiAgICAgICAgcmVxdWlyZVVwcGVyY2FzZTogdHJ1ZSxcbiAgICAgICAgcmVxdWlyZURpZ2l0czogdHJ1ZSxcbiAgICAgICAgcmVxdWlyZVN5bWJvbHM6IHRydWUsXG4gICAgICB9LFxuICAgICAgbWZhOiBjb2duaXRvLk1mYS5PUFRJT05BTCxcbiAgICAgIG1mYVNlY29uZEZhY3Rvcjoge1xuICAgICAgICBzbXM6IHRydWUsXG4gICAgICAgIG90cDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBkZXZpY2VUcmFja2luZzoge1xuICAgICAgICBjaGFsbGVuZ2VSZXF1aXJlZE9uTmV3RGV2aWNlOiB0cnVlLFxuICAgICAgICBkZXZpY2VPbmx5UmVtZW1iZXJlZE9uVXNlclByb21wdDogZmFsc2UsXG4gICAgICB9LFxuICAgICAgYWNjb3VudFJlY292ZXJ5OiBjb2duaXRvLkFjY291bnRSZWNvdmVyeS5FTUFJTF9PTkxZLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBVc2VyIFBvb2wgQ2xpZW50IGZvciBXZWIgQXBwXG4gICAgdGhpcy51c2VyUG9vbENsaWVudCA9IG5ldyBjb2duaXRvLlVzZXJQb29sQ2xpZW50KHRoaXMsICdXZWJBcHBDbGllbnQnLCB7XG4gICAgICB1c2VyUG9vbDogdGhpcy51c2VyUG9vbCxcbiAgICAgIHVzZXJQb29sQ2xpZW50TmFtZTogJ2d5bWNvYWNoLWFpLXdlYi1jbGllbnQnLFxuICAgICAgZ2VuZXJhdGVTZWNyZXQ6IGZhbHNlLFxuICAgICAgYXV0aEZsb3dzOiB7XG4gICAgICAgIHVzZXJQYXNzd29yZDogdHJ1ZSxcbiAgICAgICAgdXNlclNycDogdHJ1ZSxcbiAgICAgICAgY3VzdG9tOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIG9BdXRoOiB7XG4gICAgICAgIGZsb3dzOiB7XG4gICAgICAgICAgYXV0aG9yaXphdGlvbkNvZGVHcmFudDogdHJ1ZSxcbiAgICAgICAgICBpbXBsaWNpdENvZGVHcmFudDogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgc2NvcGVzOiBbXG4gICAgICAgICAgY29nbml0by5PQXV0aFNjb3BlLkVNQUlMLFxuICAgICAgICAgIGNvZ25pdG8uT0F1dGhTY29wZS5PUEVOSUQsXG4gICAgICAgICAgY29nbml0by5PQXV0aFNjb3BlLlBST0ZJTEUsXG4gICAgICAgIF0sXG4gICAgICAgIGNhbGxiYWNrVXJsczogW1xuICAgICAgICAgICdodHRwOi8vbG9jYWxob3N0OjMwMDAvYXV0aC9jYWxsYmFjaycsXG4gICAgICAgICAgJ2h0dHBzOi8vKi5jbG91ZGZyb250Lm5ldC9hdXRoL2NhbGxiYWNrJyxcbiAgICAgICAgXSxcbiAgICAgICAgbG9nb3V0VXJsczogW1xuICAgICAgICAgICdodHRwOi8vbG9jYWxob3N0OjMwMDAvYXV0aC9sb2dvdXQnLFxuICAgICAgICAgICdodHRwczovLyouY2xvdWRmcm9udC5uZXQvYXV0aC9sb2dvdXQnLFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICAgIHJlZnJlc2hUb2tlblZhbGlkaXR5OiBjZGsuRHVyYXRpb24uZGF5cygzMCksXG4gICAgICBhY2Nlc3NUb2tlblZhbGlkaXR5OiBjZGsuRHVyYXRpb24uaG91cnMoMSksXG4gICAgICBpZFRva2VuVmFsaWRpdHk6IGNkay5EdXJhdGlvbi5ob3VycygxKSxcbiAgICAgIHByZXZlbnRVc2VyRXhpc3RlbmNlRXJyb3JzOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIFVzZXIgUG9vbCBEb21haW5cbiAgICB0aGlzLnVzZXJQb29sRG9tYWluID0gdGhpcy51c2VyUG9vbC5hZGREb21haW4oJ0NvZ25pdG9Eb21haW4nLCB7XG4gICAgICBjb2duaXRvRG9tYWluOiB7XG4gICAgICAgIGRvbWFpblByZWZpeDogYGd5bWNvYWNoLWFpLSR7dGhpcy5hY2NvdW50fWAsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIFVzZXIgR3JvdXBzIGZvciBSb2xlLUJhc2VkIEFjY2VzcyBDb250cm9sXG4gICAgY29uc3QgYWRtaW5Hcm91cCA9IG5ldyBjb2duaXRvLkNmblVzZXJQb29sR3JvdXAodGhpcywgJ0FkbWluR3JvdXAnLCB7XG4gICAgICB1c2VyUG9vbElkOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICBncm91cE5hbWU6ICdhZG1pbicsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FkbWluaXN0cmF0b3JzIHdpdGggZnVsbCBhY2Nlc3MnLFxuICAgICAgcHJlY2VkZW5jZTogMSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGNvYWNoR3JvdXAgPSBuZXcgY29nbml0by5DZm5Vc2VyUG9vbEdyb3VwKHRoaXMsICdDb2FjaEdyb3VwJywge1xuICAgICAgdXNlclBvb2xJZDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgZ3JvdXBOYW1lOiAnY29hY2gnLFxuICAgICAgZGVzY3JpcHRpb246ICdDb2FjaGVzIHdpdGggYWNjZXNzIHRvIHVzZXIgZGF0YSBmb3IgY29hY2hpbmcnLFxuICAgICAgcHJlY2VkZW5jZTogMixcbiAgICB9KTtcblxuICAgIGNvbnN0IHVzZXJHcm91cCA9IG5ldyBjb2duaXRvLkNmblVzZXJQb29sR3JvdXAodGhpcywgJ1VzZXJHcm91cCcsIHtcbiAgICAgIHVzZXJQb29sSWQ6IHRoaXMudXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgIGdyb3VwTmFtZTogJ3VzZXInLFxuICAgICAgZGVzY3JpcHRpb246ICdSZWd1bGFyIHVzZXJzIHdpdGggYWNjZXNzIHRvIHRoZWlyIG93biBkYXRhJyxcbiAgICAgIHByZWNlZGVuY2U6IDMsXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgU05TIFRvcGljcyBmb3IgZGlmZmVyZW50IG5vdGlmaWNhdGlvbiB0eXBlc1xuICAgIGNvbnN0IHdvcmtvdXRSZW1pbmRlcnNUb3BpYyA9IG5ldyBzbnMuVG9waWModGhpcywgJ1dvcmtvdXRSZW1pbmRlcnNUb3BpYycsIHtcbiAgICAgIHRvcGljTmFtZTogJ2d5bWNvYWNoLWFpLXdvcmtvdXQtcmVtaW5kZXJzJyxcbiAgICAgIGRpc3BsYXlOYW1lOiAnV29ya291dCBSZW1pbmRlcnMnLFxuICAgIH0pO1xuXG4gICAgY29uc3QgbnV0cml0aW9uUmVtaW5kZXJzVG9waWMgPSBuZXcgc25zLlRvcGljKFxuICAgICAgdGhpcyxcbiAgICAgICdOdXRyaXRpb25SZW1pbmRlcnNUb3BpYycsXG4gICAgICB7XG4gICAgICAgIHRvcGljTmFtZTogJ2d5bWNvYWNoLWFpLW51dHJpdGlvbi1yZW1pbmRlcnMnLFxuICAgICAgICBkaXNwbGF5TmFtZTogJ051dHJpdGlvbiBSZW1pbmRlcnMnLFxuICAgICAgfVxuICAgICk7XG5cbiAgICBjb25zdCBhY2hpZXZlbWVudFRvcGljID0gbmV3IHNucy5Ub3BpYyh0aGlzLCAnQWNoaWV2ZW1lbnRUb3BpYycsIHtcbiAgICAgIHRvcGljTmFtZTogJ2d5bWNvYWNoLWFpLWFjaGlldmVtZW50cycsXG4gICAgICBkaXNwbGF5TmFtZTogJ0FjaGlldmVtZW50IE5vdGlmaWNhdGlvbnMnLFxuICAgIH0pO1xuXG4gICAgY29uc3QgYWlTdWdnZXN0aW9uc1RvcGljID0gbmV3IHNucy5Ub3BpYyh0aGlzLCAnQUlTdWdnZXN0aW9uc1RvcGljJywge1xuICAgICAgdG9waWNOYW1lOiAnZ3ltY29hY2gtYWktc3VnZ2VzdGlvbnMnLFxuICAgICAgZGlzcGxheU5hbWU6ICdBSSBTdWdnZXN0aW9ucycsXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgRXZlbnRCcmlkZ2UgUnVsZXMgZm9yIHNjaGVkdWxlZCBub3RpZmljYXRpb25zXG4gICAgY29uc3Qgd29ya291dFJlbWluZGVyUnVsZSA9IG5ldyBldmVudHMuUnVsZSh0aGlzLCAnV29ya291dFJlbWluZGVyUnVsZScsIHtcbiAgICAgIHJ1bGVOYW1lOiAnZ3ltY29hY2gtYWktd29ya291dC1yZW1pbmRlcnMnLFxuICAgICAgZGVzY3JpcHRpb246ICdUcmlnZ2VycyB3b3Jrb3V0IHJlbWluZGVyIG5vdGlmaWNhdGlvbnMnLFxuICAgICAgc2NoZWR1bGU6IGV2ZW50cy5TY2hlZHVsZS5jcm9uKHtcbiAgICAgICAgbWludXRlOiAnMCcsXG4gICAgICAgIGhvdXI6ICc4JywgLy8gOCBBTSBVVEMgLSB3aWxsIGJlIGFkanVzdGVkIHBlciB1c2VyIHRpbWV6b25lXG4gICAgICB9KSxcbiAgICB9KTtcblxuICAgIGNvbnN0IG51dHJpdGlvblJlbWluZGVyUnVsZSA9IG5ldyBldmVudHMuUnVsZShcbiAgICAgIHRoaXMsXG4gICAgICAnTnV0cml0aW9uUmVtaW5kZXJSdWxlJyxcbiAgICAgIHtcbiAgICAgICAgcnVsZU5hbWU6ICdneW1jb2FjaC1haS1udXRyaXRpb24tcmVtaW5kZXJzJyxcbiAgICAgICAgZGVzY3JpcHRpb246ICdUcmlnZ2VycyBudXRyaXRpb24gcmVtaW5kZXIgbm90aWZpY2F0aW9ucycsXG4gICAgICAgIHNjaGVkdWxlOiBldmVudHMuU2NoZWR1bGUuY3Jvbih7XG4gICAgICAgICAgbWludXRlOiAnMCcsXG4gICAgICAgICAgaG91cjogJzEyJywgLy8gMTIgUE0gVVRDIC0gd2lsbCBiZSBhZGp1c3RlZCBwZXIgdXNlciB0aW1lem9uZVxuICAgICAgICB9KSxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgY29uc3Qgd2F0ZXJSZW1pbmRlclJ1bGUgPSBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ1dhdGVyUmVtaW5kZXJSdWxlJywge1xuICAgICAgcnVsZU5hbWU6ICdneW1jb2FjaC1haS13YXRlci1yZW1pbmRlcnMnLFxuICAgICAgZGVzY3JpcHRpb246ICdUcmlnZ2VycyB3YXRlciBpbnRha2UgcmVtaW5kZXIgbm90aWZpY2F0aW9ucycsXG4gICAgICBzY2hlZHVsZTogZXZlbnRzLlNjaGVkdWxlLmNyb24oe1xuICAgICAgICBtaW51dGU6ICcwJyxcbiAgICAgICAgaG91cjogJyonLCAvLyBFdmVyeSBob3VyXG4gICAgICB9KSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHByb2dyZXNzUGhvdG9SdWxlID0gbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdQcm9ncmVzc1Bob3RvUnVsZScsIHtcbiAgICAgIHJ1bGVOYW1lOiAnZ3ltY29hY2gtYWktcHJvZ3Jlc3MtcGhvdG9zJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVHJpZ2dlcnMgd2Vla2x5IHByb2dyZXNzIHBob3RvIHJlbWluZGVycycsXG4gICAgICBzY2hlZHVsZTogZXZlbnRzLlNjaGVkdWxlLmNyb24oe1xuICAgICAgICBtaW51dGU6ICcwJyxcbiAgICAgICAgaG91cjogJzE4JywgLy8gNiBQTSBVVEMgb24gU3VuZGF5c1xuICAgICAgICB3ZWVrRGF5OiAnU1VOJyxcbiAgICAgIH0pLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIFMzIEJ1Y2tldHMgKG5lZWRlZCBieSBMYW1iZGFzKVxuICAgIHRoaXMudXNlclVwbG9hZHNCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdVc2VyVXBsb2Fkc0J1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGBneW1jb2FjaC1haS11c2VyLXVwbG9hZHMtJHt0aGlzLmFjY291bnR9YCxcbiAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBuZXcgczMuQmxvY2tQdWJsaWNBY2Nlc3Moe1xuICAgICAgICBibG9ja1B1YmxpY0FjbHM6IGZhbHNlLFxuICAgICAgICBibG9ja1B1YmxpY1BvbGljeTogZmFsc2UsXG4gICAgICAgIGlnbm9yZVB1YmxpY0FjbHM6IGZhbHNlLFxuICAgICAgICByZXN0cmljdFB1YmxpY0J1Y2tldHM6IGZhbHNlLFxuICAgICAgfSksXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgY29yczogW1xuICAgICAgICB7XG4gICAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBbXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5HRVQsXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5QVVQsXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5QT1NULFxuICAgICAgICAgICAgczMuSHR0cE1ldGhvZHMuREVMRVRFLFxuICAgICAgICAgICAgczMuSHR0cE1ldGhvZHMuSEVBRCxcbiAgICAgICAgICBdLFxuICAgICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcbiAgICAgICAgICBleHBvc2VkSGVhZGVyczogWydFVGFnJ10sXG4gICAgICAgICAgbWF4QWdlOiAzMDAwLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ0RlbGV0ZUluY29tcGxldGVNdWx0aXBhcnRVcGxvYWRzJyxcbiAgICAgICAgICBhYm9ydEluY29tcGxldGVNdWx0aXBhcnRVcGxvYWRBZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoNyksXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ1RyYW5zaXRpb25Ub0lBJyxcbiAgICAgICAgICB0cmFuc2l0aW9uczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBzdG9yYWdlQ2xhc3M6IHMzLlN0b3JhZ2VDbGFzcy5JTkZSRVFVRU5UX0FDQ0VTUyxcbiAgICAgICAgICAgICAgdHJhbnNpdGlvbkFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cygzMCksXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ1RyYW5zaXRpb25Ub0dsYWNpZXInLFxuICAgICAgICAgIHRyYW5zaXRpb25zOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHN0b3JhZ2VDbGFzczogczMuU3RvcmFnZUNsYXNzLkdMQUNJRVIsXG4gICAgICAgICAgICAgIHRyYW5zaXRpb25BZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoOTApLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIEFkZCBidWNrZXQgcG9saWN5IHRvIGFsbG93IHB1YmxpYyByZWFkIGFjY2VzcyB0byB1cGxvYWRlZCBpbWFnZXNcbiAgICB0aGlzLnVzZXJVcGxvYWRzQnVja2V0LmFkZFRvUmVzb3VyY2VQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgcHJpbmNpcGFsczogW25ldyBpYW0uQW55UHJpbmNpcGFsKCldLFxuICAgICAgICBhY3Rpb25zOiBbJ3MzOkdldE9iamVjdCddLFxuICAgICAgICByZXNvdXJjZXM6IFtgJHt0aGlzLnVzZXJVcGxvYWRzQnVja2V0LmJ1Y2tldEFybn0vdXNlci1wcm9maWxlcy8qYF0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICB0aGlzLnN0YXRpY0Fzc2V0c0J1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ1N0YXRpY0Fzc2V0c0J1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGBneW1jb2FjaC1haS1zdGF0aWMtYXNzZXRzLSR7dGhpcy5hY2NvdW50fWAsXG4gICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIHB1YmxpY1JlYWRBY2Nlc3M6IGZhbHNlLFxuICAgIH0pO1xuXG4gICAgdGhpcy5wcm9jZXNzZWRJbWFnZXNCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdQcm9jZXNzZWRJbWFnZXNCdWNrZXQnLCB7XG4gICAgICBidWNrZXROYW1lOiBgZ3ltY29hY2gtYWktcHJvY2Vzc2VkLWltYWdlcy0ke3RoaXMuYWNjb3VudH1gLFxuICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgZGVkaWNhdGVkIFByb2dyZXNzIFBob3RvcyBTMyBCdWNrZXQgd2l0aCBlbmhhbmNlZCBzZWN1cml0eVxuICAgIHRoaXMucHJvZ3Jlc3NQaG90b3NCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdQcm9ncmVzc1Bob3Rvc0J1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGBneW1jb2FjaC1haS1wcm9ncmVzcy1waG90b3MtJHt0aGlzLmFjY291bnR9YCxcbiAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgY29yczogW1xuICAgICAgICB7XG4gICAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBbXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5HRVQsXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5QVVQsXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5QT1NULFxuICAgICAgICAgICAgczMuSHR0cE1ldGhvZHMuREVMRVRFLFxuICAgICAgICAgICAgczMuSHR0cE1ldGhvZHMuSEVBRCxcbiAgICAgICAgICBdLFxuICAgICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcbiAgICAgICAgICBleHBvc2VkSGVhZGVyczogWydFVGFnJ10sXG4gICAgICAgICAgbWF4QWdlOiAzMDAwLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ0RlbGV0ZUluY29tcGxldGVNdWx0aXBhcnRVcGxvYWRzJyxcbiAgICAgICAgICBhYm9ydEluY29tcGxldGVNdWx0aXBhcnRVcGxvYWRBZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoMSksXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ1RyYW5zaXRpb25Qcm9ncmVzc1Bob3Rvc1RvSUEnLFxuICAgICAgICAgIHRyYW5zaXRpb25zOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHN0b3JhZ2VDbGFzczogczMuU3RvcmFnZUNsYXNzLklORlJFUVVFTlRfQUNDRVNTLFxuICAgICAgICAgICAgICB0cmFuc2l0aW9uQWZ0ZXI6IGNkay5EdXJhdGlvbi5kYXlzKDMwKSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAnQXJjaGl2ZU9sZFByb2dyZXNzUGhvdG9zJyxcbiAgICAgICAgICB0cmFuc2l0aW9uczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBzdG9yYWdlQ2xhc3M6IHMzLlN0b3JhZ2VDbGFzcy5HTEFDSUVSLFxuICAgICAgICAgICAgICB0cmFuc2l0aW9uQWZ0ZXI6IGNkay5EdXJhdGlvbi5kYXlzKDM2NSksXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIENsb3VkRnJvbnQgT3JpZ2luIEFjY2VzcyBJZGVudGl0eSBmb3Igc2VjdXJlIFMzIGFjY2Vzc1xuICAgIGNvbnN0IHByb2dyZXNzUGhvdG9zT0FJID0gbmV3IGNsb3VkZnJvbnQuT3JpZ2luQWNjZXNzSWRlbnRpdHkoXG4gICAgICB0aGlzLFxuICAgICAgJ1Byb2dyZXNzUGhvdG9zT0FJJyxcbiAgICAgIHtcbiAgICAgICAgY29tbWVudDogJ09yaWdpbiBBY2Nlc3MgSWRlbnRpdHkgZm9yIFByb2dyZXNzIFBob3RvcyBidWNrZXQgdjInLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBHcmFudCBDbG91ZEZyb250IE9BSSBhY2Nlc3MgdG8gcHJvZ3Jlc3MgcGhvdG9zIGJ1Y2tldFxuICAgIHRoaXMucHJvZ3Jlc3NQaG90b3NCdWNrZXQuYWRkVG9SZXNvdXJjZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBwcmluY2lwYWxzOiBbcHJvZ3Jlc3NQaG90b3NPQUkuZ3JhbnRQcmluY2lwYWxdLFxuICAgICAgICBhY3Rpb25zOiBbJ3MzOkdldE9iamVjdCddLFxuICAgICAgICByZXNvdXJjZXM6IFtgJHt0aGlzLnByb2dyZXNzUGhvdG9zQnVja2V0LmJ1Y2tldEFybn0vKmBdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gQ3JlYXRlIENsb3VkRnJvbnQgT3JpZ2luIEFjY2VzcyBJZGVudGl0eSBmb3IgZnJvbnRlbmQgYnVja2V0XG4gICAgY29uc3QgZnJvbnRlbmRPQUkgPSBuZXcgY2xvdWRmcm9udC5PcmlnaW5BY2Nlc3NJZGVudGl0eShcbiAgICAgIHRoaXMsXG4gICAgICAnRnJvbnRlbmRPQUknLFxuICAgICAge1xuICAgICAgICBjb21tZW50OiAnT3JpZ2luIEFjY2VzcyBJZGVudGl0eSBmb3IgRnJvbnRlbmQgYnVja2V0JyxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gQ3JlYXRlIEZyb250ZW5kIFMzIEJ1Y2tldCBmb3Igc3RhdGljIGFzc2V0c1xuICAgIHRoaXMuZnJvbnRlbmRCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdGcm9udGVuZEJ1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGBneW1jb2FjaC1haS1mcm9udGVuZC0ke3RoaXMuYWNjb3VudH1gLFxuICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgcHVibGljUmVhZEFjY2VzczogZmFsc2UsIC8vIE9ubHkgQ2xvdWRGcm9udCBPQUkgc2hvdWxkIGFjY2Vzc1xuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCwgLy8gQmxvY2sgYWxsIHB1YmxpYyBhY2Nlc3NcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBDbG91ZEZyb250IE9BSSBhY2Nlc3MgdG8gZnJvbnRlbmQgYnVja2V0XG4gICAgdGhpcy5mcm9udGVuZEJ1Y2tldC5hZGRUb1Jlc291cmNlUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIHByaW5jaXBhbHM6IFtmcm9udGVuZE9BSS5ncmFudFByaW5jaXBhbF0sXG4gICAgICAgIGFjdGlvbnM6IFsnczM6R2V0T2JqZWN0J10sXG4gICAgICAgIHJlc291cmNlczogW2Ake3RoaXMuZnJvbnRlbmRCdWNrZXQuYnVja2V0QXJufS8qYF0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBDcmVhdGUgTGFtYmRhIEF1dGhvcml6ZXJcbiAgICBjb25zdCBhdXRob3JpemVyTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQXV0aG9yaXplckxhbWJkYScsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUlubGluZShgXG4gICAgICAgIGNvbnN0IGp3dCA9IHJlcXVpcmUoJ2pzb253ZWJ0b2tlbicpO1xuICAgICAgICBjb25zdCBqd2tzQ2xpZW50ID0gcmVxdWlyZSgnandrcy1yc2EnKTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGNsaWVudCA9IGp3a3NDbGllbnQoe1xuICAgICAgICAgIGp3a3NVcmk6ICdodHRwczovL2NvZ25pdG8taWRwLiR7dGhpcy5yZWdpb259LmFtYXpvbmF3cy5jb20vJHt0aGlzLnVzZXJQb29sLnVzZXJQb29sSWR9Ly53ZWxsLWtub3duL2p3a3MuanNvbidcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICBmdW5jdGlvbiBnZXRLZXkoaGVhZGVyLCBjYWxsYmFjaykge1xuICAgICAgICAgIGNsaWVudC5nZXRTaWduaW5nS2V5KGhlYWRlci5raWQsIChlcnIsIGtleSkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgc2lnbmluZ0tleSA9IGtleS5wdWJsaWNLZXkgfHwga2V5LnJzYVB1YmxpY0tleTtcbiAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHNpZ25pbmdLZXkpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBleHBvcnRzLmhhbmRsZXIgPSBhc3luYyAoZXZlbnQpID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnQXV0aG9yaXplciBldmVudDonLCBKU09OLnN0cmluZ2lmeShldmVudCwgbnVsbCwgMikpO1xuICAgICAgICAgIFxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB0b2tlbiA9IGV2ZW50LmhlYWRlcnMuYXV0aG9yaXphdGlvbj8ucmVwbGFjZSgnQmVhcmVyICcsICcnKTtcbiAgICAgICAgICAgIGlmICghdG9rZW4pIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGdlbmVyYXRlUG9saWN5KCd1c2VyJywgJ0RlbnknLCBldmVudC5tZXRob2RBcm4pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zdCBkZWNvZGVkID0gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgICBqd3QudmVyaWZ5KHRva2VuLCBnZXRLZXksIHsgYWxnb3JpdGhtczogWydSUzI1NiddIH0sIChlcnIsIGRlY29kZWQpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICBlbHNlIHJlc29sdmUoZGVjb2RlZCk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdEZWNvZGVkIHRva2VuOicsIGRlY29kZWQpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gZ2VuZXJhdGVQb2xpY3koZGVjb2RlZC5zdWIsICdBbGxvdycsIGV2ZW50Lm1ldGhvZEFybiwgZGVjb2RlZCk7XG4gICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0F1dGhvcml6YXRpb24gZXJyb3I6JywgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIGdlbmVyYXRlUG9saWN5KCd1c2VyJywgJ0RlbnknLCBldmVudC5tZXRob2RBcm4pO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgXG4gICAgICAgIGZ1bmN0aW9uIGdlbmVyYXRlUG9saWN5KHByaW5jaXBhbElkLCBlZmZlY3QsIHJlc291cmNlLCBjb250ZXh0ID0ge30pIHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgcHJpbmNpcGFsSWQsXG4gICAgICAgICAgICBwb2xpY3lEb2N1bWVudDoge1xuICAgICAgICAgICAgICBWZXJzaW9uOiAnMjAxMi0xMC0xNycsXG4gICAgICAgICAgICAgIFN0YXRlbWVudDogW3tcbiAgICAgICAgICAgICAgICBBY3Rpb246ICdleGVjdXRlLWFwaTpJbnZva2UnLFxuICAgICAgICAgICAgICAgIEVmZmVjdDogZWZmZWN0LFxuICAgICAgICAgICAgICAgIFJlc291cmNlOiByZXNvdXJjZVxuICAgICAgICAgICAgICB9XVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNvbnRleHRcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICBgKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFVTRVJfUE9PTF9JRDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgICBVU0VSX1BPT0xfQ0xJRU5UX0lEOiB0aGlzLnVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXG4gICAgICAgIFRBQkxFX05BTUU6IHRoaXMubWFpblRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBwZXJtaXNzaW9ucyB0byBhdXRob3JpemVyXG4gICAgdGhpcy5tYWluVGFibGUuZ3JhbnRSZWFkRGF0YShhdXRob3JpemVyTGFtYmRhKTtcblxuICAgIC8vIENyZWF0ZSBMYW1iZGEgZnVuY3Rpb25zIGZvciBlYWNoIHNlcnZpY2VcbiAgICAvLyBjb25zdCB1c2VyU2VydmljZUxhbWJkYSA9IHRoaXMuY3JlYXRlTGFtYmRhRnVuY3Rpb24oXG4gICAgLy8gICAnVXNlclNlcnZpY2UnLFxuICAgIC8vICAgJ3VzZXItc2VydmljZSdcbiAgICAvLyApO1xuICAgIGNvbnN0IHVzZXJQcm9maWxlU2VydmljZUxhbWJkYSA9IHRoaXMuY3JlYXRlTGFtYmRhRnVuY3Rpb24oXG4gICAgICAnVXNlclByb2ZpbGVTZXJ2aWNlJyxcbiAgICAgICd1c2VyLXByb2ZpbGUtc2VydmljZSdcbiAgICApO1xuICAgIGNvbnN0IHdvcmtvdXRTZXJ2aWNlTGFtYmRhID0gdGhpcy5jcmVhdGVMYW1iZGFGdW5jdGlvbihcbiAgICAgICdXb3Jrb3V0U2VydmljZScsXG4gICAgICAnd29ya291dC1zZXJ2aWNlJ1xuICAgICk7XG4gICAgY29uc3QgY29hY2hpbmdTZXJ2aWNlTGFtYmRhID0gdGhpcy5jcmVhdGVMYW1iZGFGdW5jdGlvbihcbiAgICAgICdDb2FjaGluZ1NlcnZpY2UnLFxuICAgICAgJ2NvYWNoaW5nLXNlcnZpY2UnXG4gICAgKTtcbiAgICBjb25zdCBhbmFseXRpY3NTZXJ2aWNlTGFtYmRhID0gdGhpcy5jcmVhdGVMYW1iZGFGdW5jdGlvbihcbiAgICAgICdBbmFseXRpY3NTZXJ2aWNlJyxcbiAgICAgICdhbmFseXRpY3Mtc2VydmljZSdcbiAgICApO1xuICAgIGNvbnN0IG51dHJpdGlvblNlcnZpY2VMYW1iZGEgPSB0aGlzLmNyZWF0ZUxhbWJkYUZ1bmN0aW9uKFxuICAgICAgJ051dHJpdGlvblNlcnZpY2UnLFxuICAgICAgJ251dHJpdGlvbi1zZXJ2aWNlJ1xuICAgICk7XG4gICAgY29uc3QgYWlTZXJ2aWNlTGFtYmRhID0gdGhpcy5jcmVhdGVQeXRob25MYW1iZGFGdW5jdGlvbihcbiAgICAgICdBSVNlcnZpY2UnLFxuICAgICAgJ2FpLXNlcnZpY2UtcHl0aG9uJ1xuICAgICk7XG5cbiAgICAvLyBDcmVhdGUgTm90aWZpY2F0aW9uIFNlcnZpY2UgTGFtYmRhXG4gICAgY29uc3Qgbm90aWZpY2F0aW9uU2VydmljZUxhbWJkYSA9IHRoaXMuY3JlYXRlTGFtYmRhRnVuY3Rpb24oXG4gICAgICAnTm90aWZpY2F0aW9uU2VydmljZScsXG4gICAgICAnbm90aWZpY2F0aW9uLXNlcnZpY2UnLFxuICAgICAge1xuICAgICAgICBXT1JLT1VUX1JFTUlOREVSU19UT1BJQ19BUk46IHdvcmtvdXRSZW1pbmRlcnNUb3BpYy50b3BpY0FybixcbiAgICAgICAgTlVUUklUSU9OX1JFTUlOREVSU19UT1BJQ19BUk46IG51dHJpdGlvblJlbWluZGVyc1RvcGljLnRvcGljQXJuLFxuICAgICAgICBBQ0hJRVZFTUVOVF9UT1BJQ19BUk46IGFjaGlldmVtZW50VG9waWMudG9waWNBcm4sXG4gICAgICAgIEFJX1NVR0dFU1RJT05TX1RPUElDX0FSTjogYWlTdWdnZXN0aW9uc1RvcGljLnRvcGljQXJuLFxuICAgICAgICBGSVJFQkFTRV9TRVJWRVJfS0VZOiAnWU9VUl9GSVJFQkFTRV9TRVJWRVJfS0VZJyxcbiAgICAgICAgRklSRUJBU0VfUFJPSkVDVF9JRDogJ1lPVVJfRklSRUJBU0VfUFJPSkVDVF9JRCcsXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIENyZWF0ZSBOb3RpZmljYXRpb24gU2NoZWR1bGVyIExhbWJkYVxuICAgIGNvbnN0IG5vdGlmaWNhdGlvblNjaGVkdWxlckxhbWJkYSA9IHRoaXMuY3JlYXRlTGFtYmRhRnVuY3Rpb24oXG4gICAgICAnTm90aWZpY2F0aW9uU2NoZWR1bGVyJyxcbiAgICAgICdub3RpZmljYXRpb24tc2NoZWR1bGVyJyxcbiAgICAgIHtcbiAgICAgICAgTk9USUZJQ0FUSU9OX1NFUlZJQ0VfRlVOQ1RJT05fQVJOOiAnJywgLy8gV2lsbCBiZSBzZXQgYWZ0ZXIgY3JlYXRpb25cbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gVXBkYXRlIG5vdGlmaWNhdGlvbiBzY2hlZHVsZXIgd2l0aCB0aGUgY29ycmVjdCBmdW5jdGlvbiBBUk5cbiAgICBub3RpZmljYXRpb25TY2hlZHVsZXJMYW1iZGEuYWRkRW52aXJvbm1lbnQoXG4gICAgICAnTk9USUZJQ0FUSU9OX1NFUlZJQ0VfRlVOQ1RJT05fQVJOJyxcbiAgICAgIG5vdGlmaWNhdGlvblNlcnZpY2VMYW1iZGEuZnVuY3Rpb25Bcm5cbiAgICApO1xuXG4gICAgLy8gRW5hYmxlIExhbWJkYSBGdW5jdGlvbiBVUkxzXG4gICAgLy8gY29uc3QgdXNlclNlcnZpY2VVcmwgPSB1c2VyU2VydmljZUxhbWJkYS5hZGRGdW5jdGlvblVybCh7XG4gICAgLy8gICBhdXRoVHlwZTogbGFtYmRhLkZ1bmN0aW9uVXJsQXV0aFR5cGUuTk9ORSxcbiAgICAvLyAgIGNvcnM6IHtcbiAgICAvLyAgICAgYWxsb3dDcmVkZW50aWFsczogZmFsc2UsXG4gICAgLy8gICAgIGFsbG93ZWRIZWFkZXJzOiBbJyonXSxcbiAgICAvLyAgICAgYWxsb3dlZE1ldGhvZHM6IFtsYW1iZGEuSHR0cE1ldGhvZC5BTExdLFxuICAgIC8vICAgICBhbGxvd2VkT3JpZ2luczogWycqJ10sXG4gICAgLy8gICB9LFxuICAgIC8vIH0pO1xuXG4gICAgY29uc3QgdXNlclByb2ZpbGVTZXJ2aWNlVXJsID0gdXNlclByb2ZpbGVTZXJ2aWNlTGFtYmRhLmFkZEZ1bmN0aW9uVXJsKHtcbiAgICAgIGF1dGhUeXBlOiBsYW1iZGEuRnVuY3Rpb25VcmxBdXRoVHlwZS5OT05FLFxuICAgICAgY29yczoge1xuICAgICAgICBhbGxvd0NyZWRlbnRpYWxzOiBmYWxzZSxcbiAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxuICAgICAgICBhbGxvd2VkTWV0aG9kczogW2xhbWJkYS5IdHRwTWV0aG9kLkFMTF0sXG4gICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCB3b3Jrb3V0U2VydmljZVVybCA9IHdvcmtvdXRTZXJ2aWNlTGFtYmRhLmFkZEZ1bmN0aW9uVXJsKHtcbiAgICAgIGF1dGhUeXBlOiBsYW1iZGEuRnVuY3Rpb25VcmxBdXRoVHlwZS5OT05FLFxuICAgICAgY29yczoge1xuICAgICAgICBhbGxvd0NyZWRlbnRpYWxzOiBmYWxzZSxcbiAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxuICAgICAgICBhbGxvd2VkTWV0aG9kczogW2xhbWJkYS5IdHRwTWV0aG9kLkFMTF0sXG4gICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCBjb2FjaGluZ1NlcnZpY2VVcmwgPSBjb2FjaGluZ1NlcnZpY2VMYW1iZGEuYWRkRnVuY3Rpb25Vcmwoe1xuICAgICAgYXV0aFR5cGU6IGxhbWJkYS5GdW5jdGlvblVybEF1dGhUeXBlLk5PTkUsXG4gICAgICBjb3JzOiB7XG4gICAgICAgIGFsbG93Q3JlZGVudGlhbHM6IGZhbHNlLFxuICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXG4gICAgICAgIGFsbG93ZWRNZXRob2RzOiBbbGFtYmRhLkh0dHBNZXRob2QuQUxMXSxcbiAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGFuYWx5dGljc1NlcnZpY2VVcmwgPSBhbmFseXRpY3NTZXJ2aWNlTGFtYmRhLmFkZEZ1bmN0aW9uVXJsKHtcbiAgICAgIGF1dGhUeXBlOiBsYW1iZGEuRnVuY3Rpb25VcmxBdXRoVHlwZS5OT05FLFxuICAgICAgY29yczoge1xuICAgICAgICBhbGxvd0NyZWRlbnRpYWxzOiBmYWxzZSxcbiAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxuICAgICAgICBhbGxvd2VkTWV0aG9kczogW2xhbWJkYS5IdHRwTWV0aG9kLkFMTF0sXG4gICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCBudXRyaXRpb25TZXJ2aWNlVXJsID0gbnV0cml0aW9uU2VydmljZUxhbWJkYS5hZGRGdW5jdGlvblVybCh7XG4gICAgICBhdXRoVHlwZTogbGFtYmRhLkZ1bmN0aW9uVXJsQXV0aFR5cGUuTk9ORSxcbiAgICAgIGNvcnM6IHtcbiAgICAgICAgYWxsb3dDcmVkZW50aWFsczogZmFsc2UsXG4gICAgICAgIGFsbG93ZWRIZWFkZXJzOiBbJyonXSxcbiAgICAgICAgYWxsb3dlZE1ldGhvZHM6IFtsYW1iZGEuSHR0cE1ldGhvZC5BTExdLFxuICAgICAgICBhbGxvd2VkT3JpZ2luczogWycqJ10sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgY29uc3QgYWlTZXJ2aWNlVXJsID0gYWlTZXJ2aWNlTGFtYmRhLmFkZEZ1bmN0aW9uVXJsKHtcbiAgICAgIGF1dGhUeXBlOiBsYW1iZGEuRnVuY3Rpb25VcmxBdXRoVHlwZS5OT05FLFxuICAgICAgY29yczoge1xuICAgICAgICBhbGxvd0NyZWRlbnRpYWxzOiBmYWxzZSxcbiAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxuICAgICAgICBhbGxvd2VkTWV0aG9kczogW2xhbWJkYS5IdHRwTWV0aG9kLkFMTF0sXG4gICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCBub3RpZmljYXRpb25TZXJ2aWNlVXJsID0gbm90aWZpY2F0aW9uU2VydmljZUxhbWJkYS5hZGRGdW5jdGlvblVybCh7XG4gICAgICBhdXRoVHlwZTogbGFtYmRhLkZ1bmN0aW9uVXJsQXV0aFR5cGUuTk9ORSxcbiAgICAgIGNvcnM6IHtcbiAgICAgICAgYWxsb3dDcmVkZW50aWFsczogZmFsc2UsXG4gICAgICAgIGFsbG93ZWRIZWFkZXJzOiBbJyonXSxcbiAgICAgICAgYWxsb3dlZE1ldGhvZHM6IFtsYW1iZGEuSHR0cE1ldGhvZC5BTExdLFxuICAgICAgICBhbGxvd2VkT3JpZ2luczogWycqJ10sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIENsb3VkRnJvbnQgRGlzdHJpYnV0aW9uIHdpdGggTGFtYmRhIEZ1bmN0aW9uIFVSTHMgYXMgb3JpZ2luc1xuICAgIGNvbnN0IHVzZXJQcm9maWxlRG9tYWluID0gY2RrLkZuLnNlbGVjdChcbiAgICAgIDIsXG4gICAgICBjZGsuRm4uc3BsaXQoJy8nLCB1c2VyUHJvZmlsZVNlcnZpY2VVcmwudXJsKVxuICAgICk7XG4gICAgY29uc3Qgd29ya291dERvbWFpbiA9IGNkay5Gbi5zZWxlY3QoXG4gICAgICAyLFxuICAgICAgY2RrLkZuLnNwbGl0KCcvJywgd29ya291dFNlcnZpY2VVcmwudXJsKVxuICAgICk7XG4gICAgY29uc3QgY29hY2hpbmdEb21haW4gPSBjZGsuRm4uc2VsZWN0KFxuICAgICAgMixcbiAgICAgIGNkay5Gbi5zcGxpdCgnLycsIGNvYWNoaW5nU2VydmljZVVybC51cmwpXG4gICAgKTtcbiAgICBjb25zdCBhbmFseXRpY3NEb21haW4gPSBjZGsuRm4uc2VsZWN0KFxuICAgICAgMixcbiAgICAgIGNkay5Gbi5zcGxpdCgnLycsIGFuYWx5dGljc1NlcnZpY2VVcmwudXJsKVxuICAgICk7XG4gICAgY29uc3QgbnV0cml0aW9uRG9tYWluID0gY2RrLkZuLnNlbGVjdChcbiAgICAgIDIsXG4gICAgICBjZGsuRm4uc3BsaXQoJy8nLCBudXRyaXRpb25TZXJ2aWNlVXJsLnVybClcbiAgICApO1xuICAgIGNvbnN0IGFpRG9tYWluID0gY2RrLkZuLnNlbGVjdCgyLCBjZGsuRm4uc3BsaXQoJy8nLCBhaVNlcnZpY2VVcmwudXJsKSk7XG4gICAgY29uc3Qgbm90aWZpY2F0aW9uRG9tYWluID0gY2RrLkZuLnNlbGVjdChcbiAgICAgIDIsXG4gICAgICBjZGsuRm4uc3BsaXQoJy8nLCBub3RpZmljYXRpb25TZXJ2aWNlVXJsLnVybClcbiAgICApO1xuXG4gICAgLy8gQ3JlYXRlIENsb3VkRnJvbnQgRnVuY3Rpb24gZm9yIFVSTCByZXdyaXRpbmcgKGhhbmRsZXMgU1BBIHJvdXRpbmcpXG4gICAgY29uc3QgdXJsUmV3cml0ZUZ1bmN0aW9uID0gbmV3IGNsb3VkZnJvbnQuRnVuY3Rpb24oXG4gICAgICB0aGlzLFxuICAgICAgJ1VybFJld3JpdGVGdW5jdGlvbicsXG4gICAgICB7XG4gICAgICAgIGZ1bmN0aW9uTmFtZTogJ3VybC1yZXdyaXRlLWZ1bmN0aW9uJyxcbiAgICAgICAgY29kZTogY2xvdWRmcm9udC5GdW5jdGlvbkNvZGUuZnJvbUlubGluZShgXG4gICAgICAgIGZ1bmN0aW9uIGhhbmRsZXIoZXZlbnQpIHtcbiAgICAgICAgICB2YXIgcmVxdWVzdCA9IGV2ZW50LnJlcXVlc3Q7XG4gICAgICAgICAgdmFyIHVyaSA9IHJlcXVlc3QudXJpO1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIENoZWNrIGlmIHRoZSBVUkkgaXMgYXNraW5nIGZvciBhIGZpbGUgd2l0aCBhbiBleHRlbnNpb25cbiAgICAgICAgICBpZiAodXJpLmluY2x1ZGVzKCcuJykpIHtcbiAgICAgICAgICAgIHJldHVybiByZXF1ZXN0O1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICAvLyBIYW5kbGUgcm9vdCBwYXRoXG4gICAgICAgICAgaWYgKHVyaSA9PT0gJy8nKSB7XG4gICAgICAgICAgICByZXF1ZXN0LnVyaSA9ICcvaW5kZXguaHRtbCc7XG4gICAgICAgICAgICByZXR1cm4gcmVxdWVzdDtcbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgLy8gQ2hlY2sgaWYgdGhlIFVSSSBlbmRzIHdpdGggYSBzbGFzaFxuICAgICAgICAgIGlmICh1cmkuZW5kc1dpdGgoJy8nKSkge1xuICAgICAgICAgICAgLy8gVVJJIGhhcyB0cmFpbGluZyBzbGFzaCwgYXBwZW5kIGluZGV4Lmh0bWxcbiAgICAgICAgICAgIHJlcXVlc3QudXJpICs9ICdpbmRleC5odG1sJztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gVVJJIGRvZXNuJ3QgaGF2ZSB0cmFpbGluZyBzbGFzaCwgcmVkaXJlY3QgdG8gdmVyc2lvbiB3aXRoIHRyYWlsaW5nIHNsYXNoXG4gICAgICAgICAgICAvLyBieSBhcHBlbmRpbmcgL2luZGV4Lmh0bWwgKGVxdWl2YWxlbnQgdG8gYWRkaW5nIHRyYWlsaW5nIHNsYXNoICsgaW5kZXguaHRtbClcbiAgICAgICAgICAgIHJlcXVlc3QudXJpICs9ICcvaW5kZXguaHRtbCc7XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIHJldHVybiByZXF1ZXN0O1xuICAgICAgICB9XG4gICAgICBgKSxcbiAgICAgICAgY29tbWVudDpcbiAgICAgICAgICAnVVJMIHJld3JpdGUgZnVuY3Rpb24gZm9yIFNQQSByb3V0aW5nIHdpdGggdHJhaWxpbmcgc2xhc2ggc3VwcG9ydCcsXG4gICAgICB9XG4gICAgKTtcblxuICAgIHRoaXMuZGlzdHJpYnV0aW9uID0gbmV3IGNsb3VkZnJvbnQuRGlzdHJpYnV0aW9uKFxuICAgICAgdGhpcyxcbiAgICAgICdHeW1Db2FjaEFJRGlzdHJpYnV0aW9uJyxcbiAgICAgIHtcbiAgICAgICAgZGVmYXVsdFJvb3RPYmplY3Q6ICdpbmRleC5odG1sJyxcbiAgICAgICAgZGVmYXVsdEJlaGF2aW9yOiB7XG4gICAgICAgICAgb3JpZ2luOiBvcmlnaW5zLlMzQnVja2V0T3JpZ2luLndpdGhPcmlnaW5BY2Nlc3NJZGVudGl0eShcbiAgICAgICAgICAgIHRoaXMuZnJvbnRlbmRCdWNrZXQsXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIG9yaWdpbkFjY2Vzc0lkZW50aXR5OiBmcm9udGVuZE9BSSxcbiAgICAgICAgICAgIH1cbiAgICAgICAgICApLFxuICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OlxuICAgICAgICAgICAgY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgICBhbGxvd2VkTWV0aG9kczogY2xvdWRmcm9udC5BbGxvd2VkTWV0aG9kcy5BTExPV19HRVRfSEVBRF9PUFRJT05TLFxuICAgICAgICAgIGNhY2hlUG9saWN5OiBuZXcgY2xvdWRmcm9udC5DYWNoZVBvbGljeSh0aGlzLCAnRnJvbnRlbmRDYWNoZVBvbGljeScsIHtcbiAgICAgICAgICAgIGNhY2hlUG9saWN5TmFtZTogJ2Zyb250ZW5kLWNhY2hlLXBvbGljeScsXG4gICAgICAgICAgICBkZWZhdWx0VHRsOiBjZGsuRHVyYXRpb24uaG91cnMoMjQpLFxuICAgICAgICAgICAgbWF4VHRsOiBjZGsuRHVyYXRpb24uZGF5cygzNjUpLFxuICAgICAgICAgICAgbWluVHRsOiBjZGsuRHVyYXRpb24uc2Vjb25kcygwKSxcbiAgICAgICAgICAgIGhlYWRlckJlaGF2aW9yOiBjbG91ZGZyb250LkNhY2hlSGVhZGVyQmVoYXZpb3IuYWxsb3dMaXN0KFxuICAgICAgICAgICAgICAnQ2xvdWRGcm9udC1WaWV3ZXItQ291bnRyeSdcbiAgICAgICAgICAgICksXG4gICAgICAgICAgICBxdWVyeVN0cmluZ0JlaGF2aW9yOiBjbG91ZGZyb250LkNhY2hlUXVlcnlTdHJpbmdCZWhhdmlvci5hbGwoKSxcbiAgICAgICAgICAgIGNvb2tpZUJlaGF2aW9yOiBjbG91ZGZyb250LkNhY2hlQ29va2llQmVoYXZpb3Iubm9uZSgpLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIGZ1bmN0aW9uQXNzb2NpYXRpb25zOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGZ1bmN0aW9uOiB1cmxSZXdyaXRlRnVuY3Rpb24sXG4gICAgICAgICAgICAgIGV2ZW50VHlwZTogY2xvdWRmcm9udC5GdW5jdGlvbkV2ZW50VHlwZS5WSUVXRVJfUkVRVUVTVCxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgICAgYWRkaXRpb25hbEJlaGF2aW9yczoge1xuICAgICAgICAgIC8vICcvYXBpL3VzZXJzLyonOiB7XG4gICAgICAgICAgLy8gICBvcmlnaW46IG5ldyBvcmlnaW5zLkh0dHBPcmlnaW4odXNlclNlcnZpY2VVcmwudXJsKSxcbiAgICAgICAgICAvLyAgIHZpZXdlclByb3RvY29sUG9saWN5OlxuICAgICAgICAgIC8vICAgICBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgIC8vICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfQUxMLFxuICAgICAgICAgIC8vICAgY2FjaGVQb2xpY3k6IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3kuQ0FDSElOR19ESVNBQkxFRCxcbiAgICAgICAgICAvLyAgIG9yaWdpblJlcXVlc3RQb2xpY3k6XG4gICAgICAgICAgLy8gICAgIGNsb3VkZnJvbnQuT3JpZ2luUmVxdWVzdFBvbGljeS5BTExfVklFV0VSX0VYQ0VQVF9IT1NUX0hFQURFUixcbiAgICAgICAgICAvLyB9LFxuICAgICAgICAgICcvYXBpL3VzZXItcHJvZmlsZXMvKic6IHtcbiAgICAgICAgICAgIG9yaWdpbjogbmV3IG9yaWdpbnMuSHR0cE9yaWdpbih1c2VyUHJvZmlsZURvbWFpbiksXG4gICAgICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTpcbiAgICAgICAgICAgICAgY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0FMTCxcbiAgICAgICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfRElTQUJMRUQsXG4gICAgICAgICAgICBvcmlnaW5SZXF1ZXN0UG9saWN5OlxuICAgICAgICAgICAgICBjbG91ZGZyb250Lk9yaWdpblJlcXVlc3RQb2xpY3kuQUxMX1ZJRVdFUl9FWENFUFRfSE9TVF9IRUFERVIsXG4gICAgICAgICAgfSxcbiAgICAgICAgICAnL2FwaS93b3Jrb3V0cy8qJzoge1xuICAgICAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5IdHRwT3JpZ2luKHdvcmtvdXREb21haW4pLFxuICAgICAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6XG4gICAgICAgICAgICAgIGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgICAgICBhbGxvd2VkTWV0aG9kczogY2xvdWRmcm9udC5BbGxvd2VkTWV0aG9kcy5BTExPV19BTEwsXG4gICAgICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX0RJU0FCTEVELFxuICAgICAgICAgICAgb3JpZ2luUmVxdWVzdFBvbGljeTpcbiAgICAgICAgICAgICAgY2xvdWRmcm9udC5PcmlnaW5SZXF1ZXN0UG9saWN5LkFMTF9WSUVXRVJfRVhDRVBUX0hPU1RfSEVBREVSLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgJy9hcGkvY29hY2hpbmcvKic6IHtcbiAgICAgICAgICAgIG9yaWdpbjogbmV3IG9yaWdpbnMuSHR0cE9yaWdpbihjb2FjaGluZ0RvbWFpbiksXG4gICAgICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTpcbiAgICAgICAgICAgICAgY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0FMTCxcbiAgICAgICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfRElTQUJMRUQsXG4gICAgICAgICAgICBvcmlnaW5SZXF1ZXN0UG9saWN5OlxuICAgICAgICAgICAgICBjbG91ZGZyb250Lk9yaWdpblJlcXVlc3RQb2xpY3kuQUxMX1ZJRVdFUl9FWENFUFRfSE9TVF9IRUFERVIsXG4gICAgICAgICAgfSxcbiAgICAgICAgICAnL2FwaS9hbmFseXRpY3MvKic6IHtcbiAgICAgICAgICAgIG9yaWdpbjogbmV3IG9yaWdpbnMuSHR0cE9yaWdpbihhbmFseXRpY3NEb21haW4pLFxuICAgICAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6XG4gICAgICAgICAgICAgIGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgICAgICBhbGxvd2VkTWV0aG9kczogY2xvdWRmcm9udC5BbGxvd2VkTWV0aG9kcy5BTExPV19BTEwsXG4gICAgICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX0RJU0FCTEVELFxuICAgICAgICAgICAgb3JpZ2luUmVxdWVzdFBvbGljeTpcbiAgICAgICAgICAgICAgY2xvdWRmcm9udC5PcmlnaW5SZXF1ZXN0UG9saWN5LkFMTF9WSUVXRVJfRVhDRVBUX0hPU1RfSEVBREVSLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgJy9hcGkvbnV0cml0aW9uLyonOiB7XG4gICAgICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLkh0dHBPcmlnaW4obnV0cml0aW9uRG9tYWluKSxcbiAgICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OlxuICAgICAgICAgICAgICBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfQUxMLFxuICAgICAgICAgICAgY2FjaGVQb2xpY3k6IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3kuQ0FDSElOR19ESVNBQkxFRCxcbiAgICAgICAgICAgIG9yaWdpblJlcXVlc3RQb2xpY3k6XG4gICAgICAgICAgICAgIGNsb3VkZnJvbnQuT3JpZ2luUmVxdWVzdFBvbGljeS5BTExfVklFV0VSX0VYQ0VQVF9IT1NUX0hFQURFUixcbiAgICAgICAgICB9LFxuICAgICAgICAgICcvYXBpL2FpLyonOiB7XG4gICAgICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLkh0dHBPcmlnaW4oYWlEb21haW4sIHtcbiAgICAgICAgICAgICAgY29ubmVjdGlvblRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDEwKSxcbiAgICAgICAgICAgICAgY29ubmVjdGlvbkF0dGVtcHRzOiAzLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTpcbiAgICAgICAgICAgICAgY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0FMTCxcbiAgICAgICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfRElTQUJMRUQsXG4gICAgICAgICAgICBvcmlnaW5SZXF1ZXN0UG9saWN5OlxuICAgICAgICAgICAgICBjbG91ZGZyb250Lk9yaWdpblJlcXVlc3RQb2xpY3kuQUxMX1ZJRVdFUl9FWENFUFRfSE9TVF9IRUFERVIsXG4gICAgICAgICAgfSxcbiAgICAgICAgICAnL2FwaS9ub3RpZmljYXRpb25zLyonOiB7XG4gICAgICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLkh0dHBPcmlnaW4obm90aWZpY2F0aW9uRG9tYWluKSxcbiAgICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OlxuICAgICAgICAgICAgICBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfQUxMLFxuICAgICAgICAgICAgY2FjaGVQb2xpY3k6IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3kuQ0FDSElOR19ESVNBQkxFRCxcbiAgICAgICAgICAgIG9yaWdpblJlcXVlc3RQb2xpY3k6XG4gICAgICAgICAgICAgIGNsb3VkZnJvbnQuT3JpZ2luUmVxdWVzdFBvbGljeS5BTExfVklFV0VSX0VYQ0VQVF9IT1NUX0hFQURFUixcbiAgICAgICAgICB9LFxuICAgICAgICAgICcvcHJvZ3Jlc3MtcGhvdG9zLyonOiB7XG4gICAgICAgICAgICBvcmlnaW46IG9yaWdpbnMuUzNCdWNrZXRPcmlnaW4ud2l0aE9yaWdpbkFjY2Vzc0lkZW50aXR5KFxuICAgICAgICAgICAgICB0aGlzLnByb2dyZXNzUGhvdG9zQnVja2V0LFxuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgb3JpZ2luQWNjZXNzSWRlbnRpdHk6IHByb2dyZXNzUGhvdG9zT0FJLFxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICApLFxuICAgICAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6XG4gICAgICAgICAgICAgIGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgICAgICBhbGxvd2VkTWV0aG9kczogY2xvdWRmcm9udC5BbGxvd2VkTWV0aG9kcy5BTExPV19HRVRfSEVBRCxcbiAgICAgICAgICAgIGNhY2hlUG9saWN5OiBuZXcgY2xvdWRmcm9udC5DYWNoZVBvbGljeShcbiAgICAgICAgICAgICAgdGhpcyxcbiAgICAgICAgICAgICAgJ1Byb2dyZXNzUGhvdG9zQ2FjaGVQb2xpY3knLFxuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY2FjaGVQb2xpY3lOYW1lOiAncHJvZ3Jlc3MtcGhvdG9zLWNhY2hlLXBvbGljeScsXG4gICAgICAgICAgICAgICAgZGVmYXVsdFR0bDogY2RrLkR1cmF0aW9uLmhvdXJzKDI0KSxcbiAgICAgICAgICAgICAgICBtYXhUdGw6IGNkay5EdXJhdGlvbi5kYXlzKDM2NSksXG4gICAgICAgICAgICAgICAgbWluVHRsOiBjZGsuRHVyYXRpb24uc2Vjb25kcygwKSxcbiAgICAgICAgICAgICAgICBoZWFkZXJCZWhhdmlvcjogY2xvdWRmcm9udC5DYWNoZUhlYWRlckJlaGF2aW9yLmFsbG93TGlzdChcbiAgICAgICAgICAgICAgICAgICdDbG91ZEZyb250LVZpZXdlci1Db3VudHJ5J1xuICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICAgcXVlcnlTdHJpbmdCZWhhdmlvcjogY2xvdWRmcm9udC5DYWNoZVF1ZXJ5U3RyaW5nQmVoYXZpb3Iubm9uZSgpLFxuICAgICAgICAgICAgICAgIGNvb2tpZUJlaGF2aW9yOiBjbG91ZGZyb250LkNhY2hlQ29va2llQmVoYXZpb3Iubm9uZSgpLFxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICApLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIGNvbW1lbnQ6ICdHeW1Db2FjaCBBSSBDbG91ZEZyb250IERpc3RyaWJ1dGlvbicsXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIEdyYW50IHBlcm1pc3Npb25zIHRvIExhbWJkYSBmdW5jdGlvbnMgZm9yIFMzIGFjY2Vzc1xuICAgIHRoaXMudXNlclVwbG9hZHNCdWNrZXQuZ3JhbnRSZWFkV3JpdGUodXNlclByb2ZpbGVTZXJ2aWNlTGFtYmRhKTtcbiAgICB0aGlzLnVzZXJVcGxvYWRzQnVja2V0LmdyYW50UmVhZFdyaXRlKHdvcmtvdXRTZXJ2aWNlTGFtYmRhKTtcbiAgICB0aGlzLnVzZXJVcGxvYWRzQnVja2V0LmdyYW50UmVhZFdyaXRlKGFuYWx5dGljc1NlcnZpY2VMYW1iZGEpO1xuXG4gICAgdGhpcy5wcm9jZXNzZWRJbWFnZXNCdWNrZXQuZ3JhbnRSZWFkV3JpdGUodXNlclByb2ZpbGVTZXJ2aWNlTGFtYmRhKTtcbiAgICB0aGlzLnByb2Nlc3NlZEltYWdlc0J1Y2tldC5ncmFudFJlYWRXcml0ZSh3b3Jrb3V0U2VydmljZUxhbWJkYSk7XG4gICAgdGhpcy5wcm9jZXNzZWRJbWFnZXNCdWNrZXQuZ3JhbnRSZWFkV3JpdGUoYW5hbHl0aWNzU2VydmljZUxhbWJkYSk7XG5cbiAgICAvLyBHcmFudCBhbmFseXRpY3Mgc2VydmljZSBmdWxsIGFjY2VzcyB0byBwcm9ncmVzcyBwaG90b3MgYnVja2V0XG4gICAgdGhpcy5wcm9ncmVzc1Bob3Rvc0J1Y2tldC5ncmFudFJlYWRXcml0ZShhbmFseXRpY3NTZXJ2aWNlTGFtYmRhKTtcblxuICAgIC8vIEFsbG93IHNlcnZpY2UgdG8gcmVhZCBmcm9tIHRoZSBtYWluIER5bmFtb0RCIHRhYmxlXG4gICAgdGhpcy5tYWluVGFibGUuZ3JhbnRSZWFkRGF0YShhbmFseXRpY3NTZXJ2aWNlTGFtYmRhKTtcbiAgICB0aGlzLm1haW5UYWJsZS5ncmFudFJlYWREYXRhKG51dHJpdGlvblNlcnZpY2VMYW1iZGEpO1xuICAgIHRoaXMubWFpblRhYmxlLmdyYW50UmVhZERhdGEodXNlclByb2ZpbGVTZXJ2aWNlTGFtYmRhKTtcbiAgICB0aGlzLm1haW5UYWJsZS5ncmFudFJlYWREYXRhKHdvcmtvdXRTZXJ2aWNlTGFtYmRhKTtcbiAgICB0aGlzLm1haW5UYWJsZS5ncmFudFJlYWREYXRhKGNvYWNoaW5nU2VydmljZUxhbWJkYSk7XG4gICAgdGhpcy5tYWluVGFibGUuZ3JhbnRSZWFkRGF0YShhaVNlcnZpY2VMYW1iZGEpO1xuICAgIHRoaXMubWFpblRhYmxlLmdyYW50V3JpdGVEYXRhKGFuYWx5dGljc1NlcnZpY2VMYW1iZGEpO1xuICAgIHRoaXMubWFpblRhYmxlLmdyYW50V3JpdGVEYXRhKG51dHJpdGlvblNlcnZpY2VMYW1iZGEpO1xuICAgIHRoaXMubWFpblRhYmxlLmdyYW50V3JpdGVEYXRhKHVzZXJQcm9maWxlU2VydmljZUxhbWJkYSk7XG4gICAgdGhpcy5tYWluVGFibGUuZ3JhbnRXcml0ZURhdGEod29ya291dFNlcnZpY2VMYW1iZGEpO1xuICAgIHRoaXMubWFpblRhYmxlLmdyYW50V3JpdGVEYXRhKGNvYWNoaW5nU2VydmljZUxhbWJkYSk7XG4gICAgdGhpcy5tYWluVGFibGUuZ3JhbnRXcml0ZURhdGEoYWlTZXJ2aWNlTGFtYmRhKTtcblxuICAgIC8vIEVuc3VyZSBudXRyaXRpb24gc2VydmljZSBjYW4gUXVlcnkgR1NJcyBleHBsaWNpdGx5XG4gICAgbnV0cml0aW9uU2VydmljZUxhbWJkYS5hZGRUb1JvbGVQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogWydkeW5hbW9kYjpRdWVyeScsICdkeW5hbW9kYjpHZXRJdGVtJ10sXG4gICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgIHRoaXMubWFpblRhYmxlLnRhYmxlQXJuLFxuICAgICAgICAgIGAke3RoaXMubWFpblRhYmxlLnRhYmxlQXJufS9pbmRleC8qYCxcbiAgICAgICAgXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIEdyYW50IEFJIHNlcnZpY2UgQmVkcm9jayBwZXJtaXNzaW9uc1xuICAgIGFpU2VydmljZUxhbWJkYS5hZGRUb1JvbGVQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICdiZWRyb2NrOkludm9rZU1vZGVsJyxcbiAgICAgICAgICAnYmVkcm9jazpJbnZva2VNb2RlbFdpdGhSZXNwb25zZVN0cmVhbScsXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogWydhcm46YXdzOmJlZHJvY2s6Kjo6Zm91bmRhdGlvbi1tb2RlbC9kZWVwc2Vlay52My12MTowJ10sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBHcmFudCBBSSBzZXJ2aWNlIENvZ25pdG8gcGVybWlzc2lvbnNcbiAgICBhaVNlcnZpY2VMYW1iZGEuYWRkVG9Sb2xlUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAnY29nbml0by1pZHA6QWRtaW5MaXN0R3JvdXBzRm9yVXNlcicsXG4gICAgICAgICAgJ2NvZ25pdG8taWRwOkFkbWluR2V0VXNlcicsXG4gICAgICAgICAgJ2NvZ25pdG8taWRwOkxpc3RVc2VycycsXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogW3RoaXMudXNlclBvb2wudXNlclBvb2xBcm5dLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gR3JhbnQgbm90aWZpY2F0aW9uIHNlcnZpY2UgcGVybWlzc2lvbnNcbiAgICBub3RpZmljYXRpb25TZXJ2aWNlTGFtYmRhLmFkZFRvUm9sZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgJ3NuczpQdWJsaXNoJyxcbiAgICAgICAgICAnc25zOkNyZWF0ZVBsYXRmb3JtRW5kcG9pbnQnLFxuICAgICAgICAgICdzbnM6RGVsZXRlRW5kcG9pbnQnLFxuICAgICAgICAgICdzbnM6R2V0RW5kcG9pbnRBdHRyaWJ1dGVzJyxcbiAgICAgICAgICAnc25zOlNldEVuZHBvaW50QXR0cmlidXRlcycsXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgIHdvcmtvdXRSZW1pbmRlcnNUb3BpYy50b3BpY0FybixcbiAgICAgICAgICBudXRyaXRpb25SZW1pbmRlcnNUb3BpYy50b3BpY0FybixcbiAgICAgICAgICBhY2hpZXZlbWVudFRvcGljLnRvcGljQXJuLFxuICAgICAgICAgIGFpU3VnZ2VzdGlvbnNUb3BpYy50b3BpY0FybixcbiAgICAgICAgICAnKicsIC8vIEFsbG93IGFjY2VzcyB0byBhbGwgU05TIHBsYXRmb3JtIGFwcGxpY2F0aW9uc1xuICAgICAgICBdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gR3JhbnQgbm90aWZpY2F0aW9uIHNjaGVkdWxlciBwZXJtaXNzaW9uc1xuICAgIG5vdGlmaWNhdGlvblNjaGVkdWxlckxhbWJkYS5hZGRUb1JvbGVQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogWydsYW1iZGE6SW52b2tlRnVuY3Rpb24nXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbbm90aWZpY2F0aW9uU2VydmljZUxhbWJkYS5mdW5jdGlvbkFybl0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBBZGQgRXZlbnRCcmlkZ2UgdGFyZ2V0c1xuICAgIHdvcmtvdXRSZW1pbmRlclJ1bGUuYWRkVGFyZ2V0KFxuICAgICAgbmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24obm90aWZpY2F0aW9uU2NoZWR1bGVyTGFtYmRhKVxuICAgICk7XG4gICAgbnV0cml0aW9uUmVtaW5kZXJSdWxlLmFkZFRhcmdldChcbiAgICAgIG5ldyB0YXJnZXRzLkxhbWJkYUZ1bmN0aW9uKG5vdGlmaWNhdGlvblNjaGVkdWxlckxhbWJkYSlcbiAgICApO1xuICAgIHdhdGVyUmVtaW5kZXJSdWxlLmFkZFRhcmdldChcbiAgICAgIG5ldyB0YXJnZXRzLkxhbWJkYUZ1bmN0aW9uKG5vdGlmaWNhdGlvblNjaGVkdWxlckxhbWJkYSlcbiAgICApO1xuICAgIHByb2dyZXNzUGhvdG9SdWxlLmFkZFRhcmdldChcbiAgICAgIG5ldyB0YXJnZXRzLkxhbWJkYUZ1bmN0aW9uKG5vdGlmaWNhdGlvblNjaGVkdWxlckxhbWJkYSlcbiAgICApO1xuXG4gICAgLy8gUmVtb3ZlZCBDbG91ZFdhdGNoIExvZyBHcm91cHMgdG8gYXZvaWQgY29zdHNcbiAgICAvLyBMYW1iZGEgZnVuY3Rpb25zIHdpbGwgdXNlIGRlZmF1bHQgbG9nIGdyb3VwcyAoZnJlZSB0aWVyOiA1R0IvbW9udGgpXG5cbiAgICAvLyBPdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1VzZXJQb29sSWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgZGVzY3JpcHRpb246ICdDb2duaXRvIFVzZXIgUG9vbCBJRCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclBvb2xDbGllbnRJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvZ25pdG8gVXNlciBQb29sIENsaWVudCBJRCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclBvb2xEb21haW4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy51c2VyUG9vbERvbWFpbi5kb21haW5OYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdDb2duaXRvIFVzZXIgUG9vbCBEb21haW4nLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Nsb3VkRnJvbnRVcmwnLCB7XG4gICAgICB2YWx1ZTogYGh0dHBzOi8vJHt0aGlzLmRpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25Eb21haW5OYW1lfWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ0Nsb3VkRnJvbnQgRGlzdHJpYnV0aW9uIFVSTCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVGFibGVOYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMubWFpblRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRHluYW1vREIgVGFibGUgTmFtZScsXG4gICAgfSk7XG5cbiAgICAvLyBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclNlcnZpY2VVcmwnLCB7XG4gICAgLy8gICB2YWx1ZTogdXNlclNlcnZpY2VVcmwudXJsLFxuICAgIC8vICAgZGVzY3JpcHRpb246ICdVc2VyIFNlcnZpY2UgTGFtYmRhIEZ1bmN0aW9uIFVSTCcsXG4gICAgLy8gfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclByb2ZpbGVTZXJ2aWNlVXJsJywge1xuICAgICAgdmFsdWU6IHVzZXJQcm9maWxlU2VydmljZVVybC51cmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ1VzZXIgUHJvZmlsZSBTZXJ2aWNlIExhbWJkYSBGdW5jdGlvbiBVUkwnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1dvcmtvdXRTZXJ2aWNlVXJsJywge1xuICAgICAgdmFsdWU6IHdvcmtvdXRTZXJ2aWNlVXJsLnVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnV29ya291dCBTZXJ2aWNlIExhbWJkYSBGdW5jdGlvbiBVUkwnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0NvYWNoaW5nU2VydmljZVVybCcsIHtcbiAgICAgIHZhbHVlOiBjb2FjaGluZ1NlcnZpY2VVcmwudXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdDb2FjaGluZyBTZXJ2aWNlIExhbWJkYSBGdW5jdGlvbiBVUkwnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FuYWx5dGljc1NlcnZpY2VVcmwnLCB7XG4gICAgICB2YWx1ZTogYW5hbHl0aWNzU2VydmljZVVybC51cmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FuYWx5dGljcyBTZXJ2aWNlIExhbWJkYSBGdW5jdGlvbiBVUkwnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ051dHJpdGlvblNlcnZpY2VVcmwnLCB7XG4gICAgICB2YWx1ZTogbnV0cml0aW9uU2VydmljZVVybC51cmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ051dHJpdGlvbiBTZXJ2aWNlIExhbWJkYSBGdW5jdGlvbiBVUkwnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FJU2VydmljZVVybCcsIHtcbiAgICAgIHZhbHVlOiBhaVNlcnZpY2VVcmwudXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdBSSBTZXJ2aWNlIExhbWJkYSBGdW5jdGlvbiBVUkwnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ05vdGlmaWNhdGlvblNlcnZpY2VVcmwnLCB7XG4gICAgICB2YWx1ZTogbm90aWZpY2F0aW9uU2VydmljZVVybC51cmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ05vdGlmaWNhdGlvbiBTZXJ2aWNlIExhbWJkYSBGdW5jdGlvbiBVUkwnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1VzZXJVcGxvYWRzQnVja2V0TmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnVzZXJVcGxvYWRzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1VzZXIgVXBsb2FkcyBTMyBCdWNrZXQgTmFtZScsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnU3RhdGljQXNzZXRzQnVja2V0TmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnN0YXRpY0Fzc2V0c0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdTdGF0aWMgQXNzZXRzIFMzIEJ1Y2tldCBOYW1lJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdQcm9jZXNzZWRJbWFnZXNCdWNrZXROYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMucHJvY2Vzc2VkSW1hZ2VzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1Byb2Nlc3NlZCBJbWFnZXMgUzMgQnVja2V0IE5hbWUnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Zyb250ZW5kQnVja2V0TmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmZyb250ZW5kQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0Zyb250ZW5kIFMzIEJ1Y2tldCBOYW1lJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDbG91ZEZyb250RGlzdHJpYnV0aW9uVVJMJywge1xuICAgICAgdmFsdWU6IGBodHRwczovLyR7dGhpcy5kaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uRG9tYWluTmFtZX1gLFxuICAgICAgZGVzY3JpcHRpb246ICdDbG91ZEZyb250IERpc3RyaWJ1dGlvbiBVUkwnLFxuICAgIH0pO1xuXG4gICAgLy8gUmVtb3ZlZCBtb25pdG9yaW5nIHN0YWNrIHRvIGF2b2lkIENsb3VkV2F0Y2ggY29zdHNcbiAgICAvLyB0aGlzLmNyZWF0ZU1vbml0b3JpbmdTdGFjaygpO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVMYW1iZGFGdW5jdGlvbihcbiAgICBuYW1lOiBzdHJpbmcsXG4gICAgc2VydmljZU5hbWU6IHN0cmluZyxcbiAgICBhZGRpdGlvbmFsRW52VmFycz86IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH1cbiAgKTogbGFtYmRhLkZ1bmN0aW9uIHtcbiAgICBjb25zdCBiYXNlRW52VmFycyA9IHtcbiAgICAgIFRBQkxFX05BTUU6IHRoaXMubWFpblRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIERZTkFNT0RCX1RBQkxFOiB0aGlzLm1haW5UYWJsZS50YWJsZU5hbWUsXG4gICAgICBVU0VSX1BPT0xfSUQ6IHRoaXMudXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgIFVTRVJfUE9PTF9DTElFTlRfSUQ6IHRoaXMudXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcbiAgICAgIFVTRVJfVVBMT0FEU19CVUNLRVQ6IHRoaXMudXNlclVwbG9hZHNCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIFNUQVRJQ19BU1NFVFNfQlVDS0VUOiB0aGlzLnN0YXRpY0Fzc2V0c0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgUFJPQ0VTU0VEX0lNQUdFU19CVUNLRVQ6IHRoaXMucHJvY2Vzc2VkSW1hZ2VzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBQUk9HUkVTU19QSE9UT1NfQlVDS0VUOiB0aGlzLnByb2dyZXNzUGhvdG9zQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBKV1RfU0VDUkVUOiAneW91ci1qd3Qtc2VjcmV0LWhlcmUnLCAvLyBJbiBwcm9kdWN0aW9uLCB1c2UgQVdTIFNlY3JldHMgTWFuYWdlclxuICAgICAgQ09HTklUT19SRUdJT046IHRoaXMucmVnaW9uLFxuICAgICAgQ09HTklUT19VU0VSX1BPT0xfSUQ6IHRoaXMudXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgIFJVU1RfTE9HOiAnaW5mbycsXG4gICAgICBSVVNUX0JBQ0tUUkFDRTogJzEnLFxuICAgIH07XG5cbiAgICBjb25zdCBlbnZWYXJzID0gYWRkaXRpb25hbEVudlZhcnNcbiAgICAgID8geyAuLi5iYXNlRW52VmFycywgLi4uYWRkaXRpb25hbEVudlZhcnMgfVxuICAgICAgOiBiYXNlRW52VmFycztcblxuICAgIHJldHVybiBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsIGAke25hbWV9TGFtYmRhYCwge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFJPVklERURfQUwyLFxuICAgICAgaGFuZGxlcjogJ2Jvb3RzdHJhcCcsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoXG4gICAgICAgIGAuLi9zZXJ2aWNlcy8ke3NlcnZpY2VOYW1lfS90YXJnZXQvbGFtYmRhLyR7c2VydmljZU5hbWV9YFxuICAgICAgKSxcbiAgICAgIGVudmlyb25tZW50OiBlbnZWYXJzLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LCAvLyBPcHRpbWl6ZWQgZm9yIGNvbGQgc3RhcnRzXG4gICAgICByZXNlcnZlZENvbmN1cnJlbnRFeGVjdXRpb25zOiAxMCwgLy8gUHJldmVudCBjb2xkIHN0YXJ0cyBkdXJpbmcgaGlnaCBsb2FkXG4gICAgICAvLyBSZW1vdmVkIGxvZyByZXRlbnRpb24gdG8gdXNlIGZyZWUgdGllciBkZWZhdWx0cyAoNUdCL21vbnRoIGZyZWUpXG4gICAgICAvLyBSZW1vdmVkIFgtUmF5IHRyYWNpbmcgdG8gYXZvaWQgY29zdHMgKCQ1IHBlciAxTSB0cmFjZXMpXG4gICAgICBsYXllcnM6IFt0aGlzLmNyZWF0ZUF1dGhMYXllcigpXSxcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlUHl0aG9uTGFtYmRhRnVuY3Rpb24oXG4gICAgbmFtZTogc3RyaW5nLFxuICAgIHNlcnZpY2VOYW1lOiBzdHJpbmdcbiAgKTogbGFtYmRhLkZ1bmN0aW9uIHtcbiAgICByZXR1cm4gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCBgJHtuYW1lfUxhbWJkYWAsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzExLFxuICAgICAgaGFuZGxlcjogJ2xhbWJkYV9mdW5jdGlvbi5sYW1iZGFfaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoYC4uL3NlcnZpY2VzLyR7c2VydmljZU5hbWV9YCksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBEWU5BTU9EQl9UQUJMRTogdGhpcy5tYWluVGFibGUudGFibGVOYW1lLFxuICAgICAgICBVU0VSX1BPT0xfSUQ6IHRoaXMudXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgICAgVVNFUl9QT09MX0NMSUVOVF9JRDogdGhpcy51c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkLFxuICAgICAgICBVU0VSX1VQTE9BRFNfQlVDS0VUOiB0aGlzLnVzZXJVcGxvYWRzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgIFNUQVRJQ19BU1NFVFNfQlVDS0VUOiB0aGlzLnN0YXRpY0Fzc2V0c0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBQUk9DRVNTRURfSU1BR0VTX0JVQ0tFVDogdGhpcy5wcm9jZXNzZWRJbWFnZXNCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgUFJPR1JFU1NfUEhPVE9TX0JVQ0tFVDogdGhpcy5wcm9ncmVzc1Bob3Rvc0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBKV1RfU0VDUkVUOiAneW91ci1qd3Qtc2VjcmV0LWhlcmUnLCAvLyBJbiBwcm9kdWN0aW9uLCB1c2UgQVdTIFNlY3JldHMgTWFuYWdlclxuICAgICAgICBDT0dOSVRPX1JFR0lPTjogdGhpcy5yZWdpb24sXG4gICAgICAgIENPR05JVE9fVVNFUl9QT09MX0lEOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICAgIFBZVEhPTlBBVEg6ICcvdmFyL3J1bnRpbWU6L3Zhci90YXNrJyxcbiAgICAgICAgLy8gQUkgU2VydmljZSBzcGVjaWZpYyBlbnZpcm9ubWVudCB2YXJpYWJsZXNcbiAgICAgICAgQkVEUk9DS19NT0RFTF9JRDogJ2RlZXBzZWVrLnYzLXYxOjAnLCAvLyBEZWVwU2VlayBtb2RlbCBhdmFpbGFibGUgaW4gZXUtbm9ydGgtMVxuICAgICAgICBSQVRFX0xJTUlUX0ZSRUVfVElFUjogJzEwJywgLy8gUmVxdWVzdHMgcGVyIGRheSBmb3IgZnJlZSB0aWVyXG4gICAgICAgIFJBVEVfTElNSVRfUFJFTUlVTV9USUVSOiAnNTAnLCAvLyBSZXF1ZXN0cyBwZXIgZGF5IGZvciBwcmVtaXVtIHRpZXJcbiAgICAgICAgUkFURV9MSU1JVF9IQVJEX0xJTUlUOiAnMTAwJywgLy8gSGFyZCBsaW1pdCB0byBwcmV2ZW50IGFidXNlXG4gICAgICAgIENPTlZFUlNBVElPTl9UVExfREFZUzogJzMwJywgLy8gVFRMIGZvciBjb252ZXJzYXRpb24gaGlzdG9yeVxuICAgICAgICBSQVRFX0xJTUlUX1RUTF9EQVlTOiAnNycsIC8vIFRUTCBmb3IgcmF0ZSBsaW1pdCByZWNvcmRzXG4gICAgICB9LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksIC8vIEFJIGZ1bmN0aW9ucyBtYXkgbmVlZCBtb3JlIHRpbWVcbiAgICAgIG1lbW9yeVNpemU6IDEwMjQsIC8vIEFJIGZ1bmN0aW9ucyBuZWVkIG1vcmUgbWVtb3J5XG4gICAgICByZXNlcnZlZENvbmN1cnJlbnRFeGVjdXRpb25zOiA1LCAvLyBMaW1pdCBjb25jdXJyZW50IGV4ZWN1dGlvbnMgZm9yIEFJIGZ1bmN0aW9uc1xuICAgICAgLy8gUmVtb3ZlZCBsb2cgcmV0ZW50aW9uIHRvIHVzZSBmcmVlIHRpZXIgZGVmYXVsdHMgKDVHQi9tb250aCBmcmVlKVxuICAgICAgLy8gUmVtb3ZlZCBYLVJheSB0cmFjaW5nIHRvIGF2b2lkIGNvc3RzICgkNSBwZXIgMU0gdHJhY2VzKVxuICAgICAgLy8gbGF5ZXJzOiBbdGhpcy5jcmVhdGVQeXRob25BdXRoTGF5ZXIoKV0sIC8vIFRlbXBvcmFyaWx5IGRpc2FibGVkXG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUF1dGhMYXllcigpOiBsYW1iZGEuTGF5ZXJWZXJzaW9uIHtcbiAgICBpZiAodGhpcy5hdXRoTGF5ZXIpIHtcbiAgICAgIHJldHVybiB0aGlzLmF1dGhMYXllcjtcbiAgICB9XG4gICAgdGhpcy5hdXRoTGF5ZXIgPSBuZXcgbGFtYmRhLkxheWVyVmVyc2lvbih0aGlzLCAnQXV0aExheWVyJywge1xuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9zZXJ2aWNlcy9hdXRoLWxheWVyL2xheWVyJyksXG4gICAgICBjb21wYXRpYmxlUnVudGltZXM6IFtsYW1iZGEuUnVudGltZS5QUk9WSURFRF9BTDJdLFxuICAgICAgZGVzY3JpcHRpb246XG4gICAgICAgICdBdXRoZW50aWNhdGlvbiBhbmQgYXV0aG9yaXphdGlvbiBsYXllciBmb3IgR3ltQ29hY2ggQUkgc2VydmljZXMnLFxuICAgIH0pO1xuICAgIHJldHVybiB0aGlzLmF1dGhMYXllcjtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlUHl0aG9uQXV0aExheWVyKCk6IGxhbWJkYS5MYXllclZlcnNpb24ge1xuICAgIGlmICh0aGlzLnB5dGhvbkF1dGhMYXllcikge1xuICAgICAgcmV0dXJuIHRoaXMucHl0aG9uQXV0aExheWVyO1xuICAgIH1cbiAgICB0aGlzLnB5dGhvbkF1dGhMYXllciA9IG5ldyBsYW1iZGEuTGF5ZXJWZXJzaW9uKHRoaXMsICdQeXRob25BdXRoTGF5ZXInLCB7XG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uL3NlcnZpY2VzL2FpLXNlcnZpY2UtcHl0aG9uL2xheWVyJyksXG4gICAgICBjb21wYXRpYmxlUnVudGltZXM6IFtsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMV0sXG4gICAgICBkZXNjcmlwdGlvbjogJ1B5dGhvbiBhdXRoZW50aWNhdGlvbiBsYXllciBmb3IgQUkgc2VydmljZXMnLFxuICAgIH0pO1xuICAgIHJldHVybiB0aGlzLnB5dGhvbkF1dGhMYXllcjtcbiAgfVxuXG4gIC8vIFJlbW92ZWQgY3JlYXRlTW9uaXRvcmluZ1N0YWNrIG1ldGhvZCB0byBhdm9pZCBDbG91ZFdhdGNoIGNvc3RzXG4gIC8vIHByaXZhdGUgY3JlYXRlTW9uaXRvcmluZ1N0YWNrKCkge1xuICAvLyAgIC8vIENyZWF0ZSBtb25pdG9yaW5nIHN0YWNrXG4gIC8vICAgbmV3IE1vbml0b3JpbmdTdGFjayh0aGlzLCAnTW9uaXRvcmluZ1N0YWNrJywge1xuICAvLyAgICAgbGFtYmRhRnVuY3Rpb25zOiBbXG4gIC8vICAgICAgIHRoaXMudXNlclNlcnZpY2VMYW1iZGEsXG4gIC8vICAgICAgIHRoaXMudXNlclByb2ZpbGVTZXJ2aWNlTGFtYmRhLFxuICAvLyAgICAgICB0aGlzLndvcmtvdXRTZXJ2aWNlTGFtYmRhLFxuICAvLyAgICAgICB0aGlzLmNvYWNoaW5nU2VydmljZUxhbWJkYSxcbiAgLy8gICAgICAgdGhpcy5hbmFseXRpY3NTZXJ2aWNlTGFtYmRhLFxuICAvLyAgICAgICB0aGlzLm51dHJpdGlvblNlcnZpY2VMYW1iZGEsXG4gIC8vICAgICAgIHRoaXMuYWlTZXJ2aWNlTGFtYmRhLFxuICAvLyAgICAgXSxcbiAgLy8gICAgIGR5bmFtb0RiVGFibGU6IHRoaXMubWFpblRhYmxlLFxuICAvLyAgICAgczNCdWNrZXRzOiBbXG4gIC8vICAgICAgIHRoaXMudXNlclVwbG9hZHNCdWNrZXQsXG4gIC8vICAgICAgIHRoaXMuc3RhdGljQXNzZXRzQnVja2V0LFxuICAvLyAgICAgICB0aGlzLnByb2Nlc3NlZEltYWdlc0J1Y2tldCxcbiAgLy8gICAgIF0sXG4gIC8vICAgfSk7XG4gIC8vIH1cbn1cbiJdfQ==