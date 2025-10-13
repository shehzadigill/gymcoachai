# Lambda Router

A lightweight, Express-like REST API routing framework for AWS Lambda functions behind CloudFront. This crate provides an elegant way to handle HTTP routing, middleware, authentication, and CORS for serverless applications.

## Features

- 🚀 **Express-like API** - Familiar routing patterns with `router.get()`, `router.post()`, etc.
- 🔒 **Authentication Support** - Built-in support for auth middleware via Lambda layers
- 🌐 **CORS Handling** - Automatic CORS preflight and header management
- 📦 **Path Parameters** - Extract parameters from URLs (`/users/:userId`)
- 🔄 **Middleware Chain** - Composable middleware for logging, auth, validation, etc.
- ⚡ **Performance** - Optimized for Lambda cold starts with minimal dependencies
- 🎯 **Type Safety** - Full Rust type safety for requests and responses
- 📝 **JSON Body Parsing** - Automatic JSON serialization/deserialization

## Installation

Add to your `Cargo.toml`:

```toml
[dependencies]
lambda-router = { path = "../../packages/lambda-router" }
lambda_runtime = "0.8"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1.0", features = ["macros"] }
```

## Quick Start

### Basic Example

```rust
use lambda_router::{Router, Request, Response, Context, handler};
use lambda_runtime::Error;
use serde_json::json;

async fn get_user(req: Request, ctx: Context) -> Result<Response, Error> {
    let user_id = req.path_param("userId").unwrap();

    Ok(Response::ok(json!({
        "userId": user_id,
        "name": "John Doe",
        "email": "john@example.com"
    })))
}

async fn create_user(req: Request, ctx: Context) -> Result<Response, Error> {
    #[derive(Deserialize)]
    struct CreateUserRequest {
        name: String,
        email: String,
    }

    let body: CreateUserRequest = req.json()?;

    Ok(Response::created(json!({
        "userId": "new-user-id",
        "name": body.name,
        "email": body.email
    })))
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    let mut router = Router::new();

    // Define routes
    router.get("/api/users/:userId", handler!(get_user));
    router.post("/api/users", handler!(create_user));

    // Run Lambda service
    lambda_runtime::run(router.into_service()).await
}
```

### With Middleware

```rust
use lambda_router::{Router, Request, Response, Context, Middleware, Next, handler};
use async_trait::async_trait;
use lambda_runtime::Error;

// Custom authentication middleware
struct AuthMiddleware;

#[async_trait]
impl Middleware for AuthMiddleware {
    async fn handle(&self, mut req: Request, next: Next) -> Result<Response, Error> {
        // Check authorization header
        if let Some(token) = req.header("authorization") {
            // Validate token and add user info to context
            let user_id = validate_token(token).await?;
            req.context = req.context.with_user(user_id, None);
            next(req).await
        } else {
            Ok(Response::unauthorized("Missing authorization header"))
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    let mut router = Router::new();

    // Add middleware
    router.use_middleware(AuthMiddleware);

    // Define protected routes
    router.get("/api/profile", handler!(get_profile));

    lambda_runtime::run(router.into_service()).await
}
```

### Complete Service Example

