use anyhow::Result;
use chrono::Utc;

use crate::models::StrengthProgress;
use crate::repository::StrengthProgressRepository;

pub struct StrengthProgressService {
    repository: StrengthProgressRepository,
}

impl StrengthProgressService {
    pub fn new(repository: StrengthProgressRepository) -> Self {
        Self { repository }
    }

    pub async fn get_strength_progress(
        &self,
        user_id: &str,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<Vec<StrengthProgress>> {
        let start = start_date.unwrap_or_else(|| {
            (Utc::now() - chrono::Duration::days(30)).to_rfc3339().as_str()
        });
        let end = end_date.unwrap_or_else(|| {
            Utc::now().to_rfc3339().as_str()
        });

        self.repository.get_strength_progress(user_id, start, end).await
    }

    pub async fn create_strength_progress(
        &self,
        user_id: String,
        exercise_id: String,
        exercise_name: String,
        current_max_weight: f32,
        previous_max_weight: f32,
        period: Option<String>,
    ) -> Result<StrengthProgress> {
        let weight_increase = current_max_weight - previous_max_weight;
        let percentage_increase = if previous_max_weight > 0.0 {
            (weight_increase / previous_max_weight) * 100.0
        } else {
            0.0
        };

        let trend = if percentage_increase > 5.0 {
            "increasing".to_string()
        } else if percentage_increase < -5.0 {
            "decreasing".to_string()
        } else {
            "stable".to_string()
        };

        let progress = StrengthProgress {
            user_id,
            exercise_id,
            exercise_name,
            current_max_weight,
            previous_max_weight,
            weight_increase,
            percentage_increase,
            period: period.unwrap_or_else(|| "week".to_string()),
            measurement_date: Utc::now().to_rfc3339(),
            trend,
        };

        self.repository.create_strength_progress(&progress).await
    }
}
