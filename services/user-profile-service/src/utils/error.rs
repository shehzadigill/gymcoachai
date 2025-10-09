use std::fmt;
use serde_json::{json, Value};

/// Custom error types for the user profile service
#[derive(Debug)]
pub enum ServiceError {
    /// Authentication/Authorization errors
    Unauthorized(String),
    Forbidden(String),
    
    /// Validation errors
    ValidationError(String),
    InvalidData(String),
    
    /// Resource errors
    NotFound(String),
    Conflict(String),
    
    /// External service errors
    DatabaseError(String),
    S3Error(String),
    
    /// General errors
    InternalError(String),
    BadRequest(String),
}

impl fmt::Display for ServiceError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ServiceError::Unauthorized(msg) => write!(f, "Unauthorized: {}", msg),
            ServiceError::Forbidden(msg) => write!(f, "Forbidden: {}", msg),
            ServiceError::ValidationError(msg) => write!(f, "Validation Error: {}", msg),
            ServiceError::InvalidData(msg) => write!(f, "Invalid Data: {}", msg),
            ServiceError::NotFound(msg) => write!(f, "Not Found: {}", msg),
            ServiceError::Conflict(msg) => write!(f, "Conflict: {}", msg),
            ServiceError::DatabaseError(msg) => write!(f, "Database Error: {}", msg),
            ServiceError::S3Error(msg) => write!(f, "S3 Error: {}", msg),
            ServiceError::InternalError(msg) => write!(f, "Internal Error: {}", msg),
            ServiceError::BadRequest(msg) => write!(f, "Bad Request: {}", msg),
        }
    }
}

impl std::error::Error for ServiceError {}

/// Convert ServiceError to HTTP response
impl From<ServiceError> for Value {
    fn from(error: ServiceError) -> Self {
        use crate::utils::response::ResponseBuilder;
        
        match error {
            ServiceError::Unauthorized(msg) => ResponseBuilder::unauthorized(Some(&msg)),
            ServiceError::Forbidden(msg) => ResponseBuilder::forbidden(&msg),
            ServiceError::ValidationError(msg) => ResponseBuilder::validation_error(&msg, None),
            ServiceError::InvalidData(msg) => ResponseBuilder::validation_error(&msg, None),
            ServiceError::NotFound(msg) => ResponseBuilder::not_found(&msg),
            ServiceError::Conflict(msg) => ResponseBuilder::custom(409, json!({
                "error": "Conflict",
                "message": msg
            })),
            ServiceError::DatabaseError(msg) => ResponseBuilder::internal_server_error(&format!("Database error: {}", msg)),
            ServiceError::S3Error(msg) => ResponseBuilder::internal_server_error(&format!("Storage error: {}", msg)),
            ServiceError::InternalError(msg) => ResponseBuilder::internal_server_error(&msg),
            ServiceError::BadRequest(msg) => ResponseBuilder::bad_request(&msg),
        }
    }
}

/// Result type alias for service operations
pub type ServiceResult<T> = Result<T, ServiceError>;

/// Helper functions for creating common errors
pub mod helpers {
    use super::*;

    pub fn unauthorized_access(resource: &str) -> ServiceError {
        ServiceError::Unauthorized(format!("You can only access your own {}", resource))
    }

    pub fn forbidden_modification(resource: &str) -> ServiceError {
        ServiceError::Forbidden(format!("You can only modify your own {}", resource))
    }

    pub fn forbidden_deletion(resource: &str) -> ServiceError {
        ServiceError::Forbidden(format!("You can only delete your own {}", resource))
    }

    pub fn validation_failed(message: &str) -> ServiceError {
        ServiceError::ValidationError(message.to_string())
    }

    pub fn invalid_json() -> ServiceError {
        ServiceError::BadRequest("Invalid JSON in request body".to_string())
    }

    pub fn resource_not_found(resource: &str) -> ServiceError {
        ServiceError::NotFound(format!("{} not found", resource))
    }

    pub fn database_error(message: &str) -> ServiceError {
        ServiceError::DatabaseError(message.to_string())
    }

    pub fn s3_error(message: &str) -> ServiceError {
        ServiceError::S3Error(message.to_string())
    }

    pub fn internal_error(message: &str) -> ServiceError {
        ServiceError::InternalError(message.to_string())
    }
}
