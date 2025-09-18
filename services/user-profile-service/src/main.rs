use lambda_runtime::{service_fn, Error, LambdaEvent};
use serde_json::{json, Value};
use aws_sdk_dynamodb::{Client as DynamoDbClient, types::AttributeValue};
use aws_sdk_s3::{Client as S3Client, presigning::PresigningConfig};
use aws_config::meta::region::RegionProviderChain;
use uuid::Uuid;
use chrono::Utc;
use validator::Validate;
use anyhow::Result;
use tracing::{info, error};
use std::sync::Arc;
use once_cell::sync::Lazy;

mod models;
mod handlers;
mod database;

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

static S3_CLIENT: Lazy<Arc<S3Client>> = Lazy::new(|| {
    let rt = tokio::runtime::Runtime::new().unwrap();
    rt.block_on(async {
        let region_provider = RegionProviderChain::default_provider().or_else("us-east-1");
        let config = aws_config::from_env().region(region_provider).load().await;
        Arc::new(S3Client::new(&config))
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
    let _ = &*S3_CLIENT;
    let _ = &*AUTH_LAYER;

    let func = service_fn(handler);
    lambda_runtime::run(func).await?;
    Ok(())
}

async fn handler(event: LambdaEvent<Value>) -> Result<Value, Error> {
    let (event, _context) = event.into_parts();
    
    info!("User profile service event: {:?}", event);
    
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
    
    let response = match (http_method, path) {
        ("GET", path) if path.starts_with("/api/users/profile/") => {
            handle_get_user_profile(path, &*DYNAMODB_CLIENT, &auth_context).await
        }
        ("PUT", path) if path.starts_with("/api/users/profile/") => {
            handle_update_user_profile(path, body, &*DYNAMODB_CLIENT, &auth_context).await
        }
        ("POST", "/api/users/profile/upload") => {
            handle_generate_upload_url(body, &*S3_CLIENT, &auth_context).await
        }
        ("GET", "/api/users/profile/stats") => {
            handle_get_user_stats(path, &*DYNAMODB_CLIENT, &auth_context).await
        }
        ("DELETE", path) if path.starts_with("/api/users/profile/") => {
            handle_delete_user_profile(path, &*DYNAMODB_CLIENT, &*S3_CLIENT, &auth_context).await
        }
        ("GET", "/api/users/profile/preferences") => {
            handle_get_user_preferences(path, &*DYNAMODB_CLIENT, &auth_context).await
        }
        ("PUT", "/api/users/profile/preferences") => {
            handle_update_user_preferences(path, body, &*DYNAMODB_CLIENT, &auth_context).await
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
    
    response
}

pub fn get_cors_headers() -> serde_json::Map<String, Value> {
    let mut headers = serde_json::Map::new();
    headers.insert("Content-Type".to_string(), "application/json".into());
    headers.insert("Access-Control-Allow-Origin".to_string(), "*".into());
    headers.insert("Access-Control-Allow-Headers".to_string(), "Content-Type, Authorization".into());
    headers.insert("Access-Control-Allow-Methods".to_string(), "OPTIONS,POST,GET,PUT,DELETE".into());
    headers
}