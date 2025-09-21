use serde_json::{json, Value};
use aws_sdk_dynamodb::Client as DynamoDbClient;
use aws_sdk_s3::{Client as S3Client, presigning::PresigningConfig};
use uuid::Uuid;
use anyhow::Result;
use tracing::error;
use validator::Validate;

use crate::models::*;
use crate::database::*;
use crate::get_cors_headers;
use auth_layer::AuthContext;

pub async fn handle_get_user_profile(
    path: &str,
    dynamodb_client: &DynamoDbClient,
    auth_context: &AuthContext,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let user_id = extract_user_id_from_path(path).or_else(|| Some(auth_context.user_id.clone()));
    
    // Check if user can access this profile
    if let Some(id) = &user_id {
        if !can_access_user_profile(auth_context, id) {
            return Ok(json!({
                "statusCode": 403,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Forbidden",
                    "message": "You can only access your own profile"
                })
            }));
        }
    }
    
    match user_id {
        Some(id) => {
            match get_user_profile_from_db(&id, dynamodb_client).await {
                Ok(profile) => {
                    Ok(json!({
                        "statusCode": 200,
                        "headers": get_cors_headers(),
                        "body": profile
                    }))
                }
                Err(e) => {
                    error!("Error fetching user profile: {}", e);
                    let msg = e.to_string();
                    if msg.to_lowercase().contains("not found") {
                        Ok(json!({
                            "statusCode": 404,
                            "headers": get_cors_headers(),
                            "body": json!({
                                "error": "Not Found",
                                "message": "User profile not found"
                            })
                        }))
                    } else {
                        Ok(json!({
                            "statusCode": 500,
                            "headers": get_cors_headers(),
                            "body": json!({
                                "error": "Internal Server Error",
                                "message": "Failed to fetch user profile"
                            })
                        }))
                    }
                }
            }
        }
        None => {
            Ok(json!({
                "statusCode": 400,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Bad Request",
                    "message": "User ID is required"
                })
            }))
        }
    }
}

pub async fn handle_update_user_profile(
    path: &str,
    body: &str,
    dynamodb_client: &DynamoDbClient,
    auth_context: &AuthContext,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let user_id = extract_user_id_from_path(path).or_else(|| Some(auth_context.user_id.clone()));
    
    match user_id {
        Some(id) => {
            let update_data: Result<UserProfile, _> = serde_json::from_str(body);
            match update_data {
                Ok(profile) => {
                    if let Err(validation_errors) = profile.validate() {
                        return Ok(json!({
                            "statusCode": 400,
                            "headers": get_cors_headers(),
                            "body": json!({
                                "error": "Validation Error",
                                "message": "Invalid profile data",
                                "details": validation_errors
                            })
                        }));
                    }

                    match update_user_profile_in_db(&id, &profile, dynamodb_client).await {
                        Ok(updated_profile) => {
                            Ok(json!({
                                "statusCode": 200,
                                "headers": get_cors_headers(),
                                "body": updated_profile
                            }))
                        }
                        Err(e) => {
                            error!("Error updating user profile: {}", e);
                            Ok(json!({
                                "statusCode": 500,
                                "headers": get_cors_headers(),
                                "body": json!({
                                    "error": "Internal Server Error",
                                    "message": "Failed to update user profile"
                                })
                            }))
                        }
                    }
                }
                Err(e) => {
                    error!("Error parsing request body: {}", e);
                    Ok(json!({
                        "statusCode": 400,
                        "headers": get_cors_headers(),
                        "body": json!({
                            "error": "Bad Request",
                            "message": "Invalid JSON in request body"
                        })
                    }))
                }
            }
        }
        None => {
            Ok(json!({
                "statusCode": 400,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Bad Request",
                    "message": "User ID is required"
                })
            }))
        }
    }
}

