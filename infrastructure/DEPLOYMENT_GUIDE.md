# GymCoach AI - Deployment Guide

## Environment-Based Deployment

This CDK stack supports separate deployments for **development** and **production** environments.

### Quick Deploy Commands

#### Deploy Development Environment

```bash
# Using CDK context
cd infrastructure
cdk deploy --context environment=dev

# Or using environment variable
DEPLOY_ENV=dev cdk deploy

# Default (no flag) deploys to dev
cdk deploy
```

#### Deploy Production Environment

```bash
# Using CDK context
cd infrastructure
cdk deploy --context environment=prod

# Or using environment variable
DEPLOY_ENV=prod cdk deploy
```

### Resource Naming Convention

All resources are automatically named with the environment suffix:

| Resource Type     | Dev Name                      | Prod Name                      |
| ----------------- | ----------------------------- | ------------------------------ |
| DynamoDB Table    | `gymcoach-ai-main-dev`        | `gymcoach-ai-main-prod`        |
| User Pool         | `gymcoach-ai-users-dev`       | `gymcoach-ai-users-prod`       |
| S3 Buckets        | `gymcoach-ai-*-dev-{account}` | `gymcoach-ai-*-prod-{account}` |
| SNS Topics        | `gymcoach-ai-*-dev`           | `gymcoach-ai-*-prod`           |
| EventBridge Rules | `gymcoach-ai-*-dev`           | `gymcoach-ai-*-prod`           |
| CloudFront Stack  | `GymCoachAIStack-dev`         | `GymCoachAIStack-prod`         |

### Security Improvements

#### User Uploads Bucket (Enhanced Security)

The user uploads bucket now follows the same security pattern as the progress photos bucket:

✅ **SECURE** - No direct S3 access  
✅ **CloudFront Only** - All images served through CloudFront with Origin Access Identity  
✅ **No Public URLs** - S3 bucket blocks all public access

**CloudFront Paths:**

- User uploads: `https://{cloudfront-domain}/user-uploads/*`
- Progress photos: `https://{cloudfront-domain}/progress-photos/*`

#### Before (Insecure):

```
❌ Public bucket policy allowed direct S3 access
❌ Images accessible via: s3.amazonaws.com/bucket/user-profiles/image.jpg
```

#### After (Secure):

```
✅ All public access blocked at bucket level
✅ Images only accessible via: {cloudfront-domain}/user-uploads/user-profiles/image.jpg
✅ CloudFront Origin Access Identity controls access
```

### Development Workflow

#### 1. Initial Setup

```bash
# Install dependencies
cd infrastructure
npm install

# Bootstrap CDK (first time only)
cdk bootstrap
```

#### 2. Development Cycle

```bash
# Deploy to dev environment
cdk deploy --context environment=dev

# Test your changes in dev environment
# ... testing ...

# When ready for production
cdk deploy --context environment=prod
```

#### 3. Stack Management

```bash
# List all stacks
cdk list

# View differences before deployment
cdk diff --context environment=dev
cdk diff --context environment=prod

# Destroy a stack (careful!)
cdk destroy --context environment=dev
cdk destroy --context environment=prod
```

### Environment Variables Required

```bash
# AWS Credentials (required)
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export CDK_DEFAULT_ACCOUNT=your-account-id
export CDK_DEFAULT_REGION=eu-west-1

# Optional: Set default environment
export DEPLOY_ENV=dev  # or 'prod'

# Firebase credentials (for notifications)
export FCM_SERVER_KEY=your-fcm-server-key
export FIREBASE_PROJECT_ID=gymcoach-73528
```

### Post-Deployment Steps

After deploying either environment, you need to:

