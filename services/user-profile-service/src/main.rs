use lambda_runtime::{service_fn, Error, LambdaEvent};
use serde_json::Value;
use aws_sdk_dynamodb::Client as DynamoDbClient;
use aws_sdk_s3::Client as S3Client;
use aws_config::meta::region::RegionProviderChain;
use tracing::error;
use std::sync::Arc;
use once_cell::sync::{OnceCell, Lazy};

mod models;
mod repository;
mod service;
mod controller;
mod utils;

use repository::{UserProfileRepository, SleepRepository};
use service::{UserProfileService, SleepService, UploadService};
use controller::{UserProfileController, SleepController, UploadController};
use auth_layer::{AuthLayer, LambdaEvent as AuthLambdaEvent};
use utils::{ResponseBuilder, is_cors_preflight_request, RouteMatcher, Route};

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

    // Handle CORS preflight early
    if is_cors_preflight_request(http_method) {
        return Ok(ResponseBuilder::cors_preflight());
    }
    
    // Authenticate request
    let auth_context = match AUTH_LAYER.authenticate(&auth_event).await {
        Ok(auth_result) => {
            if !auth_result.is_authorized {
                return Ok(ResponseBuilder::forbidden(
                    &auth_result.error.unwrap_or("Access denied".to_string())
                ));
            }
            let ctx = auth_result.context.unwrap();
            ctx
        }
        Err(e) => {
            error!("Authentication error: {}", e);
            return Ok(ResponseBuilder::unauthorized(None));
        }
    };
    
    let body = event["body"]
        .as_str()
        .unwrap_or("{}");

    // Initialize services
    let dynamodb_client = DYNAMODB_CLIENT.get().expect("DynamoDB not initialized").as_ref();
    let s3_client = S3_CLIENT.get().expect("S3 not initialized").as_ref();

    // Create repositories
    let user_profile_repository = UserProfileRepository::new(dynamodb_client.clone(), s3_client.clone());
    let sleep_repository = SleepRepository::new(dynamodb_client.clone());

    // Create services
    let user_profile_service = UserProfileService::new(user_profile_repository, sleep_repository.clone());
    let sleep_service = SleepService::new(sleep_repository);
    let upload_service = UploadService::new(s3_client.clone());

    // Create controllers
    let user_profile_controller = UserProfileController::new(user_profile_service);
    let sleep_controller = SleepController::new(sleep_service);
    let upload_controller = UploadController::new(upload_service);

    // Ensure pathParameters.userId is available for handlers. If the path ends with
    // '/me', substitute the authenticated user's id. Otherwise, try to parse from path.
    let mut payload = event.clone();
    {
        use serde_json::{Map, Value as JsonValue};
        let auth_user_id = auth_context.user_id.clone();
        let mut path_params: Map<String, JsonValue> = payload
            .get("pathParameters")
            .and_then(|v| v.as_object().cloned())
            .unwrap_or_default();

        // Derive userId:
        // - If exact path is /api/user-profiles/profile or it ends with /me, use auth user id
        // - If path is /api/user-profiles/profile/{userId}, extract last segment
        let candidate = if path == "/api/user-profiles/profile" || path == "/api/user-profiles/profile/" {
            auth_user_id
        } else if path.ends_with("/me") {
            auth_user_id
        } else {
            let last_segment = path.rsplit('/').next().unwrap_or("");
            if !last_segment.is_empty() && last_segment != "profile" && last_segment != "userId" {
                last_segment.to_string()
            } else {
                auth_user_id
            }
        };

        path_params.insert("userId".to_string(), JsonValue::String(candidate.clone()));
        payload["pathParameters"] = JsonValue::Object(path_params);

    }    
    
    let response = match RouteMatcher::match_route(http_method, path) {
        Some(Route::GetUserProfile) => {
            user_profile_controller.get_user_profile(path, &auth_context).await
        }
        Some(Route::UpdateUserProfile) => {
            user_profile_controller.partial_update_user_profile(path, body, &auth_context).await
        }
        Some(Route::DeleteUserProfile) => {
            user_profile_controller.delete_user_profile(path, &auth_context).await
        }
        Some(Route::UploadProfile) => {
            upload_controller.generate_upload_url(body).await
        }
        Some(Route::GetUserStats) => {
            user_profile_controller.get_user_stats(path, &auth_context).await
        }
        Some(Route::GetUserPreferences) => {
            user_profile_controller.get_user_preferences(path, &auth_context).await
        }
        Some(Route::UpdateUserPreferences) => {
            user_profile_controller.update_user_preferences(path, body, &auth_context).await
        }
        Some(Route::GetSleepData) => {
            let query_params = RouteMatcher::extract_sleep_query_params(&event);
            sleep_controller.get_sleep_data(&query_params, &auth_context).await
        }
        Some(Route::SaveSleepData) => {
            sleep_controller.save_sleep_data(body, &auth_context).await
        }
        Some(Route::UpdateSleepData) => {
            sleep_controller.update_sleep_data(body, &auth_context).await
        }
        Some(Route::GetSleepHistory) => {
            let query_params = RouteMatcher::extract_sleep_query_params(&event);
            sleep_controller.get_sleep_history(&query_params, &auth_context).await
        }
        Some(Route::GetSleepStats) => {
            let query_params = RouteMatcher::extract_sleep_query_params(&event);
            sleep_controller.get_sleep_stats(&query_params, &auth_context).await
        }
        None => {
            Ok(ResponseBuilder::not_found("Endpoint not found"))
        }
    };
    
    response
}
