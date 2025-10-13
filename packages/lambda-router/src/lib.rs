//! # Lambda Router
//!
//! A lightweight, Express-like REST API routing framework for AWS Lambda functions
//! behind CloudFront with support for middleware, authentication, and CORS.
//!
//! ## Features
//! - Express-like routing with path parameters
//! - Middleware support (auth, logging, CORS, etc.)
//! - Automatic CORS preflight handling
//! - Type-safe request/response handling
//! - Path parameter extraction
//! - Query string parsing
//! - JSON body parsing
//! - Error handling with proper HTTP status codes
//!
//! ## Example
//! ```rust,no_run
//! use lambda_router::{Router, Request, Response, Context};
//! use lambda_runtime::{Error, LambdaEvent};
//! use serde_json::Value;
//!
//! async fn get_user(req: Request, ctx: Context) -> Result<Response, Error> {
//!     let user_id = req.path_param("userId").unwrap();
//!     Ok(Response::ok(serde_json::json!({
//!         "userId": user_id,
//!         "name": "John Doe"
//!     })))
//! }
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Error> {
//!     let mut router = Router::new();
//!     
//!     router.get("/api/users/:userId", get_user);
//!     
//!     lambda_runtime::run(router.into_service()).await
//! }
//! ```

pub mod cors;
pub mod error;
pub mod matcher;
pub mod middleware;
pub mod request;
pub mod response;
pub mod router;

// Re-export main types
pub use cors::CorsConfig;
pub use error::{Result, RouterError};
pub use matcher::PathMatcher;
pub use middleware::{Middleware, Next};
pub use request::{Context, Request};
pub use response::Response;
pub use router::{Handler, HandlerFn, Router};
