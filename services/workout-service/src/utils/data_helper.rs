use serde_json::Value;
use anyhow::Result;

use crate::utils::error::{ServiceError, ServiceResult, helpers as error_helpers};

/// Data parsing and validation helper
pub struct DataHelper;

impl DataHelper {
    /// Safely parse a JSON string to a `serde_json::Value`
    pub fn parse_json_safe(body: &str) -> ServiceResult<Value> {
        serde_json::from_str(body)
            .map_err(|e| error_helpers::validation_error(&format!("Invalid JSON in request body: {}", e), None))
    }

    /// Parse query string parameters
    pub fn parse_query_string(query: Option<&str>) -> std::collections::HashMap<String, String> {
        let mut params = std::collections::HashMap::new();
        
        if let Some(query_str) = query {
            for pair in query_str.split('&') {
                if let Some((key, value)) = pair.split_once('=') {
                    params.insert(
                        urlencoding::decode(key).unwrap_or_default().to_string(),
                        urlencoding::decode(value).unwrap_or_default().to_string()
                    );
                }
            }
        }
        
        params
    }

    /// Extract user ID from path parameters
    pub fn extract_user_id(path_params: &std::collections::HashMap<String, String>) -> Option<String> {
        path_params.get("userId").cloned()
    }

    /// Extract plan ID from path parameters
    pub fn extract_plan_id(path_params: &std::collections::HashMap<String, String>) -> Option<String> {
        path_params.get("planId").cloned()
    }

    /// Extract session ID from path parameters
    pub fn extract_session_id(path_params: &std::collections::HashMap<String, String>) -> Option<String> {
        path_params.get("sessionId").cloned()
    }

    /// Extract exercise ID from path parameters
    pub fn extract_exercise_id(path_params: &std::collections::HashMap<String, String>) -> Option<String> {
        path_params.get("exerciseId").cloned()
    }

    /// Extract schedule ID from path parameters
    pub fn extract_schedule_id(path_params: &std::collections::HashMap<String, String>) -> Option<String> {
        path_params.get("scheduleId").cloned()
    }

    /// Validate required fields in JSON data
    pub fn validate_required_fields(data: &Value, required_fields: &[&str]) -> ServiceResult<()> {
        for field in required_fields {
            if !data.get(field).is_some() {
                return Err(error_helpers::validation_error(
                    &format!("Missing required field: {}", field),
                    None
                ));
            }
        }
        Ok(())
    }

    /// Extract string value from JSON with default
    pub fn extract_string(data: &Value, key: &str, default: &str) -> String {
        data.get(key)
            .and_then(|v| v.as_str())
            .unwrap_or(default)
            .to_string()
    }

    /// Extract optional string value from JSON
    pub fn extract_optional_string(data: &Value, key: &str) -> Option<String> {
        data.get(key)
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    }

    /// Extract number value from JSON with default
    pub fn extract_number<T>(data: &Value, key: &str, default: T) -> T 
    where
        T: From<u64> + Copy,
    {
        data.get(key)
            .and_then(|v| v.as_u64())
            .map(|n| n.into())
            .unwrap_or(default)
    }

    /// Extract optional number value from JSON
    pub fn extract_optional_number<T>(data: &Value, key: &str) -> Option<T> 
    where
        T: From<u64>,
    {
        data.get(key)
            .and_then(|v| v.as_u64())
            .map(|n| n.into())
    }

    /// Extract boolean value from JSON with default
    pub fn extract_bool(data: &Value, key: &str, default: bool) -> bool {
        data.get(key)
            .and_then(|v| v.as_bool())
            .unwrap_or(default)
    }

    /// Extract optional boolean value from JSON
    pub fn extract_optional_bool(data: &Value, key: &str) -> Option<bool> {
        data.get(key)
            .and_then(|v| v.as_bool())
    }

    /// Extract array value from JSON with default
    pub fn extract_array<T>(data: &Value, key: &str) -> Vec<T>
    where
        T: for<'de> serde::Deserialize<'de>,
    {
        data.get(key)
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| serde_json::from_value(v.clone()).ok())
                    .collect()
            })
            .unwrap_or_default()
    }

    /// Extract optional array value from JSON
    pub fn extract_optional_array<T>(data: &Value, key: &str) -> Option<Vec<T>>
    where
        T: for<'de> serde::Deserialize<'de>,
    {
        data.get(key)
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| serde_json::from_value(v.clone()).ok())
                    .collect()
            })
    }
}
