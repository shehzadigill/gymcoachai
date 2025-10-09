use serde_json::Value;
use std::collections::HashMap;

/// Route matcher for efficient path matching
pub struct RouteMatcher;

impl RouteMatcher {
    /// Match routes based on HTTP method and path patterns
    pub fn match_route(method: &str, path: &str) -> Option<Route> {
        match (method, path) {
            // Workout Plan routes
            ("GET", "/api/workouts/plans") => Some(Route::GetWorkoutPlans),
            ("POST", "/api/workouts/plans") => Some(Route::CreateWorkoutPlan),
            ("GET", path)
                if path.starts_with("/api/workouts/plans/") && !path.contains("/schedule") =>
            {
                Some(Route::GetWorkoutPlan)
            }
            ("PUT", "/api/workouts/plans") => Some(Route::UpdateWorkoutPlan),
            ("DELETE", path) if path.starts_with("/api/workouts/plans/") => {
                Some(Route::DeleteWorkoutPlan)
            }

            // Workout Session routes
            ("GET", "/api/workouts/sessions") => Some(Route::GetWorkoutSessions),
            ("POST", "/api/workouts/sessions") => Some(Route::CreateWorkoutSession),
            ("GET", path) if path.starts_with("/api/workouts/sessions/") => {
                Some(Route::GetWorkoutSession)
            }
            ("PUT", "/api/workouts/sessions") => Some(Route::UpdateWorkoutSession),
            ("DELETE", path) if path.starts_with("/api/workouts/sessions/") => {
                Some(Route::DeleteWorkoutSession)
            }

            // Exercise routes
            ("GET", "/api/workouts/exercises") => Some(Route::GetExercises),
            ("POST", "/api/workouts/exercises") => Some(Route::CreateExercise),
            ("GET", path)
                if path.starts_with("/api/workouts/exercises/") && !path.ends_with("/clone") =>
            {
                Some(Route::GetExercise)
            }
            ("PUT", "/api/workouts/exercises") => Some(Route::UpdateExercise),
            ("POST", path)
                if path.starts_with("/api/workouts/exercises/") && path.ends_with("/clone") =>
            {
                Some(Route::CloneExercise)
            }
            ("DELETE", path) if path.starts_with("/api/workouts/exercises/") => {
                Some(Route::DeleteExercise)
            }

            // Analytics routes
            ("GET", "/api/workouts/analytics") => Some(Route::GetWorkoutAnalytics),
            ("GET", "/api/workouts/insights") => Some(Route::GetWorkoutInsights),
            ("GET", "/api/workouts/history") => Some(Route::GetWorkoutHistory),

            // Log Activity route
            ("POST", "/api/workouts/log-activity") => Some(Route::LogActivity),

            // Scheduled Workout routes
            ("POST", path)
                if path.starts_with("/api/workouts/plans/") && path.contains("/schedule") =>
            {
                Some(Route::ScheduleWorkoutPlan)
            }
            ("GET", "/api/workouts/schedules") => Some(Route::GetScheduledWorkouts),
            ("PUT", path) if path.starts_with("/api/workouts/schedules/") => {
                Some(Route::UpdateScheduledWorkout)
            }
            ("DELETE", path) if path.starts_with("/api/workouts/schedules/") => {
                Some(Route::DeleteScheduledWorkout)
            }

            _ => None,
        }
    }

    /// Check if path is a workout plan path
    fn is_workout_plan_path(path: &str) -> bool {
        path.starts_with("/api/workouts/plans") || path.starts_with("/workouts/plans")
    }

    /// Check if path is a workout session path
    fn is_workout_session_path(path: &str) -> bool {
        path.starts_with("/api/workouts/sessions") || path.starts_with("/workouts/sessions")
    }

    /// Check if path is an exercise path
    fn is_exercise_path(path: &str) -> bool {
        path.starts_with("/api/workouts/exercises") || path.starts_with("/workouts/exercises")
    }

    /// Check if path is an analytics path
    fn is_analytics_path(path: &str) -> bool {
        path.starts_with("/api/workouts/analytics")
            || path.starts_with("/api/workouts/insights")
            || path.starts_with("/api/workouts/history")
            || path.starts_with("/workouts/analytics")
            || path.starts_with("/workouts/insights")
            || path.starts_with("/workouts/history")
    }

    /// Check if path is a scheduled workout path
    fn is_scheduled_workout_path(path: &str) -> bool {
        path.starts_with("/api/workouts/schedules")
            || path.starts_with("/workouts/schedules")
            || (path.starts_with("/api/workouts/plans/") && path.contains("/schedule"))
            || (path.starts_with("/workouts/plans/") && path.contains("/schedule"))
    }
}

/// Route enumeration for type-safe routing
#[derive(Debug, Clone, PartialEq)]
pub enum Route {
    // Workout Plan Routes
    GetWorkoutPlans,
    CreateWorkoutPlan,
    GetWorkoutPlan,
    UpdateWorkoutPlan,
    DeleteWorkoutPlan,

    // Workout Session Routes
    GetWorkoutSessions,
    CreateWorkoutSession,
    GetWorkoutSession,
    UpdateWorkoutSession,
    DeleteWorkoutSession,

    // Exercise Routes
    GetExercises,
    CreateExercise,
    GetExercise,
    UpdateExercise,
    CloneExercise,
    DeleteExercise,

    // Analytics Routes
    GetWorkoutAnalytics,
    GetWorkoutInsights,
    GetWorkoutHistory,

    // Log Activity Route
    LogActivity,

    // Scheduled Workout Routes
    ScheduleWorkoutPlan,
    GetScheduledWorkouts,
    UpdateScheduledWorkout,
    DeleteScheduledWorkout,
}

/// Extract path parameters from the path string
pub fn extract_path_parameters(path: &str) -> HashMap<String, String> {
    let mut params = HashMap::new();

    // Extract plan ID from workout plan paths
    if let Some(plan_id) = path.strip_prefix("/api/workouts/plans/") {
        if !plan_id.contains("/") {
            params.insert("planId".to_string(), plan_id.to_string());
        } else if let Some(actual_plan_id) = plan_id.split("/").next() {
            params.insert("planId".to_string(), actual_plan_id.to_string());
        }
    }

    // Extract session ID from workout session paths
    if let Some(session_id) = path.strip_prefix("/api/workouts/sessions/") {
        params.insert("sessionId".to_string(), session_id.to_string());
    }

    // Extract exercise ID from exercise paths
    if let Some(exercise_id) = path.strip_prefix("/api/workouts/exercises/") {
        if exercise_id.ends_with("/clone") {
            let actual_id = exercise_id.strip_suffix("/clone").unwrap_or(exercise_id);
            params.insert("exerciseId".to_string(), actual_id.to_string());
        } else {
            params.insert("exerciseId".to_string(), exercise_id.to_string());
        }
    }

    // Extract schedule ID from scheduled workout paths
    if let Some(schedule_id) = path.strip_prefix("/api/workouts/schedules/") {
        params.insert("scheduleId".to_string(), schedule_id.to_string());
    }

    params
}

/// Parse query string parameters
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
