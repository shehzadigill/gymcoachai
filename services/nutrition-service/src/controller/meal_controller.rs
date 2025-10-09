use serde_json::{json, Value};
use anyhow::Result;
use tracing::error;

use crate::models::*;
use crate::service::MealService;
use crate::utils::{ResponseBuilder, DataHelper};
use auth_layer::AuthContext;

#[derive(Clone)]
pub struct MealController {
    meal_service: MealService,
}

impl MealController {
    pub fn new(meal_service: MealService) -> Self {
        Self { meal_service }
    }

    pub async fn create_meal(&self, user_id: &str, body: &str, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let create_request: Result<CreateMealRequest, _> = DataHelper::parse_json_to_type(body);
        
        match create_request {
            Ok(request) => {
                match self.meal_service.create_meal(user_id, &request, auth_context).await {
                    Ok(meal) => Ok(ResponseBuilder::created(json!({
                        "id": meal.id,
                        "user_id": meal.user_id,
                        "name": meal.name,
                        "meal_type": meal.meal_type,
                        "meal_date": meal.meal_date,
                        "total_calories": meal.total_calories,
                        "total_protein": meal.total_protein,
                        "total_carbs": meal.total_carbs,
                        "total_fat": meal.total_fat,
                        "created_at": meal.created_at,
                        "message": "Meal created successfully"
                    }))),
                    Err(e) => {
                        error!("Error creating meal: {}", e);
                        let msg = e.to_string();
                        if msg.contains("not found") {
                            Ok(ResponseBuilder::not_found(&msg))
                        } else if msg.contains("You can only") {
                            Ok(ResponseBuilder::forbidden(&msg))
                        } else {
                            Ok(ResponseBuilder::internal_server_error("Failed to create meal"))
                        }
                    }
                }
            }
            Err(_) => {
                error!("Error parsing create meal request");
                Ok(ResponseBuilder::bad_request("Invalid JSON in request body"))
            }
        }
    }

    pub async fn get_meal(&self, user_id: &str, meal_id: &str, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        match self.meal_service.get_meal(user_id, meal_id, auth_context).await {
            Ok(Some(meal)) => Ok(ResponseBuilder::ok(meal)),
            Ok(None) => Ok(ResponseBuilder::not_found("Meal not found")),
            Err(e) => {
                error!("Error fetching meal: {}", e);
                let msg = e.to_string();
                if msg.contains("You can only access") {
                    Ok(ResponseBuilder::forbidden(&msg))
                } else {
                    Ok(ResponseBuilder::internal_server_error("Failed to retrieve meal"))
                }
            }
        }
    }

    pub async fn get_meals_by_date(&self, user_id: &str, date: &str, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        match self.meal_service.get_meals_by_date(user_id, date, auth_context).await {
            Ok(meals) => Ok(ResponseBuilder::ok(json!({
                "meals": meals,
                "date": date,
                "count": meals.len()
            }))),
            Err(e) => {
                error!("Error fetching meals by date: {}", e);
                let msg = e.to_string();
                if msg.contains("You can only access") {
                    Ok(ResponseBuilder::forbidden(&msg))
                } else if msg.contains("Invalid date format") {
                    Ok(ResponseBuilder::bad_request(&msg))
                } else {
                    // Return empty meals array instead of error for better UX
                    Ok(ResponseBuilder::ok(json!({
                        "meals": [],
                        "date": date,
                        "count": 0
                    })))
                }
            }
        }
    }

    pub async fn get_user_meals(&self, user_id: &str, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        match self.meal_service.get_user_meals(user_id, auth_context).await {
            Ok(meals) => Ok(ResponseBuilder::ok(json!({
                "meals": meals,
                "count": meals.len()
            }))),
            Err(e) => {
                error!("Error fetching user meals: {}", e);
                let msg = e.to_string();
                if msg.contains("You can only access") {
                    Ok(ResponseBuilder::forbidden(&msg))
                } else {
                    Ok(ResponseBuilder::internal_server_error("Failed to retrieve user meals"))
                }
            }
        }
    }

    pub async fn update_meal(&self, user_id: &str, meal_id: &str, body: &str, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let update_request: Result<UpdateMealRequest, _> = DataHelper::parse_json_to_type(body);
        
        match update_request {
            Ok(request) => {
                match self.meal_service.update_meal(user_id, meal_id, &request, auth_context).await {
                    Ok(meal) => Ok(ResponseBuilder::ok(json!({
                        "id": meal.id,
                        "user_id": meal.user_id,
                        "name": meal.name,
                        "meal_type": meal.meal_type,
                        "meal_date": meal.meal_date,
                        "total_calories": meal.total_calories,
                        "total_protein": meal.total_protein,
                        "total_carbs": meal.total_carbs,
                        "total_fat": meal.total_fat,
                        "updated_at": meal.updated_at,
                        "message": "Meal updated successfully"
                    }))),
                    Err(e) => {
                        error!("Error updating meal: {}", e);
                        let msg = e.to_string();
                        if msg.contains("not found") {
                            Ok(ResponseBuilder::not_found(&msg))
                        } else if msg.contains("You can only") {
                            Ok(ResponseBuilder::forbidden(&msg))
                        } else {
                            Ok(ResponseBuilder::internal_server_error("Failed to update meal"))
                        }
                    }
                }
            }
            Err(_) => {
                error!("Error parsing update meal request");
                Ok(ResponseBuilder::bad_request("Invalid JSON in request body"))
            }
        }
    }

    pub async fn delete_meal(&self, user_id: &str, meal_id: &str, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        match self.meal_service.delete_meal(user_id, meal_id, auth_context).await {
            Ok(_) => Ok(ResponseBuilder::ok(json!({
                "id": meal_id,
                "message": "Meal deleted successfully"
            }))),
            Err(e) => {
                error!("Error deleting meal: {}", e);
                let msg = e.to_string();
                if msg.contains("not found") {
                    Ok(ResponseBuilder::not_found(&msg))
                } else if msg.contains("You can only") {
                    Ok(ResponseBuilder::forbidden(&msg))
                } else {
                    Ok(ResponseBuilder::internal_server_error("Failed to delete meal"))
                }
            }
        }
    }
}
