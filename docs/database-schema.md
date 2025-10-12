# GymCoach AI Database Schema Design

## Overview

This document outlines the DynamoDB single-table design for the GymCoach AI application. The design follows DynamoDB best practices for single-table design, optimizing for access patterns while maintaining data consistency and performance.

## Table Structure

### Primary Table: `gymcoach-ai-main`

**Primary Key:**

- Partition Key (PK): String
- Sort Key (SK): String

**Global Secondary Indexes:**

- GSI1: GSI1PK (String), GSI1SK (String)
- GSI2: GSI2PK (String), GSI2SK (String)

## Access Patterns

### 1. User Management

- **Create User Profile**: PK=USER#{userId}, SK=PROFILE#{userId}
- **Get User Profile**: PK=USER#{userId}, SK=PROFILE#{userId}
- **Update User Profile**: PK=USER#{userId}, SK=PROFILE#{userId}
- **Delete User Profile**: PK=USER#{userId}, SK=PROFILE#{userId}

### 2. Workout Plans

- **Create Workout Plan**: PK=WORKOUT_PLANS, SK=PLAN#{planId}
- **Get Workout Plan**: PK=WORKOUT_PLANS, SK=PLAN#{planId}
- **List User Workout Plans**: PK=WORKOUT_PLANS, FilterExpression=userId=:userId
- **Update Workout Plan**: PK=WORKOUT_PLANS, SK=PLAN#{planId}
- **Delete Workout Plan**: PK=WORKOUT_PLANS, SK=PLAN#{planId}

### 3. Workout Sessions

- **Create Workout Session**: PK=WORKOUT_SESSIONS, SK=SESSION#{sessionId}
- **Get Workout Session**: PK=WORKOUT_SESSIONS, SK=SESSION#{sessionId}
- **List User Workout Sessions**: PK=WORKOUT_SESSIONS, FilterExpression=userId=:userId
- **Update Workout Session**: PK=WORKOUT_SESSIONS, SK=SESSION#{sessionId}
- **Delete Workout Session**: PK=WORKOUT_SESSIONS, SK=SESSION#{sessionId}

### 4. Exercise Library

- **Create Exercise**: PK=EXERCISES, SK=EXERCISE#{exerciseId}
- **Get Exercise**: PK=EXERCISES, SK=EXERCISE#{exerciseId}
- **List All Exercises**: PK=EXERCISES
- **Update Exercise**: PK=EXERCISES, SK=EXERCISE#{exerciseId}
- **Delete Exercise**: PK=EXERCISES, SK=EXERCISE#{exerciseId}

### 5. Progress Photos

- **Create Progress Photo**: PK=PROGRESS_PHOTOS, SK=PHOTO#{photoId}
- **Get Progress Photo**: PK=PROGRESS_PHOTOS, SK=PHOTO#{photoId}
- **List User Progress Photos**: PK=PROGRESS_PHOTOS, FilterExpression=userId=:userId
- **Delete Progress Photo**: PK=PROGRESS_PHOTOS, SK=PHOTO#{photoId}

### 6. Workout Recommendations

- **Create Recommendation**: PK=WORKOUT_RECOMMENDATIONS, SK=RECOMMENDATION#{recommendationId}
- **Get User Recommendations**: PK=WORKOUT_RECOMMENDATIONS, FilterExpression=userId=:userId
- **Update Recommendation**: PK=WORKOUT_RECOMMENDATIONS, SK=RECOMMENDATION#{recommendationId}
- **Delete Recommendation**: PK=WORKOUT_RECOMMENDATIONS, SK=RECOMMENDATION#{recommendationId}

### 7. Adaptive Plans

- **Create Adaptive Plan**: PK=ADAPTIVE_PLANS, SK=PLAN#{planId}
- **Get User Adaptive Plans**: PK=ADAPTIVE_PLANS, FilterExpression=userId=:userId
- **Update Adaptive Plan**: PK=ADAPTIVE_PLANS, SK=PLAN#{planId}
- **Delete Adaptive Plan**: PK=ADAPTIVE_PLANS, SK=PLAN#{planId}

