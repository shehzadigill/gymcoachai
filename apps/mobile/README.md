# GymCoach AI Mobile App

A comprehensive fitness tracking mobile application built with React Native and Expo, featuring real-time API integrations with AWS backend services.

## 🚀 Features

### **Dashboard**
- **Welcome Section**: Personalized greeting with user's name
- **Key Metrics**: Workouts completed, current streak, calories today, AI recommendations
- **Progress Overview**: Weekly workout progress with visual progress bars
- **Quick Actions**: Start workout, log nutrition, view analytics
- **Recent Activity**: Timeline of recent fitness activities
- **Achievements**: Display of earned fitness achievements

### **Workouts**
- **Workout Library**: Browse and manage workout routines
- **Workout Sessions**: Start, track, and complete workout sessions
- **Exercise Details**: View exercise instructions, sets, reps, and weights
- **Progress Tracking**: Track workout completion and duration
- **Statistics**: Total workouts, completed sessions, total time, weekly progress

### **Analytics**
- **Key Metrics**: Workouts this week, current streak, calories, total workouts
- **Weekly Activity Chart**: Visual representation of daily activity
- **Body Composition**: Weight, body fat percentage, muscle mass tracking
- **Achievements**: Recent fitness achievements and milestones
- **AI Recommendations**: Personalized fitness and nutrition advice

### **Nutrition**
- **Daily Overview**: Calories, protein, carbs, fat intake with progress bars
- **Water Intake**: Track daily water consumption
- **Meal Tracking**: Log breakfast, lunch, dinner, and snacks
- **Food Search**: Search and add food items
- **Macro Tracking**: Detailed macronutrient breakdown
- **Meal History**: View past nutrition entries

### **Profile**
- **Personal Information**: Name, email, date of birth, height, weight
- **Fitness Goals**: Set and manage fitness objectives
- **Experience Level**: Beginner, intermediate, or advanced
- **Preferences**: Units (metric/imperial), notification settings
- **Privacy Settings**: Control profile visibility and sharing

## 🛠 Technical Implementation

### **Architecture**
- **React Native**: Cross-platform mobile development
- **Expo**: Development platform and build tools
- **TypeScript**: Type-safe development
- **NativeWind**: Tailwind CSS for React Native
- **React Navigation**: Navigation between screens
- **React Query**: Data fetching and caching

### **API Integration**
- **Real API Endpoints**: Connected to AWS Lambda services
- **Authentication**: JWT token-based authentication with AWS Cognito
- **Error Handling**: Graceful fallbacks to mock data when APIs fail
- **Offline Support**: Local state management for immediate UI updates

### **State Management**
- **Local State**: React hooks for component state
- **API State**: React Query for server state management
- **User Context**: Global user authentication state
- **Secure Storage**: Expo SecureStore for token persistence

## 📱 Screens

### **1. Dashboard Screen** (`src/screens/DashboardScreen.tsx`)
- Displays key fitness metrics and progress
- Shows recent activity and achievements
- Provides quick action buttons
- Real-time data from analytics APIs

### **2. Workouts Screen** (`src/screens/WorkoutsScreen.tsx`)
- Lists all available workout routines
- Start and complete workout sessions
- View exercise details and instructions
- Track workout statistics

### **3. Analytics Screen** (`src/screens/AnalyticsScreen.tsx`)
- Visual progress charts and metrics
- Body composition tracking
- Achievement display
- AI recommendations

### **4. Nutrition Screen** (`src/screens/NutritionScreen.tsx`)
- Daily nutrition overview
- Meal logging and tracking
- Food search and addition
- Macro nutrient tracking

### **5. Profile Screen** (`src/screens/ProfileScreen.tsx`)
- Personal information management
- Fitness goals and preferences
- Settings and privacy controls
- Sign out functionality

## 🔧 Components

### **Reusable Components**
- **StatCard**: Display key metrics with icons and trends
- **LoadingSpinner**: Loading states with customizable messages
- **ErrorMessage**: Error display with retry functionality

### **Custom Hooks**
- **useApi**: Generic API fetching hook with error handling
- **useCurrentUser**: User authentication and profile management

## 🚀 Getting Started

### **Prerequisites**
- Node.js 18+ 
- Expo CLI
- iOS Simulator or Android Emulator (for testing)

### **Installation**
```bash
# Navigate to mobile app directory
cd apps/mobile

# Install dependencies
npm install

# Start development server
npm start
```

### **Environment Variables**
Create a `.env` file in the mobile app root:
```env
EXPO_PUBLIC_USER_POOL_ID=your_user_pool_id
EXPO_PUBLIC_USER_POOL_CLIENT_ID=your_client_id
EXPO_PUBLIC_AWS_REGION=eu-north-1
EXPO_PUBLIC_CLOUDFRONT_URL=https://your-cloudfront-url
```

### **Running the App**
```bash
# Start Expo development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run on web browser
npm run web
```

## 🔌 API Integration

### **Backend Services**
The mobile app integrates with the following AWS Lambda services:

