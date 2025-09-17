# GymCoach AI API Documentation

This directory contains the comprehensive API documentation for all GymCoach AI services.

## API Overview

The GymCoach AI API is a RESTful API built with Rust Lambda functions and provides comprehensive fitness coaching capabilities including:

- **User Profile Management** - User profiles, preferences, and statistics
- **Workout Management** - Workout plans, sessions, exercises, and progress tracking
- **Coaching Engine** - AI-powered recommendations and adaptive planning
- **Progress Analytics** - Strength tracking, body measurements, and performance analysis
- **Nutrition Management** - Meal planning, nutrition tracking, and dietary recommendations
- **AI Services** - Machine learning models for personalized coaching

## API Architecture

### Base URLs

- **Production**: `https://api.gymcoach-ai.com`
- **Staging**: `https://staging-api.gymcoach-ai.com`

### Authentication

All API endpoints require authentication using JWT tokens obtained from the authentication service.

```http
Authorization: Bearer <jwt_token>
```

### Rate Limiting

API requests are rate limited per user and endpoint:

- **Authentication endpoints**: 5 requests/minute, 20/hour, 100/day
- **API endpoints**: 60 requests/minute, 1000/hour, 10000/day
- **File uploads**: 10 requests/minute, 100/hour, 500/day

### Response Format

All API responses follow a consistent format:

```json
{
  "data": { ... },
  "meta": {
    "requestId": "req123",
    "timestamp": "2024-01-01T00:00:00Z",
    "version": "1.0.0"
  }
}
```

### Error Handling

