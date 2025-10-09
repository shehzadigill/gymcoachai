use serde_json::{json, Value};
use anyhow::Result;
use tracing::error;

use crate::service::WaterService;
use crate::utils::{ResponseBuilder, DataHelper};
use auth_layer::AuthContext;

#[derive(Clone)]
pub struct WaterController {
    water_service: WaterService,
}

impl WaterController {
    pub fn new(water_service: WaterService) -> Self {
        Self { water_service }
    }

    pub async fn get_water(&self, user_id: &str, date: &str, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        match self.water_service.get_water(user_id, date, auth_context).await {
            Ok(Some(glasses)) => Ok(ResponseBuilder::ok(json!({
                "date": date,
                "glasses": glasses
            }))),
            Ok(None) => Ok(ResponseBuilder::ok(json!({
                "date": date,
                "glasses": 0
            }))),
            Err(e) => {
                error!("Error fetching water intake: {}", e);
                let msg = e.to_string();
                if msg.contains("You can only access") {
                    Ok(ResponseBuilder::forbidden(&msg))
                } else {
                    Ok(ResponseBuilder::internal_server_error("Failed to get water intake"))
                }
            }
        }
    }

    pub async fn set_water(&self, user_id: &str, date: &str, body: &str, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let parsed: Result<Value, _> = DataHelper::parse_json_safe(body);
        let glasses = match parsed {
            Ok(json) => json.get("glasses")
                .and_then(|v| v.as_u64())
                .unwrap_or(0) as u32,
            Err(_) => 0,
        };

        match self.water_service.set_water(user_id, date, glasses, auth_context).await {
            Ok(_) => Ok(ResponseBuilder::ok(json!({
                "date": date,
                "glasses": glasses
            }))),
            Err(e) => {
                error!("Error setting water intake: {}", e);
                let msg = e.to_string();
                if msg.contains("You can only") {
                    Ok(ResponseBuilder::forbidden(&msg))
                } else {
                    Ok(ResponseBuilder::internal_server_error("Failed to set water intake"))
                }
            }
        }
    }
}
