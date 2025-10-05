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
        // const aiServiceLambda = this.createPythonLambdaFunction(
        //   'AIService',
        //   'ai-service-python'
        // );
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
        // const aiServiceUrl = aiServiceLambda.addFunctionUrl({
        //   authType: lambda.FunctionUrlAuthType.NONE,
        //   cors: {
        //     allowCredentials: false,
        //     allowedHeaders: ['*'],
        //     allowedMethods: [lambda.HttpMethod.ALL],
        //     allowedOrigins: ['*'],
        //   },
        // });
        // Create CloudFront Distribution with Lambda Function URLs as origins
        const userProfileDomain = cdk.Fn.select(2, cdk.Fn.split('/', userProfileServiceUrl.url));
        const workoutDomain = cdk.Fn.select(2, cdk.Fn.split('/', workoutServiceUrl.url));
        const coachingDomain = cdk.Fn.select(2, cdk.Fn.split('/', coachingServiceUrl.url));
        const analyticsDomain = cdk.Fn.select(2, cdk.Fn.split('/', analyticsServiceUrl.url));
        const nutritionDomain = cdk.Fn.select(2, cdk.Fn.split('/', nutritionServiceUrl.url));
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
                // '/api/ai/*': {
                //   origin: new origins.HttpOrigin(aiServiceUrl.url),
                //   viewerProtocolPolicy:
                //     cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                //   allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
                //   cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
                //   originRequestPolicy:
                //     cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
                // },
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
        this.mainTable.grantWriteData(analyticsServiceLambda);
        this.mainTable.grantWriteData(nutritionServiceLambda);
        this.mainTable.grantWriteData(userProfileServiceLambda);
        this.mainTable.grantWriteData(workoutServiceLambda);
        this.mainTable.grantWriteData(coachingServiceLambda);
        // Ensure nutrition service can Query GSIs explicitly
        nutritionServiceLambda.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['dynamodb:Query', 'dynamodb:GetItem'],
            resources: [
                this.mainTable.tableArn,
                `${this.mainTable.tableArn}/index/*`,
            ],
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
        // new cdk.CfnOutput(this, 'AIServiceUrl', {
        //   value: aiServiceUrl.url,
        //   description: 'AI Service Lambda Function URL',
        // });
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
    createLambdaFunction(name, serviceName) {
        return new lambda.Function(this, `${name}Lambda`, {
            runtime: lambda.Runtime.PROVIDED_AL2,
            handler: 'bootstrap',
            code: lambda.Code.fromAsset(`../services/${serviceName}/target/lambda/${serviceName}`),
            environment: {
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
            },
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
                AWS_REGION: this.region,
                PYTHONPATH: '/var/runtime:/var/task',
            },
            timeout: cdk.Duration.minutes(5), // AI functions may need more time
            memorySize: 1024, // AI functions need more memory
            reservedConcurrentExecutions: 5, // Limit concurrent executions for AI functions
            // Removed log retention to use free tier defaults (5GB/month free)
            // Removed X-Ray tracing to avoid costs ($5 per 1M traces)
            layers: [this.createPythonAuthLayer()],
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
            code: lambda.Code.fromAsset('../services/ai-service-python'),
            compatibleRuntimes: [lambda.Runtime.PYTHON_3_11],
            description: 'Python authentication layer for AI services',
        });
        return this.pythonAuthLayer;
    }
}
exports.GymCoachAIStack = GymCoachAIStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3ltY29hY2gtYWktc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvZ3ltY29hY2gtYWktc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBQ25DLGlEQUFpRDtBQUNqRCx5REFBeUQ7QUFDekQsOERBQThEO0FBRTlELHFEQUFxRDtBQUNyRCwyQ0FBMkM7QUFDM0MsbURBQW1EO0FBRW5ELHlDQUF5QztBQUV6QywyREFBMkQ7QUFFM0QsTUFBYSxlQUFnQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBYzVDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDOUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsMENBQTBDO1FBQzFDLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRTtZQUMzRCxTQUFTLEVBQUUsa0JBQWtCO1lBQzdCLFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQ2pFLE9BQU8sRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQzVELFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7WUFDakQsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztZQUN4QyxpRUFBaUU7U0FDbEUsQ0FBQyxDQUFDO1FBRUgsd0NBQXdDO1FBQ3hDLElBQUksQ0FBQyxTQUFTLENBQUMsdUJBQXVCLENBQUM7WUFDckMsU0FBUyxFQUFFLE1BQU07WUFDakIsWUFBWSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVB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NkM7U0FDM0QsQ0FBQyxDQUFDO1FBQ0gsT0FBTyxJQUFJLENBQUMsZUFBZSxDQUFDO0lBQzlCLENBQUM7Q0F1QkY7QUF6NkJELDBDQXk2QkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgY2xvdWRmcm9udCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udCc7XG5pbXBvcnQgKiBhcyBvcmlnaW5zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250LW9yaWdpbnMnO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSc7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgY29nbml0byBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY29nbml0byc7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbi8vIFJlbW92ZWQgTW9uaXRvcmluZ1N0YWNrIGltcG9ydCB0byBhdm9pZCBDbG91ZFdhdGNoIGNvc3RzXG5cbmV4cG9ydCBjbGFzcyBHeW1Db2FjaEFJU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgdXNlclBvb2w6IGNvZ25pdG8uVXNlclBvb2w7XG4gIHB1YmxpYyByZWFkb25seSB1c2VyUG9vbENsaWVudDogY29nbml0by5Vc2VyUG9vbENsaWVudDtcbiAgcHVibGljIHJlYWRvbmx5IHVzZXJQb29sRG9tYWluOiBjb2duaXRvLlVzZXJQb29sRG9tYWluO1xuICBwdWJsaWMgcmVhZG9ubHkgbWFpblRhYmxlOiBkeW5hbW9kYi5UYWJsZTtcbiAgcHVibGljIHJlYWRvbmx5IGRpc3RyaWJ1dGlvbjogY2xvdWRmcm9udC5EaXN0cmlidXRpb247XG4gIHB1YmxpYyByZWFkb25seSB1c2VyVXBsb2Fkc0J1Y2tldDogczMuQnVja2V0O1xuICBwdWJsaWMgcmVhZG9ubHkgc3RhdGljQXNzZXRzQnVja2V0OiBzMy5CdWNrZXQ7XG4gIHB1YmxpYyByZWFkb25seSBwcm9jZXNzZWRJbWFnZXNCdWNrZXQ6IHMzLkJ1Y2tldDtcbiAgcHVibGljIHJlYWRvbmx5IHByb2dyZXNzUGhvdG9zQnVja2V0OiBzMy5CdWNrZXQ7XG4gIHB1YmxpYyByZWFkb25seSBmcm9udGVuZEJ1Y2tldDogczMuQnVja2V0O1xuICBwcml2YXRlIGF1dGhMYXllcj86IGxhbWJkYS5MYXllclZlcnNpb247XG4gIHByaXZhdGUgcHl0aG9uQXV0aExheWVyPzogbGFtYmRhLkxheWVyVmVyc2lvbjtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IGNkay5TdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyBEeW5hbW9EQiBUYWJsZSB3aXRoIFNpbmdsZSBUYWJsZSBEZXNpZ25cbiAgICB0aGlzLm1haW5UYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnR3ltQ29hY2hBSVRhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiAnZ3ltY29hY2gtYWktbWFpbicsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ1BLJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ1NLJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgLy8gUmVtb3ZlZCBwb2ludEluVGltZVJlY292ZXJ5IHRvIGF2b2lkIGNvc3RzICgyMCUgb2YgdGFibGUgY29zdClcbiAgICB9KTtcblxuICAgIC8vIEFkZCBHU0kgZm9yIGRpZmZlcmVudCBhY2Nlc3MgcGF0dGVybnNcbiAgICB0aGlzLm1haW5UYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdHU0kxJyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnR1NJMVBLJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ0dTSTFTSycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgfSk7XG5cbiAgICB0aGlzLm1haW5UYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdHU0kyJyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnR1NJMlBLJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ0dTSTJTSycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgQ29nbml0byBVc2VyIFBvb2xcbiAgICB0aGlzLnVzZXJQb29sID0gbmV3IGNvZ25pdG8uVXNlclBvb2wodGhpcywgJ0d5bUNvYWNoQUlVc2VyUG9vbCcsIHtcbiAgICAgIHVzZXJQb29sTmFtZTogJ2d5bWNvYWNoLWFpLXVzZXJzJyxcbiAgICAgIHNlbGZTaWduVXBFbmFibGVkOiB0cnVlLFxuICAgICAgc2lnbkluQWxpYXNlczoge1xuICAgICAgICBlbWFpbDogdHJ1ZSxcbiAgICAgICAgdXNlcm5hbWU6IHRydWUsXG4gICAgICB9LFxuICAgICAgYXV0b1ZlcmlmeToge1xuICAgICAgICBlbWFpbDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBzdGFuZGFyZEF0dHJpYnV0ZXM6IHtcbiAgICAgICAgZW1haWw6IHtcbiAgICAgICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICBnaXZlbk5hbWU6IHtcbiAgICAgICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICBmYW1pbHlOYW1lOiB7XG4gICAgICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBjdXN0b21BdHRyaWJ1dGVzOiB7XG4gICAgICAgIGZpdG5lc3NHb2FsczogbmV3IGNvZ25pdG8uU3RyaW5nQXR0cmlidXRlKHtcbiAgICAgICAgICBtaW5MZW46IDEsXG4gICAgICAgICAgbWF4TGVuOiAxMDAsXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcbiAgICAgICAgfSksXG4gICAgICAgIGV4cGVyaWVuY2VMZXZlbDogbmV3IGNvZ25pdG8uU3RyaW5nQXR0cmlidXRlKHtcbiAgICAgICAgICBtaW5MZW46IDEsXG4gICAgICAgICAgbWF4TGVuOiAyMCxcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxuICAgICAgICB9KSxcbiAgICAgICAgc3Vic2NyaXB0aW9uVGllcjogbmV3IGNvZ25pdG8uU3RyaW5nQXR0cmlidXRlKHtcbiAgICAgICAgICBtaW5MZW46IDEsXG4gICAgICAgICAgbWF4TGVuOiAyMCxcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxuICAgICAgICB9KSxcbiAgICAgIH0sXG4gICAgICBwYXNzd29yZFBvbGljeToge1xuICAgICAgICBtaW5MZW5ndGg6IDgsXG4gICAgICAgIHJlcXVpcmVMb3dlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVVcHBlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVEaWdpdHM6IHRydWUsXG4gICAgICAgIHJlcXVpcmVTeW1ib2xzOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIG1mYTogY29nbml0by5NZmEuT1BUSU9OQUwsXG4gICAgICBtZmFTZWNvbmRGYWN0b3I6IHtcbiAgICAgICAgc21zOiB0cnVlLFxuICAgICAgICBvdHA6IHRydWUsXG4gICAgICB9LFxuICAgICAgZGV2aWNlVHJhY2tpbmc6IHtcbiAgICAgICAgY2hhbGxlbmdlUmVxdWlyZWRPbk5ld0RldmljZTogdHJ1ZSxcbiAgICAgICAgZGV2aWNlT25seVJlbWVtYmVyZWRPblVzZXJQcm9tcHQ6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIGFjY291bnRSZWNvdmVyeTogY29nbml0by5BY2NvdW50UmVjb3ZlcnkuRU1BSUxfT05MWSxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgVXNlciBQb29sIENsaWVudCBmb3IgV2ViIEFwcFxuICAgIHRoaXMudXNlclBvb2xDbGllbnQgPSBuZXcgY29nbml0by5Vc2VyUG9vbENsaWVudCh0aGlzLCAnV2ViQXBwQ2xpZW50Jywge1xuICAgICAgdXNlclBvb2w6IHRoaXMudXNlclBvb2wsXG4gICAgICB1c2VyUG9vbENsaWVudE5hbWU6ICdneW1jb2FjaC1haS13ZWItY2xpZW50JyxcbiAgICAgIGdlbmVyYXRlU2VjcmV0OiBmYWxzZSxcbiAgICAgIGF1dGhGbG93czoge1xuICAgICAgICB1c2VyUGFzc3dvcmQ6IHRydWUsXG4gICAgICAgIHVzZXJTcnA6IHRydWUsXG4gICAgICAgIGN1c3RvbTogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBvQXV0aDoge1xuICAgICAgICBmbG93czoge1xuICAgICAgICAgIGF1dGhvcml6YXRpb25Db2RlR3JhbnQ6IHRydWUsXG4gICAgICAgICAgaW1wbGljaXRDb2RlR3JhbnQ6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgIHNjb3BlczogW1xuICAgICAgICAgIGNvZ25pdG8uT0F1dGhTY29wZS5FTUFJTCxcbiAgICAgICAgICBjb2duaXRvLk9BdXRoU2NvcGUuT1BFTklELFxuICAgICAgICAgIGNvZ25pdG8uT0F1dGhTY29wZS5QUk9GSUxFLFxuICAgICAgICBdLFxuICAgICAgICBjYWxsYmFja1VybHM6IFtcbiAgICAgICAgICAnaHR0cDovL2xvY2FsaG9zdDozMDAwL2F1dGgvY2FsbGJhY2snLFxuICAgICAgICAgICdodHRwczovLyouY2xvdWRmcm9udC5uZXQvYXV0aC9jYWxsYmFjaycsXG4gICAgICAgIF0sXG4gICAgICAgIGxvZ291dFVybHM6IFtcbiAgICAgICAgICAnaHR0cDovL2xvY2FsaG9zdDozMDAwL2F1dGgvbG9nb3V0JyxcbiAgICAgICAgICAnaHR0cHM6Ly8qLmNsb3VkZnJvbnQubmV0L2F1dGgvbG9nb3V0JyxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgICByZWZyZXNoVG9rZW5WYWxpZGl0eTogY2RrLkR1cmF0aW9uLmRheXMoMzApLFxuICAgICAgYWNjZXNzVG9rZW5WYWxpZGl0eTogY2RrLkR1cmF0aW9uLmhvdXJzKDEpLFxuICAgICAgaWRUb2tlblZhbGlkaXR5OiBjZGsuRHVyYXRpb24uaG91cnMoMSksXG4gICAgICBwcmV2ZW50VXNlckV4aXN0ZW5jZUVycm9yczogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBVc2VyIFBvb2wgRG9tYWluXG4gICAgdGhpcy51c2VyUG9vbERvbWFpbiA9IHRoaXMudXNlclBvb2wuYWRkRG9tYWluKCdDb2duaXRvRG9tYWluJywge1xuICAgICAgY29nbml0b0RvbWFpbjoge1xuICAgICAgICBkb21haW5QcmVmaXg6IGBneW1jb2FjaC1haS0ke3RoaXMuYWNjb3VudH1gLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBVc2VyIEdyb3VwcyBmb3IgUm9sZS1CYXNlZCBBY2Nlc3MgQ29udHJvbFxuICAgIGNvbnN0IGFkbWluR3JvdXAgPSBuZXcgY29nbml0by5DZm5Vc2VyUG9vbEdyb3VwKHRoaXMsICdBZG1pbkdyb3VwJywge1xuICAgICAgdXNlclBvb2xJZDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgZ3JvdXBOYW1lOiAnYWRtaW4nLFxuICAgICAgZGVzY3JpcHRpb246ICdBZG1pbmlzdHJhdG9ycyB3aXRoIGZ1bGwgYWNjZXNzJyxcbiAgICAgIHByZWNlZGVuY2U6IDEsXG4gICAgfSk7XG5cbiAgICBjb25zdCBjb2FjaEdyb3VwID0gbmV3IGNvZ25pdG8uQ2ZuVXNlclBvb2xHcm91cCh0aGlzLCAnQ29hY2hHcm91cCcsIHtcbiAgICAgIHVzZXJQb29sSWQ6IHRoaXMudXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgIGdyb3VwTmFtZTogJ2NvYWNoJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ29hY2hlcyB3aXRoIGFjY2VzcyB0byB1c2VyIGRhdGEgZm9yIGNvYWNoaW5nJyxcbiAgICAgIHByZWNlZGVuY2U6IDIsXG4gICAgfSk7XG5cbiAgICBjb25zdCB1c2VyR3JvdXAgPSBuZXcgY29nbml0by5DZm5Vc2VyUG9vbEdyb3VwKHRoaXMsICdVc2VyR3JvdXAnLCB7XG4gICAgICB1c2VyUG9vbElkOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICBncm91cE5hbWU6ICd1c2VyJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUmVndWxhciB1c2VycyB3aXRoIGFjY2VzcyB0byB0aGVpciBvd24gZGF0YScsXG4gICAgICBwcmVjZWRlbmNlOiAzLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIFMzIEJ1Y2tldHMgKG5lZWRlZCBieSBMYW1iZGFzKVxuICAgIHRoaXMudXNlclVwbG9hZHNCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdVc2VyVXBsb2Fkc0J1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGBneW1jb2FjaC1haS11c2VyLXVwbG9hZHMtJHt0aGlzLmFjY291bnR9YCxcbiAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBuZXcgczMuQmxvY2tQdWJsaWNBY2Nlc3Moe1xuICAgICAgICBibG9ja1B1YmxpY0FjbHM6IGZhbHNlLFxuICAgICAgICBibG9ja1B1YmxpY1BvbGljeTogZmFsc2UsXG4gICAgICAgIGlnbm9yZVB1YmxpY0FjbHM6IGZhbHNlLFxuICAgICAgICByZXN0cmljdFB1YmxpY0J1Y2tldHM6IGZhbHNlLFxuICAgICAgfSksXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgY29yczogW1xuICAgICAgICB7XG4gICAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBbXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5HRVQsXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5QVVQsXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5QT1NULFxuICAgICAgICAgICAgczMuSHR0cE1ldGhvZHMuREVMRVRFLFxuICAgICAgICAgICAgczMuSHR0cE1ldGhvZHMuSEVBRCxcbiAgICAgICAgICBdLFxuICAgICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcbiAgICAgICAgICBleHBvc2VkSGVhZGVyczogWydFVGFnJ10sXG4gICAgICAgICAgbWF4QWdlOiAzMDAwLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ0RlbGV0ZUluY29tcGxldGVNdWx0aXBhcnRVcGxvYWRzJyxcbiAgICAgICAgICBhYm9ydEluY29tcGxldGVNdWx0aXBhcnRVcGxvYWRBZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoNyksXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ1RyYW5zaXRpb25Ub0lBJyxcbiAgICAgICAgICB0cmFuc2l0aW9uczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBzdG9yYWdlQ2xhc3M6IHMzLlN0b3JhZ2VDbGFzcy5JTkZSRVFVRU5UX0FDQ0VTUyxcbiAgICAgICAgICAgICAgdHJhbnNpdGlvbkFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cygzMCksXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ1RyYW5zaXRpb25Ub0dsYWNpZXInLFxuICAgICAgICAgIHRyYW5zaXRpb25zOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHN0b3JhZ2VDbGFzczogczMuU3RvcmFnZUNsYXNzLkdMQUNJRVIsXG4gICAgICAgICAgICAgIHRyYW5zaXRpb25BZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoOTApLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIEFkZCBidWNrZXQgcG9saWN5IHRvIGFsbG93IHB1YmxpYyByZWFkIGFjY2VzcyB0byB1cGxvYWRlZCBpbWFnZXNcbiAgICB0aGlzLnVzZXJVcGxvYWRzQnVja2V0LmFkZFRvUmVzb3VyY2VQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgcHJpbmNpcGFsczogW25ldyBpYW0uQW55UHJpbmNpcGFsKCldLFxuICAgICAgICBhY3Rpb25zOiBbJ3MzOkdldE9iamVjdCddLFxuICAgICAgICByZXNvdXJjZXM6IFtgJHt0aGlzLnVzZXJVcGxvYWRzQnVja2V0LmJ1Y2tldEFybn0vdXNlci1wcm9maWxlcy8qYF0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICB0aGlzLnN0YXRpY0Fzc2V0c0J1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ1N0YXRpY0Fzc2V0c0J1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGBneW1jb2FjaC1haS1zdGF0aWMtYXNzZXRzLSR7dGhpcy5hY2NvdW50fWAsXG4gICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIHB1YmxpY1JlYWRBY2Nlc3M6IGZhbHNlLFxuICAgIH0pO1xuXG4gICAgdGhpcy5wcm9jZXNzZWRJbWFnZXNCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdQcm9jZXNzZWRJbWFnZXNCdWNrZXQnLCB7XG4gICAgICBidWNrZXROYW1lOiBgZ3ltY29hY2gtYWktcHJvY2Vzc2VkLWltYWdlcy0ke3RoaXMuYWNjb3VudH1gLFxuICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgZGVkaWNhdGVkIFByb2dyZXNzIFBob3RvcyBTMyBCdWNrZXQgd2l0aCBlbmhhbmNlZCBzZWN1cml0eVxuICAgIHRoaXMucHJvZ3Jlc3NQaG90b3NCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdQcm9ncmVzc1Bob3Rvc0J1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGBneW1jb2FjaC1haS1wcm9ncmVzcy1waG90b3MtJHt0aGlzLmFjY291bnR9YCxcbiAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgY29yczogW1xuICAgICAgICB7XG4gICAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBbXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5HRVQsXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5QVVQsXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5QT1NULFxuICAgICAgICAgICAgczMuSHR0cE1ldGhvZHMuREVMRVRFLFxuICAgICAgICAgICAgczMuSHR0cE1ldGhvZHMuSEVBRCxcbiAgICAgICAgICBdLFxuICAgICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcbiAgICAgICAgICBleHBvc2VkSGVhZGVyczogWydFVGFnJ10sXG4gICAgICAgICAgbWF4QWdlOiAzMDAwLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ0RlbGV0ZUluY29tcGxldGVNdWx0aXBhcnRVcGxvYWRzJyxcbiAgICAgICAgICBhYm9ydEluY29tcGxldGVNdWx0aXBhcnRVcGxvYWRBZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoMSksXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ1RyYW5zaXRpb25Qcm9ncmVzc1Bob3Rvc1RvSUEnLFxuICAgICAgICAgIHRyYW5zaXRpb25zOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHN0b3JhZ2VDbGFzczogczMuU3RvcmFnZUNsYXNzLklORlJFUVVFTlRfQUNDRVNTLFxuICAgICAgICAgICAgICB0cmFuc2l0aW9uQWZ0ZXI6IGNkay5EdXJhdGlvbi5kYXlzKDMwKSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAnQXJjaGl2ZU9sZFByb2dyZXNzUGhvdG9zJyxcbiAgICAgICAgICB0cmFuc2l0aW9uczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBzdG9yYWdlQ2xhc3M6IHMzLlN0b3JhZ2VDbGFzcy5HTEFDSUVSLFxuICAgICAgICAgICAgICB0cmFuc2l0aW9uQWZ0ZXI6IGNkay5EdXJhdGlvbi5kYXlzKDM2NSksXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIENsb3VkRnJvbnQgT3JpZ2luIEFjY2VzcyBJZGVudGl0eSBmb3Igc2VjdXJlIFMzIGFjY2Vzc1xuICAgIGNvbnN0IHByb2dyZXNzUGhvdG9zT0FJID0gbmV3IGNsb3VkZnJvbnQuT3JpZ2luQWNjZXNzSWRlbnRpdHkoXG4gICAgICB0aGlzLFxuICAgICAgJ1Byb2dyZXNzUGhvdG9zT0FJJyxcbiAgICAgIHtcbiAgICAgICAgY29tbWVudDogJ09yaWdpbiBBY2Nlc3MgSWRlbnRpdHkgZm9yIFByb2dyZXNzIFBob3RvcyBidWNrZXQgdjInLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBHcmFudCBDbG91ZEZyb250IE9BSSBhY2Nlc3MgdG8gcHJvZ3Jlc3MgcGhvdG9zIGJ1Y2tldFxuICAgIHRoaXMucHJvZ3Jlc3NQaG90b3NCdWNrZXQuYWRkVG9SZXNvdXJjZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBwcmluY2lwYWxzOiBbcHJvZ3Jlc3NQaG90b3NPQUkuZ3JhbnRQcmluY2lwYWxdLFxuICAgICAgICBhY3Rpb25zOiBbJ3MzOkdldE9iamVjdCddLFxuICAgICAgICByZXNvdXJjZXM6IFtgJHt0aGlzLnByb2dyZXNzUGhvdG9zQnVja2V0LmJ1Y2tldEFybn0vKmBdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gQ3JlYXRlIENsb3VkRnJvbnQgT3JpZ2luIEFjY2VzcyBJZGVudGl0eSBmb3IgZnJvbnRlbmQgYnVja2V0XG4gICAgY29uc3QgZnJvbnRlbmRPQUkgPSBuZXcgY2xvdWRmcm9udC5PcmlnaW5BY2Nlc3NJZGVudGl0eShcbiAgICAgIHRoaXMsXG4gICAgICAnRnJvbnRlbmRPQUknLFxuICAgICAge1xuICAgICAgICBjb21tZW50OiAnT3JpZ2luIEFjY2VzcyBJZGVudGl0eSBmb3IgRnJvbnRlbmQgYnVja2V0JyxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gQ3JlYXRlIEZyb250ZW5kIFMzIEJ1Y2tldCBmb3Igc3RhdGljIGFzc2V0c1xuICAgIHRoaXMuZnJvbnRlbmRCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdGcm9udGVuZEJ1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGBneW1jb2FjaC1haS1mcm9udGVuZC0ke3RoaXMuYWNjb3VudH1gLFxuICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgcHVibGljUmVhZEFjY2VzczogZmFsc2UsIC8vIE9ubHkgQ2xvdWRGcm9udCBPQUkgc2hvdWxkIGFjY2Vzc1xuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCwgLy8gQmxvY2sgYWxsIHB1YmxpYyBhY2Nlc3NcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBDbG91ZEZyb250IE9BSSBhY2Nlc3MgdG8gZnJvbnRlbmQgYnVja2V0XG4gICAgdGhpcy5mcm9udGVuZEJ1Y2tldC5hZGRUb1Jlc291cmNlUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIHByaW5jaXBhbHM6IFtmcm9udGVuZE9BSS5ncmFudFByaW5jaXBhbF0sXG4gICAgICAgIGFjdGlvbnM6IFsnczM6R2V0T2JqZWN0J10sXG4gICAgICAgIHJlc291cmNlczogW2Ake3RoaXMuZnJvbnRlbmRCdWNrZXQuYnVja2V0QXJufS8qYF0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBDcmVhdGUgTGFtYmRhIEF1dGhvcml6ZXJcbiAgICBjb25zdCBhdXRob3JpemVyTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQXV0aG9yaXplckxhbWJkYScsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUlubGluZShgXG4gICAgICAgIGNvbnN0IGp3dCA9IHJlcXVpcmUoJ2pzb253ZWJ0b2tlbicpO1xuICAgICAgICBjb25zdCBqd2tzQ2xpZW50ID0gcmVxdWlyZSgnandrcy1yc2EnKTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGNsaWVudCA9IGp3a3NDbGllbnQoe1xuICAgICAgICAgIGp3a3NVcmk6ICdodHRwczovL2NvZ25pdG8taWRwLiR7dGhpcy5yZWdpb259LmFtYXpvbmF3cy5jb20vJHt0aGlzLnVzZXJQb29sLnVzZXJQb29sSWR9Ly53ZWxsLWtub3duL2p3a3MuanNvbidcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICBmdW5jdGlvbiBnZXRLZXkoaGVhZGVyLCBjYWxsYmFjaykge1xuICAgICAgICAgIGNsaWVudC5nZXRTaWduaW5nS2V5KGhlYWRlci5raWQsIChlcnIsIGtleSkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgc2lnbmluZ0tleSA9IGtleS5wdWJsaWNLZXkgfHwga2V5LnJzYVB1YmxpY0tleTtcbiAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHNpZ25pbmdLZXkpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBleHBvcnRzLmhhbmRsZXIgPSBhc3luYyAoZXZlbnQpID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnQXV0aG9yaXplciBldmVudDonLCBKU09OLnN0cmluZ2lmeShldmVudCwgbnVsbCwgMikpO1xuICAgICAgICAgIFxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB0b2tlbiA9IGV2ZW50LmhlYWRlcnMuYXV0aG9yaXphdGlvbj8ucmVwbGFjZSgnQmVhcmVyICcsICcnKTtcbiAgICAgICAgICAgIGlmICghdG9rZW4pIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGdlbmVyYXRlUG9saWN5KCd1c2VyJywgJ0RlbnknLCBldmVudC5tZXRob2RBcm4pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zdCBkZWNvZGVkID0gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgICBqd3QudmVyaWZ5KHRva2VuLCBnZXRLZXksIHsgYWxnb3JpdGhtczogWydSUzI1NiddIH0sIChlcnIsIGRlY29kZWQpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICBlbHNlIHJlc29sdmUoZGVjb2RlZCk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdEZWNvZGVkIHRva2VuOicsIGRlY29kZWQpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gZ2VuZXJhdGVQb2xpY3koZGVjb2RlZC5zdWIsICdBbGxvdycsIGV2ZW50Lm1ldGhvZEFybiwgZGVjb2RlZCk7XG4gICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0F1dGhvcml6YXRpb24gZXJyb3I6JywgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIGdlbmVyYXRlUG9saWN5KCd1c2VyJywgJ0RlbnknLCBldmVudC5tZXRob2RBcm4pO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgXG4gICAgICAgIGZ1bmN0aW9uIGdlbmVyYXRlUG9saWN5KHByaW5jaXBhbElkLCBlZmZlY3QsIHJlc291cmNlLCBjb250ZXh0ID0ge30pIHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgcHJpbmNpcGFsSWQsXG4gICAgICAgICAgICBwb2xpY3lEb2N1bWVudDoge1xuICAgICAgICAgICAgICBWZXJzaW9uOiAnMjAxMi0xMC0xNycsXG4gICAgICAgICAgICAgIFN0YXRlbWVudDogW3tcbiAgICAgICAgICAgICAgICBBY3Rpb246ICdleGVjdXRlLWFwaTpJbnZva2UnLFxuICAgICAgICAgICAgICAgIEVmZmVjdDogZWZmZWN0LFxuICAgICAgICAgICAgICAgIFJlc291cmNlOiByZXNvdXJjZVxuICAgICAgICAgICAgICB9XVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNvbnRleHRcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICBgKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFVTRVJfUE9PTF9JRDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgICBVU0VSX1BPT0xfQ0xJRU5UX0lEOiB0aGlzLnVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXG4gICAgICAgIFRBQkxFX05BTUU6IHRoaXMubWFpblRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBwZXJtaXNzaW9ucyB0byBhdXRob3JpemVyXG4gICAgdGhpcy5tYWluVGFibGUuZ3JhbnRSZWFkRGF0YShhdXRob3JpemVyTGFtYmRhKTtcblxuICAgIC8vIENyZWF0ZSBMYW1iZGEgZnVuY3Rpb25zIGZvciBlYWNoIHNlcnZpY2VcbiAgICAvLyBjb25zdCB1c2VyU2VydmljZUxhbWJkYSA9IHRoaXMuY3JlYXRlTGFtYmRhRnVuY3Rpb24oXG4gICAgLy8gICAnVXNlclNlcnZpY2UnLFxuICAgIC8vICAgJ3VzZXItc2VydmljZSdcbiAgICAvLyApO1xuICAgIGNvbnN0IHVzZXJQcm9maWxlU2VydmljZUxhbWJkYSA9IHRoaXMuY3JlYXRlTGFtYmRhRnVuY3Rpb24oXG4gICAgICAnVXNlclByb2ZpbGVTZXJ2aWNlJyxcbiAgICAgICd1c2VyLXByb2ZpbGUtc2VydmljZSdcbiAgICApO1xuICAgIGNvbnN0IHdvcmtvdXRTZXJ2aWNlTGFtYmRhID0gdGhpcy5jcmVhdGVMYW1iZGFGdW5jdGlvbihcbiAgICAgICdXb3Jrb3V0U2VydmljZScsXG4gICAgICAnd29ya291dC1zZXJ2aWNlJ1xuICAgICk7XG4gICAgY29uc3QgY29hY2hpbmdTZXJ2aWNlTGFtYmRhID0gdGhpcy5jcmVhdGVMYW1iZGFGdW5jdGlvbihcbiAgICAgICdDb2FjaGluZ1NlcnZpY2UnLFxuICAgICAgJ2NvYWNoaW5nLXNlcnZpY2UnXG4gICAgKTtcbiAgICBjb25zdCBhbmFseXRpY3NTZXJ2aWNlTGFtYmRhID0gdGhpcy5jcmVhdGVMYW1iZGFGdW5jdGlvbihcbiAgICAgICdBbmFseXRpY3NTZXJ2aWNlJyxcbiAgICAgICdhbmFseXRpY3Mtc2VydmljZSdcbiAgICApO1xuICAgIGNvbnN0IG51dHJpdGlvblNlcnZpY2VMYW1iZGEgPSB0aGlzLmNyZWF0ZUxhbWJkYUZ1bmN0aW9uKFxuICAgICAgJ051dHJpdGlvblNlcnZpY2UnLFxuICAgICAgJ251dHJpdGlvbi1zZXJ2aWNlJ1xuICAgICk7XG4gICAgLy8gY29uc3QgYWlTZXJ2aWNlTGFtYmRhID0gdGhpcy5jcmVhdGVQeXRob25MYW1iZGFGdW5jdGlvbihcbiAgICAvLyAgICdBSVNlcnZpY2UnLFxuICAgIC8vICAgJ2FpLXNlcnZpY2UtcHl0aG9uJ1xuICAgIC8vICk7XG5cbiAgICAvLyBFbmFibGUgTGFtYmRhIEZ1bmN0aW9uIFVSTHNcbiAgICAvLyBjb25zdCB1c2VyU2VydmljZVVybCA9IHVzZXJTZXJ2aWNlTGFtYmRhLmFkZEZ1bmN0aW9uVXJsKHtcbiAgICAvLyAgIGF1dGhUeXBlOiBsYW1iZGEuRnVuY3Rpb25VcmxBdXRoVHlwZS5OT05FLFxuICAgIC8vICAgY29yczoge1xuICAgIC8vICAgICBhbGxvd0NyZWRlbnRpYWxzOiBmYWxzZSxcbiAgICAvLyAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxuICAgIC8vICAgICBhbGxvd2VkTWV0aG9kczogW2xhbWJkYS5IdHRwTWV0aG9kLkFMTF0sXG4gICAgLy8gICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcbiAgICAvLyAgIH0sXG4gICAgLy8gfSk7XG5cbiAgICBjb25zdCB1c2VyUHJvZmlsZVNlcnZpY2VVcmwgPSB1c2VyUHJvZmlsZVNlcnZpY2VMYW1iZGEuYWRkRnVuY3Rpb25Vcmwoe1xuICAgICAgYXV0aFR5cGU6IGxhbWJkYS5GdW5jdGlvblVybEF1dGhUeXBlLk5PTkUsXG4gICAgICBjb3JzOiB7XG4gICAgICAgIGFsbG93Q3JlZGVudGlhbHM6IGZhbHNlLFxuICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXG4gICAgICAgIGFsbG93ZWRNZXRob2RzOiBbbGFtYmRhLkh0dHBNZXRob2QuQUxMXSxcbiAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHdvcmtvdXRTZXJ2aWNlVXJsID0gd29ya291dFNlcnZpY2VMYW1iZGEuYWRkRnVuY3Rpb25Vcmwoe1xuICAgICAgYXV0aFR5cGU6IGxhbWJkYS5GdW5jdGlvblVybEF1dGhUeXBlLk5PTkUsXG4gICAgICBjb3JzOiB7XG4gICAgICAgIGFsbG93Q3JlZGVudGlhbHM6IGZhbHNlLFxuICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXG4gICAgICAgIGFsbG93ZWRNZXRob2RzOiBbbGFtYmRhLkh0dHBNZXRob2QuQUxMXSxcbiAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGNvYWNoaW5nU2VydmljZVVybCA9IGNvYWNoaW5nU2VydmljZUxhbWJkYS5hZGRGdW5jdGlvblVybCh7XG4gICAgICBhdXRoVHlwZTogbGFtYmRhLkZ1bmN0aW9uVXJsQXV0aFR5cGUuTk9ORSxcbiAgICAgIGNvcnM6IHtcbiAgICAgICAgYWxsb3dDcmVkZW50aWFsczogZmFsc2UsXG4gICAgICAgIGFsbG93ZWRIZWFkZXJzOiBbJyonXSxcbiAgICAgICAgYWxsb3dlZE1ldGhvZHM6IFtsYW1iZGEuSHR0cE1ldGhvZC5BTExdLFxuICAgICAgICBhbGxvd2VkT3JpZ2luczogWycqJ10sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgY29uc3QgYW5hbHl0aWNzU2VydmljZVVybCA9IGFuYWx5dGljc1NlcnZpY2VMYW1iZGEuYWRkRnVuY3Rpb25Vcmwoe1xuICAgICAgYXV0aFR5cGU6IGxhbWJkYS5GdW5jdGlvblVybEF1dGhUeXBlLk5PTkUsXG4gICAgICBjb3JzOiB7XG4gICAgICAgIGFsbG93Q3JlZGVudGlhbHM6IGZhbHNlLFxuICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXG4gICAgICAgIGFsbG93ZWRNZXRob2RzOiBbbGFtYmRhLkh0dHBNZXRob2QuQUxMXSxcbiAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IG51dHJpdGlvblNlcnZpY2VVcmwgPSBudXRyaXRpb25TZXJ2aWNlTGFtYmRhLmFkZEZ1bmN0aW9uVXJsKHtcbiAgICAgIGF1dGhUeXBlOiBsYW1iZGEuRnVuY3Rpb25VcmxBdXRoVHlwZS5OT05FLFxuICAgICAgY29yczoge1xuICAgICAgICBhbGxvd0NyZWRlbnRpYWxzOiBmYWxzZSxcbiAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxuICAgICAgICBhbGxvd2VkTWV0aG9kczogW2xhbWJkYS5IdHRwTWV0aG9kLkFMTF0sXG4gICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBjb25zdCBhaVNlcnZpY2VVcmwgPSBhaVNlcnZpY2VMYW1iZGEuYWRkRnVuY3Rpb25Vcmwoe1xuICAgIC8vICAgYXV0aFR5cGU6IGxhbWJkYS5GdW5jdGlvblVybEF1dGhUeXBlLk5PTkUsXG4gICAgLy8gICBjb3JzOiB7XG4gICAgLy8gICAgIGFsbG93Q3JlZGVudGlhbHM6IGZhbHNlLFxuICAgIC8vICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXG4gICAgLy8gICAgIGFsbG93ZWRNZXRob2RzOiBbbGFtYmRhLkh0dHBNZXRob2QuQUxMXSxcbiAgICAvLyAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLFxuICAgIC8vICAgfSxcbiAgICAvLyB9KTtcblxuICAgIC8vIENyZWF0ZSBDbG91ZEZyb250IERpc3RyaWJ1dGlvbiB3aXRoIExhbWJkYSBGdW5jdGlvbiBVUkxzIGFzIG9yaWdpbnNcbiAgICBjb25zdCB1c2VyUHJvZmlsZURvbWFpbiA9IGNkay5Gbi5zZWxlY3QoXG4gICAgICAyLFxuICAgICAgY2RrLkZuLnNwbGl0KCcvJywgdXNlclByb2ZpbGVTZXJ2aWNlVXJsLnVybClcbiAgICApO1xuICAgIGNvbnN0IHdvcmtvdXREb21haW4gPSBjZGsuRm4uc2VsZWN0KFxuICAgICAgMixcbiAgICAgIGNkay5Gbi5zcGxpdCgnLycsIHdvcmtvdXRTZXJ2aWNlVXJsLnVybClcbiAgICApO1xuICAgIGNvbnN0IGNvYWNoaW5nRG9tYWluID0gY2RrLkZuLnNlbGVjdChcbiAgICAgIDIsXG4gICAgICBjZGsuRm4uc3BsaXQoJy8nLCBjb2FjaGluZ1NlcnZpY2VVcmwudXJsKVxuICAgICk7XG4gICAgY29uc3QgYW5hbHl0aWNzRG9tYWluID0gY2RrLkZuLnNlbGVjdChcbiAgICAgIDIsXG4gICAgICBjZGsuRm4uc3BsaXQoJy8nLCBhbmFseXRpY3NTZXJ2aWNlVXJsLnVybClcbiAgICApO1xuICAgIGNvbnN0IG51dHJpdGlvbkRvbWFpbiA9IGNkay5Gbi5zZWxlY3QoXG4gICAgICAyLFxuICAgICAgY2RrLkZuLnNwbGl0KCcvJywgbnV0cml0aW9uU2VydmljZVVybC51cmwpXG4gICAgKTtcblxuICAgIC8vIENyZWF0ZSBDbG91ZEZyb250IEZ1bmN0aW9uIGZvciBVUkwgcmV3cml0aW5nIChoYW5kbGVzIFNQQSByb3V0aW5nKVxuICAgIGNvbnN0IHVybFJld3JpdGVGdW5jdGlvbiA9IG5ldyBjbG91ZGZyb250LkZ1bmN0aW9uKFxuICAgICAgdGhpcyxcbiAgICAgICdVcmxSZXdyaXRlRnVuY3Rpb24nLFxuICAgICAge1xuICAgICAgICBmdW5jdGlvbk5hbWU6ICd1cmwtcmV3cml0ZS1mdW5jdGlvbicsXG4gICAgICAgIGNvZGU6IGNsb3VkZnJvbnQuRnVuY3Rpb25Db2RlLmZyb21JbmxpbmUoYFxuICAgICAgICBmdW5jdGlvbiBoYW5kbGVyKGV2ZW50KSB7XG4gICAgICAgICAgdmFyIHJlcXVlc3QgPSBldmVudC5yZXF1ZXN0O1xuICAgICAgICAgIHZhciB1cmkgPSByZXF1ZXN0LnVyaTtcbiAgICAgICAgICBcbiAgICAgICAgICAvLyBDaGVjayBpZiB0aGUgVVJJIGlzIGFza2luZyBmb3IgYSBmaWxlIHdpdGggYW4gZXh0ZW5zaW9uXG4gICAgICAgICAgaWYgKHVyaS5pbmNsdWRlcygnLicpKSB7XG4gICAgICAgICAgICByZXR1cm4gcmVxdWVzdDtcbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgLy8gSGFuZGxlIHJvb3QgcGF0aFxuICAgICAgICAgIGlmICh1cmkgPT09ICcvJykge1xuICAgICAgICAgICAgcmVxdWVzdC51cmkgPSAnL2luZGV4Lmh0bWwnO1xuICAgICAgICAgICAgcmV0dXJuIHJlcXVlc3Q7XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIC8vIENoZWNrIGlmIHRoZSBVUkkgZW5kcyB3aXRoIGEgc2xhc2hcbiAgICAgICAgICBpZiAodXJpLmVuZHNXaXRoKCcvJykpIHtcbiAgICAgICAgICAgIC8vIFVSSSBoYXMgdHJhaWxpbmcgc2xhc2gsIGFwcGVuZCBpbmRleC5odG1sXG4gICAgICAgICAgICByZXF1ZXN0LnVyaSArPSAnaW5kZXguaHRtbCc7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIFVSSSBkb2Vzbid0IGhhdmUgdHJhaWxpbmcgc2xhc2gsIHJlZGlyZWN0IHRvIHZlcnNpb24gd2l0aCB0cmFpbGluZyBzbGFzaFxuICAgICAgICAgICAgLy8gYnkgYXBwZW5kaW5nIC9pbmRleC5odG1sIChlcXVpdmFsZW50IHRvIGFkZGluZyB0cmFpbGluZyBzbGFzaCArIGluZGV4Lmh0bWwpXG4gICAgICAgICAgICByZXF1ZXN0LnVyaSArPSAnL2luZGV4Lmh0bWwnO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICByZXR1cm4gcmVxdWVzdDtcbiAgICAgICAgfVxuICAgICAgYCksXG4gICAgICAgIGNvbW1lbnQ6XG4gICAgICAgICAgJ1VSTCByZXdyaXRlIGZ1bmN0aW9uIGZvciBTUEEgcm91dGluZyB3aXRoIHRyYWlsaW5nIHNsYXNoIHN1cHBvcnQnLFxuICAgICAgfVxuICAgICk7XG5cbiAgICB0aGlzLmRpc3RyaWJ1dGlvbiA9IG5ldyBjbG91ZGZyb250LkRpc3RyaWJ1dGlvbihcbiAgICAgIHRoaXMsXG4gICAgICAnR3ltQ29hY2hBSURpc3RyaWJ1dGlvbicsXG4gICAgICB7XG4gICAgICAgIGRlZmF1bHRSb290T2JqZWN0OiAnaW5kZXguaHRtbCcsXG4gICAgICAgIGRlZmF1bHRCZWhhdmlvcjoge1xuICAgICAgICAgIG9yaWdpbjogb3JpZ2lucy5TM0J1Y2tldE9yaWdpbi53aXRoT3JpZ2luQWNjZXNzSWRlbnRpdHkoXG4gICAgICAgICAgICB0aGlzLmZyb250ZW5kQnVja2V0LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBvcmlnaW5BY2Nlc3NJZGVudGl0eTogZnJvbnRlbmRPQUksXG4gICAgICAgICAgICB9XG4gICAgICAgICAgKSxcbiAgICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTpcbiAgICAgICAgICAgIGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfR0VUX0hFQURfT1BUSU9OUyxcbiAgICAgICAgICBjYWNoZVBvbGljeTogbmV3IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3kodGhpcywgJ0Zyb250ZW5kQ2FjaGVQb2xpY3knLCB7XG4gICAgICAgICAgICBjYWNoZVBvbGljeU5hbWU6ICdmcm9udGVuZC1jYWNoZS1wb2xpY3knLFxuICAgICAgICAgICAgZGVmYXVsdFR0bDogY2RrLkR1cmF0aW9uLmhvdXJzKDI0KSxcbiAgICAgICAgICAgIG1heFR0bDogY2RrLkR1cmF0aW9uLmRheXMoMzY1KSxcbiAgICAgICAgICAgIG1pblR0bDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMCksXG4gICAgICAgICAgICBoZWFkZXJCZWhhdmlvcjogY2xvdWRmcm9udC5DYWNoZUhlYWRlckJlaGF2aW9yLmFsbG93TGlzdChcbiAgICAgICAgICAgICAgJ0Nsb3VkRnJvbnQtVmlld2VyLUNvdW50cnknXG4gICAgICAgICAgICApLFxuICAgICAgICAgICAgcXVlcnlTdHJpbmdCZWhhdmlvcjogY2xvdWRmcm9udC5DYWNoZVF1ZXJ5U3RyaW5nQmVoYXZpb3IuYWxsKCksXG4gICAgICAgICAgICBjb29raWVCZWhhdmlvcjogY2xvdWRmcm9udC5DYWNoZUNvb2tpZUJlaGF2aW9yLm5vbmUoKSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBmdW5jdGlvbkFzc29jaWF0aW9uczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBmdW5jdGlvbjogdXJsUmV3cml0ZUZ1bmN0aW9uLFxuICAgICAgICAgICAgICBldmVudFR5cGU6IGNsb3VkZnJvbnQuRnVuY3Rpb25FdmVudFR5cGUuVklFV0VSX1JFUVVFU1QsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICAgIGFkZGl0aW9uYWxCZWhhdmlvcnM6IHtcbiAgICAgICAgICAvLyAnL2FwaS91c2Vycy8qJzoge1xuICAgICAgICAgIC8vICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5IdHRwT3JpZ2luKHVzZXJTZXJ2aWNlVXJsLnVybCksXG4gICAgICAgICAgLy8gICB2aWV3ZXJQcm90b2NvbFBvbGljeTpcbiAgICAgICAgICAvLyAgICAgY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgICAvLyAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0FMTCxcbiAgICAgICAgICAvLyAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfRElTQUJMRUQsXG4gICAgICAgICAgLy8gICBvcmlnaW5SZXF1ZXN0UG9saWN5OlxuICAgICAgICAgIC8vICAgICBjbG91ZGZyb250Lk9yaWdpblJlcXVlc3RQb2xpY3kuQUxMX1ZJRVdFUl9FWENFUFRfSE9TVF9IRUFERVIsXG4gICAgICAgICAgLy8gfSxcbiAgICAgICAgICAnL2FwaS91c2VyLXByb2ZpbGVzLyonOiB7XG4gICAgICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLkh0dHBPcmlnaW4odXNlclByb2ZpbGVEb21haW4pLFxuICAgICAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6XG4gICAgICAgICAgICAgIGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgICAgICBhbGxvd2VkTWV0aG9kczogY2xvdWRmcm9udC5BbGxvd2VkTWV0aG9kcy5BTExPV19BTEwsXG4gICAgICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX0RJU0FCTEVELFxuICAgICAgICAgICAgb3JpZ2luUmVxdWVzdFBvbGljeTpcbiAgICAgICAgICAgICAgY2xvdWRmcm9udC5PcmlnaW5SZXF1ZXN0UG9saWN5LkFMTF9WSUVXRVJfRVhDRVBUX0hPU1RfSEVBREVSLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgJy9hcGkvd29ya291dHMvKic6IHtcbiAgICAgICAgICAgIG9yaWdpbjogbmV3IG9yaWdpbnMuSHR0cE9yaWdpbih3b3Jrb3V0RG9tYWluKSxcbiAgICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OlxuICAgICAgICAgICAgICBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfQUxMLFxuICAgICAgICAgICAgY2FjaGVQb2xpY3k6IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3kuQ0FDSElOR19ESVNBQkxFRCxcbiAgICAgICAgICAgIG9yaWdpblJlcXVlc3RQb2xpY3k6XG4gICAgICAgICAgICAgIGNsb3VkZnJvbnQuT3JpZ2luUmVxdWVzdFBvbGljeS5BTExfVklFV0VSX0VYQ0VQVF9IT1NUX0hFQURFUixcbiAgICAgICAgICB9LFxuICAgICAgICAgICcvYXBpL2NvYWNoaW5nLyonOiB7XG4gICAgICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLkh0dHBPcmlnaW4oY29hY2hpbmdEb21haW4pLFxuICAgICAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6XG4gICAgICAgICAgICAgIGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgICAgICBhbGxvd2VkTWV0aG9kczogY2xvdWRmcm9udC5BbGxvd2VkTWV0aG9kcy5BTExPV19BTEwsXG4gICAgICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX0RJU0FCTEVELFxuICAgICAgICAgICAgb3JpZ2luUmVxdWVzdFBvbGljeTpcbiAgICAgICAgICAgICAgY2xvdWRmcm9udC5PcmlnaW5SZXF1ZXN0UG9saWN5LkFMTF9WSUVXRVJfRVhDRVBUX0hPU1RfSEVBREVSLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgJy9hcGkvYW5hbHl0aWNzLyonOiB7XG4gICAgICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLkh0dHBPcmlnaW4oYW5hbHl0aWNzRG9tYWluKSxcbiAgICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OlxuICAgICAgICAgICAgICBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfQUxMLFxuICAgICAgICAgICAgY2FjaGVQb2xpY3k6IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3kuQ0FDSElOR19ESVNBQkxFRCxcbiAgICAgICAgICAgIG9yaWdpblJlcXVlc3RQb2xpY3k6XG4gICAgICAgICAgICAgIGNsb3VkZnJvbnQuT3JpZ2luUmVxdWVzdFBvbGljeS5BTExfVklFV0VSX0VYQ0VQVF9IT1NUX0hFQURFUixcbiAgICAgICAgICB9LFxuICAgICAgICAgICcvYXBpL251dHJpdGlvbi8qJzoge1xuICAgICAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5IdHRwT3JpZ2luKG51dHJpdGlvbkRvbWFpbiksXG4gICAgICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTpcbiAgICAgICAgICAgICAgY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0FMTCxcbiAgICAgICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfRElTQUJMRUQsXG4gICAgICAgICAgICBvcmlnaW5SZXF1ZXN0UG9saWN5OlxuICAgICAgICAgICAgICBjbG91ZGZyb250Lk9yaWdpblJlcXVlc3RQb2xpY3kuQUxMX1ZJRVdFUl9FWENFUFRfSE9TVF9IRUFERVIsXG4gICAgICAgICAgfSxcbiAgICAgICAgICAnL3Byb2dyZXNzLXBob3Rvcy8qJzoge1xuICAgICAgICAgICAgb3JpZ2luOiBvcmlnaW5zLlMzQnVja2V0T3JpZ2luLndpdGhPcmlnaW5BY2Nlc3NJZGVudGl0eShcbiAgICAgICAgICAgICAgdGhpcy5wcm9ncmVzc1Bob3Rvc0J1Y2tldCxcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG9yaWdpbkFjY2Vzc0lkZW50aXR5OiBwcm9ncmVzc1Bob3Rvc09BSSxcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKSxcbiAgICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OlxuICAgICAgICAgICAgICBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfR0VUX0hFQUQsXG4gICAgICAgICAgICBjYWNoZVBvbGljeTogbmV3IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3koXG4gICAgICAgICAgICAgIHRoaXMsXG4gICAgICAgICAgICAgICdQcm9ncmVzc1Bob3Rvc0NhY2hlUG9saWN5JyxcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNhY2hlUG9saWN5TmFtZTogJ3Byb2dyZXNzLXBob3Rvcy1jYWNoZS1wb2xpY3knLFxuICAgICAgICAgICAgICAgIGRlZmF1bHRUdGw6IGNkay5EdXJhdGlvbi5ob3VycygyNCksXG4gICAgICAgICAgICAgICAgbWF4VHRsOiBjZGsuRHVyYXRpb24uZGF5cygzNjUpLFxuICAgICAgICAgICAgICAgIG1pblR0bDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMCksXG4gICAgICAgICAgICAgICAgaGVhZGVyQmVoYXZpb3I6IGNsb3VkZnJvbnQuQ2FjaGVIZWFkZXJCZWhhdmlvci5hbGxvd0xpc3QoXG4gICAgICAgICAgICAgICAgICAnQ2xvdWRGcm9udC1WaWV3ZXItQ291bnRyeSdcbiAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgIHF1ZXJ5U3RyaW5nQmVoYXZpb3I6IGNsb3VkZnJvbnQuQ2FjaGVRdWVyeVN0cmluZ0JlaGF2aW9yLm5vbmUoKSxcbiAgICAgICAgICAgICAgICBjb29raWVCZWhhdmlvcjogY2xvdWRmcm9udC5DYWNoZUNvb2tpZUJlaGF2aW9yLm5vbmUoKSxcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIC8vICcvYXBpL2FpLyonOiB7XG4gICAgICAgICAgLy8gICBvcmlnaW46IG5ldyBvcmlnaW5zLkh0dHBPcmlnaW4oYWlTZXJ2aWNlVXJsLnVybCksXG4gICAgICAgICAgLy8gICB2aWV3ZXJQcm90b2NvbFBvbGljeTpcbiAgICAgICAgICAvLyAgICAgY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgICAvLyAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0FMTCxcbiAgICAgICAgICAvLyAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfRElTQUJMRUQsXG4gICAgICAgICAgLy8gICBvcmlnaW5SZXF1ZXN0UG9saWN5OlxuICAgICAgICAgIC8vICAgICBjbG91ZGZyb250Lk9yaWdpblJlcXVlc3RQb2xpY3kuQUxMX1ZJRVdFUl9FWENFUFRfSE9TVF9IRUFERVIsXG4gICAgICAgICAgLy8gfSxcbiAgICAgICAgfSxcbiAgICAgICAgY29tbWVudDogJ0d5bUNvYWNoIEFJIENsb3VkRnJvbnQgRGlzdHJpYnV0aW9uJyxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gR3JhbnQgcGVybWlzc2lvbnMgdG8gTGFtYmRhIGZ1bmN0aW9ucyBmb3IgUzMgYWNjZXNzXG4gICAgdGhpcy51c2VyVXBsb2Fkc0J1Y2tldC5ncmFudFJlYWRXcml0ZSh1c2VyUHJvZmlsZVNlcnZpY2VMYW1iZGEpO1xuICAgIHRoaXMudXNlclVwbG9hZHNCdWNrZXQuZ3JhbnRSZWFkV3JpdGUod29ya291dFNlcnZpY2VMYW1iZGEpO1xuICAgIHRoaXMudXNlclVwbG9hZHNCdWNrZXQuZ3JhbnRSZWFkV3JpdGUoYW5hbHl0aWNzU2VydmljZUxhbWJkYSk7XG5cbiAgICB0aGlzLnByb2Nlc3NlZEltYWdlc0J1Y2tldC5ncmFudFJlYWRXcml0ZSh1c2VyUHJvZmlsZVNlcnZpY2VMYW1iZGEpO1xuICAgIHRoaXMucHJvY2Vzc2VkSW1hZ2VzQnVja2V0LmdyYW50UmVhZFdyaXRlKHdvcmtvdXRTZXJ2aWNlTGFtYmRhKTtcbiAgICB0aGlzLnByb2Nlc3NlZEltYWdlc0J1Y2tldC5ncmFudFJlYWRXcml0ZShhbmFseXRpY3NTZXJ2aWNlTGFtYmRhKTtcblxuICAgIC8vIEdyYW50IGFuYWx5dGljcyBzZXJ2aWNlIGZ1bGwgYWNjZXNzIHRvIHByb2dyZXNzIHBob3RvcyBidWNrZXRcbiAgICB0aGlzLnByb2dyZXNzUGhvdG9zQnVja2V0LmdyYW50UmVhZFdyaXRlKGFuYWx5dGljc1NlcnZpY2VMYW1iZGEpO1xuXG4gICAgLy8gQWxsb3cgc2VydmljZSB0byByZWFkIGZyb20gdGhlIG1haW4gRHluYW1vREIgdGFibGVcbiAgICB0aGlzLm1haW5UYWJsZS5ncmFudFJlYWREYXRhKGFuYWx5dGljc1NlcnZpY2VMYW1iZGEpO1xuICAgIHRoaXMubWFpblRhYmxlLmdyYW50UmVhZERhdGEobnV0cml0aW9uU2VydmljZUxhbWJkYSk7XG4gICAgdGhpcy5tYWluVGFibGUuZ3JhbnRSZWFkRGF0YSh1c2VyUHJvZmlsZVNlcnZpY2VMYW1iZGEpO1xuICAgIHRoaXMubWFpblRhYmxlLmdyYW50UmVhZERhdGEod29ya291dFNlcnZpY2VMYW1iZGEpO1xuICAgIHRoaXMubWFpblRhYmxlLmdyYW50UmVhZERhdGEoY29hY2hpbmdTZXJ2aWNlTGFtYmRhKTtcbiAgICB0aGlzLm1haW5UYWJsZS5ncmFudFdyaXRlRGF0YShhbmFseXRpY3NTZXJ2aWNlTGFtYmRhKTtcbiAgICB0aGlzLm1haW5UYWJsZS5ncmFudFdyaXRlRGF0YShudXRyaXRpb25TZXJ2aWNlTGFtYmRhKTtcbiAgICB0aGlzLm1haW5UYWJsZS5ncmFudFdyaXRlRGF0YSh1c2VyUHJvZmlsZVNlcnZpY2VMYW1iZGEpO1xuICAgIHRoaXMubWFpblRhYmxlLmdyYW50V3JpdGVEYXRhKHdvcmtvdXRTZXJ2aWNlTGFtYmRhKTtcbiAgICB0aGlzLm1haW5UYWJsZS5ncmFudFdyaXRlRGF0YShjb2FjaGluZ1NlcnZpY2VMYW1iZGEpO1xuXG4gICAgLy8gRW5zdXJlIG51dHJpdGlvbiBzZXJ2aWNlIGNhbiBRdWVyeSBHU0lzIGV4cGxpY2l0bHlcbiAgICBudXRyaXRpb25TZXJ2aWNlTGFtYmRhLmFkZFRvUm9sZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbJ2R5bmFtb2RiOlF1ZXJ5JywgJ2R5bmFtb2RiOkdldEl0ZW0nXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgdGhpcy5tYWluVGFibGUudGFibGVBcm4sXG4gICAgICAgICAgYCR7dGhpcy5tYWluVGFibGUudGFibGVBcm59L2luZGV4LypgLFxuICAgICAgICBdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gUmVtb3ZlZCBDbG91ZFdhdGNoIExvZyBHcm91cHMgdG8gYXZvaWQgY29zdHNcbiAgICAvLyBMYW1iZGEgZnVuY3Rpb25zIHdpbGwgdXNlIGRlZmF1bHQgbG9nIGdyb3VwcyAoZnJlZSB0aWVyOiA1R0IvbW9udGgpXG5cbiAgICAvLyBPdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1VzZXJQb29sSWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgZGVzY3JpcHRpb246ICdDb2duaXRvIFVzZXIgUG9vbCBJRCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclBvb2xDbGllbnRJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvZ25pdG8gVXNlciBQb29sIENsaWVudCBJRCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclBvb2xEb21haW4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy51c2VyUG9vbERvbWFpbi5kb21haW5OYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdDb2duaXRvIFVzZXIgUG9vbCBEb21haW4nLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Nsb3VkRnJvbnRVcmwnLCB7XG4gICAgICB2YWx1ZTogYGh0dHBzOi8vJHt0aGlzLmRpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25Eb21haW5OYW1lfWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ0Nsb3VkRnJvbnQgRGlzdHJpYnV0aW9uIFVSTCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVGFibGVOYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMubWFpblRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRHluYW1vREIgVGFibGUgTmFtZScsXG4gICAgfSk7XG5cbiAgICAvLyBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclNlcnZpY2VVcmwnLCB7XG4gICAgLy8gICB2YWx1ZTogdXNlclNlcnZpY2VVcmwudXJsLFxuICAgIC8vICAgZGVzY3JpcHRpb246ICdVc2VyIFNlcnZpY2UgTGFtYmRhIEZ1bmN0aW9uIFVSTCcsXG4gICAgLy8gfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclByb2ZpbGVTZXJ2aWNlVXJsJywge1xuICAgICAgdmFsdWU6IHVzZXJQcm9maWxlU2VydmljZVVybC51cmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ1VzZXIgUHJvZmlsZSBTZXJ2aWNlIExhbWJkYSBGdW5jdGlvbiBVUkwnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1dvcmtvdXRTZXJ2aWNlVXJsJywge1xuICAgICAgdmFsdWU6IHdvcmtvdXRTZXJ2aWNlVXJsLnVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnV29ya291dCBTZXJ2aWNlIExhbWJkYSBGdW5jdGlvbiBVUkwnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0NvYWNoaW5nU2VydmljZVVybCcsIHtcbiAgICAgIHZhbHVlOiBjb2FjaGluZ1NlcnZpY2VVcmwudXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdDb2FjaGluZyBTZXJ2aWNlIExhbWJkYSBGdW5jdGlvbiBVUkwnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FuYWx5dGljc1NlcnZpY2VVcmwnLCB7XG4gICAgICB2YWx1ZTogYW5hbHl0aWNzU2VydmljZVVybC51cmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FuYWx5dGljcyBTZXJ2aWNlIExhbWJkYSBGdW5jdGlvbiBVUkwnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ051dHJpdGlvblNlcnZpY2VVcmwnLCB7XG4gICAgICB2YWx1ZTogbnV0cml0aW9uU2VydmljZVVybC51cmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ051dHJpdGlvbiBTZXJ2aWNlIExhbWJkYSBGdW5jdGlvbiBVUkwnLFxuICAgIH0pO1xuXG4gICAgLy8gbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FJU2VydmljZVVybCcsIHtcbiAgICAvLyAgIHZhbHVlOiBhaVNlcnZpY2VVcmwudXJsLFxuICAgIC8vICAgZGVzY3JpcHRpb246ICdBSSBTZXJ2aWNlIExhbWJkYSBGdW5jdGlvbiBVUkwnLFxuICAgIC8vIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1VzZXJVcGxvYWRzQnVja2V0TmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnVzZXJVcGxvYWRzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1VzZXIgVXBsb2FkcyBTMyBCdWNrZXQgTmFtZScsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnU3RhdGljQXNzZXRzQnVja2V0TmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnN0YXRpY0Fzc2V0c0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdTdGF0aWMgQXNzZXRzIFMzIEJ1Y2tldCBOYW1lJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdQcm9jZXNzZWRJbWFnZXNCdWNrZXROYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMucHJvY2Vzc2VkSW1hZ2VzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1Byb2Nlc3NlZCBJbWFnZXMgUzMgQnVja2V0IE5hbWUnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Zyb250ZW5kQnVja2V0TmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmZyb250ZW5kQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0Zyb250ZW5kIFMzIEJ1Y2tldCBOYW1lJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDbG91ZEZyb250RGlzdHJpYnV0aW9uVVJMJywge1xuICAgICAgdmFsdWU6IGBodHRwczovLyR7dGhpcy5kaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uRG9tYWluTmFtZX1gLFxuICAgICAgZGVzY3JpcHRpb246ICdDbG91ZEZyb250IERpc3RyaWJ1dGlvbiBVUkwnLFxuICAgIH0pO1xuXG4gICAgLy8gUmVtb3ZlZCBtb25pdG9yaW5nIHN0YWNrIHRvIGF2b2lkIENsb3VkV2F0Y2ggY29zdHNcbiAgICAvLyB0aGlzLmNyZWF0ZU1vbml0b3JpbmdTdGFjaygpO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVMYW1iZGFGdW5jdGlvbihcbiAgICBuYW1lOiBzdHJpbmcsXG4gICAgc2VydmljZU5hbWU6IHN0cmluZ1xuICApOiBsYW1iZGEuRnVuY3Rpb24ge1xuICAgIHJldHVybiBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsIGAke25hbWV9TGFtYmRhYCwge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFJPVklERURfQUwyLFxuICAgICAgaGFuZGxlcjogJ2Jvb3RzdHJhcCcsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoXG4gICAgICAgIGAuLi9zZXJ2aWNlcy8ke3NlcnZpY2VOYW1lfS90YXJnZXQvbGFtYmRhLyR7c2VydmljZU5hbWV9YFxuICAgICAgKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFRBQkxFX05BTUU6IHRoaXMubWFpblRhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgRFlOQU1PREJfVEFCTEU6IHRoaXMubWFpblRhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgVVNFUl9QT09MX0lEOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICAgIFVTRVJfUE9PTF9DTElFTlRfSUQ6IHRoaXMudXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcbiAgICAgICAgVVNFUl9VUExPQURTX0JVQ0tFVDogdGhpcy51c2VyVXBsb2Fkc0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBTVEFUSUNfQVNTRVRTX0JVQ0tFVDogdGhpcy5zdGF0aWNBc3NldHNCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgUFJPQ0VTU0VEX0lNQUdFU19CVUNLRVQ6IHRoaXMucHJvY2Vzc2VkSW1hZ2VzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgIFBST0dSRVNTX1BIT1RPU19CVUNLRVQ6IHRoaXMucHJvZ3Jlc3NQaG90b3NCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgSldUX1NFQ1JFVDogJ3lvdXItand0LXNlY3JldC1oZXJlJywgLy8gSW4gcHJvZHVjdGlvbiwgdXNlIEFXUyBTZWNyZXRzIE1hbmFnZXJcbiAgICAgICAgQ09HTklUT19SRUdJT046IHRoaXMucmVnaW9uLFxuICAgICAgICBDT0dOSVRPX1VTRVJfUE9PTF9JRDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgICBSVVNUX0xPRzogJ2luZm8nLFxuICAgICAgICBSVVNUX0JBQ0tUUkFDRTogJzEnLFxuICAgICAgfSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NiwgLy8gT3B0aW1pemVkIGZvciBjb2xkIHN0YXJ0c1xuICAgICAgcmVzZXJ2ZWRDb25jdXJyZW50RXhlY3V0aW9uczogMTAsIC8vIFByZXZlbnQgY29sZCBzdGFydHMgZHVyaW5nIGhpZ2ggbG9hZFxuICAgICAgLy8gUmVtb3ZlZCBsb2cgcmV0ZW50aW9uIHRvIHVzZSBmcmVlIHRpZXIgZGVmYXVsdHMgKDVHQi9tb250aCBmcmVlKVxuICAgICAgLy8gUmVtb3ZlZCBYLVJheSB0cmFjaW5nIHRvIGF2b2lkIGNvc3RzICgkNSBwZXIgMU0gdHJhY2VzKVxuICAgICAgbGF5ZXJzOiBbdGhpcy5jcmVhdGVBdXRoTGF5ZXIoKV0sXG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZVB5dGhvbkxhbWJkYUZ1bmN0aW9uKFxuICAgIG5hbWU6IHN0cmluZyxcbiAgICBzZXJ2aWNlTmFtZTogc3RyaW5nXG4gICk6IGxhbWJkYS5GdW5jdGlvbiB7XG4gICAgcmV0dXJuIG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgYCR7bmFtZX1MYW1iZGFgLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMSxcbiAgICAgIGhhbmRsZXI6ICdsYW1iZGFfZnVuY3Rpb24ubGFtYmRhX2hhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KGAuLi9zZXJ2aWNlcy8ke3NlcnZpY2VOYW1lfWApLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgRFlOQU1PREJfVEFCTEU6IHRoaXMubWFpblRhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgVVNFUl9QT09MX0lEOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICAgIFVTRVJfUE9PTF9DTElFTlRfSUQ6IHRoaXMudXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcbiAgICAgICAgVVNFUl9VUExPQURTX0JVQ0tFVDogdGhpcy51c2VyVXBsb2Fkc0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBTVEFUSUNfQVNTRVRTX0JVQ0tFVDogdGhpcy5zdGF0aWNBc3NldHNCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgUFJPQ0VTU0VEX0lNQUdFU19CVUNLRVQ6IHRoaXMucHJvY2Vzc2VkSW1hZ2VzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgIFBST0dSRVNTX1BIT1RPU19CVUNLRVQ6IHRoaXMucHJvZ3Jlc3NQaG90b3NCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgSldUX1NFQ1JFVDogJ3lvdXItand0LXNlY3JldC1oZXJlJywgLy8gSW4gcHJvZHVjdGlvbiwgdXNlIEFXUyBTZWNyZXRzIE1hbmFnZXJcbiAgICAgICAgQ09HTklUT19SRUdJT046IHRoaXMucmVnaW9uLFxuICAgICAgICBDT0dOSVRPX1VTRVJfUE9PTF9JRDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgICBBV1NfUkVHSU9OOiB0aGlzLnJlZ2lvbixcbiAgICAgICAgUFlUSE9OUEFUSDogJy92YXIvcnVudGltZTovdmFyL3Rhc2snLFxuICAgICAgfSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLCAvLyBBSSBmdW5jdGlvbnMgbWF5IG5lZWQgbW9yZSB0aW1lXG4gICAgICBtZW1vcnlTaXplOiAxMDI0LCAvLyBBSSBmdW5jdGlvbnMgbmVlZCBtb3JlIG1lbW9yeVxuICAgICAgcmVzZXJ2ZWRDb25jdXJyZW50RXhlY3V0aW9uczogNSwgLy8gTGltaXQgY29uY3VycmVudCBleGVjdXRpb25zIGZvciBBSSBmdW5jdGlvbnNcbiAgICAgIC8vIFJlbW92ZWQgbG9nIHJldGVudGlvbiB0byB1c2UgZnJlZSB0aWVyIGRlZmF1bHRzICg1R0IvbW9udGggZnJlZSlcbiAgICAgIC8vIFJlbW92ZWQgWC1SYXkgdHJhY2luZyB0byBhdm9pZCBjb3N0cyAoJDUgcGVyIDFNIHRyYWNlcylcbiAgICAgIGxheWVyczogW3RoaXMuY3JlYXRlUHl0aG9uQXV0aExheWVyKCldLFxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVBdXRoTGF5ZXIoKTogbGFtYmRhLkxheWVyVmVyc2lvbiB7XG4gICAgaWYgKHRoaXMuYXV0aExheWVyKSB7XG4gICAgICByZXR1cm4gdGhpcy5hdXRoTGF5ZXI7XG4gICAgfVxuICAgIHRoaXMuYXV0aExheWVyID0gbmV3IGxhbWJkYS5MYXllclZlcnNpb24odGhpcywgJ0F1dGhMYXllcicsIHtcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4vc2VydmljZXMvYXV0aC1sYXllci9sYXllcicpLFxuICAgICAgY29tcGF0aWJsZVJ1bnRpbWVzOiBbbGFtYmRhLlJ1bnRpbWUuUFJPVklERURfQUwyXSxcbiAgICAgIGRlc2NyaXB0aW9uOlxuICAgICAgICAnQXV0aGVudGljYXRpb24gYW5kIGF1dGhvcml6YXRpb24gbGF5ZXIgZm9yIEd5bUNvYWNoIEFJIHNlcnZpY2VzJyxcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcy5hdXRoTGF5ZXI7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZVB5dGhvbkF1dGhMYXllcigpOiBsYW1iZGEuTGF5ZXJWZXJzaW9uIHtcbiAgICBpZiAodGhpcy5weXRob25BdXRoTGF5ZXIpIHtcbiAgICAgIHJldHVybiB0aGlzLnB5dGhvbkF1dGhMYXllcjtcbiAgICB9XG4gICAgdGhpcy5weXRob25BdXRoTGF5ZXIgPSBuZXcgbGFtYmRhLkxheWVyVmVyc2lvbih0aGlzLCAnUHl0aG9uQXV0aExheWVyJywge1xuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9zZXJ2aWNlcy9haS1zZXJ2aWNlLXB5dGhvbicpLFxuICAgICAgY29tcGF0aWJsZVJ1bnRpbWVzOiBbbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTFdLFxuICAgICAgZGVzY3JpcHRpb246ICdQeXRob24gYXV0aGVudGljYXRpb24gbGF5ZXIgZm9yIEFJIHNlcnZpY2VzJyxcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcy5weXRob25BdXRoTGF5ZXI7XG4gIH1cblxuICAvLyBSZW1vdmVkIGNyZWF0ZU1vbml0b3JpbmdTdGFjayBtZXRob2QgdG8gYXZvaWQgQ2xvdWRXYXRjaCBjb3N0c1xuICAvLyBwcml2YXRlIGNyZWF0ZU1vbml0b3JpbmdTdGFjaygpIHtcbiAgLy8gICAvLyBDcmVhdGUgbW9uaXRvcmluZyBzdGFja1xuICAvLyAgIG5ldyBNb25pdG9yaW5nU3RhY2sodGhpcywgJ01vbml0b3JpbmdTdGFjaycsIHtcbiAgLy8gICAgIGxhbWJkYUZ1bmN0aW9uczogW1xuICAvLyAgICAgICB0aGlzLnVzZXJTZXJ2aWNlTGFtYmRhLFxuICAvLyAgICAgICB0aGlzLnVzZXJQcm9maWxlU2VydmljZUxhbWJkYSxcbiAgLy8gICAgICAgdGhpcy53b3Jrb3V0U2VydmljZUxhbWJkYSxcbiAgLy8gICAgICAgdGhpcy5jb2FjaGluZ1NlcnZpY2VMYW1iZGEsXG4gIC8vICAgICAgIHRoaXMuYW5hbHl0aWNzU2VydmljZUxhbWJkYSxcbiAgLy8gICAgICAgdGhpcy5udXRyaXRpb25TZXJ2aWNlTGFtYmRhLFxuICAvLyAgICAgICB0aGlzLmFpU2VydmljZUxhbWJkYSxcbiAgLy8gICAgIF0sXG4gIC8vICAgICBkeW5hbW9EYlRhYmxlOiB0aGlzLm1haW5UYWJsZSxcbiAgLy8gICAgIHMzQnVja2V0czogW1xuICAvLyAgICAgICB0aGlzLnVzZXJVcGxvYWRzQnVja2V0LFxuICAvLyAgICAgICB0aGlzLnN0YXRpY0Fzc2V0c0J1Y2tldCxcbiAgLy8gICAgICAgdGhpcy5wcm9jZXNzZWRJbWFnZXNCdWNrZXQsXG4gIC8vICAgICBdLFxuICAvLyAgIH0pO1xuICAvLyB9XG59XG4iXX0=