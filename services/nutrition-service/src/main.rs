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

use repository::{MealRepository, FoodRepository, NutritionPlanRepository, WaterRepository, FavoriteRepository};
use service::{MealService, FoodService, NutritionPlanService, WaterService, FavoriteService, NutritionStatsService};
use controller::{MealController, FoodController, NutritionPlanController, WaterController, FavoriteController, NutritionStatsController};
use auth_layer::{AuthLayer, LambdaEvent as AuthLambdaEvent};
use utils::{ResponseBuilder, is_cors_preflight_request, RouteMatcher, Route, extract_user_id_from_path};

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

    // Initialize repositories
    let table_name = std::env::var("DYNAMODB_TABLE").unwrap_or_else(|_| "gymcoach-ai".to_string());
    let dynamodb_client = DYNAMODB_CLIENT.get().expect("DynamoDB not initialized").as_ref();
    
    let meal_repository = MealRepository::new(dynamodb_client.clone(), table_name.clone());
    let food_repository = FoodRepository::new(dynamodb_client.clone(), table_name.clone());
    let nutrition_plan_repository = NutritionPlanRepository::new(dynamodb_client.clone(), table_name.clone());
    let water_repository = WaterRepository::new(dynamodb_client.clone(), table_name.clone());
    let favorite_repository = FavoriteRepository::new(dynamodb_client.clone(), table_name.clone());

    // Initialize services
    let meal_service = MealService::new(meal_repository.clone(), food_repository.clone());
    let food_service = FoodService::new(food_repository.clone());
    let nutrition_plan_service = NutritionPlanService::new(nutrition_plan_repository);
    let water_service = WaterService::new(water_repository.clone());
    let favorite_service = FavoriteService::new(favorite_repository, food_repository.clone());
    let nutrition_stats_service = NutritionStatsService::new(meal_repository, water_repository);

    // Initialize controllers
    let meal_controller = MealController::new(meal_service);
    let food_controller = FoodController::new(food_service);
    let nutrition_plan_controller = NutritionPlanController::new(nutrition_plan_service);
    let water_controller = WaterController::new(water_service);
    let favorite_controller = FavoriteController::new(favorite_service);
    let nutrition_stats_controller = NutritionStatsController::new(nutrition_stats_service);

    // Extract user ID from path or use authenticated user's ID
    let user_id = extract_user_id_from_path(path)
        .map(|id| if id == "me" { auth_context.user_id.clone() } else { id })
        .unwrap_or_else(|| auth_context.user_id.clone());

    let response = match RouteMatcher::match_route(http_method, path) {
        Some(Route::CreateMeal) => {
            meal_controller.create_meal(&user_id, body, &auth_context).await
        }
        Some(Route::GetMeal) => {
            let meal_id = path.split('/').last().unwrap_or("");
            meal_controller.get_meal(&user_id, meal_id, &auth_context).await
        }
        Some(Route::GetMealsByDate) => {
            let date = path.split('/').last().unwrap_or("");
            meal_controller.get_meals_by_date(&user_id, date, &auth_context).await
        }
        Some(Route::GetUserMeals) => {
            meal_controller.get_user_meals(&user_id, &auth_context).await
        }
        Some(Route::UpdateMeal) => {
            let meal_id = path.split('/').last().unwrap_or("");
            meal_controller.update_meal(&user_id, meal_id, body, &auth_context).await
        }
        Some(Route::DeleteMeal) => {
            let meal_id = path.split('/').last().unwrap_or("");
            meal_controller.delete_meal(&user_id, meal_id, &auth_context).await
        }
        Some(Route::CreateFood) => {
            food_controller.create_food(body).await
        }
        Some(Route::GetFood) => {
            let food_id = path.split('/').last().unwrap_or("");
            food_controller.get_food(food_id).await
        }
        Some(Route::SearchFoods) => {
            let query_params = RouteMatcher::extract_query_params(&event);
            let query = query_params.get("q").map(|s| s.as_str()).unwrap_or("");
            let limit = query_params.get("limit").and_then(|s| s.parse::<u32>().ok());
            let cursor = query_params.get("cursor").map(|s| s.clone());
            food_controller.search_foods(query, limit, cursor).await
        }
        Some(Route::AddFavoriteFood) => {
            let food_id = path.split('/').last().unwrap_or("");
            favorite_controller.add_favorite_food(&user_id, food_id, &auth_context).await
        }
        Some(Route::RemoveFavoriteFood) => {
            let food_id = path.split('/').last().unwrap_or("");
            favorite_controller.remove_favorite_food(&user_id, food_id, &auth_context).await
        }
        Some(Route::ListFavoriteFoods) => {
            favorite_controller.list_favorite_foods(&user_id, &auth_context).await
        }
        Some(Route::CreateNutritionPlan) => {
            nutrition_plan_controller.create_nutrition_plan(&user_id, body, &auth_context).await
        }
        Some(Route::GetNutritionPlan) => {
            let plan_id = path.split('/').last().unwrap_or("");
            nutrition_plan_controller.get_nutrition_plan(&user_id, plan_id, &auth_context).await
        }
        Some(Route::GetNutritionStats) => {
            nutrition_stats_controller.get_nutrition_stats(&user_id, &auth_context).await
        }
        Some(Route::GetWater) => {
            let date = path.split('/').last().unwrap_or("");
            water_controller.get_water(&user_id, date, &auth_context).await
        }
        Some(Route::SetWater) => {
            let date = path.split('/').last().unwrap_or("");
            water_controller.set_water(&user_id, date, body, &auth_context).await
        }
        None => {
            Ok(ResponseBuilder::not_found("Endpoint not found"))
        }
    };
    
    response
}