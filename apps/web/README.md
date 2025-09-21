# GymCoach AI - Web Frontend

A modern, responsive web application for fitness tracking and AI-powered coaching built with Next.js 14, TypeScript, and Tailwind CSS.

## Features

### 🏠 Dashboard

- **Welcome Section**: Personalized greeting with user's name
- **Key Metrics**: Workouts completed, current streak, calories today, AI recommendations
- **Progress Tracking**: Visual progress bars for weekly goals
- **Quick Actions**: Start workout, log nutrition, view analytics
- **Recent Activity**: Timeline of recent fitness activities
- **Achievements**: Display of earned fitness achievements

### 💪 Workouts

- **Workout Library**: Browse and manage workout routines
- **Workout Details**: Exercise lists with sets, reps, and instructions
- **Progress Tracking**: Track completed workouts and streaks
- **Statistics**: Total workouts, completion rate, total time
- **Quick Actions**: Start, complete, or repeat workouts

### 📊 Analytics

- **Performance Metrics**: Comprehensive fitness analytics
- **Progress Charts**: Visual representation of weekly activity
- **Body Composition**: Weight, body fat, muscle mass tracking
- **Achievement System**: Track and display fitness milestones
- **AI Recommendations**: Personalized insights and suggestions
- **Time Range Filters**: Week, month, year views

### 🍎 Nutrition

- **Food Logging**: Track daily food intake with detailed nutrition info
- **Macro Tracking**: Calories, protein, carbs, fat monitoring
- **Meal Organization**: Breakfast, lunch, dinner, snack categorization
- **Water Intake**: Track daily hydration goals
- **Search & Filter**: Find foods and filter by meal type
- **Nutrition Goals**: Set and track daily nutrition targets

### 👤 Profile

- **Personal Information**: Name, email, bio, date of birth
- **Physical Stats**: Height, weight tracking
- **Fitness Goals**: Experience level and goal setting
- **Preferences**: Units, timezone, notification settings
- **Privacy Settings**: Control data sharing and visibility

## Technology Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Authentication**: AWS Amplify with Cognito
- **State Management**: React hooks and context
- **API Integration**: Custom API client with JWT authentication
- **Theme**: Dark/Light mode support

## Project Structure

```
apps/web/
├── src/
│   ├── app/
│   │   ├── (dashboard)/          # Dashboard pages (protected)
│   │   │   ├── page.tsx         # Main dashboard
│   │   │   ├── layout.tsx       # Dashboard layout with sidebar
│   │   │   ├── workouts/        # Workout management
│   │   │   ├── analytics/       # Analytics and progress
│   │   │   ├── nutrition/       # Nutrition tracking
│   │   │   └── profile/         # User profile
│   │   ├── auth/                # Authentication pages
│   │   │   ├── signin/          # Sign in
│   │   │   └── signup/          # Sign up
│   │   ├── providers/           # Context providers
│   │   └── globals.css          # Global styles
│   ├── lib/
│   │   ├── api-client.ts        # API client with auth
│   │   └── auth-config.ts       # Auth configuration
│   └── middleware.ts            # Route protection
├── public/                      # Static assets
├── package.json
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- AWS Cognito User Pool configured
- Backend services deployed

### Installation

1. **Install dependencies**:

   ```bash
   pnpm install
   ```

2. **Environment Configuration**:
   Create `.env.local` file with:

   ```env
   NEXT_PUBLIC_USER_POOL_ID=your_user_pool_id
   NEXT_PUBLIC_USER_POOL_CLIENT_ID=your_client_id
   NEXT_PUBLIC_USER_POOL_DOMAIN=your_cognito_domain
   NEXT_PUBLIC_AWS_REGION=eu-north-1
   NEXT_PUBLIC_CLOUDFRONT_URL=your_cloudfront_url
   ```

3. **Start development server**:

   ```bash
   pnpm dev
   ```

4. **Open browser**:
   Navigate to `http://localhost:3000`

## API Integration

