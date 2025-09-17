use serde_json::{json, Value};
use anyhow::Result;
use tracing::{info, error, warn};
use uuid::Uuid;
use chrono::Utc;

use crate::models::*;
use crate::database::UserRepository;
use auth_layer::AuthContext;

pub async fn handle_create_user(
    body: &str,
    user_repo: &UserRepository,
    auth_context: &AuthContext,
) -> Result<Value> {
    // Check if user can create users (admin only)
    if !can_manage_users(auth_context) {
        return Ok(json!({
            "statusCode": 403,
            "headers": get_cors_headers(),
            "body": json!({
                "error": "Forbidden",
                "message": "Only administrators can create users"
            })
        }));
    }

    let create_request: CreateUserRequest = match serde_json::from_str(body) {
        Ok(request) => request,
        Err(e) => {
            error!("Failed to parse create user request: {}", e);
            return Ok(json!({
                "statusCode": 400,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Bad Request",
                    "message": "Invalid JSON in request body",
                    "details": e.to_string()
                })
            }));
        }
    };

    // Validate the request
    if let Err(validation_errors) = create_request.validate() {
        error!("Validation failed for create user request: {:?}", validation_errors);
        return Ok(json!({
            "statusCode": 400,
            "headers": get_cors_headers(),
            "body": json!({
                "error": "Validation Error",
                "message": "Invalid input data",
                "details": validation_errors.field_errors()
            })
        }));
    }

    // Check if user already exists
    if let Ok(Some(_)) = user_repo.get_user_by_email(&create_request.email).await {
        return Ok(json!({
            "statusCode": 409,
            "headers": get_cors_headers(),
            "body": json!({
                "error": "Conflict",
                "message": "User with this email already exists"
            })
        }));
    }

    // Check username uniqueness if provided
    if let Some(username) = &create_request.username {
        if let Ok(Some(_)) = user_repo.get_user_by_username(username).await {
            return Ok(json!({
                "statusCode": 409,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Conflict",
                    "message": "Username already taken"
                })
            }));
        }
    }

    // Create new user
    let user_id = Uuid::new_v4().to_string();
    let now = Utc::now();

    let user = User {
        id: user_id.clone(),
        email: create_request.email,
        name: create_request.name,
        first_name: create_request.first_name,
        last_name: create_request.last_name,
        username: create_request.username,
        phone_number: create_request.phone_number,
        date_of_birth: create_request.date_of_birth,
        gender: create_request.gender,
        profile_picture_url: None,
        is_active: true,
        is_verified: false,
        email_verified: false,
        phone_verified: false,
        created_at: now,
        updated_at: now,
        last_login_at: None,
        preferences: create_request.preferences.unwrap_or_default(),
        subscription: create_request.subscription,
        roles: create_request.roles.unwrap_or_else(|| vec![Role::User]),
    };

    match user_repo.create_user(&user).await {
        Ok(created_user) => {
            info!("User created successfully: {}", created_user.id);
            Ok(json!({
                "statusCode": 201,
                "headers": get_cors_headers(),
                "body": json!({
                    "id": created_user.id,
                    "email": created_user.email,
                    "name": created_user.name,
                    "username": created_user.username,
                    "is_active": created_user.is_active,
                    "is_verified": created_user.is_verified,
                    "created_at": created_user.created_at,
                    "message": "User created successfully"
                })
            }))
        }
        Err(e) => {
            error!("Failed to create user: {}", e);
            Ok(json!({
                "statusCode": 500,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Internal Server Error",
                    "message": "Failed to create user"
                })
            }))
        }
    }
}

