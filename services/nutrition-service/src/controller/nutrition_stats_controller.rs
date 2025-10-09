use serde_json::Value;
use anyhow::Result;
use tracing::error;

use crate::service::NutritionStatsService;
use crate::utils::ResponseBuilder;
use auth_layer::AuthContext;

#[derive(Clone)]
pub struct NutritionStatsController {
    nutrition_stats_service: NutritionStatsService,
}

impl NutritionStatsController {
    pub fn new(nutrition_stats_service: NutritionStatsService) -> Self {
        Self { nutrition_stats_service }
    }

    pub async fn get_nutrition_stats(&self, user_id: &str, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        match self.nutrition_stats_service.get_nutrition_stats(user_id, auth_context).await {
            Ok(stats) => Ok(ResponseBuilder::ok(stats)),
            Err(e) => {
                error!("Error fetching nutrition stats: {}", e);
                let msg = e.to_string();
                if msg.contains("You can only access") {
                    Ok(ResponseBuilder::forbidden(&msg))
                } else {
                    Ok(ResponseBuilder::internal_server_error("Failed to get nutrition statistics"))
                }
            }
        }
    }
}
