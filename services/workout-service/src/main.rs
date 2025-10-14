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
use controller::{
    ExerciseController, ScheduledWorkoutController, WorkoutAnalyticsController,
    WorkoutPlanController, WorkoutSessionController,
};
use repository::{
    ExerciseRepository, ScheduledWorkoutRepository, WorkoutAnalyticsRepository,
    WorkoutPlanRepository, WorkoutSessionRepository,
};
use service::{
    ExerciseService, ScheduledWorkoutService, WorkoutAnalyticsService, WorkoutPlanService,
    WorkoutSessionService,
};

// Import all handler functions
use handlers::{
    clone_exercise, create_exercise, create_workout_plan, create_workout_session, delete_exercise,
    delete_scheduled_workout, delete_workout_plan, delete_workout_session, get_exercise,
    get_exercises, get_scheduled_workouts, get_workout_analytics, get_workout_history,
    get_workout_insights, get_workout_plan, get_workout_plans, get_workout_session,
    get_workout_sessions, log_activity, schedule_workout_plan, update_exercise,
    update_scheduled_workout, update_workout_plan, update_workout_session,
};

// Global clients for cold start optimization
static DYNAMODB_CLIENT: OnceCell<Arc<DynamoDbClient>> = OnceCell::new();
static S3_CLIENT: OnceCell<Arc<S3Client>> = OnceCell::new();

// Ensure tracing is initialized only once across Lambda invocations
static TRACING_INIT: OnceCell<()> = OnceCell::new();
static AUTH_LAYER: Lazy<AuthLayer> = Lazy::new(|| AuthLayer::new());

// Global controllers (initialized once)
static WORKOUT_PLAN_CONTROLLER: OnceCell<WorkoutPlanController> = OnceCell::new();
static WORKOUT_SESSION_CONTROLLER: OnceCell<WorkoutSessionController> = OnceCell::new();
static EXERCISE_CONTROLLER: OnceCell<ExerciseController> = OnceCell::new();
static WORKOUT_ANALYTICS_CONTROLLER: OnceCell<WorkoutAnalyticsController> = OnceCell::new();
static SCHEDULED_WORKOUT_CONTROLLER: OnceCell<ScheduledWorkoutController> = OnceCell::new();

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

    info!("Starting Workout Service initialization...");

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

    // Workout Plan routes
    router.get("/api/workouts/plans", handler!(get_workout_plans));
    router.post("/api/workouts/plans", handler!(create_workout_plan));
    router.get("/api/workouts/plans/:planId", handler!(get_workout_plan));
    router.put("/api/workouts/plans", handler!(update_workout_plan));
    router.delete("/api/workouts/plans/:planId", handler!(delete_workout_plan));

    // Workout Session routes
    router.get("/api/workouts/sessions", handler!(get_workout_sessions));
    router.post("/api/workouts/sessions", handler!(create_workout_session));
    router.get(
        "/api/workouts/sessions/:sessionId",
        handler!(get_workout_session),
    );
    router.put("/api/workouts/sessions", handler!(update_workout_session));
    router.delete(
        "/api/workouts/sessions/:sessionId",
        handler!(delete_workout_session),
    );

    // Exercise routes
    router.get("/api/workouts/exercises", handler!(get_exercises));
    router.post("/api/workouts/exercises", handler!(create_exercise));
    router.get(
        "/api/workouts/exercises/:exerciseId",
        handler!(get_exercise),
    );
    router.put("/api/workouts/exercises", handler!(update_exercise));
    router.post(
        "/api/workouts/exercises/:exerciseId/clone",
        handler!(clone_exercise),
    );
    router.delete(
        "/api/workouts/exercises/:exerciseId",
        handler!(delete_exercise),
    );

    // Analytics routes
    router.get("/api/workouts/analytics", handler!(get_workout_analytics));
    router.get("/api/workouts/insights", handler!(get_workout_insights));
    router.get("/api/workouts/history", handler!(get_workout_history));

    // Log Activity route
    router.post("/api/workouts/log-activity", handler!(log_activity));

    // Scheduled Workout routes
    router.post(
        "/api/workouts/plans/:planId/schedule",
        handler!(schedule_workout_plan),
    );
    router.get("/api/workouts/schedules", handler!(get_scheduled_workouts));
    router.put(
        "/api/workouts/schedules/:scheduleId",
        handler!(update_scheduled_workout),
    );
    router.delete(
        "/api/workouts/schedules/:scheduleId",
        handler!(delete_scheduled_workout),
    );

    info!("Workout Service initialized successfully");
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
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());

    // Initialize repositories
    let workout_plan_repository =
        WorkoutPlanRepository::new(dynamodb_client.clone(), table_name.clone());
    let workout_session_repository =
        WorkoutSessionRepository::new(dynamodb_client.clone(), table_name.clone());
    let exercise_repository = ExerciseRepository::new(dynamodb_client.clone(), table_name.clone());
    let workout_analytics_repository =
        WorkoutAnalyticsRepository::new(dynamodb_client.clone(), table_name.clone());
    let scheduled_workout_repository =
        ScheduledWorkoutRepository::new(dynamodb_client.clone(), table_name.clone());

    // Initialize services
    let workout_plan_service = WorkoutPlanService::new(workout_plan_repository);
    let workout_session_service = WorkoutSessionService::new(workout_session_repository);
    let exercise_service = ExerciseService::new(exercise_repository);
    let workout_analytics_service = WorkoutAnalyticsService::new(workout_analytics_repository);
    let scheduled_workout_service = ScheduledWorkoutService::new(scheduled_workout_repository);

    // Initialize and store controllers
    let _ = WORKOUT_PLAN_CONTROLLER.set(WorkoutPlanController::new(workout_plan_service));
    let _ = WORKOUT_SESSION_CONTROLLER.set(WorkoutSessionController::new(workout_session_service));
    let _ = EXERCISE_CONTROLLER.set(ExerciseController::new(exercise_service));
    let _ = WORKOUT_ANALYTICS_CONTROLLER
        .set(WorkoutAnalyticsController::new(workout_analytics_service));
    let _ = SCHEDULED_WORKOUT_CONTROLLER
        .set(ScheduledWorkoutController::new(scheduled_workout_service));
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
