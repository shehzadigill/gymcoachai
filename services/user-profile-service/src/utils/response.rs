use serde_json::{json, Value, Map};

use crate::utils::constants::*;
use crate::utils::http::get_cors_headers;

/// HTTP Response builder for consistent API responses
pub struct ResponseBuilder;

impl ResponseBuilder {
    /// Create a successful response (200 OK)
    pub fn ok<T: serde::Serialize>(data: T) -> Value {
        json!({
            "statusCode": HTTP_OK,
            "headers": get_cors_headers(),
            "body": data
        })
    }

    /// Create a created response (201 Created)
    pub fn created<T: serde::Serialize>(data: T) -> Value {
        json!({
            "statusCode": HTTP_CREATED,
            "headers": get_cors_headers(),
            "body": data
        })
    }

    /// Create a bad request response (400 Bad Request)
    pub fn bad_request(message: &str) -> Value {
        json!({
            "statusCode": HTTP_BAD_REQUEST,
            "headers": get_cors_headers(),
            "body": json!({
                "error": ERROR_BAD_REQUEST,
                "message": message
            })
        })
    }

    /// Create a validation error response (400 Bad Request)
    pub fn validation_error(message: &str, details: Option<Value>) -> Value {
        let mut body = json!({
            "error": ERROR_VALIDATION_ERROR,
            "message": message
        });
        
        if let Some(details) = details {
            body["details"] = details;
        }
        
        json!({
            "statusCode": HTTP_BAD_REQUEST,
            "headers": get_cors_headers(),
            "body": body
        })
    }

    /// Create an unauthorized response (401 Unauthorized)
    pub fn unauthorized(message: Option<&str>) -> Value {
        json!({
            "statusCode": HTTP_UNAUTHORIZED,
            "headers": get_cors_headers(),
            "body": json!({
                "error": ERROR_UNAUTHORIZED,
                "message": message.unwrap_or(MESSAGE_AUTHENTICATION_FAILED)
            })
        })
    }

    /// Create a forbidden response (403 Forbidden)
    pub fn forbidden(message: &str) -> Value {
        json!({
            "statusCode": HTTP_FORBIDDEN,
            "headers": get_cors_headers(),
            "body": json!({
                "error": ERROR_FORBIDDEN,
                "message": message
            })
        })
    }

    /// Create a not found response (404 Not Found)
    pub fn not_found(message: &str) -> Value {
        json!({
            "statusCode": HTTP_NOT_FOUND,
            "headers": get_cors_headers(),
            "body": json!({
                "error": ERROR_NOT_FOUND,
                "message": message
            })
        })
    }

    /// Create an internal server error response (500 Internal Server Error)
    pub fn internal_server_error(message: &str) -> Value {
        json!({
            "statusCode": HTTP_INTERNAL_SERVER_ERROR,
            "headers": get_cors_headers(),
            "body": json!({
                "error": ERROR_INTERNAL_SERVER_ERROR,
                "message": message
            })
        })
    }

    /// Create a CORS preflight response (200 OK)
    pub fn cors_preflight() -> Value {
        json!({
            "statusCode": HTTP_OK,
            "headers": get_cors_headers()
        })
    }

    /// Create a custom response with specific status code
    pub fn custom<T: serde::Serialize>(status_code: u16, data: T) -> Value {
        json!({
            "statusCode": status_code,
            "headers": get_cors_headers(),
            "body": data
        })
    }
}

/// Helper functions for common response patterns
pub mod helpers {
    use super::*;

    /// Create a response for when user cannot access a resource
    pub fn access_denied(resource: &str) -> Value {
        ResponseBuilder::forbidden(&format!("You can only access your own {}", resource))
    }

    /// Create a response for when user cannot modify a resource
    pub fn modification_denied(resource: &str) -> Value {
        ResponseBuilder::forbidden(&format!("You can only modify your own {}", resource))
    }

    /// Create a response for when user cannot delete a resource
    pub fn deletion_denied(resource: &str) -> Value {
        ResponseBuilder::forbidden(&format!("You can only delete your own {}", resource))
    }

    /// Create a response for invalid JSON parsing
    pub fn invalid_json() -> Value {
        ResponseBuilder::bad_request(MESSAGE_INVALID_JSON)
    }

    /// Create a response for invalid data validation
    pub fn invalid_data(message: &str) -> Value {
        ResponseBuilder::validation_error(message, None)
    }

    /// Create a response for resource not found
    pub fn resource_not_found(resource: &str) -> Value {
        ResponseBuilder::not_found(&format!("{} not found", resource))
    }

    /// Create a response for successful deletion
    pub fn deleted_successfully(resource: &str) -> Value {
        ResponseBuilder::ok(json!({
            "message": format!("{} deleted successfully", resource)
        }))
    }
}
