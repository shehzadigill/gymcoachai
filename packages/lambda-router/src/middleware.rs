use async_trait::async_trait;
use lambda_runtime::Error;
use crate::{Request, Response};

/// Next function type for middleware chain
pub type Next = Box<dyn Fn(Request) -> futures::future::BoxFuture<'static, Result<Response, Error>> + Send + Sync>;

/// Middleware trait
#[async_trait]
pub trait Middleware: Send + Sync {
    /// Execute middleware
    async fn handle(&self, req: Request, next: Next) -> Result<Response, Error>;
}

/// Function-based middleware wrapper
pub struct MiddlewareFn<F>
where
    F: Fn(Request, Next) -> futures::future::BoxFuture<'static, Result<Response, Error>> + Send + Sync,
{
    func: F,
}

impl<F> MiddlewareFn<F>
where
    F: Fn(Request, Next) -> futures::future::BoxFuture<'static, Result<Response, Error>> + Send + Sync,
{
    pub fn new(func: F) -> Self {
        Self { func }
    }
}

#[async_trait]
impl<F> Middleware for MiddlewareFn<F>
where
    F: Fn(Request, Next) -> futures::future::BoxFuture<'static, Result<Response, Error>> + Send + Sync,
{
    async fn handle(&self, req: Request, next: Next) -> Result<Response, Error> {
        (self.func)(req, next).await
    }
}

/// Logging middleware
pub struct LoggingMiddleware;

#[async_trait]
impl Middleware for LoggingMiddleware {
    async fn handle(&self, req: Request, next: Next) -> Result<Response, Error> {
        println!("→ {} {}", req.method, req.path);
        let response = next(req).await?;
        println!("← {}", response.status_code);
        Ok(response)
    }
}

/// CORS middleware
pub struct CorsMiddleware {
    allow_origin: String,
    allow_methods: String,
    allow_headers: String,
    max_age: String,
}

impl CorsMiddleware {
    pub fn new() -> Self {
        Self {
            allow_origin: "*".to_string(),
            allow_methods: "GET, POST, PUT, DELETE, OPTIONS".to_string(),
            allow_headers: "Content-Type, Authorization".to_string(),
            max_age: "3600".to_string(),
        }
    }
    
    pub fn allow_origin(mut self, origin: impl Into<String>) -> Self {
        self.allow_origin = origin.into();
        self
    }
    
    pub fn allow_methods(mut self, methods: impl Into<String>) -> Self {
        self.allow_methods = methods.into();
        self
    }
    
    pub fn allow_headers(mut self, headers: impl Into<String>) -> Self {
        self.allow_headers = headers.into();
        self
    }
}

impl Default for CorsMiddleware {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Middleware for CorsMiddleware {
    async fn handle(&self, req: Request, next: Next) -> Result<Response, Error> {
        // Handle preflight
        if req.is_preflight() {
            return Ok(Response::cors_preflight());
        }
        
        // Add CORS headers to response
        let mut response = next(req).await?;
        response = response
            .header("Access-Control-Allow-Origin", &self.allow_origin)
            .header("Access-Control-Allow-Methods", &self.allow_methods)
            .header("Access-Control-Allow-Headers", &self.allow_headers)
            .header("Access-Control-Max-Age", &self.max_age);
        
        Ok(response)
    }
}
