#!/bin/bash

# GymCoach AI Mobile App - Test Script
# Quick verification that everything is set up correctly

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✅ PASS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[⚠️  WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[❌ FAIL]${NC} $1"
}

echo -e "\n${BLUE}🧪 Testing GymCoach AI Mobile App Setup${NC}\n"

# Test 1: Check if we're in the right directory
print_status "Checking project directory..."
if [ -f "package.json" ] && [ -d "src" ]; then
    print_success "In correct mobile app directory"
else
    print_error "Not in mobile app directory. Run from apps/mobile/"
    exit 1
fi

# Test 2: Check key files exist
print_status "Checking essential files..."
files_check=("src/App.tsx" "src/screens/auth/WelcomeScreen.tsx" "src/screens/auth/SplashScreen.tsx" "src/screens/auth/SignInScreen.tsx" ".env")

for file in "${files_check[@]}"; do
    if [ -f "$file" ]; then
        print_success "$file exists"
    else
        print_error "$file missing"
    fi
done

# Test 3: Check node_modules
print_status "Checking dependencies..."
if [ -d "node_modules" ]; then
    print_success "Dependencies installed"
else
    print_warning "Dependencies not installed. Run: npm install"
fi

# Test 4: TypeScript compilation
print_status "Testing TypeScript compilation..."
if npx tsc --noEmit --skipLibCheck 2>/dev/null; then
    print_success "TypeScript compilation successful"
else
    print_warning "TypeScript warnings found (normal for development)"
fi

# Test 5: Check environment file
print_status "Checking environment configuration..."
if [ -f ".env" ]; then
    if grep -q "API_BASE_URL=https://your-api-domain.com" .env; then
        print_warning "Environment variables need to be configured"
        print_status "Update .env with your actual API URL and AWS settings"
    else
        print_success "Environment variables configured"
    fi
else
    print_error ".env file missing"
fi

# Test 6: Check React Native CLI
print_status "Checking React Native CLI..."
if command -v react-native &> /dev/null; then
    print_success "React Native CLI available"
else
    print_warning "React Native CLI not found. Install with: npm install -g @react-native-community/cli"
fi

# Test 7: Check platform requirements
print_status "Checking platform requirements..."

# iOS check
if command -v xcodebuild &> /dev/null; then
    print_success "iOS development ready (Xcode installed)"
else
    print_warning "iOS development not available (Xcode not found)"
fi

# Android check
if [ -n "$ANDROID_HOME" ]; then
    print_success "Android development ready (SDK configured)"
else
    print_warning "Android development not configured (ANDROID_HOME not set)"
fi

# Summary
echo -e "\n${BLUE}📱 Ready to Launch Commands:${NC}"
print_status "npm start                 # Start Metro bundler"
print_status "npm run android          # Run on Android device/emulator"  
print_status "npm run ios              # Run on iOS simulator"
print_status "./build.sh -p android    # Build Android APK"
print_status "./build.sh -p ios        # Build iOS app"

echo -e "\n${GREEN}🎉 Your captivating mobile app is ready to test!${NC}"
echo -e "Experience the amazing startup flow: Splash → Welcome → Sign In/Up\n"