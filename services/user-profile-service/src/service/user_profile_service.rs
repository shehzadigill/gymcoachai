use serde_json::Value;
use anyhow::Result;
use validator::Validate;

use crate::models::*;
use crate::repository::{UserProfileRepository, SleepRepository};
use auth_layer::AuthContext;

#[derive(Clone)]
pub struct UserProfileService {
    user_profile_repository: UserProfileRepository,
    sleep_repository: SleepRepository,
}

impl UserProfileService {
    pub fn new(user_profile_repository: UserProfileRepository, sleep_repository: SleepRepository) -> Self {
        Self {
            user_profile_repository,
            sleep_repository,
        }
    }

    pub async fn get_user_profile(&self, user_id: &str, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        // Check if user can access this profile
        if !self.can_access_user_profile(auth_context, user_id) {
            return Err("You can only access your own profile".into());
        }

        self.user_profile_repository.get_user_profile(user_id).await
    }

    pub async fn update_user_profile(&self, user_id: &str, profile: &UserProfile, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        // Check if user can access this profile
        if !self.can_access_user_profile(auth_context, user_id) {
            return Err("You can only update your own profile".into());
        }

        // Validate the profile data
        if let Err(validation_errors) = profile.validate() {
            return Err(format!("Invalid profile data: {}", validation_errors).into());
        }

        self.user_profile_repository.update_user_profile(user_id, profile).await
    }

    pub async fn partial_update_user_profile(&self, user_id: &str, update_data: &Value, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        // Check if user can access this profile
        if !self.can_access_user_profile(auth_context, user_id) {
            return Err("You can only update your own profile".into());
        }

        self.user_profile_repository.partial_update_user_profile(user_id, update_data).await
    }

    pub async fn get_user_stats(&self, user_id: &str, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        // Check if user can access this profile
        if !self.can_access_user_profile(auth_context, user_id) {
            return Err("You can only access your own stats".into());
        }

        self.user_profile_repository.get_user_stats(user_id).await
    }

    pub async fn get_user_preferences(&self, user_id: &str, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        // Check if user can access this profile
        if !self.can_access_user_profile(auth_context, user_id) {
            return Err("You can only access your own preferences".into());
        }

        self.user_profile_repository.get_user_preferences(user_id).await
    }

    pub async fn update_user_preferences(&self, user_id: &str, preferences: &UserPreferences, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        // Check if user can access this profile
        if !self.can_access_user_profile(auth_context, user_id) {
            return Err("You can only update your own preferences".into());
        }

        self.user_profile_repository.update_user_preferences(user_id, preferences).await
    }

    pub async fn delete_user_profile(&self, user_id: &str, auth_context: &AuthContext) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Check if user can access this profile
        if !self.can_access_user_profile(auth_context, user_id) {
            return Err("You can only delete your own profile".into());
        }

        self.user_profile_repository.delete_user_profile(user_id).await
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
