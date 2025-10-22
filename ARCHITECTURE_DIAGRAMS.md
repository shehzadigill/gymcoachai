# Architecture Diagrams: S3 and CloudFront Flow

## Before Fix (Broken) ❌

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PROGRESS PHOTOS UPLOAD                        │
└─────────────────────────────────────────────────────────────────────┘

Mobile/Web App
     │
     │ POST /api/analytics/progress-photos/upload
     │ { imageData: "base64...", userId: "abc123" }
     ▼
Lambda (Analytics Service)
     │
     │ S3 PutObject
     │ Key: "users/abc123/progress-photos/xyz789"  ← WRONG PATH
     ▼
S3 Bucket (progress-photos)
     │
     │ Object stored at:
     │ s3://bucket/users/abc123/progress-photos/xyz789
     │
     │ Returns CloudFront URL:
     │ https://d123.cloudfront.net/progress-photos/users/abc123/progress-photos/xyz789
     ▼
CloudFront Distribution
     │
     │ Looking for: /progress-photos/xyz789
     │ Got:         /progress-photos/users/abc123/progress-photos/xyz789
     │
     ▼
     ❌ 404 NOT FOUND - Path doesn't match!
```

---

## After Fix (Working) ✅

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PROGRESS PHOTOS UPLOAD                        │
└─────────────────────────────────────────────────────────────────────┘

Mobile/Web App
     │
     │ POST /api/analytics/progress-photos/upload
     │ { imageData: "base64...", userId: "abc123" }
     ▼
Lambda (Analytics Service)
     │
     │ S3 PutObject
     │ Key: "progress-photos/xyz789"  ← CORRECT PATH
     ▼
S3 Bucket (progress-photos)
     │
     │ Object stored at:
     │ s3://bucket/progress-photos/xyz789
     │
     │ Returns CloudFront URL:
     │ https://d123.cloudfront.net/progress-photos/xyz789
     ▼
CloudFront Distribution
     │
     │ Path: /progress-photos/*
     │ OAI: Has read permission on S3
     │
     ▼
S3 Bucket (via OAI)
     │
     │ Fetches: progress-photos/xyz789
     ▼
     ✅ 200 OK - Photo delivered!
```

---

## Profile Picture Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                      PROFILE PICTURE UPDATE                          │
└─────────────────────────────────────────────────────────────────────┘

Mobile/Web App
     │
     │ 1. Request presigned URL
     │ POST /api/user-profiles/profile/upload
     │ { file_type: "image/jpeg" }
     ▼
Lambda (User Profile Service)
     │
     │ Generate presigned URL
     │ S3.putObject.presigned()
     │
     │ Returns: {
     │   upload_url: "https://s3.../user-profiles/uuid.jpg?X-Amz-...",
     │   key: "user-profiles/uuid.jpg"
     │ }
     ▼
App receives presigned URL
     │
     │ 2. Upload directly to S3
     │ PUT to presigned URL
     │ Body: image binary
     ▼
S3 Bucket (user-uploads)
     │
     │ Image stored at: user-profiles/uuid.jpg
     │
     ▼
App gets success
     │
     │ 3. Update profile with image key
     │ PATCH /api/user-profiles/profile
     │ { profileImageUrl: "user-profiles/uuid.jpg" }
     ▼
Lambda (User Profile Service)
     │
     │ Before Fix:
     │ ❌ Might not validate empty strings
     │ ❌ No logging
     │
     │ After Fix:
     │ ✅ Validates non-empty
     │ ✅ Converts to full URL
     │ ✅ Logs the update
     │
     │ Converts key → URL:
     │ "user-profiles/uuid.jpg" →
     │ "https://bucket.s3.region.amazonaws.com/user-profiles/uuid.jpg"
     ▼
DynamoDB
     │
     │ UPDATE USER#abc123
     │ SET profileImageUrl = "https://..."
     ▼
     ✅ Profile picture URL saved!
```

---

## CloudFront Distribution Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│                     CloudFront Distribution                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Origin 1: Frontend (S3 - frontend bucket)                          │
│  ┌────────────────────────────────────────────────────┐            │
│  │ Path: /*                                            │            │
│  │ Auth: OAI (Origin Access Identity)                 │            │
│  │ Cache: Long TTL                                     │            │
│  └────────────────────────────────────────────────────┘            │
│                                                                       │
│  Origin 2: Progress Photos (S3 - progress photos bucket)           │
│  ┌────────────────────────────────────────────────────┐            │
│  │ Path: /progress-photos/*                           │ ← FIX HERE  │
│  │ Auth: OAI (progressPhotosOAI)                      │            │
│  │ Cache: 24h default, 365 days max                   │            │
│  │ Methods: GET, HEAD only                            │            │
│  └────────────────────────────────────────────────────┘            │
│                                                                       │
│  Origin 3-7: API Lambdas (Function URLs)                           │
│  ┌────────────────────────────────────────────────────┐            │
│  │ /api/user-profiles/* → UserProfileServiceLambda    │            │
│  │ /api/workouts/*      → WorkoutServiceLambda        │            │
│  │ /api/analytics/*     → AnalyticsServiceLambda      │            │
│  │ /api/nutrition/*     → NutritionServiceLambda      │            │
│  │ /api/ai/*            → AIServiceLambda             │            │
│  │                                                      │            │
│  │ Auth: None (handled by Lambda authorizer)          │            │
│  │ Cache: Disabled                                     │            │
│  └────────────────────────────────────────────────────┘            │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## S3 Bucket Structures

### Progress Photos Bucket

```
gymcoach-ai-progress-photos-<account-id>
│
└── progress-photos/          ← Root folder for all photos
    ├── photo-uuid-1.jpg
    ├── photo-uuid-2.jpg
    ├── photo-uuid-3.png
    └── photo-uuid-4.jpg

