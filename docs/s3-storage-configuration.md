# S3 Storage Configuration for GymCoach AI

## Overview

This document outlines the S3 storage configuration for the GymCoach AI application, including bucket policies, lifecycle management, security settings, and access patterns.

## S3 Buckets

### 1. User Uploads Bucket (`gymcoach-ai-user-uploads-{account}`)

**Purpose**: Store user-uploaded content including profile pictures, progress photos, and workout videos.

**Configuration**:

- **Versioning**: Enabled
- **Encryption**: S3-managed encryption (SSE-S3)
- **Public Access**: Blocked (all public access blocked)
- **Lifecycle Rules**:
  - Delete incomplete multipart uploads after 7 days
  - Transition to Infrequent Access after 30 days
  - Transition to Glacier after 90 days

**Access Patterns**:

- User profile pictures: `user-uploads/{userId}/profile/{timestamp}.{ext}`
- Progress photos: `user-uploads/{userId}/progress/{workoutSessionId}/{timestamp}.{ext}`
- Workout videos: `user-uploads/{userId}/videos/{workoutSessionId}/{timestamp}.{ext}`

**Permissions**:

- Lambda functions: Read/Write access
- Users: Presigned URL access only
- CloudFront: Read access for public content

### 2. Static Assets Bucket (`gymcoach-ai-static-assets-{account}`)

**Purpose**: Store static assets including exercise images, app icons, and other static content.

**Configuration**:

- **Versioning**: Enabled
- **Encryption**: S3-managed encryption (SSE-S3)
- **Public Access**: Blocked (served through CloudFront)
- **Lifecycle Rules**: None (content is frequently accessed)

**Access Patterns**:

- Exercise images: `static/exercises/{exerciseId}/{imageType}.{ext}`
- App icons: `static/icons/{iconName}.{ext}`
- UI assets: `static/ui/{component}/{assetName}.{ext}`

**Permissions**:

- Lambda functions: Read/Write access
- CloudFront: Read access
- Users: No direct access (served through CloudFront)

### 3. Processed Images Bucket (`gymcoach-ai-processed-images-{account}`)

**Purpose**: Store processed and optimized images for better performance and storage efficiency.

**Configuration**:

- **Versioning**: Enabled
- **Encryption**: S3-managed encryption (SSE-S3)
- **Public Access**: Blocked (served through CloudFront)
- **Lifecycle Rules**:
  - Delete old versions after 30 days

**Access Patterns**:

- Processed profile pictures: `processed/{userId}/profile/{size}/{timestamp}.{ext}`
- Processed progress photos: `processed/{userId}/progress/{workoutSessionId}/{size}/{timestamp}.{ext}`
- Thumbnails: `processed/{userId}/thumbnails/{originalId}/{size}.{ext}`

**Permissions**:

- Lambda functions: Read/Write access
- CloudFront: Read access
- Users: No direct access (served through CloudFront)

## Security Configuration

### 1. Bucket Policies