pub async fn handle_get_user(
    user_id: &str,
    user_repo: &UserRepository,
    auth_context: &AuthContext,
) -> Result<Value> {
    // Check if user can access this resource
    if !can_access_user_resource(auth_context, user_id) {
        return Ok(json!({
            "statusCode": 403,
            "headers": get_cors_headers(),
            "body": json!({
                "error": "Forbidden",
                "message": "You can only access your own user data"
            })
        }));
    }

    match user_repo.get_user_by_id(user_id).await {
        Ok(Some(user)) => {
            info!("User retrieved successfully: {}", user.id);
            Ok(json!({
                "statusCode": 200,
                "headers": get_cors_headers(),
                "body": json!({
                    "id": user.id,
                    "email": user.email,
                    "name": user.name,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "username": user.username,
                    "phone_number": user.phone_number,
                    "date_of_birth": user.date_of_birth,
                    "gender": user.gender,
                    "profile_picture_url": user.profile_picture_url,
                    "is_active": user.is_active,
                    "is_verified": user.is_verified,
                    "email_verified": user.email_verified,
                    "phone_verified": user.phone_verified,
                    "created_at": user.created_at,
                    "updated_at": user.updated_at,
                    "last_login_at": user.last_login_at,
                    "preferences": user.preferences,
                    "subscription": user.subscription,
                    "roles": user.roles
                })
            }))
        }
        Ok(None) => {
            warn!("User not found: {}", user_id);
            Ok(json!({
                "statusCode": 404,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Not Found",
                    "message": "User not found"
                })
            }))
        }
        Err(e) => {
            error!("Failed to get user: {}", e);
            Ok(json!({
                "statusCode": 500,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Internal Server Error",
                    "message": "Failed to retrieve user"
                })
            }))
        }
    }
}

pub async fn handle_update_user(
    user_id: &str,
    body: &str,
    user_repo: &UserRepository,
    auth_context: &AuthContext,
) -> Result<Value> {
    // Check if user can update this resource
    if !can_access_user_resource(auth_context, user_id) {
        return Ok(json!({
            "statusCode": 403,
            "headers": get_cors_headers(),
            "body": json!({
                "error": "Forbidden",
                "message": "You can only update your own user data"
            })
        }));
    }

    let update_request: UpdateUserRequest = match serde_json::from_str(body) {
        Ok(request) => request,
        Err(e) => {
            error!("Failed to parse update user request: {}", e);
            return Ok(json!({
                "statusCode": 400,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Bad Request",
                    "message": "Invalid JSON in request body",
                    "details": e.to_string()
                })
            }));
        }
    };

    // Validate the request
    if let Err(validation_errors) = update_request.validate() {
        error!("Validation failed for update user request: {:?}", validation_errors);
        return Ok(json!({
            "statusCode": 400,
            "headers": get_cors_headers(),
            "body": json!({
                "error": "Validation Error",
                "message": "Invalid input data",
                "details": validation_errors.field_errors()
            })
        }));
    }

    // Check if user exists
    match user_repo.get_user_by_id(user_id).await {
        Ok(Some(_)) => {
            // User exists, proceed with update
        }
        Ok(None) => {
            return Ok(json!({
                "statusCode": 404,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Not Found",
                    "message": "User not found"
                })
            }));
        }
        Err(e) => {
            error!("Failed to check user existence: {}", e);
            return Ok(json!({
                "statusCode": 500,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Internal Server Error",
                    "message": "Failed to check user existence"
                })
            }));
        }
    }

    // Check username uniqueness if being updated
    if let Some(username) = &update_request.username {
        match user_repo.get_user_by_username(username).await {
            Ok(Some(existing_user)) if existing_user.id != user_id => {
                return Ok(json!({
                    "statusCode": 409,
                    "headers": get_cors_headers(),
                    "body": json!({
                        "error": "Conflict",
                        "message": "Username already taken"
                    })
                }));
            }
            Ok(_) => {
                // Username is available or belongs to the same user
            }
            Err(e) => {
                error!("Failed to check username uniqueness: {}", e);
                return Ok(json!({
                    "statusCode": 500,
                    "headers": get_cors_headers(),
                    "body": json!({
                        "error": "Internal Server Error",
                        "message": "Failed to check username availability"
                    })
                }));
            }
        }
    }

    match user_repo.update_user(user_id, &update_request).await {
        Ok(updated_user) => {
            info!("User updated successfully: {}", updated_user.id);
            Ok(json!({
                "statusCode": 200,
                "headers": get_cors_headers(),
                "body": json!({
                    "id": updated_user.id,
                    "email": updated_user.email,
                    "name": updated_user.name,
                    "first_name": updated_user.first_name,
                    "last_name": updated_user.last_name,
                    "username": updated_user.username,
                    "phone_number": updated_user.phone_number,
                    "date_of_birth": updated_user.date_of_birth,
                    "gender": updated_user.gender,
                    "profile_picture_url": updated_user.profile_picture_url,
                    "is_active": updated_user.is_active,
                    "is_verified": updated_user.is_verified,
                    "email_verified": updated_user.email_verified,
                    "phone_verified": updated_user.phone_verified,
                    "created_at": updated_user.created_at,
                    "updated_at": updated_user.updated_at,
                    "last_login_at": updated_user.last_login_at,
                    "preferences": updated_user.preferences,
                    "subscription": updated_user.subscription,
                    "roles": updated_user.roles,
                    "message": "User updated successfully"
                })
            }))
        }
        Err(e) => {
            error!("Failed to update user: {}", e);
            Ok(json!({
                "statusCode": 500,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Internal Server Error",
                    "message": "Failed to update user"
                })
            }))
        }
    }
}

