# Quick Fix Guide: Progress Photos & Profile Pictures

## 🚨 Issues You Were Experiencing

### Issue #1: Progress Photos Upload/Delete Failing

**Symptom:** "Service error" when uploading or deleting progress photos

**Root Cause:**

- S3 objects were being stored at: `users/{userId}/progress-photos/{photoId}`
- CloudFront was configured for: `progress-photos/{photoId}`
- Result: Photos uploaded to S3 but CloudFront couldn't find them (404/403 errors)

**Fix Applied:**
✅ Changed S3 key structure to match CloudFront path
✅ Updated upload, delete, and storage logic
✅ Added proper error logging

---

### Issue #2: Profile Picture URL Not Persisting

**Symptom:** Profile picture uploads successfully to S3, but when fetching profile again, old URL still shows

**Root Causes:**

1. Empty string validation missing
2. No logging to debug the update flow
3. URL might not be properly saved to DynamoDB

**Fixes Applied:**
✅ Added empty string validation
✅ Added debug logging for profile image updates
✅ Ensured URL conversion happens before save
✅ Added tracing to track the update flow

---

## 🔍 What Changed in Code

### Progress Photos - Repository

**File:** `services/analytics-service/src/repository/progress_photo_repository.rs`

**Before:**

```rust
let key = format!("users/{}/progress-photos/{}", user_id, photo_id);
// Creates: users/abc123/progress-photos/xyz789
```

**After:**

```rust
let key = format!("{}", photo_id);
let full_s3_key = format!("progress-photos/{}", key);
// Creates: progress-photos/xyz789 ✅
```

---

### Progress Photos - Service

**File:** `services/analytics-service/src/service/progress_photo_service.rs`

**Before:**

```rust
s3_key: format!("users/{}/progress-photos/{}", user_id, photo_id),
```

**After:**

```rust
s3_key: format!("progress-photos/{}", photo_id), // Matches actual S3 location
```

---

### Profile Picture - Update Logic

**File:** `services/user-profile-service/src/repository/user_profile_repository.rs`

**Added:**

```rust
if !profile_image.is_empty() {  // ← NEW: Skip empty strings
    let image_url = if profile_image.starts_with("http://") ... {
        // conversion logic
    };
    profile.profile_image_url = Some(image_url);

    // ← NEW: Debug logging
    tracing::info!(
        "Updated profile image URL for user {}: {} -> {}",
        user_id, profile_image, image_url
    );
}
```

---

### Delete Operation - Fixed

**File:** `services/analytics-service/src/repository/progress_photo_repository.rs`

**Before:**

```rust
pub async fn delete_progress_photo_from_s3(&self, s3_key: &str) -> Result<()> {
    self.s3_client.delete_object()
        .bucket(&self.bucket_name)
        .key(s3_key)  // ← Used wrong key
        .send().await?;
    Ok(())
}
```

**After:**

```rust
pub async fn delete_progress_photo_from_s3(&self, s3_key: &str) -> Result<()> {
    // Handle both formats (with/without prefix)
    let key = if s3_key.starts_with("progress-photos/") {
        s3_key.to_string()
    } else {
        format!("progress-photos/{}", s3_key)
    };

    tracing::info!("Deleting: bucket={}, key={}", self.bucket_name, key);

    self.s3_client.delete_object()
        .bucket(&self.bucket_name)
        .key(&key)  // ← Now uses correct key
        .send().await?;
    Ok(())
}
```

---

## 🚀 How to Deploy the Fixes

### Option A: Full Rebuild and Deploy (Recommended)

```bash
# 1. Build Rust services
cd /Users/babar/projects/gymcoach-ai
./scripts/build-lambdas.sh

# 2. Deploy infrastructure
cd infrastructure
npm run build
cdk deploy

# 3. Update CloudFront domain in Lambda
cd ..
./scripts/update-cloudfront-domain.sh
```

### Option B: Quick Lambda Update Only

```bash
# If you already have the built binaries:
cd /Users/babar/projects/gymcoach-ai/infrastructure
cdk deploy --hotswap  # Faster, but only for Lambda code changes
```

---

## 🧪 Testing After Deployment

### Test Progress Photos

**Mobile App:**

```typescript
// Upload test
1. Open Progress Photos screen
2. Tap "Add Photo"
3. Select a photo
4. Add notes: "Test upload"
5. Submit

// Verify
6. Photo should appear with CloudFront URL
7. Check URL format: https://d123abc.cloudfront.net/progress-photos/{id}

// Delete test
8. Long press or swipe to delete
9. Confirm deletion
10. Photo should disappear
11. Check S3 to verify removal
```

**Web App:**

```typescript
// Upload test
1. Navigate to Progress Photos page
2. Click "Upload Photo"
3. Select file
4. Add notes
5. Submit

// Verify CloudFront URL
6. Open browser DevTools → Network tab
7. Check photo URL uses CloudFront domain
8. Photo should load correctly
```