### 8. Exercise Substitutions

- **Create Substitution**: PK=EXERCISE_SUBSTITUTIONS, SK=SUBSTITUTION#{substitutionId}
- **Get User Substitutions**: PK=EXERCISE_SUBSTITUTIONS, FilterExpression=userId=:userId
- **Update Substitution**: PK=EXERCISE_SUBSTITUTIONS, SK=SUBSTITUTION#{substitutionId}
- **Delete Substitution**: PK=EXERCISE_SUBSTITUTIONS, SK=SUBSTITUTION#{substitutionId}

### 9. Recovery Plans

- **Create Recovery Plan**: PK=RECOVERY_PLANS, SK=PLAN#{planId}
- **Get User Recovery Plans**: PK=RECOVERY_PLANS, FilterExpression=userId=:userId
- **Update Recovery Plan**: PK=RECOVERY_PLANS, SK=PLAN#{planId}
- **Delete Recovery Plan**: PK=RECOVERY_PLANS, SK=PLAN#{planId}

### 10. User Fitness Profiles

- **Create Fitness Profile**: PK=USER_FITNESS_PROFILES, SK=PROFILE#{userId}
- **Get Fitness Profile**: PK=USER_FITNESS_PROFILES, SK=PROFILE#{userId}
- **Update Fitness Profile**: PK=USER_FITNESS_PROFILES, SK=PROFILE#{userId}
- **Delete Fitness Profile**: PK=USER_FITNESS_PROFILES, SK=PROFILE#{userId}

### 11. Coaching Rules

- **Create Coaching Rule**: PK=COACHING_RULES, SK=RULE#{ruleId}
- **Get All Coaching Rules**: PK=COACHING_RULES
- **Update Coaching Rule**: PK=COACHING_RULES, SK=RULE#{ruleId}
- **Delete Coaching Rule**: PK=COACHING_RULES, SK=RULE#{ruleId}

### 12. Progress Metrics

- **Create Progress Metrics**: PK=PROGRESS_METRICS, SK=METRICS#{userId}#{period}
- **Get User Progress Metrics**: PK=PROGRESS_METRICS, FilterExpression=userId=:userId
- **Update Progress Metrics**: PK=PROGRESS_METRICS, SK=METRICS#{userId}#{period}
- **Delete Progress Metrics**: PK=PROGRESS_METRICS, SK=METRICS#{userId}#{period}

### 13. Strength Progress

- **Create Strength Progress**: PK=STRENGTH_PROGRESS, SK=USER#{userId}#{date}
- **Get User Strength Progress**: PK=STRENGTH_PROGRESS, FilterExpression=userId=:userId
- **Get Strength Progress by Date Range**: PK=STRENGTH_PROGRESS, SK BETWEEN :start AND :end
- **Update Strength Progress**: PK=STRENGTH_PROGRESS, SK=USER#{userId}#{date}
- **Delete Strength Progress**: PK=STRENGTH_PROGRESS, SK=USER#{userId}#{date}

### 14. Body Measurements

- **Create Body Measurement**: PK=BODY_MEASUREMENTS, SK=USER#{userId}#{date}
- **Get User Body Measurements**: PK=BODY_MEASUREMENTS, FilterExpression=userId=:userId
- **Get Body Measurements by Date Range**: PK=BODY_MEASUREMENTS, SK BETWEEN :start AND :end
- **Update Body Measurement**: PK=BODY_MEASUREMENTS, SK=USER#{userId}#{date}
- **Delete Body Measurement**: PK=BODY_MEASUREMENTS, SK=USER#{userId}#{date}

### 15. Progress Charts

- **Create Progress Chart**: PK=PROGRESS_CHARTS, SK=CHART#{chartId}
- **Get User Progress Charts**: PK=PROGRESS_CHARTS, FilterExpression=userId=:userId
- **Update Progress Chart**: PK=PROGRESS_CHARTS, SK=CHART#{chartId}
- **Delete Progress Chart**: PK=PROGRESS_CHARTS, SK=CHART#{chartId}

### 16. Milestones