pub async fn handle_delete_user(
    user_id: &str,
    user_repo: &UserRepository,
    auth_context: &AuthContext,
) -> Result<Value> {
    // Check if user can delete this resource
    if !can_access_user_resource(auth_context, user_id) {
        return Ok(json!({
            "statusCode": 403,
            "headers": get_cors_headers(),
            "body": json!({
                "error": "Forbidden",
                "message": "You can only delete your own user data"
            })
        }));
    }

    // Check if user exists
    match user_repo.get_user_by_id(user_id).await {
        Ok(Some(_)) => {
            // User exists, proceed with deletion
        }
        Ok(None) => {
            return Ok(json!({
                "statusCode": 404,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Not Found",
                    "message": "User not found"
                })
            }));
        }
        Err(e) => {
            error!("Failed to check user existence: {}", e);
            return Ok(json!({
                "statusCode": 500,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Internal Server Error",
                    "message": "Failed to check user existence"
                })
            }));
        }
    }

    match user_repo.delete_user(user_id).await {
        Ok(_) => {
            info!("User deleted successfully: {}", user_id);
            Ok(json!({
                "statusCode": 200,
                "headers": get_cors_headers(),
                "body": json!({
                    "id": user_id,
                    "message": "User deleted successfully"
                })
            }))
        }
        Err(e) => {
            error!("Failed to delete user: {}", e);
            Ok(json!({
                "statusCode": 500,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Internal Server Error",
                    "message": "Failed to delete user"
                })
            }))
        }
    }
}

pub async fn handle_list_users(
    page: Option<u32>,
    limit: Option<u32>,
    user_repo: &UserRepository,
    auth_context: &AuthContext,
) -> Result<Value> {
    // Check if user can list users (admin only)
    if !can_manage_users(auth_context) {
        return Ok(json!({
            "statusCode": 403,
            "headers": get_cors_headers(),
            "body": json!({
                "error": "Forbidden",
                "message": "Only administrators can list users"
            })
        }));
    }

    let page = page.unwrap_or(1);
    let limit = limit.unwrap_or(10).min(100); // Max 100 users per page

    match user_repo.list_users(page, limit).await {
        Ok(user_list) => {
            info!("Users listed successfully: {} users", user_list.users.len());
            Ok(json!({
                "statusCode": 200,
                "headers": get_cors_headers(),
                "body": user_list
            }))
        }
        Err(e) => {
            error!("Failed to list users: {}", e);
            Ok(json!({
                "statusCode": 500,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Internal Server Error",
                    "message": "Failed to list users"
                })
            }))
        }
    }
}

pub async fn handle_get_user_stats(
    user_repo: &UserRepository,
    auth_context: &AuthContext,
) -> Result<Value> {
    // Check if user can access user stats
    if !can_access_user_stats(auth_context) {
        return Ok(json!({
            "statusCode": 403,
            "headers": get_cors_headers(),
            "body": json!({
                "error": "Forbidden",
                "message": "Only administrators and coaches can access user statistics"
            })
        }));
    }

    match user_repo.get_user_stats().await {
        Ok(stats) => {
            info!("User stats retrieved successfully");
            Ok(json!({
                "statusCode": 200,
                "headers": get_cors_headers(),
                "body": stats
            }))
        }
        Err(e) => {
            error!("Failed to get user stats: {}", e);
            Ok(json!({
                "statusCode": 500,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Internal Server Error",
                    "message": "Failed to retrieve user statistics"
                })
            }))
        }
    }
}

