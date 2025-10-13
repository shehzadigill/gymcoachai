# Getting Started with Lambda Router

This guide will help you integrate the lambda-router crate into your Lambda service in 15 minutes.

## Prerequisites

- Rust 1.70 or later
- Cargo workspace already set up
- Existing Lambda service (or starting a new one)

## Step 1: Add Dependency (2 minutes)

In your service's `Cargo.toml`:

```toml
[dependencies]
lambda-router = { path = "../../packages/lambda-router" }
lambda_runtime = "0.8"
tokio = { version = "1.0", features = ["macros"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
async-trait = "0.1"
```

## Step 2: Update main.rs (5 minutes)

Replace your existing Lambda handler with the router:

```rust
use lambda_router::{Router, Request, Response, Context, handler};
use lambda_runtime::Error;
use serde_json::json;

// Define your handler functions
async fn hello_world(_req: Request, _ctx: Context) -> Result<Response, Error> {
    Ok(Response::ok(json!({
        "message": "Hello from Lambda Router!"
    })))
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    // Initialize tracing (optional but recommended)
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .with_target(false)
        .without_time()
        .init();

    // Create router
    let mut router = Router::new();

    // Define routes
    router.get("/", handler!(hello_world));

    // Run Lambda service
    lambda_runtime::run(router.into_service()).await
}
```

## Step 3: Build and Test (3 minutes)

```bash
cd your-service
cargo build

# Run tests
cargo test
```

## Step 4: Add Your Routes (5 minutes)

### Basic CRUD Example

```rust
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
struct CreateItemRequest {
    name: String,
    description: String,
}

#[derive(Serialize)]
struct Item {
    id: String,
    name: String,
    description: String,
}

// Create
async fn create_item(req: Request, ctx: Context) -> Result<Response, Error> {
    let body: CreateItemRequest = req.json()?;

    let item = Item {
        id: uuid::Uuid::new_v4().to_string(),
        name: body.name,
        description: body.description,
    };

    // Save to database here...

    Ok(Response::created(json!(item)))
}

// Read
async fn get_item(req: Request, ctx: Context) -> Result<Response, Error> {
    let item_id = req.path_param("itemId")
        .ok_or("Missing itemId")?;

    // Fetch from database here...

    Ok(Response::ok(json!({
        "id": item_id,
        "name": "Sample Item"
    })))
}

// Update
async fn update_item(req: Request, ctx: Context) -> Result<Response, Error> {
    let item_id = req.path_param("itemId")
        .ok_or("Missing itemId")?;

    let body: CreateItemRequest = req.json()?;

    // Update in database here...

    Ok(Response::ok(json!({
        "id": item_id,
        "message": "Updated successfully"
    })))
}

// Delete
async fn delete_item(req: Request, ctx: Context) -> Result<Response, Error> {
    let item_id = req.path_param("itemId")
        .ok_or("Missing itemId")?;

    // Delete from database here...

    Ok(Response::no_content())
}

// List
async fn list_items(req: Request, ctx: Context) -> Result<Response, Error> {
    let limit: usize = req.query("limit")
        .and_then(|s| s.parse().ok())
        .unwrap_or(20);

    // Fetch from database here...

    Ok(Response::ok(json!({
        "items": [],
        "limit": limit
    })))
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    let mut router = Router::new();

    // Register CRUD routes
    router.post("/api/items", handler!(create_item));
    router.get("/api/items/:itemId", handler!(get_item));
    router.put("/api/items/:itemId", handler!(update_item));
    router.delete("/api/items/:itemId", handler!(delete_item));
    router.get("/api/items", handler!(list_items));

    lambda_runtime::run(router.into_service()).await
}
```

## Step 5: Add Authentication (Optional)

If you're using the auth-layer:

```rust
use auth_layer::{AuthLayer, LambdaEvent as AuthLambdaEvent};
use lambda_router::{Middleware, Next};
use async_trait::async_trait;
use once_cell::sync::Lazy;

static AUTH_LAYER: Lazy<AuthLayer> = Lazy::new(|| AuthLayer::new());

struct AuthMiddleware;

#[async_trait]
impl Middleware for AuthMiddleware {
    async fn handle(&self, mut req: Request, next: Next) -> Result<Response, Error> {
        // Convert request to auth event
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
            return Ok(Response::forbidden("Access denied"));
        }

        // Add user to context
        if let Some(user_id) = auth_result.user_id {
            req.set_context(Context::new(req.context.request_id.clone())
                .with_user(user_id, auth_result.email));
        }

        next(req).await
    }
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    let mut router = Router::new();

    // Add auth middleware - all routes will require authentication
    router.use_middleware(AuthMiddleware);

    // Define protected routes
    router.get("/api/profile", handler!(get_profile));
    router.put("/api/profile", handler!(update_profile));

    lambda_runtime::run(router.into_service()).await
}

async fn get_profile(req: Request, ctx: Context) -> Result<Response, Error> {
    let user_id = ctx.user_id.ok_or("Unauthorized")?;

    Ok(Response::ok(json!({
        "userId": user_id,
        "email": ctx.email
    })))
}
```

## Step 6: Deploy

```bash
# Build for Lambda
cargo build --release --target x86_64-unknown-linux-musl

# Or use your existing build script
./scripts/build-lambdas.sh
```

## Common Patterns

### Pattern 1: User-Specific Routes

