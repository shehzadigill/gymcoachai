use serde_json::Value;
use anyhow::Result;

use crate::service::PerformanceTrendService;
use crate::utils::ResponseBuilder;

pub struct PerformanceTrendController {
    service: PerformanceTrendService,
}

impl PerformanceTrendController {
    pub fn new(service: PerformanceTrendService) -> Self {
        Self { service }
    }

    pub async fn get_performance_trends(
        &self,
        user_id: &str,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<Value> {
        if user_id.is_empty() {
            return Ok(ResponseBuilder::bad_request("User ID is required"));
        }

        match self.service.get_performance_trends(user_id, start_date, end_date).await {
            Ok(trends) => Ok(ResponseBuilder::ok(trends)),
            Err(e) => Ok(ResponseBuilder::internal_server_error(&format!("Failed to retrieve performance trends: {}", e))),
        }
    }
}
