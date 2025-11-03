# Analytics Service API Routes

## Route Mappings (Updated to match original API paths)

### Strength Progress

- `GET /api/analytics/strength-progress/:userId` - Get strength progress for user
- `POST /api/analytics/strength-progress` - Create strength progress entry
- `GET /api/analytics/me/strength-progress` - Get strength progress for authenticated user

### Body Measurements

- `GET /api/analytics/body-measurements/:userId` - Get body measurements for user
- `POST /api/analytics/body-measurements` - Create body measurement entry
- `GET /api/analytics/me/body-measurements` - Get body measurements for authenticated user

### Progress Charts

- `GET /api/analytics/charts/:userId` - Get progress charts for user
- `POST /api/analytics/charts` - Create progress chart
- `GET /api/analytics/me/charts` - Get progress charts for authenticated user

### Milestones

- `GET /api/analytics/milestones/:userId` - Get milestones for user
- `POST /api/analytics/milestones` - Create milestone
- `GET /api/analytics/me/milestones` - Get milestones for authenticated user

### Achievements

- `GET /api/analytics/achievements/:userId` - Get achievements for user
- `POST /api/analytics/achievements` - Create achievement
- `GET /api/analytics/me/achievements` - Get achievements for authenticated user

### Performance Trends

- `GET /api/analytics/trends/:userId` - Get performance trends for user
- `GET /api/analytics/me/trends` - Get performance trends for authenticated user

### Workout Analytics

- `GET /api/analytics/workout/:userId` - Get workout analytics for user
- `GET /api/analytics/workout/:userId/insights` - Get workout insights for user
- `GET /api/analytics/me/workout` - Get workout analytics for authenticated user
- `GET /api/analytics/me/workout/insights` - Get workout insights for authenticated user

### Progress Photos

- `GET /api/analytics/progress-photos/:userId` - Get progress photos for user
- `POST /api/analytics/progress-photos/upload` - Upload progress photo
- `PUT /api/analytics/progress-photos/:photoId` - Update progress photo
- `DELETE /api/analytics/progress-photos/:photoId` - Delete progress photo
- `GET /api/analytics/progress-photos/:userId/analytics` - Get progress photo analytics
- `GET /api/analytics/progress-photos/:userId/timeline` - Get progress photo timeline
- `GET /api/analytics/me/progress-photos` - Get progress photos for authenticated user
- `POST /api/analytics/me/progress-photos` - Upload progress photo for authenticated user
- `GET /api/analytics/me/progress-photos/analytics` - Get progress photo analytics for authenticated user
- `GET /api/analytics/me/progress-photos/timeline` - Get progress photo timeline for authenticated user

## Query Parameters

### Common Query Parameters

- `startDate` - Start date for filtering (ISO 8601 format)
- `endDate` - End date for filtering (ISO 8601 format)
- `period` - Time period for analytics (e.g., "7d", "30d", "90d", "1y")
- `limit` - Maximum number of results to return

### Progress Photos Specific

- `photoType` - Type of progress photo to filter by
- `time_range` - Alternative to startDate/endDate (e.g., "7d", "30d", "90d", "1y")

## Example API Calls

### Get Strength Progress

```bash
curl 'https://d202qmtk8kkxra.cloudfront.net/api/analytics/strength-progress/40ccb9bc-e091-7079-4c1d-3a2c47e01000?startDate=2025-09-14T21:08:05.619Z&endDate=2025-10-14T21:08:05.619Z' \
  -H 'authorization: Bearer YOUR_TOKEN'
```

### Get Workout Analytics

```bash
curl 'https://d202qmtk8kkxra.cloudfront.net/api/analytics/workout/40ccb9bc-e091-7079-4c1d-3a2c47e01000?period=30d' \
  -H 'authorization: Bearer YOUR_TOKEN'
```

### Get Progress Photos Timeline

```bash
curl 'https://d202qmtk8kkxra.cloudfront.net/api/analytics/progress-photos/40ccb9bc-e091-7079-4c1d-3a2c47e01000/timeline?time_range=30d' \
  -H 'authorization: Bearer YOUR_TOKEN'
```

## Notes

1. **User ID Parameter**: The `:userId` parameter is at the end of the path (e.g., `/api/analytics/strength-progress/:userId`)
2. **"Me" Routes**: Use authenticated user's ID from the JWT token instead of requiring userId in path
3. **POST Routes**: Generally don't include userId in path as it's extracted from the request body
4. **Authentication**: All routes require a valid JWT Bearer token in the Authorization header
5. **Query Parameters**: All date/time query parameters should be in ISO 8601 format
