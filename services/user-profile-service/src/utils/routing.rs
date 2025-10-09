use serde_json::Value;
use std::collections::HashMap;

use crate::utils::parse_query_string;

/// Route matcher for efficient path matching
pub struct RouteMatcher;

impl RouteMatcher {
    /// Match routes based on HTTP method and path patterns
    pub fn match_route(method: &str, path: &str) -> Option<Route> {
        match (method, path) {
            // User Profile Routes
            ("GET", path) if Self::is_profile_path(path) => Some(Route::GetUserProfile),
            ("PUT", path) if Self::is_profile_path(path) => Some(Route::UpdateUserProfile),
            ("DELETE", path) if Self::is_profile_path(path) => Some(Route::DeleteUserProfile),
            
            // Specific Profile Routes
            ("POST", "/api/user-profiles/profile/upload") => Some(Route::UploadProfile),
            ("GET", "/api/user-profiles/profile/stats") => Some(Route::GetUserStats),
            ("GET", "/api/user-profiles/profile/preferences") => Some(Route::GetUserPreferences),
            ("PUT", "/api/user-profiles/profile/preferences") => Some(Route::UpdateUserPreferences),
            
            // Sleep Routes
            ("GET", "/api/user-profiles/sleep") => Some(Route::GetSleepData),
            ("POST", "/api/user-profiles/sleep") => Some(Route::SaveSleepData),
            ("PUT", "/api/user-profiles/sleep") => Some(Route::UpdateSleepData),
            ("GET", "/api/user-profiles/sleep/history") => Some(Route::GetSleepHistory),
            ("GET", "/api/user-profiles/sleep/stats") => Some(Route::GetSleepStats),
            
            _ => None,
        }
    }

    /// Check if path is a profile path (base profile or with user ID)
    fn is_profile_path(path: &str) -> bool {
        path == "/api/user-profiles/profile" || path.starts_with("/api/user-profiles/profile/")
    }

    /// Extract query parameters for sleep routes
    pub fn extract_sleep_query_params(event: &Value) -> HashMap<String, String> {
        parse_query_string(event)
    }
}

/// Route enum for type-safe routing
#[derive(Debug, Clone, PartialEq)]
pub enum Route {
    // User Profile Routes
    GetUserProfile,
    UpdateUserProfile,
    DeleteUserProfile,
    UploadProfile,
    GetUserStats,
    GetUserPreferences,
    UpdateUserPreferences,
    
    // Sleep Routes
    GetSleepData,
    SaveSleepData,
    UpdateSleepData,
    GetSleepHistory,
    GetSleepStats,
}

impl Route {
    /// Get the controller method name for logging (optional)
    pub fn method_name(&self) -> &'static str {
        match self {
            Route::GetUserProfile => "GET user profile",
            Route::UpdateUserProfile => "PUT user profile",
            Route::DeleteUserProfile => "DELETE user profile",
            Route::UploadProfile => "POST upload",
            Route::GetUserStats => "GET user stats",
            Route::GetUserPreferences => "GET user preferences",
            Route::UpdateUserPreferences => "PUT user preferences",
            Route::GetSleepData => "GET sleep data",
            Route::SaveSleepData => "POST sleep data",
            Route::UpdateSleepData => "PUT sleep data",
            Route::GetSleepHistory => "GET sleep history",
            Route::GetSleepStats => "GET sleep stats",
        }
    }
}