pub async fn handle_verify_user_email(
    user_id: &str,
    user_repo: &UserRepository,
    auth_context: &AuthContext,
) -> Result<Value> {
    // Check if user exists
    match user_repo.get_user_by_id(user_id).await {
        Ok(Some(mut user)) => {
            if user.email_verified {
                return Ok(json!({
                    "statusCode": 400,
                    "headers": get_cors_headers(),
                    "body": json!({
                        "error": "Bad Request",
                        "message": "Email already verified"
                    })
                }));
            }

            // Update email verification status
            let update_request = UpdateUserRequest {
                name: None,
                first_name: None,
                last_name: None,
                username: None,
                phone_number: None,
                date_of_birth: None,
                gender: None,
                profile_picture_url: None,
                preferences: None,
                subscription: None,
                roles: None,
            };

            // For now, we'll just return success
            // In a real implementation, you'd update the user's email_verified field
            Ok(json!({
                "statusCode": 200,
                "headers": get_cors_headers(),
                "body": json!({
                    "id": user.id,
                    "message": "Email verification initiated"
                })
            }))
        }
        Ok(None) => {
            Ok(json!({
                "statusCode": 404,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Not Found",
                    "message": "User not found"
                })
            }))
        }
        Err(e) => {
            error!("Failed to verify user email: {}", e);
            Ok(json!({
                "statusCode": 500,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Internal Server Error",
                    "message": "Failed to verify email"
                })
            }))
        }
    }
}

pub async fn handle_verify_user_phone(
    user_id: &str,
    user_repo: &UserRepository,
    auth_context: &AuthContext,
) -> Result<Value> {
    // Check if user exists
    match user_repo.get_user_by_id(user_id).await {
        Ok(Some(user)) => {
            if user.phone_verified {
                return Ok(json!({
                    "statusCode": 400,
                    "headers": get_cors_headers(),
                    "body": json!({
                        "error": "Bad Request",
                        "message": "Phone number already verified"
                    })
                }));
            }

            // For now, we'll just return success
            // In a real implementation, you'd update the user's phone_verified field
            Ok(json!({
                "statusCode": 200,
                "headers": get_cors_headers(),
                "body": json!({
                    "id": user.id,
                    "message": "Phone verification initiated"
                })
            }))
        }
        Ok(None) => {
            Ok(json!({
                "statusCode": 404,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Not Found",
                    "message": "User not found"
                })
            }))
        }
        Err(e) => {
            error!("Failed to verify user phone: {}", e);
            Ok(json!({
                "statusCode": 500,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Internal Server Error",
                    "message": "Failed to verify phone number"
                })
            }))
        }
    }
}

// Authorization helper functions
fn can_access_user_resource(auth_context: &AuthContext, resource_user_id: &str) -> bool {
    // Admin can access any user resource
    if auth_context.roles.contains(&"admin".to_string()) {
        return true;
    }
    
    // Users can only access their own resources
    auth_context.user_id == resource_user_id
}

fn can_manage_users(auth_context: &AuthContext) -> bool {
    // Only admin can manage users (create, list, delete)
    auth_context.roles.contains(&"admin".to_string())
}

fn can_access_user_stats(auth_context: &AuthContext) -> bool {
    // Admin and coaches can access user stats
    auth_context.roles.contains(&"admin".to_string()) || 
    auth_context.roles.contains(&"coach".to_string())
}

pub fn get_cors_headers() -> serde_json::Map<String, Value> {
    let mut headers = serde_json::Map::new();
    headers.insert("Content-Type".to_string(), "application/json".into());
    headers.insert("Access-Control-Allow-Origin".to_string(), "*".into());
    headers.insert("Access-Control-Allow-Headers".to_string(), "Content-Type, Authorization".into());
    headers.insert("Access-Control-Allow-Methods".to_string(), "OPTIONS,POST,GET,PUT,DELETE".into());
    headers
}
