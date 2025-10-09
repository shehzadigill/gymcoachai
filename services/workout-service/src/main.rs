use lambda_runtime::{service_fn, Error, LambdaEvent};
use serde_json::Value;
use aws_sdk_dynamodb::Client as DynamoDbClient;
use aws_sdk_s3::Client as S3Client;
use aws_config::meta::region::RegionProviderChain;
use anyhow::Result;
use tracing::error;
use std::sync::Arc;
use once_cell::sync::{OnceCell, Lazy};

mod models;
mod repository;
mod service;
mod controller;
mod utils;

use repository::*;
use service::*;
use controller::*;
use utils::*;
use auth_layer::{AuthLayer, LambdaEvent as AuthLambdaEvent};

// Global clients for cold start optimization
static DYNAMODB_CLIENT: OnceCell<Arc<DynamoDbClient>> = OnceCell::new();
static S3_CLIENT: OnceCell<Arc<S3Client>> = OnceCell::new();

static AUTH_LAYER: Lazy<AuthLayer> = Lazy::new(|| AuthLayer::new());

#[tokio::main]
async fn main() -> Result<(), Error> {
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .with_target(false)
        .without_time()
        .init();

    // Initialize global clients
    if DYNAMODB_CLIENT.get().is_none() || S3_CLIENT.get().is_none() {
        let region_provider = RegionProviderChain::default_provider();
        let config = aws_config::from_env().region(region_provider).load().await;
        let _ = DYNAMODB_CLIENT.set(Arc::new(DynamoDbClient::new(&config)));
        let _ = S3_CLIENT.set(Arc::new(S3Client::new(&config)));
    }
    let _ = &*AUTH_LAYER;

    let func = service_fn(handler);
    lambda_runtime::run(func).await?;
    Ok(())
}

