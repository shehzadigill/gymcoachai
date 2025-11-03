# Infrastructure Update Summary

## Changes Implemented

### 1. Environment-Based Resource Separation ✅

**What Changed:**

- Added support for separate `dev` and `prod` environments
- All resources now include environment suffix in their names
- Stack names are now `GymCoachAIStack-dev` and `GymCoachAIStack-prod`

**Benefits:**

- ✅ Completely isolated dev and production environments
- ✅ Safe testing without affecting production
- ✅ Clear resource naming and organization
- ✅ Independent scaling and cost tracking
- ✅ Automatic resource tagging for cost allocation

**Resource Naming Examples:**

```
Dev:
- DynamoDB: gymcoach-ai-main-dev
- User Pool: gymcoach-ai-users-dev
- S3 Buckets: gymcoach-ai-*-dev-{account}
- SNS Topics: gymcoach-ai-*-dev

Prod:
- DynamoDB: gymcoach-ai-main-prod
- User Pool: gymcoach-ai-users-prod
- S3 Buckets: gymcoach-ai-*-prod-{account}
- SNS Topics: gymcoach-ai-*-prod
```

### 2. Enhanced User Uploads Bucket Security ✅

**What Changed:**

- User uploads bucket now blocks ALL public access (like progress photos bucket)
- Added CloudFront Origin Access Identity for secure access
- Removed public bucket policy that allowed direct S3 URLs
- Added `/user-uploads/*` path to CloudFront distribution

**Before (INSECURE):**

