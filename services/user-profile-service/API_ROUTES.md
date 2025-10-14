# User Profile Service API Routes

## User Profile Routes

### Get User Profile

```
GET /api/user-profiles/profile/:userId
GET /api/user-profiles/profile
```

Get user profile information. The second route uses the authenticated user's ID.

**Response:**

```json
{
  "userId": "string",
  "email": "string",
  "firstName": "string",
  "lastName": "string",
  "dateOfBirth": "string",
  "gender": "string",
  "height": number,
  "weight": number,
  "fitnessLevel": "string",
  "goals": ["string"],
  "profilePictureUrl": "string",
  "createdAt": "string",
  "updatedAt": "string"
}
```

### Update User Profile

```
PUT /api/user-profiles/profile/:userId
PUT /api/user-profiles/profile
```

Partially update user profile. The second route uses the authenticated user's ID.

**Request Body:**

```json
{
  "firstName": "string",
  "lastName": "string",
  "weight": number,
  "height": number,
  "fitnessLevel": "string",
  "goals": ["string"]
}
```

### Delete User Profile

```
DELETE /api/user-profiles/profile/:userId
```

Delete a user profile (admin only).

### Get User Stats

```
GET /api/user-profiles/profile/stats
```

Get statistics for the authenticated user.

**Response:**

```json
{
  "totalWorkouts": number,
  "totalExercises": number,
  "totalDuration": number,
  "streakDays": number,
  "favoriteExercises": ["string"],
  "performanceMetrics": {}
}
```

### Get User Preferences

```
GET /api/user-profiles/profile/preferences/:userId
GET /api/user-profiles/profile/preferences
```

Get user preferences. The first route gets preferences for a specific user (requires appropriate permissions). The second route gets preferences for the authenticated user.

**Response:**

```json
{
  "theme": "string",
  "notifications": boolean,
  "language": "string",
  "units": "string",
  "privacy": {}
}
```

### Update User Preferences

```
PUT /api/user-profiles/profile/preferences/:userId
PUT /api/user-profiles/profile/preferences
```

Update user preferences. The first route updates preferences for a specific user (requires appropriate permissions). The second route updates preferences for the authenticated user.

**Request Body:**

```json
{
  "theme": "string",
  "notifications": boolean,
  "language": "string",
  "units": "string"
}
```

## Upload Route

### Generate Upload URL

```
POST /api/user-profiles/profile/upload
```

Generate a presigned S3 URL for uploading profile pictures.

**Request Body:**

```json
{
  "fileName": "string",
  "fileType": "string"
}
```

**Response:**

```json
{
  "uploadUrl": "string",
  "fileUrl": "string",
  "expiresIn": number
}
```

## Sleep Routes

### Get Sleep Data

```
GET /api/user-profiles/sleep?userId={userId}&date={date}
```

Get sleep data for a specific date.

**Query Parameters:**

- `userId` (optional) - User ID, defaults to authenticated user
- `date` (optional) - ISO 8601 date string (e.g., "2025-01-15")

**Response:**

```json
{
  "userId": "string",
  "date": "string",
  "bedTime": "string",
  "wakeTime": "string",
  "duration": number,
  "quality": "string",
  "notes": "string"
}
```

### Save Sleep Data

```
POST /api/user-profiles/sleep
```

Save new sleep data.

**Request Body:**

```json
{
  "userId": "string",
  "date": "string",
  "bedTime": "string",
  "wakeTime": "string",
  "quality": "string",
  "notes": "string"
}
```

### Update Sleep Data

```
PUT /api/user-profiles/sleep
```

Update existing sleep data.

**Request Body:**

```json
{
  "userId": "string",
  "date": "string",
  "bedTime": "string",
  "wakeTime": "string",
  "quality": "string",
  "notes": "string"
}
```

### Get Sleep History

```
GET /api/user-profiles/sleep/history?userId={userId}&startDate={startDate}&endDate={endDate}
```

Get sleep history for a date range.

**Query Parameters:**

- `userId` (optional) - User ID, defaults to authenticated user
- `startDate` (optional) - ISO 8601 date string
- `endDate` (optional) - ISO 8601 date string

**Response:**

```json
{
  "sleepRecords": [
    {
      "date": "string",
      "duration": number,
      "quality": "string",
      "bedTime": "string",
      "wakeTime": "string"
    }
  ],
  "totalRecords": number
}
```

### Get Sleep Stats

```
GET /api/user-profiles/sleep/stats?userId={userId}&period={period}
```

Get sleep statistics for a period.

**Query Parameters:**

- `userId` (optional) - User ID, defaults to authenticated user
- `period` (optional) - Time period (e.g., "7d", "30d", "90d")

**Response:**

```json
{
  "averageDuration": number,
  "averageQuality": number,
  "totalNights": number,
  "sleepScore": number,
  "trends": {}
}
```

## Authentication

All routes require authentication via JWT Bearer token:

```
Authorization: Bearer <token>
```

## Error Responses

### 400 Bad Request

```json
{
  "error": "Bad Request",
  "message": "Invalid input data"
}
```

### 401 Unauthorized

```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

### 403 Forbidden

```json
{
  "error": "Forbidden",
  "message": "Access denied"
}
```

### 404 Not Found

```json
{
  "error": "Not Found",
  "message": "Resource not found"
}
```

### 500 Internal Server Error

```json
{
  "error": "Internal Server Error",
  "message": "An error occurred processing your request"
}
```

## CORS

All routes support CORS with the following headers:

- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

OPTIONS requests are handled automatically for CORS preflight.
