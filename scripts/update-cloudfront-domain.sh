#!/bin/bash
set -e

echo "🔧 Updating Analytics Service Lambda with CloudFront Domain..."

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "Account ID: $ACCOUNT_ID"

# Get CloudFront domain from stack outputs
echo "Fetching CloudFront domain from CloudFormation..."
CLOUDFRONT_DOMAIN=$(aws cloudformation describe-stacks \
  --stack-name GymCoachAIStack \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDomainForAnalytics`].OutputValue' \
  --output text 2>/dev/null || echo "")

if [ -z "$CLOUDFRONT_DOMAIN" ]; then
  echo "⚠️  CloudFront domain not found in stack outputs."
  echo "Trying to get distribution domain directly..."
  
  # Alternative: Get the first CloudFront distribution (if you only have one)
  CLOUDFRONT_DOMAIN=$(aws cloudfront list-distributions \
    --query 'DistributionList.Items[0].DomainName' \
    --output text 2>/dev/null || echo "")
fi

if [ -z "$CLOUDFRONT_DOMAIN" ]; then
  echo "❌ Could not find CloudFront domain. Please enter it manually:"
  read -p "CloudFront Domain (e.g., d123456abcdef.cloudfront.net): " CLOUDFRONT_DOMAIN
fi

echo "CloudFront Domain: $CLOUDFRONT_DOMAIN"

# Get current Lambda environment variables
echo "Fetching current environment variables..."
CURRENT_ENV=$(aws lambda get-function-configuration \
  --function-name AnalyticsServiceLambda \
  --query 'Environment.Variables' \
  --output json)

# Update with CloudFront domain
echo "Updating Lambda environment variables..."
NEW_ENV=$(echo $CURRENT_ENV | jq --arg cf "$CLOUDFRONT_DOMAIN" '. + {CLOUDFRONT_DOMAIN: $cf}')

aws lambda update-function-configuration \
  --function-name AnalyticsServiceLambda \
  --environment "Variables=$NEW_ENV" \
  --output json > /dev/null

echo "✅ Successfully updated AnalyticsServiceLambda with CLOUDFRONT_DOMAIN=$CLOUDFRONT_DOMAIN"

# Verify the update
echo ""
echo "Verification:"
aws lambda get-function-configuration \
  --function-name AnalyticsServiceLambda \
  --query 'Environment.Variables.CLOUDFRONT_DOMAIN' \
  --output text

echo ""
echo "🎉 Done! The Analytics Service can now generate CloudFront URLs for progress photos."
echo ""
echo "Next steps:"
echo "1. Test uploading a progress photo"
echo "2. Verify the photo URL uses the CloudFront domain"
echo "3. Check CloudWatch logs for any errors"
