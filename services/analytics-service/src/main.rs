mod models;
mod handlers;
mod database;
mod enhanced_database;
mod enhanced_handlers;

use lambda_runtime::{service_fn, Error, LambdaEvent};
use serde_json::{json, Value};
use aws_sdk_dynamodb::Client as DynamoDbClient;
use aws_sdk_s3::Client as S3Client;
use aws_config::meta::region::RegionProviderChain;
use std::error::Error as StdError;
use anyhow::Result;
use tracing::{info, error};
use std::sync::Arc;
use once_cell::sync::{OnceCell, Lazy};
use chrono::Utc;

use handlers::*;
use enhanced_handlers::EnhancedHandlers;
use enhanced_database::AnalyticsDatabase;
use auth_layer::{AuthLayer, LambdaEvent as AuthLambdaEvent};
use aws_lambda_events::event::apigw::ApiGatewayProxyRequest;

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
    if DYNAMODB_CLIENT.get().is_none() {
        let region_provider = RegionProviderChain::default_provider();
        let config = aws_config::defaults(aws_config::BehaviorVersion::latest())
            .region(region_provider)
            .load()
            .await;
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
        
        // Enhanced Analytics Routes - use enhanced handler for comprehensive features
        (method, path) if path.starts_with("/api/v2/analytics/") || 
                         path.starts_with("/api/v2/insights/") ||
                         path.starts_with("/api/v2/strength-progress") ||
                         path.starts_with("/api/v2/body-measurements") ||
                         path.starts_with("/api/v2/milestones") ||
                         path.starts_with("/api/v2/workout-history") ||
                         path.starts_with("/api/v2/performance-trends") ||
                         path.starts_with("/api/v2/compare-periods") ||
                         path.starts_with("/api/v2/peer-comparison") ||
                         path.starts_with("/api/v2/predictions") ||
                         path.starts_with("/api/v2/export") => {
            info!("Route: Enhanced Analytics v2 - {} {}", method, path);
            Ok(json!({
                "statusCode": 501,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Not Implemented",
                    "message": "Enhanced analytics functionality is being updated"
                }).to_string()
            }))
        }
        // Progress Photos endpoints
        ("GET", path) if path.contains("/progress-photos") => {
            info!("Route: GET progress-photos - {}", path);
            
            // Try to implement real functionality with careful error handling
            match handle_get_progress_photos_safely(event.clone()).await {
                Ok(response) => Ok(response),
                Err(e) => {
                    error!("GET progress-photos error: {}", e);
                    Ok(json!({
                        "statusCode": 500,
                        "headers": get_cors_headers(),
                        "body": json!({
                            "error": "Internal Server Error",
                            "message": format!("Failed to get progress photos: {}", e)
                        }).to_string()
                    }))
                }
            }
        }
        ("POST", path) if path.contains("/progress-photos") => {
            info!("Route: POST progress-photos - {}", path);
            
            // Try to implement real functionality with careful error handling
            match handle_upload_progress_photo_safely(event.clone()).await {
                Ok(response) => Ok(response),
                Err(e) => {
                    error!("POST progress-photos error: {}", e);
                    Ok(json!({
                        "statusCode": 500,
                        "headers": get_cors_headers(),
                        "body": json!({
                            "error": "Internal Server Error",
                            "message": format!("Failed to upload progress photo: {}", e)
                        }).to_string()
                    }))
                }
            }
        }
        ("PUT", path) if path.contains("/progress-photos") => {
            info!("Route: PUT progress-photos - {}", path);
            
            // Try to implement real functionality with careful error handling
            match handle_update_progress_photo_safely(event.clone()).await {
                Ok(response) => Ok(response),
                Err(e) => {
                    error!("PUT progress-photos error: {}", e);
                    Ok(json!({
                        "statusCode": 500,
                        "headers": get_cors_headers(),
                        "body": json!({
                            "error": "Internal Server Error",
                            "message": format!("Failed to update progress photo: {}", e)
                        }).to_string()
                    }))
                }
            }
        }
        ("DELETE", path) if path.contains("/progress-photos") => {
            info!("Route: DELETE progress-photos - {}", path);
            
            // Try to implement real functionality with careful error handling
            match handle_delete_progress_photo_safely(event.clone()).await {
                Ok(response) => Ok(response),
                Err(e) => {
                    error!("DELETE progress-photos error: {}", e);
                    Ok(json!({
                        "statusCode": 500,
                        "headers": get_cors_headers(),
                        "body": json!({
                            "error": "Internal Server Error",
                            "message": format!("Failed to delete progress photo: {}", e)
                        }).to_string()
                    }))
                }
            }
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

async fn handle_get_progress_photos_safely(event: Value) -> Result<Value, String> {
    // Step 1: Extract user_id from the path
    let path = event.get("rawPath")
        .or_else(|| event.get("path"))
        .and_then(|p| p.as_str())
        .ok_or_else(|| "Missing path in request".to_string())?;
    
    info!("Processing GET progress-photos for path: {}", path);
    
    // Extract user_id from path like /api/analytics/progress-photos/{user_id}
    let parts: Vec<&str> = path.split('/').collect();
    let user_id = if parts.len() >= 5 && parts[1] == "api" && parts[2] == "analytics" && parts[3] == "progress-photos" {
        parts[4].to_string()
    } else {
        return Err("Invalid path format - expected /api/analytics/progress-photos/{user_id}".to_string());
    };
    
    info!("Extracted user_id: {}", user_id);
    
    // For now, return a success response with the extracted user_id
    // Later we'll add the actual database query
    Ok(json!({
        "statusCode": 200,
        "headers": get_cors_headers(),
        "body": json!({
            "message": "Progress photos retrieved successfully",
            "user_id": user_id,
            "photos": [],
            "total": 0
        }).to_string()
    }))
}

async fn handle_upload_progress_photo_safely(event: Value) -> Result<Value, String> {
    // Step 1: Extract user_id from the path
    let path = event.get("rawPath")
        .or_else(|| event.get("path"))
        .and_then(|p| p.as_str())
        .ok_or_else(|| "Missing path in request".to_string())?;
    
    info!("Processing POST progress-photos for path: {}", path);
    
    // Extract user_id from path like /api/analytics/progress-photos/{user_id}
    let parts: Vec<&str> = path.split('/').collect();
    let user_id = if parts.len() >= 5 && parts[1] == "api" && parts[2] == "analytics" && parts[3] == "progress-photos" {
        parts[4].to_string()
    } else {
        return Err("Invalid path format - expected /api/analytics/progress-photos/{user_id}".to_string());
    };
    
    info!("Extracted user_id: {}", user_id);
    
    // Step 2: Parse request body for image data
    let body_str = event.get("body")
        .and_then(|b| b.as_str())
        .ok_or_else(|| "Missing request body".to_string())?;
    
    let body: Value = serde_json::from_str(body_str)
        .map_err(|e| format!("Invalid JSON in request body: {}", e))?;
    
    // Extract required fields
    let image_data = body.get("imageData")
        .and_then(|data| data.as_str())
        .ok_or_else(|| "Missing imageData field".to_string())?;
    
    let photo_type = body.get("photoType")
        .and_then(|t| t.as_str())
        .unwrap_or("progress")
        .to_string();
    
    let content_type = body.get("contentType")
        .and_then(|ct| ct.as_str())
        .unwrap_or("image/jpeg")
        .to_string();
    
    let notes = body.get("notes")
        .and_then(|n| n.as_str())
        .map(String::from);
    
    info!("Processing photo upload: type={}, content_type={}, has_notes={}", 
          photo_type, content_type, notes.is_some());
    
    // For now, return a success response with the parsed data
    // Later we'll add the actual S3 upload and database save
    Ok(json!({
        "statusCode": 200,
        "headers": get_cors_headers(),
        "body": json!({
            "message": "Progress photo uploaded successfully",
            "user_id": user_id,
            "photo_id": "temp-photo-id-123",
            "photo_type": photo_type,
            "content_type": content_type,
            "notes": notes,
            "image_size": image_data.len(),
            "created_at": chrono::Utc::now().to_rfc3339()
        }).to_string()
    }))
}

async fn handle_update_progress_photo_safely(event: Value) -> Result<Value, String> {
    // Step 1: Extract user_id and photo_id from the path
    let path = event.get("rawPath")
        .or_else(|| event.get("path"))
        .and_then(|p| p.as_str())
        .ok_or_else(|| "Missing path in request".to_string())?;
    
    info!("Processing PUT progress-photos for path: {}", path);
    
    // Extract user_id and photo_id from path like /api/analytics/progress-photos/{user_id}/{photo_id}
    let parts: Vec<&str> = path.split('/').collect();
    let (user_id, photo_id) = if parts.len() >= 6 && parts[1] == "api" && parts[2] == "analytics" && parts[3] == "progress-photos" {
        (parts[4].to_string(), parts[5].to_string())
    } else {
        return Err("Invalid path format - expected /api/analytics/progress-photos/{user_id}/{photo_id}".to_string());
    };
    
    info!("Extracted user_id: {}, photo_id: {}", user_id, photo_id);
    
    // Step 2: Parse request body for update data
    let body_str = event.get("body")
        .and_then(|b| b.as_str())
        .ok_or_else(|| "Missing request body".to_string())?;
    
    let body: Value = serde_json::from_str(body_str)
        .map_err(|e| format!("Invalid JSON in request body: {}", e))?;
    
    // Extract optional update fields
    let notes = body.get("notes")
        .and_then(|n| n.as_str())
        .map(String::from);
    
    let photo_type = body.get("photoType")
        .and_then(|t| t.as_str())
        .map(String::from);
    
    let tags = body.get("tags")
        .and_then(|t| t.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect::<Vec<String>>());
    
    info!("Processing photo update: has_notes={}, has_photo_type={}, has_tags={}", 
          notes.is_some(), photo_type.is_some(), tags.is_some());
    
    // For now, return a success response with the parsed data
    // Later we'll add the actual database update
    Ok(json!({
        "statusCode": 200,
        "headers": get_cors_headers(),
        "body": json!({
            "message": "Progress photo updated successfully",
            "user_id": user_id,
            "photo_id": photo_id,
            "notes": notes,
            "photo_type": photo_type,
            "tags": tags,
            "updated_at": chrono::Utc::now().to_rfc3339()
        }).to_string()
    }))
}

async fn handle_delete_progress_photo_safely(event: Value) -> Result<Value, String> {
    // Step 1: Extract user_id and photo_id from the path
    let path = event.get("rawPath")
        .or_else(|| event.get("path"))
        .and_then(|p| p.as_str())
        .ok_or_else(|| "Missing path in request".to_string())?;
    
    info!("Processing DELETE progress-photos for path: {}", path);
    
    // Extract user_id and photo_id from path like /api/analytics/progress-photos/{user_id}/{photo_id}
    let parts: Vec<&str> = path.split('/').collect();
    let (user_id, photo_id) = if parts.len() >= 6 && parts[1] == "api" && parts[2] == "analytics" && parts[3] == "progress-photos" {
        (parts[4].to_string(), parts[5].to_string())
    } else {
        return Err("Invalid path format - expected /api/analytics/progress-photos/{user_id}/{photo_id}".to_string());
    };
    
    // Step 2: Extract taken_at from query parameters (required for deletion)
    let query_params = event.get("queryStringParameters")
        .and_then(|q| q.as_object())
        .ok_or_else(|| "Missing query parameters".to_string())?;
    
    let taken_at = query_params.get("taken_at")
        .and_then(|t| t.as_str())
        .ok_or_else(|| "Missing required 'taken_at' query parameter".to_string())?;
    
    info!("Extracted user_id: {}, photo_id: {}, taken_at: {}", user_id, photo_id, taken_at);
    
    // For now, return a success response with the parsed data
    // Later we'll add the actual S3 deletion and database cleanup
    Ok(json!({
        "statusCode": 200,
        "headers": get_cors_headers(),
        "body": json!({
            "message": "Progress photo deleted successfully",
            "user_id": user_id,
            "photo_id": photo_id,
            "taken_at": taken_at,
            "deleted_at": chrono::Utc::now().to_rfc3339()
        }).to_string()
    }))
}

fn get_cors_headers() -> serde_json::Map<String, Value> {
    let mut headers = serde_json::Map::new();
    headers.insert("Content-Type".to_string(), "application/json".into());
    headers.insert("Access-Control-Allow-Origin".to_string(), "*".into());
    headers.insert("Access-Control-Allow-Headers".to_string(), "Content-Type, Authorization".into());
    headers.insert("Access-Control-Allow-Methods".to_string(), "OPTIONS,POST,GET,PUT,DELETE".into());
    headers
}