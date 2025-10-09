use serde_json::Value;
use anyhow::Result;

use crate::service::AchievementService;
use crate::utils::ResponseBuilder;

pub struct AchievementController {
    service: AchievementService,
}

impl AchievementController {
    pub fn new(service: AchievementService) -> Self {
        Self { service }
    }

    pub async fn get_achievements(&self, user_id: &str) -> Result<Value> {
        if user_id.is_empty() {
            return Ok(ResponseBuilder::bad_request("User ID is required"));
        }

        match self.service.get_achievements(user_id).await {
            Ok(achievements) => Ok(ResponseBuilder::ok(achievements)),
            Err(e) => Ok(ResponseBuilder::internal_server_error(&format!("Failed to retrieve achievements: {}", e))),
        }
    }

    pub async fn create_achievement(
        &self,
        body: &str,
    ) -> Result<Value> {
        let body: Value = serde_json::from_str(body)?;
        
        let user_id = body["userId"].as_str().unwrap_or("").to_string();
        let achievement_type = body["achievementType"].as_str().unwrap_or("milestone").to_string();
        let title = body["title"].as_str().unwrap_or("New Achievement").to_string();
        let description = body["description"].as_str().unwrap_or("").to_string();
        let icon = body["icon"].as_str().map(|s| s.to_string());
        let category = body["category"].as_str().map(|s| s.to_string());
        let rarity = body["rarity"].as_str().map(|s| s.to_string());
        let points = body["points"].as_u64().map(|v| v as i32);

        if user_id.is_empty() {
            return Ok(ResponseBuilder::bad_request("User ID is required"));
        }

        match self.service.create_achievement(
            user_id,
            achievement_type,
            title,
            description,
            icon,
            category,
            rarity,
            points,
        ).await {
            Ok(achievement) => Ok(ResponseBuilder::created(achievement)),
            Err(e) => Ok(ResponseBuilder::internal_server_error(&format!("Failed to create achievement: {}", e))),
        }
    }
}