- **Create Milestone**: PK=MILESTONES, SK=MILESTONE#{milestoneId}
- **Get User Milestones**: PK=MILESTONES, FilterExpression=userId=:userId
- **Update Milestone**: PK=MILESTONES, SK=MILESTONE#{milestoneId}
- **Delete Milestone**: PK=MILESTONES, SK=MILESTONE#{milestoneId}

### 18. Device Tokens

- **Create Device Token**: PK=USER#{userId}, SK=DEVICE#{deviceId}
- **Get User Devices**: PK=USER#{userId}, FilterExpression=begins_with(SK, "DEVICE#")
- **Update Device Token**: PK=USER#{userId}, SK=DEVICE#{deviceId}
- **Delete Device Token**: PK=USER#{userId}, SK=DEVICE#{deviceId}

### 19. Notification History

- **Create Notification Record**: PK=NOTIFICATION#{notificationId}, SK=USER#{userId}
- **Get User Notifications**: PK=NOTIFICATION#{notificationId}, FilterExpression=SK=USER#{userId}
- **Get Notification by ID**: PK=NOTIFICATION#{notificationId}, SK=USER#{userId}
- **Delete Notification Record**: PK=NOTIFICATION#{notificationId}, SK=USER#{userId} (TTL)

### 20. Notification Preferences

- **Create Notification Preferences**: PK=USER#{userId}, SK=NOTIFICATION_PREFERENCES
- **Get Notification Preferences**: PK=USER#{userId}, SK=NOTIFICATION_PREFERENCES
- **Update Notification Preferences**: PK=USER#{userId}, SK=NOTIFICATION_PREFERENCES
- **Delete Notification Preferences**: PK=USER#{userId}, SK=NOTIFICATION_PREFERENCES

## Data Models

### User Profile

