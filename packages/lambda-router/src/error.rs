use crate::response::Response;
use thiserror::Error;

/// Router-specific errors
#[derive(Error, Debug)]
pub enum RouterError {
    #[error("Route not found: {method} {path}")]
    RouteNotFound { method: String, path: String },

    #[error("Method not allowed: {method}")]
    MethodNotAllowed { method: String },

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Forbidden: {0}")]
    Forbidden(String),

    #[error("Internal server error: {0}")]
    InternalError(String),

    #[error("JSON parsing error: {0}")]
    JsonError(#[from] serde_json::Error),

    #[error("Handler error: {0}")]
    HandlerError(#[from] anyhow::Error),
}

// Implement From<&str> for convenience
impl From<&str> for RouterError {
    fn from(s: &str) -> Self {
        RouterError::InternalError(s.to_string())
    }
}

// Implement From<String> for convenience
impl From<String> for RouterError {
    fn from(s: String) -> Self {
        RouterError::InternalError(s)
    }
}

impl RouterError {
    /// Convert RouterError to HTTP Response
    pub fn to_response(&self) -> Response {
        match self {
            RouterError::RouteNotFound { method, path } => {
                Response::not_found(&format!("Route not found: {} {}", method, path))
            }
            RouterError::MethodNotAllowed { method } => {
                Response::method_not_allowed(&format!("Method not allowed: {}", method))
            }
            RouterError::BadRequest(msg) => Response::bad_request(msg),
            RouterError::Unauthorized(msg) => Response::unauthorized(msg),
            RouterError::Forbidden(msg) => Response::forbidden(msg),
            RouterError::InternalError(msg) => Response::internal_error(msg),
            RouterError::JsonError(e) => Response::bad_request(&format!("Invalid JSON: {}", e)),
            RouterError::HandlerError(e) => {
                Response::internal_error(&format!("Handler error: {}", e))
            }
        }
    }
}

/// Result type alias for router operations
pub type Result<T> = std::result::Result<T, RouterError>;
