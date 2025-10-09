use serde_json::{Value, Map};
use std::collections::HashMap;

use crate::utils::constants::*;

/// Parse query string parameters from Lambda event
pub fn parse_query_string(event: &Value) -> HashMap<String, String> {
    let mut params = HashMap::new();
    
    if let Some(query_params) = event.get("queryStringParameters") {
        if let Some(query_obj) = query_params.as_object() {
            for (key, value) in query_obj {
                if let Some(value_str) = value.as_str() {
                    params.insert(key.clone(), value_str.to_string());
                }
            }
        }
    }
    
    params
}

/// Check if the request is a CORS preflight request
pub fn is_cors_preflight_request(http_method: &str) -> bool {
    http_method == METHOD_OPTIONS
}

/// Get standard CORS headers
pub fn get_cors_headers() -> Map<String, Value> {
    let mut headers = Map::new();
    headers.insert(HEADER_CONTENT_TYPE.to_string(), "application/json".into());
    headers.insert(HEADER_ACCESS_CONTROL_ALLOW_ORIGIN.to_string(), "*".into());
    headers.insert(HEADER_ACCESS_CONTROL_ALLOW_HEADERS.to_string(), "Content-Type, Authorization".into());
    headers.insert(HEADER_ACCESS_CONTROL_ALLOW_METHODS.to_string(), "OPTIONS,POST,GET,PUT,DELETE".into());
    headers
}

/// Get current UTC date in YYYY-MM-DD format
pub fn get_current_date() -> String {
    chrono::Utc::now().format("%Y-%m-%d").to_string()
}

/// Get current UTC timestamp in RFC3339 format
pub fn get_current_timestamp() -> String {
    chrono::Utc::now().to_rfc3339()
}

/// Extract user ID from path
pub fn extract_user_id_from_path(path: &str) -> Option<String> {
    let path_parts: Vec<&str> = path.split('/').collect();
    
    if path_parts.len() >= 3 && path_parts[1] == "users" {
        Some(path_parts[2].to_string())
    } else if path_parts.len() >= 4 && path_parts[2] == "users" {
        Some(path_parts[3].to_string())
    } else if path_parts.len() >= 2 && path_parts[1] == "me" {
        // Handle /me endpoints - will be resolved in main.rs with auth context
        Some("me".to_string())
    } else if path_parts.len() >= 4 && path_parts[1] == "api" && path_parts[2] == "nutrition" && path_parts[3] == "me" {
        // Handle /api/nutrition/me endpoints
        Some("me".to_string())
    } else if path_parts.len() >= 5 && path_parts[1] == "api" && path_parts[2] == "nutrition" && path_parts[3] == "users" {
        // Handle /api/nutrition/users/{userId} endpoints
        Some(path_parts[4].to_string())
    } else {
        None
    }
}
