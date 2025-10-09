use anyhow::Result;
use tracing::{info, error};
use chrono::Utc;
use uuid::Uuid;

use crate::repository::ExerciseRepository;
use crate::models::*;
use auth_layer::AuthContext;

#[derive(Clone)]
pub struct ExerciseService {
    exercise_repository: ExerciseRepository,
}

impl ExerciseService {
    pub fn new(exercise_repository: ExerciseRepository) -> Self {
        Self { exercise_repository }
    }

    pub async fn get_exercises(&self, auth_context: &AuthContext) -> Result<serde_json::Value, Box<dyn std::error::Error + Send + Sync>> {
        // No authorization needed for public exercise library
        self.exercise_repository.get_exercises().await
    }

    pub async fn get_exercises_with_user(&self, user_id: Option<String>, auth_context: &AuthContext) -> Result<serde_json::Value, Box<dyn std::error::Error + Send + Sync>> {
        // Authorization check
        if let Some(ref uid) = user_id {
            if auth_context.user_id != *uid {
                return Err(anyhow::anyhow!("You can only access your own exercises").into());
            }
        }

        self.exercise_repository.get_exercises_with_user(user_id).await
    }

    pub async fn create_exercise(&self, exercise_data: &serde_json::Value, auth_context: &AuthContext) -> Result<serde_json::Value, Box<dyn std::error::Error + Send + Sync>> {
        let exercise_id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        let exercise = Exercise {
            id: exercise_id.clone(),
            name: exercise_data["name"].as_str()
                .ok_or_else(|| anyhow::anyhow!("Exercise name is required"))?
                .to_string(),
            description: exercise_data["description"].as_str().map(|s| s.to_string()),
            category: exercise_data["category"].as_str()
                .ok_or_else(|| anyhow::anyhow!("Exercise category is required"))?
                .to_string(),
            muscle_groups: exercise_data["muscleGroups"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect()
                })
                .unwrap_or_default(),
            equipment: exercise_data["equipment"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect()
                })
                .unwrap_or_default(),
            difficulty: exercise_data["difficulty"].as_str().unwrap_or("beginner").to_string(),
            instructions: exercise_data["instructions"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect()
                })
                .unwrap_or_default(),
            tips: exercise_data["tips"].as_str().map(|s| s.to_string()),
            video_url: exercise_data["videoUrl"].as_str().map(|s| s.to_string()),
            image_url: exercise_data["imageUrl"].as_str().map(|s| s.to_string()),
            created_by: Some(auth_context.user_id.clone()),
            is_system: false, // User-created exercises are not system exercises
            tags: exercise_data["tags"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect()
                })
                .unwrap_or_default(),
            created_at: now.clone(),
            updated_at: now,
        };

        self.exercise_repository.create_exercise(&exercise).await
    }

    pub async fn get_exercise(&self, exercise_id: &str, auth_context: &AuthContext) -> Result<serde_json::Value, Box<dyn std::error::Error + Send + Sync>> {
        // No authorization needed for public exercise library
        self.exercise_repository.get_exercise(exercise_id).await
    }

    pub async fn update_exercise(&self, exercise_data: &serde_json::Value, auth_context: &AuthContext) -> Result<serde_json::Value, Box<dyn std::error::Error + Send + Sync>> {
        let exercise_id = exercise_data["id"].as_str()
            .ok_or_else(|| anyhow::anyhow!("Exercise ID is required"))?;

        // First get the exercise to check ownership
        let exercise_result = self.exercise_repository.get_exercise(exercise_id).await?;
        let existing_exercise: Exercise = serde_json::from_value(exercise_result)?;

        // Authorization check - only allow updates to user-created exercises
        if existing_exercise.is_system {
            return Err(anyhow::anyhow!("Cannot update system exercises").into());
        }

        if let Some(ref created_by) = existing_exercise.created_by {
            if auth_context.user_id != *created_by {
                return Err(anyhow::anyhow!("You can only update your own exercises").into());
            }
        }

        let now = Utc::now().to_rfc3339();

        let exercise = Exercise {
            id: exercise_id.to_string(),
            name: exercise_data["name"].as_str()
                .ok_or_else(|| anyhow::anyhow!("Exercise name is required"))?
                .to_string(),
            description: exercise_data["description"].as_str().map(|s| s.to_string()),
            category: exercise_data["category"].as_str()
                .ok_or_else(|| anyhow::anyhow!("Exercise category is required"))?
                .to_string(),
            muscle_groups: exercise_data["muscleGroups"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect()
                })
                .unwrap_or_default(),
            equipment: exercise_data["equipment"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect()
                })
                .unwrap_or_default(),
            difficulty: exercise_data["difficulty"].as_str().unwrap_or("beginner").to_string(),
            instructions: exercise_data["instructions"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect()
                })
                .unwrap_or_default(),
            tips: exercise_data["tips"].as_str().map(|s| s.to_string()),
            video_url: exercise_data["videoUrl"].as_str().map(|s| s.to_string()),
            image_url: exercise_data["imageUrl"].as_str().map(|s| s.to_string()),
            created_by: existing_exercise.created_by,
            is_system: existing_exercise.is_system,
            tags: exercise_data["tags"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect()
                })
                .unwrap_or_default(),
            created_at: existing_exercise.created_at,
            updated_at: now,
        };

        self.exercise_repository.update_exercise(&exercise).await
    }

    pub async fn clone_exercise(&self, exercise_id: &str, auth_context: &AuthContext) -> Result<serde_json::Value, Box<dyn std::error::Error + Send + Sync>> {
        // Get the original exercise
        let exercise_result = self.exercise_repository.get_exercise(exercise_id).await?;
        let original_exercise: Exercise = serde_json::from_value(exercise_result)?;

        let new_exercise_id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        let cloned_exercise = Exercise {
            id: new_exercise_id.clone(),
            name: format!("{} (Copy)", original_exercise.name),
            description: original_exercise.description,
            category: original_exercise.category,
            muscle_groups: original_exercise.muscle_groups,
            equipment: original_exercise.equipment,
            difficulty: original_exercise.difficulty,
            instructions: original_exercise.instructions,
            tips: original_exercise.tips,
            video_url: original_exercise.video_url,
            image_url: original_exercise.image_url,
            created_by: Some(auth_context.user_id.clone()),
            is_system: false, // Cloned exercises are user-created
            tags: original_exercise.tags,
            created_at: now.clone(),
            updated_at: now,
        };

        self.exercise_repository.create_exercise(&cloned_exercise).await
    }

    pub async fn delete_exercise(&self, exercise_id: &str, auth_context: &AuthContext) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // First get the exercise to check ownership
        let exercise_result = self.exercise_repository.get_exercise(exercise_id).await?;
        let existing_exercise: Exercise = serde_json::from_value(exercise_result)?;

        // Authorization check - only allow deletion of user-created exercises
        if existing_exercise.is_system {
            return Err(anyhow::anyhow!("Cannot delete system exercises").into());
        }

        if let Some(ref created_by) = existing_exercise.created_by {
            if auth_context.user_id != *created_by {
                return Err(anyhow::anyhow!("You can only delete your own exercises").into());
            }
        }

        self.exercise_repository.delete_exercise(exercise_id).await
    }
}
