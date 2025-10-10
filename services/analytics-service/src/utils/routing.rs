use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq)]
pub enum Route {
    // Strength Progress Routes
    GetStrengthProgress,
    CreateStrengthProgress,

    // Body Measurement Routes
    GetBodyMeasurements,
    CreateBodyMeasurement,

    // Progress Chart Routes
    GetProgressCharts,
    CreateProgressChart,

    // Milestone Routes
    GetMilestones,
    CreateMilestone,

    // Achievement Routes
    GetAchievements,
    CreateAchievement,

    // Performance Trend Routes
    GetPerformanceTrends,

    // Workout Analytics Routes
    GetWorkoutAnalytics,
    GetWorkoutInsights,
    GenerateProgressReport,

    // Progress Photo Routes
    GetProgressPhotos,
    UploadProgressPhoto,
    UpdateProgressPhoto,
    DeleteProgressPhoto,
    GetProgressPhotoAnalytics,
    GetProgressPhotoTimeline,
}

pub struct RouteMatcher;

impl RouteMatcher {
    pub fn match_route(method: &str, path: &str) -> Option<Route> {
        match (method, path) {
            // Strength Progress routes
            ("GET", path) if path.starts_with("/api/analytics/strength-progress/") => {
                Some(Route::GetStrengthProgress)
            }
            ("POST", "/api/analytics/strength-progress") => Some(Route::CreateStrengthProgress),

            // Body Measurements routes
            ("GET", path) if path.starts_with("/api/analytics/body-measurements/") => {
                Some(Route::GetBodyMeasurements)
            }
            ("POST", "/api/analytics/body-measurements") => Some(Route::CreateBodyMeasurement),

            // Progress Charts routes
            ("GET", path) if path.starts_with("/api/analytics/charts/") => {
                Some(Route::GetProgressCharts)
            }
            ("POST", "/api/analytics/charts") => Some(Route::CreateProgressChart),

            // Milestones routes
            ("GET", path) if path.starts_with("/api/analytics/milestones/") => {
                Some(Route::GetMilestones)
            }
            ("POST", "/api/analytics/milestones") => Some(Route::CreateMilestone),

            // Achievements routes
            ("GET", path) if path.starts_with("/api/analytics/achievements/") => {
                Some(Route::GetAchievements)
            }
            ("POST", "/api/analytics/achievements") => Some(Route::CreateAchievement),

            // Performance Trends routes
            ("GET", path) if path.starts_with("/api/analytics/trends/") => {
                Some(Route::GetPerformanceTrends)
            }

            // Workout Analytics routes
            ("GET", path) if path.starts_with("/api/analytics/workout/") => {
                Some(Route::GetWorkoutAnalytics)
            }
            ("POST", "/api/analytics/reports") => Some(Route::GenerateProgressReport),

            // Progress Photos routes
            ("GET", path)
                if path.contains("/progress-photos")
                    && (path.contains("/analytics") || path.contains("/analytics?")) =>
            {
                Some(Route::GetProgressPhotoAnalytics)
            }
            ("GET", path)
                if path.contains("/progress-photos")
                    && (path.contains("/timeline") || path.contains("/timeline?")) =>
            {
                Some(Route::GetProgressPhotoTimeline)
            }
            ("GET", path)
                if path.contains("/progress-photos")
                    && !path.contains("/analytics")
                    && !path.contains("/timeline")
                    && !path.contains("/analytics?")
                    && !path.contains("/timeline?") =>
            {
                Some(Route::GetProgressPhotos)
            }
            ("POST", path) if path.contains("/progress-photos") && path.contains("/upload") => {
                Some(Route::UploadProgressPhoto)
            }
            ("POST", path)
                if path.contains("/progress-photos")
                    && !path.contains("/analytics")
                    && !path.contains("/timeline")
                    && !path.contains("/upload") =>
            {
                Some(Route::UploadProgressPhoto)
            }
            ("PUT", path) if path.contains("/progress-photos") => Some(Route::UpdateProgressPhoto),
            ("DELETE", path) if path.contains("/progress-photos") => {
                Some(Route::DeleteProgressPhoto)
            }

            _ => None,
        }
    }
}

pub fn extract_path_parameters(path: &str) -> HashMap<String, String> {
    let mut params = HashMap::new();

    // Extract user ID from various path patterns
    if let Some(user_id) = extract_user_id_from_path(path) {
        params.insert("userId".to_string(), user_id);
    }

    // Extract photo ID from progress photo paths
    if let Some(photo_id) = extract_photo_id_from_path(path) {
        params.insert("photoId".to_string(), photo_id);
    }

    params
}

fn extract_user_id_from_path(path: &str) -> Option<String> {
    let parts: Vec<&str> = path.split('/').collect();

    // Look for patterns like /api/analytics/{resource}/{user_id}
    if parts.len() >= 5 && parts[1] == "api" && parts[2] == "analytics" {
        let user_id = parts[4];
        if !user_id.is_empty() && user_id != "me" {
            return Some(user_id.to_string());
        }
    }

    // Look for progress-photos patterns
    if let Some(progress_index) = parts.iter().position(|&p| p == "progress-photos") {
        if progress_index + 1 < parts.len() {
            let user_id = parts[progress_index + 1];
            if !user_id.is_empty() && user_id != "me" {
                return Some(user_id.to_string());
            }
        }
    }

    None
}

fn extract_photo_id_from_path(path: &str) -> Option<String> {
    let parts: Vec<&str> = path.split('/').collect();

    // Look for patterns like /api/analytics/progress-photos/{user_id}/{photo_id}
    if let Some(progress_index) = parts.iter().position(|&p| p == "progress-photos") {
        if progress_index + 2 < parts.len() {
            let photo_id = parts[progress_index + 2];
            if !photo_id.is_empty() {
                return Some(photo_id.to_string());
            }
        }
    }

    None
}

pub fn parse_query_string(query: Option<&str>) -> HashMap<String, String> {
    let mut params = HashMap::new();

    if let Some(query_str) = query {
        for pair in query_str.split('&') {
            if let Some((key, value)) = pair.split_once('=') {
                params.insert(
                    urlencoding::decode(key).unwrap_or_default().to_string(),
                    urlencoding::decode(value).unwrap_or_default().to_string(),
                );
            }
        }
    }

    params
}
