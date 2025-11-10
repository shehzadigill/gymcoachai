#!/bin/bash

set -e

# Get environment from argument (default to 'dev')
ENVIRONMENT=${1:-dev}

# Validate environment
if [[ "$ENVIRONMENT" != "dev" && "$ENVIRONMENT" != "prod" ]]; then
    echo "❌ Invalid environment: $ENVIRONMENT. Must be 'dev' or 'prod'"
    exit 1
fi

echo "🚀 Deploying frontend static export to S3 ($ENVIRONMENT environment)..."

# Set AWS profile if not already set
if [ -z "$AWS_PROFILE" ]; then
    export AWS_PROFILE=shehzadi
    echo "Using AWS profile: $AWS_PROFILE"
fi

# Build the app with static export
echo "📦 Building Next.js app with static export..."
cd /Users/babar/projects/gymcoach-ai/apps/web

# Clean cache to ensure fresh build
echo "🧹 Cleaning build cache..."
rm -rf .next out

npm run build:static

# Check if out directory exists
if [ ! -d "out" ]; then
    echo "❌ Build output directory 'out' not found!"
    exit 1
fi

echo "📁 Build output created successfully in 'out' directory"

# Upload to S3 using AWS CLI
echo "☁️ Uploading to S3..."
cd /Users/babar/projects/gymcoach-ai/infrastructure

# Get the S3 bucket name from CDK output
STACK_NAME="GymCoachAIStack-${ENVIRONMENT}"
echo "Getting bucket name from stack: $STACK_NAME"

FRONTEND_BUCKET=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' \
    --output text \
    --region eu-west-1)

if [ -z "$FRONTEND_BUCKET" ]; then
    echo "❌ Could not find frontend S3 bucket name from CloudFormation outputs"
    exit 1
fi

echo "📤 Uploading files to bucket: $FRONTEND_BUCKET"

# Sync the out directory to S3
aws s3 sync ../apps/web/out s3://$FRONTEND_BUCKET --delete \
    --exclude "*.map" \
    --cache-control "public, max-age=31536000, immutable" \
    --metadata-directive REPLACE \
    --region eu-west-1

# Set specific cache control for HTML files
aws s3 cp ../apps/web/out s3://$FRONTEND_BUCKET --recursive \
    --exclude "*" --include "*.html" \
    --cache-control "public, max-age=0, must-revalidate" \
    --metadata-directive REPLACE \
    --region eu-west-1

echo "✅ Frontend deployment completed successfully!"

# Get the CloudFront distribution ID and URL
CLOUDFRONT_DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
    --output text \
    --region eu-west-1)

CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionURL`].OutputValue' \
    --output text \
    --region eu-west-1)

if [ -n "$CLOUDFRONT_DISTRIBUTION_ID" ]; then
    echo "🔄 Invalidating CloudFront cache for distribution: $CLOUDFRONT_DISTRIBUTION_ID"
    INVALIDATION_ID=$(aws cloudfront create-invalidation \
        --distribution-id $CLOUDFRONT_DISTRIBUTION_ID \
        --paths "/*" \
        --query 'Invalidation.Id' \
        --output text \
        --region eu-west-1)
    
    echo "✅ Cache invalidation created with ID: $INVALIDATION_ID"
    echo "⏳ Invalidation is in progress. This typically takes 2-5 minutes."
else
    echo "⚠️ Could not find CloudFront distribution ID from CloudFormation outputs"
    echo "💡 You may need to manually invalidate the cache"
fi

echo "🌐 Frontend is now available at: $CLOUDFRONT_URL"