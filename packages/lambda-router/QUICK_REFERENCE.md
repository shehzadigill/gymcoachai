# Lambda Router - Quick Reference

## Installation

```toml
[dependencies]
lambda-router = { path = "../../packages/lambda-router" }
lambda_runtime = "0.8"
tokio = { version = "1.0", features = ["macros"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
```

## Basic Setup

```rust
use lambda_router::{Router, Request, Response, Context, handler};
use lambda_runtime::Error;

#[tokio::main]
async fn main() -> Result<(), Error> {
    let mut router = Router::new();

    router.get("/api/users/:userId", handler!(get_user));

    lambda_runtime::run(router.into_service()).await
}
```

## Routing Methods

```rust
router.get("/path", handler!(func));      // GET
router.post("/path", handler!(func));     // POST
router.put("/path", handler!(func));      // PUT
router.delete("/path", handler!(func));   // DELETE
router.patch("/path", handler!(func));    // PATCH
```

## Handler Signature

```rust
async fn handler_name(req: Request, ctx: Context) -> Result<Response, Error> {
    // Your logic here
    Ok(Response::ok(json!({"message": "success"})))
}
```

## Request API

### Path Parameters

```rust
let user_id = req.path_param("userId").unwrap();
let post_id = req.path_param("postId").ok_or("Missing postId")?;
```

### Query Parameters

```rust
let search = req.query("q");
let page: usize = req.query("page")
    .and_then(|s| s.parse().ok())
    .unwrap_or(1);
```

### Headers

```rust
let auth = req.header("authorization");
let content_type = req.header("content-type");
```

### JSON Body

```rust
#[derive(Deserialize)]
struct MyRequest {
    name: String,
    email: String,
}

let body: MyRequest = req.json()?;
```

### Raw Body

```rust
let raw = req.body();  // Option<&str>
```

### Context

```rust
let user_id = ctx.user_id.ok_or("Unauthorized")?;
let email = ctx.email;
let request_id = ctx.request_id;
```

### Check Preflight

```rust
if req.is_preflight() {
    return Ok(Response::cors_preflight());
}
```

## Response API

### Success Responses

```rust
Response::ok(json!({"data": value}))                    // 200
Response::created(json!({"id": "123"}))                 // 201
Response::no_content()                                   // 204
```

### Error Responses

```rust
Response::bad_request("Invalid input")                   // 400
Response::unauthorized("Token expired")                  // 401
Response::forbidden("Access denied")                     // 403
Response::not_found("Resource not found")                // 404
Response::method_not_allowed("Method not allowed")       // 405
Response::internal_error("Something went wrong")         // 500
```

### Custom Response

```rust
Response::new(201)
    .json(body)
    .header("X-Custom-Header", "value")
    .with_cors()
```

### Text Response

```rust
Response::new(200).text("Hello, World!")
```

### CORS

```rust
Response::ok(data).with_cors()  // Adds CORS headers
Response::cors_preflight()       // OPTIONS response
```

## Middleware

### Built-in Middleware

#### CORS Middleware

```rust
use lambda_router::middleware::CorsMiddleware;

router.use_middleware(CorsMiddleware::new());
```

#### Logging Middleware

```rust
use lambda_router::middleware::LoggingMiddleware;

router.use_middleware(LoggingMiddleware);
```

### Custom Middleware

```rust
use async_trait::async_trait;
use lambda_router::{Middleware, Request, Response, Next};

struct MyMiddleware;

#[async_trait]
impl Middleware for MyMiddleware {
    async fn handle(&self, req: Request, next: Next) -> Result<Response, Error> {
        // Pre-processing
        println!("Before: {} {}", req.method, req.path);

        // Call next middleware/handler
        let response = next(req).await?;

        // Post-processing
        println!("After: {}", response.status_code);

        Ok(response)
    }
}

router.use_middleware(MyMiddleware);
```

### Auth Middleware Example

