# Notification Service API Routes

## Notification Routes

### Send Notification

```
POST /api/notifications/send
```

Send a push notification to a user.

**Request Body:**

```json
{
  "user_id": "string",
  "device_token": "string (optional)",
  "notification_type": "string",
  "title": "string",
  "body": "string",
  "data": {} (optional)
}
```

**Response:**

```json
{
  "success": true,
  "message": "Notification sent successfully",
  "notification_id": "uuid"
}
```

### Get Notifications

```
GET /api/notifications?limit=20
```

Get notification history for the authenticated user.

**Query Parameters:**

- `limit` (optional): Number of notifications to return (default: 20)

**Response:**

```json
{
  "success": true,
  "notifications": [],
  "message": "Notification history retrieval not yet implemented"
}
```

### Mark Notification as Read

```
PUT /api/notifications/:notificationId/read
```

Mark a specific notification as read.

**Response:**

```json
{
  "success": true,
  "message": "Notification marked as read"
}
```

## Device Management Routes

### Register Device

```
POST /api/notifications/devices
```

Register a device for push notifications.

**Request Body:**

```json
{
  "user_id": "string",
  "device_token": "string",
  "platform": "string",
  "device_name": "string (optional)"
}
```

**Supported Platforms:**

- `ios`
- `android`

**Response:**

```json
{
  "success": true,
  "message": "Device registered successfully",
  "device_id": "uuid"
}
```

### Deactivate Device

```
DELETE /api/notifications/devices/:deviceId
```

Deactivate a registered device.

**Response:**

```json
{
  "success": true,
  "message": "Device deactivated successfully"
}
```

### Get User Devices

```
GET /api/notifications/devices
```

Get all registered devices for the authenticated user.

**Response:**

```json
{
  "success": true,
  "devices": [],
  "message": "Device listing not yet implemented"
}
```

## Preferences Routes

### Get Preferences

```
GET /api/notifications/preferences
```

Get notification preferences for the authenticated user.

**Response:**

```json
{
  "success": true,
  "preferences": {
    "workout_reminders": true,
    "nutrition_reminders": true,
    "water_reminders": true,
    "progress_photos": true,
    "achievements": true,
    "ai_suggestions": true,
    "workout_reminder_time": "08:00",
    "nutrition_reminder_times": ["08:00", "13:00", "19:00"],
    "timezone": "America/New_York"
  }
}
```

### Update Preferences

```
PUT /api/notifications/preferences
```

Update notification preferences for the authenticated user.

**Request Body:**

```json
{
  "workout_reminders": true,
  "nutrition_reminders": true,
  "water_reminders": true,
  "progress_photos": true,
  "achievements": true,
  "ai_suggestions": true,
  "workout_reminder_time": "08:00",
  "nutrition_reminder_times": ["08:00", "13:00", "19:00"],
  "timezone": "America/New_York"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Preferences updated successfully"
}
```

## Scheduled Notifications (Internal/EventBridge)

### Process Scheduled Notifications

```
POST /api/notifications/scheduled/process
```

Process scheduled notifications (triggered by EventBridge).

**Note:** This endpoint bypasses authentication and is intended to be called by AWS EventBridge only.

**Response:**

```json
{
  "success": true,
  "message": "Processed 10 scheduled notifications",
  "processed_count": 10
}
```

## Authentication

All routes (except OPTIONS and `/api/notifications/scheduled/process`) require a valid JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

The scheduled notifications endpoint bypasses authentication as it's triggered by AWS EventBridge.

## CORS Support

All endpoints support CORS with the following headers:

- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`
- `Access-Control-Max-Age: 3600`

## Notification Types

Supported notification types:

- `workout_reminder`: Reminder to complete a workout
- `nutrition_reminder`: Reminder to log meals
- `water_reminder`: Reminder to drink water
- `progress_photo`: Reminder to take progress photos
- `achievement`: Achievement unlocked notification
- `ai_suggestion`: AI-generated fitness suggestion

## Error Responses

All error responses follow this format:

```json
{
  "statusCode": 4xx/5xx,
  "headers": {...},
  "body": "{\"error\": \"Error Type\", \"message\": \"Error message\"}"
}
```

## Notes

- Device tokens are platform-specific (APNs for iOS, FCM for Android)
- Timezone should be in IANA timezone format (e.g., "America/New_York")
- Reminder times should be in HH:MM format (24-hour)
- Notifications are delivered via AWS SNS
- Scheduled notifications are processed hourly by EventBridge
