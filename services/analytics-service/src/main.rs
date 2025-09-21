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
use once_cell::sync::{OnceCell, Lazy};

use handlers::*;
use auth_layer::{AuthLayer, LambdaEvent as AuthLambdaEvent};

// Global clients for cold start optimization
static DYNAMODB_CLIENT: OnceCell<Arc<DynamoDbClient>> = OnceCell::new();

static AUTH_LAYER: Lazy<AuthLayer> = Lazy::new(|| AuthLayer::new());

#[tokio::main]
async fn main() -> Result<(), Error> {
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .with_target(false)
        .without_time()
        .init();

    // Initialize global clients
    if DYNAMODB_CLIENT.get().is_none() {
        let region_provider = RegionProviderChain::default_provider();
        let config = aws_config::from_env().region(region_provider).load().await;
        let _ = DYNAMODB_CLIENT.set(Arc::new(DynamoDbClient::new(&config)));
    }
    let _ = &*AUTH_LAYER;

    let func = service_fn(handler);
    lambda_runtime::run(func).await?;
    Ok(())
}

async fn handler(event: LambdaEvent<Value>) -> Result<Value, Error> {
    let (event, _context) = event.into_parts();
    
    info!("Analytics service event: {:?}", event);

    // Read method and path early so they are available for logging/auth
    let http_method = event["requestContext"]["http"]["method"]
        .as_str()
        .unwrap_or("GET");
    let path = event["rawPath"].as_str().unwrap_or("/");

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

    // Handle CORS preflight early
    if http_method == "OPTIONS" {
        return Ok(json!({
            "statusCode": 200,
            "headers": get_cors_headers()
        }));
    }

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
            let ctx = auth_result.context.unwrap();
            info!("Auth ok: user_id={}, path={} method={}", ctx.user_id, path, http_method);
            ctx
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
    
    // http_method and path already computed above
    
    let _body = event["body"].as_str().unwrap_or("{}");
    
    // Ensure pathParameters.userId is available for handlers. If the path ends with
    // '/me', substitute the authenticated user's id. Otherwise, try to parse from path.
    let mut payload = event.clone();
    {
        use serde_json::{Map, Value as JsonValue};
        let auth_user_id = auth_context.user_id.clone();
        let mut path_params: Map<String, JsonValue> = payload
            .get("pathParameters")
            .and_then(|v| v.as_object().cloned())
            .unwrap_or_default();

        // Derive userId: prefer explicit path segment if it's not a placeholder; else use auth user id
        let last_segment = path.rsplit('/').next().unwrap_or("");
        let candidate = if !last_segment.is_empty()
            && last_segment != "me"
            && last_segment != "userId"
        {
            last_segment.to_string()
        } else {
            auth_user_id
        };

        path_params.insert("userId".to_string(), JsonValue::String(candidate.clone()));
        payload["pathParameters"] = JsonValue::Object(path_params);

        // Log derived path parameters for debugging
        info!("Resolved userId for request: {}", candidate);
    }

    let response = match (http_method, path) {
        // Strength Progress
        ("GET", path) if path.starts_with("/api/analytics/strength-progress/") => {
            info!("Route: GET strength-progress");
            get_strength_progress_handler(payload.clone(), DYNAMODB_CLIENT.get().expect("DynamoDB not initialized").as_ref()).await
        }
        ("POST", "/api/analytics/strength-progress") => {
            info!("Route: POST strength-progress");
            create_strength_progress_handler(payload.clone(), DYNAMODB_CLIENT.get().expect("DynamoDB not initialized").as_ref()).await
        }
        
        // Body Measurements
        ("GET", path) if path.starts_with("/api/analytics/body-measurements/") => {
            info!("Route: GET body-measurements");
            get_body_measurements_handler(payload.clone(), DYNAMODB_CLIENT.get().expect("DynamoDB not initialized").as_ref()).await
        }
        ("POST", "/api/analytics/body-measurements") => {
            info!("Route: POST body-measurements");
            create_body_measurement_handler(payload.clone(), DYNAMODB_CLIENT.get().expect("DynamoDB not initialized").as_ref()).await
        }
        
        // Progress Charts
        ("GET", path) if path.starts_with("/api/analytics/charts/") => {
            info!("Route: GET charts");
            get_progress_charts_handler(payload.clone(), DYNAMODB_CLIENT.get().expect("DynamoDB not initialized").as_ref()).await
        }
        ("POST", "/api/analytics/charts") => {
            info!("Route: POST charts");
            create_progress_chart_handler(payload.clone(), DYNAMODB_CLIENT.get().expect("DynamoDB not initialized").as_ref()).await
        }
        
        // Milestones
        ("GET", path) if path.starts_with("/api/analytics/milestones/") => {
            info!("Route: GET milestones");
            get_milestones_handler(payload.clone(), DYNAMODB_CLIENT.get().expect("DynamoDB not initialized").as_ref()).await
        }
        ("POST", "/api/analytics/milestones") => {
            info!("Route: POST milestones");
            create_milestone_handler(payload.clone(), DYNAMODB_CLIENT.get().expect("DynamoDB not initialized").as_ref()).await
        }
        
        // Achievements
        ("GET", path) if path.starts_with("/api/analytics/achievements/") => {
            info!("Route: GET achievements");
            get_achievements_handler(payload.clone(), DYNAMODB_CLIENT.get().expect("DynamoDB not initialized").as_ref()).await
        }
        ("POST", "/api/analytics/achievements") => {
            info!("Route: POST achievements");
            create_achievement_handler(payload.clone(), DYNAMODB_CLIENT.get().expect("DynamoDB not initialized").as_ref()).await
        }
        
        // Performance Trends
        ("GET", path) if path.starts_with("/api/analytics/trends/") => {
            info!("Route: GET trends");
            get_performance_trends_handler(payload.clone(), DYNAMODB_CLIENT.get().expect("DynamoDB not initialized").as_ref()).await
        }
        
        // Comprehensive Analytics
        ("GET", path) if path.starts_with("/api/analytics/workout/") => {
            info!("Route: GET workout analytics");
            get_workout_analytics_handler(payload.clone(), DYNAMODB_CLIENT.get().expect("DynamoDB not initialized").as_ref()).await
        }
        ("POST", "/api/analytics/reports") => {
            generate_progress_report_handler(event, DYNAMODB_CLIENT.get().expect("DynamoDB not initialized").as_ref()).await
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

fn get_cors_headers() -> serde_json::Map<String, Value> {
    let mut headers = serde_json::Map::new();
    headers.insert("Content-Type".to_string(), "application/json".into());
    headers.insert("Access-Control-Allow-Origin".to_string(), "*".into());
    headers.insert("Access-Control-Allow-Headers".to_string(), "Content-Type, Authorization".into());
    headers.insert("Access-Control-Allow-Methods".to_string(), "OPTIONS,POST,GET,PUT,DELETE".into());
    headers
}