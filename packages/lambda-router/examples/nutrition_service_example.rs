// Example: Refactored nutrition-service using lambda-router
//
// This is an example showing how to migrate your existing nutrition-service
// to use the new lambda-router crate.

use lambda_router::{Router, Request, Response, Context, Middleware, Next, handler};
use lambda_runtime::Error;
use async_trait::async_trait;
use once_cell::sync::{Lazy, OnceCell};
use std::sync::Arc;
use aws_sdk_dynamodb::Client as DynamoDbClient;
use aws_sdk_s3::Client as S3Client;
use aws_config::meta::region::RegionProviderChain;
use auth_layer::{AuthLayer, LambdaEvent as AuthLambdaEvent};
use serde_json::json;

// Global clients for cold start optimization
static DYNAMODB_CLIENT: OnceCell<Arc<DynamoDbClient>> = OnceCell::new();
static S3_CLIENT: OnceCell<Arc<S3Client>> = OnceCell::new();
static AUTH_LAYER: Lazy<AuthLayer> = Lazy::new(|| AuthLayer::new());

// Custom authentication middleware
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
            path_parameters: req.path_params
                .iter()
                .map(|(k, v)| (k.clone(), v.clone()))
                .collect::<std::collections::HashMap<_, _>>()
                .into(),
            query_string_parameters: req.query_params
                .iter()
                .map(|(k, v)| (k.clone(), v.clone()))
                .collect::<std::collections::HashMap<_, _>>()
                .into(),
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
        if let Some(user_id) = auth_result.user_id {
            req.set_context(Context::new(req.context.request_id.clone())
                .with_user(user_id, auth_result.email));
        }

        next(req).await
    }
}

// Logging middleware
struct RequestLogger;

#[async_trait]
impl Middleware for RequestLogger {
    async fn handle(&self, req: Request, next: Next) -> Result<Response, Error> {
        tracing::info!("→ {} {} (request_id: {})", 
            req.method, req.path, req.context.request_id);
        
        let start = std::time::Instant::now();
        let response = next(req).await;
        let duration = start.elapsed();
        
        match &response {
            Ok(resp) => {
                tracing::info!("← {} ({:?})", resp.status_code, duration);
            }
            Err(e) => {
                tracing::error!("✗ Error: {} ({:?})", e, duration);
            }
        }
        
        response
    }
}

// Handler functions
async fn create_meal(req: Request, ctx: Context) -> Result<Response, Error> {
    let user_id = ctx.user_id.ok_or("Unauthorized")?;
    
    #[derive(serde::Deserialize)]
    struct CreateMealRequest {
        name: String,
        calories: f32,
        date: String,
    }
    
    let body: CreateMealRequest = req.json()
        .map_err(|e| format!("Invalid JSON: {}", e))?;
    
    // Your business logic here...
    let db_client = DYNAMODB_CLIENT.get().unwrap();
    
    Ok(Response::created(json!({
        "id": "meal-123",
        "userId": user_id,
        "name": body.name,
        "calories": body.calories,
        "date": body.date
    })))
}

async fn get_meals(req: Request, ctx: Context) -> Result<Response, Error> {
    let user_id = req.path_param("userId")
        .ok_or("Missing userId")?;
    
    let date = req.query("date");
    
    // Your business logic here...
    let db_client = DYNAMODB_CLIENT.get().unwrap();
    
    Ok(Response::ok(json!({
        "meals": [],
        "userId": user_id,
        "date": date
    })))
}

async fn get_meal(req: Request, ctx: Context) -> Result<Response, Error> {
    let user_id = req.path_param("userId")
        .ok_or("Missing userId")?;
    let meal_id = req.path_param("mealId")
        .ok_or("Missing mealId")?;
    
    // Your business logic here...
    
    Ok(Response::ok(json!({
        "id": meal_id,
        "userId": user_id
    })))
}

async fn update_meal(req: Request, ctx: Context) -> Result<Response, Error> {
    let meal_id = req.path_param("mealId")
        .ok_or("Missing mealId")?;
    
    #[derive(serde::Deserialize)]
    struct UpdateMealRequest {
        name: Option<String>,
        calories: Option<f32>,
    }
    
    let body: UpdateMealRequest = req.json()
        .map_err(|e| format!("Invalid JSON: {}", e))?;
    
    // Your business logic here...
    
    Ok(Response::ok(json!({
        "id": meal_id,
        "message": "Updated successfully"
    })))
}

