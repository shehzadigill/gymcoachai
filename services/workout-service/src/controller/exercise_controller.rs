use serde_json::{json, Value};
use anyhow::Result;
use tracing::error;

use crate::service::ExerciseService;
use crate::utils::{ResponseBuilder, DataHelper};
use auth_layer::AuthContext;

#[derive(Clone)]
pub struct ExerciseController {
    exercise_service: ExerciseService,
}

impl ExerciseController {
    pub fn new(exercise_service: ExerciseService) -> Self {
        Self { exercise_service }
    }

    pub async fn get_exercises(&self, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        match self.exercise_service.get_exercises(auth_context).await {
            Ok(exercises) => Ok(ResponseBuilder::success(exercises)),
            Err(e) => {
                error!("Failed to get exercises: {}", e);
                Ok(ResponseBuilder::internal_server_error("Failed to retrieve exercises"))
            }
        }
    }

    pub async fn get_exercises_with_user(&self, user_id: Option<String>, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        match self.exercise_service.get_exercises_with_user(user_id, auth_context).await {
            Ok(exercises) => Ok(ResponseBuilder::success(exercises)),
            Err(e) => {
                error!("Failed to get exercises with user: {}", e);
                Ok(ResponseBuilder::internal_server_error("Failed to retrieve exercises"))
            }
        }
    }

    pub async fn create_exercise(&self, body: &str, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let parsed: Result<Value, _> = DataHelper::parse_json_safe(body);
        let exercise_data = match parsed {
            Ok(json) => json,
            Err(e) => {
                error!("Failed to parse request body: {}", e);
                return Ok(ResponseBuilder::bad_request("Invalid JSON in request body"));
            }
        };

        match self.exercise_service.create_exercise(&exercise_data, auth_context).await {
            Ok(exercise) => Ok(ResponseBuilder::success(exercise)),
            Err(e) => {
                error!("Failed to create exercise: {}", e);
                Ok(ResponseBuilder::internal_server_error("Failed to create exercise"))
            }
        }
    }

    pub async fn get_exercise(&self, exercise_id: &str, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        match self.exercise_service.get_exercise(exercise_id, auth_context).await {
            Ok(exercise) => Ok(ResponseBuilder::success(exercise)),
            Err(e) => {
                error!("Failed to get exercise: {}", e);
                Ok(ResponseBuilder::internal_server_error("Failed to retrieve exercise"))
            }
        }
    }

    pub async fn update_exercise(&self, body: &str, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let parsed: Result<Value, _> = DataHelper::parse_json_safe(body);
        let exercise_data = match parsed {
            Ok(json) => json,
            Err(e) => {
                error!("Failed to parse request body: {}", e);
                return Ok(ResponseBuilder::bad_request("Invalid JSON in request body"));
            }
        };

        match self.exercise_service.update_exercise(&exercise_data, auth_context).await {
            Ok(exercise) => Ok(ResponseBuilder::success(exercise)),
            Err(e) => {
                error!("Failed to update exercise: {}", e);
                Ok(ResponseBuilder::internal_server_error("Failed to update exercise"))
            }
        }
    }

    pub async fn clone_exercise(&self, exercise_id: &str, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        match self.exercise_service.clone_exercise(exercise_id, auth_context).await {
            Ok(exercise) => Ok(ResponseBuilder::success(exercise)),
            Err(e) => {
                error!("Failed to clone exercise: {}", e);
                Ok(ResponseBuilder::internal_server_error("Failed to clone exercise"))
            }
        }
    }

    pub async fn delete_exercise(&self, exercise_id: &str, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        match self.exercise_service.delete_exercise(exercise_id, auth_context).await {
            Ok(_) => Ok(ResponseBuilder::success(json!({"message": "Exercise deleted successfully"}))),
            Err(e) => {
                error!("Failed to delete exercise: {}", e);
                Ok(ResponseBuilder::internal_server_error("Failed to delete exercise"))
            }
        }
    }
}
