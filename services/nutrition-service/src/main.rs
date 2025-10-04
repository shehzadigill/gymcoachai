use lambda_runtime::{service_fn, Error, LambdaEvent};
use serde_json::{json, Value};
use aws_sdk_dynamodb::Client as DynamoDbClient;
use aws_sdk_s3::Client as S3Client;
use aws_config::meta::region::RegionProviderChain;
use std::sync::Arc;
use once_cell::sync::{OnceCell, Lazy};
use tracing::{info, error};
use anyhow::Result;

mod models;
mod database;
mod handlers;

use handlers::*;
use auth_layer::{AuthLayer, LambdaEvent as AuthLambdaEvent};

// Global clients for cold start optimization
static DYNAMODB_CLIENT: OnceCell<Arc<DynamoDbClient>> = OnceCell::new();
static S3_CLIENT: OnceCell<Arc<S3Client>> = OnceCell::new();

static AUTH_LAYER: Lazy<AuthLayer> = Lazy::new(|| AuthLayer::new());

#[tokio::main]
async fn main() -> Result<(), Error> {
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
    };

    let http_method = event["requestContext"]["http"]["method"]
        .as_str()
        .unwrap_or("GET");

    let path = event["rawPath"]
        .as_str()
        .unwrap_or("/");

    info!("Processing path: {}", path);

    let body = event["body"]
        .as_str()
        .unwrap_or("{}");

    let qp_obj = event["queryStringParameters"].as_object().cloned().unwrap_or_default();
    let query_params = qp_obj;

    // Extract user ID and other parameters from path
    let path_parts: Vec<&str> = path.split('/').collect();
    info!("Path parts: {:?}", path_parts);
    
    let user_id = if path_parts.len() >= 3 && path_parts[1] == "users" {
        Some(path_parts[2].to_string())
    } else if path_parts.len() >= 4 && path_parts[2] == "users" {
        Some(path_parts[3].to_string())
    } else if path_parts.len() >= 2 && path_parts[1] == "me" {
        // Handle /me endpoints - get user ID from auth context
        Some(auth_context.user_id.clone())
    } else if path_parts.len() >= 4 && path_parts[1] == "api" && path_parts[2] == "nutrition" && path_parts[3] == "me" {
        // Handle /api/nutrition/me endpoints - get user ID from auth context
        Some(auth_context.user_id.clone())
    } else if path_parts.len() >= 5 && path_parts[1] == "api" && path_parts[2] == "nutrition" && path_parts[3] == "users" {
        // Handle /api/nutrition/users/{userId} endpoints
        Some(path_parts[4].to_string())
    } else {
        None
    };
    
    info!("Extracted user_id: {:?}", user_id);

    // Initialize nutrition repository
    let table_name = std::env::var("DYNAMODB_TABLE").unwrap_or_else(|_| "gymcoach-ai".to_string());
    let nutrition_repo = database::NutritionRepository::new(DYNAMODB_CLIENT.get().expect("DynamoDB not initialized").as_ref().clone(), table_name);

    let response = match (http_method, path) {
        // Meal endpoints
        ("POST", path) if (path.starts_with("/api/nutrition/users/") || path.starts_with("/api/users/") || path.starts_with("/users/") || path.starts_with("/api/nutrition/me/") || path.starts_with("/me/")) && path.ends_with("/meals") => {
            handle_create_meal(&user_id.unwrap_or_default(), body, &nutrition_repo, &auth_context).await
        }
        ("GET", path) if (path.starts_with("/api/nutrition/users/") || path.starts_with("/api/users/") || path.starts_with("/users/") || path.starts_with("/api/nutrition/me/") || path.starts_with("/me/")) && path.contains("/meals/") && !path.contains("/date") => {
            let meal_id = path_parts.last().map_or("", |v| v);
            handle_get_meal(&user_id.unwrap_or_default(), meal_id, &nutrition_repo, &auth_context).await
        }
        ("GET", path) if (path.starts_with("/api/nutrition/users/") || path.starts_with("/api/users/") || path.starts_with("/users/") || path.starts_with("/api/nutrition/me/") || path.starts_with("/me/")) && path.contains("/meals/date/") => {
            let date = path_parts.last().map_or("", |v| v);
            handle_get_meals_by_date(&user_id.unwrap_or_default(), date, &nutrition_repo, &auth_context).await
        }
        ("GET", path) if (path.starts_with("/api/nutrition/users/") || path.starts_with("/api/users/") || path.starts_with("/users/") || path.starts_with("/api/nutrition/me/") || path.starts_with("/me/")) && path.ends_with("/meals") => {
            handle_get_user_meals(&user_id.unwrap_or_default(), &nutrition_repo, &auth_context).await
        }
        ("PUT", path) if (path.starts_with("/api/nutrition/users/") || path.starts_with("/api/users/") || path.starts_with("/users/") || path.starts_with("/api/nutrition/me/") || path.starts_with("/me/")) && path.contains("/meals/") && !path.contains("/date") => {
            let meal_id = path_parts.last().map_or("", |v| v);
            handle_update_meal(&user_id.unwrap_or_default(), meal_id, body, &nutrition_repo, &auth_context).await
        }
        ("DELETE", path) if (path.starts_with("/api/nutrition/users/") || path.starts_with("/api/users/") || path.starts_with("/users/") || path.starts_with("/api/nutrition/me/") || path.starts_with("/me/")) && path.contains("/meals/") && !path.contains("/date") => {
            let meal_id = path_parts.last().map_or("", |v| v);
            handle_delete_meal(&user_id.unwrap_or_default(), meal_id, &nutrition_repo, &auth_context).await
        }
        
        // Food endpoints
        ("POST", path) if path == "/api/foods" || path == "/foods" || path == "/api/nutrition/foods" => {
            handle_create_food(body, &nutrition_repo, &auth_context).await
        }
        ("GET", path) if (path.starts_with("/api/foods/") || path.starts_with("/foods/") || path.starts_with("/api/nutrition/foods/")) && !path.contains("/search") => {
            let food_id = path_parts.last().map_or("", |v| v);
            handle_get_food(food_id, &nutrition_repo, &auth_context).await
        }
        ("GET", path) if path == "/api/foods/search" || path == "/foods/search" || path == "/api/nutrition/foods/search" => {
            let query = query_params.get("q")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let limit = query_params.get("limit")
                .and_then(|v| v.as_str())
                .and_then(|s| s.parse::<u32>().ok());
            let cursor = query_params.get("cursor").and_then(|v| v.as_str()).map(|s| s.to_string());
            handle_search_foods(query, limit, &nutrition_repo, &auth_context, cursor).await
        }

        // Favorite food endpoints
        ("POST", path) if (path.starts_with("/api/nutrition/users/") || path.starts_with("/api/users/") || path.starts_with("/users/") || path.starts_with("/api/nutrition/me/") || path.starts_with("/me/")) && path.contains("/favorites/foods/") => {
            let food_id = path_parts.last().map_or("", |v| v);
            handle_add_favorite_food(&user_id.unwrap_or_default(), food_id, &nutrition_repo, &auth_context).await
        }
        ("DELETE", path) if (path.starts_with("/api/nutrition/users/") || path.starts_with("/api/users/") || path.starts_with("/users/") || path.starts_with("/api/nutrition/me/") || path.starts_with("/me/")) && path.contains("/favorites/foods/") => {
            let food_id = path_parts.last().map_or("", |v| v);
            handle_remove_favorite_food(&user_id.unwrap_or_default(), food_id, &nutrition_repo, &auth_context).await
        }
        ("GET", path) if (path.starts_with("/api/nutrition/users/") || path.starts_with("/api/users/") || path.starts_with("/users/") || path.starts_with("/api/nutrition/me/") || path.starts_with("/me/")) && path.ends_with("/favorites/foods") => {
            handle_list_favorite_foods(&user_id.unwrap_or_default(), &nutrition_repo, &auth_context).await
        }
        
        // Nutrition plan endpoints
        ("POST", path) if (path.starts_with("/api/nutrition/users/") || path.starts_with("/api/users/") || path.starts_with("/users/") || path.starts_with("/api/nutrition/me/") || path.starts_with("/me/")) && path.ends_with("/nutrition-plans") => {
            handle_create_nutrition_plan(&user_id.unwrap_or_default(), body, &nutrition_repo, &auth_context).await
        }
        ("GET", path) if (path.starts_with("/api/nutrition/users/") || path.starts_with("/api/users/") || path.starts_with("/users/") || path.starts_with("/api/nutrition/me/") || path.starts_with("/me/")) && path.contains("/nutrition-plans/") => {
            let plan_id = path_parts.last().map_or("", |v| v);
            handle_get_nutrition_plan(&user_id.unwrap_or_default(), plan_id, &nutrition_repo, &auth_context).await
        }

        // Nutrition statistics endpoints
        ("GET", path) if (path.starts_with("/api/nutrition/users/") || path.starts_with("/api/users/") || path.starts_with("/users/") || path.starts_with("/api/nutrition/me/") || path.starts_with("/me/")) && path.ends_with("/stats") => {
            handle_get_nutrition_stats(&user_id.unwrap_or_default(), &nutrition_repo, &auth_context).await
        }

        // Water intake endpoints
        ("GET", path) if (path.starts_with("/api/nutrition/users/") || path.starts_with("/api/users/") || path.starts_with("/users/") || path.starts_with("/api/nutrition/me/") || path.starts_with("/me/")) && path.contains("/water/date/") => {
            let date = path_parts.last().map_or("", |v| v);
            handle_get_water(&user_id.unwrap_or_default(), date, &nutrition_repo, &auth_context).await
        }
        ("POST", path) if (path.starts_with("/api/nutrition/users/") || path.starts_with("/api/users/") || path.starts_with("/users/") || path.starts_with("/api/nutrition/me/") || path.starts_with("/me/")) && path.contains("/water/date/") => {
            let date = path_parts.last().map_or("", |v| v);
            handle_set_water(&user_id.unwrap_or_default(), date, body, &nutrition_repo, &auth_context).await
        }
        
        _ => {
            Ok(json!({
                "statusCode": 404,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Not Found",
                    "message": "Endpoint not found"
                })
            }))
        }
    };

    Ok(response?)
}