### Test Profile Picture

**Mobile App:**

```typescript
// Upload test
1. Go to Profile tab
2. Tap on avatar/profile picture
3. Select "Take Photo" or "Choose from Library"
4. Select/take a photo
5. Wait for upload

// Verify persistence
6. Note the profile picture displays
7. Force close app
8. Reopen app
9. Profile picture should still be there
10. Go to another tab and back
11. Picture should persist
```

**Web App:**

```typescript
// Upload test
1. Go to Profile page
2. Click on profile picture / camera icon
3. Select a file
4. Wait for upload success message

// Verify persistence
5. Refresh page (F5)
6. Profile picture should still show
7. Log out and log back in
8. Picture should persist

// Update test
9. Upload a different picture
10. Old picture should be replaced
11. Verify in browser DevTools that URL changed
```

---

## 📊 Debugging with CloudWatch Logs

### Check Progress Photo Upload Logs

```bash
# Analytics Service logs
aws logs tail /aws/lambda/AnalyticsServiceLambda --follow --format short

# Look for:
# "Uploading progress photo to S3"
# "Created progress photo with ID: xyz"
# Any error messages
```

### Check Profile Picture Update Logs

```bash
# User Profile Service logs
aws logs tail /aws/lambda/UserProfileServiceLambda --follow --format short

# Look for:
# "Updated profile image URL for user abc123: user-profiles/xyz.jpg -> https://..."
# Any error messages
```

### Check S3 Operations

```bash
# Enable S3 access logging (if not already enabled)
aws s3api put-bucket-logging \
  --bucket gymcoach-ai-progress-photos-<account-id> \
  --bucket-logging-status '{
    "LoggingEnabled": {
      "TargetBucket": "your-logs-bucket",
      "TargetPrefix": "progress-photos-logs/"
    }
  }'
```

---

## 🔧 Manual Verification Commands

### Check if Photo Exists in S3

```bash
# List progress photos
aws s3 ls s3://gymcoach-ai-progress-photos-<account-id>/progress-photos/

# Check specific photo
aws s3 ls s3://gymcoach-ai-progress-photos-<account-id>/progress-photos/<photo-id>
```

### Check Profile Picture in DynamoDB

```bash
# Replace USER_ID with actual user ID
aws dynamodb get-item \
  --table-name gymcoach-ai-main \
  --key '{"PK":{"S":"USER#<USER_ID>"},"SK":{"S":"PROFILE"}}' \
  --query 'Item.profileImageUrl'
```

### Test CloudFront Access

```bash
# Should return 200 OK
curl -I https://<cloudfront-domain>/progress-photos/<photo-id>

# If 403, check:
# 1. S3 object exists
# 2. CloudFront OAI has permissions
# 3. Path matches exactly
```

---

## ❌ Common Errors and Solutions

### Error: "Access Denied" when accessing photo URL

**Solution:**

1. Verify S3 object is at `progress-photos/{id}` not `users/.../progress-photos/{id}`
2. Check CloudFront OAI has permissions on the bucket
3. Clear CloudFront cache:
   ```bash
   aws cloudfront create-invalidation \
     --distribution-id <id> \
     --paths "/progress-photos/*"
   ```

### Error: "Profile picture not updating"

**Solution:**

1. Check CloudWatch logs for "Updated profile image URL" message
2. Verify DynamoDB item was actually updated
3. Clear app cache and reload
4. Check if frontend is using cached profile data

### Error: "Delete operation fails silently"

**Solution:**

1. Check Lambda has DeleteObject permission on S3 bucket
2. Verify s3_key in DynamoDB matches actual S3 object key
3. Check CloudWatch logs for delete operation
4. Ensure photo exists before deleting

---

## 🎯 Key Points to Remember

1. **Progress Photos S3 Path:** `progress-photos/{photoId}` (flat structure)
2. **CloudFront Path:** `/progress-photos/*` (must match S3 structure)
3. **Profile Pictures:** Stored at `user-profiles/{uuid}.{ext}` (different bucket)
4. **CloudFront Domain:** Must be set in Lambda environment variable for CloudFront URLs to work
5. **Bucket Access:** Progress photos bucket has `BLOCK_ALL`, only accessible via CloudFront OAI

---

## 📞 Still Having Issues?

1. **Check CloudWatch Logs First:** Most errors are logged
2. **Verify S3 Structure:** Use `aws s3 ls` to see actual keys
3. **Test CloudFront:** Use `curl -I` to check if CloudFront can access files
4. **Check DynamoDB:** Ensure s3_key matches actual S3 location
5. **Review Permissions:** Ensure Lambda roles have correct S3 permissions

**Need more help?** Check the full detailed guide: `S3_PERMISSIONS_FIX_SUMMARY.md`