- **User Profile Service**: `/api/user-profiles/profile`
- **Analytics Service**: `/api/analytics/*`
- **Workout Service**: `/api/workouts/sessions`
- **Nutrition Service**: `/api/users/{userId}/meals`

### **Authentication Flow**
1. User signs in with AWS Cognito
2. JWT token is stored securely using Expo SecureStore
3. Token is included in all API requests
4. Token is refreshed automatically when needed

### **Error Handling**
- API calls fail gracefully with fallback to mock data
- User-friendly error messages
- Retry functionality for failed requests
- Offline support with local state management

## 📊 Data Flow

### **Dashboard Data**
```typescript
// Fetches data from multiple APIs
const { data: workoutsData } = useApi('/api/analytics/strength-progress/me');
const { data: profileData } = useApi('/api/user-profiles/profile');
const { data: nutritionData } = useApi('/api/analytics/body-measurements/me');
```

### **Workout Management**
```typescript
// Fetch workout sessions
const { data: workoutsResponse } = useApi('/api/workouts/sessions');

// Complete workout
await apiFetch('/api/workouts/sessions', {
  method: 'PUT',
  body: JSON.stringify({ id, status: 'completed' })
});
```

### **Nutrition Tracking**
```typescript
// Fetch meals for today
const response = await apiFetch(`/api/users/${userId}/meals/date/${today}`);

// Add new meal
await apiFetch(`/api/users/${userId}/meals`, {
  method: 'POST',
  body: JSON.stringify(mealData)
});
```

## 🎨 UI/UX Features

### **Design System**
- **Consistent Styling**: Tailwind CSS classes for consistent design
- **Dark Mode Support**: Automatic theme switching
- **Responsive Layout**: Adapts to different screen sizes
- **Touch-Friendly**: Optimized for mobile interactions

### **Navigation**
- **Bottom Tab Navigation**: Easy access to main features
- **Stack Navigation**: Hierarchical screen navigation
- **Modal Presentations**: Full-screen modals for detailed views

### **User Experience**
- **Pull-to-Refresh**: Refresh data by pulling down
- **Loading States**: Smooth loading indicators
- **Error States**: Clear error messages with retry options
- **Offline Support**: Works without internet connection

## 🔒 Security

### **Authentication**
- **AWS Cognito**: Secure user authentication
- **JWT Tokens**: Secure API communication
- **Secure Storage**: Encrypted token storage
- **Auto-Refresh**: Automatic token renewal

### **Data Protection**
- **HTTPS Only**: All API calls use secure connections
- **Token Expiration**: Automatic token refresh
- **Secure Storage**: Sensitive data encrypted locally

## 📱 Platform Support

### **iOS**
- iOS 13.0+
- iPhone and iPad support
- Native iOS navigation patterns

### **Android**
- Android 6.0+ (API level 23)
- Material Design components
- Android-specific optimizations

### **Web**
- Modern web browsers
- Responsive web design
- PWA capabilities

## 🚀 Deployment

### **Development Build**
```bash
# Create development build
expo build:ios --type development
expo build:android --type development
```

### **Production Build**
```bash
# Create production build
expo build:ios --type production
expo build:android --type production
```

### **App Store Deployment**
1. Build production version
2. Submit to App Store Connect (iOS)
3. Submit to Google Play Console (Android)
4. Configure app store metadata
5. Release to users

## 🧪 Testing

### **Manual Testing**
- Test all screens and navigation
- Verify API integrations
- Test offline functionality
- Check error handling

### **Device Testing**
- Test on real iOS and Android devices
- Verify performance on different screen sizes
- Test with different network conditions

## 🔄 Updates and Maintenance

### **Code Updates**
- Regular dependency updates
- Bug fixes and improvements
- New feature additions
- Performance optimizations

### **API Updates**
- Backend service updates
- New API endpoints
- Schema changes
- Authentication updates

## 📈 Performance

### **Optimizations**
- **Lazy Loading**: Load screens only when needed
- **Image Optimization**: Optimized images for mobile
- **API Caching**: React Query for efficient data caching
- **Bundle Splitting**: Optimized JavaScript bundles

### **Monitoring**
- **Error Tracking**: Monitor app crashes and errors
- **Performance Metrics**: Track app performance
- **User Analytics**: Understand user behavior
- **API Monitoring**: Monitor backend service health

## 🎯 Future Enhancements

### **Planned Features**
- **Push Notifications**: Workout reminders and achievements
- **Social Features**: Share workouts and progress
- **Wearable Integration**: Apple Watch and Android Wear support
- **Advanced Analytics**: More detailed progress tracking
- **AI Coaching**: Personalized workout recommendations

### **Technical Improvements**
- **Offline Sync**: Better offline data synchronization
- **Performance**: Further performance optimizations
- **Accessibility**: Enhanced accessibility features
- **Testing**: Comprehensive test coverage

## 📞 Support

For technical support or questions:
- Check the documentation
- Review error logs
- Test with different network conditions
- Verify environment variables
- Check API service status

## 📄 License

This project is part of the GymCoach AI fitness platform. All rights reserved.

---

**Built with ❤️ using React Native, Expo, and AWS services.**
