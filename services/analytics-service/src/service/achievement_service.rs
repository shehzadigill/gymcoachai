use anyhow::Result;
use chrono::Utc;
use uuid::Uuid;

use crate::models::Achievement;
use crate::repository::AchievementRepository;

pub struct AchievementService {
    repository: AchievementRepository,
}

impl AchievementService {
    pub fn new(repository: AchievementRepository) -> Self {
        Self { repository }
    }

    pub async fn get_achievements(&self, user_id: &str) -> Result<Vec<Achievement>> {
        self.repository.get_achievements(user_id).await
    }

    pub async fn create_achievement(
        &self,
        user_id: String,
        achievement_type: String,
        title: String,
        description: String,
        icon: Option<String>,
        category: Option<String>,
        rarity: Option<String>,
        points: Option<i32>,
    ) -> Result<Achievement> {
        let achievement = Achievement {
            id: Uuid::new_v4().to_string(),
            user_id,
            achievement_type,
            title,
            description,
            icon: icon.unwrap_or_else(|| "🏆".to_string()),
            category: category.unwrap_or_else(|| "general".to_string()),
            rarity: rarity.unwrap_or_else(|| "common".to_string()),
            points: points.unwrap_or(10),
            earned_date: Utc::now().to_rfc3339(),
            achieved_at: Utc::now().to_rfc3339(),
            created_at: Utc::now().to_rfc3339(),
            requirements: serde_json::Value::Null,
            metadata: None,
        };

        self.repository.create_achievement(&achievement).await
    }
}
