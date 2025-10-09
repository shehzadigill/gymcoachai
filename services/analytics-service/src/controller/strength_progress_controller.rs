use serde_json::Value;
use anyhow::Result;

use crate::service::StrengthProgressService;
use crate::utils::ResponseBuilder;

pub struct StrengthProgressController {
    service: StrengthProgressService,
}

impl StrengthProgressController {
    pub fn new(service: StrengthProgressService) -> Self {
        Self { service }
    }

    pub async fn get_strength_progress(
        &self,
        user_id: &str,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<Value> {
        if user_id.is_empty() {
            return Ok(ResponseBuilder::bad_request("User ID is required"));
        }

        match self.service.get_strength_progress(user_id, start_date, end_date).await {
            Ok(progress) => Ok(ResponseBuilder::ok(progress)),
            Err(e) => Ok(ResponseBuilder::internal_server_error(&format!("Failed to retrieve strength progress: {}", e))),
        }
    }

    pub async fn create_strength_progress(
        &self,
        body: &str,
    ) -> Result<Value> {
        let body: Value = serde_json::from_str(body)?;
        
        let user_id = body["userId"].as_str().unwrap_or("").to_string();
        let exercise_id = body["exerciseId"].as_str().unwrap_or("").to_string();
        let exercise_name = body["exerciseName"].as_str().unwrap_or("").to_string();
        let current_max_weight = body["currentMaxWeight"].as_f64().unwrap_or(0.0) as f32;
        let previous_max_weight = body["previousMaxWeight"].as_f64().unwrap_or(0.0) as f32;
        let period = body["period"].as_str().map(|s| s.to_string());

        if user_id.is_empty() || exercise_id.is_empty() || exercise_name.is_empty() {
            return Ok(ResponseBuilder::bad_request("User ID, exercise ID, and exercise name are required"));
        }

        match self.service.create_strength_progress(
            user_id,
            exercise_id,
            exercise_name,
            current_max_weight,
            previous_max_weight,
            period,
        ).await {
            Ok(progress) => Ok(ResponseBuilder::created(progress)),
            Err(e) => Ok(ResponseBuilder::internal_server_error(&format!("Failed to create strength progress: {}", e))),
        }
    }
}
