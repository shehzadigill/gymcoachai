#!/bin/bash

# GymCoach AI Mobile App - Complete Setup Script
# This script will guide you through setting up your React Native mobile app

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Function to print colored output
print_header() {
    echo -e "\n${PURPLE}============================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}============================================${NC}\n"
}

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

print_step() {
    echo -e "\n${GREEN}📱 STEP $1:${NC} $2\n"
}

# Check if we're in the correct directory
if [ ! -f "package.json" ] || [ ! -d "src" ]; then
    print_error "Please run this script from the mobile app directory (apps/mobile)"
    exit 1
fi

print_header "🚀 GymCoach AI Mobile App Setup"

print_status "Welcome to your React Native mobile app setup!"
print_status "This script will guide you through the complete setup process."

# Step 1: Install Dependencies
print_step "1" "Installing Dependencies"

print_status "Installing npm dependencies..."
npm install

if [ $? -eq 0 ]; then
    print_success "Dependencies installed successfully!"
else
    print_error "Failed to install dependencies. Please check your internet connection."
    exit 1
fi

# Step 2: Environment Configuration
print_step "2" "Environment Configuration"

if [ ! -f ".env" ]; then
    print_warning ".env file not found. Creating template..."
    cat > .env << EOF
# API Configuration
API_BASE_URL=https://your-api-domain.com

# AWS Cognito Configuration
COGNITO_USER_POOL_ID=your_user_pool_id_here
COGNITO_CLIENT_ID=your_client_id_here
AWS_REGION=us-east-1

# Firebase Configuration (for push notifications)
FIREBASE_SERVER_KEY=your_firebase_server_key_here
FIREBASE_VAPID_KEY=your_vapid_key_here

# App Configuration
APP_ENV=development
DEBUG_MODE=true
EOF
    print_success ".env template created!"
else
    print_success ".env file already exists!"
fi

print_warning "📝 Please update the .env file with your actual values:"
print_status "   - API_BASE_URL: Your deployed backend API URL"
print_status "   - COGNITO_USER_POOL_ID: From your AWS Cognito setup"
print_status "   - COGNITO_CLIENT_ID: From your AWS Cognito setup"
print_status "   - AWS_REGION: Your AWS region (e.g., us-east-1)"

# Step 3: Firebase Setup
print_step "3" "Firebase Setup (Push Notifications)"

print_status "Firebase setup is required for push notifications."
print_status "Please follow these steps:"
print_status ""
print_status "1. Go to https://console.firebase.google.com/"
print_status "2. Create a new project or select existing project"
print_status "3. Enable Cloud Messaging in your Firebase project"
print_status "4. Download configuration files:"
print_status "   📁 For Android: google-services.json"
print_status "   📁 For iOS: GoogleService-Info.plist"
print_status ""
print_status "5. Place the files in the correct locations:"
print_status "   📁 android/app/google-services.json"
print_status "   📁 ios/GoogleService-Info.plist"

if [ -f "firebase-setup.md" ]; then
    print_status "📖 Detailed Firebase setup instructions are in firebase-setup.md"
else
    print_warning "Firebase setup guide not found. Creating basic instructions..."
    cat > firebase-setup.md << EOF
# Firebase Setup for Push Notifications

## Step 1: Create Firebase Project
1. Go to https://console.firebase.google.com/
2. Click "Create a project" or select existing project
3. Follow the setup wizard

## Step 2: Enable Cloud Messaging
1. In your Firebase project console
2. Go to "Project settings" (gear icon)
3. Navigate to "Cloud Messaging" tab
4. Note down your Server Key and Sender ID

## Step 3: Add Apps to Firebase
### For Android:
1. Click "Add app" → Android
2. Enter package name: com.gymcoachai.mobile
3. Download google-services.json
4. Place in android/app/google-services.json

### For iOS:
1. Click "Add app" → iOS
2. Enter Bundle ID: com.gymcoachai.mobile
3. Download GoogleService-Info.plist
4. Place in ios/GoogleService-Info.plist

## Step 4: Update Environment Variables
Update your .env file with:
- FIREBASE_SERVER_KEY=your_server_key_here
- FIREBASE_VAPID_KEY=your_vapid_key_here
EOF
    print_success "Firebase setup guide created in firebase-setup.md"
fi

