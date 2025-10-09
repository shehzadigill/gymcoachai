use anyhow::Result;
use validator::Validate;
use chrono::Utc;

use crate::models::*;
use crate::repository::SleepRepository;
use auth_layer::AuthContext;

#[derive(Clone)]
pub struct SleepService {
    sleep_repository: SleepRepository,
}

impl SleepService {
    pub fn new(sleep_repository: SleepRepository) -> Self {
        Self {
            sleep_repository,
        }
    }

    pub async fn get_sleep_data(&self, user_id: &str, date: &str, auth_context: &AuthContext) -> Result<Option<SleepData>, Box<dyn std::error::Error + Send + Sync>> {
        // Check if user can access this data
        if !self.can_access_user_profile(auth_context, user_id) {
            return Err("You can only access your own sleep data".into());
        }

        self.sleep_repository.get_sleep_data(user_id, date).await
    }

    pub async fn save_sleep_data(&self, mut sleep_data: SleepData, auth_context: &AuthContext) -> Result<SleepData, Box<dyn std::error::Error + Send + Sync>> {
        // Use authenticated user ID
        sleep_data.user_id = auth_context.user_id.clone();
        
        // Validate the data
        if let Err(validation_errors) = sleep_data.validate() {
            return Err(format!("Invalid sleep data: {}", validation_errors).into());
        }

        // Set timestamps
        let now = chrono::Utc::now().to_rfc3339();
        if sleep_data.created_at.is_empty() {
            sleep_data.created_at = now.clone();
        }
        sleep_data.updated_at = now;

        self.sleep_repository.save_sleep_data(&sleep_data).await?;
        Ok(sleep_data)
    }

    pub async fn update_sleep_data(&self, mut sleep_data: SleepData, auth_context: &AuthContext) -> Result<SleepData, Box<dyn std::error::Error + Send + Sync>> {
        // Use authenticated user ID
        sleep_data.user_id = auth_context.user_id.clone();
        
        // Validate the data
        if let Err(validation_errors) = sleep_data.validate() {
            return Err(format!("Invalid sleep data: {}", validation_errors).into());
        }

        // Check if sleep data exists for this date
        match self.sleep_repository.get_sleep_data(&sleep_data.user_id, &sleep_data.date).await? {
            Some(existing_data) => {
                // Keep the original created_at timestamp
                sleep_data.created_at = existing_data.created_at;
                sleep_data.updated_at = Utc::now().to_rfc3339();

                self.sleep_repository.save_sleep_data(&sleep_data).await?;
                Ok(sleep_data)
            }
            None => {
                Err("No sleep data found for this date".into())
            }
        }
    }

    pub async fn get_sleep_history(&self, user_id: &str, days: u32, auth_context: &AuthContext) -> Result<Vec<SleepData>, Box<dyn std::error::Error + Send + Sync>> {
        // Check if user can access this data
        if !self.can_access_user_profile(auth_context, user_id) {
            return Err("You can only access your own sleep data".into());
        }

        self.sleep_repository.get_sleep_history(user_id, days).await
    }

    pub async fn get_sleep_stats(&self, user_id: &str, period: &str, auth_context: &AuthContext) -> Result<SleepStats, Box<dyn std::error::Error + Send + Sync>> {
        // Check if user can access this data
        if !self.can_access_user_profile(auth_context, user_id) {
            return Err("You can only access your own sleep data".into());
        }

        self.sleep_repository.calculate_sleep_stats(user_id, period).await
    }

    // Authorization helper methods
    fn can_access_user_profile(&self, auth_context: &AuthContext, resource_user_id: &str) -> bool {
        // Admin can access any user profile
        if auth_context.roles.contains(&"admin".to_string()) {
            return true;
        }
        
        // Coaches can access user profiles for coaching purposes
        if auth_context.roles.contains(&"coach".to_string()) {
            return true;
        }
        
        // Users can only access their own profile
        auth_context.user_id == resource_user_id
    }
}
