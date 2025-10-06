#!/bin/bash

# GymCoach AI Mobile App - Build & Deploy Script
# This script handles building and deploying the React Native mobile app

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the mobile app directory
if [ ! -f "package.json" ] || [ ! -d "src" ]; then
    print_error "Please run this script from the mobile app directory (apps/mobile)"
    exit 1
fi

# Parse command line arguments
PLATFORM=""
BUILD_TYPE="debug"
CLEAN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--platform)
            PLATFORM="$2"
            shift 2
            ;;
        -t|--type)
            BUILD_TYPE="$2"
            shift 2
            ;;
        -c|--clean)
            CLEAN=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  -p, --platform    Target platform (ios|android|both)"
            echo "  -t, --type        Build type (debug|release)"
            echo "  -c, --clean       Clean build directories first"
            echo "  -h, --help        Show this help message"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Validate platform
if [ -z "$PLATFORM" ]; then
    print_error "Platform is required. Use -p ios, -p android, or -p both"
    exit 1
fi

if [ "$PLATFORM" != "ios" ] && [ "$PLATFORM" != "android" ] && [ "$PLATFORM" != "both" ]; then
    print_error "Platform must be 'ios', 'android', or 'both'"
    exit 1
fi

# Validate build type
if [ "$BUILD_TYPE" != "debug" ] && [ "$BUILD_TYPE" != "release" ]; then
    print_error "Build type must be 'debug' or 'release'"
    exit 1
fi

print_status "Starting GymCoach AI Mobile App build process..."
print_status "Platform: $PLATFORM"
print_status "Build Type: $BUILD_TYPE"
print_status "Clean Build: $CLEAN"

# Check dependencies
print_status "Checking dependencies..."
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    print_error "npm is not installed"
    exit 1
fi

# Install dependencies
print_status "Installing npm dependencies..."
npm install

# Clean if requested
if [ "$CLEAN" = true ]; then
    print_status "Cleaning build directories..."
    
    # Clean Metro cache
    print_status "Cleaning Metro cache..."
    npx react-native start --reset-cache &
    METRO_PID=$!
    sleep 3
    kill $METRO_PID 2>/dev/null || true
    
    if [ "$PLATFORM" = "ios" ] || [ "$PLATFORM" = "both" ]; then
        if [ -d "ios" ]; then
            print_status "Cleaning iOS build..."
            cd ios
            xcodebuild clean -workspace mobile.xcworkspace -scheme mobile || true
            rm -rf build/
            rm -rf DerivedData/
            cd ..
        fi
    fi
    
    if [ "$PLATFORM" = "android" ] || [ "$PLATFORM" = "both" ]; then
        if [ -d "android" ]; then
            print_status "Cleaning Android build..."
            cd android
            ./gradlew clean || true
            cd ..
        fi
    fi
fi

# Check environment variables
print_status "Checking environment configuration..."
if [ ! -f ".env" ]; then
    print_warning ".env file not found. Creating template..."
    cat > .env << EOF
# API Configuration
API_BASE_URL=https://your-api-url.com

# AWS Cognito Configuration
COGNITO_USER_POOL_ID=your_user_pool_id
COGNITO_CLIENT_ID=your_client_id
AWS_REGION=your_region

# Firebase Configuration (for push notifications)
FIREBASE_SERVER_KEY=your_server_key_here
FIREBASE_VAPID_KEY=your_vapid_key_here
EOF
    print_warning "Please configure .env file before building"
fi

# Build iOS
build_ios() {
    print_status "Building iOS app..."
    
    # Check if Xcode is available
    if ! command -v xcodebuild &> /dev/null; then
        print_error "Xcode is not installed or xcodebuild is not in PATH"
        return 1
    fi
    
    # Install pods
    print_status "Installing iOS pods..."
    cd ios
    pod install
    cd ..
    
    # Build
    if [ "$BUILD_TYPE" = "release" ]; then
        print_status "Building iOS release..."
        npx react-native run-ios --configuration Release
    else
        print_status "Building iOS debug..."
        npx react-native run-ios
    fi
    
    print_success "iOS build completed!"
}

# Build Android
build_android() {
    print_status "Building Android app..."
    
    # Check if Android SDK is available
    if [ -z "$ANDROID_HOME" ]; then
        print_error "ANDROID_HOME environment variable is not set"
        return 1
    fi
    
    # Build
    if [ "$BUILD_TYPE" = "release" ]; then
        print_status "Building Android release..."
        cd android
        ./gradlew assembleRelease
        cd ..
        
        APK_PATH="android/app/build/outputs/apk/release/app-release.apk"
        if [ -f "$APK_PATH" ]; then
            print_success "Android release APK created: $APK_PATH"
        fi
    else
        print_status "Building Android debug..."
        npx react-native run-android
    fi
    
    print_success "Android build completed!"
}

# Start Metro bundler in background
print_status "Starting Metro bundler..."
npx react-native start &
METRO_PID=$!

# Wait for Metro to start
sleep 5

# Build based on platform
case $PLATFORM in
    ios)
        build_ios
        ;;
    android)
        build_android
        ;;
    both)
        build_ios
        build_android
        ;;
esac

# Stop Metro bundler
print_status "Stopping Metro bundler..."
kill $METRO_PID 2>/dev/null || true

print_success "Build process completed successfully!"

# Additional information
print_status "Next steps:"
if [ "$BUILD_TYPE" = "release" ]; then
    print_status "- For iOS: Open Xcode and archive for App Store distribution"
    print_status "- For Android: Upload APK to Google Play Console"
else
    print_status "- App should be running on your connected device/emulator"
    print_status "- Check the device for any errors or issues"
fi

print_status "Logs and debugging:"
print_status "- Use 'npx react-native log-android' for Android logs"
print_status "- Use 'npx react-native log-ios' for iOS logs"
print_status "- Use React Native Debugger for advanced debugging"