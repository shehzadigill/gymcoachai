use serde_json::Value;
use anyhow::Result;

use crate::service::MilestoneService;
use crate::utils::ResponseBuilder;

pub struct MilestoneController {
    service: MilestoneService,
}

impl MilestoneController {
    pub fn new(service: MilestoneService) -> Self {
        Self { service }
    }

    pub async fn get_milestones(&self, user_id: &str) -> Result<Value> {
        if user_id.is_empty() {
            return Ok(ResponseBuilder::bad_request("User ID is required"));
        }

        match self.service.get_milestones(user_id).await {
            Ok(milestones) => Ok(ResponseBuilder::ok(milestones)),
            Err(e) => Ok(ResponseBuilder::internal_server_error(&format!("Failed to retrieve milestones: {}", e))),
        }
    }

    pub async fn create_milestone(
        &self,
        body: &str,
    ) -> Result<Value> {
        let body: Value = serde_json::from_str(body)?;
        
        let user_id = body["userId"].as_str().unwrap_or("").to_string();
        let milestone_type = body["milestoneType"].as_str().unwrap_or("").to_string();
        let title = body["title"].as_str().unwrap_or("").to_string();
        let description = body["description"].as_str().unwrap_or("").to_string();
        let target_value = body["targetValue"].as_f64().unwrap_or(0.0) as f32;
        let current_value = body["currentValue"].as_f64().map(|v| v as f32);
        let unit = body["unit"].as_str().map(|s| s.to_string());
        let target_date = body["targetDate"].as_str().map(|s| s.to_string());

        if user_id.is_empty() || milestone_type.is_empty() || title.is_empty() {
            return Ok(ResponseBuilder::bad_request("User ID, milestone type, and title are required"));
        }

        match self.service.create_milestone(
            user_id,
            milestone_type,
            title,
            description,
            target_value,
            current_value,
            unit,
            target_date,
        ).await {
            Ok(milestone) => Ok(ResponseBuilder::created(milestone)),
            Err(e) => Ok(ResponseBuilder::internal_server_error(&format!("Failed to create milestone: {}", e))),
        }
    }
}
