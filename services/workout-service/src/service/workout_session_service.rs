use anyhow::Result;
use chrono::Utc;
use tracing::{error, info};
use uuid::Uuid;

use crate::models::*;
use crate::repository::WorkoutSessionRepository;
use auth_layer::AuthContext;

#[derive(Clone)]
pub struct WorkoutSessionService {
    workout_session_repository: WorkoutSessionRepository,
}

impl WorkoutSessionService {
    pub fn new(workout_session_repository: WorkoutSessionRepository) -> Self {
        Self {
            workout_session_repository,
        }
    }

    pub async fn get_workout_sessions(
        &self,
        user_id: Option<String>,
        workout_plan_id: Option<String>,
        auth_context: &AuthContext,
    ) -> Result<serde_json::Value, Box<dyn std::error::Error + Send + Sync>> {
        // Authorization check
        if let Some(ref uid) = user_id {
            if auth_context.user_id != *uid {
                return Err(
                    anyhow::anyhow!("You can only access your own workout sessions").into(),
                );
            }
        }

        self.workout_session_repository
            .get_workout_sessions(user_id, workout_plan_id)
            .await
    }

    pub async fn create_workout_session(
        &self,
        session_data: &serde_json::Value,
        auth_context: &AuthContext,
    ) -> Result<serde_json::Value, Box<dyn std::error::Error + Send + Sync>> {
        let user_id = session_data["userId"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("User ID is required"))?;

        // Authorization check
        if auth_context.user_id != user_id {
            return Err(
                anyhow::anyhow!("You can only create workout sessions for yourself").into(),
            );
        }

        let session_id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        let session = WorkoutSession {
            id: session_id.clone(),
            user_id: user_id.to_string(),
            workout_plan_id: session_data["workoutPlanId"]
                .as_str()
                .map(|s| s.to_string()),
            name: session_data["name"]
                .as_str()
                .ok_or_else(|| anyhow::anyhow!("Session name is required"))?
                .to_string(),
            started_at: session_data["startedAt"]
                .as_str()
                .unwrap_or(&now)
                .to_string(),
            completed_at: session_data["completedAt"].as_str().map(|s| s.to_string()),
            duration_minutes: session_data["durationMinutes"].as_u64().map(|d| d as i32),
            notes: session_data["notes"].as_str().map(|s| s.to_string()),
            rating: session_data["rating"].as_u64().map(|r| r as i32),
            created_at: now.clone(),
            updated_at: now,
            exercises: session_data["exercises"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| serde_json::from_value::<SessionExercise>(v.clone()).ok())
                        .collect()
                })
                .unwrap_or_default(),
        };

        self.workout_session_repository
            .create_workout_session(&session)
            .await
    }

    pub async fn get_workout_session(
        &self,
        session_id: &str,
        auth_context: &AuthContext,
    ) -> Result<serde_json::Value, Box<dyn std::error::Error + Send + Sync>> {
        // First get the session to check ownership
        let session_result = self
            .workout_session_repository
            .get_workout_session(session_id)
            .await?;
        let session: WorkoutSession = serde_json::from_value(session_result)?;

        // Authorization check
        if auth_context.user_id != session.user_id {
            return Err(anyhow::anyhow!("You can only access your own workout sessions").into());
        }

        Ok(serde_json::to_value(session)?)
    }

    pub async fn update_workout_session(
        &self,
        session_data: &serde_json::Value,
        auth_context: &AuthContext,
    ) -> Result<serde_json::Value, Box<dyn std::error::Error + Send + Sync>> {
        let user_id = session_data["userId"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("User ID is required"))?;
        let session_id = session_data["id"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Session ID is required"))?;

        // Authorization check
        if auth_context.user_id != user_id {
            return Err(anyhow::anyhow!("You can only update your own workout sessions").into());
        }

        let now = Utc::now().to_rfc3339();

        let session = WorkoutSession {
            id: session_id.to_string(),
            user_id: user_id.to_string(),
            workout_plan_id: session_data["workoutPlanId"]
                .as_str()
                .map(|s| s.to_string()),
            name: session_data["name"]
                .as_str()
                .ok_or_else(|| anyhow::anyhow!("Session name is required"))?
                .to_string(),
            started_at: session_data["startedAt"]
                .as_str()
                .unwrap_or(&now)
                .to_string(),
            completed_at: session_data["completedAt"].as_str().map(|s| s.to_string()),
            duration_minutes: session_data["durationMinutes"].as_u64().map(|d| d as i32),
            notes: session_data["notes"].as_str().map(|s| s.to_string()),
            rating: session_data["rating"].as_u64().map(|r| r as i32),
            created_at: session_data["createdAt"]
                .as_str()
                .unwrap_or(&now)
                .to_string(),
            updated_at: now,
            exercises: session_data["exercises"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| serde_json::from_value::<SessionExercise>(v.clone()).ok())
                        .collect()
                })
                .unwrap_or_default(),
        };

        self.workout_session_repository
            .update_workout_session(&session)
            .await
    }

    pub async fn delete_workout_session(
        &self,
        session_id: &str,
        auth_context: &AuthContext,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // First get the session to check ownership
        let session_result = self
            .workout_session_repository
            .get_workout_session(session_id)
            .await?;
        let session: WorkoutSession = serde_json::from_value(session_result)?;

        // Authorization check
        if auth_context.user_id != session.user_id {
            return Err(anyhow::anyhow!("You can only delete your own workout sessions").into());
        }

        self.workout_session_repository
            .delete_workout_session(session_id)
            .await
    }
}
