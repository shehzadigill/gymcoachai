use anyhow::Result;
use chrono::Utc;
use uuid::Uuid;

use crate::models::{ProgressChart, ChartDataPoint};
use crate::repository::ProgressChartRepository;

#[derive(Clone)]
pub struct ProgressChartService {
    repository: ProgressChartRepository,
}

impl ProgressChartService {
    pub fn new(repository: ProgressChartRepository) -> Self {
        Self { repository }
    }

    pub async fn get_progress_charts(&self, user_id: &str) -> Result<Vec<ProgressChart>> {
        self.repository.get_progress_charts(user_id).await
    }

    pub async fn create_progress_chart(
        &self,
        user_id: String,
        chart_type: String,
        title: String,
        description: String,
        data_points: Vec<ChartDataPoint>,
        x_axis_label: Option<String>,
        y_axis_label: Option<String>,
    ) -> Result<ProgressChart> {
        let chart = ProgressChart {
            chart_id: Uuid::new_v4().to_string(),
            user_id,
            chart_type,
            title,
            description,
            data_points,
            x_axis_label: x_axis_label.unwrap_or_else(|| "Date".to_string()),
            y_axis_label: y_axis_label.unwrap_or_else(|| "Value".to_string()),
            created_at: Utc::now().to_rfc3339(),
            updated_at: Utc::now().to_rfc3339(),
        };

        self.repository.create_progress_chart(&chart).await
    }
}
