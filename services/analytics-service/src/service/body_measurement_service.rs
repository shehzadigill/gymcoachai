use anyhow::Result;
use chrono::Utc;
use uuid::Uuid;

use crate::models::BodyMeasurement;
use crate::repository::BodyMeasurementRepository;

#[derive(Clone)]
pub struct BodyMeasurementService {
    repository: BodyMeasurementRepository,
}

impl BodyMeasurementService {
    pub fn new(repository: BodyMeasurementRepository) -> Self {
        Self { repository }
    }

    pub async fn get_body_measurements(
        &self,
        user_id: &str,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<Vec<BodyMeasurement>> {
        let start = start_date.map(|s| s.to_string()).unwrap_or_else(|| {
            (Utc::now() - chrono::Duration::days(30)).to_rfc3339()
        });
        let end = end_date.map(|s| s.to_string()).unwrap_or_else(|| {
            Utc::now().to_rfc3339()
        });

        self.repository.get_body_measurements(user_id, &start, &end).await
    }

    pub async fn create_body_measurement(
        &self,
        user_id: String,
        measurement_type: String,
        value: f32,
        unit: String,
        notes: Option<String>,
    ) -> Result<BodyMeasurement> {
        let measurement = BodyMeasurement {
            id: Uuid::new_v4().to_string(),
            user_id,
            measurement_type,
            value,
            unit,
            measured_at: Utc::now().to_rfc3339(),
            notes,
        };

        self.repository.create_body_measurement(&measurement).await
    }
}