```rust
use auth_layer::{AuthLayer, LambdaEvent as AuthLambdaEvent};
use once_cell::sync::Lazy;

static AUTH_LAYER: Lazy<AuthLayer> = Lazy::new(|| AuthLayer::new());

struct AuthMiddleware;

#[async_trait]
impl Middleware for AuthMiddleware {
    async fn handle(&self, mut req: Request, next: Next) -> Result<Response, Error> {
        let auth_event = AuthLambdaEvent {
            headers: Some(req.headers.clone()),
            // ... other fields
        };

        let auth_result = AUTH_LAYER.authenticate(&auth_event).await?;

        if !auth_result.is_authorized {
            return Ok(Response::forbidden("Access denied"));
        }

        req.context = req.context.with_user(
            auth_result.user_id.unwrap(),
            auth_result.email
        );

        next(req).await
    }
}
```

## Path Patterns

### Simple Path

```rust
router.get("/api/users", handler!(list_users));
```

### Single Parameter

```rust
router.get("/api/users/:userId", handler!(get_user));

async fn get_user(req: Request, ctx: Context) -> Result<Response, Error> {
    let user_id = req.path_param("userId").unwrap();
    // ...
}
```

### Multiple Parameters

```rust
router.get("/api/users/:userId/posts/:postId", handler!(get_post));

async fn get_post(req: Request, ctx: Context) -> Result<Response, Error> {
    let user_id = req.path_param("userId").unwrap();
    let post_id = req.path_param("postId").unwrap();
    // ...
}
```

### Nested Resources

```rust
router.get("/api/users/:userId/posts/:postId/comments/:commentId",
    handler!(get_comment));
```

## Common Patterns

### CRUD Operations

```rust
// Create
router.post("/api/resources", handler!(create));

// Read
router.get("/api/resources/:id", handler!(get));

// Update
router.put("/api/resources/:id", handler!(update));

// Delete
router.delete("/api/resources/:id", handler!(delete));

// List
router.get("/api/resources", handler!(list));
```

### Search with Query Params

```rust
router.get("/api/search", handler!(search));

async fn search(req: Request, ctx: Context) -> Result<Response, Error> {
    let query = req.query("q").ok_or("Missing query")?;
    let limit: usize = req.query("limit")
        .and_then(|s| s.parse().ok())
        .unwrap_or(20);
    let offset: usize = req.query("offset")
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);

    Ok(Response::ok(json!({
        "query": query,
        "limit": limit,
        "offset": offset,
        "results": []
    })))
}
```

### User-Specific Resources

```rust
router.get("/api/users/:userId/profile", handler!(get_profile));

async fn get_profile(req: Request, ctx: Context) -> Result<Response, Error> {
    let user_id = req.path_param("userId").unwrap();

    // Security: Ensure user can only access their own profile
    if ctx.user_id.as_deref() != Some(user_id) {
        return Ok(Response::forbidden("Cannot access other user's profile"));
    }

    Ok(Response::ok(json!({ "userId": user_id })))
}
```

### Optional Query Parameters

```rust
async fn list_items(req: Request, ctx: Context) -> Result<Response, Error> {
    let page: usize = req.query("page")
        .and_then(|s| s.parse().ok())
        .unwrap_or(1);

    let limit: usize = req.query("limit")
        .and_then(|s| s.parse().ok())
        .unwrap_or(20);

    let sort = req.query("sort")
        .map(|s| s.as_str())
        .unwrap_or("created_at");

    Ok(Response::ok(json!({
        "page": page,
        "limit": limit,
        "sort": sort,
        "items": []
    })))
}
```

### Date-based Queries

```rust
router.get("/api/users/:userId/meals/date/:date", handler!(get_meals_by_date));

async fn get_meals_by_date(req: Request, ctx: Context) -> Result<Response, Error> {
    let user_id = req.path_param("userId").unwrap();
    let date = req.path_param("date").unwrap();

    // Validate date format
    if !is_valid_date(date) {
        return Ok(Response::bad_request("Invalid date format"));
    }

    Ok(Response::ok(json!({
        "userId": user_id,
        "date": date,
        "meals": []
    })))
}
```

