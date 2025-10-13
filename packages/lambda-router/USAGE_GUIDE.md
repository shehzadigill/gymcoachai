# Using lambda-router in Your Service

This guide shows how to integrate lambda-router into any Rust Lambda service in the gymcoach-ai project.

## Quick Start (5 minutes)

### Step 1: Add Dependency

In your service's `Cargo.toml`:

```toml
[dependencies]
lambda-router = { path = "../../packages/lambda-router" }
lambda_runtime = "0.8"
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tracing = "0.1"
async-trait = "0.1"
```

### Step 2: Create Basic Router

In your `main.rs`:

```rust
use lambda_router::{Router, Request, Response, Context, handler};
use lambda_runtime::{run, service_fn, Error};

// Define handlers
async fn health_check(_req: Request, _ctx: Context) -> Result<Response, Error> {
    Ok(Response::ok(serde_json::json!({
        "status": "healthy",
        "service": "my-service"
    })))
}

async fn get_item(req: Request, _ctx: Context) -> Result<Response, Error> {
    let item_id = req.path_param("itemId")
        .ok_or("Missing itemId")?;

    Ok(Response::ok(serde_json::json!({
        "itemId": item_id,
        "data": "some data"
    })))
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .init();

    let mut router = Router::new();

    // Define routes
    router.get("/health", handler!(health_check));
    router.get("/api/items/:itemId", handler!(get_item));

    // Run service
    run(service_fn(router.into_service())).await
}
```

### Step 3: Deploy

```bash
cargo build --release --target x86_64-unknown-linux-musl
```

That's it! You now have a fully functional Lambda service with routing.

## With Authentication

### Step 1: Add Auth Middleware

```rust
use lambda_router::{Router, Request, Response, Context, Middleware, Next, handler};
use lambda_runtime::{run, service_fn, Error};
use auth_layer::{AuthLayer, LambdaEvent as AuthLambdaEvent};
use async_trait::async_trait;
use once_cell::sync::Lazy;

// Initialize auth layer once
static AUTH_LAYER: Lazy<AuthLayer> = Lazy::new(|| {
    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_default();
    let cognito_region = std::env::var("COGNITO_REGION").unwrap_or_default();
    let cognito_user_pool_id = std::env::var("COGNITO_USER_POOL_ID").unwrap_or_default();
    AuthLayer::new(jwt_secret, cognito_region, cognito_user_pool_id)
});

// Custom auth middleware
struct AuthMiddleware;

#[async_trait]
impl Middleware for AuthMiddleware {
    async fn handle(&self, mut req: Request, next: Next) -> Result<Response, Error> {
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

        // Authenticate
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
                    .with_custom("auth_context".to_string(),
                        serde_json::to_value(&auth_ctx).unwrap())
            );
        }

        next(req).await
    }
}
```

### Step 2: Use in Router

```rust
#[tokio::main]
async fn main() -> Result<(), Error> {
    let mut router = Router::new();

    // Add auth middleware (applies to all routes)
    router.use_middleware(AuthMiddleware);

    // Define routes
    router.get("/health", handler!(health_check));
    router.get("/api/users/:userId/data", handler!(get_user_data));
    router.post("/api/users/:userId/data", handler!(create_user_data));

    run(service_fn(router.into_service())).await
}
```

### Step 3: Access Auth Context in Handlers

```rust
// Helper to extract auth context
fn get_auth_context(ctx: &Context) -> auth_layer::AuthContext {
    ctx.custom.get("auth_context")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_else(|| auth_layer::AuthContext {
            user_id: String::new(),
            email: String::new(),
            roles: vec![],
            permissions: vec![],
            exp: 0,
            iat: 0,
        })
}

async fn get_user_data(req: Request, ctx: Context) -> Result<Response, Error> {
    let user_id = req.path_param("userId").ok_or("Missing userId")?;
    let auth_context = get_auth_context(&ctx);

    // Verify user can access this resource
    if auth_context.user_id != user_id {
        return Ok(Response::forbidden("Cannot access other users' data"));
    }

    // ... fetch and return data
    Ok(Response::ok(serde_json::json!({
        "userId": user_id,
        "data": "user data"
    })))
}
```

## Advanced Patterns

### Multiple Middleware

```rust
router.use_middleware(LoggingMiddleware);
router.use_middleware(AuthMiddleware);
router.use_middleware(CorsMiddleware::default());
```

### Query Parameters

```rust
async fn search_items(req: Request, _ctx: Context) -> Result<Response, Error> {
    let query = req.query("q").unwrap_or(&"".to_string()).clone();
    let limit: usize = req.query("limit")
        .and_then(|s| s.parse().ok())
        .unwrap_or(10);

    Ok(Response::ok(serde_json::json!({
        "query": query,
        "limit": limit,
        "results": []
    })))
}
```

### JSON Request Body

```rust
async fn create_item(req: Request, _ctx: Context) -> Result<Response, Error> {
    #[derive(serde::Deserialize)]
    struct CreateItemRequest {
        name: String,
        description: String,
    }

    let body: CreateItemRequest = req.json()
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    Ok(Response::created(serde_json::json!({
        "id": "item-123",
        "name": body.name,
        "description": body.description
    })))
}
```

