# Quick Deployment Reference

## 🚀 Deploy Commands

### Development

```bash
cd infrastructure
cdk deploy --context environment=dev
```

### Production

```bash
cd infrastructure
cdk deploy --context environment=prod
```

### Default (Dev)

```bash
cd infrastructure
cdk deploy
```

## 📋 Useful Commands

### Check what will change

```bash
cdk diff --context environment=dev
cdk diff --context environment=prod
```

### List all stacks

```bash
cdk list
```

### Destroy stack

```bash
cdk destroy --context environment=dev
cdk destroy --context environment=prod
```

## 🔐 Security Features

### User Images Now Secure!

- ✅ No direct S3 access
- ✅ Only accessible through CloudFront
- ✅ Same security as progress photos
- ✅ Public access blocked at bucket level

### Access Patterns

```
❌ OLD: s3.amazonaws.com/bucket/user-profiles/image.jpg
✅ NEW: {cloudfront-domain}/user-uploads/user-profiles/image.jpg
```

## 📦 Resource Naming

All resources include environment suffix:

| Resource   | Dev                     | Prod                     |
| ---------- | ----------------------- | ------------------------ |
| DynamoDB   | `gymcoach-ai-main-dev`  | `gymcoach-ai-main-prod`  |
| User Pool  | `gymcoach-ai-users-dev` | `gymcoach-ai-users-prod` |
| S3 Buckets | `*-dev-{account}`       | `*-prod-{account}`       |

## 🎯 Common Workflows

### Initial Setup

```bash
cd infrastructure
npm install
cdk bootstrap
```

### Deploy to Dev → Test → Deploy to Prod

```bash
# Deploy to dev
cdk deploy --context environment=dev

# Test thoroughly...

# Deploy to prod
cdk deploy --context environment=prod
```

### Get Stack Outputs

```bash
aws cloudformation describe-stacks \
  --stack-name GymCoachAIStack-dev \
  --query 'Stacks[0].Outputs'
```

## ⚡ Environment Variables

```bash
export AWS_ACCESS_KEY_ID=your-key
export AWS_SECRET_ACCESS_KEY=your-secret
export CDK_DEFAULT_ACCOUNT=your-account
export CDK_DEFAULT_REGION=eu-west-1
export DEPLOY_ENV=dev  # or prod
```

## 📝 Post-Deployment

1. Update Analytics Lambda with CloudFront domain
2. Deploy frontend to S3
3. Invalidate CloudFront cache
4. Update frontend .env files

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed instructions.