```rust
router.get("/api/users/:userId/items", handler!(get_user_items));

async fn get_user_items(req: Request, ctx: Context) -> Result<Response, Error> {
    let user_id = req.path_param("userId").ok_or("Missing userId")?;

    // Security: Ensure user can only access their own items
    if ctx.user_id.as_deref() != Some(user_id) {
        return Ok(Response::forbidden("Cannot access other user's items"));
    }

    Ok(Response::ok(json!({ "items": [] })))
}
```

### Pattern 2: Search with Filters

```rust
router.get("/api/search", handler!(search));

async fn search(req: Request, ctx: Context) -> Result<Response, Error> {
    let query = req.query("q").ok_or("Missing query parameter")?;
    let category = req.query("category");
    let limit: usize = req.query("limit")
        .and_then(|s| s.parse().ok())
        .unwrap_or(20);

    Ok(Response::ok(json!({
        "query": query,
        "category": category,
        "limit": limit,
        "results": []
    })))
}
```

### Pattern 3: Nested Resources

```rust
router.get("/api/users/:userId/posts/:postId/comments",
    handler!(get_comments));

async fn get_comments(req: Request, ctx: Context) -> Result<Response, Error> {
    let user_id = req.path_param("userId").ok_or("Missing userId")?;
    let post_id = req.path_param("postId").ok_or("Missing postId")?;

    Ok(Response::ok(json!({
        "userId": user_id,
        "postId": post_id,
        "comments": []
    })))
}
```

### Pattern 4: Date-based Queries

```rust
router.get("/api/users/:userId/items/date/:date", handler!(get_items_by_date));

async fn get_items_by_date(req: Request, ctx: Context) -> Result<Response, Error> {
    let user_id = req.path_param("userId").ok_or("Missing userId")?;
    let date = req.path_param("date").ok_or("Missing date")?;

    // Validate date format
    if !is_valid_date_format(date) {
        return Ok(Response::bad_request("Invalid date format. Use YYYY-MM-DD"));
    }

    Ok(Response::ok(json!({
        "userId": user_id,
        "date": date,
        "items": []
    })))
}

fn is_valid_date_format(date: &str) -> bool {
    // Simple validation - enhance as needed
    date.len() == 10 && date.chars().nth(4) == Some('-') && date.chars().nth(7) == Some('-')
}
```

## Testing Your Routes

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn mock_event(method: &str, path: &str, body: Option<&str>) -> serde_json::Value {
        json!({
            "requestContext": {
                "http": { "method": method },
                "requestId": "test-123"
            },
            "rawPath": path,
            "body": body,
            "headers": {},
            "queryStringParameters": {}
        })
    }

    #[tokio::test]
    async fn test_get_item() {
        let event = mock_event("GET", "/api/items/item-123", None);
        let req = Request::from_lambda_event(event);
        let ctx = Context::new("test-123".to_string());

        let response = get_item(req, ctx).await.unwrap();

        assert_eq!(response.status_code, 200);
    }

    #[tokio::test]
    async fn test_create_item() {
        let body = r#"{"name":"Test Item","description":"A test"}"#;
        let event = mock_event("POST", "/api/items", Some(body));
        let req = Request::from_lambda_event(event);
        let ctx = Context::new("test-123".to_string());

        let response = create_item(req, ctx).await.unwrap();

        assert_eq!(response.status_code, 201);
    }
}
```

## Debugging

### Enable Logging

```rust
#[tokio::main]
async fn main() -> Result<(), Error> {
    // Add detailed logging
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::DEBUG)
        .with_target(true)
        .with_line_number(true)
        .init();

    // Your router setup...
}
```

### Log in Handlers

```rust
use tracing::{info, error, debug};

async fn my_handler(req: Request, ctx: Context) -> Result<Response, Error> {
    debug!("Request: {:?}", req);
    info!("Processing request for user: {:?}", ctx.user_id);

    match do_something().await {
        Ok(result) => {
            info!("Success");
            Ok(Response::ok(json!(result)))
        }
        Err(e) => {
            error!("Error: {}", e);
            Ok(Response::internal_error(&e.to_string()))
        }
    }
}
```

## Troubleshooting

### Common Issues

**Issue: Route not matching**

- Check path pattern syntax
- Ensure method matches (GET, POST, etc.)
- Verify path starts with `/`

**Issue: Path parameter is None**

- Check parameter name matches pattern
- Use `.ok_or()` for better error messages

**Issue: JSON parsing fails**

- Validate request body structure
- Check Deserialize implementation
- Add logging to see raw body

**Issue: CORS errors**

- CORS middleware is added by default
- Check browser console for specific error
- Verify CloudFront CORS configuration

## Next Steps

1. ✅ Basic routes working
2. → Add database integration
3. → Add authentication
4. → Add custom middleware
5. → Deploy to Lambda
6. → Monitor and optimize

## Need Help?

- Check `README.md` for full documentation
- See `QUICK_REFERENCE.md` for API reference
- Look at `examples/` for complete examples
- Review `ARCHITECTURE.md` for deep dive

## Tips for Success

1. **Start Simple** - Begin with basic routes, add complexity gradually
2. **Test Locally** - Use cargo test before deploying
3. **Add Logging** - Debug issues faster with good logging
4. **Validate Input** - Always validate user input
5. **Handle Errors** - Provide clear error messages
6. **Security First** - Verify authorization in handlers
7. **Document Routes** - Add doc comments to handlers

## Congratulations! 🎉

You now have a modern, Express-like routing system for your Lambda functions!

Your Lambda service is now:

- ✅ Easier to maintain
- ✅ More testable
- ✅ Better organized
- ✅ Type-safe
- ✅ Production-ready