The frontend integrates with several backend services:

### Analytics Service

- **Strength Progress**: `/api/analytics/strength-progress/me`
- **Body Measurements**: `/api/analytics/body-measurements/me`
- **Milestones**: `/api/analytics/milestones/me`
- **Achievements**: `/api/analytics/achievements/me`

### User Profile Service

- **Get Profile**: `GET /api/user-profiles/profile`
- **Update Profile**: `PUT /api/user-profiles/profile`
- **Create Profile**: `POST /api/user-profiles/profile`

### Workout Service

- **Get Workouts**: `GET /api/workouts/me`
- **Create Workout**: `POST /api/workouts`
- **Complete Workout**: `POST /api/workouts/{id}/complete`

### Nutrition Service

- **Log Food**: `POST /api/nutrition/entries`
- **Get Entries**: `GET /api/nutrition/entries/me`
- **Update Entry**: `PUT /api/nutrition/entries/{id}`

## Authentication Flow

1. **Sign Up**: Users create accounts with email verification
2. **Sign In**: JWT token-based authentication
3. **Token Management**: Automatic token refresh and storage
4. **Route Protection**: Middleware protects dashboard routes
5. **API Authentication**: All API calls include JWT tokens

## Responsive Design

- **Mobile First**: Optimized for mobile devices
- **Breakpoints**: sm (640px), md (768px), lg (1024px), xl (1280px)
- **Sidebar**: Collapsible navigation on mobile
- **Touch Friendly**: Large touch targets and gestures

## Dark Mode

- **System Preference**: Automatically detects user's theme preference
- **Manual Toggle**: Theme switcher in header
- **Persistent**: Remembers user's choice
- **Components**: All components support both themes

## Error Handling

- **API Errors**: Graceful error handling with user-friendly messages
- **Loading States**: Skeleton loaders and spinners
- **Fallbacks**: Default values when data is unavailable
- **Retry Logic**: Automatic retry for failed requests

## Performance Optimizations

- **Code Splitting**: Automatic route-based code splitting
- **Image Optimization**: Next.js Image component
- **Caching**: API response caching with `no-store` for real-time data
- **Bundle Analysis**: Optimized bundle size

## Development

### Available Scripts

```bash
# Development
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm start        # Start production server
pnpm lint         # Run ESLint
pnpm type-check   # Run TypeScript checks
```

### Code Style

- **ESLint**: Configured with Next.js and TypeScript rules
- **Prettier**: Code formatting (if configured)
- **TypeScript**: Strict type checking enabled
- **Import Organization**: Absolute imports for cleaner code

## Deployment

### Build for Production

```bash
pnpm build
```

### Environment Variables

Ensure all required environment variables are set in production:

- `NEXT_PUBLIC_USER_POOL_ID`
- `NEXT_PUBLIC_USER_POOL_CLIENT_ID`
- `NEXT_PUBLIC_USER_POOL_DOMAIN`
- `NEXT_PUBLIC_AWS_REGION`
- `NEXT_PUBLIC_CLOUDFRONT_URL`

### Deployment Platforms

- **Vercel**: Recommended for Next.js applications
- **AWS Amplify**: For AWS ecosystem integration
- **Netlify**: Alternative deployment option

## Contributing

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit changes**: `git commit -m 'Add amazing feature'`
4. **Push to branch**: `git push origin feature/amazing-feature`
5. **Open Pull Request**

## Troubleshooting

### Common Issues

1. **Authentication Errors**:
   - Check environment variables
   - Verify Cognito configuration
   - Clear browser cache and cookies

2. **API Connection Issues**:
   - Verify CloudFront URL
   - Check network connectivity
   - Review browser console for errors

3. **Build Errors**:
   - Clear `.next` folder
   - Reinstall dependencies
   - Check TypeScript errors

### Debug Mode

Enable debug logging by setting:

```env
NEXT_PUBLIC_DEBUG=true
```

## License

This project is part of the GymCoach AI application suite.
