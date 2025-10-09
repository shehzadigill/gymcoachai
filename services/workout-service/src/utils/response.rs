use serde_json::{json, Value};

use crate::utils::constants::*;
use crate::utils::http::get_cors_headers;

/// HTTP Response builder for consistent API responses
pub struct ResponseBuilder;

impl ResponseBuilder {
    /// Build a custom HTTP response
    pub fn custom(status_code: u16, body: Value) -> Value {
        json!({
            "statusCode": status_code,
            "headers": get_cors_headers(),
            "body": body
        })
    }

    /// Build a 200 OK response
    pub fn ok<T: serde::Serialize>(data: T) -> Value {
        Self::custom(200, json!(data))
    }

    /// Build a 200 OK response (alias for ok)
    pub fn success<T: serde::Serialize>(data: T) -> Value {
        Self::ok(data)
    }

    /// Build a 201 Created response
    pub fn created<T: serde::Serialize>(data: T) -> Value {
        Self::custom(201, json!(data))
    }

    /// Build a 204 No Content response
    pub fn no_content() -> Value {
        Self::custom(204, json!({}))
    }

    /// Build a 400 Bad Request response
    pub fn bad_request(message: &str) -> Value {
        Self::custom(400, json!({
            "error": MESSAGE_BAD_REQUEST,
            "message": message
        }))
    }

    /// Build a 401 Unauthorized response
    pub fn unauthorized(message: Option<&str>) -> Value {
        Self::custom(401, json!({
            "error": MESSAGE_UNAUTHORIZED,
            "message": message.unwrap_or("Authentication failed")
        }))
    }

    /// Build a 403 Forbidden response
    pub fn forbidden(message: &str) -> Value {
        Self::custom(403, json!({
            "error": MESSAGE_FORBIDDEN,
            "message": message
        }))
    }

    /// Build a 404 Not Found response
    pub fn not_found(message: &str) -> Value {
        Self::custom(404, json!({
            "error": "Not Found",
            "message": message
        }))
    }

    /// Build a 409 Conflict response
    pub fn conflict(message: &str) -> Value {
        Self::custom(409, json!({
            "error": "Conflict",
            "message": message
        }))
    }

    /// Build a 422 Unprocessable Entity response for validation errors
    pub fn validation_error(message: &str, details: Option<Value>) -> Value {
        json!({
            "statusCode": 422,
            "headers": get_cors_headers(),
            "body": json!({
                "error": MESSAGE_VALIDATION_ERROR,
                "message": message,
                "details": details
            })
        })
    }

    /// Build a 500 Internal Server Error response
    pub fn internal_server_error(message: &str) -> Value {
        Self::custom(500, json!({
            "error": MESSAGE_INTERNAL_SERVER_ERROR,
            "message": message
        }))
    }

    /// Build a 501 Not Implemented response
    pub fn not_implemented(message: &str) -> Value {
        Self::custom(501, json!({
            "error": "Not Implemented",
            "message": message
        }))
    }

    /// Build a 200 OK response for CORS preflight
    pub fn cors_preflight() -> Value {
        json!({
            "statusCode": 200,
            "headers": get_cors_headers()
        })
    }

}

// Helper functions for common responses
pub mod helpers {
    use serde_json::{json, Value};
    use super::ResponseBuilder;
    use crate::utils::constants::*;

    pub fn invalid_json() -> Value {
        ResponseBuilder::bad_request(MESSAGE_INVALID_JSON)
    }

    pub fn invalid_data(message: &str) -> Value {
        ResponseBuilder::bad_request(message)
    }

    pub fn deleted_successfully(resource_name: &str) -> Value {
        ResponseBuilder::ok(json!({
            "message": format!("{}{}", resource_name, MESSAGE_DELETED_SUCCESSFULLY)
        }))
    }

    pub fn access_denied(resource: &str) -> Value {
        ResponseBuilder::forbidden(&format!("Access denied to {}", resource))
    }

    pub fn modification_denied(resource: &str) -> Value {
        ResponseBuilder::forbidden(&format!("Modification denied for {}", resource))
    }

    pub fn deletion_denied(resource: &str) -> Value {
        ResponseBuilder::forbidden(&format!("Deletion denied for {}", resource))
    }

    pub fn resource_not_found(resource: &str) -> Value {
        ResponseBuilder::not_found(&format!("{} not found", resource))
    }

    pub fn unauthorized_access(resource: &str) -> Value {
        ResponseBuilder::unauthorized(Some(&format!("Unauthorized access to {}", resource)))
    }
}
