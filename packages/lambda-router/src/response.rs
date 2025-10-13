use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;

/// HTTP Response builder
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Response {
    #[serde(rename = "statusCode")]
    pub status_code: u16,
    pub headers: HashMap<String, String>,
    pub body: String,
    #[serde(rename = "isBase64Encoded")]
    pub is_base64_encoded: bool,
}

impl Response {
    /// Create a new Response
    pub fn new(status_code: u16) -> Self {
        let mut headers = HashMap::new();
        headers.insert("Content-Type".to_string(), "application/json".to_string());

        Self {
            status_code,
            headers,
            body: String::new(),
            is_base64_encoded: false,
        }
    }

    /// Set response body from JSON value
    pub fn json(mut self, body: Value) -> Self {
        self.body = body.to_string();
        self.headers
            .insert("Content-Type".to_string(), "application/json".to_string());
        self
    }

    /// Set response body from serializable object
    pub fn json_body<T: Serialize>(mut self, body: &T) -> Self {
        self.body = serde_json::to_string(body).unwrap_or_else(|_| "{}".to_string());
        self.headers
            .insert("Content-Type".to_string(), "application/json".to_string());
        self
    }

    /// Set response body as string
    pub fn text(mut self, body: impl Into<String>) -> Self {
        self.body = body.into();
        self.headers
            .insert("Content-Type".to_string(), "text/plain".to_string());
        self
    }

    /// Add header
    pub fn header(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.headers.insert(key.into(), value.into());
        self
    }

    /// Add multiple headers
    pub fn headers(mut self, headers: HashMap<String, String>) -> Self {
        self.headers.extend(headers);
        self
    }

    /// Add CORS headers
    pub fn with_cors(mut self) -> Self {
        self.headers
            .insert("Access-Control-Allow-Origin".to_string(), "*".to_string());
        self.headers.insert(
            "Access-Control-Allow-Methods".to_string(),
            "GET, POST, PUT, DELETE, OPTIONS".to_string(),
        );
        self.headers.insert(
            "Access-Control-Allow-Headers".to_string(),
            "Content-Type, Authorization".to_string(),
        );
        self.headers
            .insert("Access-Control-Max-Age".to_string(), "3600".to_string());
        self
    }

    /// Convert to JSON value
    pub fn to_json(&self) -> Value {
        json!({
            "statusCode": self.status_code,
            "headers": self.headers,
            "body": self.body,
            "isBase64Encoded": self.is_base64_encoded
        })
    }

    /// Create Response from JSON value (for controller compatibility)
    /// Expects format: { statusCode: number, headers: object, body: any }
    pub fn from_json_value(value: Value) -> Self {
        let status_code = value["statusCode"].as_u64().unwrap_or(200) as u16;

        let mut headers = HashMap::new();
        if let Some(headers_obj) = value["headers"].as_object() {
            for (key, val) in headers_obj {
                if let Some(s) = val.as_str() {
                    headers.insert(key.clone(), s.to_string());
                }
            }
        }

        // Handle body - could be already stringified or an object
        let body = if let Some(body_str) = value["body"].as_str() {
            body_str.to_string()
        } else {
            value["body"].to_string()
        };

        Self {
            status_code,
            headers,
            body,
            is_base64_encoded: value["isBase64Encoded"].as_bool().unwrap_or(false),
        }
    }

    // Convenience constructors

    /// 200 OK response
    pub fn ok(body: Value) -> Self {
        Self::new(200).json(body).with_cors()
    }

    /// 201 Created response
    pub fn created(body: Value) -> Self {
        Self::new(201).json(body).with_cors()
    }

    /// 204 No Content response
    pub fn no_content() -> Self {
        Self::new(204).with_cors()
    }

    /// 400 Bad Request response
    pub fn bad_request(message: &str) -> Self {
        Self::new(400)
            .json(json!({
                "error": "Bad Request",
                "message": message
            }))
            .with_cors()
    }

    /// 401 Unauthorized response
    pub fn unauthorized(message: &str) -> Self {
        Self::new(401)
            .json(json!({
                "error": "Unauthorized",
                "message": message
            }))
            .with_cors()
    }

    /// 403 Forbidden response
    pub fn forbidden(message: &str) -> Self {
        Self::new(403)
            .json(json!({
                "error": "Forbidden",
                "message": message
            }))
            .with_cors()
    }

    /// 404 Not Found response
    pub fn not_found(message: &str) -> Self {
        Self::new(404)
            .json(json!({
                "error": "Not Found",
                "message": message
            }))
            .with_cors()
    }

    /// 405 Method Not Allowed response
    pub fn method_not_allowed(message: &str) -> Self {
        Self::new(405)
            .json(json!({
                "error": "Method Not Allowed",
                "message": message
            }))
            .with_cors()
    }

    /// 500 Internal Server Error response
    pub fn internal_error(message: &str) -> Self {
        Self::new(500)
            .json(json!({
                "error": "Internal Server Error",
                "message": message
            }))
            .with_cors()
    }

    /// CORS preflight response
    pub fn cors_preflight() -> Self {
        Self::new(200).text("").with_cors()
    }
}
