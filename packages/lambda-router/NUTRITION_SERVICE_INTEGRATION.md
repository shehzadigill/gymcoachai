# Nutrition Service Integration with lambda-router

## Overview

Successfully integrated the `lambda-router` crate into the nutrition-service, replacing ~250 lines of manual route matching with a clean, Express-like routing system.

## Changes Made

### 1. lambda-router Enhancements

Added `Response::from_json_value()` method to support controllers that return JSON responses:

```rust
/// Create Response from JSON value (for controller compatibility)
/// Expects format: { statusCode: number, headers: object, body: any }
pub fn from_json_value(value: Value) -> Self {
    let status_code = value["statusCode"].as_u64().unwrap_or(200) as u16;

    let mut headers = HashMap::new();
    if let Some(headers_obj) = value["headers"].as_object() {
        for (key, val) in headers_obj {
            if let Some(s) = val.as_str() {
                headers.insert(key.clone(), s.to_string());
            }
        }
    }

    // Handle body - could be already stringified or an object
    let body = if let Some(body_str) = value["body"].as_str() {
        body_str.to_string()
    } else {
        value["body"].to_string()
    };

    Self {
        status_code,
        headers,
        body,
        is_base64_encoded: value["isBase64Encoded"].as_bool().unwrap_or(false),
    }
}
```

Added `From<&str>` and `From<String>` implementations for `RouterError` for convenience.

### 2. Nutrition Service Refactor

**Before (manual routing):**

```rust
// ~250 lines of manual if-else chains
let response = if path.starts_with("/api/nutrition/users/") && path.contains("/meals") {
    if method == "POST" {
        handle_create_meal(event).await
    } else if method == "GET" {
        // ... more nested conditions
    }
    // ... hundreds more lines
}
```

**After (lambda-router):**

```rust
let mut router = Router::new();

// Add authentication middleware
router.use_middleware(AuthMiddleware);

// Meal routes
router.post("/api/nutrition/users/:userId/meals", handler!(create_meal));
router.get("/api/nutrition/users/:userId/meals/:mealId", handler!(get_meal));
router.get("/api/nutrition/users/:userId/meals/date/:date", handler!(get_meals_by_date));
// ... 40+ routes in clean, readable format
```

### 3. Handler Pattern

Handlers now follow a clean, consistent pattern:

```rust
async fn create_meal(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = req.path_param("userId").ok_or("Missing userId")?;
    let auth_context = get_auth_context(&ctx);
    let body = req.body().ok_or("Missing request body")?;

    let controller = MEAL_CONTROLLER.get().ok_or("Controller not initialized")?;

    match controller.create_meal(user_id, body, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in create_meal handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}
```

### 4. Authentication Middleware

Custom authentication middleware integrated with the existing auth-layer:

```rust
struct AuthMiddleware;

#[async_trait]
impl Middleware for AuthMiddleware {
    async fn handle(&self, mut req: Request, next: Next) -> Result<Response, LambdaError> {
        // Convert to auth event format
        let auth_event = AuthLambdaEvent {
            headers: Some(req.headers.clone()),
            request_context: req.raw_event()
                .get("requestContext")
                .and_then(|v| serde_json::from_value(v.clone()).ok()),
            path_parameters: Some(req.path_params.clone()),
            query_string_parameters: Some(req.query_params.clone()),
            body: req.body.clone(),
        };

        // Authenticate request
        let auth_result = AUTH_LAYER.authenticate(&auth_event).await
            .map_err(|e| format!("Auth error: {}", e))?;

        if !auth_result.is_authorized {
            return Ok(Response::forbidden(
                &auth_result.error.unwrap_or("Access denied".to_string())
            ));
        }

        // Add user context
        if let Some(auth_ctx) = auth_result.context {
            req.set_context(
                Context::new(req.context.request_id.clone())
                    .with_user(auth_ctx.user_id.clone(), Some(auth_ctx.email.clone()))
                    .with_custom("auth_context".to_string(), serde_json::to_value(&auth_ctx).unwrap())
            );
        }

        next(req).await
    }
}
```

## Routes Implemented

### Meal Management

- `POST /api/nutrition/users/:userId/meals` - Create meal
- `GET /api/nutrition/users/:userId/meals/:mealId` - Get specific meal
- `GET /api/nutrition/users/:userId/meals/date/:date` - Get meals by date
- `GET /api/nutrition/users/:userId/meals` - Get all user meals
- `PUT /api/nutrition/users/:userId/meals/:mealId` - Update meal
- `DELETE /api/nutrition/users/:userId/meals/:mealId` - Delete meal

### "Me" Endpoints (uses authenticated user)

- `POST /api/nutrition/me/meals` - Create meal for authenticated user
- `GET /api/nutrition/me/meals` - Get authenticated user's meals

### Food Database

- `POST /api/nutrition/foods` - Create food
- `GET /api/nutrition/foods/:foodId` - Get food details
- `GET /api/nutrition/foods/search?q=...` - Search foods

### Favorites

- `POST /api/nutrition/users/:userId/favorites/foods/:foodId` - Add favorite
- `DELETE /api/nutrition/users/:userId/favorites/foods/:foodId` - Remove favorite
- `GET /api/nutrition/users/:userId/favorites/foods` - List favorites

### Nutrition Plans

- `POST /api/nutrition/users/:userId/nutrition-plans` - Create plan
- `GET /api/nutrition/users/:userId/nutrition-plans/:planId` - Get plan

### Statistics

- `GET /api/nutrition/users/:userId/stats` - Get nutrition stats

### Water Intake

- `GET /api/nutrition/users/:userId/water/date/:date` - Get water intake
- `POST /api/nutrition/users/:userId/water/date/:date` - Set water intake

All routes also support `/api/users/:userId/...` paths for backward compatibility.

## Benefits

1. **Code Reduction**: Reduced from ~250 lines of manual routing to ~50 lines of route definitions
2. **Type Safety**: Compile-time route validation
3. **Middleware Support**: Clean authentication and CORS handling
4. **Path Parameters**: Automatic extraction with `:param` syntax
5. **Query Parameters**: Simple `.query("name")` API
6. **Error Handling**: Consistent error responses
7. **Maintainability**: Easy to add/modify routes
8. **Testability**: Cleaner handler functions

## Compilation

The service now compiles successfully with only minor warnings:

```bash
cd services/nutrition-service
cargo check  # ✅ Success
cargo build --release  # Ready for Lambda deployment
```

## Next Steps

1. Test deployed service with actual Lambda events
2. Consider migrating other services:
   - workout-service
   - user-profile-service
   - analytics-service
3. Add unit tests for handlers
4. Add integration tests for routing logic

## Performance Notes

- **Cold Start**: OnceCell used for controller initialization (happens once per Lambda instance)
- **Hot Path**: Regex-based route matching with O(n) complexity where n = number of routes
- **Memory**: Minimal overhead from Arc-wrapped router
- **Concurrency**: Fully async/await with tokio runtime

## Related Documentation

- [lambda-router README](./README.md)
- [Architecture Details](./ARCHITECTURE.md)
- [Migration Guide](./MIGRATION.md)
- [Quick Reference](./QUICK_REFERENCE.md)
