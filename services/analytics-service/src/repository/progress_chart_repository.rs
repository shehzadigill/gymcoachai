use aws_sdk_dynamodb::Client as DynamoDbClient;
use aws_sdk_dynamodb::types::AttributeValue;
use anyhow::Result;
use std::collections::HashMap;

use crate::models::{ProgressChart, ChartDataPoint};

pub struct ProgressChartRepository {
    client: DynamoDbClient,
    table_name: String,
}

impl ProgressChartRepository {
    pub fn new(client: DynamoDbClient, table_name: String) -> Self {
        Self { client, table_name }
    }

    pub async fn get_progress_charts(&self, user_id: &str) -> Result<Vec<ProgressChart>> {
        let result = self
            .client
            .query()
            .table_name(&self.table_name)
            .key_condition_expression("PK = :pk")
            .expression_attribute_values(":pk", AttributeValue::S("PROGRESS_CHARTS".to_string()))
            .filter_expression("userId = :userId")
            .expression_attribute_values(":userId", AttributeValue::S(user_id.to_string()))
            .send()
            .await?;
        
        let charts: Vec<ProgressChart> = result
            .items
            .unwrap_or_default()
            .into_iter()
            .filter_map(|item| {
                Some(ProgressChart {
                    chart_id: item.get("chartId")?.as_s().ok()?.clone(),
                    user_id: item.get("userId")?.as_s().ok()?.clone(),
                    chart_type: item.get("chartType")?.as_s().ok()?.clone(),
                    title: item.get("title")?.as_s().ok()?.clone(),
                    description: item.get("description")?.as_s().ok()?.clone(),
                    data_points: item.get("dataPoints")
                        .and_then(|v| v.as_l().ok())
                        .map(|list| list.iter().filter_map(|v| {
                            let obj = v.as_m().ok()?;
                            Some(ChartDataPoint {
                                x_value: obj.get("xValue")?.as_s().ok()?.clone(),
                                y_value: obj.get("yValue")?.as_n().ok()?.parse().ok()?,
                                label: obj.get("label").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
                                metadata: obj.get("metadata").and_then(|vv| vv.as_s().ok()).and_then(|s| serde_json::from_str(s).ok()),
                            })
                        }).collect())
                        .unwrap_or_default(),
                    x_axis_label: item.get("xAxisLabel")?.as_s().ok()?.clone(),
                    y_axis_label: item.get("yAxisLabel")?.as_s().ok()?.clone(),
                    created_at: item.get("createdAt")?.as_s().ok()?.clone(),
                    updated_at: item.get("updatedAt")?.as_s().ok()?.clone(),
                })
            })
            .collect();
        
        Ok(charts)
    }

    pub async fn create_progress_chart(&self, chart: &ProgressChart) -> Result<ProgressChart> {
        let mut item = HashMap::new();
        item.insert("PK".to_string(), AttributeValue::S("PROGRESS_CHARTS".to_string()));
        item.insert("SK".to_string(), AttributeValue::S(format!("CHART#{}", chart.chart_id)));
        item.insert("chartId".to_string(), AttributeValue::S(chart.chart_id.clone()));
        item.insert("userId".to_string(), AttributeValue::S(chart.user_id.clone()));
        item.insert("chartType".to_string(), AttributeValue::S(chart.chart_type.clone()));
        item.insert("title".to_string(), AttributeValue::S(chart.title.clone()));
        item.insert("description".to_string(), AttributeValue::S(chart.description.clone()));
        item.insert("xAxisLabel".to_string(), AttributeValue::S(chart.x_axis_label.clone()));
        item.insert("yAxisLabel".to_string(), AttributeValue::S(chart.y_axis_label.clone()));
        item.insert("createdAt".to_string(), AttributeValue::S(chart.created_at.clone()));
        item.insert("updatedAt".to_string(), AttributeValue::S(chart.updated_at.clone()));
        
        // Add data points as a list of maps
        let data_points: Vec<AttributeValue> = chart.data_points
            .iter()
            .map(|point| {
                let mut point_map = HashMap::new();
                point_map.insert("xValue".to_string(), AttributeValue::S(point.x_value.clone()));
                point_map.insert("yValue".to_string(), AttributeValue::N(point.y_value.to_string()));
                
                if let Some(label) = &point.label {
                    point_map.insert("label".to_string(), AttributeValue::S(label.clone()));
                }
                if let Some(metadata) = &point.metadata {
                    point_map.insert("metadata".to_string(), AttributeValue::S(serde_json::to_string(metadata).unwrap_or_default()));
                }
                
                AttributeValue::M(point_map)
            })
            .collect();
        item.insert("dataPoints".to_string(), AttributeValue::L(data_points));
        
        self.client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .send()
            .await?;
        
        Ok(chart.clone())
    }
}
