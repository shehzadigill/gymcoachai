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
        this.distribution = new cloudfront.Distribution(this, 'GymCoachAIDistribution', {
            defaultBehavior: {
                origin: new origins.HttpOrigin(userProfileDomain),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
                cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
                originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3ltY29hY2gtYWktc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvZ3ltY29hY2gtYWktc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBQ25DLGlEQUFpRDtBQUNqRCx5REFBeUQ7QUFDekQsOERBQThEO0FBRTlELHFEQUFxRDtBQUNyRCwyQ0FBMkM7QUFDM0MsbURBQW1EO0FBRW5ELHlDQUF5QztBQUV6QywyREFBMkQ7QUFFM0QsTUFBYSxlQUFnQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBWTVDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDOUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsMENBQTBDO1FBQzFDLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRTtZQUMzRCxTQUFTLEVBQUUsa0JBQWtCO1lBQzdCLFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQ2pFLE9BQU8sRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQzVELFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7WUFDakQsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztZQUN4QyxpRUFBaUU7U0FDbEUsQ0FBQyxDQUFDO1FBRUgsd0NBQXdDO1FBQ3hDLElBQUksQ0FBQyxTQUFTLENBQUMsdUJBQXVCLENBQUM7WUFDckMsU0FBUyxFQUFFLE1BQU07WUFDakIsWUFBWSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVB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O1lBQzFELElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyw4QkFBOEIsQ0FBQztZQUMzRCxrQkFBa0IsRUFBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDO1lBQ2pELFdBQVcsRUFDVCxpRUFBaUU7U0FDcEUsQ0FBQyxDQUFDO1FBQ0gsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDO0lBQ3hCLENBQUM7SUFFTyxxQkFBcUI7UUFDM0IsSUFBSSxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDekIsT0FBTyxJQUFJLENBQUMsZUFBZSxDQUFDO1FBQzlCLENBQUM7UUFDRCxJQUFJLENBQUMsZUFBZSxHQUFHLElBQUksTUFBTSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsaUJBQWlCLEVBQUU7WUFDdEUsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLCtCQUErQixDQUFDO1lBQzVELGtCQUFrQixFQUFFLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUM7WUFDaEQsV0FBVyxFQUFFLDZDQUE2QztTQUMzRCxDQUFDLENBQUM7UUFDSCxPQUFPLElBQUksQ0FBQyxlQUFlLENBQUM7SUFDOUIsQ0FBQztDQXVCRjtBQW51QkQsMENBbXVCQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBjbG91ZGZyb250IGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250JztcbmltcG9ydCAqIGFzIG9yaWdpbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQtb3JpZ2lucyc7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBjb2duaXRvIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jb2duaXRvJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuLy8gUmVtb3ZlZCBNb25pdG9yaW5nU3RhY2sgaW1wb3J0IHRvIGF2b2lkIENsb3VkV2F0Y2ggY29zdHNcblxuZXhwb3J0IGNsYXNzIEd5bUNvYWNoQUlTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSB1c2VyUG9vbDogY29nbml0by5Vc2VyUG9vbDtcbiAgcHVibGljIHJlYWRvbmx5IHVzZXJQb29sQ2xpZW50OiBjb2duaXRvLlVzZXJQb29sQ2xpZW50O1xuICBwdWJsaWMgcmVhZG9ubHkgdXNlclBvb2xEb21haW46IGNvZ25pdG8uVXNlclBvb2xEb21haW47XG4gIHB1YmxpYyByZWFkb25seSBtYWluVGFibGU6IGR5bmFtb2RiLlRhYmxlO1xuICBwdWJsaWMgcmVhZG9ubHkgZGlzdHJpYnV0aW9uOiBjbG91ZGZyb250LkRpc3RyaWJ1dGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IHVzZXJVcGxvYWRzQnVja2V0OiBzMy5CdWNrZXQ7XG4gIHB1YmxpYyByZWFkb25seSBzdGF0aWNBc3NldHNCdWNrZXQ6IHMzLkJ1Y2tldDtcbiAgcHVibGljIHJlYWRvbmx5IHByb2Nlc3NlZEltYWdlc0J1Y2tldDogczMuQnVja2V0O1xuICBwcml2YXRlIGF1dGhMYXllcj86IGxhbWJkYS5MYXllclZlcnNpb247XG4gIHByaXZhdGUgcHl0aG9uQXV0aExheWVyPzogbGFtYmRhLkxheWVyVmVyc2lvbjtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IGNkay5TdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyBEeW5hbW9EQiBUYWJsZSB3aXRoIFNpbmdsZSBUYWJsZSBEZXNpZ25cbiAgICB0aGlzLm1haW5UYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnR3ltQ29hY2hBSVRhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiAnZ3ltY29hY2gtYWktbWFpbicsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ1BLJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ1NLJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgLy8gUmVtb3ZlZCBwb2ludEluVGltZVJlY292ZXJ5IHRvIGF2b2lkIGNvc3RzICgyMCUgb2YgdGFibGUgY29zdClcbiAgICB9KTtcblxuICAgIC8vIEFkZCBHU0kgZm9yIGRpZmZlcmVudCBhY2Nlc3MgcGF0dGVybnNcbiAgICB0aGlzLm1haW5UYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdHU0kxJyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnR1NJMVBLJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ0dTSTFTSycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgfSk7XG5cbiAgICB0aGlzLm1haW5UYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdHU0kyJyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnR1NJMlBLJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ0dTSTJTSycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgQ29nbml0byBVc2VyIFBvb2xcbiAgICB0aGlzLnVzZXJQb29sID0gbmV3IGNvZ25pdG8uVXNlclBvb2wodGhpcywgJ0d5bUNvYWNoQUlVc2VyUG9vbCcsIHtcbiAgICAgIHVzZXJQb29sTmFtZTogJ2d5bWNvYWNoLWFpLXVzZXJzJyxcbiAgICAgIHNlbGZTaWduVXBFbmFibGVkOiB0cnVlLFxuICAgICAgc2lnbkluQWxpYXNlczoge1xuICAgICAgICBlbWFpbDogdHJ1ZSxcbiAgICAgICAgdXNlcm5hbWU6IHRydWUsXG4gICAgICB9LFxuICAgICAgYXV0b1ZlcmlmeToge1xuICAgICAgICBlbWFpbDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBzdGFuZGFyZEF0dHJpYnV0ZXM6IHtcbiAgICAgICAgZW1haWw6IHtcbiAgICAgICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICBnaXZlbk5hbWU6IHtcbiAgICAgICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICBmYW1pbHlOYW1lOiB7XG4gICAgICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBjdXN0b21BdHRyaWJ1dGVzOiB7XG4gICAgICAgIGZpdG5lc3NHb2FsczogbmV3IGNvZ25pdG8uU3RyaW5nQXR0cmlidXRlKHtcbiAgICAgICAgICBtaW5MZW46IDEsXG4gICAgICAgICAgbWF4TGVuOiAxMDAsXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcbiAgICAgICAgfSksXG4gICAgICAgIGV4cGVyaWVuY2VMZXZlbDogbmV3IGNvZ25pdG8uU3RyaW5nQXR0cmlidXRlKHtcbiAgICAgICAgICBtaW5MZW46IDEsXG4gICAgICAgICAgbWF4TGVuOiAyMCxcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxuICAgICAgICB9KSxcbiAgICAgICAgc3Vic2NyaXB0aW9uVGllcjogbmV3IGNvZ25pdG8uU3RyaW5nQXR0cmlidXRlKHtcbiAgICAgICAgICBtaW5MZW46IDEsXG4gICAgICAgICAgbWF4TGVuOiAyMCxcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxuICAgICAgICB9KSxcbiAgICAgIH0sXG4gICAgICBwYXNzd29yZFBvbGljeToge1xuICAgICAgICBtaW5MZW5ndGg6IDgsXG4gICAgICAgIHJlcXVpcmVMb3dlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVVcHBlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVEaWdpdHM6IHRydWUsXG4gICAgICAgIHJlcXVpcmVTeW1ib2xzOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIG1mYTogY29nbml0by5NZmEuT1BUSU9OQUwsXG4gICAgICBtZmFTZWNvbmRGYWN0b3I6IHtcbiAgICAgICAgc21zOiB0cnVlLFxuICAgICAgICBvdHA6IHRydWUsXG4gICAgICB9LFxuICAgICAgZGV2aWNlVHJhY2tpbmc6IHtcbiAgICAgICAgY2hhbGxlbmdlUmVxdWlyZWRPbk5ld0RldmljZTogdHJ1ZSxcbiAgICAgICAgZGV2aWNlT25seVJlbWVtYmVyZWRPblVzZXJQcm9tcHQ6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIGFjY291bnRSZWNvdmVyeTogY29nbml0by5BY2NvdW50UmVjb3ZlcnkuRU1BSUxfT05MWSxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgVXNlciBQb29sIENsaWVudCBmb3IgV2ViIEFwcFxuICAgIHRoaXMudXNlclBvb2xDbGllbnQgPSBuZXcgY29nbml0by5Vc2VyUG9vbENsaWVudCh0aGlzLCAnV2ViQXBwQ2xpZW50Jywge1xuICAgICAgdXNlclBvb2w6IHRoaXMudXNlclBvb2wsXG4gICAgICB1c2VyUG9vbENsaWVudE5hbWU6ICdneW1jb2FjaC1haS13ZWItY2xpZW50JyxcbiAgICAgIGdlbmVyYXRlU2VjcmV0OiBmYWxzZSxcbiAgICAgIGF1dGhGbG93czoge1xuICAgICAgICB1c2VyUGFzc3dvcmQ6IHRydWUsXG4gICAgICAgIHVzZXJTcnA6IHRydWUsXG4gICAgICAgIGN1c3RvbTogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBvQXV0aDoge1xuICAgICAgICBmbG93czoge1xuICAgICAgICAgIGF1dGhvcml6YXRpb25Db2RlR3JhbnQ6IHRydWUsXG4gICAgICAgICAgaW1wbGljaXRDb2RlR3JhbnQ6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgIHNjb3BlczogW1xuICAgICAgICAgIGNvZ25pdG8uT0F1dGhTY29wZS5FTUFJTCxcbiAgICAgICAgICBjb2duaXRvLk9BdXRoU2NvcGUuT1BFTklELFxuICAgICAgICAgIGNvZ25pdG8uT0F1dGhTY29wZS5QUk9GSUxFLFxuICAgICAgICBdLFxuICAgICAgICBjYWxsYmFja1VybHM6IFtcbiAgICAgICAgICAnaHR0cDovL2xvY2FsaG9zdDozMDAwL2F1dGgvY2FsbGJhY2snLFxuICAgICAgICAgICdodHRwczovLyouY2xvdWRmcm9udC5uZXQvYXV0aC9jYWxsYmFjaycsXG4gICAgICAgIF0sXG4gICAgICAgIGxvZ291dFVybHM6IFtcbiAgICAgICAgICAnaHR0cDovL2xvY2FsaG9zdDozMDAwL2F1dGgvbG9nb3V0JyxcbiAgICAgICAgICAnaHR0cHM6Ly8qLmNsb3VkZnJvbnQubmV0L2F1dGgvbG9nb3V0JyxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgICByZWZyZXNoVG9rZW5WYWxpZGl0eTogY2RrLkR1cmF0aW9uLmRheXMoMzApLFxuICAgICAgYWNjZXNzVG9rZW5WYWxpZGl0eTogY2RrLkR1cmF0aW9uLmhvdXJzKDEpLFxuICAgICAgaWRUb2tlblZhbGlkaXR5OiBjZGsuRHVyYXRpb24uaG91cnMoMSksXG4gICAgICBwcmV2ZW50VXNlckV4aXN0ZW5jZUVycm9yczogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBVc2VyIFBvb2wgRG9tYWluXG4gICAgdGhpcy51c2VyUG9vbERvbWFpbiA9IHRoaXMudXNlclBvb2wuYWRkRG9tYWluKCdDb2duaXRvRG9tYWluJywge1xuICAgICAgY29nbml0b0RvbWFpbjoge1xuICAgICAgICBkb21haW5QcmVmaXg6IGBneW1jb2FjaC1haS0ke3RoaXMuYWNjb3VudH1gLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBVc2VyIEdyb3VwcyBmb3IgUm9sZS1CYXNlZCBBY2Nlc3MgQ29udHJvbFxuICAgIGNvbnN0IGFkbWluR3JvdXAgPSBuZXcgY29nbml0by5DZm5Vc2VyUG9vbEdyb3VwKHRoaXMsICdBZG1pbkdyb3VwJywge1xuICAgICAgdXNlclBvb2xJZDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgZ3JvdXBOYW1lOiAnYWRtaW4nLFxuICAgICAgZGVzY3JpcHRpb246ICdBZG1pbmlzdHJhdG9ycyB3aXRoIGZ1bGwgYWNjZXNzJyxcbiAgICAgIHByZWNlZGVuY2U6IDEsXG4gICAgfSk7XG5cbiAgICBjb25zdCBjb2FjaEdyb3VwID0gbmV3IGNvZ25pdG8uQ2ZuVXNlclBvb2xHcm91cCh0aGlzLCAnQ29hY2hHcm91cCcsIHtcbiAgICAgIHVzZXJQb29sSWQ6IHRoaXMudXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgIGdyb3VwTmFtZTogJ2NvYWNoJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ29hY2hlcyB3aXRoIGFjY2VzcyB0byB1c2VyIGRhdGEgZm9yIGNvYWNoaW5nJyxcbiAgICAgIHByZWNlZGVuY2U6IDIsXG4gICAgfSk7XG5cbiAgICBjb25zdCB1c2VyR3JvdXAgPSBuZXcgY29nbml0by5DZm5Vc2VyUG9vbEdyb3VwKHRoaXMsICdVc2VyR3JvdXAnLCB7XG4gICAgICB1c2VyUG9vbElkOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICBncm91cE5hbWU6ICd1c2VyJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUmVndWxhciB1c2VycyB3aXRoIGFjY2VzcyB0byB0aGVpciBvd24gZGF0YScsXG4gICAgICBwcmVjZWRlbmNlOiAzLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIFMzIEJ1Y2tldHMgKG5lZWRlZCBieSBMYW1iZGFzKVxuICAgIHRoaXMudXNlclVwbG9hZHNCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdVc2VyVXBsb2Fkc0J1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGBneW1jb2FjaC1haS11c2VyLXVwbG9hZHMtJHt0aGlzLmFjY291bnR9YCxcbiAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBuZXcgczMuQmxvY2tQdWJsaWNBY2Nlc3Moe1xuICAgICAgICBibG9ja1B1YmxpY0FjbHM6IGZhbHNlLFxuICAgICAgICBibG9ja1B1YmxpY1BvbGljeTogZmFsc2UsXG4gICAgICAgIGlnbm9yZVB1YmxpY0FjbHM6IGZhbHNlLFxuICAgICAgICByZXN0cmljdFB1YmxpY0J1Y2tldHM6IGZhbHNlLFxuICAgICAgfSksXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgY29yczogW1xuICAgICAgICB7XG4gICAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBbXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5HRVQsXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5QVVQsXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5QT1NULFxuICAgICAgICAgICAgczMuSHR0cE1ldGhvZHMuREVMRVRFLFxuICAgICAgICAgICAgczMuSHR0cE1ldGhvZHMuSEVBRCxcbiAgICAgICAgICBdLFxuICAgICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcbiAgICAgICAgICBleHBvc2VkSGVhZGVyczogWydFVGFnJ10sXG4gICAgICAgICAgbWF4QWdlOiAzMDAwLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ0RlbGV0ZUluY29tcGxldGVNdWx0aXBhcnRVcGxvYWRzJyxcbiAgICAgICAgICBhYm9ydEluY29tcGxldGVNdWx0aXBhcnRVcGxvYWRBZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoNyksXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ1RyYW5zaXRpb25Ub0lBJyxcbiAgICAgICAgICB0cmFuc2l0aW9uczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBzdG9yYWdlQ2xhc3M6IHMzLlN0b3JhZ2VDbGFzcy5JTkZSRVFVRU5UX0FDQ0VTUyxcbiAgICAgICAgICAgICAgdHJhbnNpdGlvbkFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cygzMCksXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ1RyYW5zaXRpb25Ub0dsYWNpZXInLFxuICAgICAgICAgIHRyYW5zaXRpb25zOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHN0b3JhZ2VDbGFzczogczMuU3RvcmFnZUNsYXNzLkdMQUNJRVIsXG4gICAgICAgICAgICAgIHRyYW5zaXRpb25BZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoOTApLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIEFkZCBidWNrZXQgcG9saWN5IHRvIGFsbG93IHB1YmxpYyByZWFkIGFjY2VzcyB0byB1cGxvYWRlZCBpbWFnZXNcbiAgICB0aGlzLnVzZXJVcGxvYWRzQnVja2V0LmFkZFRvUmVzb3VyY2VQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgcHJpbmNpcGFsczogW25ldyBpYW0uQW55UHJpbmNpcGFsKCldLFxuICAgICAgICBhY3Rpb25zOiBbJ3MzOkdldE9iamVjdCddLFxuICAgICAgICByZXNvdXJjZXM6IFtgJHt0aGlzLnVzZXJVcGxvYWRzQnVja2V0LmJ1Y2tldEFybn0vdXNlci1wcm9maWxlcy8qYF0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICB0aGlzLnN0YXRpY0Fzc2V0c0J1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ1N0YXRpY0Fzc2V0c0J1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGBneW1jb2FjaC1haS1zdGF0aWMtYXNzZXRzLSR7dGhpcy5hY2NvdW50fWAsXG4gICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIHB1YmxpY1JlYWRBY2Nlc3M6IGZhbHNlLFxuICAgIH0pO1xuXG4gICAgdGhpcy5wcm9jZXNzZWRJbWFnZXNCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdQcm9jZXNzZWRJbWFnZXNCdWNrZXQnLCB7XG4gICAgICBidWNrZXROYW1lOiBgZ3ltY29hY2gtYWktcHJvY2Vzc2VkLWltYWdlcy0ke3RoaXMuYWNjb3VudH1gLFxuICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgTGFtYmRhIEF1dGhvcml6ZXJcbiAgICBjb25zdCBhdXRob3JpemVyTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQXV0aG9yaXplckxhbWJkYScsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUlubGluZShgXG4gICAgICAgIGNvbnN0IGp3dCA9IHJlcXVpcmUoJ2pzb253ZWJ0b2tlbicpO1xuICAgICAgICBjb25zdCBqd2tzQ2xpZW50ID0gcmVxdWlyZSgnandrcy1yc2EnKTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGNsaWVudCA9IGp3a3NDbGllbnQoe1xuICAgICAgICAgIGp3a3NVcmk6ICdodHRwczovL2NvZ25pdG8taWRwLiR7dGhpcy5yZWdpb259LmFtYXpvbmF3cy5jb20vJHt0aGlzLnVzZXJQb29sLnVzZXJQb29sSWR9Ly53ZWxsLWtub3duL2p3a3MuanNvbidcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICBmdW5jdGlvbiBnZXRLZXkoaGVhZGVyLCBjYWxsYmFjaykge1xuICAgICAgICAgIGNsaWVudC5nZXRTaWduaW5nS2V5KGhlYWRlci5raWQsIChlcnIsIGtleSkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgc2lnbmluZ0tleSA9IGtleS5wdWJsaWNLZXkgfHwga2V5LnJzYVB1YmxpY0tleTtcbiAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHNpZ25pbmdLZXkpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBleHBvcnRzLmhhbmRsZXIgPSBhc3luYyAoZXZlbnQpID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnQXV0aG9yaXplciBldmVudDonLCBKU09OLnN0cmluZ2lmeShldmVudCwgbnVsbCwgMikpO1xuICAgICAgICAgIFxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB0b2tlbiA9IGV2ZW50LmhlYWRlcnMuYXV0aG9yaXphdGlvbj8ucmVwbGFjZSgnQmVhcmVyICcsICcnKTtcbiAgICAgICAgICAgIGlmICghdG9rZW4pIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGdlbmVyYXRlUG9saWN5KCd1c2VyJywgJ0RlbnknLCBldmVudC5tZXRob2RBcm4pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zdCBkZWNvZGVkID0gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgICBqd3QudmVyaWZ5KHRva2VuLCBnZXRLZXksIHsgYWxnb3JpdGhtczogWydSUzI1NiddIH0sIChlcnIsIGRlY29kZWQpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICBlbHNlIHJlc29sdmUoZGVjb2RlZCk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdEZWNvZGVkIHRva2VuOicsIGRlY29kZWQpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gZ2VuZXJhdGVQb2xpY3koZGVjb2RlZC5zdWIsICdBbGxvdycsIGV2ZW50Lm1ldGhvZEFybiwgZGVjb2RlZCk7XG4gICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0F1dGhvcml6YXRpb24gZXJyb3I6JywgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIGdlbmVyYXRlUG9saWN5KCd1c2VyJywgJ0RlbnknLCBldmVudC5tZXRob2RBcm4pO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgXG4gICAgICAgIGZ1bmN0aW9uIGdlbmVyYXRlUG9saWN5KHByaW5jaXBhbElkLCBlZmZlY3QsIHJlc291cmNlLCBjb250ZXh0ID0ge30pIHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgcHJpbmNpcGFsSWQsXG4gICAgICAgICAgICBwb2xpY3lEb2N1bWVudDoge1xuICAgICAgICAgICAgICBWZXJzaW9uOiAnMjAxMi0xMC0xNycsXG4gICAgICAgICAgICAgIFN0YXRlbWVudDogW3tcbiAgICAgICAgICAgICAgICBBY3Rpb246ICdleGVjdXRlLWFwaTpJbnZva2UnLFxuICAgICAgICAgICAgICAgIEVmZmVjdDogZWZmZWN0LFxuICAgICAgICAgICAgICAgIFJlc291cmNlOiByZXNvdXJjZVxuICAgICAgICAgICAgICB9XVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNvbnRleHRcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICBgKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFVTRVJfUE9PTF9JRDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgICBVU0VSX1BPT0xfQ0xJRU5UX0lEOiB0aGlzLnVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXG4gICAgICAgIFRBQkxFX05BTUU6IHRoaXMubWFpblRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBwZXJtaXNzaW9ucyB0byBhdXRob3JpemVyXG4gICAgdGhpcy5tYWluVGFibGUuZ3JhbnRSZWFkRGF0YShhdXRob3JpemVyTGFtYmRhKTtcblxuICAgIC8vIENyZWF0ZSBMYW1iZGEgZnVuY3Rpb25zIGZvciBlYWNoIHNlcnZpY2VcbiAgICAvLyBjb25zdCB1c2VyU2VydmljZUxhbWJkYSA9IHRoaXMuY3JlYXRlTGFtYmRhRnVuY3Rpb24oXG4gICAgLy8gICAnVXNlclNlcnZpY2UnLFxuICAgIC8vICAgJ3VzZXItc2VydmljZSdcbiAgICAvLyApO1xuICAgIGNvbnN0IHVzZXJQcm9maWxlU2VydmljZUxhbWJkYSA9IHRoaXMuY3JlYXRlTGFtYmRhRnVuY3Rpb24oXG4gICAgICAnVXNlclByb2ZpbGVTZXJ2aWNlJyxcbiAgICAgICd1c2VyLXByb2ZpbGUtc2VydmljZSdcbiAgICApO1xuICAgIGNvbnN0IHdvcmtvdXRTZXJ2aWNlTGFtYmRhID0gdGhpcy5jcmVhdGVMYW1iZGFGdW5jdGlvbihcbiAgICAgICdXb3Jrb3V0U2VydmljZScsXG4gICAgICAnd29ya291dC1zZXJ2aWNlJ1xuICAgICk7XG4gICAgY29uc3QgY29hY2hpbmdTZXJ2aWNlTGFtYmRhID0gdGhpcy5jcmVhdGVMYW1iZGFGdW5jdGlvbihcbiAgICAgICdDb2FjaGluZ1NlcnZpY2UnLFxuICAgICAgJ2NvYWNoaW5nLXNlcnZpY2UnXG4gICAgKTtcbiAgICBjb25zdCBhbmFseXRpY3NTZXJ2aWNlTGFtYmRhID0gdGhpcy5jcmVhdGVMYW1iZGFGdW5jdGlvbihcbiAgICAgICdBbmFseXRpY3NTZXJ2aWNlJyxcbiAgICAgICdhbmFseXRpY3Mtc2VydmljZSdcbiAgICApO1xuICAgIGNvbnN0IG51dHJpdGlvblNlcnZpY2VMYW1iZGEgPSB0aGlzLmNyZWF0ZUxhbWJkYUZ1bmN0aW9uKFxuICAgICAgJ051dHJpdGlvblNlcnZpY2UnLFxuICAgICAgJ251dHJpdGlvbi1zZXJ2aWNlJ1xuICAgICk7XG4gICAgLy8gY29uc3QgYWlTZXJ2aWNlTGFtYmRhID0gdGhpcy5jcmVhdGVQeXRob25MYW1iZGFGdW5jdGlvbihcbiAgICAvLyAgICdBSVNlcnZpY2UnLFxuICAgIC8vICAgJ2FpLXNlcnZpY2UtcHl0aG9uJ1xuICAgIC8vICk7XG5cbiAgICAvLyBFbmFibGUgTGFtYmRhIEZ1bmN0aW9uIFVSTHNcbiAgICAvLyBjb25zdCB1c2VyU2VydmljZVVybCA9IHVzZXJTZXJ2aWNlTGFtYmRhLmFkZEZ1bmN0aW9uVXJsKHtcbiAgICAvLyAgIGF1dGhUeXBlOiBsYW1iZGEuRnVuY3Rpb25VcmxBdXRoVHlwZS5OT05FLFxuICAgIC8vICAgY29yczoge1xuICAgIC8vICAgICBhbGxvd0NyZWRlbnRpYWxzOiBmYWxzZSxcbiAgICAvLyAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxuICAgIC8vICAgICBhbGxvd2VkTWV0aG9kczogW2xhbWJkYS5IdHRwTWV0aG9kLkFMTF0sXG4gICAgLy8gICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcbiAgICAvLyAgIH0sXG4gICAgLy8gfSk7XG5cbiAgICBjb25zdCB1c2VyUHJvZmlsZVNlcnZpY2VVcmwgPSB1c2VyUHJvZmlsZVNlcnZpY2VMYW1iZGEuYWRkRnVuY3Rpb25Vcmwoe1xuICAgICAgYXV0aFR5cGU6IGxhbWJkYS5GdW5jdGlvblVybEF1dGhUeXBlLk5PTkUsXG4gICAgICBjb3JzOiB7XG4gICAgICAgIGFsbG93Q3JlZGVudGlhbHM6IGZhbHNlLFxuICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXG4gICAgICAgIGFsbG93ZWRNZXRob2RzOiBbbGFtYmRhLkh0dHBNZXRob2QuQUxMXSxcbiAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHdvcmtvdXRTZXJ2aWNlVXJsID0gd29ya291dFNlcnZpY2VMYW1iZGEuYWRkRnVuY3Rpb25Vcmwoe1xuICAgICAgYXV0aFR5cGU6IGxhbWJkYS5GdW5jdGlvblVybEF1dGhUeXBlLk5PTkUsXG4gICAgICBjb3JzOiB7XG4gICAgICAgIGFsbG93Q3JlZGVudGlhbHM6IGZhbHNlLFxuICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXG4gICAgICAgIGFsbG93ZWRNZXRob2RzOiBbbGFtYmRhLkh0dHBNZXRob2QuQUxMXSxcbiAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGNvYWNoaW5nU2VydmljZVVybCA9IGNvYWNoaW5nU2VydmljZUxhbWJkYS5hZGRGdW5jdGlvblVybCh7XG4gICAgICBhdXRoVHlwZTogbGFtYmRhLkZ1bmN0aW9uVXJsQXV0aFR5cGUuTk9ORSxcbiAgICAgIGNvcnM6IHtcbiAgICAgICAgYWxsb3dDcmVkZW50aWFsczogZmFsc2UsXG4gICAgICAgIGFsbG93ZWRIZWFkZXJzOiBbJyonXSxcbiAgICAgICAgYWxsb3dlZE1ldGhvZHM6IFtsYW1iZGEuSHR0cE1ldGhvZC5BTExdLFxuICAgICAgICBhbGxvd2VkT3JpZ2luczogWycqJ10sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgY29uc3QgYW5hbHl0aWNzU2VydmljZVVybCA9IGFuYWx5dGljc1NlcnZpY2VMYW1iZGEuYWRkRnVuY3Rpb25Vcmwoe1xuICAgICAgYXV0aFR5cGU6IGxhbWJkYS5GdW5jdGlvblVybEF1dGhUeXBlLk5PTkUsXG4gICAgICBjb3JzOiB7XG4gICAgICAgIGFsbG93Q3JlZGVudGlhbHM6IGZhbHNlLFxuICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXG4gICAgICAgIGFsbG93ZWRNZXRob2RzOiBbbGFtYmRhLkh0dHBNZXRob2QuQUxMXSxcbiAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IG51dHJpdGlvblNlcnZpY2VVcmwgPSBudXRyaXRpb25TZXJ2aWNlTGFtYmRhLmFkZEZ1bmN0aW9uVXJsKHtcbiAgICAgIGF1dGhUeXBlOiBsYW1iZGEuRnVuY3Rpb25VcmxBdXRoVHlwZS5OT05FLFxuICAgICAgY29yczoge1xuICAgICAgICBhbGxvd0NyZWRlbnRpYWxzOiBmYWxzZSxcbiAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxuICAgICAgICBhbGxvd2VkTWV0aG9kczogW2xhbWJkYS5IdHRwTWV0aG9kLkFMTF0sXG4gICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBjb25zdCBhaVNlcnZpY2VVcmwgPSBhaVNlcnZpY2VMYW1iZGEuYWRkRnVuY3Rpb25Vcmwoe1xuICAgIC8vICAgYXV0aFR5cGU6IGxhbWJkYS5GdW5jdGlvblVybEF1dGhUeXBlLk5PTkUsXG4gICAgLy8gICBjb3JzOiB7XG4gICAgLy8gICAgIGFsbG93Q3JlZGVudGlhbHM6IGZhbHNlLFxuICAgIC8vICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXG4gICAgLy8gICAgIGFsbG93ZWRNZXRob2RzOiBbbGFtYmRhLkh0dHBNZXRob2QuQUxMXSxcbiAgICAvLyAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLFxuICAgIC8vICAgfSxcbiAgICAvLyB9KTtcblxuICAgIC8vIENyZWF0ZSBDbG91ZEZyb250IERpc3RyaWJ1dGlvbiB3aXRoIExhbWJkYSBGdW5jdGlvbiBVUkxzIGFzIG9yaWdpbnNcbiAgICBjb25zdCB1c2VyUHJvZmlsZURvbWFpbiA9IGNkay5Gbi5zZWxlY3QoXG4gICAgICAyLFxuICAgICAgY2RrLkZuLnNwbGl0KCcvJywgdXNlclByb2ZpbGVTZXJ2aWNlVXJsLnVybClcbiAgICApO1xuICAgIGNvbnN0IHdvcmtvdXREb21haW4gPSBjZGsuRm4uc2VsZWN0KFxuICAgICAgMixcbiAgICAgIGNkay5Gbi5zcGxpdCgnLycsIHdvcmtvdXRTZXJ2aWNlVXJsLnVybClcbiAgICApO1xuICAgIGNvbnN0IGNvYWNoaW5nRG9tYWluID0gY2RrLkZuLnNlbGVjdChcbiAgICAgIDIsXG4gICAgICBjZGsuRm4uc3BsaXQoJy8nLCBjb2FjaGluZ1NlcnZpY2VVcmwudXJsKVxuICAgICk7XG4gICAgY29uc3QgYW5hbHl0aWNzRG9tYWluID0gY2RrLkZuLnNlbGVjdChcbiAgICAgIDIsXG4gICAgICBjZGsuRm4uc3BsaXQoJy8nLCBhbmFseXRpY3NTZXJ2aWNlVXJsLnVybClcbiAgICApO1xuICAgIGNvbnN0IG51dHJpdGlvbkRvbWFpbiA9IGNkay5Gbi5zZWxlY3QoXG4gICAgICAyLFxuICAgICAgY2RrLkZuLnNwbGl0KCcvJywgbnV0cml0aW9uU2VydmljZVVybC51cmwpXG4gICAgKTtcblxuICAgIHRoaXMuZGlzdHJpYnV0aW9uID0gbmV3IGNsb3VkZnJvbnQuRGlzdHJpYnV0aW9uKFxuICAgICAgdGhpcyxcbiAgICAgICdHeW1Db2FjaEFJRGlzdHJpYnV0aW9uJyxcbiAgICAgIHtcbiAgICAgICAgZGVmYXVsdEJlaGF2aW9yOiB7XG4gICAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5IdHRwT3JpZ2luKHVzZXJQcm9maWxlRG9tYWluKSxcbiAgICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTpcbiAgICAgICAgICAgIGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfQUxMLFxuICAgICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfRElTQUJMRUQsXG4gICAgICAgICAgb3JpZ2luUmVxdWVzdFBvbGljeTpcbiAgICAgICAgICAgIGNsb3VkZnJvbnQuT3JpZ2luUmVxdWVzdFBvbGljeS5BTExfVklFV0VSX0VYQ0VQVF9IT1NUX0hFQURFUixcbiAgICAgICAgfSxcbiAgICAgICAgYWRkaXRpb25hbEJlaGF2aW9yczoge1xuICAgICAgICAgIC8vICcvYXBpL3VzZXJzLyonOiB7XG4gICAgICAgICAgLy8gICBvcmlnaW46IG5ldyBvcmlnaW5zLkh0dHBPcmlnaW4odXNlclNlcnZpY2VVcmwudXJsKSxcbiAgICAgICAgICAvLyAgIHZpZXdlclByb3RvY29sUG9saWN5OlxuICAgICAgICAgIC8vICAgICBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgIC8vICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfQUxMLFxuICAgICAgICAgIC8vICAgY2FjaGVQb2xpY3k6IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3kuQ0FDSElOR19ESVNBQkxFRCxcbiAgICAgICAgICAvLyAgIG9yaWdpblJlcXVlc3RQb2xpY3k6XG4gICAgICAgICAgLy8gICAgIGNsb3VkZnJvbnQuT3JpZ2luUmVxdWVzdFBvbGljeS5BTExfVklFV0VSX0VYQ0VQVF9IT1NUX0hFQURFUixcbiAgICAgICAgICAvLyB9LFxuICAgICAgICAgICcvYXBpL3VzZXItcHJvZmlsZXMvKic6IHtcbiAgICAgICAgICAgIG9yaWdpbjogbmV3IG9yaWdpbnMuSHR0cE9yaWdpbih1c2VyUHJvZmlsZURvbWFpbiksXG4gICAgICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTpcbiAgICAgICAgICAgICAgY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0FMTCxcbiAgICAgICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfRElTQUJMRUQsXG4gICAgICAgICAgICBvcmlnaW5SZXF1ZXN0UG9saWN5OlxuICAgICAgICAgICAgICBjbG91ZGZyb250Lk9yaWdpblJlcXVlc3RQb2xpY3kuQUxMX1ZJRVdFUl9FWENFUFRfSE9TVF9IRUFERVIsXG4gICAgICAgICAgfSxcbiAgICAgICAgICAnL2FwaS93b3Jrb3V0cy8qJzoge1xuICAgICAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5IdHRwT3JpZ2luKHdvcmtvdXREb21haW4pLFxuICAgICAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6XG4gICAgICAgICAgICAgIGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgICAgICBhbGxvd2VkTWV0aG9kczogY2xvdWRmcm9udC5BbGxvd2VkTWV0aG9kcy5BTExPV19BTEwsXG4gICAgICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX0RJU0FCTEVELFxuICAgICAgICAgICAgb3JpZ2luUmVxdWVzdFBvbGljeTpcbiAgICAgICAgICAgICAgY2xvdWRmcm9udC5PcmlnaW5SZXF1ZXN0UG9saWN5LkFMTF9WSUVXRVJfRVhDRVBUX0hPU1RfSEVBREVSLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgJy9hcGkvY29hY2hpbmcvKic6IHtcbiAgICAgICAgICAgIG9yaWdpbjogbmV3IG9yaWdpbnMuSHR0cE9yaWdpbihjb2FjaGluZ0RvbWFpbiksXG4gICAgICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTpcbiAgICAgICAgICAgICAgY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0FMTCxcbiAgICAgICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfRElTQUJMRUQsXG4gICAgICAgICAgICBvcmlnaW5SZXF1ZXN0UG9saWN5OlxuICAgICAgICAgICAgICBjbG91ZGZyb250Lk9yaWdpblJlcXVlc3RQb2xpY3kuQUxMX1ZJRVdFUl9FWENFUFRfSE9TVF9IRUFERVIsXG4gICAgICAgICAgfSxcbiAgICAgICAgICAnL2FwaS9hbmFseXRpY3MvKic6IHtcbiAgICAgICAgICAgIG9yaWdpbjogbmV3IG9yaWdpbnMuSHR0cE9yaWdpbihhbmFseXRpY3NEb21haW4pLFxuICAgICAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6XG4gICAgICAgICAgICAgIGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgICAgICBhbGxvd2VkTWV0aG9kczogY2xvdWRmcm9udC5BbGxvd2VkTWV0aG9kcy5BTExPV19BTEwsXG4gICAgICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX0RJU0FCTEVELFxuICAgICAgICAgICAgb3JpZ2luUmVxdWVzdFBvbGljeTpcbiAgICAgICAgICAgICAgY2xvdWRmcm9udC5PcmlnaW5SZXF1ZXN0UG9saWN5LkFMTF9WSUVXRVJfRVhDRVBUX0hPU1RfSEVBREVSLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgJy9hcGkvbnV0cml0aW9uLyonOiB7XG4gICAgICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLkh0dHBPcmlnaW4obnV0cml0aW9uRG9tYWluKSxcbiAgICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OlxuICAgICAgICAgICAgICBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfQUxMLFxuICAgICAgICAgICAgY2FjaGVQb2xpY3k6IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3kuQ0FDSElOR19ESVNBQkxFRCxcbiAgICAgICAgICAgIG9yaWdpblJlcXVlc3RQb2xpY3k6XG4gICAgICAgICAgICAgIGNsb3VkZnJvbnQuT3JpZ2luUmVxdWVzdFBvbGljeS5BTExfVklFV0VSX0VYQ0VQVF9IT1NUX0hFQURFUixcbiAgICAgICAgICB9LFxuICAgICAgICAgIC8vICcvYXBpL2FpLyonOiB7XG4gICAgICAgICAgLy8gICBvcmlnaW46IG5ldyBvcmlnaW5zLkh0dHBPcmlnaW4oYWlTZXJ2aWNlVXJsLnVybCksXG4gICAgICAgICAgLy8gICB2aWV3ZXJQcm90b2NvbFBvbGljeTpcbiAgICAgICAgICAvLyAgICAgY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgICAvLyAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0FMTCxcbiAgICAgICAgICAvLyAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfRElTQUJMRUQsXG4gICAgICAgICAgLy8gICBvcmlnaW5SZXF1ZXN0UG9saWN5OlxuICAgICAgICAgIC8vICAgICBjbG91ZGZyb250Lk9yaWdpblJlcXVlc3RQb2xpY3kuQUxMX1ZJRVdFUl9FWENFUFRfSE9TVF9IRUFERVIsXG4gICAgICAgICAgLy8gfSxcbiAgICAgICAgfSxcbiAgICAgICAgY29tbWVudDogJ0d5bUNvYWNoIEFJIENsb3VkRnJvbnQgRGlzdHJpYnV0aW9uJyxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gR3JhbnQgcGVybWlzc2lvbnMgdG8gTGFtYmRhIGZ1bmN0aW9ucyBmb3IgUzMgYWNjZXNzXG4gICAgdGhpcy51c2VyVXBsb2Fkc0J1Y2tldC5ncmFudFJlYWRXcml0ZSh1c2VyUHJvZmlsZVNlcnZpY2VMYW1iZGEpO1xuICAgIHRoaXMudXNlclVwbG9hZHNCdWNrZXQuZ3JhbnRSZWFkV3JpdGUod29ya291dFNlcnZpY2VMYW1iZGEpO1xuICAgIHRoaXMudXNlclVwbG9hZHNCdWNrZXQuZ3JhbnRSZWFkV3JpdGUoYW5hbHl0aWNzU2VydmljZUxhbWJkYSk7XG5cbiAgICB0aGlzLnByb2Nlc3NlZEltYWdlc0J1Y2tldC5ncmFudFJlYWRXcml0ZSh1c2VyUHJvZmlsZVNlcnZpY2VMYW1iZGEpO1xuICAgIHRoaXMucHJvY2Vzc2VkSW1hZ2VzQnVja2V0LmdyYW50UmVhZFdyaXRlKHdvcmtvdXRTZXJ2aWNlTGFtYmRhKTtcbiAgICB0aGlzLnByb2Nlc3NlZEltYWdlc0J1Y2tldC5ncmFudFJlYWRXcml0ZShhbmFseXRpY3NTZXJ2aWNlTGFtYmRhKTtcbiAgICAvLyBBbGxvdyBzZXJ2aWNlIHRvIHJlYWQgZnJvbSB0aGUgbWFpbiBEeW5hbW9EQiB0YWJsZVxuICAgIHRoaXMubWFpblRhYmxlLmdyYW50UmVhZERhdGEoYW5hbHl0aWNzU2VydmljZUxhbWJkYSk7XG4gICAgdGhpcy5tYWluVGFibGUuZ3JhbnRSZWFkRGF0YShudXRyaXRpb25TZXJ2aWNlTGFtYmRhKTtcbiAgICB0aGlzLm1haW5UYWJsZS5ncmFudFJlYWREYXRhKHVzZXJQcm9maWxlU2VydmljZUxhbWJkYSk7XG4gICAgdGhpcy5tYWluVGFibGUuZ3JhbnRSZWFkRGF0YSh3b3Jrb3V0U2VydmljZUxhbWJkYSk7XG4gICAgdGhpcy5tYWluVGFibGUuZ3JhbnRSZWFkRGF0YShjb2FjaGluZ1NlcnZpY2VMYW1iZGEpO1xuICAgIHRoaXMubWFpblRhYmxlLmdyYW50V3JpdGVEYXRhKGFuYWx5dGljc1NlcnZpY2VMYW1iZGEpO1xuICAgIHRoaXMubWFpblRhYmxlLmdyYW50V3JpdGVEYXRhKG51dHJpdGlvblNlcnZpY2VMYW1iZGEpO1xuICAgIHRoaXMubWFpblRhYmxlLmdyYW50V3JpdGVEYXRhKHVzZXJQcm9maWxlU2VydmljZUxhbWJkYSk7XG4gICAgdGhpcy5tYWluVGFibGUuZ3JhbnRXcml0ZURhdGEod29ya291dFNlcnZpY2VMYW1iZGEpO1xuICAgIHRoaXMubWFpblRhYmxlLmdyYW50V3JpdGVEYXRhKGNvYWNoaW5nU2VydmljZUxhbWJkYSk7XG5cbiAgICAvLyBFbnN1cmUgbnV0cml0aW9uIHNlcnZpY2UgY2FuIFF1ZXJ5IEdTSXMgZXhwbGljaXRseVxuICAgIG51dHJpdGlvblNlcnZpY2VMYW1iZGEuYWRkVG9Sb2xlUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFsnZHluYW1vZGI6UXVlcnknLCAnZHluYW1vZGI6R2V0SXRlbSddLFxuICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICB0aGlzLm1haW5UYWJsZS50YWJsZUFybixcbiAgICAgICAgICBgJHt0aGlzLm1haW5UYWJsZS50YWJsZUFybn0vaW5kZXgvKmAsXG4gICAgICAgIF0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBSZW1vdmVkIENsb3VkV2F0Y2ggTG9nIEdyb3VwcyB0byBhdm9pZCBjb3N0c1xuICAgIC8vIExhbWJkYSBmdW5jdGlvbnMgd2lsbCB1c2UgZGVmYXVsdCBsb2cgZ3JvdXBzIChmcmVlIHRpZXI6IDVHQi9tb250aClcblxuICAgIC8vIE91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclBvb2xJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvZ25pdG8gVXNlciBQb29sIElEJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVc2VyUG9vbENsaWVudElkJywge1xuICAgICAgdmFsdWU6IHRoaXMudXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ29nbml0byBVc2VyIFBvb2wgQ2xpZW50IElEJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVc2VyUG9vbERvbWFpbicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnVzZXJQb29sRG9tYWluLmRvbWFpbk5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvZ25pdG8gVXNlciBQb29sIERvbWFpbicsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ2xvdWRGcm9udFVybCcsIHtcbiAgICAgIHZhbHVlOiBgaHR0cHM6Ly8ke3RoaXMuZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWV9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ2xvdWRGcm9udCBEaXN0cmlidXRpb24gVVJMJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdUYWJsZU5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5tYWluVGFibGUudGFibGVOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdEeW5hbW9EQiBUYWJsZSBOYW1lJyxcbiAgICB9KTtcblxuICAgIC8vIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVc2VyU2VydmljZVVybCcsIHtcbiAgICAvLyAgIHZhbHVlOiB1c2VyU2VydmljZVVybC51cmwsXG4gICAgLy8gICBkZXNjcmlwdGlvbjogJ1VzZXIgU2VydmljZSBMYW1iZGEgRnVuY3Rpb24gVVJMJyxcbiAgICAvLyB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVc2VyUHJvZmlsZVNlcnZpY2VVcmwnLCB7XG4gICAgICB2YWx1ZTogdXNlclByb2ZpbGVTZXJ2aWNlVXJsLnVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVXNlciBQcm9maWxlIFNlcnZpY2UgTGFtYmRhIEZ1bmN0aW9uIFVSTCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnV29ya291dFNlcnZpY2VVcmwnLCB7XG4gICAgICB2YWx1ZTogd29ya291dFNlcnZpY2VVcmwudXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdXb3Jrb3V0IFNlcnZpY2UgTGFtYmRhIEZ1bmN0aW9uIFVSTCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ29hY2hpbmdTZXJ2aWNlVXJsJywge1xuICAgICAgdmFsdWU6IGNvYWNoaW5nU2VydmljZVVybC51cmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvYWNoaW5nIFNlcnZpY2UgTGFtYmRhIEZ1bmN0aW9uIFVSTCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQW5hbHl0aWNzU2VydmljZVVybCcsIHtcbiAgICAgIHZhbHVlOiBhbmFseXRpY3NTZXJ2aWNlVXJsLnVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQW5hbHl0aWNzIFNlcnZpY2UgTGFtYmRhIEZ1bmN0aW9uIFVSTCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnTnV0cml0aW9uU2VydmljZVVybCcsIHtcbiAgICAgIHZhbHVlOiBudXRyaXRpb25TZXJ2aWNlVXJsLnVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnTnV0cml0aW9uIFNlcnZpY2UgTGFtYmRhIEZ1bmN0aW9uIFVSTCcsXG4gICAgfSk7XG5cbiAgICAvLyBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQUlTZXJ2aWNlVXJsJywge1xuICAgIC8vICAgdmFsdWU6IGFpU2VydmljZVVybC51cmwsXG4gICAgLy8gICBkZXNjcmlwdGlvbjogJ0FJIFNlcnZpY2UgTGFtYmRhIEZ1bmN0aW9uIFVSTCcsXG4gICAgLy8gfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclVwbG9hZHNCdWNrZXROYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMudXNlclVwbG9hZHNCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVXNlciBVcGxvYWRzIFMzIEJ1Y2tldCBOYW1lJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTdGF0aWNBc3NldHNCdWNrZXROYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMuc3RhdGljQXNzZXRzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1N0YXRpYyBBc3NldHMgUzMgQnVja2V0IE5hbWUnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1Byb2Nlc3NlZEltYWdlc0J1Y2tldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5wcm9jZXNzZWRJbWFnZXNCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUHJvY2Vzc2VkIEltYWdlcyBTMyBCdWNrZXQgTmFtZScsXG4gICAgfSk7XG5cbiAgICAvLyBSZW1vdmVkIG1vbml0b3Jpbmcgc3RhY2sgdG8gYXZvaWQgQ2xvdWRXYXRjaCBjb3N0c1xuICAgIC8vIHRoaXMuY3JlYXRlTW9uaXRvcmluZ1N0YWNrKCk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUxhbWJkYUZ1bmN0aW9uKFxuICAgIG5hbWU6IHN0cmluZyxcbiAgICBzZXJ2aWNlTmFtZTogc3RyaW5nXG4gICk6IGxhbWJkYS5GdW5jdGlvbiB7XG4gICAgcmV0dXJuIG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgYCR7bmFtZX1MYW1iZGFgLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QUk9WSURFRF9BTDIsXG4gICAgICBoYW5kbGVyOiAnYm9vdHN0cmFwJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChcbiAgICAgICAgYC4uL3NlcnZpY2VzLyR7c2VydmljZU5hbWV9L3RhcmdldC9sYW1iZGEvJHtzZXJ2aWNlTmFtZX1gXG4gICAgICApLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgVEFCTEVfTkFNRTogdGhpcy5tYWluVGFibGUudGFibGVOYW1lLFxuICAgICAgICBEWU5BTU9EQl9UQUJMRTogdGhpcy5tYWluVGFibGUudGFibGVOYW1lLFxuICAgICAgICBVU0VSX1BPT0xfSUQ6IHRoaXMudXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgICAgVVNFUl9QT09MX0NMSUVOVF9JRDogdGhpcy51c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkLFxuICAgICAgICBVU0VSX1VQTE9BRFNfQlVDS0VUOiB0aGlzLnVzZXJVcGxvYWRzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgIFNUQVRJQ19BU1NFVFNfQlVDS0VUOiB0aGlzLnN0YXRpY0Fzc2V0c0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBQUk9DRVNTRURfSU1BR0VTX0JVQ0tFVDogdGhpcy5wcm9jZXNzZWRJbWFnZXNCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgSldUX1NFQ1JFVDogJ3lvdXItand0LXNlY3JldC1oZXJlJywgLy8gSW4gcHJvZHVjdGlvbiwgdXNlIEFXUyBTZWNyZXRzIE1hbmFnZXJcbiAgICAgICAgQ09HTklUT19SRUdJT046IHRoaXMucmVnaW9uLFxuICAgICAgICBDT0dOSVRPX1VTRVJfUE9PTF9JRDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgICBSVVNUX0xPRzogJ2luZm8nLFxuICAgICAgICBSVVNUX0JBQ0tUUkFDRTogJzEnLFxuICAgICAgfSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NiwgLy8gT3B0aW1pemVkIGZvciBjb2xkIHN0YXJ0c1xuICAgICAgcmVzZXJ2ZWRDb25jdXJyZW50RXhlY3V0aW9uczogMTAsIC8vIFByZXZlbnQgY29sZCBzdGFydHMgZHVyaW5nIGhpZ2ggbG9hZFxuICAgICAgLy8gUmVtb3ZlZCBsb2cgcmV0ZW50aW9uIHRvIHVzZSBmcmVlIHRpZXIgZGVmYXVsdHMgKDVHQi9tb250aCBmcmVlKVxuICAgICAgLy8gUmVtb3ZlZCBYLVJheSB0cmFjaW5nIHRvIGF2b2lkIGNvc3RzICgkNSBwZXIgMU0gdHJhY2VzKVxuICAgICAgbGF5ZXJzOiBbdGhpcy5jcmVhdGVBdXRoTGF5ZXIoKV0sXG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZVB5dGhvbkxhbWJkYUZ1bmN0aW9uKFxuICAgIG5hbWU6IHN0cmluZyxcbiAgICBzZXJ2aWNlTmFtZTogc3RyaW5nXG4gICk6IGxhbWJkYS5GdW5jdGlvbiB7XG4gICAgcmV0dXJuIG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgYCR7bmFtZX1MYW1iZGFgLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMSxcbiAgICAgIGhhbmRsZXI6ICdsYW1iZGFfZnVuY3Rpb24ubGFtYmRhX2hhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KGAuLi9zZXJ2aWNlcy8ke3NlcnZpY2VOYW1lfWApLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgRFlOQU1PREJfVEFCTEU6IHRoaXMubWFpblRhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgVVNFUl9QT09MX0lEOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICAgIFVTRVJfUE9PTF9DTElFTlRfSUQ6IHRoaXMudXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcbiAgICAgICAgVVNFUl9VUExPQURTX0JVQ0tFVDogdGhpcy51c2VyVXBsb2Fkc0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBTVEFUSUNfQVNTRVRTX0JVQ0tFVDogdGhpcy5zdGF0aWNBc3NldHNCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgUFJPQ0VTU0VEX0lNQUdFU19CVUNLRVQ6IHRoaXMucHJvY2Vzc2VkSW1hZ2VzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgIEpXVF9TRUNSRVQ6ICd5b3VyLWp3dC1zZWNyZXQtaGVyZScsIC8vIEluIHByb2R1Y3Rpb24sIHVzZSBBV1MgU2VjcmV0cyBNYW5hZ2VyXG4gICAgICAgIENPR05JVE9fUkVHSU9OOiB0aGlzLnJlZ2lvbixcbiAgICAgICAgQ09HTklUT19VU0VSX1BPT0xfSUQ6IHRoaXMudXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgICAgQVdTX1JFR0lPTjogdGhpcy5yZWdpb24sXG4gICAgICAgIFBZVEhPTlBBVEg6ICcvdmFyL3J1bnRpbWU6L3Zhci90YXNrJyxcbiAgICAgIH0sXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSwgLy8gQUkgZnVuY3Rpb25zIG1heSBuZWVkIG1vcmUgdGltZVxuICAgICAgbWVtb3J5U2l6ZTogMTAyNCwgLy8gQUkgZnVuY3Rpb25zIG5lZWQgbW9yZSBtZW1vcnlcbiAgICAgIHJlc2VydmVkQ29uY3VycmVudEV4ZWN1dGlvbnM6IDUsIC8vIExpbWl0IGNvbmN1cnJlbnQgZXhlY3V0aW9ucyBmb3IgQUkgZnVuY3Rpb25zXG4gICAgICAvLyBSZW1vdmVkIGxvZyByZXRlbnRpb24gdG8gdXNlIGZyZWUgdGllciBkZWZhdWx0cyAoNUdCL21vbnRoIGZyZWUpXG4gICAgICAvLyBSZW1vdmVkIFgtUmF5IHRyYWNpbmcgdG8gYXZvaWQgY29zdHMgKCQ1IHBlciAxTSB0cmFjZXMpXG4gICAgICBsYXllcnM6IFt0aGlzLmNyZWF0ZVB5dGhvbkF1dGhMYXllcigpXSxcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlQXV0aExheWVyKCk6IGxhbWJkYS5MYXllclZlcnNpb24ge1xuICAgIGlmICh0aGlzLmF1dGhMYXllcikge1xuICAgICAgcmV0dXJuIHRoaXMuYXV0aExheWVyO1xuICAgIH1cbiAgICB0aGlzLmF1dGhMYXllciA9IG5ldyBsYW1iZGEuTGF5ZXJWZXJzaW9uKHRoaXMsICdBdXRoTGF5ZXInLCB7XG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uL3NlcnZpY2VzL2F1dGgtbGF5ZXIvbGF5ZXInKSxcbiAgICAgIGNvbXBhdGlibGVSdW50aW1lczogW2xhbWJkYS5SdW50aW1lLlBST1ZJREVEX0FMMl0sXG4gICAgICBkZXNjcmlwdGlvbjpcbiAgICAgICAgJ0F1dGhlbnRpY2F0aW9uIGFuZCBhdXRob3JpemF0aW9uIGxheWVyIGZvciBHeW1Db2FjaCBBSSBzZXJ2aWNlcycsXG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMuYXV0aExheWVyO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVQeXRob25BdXRoTGF5ZXIoKTogbGFtYmRhLkxheWVyVmVyc2lvbiB7XG4gICAgaWYgKHRoaXMucHl0aG9uQXV0aExheWVyKSB7XG4gICAgICByZXR1cm4gdGhpcy5weXRob25BdXRoTGF5ZXI7XG4gICAgfVxuICAgIHRoaXMucHl0aG9uQXV0aExheWVyID0gbmV3IGxhbWJkYS5MYXllclZlcnNpb24odGhpcywgJ1B5dGhvbkF1dGhMYXllcicsIHtcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4vc2VydmljZXMvYWktc2VydmljZS1weXRob24nKSxcbiAgICAgIGNvbXBhdGlibGVSdW50aW1lczogW2xhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzExXSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUHl0aG9uIGF1dGhlbnRpY2F0aW9uIGxheWVyIGZvciBBSSBzZXJ2aWNlcycsXG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMucHl0aG9uQXV0aExheWVyO1xuICB9XG5cbiAgLy8gUmVtb3ZlZCBjcmVhdGVNb25pdG9yaW5nU3RhY2sgbWV0aG9kIHRvIGF2b2lkIENsb3VkV2F0Y2ggY29zdHNcbiAgLy8gcHJpdmF0ZSBjcmVhdGVNb25pdG9yaW5nU3RhY2soKSB7XG4gIC8vICAgLy8gQ3JlYXRlIG1vbml0b3Jpbmcgc3RhY2tcbiAgLy8gICBuZXcgTW9uaXRvcmluZ1N0YWNrKHRoaXMsICdNb25pdG9yaW5nU3RhY2snLCB7XG4gIC8vICAgICBsYW1iZGFGdW5jdGlvbnM6IFtcbiAgLy8gICAgICAgdGhpcy51c2VyU2VydmljZUxhbWJkYSxcbiAgLy8gICAgICAgdGhpcy51c2VyUHJvZmlsZVNlcnZpY2VMYW1iZGEsXG4gIC8vICAgICAgIHRoaXMud29ya291dFNlcnZpY2VMYW1iZGEsXG4gIC8vICAgICAgIHRoaXMuY29hY2hpbmdTZXJ2aWNlTGFtYmRhLFxuICAvLyAgICAgICB0aGlzLmFuYWx5dGljc1NlcnZpY2VMYW1iZGEsXG4gIC8vICAgICAgIHRoaXMubnV0cml0aW9uU2VydmljZUxhbWJkYSxcbiAgLy8gICAgICAgdGhpcy5haVNlcnZpY2VMYW1iZGEsXG4gIC8vICAgICBdLFxuICAvLyAgICAgZHluYW1vRGJUYWJsZTogdGhpcy5tYWluVGFibGUsXG4gIC8vICAgICBzM0J1Y2tldHM6IFtcbiAgLy8gICAgICAgdGhpcy51c2VyVXBsb2Fkc0J1Y2tldCxcbiAgLy8gICAgICAgdGhpcy5zdGF0aWNBc3NldHNCdWNrZXQsXG4gIC8vICAgICAgIHRoaXMucHJvY2Vzc2VkSW1hZ2VzQnVja2V0LFxuICAvLyAgICAgXSxcbiAgLy8gICB9KTtcbiAgLy8gfVxufVxuIl19