use async_trait::async_trait;
use lambda_router::{handler, Context, Middleware, Next, Request, Response, Router};
use lambda_runtime::service_fn;
use lambda_runtime::Error as LambdaError;
use once_cell::sync::Lazy;
use tracing::{error, info};

mod handlers;
mod models;
mod services;
mod utils;

use auth_layer::{AuthLayer, LambdaEvent as AuthLambdaEvent};
use handlers::*;

// Global auth layer
static AUTH_LAYER: Lazy<AuthLayer> = Lazy::new(|| AuthLayer::new());

#[tokio::main]
async fn main() -> Result<(), LambdaError> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .with_target(false)
        .without_time()
        .init();

    info!("Starting Notification Service initialization...");

    // Initialize auth layer
    info!("Initializing auth layer...");
    let _ = &*AUTH_LAYER;
    info!("Auth layer initialized");

    // Create router
    info!("Creating router...");
    let mut router = Router::new();

    // Add authentication middleware
    router.use_middleware(AuthMiddleware);

    // Notification routes
    router.post("/api/notifications/send", handler!(send_notification));
    router.get("/api/notifications", handler!(get_notifications));
    router.put(
        "/api/notifications/:notificationId/read",
        handler!(mark_notification_read),
    );

    // Device management routes
    router.post("/api/notifications/devices", handler!(register_device));
    router.delete(
        "/api/notifications/devices/:deviceId",
        handler!(unregister_device),
    );
    router.get("/api/notifications/devices", handler!(get_user_devices));

    // Preferences routes
    router.get("/api/notifications/preferences", handler!(get_preferences));
    router.put("/api/notifications/preferences", handler!(update_preferences));

    // Scheduled notifications (for EventBridge triggers)
    router.post(
        "/api/notifications/scheduled/process",
        handler!(process_scheduled_notifications),
    );

    info!("Notification Service initialized successfully");
    info!("Starting Lambda runtime...");

    // Run Lambda service
    let result = lambda_runtime::run(service_fn(router.into_service())).await;

    if let Err(e) = &result {
        error!("Lambda runtime error: {}", e);
    }

    result
}

// Authentication Middleware
struct AuthMiddleware;

#[async_trait]
impl Middleware for AuthMiddleware {
    async fn handle(&self, req: Request, next: Next) -> Result<Response, lambda_runtime::Error> {
        // Skip auth for OPTIONS requests (CORS preflight)
        if req.method == "OPTIONS" {
            return Ok(Response::cors_preflight());
        }

        // Skip auth for scheduled notifications endpoint (triggered by EventBridge)
        if req.path == "/api/notifications/scheduled/process" {
            return next(req).await;
        }

        // Convert to auth event format
        let auth_event = AuthLambdaEvent {
            headers: if !req.headers.is_empty() {
                Some(req.headers.clone())
            } else {
                None
            },
            request_context: None,
            path_parameters: None,
            query_string_parameters: if !req.query_params.is_empty() {
                Some(req.query_params.clone())
            } else {
                None
            },
            body: req.body.clone(),
        };

        // Authenticate request
        match AUTH_LAYER.authenticate(&auth_event).await {
            Ok(auth_result) => {
                if !auth_result.is_authorized {
                    return Ok(Response::forbidden(
                        &auth_result.error.unwrap_or("Access denied".to_string()),
                    ));
                }

                if let Some(auth_context) = auth_result.context {
                    // Create new request with auth info
                    let mut new_req = req.clone();
                    new_req.context.user_id = Some(auth_context.user_id.clone());
                    new_req.context.email = Some(auth_context.email.clone());

                    // Store auth_context in custom data
                    if let Ok(auth_json) = serde_json::to_value(&auth_context) {
                        new_req
                            .context
                            .custom
                            .insert("auth_context".to_string(), auth_json);
                    }

                    next(new_req).await
                } else {
                    Ok(Response::unauthorized("Authentication required"))
                }
            }
            Err(e) => {
                error!("Authentication error: {}", e);
                Ok(Response::unauthorized("Authentication failed"))
            }
        }
    }
}
