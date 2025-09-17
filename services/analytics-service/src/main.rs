mod models;
mod handlers;
mod database;

use lambda_runtime::{service_fn, Error, LambdaEvent};
use serde_json::{json, Value};
use aws_sdk_dynamodb::Client as DynamoDbClient;
use aws_config::meta::region::RegionProviderChain;
use anyhow::Result;
use tracing::{info, error};
use std::sync::Arc;
use once_cell::sync::Lazy;

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
    
    info!("Analytics service event: {:?}", event);

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
        // Strength Progress
        ("GET", path) if path.starts_with("/api/analytics/strength-progress/") => {
            get_strength_progress_handler(event, &*DYNAMODB_CLIENT, &auth_context).await
        }
        ("POST", "/api/analytics/strength-progress") => {
            create_strength_progress_handler(event, &*DYNAMODB_CLIENT, &auth_context).await
        }
        
        // Body Measurements
        ("GET", path) if path.starts_with("/api/analytics/body-measurements/") => {
            get_body_measurements_handler(event, &*DYNAMODB_CLIENT, &auth_context).await
        }
        ("POST", "/api/analytics/body-measurements") => {
            create_body_measurement_handler(event, &*DYNAMODB_CLIENT, &auth_context).await
        }
        
        // Progress Charts
        ("GET", path) if path.starts_with("/api/analytics/charts/") => {
            get_progress_charts_handler(event, &dynamodb_client).await
        }
        ("POST", "/api/analytics/charts") => {
            create_progress_chart_handler(event, &dynamodb_client).await
        }
        
        // Milestones
        ("GET", path) if path.starts_with("/api/analytics/milestones/") => {
            get_milestones_handler(event, &dynamodb_client).await
        }
        ("POST", "/api/analytics/milestones") => {
            create_milestone_handler(event, &dynamodb_client).await
        }
        
        // Performance Trends
        ("GET", path) if path.starts_with("/api/analytics/trends/") => {
            get_performance_trends_handler(event, &dynamodb_client).await
        }
        
        // Comprehensive Analytics
        ("GET", path) if path.starts_with("/api/analytics/workout/") => {
            get_workout_analytics_handler(event, &dynamodb_client).await
        }
        ("POST", "/api/analytics/reports") => {
            generate_progress_report_handler(event, &dynamodb_client).await
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

fn get_cors_headers() -> serde_json::Map<String, Value> {
    let mut headers = serde_json::Map::new();
    headers.insert("Content-Type".to_string(), "application/json".into());
    headers.insert("Access-Control-Allow-Origin".to_string(), "*".into());
    headers.insert("Access-Control-Allow-Headers".to_string(), "Content-Type, Authorization".into());
    headers.insert("Access-Control-Allow-Methods".to_string(), "OPTIONS,POST,GET,PUT,DELETE".into());
    headers
}