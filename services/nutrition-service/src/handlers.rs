use serde_json::{json, Value};
use anyhow::Result;
use tracing::{info, error, warn};
use uuid::Uuid;
use chrono::Utc;

use crate::models::*;
use crate::database::NutritionRepository;
use auth_layer::AuthContext;

// Meal handlers
pub async fn handle_create_meal(
    user_id: &str,
    body: &str,
    nutrition_repo: &NutritionRepository,
    auth_context: &AuthContext,
) -> Result<Value> {
    let create_request: CreateMealRequest = match serde_json::from_str(body) {
        Ok(request) => request,
        Err(e) => {
            error!("Failed to parse create meal request: {}", e);
            return Ok(json!({
                "statusCode": 400,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Bad Request",
                    "message": "Invalid JSON in request body",
                    "details": e.to_string()
                })
            }));
        }
    };

    // Validate the request
    if let Err(validation_errors) = create_request.validate() {
        error!("Validation failed for create meal request: {:?}", validation_errors);
        return Ok(json!({
            "statusCode": 400,
            "headers": get_cors_headers(),
            "body": json!({
                "error": "Validation Error",
                "message": "Invalid input data",
                "details": validation_errors.field_errors()
            })
        }));
    }

    // Create meal ID
    let meal_id = Uuid::new_v4().to_string();
    let now = Utc::now();

    // Calculate nutrition totals from foods
    let mut total_calories = 0.0;
    let mut total_protein = 0.0;
    let mut total_carbs = 0.0;
    let mut total_fat = 0.0;
    let mut total_fiber = 0.0;
    let mut total_sugar = 0.0;
    let mut total_sodium = 0.0;

    let mut foods = Vec::new();
    for food_request in &create_request.foods {
        // Get food details from database
        match nutrition_repo.get_food_by_id(&food_request.food_id).await {
            Ok(Some(food)) => {
                let multiplier = food_request.quantity / food.serving_size;
                
                let food_item = FoodItem {
                    id: Uuid::new_v4().to_string(),
                    food_id: food.id.clone(),
                    name: food.name.clone(),
                    brand: food.brand.clone(),
                    quantity: food_request.quantity,
                    unit: food_request.unit.clone(),
                    serving_size: food.serving_size,
                    serving_unit: food.serving_unit.clone(),
                    calories: food.nutrition_facts.calories * multiplier,
                    protein: food.nutrition_facts.protein * multiplier,
                    carbs: food.nutrition_facts.total_carbs * multiplier,
                    fat: food.nutrition_facts.total_fat * multiplier,
                    fiber: food.nutrition_facts.dietary_fiber * multiplier,
                    sugar: food.nutrition_facts.total_sugars * multiplier,
                    sodium: food.nutrition_facts.sodium * multiplier,
                    barcode: food.barcode.clone(),
                    nutrition_facts: Some(food.nutrition_facts.clone()),
                };

                total_calories += food_item.calories;
                total_protein += food_item.protein;
                total_carbs += food_item.carbs;
                total_fat += food_item.fat;
                total_fiber += food_item.fiber;
                total_sugar += food_item.sugar;
                total_sodium += food_item.sodium;

                foods.push(food_item);
            }
            Ok(None) => {
                return Ok(json!({
                    "statusCode": 404,
                    "headers": get_cors_headers(),
                    "body": json!({
                        "error": "Not Found",
                        "message": format!("Food with ID {} not found", food_request.food_id)
                    })
                }));
            }
            Err(e) => {
                error!("Failed to get food: {}", e);
                return Ok(json!({
                    "statusCode": 500,
                    "headers": get_cors_headers(),
                    "body": json!({
                        "error": "Internal Server Error",
                        "message": "Failed to retrieve food information"
                    })
                }));
            }
        }
    }

    let meal = Meal {
        id: meal_id.clone(),
        user_id: user_id.to_string(),
        name: create_request.name,
        description: create_request.description,
        meal_type: create_request.meal_type,
        meal_date: create_request.meal_date,
        meal_time: create_request.meal_time,
        total_calories,
        total_protein,
        total_carbs,
        total_fat,
        total_fiber,
        total_sugar,
        total_sodium,
        foods,
        notes: create_request.notes,
        created_at: now,
        updated_at: now,
    };

    match nutrition_repo.create_meal(&meal).await {
        Ok(created_meal) => {
            info!("Meal created successfully: {}", created_meal.id);
            Ok(json!({
                "statusCode": 201,
                "headers": get_cors_headers(),
                "body": json!({
                    "id": created_meal.id,
                    "user_id": created_meal.user_id,
                    "name": created_meal.name,
                    "meal_type": created_meal.meal_type,
                    "meal_date": created_meal.meal_date,
                    "total_calories": created_meal.total_calories,
                    "total_protein": created_meal.total_protein,
                    "total_carbs": created_meal.total_carbs,
                    "total_fat": created_meal.total_fat,
                    "created_at": created_meal.created_at,
                    "message": "Meal created successfully"
                })
            }))
        }
        Err(e) => {
            error!("Failed to create meal: {}", e);
            Ok(json!({
                "statusCode": 500,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Internal Server Error",
                    "message": "Failed to create meal"
                })
            }))
        }
    }
}

