# Lambda Router - Serverless Express for Rust

## Overview

**lambda-router** is a lightweight, Express.js-inspired REST API routing framework specifically designed for AWS Lambda functions behind CloudFront. It provides an elegant, type-safe way to handle HTTP routing, middleware, authentication, and CORS for serverless applications written in Rust.

## 🎯 Project Goals

The goal was to create a separate Rust module/crate that works like serverless Express, handling REST API routing for Lambda functions that are:

- Behind CloudFront
- Using Lambda layers for authentication
- Need clean, maintainable routing patterns
- Require middleware support

## ✨ Key Features

### 1. **Express-like Routing**

Clean, declarative routing API similar to Express.js:

```rust
router.get("/api/users/:userId", handler!(get_user));
router.post("/api/users", handler!(create_user));
router.put("/api/users/:userId", handler!(update_user));
router.delete("/api/users/:userId", handler!(delete_user));
```

### 2. **Path Parameters**

Automatic extraction of URL parameters:

```rust
let user_id = req.path_param("userId").unwrap();
let post_id = req.path_param("postId").unwrap();
```

### 3. **Middleware Support**

Composable middleware chain for cross-cutting concerns:

```rust
router.use_middleware(LoggingMiddleware);
router.use_middleware(AuthMiddleware);
router.use_middleware(ValidationMiddleware);
```

### 4. **Automatic CORS**

Built-in CORS handling with preflight support:

- Automatic OPTIONS handling
- Configurable CORS headers
- Per-route or global CORS settings

### 5. **Type-Safe JSON**

Automatic JSON parsing with Serde:

```rust
#[derive(Deserialize)]
struct CreateUserRequest {
    name: String,
    email: String,
}

let body: CreateUserRequest = req.json()?;
```

### 6. **Query Parameters**

Easy query string access:

```rust
let search = req.query("q");
let limit: usize = req.query("limit")
    .and_then(|s| s.parse().ok())
    .unwrap_or(20);
```

### 7. **Rich Response Builders**

Convenient response constructors:

```rust
Response::ok(json!(data))           // 200
Response::created(json!(data))      // 201
Response::bad_request("message")    // 400
Response::unauthorized("message")   // 401
Response::forbidden("message")      // 403
Response::not_found("message")      // 404
Response::internal_error("message") // 500
```

### 8. **Context Management**

Request context for passing data through middleware:

```rust
req.context.user_id    // User ID from auth
req.context.email      // User email
req.context.custom     // Custom data
```

## 📦 Module Structure

```
packages/lambda-router/
├── Cargo.toml              # Dependencies and metadata
├── README.md               # User-facing documentation
├── MIGRATION.md            # Migration guide from old routing
├── .gitignore
├── src/
│   ├── lib.rs              # Main exports
│   ├── router.rs           # Core Router implementation
│   ├── request.rs          # Request type and parsing
│   ├── response.rs         # Response builder
│   ├── middleware.rs       # Middleware trait and built-ins
│   ├── matcher.rs          # Path pattern matching
│   ├── error.rs            # Error types
│   └── cors.rs             # CORS configuration
└── examples/
    ├── simple.rs           # Basic usage example
    └── nutrition_service_example.rs  # Full service example
```

## 🔧 Technical Architecture

### Request Flow

```
Lambda Event
    ↓
Request Parser (request.rs)
    ↓
CORS Preflight Check
    ↓
Middleware Chain (middleware.rs)
    ↓
Route Matcher (matcher.rs)
    ↓
Handler Function
    ↓
Response Builder (response.rs)
    ↓
Lambda Response
```

### Path Matching Algorithm

The router uses regex-based path matching:

1. Convert Express-style patterns (`:param`) to regex
2. Extract parameter names
3. Compile regex for efficient matching
4. Cache compiled patterns

Example:

```
Pattern: /api/users/:userId/posts/:postId
Regex:   ^/api/users/([^/]+)/posts/([^/]+)$
Params:  ["userId", "postId"]
```

### Middleware Chain