Errors are returned with appropriate HTTP status codes and detailed error information:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data provided",
    "details": {
      "field": "email",
      "reason": "Invalid email format"
    }
  },
  "meta": {
    "requestId": "req123",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

## Service Documentation

### 1. User Profile Service

**File**: `user-profile-service.yaml`

Manages user profiles, preferences, and statistics.

**Key Endpoints**:

- `POST /api/user-profiles` - Create user profile
- `GET /api/user-profiles/{userId}` - Get user profile
- `PUT /api/user-profiles/{userId}` - Update user profile
- `DELETE /api/user-profiles/{userId}` - Delete user profile
- `GET /api/user-profiles/{userId}/preferences` - Get user preferences
- `PUT /api/user-profiles/{userId}/preferences` - Update user preferences
- `GET /api/user-profiles/{userId}/stats` - Get user statistics
- `POST /api/user-profiles/{userId}/upload` - Generate upload URL

### 2. Workout Service

**File**: `workout-service.yaml`

Manages workout plans, sessions, exercises, and progress photos.

**Key Endpoints**:

- `POST /api/workouts/plans` - Create workout plan
- `GET /api/workouts/plans` - List workout plans
- `GET /api/workouts/plans/{planId}` - Get workout plan
- `PUT /api/workouts/plans/{planId}` - Update workout plan
- `DELETE /api/workouts/plans/{planId}` - Delete workout plan
- `POST /api/workouts/sessions` - Create workout session
- `GET /api/workouts/sessions` - List workout sessions
- `GET /api/workouts/sessions/{sessionId}` - Get workout session
- `GET /api/workouts/exercises` - List exercises
- `GET /api/workouts/exercises/{exerciseId}` - Get exercise
- `POST /api/workouts/progress-photos` - Upload progress photo
- `GET /api/workouts/progress-photos` - List progress photos
- `GET /api/workouts/progress-photos/{photoId}` - Get progress photo
- `DELETE /api/workouts/progress-photos/{photoId}` - Delete progress photo

### 3. Coaching Service

**File**: `coaching-service.yaml`

Provides AI-powered coaching recommendations and adaptive planning.

**Key Endpoints**:

- `POST /api/coaching/recommendations` - Create recommendation
- `GET /api/coaching/recommendations` - List recommendations
- `GET /api/coaching/recommendations/{id}` - Get recommendation
- `PUT /api/coaching/recommendations/{id}` - Update recommendation
- `DELETE /api/coaching/recommendations/{id}` - Delete recommendation
- `POST /api/coaching/recommendations/generate` - Generate AI recommendations
- `POST /api/coaching/adaptive-planning` - Create adaptive plan
- `GET /api/coaching/adaptive-planning/{id}` - Get adaptive plan
- `PUT /api/coaching/adaptive-planning/{id}` - Update adaptive plan
- `POST /api/coaching/exercise-substitutions` - Get exercise substitutions
- `POST /api/coaching/recovery-calculations` - Calculate recovery needs
- `POST /api/coaching/difficulty-adjustments` - Adjust workout difficulty

### 4. Analytics Service

**File**: `analytics-service.yaml`

Provides progress tracking, analytics, and performance insights.

**Key Endpoints**:

- `POST /api/analytics/strength-progress` - Record strength progress
- `GET /api/analytics/strength-progress/{userId}` - Get strength progress
- `POST /api/analytics/body-measurements` - Record body measurements
- `GET /api/analytics/body-measurements/{userId}` - Get body measurements
- `GET /api/analytics/progress-charts/{userId}` - Get progress charts
- `POST /api/analytics/milestones` - Create milestone
- `GET /api/analytics/milestones/{userId}` - Get milestones
- `PUT /api/analytics/milestones/{id}` - Update milestone
- `DELETE /api/analytics/milestones/{id}` - Delete milestone
- `GET /api/analytics/performance-trends/{userId}` - Get performance trends
- `GET /api/analytics/workout-analytics/{userId}` - Get workout analytics

### 5. Nutrition Service

**File**: `nutrition-service.yaml`

Manages nutrition tracking, meal planning, and dietary recommendations.

**Key Endpoints**:

- `POST /api/nutrition/meals` - Create meal
- `GET /api/nutrition/meals` - List meals
- `GET /api/nutrition/meals/{id}` - Get meal
- `PUT /api/nutrition/meals/{id}` - Update meal
- `DELETE /api/nutrition/meals/{id}` - Delete meal
- `POST /api/nutrition/meal-plans` - Create meal plan
- `GET /api/nutrition/meal-plans` - List meal plans
- `GET /api/nutrition/meal-plans/{id}` - Get meal plan
- `PUT /api/nutrition/meal-plans/{id}` - Update meal plan
- `DELETE /api/nutrition/meal-plans/{id}` - Delete meal plan
- `POST /api/nutrition/nutrition-tracking` - Record nutrition data
- `GET /api/nutrition/nutrition-tracking/{userId}` - Get nutrition tracking
- `GET /api/nutrition/dietary-recommendations/{userId}` - Get dietary recommendations

### 6. AI Service

**File**: `ai-service.yaml`

Provides AI-powered features and machine learning capabilities.

**Key Endpoints**:

- `POST /api/ai/personalized-recommendations` - Get personalized recommendations
- `POST /api/ai/form-analysis` - Analyze exercise form
- `POST /api/ai/progress-prediction` - Predict progress
- `POST /api/ai/injury-prevention` - Get injury prevention advice
- `POST /api/ai/nutrition-optimization` - Optimize nutrition
- `POST /api/ai/goal-setting` - Set and adjust goals
- `POST /api/ai/motivation-coaching` - Get motivation coaching
- `POST /api/ai/social-features` - Social features and challenges

## Data Models

### Common Models

#### User

```json
{
  "userId": "string",
  "email": "string",
  "name": "string",
  "fitnessGoals": "string",
  "experienceLevel": "string",
  "preferences": { ... },
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

#### Workout Plan

```json
{
  "id": "string",
  "userId": "string",
  "name": "string",
  "description": "string",
  "difficulty": "string",
  "durationWeeks": "integer",
  "frequencyPerWeek": "integer",
  "exercises": [ ... ],
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

#### Workout Session

```json
{
  "id": "string",
  "userId": "string",
  "workoutPlanId": "string",
  "name": "string",
  "exercises": [ ... ],
  "startedAt": "datetime",
  "completedAt": "datetime",
  "totalDuration": "integer",
  "notes": "string",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

#### Exercise

```json
{
  "id": "string",
  "name": "string",
  "description": "string",
  "category": "string",
  "muscleGroup": "string",
  "equipment": "string",
  "difficulty": "string",
  "instructions": [ ... ],
  "tips": [ ... ],
  "videoUrl": "string",
  "imageUrl": "string",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

## SDKs and Client Libraries

### JavaScript/TypeScript

```bash
npm install @gymcoach-ai/sdk
```

```typescript
import { GymCoachAI } from '@gymcoach-ai/sdk';

const client = new GymCoachAI({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.gymcoach-ai.com',
});

// Create user profile
const profile = await client.userProfiles.create({
  userId: 'user123',
  email: 'user@example.com',
  name: 'John Doe',
  fitnessGoals: 'Build muscle',
  experienceLevel: 'beginner',
});
```

### Python

```bash
pip install gymcoach-ai
```

```python
from gymcoach_ai import GymCoachAI

client = GymCoachAI(
    api_key='your-api-key',
    base_url='https://api.gymcoach-ai.com'
)

# Create user profile
profile = client.user_profiles.create(
    user_id='user123',
    email='user@example.com',
    name='John Doe',
    fitness_goals='Build muscle',
    experience_level='beginner'
)
```

### Swift (iOS)

```swift
import GymCoachAI

let client = GymCoachAI(apiKey: "your-api-key")

// Create user profile
let profile = try await client.userProfiles.create(
    userId: "user123",
    email: "user@example.com",
    name: "John Doe",
    fitnessGoals: "Build muscle",
    experienceLevel: "beginner"
)
```

### Kotlin (Android)

```kotlin
import com.gymcoachai.GymCoachAI

val client = GymCoachAI(apiKey = "your-api-key")

// Create user profile
val profile = client.userProfiles.create(
    userId = "user123",
    email = "user@example.com",
    name = "John Doe",
    fitnessGoals = "Build muscle",
    experienceLevel = "beginner"
)
```

## Testing

### Postman Collection

Download the Postman collection for testing all API endpoints:
[Download Collection](postman-collection.json)

### cURL Examples

```bash
# Create user profile
curl -X POST https://api.gymcoach-ai.com/api/user-profiles \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "email": "user@example.com",
    "name": "John Doe",
    "fitnessGoals": "Build muscle",
    "experienceLevel": "beginner"
  }'

# Get user profile
curl -X GET https://api.gymcoach-ai.com/api/user-profiles/user123 \
  -H "Authorization: Bearer your-jwt-token"
```

## Support

### Documentation

- **API Reference**: [https://docs.gymcoach-ai.com](https://docs.gymcoach-ai.com)
- **SDK Documentation**: [https://sdk.gymcoach-ai.com](https://sdk.gymcoach-ai.com)
- **Tutorials**: [https://tutorials.gymcoach-ai.com](https://tutorials.gymcoach-ai.com)

### Community

- **GitHub**: [https://github.com/gymcoach-ai](https://github.com/gymcoach-ai)
- **Discord**: [https://discord.gg/gymcoach-ai](https://discord.gg/gymcoach-ai)
- **Stack Overflow**: Tag questions with `gymcoach-ai`

### Support

- **Email**: support@gymcoach-ai.com
- **Status Page**: [https://status.gymcoach-ai.com](https://status.gymcoach-ai.com)
- **Issue Tracker**: [https://github.com/gymcoach-ai/issues](https://github.com/gymcoach-ai/issues)

## Changelog

### Version 1.0.0 (2024-01-01)

- Initial release
- User profile management
- Workout plan and session management
- Exercise library
- Progress photo tracking
- AI-powered recommendations
- Analytics and reporting
- Nutrition tracking
- Mobile SDKs for iOS and Android