async fn delete_meal(req: Request, ctx: Context) -> Result<Response, Error> {
    let meal_id = req.path_param("mealId")
        .ok_or("Missing mealId")?;
    
    // Your business logic here...
    
    Ok(Response::no_content())
}

async fn search_foods(req: Request, ctx: Context) -> Result<Response, Error> {
    let query = req.query("q")
        .ok_or("Missing query parameter")?;
    
    // Your business logic here...
    
    Ok(Response::ok(json!({
        "foods": [],
        "query": query
    })))
}

async fn get_nutrition_stats(req: Request, ctx: Context) -> Result<Response, Error> {
    let user_id = req.path_param("userId")
        .ok_or("Missing userId")?;
    
    let start_date = req.query("startDate");
    let end_date = req.query("endDate");
    
    // Your business logic here...
    
    Ok(Response::ok(json!({
        "userId": user_id,
        "stats": {
            "totalCalories": 2000,
            "totalProtein": 150,
            "totalCarbs": 200,
            "totalFat": 70
        },
        "period": {
            "start": start_date,
            "end": end_date
        }
    })))
}

async fn set_water_intake(req: Request, ctx: Context) -> Result<Response, Error> {
    let user_id = req.path_param("userId")
        .ok_or("Missing userId")?;
    let date = req.path_param("date")
        .ok_or("Missing date")?;
    
    #[derive(serde::Deserialize)]
    struct SetWaterRequest {
        amount: f32,
    }
    
    let body: SetWaterRequest = req.json()
        .map_err(|e| format!("Invalid JSON: {}", e))?;
    
    // Your business logic here...
    
    Ok(Response::ok(json!({
        "userId": user_id,
        "date": date,
        "amount": body.amount
    })))
}

async fn add_favorite_food(req: Request, ctx: Context) -> Result<Response, Error> {
    let user_id = req.path_param("userId")
        .ok_or("Missing userId")?;
    let food_id = req.path_param("foodId")
        .ok_or("Missing foodId")?;
    
    // Your business logic here...
    
    Ok(Response::created(json!({
        "userId": user_id,
        "foodId": food_id
    })))
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .with_target(false)
        .without_time()
        .init();

    // Initialize global clients
    if DYNAMODB_CLIENT.get().is_none() || S3_CLIENT.get().is_none() {
        let region_provider = RegionProviderChain::default_provider();
        let config = aws_config::from_env().region(region_provider).load().await;
        let _ = DYNAMODB_CLIENT.set(Arc::new(DynamoDbClient::new(&config)));
        let _ = S3_CLIENT.set(Arc::new(S3Client::new(&config)));
    }
    let _ = &*AUTH_LAYER;

    // Create router
    let mut router = Router::new();
    
    // Add middleware
    router.use_middleware(RequestLogger);
    router.use_middleware(AuthMiddleware);
    
    // Meal routes
    router.post("/api/nutrition/users/:userId/meals", handler!(create_meal));
    router.get("/api/nutrition/users/:userId/meals", handler!(get_meals));
    router.get("/api/nutrition/users/:userId/meals/:mealId", handler!(get_meal));
    router.put("/api/nutrition/users/:userId/meals/:mealId", handler!(update_meal));
    router.delete("/api/nutrition/users/:userId/meals/:mealId", handler!(delete_meal));
    
    // Food routes
    router.get("/api/nutrition/foods/search", handler!(search_foods));
    
    // Favorite routes
    router.post("/api/nutrition/users/:userId/favorites/foods/:foodId", handler!(add_favorite_food));
    
    // Stats routes
    router.get("/api/nutrition/users/:userId/stats", handler!(get_nutrition_stats));
    
    // Water routes
    router.post("/api/nutrition/users/:userId/water/date/:date", handler!(set_water_intake));
    
    // Alternative paths for backward compatibility
    router.post("/api/users/:userId/meals", handler!(create_meal));
    router.get("/api/users/:userId/meals", handler!(get_meals));
    
    // Run Lambda service
    lambda_runtime::run(router.into_service()).await
}
