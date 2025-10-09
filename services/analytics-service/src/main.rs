mod models;
mod repository;
mod service;
mod controller;
mod utils;

use lambda_runtime::{service_fn, Error, LambdaEvent};
use serde_json::Value;
use aws_sdk_dynamodb::Client as DynamoDbClient;
use aws_sdk_s3::Client as S3Client;
use aws_config::meta::region::RegionProviderChain;
use anyhow::Result;
use tracing::error;
use std::sync::Arc;
use once_cell::sync::{OnceCell, Lazy};

use repository::{
    StrengthProgressRepository, BodyMeasurementRepository, ProgressChartRepository,
    MilestoneRepository, AchievementRepository, PerformanceTrendRepository,
    WorkoutSessionRepository, ProgressPhotoRepository,
};
use service::{
    StrengthProgressService, BodyMeasurementService, ProgressChartService,
    MilestoneService, AchievementService, PerformanceTrendService,
    WorkoutSessionService, ProgressPhotoService, AnalyticsService,
};
use controller::{
    StrengthProgressController, BodyMeasurementController, ProgressChartController,
    MilestoneController, AchievementController, PerformanceTrendController,
    WorkoutAnalyticsController, ProgressPhotoController,
};
use utils::{ResponseBuilder, RouteMatcher, DataHelper, routing::extract_path_parameters, routing::parse_query_string};
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
        let config = aws_config::defaults(aws_config::BehaviorVersion::latest())
            .region(region_provider)
            .load()
            .await;
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

    // Handle CORS preflight requests
    if http_method == "OPTIONS" {
        return Ok(ResponseBuilder::cors_preflight());
    }

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
                return Ok(ResponseBuilder::forbidden(&auth_result.error.unwrap_or("Access denied".to_string())));
            }
            auth_result.context.unwrap()
        }
        Err(e) => {
            error!("Authentication error: {}", e);
            return Ok(ResponseBuilder::unauthorized(Some("Authentication failed")));
        }
    };

    let body = event["body"]
        .as_str()
        .unwrap_or("{}");

    // Initialize repositories
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    let bucket_name = std::env::var("PROGRESS_PHOTOS_BUCKET").unwrap_or_else(|_| "gymcoach-ai-progress-photos".to_string());
    let dynamodb_client = DYNAMODB_CLIENT.get().expect("DynamoDB not initialized");
    let s3_client = S3_CLIENT.get().expect("S3 not initialized");

    let strength_progress_repository = StrengthProgressRepository::new(dynamodb_client.as_ref().clone(), table_name.clone());
    let body_measurement_repository = BodyMeasurementRepository::new(dynamodb_client.as_ref().clone(), table_name.clone());
    let progress_chart_repository = ProgressChartRepository::new(dynamodb_client.as_ref().clone(), table_name.clone());
    let milestone_repository = MilestoneRepository::new(dynamodb_client.as_ref().clone(), table_name.clone());
    let achievement_repository = AchievementRepository::new(dynamodb_client.as_ref().clone(), table_name.clone());
    let performance_trend_repository = PerformanceTrendRepository::new(dynamodb_client.as_ref().clone(), table_name.clone());
    let workout_session_repository = WorkoutSessionRepository::new(dynamodb_client.as_ref().clone(), table_name.clone());
    let progress_photo_repository = ProgressPhotoRepository::new(
        dynamodb_client.as_ref().clone(),
        s3_client.as_ref().clone(),
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
    let strength_progress_controller = StrengthProgressController::new(strength_progress_service);
    let body_measurement_controller = BodyMeasurementController::new(body_measurement_service);
    let progress_chart_controller = ProgressChartController::new(progress_chart_service);
    let milestone_controller = MilestoneController::new(milestone_service);
    let achievement_controller = AchievementController::new(achievement_service);
    let performance_trend_controller = PerformanceTrendController::new(performance_trend_service);
    let workout_analytics_controller = WorkoutAnalyticsController::new(analytics_service);
    let progress_photo_controller = ProgressPhotoController::new(progress_photo_service);

    // Extract path parameters and query parameters
    let path_params = extract_path_parameters(path);
    let query_params = parse_query_string(event.get("queryStringParameters").and_then(|v| v.as_str()));

    // Route the request
    let response = match RouteMatcher::match_route(http_method, path) {
        // Strength Progress routes
        Some(utils::routing::Route::GetStrengthProgress) => {
            let user_id = DataHelper::extract_user_id(&path_params, &query_params, &auth_context.user_id);
            let start_date = DataHelper::extract_start_date(&query_params);
            let end_date = DataHelper::extract_end_date(&query_params);
            strength_progress_controller.get_strength_progress(&user_id, start_date.as_deref(), end_date.as_deref()).await
        }
        Some(utils::routing::Route::CreateStrengthProgress) => {
            strength_progress_controller.create_strength_progress(body).await
        }

        // Body Measurement routes
        Some(utils::routing::Route::GetBodyMeasurements) => {
            let user_id = DataHelper::extract_user_id(&path_params, &query_params, &auth_context.user_id);
            let start_date = DataHelper::extract_start_date(&query_params);
            let end_date = DataHelper::extract_end_date(&query_params);
            body_measurement_controller.get_body_measurements(&user_id, start_date.as_deref(), end_date.as_deref()).await
        }
        Some(utils::routing::Route::CreateBodyMeasurement) => {
            body_measurement_controller.create_body_measurement(body).await
        }

        // Progress Chart routes
        Some(utils::routing::Route::GetProgressCharts) => {
            let user_id = DataHelper::extract_user_id(&path_params, &query_params, &auth_context.user_id);
            progress_chart_controller.get_progress_charts(&user_id).await
        }
        Some(utils::routing::Route::CreateProgressChart) => {
            progress_chart_controller.create_progress_chart(body).await
        }

        // Milestone routes
        Some(utils::routing::Route::GetMilestones) => {
            let user_id = DataHelper::extract_user_id(&path_params, &query_params, &auth_context.user_id);
            milestone_controller.get_milestones(&user_id).await
        }
        Some(utils::routing::Route::CreateMilestone) => {
            milestone_controller.create_milestone(body).await
        }

        // Achievement routes
        Some(utils::routing::Route::GetAchievements) => {
            let user_id = DataHelper::extract_user_id(&path_params, &query_params, &auth_context.user_id);
            achievement_controller.get_achievements(&user_id).await
        }
        Some(utils::routing::Route::CreateAchievement) => {
            achievement_controller.create_achievement(body).await
        }

        // Performance Trend routes
        Some(utils::routing::Route::GetPerformanceTrends) => {
            let user_id = DataHelper::extract_user_id(&path_params, &query_params, &auth_context.user_id);
            let start_date = DataHelper::extract_start_date(&query_params);
            let end_date = DataHelper::extract_end_date(&query_params);
            performance_trend_controller.get_performance_trends(&user_id, start_date.as_deref(), end_date.as_deref()).await
        }

        // Workout Analytics routes
        Some(utils::routing::Route::GetWorkoutAnalytics) => {
            let user_id = DataHelper::extract_user_id(&path_params, &query_params, &auth_context.user_id);
            let period = DataHelper::extract_period(&query_params);
            workout_analytics_controller.get_workout_analytics(&user_id, period.as_deref()).await
        }
        Some(utils::routing::Route::GetWorkoutInsights) => {
            let user_id = DataHelper::extract_user_id(&path_params, &query_params, &auth_context.user_id);
            let period = DataHelper::extract_period(&query_params);
            workout_analytics_controller.get_workout_insights(&user_id, period.as_deref()).await
        }
        Some(utils::routing::Route::GenerateProgressReport) => {
            // For now, return not implemented
            Ok(ResponseBuilder::not_found("Progress report generation not implemented"))
        }

        // Progress Photo routes
        Some(utils::routing::Route::GetProgressPhotos) => {
            let user_id = DataHelper::extract_user_id(&path_params, &query_params, &auth_context.user_id);
            let photo_type = DataHelper::extract_photo_type(&query_params);
            let start_date = DataHelper::extract_start_date(&query_params);
            let end_date = DataHelper::extract_end_date(&query_params);
            let limit = DataHelper::extract_limit(&query_params);
            progress_photo_controller.get_progress_photos(
                &user_id,
                photo_type.as_deref(),
                start_date.as_deref(),
                end_date.as_deref(),
                limit,
            ).await
        }
        Some(utils::routing::Route::UploadProgressPhoto) => {
            progress_photo_controller.upload_progress_photo(body).await
        }
        Some(utils::routing::Route::UpdateProgressPhoto) => {
            // For now, return not implemented
            Ok(ResponseBuilder::not_found("Progress photo update not implemented"))
        }
        Some(utils::routing::Route::DeleteProgressPhoto) => {
            // For now, return not implemented
            Ok(ResponseBuilder::not_found("Progress photo deletion not implemented"))
        }
        Some(utils::routing::Route::GetProgressPhotoAnalytics) => {
            // For now, return not implemented
            Ok(ResponseBuilder::not_found("Progress photo analytics not implemented"))
        }
        Some(utils::routing::Route::GetProgressPhotoTimeline) => {
            // For now, return not implemented
            Ok(ResponseBuilder::not_found("Progress photo timeline not implemented"))
        }

        _ => Ok(ResponseBuilder::not_found("Endpoint not found")),
    };

    Ok(response?)
}