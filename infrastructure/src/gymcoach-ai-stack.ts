import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';
// Removed MonitoringStack import to avoid CloudWatch costs

export class GymCoachAIStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly userPoolDomain: cognito.UserPoolDomain;
  public readonly mainTable: dynamodb.Table;
  public readonly distribution: cloudfront.Distribution;
  public readonly userUploadsBucket: s3.Bucket;
  public readonly staticAssetsBucket: s3.Bucket;
  public readonly processedImagesBucket: s3.Bucket;
  public readonly progressPhotosBucket: s3.Bucket;
  public readonly frontendBucket: s3.Bucket;
  private authLayer?: lambda.LayerVersion;
  private pythonAuthLayer?: lambda.LayerVersion;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
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

    const nutritionRemindersTopic = new sns.Topic(
      this,
      'NutritionRemindersTopic',
      {
        topicName: 'gymcoach-ai-nutrition-reminders',
        displayName: 'Nutrition Reminders',
      }
    );

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

    const nutritionReminderRule = new events.Rule(
      this,
      'NutritionReminderRule',
      {
        ruleName: 'gymcoach-ai-nutrition-reminders',
        description: 'Triggers nutrition reminder notifications',
        schedule: events.Schedule.cron({
          minute: '0',
          hour: '12', // 12 PM UTC - will be adjusted per user timezone
        }),
      }
    );

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
    this.userUploadsBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.AnyPrincipal()],
        actions: ['s3:GetObject'],
        resources: [`${this.userUploadsBucket.bucketArn}/user-profiles/*`],
      })
    );

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
    const progressPhotosOAI = new cloudfront.OriginAccessIdentity(
      this,
      'ProgressPhotosOAI',
      {
        comment: 'Origin Access Identity for Progress Photos bucket v2',
      }
    );

    // Grant CloudFront OAI access to progress photos bucket
    this.progressPhotosBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [progressPhotosOAI.grantPrincipal],
        actions: ['s3:GetObject'],
        resources: [`${this.progressPhotosBucket.bucketArn}/*`],
      })
    );

    // Create CloudFront Origin Access Identity for frontend bucket
    const frontendOAI = new cloudfront.OriginAccessIdentity(
      this,
      'FrontendOAI',
      {
        comment: 'Origin Access Identity for Frontend bucket',
      }
    );

    // Create Frontend S3 Bucket for static assets
    this.frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `gymcoach-ai-frontend-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      publicReadAccess: false, // Only CloudFront OAI should access
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, // Block all public access
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Grant CloudFront OAI access to frontend bucket
    this.frontendBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [frontendOAI.grantPrincipal],
        actions: ['s3:GetObject'],
        resources: [`${this.frontendBucket.bucketArn}/*`],
      })
    );

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
    const userProfileServiceLambda = this.createLambdaFunction(
      'UserProfileService',
      'user-profile-service'
    );
    const workoutServiceLambda = this.createLambdaFunction(
      'WorkoutService',
      'workout-service'
    );
    const coachingServiceLambda = this.createLambdaFunction(
      'CoachingService',
      'coaching-service'
    );
    const analyticsServiceLambda = this.createLambdaFunction(
      'AnalyticsService',
      'analytics-service'
    );
    const nutritionServiceLambda = this.createLambdaFunction(
      'NutritionService',
      'nutrition-service'
    );
    const aiServiceLambda = this.createPythonLambdaFunction(
      'AIService',
      'ai-service-python'
    );

    // Create Notification Service Lambda
    const notificationServiceLambda = this.createLambdaFunction(
      'NotificationService',
      'notification-service',
      {
        WORKOUT_REMINDERS_TOPIC_ARN: workoutRemindersTopic.topicArn,
        NUTRITION_REMINDERS_TOPIC_ARN: nutritionRemindersTopic.topicArn,
        ACHIEVEMENT_TOPIC_ARN: achievementTopic.topicArn,
        AI_SUGGESTIONS_TOPIC_ARN: aiSuggestionsTopic.topicArn,
        FIREBASE_SERVER_KEY: 'YOUR_FIREBASE_SERVER_KEY',
        FIREBASE_PROJECT_ID: 'YOUR_FIREBASE_PROJECT_ID',
      }
    );

    // Create Notification Scheduler Lambda
    const notificationSchedulerLambda = this.createLambdaFunction(
      'NotificationScheduler',
      'notification-scheduler',
      {
        NOTIFICATION_SERVICE_FUNCTION_ARN: '', // Will be set after creation
      }
    );

    // Update notification scheduler with the correct function ARN
    notificationSchedulerLambda.addEnvironment(
      'NOTIFICATION_SERVICE_FUNCTION_ARN',
      notificationServiceLambda.functionArn
    );

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
    const userProfileDomain = cdk.Fn.select(
      2,
      cdk.Fn.split('/', userProfileServiceUrl.url)
    );
    const workoutDomain = cdk.Fn.select(
      2,
      cdk.Fn.split('/', workoutServiceUrl.url)
    );
    const coachingDomain = cdk.Fn.select(
      2,
      cdk.Fn.split('/', coachingServiceUrl.url)
    );
    const analyticsDomain = cdk.Fn.select(
      2,
      cdk.Fn.split('/', analyticsServiceUrl.url)
    );
    const nutritionDomain = cdk.Fn.select(
      2,
      cdk.Fn.split('/', nutritionServiceUrl.url)
    );
    const aiDomain = cdk.Fn.select(2, cdk.Fn.split('/', aiServiceUrl.url));
    const notificationDomain = cdk.Fn.select(
      2,
      cdk.Fn.split('/', notificationServiceUrl.url)
    );

    // Create CloudFront Function for URL rewriting (handles SPA routing)
    const urlRewriteFunction = new cloudfront.Function(
      this,
      'UrlRewriteFunction',
      {
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
        comment:
          'URL rewrite function for SPA routing with trailing slash support',
      }
    );

    this.distribution = new cloudfront.Distribution(
      this,
      'GymCoachAIDistribution',
      {
        defaultRootObject: 'index.html',
        defaultBehavior: {
          origin: origins.S3BucketOrigin.withOriginAccessIdentity(
            this.frontendBucket,
            {
              originAccessIdentity: frontendOAI,
            }
          ),
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachePolicy: new cloudfront.CachePolicy(this, 'FrontendCachePolicy', {
            cachePolicyName: 'frontend-cache-policy',
            defaultTtl: cdk.Duration.hours(24),
            maxTtl: cdk.Duration.days(365),
            minTtl: cdk.Duration.seconds(0),
            headerBehavior: cloudfront.CacheHeaderBehavior.allowList(
              'CloudFront-Viewer-Country'
            ),
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
            viewerProtocolPolicy:
              cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
            cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
            originRequestPolicy:
              cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          },
          '/api/workouts/*': {
            origin: new origins.HttpOrigin(workoutDomain),
            viewerProtocolPolicy:
              cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
            cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
            originRequestPolicy:
              cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          },
          '/api/coaching/*': {
            origin: new origins.HttpOrigin(coachingDomain),
            viewerProtocolPolicy:
              cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
            cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
            originRequestPolicy:
              cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          },
          '/api/analytics/*': {
            origin: new origins.HttpOrigin(analyticsDomain),
            viewerProtocolPolicy:
              cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
            cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
            originRequestPolicy:
              cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          },
          '/api/nutrition/*': {
            origin: new origins.HttpOrigin(nutritionDomain),
            viewerProtocolPolicy:
              cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
            cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
            originRequestPolicy:
              cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          },
          '/api/ai/*': {
            origin: new origins.HttpOrigin(aiDomain, {
              connectionTimeout: cdk.Duration.seconds(10),
              connectionAttempts: 3,
            }),
            viewerProtocolPolicy:
              cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
            cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
            originRequestPolicy:
              cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          },
          '/api/notifications/*': {
            origin: new origins.HttpOrigin(notificationDomain),
            viewerProtocolPolicy:
              cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
            cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
            originRequestPolicy:
              cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          },
          '/progress-photos/*': {
            origin: origins.S3BucketOrigin.withOriginAccessIdentity(
              this.progressPhotosBucket,
              {
                originAccessIdentity: progressPhotosOAI,
              }
            ),
            viewerProtocolPolicy:
              cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
            cachePolicy: new cloudfront.CachePolicy(
              this,
              'ProgressPhotosCachePolicy',
              {
                cachePolicyName: 'progress-photos-cache-policy',
                defaultTtl: cdk.Duration.hours(24),
                maxTtl: cdk.Duration.days(365),
                minTtl: cdk.Duration.seconds(0),
                headerBehavior: cloudfront.CacheHeaderBehavior.allowList(
                  'CloudFront-Viewer-Country'
                ),
                queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
                cookieBehavior: cloudfront.CacheCookieBehavior.none(),
              }
            ),
          },
        },
        comment: 'GymCoach AI CloudFront Distribution',
      }
    );

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
    nutritionServiceLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:Query', 'dynamodb:GetItem'],
        resources: [
          this.mainTable.tableArn,
          `${this.mainTable.tableArn}/index/*`,
        ],
      })
    );

    // Grant AI service Bedrock permissions
    aiServiceLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock:InvokeModel',
          'bedrock:InvokeModelWithResponseStream',
        ],
        resources: ['arn:aws:bedrock:*::foundation-model/deepseek.v3-v1:0'],
      })
    );

    // Grant AI service Cognito permissions
    aiServiceLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'cognito-idp:AdminListGroupsForUser',
          'cognito-idp:AdminGetUser',
          'cognito-idp:ListUsers',
        ],
        resources: [this.userPool.userPoolArn],
      })
    );

    // Grant notification service permissions
    notificationServiceLambda.addToRolePolicy(
      new iam.PolicyStatement({
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
      })
    );

    // Grant notification scheduler permissions
    notificationSchedulerLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['lambda:InvokeFunction'],
        resources: [notificationServiceLambda.functionArn],
      })
    );

    // Add EventBridge targets
    workoutReminderRule.addTarget(
      new targets.LambdaFunction(notificationSchedulerLambda)
    );
    nutritionReminderRule.addTarget(
      new targets.LambdaFunction(notificationSchedulerLambda)
    );
    waterReminderRule.addTarget(
      new targets.LambdaFunction(notificationSchedulerLambda)
    );
    progressPhotoRule.addTarget(
      new targets.LambdaFunction(notificationSchedulerLambda)
    );

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

  private createLambdaFunction(
    name: string,
    serviceName: string,
    additionalEnvVars?: { [key: string]: string }
  ): lambda.Function {
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
      code: lambda.Code.fromAsset(
        `../services/${serviceName}/target/lambda/${serviceName}`
      ),
      environment: envVars,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256, // Optimized for cold starts
      reservedConcurrentExecutions: 10, // Prevent cold starts during high load
      // Removed log retention to use free tier defaults (5GB/month free)
      // Removed X-Ray tracing to avoid costs ($5 per 1M traces)
      layers: [this.createAuthLayer()],
    });
  }

  private createPythonLambdaFunction(
    name: string,
    serviceName: string
  ): lambda.Function {
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

  private createAuthLayer(): lambda.LayerVersion {
    if (this.authLayer) {
      return this.authLayer;
    }
    this.authLayer = new lambda.LayerVersion(this, 'AuthLayer', {
      code: lambda.Code.fromAsset('../services/auth-layer/layer'),
      compatibleRuntimes: [lambda.Runtime.PROVIDED_AL2],
      description:
        'Authentication and authorization layer for GymCoach AI services',
    });
    return this.authLayer;
  }

  private createPythonAuthLayer(): lambda.LayerVersion {
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

  // Removed createMonitoringStack method to avoid CloudWatch costs
  // private createMonitoringStack() {
  //   // Create monitoring stack
  //   new MonitoringStack(this, 'MonitoringStack', {
  //     lambdaFunctions: [
  //       this.userServiceLambda,
  //       this.userProfileServiceLambda,
  //       this.workoutServiceLambda,
  //       this.coachingServiceLambda,
  //       this.analyticsServiceLambda,
  //       this.nutritionServiceLambda,
  //       this.aiServiceLambda,
  //     ],
  //     dynamoDbTable: this.mainTable,
  //     s3Buckets: [
  //       this.userUploadsBucket,
  //       this.staticAssetsBucket,
  //       this.processedImagesBucket,
  //     ],
  //   });
  // }
}
