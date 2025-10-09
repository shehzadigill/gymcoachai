use validator::Validate;
use serde_json::Value;

use crate::utils::error::{ServiceResult, helpers as error_helpers};

/// Validation utilities for common operations
pub struct ValidationHelper;

impl ValidationHelper {
    /// Validate a struct that implements Validate trait
    pub fn validate_struct<T: Validate>(data: &T) -> ServiceResult<()> {
        data.validate().map_err(|e| error_helpers::validation_error(&e.to_string(), None))
    }

    /// Validate the presence of required fields in a JSON object
    pub fn validate_json_structure(data: &Value, required_fields: &[&str]) -> ServiceResult<()> {
        if let Some(obj) = data.as_object() {
            for field in required_fields {
                if !obj.contains_key(*field) {
                    return Err(error_helpers::validation_error(&format!("Missing required field: {}", field), None));
                }
            }
            Ok(())
        } else {
            Err(error_helpers::validation_error("Invalid JSON structure, expected an object", None))
        }
    }

    /// Validate user ID format
    pub fn validate_user_id(user_id: &str) -> ServiceResult<()> {
        if user_id.is_empty() {
            return Err(error_helpers::validation_error("User ID cannot be empty", None));
        }
        if user_id.len() > 255 {
            return Err(error_helpers::validation_error("User ID too long", None));
        }
        Ok(())
    }

    /// Validate email format
    pub fn validate_email(email: &str) -> ServiceResult<()> {
        if email.is_empty() {
            return Err(error_helpers::validation_error("Email cannot be empty", None));
        }
        if !email.contains('@') {
            return Err(error_helpers::validation_error("Invalid email format", None));
        }
        if email.len() > 255 {
            return Err(error_helpers::validation_error("Email too long", None));
        }
        Ok(())
    }

    /// Validate date format (YYYY-MM-DD or ISO 8601)
    pub fn validate_date_format(date: &str) -> ServiceResult<()> {
        if date.is_empty() {
            return Err(error_helpers::validation_error("Date cannot be empty", None));
        }
        
        // Try YYYY-MM-DD format first
        if chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d").is_ok() {
            return Ok(());
        }
        
        // Try ISO 8601 format
        if chrono::DateTime::parse_from_rfc3339(date).is_ok() {
            return Ok(());
        }
        
        Err(error_helpers::validation_error("Invalid date format. Use YYYY-MM-DD or ISO 8601", None))
    }

    /// Validate numeric range
    pub fn validate_range(value: f64, min: f64, max: f64, field_name: &str) -> ServiceResult<()> {
        if value < min || value > max {
            return Err(error_helpers::validation_error(
                &format!("{} must be between {} and {}", field_name, min, max), 
                None
            ));
        }
        Ok(())
    }

    /// Validate string length
    pub fn validate_string_length(value: &str, min: usize, max: usize, field_name: &str) -> ServiceResult<()> {
        if value.len() < min || value.len() > max {
            return Err(error_helpers::validation_error(
                &format!("{} must be between {} and {} characters", field_name, min, max), 
                None
            ));
        }
        Ok(())
    }

    /// Validate optional string length
    pub fn validate_optional_string_length(value: Option<&str>, min: usize, max: usize, field_name: &str) -> ServiceResult<()> {
        if let Some(v) = value {
            Self::validate_string_length(v, min, max, field_name)
        } else {
            Ok(())
        }
    }
}

/// Authorization helper functions
pub struct AuthorizationHelper;

impl AuthorizationHelper {
    /// Check if user can access a resource
    pub fn can_access_user_profile(auth_user_id: &str, resource_user_id: &str, roles: &[String]) -> bool {
        // Admin can access any user profile
        if roles.contains(&"admin".to_string()) {
            return true;
        }
        
        // Coaches can access user profiles for coaching purposes
        if roles.contains(&"coach".to_string()) {
            return true;
        }
        
        // Users can only access their own profile
        auth_user_id == resource_user_id
    }

    /// Check if user can manage user profiles (e.g., admin or coach)
    pub fn can_manage_user_profiles(roles: &[String]) -> bool {
        roles.contains(&"admin".to_string()) || 
        roles.contains(&"coach".to_string())
    }

    /// Check if user can access sleep data
    pub fn can_access_sleep_data(auth_user_id: &str, resource_user_id: &str, roles: &[String]) -> bool {
        // Admin can access any user profile
        if roles.contains(&"admin".to_string()) {
            return true;
        }
        
        // Coaches can access user profiles for coaching purposes
        if roles.contains(&"coach".to_string()) {
            return true;
        }
        
        // Users can only access their own profile
        auth_user_id == resource_user_id
    }
}

/// Data parsing and conversion utilities
pub struct DataHelper;

impl DataHelper {
    /// Safely parse a JSON string to a specified type
    pub fn parse_json_to_type<T: serde::de::DeserializeOwned>(body: &str) -> ServiceResult<T> {
        serde_json::from_str(body)
            .map_err(|e| error_helpers::validation_error(&format!("Invalid JSON in request body: {}", e), None))
    }

    /// Safely parse a JSON string to a `serde_json::Value`
    pub fn parse_json_safe(body: &str) -> ServiceResult<Value> {
        serde_json::from_str(body)
            .map_err(|e| error_helpers::validation_error(&format!("Invalid JSON in request body: {}", e), None))
    }

    /// Parse integer safely with error handling
    pub fn parse_i32_safe(value: &str, field_name: &str) -> ServiceResult<i32> {
        value.parse::<i32>()
            .map_err(|_| error_helpers::validation_error(&format!("Invalid integer for {}", field_name), None))
    }

    /// Parse float safely with error handling
    pub fn parse_f32_safe(value: &str, field_name: &str) -> ServiceResult<f32> {
        value.parse::<f32>()
            .map_err(|_| error_helpers::validation_error(&format!("Invalid float for {}", field_name), None))
    }

    /// Parse unsigned integer safely with error handling
    pub fn parse_u32_safe(value: &str, field_name: &str) -> ServiceResult<u32> {
        value.parse::<u32>()
            .map_err(|_| error_helpers::validation_error(&format!("Invalid unsigned integer for {}", field_name), None))
    }
}
