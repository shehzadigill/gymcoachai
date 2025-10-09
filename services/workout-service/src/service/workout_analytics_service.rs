use anyhow::Result;
use tracing::{info, error};

use crate::repository::WorkoutAnalyticsRepository;
use crate::models::*;
use auth_layer::AuthContext;

#[derive(Clone)]
pub struct WorkoutAnalyticsService {
    workout_analytics_repository: WorkoutAnalyticsRepository,
}

impl WorkoutAnalyticsService {
    pub fn new(workout_analytics_repository: WorkoutAnalyticsRepository) -> Self {
        Self { workout_analytics_repository }
    }

    pub async fn get_workout_analytics(&self, user_id: Option<String>, auth_context: &AuthContext) -> Result<serde_json::Value, Box<dyn std::error::Error + Send + Sync>> {
        // Authorization check
        if let Some(ref uid) = user_id {
            if auth_context.user_id != *uid {
                return Err(anyhow::anyhow!("You can only access your own workout analytics").into());
            }
        }

        self.workout_analytics_repository.get_workout_analytics(user_id).await
    }

    pub async fn get_workout_insights(&self, user_id: &str, time_range: &str, auth_context: &AuthContext) -> Result<serde_json::Value, Box<dyn std::error::Error + Send + Sync>> {
        // Authorization check
        if auth_context.user_id != user_id {
            return Err(anyhow::anyhow!("You can only access your own workout insights").into());
        }

        self.workout_analytics_repository.get_workout_insights(user_id, time_range).await
    }

    pub async fn get_workout_history(&self, user_id: &str, limit: Option<i32>, auth_context: &AuthContext) -> Result<serde_json::Value, Box<dyn std::error::Error + Send + Sync>> {
        // Authorization check
        if auth_context.user_id != user_id {
            return Err(anyhow::anyhow!("You can only access your own workout history").into());
        }

        self.workout_analytics_repository.get_workout_history(user_id, limit).await
    }
}
