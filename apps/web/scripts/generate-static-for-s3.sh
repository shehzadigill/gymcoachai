#!/bin/bash

# Script to generate static pages for S3 deployment
# This creates static HTML files for all supported locales and routes

echo "🚀 Generating static pages for S3 deployment..."

# Set environment for static export
export NEXT_EXPORT=true

# Build the application
echo "📦 Building Next.js application with static export..."
npm run build

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    
    # The build output will be in the 'out' directory
    echo "📁 Static files generated in 'out' directory"
    echo "🌐 Ready for S3 deployment!"
    
    # List the generated files
    echo "📋 Generated files:"
    find out -name "*.html" | head -20
    
    echo ""
    echo "🎯 Next steps:"
    echo "1. Upload the 'out' directory contents to your S3 bucket"
    echo "2. Configure S3 bucket for static website hosting"
    echo "3. Set up CloudFront CDN (optional but recommended)"
    echo "4. Configure custom domain (optional)"
    
else
    echo "❌ Build failed!"
    exit 1
fi
