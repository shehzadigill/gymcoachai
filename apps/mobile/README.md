# GymCoach AI - Mobile App

A React Native mobile application for fitness tracking and AI-powered coaching with push notifications support.

## 🚀 Features

### Core Functionality

- **Authentication**: AWS Cognito integration with secure token management
- **Dashboard**: Overview of workouts, nutrition, and progress
- **Workouts**: Session tracking, exercise library, and workout plans
- **Nutrition**: Meal logging with macro tracking and water intake
- **Analytics**: Progress tracking, strength records, and achievements
- **Profile**: User settings and notification preferences

### Push Notifications

- **Nutrition Reminders**: Customizable meal logging reminders
- **Workout Reminders**: Scheduled workout notifications
- **Progress Updates**: Achievement and milestone notifications
- **Firebase Integration**: FCM for Android, APNs for iOS

### Technical Features

- **Offline Support**: Local data caching with AsyncStorage
- **API Integration**: Full integration with backend services
- **Error Handling**: Graceful error handling with user-friendly messages
- **Performance**: Optimized with React Query for data fetching
- **Security**: Secure token storage with React Native Keychain

## 🏗️ Architecture

### Technology Stack

- **Framework**: React Native CLI (not Expo)
- **Language**: TypeScript
- **Navigation**: React Navigation 6
- **State Management**: React Context + React Query
- **Authentication**: AWS Amplify + Cognito
- **Storage**: AsyncStorage + React Native Keychain
- **Push Notifications**: Firebase Cloud Messaging + React Native Push Notification
- **HTTP Client**: Fetch API with custom wrapper

### Project Structure

```
src/
├── components/           # Reusable UI components
│   └── common/          # Common components (Button, Card, etc.)
├── contexts/            # React contexts (Auth, Theme, etc.)
├── hooks/               # Custom React hooks
├── navigation/          # Navigation configuration
├── screens/             # Screen components
│   ├── auth/           # Authentication screens
│   ├── workout/        # Workout-related screens
│   └── nutrition/      # Nutrition-related screens
├── services/            # API client and external services
├── types/               # TypeScript type definitions
└── utils/               # Utility functions
```

## 🔧 Setup & Installation

### Prerequisites

- Node.js 18+
- React Native CLI
- Xcode (for iOS development)
- Android Studio (for Android development)
- Firebase account
- AWS account with Cognito setup

### Installation

1. **Clone and navigate to mobile app**:

   ```bash
   cd apps/mobile
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **iOS Setup**:

   ```bash
   cd ios && pod install && cd ..
   ```

4. **Android Setup**:
   - Ensure Android SDK and build tools are installed
   - Create debug keystore if needed

5. **Environment Configuration**:
   Create `.env` file:

   ```env
   API_BASE_URL=https://your-api-url.com
   COGNITO_USER_POOL_ID=your_user_pool_id
   COGNITO_CLIENT_ID=your_client_id
   AWS_REGION=your_region
   ```

6. **Firebase Setup**:
   - Follow instructions in `firebase-setup.md`
   - Add `google-services.json` (Android)
   - Add `GoogleService-Info.plist` (iOS)

### Running the App

**Start Metro bundler**:

```bash
npm start
```

**Run on iOS**:

```bash
npm run ios
```

**Run on Android**:

```bash
npm run android
```

## 📱 Push Notifications

### Features

- **Nutrition Reminders**: Configurable meal time reminders
- **Workout Notifications**: Scheduled workout alerts
- **Progress Updates**: Achievement notifications
- **Smart Scheduling**: Automatic notification scheduling based on user preferences

### Configuration

Users can configure notifications in the Profile screen:

- Enable/disable notification types
- Set custom meal reminder times
- Control notification frequency

### Implementation Details

- **Firebase Cloud Messaging** for Android
- **Apple Push Notification Service** for iOS
- **Local Notifications** for scheduled reminders
- **Background Processing** for notification handling

## 🔌 API Integration

### Backend Services

The mobile app integrates with the following backend services:

- **User Profile Service**: `/api/user-profiles/*`
- **Analytics Service**: `/api/analytics/*`
- **Workout Service**: `/api/workouts/*`
- **Nutrition Service**: `/api/nutrition/*`

### Authentication Flow

1. User signs in with AWS Cognito
2. JWT token is stored securely
3. Token is included in all API requests
4. Automatic token refresh when expired

### Error Handling

- Network error recovery
- Token refresh on 401 errors
- User-friendly error messages
- Offline data fallbacks

## 🎨 UI/UX Design

### Design System

- **Colors**: Blue primary (#3b82f6), consistent with web app
- **Typography**: System fonts with proper scaling
- **Spacing**: 4px grid system
- **Components**: Reusable design components

### Accessibility

- Screen reader support
- High contrast mode
- Large text support
- Touch target sizing

### Responsive Design

- Portrait and landscape support
- Different screen sizes (phones, tablets)
- Safe area handling
- Keyboard avoidance

## 🧪 Testing

### Unit Tests

```bash
npm test
```

### End-to-End Tests

```bash
npm run test:e2e
```

### Manual Testing Checklist

- [ ] Authentication flow
- [ ] Navigation between screens
- [ ] API data loading
- [ ] Push notification receiving
- [ ] Offline functionality
- [ ] Error handling

## 📦 Building & Deployment

### Debug Builds

- Automatic when running with `npm run android/ios`
- Includes debugging tools and logging

### Release Builds

**Android**:

```bash
cd android && ./gradlew assembleRelease
```

**iOS**:

1. Open `ios/mobile.xcworkspace` in Xcode
2. Select "mobile" scheme
3. Product → Archive
4. Follow App Store distribution process

### App Store Submission

- Follow platform-specific guidelines
- Ensure push notification permissions are properly requested
- Include proper app descriptions and screenshots

## 🔐 Security

### Data Protection

- Sensitive data encrypted at rest
- Secure HTTP communication (HTTPS only)
- Token storage in secure keychain
- No sensitive data in logs

### Permissions

- Camera: Progress photos
- Photo Library: Saving images
- Notifications: Push notifications
- Network: API communication

## 🐛 Troubleshooting

### Common Issues

**Metro bundler issues**:

```bash
npm start -- --reset-cache
```

**iOS build issues**:

```bash
cd ios && pod install && cd ..
```

**Android build issues**:

```bash
cd android && ./gradlew clean && cd ..
```

**Push notifications not working**:

- Check Firebase configuration
- Verify device registration
- Test with Firebase Console

### Logs and Debugging

- Use React Native Debugger
- Check device logs in Xcode/Android Studio
- Enable network request logging
- Use Flipper for advanced debugging

## 🤝 Contributing

1. Follow TypeScript best practices
2. Use existing component patterns
3. Add proper error handling
4. Update documentation
5. Test on both platforms

## 📄 License

This project is part of the GymCoach AI application suite.
