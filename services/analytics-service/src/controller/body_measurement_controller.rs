use serde_json::Value;
use anyhow::Result;

use crate::service::BodyMeasurementService;
use crate::utils::ResponseBuilder;

pub struct BodyMeasurementController {
    service: BodyMeasurementService,
}

impl BodyMeasurementController {
    pub fn new(service: BodyMeasurementService) -> Self {
        Self { service }
    }

    pub async fn get_body_measurements(
        &self,
        user_id: &str,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<Value> {
        if user_id.is_empty() {
            return Ok(ResponseBuilder::bad_request("User ID is required"));
        }

        match self.service.get_body_measurements(user_id, start_date, end_date).await {
            Ok(measurements) => Ok(ResponseBuilder::ok(measurements)),
            Err(e) => Ok(ResponseBuilder::internal_server_error(&format!("Failed to retrieve body measurements: {}", e))),
        }
    }

    pub async fn create_body_measurement(
        &self,
        body: &str,
    ) -> Result<Value> {
        let body: Value = serde_json::from_str(body)?;
        
        let user_id = body["userId"].as_str().unwrap_or("").to_string();
        let measurement_type = body["measurementType"].as_str().unwrap_or("").to_string();
        let value = body["value"].as_f64().unwrap_or(0.0) as f32;
        let unit = body["unit"].as_str().unwrap_or("").to_string();
        let notes = body["notes"].as_str().map(|s| s.to_string());

        if user_id.is_empty() || measurement_type.is_empty() || unit.is_empty() {
            return Ok(ResponseBuilder::bad_request("User ID, measurement type, and unit are required"));
        }

        match self.service.create_body_measurement(
            user_id,
            measurement_type,
            value,
            unit,
            notes,
        ).await {
            Ok(measurement) => Ok(ResponseBuilder::created(measurement)),
            Err(e) => Ok(ResponseBuilder::internal_server_error(&format!("Failed to create body measurement: {}", e))),
        }
    }
}
