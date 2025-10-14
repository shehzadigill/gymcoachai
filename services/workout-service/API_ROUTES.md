# Workout Service API Routes

## Workout Plan Routes

### Get Workout Plans

```
GET /api/workouts/plans?userId={userId}
```

Get all workout plans. Optional userId query parameter.

### Create Workout Plan

```
POST /api/workouts/plans
```

Create a new workout plan.

### Get Workout Plan

```
GET /api/workouts/plans/:planId?userId={userId}
```

Get a specific workout plan by ID. Optional userId query parameter.

### Update Workout Plan

```
PUT /api/workouts/plans
```

Update an existing workout plan.

### Delete Workout Plan

```
DELETE /api/workouts/plans/:planId?userId={userId}
```

Delete a workout plan. Optional userId query parameter.

## Workout Session Routes

### Get Workout Sessions

```
GET /api/workouts/sessions?userId={userId}
```

Get all workout sessions. Optional userId query parameter.

### Create Workout Session

```
POST /api/workouts/sessions
```

Create a new workout session.

### Get Workout Session

```
GET /api/workouts/sessions/:sessionId
```

Get a specific workout session by ID.

### Update Workout Session

```
PUT /api/workouts/sessions
```

Update an existing workout session.

### Delete Workout Session

```
DELETE /api/workouts/sessions/:sessionId
```

Delete a workout session.

## Exercise Routes

### Get Exercises

```
GET /api/workouts/exercises
```

Get all exercises in the library.

### Create Exercise

```
POST /api/workouts/exercises
```

Create a new exercise.

### Get Exercise

```
GET /api/workouts/exercises/:exerciseId
```

Get a specific exercise by ID.

### Update Exercise

```
PUT /api/workouts/exercises
```

Update an existing exercise.

### Clone Exercise

```
POST /api/workouts/exercises/:exerciseId/clone
```

Clone an existing exercise.

### Delete Exercise

```
DELETE /api/workouts/exercises/:exerciseId
```

Delete an exercise.

## Analytics Routes

### Get Workout Analytics

```
GET /api/workouts/analytics?userId={userId}
```

Get workout analytics. Optional userId query parameter.

### Get Workout Insights

```
GET /api/workouts/insights?userId={userId}&timeRange={timeRange}
```

Get workout insights for a specific time range.

- Optional userId query parameter
- Optional timeRange query parameter (defaults to "week")

### Get Workout History

```
GET /api/workouts/history?userId={userId}&limit={limit}
```

Get workout history.

- Optional userId query parameter
- Optional limit query parameter

## Activity Logging

### Log Activity

```
POST /api/workouts/log-activity
```

Log a workout activity (Not yet implemented - returns 501).

## Scheduled Workout Routes

### Schedule Workout Plan

```
POST /api/workouts/plans/:planId/schedule
```

Schedule a workout plan.

### Get Scheduled Workouts

```
GET /api/workouts/schedules?userId={userId}
```

Get all scheduled workouts. Optional userId query parameter.

### Update Scheduled Workout

```
PUT /api/workouts/schedules/:scheduleId
```

Update a scheduled workout.

### Delete Scheduled Workout

```
DELETE /api/workouts/schedules/:scheduleId?userId={userId}
```

Delete a scheduled workout. Optional userId query parameter.

## Authentication

All routes (except OPTIONS) require a valid JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

## CORS Support

All endpoints support CORS with the following headers:

- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`
- `Access-Control-Max-Age: 3600`

## Response Format

All successful responses follow this format:

```json
{
  "statusCode": 200,
  "headers": {...},
  "body": "..."
}
```

Error responses:

```json
{
  "statusCode": 4xx/5xx,
  "headers": {...},
  "body": "{\"error\": \"Error Type\", \"message\": \"Error message\"}"
}
```
