use serde_json::{json, Value};
use anyhow::Result;
use tracing::error;

use crate::service::WorkoutSessionService;
use crate::utils::{ResponseBuilder, DataHelper};
use auth_layer::AuthContext;

#[derive(Clone)]
pub struct WorkoutSessionController {
    workout_session_service: WorkoutSessionService,
}

impl WorkoutSessionController {
    pub fn new(workout_session_service: WorkoutSessionService) -> Self {
        Self { workout_session_service }
    }

    pub async fn get_workout_sessions(&self, user_id: Option<String>, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        match self.workout_session_service.get_workout_sessions(user_id, auth_context).await {
            Ok(sessions) => Ok(ResponseBuilder::success(sessions)),
            Err(e) => {
                error!("Failed to get workout sessions: {}", e);
                Ok(ResponseBuilder::internal_server_error("Failed to retrieve workout sessions"))
            }
        }
    }

    pub async fn create_workout_session(&self, body: &str, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let parsed: Result<Value, _> = DataHelper::parse_json_safe(body);
        let session_data = match parsed {
            Ok(json) => json,
            Err(e) => {
                error!("Failed to parse request body: {}", e);
                return Ok(ResponseBuilder::bad_request("Invalid JSON in request body"));
            }
        };

        match self.workout_session_service.create_workout_session(&session_data, auth_context).await {
            Ok(session) => Ok(ResponseBuilder::success(session)),
            Err(e) => {
                error!("Failed to create workout session: {}", e);
                Ok(ResponseBuilder::internal_server_error("Failed to create workout session"))
            }
        }
    }

    pub async fn get_workout_session(&self, session_id: &str, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        match self.workout_session_service.get_workout_session(session_id, auth_context).await {
            Ok(session) => Ok(ResponseBuilder::success(session)),
            Err(e) => {
                error!("Failed to get workout session: {}", e);
                Ok(ResponseBuilder::internal_server_error("Failed to retrieve workout session"))
            }
        }
    }

    pub async fn update_workout_session(&self, body: &str, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let parsed: Result<Value, _> = DataHelper::parse_json_safe(body);
        let session_data = match parsed {
            Ok(json) => json,
            Err(e) => {
                error!("Failed to parse request body: {}", e);
                return Ok(ResponseBuilder::bad_request("Invalid JSON in request body"));
            }
        };

        match self.workout_session_service.update_workout_session(&session_data, auth_context).await {
            Ok(session) => Ok(ResponseBuilder::success(session)),
            Err(e) => {
                error!("Failed to update workout session: {}", e);
                Ok(ResponseBuilder::internal_server_error("Failed to update workout session"))
            }
        }
    }

    pub async fn delete_workout_session(&self, session_id: &str, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        match self.workout_session_service.delete_workout_session(session_id, auth_context).await {
            Ok(_) => Ok(ResponseBuilder::success(json!({"message": "Workout session deleted successfully"}))),
            Err(e) => {
                error!("Failed to delete workout session: {}", e);
                Ok(ResponseBuilder::internal_server_error("Failed to delete workout session"))
            }
        }
    }
}
