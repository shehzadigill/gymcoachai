use anyhow::Result;

use crate::models::WorkoutSession;
use crate::repository::WorkoutSessionRepository;

pub struct WorkoutSessionService {
    repository: WorkoutSessionRepository,
}

impl WorkoutSessionService {
    pub fn new(repository: WorkoutSessionRepository) -> Self {
        Self { repository }
    }

    pub async fn get_workout_sessions_for_analytics(
        &self,
        user_id: &str,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<Vec<WorkoutSession>> {
        let start = start_date.unwrap_or_else(|| {
            (chrono::Utc::now() - chrono::Duration::days(30)).to_rfc3339().as_str()
        });
        let end = end_date.unwrap_or_else(|| {
            chrono::Utc::now().to_rfc3339().as_str()
        });

        self.repository.get_workout_sessions_for_analytics(user_id, start, end).await
    }
}