pub async fn handle_get_meal(
    user_id: &str,
    meal_id: &str,
    nutrition_repo: &NutritionRepository,
) -> Result<Value> {
    match nutrition_repo.get_meal_by_id(user_id, meal_id).await {
        Ok(Some(meal)) => {
            info!("Meal retrieved successfully: {}", meal.id);
            Ok(json!({
                "statusCode": 200,
                "headers": get_cors_headers(),
                "body": meal
            }))
        }
        Ok(None) => {
            warn!("Meal not found: {}", meal_id);
            Ok(json!({
                "statusCode": 404,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Not Found",
                    "message": "Meal not found"
                })
            }))
        }
        Err(e) => {
            error!("Failed to get meal: {}", e);
            Ok(json!({
                "statusCode": 500,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Internal Server Error",
                    "message": "Failed to retrieve meal"
                })
            }))
        }
    }
}

pub async fn handle_get_meals_by_date(
    user_id: &str,
    date: &str,
    nutrition_repo: &NutritionRepository,
) -> Result<Value> {
    let meal_date = match chrono::DateTime::parse_from_rfc3339(date) {
        Ok(dt) => dt.with_timezone(&Utc),
        Err(e) => {
            error!("Invalid date format: {}", e);
            return Ok(json!({
                "statusCode": 400,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Bad Request",
                    "message": "Invalid date format. Use ISO 8601 format"
                })
            }));
        }
    };

    match nutrition_repo.get_meals_by_date(user_id, &meal_date).await {
        Ok(meals) => {
            info!("Meals retrieved successfully for date: {}", date);
            Ok(json!({
                "statusCode": 200,
                "headers": get_cors_headers(),
                "body": json!({
                    "meals": meals,
                    "date": date,
                    "count": meals.len()
                })
            }))
        }
        Err(e) => {
            error!("Failed to get meals by date: {}", e);
            Ok(json!({
                "statusCode": 500,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Internal Server Error",
                    "message": "Failed to retrieve meals"
                })
            }))
        }
    }
}