pub async fn handle_generate_upload_url(
    body: &str,
    s3_client: &S3Client,
    auth_context: &AuthContext,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let upload_request: Result<UploadRequest, _> = serde_json::from_str(body);
    
    match upload_request {
        Ok(request) => {
            let file_type = request.file_type;
            let file_extension = match file_type.as_str() {
                "image/jpeg" => "jpg",
                "image/png" => "png",
                "image/gif" => "gif",
                "image/webp" => "webp",
                _ => "jpg",
            };
            
            let file_name = format!("{}.{}", Uuid::new_v4(), file_extension);
            let key = format!("user-profiles/{}", file_name);
            
            let presigning_config = PresigningConfig::expires_in(std::time::Duration::from_secs(300))?;
            
            let bucket_name = std::env::var("USER_UPLOADS_BUCKET").unwrap_or_else(|_| "gymcoach-ai-user-uploads".to_string());
            
            match s3_client
                .put_object()
                .bucket(&bucket_name)
                .key(&key)
                .content_type(&file_type)
                .presigned(presigning_config)
                .await
            {
                Ok(presigned_url) => {
                    let response = UploadResponse {
                        upload_url: presigned_url.uri().to_string(),
                        key,
                        bucket_name: bucket_name.clone(),
                        expires_in: 300,
                    };
                    
                    Ok(json!({
                        "statusCode": 200,
                        "headers": get_cors_headers(),
                        "body": response
                    }))
                }
                Err(e) => {
                    error!("Error generating presigned URL: {}", e);
                    Ok(json!({
                        "statusCode": 500,
                        "headers": get_cors_headers(),
                        "body": json!({
                            "error": "Internal Server Error",
                            "message": "Failed to generate upload URL"
                        })
                    }))
                }
            }
        }
        Err(e) => {
            error!("Error parsing upload request: {}", e);
            Ok(json!({
                "statusCode": 400,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Bad Request",
                    "message": "Invalid upload request"
                })
            }))
        }
    }
}

pub async fn handle_get_user_stats(
    path: &str,
    dynamodb_client: &DynamoDbClient,
    auth_context: &AuthContext,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let user_id = extract_user_id_from_path(path).or_else(|| Some(auth_context.user_id.clone()));
    
    match user_id {
        Some(id) => {
            match get_user_stats_from_db(&id, dynamodb_client).await {
                Ok(stats) => {
                    Ok(json!({
                        "statusCode": 200,
                        "headers": get_cors_headers(),
                        "body": stats
                    }))
                }
                Err(e) => {
                    error!("Error fetching user stats: {}", e);
                    Ok(json!({
                        "statusCode": 500,
                        "headers": get_cors_headers(),
                        "body": json!({
                            "error": "Internal Server Error",
                            "message": "Failed to fetch user statistics"
                        })
                    }))
                }
            }
        }
        None => {
            Ok(json!({
                "statusCode": 400,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Bad Request",
                    "message": "User ID is required"
                })
            }))
        }
    }
}

pub async fn handle_delete_user_profile(
    path: &str,
    dynamodb_client: &DynamoDbClient,
    s3_client: &S3Client,
    auth_context: &AuthContext,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let user_id = extract_user_id_from_path(path).or_else(|| Some(auth_context.user_id.clone()));
    
    match user_id {
        Some(id) => {
            match delete_user_profile_from_db(&id, dynamodb_client, s3_client).await {
                Ok(_) => {
                    Ok(json!({
                        "statusCode": 200,
                        "headers": get_cors_headers(),
                        "body": json!({
                            "message": "User profile deleted successfully"
                        })
                    }))
                }
                Err(e) => {
                    error!("Error deleting user profile: {}", e);
                    Ok(json!({
                        "statusCode": 500,
                        "headers": get_cors_headers(),
                        "body": json!({
                            "error": "Internal Server Error",
                            "message": "Failed to delete user profile"
                        })
                    }))
                }
            }
        }
        None => {
            Ok(json!({
                "statusCode": 400,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Bad Request",
                    "message": "User ID is required"
                })
            }))
        }
    }
}

