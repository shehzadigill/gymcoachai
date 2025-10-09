use anyhow::Result;
use chrono::Utc;
use uuid::Uuid;

use crate::models::Milestone;
use crate::repository::MilestoneRepository;

pub struct MilestoneService {
    repository: MilestoneRepository,
}

impl MilestoneService {
    pub fn new(repository: MilestoneRepository) -> Self {
        Self { repository }
    }

    pub async fn get_milestones(&self, user_id: &str) -> Result<Vec<Milestone>> {
        self.repository.get_milestones(user_id).await
    }

    pub async fn create_milestone(
        &self,
        user_id: String,
        milestone_type: String,
        title: String,
        description: String,
        target_value: f32,
        current_value: Option<f32>,
        unit: Option<String>,
        target_date: Option<String>,
    ) -> Result<Milestone> {
        let current_value = current_value.unwrap_or(0.0);
        let progress_percentage = if target_value > 0.0 {
            (current_value / target_value) * 100.0
        } else {
            0.0
        };

        let achieved = progress_percentage >= 100.0;
        let achieved_at = if achieved { Some(Utc::now().to_rfc3339()) } else { None };

        let milestone = Milestone {
            id: Uuid::new_v4().to_string(),
            user_id,
            milestone_type,
            title,
            description,
            target_value,
            current_value,
            unit: unit.unwrap_or_else(|| "kg".to_string()),
            target_date,
            created_at: Utc::now().to_rfc3339(),
            status: "active".to_string(),
            progress_percentage,
            achieved,
            achieved_at,
            metadata: None,
        };

        self.repository.create_milestone(&milestone).await
    }
}
