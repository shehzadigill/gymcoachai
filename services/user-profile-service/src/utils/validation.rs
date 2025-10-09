use validator::Validate;
use serde_json::Value;

use crate::utils::error::{ServiceResult, helpers as error_helpers};

/// Validation utilities for common operations
pub struct ValidationHelper;

impl ValidationHelper {
    /// Validate a struct that implements Validate trait
    pub fn validate_struct<T: Validate>(data: &T) -> ServiceResult<()> {
        data.validate()
            .map_err(|errors| error_helpers::validation_failed(&format!("Invalid data: {}", errors)))
    }

    /// Validate JSON data against a schema (basic validation)
    pub fn validate_json_structure(data: &Value, required_fields: &[&str]) -> ServiceResult<()> {
        if let Some(obj) = data.as_object() {
            for field in required_fields {
                if !obj.contains_key(*field) {
                    return Err(error_helpers::validation_failed(&format!("Missing required field: {}", field)));
                }
            }
        } else {
            return Err(error_helpers::validation_failed("Expected JSON object"));
        }
        Ok(())
    }

    /// Validate user ID format
    pub fn validate_user_id(user_id: &str) -> ServiceResult<()> {
        if user_id.is_empty() {
            return Err(error_helpers::validation_failed("User ID cannot be empty"));
        }
        
        if user_id.len() < 3 || user_id.len() > 100 {
            return Err(error_helpers::validation_failed("User ID must be between 3 and 100 characters"));
        }
        
        // Basic format validation (alphanumeric and some special chars)
        if !user_id.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
            return Err(error_helpers::validation_failed("User ID contains invalid characters"));
        }
        
        Ok(())
    }

    /// Validate email format
    pub fn validate_email(email: &str) -> ServiceResult<()> {
        if email.is_empty() {
            return Err(error_helpers::validation_failed("Email cannot be empty"));
        }
        
        if !email.contains('@') || !email.contains('.') {
            return Err(error_helpers::validation_failed("Invalid email format"));
        }
        
        Ok(())
    }

    /// Validate date format (YYYY-MM-DD)
    pub fn validate_date_format(date: &str) -> ServiceResult<()> {
        if date.is_empty() {
            return Err(error_helpers::validation_failed("Date cannot be empty"));
        }
        
        if date.len() != 10 {
            return Err(error_helpers::validation_failed("Date must be in YYYY-MM-DD format"));
        }
        
        // Basic format check
        if !date.chars().enumerate().all(|(i, c)| {
            match i {
                4 | 7 => c == '-',
                _ => c.is_ascii_digit(),
            }
        }) {
            return Err(error_helpers::validation_failed("Date must be in YYYY-MM-DD format"));
        }
        
        Ok(())
    }

    /// Validate numeric range
    pub fn validate_range(value: f64, min: f64, max: f64, field_name: &str) -> ServiceResult<()> {
        if value < min || value > max {
            return Err(error_helpers::validation_failed(
                &format!("{} must be between {} and {}", field_name, min, max)
            ));
        }
        Ok(())
    }

    /// Validate string length
    pub fn validate_string_length(value: &str, min: usize, max: usize, field_name: &str) -> ServiceResult<()> {
        let len = value.len();
        if len < min || len > max {
            return Err(error_helpers::validation_failed(
                &format!("{} must be between {} and {} characters", field_name, min, max)
            ));
        }
        Ok(())
    }

    /// Validate optional string length
    pub fn validate_optional_string_length(value: Option<&str>, min: usize, max: usize, field_name: &str) -> ServiceResult<()> {
        if let Some(val) = value {
            Self::validate_string_length(val, min, max, field_name)?;
        }
        Ok(())
    }
}

/// Authorization utilities
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

    /// Check if user can manage user profiles
    pub fn can_manage_user_profiles(roles: &[String]) -> bool {
        roles.contains(&"admin".to_string()) || roles.contains(&"coach".to_string())
    }

    /// Check if user can access sleep data
    pub fn can_access_sleep_data(auth_user_id: &str, resource_user_id: &str, roles: &[String]) -> bool {
        Self::can_access_user_profile(auth_user_id, resource_user_id, roles)
    }
}

/// Data transformation utilities
pub struct DataHelper;

impl DataHelper {
    /// Safely parse JSON string to Value
    pub fn parse_json_safe(json_str: &str) -> ServiceResult<Value> {
        serde_json::from_str(json_str)
            .map_err(|_| error_helpers::invalid_json())
    }

    /// Safely parse JSON string to specific type
    pub fn parse_json_to_type<T: serde::de::DeserializeOwned>(json_str: &str) -> ServiceResult<T> {
        serde_json::from_str(json_str)
            .map_err(|_| error_helpers::invalid_json())
    }

    /// Convert string to i32 with validation
    pub fn parse_i32_safe(value: &str, field_name: &str) -> ServiceResult<i32> {
        value.parse::<i32>()
            .map_err(|_| error_helpers::validation_failed(&format!("{} must be a valid integer", field_name)))
    }

    /// Convert string to f32 with validation
    pub fn parse_f32_safe(value: &str, field_name: &str) -> ServiceResult<f32> {
        value.parse::<f32>()
            .map_err(|_| error_helpers::validation_failed(&format!("{} must be a valid number", field_name)))
    }

    /// Convert string to u32 with validation
    pub fn parse_u32_safe(value: &str, field_name: &str) -> ServiceResult<u32> {
        value.parse::<u32>()
            .map_err(|_| error_helpers::validation_failed(&format!("{} must be a valid positive integer", field_name)))
    }
}