pub async fn handle_update_meal(
    user_id: &str,
    meal_id: &str,
    body: &str,
    nutrition_repo: &NutritionRepository,
) -> Result<Value> {
    let update_request: UpdateMealRequest = match serde_json::from_str(body) {
        Ok(request) => request,
        Err(e) => {
            error!("Failed to parse update meal request: {}", e);
            return Ok(json!({
                "statusCode": 400,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Bad Request",
                    "message": "Invalid JSON in request body",
                    "details": e.to_string()
                })
            }));
        }
    };

    // Validate the request
    if let Err(validation_errors) = update_request.validate() {
        error!("Validation failed for update meal request: {:?}", validation_errors);
        return Ok(json!({
            "statusCode": 400,
            "headers": get_cors_headers(),
            "body": json!({
                "error": "Validation Error",
                "message": "Invalid input data",
                "details": validation_errors.field_errors()
            })
        }));
    }

    // Check if meal exists
    match nutrition_repo.get_meal_by_id(user_id, meal_id).await {
        Ok(Some(_)) => {
            // Meal exists, proceed with update
        }
        Ok(None) => {
            return Ok(json!({
                "statusCode": 404,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Not Found",
                    "message": "Meal not found"
                })
            }));
        }
        Err(e) => {
            error!("Failed to check meal existence: {}", e);
            return Ok(json!({
                "statusCode": 500,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Internal Server Error",
                    "message": "Failed to check meal existence"
                })
            }));
        }
    }

    match nutrition_repo.update_meal(user_id, meal_id, &update_request).await {
        Ok(updated_meal) => {
            info!("Meal updated successfully: {}", updated_meal.id);
            Ok(json!({
                "statusCode": 200,
                "headers": get_cors_headers(),
                "body": json!({
                    "id": updated_meal.id,
                    "user_id": updated_meal.user_id,
                    "name": updated_meal.name,
                    "meal_type": updated_meal.meal_type,
                    "meal_date": updated_meal.meal_date,
                    "total_calories": updated_meal.total_calories,
                    "total_protein": updated_meal.total_protein,
                    "total_carbs": updated_meal.total_carbs,
                    "total_fat": updated_meal.total_fat,
                    "updated_at": updated_meal.updated_at,
                    "message": "Meal updated successfully"
                })
            }))
        }
        Err(e) => {
            error!("Failed to update meal: {}", e);
            Ok(json!({
                "statusCode": 500,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Internal Server Error",
                    "message": "Failed to update meal"
                })
            }))
        }
    }
}

pub async fn handle_delete_meal(
    user_id: &str,
    meal_id: &str,
    nutrition_repo: &NutritionRepository,
) -> Result<Value> {
    // Check if meal exists
    match nutrition_repo.get_meal_by_id(user_id, meal_id).await {
        Ok(Some(_)) => {
            // Meal exists, proceed with deletion
        }
        Ok(None) => {
            return Ok(json!({
                "statusCode": 404,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Not Found",
                    "message": "Meal not found"
                })
            }));
        }
        Err(e) => {
            error!("Failed to check meal existence: {}", e);
            return Ok(json!({
                "statusCode": 500,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Internal Server Error",
                    "message": "Failed to check meal existence"
                })
            }));
        }
    }

    match nutrition_repo.delete_meal(user_id, meal_id).await {
        Ok(_) => {
            info!("Meal deleted successfully: {}", meal_id);
            Ok(json!({
                "statusCode": 200,
                "headers": get_cors_headers(),
                "body": json!({
                    "id": meal_id,
                    "message": "Meal deleted successfully"
                })
            }))
        }
        Err(e) => {
            error!("Failed to delete meal: {}", e);
            Ok(json!({
                "statusCode": 500,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Internal Server Error",
                    "message": "Failed to delete meal"
                })
            }))
        }
    }
}