async fn handler(event: LambdaEvent<Value>) -> Result<Value, Error> {
    let (event, _context) = event.into_parts();

    // Read method and path early so they are available for auth
    let http_method = event["requestContext"]["http"]["method"]
        .as_str()
        .unwrap_or("GET");
    let path = event["rawPath"].as_str().unwrap_or("/");

    // Convert to auth event format
    let auth_event = AuthLambdaEvent {
        headers: event.get("headers")
            .and_then(|v| v.as_object())
            .map(|obj| {
                obj.iter()
                    .map(|(k, v)| (k.clone(), v.as_str().unwrap_or("").to_string()))
                    .collect()
            }),
        request_context: event.get("requestContext")
            .and_then(|v| serde_json::from_value(v.clone()).ok()),
        path_parameters: event.get("pathParameters")
            .and_then(|v| v.as_object())
            .map(|obj| {
                obj.iter()
                    .map(|(k, v)| (k.clone(), v.as_str().unwrap_or("").to_string()))
                    .collect()
            }),
        query_string_parameters: event.get("queryStringParameters")
            .and_then(|v| v.as_object())
            .map(|obj| {
                obj.iter()
                    .map(|(k, v)| (k.clone(), v.as_str().unwrap_or("").to_string()))
                    .collect()
            }),
        body: event.get("body")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
    };

    // Authenticate request
    let auth_context = match AUTH_LAYER.authenticate(&auth_event).await {
        Ok(auth_result) => {
            if !auth_result.is_authorized {
                return Ok(ResponseBuilder::forbidden(
                    &auth_result.error.unwrap_or("Access denied".to_string())
                ));
            }
            auth_result.context.unwrap()
        }
        Err(e) => {
            error!("Authentication error: {}", e);
            return Ok(ResponseBuilder::unauthorized(Some("Authentication failed")));
        }
    };

    // Handle CORS preflight
    if http_method == "OPTIONS" {
        return Ok(ResponseBuilder::cors_preflight());
    }

    let body = event["body"]
        .as_str()
        .unwrap_or("{}");

    // Initialize repositories
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    let dynamodb_client = DYNAMODB_CLIENT.get().expect("DynamoDB not initialized");
    
    let workout_plan_repository = WorkoutPlanRepository::new(dynamodb_client.as_ref().clone(), table_name.clone());
    let workout_session_repository = WorkoutSessionRepository::new(dynamodb_client.as_ref().clone(), table_name.clone());
    let exercise_repository = ExerciseRepository::new(dynamodb_client.as_ref().clone(), table_name.clone());
    let workout_analytics_repository = WorkoutAnalyticsRepository::new(dynamodb_client.as_ref().clone(), table_name.clone());
    let scheduled_workout_repository = ScheduledWorkoutRepository::new(dynamodb_client.as_ref().clone(), table_name.clone());

    // Initialize services
    let workout_plan_service = WorkoutPlanService::new(workout_plan_repository);
    let workout_session_service = WorkoutSessionService::new(workout_session_repository);
    let exercise_service = ExerciseService::new(exercise_repository);
    let workout_analytics_service = WorkoutAnalyticsService::new(workout_analytics_repository);
    let scheduled_workout_service = ScheduledWorkoutService::new(scheduled_workout_repository);

    // Initialize controllers
    let workout_plan_controller = WorkoutPlanController::new(workout_plan_service);
    let workout_session_controller = WorkoutSessionController::new(workout_session_service);
    let exercise_controller = ExerciseController::new(exercise_service);
    let workout_analytics_controller = WorkoutAnalyticsController::new(workout_analytics_service);
    let scheduled_workout_controller = ScheduledWorkoutController::new(scheduled_workout_service);

    // Extract path parameters
    let path_params = extract_path_parameters(path);
    let query_params = crate::utils::routing::parse_query_string(event.get("queryStringParameters").and_then(|v| v.as_str()));

    // Route the request
    let response = match RouteMatcher::match_route(http_method, path) {
        // Workout Plan routes
        Some(Route::GetWorkoutPlans) => {
            let user_id = query_params.get("userId").cloned();
            workout_plan_controller.get_workout_plans(user_id, &auth_context).await
        }
        Some(Route::CreateWorkoutPlan) => {
            workout_plan_controller.create_workout_plan(body, &auth_context).await
        }
        Some(Route::GetWorkoutPlan) => {
            let user_id = query_params.get("userId").unwrap_or(&auth_context.user_id);
            let empty_string = "".to_string();
            let plan_id = path_params.get("planId").unwrap_or(&empty_string);
            workout_plan_controller.get_workout_plan(user_id, plan_id, &auth_context).await
        }
        Some(Route::UpdateWorkoutPlan) => {
            workout_plan_controller.update_workout_plan(body, &auth_context).await
        }
        Some(Route::DeleteWorkoutPlan) => {
            let user_id = query_params.get("userId").unwrap_or(&auth_context.user_id);
            let empty_string = "".to_string();
            let plan_id = path_params.get("planId").unwrap_or(&empty_string);
            workout_plan_controller.delete_workout_plan(user_id, plan_id, &auth_context).await
        }

        // Workout Session routes
        Some(Route::GetWorkoutSessions) => {
            let user_id = query_params.get("userId").cloned();
            workout_session_controller.get_workout_sessions(user_id, &auth_context).await
        }
        Some(Route::CreateWorkoutSession) => {
            workout_session_controller.create_workout_session(body, &auth_context).await
        }
        Some(Route::GetWorkoutSession) => {
            let empty_string = "".to_string();
            let session_id = path_params.get("sessionId").unwrap_or(&empty_string);
            workout_session_controller.get_workout_session(session_id, &auth_context).await
        }
        Some(Route::UpdateWorkoutSession) => {
            workout_session_controller.update_workout_session(body, &auth_context).await
        }
        Some(Route::DeleteWorkoutSession) => {
            let empty_string = "".to_string();
            let session_id = path_params.get("sessionId").unwrap_or(&empty_string);
            workout_session_controller.delete_workout_session(session_id, &auth_context).await
        }

        // Exercise routes
        Some(Route::GetExercises) => {
            exercise_controller.get_exercises(&auth_context).await
        }
        Some(Route::CreateExercise) => {
            exercise_controller.create_exercise(body, &auth_context).await
        }
        Some(Route::GetExercise) => {
            let empty_string = "".to_string();
            let exercise_id = path_params.get("exerciseId").unwrap_or(&empty_string);
            exercise_controller.get_exercise(exercise_id, &auth_context).await
        }
        Some(Route::UpdateExercise) => {
            exercise_controller.update_exercise(body, &auth_context).await
        }
        Some(Route::CloneExercise) => {
            let empty_string = "".to_string();
            let exercise_id = path_params.get("exerciseId").unwrap_or(&empty_string);
            exercise_controller.clone_exercise(exercise_id, &auth_context).await
        }
        Some(Route::DeleteExercise) => {
            let empty_string = "".to_string();
            let exercise_id = path_params.get("exerciseId").unwrap_or(&empty_string);
            exercise_controller.delete_exercise(exercise_id, &auth_context).await
        }

        // Analytics routes
        Some(Route::GetWorkoutAnalytics) => {
            let user_id = query_params.get("userId").cloned();
            workout_analytics_controller.get_workout_analytics(user_id, &auth_context).await
        }
        Some(Route::GetWorkoutInsights) => {
            let user_id = query_params.get("userId").unwrap_or(&auth_context.user_id);
            let week_string = "week".to_string();
            let time_range = query_params.get("timeRange").unwrap_or(&week_string);
            workout_analytics_controller.get_workout_insights(user_id, time_range, &auth_context).await
        }
        Some(Route::GetWorkoutHistory) => {
            let user_id = query_params.get("userId").unwrap_or(&auth_context.user_id);
            let limit = query_params.get("limit")
                .and_then(|s| s.parse::<i32>().ok());
            workout_analytics_controller.get_workout_history(user_id, limit, &auth_context).await
        }

        // Log Activity route (placeholder - would need implementation)
        Some(Route::LogActivity) => {
            Ok(ResponseBuilder::not_implemented("Log activity endpoint not yet implemented"))
        }

        // Scheduled Workout routes
        Some(Route::ScheduleWorkoutPlan) => {
            scheduled_workout_controller.create_scheduled_workout(body, &auth_context).await
        }
        Some(Route::GetScheduledWorkouts) => {
            let user_id = query_params.get("userId").cloned();
            scheduled_workout_controller.get_scheduled_workouts(user_id, &auth_context).await
        }
        Some(Route::UpdateScheduledWorkout) => {
            scheduled_workout_controller.update_scheduled_workout(body, &auth_context).await
        }
        Some(Route::DeleteScheduledWorkout) => {
            let user_id = query_params.get("userId").unwrap_or(&auth_context.user_id);
            let empty_string = "".to_string();
            let schedule_id = path_params.get("scheduleId").unwrap_or(&empty_string);
            scheduled_workout_controller.delete_scheduled_workout(user_id, schedule_id, &auth_context).await
        }

        _ => Ok(ResponseBuilder::not_found("Endpoint not found")),
    };

    response
}