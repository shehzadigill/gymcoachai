use validator::Validate;
use anyhow::Result;
use tracing::{info, error};
use uuid::Uuid;
use chrono::Utc;

use crate::models::*;
use crate::repository::{MealRepository, FoodRepository};
use auth_layer::AuthContext;

#[derive(Clone)]
pub struct MealService {
    meal_repository: MealRepository,
    food_repository: FoodRepository,
}

impl MealService {
    pub fn new(meal_repository: MealRepository, food_repository: FoodRepository) -> Self {
        Self {
            meal_repository,
            food_repository,
        }
    }

    pub async fn create_meal(&self, user_id: &str, create_request: &CreateMealRequest, auth_context: &AuthContext) -> Result<Meal> {
        // Validate the request
        create_request.validate()?;

        // Create meal ID
        let meal_id = Uuid::new_v4().to_string();
        let now = Utc::now();

        // Calculate nutrition totals from foods or custom nutrition
        let mut total_calories = 0.0;
        let mut total_protein = 0.0;
        let mut total_carbs = 0.0;
        let mut total_fat = 0.0;
        let mut total_fiber = 0.0;
        let mut total_sugar = 0.0;
        let mut total_sodium = 0.0;

        let mut foods = Vec::new();
        
        // If foods array is empty but custom_nutrition is provided, use custom values
        if create_request.foods.is_empty() {
            if let Some(custom_nutrition) = &create_request.custom_nutrition {
                total_calories = custom_nutrition.calories;
                total_protein = custom_nutrition.protein;
                total_carbs = custom_nutrition.total_carbs;
                total_fat = custom_nutrition.total_fat;
                total_fiber = custom_nutrition.dietary_fiber;
                total_sugar = custom_nutrition.total_sugars;
                total_sodium = custom_nutrition.sodium;
                
                info!("Using custom nutrition values: calories={}, protein={}, carbs={}, fat={}", 
                    total_calories, total_protein, total_carbs, total_fat);
            }
        } else {
            // Calculate totals from foods
            for food_request in &create_request.foods {
                // Get food details from database
                match self.food_repository.get_food_by_id(&food_request.food_id).await {
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
                            total_carbs: food.nutrition_facts.total_carbs * multiplier,
                            total_fat: food.nutrition_facts.total_fat * multiplier,
                            dietary_fiber: food.nutrition_facts.dietary_fiber * multiplier,
                            total_sugars: food.nutrition_facts.total_sugars * multiplier,
                            sodium: food.nutrition_facts.sodium * multiplier,
                            barcode: food.barcode.clone(),
                            nutrition_facts: Some(food.nutrition_facts.clone()),
                        };

                        total_calories += food_item.calories;
                        total_protein += food_item.protein;
                        total_carbs += food_item.total_carbs;
                        total_fat += food_item.total_fat;
                        total_fiber += food_item.dietary_fiber;
                        total_sugar += food_item.total_sugars;
                        total_sodium += food_item.sodium;

                        foods.push(food_item);
                    }
                    Ok(None) => {
                        return Err(anyhow::anyhow!("Food with ID {} not found", food_request.food_id));
                    }
                    Err(e) => {
                        error!("Failed to get food: {}", e);
                        return Err(anyhow::anyhow!("Failed to retrieve food information: {}", e));
                    }
                }
            }
        }

        let meal = Meal {
            id: meal_id.clone(),
            user_id: user_id.to_string(),
            name: create_request.name.clone(),
            description: create_request.description.clone(),
            meal_type: create_request.meal_type.clone(),
            meal_date: create_request.meal_date,
            meal_time: create_request.meal_time,
            total_calories,
            total_protein,
            total_carbs,
            total_fat,
            dietary_fiber: total_fiber,
            total_sugars: total_sugar,
            sodium: total_sodium,
            foods,
            notes: create_request.notes.clone(),
            created_at: now,
            updated_at: now,
        };

        self.meal_repository.create_meal(&meal).await
    }

    pub async fn get_meal(&self, user_id: &str, meal_id: &str, auth_context: &AuthContext) -> Result<Option<Meal>> {
        // Authorization check
        if auth_context.user_id != user_id {
            return Err(anyhow::anyhow!("You can only access your own meals"));
        }

        self.meal_repository.get_meal_by_id(user_id, meal_id).await
    }

    pub async fn get_meals_by_date(&self, user_id: &str, date: &str, auth_context: &AuthContext) -> Result<Vec<Meal>> {
        // Authorization check
        if auth_context.user_id != user_id {
            return Err(anyhow::anyhow!("You can only access your own meals"));
        }

        let meal_date = if date.contains('T') || date.contains('Z') {
            // Try parsing as ISO 8601 format
            match chrono::DateTime::parse_from_rfc3339(date) {
                Ok(dt) => dt.with_timezone(&Utc),
                Err(e) => {
                    error!("Invalid ISO 8601 date format: {}", e);
                    return Err(anyhow::anyhow!("Invalid date format. Use ISO 8601 format or YYYY-MM-DD"));
                }
            }
        } else {
            // Try parsing as YYYY-MM-DD format
            match chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d") {
                Ok(naive_date) => {
                    // Convert to UTC datetime at start of day
                    naive_date.and_hms_opt(0, 0, 0).unwrap().and_utc()
                }
                Err(e) => {
                    error!("Invalid date format: {}", e);
                    return Err(anyhow::anyhow!("Invalid date format. Use ISO 8601 format or YYYY-MM-DD"));
                }
            }
        };

        self.meal_repository.get_meals_by_date(user_id, &meal_date).await
    }

    pub async fn get_user_meals(&self, user_id: &str, auth_context: &AuthContext) -> Result<Vec<Meal>> {
        // Authorization check
        if auth_context.user_id != user_id {
            return Err(anyhow::anyhow!("You can only access your own meals"));
        }

        self.meal_repository.get_user_meals(user_id).await
    }

    pub async fn update_meal(&self, user_id: &str, meal_id: &str, updates: &UpdateMealRequest, auth_context: &AuthContext) -> Result<Meal> {
        // Authorization check
        if auth_context.user_id != user_id {
            return Err(anyhow::anyhow!("You can only update your own meals"));
        }

        // Validate the request
        updates.validate()?;

        // Check if meal exists
        match self.meal_repository.get_meal_by_id(user_id, meal_id).await {
            Ok(Some(_)) => {
                // Meal exists, proceed with update
            }
            Ok(None) => {
                return Err(anyhow::anyhow!("Meal not found"));
            }
            Err(e) => {
                error!("Failed to check meal existence: {}", e);
                return Err(anyhow::anyhow!("Failed to check meal existence: {}", e));
            }
        }

        self.meal_repository.update_meal(user_id, meal_id, updates).await
    }

    pub async fn delete_meal(&self, user_id: &str, meal_id: &str, auth_context: &AuthContext) -> Result<()> {
        // Authorization check
        if auth_context.user_id != user_id {
            return Err(anyhow::anyhow!("You can only delete your own meals"));
        }

        // Check if meal exists
        match self.meal_repository.get_meal_by_id(user_id, meal_id).await {
            Ok(Some(_)) => {
                // Meal exists, proceed with deletion
            }
            Ok(None) => {
                return Err(anyhow::anyhow!("Meal not found"));
            }
            Err(e) => {
                error!("Failed to check meal existence: {}", e);
                return Err(anyhow::anyhow!("Failed to check meal existence: {}", e));
            }
        }

        self.meal_repository.delete_meal(user_id, meal_id).await
    }
}
