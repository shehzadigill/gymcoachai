use async_trait::async_trait;
use aws_config::meta::region::RegionProviderChain;
use aws_sdk_dynamodb::Client as DynamoDbClient;
use aws_sdk_s3::Client as S3Client;
use lambda_router::{handler, Context, Middleware, Next, Request, Response, Router};
use lambda_runtime::service_fn;
use lambda_runtime::Error as LambdaError;
use once_cell::sync::{Lazy, OnceCell};
use std::sync::Arc;
use tracing::{error, info};

mod controller;
mod handlers;
mod models;
mod repository;
mod service;
mod utils;

use auth_layer::{AuthLayer, LambdaEvent as AuthLambdaEvent};
use controller::{SleepController, UploadController, UserProfileController};
use repository::{SleepRepository, UserProfileRepository};
use service::{SleepService, UploadService, UserProfileService};

// Import all handler functions
use handlers::{
    delete_user_profile, generate_upload_url, get_sleep_data, get_sleep_history, get_sleep_stats,
    get_user_preferences, get_user_profile, get_user_profile_me, get_user_stats, save_sleep_data,
    update_sleep_data, update_user_preferences, update_user_profile, update_user_profile_me,
};

// Global clients for cold start optimization
static DYNAMODB_CLIENT: OnceCell<Arc<DynamoDbClient>> = OnceCell::new();
static S3_CLIENT: OnceCell<Arc<S3Client>> = OnceCell::new();

// Ensure tracing is initialized only once across Lambda invocations
static TRACING_INIT: OnceCell<()> = OnceCell::new();
static AUTH_LAYER: Lazy<AuthLayer> = Lazy::new(|| AuthLayer::new());

// Global controllers (initialized once)
static USER_PROFILE_CONTROLLER: OnceCell<UserProfileController> = OnceCell::new();
static SLEEP_CONTROLLER: OnceCell<SleepController> = OnceCell::new();
static UPLOAD_CONTROLLER: OnceCell<UploadController> = OnceCell::new();

#[tokio::main]
async fn main() -> Result<(), LambdaError> {
    // Initialize tracing only once (critical for Lambda runtime reuse)
    TRACING_INIT.get_or_init(|| {
        tracing_subscriber::fmt()
            .with_max_level(tracing::Level::INFO)
            .with_target(false)
            .without_time()
            .init();
    });

    info!("Starting User Profile Service initialization...");

    // Initialize global clients
    info!("Initializing AWS clients...");
    if DYNAMODB_CLIENT.get().is_none() || S3_CLIENT.get().is_none() {
        let region_provider = RegionProviderChain::default_provider();
        let config = aws_config::defaults(aws_config::BehaviorVersion::latest())
            .region(region_provider)
            .load()
            .await;
        let _ = DYNAMODB_CLIENT.set(Arc::new(DynamoDbClient::new(&config)));
        let _ = S3_CLIENT.set(Arc::new(S3Client::new(&config)));
        info!("AWS clients initialized successfully");
    }

    info!("Initializing auth layer...");
    let _ = &*AUTH_LAYER;
    info!("Auth layer initialized");

    // Initialize controllers once
    info!("Initializing controllers...");
    init_controllers();
    info!("Controllers initialized successfully");

    // Create router
    info!("Creating router...");
    let mut router = Router::new();

    // Add authentication middleware
    router.use_middleware(AuthMiddleware);

    // User Profile routes
    router.get(
        "/api/user-profiles/profile/:userId",
        handler!(get_user_profile),
    );
    router.get("/api/user-profiles/profile", handler!(get_user_profile_me));
    router.put(
        "/api/user-profiles/profile/:userId",
        handler!(update_user_profile),
    );
    router.put(
        "/api/user-profiles/profile",
        handler!(update_user_profile_me),
    );
    router.delete(
        "/api/user-profiles/profile/:userId",
        handler!(delete_user_profile),
    );

    // User Stats and Preferences
    router.get("/api/user-profiles/profile/stats", handler!(get_user_stats));
    router.get(
        "/api/user-profiles/profile/preferences/:userId",
        handler!(get_user_preferences),
    );
    router.get(
        "/api/user-profiles/profile/preferences",
        handler!(get_user_preferences),
    );
    router.put(
        "/api/user-profiles/profile/preferences/:userId",
        handler!(update_user_preferences),
    );
    router.put(
        "/api/user-profiles/profile/preferences",
        handler!(update_user_preferences),
    );

    // Upload route
    router.post(
        "/api/user-profiles/profile/upload",
        handler!(generate_upload_url),
    );

    // Sleep routes
    router.get("/api/user-profiles/sleep", handler!(get_sleep_data));
    router.post("/api/user-profiles/sleep", handler!(save_sleep_data));
    router.put("/api/user-profiles/sleep", handler!(update_sleep_data));
    router.get(
        "/api/user-profiles/sleep/history",
        handler!(get_sleep_history),
    );
    router.get("/api/user-profiles/sleep/stats", handler!(get_sleep_stats));

    info!("User Profile Service initialized successfully");
    info!("Starting Lambda runtime...");

    // Run Lambda service
    let result = lambda_runtime::run(service_fn(router.into_service())).await;

    if let Err(e) = &result {
        error!("Lambda runtime error: {}", e);
    }

    result
}

