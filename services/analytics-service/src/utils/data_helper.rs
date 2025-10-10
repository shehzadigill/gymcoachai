use serde_json::Value;
use std::collections::HashMap;

pub struct DataHelper;

impl DataHelper {
    /// Extract user ID from path parameters or query parameters
    pub fn extract_user_id(
        path_params: &HashMap<String, String>,
        query_params: &HashMap<String, String>,
        auth_user_id: &str,
    ) -> String {
        path_params
            .get("userId")
            .or_else(|| query_params.get("userId"))
            .cloned()
            .unwrap_or_else(|| auth_user_id.to_string())
    }

    /// Extract photo ID from path parameters
    pub fn extract_photo_id(path_params: &HashMap<String, String>) -> Option<String> {
        path_params.get("photoId").cloned()
    }

    /// Extract start date from query parameters
    pub fn extract_start_date(query_params: &HashMap<String, String>) -> Option<String> {
        query_params.get("startDate").cloned()
    }

    /// Extract end date from query parameters
    pub fn extract_end_date(query_params: &HashMap<String, String>) -> Option<String> {
        query_params.get("endDate").cloned()
    }

    /// Extract period from query parameters
    pub fn extract_period(query_params: &HashMap<String, String>) -> Option<String> {
        query_params.get("period").cloned()
    }

    /// Extract time range from query parameters (supports both 'period' and 'time_range')
    pub fn extract_time_range(query_params: &HashMap<String, String>) -> Option<String> {
        query_params
            .get("time_range")
            .or_else(|| query_params.get("period"))
            .cloned()
    }

    /// Convert time range to start and end dates
    pub fn time_range_to_dates(time_range: &str) -> (String, String) {
        use chrono::Utc;

        match time_range {
            "1w" | "week" => (
                (Utc::now() - chrono::Duration::days(7)).to_rfc3339(),
                Utc::now().to_rfc3339(),
            ),
            "1m" | "month" => (
                (Utc::now() - chrono::Duration::days(30)).to_rfc3339(),
                Utc::now().to_rfc3339(),
            ),
            "3m" | "quarter" => (
                (Utc::now() - chrono::Duration::days(90)).to_rfc3339(),
                Utc::now().to_rfc3339(),
            ),
            "1y" | "year" => (
                (Utc::now() - chrono::Duration::days(365)).to_rfc3339(),
                Utc::now().to_rfc3339(),
            ),
            _ => (
                (Utc::now() - chrono::Duration::days(30)).to_rfc3339(),
                Utc::now().to_rfc3339(),
            ),
        }
    }

    /// Extract photo type from query parameters
    pub fn extract_photo_type(query_params: &HashMap<String, String>) -> Option<String> {
        query_params.get("photoType").cloned()
    }

    /// Extract limit from query parameters
    pub fn extract_limit(query_params: &HashMap<String, String>) -> Option<u32> {
        query_params
            .get("limit")
            .and_then(|s| s.parse::<u32>().ok())
    }

    /// Validate required fields in request body
    pub fn validate_required_fields(body: &Value, required_fields: &[&str]) -> Result<(), String> {
        for field in required_fields {
            if !body.get(field).is_some() {
                return Err(format!("Missing required field: {}", field));
            }
        }
        Ok(())
    }

    /// Extract string value from JSON with default
    pub fn extract_string(body: &Value, key: &str, default: &str) -> String {
        body.get(key)
            .and_then(|v| v.as_str())
            .unwrap_or(default)
            .to_string()
    }

    /// Extract optional string value from JSON
    pub fn extract_optional_string(body: &Value, key: &str) -> Option<String> {
        body.get(key)
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    }

    /// Extract number value from JSON with default
    pub fn extract_number(body: &Value, key: &str, default: f64) -> f64 {
        body.get(key).and_then(|v| v.as_f64()).unwrap_or(default)
    }

    /// Extract optional number value from JSON
    pub fn extract_optional_number(body: &Value, key: &str) -> Option<f64> {
        body.get(key).and_then(|v| v.as_f64())
    }

    /// Extract boolean value from JSON with default
    pub fn extract_bool(body: &Value, key: &str, default: bool) -> bool {
        body.get(key).and_then(|v| v.as_bool()).unwrap_or(default)
    }

    /// Extract optional boolean value from JSON
    pub fn extract_optional_bool(body: &Value, key: &str) -> Option<bool> {
        body.get(key).and_then(|v| v.as_bool())
    }

    /// Extract array value from JSON
    pub fn extract_array<T>(body: &Value, key: &str) -> Vec<T>
    where
        T: for<'de> serde::Deserialize<'de>,
    {
        body.get(key)
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| serde_json::from_value(v.clone()).ok())
                    .collect()
            })
            .unwrap_or_default()
    }

    /// Extract optional array value from JSON
    pub fn extract_optional_array<T>(body: &Value, key: &str) -> Option<Vec<T>>
    where
        T: for<'de> serde::Deserialize<'de>,
    {
        body.get(key).and_then(|v| v.as_array()).map(|arr| {
            arr.iter()
                .filter_map(|v| serde_json::from_value(v.clone()).ok())
                .collect()
        })
    }
}
