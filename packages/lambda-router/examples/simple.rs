// Simple minimal example of using lambda-router

use lambda_router::{Router, Request, Response, Context, handler};
use lambda_runtime::Error;
use serde_json::json;

// Simple GET handler
async fn hello_world(_req: Request, _ctx: Context) -> Result<Response, Error> {
    Ok(Response::ok(json!({
        "message": "Hello, World!",
        "version": "1.0"
    })))
}

// Handler with path parameter
async fn get_user(req: Request, _ctx: Context) -> Result<Response, Error> {
    let user_id = req.path_param("userId")
        .ok_or("Missing userId parameter")?;
    
    Ok(Response::ok(json!({
        "userId": user_id,
        "name": "John Doe",
        "email": "john@example.com"
    })))
}

// POST handler with JSON body
async fn create_user(req: Request, _ctx: Context) -> Result<Response, Error> {
    #[derive(serde::Deserialize)]
    struct CreateUserRequest {
        name: String,
        email: String,
    }
    
    let body: CreateUserRequest = req.json()
        .map_err(|e| format!("Invalid JSON: {}", e))?;
    
    Ok(Response::created(json!({
        "id": "user-123",
        "name": body.name,
        "email": body.email,
        "created": true
    })))
}

// Handler with query parameters
async fn search_users(req: Request, _ctx: Context) -> Result<Response, Error> {
    let query = req.query("q").unwrap_or(&"".to_string()).clone();
    let limit: usize = req.query("limit")
        .and_then(|s| s.parse().ok())
        .unwrap_or(10);
    
    Ok(Response::ok(json!({
        "query": query,
        "limit": limit,
        "results": []
    })))
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    // Create router
    let mut router = Router::new();
    
    // Define routes
    router.get("/", handler!(hello_world));
    router.get("/api/users/:userId", handler!(get_user));
    router.post("/api/users", handler!(create_user));
    router.get("/api/users/search", handler!(search_users));
    
    // Run Lambda service
    lambda_runtime::run(router.into_service()).await
}