```json
{
  "PK": "USER#user123",
  "SK": "PROFILE#user123",
  "id": "user123",
  "userId": "user123",
  "email": "user@example.com",
  "name": "John Doe",
  "profileImage": "https://s3.../profile.jpg",
  "fitnessGoals": "Build muscle and lose weight",
  "experienceLevel": "intermediate",
  "preferences": {
    "units": "metric",
    "timezone": "UTC",
    "notifications": {
      "email": true,
      "push": true,
      "workoutReminders": true,
      "nutritionReminders": true
    },
    "privacy": {
      "profileVisibility": "private",
      "workoutSharing": false,
      "progressSharing": false
    }
  },
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

### Workout Plan

```json
{
  "PK": "WORKOUT_PLANS",
  "SK": "PLAN#plan123",
  "id": "plan123",
  "userId": "user123",
  "name": "Beginner Strength Program",
  "description": "A 4-week beginner strength program",
  "difficulty": "beginner",
  "durationWeeks": 4,
  "frequencyPerWeek": 3,
  "exercises": [
    {
      "exerciseId": "ex123",
      "name": "Push-ups",
      "sets": 3,
      "reps": 10,
      "restSeconds": 60,
      "order": 1
    }
  ],
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

### Workout Session

```json
{
  "PK": "WORKOUT_SESSIONS",
  "SK": "SESSION#session123",
  "id": "session123",
  "userId": "user123",
  "workoutPlanId": "plan123",
  "name": "Upper Body Workout",
  "startedAt": "2024-01-01T10:00:00Z",
  "completedAt": "2024-01-01T11:00:00Z",
  "durationMinutes": 60,
  "rating": 4,
  "notes": "Great workout!",
  "exercises": [
    {
      "exerciseId": "ex123",
      "name": "Push-ups",
      "sets": [
        {
          "setNumber": 1,
          "reps": 10,
          "weight": null,
          "completed": true,
          "notes": "Good form"
        }
      ],
      "order": 1
    }
  ],
  "createdAt": "2024-01-01T10:00:00Z",
  "updatedAt": "2024-01-01T11:00:00Z"
}
```

### Exercise

```json
{
  "PK": "EXERCISES",
  "SK": "EXERCISE#ex123",
  "id": "ex123",
  "name": "Push-ups",
  "description": "A bodyweight exercise for chest and arms",
  "category": "strength",
  "muscleGroups": ["chest", "shoulders", "triceps"],
  "equipment": ["bodyweight"],
  "difficulty": "beginner",
  "instructions": [
    "Start in plank position",
    "Lower body to ground",
    "Push back up"
  ],
  "tips": "Keep core tight",
  "videoUrl": "https://youtube.com/watch?v=...",
  "imageUrl": "https://s3.../pushup.jpg",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

### Progress Photo

```json
{
  "PK": "PROGRESS_PHOTOS",
  "SK": "PHOTO#photo123",
  "id": "photo123",
  "userId": "user123",
  "workoutSessionId": "session123",
  "photoType": "front",
  "photoUrl": "https://s3.../photo123.jpg",
  "s3Key": "user-uploads/user123/photo123.jpg",
  "takenAt": "2024-01-01T10:30:00Z",
  "notes": "Front view progress photo",
  "createdAt": "2024-01-01T10:30:00Z"
}
```

### Workout Recommendation

```json
{
  "PK": "WORKOUT_RECOMMENDATIONS",
  "SK": "RECOMMENDATION#rec123",
  "id": "rec123",
  "userId": "user123",
  "recommendationType": "workout_plan",
  "title": "Increase Workout Frequency",
  "description": "Based on your recent performance, consider increasing your workout frequency to 4 times per week.",
  "reasoning": "Your completion rate is consistently high and you're recovering well between sessions.",
  "priority": 4,
  "expiresAt": "2024-01-08T00:00:00Z",
  "isApplied": false,
  "metadata": {
    "confidence_score": 0.85,
    "impact_level": "medium",
    "category": "progression"
  },
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### Adaptive Plan

```json
{
  "PK": "ADAPTIVE_PLANS",
  "SK": "PLAN#adaptive123",
  "id": "adaptive123",
  "userId": "user123",
  "basePlanId": "plan123",
  "adaptations": [
    {
      "exerciseId": "ex123",
      "adaptationType": "substitute",
      "originalExercise": {
        "id": "ex123",
        "name": "Barbell Bench Press",
        "category": "strength",
        "muscleGroups": ["chest", "shoulders", "triceps"],
        "equipment": ["barbell", "bench"],
        "difficulty": "intermediate"
      },
      "newExercise": {
        "id": "ex456",
        "name": "Dumbbell Bench Press",
        "category": "strength",
        "muscleGroups": ["chest", "shoulders", "triceps"],
        "equipment": ["dumbbells", "bench"],
        "difficulty": "intermediate"
      },
      "reason": "Equipment not available"
    }
  ],
  "adaptationReason": "Equipment availability and user preference",
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

### Recovery Plan

```json
{
  "PK": "RECOVERY_PLANS",
  "SK": "PLAN#recovery123",
  "id": "recovery123",
  "userId": "user123",
  "planType": "deload",
  "durationDays": 7,
  "activities": [
    {
      "id": "act123",
      "name": "Light Stretching",
      "activityType": "stretching",
      "durationMinutes": 15,
      "intensity": "low",
      "instructions": [
        "Focus on major muscle groups",
        "Hold each stretch for 30 seconds",
        "Don't force the stretch"
      ],
      "equipmentNeeded": ["yoga mat"],
      "order": 1
    }
  ],
  "startsAt": "2024-01-01T00:00:00Z",
  "endsAt": "2024-01-08T00:00:00Z",
  "isCompleted": false,
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### User Fitness Profile

```json
{
  "PK": "USER_FITNESS_PROFILES",
  "SK": "PROFILE#user123",
  "userId": "user123",
  "experienceLevel": "intermediate",
  "fitnessGoals": ["build_muscle", "lose_weight"],
  "currentStrengthLevels": {
    "ex123": 135.0,
    "ex456": 225.0
  },
  "recentPerformance": [
    {
      "workoutId": "session123",
      "date": "2024-01-01",
      "exercises": [
        {
          "exerciseId": "ex123",
          "setsCompleted": 3,
          "totalSets": 3,
          "averageWeight": 135.0,
          "averageReps": 8.0,
          "perceivedDifficulty": 4,
          "formRating": 5
        }
      ],
      "overallRating": 4,
      "difficultyPerceived": 4,
      "completionRate": 1.0
    }
  ],
  "injuryHistory": [
    {
      "id": "injury123",
      "bodyPart": "lower_back",
      "injuryType": "strain",
      "severity": "mild",
      "dateOccurred": "2023-12-01",
      "dateRecovered": "2023-12-15",
      "restrictions": ["avoid_heavy_deadlifts"],
      "notes": "Recovered well with rest and physical therapy"
    }
  ],
  "preferences": {
    "workoutDurationPreference": 60,
    "frequencyPreference": 4,
    "intensityPreference": "moderate",
    "equipmentAvailable": ["barbell", "dumbbells", "bench"],
    "timeOfDayPreference": "evening",
    "workoutTypes": ["strength", "cardio"],
    "avoidExercises": ["heavy_deadlifts"],
    "preferredExercises": ["squats", "bench_press"]
  },
  "lastUpdated": "2024-01-01T00:00:00Z"
}
```

### Coaching Rule

```json
{
  "PK": "COACHING_RULES",
  "SK": "RULE#rule123",
  "id": "rule123",
  "ruleType": "progression",
  "condition": {
    "field": "completion_rate",
    "operator": ">=",
    "value": 0.9,
    "timeWindow": 7
  },
  "action": {
    "actionType": "increase_difficulty",
    "parameters": {
      "weight_increase": 0.05,
      "rep_increase": 1
    },
    "message": "Great job! Let's increase the difficulty slightly."
  },
  "priority": 3,
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

### Progress Metrics

```json
{
  "PK": "PROGRESS_METRICS",
  "SK": "METRICS#user123#month",
  "userId": "user123",
  "period": "month",
  "startDate": "2024-01-01",
  "endDate": "2024-01-31",
  "strengthGains": {
    "ex123": 10.0,
    "ex456": 15.0
  },
  "volumeIncrease": 0.12,
  "consistencyScore": 0.85,
  "improvementAreas": ["upper_body", "core"],
  "recommendations": ["Continue current program", "Focus on form improvement"],
  "createdAt": "2024-01-31T00:00:00Z"
}
```

### Strength Progress

```json
{
  "PK": "STRENGTH_PROGRESS",
  "SK": "USER#user123#2024-01-01",
  "userId": "user123",
  "exerciseId": "ex123",
  "exerciseName": "Bench Press",
  "currentMaxWeight": 145.0,
  "previousMaxWeight": 135.0,
  "weightIncrease": 10.0,
  "percentageIncrease": 7.41,
  "period": "week",
  "measurementDate": "2024-01-01T00:00:00Z",
  "trend": "increasing"
}
```

### Body Measurement

```json
{
  "PK": "BODY_MEASUREMENTS",
  "SK": "USER#user123#2024-01-01",
  "id": "measurement123",
  "userId": "user123",
  "measurementType": "weight",
  "value": 75.5,
  "unit": "kg",
  "measuredAt": "2024-01-01T08:00:00Z",
  "notes": "Morning weight after workout"
}
```

### Progress Chart

```json
{
  "PK": "PROGRESS_CHARTS",
  "SK": "CHART#chart123",
  "chartId": "chart123",
  "userId": "user123",
  "chartType": "strength_progress",
  "title": "Bench Press Progress",
  "description": "Weekly bench press strength progression",
  "dataPoints": [
    {
      "xValue": "2024-01-01",
      "yValue": 135.0,
      "label": "Week 1"
    },
    {
      "xValue": "2024-01-08",
      "yValue": 140.0,
      "label": "Week 2"
    }
  ],
  "xAxisLabel": "Date",
  "yAxisLabel": "Weight (lbs)",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

### Milestone

```json
{
  "PK": "MILESTONES",
  "SK": "MILESTONE#milestone123",
  "id": "milestone123",
  "userId": "user123",
  "milestoneType": "strength",
  "title": "Bench Press 150 lbs",
  "description": "Achieve a 150 lb bench press",
  "targetValue": 150.0,
  "currentValue": 145.0,
  "progressPercentage": 96.67,
  "achieved": false,
  "targetDate": "2024-02-01T00:00:00Z",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### Performance Trend

```json
{
  "PK": "PERFORMANCE_TRENDS",
  "SK": "USER#user123#2024-01-01",
  "userId": "user123",
  "metricType": "strength",
  "period": "month",
  "startDate": "2024-01-01",
  "endDate": "2024-01-31",
  "trendDirection": "upward",
  "trendStrength": 0.75,
  "dataPoints": [
    {
      "date": "2024-01-01",
      "value": 135.0,
      "context": "bench_press"
    },
    {
      "date": "2024-01-08",
      "value": 140.0,
      "context": "bench_press"
    }
  ],
  "insights": ["Consistent strength gains", "Good form maintenance"],
  "recommendations": [
    "Continue current program",
    "Consider increasing frequency"
  ]
}
```

### Device Token

```json
{
  "PK": "USER#user123",
  "SK": "DEVICE#device456",
  "deviceId": "device456",
  "userId": "user123",
  "deviceToken": "fcm_token_or_apns_token_here",
  "platform": "ios",
  "deviceName": "John's iPhone",
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00Z",
  "lastUsedAt": "2024-01-01T00:00:00Z"
}
```

### Notification History

```json
{
  "PK": "NOTIFICATION#notif789",
  "SK": "USER#user123",
  "notificationId": "notif789",
  "userId": "user123",
  "notificationType": "workout_reminder",
  "title": "Time for your workout! 💪",
  "body": "Your scheduled workout is ready. Let's get moving!",
  "data": {
    "action": "start_workout",
    "category": "workout"
  },
  "sentAt": "2024-01-01T08:00:00Z",
  "deliveryStatus": "Delivered",
  "ttl": 1704067200
}
```

### Notification Preferences

```json
{
  "PK": "USER#user123",
  "SK": "NOTIFICATION_PREFERENCES",
  "userId": "user123",
  "workoutReminders": true,
  "nutritionReminders": true,
  "waterReminders": true,
  "progressPhotos": true,
  "achievements": true,
  "aiSuggestions": true,
  "workoutReminderTime": "08:00",
  "nutritionReminderTimes": ["08:00", "13:00", "19:00"],
  "timezone": "America/New_York",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

## Indexing Strategy

### Primary Index

- **Partition Key (PK)**: Entity type identifier
- **Sort Key (SK)**: Unique identifier for the entity

### Global Secondary Index 1 (GSI1)

- **GSI1PK**: User ID for user-specific queries
- **GSI1SK**: Timestamp or entity ID for sorting

### Global Secondary Index 2 (GSI2)

- **GSI2PK**: Entity type for cross-entity queries
- **GSI2SK**: Status or category for filtering

## Query Patterns

### 1. Get User Profile

```typescript
const params = {
  TableName: 'gymcoach-ai-main',
  Key: {
    PK: 'USER#user123',
    SK: 'PROFILE#user123',
  },
};
```

### 2. List User Workout Plans

```typescript
const params = {
  TableName: 'gymcoach-ai-main',
  KeyConditionExpression: 'PK = :pk',
  FilterExpression: 'userId = :userId',
  ExpressionAttributeValues: {
    ':pk': 'WORKOUT_PLANS',
    ':userId': 'user123',
  },
};
```

### 3. Get Workout Sessions by Date Range

```typescript
const params = {
  TableName: 'gymcoach-ai-main',
  KeyConditionExpression: 'PK = :pk',
  FilterExpression: 'userId = :userId AND startedAt BETWEEN :start AND :end',
  ExpressionAttributeValues: {
    ':pk': 'WORKOUT_SESSIONS',
    ':userId': 'user123',
    ':start': '2024-01-01',
    ':end': '2024-01-31',
  },
};
```

### 4. Get Strength Progress by Date Range

```typescript
const params = {
  TableName: 'gymcoach-ai-main',
  KeyConditionExpression: 'PK = :pk AND SK BETWEEN :start AND :end',
  ExpressionAttributeValues: {
    ':pk': 'STRENGTH_PROGRESS',
    ':start': 'USER#user123#2024-01-01',
    ':end': 'USER#user123#2024-01-31',
  },
};
```

## Data Consistency

### 1. Single-Table Design Benefits

- **Atomic Operations**: All related data can be updated in a single transaction
- **Consistent Performance**: Predictable query performance across all access patterns
- **Cost Efficiency**: Single table reduces DynamoDB costs

### 2. Data Validation

- **Required Fields**: All entities must have PK, SK, and entity-specific required fields
- **Data Types**: Consistent data types across all entities
- **Constraints**: Business logic constraints enforced at application level

### 3. Error Handling

- **Conditional Writes**: Use conditional expressions to prevent overwrites
- **Transaction Support**: Use DynamoDB transactions for multi-item operations
- **Retry Logic**: Implement exponential backoff for throttled requests

## Performance Optimization

### 1. Query Optimization

- **Projection Expressions**: Only fetch required attributes
- **Filter Expressions**: Use filters to reduce data transfer
- **Pagination**: Implement pagination for large result sets

### 2. Caching Strategy

- **Application-Level Caching**: Cache frequently accessed data
- **CloudFront Caching**: Cache static data at edge locations
- **DynamoDB DAX**: Use DAX for microsecond latency

### 3. Monitoring

- **CloudWatch Metrics**: Monitor read/write capacity and throttling
- **X-Ray Tracing**: Track request flow and performance
- **Custom Metrics**: Track business-specific metrics

## Security Considerations

### 1. Access Control

- **IAM Policies**: Restrict access to specific table operations
- **Resource-Based Policies**: Control access to specific items
- **Condition Keys**: Use conditions for fine-grained access control

### 2. Data Encryption

- **Encryption at Rest**: DynamoDB encryption using AWS KMS
- **Encryption in Transit**: HTTPS for all API calls
- **Client-Side Encryption**: Encrypt sensitive data before storage

### 3. Audit Logging

- **CloudTrail**: Log all DynamoDB API calls
- **DynamoDB Streams**: Track item-level changes
- **Custom Logging**: Log business-specific events

## Backup and Recovery

### 1. Point-in-Time Recovery

- **Enabled**: Point-in-time recovery enabled for all tables
- **Retention**: 35-day retention period
- **Testing**: Regular restore testing

### 2. On-Demand Backups

- **Scheduled Backups**: Daily automated backups
- **Manual Backups**: Before major deployments
- **Cross-Region**: Backup replication to secondary region

### 3. Disaster Recovery

- **Multi-Region**: Active-passive setup across regions
- **RTO/RPO**: Recovery Time Objective and Recovery Point Objective defined
- **Testing**: Regular disaster recovery testing

## Migration Strategy

### 1. Data Migration

- **DynamoDB Data Pipeline**: Use AWS Data Pipeline for large migrations
- **Incremental Migration**: Migrate data in batches
- **Validation**: Verify data integrity after migration

### 2. Application Updates

- **Feature Flags**: Use feature flags for gradual rollout
- **Blue-Green Deployment**: Deploy new version alongside old
- **Rollback Plan**: Quick rollback capability

### 3. Testing

- **Load Testing**: Test performance under expected load
- **Integration Testing**: Test all service integrations
- **User Acceptance Testing**: Validate with end users

## Monitoring and Alerting

### 1. CloudWatch Alarms

- **Throttling**: Alert on DynamoDB throttling
- **Error Rate**: Alert on high error rates
- **Latency**: Alert on high latency

### 2. Custom Metrics

- **Business Metrics**: Track user engagement and usage
- **Performance Metrics**: Track response times and throughput
- **Error Metrics**: Track and categorize errors

### 3. Dashboards

- **Operational Dashboard**: Real-time operational metrics
- **Business Dashboard**: Business-specific metrics
- **Performance Dashboard**: Performance and capacity metrics

This database schema design provides a solid foundation for the GymCoach AI application, ensuring scalability, performance, and maintainability while following DynamoDB best practices.
