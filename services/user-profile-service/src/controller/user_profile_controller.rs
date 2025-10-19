use anyhow::Result;
use serde_json::Value;
use tracing::error;

use crate::models::*;
use crate::service::UserProfileService;
use crate::utils::{response_helpers, DataHelper, ResponseBuilder};
use auth_layer::AuthContext;

#[derive(Clone)]
pub struct UserProfileController {
    user_profile_service: UserProfileService,
}

impl UserProfileController {
    pub fn new(user_profile_service: UserProfileService) -> Self {
        Self {
            user_profile_service,
        }
    }

    pub async fn get_user_profile(
        &self,
        path: &str,
        auth_context: &AuthContext,
    ) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let user_id = self
            .extract_user_id_from_path(path)
            .unwrap_or_else(|| auth_context.user_id.clone());

        match self
            .user_profile_service
            .get_user_profile(&user_id, auth_context)
            .await
        {
            Ok(profile) => Ok(ResponseBuilder::ok(profile)),
            Err(e) => {
                error!("Error fetching user profile: {}", e);
                let msg = e.to_string();
                if msg.to_lowercase().contains("not found") {
                    Ok(ResponseBuilder::not_found("User profile not found"))
                } else if msg.contains("You can only access") {
                    Ok(ResponseBuilder::forbidden(&msg))
                } else {
                    Ok(ResponseBuilder::internal_server_error(
                        "Failed to fetch user profile",
                    ))
                }
            }
        }
    }

    pub async fn update_user_profile(
        &self,
        path: &str,
        body: &str,
        auth_context: &AuthContext,
    ) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let user_id = self
            .extract_user_id_from_path(path)
            .unwrap_or_else(|| auth_context.user_id.clone());

        let update_data: Result<UserProfile, _> = DataHelper::parse_json_to_type(body);
        match update_data {
            Ok(profile) => {
                match self
                    .user_profile_service
                    .update_user_profile(&user_id, &profile, auth_context)
                    .await
                {
                    Ok(updated_profile) => Ok(ResponseBuilder::ok(updated_profile)),
                    Err(e) => {
                        error!("Error updating user profile: {}", e);
                        let msg = e.to_string();
                        if msg.contains("Invalid profile data") {
                            Ok(ResponseBuilder::validation_error(&msg, None))
                        } else if msg.contains("You can only update") {
                            Ok(ResponseBuilder::forbidden(&msg))
                        } else {
                            Ok(ResponseBuilder::internal_server_error(
                                "Failed to update user profile",
                            ))
                        }
                    }
                }
            }
            Err(_) => {
                error!("Error parsing request body");
                Ok(response_helpers::invalid_json())
            }
        }
    }

    pub async fn partial_update_user_profile(
        &self,
        path: &str,
        body: &str,
        auth_context: &AuthContext,
    ) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let user_id = self
            .extract_user_id_from_path(path)
            .unwrap_or_else(|| auth_context.user_id.clone());

        let update_data: Result<Value, _> = DataHelper::parse_json_safe(body);
        match update_data {
            Ok(data) => {
                match self
                    .user_profile_service
                    .partial_update_user_profile(&user_id, &data, auth_context)
                    .await
                {
                    Ok(updated_profile) => Ok(ResponseBuilder::ok(updated_profile)),
                    Err(e) => {
                        error!("Error updating user profile: {}", e);
                        let msg = e.to_string();
                        if msg.contains("You can only update") {
                            Ok(ResponseBuilder::forbidden(&msg))
                        } else {
                            Ok(ResponseBuilder::internal_server_error(
                                "Failed to update user profile",
                            ))
                        }
                    }
                }
            }
            Err(_) => {
                error!("Error parsing request body");
                Ok(response_helpers::invalid_json())
            }
        }
    }

    pub async fn get_user_stats(
        &self,
        path: &str,
        auth_context: &AuthContext,
    ) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let user_id = self
            .extract_user_id_from_path(path)
            .unwrap_or_else(|| auth_context.user_id.clone());

        match self
            .user_profile_service
            .get_user_stats(&user_id, auth_context)
            .await
        {
            Ok(stats) => Ok(ResponseBuilder::ok(stats)),
            Err(e) => {
                error!("Error fetching user stats: {}", e);
                let msg = e.to_string();
                if msg.contains("You can only access") {
                    Ok(ResponseBuilder::forbidden(&msg))
                } else {
                    Ok(ResponseBuilder::internal_server_error(
                        "Failed to fetch user statistics",
                    ))
                }
            }
        }
    }

    pub async fn delete_user_profile(
        &self,
        path: &str,
        auth_context: &AuthContext,
    ) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let user_id = self
            .extract_user_id_from_path(path)
            .unwrap_or_else(|| auth_context.user_id.clone());

        match self
            .user_profile_service
            .delete_user_profile(&user_id, auth_context)
            .await
        {
            Ok(_) => Ok(response_helpers::deleted_successfully("User profile")),
            Err(e) => {
                error!("Error deleting user profile: {}", e);
                let msg = e.to_string();
                if msg.contains("You can only delete") {
                    Ok(ResponseBuilder::forbidden(&msg))
                } else {
                    Ok(ResponseBuilder::internal_server_error(
                        "Failed to delete user profile",
                    ))
                }
            }
        }
    }

    pub async fn get_user_preferences(
        &self,
        path: &str,
        auth_context: &AuthContext,
    ) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let user_id = self
            .extract_user_id_from_path(path)
            .unwrap_or_else(|| auth_context.user_id.clone());

        match self
            .user_profile_service
            .get_user_preferences(&user_id, auth_context)
            .await
        {
            Ok(preferences) => Ok(ResponseBuilder::ok(preferences)),
            Err(e) => {
                error!("Error fetching user preferences: {}", e);
                let msg = e.to_string();
                if msg.contains("You can only access") {
                    Ok(ResponseBuilder::forbidden(&msg))
                } else {
                    Ok(ResponseBuilder::internal_server_error(
                        "Failed to fetch user preferences",
                    ))
                }
            }
        }
    }

    pub async fn update_user_preferences(
        &self,
        path: &str,
        body: &str,
        auth_context: &AuthContext,
    ) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let user_id = self
            .extract_user_id_from_path(path)
            .unwrap_or_else(|| auth_context.user_id.clone());

        let preferences: Result<UserPreferences, _> = DataHelper::parse_json_to_type(body);
        match preferences {
            Ok(prefs) => {
                match self
                    .user_profile_service
                    .update_user_preferences(&user_id, &prefs, auth_context)
                    .await
                {
                    Ok(updated_prefs) => Ok(ResponseBuilder::ok(updated_prefs)),
                    Err(e) => {
                        error!("Error updating user preferences: {}", e);
                        let msg = e.to_string();
                        if msg.contains("You can only update") {
                            Ok(ResponseBuilder::forbidden(&msg))
                        } else {
                            Ok(ResponseBuilder::internal_server_error(
                                "Failed to update user preferences",
                            ))
                        }
                    }
                }
            }
            Err(_) => {
                error!("Error parsing preferences");
                Ok(response_helpers::invalid_data("Invalid preferences data"))
            }
        }
    }

    pub async fn save_device_token(
        &self,
        _path: &str,
        auth_context: &AuthContext,
        body: &Value,
    ) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let user_id = auth_context.user_id.clone();

        let token = body
            .get("token")
            .and_then(|v| v.as_str())
            .ok_or("Missing token")?;
        let platform = body
            .get("platform")
            .and_then(|v| v.as_str())
            .ok_or("Missing platform")?;

        match self
            .user_profile_service
            .save_device_token(&user_id, token, platform)
            .await
        {
            Ok(device_id) => Ok(ResponseBuilder::ok(serde_json::json!({
                "success": true,
                "message": "Device token saved successfully",
                "device_id": device_id
            }))),
            Err(e) => {
                error!("Error saving device token: {}", e);
                Ok(ResponseBuilder::internal_server_error(
                    "Failed to save device token",
                ))
            }
        }
    }

    pub async fn get_device_tokens(
        &self,
        path: &str,
        auth_context: &AuthContext,
    ) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let user_id = self
            .extract_user_id_from_path(path)
            .unwrap_or_else(|| auth_context.user_id.clone());

        match self
            .user_profile_service
            .get_device_tokens(&user_id, auth_context)
            .await
        {
            Ok(tokens) => Ok(ResponseBuilder::ok(serde_json::json!({
                "success": true,
                "tokens": tokens
            }))),
            Err(e) => {
                error!("Error fetching device tokens: {}", e);
                Ok(ResponseBuilder::internal_server_error(
                    "Failed to fetch device tokens",
                ))
            }
        }
    }

    pub async fn delete_device_token(
        &self,
        path: &str,
        auth_context: &AuthContext,
    ) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let user_id = self
            .extract_user_id_from_path(path)
            .unwrap_or_else(|| auth_context.user_id.clone());
        let device_id = path.split('/').last().ok_or("Missing device ID")?;

        match self
            .user_profile_service
            .delete_device_token(&user_id, device_id, auth_context)
            .await
        {
            Ok(_) => Ok(ResponseBuilder::ok(serde_json::json!({
                "success": true,
                "message": "Device token deleted successfully"
            }))),
            Err(e) => {
                error!("Error deleting device token: {}", e);
                Ok(ResponseBuilder::internal_server_error(
                    "Failed to delete device token",
                ))
            }
        }
    }

    fn extract_user_id_from_path(&self, path: &str) -> Option<String> {
        crate::utils::extract_user_id_from_path(path)
    }
}
