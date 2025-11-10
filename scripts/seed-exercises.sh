#!/bin/bash

# Script to populate exercises in the database
# Usage: ./seed-exercises.sh

echo "🏋️  GymCoach AI - Exercise Database Seeder"
echo "=========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "scripts/populate-exercises.js" ]; then
    echo "❌ Error: This script must be run from the project root directory"
    echo "   Current directory: $(pwd)"
    echo "   Expected: /path/to/gymcoach-ai"
    exit 1
fi

echo "📍 Found populate-exercises.js script"
echo ""

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    echo "   Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"
echo ""

# Run the script
echo "🚀 Starting exercise population..."
echo "   This will create sample exercises in the database"
echo "   API Endpoint: https://d202qmtk8kkxra.cloudfront.net"
echo ""

cd scripts
AWS_PROFILE=shehzadi node populate-exercises.js

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Exercise population completed successfully!"
    echo ""
    echo "Next steps:"
    echo "  1. Test the mobile app exercises list"
    echo "  2. Verify exercises appear in the workout creation flow"
    echo "  3. Check that exercise details are displayed correctly"
else
    echo ""
    echo "❌ Exercise population failed!"
    echo "   Please check the error messages above"
    echo "   Common issues:"
    echo "     - Network connectivity problems"
    echo "     - API authentication issues"
    echo "     - Database permissions"
    exit 1
fi