pub async fn handle_get_user_preferences(
    path: &str,
    dynamodb_client: &DynamoDbClient,
    auth_context: &AuthContext,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let user_id = extract_user_id_from_path(path).or_else(|| Some(auth_context.user_id.clone()));
    
    match user_id {
        Some(id) => {
            match get_user_preferences_from_db(&id, dynamodb_client).await {
                Ok(preferences) => {
                    Ok(json!({
                        "statusCode": 200,
                        "headers": get_cors_headers(),
                        "body": preferences
                    }))
                }
                Err(e) => {
                    error!("Error fetching user preferences: {}", e);
                    Ok(json!({
                        "statusCode": 500,
                        "headers": get_cors_headers(),
                        "body": json!({
                            "error": "Internal Server Error",
                            "message": "Failed to fetch user preferences"
                        })
                    }))
                }
            }
        }
        None => {
            Ok(json!({
                "statusCode": 400,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Bad Request",
                    "message": "User ID is required"
                })
            }))
        }
    }
}

pub async fn handle_update_user_preferences(
    path: &str,
    body: &str,
    dynamodb_client: &DynamoDbClient,
    auth_context: &AuthContext,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let user_id = extract_user_id_from_path(path);
    
    match user_id {
        Some(id) => {
            let preferences: Result<UserPreferences, _> = serde_json::from_str(body);
            match preferences {
                Ok(prefs) => {
                    match update_user_preferences_in_db(&id, &prefs, dynamodb_client).await {
                        Ok(updated_prefs) => {
                            Ok(json!({
                                "statusCode": 200,
                                "headers": get_cors_headers(),
                                "body": updated_prefs
                            }))
                        }
                        Err(e) => {
                            error!("Error updating user preferences: {}", e);
                            Ok(json!({
                                "statusCode": 500,
                                "headers": get_cors_headers(),
                                "body": json!({
                                    "error": "Internal Server Error",
                                    "message": "Failed to update user preferences"
                                })
                            }))
                        }
                    }
                }
                Err(e) => {
                    error!("Error parsing preferences: {}", e);
                    Ok(json!({
                        "statusCode": 400,
                        "headers": get_cors_headers(),
                        "body": json!({
                            "error": "Bad Request",
                            "message": "Invalid preferences data"
                        })
                    }))
                }
            }
        }
        None => {
            Ok(json!({
                "statusCode": 400,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Bad Request",
                    "message": "User ID is required"
                })
            }))
        }
    }
}

// Authorization helper functions
fn can_access_user_profile(auth_context: &AuthContext, resource_user_id: &str) -> bool {
    // Admin can access any user profile
    if auth_context.roles.contains(&"admin".to_string()) {
        return true;
    }
    
    // Coaches can access user profiles for coaching purposes
    if auth_context.roles.contains(&"coach".to_string()) {
        return true;
    }
    
    // Users can only access their own profile
    auth_context.user_id == resource_user_id
}

fn can_manage_user_profiles(auth_context: &AuthContext) -> bool {
    // Admin and coaches can manage user profiles
    auth_context.roles.contains(&"admin".to_string()) || 
    auth_context.roles.contains(&"coach".to_string())
}

fn extract_user_id_from_path(path: &str) -> Option<String> {
    let parts: Vec<&str> = path.split('/').collect();
    // Expect formats:
    // - /api/user-profiles/profile
    // - /api/user-profiles/profile/{userId}
    // - /api/user-profiles/profile/me
    if parts.len() >= 4 && parts[1] == "api" && parts[2] == "user-profiles" && parts[3] == "profile" {
        if parts.len() > 4 {
            let last = parts[4];
            if last == "me" || last.is_empty() {
                None
            } else {
                Some(last.to_string())
            }
        } else {
            None
        }
    } else {
        None
    }
}
