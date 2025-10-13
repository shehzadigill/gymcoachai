use async_trait::async_trait;
use futures::future::BoxFuture;
use lambda_runtime::{Error, LambdaEvent};
use serde_json::Value;
use std::sync::Arc;

use crate::middleware::CorsMiddleware;
use crate::{Context, Middleware, PathMatcher, Request, Response, Result, RouterError};

/// Handler function type
pub type HandlerFn =
    Arc<dyn Fn(Request, Context) -> BoxFuture<'static, Result<Response>> + Send + Sync>;

/// Handler trait for route handlers
#[async_trait]
pub trait Handler: Send + Sync {
    async fn handle(&self, req: Request, ctx: Context) -> Result<Response>;
}

/// Route definition
struct Route {
    method: String,
    matcher: PathMatcher,
    handler: HandlerFn,
}

/// Router for handling Lambda HTTP requests
pub struct Router {
    routes: Vec<Route>,
    middlewares: Vec<Arc<dyn Middleware>>,
    not_found_handler: Option<HandlerFn>,
}

impl Router {
    /// Create a new Router
    pub fn new() -> Self {
        Self {
            routes: Vec::new(),
            middlewares: vec![Arc::new(CorsMiddleware::new())],
            not_found_handler: None,
        }
    }

    /// Add a middleware
    pub fn use_middleware(&mut self, middleware: impl Middleware + 'static) {
        self.middlewares.push(Arc::new(middleware));
    }

    /// Set custom not found handler
    pub fn not_found<F>(&mut self, handler: F)
    where
        F: Fn(Request, Context) -> BoxFuture<'static, Result<Response>> + Send + Sync + 'static,
    {
        self.not_found_handler = Some(Arc::new(handler));
    }

    /// Add a GET route
    pub fn get<F>(&mut self, path: &str, handler: F)
    where
        F: Fn(Request, Context) -> BoxFuture<'static, Result<Response>> + Send + Sync + 'static,
    {
        self.add_route("GET", path, handler);
    }

    /// Add a POST route
    pub fn post<F>(&mut self, path: &str, handler: F)
    where
        F: Fn(Request, Context) -> BoxFuture<'static, Result<Response>> + Send + Sync + 'static,
    {
        self.add_route("POST", path, handler);
    }

    /// Add a PUT route
    pub fn put<F>(&mut self, path: &str, handler: F)
    where
        F: Fn(Request, Context) -> BoxFuture<'static, Result<Response>> + Send + Sync + 'static,
    {
        self.add_route("PUT", path, handler);
    }

    /// Add a DELETE route
    pub fn delete<F>(&mut self, path: &str, handler: F)
    where
        F: Fn(Request, Context) -> BoxFuture<'static, Result<Response>> + Send + Sync + 'static,
    {
        self.add_route("DELETE", path, handler);
    }

    /// Add a PATCH route
    pub fn patch<F>(&mut self, path: &str, handler: F)
    where
        F: Fn(Request, Context) -> BoxFuture<'static, Result<Response>> + Send + Sync + 'static,
    {
        self.add_route("PATCH", path, handler);
    }

    /// Add a route for any method
    pub fn add_route<F>(&mut self, method: &str, path: &str, handler: F)
    where
        F: Fn(Request, Context) -> BoxFuture<'static, Result<Response>> + Send + Sync + 'static,
    {
        self.routes.push(Route {
            method: method.to_uppercase(),
            matcher: PathMatcher::new(path),
            handler: Arc::new(handler),
        });
    }

    /// Handle incoming Lambda event
    async fn handle_request(&self, mut req: Request) -> Result<Response> {
        // Find matching route
        let route = self
            .routes
            .iter()
            .find(|r| r.method == req.method && r.matcher.matches(&req.path).is_some());

        match route {
            Some(route) => {
                // Extract path parameters
                if let Some(params) = route.matcher.matches(&req.path) {
                    req.set_path_params(params);
                }

                // Execute handler with middleware chain
                let handler = route.handler.clone();
                let middlewares = self.middlewares.clone();

                // Build middleware chain by wrapping handler in middleware
                if middlewares.is_empty() {
                    // No middleware, just execute handler
                    let ctx = req.context.clone();
                    (handler)(req, ctx).await
                } else {
                    // Execute through middleware chain
                    self.execute_middleware_chain(req, middlewares, handler)
                        .await
                }
            }
            None => {
                if let Some(handler) = &self.not_found_handler {
                    let ctx = req.context.clone();
                    (handler)(req, ctx).await
                } else {
                    Err(RouterError::RouteNotFound {
                        method: req.method.clone(),
                        path: req.path.clone(),
                    })
                }
            }
        }
    }

    /// Execute request through middleware chain
    async fn execute_middleware_chain(
        &self,
        req: Request,
        middlewares: Vec<Arc<dyn Middleware>>,
        handler: Arc<
            dyn Fn(Request, Context) -> BoxFuture<'static, Result<Response>> + Send + Sync,
        >,
    ) -> Result<Response> {
        use std::sync::Arc as StdArc;

        // Build the middleware chain from the end backwards
        let final_handler: StdArc<
            dyn Fn(Request) -> BoxFuture<'static, std::result::Result<Response, Error>>
                + Send
                + Sync,
        > = StdArc::new(move |req: Request| {
            let handler = handler.clone();
            let ctx = req.context.clone();
            Box::pin(async move {
                handler(req, ctx)
                    .await
                    .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)
            })
        });

        // Wrap each middleware around the next
        let mut current_handler = final_handler;

        for middleware in middlewares.into_iter().rev() {
            let next_handler = current_handler.clone();
            current_handler = StdArc::new(move |req: Request| {
                let middleware = middleware.clone();
                let next = next_handler.clone();
                let next_fn: Box<
                    dyn Fn(Request) -> BoxFuture<'static, std::result::Result<Response, Error>>
                        + Send
                        + Sync,
                > = Box::new(move |req: Request| {
                    let next = next.clone();
                    (next)(req)
                });
                Box::pin(async move { middleware.handle(req, next_fn).await })
            });
        }

        // Execute the complete chain
        (current_handler)(req)
            .await
            .map_err(|e| RouterError::HandlerError(anyhow::anyhow!("{}", e)))
    }

    /// Convert router into Lambda service function
    pub fn into_service(
        self,
    ) -> impl Fn(LambdaEvent<Value>) -> BoxFuture<'static, std::result::Result<Value, Error>> {
        let router = Arc::new(self);

        move |event: LambdaEvent<Value>| {
            let router = router.clone();
            Box::pin(async move {
                let (event_payload, _context) = event.into_parts();

                // Parse request
                let req = Request::from_lambda_event(event_payload);

                // Handle CORS preflight early
                if req.is_preflight() {
                    return Ok(Response::cors_preflight().to_json());
                }

                // Route request
                let response = match router.handle_request(req).await {
                    Ok(resp) => resp,
                    Err(e) => e.to_response(),
                };

                Ok(response.to_json())
            })
        }
    }
}

impl Default for Router {
    fn default() -> Self {
        Self::new()
    }
}

/// Helper macro for creating async handlers
#[macro_export]
macro_rules! handler {
    ($func:expr) => {
        |req: Request, ctx: Context| Box::pin($func(req, ctx))
    };
}