## Error Handling

### Using ? Operator

```rust
async fn handler(req: Request, ctx: Context) -> Result<Response, Error> {
    let body: MyRequest = req.json()
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    let result = service.do_something().await?;

    Ok(Response::ok(json!(result)))
}
```

### Pattern Matching

```rust
async fn handler(req: Request, ctx: Context) -> Result<Response, Error> {
    match service.do_something().await {
        Ok(data) => Ok(Response::ok(json!(data))),
        Err(e) => Ok(Response::internal_error(&e.to_string())),
    }
}
```

### Custom Error Types

```rust
use lambda_router::RouterError;

async fn handler(req: Request, ctx: Context) -> Result<Response, Error> {
    let user_id = req.path_param("userId")
        .ok_or(RouterError::BadRequest("Missing userId".to_string()))?;

    Ok(Response::ok(json!({ "userId": user_id })))
}
```

## Testing

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn mock_request(method: &str, path: &str, body: Option<&str>) -> Request {
        let event = json!({
            "requestContext": {
                "http": { "method": method },
                "requestId": "test-123"
            },
            "rawPath": path,
            "body": body,
            "headers": {},
            "queryStringParameters": {}
        });

        Request::from_lambda_event(event)
    }

    #[tokio::test]
    async fn test_get_user() {
        let req = mock_request("GET", "/api/users/user-123", None);
        let ctx = Context::new("test-123".to_string());

        let response = get_user(req, ctx).await.unwrap();

        assert_eq!(response.status_code, 200);
    }

    #[tokio::test]
    async fn test_create_user() {
        let body = r#"{"name":"John","email":"john@test.com"}"#;
        let req = mock_request("POST", "/api/users", Some(body));
        let ctx = Context::new("test-123".to_string());

        let response = create_user(req, ctx).await.unwrap();

        assert_eq!(response.status_code, 201);
    }
}
```

## Tips & Best Practices

1. **Always validate path parameters exist**

   ```rust
   let id = req.path_param("id").ok_or("Missing id")?;
   ```

2. **Use type-safe JSON parsing**

   ```rust
   #[derive(Deserialize)]
   struct Request { /* fields */ }
   let body: Request = req.json()?;
   ```

3. **Check authorization in handlers**

   ```rust
   if ctx.user_id.as_deref() != Some(user_id) {
       return Ok(Response::forbidden("Access denied"));
   }
   ```

4. **Provide clear error messages**

   ```rust
   Response::bad_request("Email is required and must be valid")
   ```

5. **Use middleware for cross-cutting concerns**
   - Authentication
   - Logging
   - CORS
   - Rate limiting
   - Request validation

6. **Keep handlers focused**
   - One responsibility per handler
   - Delegate business logic to services
   - Keep error handling consistent

7. **Document your routes**
   ```rust
   /// Get user by ID
   ///
   /// Returns user details including profile and preferences
   async fn get_user(req: Request, ctx: Context) -> Result<Response, Error> {
       // ...
   }
   ```

## Common HTTP Status Codes

- `200 OK` - Success
- `201 Created` - Resource created
- `204 No Content` - Success with no body
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not authorized
- `404 Not Found` - Resource doesn't exist
- `405 Method Not Allowed` - Wrong HTTP method
- `500 Internal Server Error` - Server error

## Environment Variables

Commonly used in Lambda:

```rust
use std::env;

let table_name = env::var("DYNAMODB_TABLE")
    .unwrap_or_else(|_| "default-table".to_string());
```

## Logging

```rust
use tracing::{info, error, debug};

async fn handler(req: Request, ctx: Context) -> Result<Response, Error> {
    info!("Processing request: {} {}", req.method, req.path);

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