fn init_controllers() {
    let dynamodb_client = DYNAMODB_CLIENT
        .get()
        .expect("DynamoDB not initialized")
        .as_ref();
    let s3_client = S3_CLIENT.get().expect("S3 not initialized").as_ref();

    // Create repositories
    let user_profile_repository =
        UserProfileRepository::new(dynamodb_client.clone(), s3_client.clone());
    let sleep_repository = SleepRepository::new(dynamodb_client.clone());

    // Create services
    let user_profile_service =
        UserProfileService::new(user_profile_repository, sleep_repository.clone());
    let sleep_service = SleepService::new(sleep_repository);
    let upload_service = UploadService::new(s3_client.clone());

    // Initialize controllers
    let _ = USER_PROFILE_CONTROLLER.set(UserProfileController::new(user_profile_service));
    let _ = SLEEP_CONTROLLER.set(SleepController::new(sleep_service));
    let _ = UPLOAD_CONTROLLER.set(UploadController::new(upload_service));
}

// Authentication middleware
struct AuthMiddleware;

#[async_trait]
impl Middleware for AuthMiddleware {
    async fn handle(&self, mut req: Request, next: Next) -> Result<Response, LambdaError> {
        info!(
            "Auth middleware: Processing request {} {}",
            req.method, req.path
        );

        // Convert to auth event format
        let auth_event = AuthLambdaEvent {
            headers: Some(req.headers.clone()),
            request_context: req
                .raw_event()
                .get("requestContext")
                .and_then(|v| serde_json::from_value(v.clone()).ok()),
            path_parameters: Some(req.path_params.clone()),
            query_string_parameters: Some(req.query_params.clone()),
            body: req.body.clone(),
        };

        // Authenticate request
        info!("Auth middleware: Calling auth layer...");
        let auth_result = AUTH_LAYER.authenticate(&auth_event).await.map_err(|e| {
            error!("Auth middleware: Authentication failed: {}", e);
            format!("Auth error: {}", e)
        })?;

        info!(
            "Auth middleware: Auth result - is_authorized: {}",
            auth_result.is_authorized
        );

        if !auth_result.is_authorized {
            info!("Auth middleware: Request not authorized");
            return Ok(Response::forbidden(
                &auth_result.error.unwrap_or("Access denied".to_string()),
            ));
        }

        // Add user context
        if let Some(auth_ctx) = auth_result.context {
            info!(
                "Auth middleware: Adding user context for user: {}",
                auth_ctx.user_id
            );
            match serde_json::to_value(&auth_ctx) {
                Ok(auth_ctx_value) => {
                    req.set_context(
                        Context::new(req.context.request_id.clone())
                            .with_user(auth_ctx.user_id.clone(), Some(auth_ctx.email.clone()))
                            .with_custom("auth_context".to_string(), auth_ctx_value),
                    );
                }
                Err(e) => {
                    error!("Failed to serialize auth context: {}", e);
                    // Continue without auth context
                }
            }
        }

        info!("Auth middleware: Calling next handler...");
        next(req).await
    }
}