#### User Uploads Bucket Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowLambdaFunctions",
      "Effect": "Allow",
      "Principal": {
        "AWS": [
          "arn:aws:iam::{account}:role/GymCoachAIStack-UserProfileServiceLambdaRole-*",
          "arn:aws:iam::{account}:role/GymCoachAIStack-WorkoutServiceLambdaRole-*",
          "arn:aws:iam::{account}:role/GymCoachAIStack-AnalyticsServiceLambdaRole-*"
        ]
      },
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:GetObjectVersion",
        "s3:DeleteObjectVersion"
      ],
      "Resource": "arn:aws:s3:::gymcoach-ai-user-uploads-{account}/*"
    },
    {
      "Sid": "AllowCloudFrontRead",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:cloudfront::{account}:distribution/{distributionId}"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::gymcoach-ai-user-uploads-{account}/*"
    },
    {
      "Sid": "DenyInsecureConnections",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": "arn:aws:s3:::gymcoach-ai-user-uploads-{account}/*",
      "Condition": {
        "Bool": {
          "aws:SecureTransport": "false"
        }
      }
    }
  ]
}
```

#### Static Assets Bucket Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowLambdaFunctions",
      "Effect": "Allow",
      "Principal": {
        "AWS": [
          "arn:aws:iam::{account}:role/GymCoachAIStack-UserProfileServiceLambdaRole-*",
          "arn:aws:iam::{account}:role/GymCoachAIStack-WorkoutServiceLambdaRole-*",
          "arn:aws:iam::{account}:role/GymCoachAIStack-AnalyticsServiceLambdaRole-*"
        ]
      },
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::gymcoach-ai-static-assets-{account}/*"
    },
    {
      "Sid": "AllowCloudFrontRead",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:cloudfront::{account}:distribution/{distributionId}"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::gymcoach-ai-static-assets-{account}/*"
    }
  ]
}
```

#### Processed Images Bucket Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowLambdaFunctions",
      "Effect": "Allow",
      "Principal": {
        "AWS": [
          "arn:aws:iam::{account}:role/GymCoachAIStack-UserProfileServiceLambdaRole-*",
          "arn:aws:iam::{account}:role/GymCoachAIStack-WorkoutServiceLambdaRole-*",
          "arn:aws:iam::{account}:role/GymCoachAIStack-AnalyticsServiceLambdaRole-*"
        ]
      },
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::gymcoach-ai-processed-images-{account}/*"
    },
    {
      "Sid": "AllowCloudFrontRead",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:cloudfront::{account}:distribution/{distributionId}"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::gymcoach-ai-processed-images-{account}/*"
    }
  ]
}
```

### 2. CORS Configuration

#### User Uploads Bucket CORS

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": [
      "https://*.cloudfront.net",
      "http://localhost:3000",
      "https://localhost:3000"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

#### Static Assets Bucket CORS

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": [
      "https://*.cloudfront.net",
      "http://localhost:3000",
      "https://localhost:3000"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 86400
  }
]
```

### 3. Access Control Lists (ACLs)

All buckets use bucket-owner-full-control ACL to ensure proper ownership and access control.

## Lifecycle Management

### 1. User Uploads Bucket Lifecycle Rules

```yaml
Rules:
  - Id: DeleteIncompleteMultipartUploads
    Status: Enabled
    AbortIncompleteMultipartUpload:
      DaysAfterInitiation: 7

  - Id: TransitionToIA
    Status: Enabled
    Transitions:
      - StorageClass: STANDARD_IA
        Days: 30

  - Id: TransitionToGlacier
    Status: Enabled
    Transitions:
      - StorageClass: GLACIER
        Days: 90

  - Id: DeleteOldVersions
    Status: Enabled
    NoncurrentVersionExpiration:
      NoncurrentDays: 30
```

### 2. Processed Images Bucket Lifecycle Rules

```yaml
Rules:
  - Id: DeleteOldVersions
    Status: Enabled
    NoncurrentVersionExpiration:
      NoncurrentDays: 30

  - Id: DeleteIncompleteMultipartUploads
    Status: Enabled
    AbortIncompleteMultipartUpload:
      DaysAfterInitiation: 7
```

## Presigned URL Generation

### 1. Upload URLs

```typescript
// Generate presigned URL for user uploads
const uploadUrl = await s3.getSignedUrl('putObject', {
  Bucket: 'gymcoach-ai-user-uploads-{account}',
  Key: `user-uploads/${userId}/profile/${timestamp}.${extension}`,
  Expires: 3600, // 1 hour
  ContentType: contentType,
  ContentLength: contentLength,
  ServerSideEncryption: 'AES256',
  ACL: 'bucket-owner-full-control',
});
```

### 2. Download URLs

```typescript
// Generate presigned URL for secure downloads
const downloadUrl = await s3.getSignedUrl('getObject', {
  Bucket: 'gymcoach-ai-user-uploads-{account}',
  Key: `user-uploads/${userId}/progress/${photoId}.jpg`,
  Expires: 3600, // 1 hour
  ResponseContentDisposition: 'attachment; filename="progress-photo.jpg"',
});
```

## Image Processing Pipeline

### 1. Upload Flow

1. **Client Request**: User uploads image via presigned URL
2. **S3 Upload**: Image stored in user-uploads bucket
3. **Lambda Trigger**: S3 event triggers image processing Lambda
4. **Image Processing**: Resize, optimize, and create thumbnails
5. **Processed Storage**: Store processed images in processed-images bucket
6. **Database Update**: Update DynamoDB with processed image URLs

### 2. Processing Steps

```typescript
// Image processing pipeline
const processImage = async (sourceKey: string, userId: string) => {
  // 1. Download original image
  const originalImage = await s3
    .getObject({
      Bucket: 'gymcoach-ai-user-uploads-{account}',
      Key: sourceKey,
    })
    .promise();

  // 2. Process different sizes
  const sizes = [
    { name: 'thumbnail', width: 150, height: 150 },
    { name: 'small', width: 300, height: 300 },
    { name: 'medium', width: 600, height: 600 },
    { name: 'large', width: 1200, height: 1200 },
  ];

  for (const size of sizes) {
    const processedImage = await sharp(originalImage.Body)
      .resize(size.width, size.height, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toBuffer();

    await s3
      .putObject({
        Bucket: 'gymcoach-ai-processed-images-{account}',
        Key: `processed/${userId}/profile/${size.name}/${timestamp}.jpg`,
        Body: processedImage,
        ContentType: 'image/jpeg',
        ServerSideEncryption: 'AES256',
      })
      .promise();
  }
};
```

## CloudFront Integration

### 1. Origin Configuration

```typescript
// CloudFront origin for S3 buckets
const s3Origin = new origins.S3Origin(staticAssetsBucket, {
  originAccessIdentity: cloudFrontOAI,
  originPath: '/static',
});
```

### 2. Cache Behaviors

```typescript
// Cache behavior for static assets
const staticAssetsBehavior = {
  pathPattern: '/static/*',
  origin: s3Origin,
  viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
  allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
  cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
  cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
  originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
};
```

### 3. Custom Headers

```typescript
// Custom headers for security
const customHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};
```

## Monitoring and Logging

### 1. CloudWatch Metrics

- **Bucket Size**: Monitor storage usage
- **Request Count**: Track API requests
- **Error Rate**: Monitor failed requests
- **Data Transfer**: Track data transfer costs

### 2. CloudTrail Logging

```json
{
  "EventName": "GetObject",
  "EventTime": "2024-01-01T00:00:00Z",
  "SourceIPAddress": "203.0.113.12",
  "UserIdentity": {
    "type": "AssumedRole",
    "principalId": "AROAEXAMPLE123:user123",
    "arn": "arn:aws:sts::{account}:assumed-role/LambdaRole/user123"
  },
  "Resources": [
    {
      "type": "AWS::S3::Object",
      "resourceId": "gymcoach-ai-user-uploads-{account}/user-uploads/user123/profile/photo.jpg"
    }
  ]
}
```

### 3. S3 Access Logging

```xml
<AccessLog>
  <LoggingEnabled>
    <TargetBucket>gymcoach-ai-access-logs-{account}</TargetBucket>
    <TargetPrefix>access-logs/</TargetPrefix>
  </LoggingEnabled>
</AccessLog>
```

## Cost Optimization

### 1. Storage Classes

- **Standard**: Frequently accessed data (0-30 days)
- **Infrequent Access**: Less frequently accessed data (30-90 days)
- **Glacier**: Archive data (90+ days)

### 2. Intelligent Tiering

```typescript
// Enable intelligent tiering for cost optimization
const intelligentTiering = new s3.IntelligentTieringConfiguration(
  this,
  'IntelligentTiering',
  {
    bucket: userUploadsBucket,
    id: 'EntireBucket',
    status: s3.IntelligentTieringStatus.ENABLED,
    transitions: [
      {
        storageClass: s3.StorageClass.INFREQUENT_ACCESS,
        transitionAfter: cdk.Duration.days(30),
      },
      {
        storageClass: s3.StorageClass.ARCHIVE_ACCESS,
        transitionAfter: cdk.Duration.days(90),
      },
      {
        storageClass: s3.StorageClass.DEEP_ARCHIVE_ACCESS,
        transitionAfter: cdk.Duration.days(180),
      },
    ],
  }
);
```

### 3. Compression

```typescript
// Enable compression for text files
const compressionRule = {
  id: 'CompressTextFiles',
  status: 'Enabled',
  filter: {
    and: {
      prefix: 'logs/',
      tags: [
        {
          key: 'ContentType',
          value: 'text/plain',
        },
      ],
    },
  },
  transitions: [
    {
      storageClass: 'STANDARD_IA',
      days: 30,
    },
  ],
};
```

## Backup and Disaster Recovery

### 1. Cross-Region Replication

```typescript
// Enable cross-region replication
const replicationRule = {
  id: 'ReplicateToSecondaryRegion',
  status: 'Enabled',
  prefix: 'user-uploads/',
  destination: {
    bucket: 'arn:aws:s3:::gymcoach-ai-user-uploads-{account}-secondary',
    storageClass: 'STANDARD_IA',
    encryptionConfiguration: {
      replicaKmsKeyId: 'arn:aws:kms:us-west-2:{account}:key/{key-id}',
    },
  },
};
```

### 2. Point-in-Time Recovery

```typescript
// Enable point-in-time recovery
const pointInTimeRecovery = new s3.Bucket(this, 'PointInTimeRecovery', {
  bucketName: 'gymcoach-ai-backup-{account}',
  versioning: s3.BucketVersioning.ENABLED,
  lifecycleRules: [
    {
      id: 'DeleteOldVersions',
      noncurrentVersionExpiration: cdk.Duration.days(30),
    },
  ],
});
```

## Security Best Practices

### 1. Encryption

- **Encryption at Rest**: S3-managed encryption (SSE-S3)
- **Encryption in Transit**: HTTPS only
- **Client-Side Encryption**: For sensitive data

### 2. Access Control

- **IAM Policies**: Least privilege access
- **Bucket Policies**: Restrictive access patterns
- **Presigned URLs**: Time-limited access

### 3. Monitoring

- **CloudTrail**: Audit all S3 operations
- **CloudWatch**: Monitor access patterns
- **GuardDuty**: Detect suspicious activity

## Performance Optimization

### 1. Multipart Uploads

```typescript
// Use multipart uploads for large files
const multipartUpload = await s3
  .createMultipartUpload({
    Bucket: 'gymcoach-ai-user-uploads-{account}',
    Key: `user-uploads/${userId}/videos/${videoId}.mp4`,
    ContentType: 'video/mp4',
    ServerSideEncryption: 'AES256',
  })
  .promise();
```

### 2. Transfer Acceleration

```typescript
// Enable transfer acceleration for faster uploads
const transferAcceleration = new s3.Bucket(this, 'TransferAcceleration', {
  bucketName: 'gymcoach-ai-user-uploads-{account}',
  transferAcceleration: true,
});
```

### 3. CloudFront Caching

```typescript
// Configure CloudFront for optimal caching
const cacheBehavior = {
  pathPattern: '/processed/*',
  origin: processedImagesOrigin,
  viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
  allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
  cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
  cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
  originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
  responseHeadersPolicy:
    cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS,
};
```

This S3 storage configuration provides a robust, secure, and cost-effective solution for storing and serving user-generated content and static assets in the GymCoach AI application.