✅ CORRECT: Flat structure, matches CloudFront path
❌ WRONG:   users/{userId}/progress-photos/{photoId}
```

### User Uploads Bucket (Profile Pictures)

```
gymcoach-ai-user-uploads-<account-id>
│
└── user-profiles/            ← Profile pictures
    ├── uuid-1.jpg
    ├── uuid-2.png
    └── uuid-3.jpg

✅ PUBLIC READ allowed on user-profiles/*
   (via bucket policy, not public ACL)
```

---

## Permission Flow

### Progress Photos - Access via CloudFront Only

```
User Request
     │
     │ https://d123.cloudfront.net/progress-photos/xyz.jpg
     ▼
CloudFront Distribution
     │
     │ OAI Identity: arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity XYZ
     ▼
S3 Bucket Policy
     │
     │ {
     │   "Effect": "Allow",
     │   "Principal": {
     │     "AWS": "arn:aws:iam::cloudfront:user/..."
     │   },
     │   "Action": "s3:GetObject",
     │   "Resource": "arn:aws:s3:::bucket/progress-photos/*"
     │ }
     ▼
S3 Object
     │
     ▼
     ✅ Access Granted
```

### Progress Photos - Direct S3 Access (Blocked)

```
User Request
     │
     │ https://bucket.s3.amazonaws.com/progress-photos/xyz.jpg
     ▼
S3 Bucket
     │
     │ Block Public Access: ENABLED
     │ Block Public ACLs: YES
     │ Block Public Policy: YES
     │ Ignore Public ACLs: YES
     │ Restrict Public Buckets: YES
     ▼
     ❌ 403 FORBIDDEN - No public access allowed
```

### Lambda Write Access to S3

```
Lambda Function (Analytics Service)
     │
     │ IAM Role: AnalyticsServiceLambdaRole
     ▼
IAM Policy
     │
     │ {
     │   "Effect": "Allow",
     │   "Action": [
     │     "s3:GetObject",
     │     "s3:PutObject",
     │     "s3:DeleteObject"
     │   ],
     │   "Resource": "arn:aws:s3:::bucket/progress-photos/*"
     │ }
     ▼
S3 Bucket
     │
     ▼
     ✅ Read/Write Access Granted
```

---

## Error Scenarios and Solutions

### Scenario 1: 403 Forbidden on CloudFront URL

```
Request: https://d123.cloudfront.net/progress-photos/xyz.jpg
Response: 403 Forbidden

Causes:
1. S3 object at wrong path (e.g., users/.../progress-photos/xyz.jpg)
2. OAI doesn't have permission
3. Object doesn't exist

Solutions:
1. Check S3 object path: aws s3 ls s3://bucket/progress-photos/
2. Verify OAI policy on bucket
3. Verify object exists
4. Invalidate CloudFront cache
```

### Scenario 2: Profile Picture Not Updating

```
Upload: ✅ Success
Database: ❌ Old URL still showing

Causes:
1. Empty string being saved
2. Update not committed to DynamoDB
3. Frontend caching old data

Solutions:
1. Check CloudWatch logs for "Updated profile image URL"
2. Query DynamoDB directly to verify update
3. Clear frontend cache / reload
4. Ensure validation allows the new URL format
```

### Scenario 3: Delete Fails but Upload Works

```
Upload: ✅ Success (object at progress-photos/xyz.jpg)
Delete: ❌ Fails (looking for users/.../progress-photos/xyz.jpg)

Cause:
s3_key in DynamoDB has old format

Solution:
Fix applied - delete operation now handles both formats
```

---

## Environment Variables Required

### Analytics Service Lambda

```bash
TABLE_NAME=gymcoach-ai-main
DYNAMODB_TABLE=gymcoach-ai-main
PROGRESS_PHOTOS_BUCKET=gymcoach-ai-progress-photos-<account-id>
CLOUDFRONT_DOMAIN=d123abc.cloudfront.net  ← REQUIRED for CloudFront URLs
AWS_REGION=us-east-1
```

### User Profile Service Lambda

```bash
TABLE_NAME=gymcoach-ai-main
USER_UPLOADS_BUCKET=gymcoach-ai-user-uploads-<account-id>
AWS_REGION=us-east-1
USER_POOL_ID=us-east-1_xyz
```

---

## Summary of Fixes

| Component                 | Before                                   | After                                       |
| ------------------------- | ---------------------------------------- | ------------------------------------------- |
| **Progress Photo S3 Key** | `users/{userId}/progress-photos/{id}` ❌ | `progress-photos/{id}` ✅                   |
| **Progress Photo URL**    | Direct S3 or wrong CF path ❌            | `https://cf.domain/progress-photos/{id}` ✅ |
| **Delete S3 Key**         | Used stored key directly ❌              | Validates and fixes key format ✅           |
| **Profile Image Update**  | No validation, no logging ❌             | Validates, converts, logs ✅                |
| **CloudFront Domain**     | Hardcoded or missing ❌                  | Environment variable ✅                     |

All issues are now fixed! 🎉
