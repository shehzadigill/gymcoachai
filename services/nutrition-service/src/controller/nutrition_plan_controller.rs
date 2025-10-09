use serde_json::{json, Value};
use anyhow::Result;
use tracing::error;

use crate::models::*;
use crate::service::NutritionPlanService;
use crate::utils::{ResponseBuilder, DataHelper};
use auth_layer::AuthContext;

#[derive(Clone)]
pub struct NutritionPlanController {
    nutrition_plan_service: NutritionPlanService,
}

impl NutritionPlanController {
    pub fn new(nutrition_plan_service: NutritionPlanService) -> Self {
        Self { nutrition_plan_service }
    }

    pub async fn create_nutrition_plan(&self, user_id: &str, body: &str, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let create_request: Result<CreateNutritionPlanRequest, _> = DataHelper::parse_json_to_type(body);
        
        match create_request {
            Ok(request) => {
                match self.nutrition_plan_service.create_nutrition_plan(user_id, &request, auth_context).await {
                    Ok(plan) => Ok(ResponseBuilder::created(json!({
                        "id": plan.id,
                        "user_id": plan.user_id,
                        "name": plan.name,
                        "plan_type": plan.plan_type,
                        "goal": plan.goal,
                        "daily_calories": plan.daily_calories,
                        "daily_protein": plan.daily_protein,
                        "daily_carbs": plan.daily_carbs,
                        "daily_fat": plan.daily_fat,
                        "start_date": plan.start_date,
                        "is_active": plan.is_active,
                        "created_at": plan.created_at,
                        "message": "Nutrition plan created successfully"
                    }))),
                    Err(e) => {
                        error!("Error creating nutrition plan: {}", e);
                        let msg = e.to_string();
                        if msg.contains("You can only") {
                            Ok(ResponseBuilder::forbidden(&msg))
                        } else {
                            Ok(ResponseBuilder::internal_server_error("Failed to create nutrition plan"))
                        }
                    }
                }
            }
            Err(_) => {
                error!("Error parsing create nutrition plan request");
                Ok(ResponseBuilder::bad_request("Invalid JSON in request body"))
            }
        }
    }

    pub async fn get_nutrition_plan(&self, user_id: &str, plan_id: &str, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        match self.nutrition_plan_service.get_nutrition_plan(user_id, plan_id, auth_context).await {
            Ok(Some(plan)) => Ok(ResponseBuilder::ok(plan)),
            Ok(None) => Ok(ResponseBuilder::not_found("Nutrition plan not found")),
            Err(e) => {
                error!("Error fetching nutrition plan: {}", e);
                let msg = e.to_string();
                if msg.contains("You can only access") {
                    Ok(ResponseBuilder::forbidden(&msg))
                } else {
                    Ok(ResponseBuilder::internal_server_error("Failed to retrieve nutrition plan"))
                }
            }
        }
    }
}
