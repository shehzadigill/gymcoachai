use anyhow::Result;
use tracing::{info, error};
use chrono::Utc;
use uuid::Uuid;

use crate::repository::WorkoutPlanRepository;
use crate::models::*;
use auth_layer::AuthContext;

#[derive(Clone)]
pub struct WorkoutPlanService {
    workout_plan_repository: WorkoutPlanRepository,
}

impl WorkoutPlanService {
    pub fn new(workout_plan_repository: WorkoutPlanRepository) -> Self {
        Self { workout_plan_repository }
    }

    pub async fn get_workout_plans(&self, user_id: Option<String>, auth_context: &AuthContext) -> Result<serde_json::Value, Box<dyn std::error::Error + Send + Sync>> {
        // Authorization check
        if let Some(ref uid) = user_id {
            if auth_context.user_id != *uid {
                return Err(anyhow::anyhow!("You can only access your own workout plans").into());
            }
        }

        self.workout_plan_repository.get_workout_plans(user_id).await
    }

    pub async fn create_workout_plan(&self, plan_data: &serde_json::Value, auth_context: &AuthContext) -> Result<serde_json::Value, Box<dyn std::error::Error + Send + Sync>> {
        let user_id = plan_data["userId"].as_str()
            .ok_or_else(|| anyhow::anyhow!("User ID is required"))?;

        // Authorization check
        if auth_context.user_id != user_id {
            return Err(anyhow::anyhow!("You can only create workout plans for yourself").into());
        }

        let plan_id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        let plan = WorkoutPlan {
            id: plan_id.clone(),
            user_id: user_id.to_string(),
            name: plan_data["name"].as_str()
                .ok_or_else(|| anyhow::anyhow!("Plan name is required"))?
                .to_string(),
            description: plan_data["description"].as_str().map(|s| s.to_string()),
            difficulty: plan_data["difficulty"].as_str().unwrap_or("beginner").to_string(),
            duration_weeks: plan_data["durationWeeks"].as_u64().unwrap_or(4) as i32,
            frequency_per_week: plan_data["frequencyPerWeek"].as_u64().unwrap_or(3) as i32,
            exercises: plan_data["exercises"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| serde_json::from_value::<WorkoutExercise>(v.clone()).ok())
                        .collect()
                })
                .unwrap_or_default(),
            created_at: now.clone(),
            updated_at: now,
            is_active: true,
            tags: plan_data["tags"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect()
                }),
            rating: plan_data["rating"].as_f64().map(|r| r as f32),
            is_template: plan_data["isTemplate"].as_bool(),
            total_sessions: plan_data["totalSessions"].as_u64().map(|s| s as i32),
            completed_sessions: plan_data["completedSessions"].as_u64().map(|s| s as i32),
            next_scheduled_date: plan_data["nextScheduledDate"].as_str().map(|s| s.to_string()),
        };

        self.workout_plan_repository.create_workout_plan(&plan).await
    }

    pub async fn get_workout_plan(&self, user_id: &str, plan_id: &str, auth_context: &AuthContext) -> Result<serde_json::Value, Box<dyn std::error::Error + Send + Sync>> {
        // Authorization check
        if auth_context.user_id != user_id {
            return Err(anyhow::anyhow!("You can only access your own workout plans").into());
        }

        self.workout_plan_repository.get_workout_plan(user_id, plan_id).await
    }

    pub async fn update_workout_plan(&self, plan_data: &serde_json::Value, auth_context: &AuthContext) -> Result<serde_json::Value, Box<dyn std::error::Error + Send + Sync>> {
        let user_id = plan_data["userId"].as_str()
            .ok_or_else(|| anyhow::anyhow!("User ID is required"))?;
        let plan_id = plan_data["id"].as_str()
            .ok_or_else(|| anyhow::anyhow!("Plan ID is required"))?;

        // Authorization check
        if auth_context.user_id != user_id {
            return Err(anyhow::anyhow!("You can only update your own workout plans").into());
        }

        let now = Utc::now().to_rfc3339();

        let plan = WorkoutPlan {
            id: plan_id.to_string(),
            user_id: user_id.to_string(),
            name: plan_data["name"].as_str()
                .ok_or_else(|| anyhow::anyhow!("Plan name is required"))?
                .to_string(),
            description: plan_data["description"].as_str().map(|s| s.to_string()),
            difficulty: plan_data["difficulty"].as_str().unwrap_or("beginner").to_string(),
            duration_weeks: plan_data["durationWeeks"].as_u64().unwrap_or(4) as i32,
            frequency_per_week: plan_data["frequencyPerWeek"].as_u64().unwrap_or(3) as i32,
            exercises: plan_data["exercises"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| serde_json::from_value::<WorkoutExercise>(v.clone()).ok())
                        .collect()
                })
                .unwrap_or_default(),
            created_at: plan_data["createdAt"].as_str().unwrap_or(&now).to_string(),
            updated_at: now,
            is_active: plan_data["isActive"].as_bool().unwrap_or(true),
            tags: plan_data["tags"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect()
                }),
            rating: plan_data["rating"].as_f64().map(|r| r as f32),
            is_template: plan_data["isTemplate"].as_bool(),
            total_sessions: plan_data["totalSessions"].as_u64().map(|s| s as i32),
            completed_sessions: plan_data["completedSessions"].as_u64().map(|s| s as i32),
            next_scheduled_date: plan_data["nextScheduledDate"].as_str().map(|s| s.to_string()),
        };

        self.workout_plan_repository.update_workout_plan(&plan).await
    }

    pub async fn delete_workout_plan(&self, user_id: &str, plan_id: &str, auth_context: &AuthContext) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Authorization check
        if auth_context.user_id != user_id {
            return Err(anyhow::anyhow!("You can only delete your own workout plans").into());
        }

        self.workout_plan_repository.delete_workout_plan(user_id, plan_id).await
    }
}
