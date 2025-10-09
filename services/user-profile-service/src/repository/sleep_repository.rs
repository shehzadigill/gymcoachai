use aws_sdk_dynamodb::{Client as DynamoDbClient, types::AttributeValue};
use chrono::Utc;
use anyhow::Result;

use crate::models::*;

#[derive(Clone)]
pub struct SleepRepository {
    dynamodb_client: DynamoDbClient,
    table_name: String,
}

impl SleepRepository {
    pub fn new(dynamodb_client: DynamoDbClient) -> Self {
        let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
        Self {
            dynamodb_client,
            table_name,
        }
    }

    pub async fn get_sleep_data(&self, user_id: &str, date: &str) -> Result<Option<SleepData>, Box<dyn std::error::Error + Send + Sync>> {
        let result = self.dynamodb_client
            .get_item()
            .table_name(&self.table_name)
            .key("PK", AttributeValue::S(format!("USER#{}", user_id)))
            .key("SK", AttributeValue::S(format!("SLEEP#{}", date)))
            .send()
            .await?;

        if let Some(item) = result.item {
            let sleep_data = SleepData {
                user_id: user_id.to_string(),
                date: date.to_string(),
                hours: item.get("hours").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()).unwrap_or(0),
                minutes: item.get("minutes").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()),
                quality: item.get("quality").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()),
                bed_time: item.get("bedTime").and_then(|v| v.as_s().ok()).map(|s| s.to_string()),
                wake_time: item.get("wakeTime").and_then(|v| v.as_s().ok()).map(|s| s.to_string()),
                notes: item.get("notes").and_then(|v| v.as_s().ok()).map(|s| s.to_string()),
                created_at: item.get("createdAt").and_then(|v| v.as_s().ok()).map_or_else(|| Utc::now().to_rfc3339(), |v| v.to_string()),
                updated_at: item.get("updatedAt").and_then(|v| v.as_s().ok()).map_or_else(|| Utc::now().to_rfc3339(), |v| v.to_string()),
            };
            Ok(Some(sleep_data))
        } else {
            Ok(None)
        }
    }

    pub async fn save_sleep_data(&self, sleep_data: &SleepData) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let now = Utc::now().to_rfc3339();

        let mut item = std::collections::HashMap::new();
        item.insert("PK".to_string(), AttributeValue::S(format!("USER#{}", sleep_data.user_id)));
        item.insert("SK".to_string(), AttributeValue::S(format!("SLEEP#{}", sleep_data.date)));
        item.insert("hours".to_string(), AttributeValue::N(sleep_data.hours.to_string()));
        item.insert("updatedAt".to_string(), AttributeValue::S(now.clone()));

        if let Some(minutes) = sleep_data.minutes {
            item.insert("minutes".to_string(), AttributeValue::N(minutes.to_string()));
        }
        if let Some(quality) = sleep_data.quality {
            item.insert("quality".to_string(), AttributeValue::N(quality.to_string()));
        }
        if let Some(bed_time) = &sleep_data.bed_time {
            item.insert("bedTime".to_string(), AttributeValue::S(bed_time.clone()));
        }
        if let Some(wake_time) = &sleep_data.wake_time {
            item.insert("wakeTime".to_string(), AttributeValue::S(wake_time.clone()));
        }
        if let Some(notes) = &sleep_data.notes {
            item.insert("notes".to_string(), AttributeValue::S(notes.clone()));
        }

        // Set createdAt only if it's a new record
        if sleep_data.created_at.is_empty() {
            item.insert("createdAt".to_string(), AttributeValue::S(now));
        } else {
            item.insert("createdAt".to_string(), AttributeValue::S(sleep_data.created_at.clone()));
        }

        self.dynamodb_client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .send()
            .await?;

        Ok(())
    }

    pub async fn get_sleep_history(&self, user_id: &str, days: u32) -> Result<Vec<SleepData>, Box<dyn std::error::Error + Send + Sync>> {
        let result = self.dynamodb_client
            .query()
            .table_name(&self.table_name)
            .key_condition_expression("PK = :pk AND begins_with(SK, :sk)")
            .expression_attribute_values(":pk", AttributeValue::S(format!("USER#{}", user_id)))
            .expression_attribute_values(":sk", AttributeValue::S("SLEEP#".to_string()))
            .scan_index_forward(false) // Most recent first
            .limit(days as i32)
            .send()
            .await?;

        let mut sleep_history = Vec::new();
        
        if let Some(items) = result.items {
            for item in items {
                if let (Some(date_sk), Some(hours)) = (
                    item.get("SK").and_then(|v| v.as_s().ok()),
                    item.get("hours").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok())
                ) {
                    // Extract date from SK (format: "SLEEP#YYYY-MM-DD")
                    if let Some(date) = date_sk.strip_prefix("SLEEP#") {
                        let sleep_data = SleepData {
                            user_id: user_id.to_string(),
                            date: date.to_string(),
                            hours,
                            minutes: item.get("minutes").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()),
                            quality: item.get("quality").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()),
                            bed_time: item.get("bedTime").and_then(|v| v.as_s().ok()).map(|s| s.to_string()),
                            wake_time: item.get("wakeTime").and_then(|v| v.as_s().ok()).map(|s| s.to_string()),
                            notes: item.get("notes").and_then(|v| v.as_s().ok()).map(|s| s.to_string()),
                            created_at: item.get("createdAt").and_then(|v| v.as_s().ok()).map_or_else(|| Utc::now().to_rfc3339(), |v| v.to_string()),
                            updated_at: item.get("updatedAt").and_then(|v| v.as_s().ok()).map_or_else(|| Utc::now().to_rfc3339(), |v| v.to_string()),
                        };
                        sleep_history.push(sleep_data);
                    }
                }
            }
        }

        Ok(sleep_history)
    }

    pub async fn calculate_sleep_stats(&self, user_id: &str, period: &str) -> Result<SleepStats, Box<dyn std::error::Error + Send + Sync>> {
        let days = match period {
            "week" => 7,
            "month" => 30,
            "year" => 365,
            _ => 30, // default to month
        };

        let sleep_history = self.get_sleep_history(user_id, days).await?;
        
        if sleep_history.is_empty() {
            return Ok(SleepStats {
                user_id: user_id.to_string(),
                period: period.to_string(),
                average_hours: 0.0,
                average_quality: 0.0,
                total_nights: 0,
                best_night: SleepNight {
                    date: "".to_string(),
                    hours: 0.0,
                    quality: 0,
                },
                worst_night: SleepNight {
                    date: "".to_string(),
                    hours: 0.0,
                    quality: 0,
                },
                consistency: 0.0,
                trend: "stable".to_string(),
                calculated_at: Utc::now().to_rfc3339(),
            });
        }

        // Calculate statistics
        let total_nights = sleep_history.len() as u32;
        let total_hours: f32 = sleep_history.iter()
            .map(|s| s.hours as f32 + (s.minutes.unwrap_or(0) as f32 / 60.0))
            .sum();
        let average_hours = total_hours / total_nights as f32;

        let qualities: Vec<u8> = sleep_history.iter()
            .filter_map(|s| s.quality)
            .collect();
        let average_quality = if qualities.is_empty() {
            0.0
        } else {
            qualities.iter().sum::<u8>() as f32 / qualities.len() as f32
        };

        // Find best and worst nights
        let mut best_night = SleepNight {
            date: sleep_history[0].date.clone(),
            hours: sleep_history[0].hours as f32 + (sleep_history[0].minutes.unwrap_or(0) as f32 / 60.0),
            quality: sleep_history[0].quality.unwrap_or(3),
        };
        let mut worst_night = best_night.clone();

        for sleep in &sleep_history {
            let total_sleep = sleep.hours as f32 + (sleep.minutes.unwrap_or(0) as f32 / 60.0);
            let quality = sleep.quality.unwrap_or(3);
            
            // Best night: highest quality, then highest duration
            if quality > best_night.quality || (quality == best_night.quality && total_sleep > best_night.hours) {
                best_night = SleepNight {
                    date: sleep.date.clone(),
                    hours: total_sleep,
                    quality,
                };
            }
            
            // Worst night: lowest quality, then lowest duration
            if quality < worst_night.quality || (quality == worst_night.quality && total_sleep < worst_night.hours) {
                worst_night = SleepNight {
                    date: sleep.date.clone(),
                    hours: total_sleep,
                    quality,
                };
            }
        }

        // Calculate consistency (how close to average)
        let variance: f32 = sleep_history.iter()
            .map(|s| {
                let total_sleep = s.hours as f32 + (s.minutes.unwrap_or(0) as f32 / 60.0);
                (total_sleep - average_hours).powi(2)
            })
            .sum::<f32>() / total_nights as f32;
        let std_deviation = variance.sqrt();
        let consistency = ((1.0 - (std_deviation / average_hours).min(1.0)) * 100.0).max(0.0);

        // Simple trend analysis (compare first half to second half)
        let trend = if sleep_history.len() >= 4 {
            let mid_point = sleep_history.len() / 2;
            let first_half_avg: f32 = sleep_history[mid_point..].iter()
                .map(|s| s.hours as f32 + (s.minutes.unwrap_or(0) as f32 / 60.0))
                .sum::<f32>() / (sleep_history.len() - mid_point) as f32;
            let second_half_avg: f32 = sleep_history[..mid_point].iter()
                .map(|s| s.hours as f32 + (s.minutes.unwrap_or(0) as f32 / 60.0))
                .sum::<f32>() / mid_point as f32;
            
            let diff = second_half_avg - first_half_avg;
            if diff > 0.5 {
                "improving"
            } else if diff < -0.5 {
                "declining"
            } else {
                "stable"
            }
        } else {
            "stable"
        };

        Ok(SleepStats {
            user_id: user_id.to_string(),
            period: period.to_string(),
            average_hours,
            average_quality,
            total_nights,
            best_night,
            worst_night,
            consistency,
            trend: trend.to_string(),
            calculated_at: Utc::now().to_rfc3339(),
        })
    }
}
