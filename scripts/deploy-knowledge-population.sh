#!/bin/bash
"""
Deployment script for S3 Vectors knowledge population
Sets up environment and runs knowledge population scripts
"""

set -e

echo "🚀 Starting S3 Vectors Knowledge Population Deployment..."

# Set AWS profile if not already set
if [ -z "$AWS_PROFILE" ]; then
    export AWS_PROFILE=shehzadi
    echo "Using AWS profile: $AWS_PROFILE"
fi

# Set environment variables
export VECTORS_BUCKET="gymcoach-ai-vectors-dev"
export DYNAMODB_TABLE="gymcoach-ai-main-dev"
export AWS_REGION="eu-west-1"

# Make scripts executable
chmod +x scripts/exercise-knowledge-builder.py
chmod +x scripts/nutrition-knowledge-builder.py
chmod +x scripts/populate-s3-vectors-knowledge.py

echo "✅ Scripts made executable"

# Install required Python packages
echo "📦 Installing required packages..."
pip3 install boto3 botocore asyncio

echo "✅ Packages installed"

# Check AWS credentials
echo "🔐 Checking AWS credentials..."
aws sts get-caller-identity --region $AWS_REGION

if [ $? -eq 0 ]; then
    echo "✅ AWS credentials verified"
else
    echo "❌ AWS credentials not found. Please configure AWS CLI."
    exit 1
fi

# Get account ID for bucket name
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --region $AWS_REGION)
VECTORS_BUCKET="gymcoach-ai-vectors-dev-${ACCOUNT_ID}"

echo "Using bucket: $VECTORS_BUCKET"

# Check if S3 bucket exists
echo "🪣 Checking S3 vectors bucket..."
aws s3 ls s3://$VECTORS_BUCKET --region $AWS_REGION

if [ $? -eq 0 ]; then
    echo "✅ S3 vectors bucket exists"
else
    echo "❌ S3 vectors bucket not found. Please deploy infrastructure first."
    exit 1
fi

# Run knowledge population
echo "🧠 Starting knowledge population..."
cd scripts

echo "📚 Populating exercise knowledge..."
python3 exercise-knowledge-builder.py

echo "🥗 Populating nutrition knowledge..."
python3 nutrition-knowledge-builder.py

echo "🔬 Populating research knowledge..."
python3 populate-s3-vectors-knowledge.py

echo "✅ Knowledge population completed!"

# Verify population
echo "🔍 Verifying knowledge population..."
aws s3 ls s3://$VECTORS_BUCKET --recursive --region $AWS_REGION | wc -l

echo "🎉 S3 Vectors knowledge population deployment completed successfully!"
echo "📊 Check the logs above for detailed results."
