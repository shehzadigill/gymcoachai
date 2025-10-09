use serde_json::Value;
use anyhow::Result;
use tracing::error;

use crate::models::*;
use crate::service::SleepService;
use crate::utils::{ResponseBuilder, DataHelper, get_current_date};
use auth_layer::AuthContext;

#[derive(Clone)]
pub struct SleepController {
    sleep_service: SleepService,
}

impl SleepController {
    pub fn new(sleep_service: SleepService) -> Self {
        Self {
            sleep_service,
        }
    }

    pub async fn get_sleep_data(&self, query_params: &std::collections::HashMap<String, String>, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let user_id = query_params.get("userId")
            .map(|s| s.as_str())
            .unwrap_or(&auth_context.user_id);

        let current_date = get_current_date();
        let date = query_params.get("date")
            .map(|s| s.as_str())
            .unwrap_or(&current_date);

        match self.sleep_service.get_sleep_data(user_id, date, auth_context).await {
            Ok(Some(sleep_data)) => Ok(ResponseBuilder::ok(sleep_data)),
            Ok(None) => Ok(ResponseBuilder::not_found("No sleep data found for this date")),
            Err(e) => {
                error!("Error fetching sleep data: {}", e);
                let msg = e.to_string();
                if msg.contains("You can only access") {
                    Ok(ResponseBuilder::forbidden(&msg))
                } else {
                    Ok(ResponseBuilder::internal_server_error("Failed to fetch sleep data"))
                }
            }
        }
    }

    pub async fn save_sleep_data(&self, body: &str, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let sleep_data: SleepData = DataHelper::parse_json_to_type(body)?;

        match self.sleep_service.save_sleep_data(sleep_data, auth_context).await {
            Ok(saved_data) => Ok(ResponseBuilder::created(saved_data)),
            Err(e) => {
                error!("Error saving sleep data: {}", e);
                let msg = e.to_string();
                if msg.contains("Invalid sleep data") {
                    Ok(ResponseBuilder::validation_error(&msg, None))
                } else {
                    Ok(ResponseBuilder::internal_server_error("Failed to save sleep data"))
                }
            }
        }
    }

    pub async fn update_sleep_data(&self, body: &str, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let sleep_data: SleepData = DataHelper::parse_json_to_type(body)?;

        match self.sleep_service.update_sleep_data(sleep_data, auth_context).await {
            Ok(updated_data) => Ok(ResponseBuilder::ok(updated_data)),
            Err(e) => {
                error!("Error updating sleep data: {}", e);
                let msg = e.to_string();
                if msg.contains("Invalid sleep data") {
                    Ok(ResponseBuilder::validation_error(&msg, None))
                } else if msg.contains("No sleep data found") {
                    Ok(ResponseBuilder::not_found(&msg))
                } else {
                    Ok(ResponseBuilder::internal_server_error("Failed to update sleep data"))
                }
            }
        }
    }

    pub async fn get_sleep_history(&self, query_params: &std::collections::HashMap<String, String>, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let user_id = query_params.get("userId")
            .map(|s| s.as_str())
            .unwrap_or(&auth_context.user_id);

        let days = query_params.get("days")
            .and_then(|s| s.parse::<u32>().ok())
            .unwrap_or(7);

        match self.sleep_service.get_sleep_history(user_id, days, auth_context).await {
            Ok(sleep_history) => Ok(ResponseBuilder::ok(sleep_history)),
            Err(e) => {
                error!("Error fetching sleep history: {}", e);
                let msg = e.to_string();
                if msg.contains("You can only access") {
                    Ok(ResponseBuilder::forbidden(&msg))
                } else {
                    Ok(ResponseBuilder::internal_server_error("Failed to fetch sleep history"))
                }
            }
        }
    }

    pub async fn get_sleep_stats(&self, query_params: &std::collections::HashMap<String, String>, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let user_id = query_params.get("userId")
            .map(|s| s.as_str())
            .unwrap_or(&auth_context.user_id);

        let period = query_params.get("period")
            .map(|s| s.as_str())
            .unwrap_or("month");

        match self.sleep_service.get_sleep_stats(user_id, period, auth_context).await {
            Ok(sleep_stats) => Ok(ResponseBuilder::ok(sleep_stats)),
            Err(e) => {
                error!("Error calculating sleep stats: {}", e);
                let msg = e.to_string();
                if msg.contains("You can only access") {
                    Ok(ResponseBuilder::forbidden(&msg))
                } else {
                    Ok(ResponseBuilder::internal_server_error("Failed to calculate sleep statistics"))
                }
            }
        }
    }

}