### Error Handling

```rust
use lambda_router::RouterError;

async fn get_item(req: Request, _ctx: Context) -> Result<Response, RouterError> {
    let item_id = req.path_param("itemId")?;  // Auto-converts &str to RouterError

    // Custom error handling
    let item = fetch_item(item_id)
        .await
        .map_err(|e| RouterError::InternalError(e.to_string()))?;

    Ok(Response::ok(serde_json::json!(item)))
}
```

### Using with Existing Controllers

If you have existing controllers (like nutrition-service):

```rust
async fn create_item(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = req.path_param("userId").ok_or("Missing userId")?;
    let body = req.body().ok_or("Missing request body")?;
    let auth_context = get_auth_context(&ctx);

    let controller = ITEM_CONTROLLER.get().ok_or("Controller not initialized")?;

    match controller.create_item(user_id, body, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            tracing::error!("Error creating item: {}", e);
            Ok(Response::internal_error("Failed to create item"))
        }
    }
}
```

## Response Builders

```rust
// Standard responses
Response::ok(json!({"message": "Success"}))
Response::created(json!({"id": "123"}))
Response::no_content()
Response::bad_request("Invalid input")
Response::unauthorized("Not authenticated")
Response::forbidden("Access denied")
Response::not_found("Resource not found")
Response::internal_error("Server error")
Response::method_not_allowed("POST not allowed")

// Custom response
Response::new(201)
    .json(json!({"created": true}))
    .header("X-Custom-Header", "value")

// CORS response
Response::ok(json!({"data": "..."}))
    .with_cors()
```

## Tips & Best Practices

### 1. Use OnceCell for Initialization

```rust
use once_cell::sync::OnceCell;

static CONTROLLER: OnceCell<MyController> = OnceCell::new();

fn init_controller() {
    let _ = CONTROLLER.set(MyController::new(...));
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    init_controller();
    // ... setup router
}
```

### 2. Group Related Routes

```rust
// User routes
router.get("/api/users/:userId", handler!(get_user));
router.post("/api/users/:userId", handler!(create_user));
router.put("/api/users/:userId", handler!(update_user));
router.delete("/api/users/:userId", handler!(delete_user));

// Item routes
router.get("/api/users/:userId/items/:itemId", handler!(get_item));
router.post("/api/users/:userId/items", handler!(create_item));
```

### 3. Add Health Check

```rust
router.get("/health", handler!(health_check));
```

### 4. Support Multiple Path Styles

```rust
// Primary path
router.get("/api/v1/users/:userId", handler!(get_user));

// Backward compatibility
router.get("/users/:userId", handler!(get_user));

// Authenticated user shortcut
router.get("/api/v1/me", handler!(get_current_user));
```

### 5. Use Middleware for Cross-Cutting Concerns

- Authentication
- Logging
- CORS
- Request validation
- Rate limiting
- Metrics collection

## Testing

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_health_check() {
        let req = Request::new("GET", "/health");
        let ctx = Context::new("test-123".to_string());

        let response = health_check(req, ctx).await.unwrap();
        assert_eq!(response.status_code, 200);
    }
}
```

## Common Issues

### 1. Handler Type Mismatch

**Error:** `expected Result<Response, Error>, found Result<Response, RouterError>`

**Solution:** Use consistent error type in all handlers:

```rust
async fn my_handler(req: Request, ctx: Context) -> Result<Response, Error> {
    // or
async fn my_handler(req: Request, ctx: Context) -> Result<Response, RouterError> {
```

### 2. Missing service_fn Wrapper

**Error:** `trait Service<LambdaEvent<_>> not implemented`

**Solution:**

```rust
run(service_fn(router.into_service())).await  // ✅ Correct
run(router.into_service()).await  // ❌ Wrong
```

### 3. Borrow Checker Issues with ctx

**Error:** `borrow of partially moved value: ctx`

**Solution:**

```rust
let user_id = ctx.user_id.as_ref().ok_or("Unauthorized")?.clone();  // ✅
let user_id = ctx.user_id.ok_or("Unauthorized")?;  // ❌ Moves ctx
```

## Migration Checklist

- [ ] Add lambda-router to Cargo.toml
- [ ] Create Router in main()
- [ ] Convert route matching to router.METHOD() calls
- [ ] Update handlers to use Request/Response types
- [ ] Add middleware (auth, CORS, etc.)
- [ ] Test compilation with `cargo check`
- [ ] Test with sample Lambda events
- [ ] Build for deployment with `cargo build --release`
- [ ] Update infrastructure/CDK if needed
- [ ] Deploy and monitor

## Need Help?

Check the documentation:

- [README.md](./README.md) - Overview and basic usage
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Technical details
- [MIGRATION.md](./MIGRATION.md) - Detailed migration guide
- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - API reference
- [nutrition-service integration](./NUTRITION_SERVICE_INTEGRATION.md) - Real-world example

## Example Services

See these services for complete examples:

- `services/nutrition-service/src/main.rs` - Full implementation with auth
- `packages/lambda-router/examples/simple.rs` - Minimal example
- `packages/lambda-router/examples/nutrition_service_example.rs` - Complete example
