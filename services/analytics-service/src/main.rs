mod controller;
mod handlers;
mod models;
mod repository;
mod service;
mod utils;

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

use auth_layer::{AuthLayer, LambdaEvent as AuthLambdaEvent};
use controller::{
    AchievementController, BodyMeasurementController, MilestoneController,
    PerformanceTrendController, ProgressChartController, ProgressPhotoController,
    StrengthProgressController, WorkoutAnalyticsController,
};
use repository::{
    AchievementRepository, BodyMeasurementRepository, MilestoneRepository,
    PerformanceTrendRepository, ProgressChartRepository, ProgressPhotoRepository,
    StrengthProgressRepository, WorkoutSessionRepository,
};
use service::{
    AchievementService, AnalyticsService, BodyMeasurementService, MilestoneService,
    PerformanceTrendService, ProgressChartService, ProgressPhotoService, StrengthProgressService,
    WorkoutSessionService,
};

// Import all handler functions
use handlers::{
    // Achievement handlers
    create_achievement,
    // Body measurement handlers
    create_body_measurement,
    // Milestone handlers
    create_milestone,
    // Progress chart handlers
    create_progress_chart,
    // Strength progress handlers
    create_strength_progress,
    // Progress photo handlers
    delete_progress_photo,
    get_achievements,
    get_body_measurements,
    get_milestones,
    // Performance trend handlers
    get_performance_trends,
    get_progress_charts,
    get_progress_photo_analytics,
    get_progress_photo_timeline,
    get_progress_photos,
    get_strength_progress,
    // Workout analytics handlers
    get_workout_analytics,
    get_workout_insights,
    update_progress_photo,
    upload_progress_photo,
};

// Global clients for cold start optimization
static DYNAMODB_CLIENT: OnceCell<Arc<DynamoDbClient>> = OnceCell::new();
static S3_CLIENT: OnceCell<Arc<S3Client>> = OnceCell::new();

// Ensure tracing is initialized only once across Lambda invocations
static TRACING_INIT: OnceCell<()> = OnceCell::new();
static AUTH_LAYER: Lazy<AuthLayer> = Lazy::new(|| AuthLayer::new());

// Global controllers (initialized once)
static STRENGTH_PROGRESS_CONTROLLER: OnceCell<StrengthProgressController> = OnceCell::new();
static BODY_MEASUREMENT_CONTROLLER: OnceCell<BodyMeasurementController> = OnceCell::new();
static PROGRESS_CHART_CONTROLLER: OnceCell<ProgressChartController> = OnceCell::new();
static MILESTONE_CONTROLLER: OnceCell<MilestoneController> = OnceCell::new();
static ACHIEVEMENT_CONTROLLER: OnceCell<AchievementController> = OnceCell::new();
static PERFORMANCE_TREND_CONTROLLER: OnceCell<PerformanceTrendController> = OnceCell::new();
static WORKOUT_ANALYTICS_CONTROLLER: OnceCell<WorkoutAnalyticsController> = OnceCell::new();
static PROGRESS_PHOTO_CONTROLLER: OnceCell<ProgressPhotoController> = OnceCell::new();

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

    info!("Starting Analytics Service initialization...");

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

    // Strength Progress routes
    router.get(
        "/api/analytics/strength-progress/:userId",
        handler!(get_strength_progress),
    );
    router.post(
        "/api/analytics/strength-progress",
        handler!(create_strength_progress),
    );
    router.get(
        "/api/analytics/me/strength-progress",
        handler!(get_strength_progress),
    );

    // Body Measurement routes
    router.get(
        "/api/analytics/body-measurements/:userId",
        handler!(get_body_measurements),
    );
    router.post(
        "/api/analytics/body-measurements",
        handler!(create_body_measurement),
    );
    router.get(
        "/api/analytics/me/body-measurements",
        handler!(get_body_measurements),
    );

    // Progress Chart routes
    router.get(
        "/api/analytics/charts/:userId",
        handler!(get_progress_charts),
    );
    router.post("/api/analytics/charts", handler!(create_progress_chart));
    router.get("/api/analytics/me/charts", handler!(get_progress_charts));

    // Milestone routes
    router.get(
        "/api/analytics/milestones/:userId",
        handler!(get_milestones),
    );
    router.post("/api/analytics/milestones", handler!(create_milestone));
    router.get("/api/analytics/me/milestones", handler!(get_milestones));

    // Achievement routes
    router.get(
        "/api/analytics/achievements/:userId",
        handler!(get_achievements),
    );
    router.post("/api/analytics/achievements", handler!(create_achievement));
    router.get("/api/analytics/me/achievements", handler!(get_achievements));

    // Performance Trend routes
    router.get(
        "/api/analytics/trends/:userId",
        handler!(get_performance_trends),
    );
    router.get("/api/analytics/me/trends", handler!(get_performance_trends));

    // Workout Analytics routes
    router.get(
        "/api/analytics/workout/:userId",
        handler!(get_workout_analytics),
    );
    router.get(
        "/api/analytics/workout/:userId/insights",
        handler!(get_workout_insights),
    );
    router.get("/api/analytics/me/workout", handler!(get_workout_analytics));
    router.get(
        "/api/analytics/me/workout/insights",
        handler!(get_workout_insights),
    );

    // Progress Photo routes
    router.get(
        "/api/analytics/progress-photos/:userId",
        handler!(get_progress_photos),
    );
    router.post(
        "/api/analytics/progress-photos/upload",
        handler!(upload_progress_photo),
    );
    router.put(
        "/api/analytics/progress-photos/:photoId",
        handler!(update_progress_photo),
    );
    router.delete(
        "/api/analytics/progress-photos/:photoId",
        handler!(delete_progress_photo),
    );
    router.get(
        "/api/analytics/progress-photos/:userId/analytics",
        handler!(get_progress_photo_analytics),
    );
    router.get(
        "/api/analytics/progress-photos/:userId/timeline",
        handler!(get_progress_photo_timeline),
    );

    // Progress photo /me routes
    router.get(
        "/api/analytics/me/progress-photos",
        handler!(get_progress_photos),
    );
    router.post(
        "/api/analytics/me/progress-photos",
        handler!(upload_progress_photo),
    );
    router.get(
        "/api/analytics/me/progress-photos/analytics",
        handler!(get_progress_photo_analytics),
    );
    router.get(
        "/api/analytics/me/progress-photos/timeline",
        handler!(get_progress_photo_timeline),
    );

    info!("Analytics Service initialized successfully");
    info!("Starting Lambda runtime...");

    // Run Lambda service
    let result = lambda_runtime::run(service_fn(router.into_service())).await;

    if let Err(e) = &result {
        error!("Lambda runtime error: {}", e);
    }

    result
}