```rust
use lambda_router::{Router, Request, Response, Context, handler};
use lambda_runtime::Error;
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Deserialize)]
struct CreateMealRequest {
    name: String,
    calories: f32,
    date: String,
}

#[derive(Serialize)]
struct Meal {
    id: String,
    user_id: String,
    name: String,
    calories: f32,
    date: String,
}

async fn create_meal(req: Request, ctx: Context) -> Result<Response, Error> {
    let user_id = ctx.user_id.ok_or("Unauthorized")?;
    let body: CreateMealRequest = req.json()?;

    let meal = Meal {
        id: uuid::Uuid::new_v4().to_string(),
        user_id,
        name: body.name,
        calories: body.calories,
        date: body.date,
    };

    // Save to database...

    Ok(Response::created(json!(meal)))
}

async fn get_meals(req: Request, ctx: Context) -> Result<Response, Error> {
    let user_id = ctx.user_id.ok_or("Unauthorized")?;
    let date = req.query("date");

    // Fetch from database...

    Ok(Response::ok(json!({
        "meals": [],
        "date": date
    })))
}

async fn get_meal(req: Request, ctx: Context) -> Result<Response, Error> {
    let user_id = ctx.user_id.ok_or("Unauthorized")?;
    let meal_id = req.path_param("mealId").ok_or("Missing mealId")?;

    // Fetch from database...

    Ok(Response::ok(json!({
        "id": meal_id,
        "userId": user_id
    })))
}

async fn update_meal(req: Request, ctx: Context) -> Result<Response, Error> {
    let user_id = ctx.user_id.ok_or("Unauthorized")?;
    let meal_id = req.path_param("mealId").ok_or("Missing mealId")?;
    let body: CreateMealRequest = req.json()?;

    // Update in database...

    Ok(Response::ok(json!({
        "id": meal_id,
        "message": "Updated successfully"
    })))
}

async fn delete_meal(req: Request, ctx: Context) -> Result<Response, Error> {
    let user_id = ctx.user_id.ok_or("Unauthorized")?;
    let meal_id = req.path_param("mealId").ok_or("Missing mealId")?;

    // Delete from database...

    Ok(Response::no_content())
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    let mut router = Router::new();

    // Meal routes
    router.post("/api/users/:userId/meals", handler!(create_meal));
    router.get("/api/users/:userId/meals", handler!(get_meals));
    router.get("/api/users/:userId/meals/:mealId", handler!(get_meal));
    router.put("/api/users/:userId/meals/:mealId", handler!(update_meal));
    router.delete("/api/users/:userId/meals/:mealId", handler!(delete_meal));

    lambda_runtime::run(router.into_service()).await
}
```

## API Reference

### Router

```rust
let mut router = Router::new();

// HTTP methods
router.get("/path", handler);
router.post("/path", handler);
router.put("/path", handler);
router.delete("/path", handler);
router.patch("/path", handler);

// Middleware
router.use_middleware(middleware);

// Custom 404 handler
router.not_found(handler);

// Convert to Lambda service
lambda_runtime::run(router.into_service()).await
```

### Request

```rust
// Path parameters
let user_id = req.path_param("userId").unwrap();

// Query parameters
let page = req.query("page");

// Headers
let auth = req.header("authorization");

// JSON body
let body: MyStruct = req.json()?;

// Raw body
let raw = req.body();

// Context
let user_id = req.context.user_id;
```

### Response

```rust
// Success responses
Response::ok(json!({"message": "Success"}))
Response::created(json!({"id": "123"}))
Response::no_content()

// Error responses
Response::bad_request("Invalid input")
Response::unauthorized("Token expired")
Response::forbidden("Access denied")
Response::not_found("Resource not found")
Response::internal_error("Something went wrong")

// Custom response
Response::new(201)
    .json(body)
    .header("X-Custom", "value")
    .with_cors()
```

### Middleware

```rust
use async_trait::async_trait;

struct MyMiddleware;

#[async_trait]
impl Middleware for MyMiddleware {
    async fn handle(&self, req: Request, next: Next) -> Result<Response, Error> {
        // Pre-processing
        println!("Before handler");

        // Call next middleware/handler
        let response = next(req).await?;

        // Post-processing
        println!("After handler");

        Ok(response)
    }
}

router.use_middleware(MyMiddleware);
```

## Path Patterns

Supports Express-like path patterns with parameters:

```rust
router.get("/api/users/:userId", handler);
router.get("/api/users/:userId/posts/:postId", handler);
router.get("/api/nutrition/users/:userId/meals/:mealId", handler);
```

## Integration with Auth Layer

```rust
use auth_layer::{AuthLayer, LambdaEvent as AuthLambdaEvent};
use lambda_router::{Router, Request, Context};

static AUTH_LAYER: Lazy<AuthLayer> = Lazy::new(|| AuthLayer::new());

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

        // Add user context
        req.context = req.context.with_user(
            auth_result.user_id.unwrap(),
            auth_result.email
        );

        next(req).await
    }
}
```

## Performance Optimization

The router is designed for Lambda cold start optimization:

- Minimal dependencies
- Lazy static initialization
- Zero-copy where possible
- Compiled with `opt-level = "z"` for size optimization

## License

MIT
