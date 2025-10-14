# User Profile Service Routing Refactoring Summary

## Overview

Successfully refactored the **user-profile-service** to use the same reusable `lambda-router` pattern as the nutrition and analytics services.

## Changes Made

### 1. **New Handler Module** (`src/handlers.rs`)

Created a comprehensive handler module with clean handler functions for all endpoints:

**User Profile Handlers:**

- `get_user_profile` - Get user profile by userId
- `get_user_profile_me` - Get authenticated user's profile
- `update_user_profile` - Update user profile by userId
- `update_user_profile_me` - Update authenticated user's profile
- `delete_user_profile` - Delete user profile
- `get_user_stats` - Get user statistics
- `get_user_preferences` - Get user preferences
- `update_user_preferences` - Update user preferences

**Upload Handlers:**

- `generate_upload_url` - Generate S3 presigned upload URL

**Sleep Handlers:**

- `get_sleep_data` - Get sleep data for a specific date
- `save_sleep_data` - Save new sleep data
- `update_sleep_data` - Update existing sleep data
- `get_sleep_history` - Get sleep history for date range
- `get_sleep_stats` - Get sleep statistics for a period

Each handler:

- Accepts `Request` and `Context` from lambda-router
- Extracts parameters using router's built-in methods
- Calls appropriate controller methods
- Returns properly formatted `Response`

### 2. **Updated Main Module** (`src/main.rs`)

#### Dependency Changes

- Added `lambda-router` dependency (local package)
- Added `async-trait` for middleware implementation
- Already using `lambda_runtime = "0.8"` (no change needed)

#### Architecture Changes

- **Global Controllers**: Initialized once using `OnceCell`
  - `USER_PROFILE_CONTROLLER`
  - `SLEEP_CONTROLLER`
  - `UPLOAD_CONTROLLER`

- **Router-based Routing**: Replaced custom routing logic with `lambda-router::Router`

  ```rust
  let mut router = Router::new();
  router.use_middleware(AuthMiddleware);
  router.get("/api/user-profiles/profile/:userId", handler!(get_user_profile));
  // ... etc
  ```

- **Authentication Middleware**: Implemented as reusable middleware
  - Validates requests using `AuthLayer`
  - Injects user context into request
  - Provides unified auth handling

- **Controller Initialization**: Moved to `init_controllers()` function
  - Initializes repositories and services once
  - Sets up global controller instances

### 3. **Route Structure**

All routes follow consistent patterns:

**User Profile Routes:**

```
GET    /api/user-profiles/profile/:userId        - Get user profile
GET    /api/user-profiles/profile                - Get authenticated user profile
PUT    /api/user-profiles/profile/:userId        - Update user profile
PUT    /api/user-profiles/profile                - Update authenticated user profile
DELETE /api/user-profiles/profile/:userId        - Delete user profile
GET    /api/user-profiles/profile/stats          - Get user stats
GET    /api/user-profiles/profile/preferences    - Get user preferences
PUT    /api/user-profiles/profile/preferences    - Update user preferences
POST   /api/user-profiles/profile/upload         - Generate upload URL
```

**Sleep Routes:**

```
GET  /api/user-profiles/sleep          - Get sleep data
POST /api/user-profiles/sleep          - Save sleep data
PUT  /api/user-profiles/sleep          - Update sleep data
GET  /api/user-profiles/sleep/history  - Get sleep history
GET  /api/user-profiles/sleep/stats    - Get sleep statistics
```

### 4. **Query Parameters**

**Sleep Routes Support:**

- `userId` - User ID (defaults to authenticated user if not provided)
- `date` - Specific date for sleep data (ISO 8601 format)
- `startDate` - Start date for history (ISO 8601 format)
- `endDate` - End date for history (ISO 8601 format)
- `period` - Time period for stats (e.g., "7d", "30d", "90d")

### 5. **Benefits of Refactoring**

1. **Consistency**: Now matches nutrition and analytics service architecture
2. **Maintainability**: Clean separation of concerns (routes → handlers → controllers → services)
3. **Reusability**: Handlers can be easily tested and reused
4. **Performance**: Global controller initialization reduces cold start time
5. **Type Safety**: Leverages Rust's type system through lambda-router
6. **Simplified Routing**: Express-like syntax is easier to understand
7. **Middleware Support**: Easy to add logging, rate limiting, etc.

### 6. **Removed/Deprecated Code**

The following custom utilities are no longer needed (but kept for backward compatibility):

- `utils/routing.rs` - Custom route matching
- Custom response builders (replaced by lambda-router Response methods)
- Manual path parameter extraction

### 7. **Handler Patterns**

**Legacy Controller Compatibility:**
Since the controllers still expect path strings, handlers construct paths for backward compatibility:

```rust
let path = format!("/api/user-profiles/profile/{}", user_id);
controller.get_user_profile(&path, &auth_context).await
```

**Query Parameter Handling:**

```rust
let mut query_params = std::collections::HashMap::new();
if let Some(user_id) = req.query("userId") {
    query_params.insert("userId".to_string(), user_id.to_string());
}
```

### 8. **Authentication Flow**

1. Request comes in → Router
2. AuthMiddleware validates JWT token
3. User context injected into request
4. Handler extracts userId (from path param or authenticated user)
5. Controller processes request
6. Response returned

## Example API Calls

### Get User Profile (by ID)

```bash
curl 'https://api.example.com/api/user-profiles/profile/40ccb9bc-e091-7079-4c1d-3a2c47e01000' \
  -H 'authorization: Bearer YOUR_TOKEN'
```

### Get My Profile

```bash
curl 'https://api.example.com/api/user-profiles/profile' \
  -H 'authorization: Bearer YOUR_TOKEN'
```

### Update Preferences

```bash
curl -X PUT 'https://api.example.com/api/user-profiles/profile/preferences' \
  -H 'authorization: Bearer YOUR_TOKEN' \
  -H 'content-type: application/json' \
  -d '{"theme":"dark","notifications":true}'
```

### Get Sleep History

```bash
curl 'https://api.example.com/api/user-profiles/sleep/history?startDate=2025-01-01T00:00:00Z&endDate=2025-01-31T23:59:59Z' \
  -H 'authorization: Bearer YOUR_TOKEN'
```

### Get Sleep Stats

```bash
curl 'https://api.example.com/api/user-profiles/sleep/stats?period=30d' \
  -H 'authorization: Bearer YOUR_TOKEN'
```

## Testing Recommendations

1. Test both `:userId` and authenticated user paths
2. Verify query parameters work for sleep routes
3. Test authentication middleware with valid/invalid tokens
4. Verify CORS handling for preflight requests
5. Test upload URL generation
6. Verify sleep data CRUD operations

## Compilation Status

✅ **Successfully compiles** with only warnings for unused code
✅ **Ready for deployment**

## Dependencies Updated

```toml
lambda_runtime = "0.8"
lambda-router = { path = "../../packages/lambda-router" }
async-trait = "0.1"
```

## Future Improvements

1. Consider removing unused routing utilities after confirming no dependencies
2. Refactor controllers to accept structured parameters instead of path strings
3. Add request validation middleware
4. Add structured logging middleware
5. Add rate limiting middleware
6. Add OpenAPI/Swagger documentation generation

---

**Migration Complete**: The user-profile-service now uses the same modern, maintainable routing architecture as the nutrition and analytics services, providing a consistent development experience across all Rust Lambda services.
