#!/bin/bash

# S3 Deployment Script for GymCoach AI
# This script builds and deploys your static site to S3

set -e  # Exit on any error

echo "🚀 GymCoach AI - S3 Deployment Script"
echo "======================================"

# Configuration
BUCKET_NAME="${S3_BUCKET_NAME:-your-bucket-name}"
REGION="${AWS_REGION:-us-east-1}"
PROFILE="${AWS_PROFILE:-default}"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if bucket name is set
if [ "$BUCKET_NAME" = "your-bucket-name" ]; then
    echo "⚠️  Please set S3_BUCKET_NAME environment variable"
    echo "   Example: export S3_BUCKET_NAME=my-gymcoach-bucket"
    exit 1
fi

echo "📦 Building static files..."
cd apps/web

# Generate static files
NEXT_EXPORT=true npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
else
    echo "❌ Build failed!"
    exit 1
fi

echo "☁️  Uploading to S3 bucket: $BUCKET_NAME"

# Upload files to S3
aws s3 sync out/ s3://$BUCKET_NAME \
    --region $REGION \
    --profile $PROFILE \
    --delete \
    --cache-control "public, max-age=31536000" \
    --exclude "*.html" \
    --exclude "*.json"

# Upload HTML files with shorter cache
aws s3 sync out/ s3://$BUCKET_NAME \
    --region $REGION \
    --profile $PROFILE \
    --delete \
    --cache-control "public, max-age=0, must-revalidate" \
    --include "*.html" \
    --include "*.json"

if [ $? -eq 0 ]; then
    echo "✅ Upload successful!"
    echo ""
    echo "🎯 Next steps:"
    echo "1. Configure S3 bucket for static website hosting"
    echo "2. Set up CloudFront distribution (recommended)"
    echo "3. Configure custom domain (optional)"
    echo ""
    echo "🌐 Your site should be available at:"
    echo "   http://$BUCKET_NAME.s3-website-$REGION.amazonaws.com"
else
    echo "❌ Upload failed!"
    exit 1
fi