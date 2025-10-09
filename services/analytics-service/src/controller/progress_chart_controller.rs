use serde_json::Value;
use anyhow::Result;

use crate::service::ProgressChartService;
use crate::models::ChartDataPoint;
use crate::utils::ResponseBuilder;

pub struct ProgressChartController {
    service: ProgressChartService,
}

impl ProgressChartController {
    pub fn new(service: ProgressChartService) -> Self {
        Self { service }
    }

    pub async fn get_progress_charts(&self, user_id: &str) -> Result<Value> {
        if user_id.is_empty() {
            return Ok(ResponseBuilder::bad_request("User ID is required"));
        }

        match self.service.get_progress_charts(user_id).await {
            Ok(charts) => Ok(ResponseBuilder::ok(charts)),
            Err(e) => Ok(ResponseBuilder::internal_server_error(&format!("Failed to retrieve progress charts: {}", e))),
        }
    }

    pub async fn create_progress_chart(
        &self,
        body: &str,
    ) -> Result<Value> {
        let body: Value = serde_json::from_str(body)?;
        
        let user_id = body["userId"].as_str().unwrap_or("").to_string();
        let chart_type = body["chartType"].as_str().unwrap_or("").to_string();
        let title = body["title"].as_str().unwrap_or("").to_string();
        let description = body["description"].as_str().unwrap_or("").to_string();
        let x_axis_label = body["xAxisLabel"].as_str().map(|s| s.to_string());
        let y_axis_label = body["yAxisLabel"].as_str().map(|s| s.to_string());

        if user_id.is_empty() || chart_type.is_empty() || title.is_empty() {
            return Ok(ResponseBuilder::bad_request("User ID, chart type, and title are required"));
        }

        let data_points: Vec<ChartDataPoint> = body["dataPoints"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter_map(|point| {
                Some(ChartDataPoint {
                    x_value: point["xValue"].as_str()?.to_string(),
                    y_value: point["yValue"].as_f64()? as f32,
                    label: point["label"].as_str().map(|s| s.to_string()),
                    metadata: point["metadata"].as_object().and_then(|_| serde_json::from_value(point["metadata"].clone()).ok()),
                })
            })
            .collect();

        match self.service.create_progress_chart(
            user_id,
            chart_type,
            title,
            description,
            data_points,
            x_axis_label,
            y_axis_label,
        ).await {
            Ok(chart) => Ok(ResponseBuilder::created(chart)),
            Err(e) => Ok(ResponseBuilder::internal_server_error(&format!("Failed to create progress chart: {}", e))),
        }
    }
}
