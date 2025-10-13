# Migration Guide: From Custom Routing to Lambda Router

This guide will help you migrate your existing Lambda services to use the `lambda-router` crate.

## Step 1: Add Dependency

Update your service's `Cargo.toml`:

```toml
[dependencies]
lambda-router = { path = "../../packages/lambda-router" }
lambda_runtime = "0.8"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1.0", features = ["macros"] }
async-trait = "0.1"
```

## Step 2: Remove Old Routing Code

You can remove or significantly simplify:

- `src/utils/routing.rs` - Route matching logic
- `src/utils/response.rs` - Response builders (router provides this)
- Manual CORS handling in `main.rs`
- Custom request parsing logic

## Step 3: Refactor Main Handler

### Before:

```rust
async fn handler(event: LambdaEvent<Value>) -> Result<Value, Error> {
    let (event, _context) = event.into_parts();
    let http_method = event["requestContext"]["http"]["method"].as_str().unwrap_or("GET");
    let path = event["rawPath"].as_str().unwrap_or("/");

    // Manual CORS handling
    if is_cors_preflight_request(http_method) {
        return Ok(ResponseBuilder::cors_preflight());
    }

    // Manual auth
    let auth_context = AUTH_LAYER.authenticate(&auth_event).await?;

    // Manual routing
    match RouteMatcher::match_route(method, path) {
        Some(Route::CreateMeal) => {
            // handler logic
        }
        // ... many more matches
    }
}
```

### After:

```rust
#[tokio::main]
async fn main() -> Result<(), Error> {
    // Initialize services
    init_clients().await;

    let mut router = Router::new();

    // Add middleware
    router.use_middleware(AuthMiddleware);

    // Define routes - clean and declarative
    router.post("/api/users/:userId/meals", handler!(create_meal));
    router.get("/api/users/:userId/meals/:mealId", handler!(get_meal));

    lambda_runtime::run(router.into_service()).await
}
```

## Step 4: Create Handler Functions

Each route becomes a simple async function:

### Before (in controller):

```rust
pub async fn create_meal(
    event: &Value,
    meal_service: &MealService,
    user_id: &str,
) -> Result<Value, AppError> {
    // Parse body manually
    let body = event["body"].as_str().ok_or(...)?;
    let create_request: CreateMealRequest = serde_json::from_str(body)?;

    // Call service
    let meal = meal_service.create_meal(user_id, create_request).await?;

    // Build response manually
    Ok(ResponseBuilder::success(json!(meal)))
}
```

### After (with router):

```rust
async fn create_meal(req: Request, ctx: Context) -> Result<Response, Error> {
    let user_id = ctx.user_id.ok_or("Unauthorized")?;
    let body: CreateMealRequest = req.json()?;

    let meal = meal_service.create_meal(&user_id, body).await?;

    Ok(Response::created(json!(meal)))
}
```

## Step 5: Implement Auth Middleware

Create a reusable auth middleware:

```rust
struct AuthMiddleware;

#[async_trait]
impl Middleware for AuthMiddleware {
    async fn handle(&self, mut req: Request, next: Next) -> Result<Response, Error> {
        // Convert to auth event
        let auth_event = AuthLambdaEvent {
            headers: Some(req.headers.clone()),
            // ... other fields
        };

        // Authenticate
        let auth_result = AUTH_LAYER.authenticate(&auth_event).await?;

        if !auth_result.is_authorized {
            return Ok(Response::forbidden("Access denied"));
        }

        // Add user to context
        req.set_context(Context::new(req.context.request_id.clone())
            .with_user(auth_result.user_id.unwrap(), auth_result.email));

        next(req).await
    }
}
```

## Step 6: Path Parameters

### Before:

```rust
let user_id = extract_user_id_from_path(path)?;
let meal_id = path.split('/').nth(5).ok_or(...)?;
```

### After:

```rust
let user_id = req.path_param("userId").ok_or("Missing userId")?;
let meal_id = req.path_param("mealId").ok_or("Missing mealId")?;
```

## Step 7: Query Parameters

### Before:

```rust
let query_params = event.get("queryStringParameters")?;
let date = query_params.get("date")?;
```

### After:

```rust
let date = req.query("date");
```

## Step 8: Request Body

### Before:

```rust
let body_str = event["body"].as_str().ok_or(...)?;
let body: MyRequest = serde_json::from_str(body_str)?;
```

### After:

```rust
let body: MyRequest = req.json()?;
```

## Step 9: Response Building

### Before:

```rust
Ok(json!({
    "statusCode": 200,
    "headers": {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
    },
    "body": serde_json::to_string(&data)?
}))
```

### After:

```rust
Ok(Response::ok(json!(data)))
```

## Benefits

✅ **Less Code**: 40-60% reduction in boilerplate  
✅ **Type Safety**: Full compile-time checking  
✅ **Readability**: Clear, Express-like API  
✅ **Maintainability**: Centralized routing logic  
✅ **Testability**: Easy to unit test handlers  
✅ **Reusability**: Share middleware across services  
✅ **CORS**: Automatic handling  
✅ **Error Handling**: Consistent HTTP error responses

## Complete Example

See `examples/nutrition_service_example.rs` for a full working example.

## Gradual Migration

You can migrate gradually:

1. Start with a new service using the router
2. Migrate one service at a time
3. Keep old routing code until migration is complete
4. Both approaches can coexist during transition

## Testing

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_create_meal() {
        let mut req = Request::from_lambda_event(mock_event());
        let ctx = Context::new("test-123".to_string())
            .with_user("user-123".to_string(), None);

        let response = create_meal(req, ctx).await.unwrap();
        assert_eq!(response.status_code, 201);
    }
}
```

## Common Patterns

### Pattern 1: User-specific routes

```rust
router.get("/api/users/:userId/resource", handler!(get_resource));

async fn get_resource(req: Request, ctx: Context) -> Result<Response, Error> {
    let user_id = req.path_param("userId").ok_or("Missing userId")?;
    // Verify user_id matches ctx.user_id for security
    if Some(user_id) != ctx.user_id.as_deref() {
        return Ok(Response::forbidden("Cannot access other user's data"));
    }
    // ... rest of logic
}
```

### Pattern 2: Optional query parameters

```rust
async fn get_meals(req: Request, ctx: Context) -> Result<Response, Error> {
    let date = req.query("date");
    let limit: usize = req.query("limit")
        .and_then(|s| s.parse().ok())
        .unwrap_or(20);
    // ...
}
```

### Pattern 3: Nested resources

```rust
router.get("/api/users/:userId/meals/:mealId/items/:itemId",
    handler!(get_meal_item));

async fn get_meal_item(req: Request, ctx: Context) -> Result<Response, Error> {
    let user_id = req.path_param("userId").ok_or("Missing userId")?;
    let meal_id = req.path_param("mealId").ok_or("Missing mealId")?;
    let item_id = req.path_param("itemId").ok_or("Missing itemId")?;
    // ...
}
```

## Need Help?

Check the `lambda-router` README for full API documentation and more examples.
