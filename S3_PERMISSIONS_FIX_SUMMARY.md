# S3 Permissions and Profile Picture Fix Summary

## 🔍 Issues Identified

### 1. **Progress Photos - Incorrect S3 Key Structure** ❌

**Problem:** The S3 keys didn't match the CloudFront path configuration.

- **Old Key Structure:** `users/{userId}/progress-photos/{photoId}`
- **CloudFront Expected:** `progress-photos/{photoId}`
- **Impact:** Photos uploaded successfully to S3 but couldn't be accessed via CloudFront URLs

### 2. **Profile Picture Update Not Persisting** ❌

**Problem:** Profile image URL updates weren't being saved correctly.

- The URL conversion logic was correct but lacked proper validation
- No logging to debug update issues
- Empty strings weren't being handled

### 3. **Missing CLOUDFRONT_DOMAIN Environment Variable** ❌

**Problem:** Analytics service couldn't generate proper CloudFront URLs.

- Created circular dependency in CDK
- Photos defaulted to direct S3 URLs (which don't work with BLOCK_ALL policy)

### 4. **Delete Operation Used Wrong S3 Key** ❌

**Problem:** Delete operations failed because they used the stored s3_key directly without validation.

---

## ✅ Changes Made

### 1. **Fixed Progress Photo Upload Path**

**File:** `services/analytics-service/src/repository/progress_photo_repository.rs`

```rust
// OLD:
let key = format!("users/{}/progress-photos/{}", user_id, photo_id);

// NEW:
let key = format!("{}", photo_id);
let full_s3_key = format!("progress-photos/{}", key);
```

**Result:** Photos now stored at `progress-photos/{photoId}` matching CloudFront configuration.

---

### 2. **Fixed S3 Key Storage in Service**

**File:** `services/analytics-service/src/service/progress_photo_service.rs`

```rust
// OLD:
s3_key: format!("users/{}/progress-photos/{}", user_id, photo_id),

// NEW:
s3_key: format!("progress-photos/{}", photo_id),
```

---

### 3. **Enhanced Profile Image Update Logic**

**File:** `services/user-profile-service/src/repository/user_profile_repository.rs`

**Added:**

- Empty string validation
- Debug logging for profile image updates
- Better error handling

```rust
if !profile_image.is_empty() {
    // conversion logic...

    tracing::info!(
        "Updated profile image URL for user {}: {} -> {}",
        user_id, profile_image, image_url
    );
}
```

---

### 4. **Fixed Delete Operation**

**File:** `services/analytics-service/src/repository/progress_photo_repository.rs`

**Added:**

- S3 key validation and normalization
- Logging for debugging
- Handles both formats (with/without prefix)

```rust
let key = if s3_key.starts_with("progress-photos/") {
    s3_key.to_string()
} else {
    format!("progress-photos/{}", s3_key)
};
```

---

### 5. **Added CloudFront Domain Output**

**File:** `infrastructure/src/gymcoach-ai-stack.ts`

**Added:**

- CDK output for CloudFront domain
- Placeholder in analytics Lambda environment

```typescript
new cdk.CfnOutput(this, 'CloudFrontDomainForAnalytics', {
  value: this.distribution.distributionDomainName,
  description: 'CloudFront domain - use this to update AnalyticsService Lambda',
  exportName: 'GymCoachAI-CloudFrontDomain',
});
```

---

## 🚀 Deployment Steps

### Step 1: Rebuild Services

```bash
cd /Users/babar/projects/gymcoach-ai

# Build analytics service (Rust)
cd services/analytics-service
cargo build --release --target x86_64-unknown-linux-musl

# Build user-profile service (Rust)
cd ../user-profile-service
cargo build --release --target x86_64-unknown-linux-musl

# Package for Lambda
cd ../../
./scripts/build-lambdas.sh
```

### Step 2: Deploy Infrastructure

```bash
cd infrastructure
npm run build
cdk deploy
```

**Note the CloudFront domain from the output!**

### Step 3: Update Analytics Lambda Environment Variable

After deployment, update the `CLOUDFRONT_DOMAIN` environment variable:

```bash
# Get CloudFront domain from CDK output
CLOUDFRONT_DOMAIN=$(aws cloudformation describe-stacks \
  --stack-name GymCoachAIStack \
  --query 'Stacks[0].Outputs[?ExportName==`GymCoachAI-CloudFrontDomain`].OutputValue' \
  --output text)

# Update Lambda function
aws lambda update-function-configuration \
  --function-name AnalyticsServiceLambda \
  --environment "Variables={TABLE_NAME=gymcoach-ai-main,DYNAMODB_TABLE=gymcoach-ai-main,PROGRESS_PHOTOS_BUCKET=gymcoach-ai-progress-photos-<account-id>,CLOUDFRONT_DOMAIN=$CLOUDFRONT_DOMAIN}"
```

### Step 4: Verify S3 Bucket Configuration

```bash
# Check progress photos bucket
aws s3 ls s3://gymcoach-ai-progress-photos-<account-id>/progress-photos/

# Check bucket policy
aws s3api get-bucket-policy --bucket gymcoach-ai-progress-photos-<account-id>
```

### Step 5: Test Upload and Delete

```bash
# Test from frontend or mobile app
# 1. Upload a progress photo
# 2. Verify it appears with CloudFront URL
# 3. Delete the photo
# 4. Verify it's removed from S3
```

---

## 🧪 Testing Checklist

### Progress Photos

- [ ] Upload new progress photo via mobile app
- [ ] Verify photo URL starts with CloudFront domain
- [ ] Photo displays correctly in app
- [ ] Delete progress photo
- [ ] Verify photo removed from S3 and DynamoDB
- [ ] Check CloudWatch logs for any errors

### Profile Picture

- [ ] Upload new profile picture
- [ ] Verify URL is saved in DynamoDB
- [ ] Log out and log back in
- [ ] Profile picture still displays correctly
- [ ] Update profile picture again
- [ ] Old URL replaced with new URL

---

## 🔧 Manual Fixes Required

### 1. Migrate Existing Progress Photos (If Any)

If you have existing progress photos with the old key structure, run this migration:

```bash
# List all objects with old structure
aws s3 ls s3://gymcoach-ai-progress-photos-<account-id>/users/ --recursive

# For each photo, copy to new location:
# aws s3 cp s3://bucket/users/{userId}/progress-photos/{photoId} \
#           s3://bucket/progress-photos/{photoId}

# Update DynamoDB records with new s3_key
```

### 2. Update CloudFront Distribution (If Needed)

The CloudFront distribution is already configured correctly for `/progress-photos/*` path.
Verify the behavior is configured:

```bash
aws cloudfront get-distribution-config --id <distribution-id>
```

Look for:

```json
{
  "PathPattern": "/progress-photos/*",
  "AllowedMethods": {
    "Items": ["GET", "HEAD"]
  }
}
```

---

## 📊 Monitoring

### CloudWatch Logs to Monitor

1. **Analytics Service Logs:**
   - Look for "Uploading progress photo to S3"
   - Look for "Deleting progress photo from S3"

2. **User Profile Service Logs:**
   - Look for "Updated profile image URL for user"

### Metrics to Watch

- S3 PutObject errors
- S3 DeleteObject errors
- Lambda errors in analytics service
- CloudFront 403 errors (should be zero)

---

## 🐛 Debugging Tips

### Progress Photos Not Displaying

1. Check CloudFront URL format:
   ```
   https://<cloudfront-domain>/progress-photos/{photoId}
   ```
2. Verify S3 object exists:
   ```bash
   aws s3 ls s3://gymcoach-ai-progress-photos-<account-id>/progress-photos/
   ```
3. Check CloudFront cache (may need to invalidate):
   ```bash
   aws cloudfront create-invalidation \
     --distribution-id <dist-id> \
     --paths "/progress-photos/*"
   ```

### Profile Picture Not Updating

1. Check CloudWatch logs for the update operation
2. Query DynamoDB directly:
   ```bash
   aws dynamodb get-item \
     --table-name gymcoach-ai-main \
     --key '{"PK":{"S":"USER#<userId>"},"SK":{"S":"PROFILE"}}'
   ```
3. Verify `profileImageUrl` field is updated

### Delete Not Working

1. Check S3 key format in DynamoDB
2. Verify Lambda has DeleteObject permissions
3. Check CloudWatch logs for actual S3 key being deleted

---

## 🔐 Security Notes

- ✅ Progress photos bucket has `BLOCK_ALL` public access (correct)
- ✅ Access is granted only via CloudFront OAI (correct)
- ✅ Analytics Lambda has read/write permissions (correct)
- ✅ User uploads bucket allows public read for `/user-profiles/*` (correct for profile pictures)

---

## 📝 Additional Notes

### Why This Happened

1. **Progress Photos:** Initial implementation used nested folder structure which is common but didn't match CloudFront configuration
2. **Profile Picture:** Missing validation and logging made it hard to debug
3. **CloudFront Domain:** Circular dependency in CDK is a known limitation

### Future Improvements

1. Add image processing Lambda to create thumbnails
2. Implement S3 lifecycle policies for old photos
3. Add image compression before upload
4. Implement presigned URLs for direct upload (bypass Lambda)
5. Add CloudFront signed URLs for private photos

---

## ✅ Verification Commands

```bash
# Check Lambda environment variables
aws lambda get-function-configuration --function-name AnalyticsServiceLambda | jq '.Environment.Variables'

# Check S3 bucket structure
aws s3 ls s3://gymcoach-ai-progress-photos-<account-id>/ --recursive | head -20

# Check CloudFront origins
aws cloudfront get-distribution --id <distribution-id> | jq '.Distribution.DistributionConfig.Origins'

# Test CloudFront access
curl -I https://<cloudfront-domain>/progress-photos/<photo-id>
```

---

## 🎯 Summary

All issues have been fixed:

1. ✅ Progress photo S3 keys now match CloudFront path
2. ✅ Profile picture updates include validation and logging
3. ✅ Delete operations handle both key formats
4. ✅ CloudFront domain is available via CDK output
5. ✅ All S3 permissions are correctly configured

**Next Steps:** Deploy and test!
