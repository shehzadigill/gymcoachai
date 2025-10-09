use anyhow::Result;

use crate::models::PerformanceTrend;
use crate::repository::PerformanceTrendRepository;

#[derive(Clone)]
pub struct PerformanceTrendService {
    repository: PerformanceTrendRepository,
}

impl PerformanceTrendService {
    pub fn new(repository: PerformanceTrendRepository) -> Self {
        Self { repository }
    }

    pub async fn get_performance_trends(
        &self,
        user_id: &str,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<Vec<PerformanceTrend>> {
        let start = start_date.map(|s| s.to_string()).unwrap_or_else(|| {
            (chrono::Utc::now() - chrono::Duration::days(30)).to_rfc3339()
        });
        let end = end_date.map(|s| s.to_string()).unwrap_or_else(|| {
            chrono::Utc::now().to_rfc3339()
        });

        self.repository.get_performance_trends(user_id, &start, &end).await
    }
}
