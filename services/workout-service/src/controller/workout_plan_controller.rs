use serde_json::{json, Value};
use anyhow::Result;
use tracing::error;

use crate::service::WorkoutPlanService;
use crate::utils::{ResponseBuilder, DataHelper};
use auth_layer::AuthContext;

#[derive(Clone)]
pub struct WorkoutPlanController {
    workout_plan_service: WorkoutPlanService,
}

impl WorkoutPlanController {
    pub fn new(workout_plan_service: WorkoutPlanService) -> Self {
        Self { workout_plan_service }
    }

    pub async fn get_workout_plans(&self, user_id: Option<String>, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        match self.workout_plan_service.get_workout_plans(user_id, auth_context).await {
            Ok(plans) => Ok(ResponseBuilder::success(plans)),
            Err(e) => {
                error!("Failed to get workout plans: {}", e);
                Ok(ResponseBuilder::internal_server_error("Failed to retrieve workout plans"))
            }
        }
    }

    pub async fn create_workout_plan(&self, body: &str, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let parsed: Result<Value, _> = DataHelper::parse_json_safe(body);
        let plan_data = match parsed {
            Ok(json) => json,
            Err(e) => {
                error!("Failed to parse request body: {}", e);
                return Ok(ResponseBuilder::bad_request("Invalid JSON in request body"));
            }
        };

        match self.workout_plan_service.create_workout_plan(&plan_data, auth_context).await {
            Ok(plan) => Ok(ResponseBuilder::success(plan)),
            Err(e) => {
                error!("Failed to create workout plan: {}", e);
                Ok(ResponseBuilder::internal_server_error("Failed to create workout plan"))
            }
        }
    }

    pub async fn get_workout_plan(&self, user_id: &str, plan_id: &str, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        match self.workout_plan_service.get_workout_plan(user_id, plan_id, auth_context).await {
            Ok(plan) => Ok(ResponseBuilder::success(plan)),
            Err(e) => {
                error!("Failed to get workout plan: {}", e);
                Ok(ResponseBuilder::internal_server_error("Failed to retrieve workout plan"))
            }
        }
    }

    pub async fn update_workout_plan(&self, body: &str, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let parsed: Result<Value, _> = DataHelper::parse_json_safe(body);
        let plan_data = match parsed {
            Ok(json) => json,
            Err(e) => {
                error!("Failed to parse request body: {}", e);
                return Ok(ResponseBuilder::bad_request("Invalid JSON in request body"));
            }
        };

        match self.workout_plan_service.update_workout_plan(&plan_data, auth_context).await {
            Ok(plan) => Ok(ResponseBuilder::success(plan)),
            Err(e) => {
                error!("Failed to update workout plan: {}", e);
                Ok(ResponseBuilder::internal_server_error("Failed to update workout plan"))
            }
        }
    }

    pub async fn delete_workout_plan(&self, user_id: &str, plan_id: &str, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        match self.workout_plan_service.delete_workout_plan(user_id, plan_id, auth_context).await {
            Ok(_) => Ok(ResponseBuilder::success(json!({"message": "Workout plan deleted successfully"}))),
            Err(e) => {
                error!("Failed to delete workout plan: {}", e);
                Ok(ResponseBuilder::internal_server_error("Failed to delete workout plan"))
            }
        }
    }
}
