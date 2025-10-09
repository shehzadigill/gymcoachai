use aws_sdk_dynamodb::Client as DynamoDbClient;
use aws_sdk_dynamodb::types::AttributeValue;
use anyhow::Result;
use std::collections::HashMap;

use crate::models::BodyMeasurement;

#[derive(Clone)]
pub struct BodyMeasurementRepository {
    client: DynamoDbClient,
    table_name: String,
}

impl BodyMeasurementRepository {
    pub fn new(client: DynamoDbClient, table_name: String) -> Self {
        Self { client, table_name }
    }

    pub async fn get_body_measurements(
        &self,
        user_id: &str,
        start_date: &str,
        end_date: &str,
    ) -> Result<Vec<BodyMeasurement>> {
        let result = self
            .client
            .query()
            .table_name(&self.table_name)
            .key_condition_expression("PK = :pk AND SK BETWEEN :start AND :end")
            .expression_attribute_values(":pk", AttributeValue::S("BODY_MEASUREMENTS".to_string()))
            .expression_attribute_values(":start", AttributeValue::S(format!("USER#{}#{}", user_id, start_date)))
            .expression_attribute_values(":end", AttributeValue::S(format!("USER#{}#{}", user_id, end_date)))
            .send()
            .await?;
        
        let measurements: Vec<BodyMeasurement> = result
            .items
            .unwrap_or_default()
            .into_iter()
            .filter_map(|item| {
                Some(BodyMeasurement {
                    id: item.get("id")?.as_s().ok()?.clone(),
                    user_id: item.get("userId")?.as_s().ok()?.clone(),
                    measurement_type: item.get("measurementType")?.as_s().ok()?.clone(),
                    value: item.get("value")?.as_n().ok()?.parse().ok()?,
                    unit: item.get("unit")?.as_s().ok()?.clone(),
                    measured_at: item.get("measuredAt")?.as_s().ok()?.clone(),
                    notes: item.get("notes").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
                })
            })
            .collect();
        
        Ok(measurements)
    }

    pub async fn create_body_measurement(&self, measurement: &BodyMeasurement) -> Result<BodyMeasurement> {
        let mut item = HashMap::new();
        item.insert("PK".to_string(), AttributeValue::S("BODY_MEASUREMENTS".to_string()));
        item.insert("SK".to_string(), AttributeValue::S(format!("USER#{}#{}", measurement.user_id, measurement.measured_at)));
        item.insert("id".to_string(), AttributeValue::S(measurement.id.clone()));
        item.insert("userId".to_string(), AttributeValue::S(measurement.user_id.clone()));
        item.insert("measurementType".to_string(), AttributeValue::S(measurement.measurement_type.clone()));
        item.insert("value".to_string(), AttributeValue::N(measurement.value.to_string()));
        item.insert("unit".to_string(), AttributeValue::S(measurement.unit.clone()));
        item.insert("measuredAt".to_string(), AttributeValue::S(measurement.measured_at.clone()));
        
        if let Some(notes) = &measurement.notes {
            item.insert("notes".to_string(), AttributeValue::S(notes.clone()));
        }
        
        self.client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .send()
            .await?;
        
        Ok(measurement.clone())
    }
}
