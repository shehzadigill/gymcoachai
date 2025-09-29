# Backend/Frontend Sync Requirements for Workout Plans

## ✅ CURRENT STATUS: BASIC CRUD SYNCHRONIZED

The basic workout plans CRUD operations are fully synchronized between backend and frontend.

## 🚀 REQUIRED ADDITIONS FOR ENHANCED FEATURES

### 1. Backend Model Additions (services/workout-service/src/models.rs)

```rust
#[derive(Deserialize, Serialize, Validate, Debug, Clone)]
pub struct ScheduledWorkout {
    pub id: String,
    pub plan_id: String,
    pub user_id: String,
    pub plan_name: String,
    pub scheduled_date: String,      // ISO date string
    pub scheduled_time: String,      // Time in HH:MM format
    pub status: String,              // "scheduled", "completed", "missed", "cancelled"
    pub week: i32,                   // Week number in plan
    pub day: i32,                    // Day number in week
    pub notes: Option<String>,
    pub completed_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

// Add to WorkoutPlan model:
#[derive(Deserialize, Serialize, Validate, Debug, Clone)]
pub struct WorkoutPlan {
    // ... existing fields ...
    pub tags: Option<Vec<String>>,           // NEW: Plan tags
    pub rating: Option<f32>,                 // NEW: User rating (1-5)
    pub is_template: Option<bool>,           // NEW: Template flag
    pub total_sessions: Option<i32>,         // NEW: Calculated field
    pub completed_sessions: Option<i32>,     // NEW: Progress tracking
    pub next_scheduled_date: Option<String>, // NEW: Next workout date
}
```

### 2. Backend Handler Additions (services/workout-service/src/handlers.rs)

```rust
// Schedule management handlers
pub async fn schedule_workout_plan_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    // Implementation needed
}

pub async fn get_scheduled_workouts_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    // Implementation needed
}

pub async fn update_scheduled_workout_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    // Implementation needed
}

pub async fn delete_scheduled_workout_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    // Implementation needed
}
```

### 3. Backend Route Additions (services/workout-service/src/main.rs)

```rust
// Add to route matching in handler()
match (http_method, path) {
    // ... existing routes ...

    // Scheduling routes
    ("POST", path) if path.starts_with("/api/workouts/plans/") && path.contains("/schedule") => {
        schedule_workout_plan_handler(modified_event, DYNAMODB_CLIENT.get().unwrap()).await
    }
    ("GET", "/api/workouts/schedules") => {
        get_scheduled_workouts_handler(modified_event, DYNAMODB_CLIENT.get().unwrap()).await
    }
    ("PUT", path) if path.starts_with("/api/workouts/schedules/") => {
        update_scheduled_workout_handler(modified_event, DYNAMODB_CLIENT.get().unwrap()).await
    }
    ("DELETE", path) if path.starts_with("/api/workouts/schedules/") => {
        delete_scheduled_workout_handler(modified_event, DYNAMODB_CLIENT.get().unwrap()).await
    }

    // ... rest of routes ...
}
```

### 4. Frontend API Client Additions (apps/web/src/lib/api-client.ts)

```typescript
export const api = {
  // ... existing methods ...

  // Scheduling methods
  async scheduleWorkoutPlan(
    planId: string,
    schedule: {
      startDate: string;
      times: string[];
      userId?: string;
    }
  ) {
    const userId = schedule.userId || (await getCurrentUserId());
    return apiFetch<any>(`/api/workouts/plans/${planId}/schedule`, {
      method: 'POST',
      body: JSON.stringify({ ...schedule, userId }),
    });
  },

  async getScheduledWorkouts(userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<any[]>(`/api/workouts/schedules?userId=${id}`);
  },

  async updateScheduledWorkout(scheduleId: string, data: any) {
    return apiFetch<any>(`/api/workouts/schedules/${scheduleId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async cancelScheduledWorkout(scheduleId: string) {
    return apiFetch<any>(`/api/workouts/schedules/${scheduleId}`, {
      method: 'DELETE',
    });
  },
};
```

### 5. Database Schema Updates

Add to DynamoDB table schema:

```
// New partition key pattern for scheduled workouts
PK: SCHEDULED_WORKOUTS
SK: SCHEDULE#{scheduleId}

// Or user-based partitioning
PK: USER#{userId}
SK: SCHEDULE#{scheduleId}

// GSI for date-based queries
GSI1PK: SCHEDULE_DATE#{date}
GSI1SK: USER#{userId}#PLAN#{planId}
```

## 🚦 IMPLEMENTATION PRIORITY

### Phase 1: Core Scheduling (High Priority)

1. Add ScheduledWorkout model
2. Implement basic schedule handlers
3. Add scheduling API endpoints
4. Update frontend API client

### Phase 2: Enhanced Features (Medium Priority)

1. Add template support
2. Implement rating system
3. Add progress tracking
4. Enhanced filtering

### Phase 3: Advanced Features (Low Priority)

1. Recurring schedule patterns
2. Smart scheduling suggestions
3. Conflict detection
4. Calendar integrations

## 🧪 TESTING CHECKLIST

- [ ] Backend models compile correctly
- [ ] API endpoints return expected data structure
- [ ] Frontend can schedule workout plans
- [ ] Scheduled workouts display correctly
- [ ] CRUD operations work for schedules
- [ ] Error handling for edge cases
- [ ] Authentication works for all endpoints

## 🔄 CURRENT WORKAROUND

The frontend currently uses mock data for scheduling features:

```typescript
// In WorkoutPlansPage component
const mockScheduled: ScheduledWorkout[] = [
  // Mock data is used until backend is implemented
];
```

Once backend scheduling is implemented, remove mock data and connect to real API.
