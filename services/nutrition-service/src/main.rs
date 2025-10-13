use async_trait::async_trait;
use aws_config::meta::region::RegionProviderChain;
use aws_sdk_dynamodb::Client as DynamoDbClient;
use aws_sdk_s3::Client as S3Client;
use lambda_router::{handler, Context, Middleware, Next, Request, Response, Router, RouterError};
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
    FavoriteController, FoodController, MealController, NutritionPlanController,
    NutritionStatsController, WaterController,
};
use repository::{
    FavoriteRepository, FoodRepository, MealRepository, NutritionPlanRepository, WaterRepository,
};
use service::{
    FavoriteService, FoodService, MealService, NutritionPlanService, NutritionStatsService,
    WaterService,
};

// Import all handler functions
use handlers::{
    // Favorite handlers
    add_favorite_food,
    add_favorite_food_me,
    // Food handlers
    create_food,
    // Meal handlers
    create_meal,
    create_meal_me,
    // Nutrition plan handlers
    create_nutrition_plan,
    delete_meal,
    get_food,
    get_meal,
    get_meals_by_date,
    get_meals_by_date_me,
    get_nutrition_plan,
    // Nutrition stats handlers
    get_nutrition_stats,
    get_user_meals,
    get_user_meals_me,
    // Water handlers
    get_water,
    get_water_me,
    list_favorite_foods,
    list_favorite_foods_me,
    remove_favorite_food,
    remove_favorite_food_me,
    search_foods,
    set_water,
    set_water_me,
    update_meal,
};

// Global clients for cold start optimization
static DYNAMODB_CLIENT: OnceCell<Arc<DynamoDbClient>> = OnceCell::new();
static S3_CLIENT: OnceCell<Arc<S3Client>> = OnceCell::new();

// Ensure tracing is initialized only once across Lambda invocations
static TRACING_INIT: OnceCell<()> = OnceCell::new();
static AUTH_LAYER: Lazy<AuthLayer> = Lazy::new(|| AuthLayer::new());