// Food handlers
pub async fn handle_create_food(
    body: &str,
    nutrition_repo: &NutritionRepository,
) -> Result<Value> {
    let create_request: CreateFoodRequest = match serde_json::from_str(body) {
        Ok(request) => request,
        Err(e) => {
            error!("Failed to parse create food request: {}", e);
            return Ok(json!({
                "statusCode": 400,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Bad Request",
                    "message": "Invalid JSON in request body",
                    "details": e.to_string()
                })
            }));
        }
    };

    // Validate the request
    if let Err(validation_errors) = create_request.validate() {
        error!("Validation failed for create food request: {:?}", validation_errors);
        return Ok(json!({
            "statusCode": 400,
            "headers": get_cors_headers(),
            "body": json!({
                "error": "Validation Error",
                "message": "Invalid input data",
                "details": validation_errors.field_errors()
            })
        }));
    }

    let food_id = Uuid::new_v4().to_string();
    let now = Utc::now();

    let food = Food {
        id: food_id.clone(),
        name: create_request.name,
        brand: create_request.brand,
        category: create_request.category,
        subcategory: create_request.subcategory,
        description: create_request.description,
        barcode: create_request.barcode,
        upc: create_request.upc,
        nutrition_facts: create_request.nutrition_facts,
        serving_size: create_request.serving_size,
        serving_unit: create_request.serving_unit,
        common_servings: create_request.common_servings.unwrap_or_default(),
        allergens: create_request.allergens.unwrap_or_default(),
        dietary_tags: create_request.dietary_tags.unwrap_or_default(),
        verified: false,
        verified_by: None,
        verified_at: None,
        created_at: now,
        updated_at: now,
    };

    match nutrition_repo.create_food(&food).await {
        Ok(created_food) => {
            info!("Food created successfully: {}", created_food.id);
            Ok(json!({
                "statusCode": 201,
                "headers": get_cors_headers(),
                "body": json!({
                    "id": created_food.id,
                    "name": created_food.name,
                    "brand": created_food.brand,
                    "category": created_food.category,
                    "nutrition_facts": created_food.nutrition_facts,
                    "serving_size": created_food.serving_size,
                    "serving_unit": created_food.serving_unit,
                    "created_at": created_food.created_at,
                    "message": "Food created successfully"
                })
            }))
        }
        Err(e) => {
            error!("Failed to create food: {}", e);
            Ok(json!({
                "statusCode": 500,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Internal Server Error",
                    "message": "Failed to create food"
                })
            }))
        }
    }
}

pub async fn handle_get_food(
    food_id: &str,
    nutrition_repo: &NutritionRepository,
) -> Result<Value> {
    match nutrition_repo.get_food_by_id(food_id).await {
        Ok(Some(food)) => {
            info!("Food retrieved successfully: {}", food.id);
            Ok(json!({
                "statusCode": 200,
                "headers": get_cors_headers(),
                "body": food
            }))
        }
        Ok(None) => {
            warn!("Food not found: {}", food_id);
            Ok(json!({
                "statusCode": 404,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Not Found",
                    "message": "Food not found"
                })
            }))
        }
        Err(e) => {
            error!("Failed to get food: {}", e);
            Ok(json!({
                "statusCode": 500,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Internal Server Error",
                    "message": "Failed to retrieve food"
                })
            }))
        }
    }
}

pub async fn handle_search_foods(
    query: &str,
    limit: Option<u32>,
    nutrition_repo: &NutritionRepository,
) -> Result<Value> {
    let limit = limit.unwrap_or(20).min(100); // Max 100 results

    match nutrition_repo.search_foods(query, limit).await {
        Ok(foods) => {
            info!("Foods searched successfully: {} results", foods.len());
            Ok(json!({
                "statusCode": 200,
                "headers": get_cors_headers(),
                "body": json!({
                    "foods": foods,
                    "query": query,
                    "count": foods.len(),
                    "limit": limit
                })
            }))
        }
        Err(e) => {
            error!("Failed to search foods: {}", e);
            Ok(json!({
                "statusCode": 500,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Internal Server Error",
                    "message": "Failed to search foods"
                })
            }))
        }
    }
}