Middleware executes in order with a `Next` function:

```rust
Middleware 1 (Auth) → Middleware 2 (Logging) → Handler → Response
       ↓                      ↓                     ↑          ↑
    next()                 next()              Ok(response)   |
       └────────────────────────────────────────────┘─────────┘
```

## 🚀 Performance Optimizations

1. **Zero-Copy Parsing**: Borrows from Lambda event where possible
2. **Lazy Regex Compilation**: Uses `lazy_static` for pattern caching
3. **Arc-based Sharing**: Minimal cloning with `Arc<>` wrappers
4. **Size Optimization**: Compiled with `opt-level = "z"` for smaller binaries
5. **LTO**: Link-time optimization enabled

## 🔌 Integration Points

### With Auth Layer

```rust
use auth_layer::{AuthLayer, LambdaEvent as AuthLambdaEvent};

struct AuthMiddleware;

impl Middleware for AuthMiddleware {
    async fn handle(&self, mut req: Request, next: Next) -> Result<Response, Error> {
        // Convert to auth event
        let auth_event = AuthLambdaEvent { /* ... */ };

        // Authenticate
        let auth_result = AUTH_LAYER.authenticate(&auth_event).await?;

        // Add to context
        req.context = req.context.with_user(auth_result.user_id, auth_result.email);

        next(req).await
    }
}
```

### With DynamoDB

```rust
// Global client (cold start optimization)
static DYNAMODB_CLIENT: OnceCell<Arc<DynamoDbClient>> = OnceCell::new();

async fn get_user(req: Request, ctx: Context) -> Result<Response, Error> {
    let db = DYNAMODB_CLIENT.get().unwrap();
    let user_id = req.path_param("userId").unwrap();

    // Query DynamoDB
    let result = db.get_item()
        .table_name("Users")
        .key("userId", AttributeValue::S(user_id.clone()))
        .send()
        .await?;

    Ok(Response::ok(json!(result.item)))
}
```

### With CloudFront

The router is designed for Lambda@Edge and Lambda Function URLs behind CloudFront:

```
Client → CloudFront → Lambda Function URL → Lambda Router → Handler
           ↓
      (caching)
```

## 📝 Usage Patterns

### Pattern 1: CRUD API

```rust
// Users CRUD
router.post("/api/users", handler!(create_user));
router.get("/api/users/:userId", handler!(get_user));
router.put("/api/users/:userId", handler!(update_user));
router.delete("/api/users/:userId", handler!(delete_user));
router.get("/api/users", handler!(list_users));
```

### Pattern 2: Nested Resources

```rust
// User's posts
router.get("/api/users/:userId/posts", handler!(get_user_posts));
router.post("/api/users/:userId/posts", handler!(create_post));
router.get("/api/users/:userId/posts/:postId", handler!(get_post));
```

### Pattern 3: Search Endpoints

```rust
// Search with query params
router.get("/api/search", handler!(search));

async fn search(req: Request, _ctx: Context) -> Result<Response, Error> {
    let query = req.query("q").ok_or("Missing query")?;
    let filter = req.query("filter");
    // ...
}
```

### Pattern 4: Authenticated Routes

```rust
router.use_middleware(AuthMiddleware);  // All routes require auth

router.get("/api/profile", handler!(get_profile));
router.put("/api/profile", handler!(update_profile));

async fn get_profile(req: Request, ctx: Context) -> Result<Response, Error> {
    let user_id = ctx.user_id.ok_or("Unauthorized")?;
    // User is authenticated, user_id is available
    Ok(Response::ok(json!({ "userId": user_id })))
}
```