1. **Update Analytics Service Lambda**

   ```bash
   # Get CloudFront domain from stack outputs
   CLOUDFRONT_DOMAIN=$(aws cloudformation describe-stacks \
     --stack-name GymCoachAIStack-{env} \
     --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDomainForAnalytics`].OutputValue' \
     --output text)

   # Update Lambda environment variable
   aws lambda update-function-configuration \
     --function-name AnalyticsServiceLambda \
     --environment "Variables={CLOUDFRONT_DOMAIN=$CLOUDFRONT_DOMAIN,...}"
   ```

2. **Deploy Frontend to S3**

   ```bash
   # Build frontend
   cd apps/web
   npm run build

   # Sync to appropriate S3 bucket
   aws s3 sync out/ s3://gymcoach-ai-frontend-{env}-{account}/

   # Invalidate CloudFront cache
   aws cloudfront create-invalidation \
     --distribution-id {distribution-id} \
     --paths "/*"
   ```

3. **Update Application Configuration**
   Update your frontend `.env` files with the new stack outputs:
   - `NEXT_PUBLIC_USER_POOL_ID`
   - `NEXT_PUBLIC_USER_POOL_CLIENT_ID`
   - `NEXT_PUBLIC_API_URL` (CloudFront domain)

### Migration from Single to Multi-Environment

If you have an existing deployment, here's how to migrate:

#### Option 1: Fresh Start (Recommended for Dev)

```bash
# Deploy new dev stack
cdk deploy --context environment=dev

# Migrate data if needed
# ... data migration scripts ...

# Destroy old stack
cdk destroy GymCoachAIStack
```

#### Option 2: In-Place Migration (For Production)

```bash
# 1. Export existing data
aws dynamodb export-table-to-point-in-time \
  --table-arn arn:aws:dynamodb:eu-west-1:{account}:table/gymcoach-ai-main \
  --s3-bucket gymcoach-ai-backup \
  --export-format DYNAMODB_JSON

# 2. Deploy production stack
cdk deploy --context environment=prod

# 3. Import data to new table
# ... import scripts ...

# 4. Update DNS/routing to new CloudFront distribution

# 5. Destroy old stack after verification
cdk destroy GymCoachAIStack
```

### Best Practices

1. **Always deploy to dev first**

   ```bash
   cdk deploy --context environment=dev
   # Test thoroughly
   cdk deploy --context environment=prod
   ```

2. **Use different AWS accounts for dev/prod** (Optional but recommended)

   ```bash
   # Dev account
   export AWS_PROFILE=gymcoach-dev
   cdk deploy --context environment=dev

   # Prod account
   export AWS_PROFILE=gymcoach-prod
   cdk deploy --context environment=prod
   ```

3. **Tag resources for cost tracking**
   All resources are automatically tagged with:
   - `Environment: dev` or `Environment: prod`
   - `Project: GymCoach-AI`

4. **Monitor costs separately**
   Use AWS Cost Explorer to filter by:
   - Tag: `Environment=dev`
   - Tag: `Environment=prod`

### Troubleshooting

#### Issue: Stack already exists

```bash
# If you get "Stack already exists" error
cdk destroy GymCoachAIStack
cdk deploy --context environment=dev
```

#### Issue: Bucket name conflicts

```bash
# Bucket names are globally unique and include account ID
# If still conflicts, modify the bucket names in the stack
```

#### Issue: CloudFront distribution not found

```bash
# Wait for CloudFront distribution to fully deploy (can take 15-20 minutes)
aws cloudfront list-distributions
```

### Cost Optimization

- **Dev Environment**: Lower resource limits, aggressive lifecycle policies
- **Prod Environment**: Higher limits, conservative lifecycle policies

Both environments use:

- Pay-per-request DynamoDB billing
- S3 lifecycle transitions to IA/Glacier
- Lambda reserved concurrency limits
- No CloudWatch Log retention (uses free tier defaults)

### Stack Outputs

After deployment, get stack outputs:

```bash
# Dev outputs
aws cloudformation describe-stacks \
  --stack-name GymCoachAIStack-dev \
  --query 'Stacks[0].Outputs'

# Prod outputs
aws cloudformation describe-stacks \
  --stack-name GymCoachAIStack-prod \
  --query 'Stacks[0].Outputs'
```

Key outputs include:

- `CloudFrontUrl`: Main application URL
- `UserPoolId`: Cognito user pool ID
- `UserPoolClientId`: Cognito client ID
- Various Lambda function URLs
- S3 bucket names

---

## Summary

✅ Separate dev and production environments  
✅ Secure S3 access via CloudFront only  
✅ Environment-based resource naming  
✅ Simple deployment commands  
✅ Cost-optimized configuration

Deploy with confidence! 🚀
