use aws_sdk_dynamodb::Client as DynamoDbClient;
use aws_sdk_dynamodb::types::AttributeValue;
use anyhow::Result;

use crate::models::{PerformanceTrend, TrendDataPoint};

pub struct PerformanceTrendRepository {
    client: DynamoDbClient,
    table_name: String,
}

impl PerformanceTrendRepository {
    pub fn new(client: DynamoDbClient, table_name: String) -> Self {
        Self { client, table_name }
    }

    pub async fn get_performance_trends(
        &self,
        user_id: &str,
        start_date: &str,
        end_date: &str,
    ) -> Result<Vec<PerformanceTrend>> {
        let result = self
            .client
            .query()
            .table_name(&self.table_name)
            .key_condition_expression("PK = :pk AND SK BETWEEN :start AND :end")
            .expression_attribute_values(":pk", AttributeValue::S("PERFORMANCE_TRENDS".to_string()))
            .expression_attribute_values(":start", AttributeValue::S(format!("USER#{}#{}", user_id, start_date)))
            .expression_attribute_values(":end", AttributeValue::S(format!("USER#{}#{}", user_id, end_date)))
            .send()
            .await?;
        
        let trends: Vec<PerformanceTrend> = result
            .items
            .unwrap_or_default()
            .into_iter()
            .filter_map(|item| {
                Some(PerformanceTrend {
                    metric: item.get("metric")?.as_s().ok()?.clone(),
                    trend_type: item.get("trendType")?.as_s().ok()?.clone(),
                    period: item.get("period")?.as_s().ok()?.clone(),
                    data_points: item.get("dataPoints")
                        .and_then(|v| v.as_l().ok())
                        .map(|list| list.iter().filter_map(|v| {
                            let obj = v.as_m().ok()?;
                            Some(TrendDataPoint {
                                date: obj.get("date")?.as_s().ok()?.clone(),
                                value: obj.get("value")?.as_n().ok()?.parse().ok()?,
                                context: obj.get("context").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
                            })
                        }).collect())
                        .unwrap_or_default(),
                    slope: item.get("slope")?.as_n().ok()?.parse().ok()?,
                    r_squared: item.get("rSquared")?.as_n().ok()?.parse().ok()?,
                    prediction: item.get("prediction").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()),
                })
            })
            .collect();
        
        Ok(trends)
    }
}
