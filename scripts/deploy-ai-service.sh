#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

echo "Deploying Python AI Service..."

# Navigate to the AI service directory
cd services/ai-service-python

# Create deployment package
echo "Creating deployment package..."

# Install dependencies
pip install -r requirements.txt -t .

# Create deployment zip
zip -r ai-service-deployment.zip . -x "*.pyc" "__pycache__/*" "*.git*" "*.DS_Store"

# Move to deployment directory
mkdir -p ../../deployments
mv ai-service-deployment.zip ../../deployments/

echo "✅ AI Service deployment package created successfully!"
echo "Package location: deployments/ai-service-deployment.zip"

# Optional: Deploy to AWS Lambda (requires AWS CLI configured)
if command -v aws &> /dev/null; then
    echo "Deploying to AWS Lambda..."
    aws lambda update-function-code \
        --function-name gymcoach-ai-ai-service \
        --zip-file fileb://../../deployments/ai-service-deployment.zip
    echo "✅ AI Service deployed to AWS Lambda!"
else
    echo "AWS CLI not found. Please deploy manually using the deployment package."
fi