// Global controllers (initialized once)
static MEAL_CONTROLLER: OnceCell<MealController> = OnceCell::new();
static FOOD_CONTROLLER: OnceCell<FoodController> = OnceCell::new();
static NUTRITION_PLAN_CONTROLLER: OnceCell<NutritionPlanController> = OnceCell::new();
static WATER_CONTROLLER: OnceCell<WaterController> = OnceCell::new();
static FAVORITE_CONTROLLER: OnceCell<FavoriteController> = OnceCell::new();
static NUTRITION_STATS_CONTROLLER: OnceCell<NutritionStatsController> = OnceCell::new();

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

    info!("Starting Nutrition Service initialization...");

    // Initialize global clients
    info!("Initializing AWS clients...");
    if DYNAMODB_CLIENT.get().is_none() || S3_CLIENT.get().is_none() {
        let region_provider = RegionProviderChain::default_provider();
        let config = aws_config::from_env().region(region_provider).load().await;
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

    // Meal routes
    router.post("/api/nutrition/users/:userId/meals", handler!(create_meal));
    router.get(
        "/api/nutrition/users/:userId/meals/:mealId",
        handler!(get_meal),
    );
    router.get(
        "/api/nutrition/users/:userId/meals/date/:date",
        handler!(get_meals_by_date),
    );
    router.get(
        "/api/nutrition/users/:userId/meals",
        handler!(get_user_meals),
    );
    router.put(
        "/api/nutrition/users/:userId/meals/:mealId",
        handler!(update_meal),
    );
    router.delete(
        "/api/nutrition/users/:userId/meals/:mealId",
        handler!(delete_meal),
    );

    // Alternative paths for backward compatibility
    router.post("/api/users/:userId/meals", handler!(create_meal));
    router.get("/api/users/:userId/meals/:mealId", handler!(get_meal));
    router.get(
        "/api/users/:userId/meals/date/:date",
        handler!(get_meals_by_date),
    );
    router.get("/api/users/:userId/meals", handler!(get_user_meals));
    router.put("/api/users/:userId/meals/:mealId", handler!(update_meal));
    router.delete("/api/users/:userId/meals/:mealId", handler!(delete_meal));

    // Support "me" paths
    router.post("/api/nutrition/me/meals", handler!(create_meal_me));
    router.get("/api/nutrition/me/meals", handler!(get_user_meals_me));
    router.get(
        "/api/nutrition/me/meals/date/:date",
        handler!(get_meals_by_date_me),
    );
    router.get("/nutrition/me/meals", handler!(get_user_meals_me));
    router.post("/me/meals", handler!(create_meal_me));

    // Food routes
    router.post("/api/nutrition/foods", handler!(create_food));
    router.get("/api/nutrition/foods/:foodId", handler!(get_food));
    router.get("/api/nutrition/foods/search", handler!(search_foods));

    // Favorite food routes
    router.post(
        "/api/nutrition/users/:userId/favorites/foods/:foodId",
        handler!(add_favorite_food),
    );
    router.delete(
        "/api/nutrition/users/:userId/favorites/foods/:foodId",
        handler!(remove_favorite_food),
    );
    router.get(
        "/api/nutrition/users/:userId/favorites/foods",
        handler!(list_favorite_foods),
    );

    // Alternative paths
    router.post(
        "/api/users/:userId/favorites/foods/:foodId",
        handler!(add_favorite_food),
    );
    router.delete(
        "/api/users/:userId/favorites/foods/:foodId",
        handler!(remove_favorite_food),
    );
    router.get(
        "/api/users/:userId/favorites/foods",
        handler!(list_favorite_foods),
    );

    // Favorites /me routes
    router.get(
        "/api/nutrition/me/favorites/foods",
        handler!(list_favorite_foods_me),
    );
    router.post(
        "/api/nutrition/me/favorites/foods/:foodId",
        handler!(add_favorite_food_me),
    );
    router.delete(
        "/api/nutrition/me/favorites/foods/:foodId",
        handler!(remove_favorite_food_me),
    );

    // Nutrition plan routes
    router.post(
        "/api/nutrition/users/:userId/nutrition-plans",
        handler!(create_nutrition_plan),
    );
    router.get(
        "/api/nutrition/users/:userId/nutrition-plans/:planId",
        handler!(get_nutrition_plan),
    );

    // Nutrition stats routes
    router.get(
        "/api/nutrition/users/:userId/stats",
        handler!(get_nutrition_stats),
    );
    router.get("/api/users/:userId/stats", handler!(get_nutrition_stats));

    // Water intake routes
    router.get(
        "/api/nutrition/users/:userId/water/date/:date",
        handler!(get_water),
    );
    router.post(
        "/api/nutrition/users/:userId/water/date/:date",
        handler!(set_water),
    );
    router.get("/api/users/:userId/water/date/:date", handler!(get_water));
    router.post("/api/users/:userId/water/date/:date", handler!(set_water));

    // Water intake /me routes
    router.get("/api/nutrition/me/water/date/:date", handler!(get_water_me));
    router.post("/api/nutrition/me/water/date/:date", handler!(set_water_me));

    info!("Nutrition Service initialized successfully");
    info!("Starting Lambda runtime...");

    // Run Lambda service
    let result = lambda_runtime::run(service_fn(router.into_service())).await;

    if let Err(e) = &result {
        error!("Lambda runtime error: {}", e);
    }

    result
}

fn init_controllers() {
    let table_name = std::env::var("DYNAMODB_TABLE").unwrap_or_else(|_| "gymcoach-ai".to_string());
    let dynamodb_client = DYNAMODB_CLIENT
        .get()
        .expect("DynamoDB not initialized")
        .as_ref();

    let meal_repository = MealRepository::new(dynamodb_client.clone(), table_name.clone());
    let food_repository = FoodRepository::new(dynamodb_client.clone(), table_name.clone());
    let nutrition_plan_repository =
        NutritionPlanRepository::new(dynamodb_client.clone(), table_name.clone());
    let water_repository = WaterRepository::new(dynamodb_client.clone(), table_name.clone());
    let favorite_repository = FavoriteRepository::new(dynamodb_client.clone(), table_name.clone());

    let meal_service = MealService::new(meal_repository.clone(), food_repository.clone());
    let food_service = FoodService::new(food_repository.clone());
    let nutrition_plan_service = NutritionPlanService::new(nutrition_plan_repository);
    let water_service = WaterService::new(water_repository.clone());
    let favorite_service = FavoriteService::new(favorite_repository, food_repository.clone());
    let nutrition_stats_service = NutritionStatsService::new(meal_repository, water_repository);

    let _ = MEAL_CONTROLLER.set(MealController::new(meal_service));
    let _ = FOOD_CONTROLLER.set(FoodController::new(food_service));
    let _ = NUTRITION_PLAN_CONTROLLER.set(NutritionPlanController::new(nutrition_plan_service));
    let _ = WATER_CONTROLLER.set(WaterController::new(water_service));
    let _ = FAVORITE_CONTROLLER.set(FavoriteController::new(favorite_service));
    let _ = NUTRITION_STATS_CONTROLLER.set(NutritionStatsController::new(nutrition_stats_service));
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