// Nutrition plan handlers
pub async fn handle_create_nutrition_plan(
    user_id: &str,
    body: &str,
    nutrition_repo: &NutritionRepository,
) -> Result<Value> {
    let create_request: CreateNutritionPlanRequest = match serde_json::from_str(body) {
        Ok(request) => request,
        Err(e) => {
            error!("Failed to parse create nutrition plan request: {}", e);
            return Ok(json!({
                "statusCode": 400,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Bad Request",
                    "message": "Invalid JSON in request body",
                    "details": e.to_string()
                })
            }));
        }
    };

    // Validate the request
    if let Err(validation_errors) = create_request.validate() {
        error!("Validation failed for create nutrition plan request: {:?}", validation_errors);
        return Ok(json!({
            "statusCode": 400,
            "headers": get_cors_headers(),
            "body": json!({
                "error": "Validation Error",
                "message": "Invalid input data",
                "details": validation_errors.field_errors()
            })
        }));
    }

    let plan_id = Uuid::new_v4().to_string();
    let now = Utc::now();

    let plan = NutritionPlan {
        id: plan_id.clone(),
        user_id: user_id.to_string(),
        name: create_request.name,
        description: create_request.description,
        plan_type: create_request.plan_type,
        goal: create_request.goal,
        daily_calories: create_request.daily_calories,
        daily_protein: create_request.daily_protein,
        daily_carbs: create_request.daily_carbs,
        daily_fat: create_request.daily_fat,
        daily_fiber: create_request.daily_fiber,
        daily_sugar: create_request.daily_sugar,
        daily_sodium: create_request.daily_sodium,
        meal_plans: create_request.meal_plans,
        restrictions: create_request.restrictions.unwrap_or_default(),
        preferences: create_request.preferences.unwrap_or_default(),
        start_date: create_request.start_date,
        end_date: create_request.end_date,
        is_active: true,
        created_at: now,
        updated_at: now,
    };

    match nutrition_repo.create_nutrition_plan(&plan).await {
        Ok(created_plan) => {
            info!("Nutrition plan created successfully: {}", created_plan.id);
            Ok(json!({
                "statusCode": 201,
                "headers": get_cors_headers(),
                "body": json!({
                    "id": created_plan.id,
                    "user_id": created_plan.user_id,
                    "name": created_plan.name,
                    "plan_type": created_plan.plan_type,
                    "goal": created_plan.goal,
                    "daily_calories": created_plan.daily_calories,
                    "daily_protein": created_plan.daily_protein,
                    "daily_carbs": created_plan.daily_carbs,
                    "daily_fat": created_plan.daily_fat,
                    "start_date": created_plan.start_date,
                    "is_active": created_plan.is_active,
                    "created_at": created_plan.created_at,
                    "message": "Nutrition plan created successfully"
                })
            }))
        }
        Err(e) => {
            error!("Failed to create nutrition plan: {}", e);
            Ok(json!({
                "statusCode": 500,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Internal Server Error",
                    "message": "Failed to create nutrition plan"
                })
            }))
        }
    }
}

pub async fn handle_get_nutrition_plan(
    user_id: &str,
    plan_id: &str,
    nutrition_repo: &NutritionRepository,
) -> Result<Value> {
    match nutrition_repo.get_nutrition_plan_by_id(user_id, plan_id).await {
        Ok(Some(plan)) => {
            info!("Nutrition plan retrieved successfully: {}", plan.id);
            Ok(json!({
                "statusCode": 200,
                "headers": get_cors_headers(),
                "body": plan
            }))
        }
        Ok(None) => {
            warn!("Nutrition plan not found: {}", plan_id);
            Ok(json!({
                "statusCode": 404,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Not Found",
                    "message": "Nutrition plan not found"
                })
            }))
        }
        Err(e) => {
            error!("Failed to get nutrition plan: {}", e);
            Ok(json!({
                "statusCode": 500,
                "headers": get_cors_headers(),
                "body": json!({
                    "error": "Internal Server Error",
                    "message": "Failed to retrieve nutrition plan"
                })
            }))
        }
    }
}

pub fn get_cors_headers() -> serde_json::Map<String, Value> {
    let mut headers = serde_json::Map::new();
    headers.insert("Content-Type".to_string(), "application/json".into());
    headers.insert("Access-Control-Allow-Origin".to_string(), "*".into());
    headers.insert("Access-Control-Allow-Headers".to_string(), "Content-Type, Authorization".into());
    headers.insert("Access-Control-Allow-Methods".to_string(), "OPTIONS,POST,GET,PUT,DELETE".into());
    headers
}
