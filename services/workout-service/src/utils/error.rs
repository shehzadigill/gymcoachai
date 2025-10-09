use std::fmt;
use serde_json::Value;

/// Custom error types for the nutrition service
#[derive(Debug)]
pub enum ServiceError {
    /// Authentication/Authorization errors
    Unauthorized(String),
    Forbidden(String),
    /// Validation errors
    Validation(String, Option<Value>),
    /// Resource not found errors
    NotFound(String),
    /// Database operation errors
    Database(String),
    /// S3 operation errors
    S3(String),
    /// Conflict errors (e.g., resource already exists)
    Conflict(String),
    /// Generic internal server errors
    Internal(String),
}

impl fmt::Display for ServiceError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            ServiceError::Unauthorized(msg) => write!(f, "Unauthorized: {}", msg),
            ServiceError::Forbidden(msg) => write!(f, "Forbidden: {}", msg),
            ServiceError::Validation(msg, _) => write!(f, "Validation Error: {}", msg),
            ServiceError::NotFound(msg) => write!(f, "Not Found: {}", msg),
            ServiceError::Database(msg) => write!(f, "Database Error: {}", msg),
            ServiceError::S3(msg) => write!(f, "S3 Error: {}", msg),
            ServiceError::Conflict(msg) => write!(f, "Conflict: {}", msg),
            ServiceError::Internal(msg) => write!(f, "Internal Server Error: {}", msg),
        }
    }
}

impl std::error::Error for ServiceError {}

/// A specialized `Result` type for service operations.
pub type ServiceResult<T> = Result<T, ServiceError>;

/// Helper functions for creating common `ServiceError` instances.
pub mod helpers {
    use serde_json::Value;
    use super::ServiceError;

    pub fn unauthorized(message: &str) -> ServiceError {
        ServiceError::Unauthorized(message.to_string())
    }

    pub fn forbidden(message: &str) -> ServiceError {
        ServiceError::Forbidden(message.to_string())
    }

    pub fn validation_error(message: &str, details: Option<Value>) -> ServiceError {
        ServiceError::Validation(message.to_string(), details)
    }

    pub fn not_found(message: &str) -> ServiceError {
        ServiceError::NotFound(message.to_string())
    }

    pub fn database_error(message: &str) -> ServiceError {
        ServiceError::Database(message.to_string())
    }

    pub fn s3_error(message: &str) -> ServiceError {
        ServiceError::S3(message.to_string())
    }

    pub fn conflict(message: &str) -> ServiceError {
        ServiceError::Conflict(message.to_string())
    }

    pub fn internal_error(message: &str) -> ServiceError {
        ServiceError::Internal(message.to_string())
    }

    pub fn unauthorized_access(resource: &str) -> ServiceError {
        ServiceError::Unauthorized(format!("Unauthorized access to {}", resource))
    }

    pub fn forbidden_modification(resource: &str) -> ServiceError {
        ServiceError::Forbidden(format!("Modification denied for {}", resource))
    }

    pub fn forbidden_deletion(resource: &str) -> ServiceError {
        ServiceError::Forbidden(format!("Deletion denied for {}", resource))
    }

    pub fn validation_failed(message: &str) -> ServiceError {
        ServiceError::Validation(message.to_string(), None)
    }

    pub fn resource_not_found(resource: &str) -> ServiceError {
        ServiceError::NotFound(format!("{} not found", resource))
    }

}
