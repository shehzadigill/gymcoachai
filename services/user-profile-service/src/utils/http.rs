use serde_json::{Map, Value};
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

/// Extract user ID from path parameters
pub fn extract_user_id_from_path(path: &str) -> Option<String> {
    let parts: Vec<&str> = path.split('/').collect();
    // Expect formats:
    // - /api/user-profiles/profile
    // - /api/user-profiles/profile/{userId}
    // - /api/user-profiles/profile/me
    // - /api/user-profiles/profile/preferences
    // - /api/user-profiles/profile/preferences/{userId}
    // - /api/user-profiles/profile/stats
    // - /api/user-profiles/profile/stats/{userId}

    if parts.len() >= 4 && parts[1] == "api" && parts[2] == "user-profiles" && parts[3] == "profile"
    {
        // Handle preferences endpoint: /api/user-profiles/profile/preferences/{userId}
        if parts.len() >= 6 && parts[4] == "preferences" {
            let user_id = parts[5];
            if user_id == "me" || user_id.is_empty() {
                None
            } else {
                Some(user_id.to_string())
            }
        }
        // Handle stats endpoint: /api/user-profiles/profile/stats/{userId}
        else if parts.len() >= 6 && parts[4] == "stats" {
            let user_id = parts[5];
            if user_id == "me" || user_id.is_empty() {
                None
            } else {
                Some(user_id.to_string())
            }
        }
        // Handle base profile endpoint: /api/user-profiles/profile/{userId}
        else if parts.len() > 4 {
            let user_id = parts[4];
            if user_id == "me"
                || user_id.is_empty()
                || user_id == "preferences"
                || user_id == "stats"
            {
                None
            } else {
                Some(user_id.to_string())
            }
        } else {
            None
        }
    } else {
        None
    }
}

/// Get CORS headers for HTTP responses
pub fn get_cors_headers() -> Map<String, Value> {
    let mut headers = Map::new();
    headers.insert("Content-Type".to_string(), CONTENT_TYPE_JSON.into());
    headers.insert(
        "Access-Control-Allow-Origin".to_string(),
        CORS_ORIGIN.into(),
    );
    headers.insert(
        "Access-Control-Allow-Headers".to_string(),
        CORS_HEADERS.into(),
    );
    headers.insert(
        "Access-Control-Allow-Methods".to_string(),
        CORS_METHODS.into(),
    );
    headers
}

/// Check if request is a CORS preflight request
pub fn is_cors_preflight_request(method: &str) -> bool {
    method == "OPTIONS"
}

/// Get current date in default format
pub fn get_current_date() -> String {
    chrono::Utc::now().format(DEFAULT_DATE_FORMAT).to_string()
}

/// Get current timestamp in RFC3339 format
pub fn get_current_timestamp() -> String {
    chrono::Utc::now().to_rfc3339()
}
