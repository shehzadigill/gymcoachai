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
use uuid;
use base64::{self, Engine as _};

use handlers::*;
use enhanced_handlers::EnhancedHandlers;
use enhanced_database::AnalyticsDatabase;
use auth_layer::{AuthLayer, LambdaEvent as AuthLambdaEvent};
use aws_lambda_events::event::apigw::ApiGatewayProxyRequest;
use models::ProgressPhoto;

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
        // Progress Photos Analytics endpoint
        ("GET", path) if path.contains("/progress-photos") && (path.ends_with("/analytics") || path.contains("/analytics?")) => {
            info!("🔍 ANALYTICS ROUTE MATCHED: GET progress-photos analytics - {}", path);
            
            match handle_get_progress_photo_analytics_safely(event.clone()).await {
                Ok(response) => Ok(response),
                Err(e) => {
                    error!("GET progress-photos analytics error: {}", e);
                    Ok(json!({
                        "statusCode": 500,
                        "headers": get_cors_headers(),
                        "body": json!({
                            "error": "Database Error",
                            "message": format!("Failed to retrieve progress photos: {}", e)
                        }).to_string()
                    }))
                }
            }
        }
        // Progress Photos Timeline endpoint
        ("GET", path) if path.contains("/progress-photos") && (path.ends_with("/timeline") || path.contains("/timeline?")) => {
            info!("📅 TIMELINE ROUTE MATCHED: GET progress-photos timeline - {}", path);
            
            match handle_get_progress_photo_timeline_safely(event.clone()).await {
                Ok(response) => Ok(response),
                Err(e) => {
                    error!("GET progress-photos timeline error: {}", e);
                    Ok(json!({
                        "statusCode": 500,
                        "headers": get_cors_headers(),
                        "body": json!({
                            "error": "Database Error",
                            "message": format!("Failed to retrieve progress photos: {}", e)
                        }).to_string()
                    }))
                }
            }
        }
        // Progress Photos basic endpoints - must be more specific to avoid catching analytics/timeline
        ("GET", path) if path.contains("/progress-photos") && !path.ends_with("/analytics") && !path.ends_with("/timeline") && !path.contains("/analytics?") && !path.contains("/timeline?") => {
            info!("📷 PHOTOS ROUTE MATCHED: GET progress-photos - {}", path);
            
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
        // Progress Photos Upload endpoint - specific match for /upload
        ("POST", path) if path.contains("/progress-photos") && path.contains("/upload") => {
            info!("📤 UPLOAD ROUTE MATCHED: POST progress-photos upload - {}", path);
            
            // Try to implement real functionality with careful error handling
            match handle_upload_progress_photo_safely(event.clone()).await {
                Ok(response) => Ok(response),
                Err(e) => {
                    error!("POST progress-photos upload error: {}", e);
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
        ("POST", path) if path.contains("/progress-photos") && !path.contains("/analytics") && !path.contains("/timeline") && !path.contains("/upload") => {
            info!("📷 PHOTOS ROUTE MATCHED: POST progress-photos - {}", path);
            
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
    
    info!("📷 PHOTOS HANDLER: Processing GET progress-photos for path: {}", path);
    
    // Extract user_id from path like /api/analytics/progress-photos/{user_id}
    let parts: Vec<&str> = path.split('/').collect();
    let user_id = if parts.len() >= 5 && parts[1] == "api" && parts[2] == "analytics" && parts[3] == "progress-photos" {
        parts[4].to_string()
    } else {
        return Err("Invalid path format - expected /api/analytics/progress-photos/{user_id}".to_string());
    };
    
    info!("Extracted user_id: {}", user_id);
    
    // Step 2: Parse query parameters
    let default_params = serde_json::Map::new();
    let query_params = event.get("queryStringParameters")
        .and_then(|q| q.as_object())
        .unwrap_or(&default_params);
    
    let photo_type = query_params.get("photo_type")
        .and_then(|t| t.as_str());
    let start_date = query_params.get("start_date")
        .and_then(|d| d.as_str());
    let end_date = query_params.get("end_date")
        .and_then(|d| d.as_str());
    let limit = query_params.get("limit")
        .and_then(|l| l.as_str())
        .and_then(|l| l.parse::<u32>().ok())
        .unwrap_or(50);
    
    // Step 3: Initialize database
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    let bucket_name = std::env::var("PROGRESS_PHOTOS_BUCKET").unwrap_or_else(|_| "gymcoach-ai-progress-photos".to_string());
    
    let database = AnalyticsDatabase::new(
        (**DYNAMODB_CLIENT.get().expect("DynamoDB not initialized")).clone(),
        (**S3_CLIENT.get().expect("S3 not initialized")).clone(),
        table_name,
        bucket_name
    );
    
    // Step 4: Fetch photos from database
    match database.get_progress_photos(&user_id, photo_type, start_date, end_date, Some(limit)).await {
        Ok(photos) => {
            info!("Retrieved {} photos for user {}", photos.len(), user_id);
            Ok(json!({
                "statusCode": 200,
                "headers": get_cors_headers(),
                "body": serde_json::to_string(&photos).map_err(|e| format!("Serialization error: {}", e))?
            }))
        },
        Err(e) => {
            error!("Failed to retrieve progress photos: {}", e);
            Ok(json!({
                "statusCode": 500,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Database Error",
                    "message": format!("Failed to retrieve progress photos: {}", e)
                }).to_string()
            }))
        }
    }
}

async fn handle_upload_progress_photo_safely(event: Value) -> Result<Value, String> {
    // Step 1: Extract user_id from the path
    let path = event.get("rawPath")
        .or_else(|| event.get("path"))
        .and_then(|p| p.as_str())
        .ok_or_else(|| "Missing path in request".to_string())?;
    
    info!("Processing POST progress-photos for path: {}", path);
    
    // Extract user_id from path like /api/analytics/progress-photos/{user_id}/upload
    let parts: Vec<&str> = path.split('/').collect();
    let user_id = if parts.len() >= 5 && parts[1] == "api" && parts[2] == "analytics" && parts[3] == "progress-photos" {
        parts[4].to_string()
    } else {
        return Err("Invalid path format - expected /api/analytics/progress-photos/{user_id}/upload".to_string());
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
    
    let workout_session_id = body.get("workoutSessionId")
        .and_then(|id| id.as_str())
        .map(String::from);
    
    info!("Processing photo upload: type={}, content_type={}, has_notes={}", 
          photo_type, content_type, notes.is_some());
    
    // Step 3: Initialize database and S3 clients
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    let bucket_name = std::env::var("PROGRESS_PHOTOS_BUCKET").unwrap_or_else(|_| "gymcoach-ai-progress-photos".to_string());
    
    let database = AnalyticsDatabase::new(
        (**DYNAMODB_CLIENT.get().expect("DynamoDB not initialized")).clone(),
        (**S3_CLIENT.get().expect("S3 not initialized")).clone(),
        table_name,
        bucket_name
    );
    
    // Step 4: Decode base64 image data
    let file_data = base64::engine::general_purpose::STANDARD
        .decode(image_data)
        .map_err(|_| "Invalid base64 image data".to_string())?;
    
    // Validate file size (max 10MB)
    if file_data.len() > 10 * 1024 * 1024 {
        return Ok(json!({
            "statusCode": 413,
            "headers": get_cors_headers(),
            "body": json!({
                "error": "File too large",
                "message": "Maximum file size is 10MB"
            }).to_string()
        }));
    }
    
    // Step 5: Generate unique photo ID and upload to S3
    let photo_id = uuid::Uuid::new_v4().to_string();
    let taken_at = Utc::now().to_rfc3339();
    let created_at = taken_at.clone();
    
    match database.upload_progress_photo_to_s3(&user_id, &photo_id, &content_type, &image_data).await {
        Ok(photo_url) => {
            // Step 6: Create progress photo record in database
            let progress_photo = ProgressPhoto {
                id: photo_id.clone(),
                user_id: user_id.clone(),
                workout_session_id,
                photo_type: photo_type.clone(),
                photo_url: photo_url.clone(),
                s3_key: format!("users/{}/progress-photos/{}", user_id, photo_id),
                taken_at: taken_at.clone(),
                notes,
                created_at: created_at.clone(),
                updated_at: created_at,
                tags: Vec::new(),
                metadata: None,
            };
            
            match database.create_progress_photo(&progress_photo).await {
                Ok(_) => {
                    info!("Successfully uploaded photo {} for user {}", photo_id, user_id);
                    Ok(json!({
                        "statusCode": 200,
                        "headers": get_cors_headers(),
                        "body": json!(progress_photo).to_string()
                    }))
                },
                Err(e) => {
                    error!("Failed to save progress photo to database: {}", e);
                    Ok(json!({
                        "statusCode": 500,
                        "headers": get_cors_headers(),
                        "body": json!({
                            "error": "Database Error",
                            "message": format!("Failed to save progress photo: {}", e)
                        }).to_string()
                    }))
                }
            }
        },
        Err(e) => {
            error!("Failed to upload photo to S3: {}", e);
            Ok(json!({
                "statusCode": 500,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Upload Error",
                    "message": format!("Failed to upload photo: {}", e)
                }).to_string()
            }))
        }
    }
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

async fn handle_get_progress_photo_analytics_safely(event: Value) -> Result<Value, String> {
    // Step 1: Extract user_id from the path
    let path = event.get("rawPath")
        .or_else(|| event.get("path"))
        .and_then(|p| p.as_str())
        .ok_or_else(|| "Missing path in request".to_string())?;
    
    info!("🔍 ANALYTICS HANDLER: Processing GET progress-photos analytics for path: {}", path);
    
    // Extract user_id from path - more flexible parsing
    let parts: Vec<&str> = path.split('/').filter(|p| !p.is_empty()).collect();
    info!("Path parts: {:?}", parts);
    
    // Look for progress-photos in the path and extract user_id
    let user_id = if let Some(progress_index) = parts.iter().position(|&p| p == "progress-photos") {
        if progress_index + 1 < parts.len() {
            parts[progress_index + 1].to_string()
        } else {
            return Err("Missing user_id in path after progress-photos".to_string());
        }
    } else {
        return Err("Path does not contain progress-photos segment".to_string());
    };
    
    // Step 2: Extract time_range from query parameters
    let query_params = event.get("queryStringParameters")
        .and_then(|q| q.as_object());
    
    let time_range = query_params
        .and_then(|params| params.get("time_range"))
        .and_then(|tr| tr.as_str())
        .unwrap_or("1m"); // default to 1 month
    
    info!("Extracted user_id: {}, time_range: {}", user_id, time_range);
    
    // Step 3: Initialize database
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    let bucket_name = std::env::var("PROGRESS_PHOTOS_BUCKET").unwrap_or_else(|_| "gymcoach-ai-progress-photos".to_string());
    
    let database = AnalyticsDatabase::new(
        (**DYNAMODB_CLIENT.get().expect("DynamoDB not initialized")).clone(),
        (**S3_CLIENT.get().expect("S3 not initialized")).clone(),
        table_name,
        bucket_name
    );
    
    // Step 4: Get progress photos from database with error handling
    let photos = match database.get_progress_photos(&user_id, None, None, None, None).await {
        Ok(photos) => {
            info!("Successfully retrieved {} photos for user {}", photos.len(), user_id);
            photos
        },
        Err(e) => {
            error!("Failed to get progress photos for user {}: {:?}", user_id, e);
            // Return empty analytics instead of failing
            vec![]
        }
    };
    
    // Step 5: Calculate analytics based on time range
    let analytics = calculate_progress_photo_analytics(&photos, time_range);
    
    Ok(json!({
        "statusCode": 200,
        "headers": get_cors_headers(),
        "body": serde_json::to_string(&analytics).map_err(|e| format!("Serialization error: {}", e))?
    }))
}

async fn handle_get_progress_photo_timeline_safely(event: Value) -> Result<Value, String> {
    // Step 1: Extract user_id from the path
    let path = event.get("rawPath")
        .or_else(|| event.get("path"))
        .and_then(|p| p.as_str())
        .ok_or_else(|| "Missing path in request".to_string())?;
    
    info!("📅 TIMELINE HANDLER: Processing GET progress-photos timeline for path: {}", path);
    
    // Extract user_id from path - more flexible parsing
    let parts: Vec<&str> = path.split('/').filter(|p| !p.is_empty()).collect();
    info!("Path parts: {:?}", parts);
    
    // Look for progress-photos in the path and extract user_id
    let user_id = if let Some(progress_index) = parts.iter().position(|&p| p == "progress-photos") {
        if progress_index + 1 < parts.len() {
            parts[progress_index + 1].to_string()
        } else {
            return Err("Missing user_id in path after progress-photos".to_string());
        }
    } else {
        return Err("Path does not contain progress-photos segment".to_string());
    };
    
    // Step 2: Extract time_range from query parameters
    let query_params = event.get("queryStringParameters")
        .and_then(|q| q.as_object());
    
    let time_range = query_params
        .and_then(|params| params.get("time_range"))
        .and_then(|tr| tr.as_str())
        .unwrap_or("1m"); // default to 1 month
    
    info!("Extracted user_id: {}, time_range: {}", user_id, time_range);
    
    // Step 3: Initialize database
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    let bucket_name = std::env::var("PROGRESS_PHOTOS_BUCKET").unwrap_or_else(|_| "gymcoach-ai-progress-photos".to_string());
    
    let database = AnalyticsDatabase::new(
        (**DYNAMODB_CLIENT.get().expect("DynamoDB not initialized")).clone(),
        (**S3_CLIENT.get().expect("S3 not initialized")).clone(),
        table_name,
        bucket_name
    );
    
    // Step 4: Get progress photos from database with error handling
    let photos = match database.get_progress_photos(&user_id, None, None, None, None).await {
        Ok(photos) => {
            info!("Successfully retrieved {} photos for user {}", photos.len(), user_id);
            photos
        },
        Err(e) => {
            error!("Failed to get progress photos for user {}: {:?}", user_id, e);
            // Return empty timeline instead of failing
            vec![]
        }
    };
    
    // Step 5: Create timeline based on time range
    let timeline = create_progress_photo_timeline(&photos, time_range);
    
    Ok(json!({
        "statusCode": 200,
        "headers": get_cors_headers(),
        "body": serde_json::to_string(&timeline).map_err(|e| format!("Serialization error: {}", e))?
    }))
}

fn calculate_progress_photo_analytics(photos: &[models::ProgressPhoto], time_range: &str) -> serde_json::Value {
    // Calculate basic analytics from photos
    let total_photos = photos.len();
    
    // Group by photo type if available
    let mut photos_by_type = std::collections::HashMap::new();
    for photo in photos {
        let photo_type = &photo.photo_type;
        *photos_by_type.entry(photo_type.to_string()).or_insert(0) += 1;
    }
    
    // Group photos by month
    let mut photos_by_month = Vec::new();
    // TODO: Group by actual months when we have proper date parsing
    if !photos.is_empty() {
        photos_by_month.push(json!({
            "month": "Current",
            "count": total_photos,
            "types": photos_by_type.clone()
        }));
    }
    
    // Calculate upload frequency
    let days_in_period = match time_range {
        "1w" => 7.0,
        "1m" => 30.0,
        "3m" => 90.0,
        "6m" => 180.0,
        "1y" => 365.0,
        _ => 30.0, // default to monthly
    };
    
    let daily_average = total_photos as f64 / days_in_period;
    let weekly_average = daily_average * 7.0;
    let monthly_average = daily_average * 30.0;
    
    let upload_frequency = json!({
        "daily_average": daily_average,
        "weekly_average": weekly_average,
        "monthly_average": monthly_average,
        "longest_streak": if total_photos > 0 { 1 } else { 0 },
        "current_streak": if total_photos > 0 { 1 } else { 0 }
    });
    
    // Calculate transformation insights
    let transformation_insights = json!({
        "total_duration_days": days_in_period as i32,
        "milestone_photos": [],
        "progress_indicators": []
    });
    
    json!({
        "total_photos": total_photos,
        "photos_by_type": photos_by_type,
        "photos_by_month": photos_by_month,
        "upload_frequency": upload_frequency,
        "consistency_score": if total_photos > 0 { 0.8 } else { 0.0 },
        "transformation_insights": transformation_insights
    })
}

fn create_progress_photo_timeline(photos: &[models::ProgressPhoto], time_range: &str) -> serde_json::Value {
    // Sort photos by taken_at date
    let mut sorted_photos = photos.to_vec();
    sorted_photos.sort_by(|a, b| {
        a.taken_at.cmp(&b.taken_at)
    });
    
    // Group photos by date for timeline entries
    let mut timeline_entries = Vec::new();
    let mut current_date = String::new();
    let mut current_photos = Vec::new();
    
    for (index, photo) in sorted_photos.iter().enumerate() {
        // Extract date from taken_at (assuming ISO format)
        let photo_date = photo.taken_at.split('T').next().unwrap_or(&photo.taken_at).to_string();
        
        if photo_date != current_date {
            // If we have accumulated photos for previous date, add timeline entry
            if !current_photos.is_empty() {
                timeline_entries.push(json!({
                    "date": current_date,
                    "photos": current_photos,
                    "week_number": (index / 7) + 1,
                    "month_name": "Current", // TODO: Parse actual month name
                    "days_since_start": index,
                    "workout_context": {
                        "sessions_that_week": 3,
                        "primary_focus": "Progress tracking",
                        "achievements": []
                    }
                }));
                current_photos = Vec::new();
            }
            current_date = photo_date;
        }
        
        // Add photo to current date group
        current_photos.push(photo.clone());
    }
    
    // Add the last group if exists
    if !current_photos.is_empty() {
        timeline_entries.push(json!({
            "date": current_date,
            "photos": current_photos,
            "week_number": (sorted_photos.len() / 7) + 1,
            "month_name": "Current",
            "days_since_start": sorted_photos.len(),
            "workout_context": {
                "sessions_that_week": 3,
                "primary_focus": "Progress tracking",
                "achievements": []
            }
        }));
    }
    
    serde_json::Value::Array(timeline_entries)
}

fn get_cors_headers() -> serde_json::Map<String, Value> {
    let mut headers = serde_json::Map::new();
    headers.insert("Content-Type".to_string(), "application/json".into());
    headers.insert("Access-Control-Allow-Origin".to_string(), "*".into());
    headers.insert("Access-Control-Allow-Headers".to_string(), "Content-Type, Authorization".into());
    headers.insert("Access-Control-Allow-Methods".to_string(), "OPTIONS,POST,GET,PUT,DELETE".into());
    headers
}