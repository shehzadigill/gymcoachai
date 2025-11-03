# GymCoach AI Infrastructure

AWS CDK infrastructure for GymCoach AI with separate development and production environments.

## 🎯 Quick Start

### Deploy Development Environment

```bash
cd infrastructure
npm install
cdk deploy --context environment=dev
```

### Deploy Production Environment

```bash
cd infrastructure
cdk deploy --context environment=prod
```

## 📚 Documentation

- **[QUICK_DEPLOY.md](./QUICK_DEPLOY.md)** - Quick reference for common commands
- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - Comprehensive deployment guide
- **[INFRASTRUCTURE_UPDATE_SUMMARY.md](./INFRASTRUCTURE_UPDATE_SUMMARY.md)** - Recent changes and updates

## 🔑 Key Features

### Environment Separation

- ✅ Completely isolated `dev` and `prod` environments
- ✅ Independent resource naming with environment suffixes
- ✅ Separate AWS stacks: `GymCoachAIStack-dev` and `GymCoachAIStack-prod`
- ✅ Automatic resource tagging for cost tracking

### Security

- 🔒 User uploads bucket secured with CloudFront-only access
- 🔒 Progress photos protected via Origin Access Identity
- 🔒 No direct S3 public access allowed
- 🔒 All images served through CloudFront CDN

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       CloudFront CDN                        │
│  - Main App (S3 Origin)                                     │
│  - /api/* (Lambda Function URLs)                            │
│  - /user-uploads/* (S3 via OAI) 🔒 NEW!                    │
│  - /progress-photos/* (S3 via OAI)                          │
└─────────────────────────────────────────────────────────────┘
                              ▼
         ┌────────────────────┴────────────────────┐
         ▼                                         ▼
┌──────────────────┐                    ┌──────────────────┐
│   S3 Buckets     │                    │  Lambda Services │
│  - Frontend      │                    │  - User Profile  │
│  - User Uploads  │◄─── OAI ───        │  - Workout       │
│  - Progress Photos│◄─── OAI ───       │  - Analytics     │
│  - Vectors       │                    │  - Nutrition     │
└──────────────────┘                    │  - AI Service    │
                                        │  - Coaching      │
                                        │  - Notifications │
                                        └──────────────────┘
                                                 ▼
                              ┌──────────────────────────────┐
                              │   DynamoDB                   │
                              │   Cognito User Pool          │
                              │   SNS Topics                 │
                              │   EventBridge Rules          │
                              └──────────────────────────────┘
```

## 📦 Resources Created

### Per Environment (dev/prod)

| Resource Type           | Count | Naming Pattern                  |
| ----------------------- | ----- | ------------------------------- |
| DynamoDB Tables         | 1     | `gymcoach-ai-main-{env}`        |
| Cognito User Pool       | 1     | `gymcoach-ai-users-{env}`       |
| S3 Buckets              | 6     | `gymcoach-ai-*-{env}-{account}` |
| Lambda Functions        | 8     | Service-specific                |
| CloudFront Distribution | 1     | Auto-generated domain           |
| SNS Topics              | 4     | `gymcoach-ai-*-{env}`           |
| EventBridge Rules       | 9     | `gymcoach-ai-*-{env}`           |

## 🔐 Security Improvements

### User Uploads Bucket (NEW!)

Previously, user images were accessible via public S3 URLs:

```
❌ https://gymcoach-ai-user-uploads.s3.amazonaws.com/user-profiles/avatar.jpg
```

Now, all images are **only** accessible through CloudFront:

```
✅ https://{cloudfront-domain}/user-uploads/user-profiles/avatar.jpg
```

**Benefits:**

- No direct S3 access possible
- Centralized access control
- Better caching and performance
- Protection against misconfiguration
- Consistent security model

## 🚀 Deployment

### Prerequisites

```bash
# Install AWS CDK globally
npm install -g aws-cdk

# Configure AWS credentials
export AWS_ACCESS_KEY_ID=your-key
export AWS_SECRET_ACCESS_KEY=your-secret
export CDK_DEFAULT_ACCOUNT=your-account
export CDK_DEFAULT_REGION=eu-west-1
```

### First Time Setup

```bash
# Navigate to infrastructure directory
cd infrastructure

# Install dependencies
npm install

# Bootstrap CDK (one time only)
cdk bootstrap
```

### Deploy

```bash
# Development
cdk deploy --context environment=dev

# Production
cdk deploy --context environment=prod

# Default (dev)
cdk deploy
```

### View Changes Before Deploying

```bash
cdk diff --context environment=dev
cdk diff --context environment=prod
```

## 🔄 Common Workflows

### Development Cycle

```bash
# 1. Make changes to infrastructure code
vim src/gymcoach-ai-stack.ts

# 2. Build
npm run build

# 3. Preview changes
cdk diff --context environment=dev

# 4. Deploy to dev
cdk deploy --context environment=dev

# 5. Test thoroughly
# ... testing ...

# 6. Deploy to production
cdk deploy --context environment=prod
```

### Get Stack Outputs

```bash
# Dev stack outputs
aws cloudformation describe-stacks \
  --stack-name GymCoachAIStack-dev \
  --query 'Stacks[0].Outputs'

# Prod stack outputs
aws cloudformation describe-stacks \
  --stack-name GymCoachAIStack-prod \
  --query 'Stacks[0].Outputs'
```

### Frontend Deployment

```bash
# Build frontend
cd ../apps/web
npm run build

# Deploy to dev S3
aws s3 sync out/ s3://gymcoach-ai-frontend-dev-{account}/

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id {dev-distribution-id} \
  --paths "/*"

# Same for production
aws s3 sync out/ s3://gymcoach-ai-frontend-prod-{account}/
aws cloudfront create-invalidation \
  --distribution-id {prod-distribution-id} \
  --paths "/*"
```

## 🧪 Testing

### Verify Security

```bash
# This should FAIL (no public access)
curl https://gymcoach-ai-user-uploads-dev-{account}.s3.amazonaws.com/test.jpg

# This should SUCCEED (CloudFront access)
curl https://{cloudfront-domain}/user-uploads/test.jpg
```

### Check Resources

```bash
# List DynamoDB tables
aws dynamodb list-tables | grep gymcoach-ai

# List S3 buckets
aws s3 ls | grep gymcoach-ai

# List Lambda functions
aws lambda list-functions | grep Service
```

## 💰 Cost Optimization

Both environments use:

- **DynamoDB**: Pay-per-request billing (no provisioned capacity)
- **Lambda**: Reserved concurrency of 20 (cost-controlled)
- **S3**: Lifecycle transitions to IA (30 days) and Glacier (90 days)
- **CloudWatch**: No custom log retention (free tier defaults)
- **No X-Ray**: Tracing disabled to avoid costs

**Estimated Monthly Costs:**

- Dev Environment: $5-15/month (light usage)
- Prod Environment: $20-50/month (depends on traffic)

## 🔧 Troubleshooting

### Stack Already Exists

```bash
# List existing stacks
cdk ls

# Destroy old stack if needed
cdk destroy GymCoachAIStack

# Deploy with new naming
cdk deploy --context environment=dev
```

### Bucket Name Conflicts

```bash
# Bucket names include account ID to avoid conflicts
# If you still get conflicts, the bucket might exist from previous deployment
aws s3 rb s3://gymcoach-ai-frontend-{account} --force
```

### CloudFront Takes Long Time

```bash
# CloudFront distributions can take 15-20 minutes to deploy/update
# Check status:
aws cloudfront list-distributions --query 'DistributionList.Items[*].[Id,Status]'
```

## 📊 Monitoring

### CloudWatch Logs

```bash
# View Lambda logs
aws logs tail /aws/lambda/UserProfileService --follow
aws logs tail /aws/lambda/AIService --follow
```

### CloudWatch Metrics

```bash
# DynamoDB metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --dimensions Name=TableName,Value=gymcoach-ai-main-dev
```

### Cost Tracking

```bash
# Filter by environment tag
aws ce get-cost-and-usage \
  --time-period Start=2025-11-01,End=2025-12-01 \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --filter file://filter.json

# filter.json:
{
  "Tags": {
    "Key": "Environment",
    "Values": ["dev"]
  }
}
```

## 🔄 Migration Guide

See [INFRASTRUCTURE_UPDATE_SUMMARY.md](./INFRASTRUCTURE_UPDATE_SUMMARY.md) for detailed migration steps from the old single-stack setup.

## 📝 Environment Variables

### Required

```bash
export AWS_ACCESS_KEY_ID=your-key
export AWS_SECRET_ACCESS_KEY=your-secret
export CDK_DEFAULT_ACCOUNT=your-account-id
export CDK_DEFAULT_REGION=eu-west-1
```

### Optional

```bash
export DEPLOY_ENV=dev  # or 'prod'
export FCM_SERVER_KEY=your-fcm-key
export FIREBASE_PROJECT_ID=gymcoach-73528
```

## 🎯 Best Practices

1. **Always deploy to dev first**

   ```bash
   cdk deploy --context environment=dev
   # Test thoroughly
   cdk deploy --context environment=prod
   ```

2. **Use version control**

   ```bash
   git add infrastructure/
   git commit -m "Update infrastructure"
   git push
   ```

3. **Review changes before deploying**

   ```bash
   cdk diff --context environment=prod
   ```

4. **Tag your releases**

   ```bash
   git tag -a v1.0.0 -m "Production release"
   git push --tags
   ```

5. **Backup before major changes**
   ```bash
   aws dynamodb create-backup \
     --table-name gymcoach-ai-main-prod \
     --backup-name prod-backup-$(date +%Y%m%d)
   ```

## 📞 Support

For issues or questions:

1. Check [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
2. Review [INFRASTRUCTURE_UPDATE_SUMMARY.md](./INFRASTRUCTURE_UPDATE_SUMMARY.md)
3. Check AWS CloudFormation events for deployment errors
4. Review Lambda CloudWatch logs

## 📄 License

See main project LICENSE file.

---

**Ready to deploy!** 🚀

Start with:

```bash
cd infrastructure
cdk deploy --context environment=dev
```
