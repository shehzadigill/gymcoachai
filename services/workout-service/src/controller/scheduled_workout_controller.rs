use serde_json::{json, Value};
use anyhow::Result;
use tracing::error;

use crate::service::ScheduledWorkoutService;
use crate::utils::{ResponseBuilder, DataHelper};
use auth_layer::AuthContext;

#[derive(Clone)]
pub struct ScheduledWorkoutController {
    scheduled_workout_service: ScheduledWorkoutService,
}

impl ScheduledWorkoutController {
    pub fn new(scheduled_workout_service: ScheduledWorkoutService) -> Self {
        Self { scheduled_workout_service }
    }

    pub async fn create_scheduled_workout(&self, body: &str, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let parsed: Result<Value, _> = DataHelper::parse_json_safe(body);
        let schedule_data = match parsed {
            Ok(json) => json,
            Err(e) => {
                error!("Failed to parse request body: {}", e);
                return Ok(ResponseBuilder::bad_request("Invalid JSON in request body"));
            }
        };

        match self.scheduled_workout_service.create_scheduled_workout(&schedule_data, auth_context).await {
            Ok(schedule) => Ok(ResponseBuilder::success(schedule)),
            Err(e) => {
                error!("Failed to create scheduled workout: {}", e);
                Ok(ResponseBuilder::internal_server_error("Failed to create scheduled workout"))
            }
        }
    }

    pub async fn get_scheduled_workouts(&self, user_id: Option<String>, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        match self.scheduled_workout_service.get_scheduled_workouts(user_id, auth_context).await {
            Ok(schedules) => Ok(ResponseBuilder::success(schedules)),
            Err(e) => {
                error!("Failed to get scheduled workouts: {}", e);
                Ok(ResponseBuilder::internal_server_error("Failed to retrieve scheduled workouts"))
            }
        }
    }

    pub async fn update_scheduled_workout(&self, body: &str, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let parsed: Result<Value, _> = DataHelper::parse_json_safe(body);
        let schedule_data = match parsed {
            Ok(json) => json,
            Err(e) => {
                error!("Failed to parse request body: {}", e);
                return Ok(ResponseBuilder::bad_request("Invalid JSON in request body"));
            }
        };

        match self.scheduled_workout_service.update_scheduled_workout(&schedule_data, auth_context).await {
            Ok(schedule) => Ok(ResponseBuilder::success(schedule)),
            Err(e) => {
                error!("Failed to update scheduled workout: {}", e);
                Ok(ResponseBuilder::internal_server_error("Failed to update scheduled workout"))
            }
        }
    }

    pub async fn delete_scheduled_workout(&self, user_id: &str, schedule_id: &str, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        match self.scheduled_workout_service.delete_scheduled_workout(user_id, schedule_id, auth_context).await {
            Ok(result) => Ok(ResponseBuilder::success(result)),
            Err(e) => {
                error!("Failed to delete scheduled workout: {}", e);
                Ok(ResponseBuilder::internal_server_error("Failed to delete scheduled workout"))
            }
        }
    }
}
