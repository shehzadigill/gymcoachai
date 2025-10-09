use anyhow::Result;

use crate::models::WorkoutSession;
use crate::repository::WorkoutSessionRepository;

#[derive(Clone)]
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
        let start = start_date.map(|s| s.to_string()).unwrap_or_else(|| {
            (chrono::Utc::now() - chrono::Duration::days(30)).to_rfc3339()
        });
        let end = end_date.map(|s| s.to_string()).unwrap_or_else(|| {
            chrono::Utc::now().to_rfc3339()
        });

        self.repository.get_workout_sessions_for_analytics(user_id, &start, &end).await
    }
}
