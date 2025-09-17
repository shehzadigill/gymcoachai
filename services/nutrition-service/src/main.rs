use lambda_runtime::{service_fn, Error, LambdaEvent};
use serde_json::{json, Value};
use aws_sdk_dynamodb::{Client as DynamoDbClient};
use aws_config::meta::region::RegionProviderChain;
use std::sync::Arc;
use once_cell::sync::Lazy;
use tracing::{info, error};
use anyhow::Result;

mod models;
mod database;
mod handlers;

use handlers::*;
use auth_layer::{AuthLayer, LambdaEvent as AuthLambdaEvent};

// Global clients for cold start optimization
static DYNAMODB_CLIENT: Lazy<Arc<DynamoDbClient>> = Lazy::new(|| {
    let rt = tokio::runtime::Runtime::new().unwrap();
    rt.block_on(async {
        let region_provider = RegionProviderChain::default_provider().or_else("us-east-1");
        let config = aws_config::from_env().region(region_provider).load().await;
        Arc::new(DynamoDbClient::new(&config))
    })
});

static AUTH_LAYER: Lazy<AuthLayer> = Lazy::new(|| AuthLayer::new());

#[tokio::main]
async fn main() -> Result<(), Error> {
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .with_target(false)
        .without_time()
        .init();

    // Initialize global clients
    let _ = &*DYNAMODB_CLIENT;
    let _ = &*AUTH_LAYER;

    let func = service_fn(handler);
    lambda_runtime::run(func).await?;
    Ok(())
}

async fn handler(event: LambdaEvent<Value>) -> Result<Value, Error> {
    let (event, _context) = event.into_parts();

    info!("Nutrition service event: {:?}", event);

    // Convert to auth event format
    let auth_event = AuthLambdaEvent {
        headers: event.get("headers")
            .and_then(|v| v.as_object())
            .map(|obj| {
                obj.iter()
                    .map(|(k, v)| (k.clone(), v.as_str().unwrap_or("").to_string()))
                    .collect()
            }),
        request_context: event.get("requestContext")
            .and_then(|v| serde_json::from_value(v.clone()).ok()),
        path_parameters: event.get("pathParameters")
            .and_then(|v| v.as_object())
            .map(|obj| {
                obj.iter()
                    .map(|(k, v)| (k.clone(), v.as_str().unwrap_or("").to_string()))
                    .collect()
            }),
        query_string_parameters: event.get("queryStringParameters")
            .and_then(|v| v.as_object())
            .map(|obj| {
                obj.iter()
                    .map(|(k, v)| (k.clone(), v.as_str().unwrap_or("").to_string()))
                    .collect()
            }),
        body: event.get("body")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
    };

    // Authenticate request
    let auth_context = match AUTH_LAYER.authenticate(&auth_event).await {
        Ok(auth_result) => {
            if !auth_result.is_authorized {
                return Ok(json!({
                    "statusCode": 403,
                    "headers": get_cors_headers(),
                    "body": json!({
                        "error": "Forbidden",
                        "message": auth_result.error.unwrap_or("Access denied".to_string())
                    })
                }));
            }
            auth_result.context.unwrap()
        }
        Err(e) => {
            error!("Authentication error: {}", e);
            return Ok(json!({
                "statusCode": 401,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Unauthorized",
                    "message": "Authentication failed"
                })
            }));
        }
    }

    let http_method = event["requestContext"]["http"]["method"]
        .as_str()
        .unwrap_or("GET");

    let path = event["rawPath"]
        .as_str()
        .unwrap_or("/");

    let body = event["body"]
        .as_str()
        .unwrap_or("{}");

    let query_params = event["queryStringParameters"]
        .as_object()
        .unwrap_or(&serde_json::Map::new());

    // Extract user ID and other parameters from path
    let path_parts: Vec<&str> = path.split('/').collect();
    let user_id = if path_parts.len() >= 4 && path_parts[2] == "users" {
        Some(path_parts[3].to_string())
    } else {
        None
    };

    // Initialize nutrition repository
    let table_name = std::env::var("DYNAMODB_TABLE").unwrap_or_else(|_| "gymcoach-ai".to_string());
    let nutrition_repo = database::NutritionRepository::new((*DYNAMODB_CLIENT).clone(), table_name);

    let response = match (http_method, path) {
        // Meal endpoints
        ("POST", path) if path.starts_with("/api/users/") && path.ends_with("/meals") => {
            handle_create_meal(&user_id.unwrap_or_default(), body, &nutrition_repo, &auth_context).await
        }
        ("GET", path) if path.starts_with("/api/users/") && path.contains("/meals/") && !path.contains("/date") => {
            let meal_id = path_parts.last().unwrap_or("");
            handle_get_meal(&user_id.unwrap_or_default(), meal_id, &nutrition_repo, &auth_context).await
        }
        ("GET", path) if path.starts_with("/api/users/") && path.contains("/meals/date/") => {
            let date = path_parts.last().unwrap_or("");
            handle_get_meals_by_date(&user_id.unwrap_or_default(), date, &nutrition_repo, &auth_context).await
        }
        ("PUT", path) if path.starts_with("/api/users/") && path.contains("/meals/") => {
            let meal_id = path_parts.last().unwrap_or("");
            handle_update_meal(&user_id.unwrap_or_default(), meal_id, body, &nutrition_repo, &auth_context).await
        }
        ("DELETE", path) if path.starts_with("/api/users/") && path.contains("/meals/") => {
            let meal_id = path_parts.last().unwrap_or("");
            handle_delete_meal(&user_id.unwrap_or_default(), meal_id, &nutrition_repo, &auth_context).await
        }
        
        // Food endpoints
        ("POST", "/api/foods") => {
            handle_create_food(body, &nutrition_repo, &auth_context).await
        }
        ("GET", path) if path.starts_with("/api/foods/") && !path.contains("/search") => {
            let food_id = path_parts.last().unwrap_or("");
            handle_get_food(food_id, &nutrition_repo, &auth_context).await
        }
        ("GET", "/api/foods/search") => {
            let query = query_params.get("q")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let limit = query_params.get("limit")
                .and_then(|v| v.as_str())
                .and_then(|s| s.parse::<u32>().ok());
            handle_search_foods(query, limit, &nutrition_repo, &auth_context).await
        }
        
        // Nutrition plan endpoints
        ("POST", path) if path.starts_with("/api/users/") && path.ends_with("/nutrition-plans") => {
            handle_create_nutrition_plan(&user_id.unwrap_or_default(), body, &nutrition_repo, &auth_context).await
        }
        ("GET", path) if path.starts_with("/api/users/") && path.contains("/nutrition-plans/") => {
            let plan_id = path_parts.last().unwrap_or("");
            handle_get_nutrition_plan(&user_id.unwrap_or_default(), plan_id, &nutrition_repo, &auth_context).await
        }
        
        _ => {
            json!({
                "statusCode": 404,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Not Found",
                    "message": "Endpoint not found"
                })
            })
        }
    };

    Ok(response)
}
