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

    info!("User service event: {:?}", event);

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

    let body = event["body"]
        .as_str()
        .unwrap_or("{}");

    let query_params = event["queryStringParameters"]
        .as_object()
        .unwrap_or(&serde_json::Map::new());

    // Extract user ID from path
    let user_id = extract_user_id_from_path(path);

    // Initialize user repository
    let table_name = std::env::var("DYNAMODB_TABLE").unwrap_or_else(|_| "gymcoach-ai".to_string());
    let user_repo = database::UserRepository::new((*DYNAMODB_CLIENT).clone(), table_name);

    let response = match (http_method, path) {
        ("GET", path) if path.starts_with("/api/users/") && path.ends_with("/stats") => {
            handle_get_user_stats(&user_repo, &auth_context).await
        }
        ("GET", path) if path.starts_with("/api/users/") && path.ends_with("/verify-email") => {
            handle_verify_user_email(&user_id.unwrap_or_default(), &user_repo, &auth_context).await
        }
        ("GET", path) if path.starts_with("/api/users/") && path.ends_with("/verify-phone") => {
            handle_verify_user_phone(&user_id.unwrap_or_default(), &user_repo, &auth_context).await
        }
        ("GET", path) if path.starts_with("/api/users/") => {
            handle_get_user(&user_id.unwrap_or_default(), &user_repo, &auth_context).await
        }
        ("POST", "/api/users") => {
            handle_create_user(body, &user_repo, &auth_context).await
        }
        ("PUT", path) if path.starts_with("/api/users/") => {
            handle_update_user(&user_id.unwrap_or_default(), body, &user_repo, &auth_context).await
        }
        ("DELETE", path) if path.starts_with("/api/users/") => {
            handle_delete_user(&user_id.unwrap_or_default(), &user_repo, &auth_context).await
        }
        ("GET", "/api/users") => {
            let page = query_params.get("page")
                .and_then(|v| v.as_str())
                .and_then(|s| s.parse::<u32>().ok());
            let limit = query_params.get("limit")
                .and_then(|v| v.as_str())
                .and_then(|s| s.parse::<u32>().ok());
            handle_list_users(page, limit, &user_repo, &auth_context).await
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

fn extract_user_id_from_path(path: &str) -> Option<String> {
    let parts: Vec<&str> = path.split('/').collect();
    if parts.len() >= 4 && parts[1] == "api" && parts[2] == "users" {
        Some(parts[3].to_string())
    } else {
        None
    }
}