fn init_controllers() {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    let bucket_name = std::env::var("PROGRESS_PHOTOS_BUCKET")
        .unwrap_or_else(|_| "gymcoach-ai-progress-photos".to_string());
    let dynamodb_client = DYNAMODB_CLIENT
        .get()
        .expect("DynamoDB not initialized")
        .as_ref();
    let s3_client = S3_CLIENT.get().expect("S3 not initialized").as_ref();

    // Initialize repositories
    let strength_progress_repository =
        StrengthProgressRepository::new(dynamodb_client.clone(), table_name.clone());
    let body_measurement_repository =
        BodyMeasurementRepository::new(dynamodb_client.clone(), table_name.clone());
    let progress_chart_repository =
        ProgressChartRepository::new(dynamodb_client.clone(), table_name.clone());
    let milestone_repository =
        MilestoneRepository::new(dynamodb_client.clone(), table_name.clone());
    let achievement_repository =
        AchievementRepository::new(dynamodb_client.clone(), table_name.clone());
    let performance_trend_repository =
        PerformanceTrendRepository::new(dynamodb_client.clone(), table_name.clone());
    let workout_session_repository =
        WorkoutSessionRepository::new(dynamodb_client.clone(), table_name.clone());
    let progress_photo_repository = ProgressPhotoRepository::new(
        dynamodb_client.clone(),
        s3_client.clone(),
        table_name.clone(),
        bucket_name,
    );

    // Initialize services
    let strength_progress_service = StrengthProgressService::new(strength_progress_repository);
    let body_measurement_service = BodyMeasurementService::new(body_measurement_repository);
    let progress_chart_service = ProgressChartService::new(progress_chart_repository);
    let milestone_service = MilestoneService::new(milestone_repository);
    let achievement_service = AchievementService::new(achievement_repository);
    let performance_trend_service = PerformanceTrendService::new(performance_trend_repository);
    let workout_session_service = WorkoutSessionService::new(workout_session_repository);
    let progress_photo_service = ProgressPhotoService::new(progress_photo_repository);
    let analytics_service = AnalyticsService::new(
        strength_progress_service.clone(),
        body_measurement_service.clone(),
        progress_chart_service.clone(),
        milestone_service.clone(),
        achievement_service.clone(),
        performance_trend_service.clone(),
        workout_session_service.clone(),
        progress_photo_service.clone(),
    );

    // Initialize controllers
    let _ = STRENGTH_PROGRESS_CONTROLLER
        .set(StrengthProgressController::new(strength_progress_service));
    let _ =
        BODY_MEASUREMENT_CONTROLLER.set(BodyMeasurementController::new(body_measurement_service));
    let _ = PROGRESS_CHART_CONTROLLER.set(ProgressChartController::new(progress_chart_service));
    let _ = MILESTONE_CONTROLLER.set(MilestoneController::new(milestone_service));
    let _ = ACHIEVEMENT_CONTROLLER.set(AchievementController::new(achievement_service));
    let _ = PERFORMANCE_TREND_CONTROLLER
        .set(PerformanceTrendController::new(performance_trend_service));
    let _ = WORKOUT_ANALYTICS_CONTROLLER.set(WorkoutAnalyticsController::new(analytics_service));
    let _ = PROGRESS_PHOTO_CONTROLLER.set(ProgressPhotoController::new(progress_photo_service));
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
