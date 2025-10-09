use serde_json::Value;
use anyhow::Result;

use crate::service::AnalyticsService;
use crate::utils::ResponseBuilder;

pub struct WorkoutAnalyticsController {
    service: AnalyticsService,
}

impl WorkoutAnalyticsController {
    pub fn new(service: AnalyticsService) -> Self {
        Self { service }
    }

    pub async fn get_workout_analytics(
        &self,
        user_id: &str,
        period: Option<&str>,
    ) -> Result<Value> {
        if user_id.is_empty() {
            return Ok(ResponseBuilder::bad_request("User ID is required"));
        }

        let period = period.unwrap_or("month");
        match self.service.get_workout_analytics(user_id, period).await {
            Ok(analytics) => Ok(ResponseBuilder::ok(analytics)),
            Err(e) => Ok(ResponseBuilder::internal_server_error(&format!("Failed to retrieve workout analytics: {}", e))),
        }
    }

    pub async fn get_workout_insights(
        &self,
        user_id: &str,
        period: Option<&str>,
    ) -> Result<Value> {
        if user_id.is_empty() {
            return Ok(ResponseBuilder::bad_request("User ID is required"));
        }

        let period = period.unwrap_or("month");
        match self.service.get_workout_insights(user_id, period).await {
            Ok(insights) => Ok(ResponseBuilder::ok(insights)),
            Err(e) => Ok(ResponseBuilder::internal_server_error(&format!("Failed to retrieve workout insights: {}", e))),
        }
    }
}