## 🧪 Testing

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[tokio::test]
    async fn test_create_user() {
        let event = json!({
            "requestContext": {
                "http": { "method": "POST" },
                "requestId": "test-123"
            },
            "rawPath": "/api/users",
            "body": r#"{"name":"John","email":"john@test.com"}"#
        });

        let req = Request::from_lambda_event(event);
        let ctx = Context::new("test-123".to_string());

        let response = create_user(req, ctx).await.unwrap();
        assert_eq!(response.status_code, 201);
    }
}
```

## 📊 Comparison: Before vs After

### Before (Custom Routing)

```rust
// ~200 lines in main.rs
async fn handler(event: LambdaEvent<Value>) -> Result<Value, Error> {
    // Manual parsing
    let method = event["requestContext"]["http"]["method"].as_str().unwrap_or("GET");
    let path = event["rawPath"].as_str().unwrap_or("/");

    // Manual CORS
    if method == "OPTIONS" { return Ok(cors_response()); }

    // Manual auth
    let auth_result = AUTH_LAYER.authenticate(&event).await?;
    if !auth_result.is_authorized { return Ok(forbidden()); }

    // Manual routing
    match (method, path) {
        ("POST", path) if path.ends_with("/meals") => {
            // Extract user_id manually
            let user_id = extract_from_path(path)?;
            // Parse body manually
            let body = serde_json::from_str(event["body"].as_str()?)?;
            // Call controller
            create_meal(&user_id, body).await?
        }
        // ... 50+ more match arms
    }
}
```

### After (With Router)

```rust
// ~50 lines in main.rs
#[tokio::main]
async fn main() -> Result<(), Error> {
    let mut router = Router::new();

    router.use_middleware(AuthMiddleware);

    router.post("/api/users/:userId/meals", handler!(create_meal));
    router.get("/api/users/:userId/meals", handler!(get_meals));
    // ... clean route definitions

    lambda_runtime::run(router.into_service()).await
}

// Handler is simple and focused
async fn create_meal(req: Request, ctx: Context) -> Result<Response, Error> {
    let user_id = req.path_param("userId").unwrap();
    let body: CreateMealRequest = req.json()?;

    let meal = meal_service.create(&user_id, body).await?;
    Ok(Response::created(json!(meal)))
}
```

### Benefits

- ✅ **60% less boilerplate code**
- ✅ **Type-safe throughout**
- ✅ **Easier to test**
- ✅ **Better separation of concerns**
- ✅ **Reusable across services**
- ✅ **Self-documenting routes**

## 🔒 Security Considerations

1. **Input Validation**: Always validate user input
2. **Path Traversal**: Router prevents path traversal attacks
3. **Auth Context**: Verify `ctx.user_id` matches path parameters
4. **CORS**: Configure restrictive CORS in production
5. **Error Messages**: Don't leak sensitive info in error responses

Example security pattern:

```rust
async fn get_user_data(req: Request, ctx: Context) -> Result<Response, Error> {
    let user_id = req.path_param("userId").ok_or("Missing userId")?;

    // Security: Ensure user can only access their own data
    if ctx.user_id.as_deref() != Some(user_id) {
        return Ok(Response::forbidden("Cannot access other user's data"));
    }

    // Proceed with authorized request
    // ...
}
```

## 📈 Future Enhancements

Potential future additions:

- [ ] Rate limiting middleware
- [ ] Request validation middleware (with validator crate)
- [ ] OpenAPI/Swagger generation
- [ ] Metrics/tracing integration
- [ ] Response caching middleware
- [ ] Request/response logging middleware
- [ ] JWT token parsing utilities
- [ ] WebSocket support
- [ ] GraphQL integration

## 🤝 Contributing

To add new features or improve the router:

1. Add new middleware in `middleware.rs`
2. Extend `Request` or `Response` in respective files
3. Add tests in test modules
4. Update examples and documentation
5. Ensure `cargo check` passes
6. Run `cargo test` for all tests

## 📚 Additional Resources

- [AWS Lambda Rust Runtime](https://github.com/awslabs/aws-lambda-rust-runtime)
- [Express.js Routing](https://expressjs.com/en/guide/routing.html)
- [Rust Async Book](https://rust-lang.github.io/async-book/)
- [Serde JSON Documentation](https://docs.serde.rs/serde_json/)

## 📄 License

MIT License - See LICENSE file for details

---

**Built with ❤️ for serverless Rust applications**