```typescript
blockPublicAccess: (new s3.BlockPublicAccess({
  blockPublicAcls: false, // ❌ Allowed public ACLs
  blockPublicPolicy: false, // ❌ Allowed public policies
  ignorePublicAcls: false, // ❌ Respected public ACLs
  restrictPublicBuckets: false, // ❌ Allowed public buckets
}),
  // Public bucket policy
  this.userUploadsBucket.addToResourcePolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      principals: [new iam.AnyPrincipal()], // ❌ Anyone could access
      actions: ['s3:GetObject'],
      resources: [`${this.userUploadsBucket.bucketArn}/user-profiles/*`],
    })
  ));
```

**After (SECURE):**

```typescript
blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,  // ✅ All public access blocked

// CloudFront Origin Access Identity
const userUploadsOAI = new cloudfront.OriginAccessIdentity(
  this,
  'UserUploadsOAI',
  {
    comment: 'Origin Access Identity for User Uploads bucket',
  }
);

// Only CloudFront OAI can access
this.userUploadsBucket.addToResourcePolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    principals: [userUploadsOAI.grantPrincipal],  // ✅ Only CloudFront
    actions: ['s3:GetObject'],
    resources: [`${this.userUploadsBucket.bucketArn}/*`],
  })
);
```

**Security Benefits:**

- ✅ No direct S3 access possible
- ✅ Images only accessible through CloudFront
- ✅ Better control over access patterns
- ✅ Consistent security model across all image buckets
- ✅ Protection against accidental public exposure
- ✅ CloudFront caching improves performance

**Access Pattern Change:**

```
❌ OLD (Insecure):
https://s3.amazonaws.com/gymcoach-ai-user-uploads/user-profiles/avatar.jpg
https://gymcoach-ai-user-uploads.s3.amazonaws.com/user-profiles/avatar.jpg

✅ NEW (Secure):
https://d202qmtk8kkxra.cloudfront.net/user-uploads/user-profiles/avatar.jpg
```

### 3. Updated Files

#### `infrastructure/src/gymcoach-ai-stack.ts`

**Changes:**

1. Added `GymCoachAIStackProps` interface with `environment` property
2. Added `env` private property to track environment
3. Updated all resource names to include `${this.env}` suffix
4. Changed user uploads bucket to `BLOCK_ALL` public access
5. Removed public bucket policy from user uploads bucket
6. Added `userUploadsOAI` CloudFront Origin Access Identity
7. Added OAI permission to user uploads bucket
8. Added `/user-uploads/*` behavior to CloudFront distribution
9. Added cache policy for user uploads

**Lines Changed:** ~50 modifications across the entire stack

#### `infrastructure/src/app.ts`

**Changes:**

1. Added environment detection from context or env var
2. Added environment validation
3. Updated stack name to include environment
4. Added environment and project tags
5. Added console logging for deployment tracking

**Before:**

```typescript
new GymCoachAIStack(app, 'GymCoachAIStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'eu-west-1',
  },
});
```

**After:**

```typescript
const environment =
  app.node.tryGetContext('environment') || process.env.DEPLOY_ENV || 'dev';

new GymCoachAIStack(app, `GymCoachAIStack-${environment}`, {
  environment: environment as 'dev' | 'prod',
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'eu-west-1',
  },
  tags: {
    Environment: environment,
    Project: 'GymCoach-AI',
  },
});
```

### 4. New Documentation Files

#### `infrastructure/DEPLOYMENT_GUIDE.md`

Comprehensive guide covering:

- Environment-based deployment commands
- Resource naming conventions
- Security improvements explained
- Development workflow
- Post-deployment steps
- Migration guide
- Best practices
- Troubleshooting
- Cost optimization

#### `infrastructure/QUICK_DEPLOY.md`

Quick reference card with:

- Common deployment commands
- Security features summary
- Resource naming table
- Common workflows
- Post-deployment checklist

## Deployment Commands

### Development Environment

```bash
cd infrastructure
cdk deploy --context environment=dev
```

### Production Environment

```bash
cd infrastructure
cdk deploy --context environment=prod
```

### Default (Dev)

```bash
cd infrastructure
cdk deploy
```

## Breaking Changes & Migration Required

### ⚠️ Important: This is a breaking change!

**Why it's breaking:**

1. Stack name changes from `GymCoachAIStack` to `GymCoachAIStack-dev/prod`
2. All resource names change (DynamoDB, S3, Cognito, etc.)
3. User uploads now require CloudFront URLs instead of S3 URLs

### Migration Steps

#### Option 1: Fresh Dev Deployment (Recommended)

```bash
# 1. Deploy new dev stack
cdk deploy --context environment=dev

# 2. Test thoroughly
# ... testing ...

# 3. When ready, deploy prod
cdk deploy --context environment=prod

# 4. Destroy old stack
cdk destroy GymCoachAIStack
```

#### Option 2: Export/Import Data

```bash
# 1. Export existing DynamoDB data
aws dynamodb export-table-to-point-in-time \
  --table-arn arn:aws:dynamodb:eu-west-1:{account}:table/gymcoach-ai-main \
  --s3-bucket backup-bucket

# 2. Export S3 data
aws s3 sync s3://gymcoach-ai-user-uploads-{account} ./backup/user-uploads/

# 3. Deploy new stack
cdk deploy --context environment=prod

# 4. Import data
# ... import scripts ...

# 5. Update application URLs

# 6. Destroy old stack
cdk destroy GymCoachAIStack
```

### Frontend Changes Required

Update your frontend code to use CloudFront URLs:

**Before:**

```typescript
const imageUrl = `https://${bucketName}.s3.amazonaws.com/user-profiles/${userId}/avatar.jpg`;
```

**After:**

```typescript
const imageUrl = `https://${cloudFrontDomain}/user-uploads/user-profiles/${userId}/avatar.jpg`;
```

## Cost Impact

### No Additional Costs

- Using existing CloudFront distribution
- Origin Access Identity is free
- No additional data transfer charges (already going through CloudFront)

### Potential Savings

- Better cache hit rates on user images
- Reduced S3 request costs
- Unified CDN delivery

## Security Compliance

### Before

- ❌ User images exposed via public S3 URLs
- ❌ No centralized access control
- ❌ Potential for misconfiguration
- ❌ Direct bucket access possible

### After

- ✅ All images require CloudFront access
- ✅ Centralized access control via OAI
- ✅ Protection against misconfiguration
- ✅ No direct bucket access possible
- ✅ Consistent security model

## Testing Checklist

- [ ] Deploy dev stack successfully
- [ ] Verify all resources have `-dev` suffix
- [ ] Test user image uploads
- [ ] Verify images accessible via CloudFront `/user-uploads/*`
- [ ] Verify images NOT accessible via direct S3 URL
- [ ] Test progress photos still work
- [ ] Test all Lambda functions
- [ ] Check CloudFront cache behavior
- [ ] Deploy prod stack
- [ ] Verify all resources have `-prod` suffix
- [ ] Migration complete

## Rollback Plan

If issues occur:

```bash
# 1. Keep old stack running
# Don't destroy GymCoachAIStack yet

# 2. Destroy new stack if needed
cdk destroy --context environment=dev
cdk destroy --context environment=prod

# 3. Revert code changes
git revert HEAD

# 4. Redeploy old stack
cdk deploy
```

## Next Steps

1. **Deploy to Dev**

   ```bash
   cd infrastructure
   cdk deploy --context environment=dev
   ```

2. **Update Frontend Config**
   - Update CloudFront domain in `.env`
   - Update API endpoints
   - Change image URL patterns

3. **Test Thoroughly**
   - User registration/login
   - Profile image upload
   - Progress photos upload
   - Image display
   - All API endpoints

4. **Deploy to Prod**

   ```bash
   cdk deploy --context environment=prod
   ```

5. **Monitor**
   - CloudFront metrics
   - Lambda errors
   - S3 access logs
   - User feedback

## Summary

✅ **Environment Separation**: Dev and prod completely isolated  
✅ **Enhanced Security**: User uploads now CloudFront-only access  
✅ **Better Organization**: Clear resource naming with env suffix  
✅ **Cost Tracking**: Automatic tags for cost allocation  
✅ **Scalability**: Independent scaling per environment

**Total Files Modified:** 2  
**New Files Created:** 3  
**Breaking Changes:** Yes (requires migration)  
**Security Improvement:** Significant

---

Ready to deploy! 🚀

For questions or issues, refer to:

- `DEPLOYMENT_GUIDE.md` - Comprehensive guide
- `QUICK_DEPLOY.md` - Quick reference
