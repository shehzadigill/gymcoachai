use lambda_runtime::{service_fn, Error, LambdaEvent};
use serde_json::{json, Value};
use std::collections::HashMap;

#[tokio::main]
async fn main() -> Result<(), Error> {
    let func = service_fn(handler);
    lambda_runtime::run(func).await?;
    Ok(())
}

async fn handler(event: LambdaEvent<Value>) -> Result<Value, Error> {
    let (event, _context) = event.into_parts();
    
    println!("User service event: {:?}", event);
    
    let http_method = event["requestContext"]["http"]["method"]
        .as_str()
        .unwrap_or("GET");
    
    let path = event["rawPath"]
        .as_str()
        .unwrap_or("/");
    
    let headers = event["headers"]
        .as_object()
        .unwrap_or(&serde_json::Map::new());
    
    // Extract user ID from path or headers
    let user_id = extract_user_id_from_path(path);
    
    let response = match (http_method, path) {
        ("GET", path) if path.starts_with("/api/users/") => {
            handle_get_user(user_id, headers).await
        }
        ("POST", "/api/users") => {
            handle_create_user(&event).await
        }
        ("PUT", path) if path.starts_with("/api/users/") => {
            handle_update_user(user_id, &event).await
        }
        ("DELETE", path) if path.starts_with("/api/users/") => {
            handle_delete_user(user_id).await
        }
        ("GET", "/api/users") => {
            handle_list_users(headers).await
        }
        _ => {
            json!({
                "statusCode": 404,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization",
                    "Access-Control-Allow-Methods": "OPTIONS,POST,GET,PUT,DELETE"
                },
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

async fn handle_get_user(user_id: Option<String>, headers: &serde_json::Map<String, Value>) -> Value {
    match user_id {
        Some(id) => {
            // TODO: Implement actual user retrieval from DynamoDB
            json!({
                "statusCode": 200,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization",
                    "Access-Control-Allow-Methods": "OPTIONS,POST,GET,PUT,DELETE"
                },
                "body": json!({
                    "id": id,
                    "email": "user@example.com",
                    "name": "John Doe",
                    "createdAt": "2024-01-01T00:00:00Z",
                    "updatedAt": "2024-01-01T00:00:00Z",
                    "preferences": {
                        "units": "metric",
                        "timezone": "UTC",
                        "notifications": {
                            "email": true,
                            "push": true,
                            "workoutReminders": true,
                            "nutritionReminders": true
                        },
                        "privacy": {
                            "profileVisibility": "private",
                            "workoutSharing": false,
                            "progressSharing": false
                        }
                    }
                })
            })
        }
        None => {
            json!({
                "statusCode": 400,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization",
                    "Access-Control-Allow-Methods": "OPTIONS,POST,GET,PUT,DELETE"
                },
                "body": json!({
                    "error": "Bad Request",
                    "message": "User ID is required"
                })
            })
        }
    }
}

async fn handle_create_user(event: &Value) -> Value {
    // TODO: Implement actual user creation in DynamoDB
    json!({
        "statusCode": 201,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Allow-Methods": "OPTIONS,POST,GET,PUT,DELETE"
        },
        "body": json!({
            "id": "new-user-id",
            "email": "newuser@example.com",
            "name": "New User",
            "createdAt": "2024-01-01T00:00:00Z",
            "updatedAt": "2024-01-01T00:00:00Z",
            "message": "User created successfully"
        })
    })
}

async fn handle_update_user(user_id: Option<String>, event: &Value) -> Value {
    match user_id {
        Some(id) => {
            // TODO: Implement actual user update in DynamoDB
            json!({
                "statusCode": 200,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization",
                    "Access-Control-Allow-Methods": "OPTIONS,POST,GET,PUT,DELETE"
                },
                "body": json!({
                    "id": id,
                    "message": "User updated successfully"
                })
            })
        }
        None => {
            json!({
                "statusCode": 400,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization",
                    "Access-Control-Allow-Methods": "OPTIONS,POST,GET,PUT,DELETE"
                },
                "body": json!({
                    "error": "Bad Request",
                    "message": "User ID is required"
                })
            })
        }
    }
}

async fn handle_delete_user(user_id: Option<String>) -> Value {
    match user_id {
        Some(id) => {
            // TODO: Implement actual user deletion from DynamoDB
            json!({
                "statusCode": 200,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization",
                    "Access-Control-Allow-Methods": "OPTIONS,POST,GET,PUT,DELETE"
                },
                "body": json!({
                    "id": id,
                    "message": "User deleted successfully"
                })
            })
        }
        None => {
            json!({
                "statusCode": 400,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization",
                    "Access-Control-Allow-Methods": "OPTIONS,POST,GET,PUT,DELETE"
                },
                "body": json!({
                    "error": "Bad Request",
                    "message": "User ID is required"
                })
            })
        }
    }
}

async fn handle_list_users(headers: &serde_json::Map<String, Value>) -> Value {
    // TODO: Implement actual user listing from DynamoDB
    json!({
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Allow-Methods": "OPTIONS,POST,GET,PUT,DELETE"
        },
        "body": json!({
            "users": [
                {
                    "id": "user-1",
                    "email": "user1@example.com",
                    "name": "User One"
                },
                {
                    "id": "user-2",
                    "email": "user2@example.com",
                    "name": "User Two"
                }
            ],
            "pagination": {
                "page": 1,
                "limit": 10,
                "total": 2,
                "totalPages": 1
            }
        })
    })
}