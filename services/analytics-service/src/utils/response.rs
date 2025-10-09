use serde_json::{json, Value};

pub struct ResponseBuilder;

impl ResponseBuilder {
    /// Build a 200 OK response
    pub fn ok<T: serde::Serialize>(data: T) -> Value {
        json!({
            "statusCode": 200,
            "headers": Self::get_cors_headers(),
            "body": serde_json::to_string(&data).unwrap_or_else(|_| "{}".to_string())
        })
    }

    /// Build a 201 Created response
    pub fn created<T: serde::Serialize>(data: T) -> Value {
        json!({
            "statusCode": 201,
            "headers": Self::get_cors_headers(),
            "body": serde_json::to_string(&data).unwrap_or_else(|_| "{}".to_string())
        })
    }

    /// Build a 400 Bad Request response
    pub fn bad_request(message: &str) -> Value {
        json!({
            "statusCode": 400,
            "headers": Self::get_cors_headers(),
            "body": json!({
                "error": "Bad Request",
                "message": message
            }).to_string()
        })
    }

    /// Build a 401 Unauthorized response
    pub fn unauthorized(message: Option<&str>) -> Value {
        json!({
            "statusCode": 401,
            "headers": Self::get_cors_headers(),
            "body": json!({
                "error": "Unauthorized",
                "message": message.unwrap_or("Authentication required")
            }).to_string()
        })
    }

    /// Build a 403 Forbidden response
    pub fn forbidden(message: &str) -> Value {
        json!({
            "statusCode": 403,
            "headers": Self::get_cors_headers(),
            "body": json!({
                "error": "Forbidden",
                "message": message
            }).to_string()
        })
    }

    /// Build a 404 Not Found response
    pub fn not_found(message: &str) -> Value {
        json!({
            "statusCode": 404,
            "headers": Self::get_cors_headers(),
            "body": json!({
                "error": "Not Found",
                "message": message
            }).to_string()
        })
    }

    /// Build a 413 Payload Too Large response
    pub fn payload_too_large(message: &str) -> Value {
        json!({
            "statusCode": 413,
            "headers": Self::get_cors_headers(),
            "body": json!({
                "error": "Payload Too Large",
                "message": message
            }).to_string()
        })
    }

    /// Build a 500 Internal Server Error response
    pub fn internal_server_error(message: &str) -> Value {
        json!({
            "statusCode": 500,
            "headers": Self::get_cors_headers(),
            "body": json!({
                "error": "Internal Server Error",
                "message": message
            }).to_string()
        })
    }

    /// Build a CORS preflight response
    pub fn cors_preflight() -> Value {
        json!({
            "statusCode": 200,
            "headers": Self::get_cors_headers()
        })
    }

    /// Get CORS headers
    fn get_cors_headers() -> Value {
        json!({
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "OPTIONS,POST,GET,PUT,DELETE",
            "Access-Control-Allow-Headers": "Content-Type,Authorization"
        })
    }
}