# Step 4: Platform Setup Check
print_step "4" "Platform Requirements Check"

# Check for iOS requirements
if command -v xcodebuild &> /dev/null; then
    print_success "✅ Xcode is installed - iOS development ready"
else
    print_warning "⚠️  Xcode not found - iOS development not available"
    print_status "   Install Xcode from the Mac App Store for iOS development"
fi

# Check for Android requirements
if [ -n "$ANDROID_HOME" ]; then
    print_success "✅ Android SDK is configured - Android development ready"
else
    print_warning "⚠️  ANDROID_HOME not set - Android development not configured"
    print_status "   Install Android Studio and set ANDROID_HOME environment variable"
fi

# Check for React Native CLI
if command -v react-native &> /dev/null; then
    print_success "✅ React Native CLI is available"
else
    print_warning "⚠️  React Native CLI not found"
    print_status "   Installing React Native CLI globally..."
    npm install -g @react-native-community/cli
fi

# Step 5: Project Initialization
print_step "5" "Project Initialization"

print_status "Creating necessary directories and files..."

# Create iOS directory structure if needed
if [ ! -d "ios" ]; then
    print_status "Initializing iOS project structure..."
    npx react-native init TempProject --template react-native-template-typescript
    mv TempProject/ios ./
    rm -rf TempProject
    print_success "iOS project structure created"
fi

# Create Android directory structure if needed
if [ ! -d "android" ]; then
    print_status "Initializing Android project structure..."
    npx react-native init TempProject --template react-native-template-typescript
    mv TempProject/android ./
    rm -rf TempProject
    print_success "Android project structure created"
fi

# Step 6: Final Setup
print_step "6" "Final Configuration"

print_status "Running final setup commands..."

# Install iOS pods if on macOS
if [[ "$OSTYPE" == "darwin"* ]] && [ -d "ios" ]; then
    print_status "Installing iOS pods..."
    cd ios && pod install && cd ..
    print_success "iOS pods installed successfully"
fi

# Type checking
print_status "Running TypeScript type check..."
npx tsc --noEmit
if [ $? -eq 0 ]; then
    print_success "TypeScript compilation successful"
else
    print_warning "TypeScript warnings found - check your code"
fi

# Success Message
print_header "🎉 Setup Complete!"

print_success "Your GymCoach AI mobile app is now set up!"
print_status ""
print_status "📱 What's been configured:"
print_success "   ✅ Dependencies installed"
print_success "   ✅ Environment template created"
print_success "   ✅ Firebase setup guide provided"
print_success "   ✅ Platform requirements checked"
print_success "   ✅ Project structure initialized"
print_status ""
print_status "🚀 Next Steps:"
print_status "   1. Update your .env file with actual values"
print_status "   2. Complete Firebase setup (see firebase-setup.md)"
print_status "   3. Start the development server: npm start"
print_status "   4. Run on device/emulator:"
print_status "      📱 iOS: npm run ios"
print_status "      🤖 Android: npm run android"
print_status ""
print_status "📖 Available Commands:"
print_status "   npm start          - Start Metro bundler"
print_status "   npm run ios        - Run on iOS simulator"
print_status "   npm run android    - Run on Android emulator"
print_status "   npm run type-check - Check TypeScript types"
print_status "   npm run lint       - Run code linter"
print_status ""
print_status "🛠️  For production builds:"
print_status "   ./build.sh -p ios -t release     - Build iOS for App Store"
print_status "   ./build.sh -p android -t release - Build Android APK"
print_status ""
print_success "Happy coding! 🚀"

print_header "📱 Your Captivating Mobile App Features"

print_status "Your app includes these amazing features:"
print_success "   🎨 Beautiful Welcome Screen with animations"
print_success "   💪 Smooth Splash Screen with loading animation"
print_success "   🔐 Secure Authentication (Sign Up / Sign In)"
print_success "   📊 Complete Dashboard with metrics"
print_success "   💪 Workout tracking and exercise library"
print_success "   🥗 Nutrition logging and meal planning"
print_success "   📈 Analytics and progress tracking"
print_success "   👤 User profile and settings"
print_success "   🔔 Push notifications for reminders"
print_success "   📱 Native iOS and Android experience"
print_status ""
print_status "All screens are beautifully designed with smooth animations!"
print_status "Users will love the onboarding experience! 💝"