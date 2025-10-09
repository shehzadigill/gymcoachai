use serde_json::{json, Value};
use anyhow::Result;
use tracing::error;

use crate::service::WorkoutAnalyticsService;
use crate::utils::ResponseBuilder;
use auth_layer::AuthContext;

#[derive(Clone)]
pub struct WorkoutAnalyticsController {
    workout_analytics_service: WorkoutAnalyticsService,
}

impl WorkoutAnalyticsController {
    pub fn new(workout_analytics_service: WorkoutAnalyticsService) -> Self {
        Self { workout_analytics_service }
    }

    pub async fn get_workout_analytics(&self, user_id: Option<String>, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        match self.workout_analytics_service.get_workout_analytics(user_id, auth_context).await {
            Ok(analytics) => Ok(ResponseBuilder::success(analytics)),
            Err(e) => {
                error!("Failed to get workout analytics: {}", e);
                Ok(ResponseBuilder::internal_server_error("Failed to retrieve workout analytics"))
            }
        }
    }

    pub async fn get_workout_insights(&self, user_id: &str, time_range: &str, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        match self.workout_analytics_service.get_workout_insights(user_id, time_range, auth_context).await {
            Ok(insights) => Ok(ResponseBuilder::success(insights)),
            Err(e) => {
                error!("Failed to get workout insights: {}", e);
                Ok(ResponseBuilder::internal_server_error("Failed to retrieve workout insights"))
            }
        }
    }

    pub async fn get_workout_history(&self, user_id: &str, limit: Option<i32>, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        match self.workout_analytics_service.get_workout_history(user_id, limit, auth_context).await {
            Ok(history) => Ok(ResponseBuilder::success(history)),
            Err(e) => {
                error!("Failed to get workout history: {}", e);
                Ok(ResponseBuilder::internal_server_error("Failed to retrieve workout history"))
            }
        }
    }
}
