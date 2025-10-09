use anyhow::Result;
use tracing::{info, error};
use chrono::Utc;
use uuid::Uuid;

use crate::repository::ScheduledWorkoutRepository;
use crate::models::*;
use auth_layer::AuthContext;

#[derive(Clone)]
pub struct ScheduledWorkoutService {
    scheduled_workout_repository: ScheduledWorkoutRepository,
}

impl ScheduledWorkoutService {
    pub fn new(scheduled_workout_repository: ScheduledWorkoutRepository) -> Self {
        Self { scheduled_workout_repository }
    }

    pub async fn create_scheduled_workout(&self, schedule_data: &serde_json::Value, auth_context: &AuthContext) -> Result<serde_json::Value, Box<dyn std::error::Error + Send + Sync>> {
        let user_id = schedule_data["userId"].as_str()
            .ok_or_else(|| anyhow::anyhow!("User ID is required"))?;

        // Authorization check
        if auth_context.user_id != user_id {
            return Err(anyhow::anyhow!("You can only create scheduled workouts for yourself").into());
        }

        let schedule_id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        let scheduled_workout = ScheduledWorkout {
            id: schedule_id.clone(),
            plan_id: schedule_data["planId"].as_str()
                .ok_or_else(|| anyhow::anyhow!("Plan ID is required"))?
                .to_string(),
            user_id: user_id.to_string(),
            plan_name: schedule_data["planName"].as_str()
                .ok_or_else(|| anyhow::anyhow!("Plan name is required"))?
                .to_string(),
            scheduled_date: schedule_data["scheduledDate"].as_str()
                .ok_or_else(|| anyhow::anyhow!("Scheduled date is required"))?
                .to_string(),
            scheduled_time: schedule_data["scheduledTime"].as_str()
                .ok_or_else(|| anyhow::anyhow!("Scheduled time is required"))?
                .to_string(),
            status: schedule_data["status"].as_str().unwrap_or("scheduled").to_string(),
            week: schedule_data["week"].as_u64().unwrap_or(1) as i32,
            day: schedule_data["day"].as_u64().unwrap_or(1) as i32,
            notes: schedule_data["notes"].as_str().map(|s| s.to_string()),
            completed_at: schedule_data["completedAt"].as_str().map(|s| s.to_string()),
            created_at: now.clone(),
            updated_at: now,
        };

        self.scheduled_workout_repository.create_scheduled_workout(&scheduled_workout).await
    }

    pub async fn get_scheduled_workouts(&self, user_id: Option<String>, auth_context: &AuthContext) -> Result<serde_json::Value, Box<dyn std::error::Error + Send + Sync>> {
        // Authorization check
        if let Some(ref uid) = user_id {
            if auth_context.user_id != *uid {
                return Err(anyhow::anyhow!("You can only access your own scheduled workouts").into());
            }
        }

        self.scheduled_workout_repository.get_scheduled_workouts(user_id).await
    }

    pub async fn update_scheduled_workout(&self, schedule_data: &serde_json::Value, auth_context: &AuthContext) -> Result<serde_json::Value, Box<dyn std::error::Error + Send + Sync>> {
        let user_id = schedule_data["userId"].as_str()
            .ok_or_else(|| anyhow::anyhow!("User ID is required"))?;
        let schedule_id = schedule_data["id"].as_str()
            .ok_or_else(|| anyhow::anyhow!("Schedule ID is required"))?;

        // Authorization check
        if auth_context.user_id != user_id {
            return Err(anyhow::anyhow!("You can only update your own scheduled workouts").into());
        }

        let now = Utc::now().to_rfc3339();

        let scheduled_workout = ScheduledWorkout {
            id: schedule_id.to_string(),
            plan_id: schedule_data["planId"].as_str()
                .ok_or_else(|| anyhow::anyhow!("Plan ID is required"))?
                .to_string(),
            user_id: user_id.to_string(),
            plan_name: schedule_data["planName"].as_str()
                .ok_or_else(|| anyhow::anyhow!("Plan name is required"))?
                .to_string(),
            scheduled_date: schedule_data["scheduledDate"].as_str()
                .ok_or_else(|| anyhow::anyhow!("Scheduled date is required"))?
                .to_string(),
            scheduled_time: schedule_data["scheduledTime"].as_str()
                .ok_or_else(|| anyhow::anyhow!("Scheduled time is required"))?
                .to_string(),
            status: schedule_data["status"].as_str().unwrap_or("scheduled").to_string(),
            week: schedule_data["week"].as_u64().unwrap_or(1) as i32,
            day: schedule_data["day"].as_u64().unwrap_or(1) as i32,
            notes: schedule_data["notes"].as_str().map(|s| s.to_string()),
            completed_at: schedule_data["completedAt"].as_str().map(|s| s.to_string()),
            created_at: schedule_data["createdAt"].as_str().unwrap_or(&now).to_string(),
            updated_at: now,
        };

        self.scheduled_workout_repository.update_scheduled_workout(&scheduled_workout).await
    }

    pub async fn delete_scheduled_workout(&self, user_id: &str, schedule_id: &str, auth_context: &AuthContext) -> Result<serde_json::Value, Box<dyn std::error::Error + Send + Sync>> {
        // Authorization check
        if auth_context.user_id != user_id {
            return Err(anyhow::anyhow!("You can only delete your own scheduled workouts").into());
        }

        self.scheduled_workout_repository.delete_scheduled_workout(user_id, schedule_id).await
    }
}
