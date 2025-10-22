#!/bin/bash

# Deploy Frontend Static to S3 and CloudFront
# This script builds and deploys your static site to S3 and invalidates CloudFront

set -e  # Exit on any error

echo "🚀 GymCoach AI - Frontend Static Deployment"
echo "=========================================="

# Configuration
BUCKET_NAME="${S3_BUCKET_NAME:-your-bucket-name}"
CLOUDFRONT_DISTRIBUTION_ID="${CLOUDFRONT_DISTRIBUTION_ID:-your-distribution-id}"
REGION="${AWS_REGION:-us-east-1}"
PROFILE="${AWS_PROFILE:-default}"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if required environment variables are set
if [ "$BUCKET_NAME" = "your-bucket-name" ]; then
    echo "⚠️  Please set S3_BUCKET_NAME environment variable"
    echo "   Example: export S3_BUCKET_NAME=my-gymcoach-bucket"
    exit 1
fi

if [ "$CLOUDFRONT_DISTRIBUTION_ID" = "your-distribution-id" ]; then
    echo "⚠️  Please set CLOUDFRONT_DISTRIBUTION_ID environment variable"
    echo "   Example: export CLOUDFRONT_DISTRIBUTION_ID=E1234567890ABC"
    exit 1
fi

echo "📦 Building static files..."
cd apps/web

# Clean previous builds
rm -rf .next out

# Generate static files
NEXT_EXPORT=true npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
else
    echo "❌ Build failed!"
    exit 1
fi

echo "☁️  Uploading to S3 bucket: $BUCKET_NAME"

# Upload static assets with long cache
aws s3 sync out/ s3://$BUCKET_NAME \
    --region $REGION \
    --profile $PROFILE \
    --delete \
    --cache-control "public, max-age=31536000" \
    --exclude "*.html" \
    --exclude "*.json"

# Upload HTML files with short cache
aws s3 sync out/ s3://$BUCKET_NAME \
    --region $REGION \
    --profile $PROFILE \
    --delete \
    --cache-control "public, max-age=0, must-revalidate" \
    --include "*.html" \
    --include "*.json"

if [ $? -eq 0 ]; then
    echo "✅ Upload successful!"
else
    echo "❌ Upload failed!"
    exit 1
fi

echo "🔄 Invalidating CloudFront cache..."

# Invalidate CloudFront distribution
aws cloudfront create-invalidation \
    --distribution-id $CLOUDFRONT_DISTRIBUTION_ID \
    --paths "/*" \
    --region $REGION \
    --profile $PROFILE

if [ $? -eq 0 ]; then
    echo "✅ CloudFront invalidation successful!"
else
    echo "⚠️  CloudFront invalidation failed, but upload was successful"
fi

echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "🌐 Your site should be available at:"
echo "   S3: http://$BUCKET_NAME.s3-website-$REGION.amazonaws.com"
echo "   CloudFront: Check your CloudFront distribution URL"
echo ""
echo "📝 Next steps:"
echo "1. Verify your site is working correctly"
echo "2. Check CloudFront invalidation status in AWS Console"
echo "3. Test all functionality (auth, translations, etc.)"
