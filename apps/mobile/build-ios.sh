#!/bin/bash

echo "🎯 Building GymCoach Mobile App for iOS..."
echo "📱 This is your first build - it will take 5-10 minutes"
echo "⏰ Subsequent builds will be much faster!"
echo ""

cd /Users/babar/projects/gymcoach-ai/apps/mobile

# Start Metro bundler in background
echo "🚀 Starting Metro bundler..."
npx react-native start &
METRO_PID=$!

# Wait for Metro to start
sleep 5

echo "🔨 Starting iOS build..."
echo "💡 You can also open Xcode workspace manually:"
echo "   open ios/mobile.xcworkspace"
echo ""

# Build the app
npx react-native run-ios --scheme GymCoachMobile --verbose

# If Metro is still running, kill it
if kill -0 $METRO_PID 2>/dev/null; then
    echo "⏹️  Stopping Metro bundler..."
    kill $METRO_PID
fi

echo "✅ Build process completed!"