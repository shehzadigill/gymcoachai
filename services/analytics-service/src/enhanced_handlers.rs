use lambda_runtime::{Error as LambdaError};
use aws_lambda_events::event::apigw::{ApiGatewayProxyRequest, ApiGatewayProxyResponse};
use serde_json::{json, Value};
use uuid::Uuid;
use std::collections::HashMap;
use chrono::Utc;
use base64::{engine::general_purpose, Engine as _};

use crate::enhanced_database::AnalyticsDatabase;
use crate::models::*;

pub struct EnhancedHandlers {
    pub database: AnalyticsDatabase,
}

impl EnhancedHandlers {
    pub fn new(database: AnalyticsDatabase) -> Self {
        Self { database }
    }

    // Helper Methods
    fn extract_user_id(&self, request: &ApiGatewayProxyRequest) -> Result<String, String> {
        // First try to get from path_parameters
        if let Some(user_id) = request.path_parameters.get("user_id") {
            return Ok(user_id.clone());
        }
        
        // If not in path_parameters, parse from the URL path manually
        if let Some(path) = &request.path {
            // Expected format: /api/analytics/progress-photos/{user_id}/...
            let parts: Vec<&str> = path.split('/').collect();
            if parts.len() >= 5 && parts[1] == "api" && parts[2] == "analytics" && parts[3] == "progress-photos" {
                return Ok(parts[4].to_string());
            }
        }
        
        Err("Missing user_id parameter".to_string())
    }

    fn extract_photo_id(&self, request: &ApiGatewayProxyRequest) -> Result<String, String> {
        // First try to get from path_parameters
        if let Some(photo_id) = request.path_parameters.get("photo_id") {
            return Ok(photo_id.clone());
        }
        
        // If not in path_parameters, parse from the URL path manually
        if let Some(path) = &request.path {
            // Expected format: /api/analytics/progress-photos/{user_id}/{photo_id}
            let parts: Vec<&str> = path.split('/').collect();
            if parts.len() >= 6 && parts[1] == "api" && parts[2] == "analytics" && parts[3] == "progress-photos" {
                return Ok(parts[5].to_string());
            }
        }
        
        Err("Missing photo_id parameter".to_string())
    }

    fn create_success_response<T: serde::Serialize>(&self, data: &T) -> ApiGatewayProxyResponse {
        let mut headers = aws_lambda_events::http::HeaderMap::new();
        let cors_headers = self.create_cors_headers();
        for (key, value) in cors_headers {
            if let Ok(header_name) = key.parse::<aws_lambda_events::http::HeaderName>() {
                if let Ok(header_value) = value.parse::<aws_lambda_events::http::HeaderValue>() {
                    headers.insert(header_name, header_value);
                }
            }
        }
        
        ApiGatewayProxyResponse {
            status_code: 200,
            headers,
            multi_value_headers: aws_lambda_events::http::HeaderMap::new(),
            body: Some(aws_lambda_events::encodings::Body::Text(serde_json::to_string(data).unwrap_or_default())),
            is_base64_encoded: false,
        }
    }

    fn create_error_response(&self, status_code: i64, message: &str) -> ApiGatewayProxyResponse {
        let mut headers = aws_lambda_events::http::HeaderMap::new();
        let cors_headers = self.create_cors_headers();
        for (key, value) in cors_headers {
            if let Ok(header_name) = key.parse::<aws_lambda_events::http::HeaderName>() {
                if let Ok(header_value) = value.parse::<aws_lambda_events::http::HeaderValue>() {
                    headers.insert(header_name, header_value);
                }
            }
        }
        
        ApiGatewayProxyResponse {
            status_code,
            headers,
            multi_value_headers: aws_lambda_events::http::HeaderMap::new(),
            body: Some(aws_lambda_events::encodings::Body::Text(json!({"error": message}).to_string())),
            is_base64_encoded: false,
        }
    }

    fn create_cors_headers(&self) -> HashMap<String, String> {
        let mut headers = HashMap::new();
        headers.insert("Access-Control-Allow-Origin".to_string(), "*".to_string());
        headers.insert("Access-Control-Allow-Methods".to_string(), "GET, POST, PUT, DELETE, OPTIONS".to_string());
        headers.insert("Access-Control-Allow-Headers".to_string(), "Content-Type, Authorization".to_string());
        headers.insert("Content-Type".to_string(), "application/json".to_string());
        headers
    }

    // Main handler method
    pub async fn handle_request(&self, event: lambda_runtime::LambdaEvent<ApiGatewayProxyRequest>) -> Result<ApiGatewayProxyResponse, String> {
        let request = event.payload;
        
        let method = &request.http_method;
        let path = request.path.as_deref().unwrap_or("");
        
        println!("Enhanced handler received: {} {}", method, path);

        match (method.as_str(), path) {
            ("GET", path) if path.contains("/workout-insights") => {
                self.handle_get_workout_insights(&request).await
            }
            ("GET", path) if path.contains("/workout-history") => {
                self.handle_get_workout_history(&request).await
            }
            ("GET", path) if path.contains("/strength-progress") => {
                self.handle_get_strength_progress(&request).await
            }
            ("GET", path) if path.contains("/body-measurements") => {
                self.handle_get_body_measurements(&request).await
            }
            ("GET", path) if path.contains("/milestones") => {
                self.handle_get_milestones(&request).await
            }
            // Progress Photos routes
            ("GET", path) if path.contains("/progress-photos") && path.contains("/analytics") => {
                self.handle_get_progress_photo_analytics(&request).await
            }
            ("GET", path) if path.contains("/progress-photos") && path.contains("/timeline") => {
                self.handle_get_progress_photo_timeline(&request).await
            }
            ("POST", path) if path.contains("/progress-photos") && path.contains("/compare") => {
                self.handle_get_progress_photo_comparison(&request).await
            }
            ("POST", path) if path.contains("/progress-photos") && path.contains("/upload") => {
                self.handle_upload_progress_photo(&request).await
            }
            ("GET", path) if path.contains("/progress-photos") => {
                self.handle_get_progress_photos(&request).await
            }
            ("PUT", path) if path.contains("/progress-photos") => {
                self.handle_update_progress_photo(&request).await
            }
            ("DELETE", path) if path.contains("/progress-photos") => {
                self.handle_delete_progress_photo(&request).await
            }
            ("OPTIONS", _) => {
                Ok(self.create_cors_response())
            }
            _ => {
                Ok(self.create_error_response(404, "Endpoint not found"))
            }
        }
    }

    fn create_cors_response(&self) -> ApiGatewayProxyResponse {
        let mut headers = aws_lambda_events::http::HeaderMap::new();
        let cors_headers = self.create_cors_headers();
        for (key, value) in cors_headers {
            if let Ok(header_name) = key.parse::<aws_lambda_events::http::HeaderName>() {
                if let Ok(header_value) = value.parse::<aws_lambda_events::http::HeaderValue>() {
                    headers.insert(header_name, header_value);
                }
            }
        }
        
        ApiGatewayProxyResponse {
            status_code: 200,
            headers,
            multi_value_headers: aws_lambda_events::http::HeaderMap::new(),
            body: Some(aws_lambda_events::encodings::Body::Text("".to_string())),
            is_base64_encoded: false,
        }
    }

    // Individual handler methods (stubs for now)
    async fn handle_get_workout_insights(&self, request: &ApiGatewayProxyRequest) -> Result<ApiGatewayProxyResponse, String> {
        let user_id = self.extract_user_id(request)?;
        match self.database.get_workout_insights(&user_id).await {
            Ok(insights) => Ok(self.create_success_response(&insights)),
            Err(e) => Ok(self.create_error_response(500, &format!("Failed to get workout insights: {}", e))),
        }
    }

    async fn handle_get_workout_history(&self, request: &ApiGatewayProxyRequest) -> Result<ApiGatewayProxyResponse, String> {
        let user_id = self.extract_user_id(request)?;
        let workout_request = crate::models::GetWorkoutHistoryRequest {
            user_id,
            start_date: None,
            end_date: None,
            workout_type: None,
            limit: Some(50),
            offset: Some(0),
            sort_by: Some("date".to_string()),
            sort_order: Some("desc".to_string()),
        };
        
        match self.database.get_workout_history(&workout_request).await {
            Ok(history) => Ok(self.create_success_response(&history)),
            Err(e) => Ok(self.create_error_response(500, &format!("Failed to get workout history: {}", e))),
        }
    }

    async fn handle_get_strength_progress(&self, request: &ApiGatewayProxyRequest) -> Result<ApiGatewayProxyResponse, String> {
        let user_id = self.extract_user_id(request)?;
        
        match self.database.get_strength_progress(&user_id, None, None, None).await {
            Ok(progress) => Ok(self.create_success_response(&progress)),
            Err(e) => Ok(self.create_error_response(500, &format!("Failed to get strength progress: {}", e))),
        }
    }

    async fn handle_get_body_measurements(&self, request: &ApiGatewayProxyRequest) -> Result<ApiGatewayProxyResponse, String> {
        let user_id = self.extract_user_id(request)?;
        
        match self.database.get_body_measurements(&user_id, None, None, None).await {
            Ok(measurements) => Ok(self.create_success_response(&measurements)),
            Err(e) => Ok(self.create_error_response(500, &format!("Failed to get body measurements: {}", e))),
        }
    }

    async fn handle_get_milestones(&self, request: &ApiGatewayProxyRequest) -> Result<ApiGatewayProxyResponse, String> {
        let user_id = self.extract_user_id(request)?;
        match self.database.get_milestones(&user_id).await {
            Ok(milestones) => Ok(self.create_success_response(&milestones)),
            Err(e) => Ok(self.create_error_response(500, &format!("Failed to get milestones: {}", e))),
        }
    }

    // Progress Photos Handlers
    pub async fn handle_get_progress_photos(&self, request: &ApiGatewayProxyRequest) -> Result<ApiGatewayProxyResponse, String> {
        let user_id = self.extract_user_id(request)?;
        
        // Parse query parameters safely
        let photo_type = request.query_string_parameters.first("photo_type").map(String::from);
        let start_date = request.query_string_parameters.first("start_date").map(String::from);
        let end_date = request.query_string_parameters.first("end_date").map(String::from);
        let limit = request.query_string_parameters.first("limit")
            .and_then(|l| l.parse::<u32>().ok())
            .unwrap_or(50);

        match self.database.get_progress_photos(&user_id, photo_type.as_deref(), start_date.as_deref(), end_date.as_deref(), Some(limit)).await {
            Ok(photos) => Ok(self.create_success_response(&photos)),
            Err(e) => Ok(self.create_error_response(500, &format!("Failed to get progress photos: {}", e))),
        }
    }

    pub async fn handle_upload_progress_photo(&self, request: &ApiGatewayProxyRequest) -> Result<ApiGatewayProxyResponse, String> {
        let user_id = self.extract_user_id(request)?;
        
        // Parse request body for base64 encoded image data
        let body: Value = request.body.as_ref()
            .and_then(|b| serde_json::from_str(b).ok())
            .ok_or_else(|| "Invalid request body".to_string())?;

        let image_data = body.get("imageData")
            .and_then(|data| data.as_str())
            .ok_or_else(|| "Missing imageData field".to_string())?;

        let photo_type = body.get("photoType")
            .and_then(|t| t.as_str())
            .unwrap_or("progress")
            .to_string();

        let content_type = body.get("contentType")
            .and_then(|ct| ct.as_str())
            .unwrap_or("image/jpeg");

        let notes = body.get("notes")
            .and_then(|n| n.as_str())
            .map(String::from);

        let workout_session_id = body.get("workoutSessionId")
            .and_then(|id| id.as_str())
            .map(String::from);

        // Decode base64 image data
        let file_data = general_purpose::STANDARD
            .decode(image_data)
            .map_err(|_| "Invalid base64 image data".to_string())?;

        // Validate file size (max 10MB)
        if file_data.len() > 10 * 1024 * 1024 {
            return Ok(self.create_error_response(413, "File too large. Maximum size is 10MB"));
        }

        // Generate unique photo ID and timestamp
        let photo_id = Uuid::new_v4().to_string();
        let taken_at = Utc::now().to_rfc3339();
        let created_at = taken_at.clone();

        // Upload to S3
        match self.database.upload_progress_photo_to_s3(&user_id, &photo_id, content_type, file_data).await {
            Ok(photo_url) => {
                // Create progress photo record
                let progress_photo = ProgressPhoto {
                    id: photo_id.clone(),
                    user_id: user_id.clone(),
                    workout_session_id,
                    photo_type,
                    photo_url: photo_url.clone(),
                    s3_key: format!("users/{}/progress-photos/{}", user_id, photo_id),
                    taken_at: taken_at.clone(),
                    notes,
                    created_at: created_at.clone(),
                    updated_at: created_at,
                    tags: Vec::new(),
                    metadata: None,
                };

                // Save to database
                match self.database.create_progress_photo(&progress_photo).await {
                    Ok(_) => Ok(self.create_success_response(&progress_photo)),
                    Err(e) => Ok(self.create_error_response(500, &format!("Failed to save progress photo: {}", e))),
                }
            },
            Err(e) => Ok(self.create_error_response(500, &format!("Failed to upload photo: {}", e))),
        }
    }

    pub async fn handle_update_progress_photo(&self, request: &ApiGatewayProxyRequest) -> Result<ApiGatewayProxyResponse, String> {
        let photo_id = self.extract_photo_id(request)?;

        let body: Value = request.body.as_ref()
            .and_then(|b| serde_json::from_str(b).ok())
            .unwrap_or(json!({}));

        let user_id = self.extract_user_id(request)?;
        
        // Extract taken_at from query parameters
        let payload = serde_json::to_value(request).map_err(|e| e.to_string())?;
        let taken_at = payload["queryStringParameters"]["taken_at"]
            .as_str()
            .ok_or_else(|| "Missing taken_at parameter".to_string())?;
            
        match self.database.update_progress_photo(&user_id, &photo_id, taken_at, &body).await {
            Ok(photo) => Ok(self.create_success_response(&photo)),
            Err(e) => Ok(self.create_error_response(500, &format!("Failed to update progress photo: {}", e))),
        }
    }

    pub async fn handle_delete_progress_photo(&self, request: &ApiGatewayProxyRequest) -> Result<ApiGatewayProxyResponse, String> {
        let photo_id = self.extract_photo_id(request)?;

        let user_id = self.extract_user_id(request)?;
        
        // Extract taken_at from query parameters or request body
        let payload = serde_json::to_value(request).map_err(|e| e.to_string())?;
        let taken_at = payload["queryStringParameters"]["taken_at"]
            .as_str()
            .ok_or_else(|| "Missing taken_at parameter".to_string())?;
            
        match self.database.delete_progress_photo(&user_id, &photo_id, taken_at).await {
            Ok(_) => Ok(self.create_success_response(&json!({"message": "Photo deleted successfully"}))),
            Err(e) => Ok(self.create_error_response(500, &format!("Failed to delete progress photo: {}", e))),
        }
    }

    pub async fn handle_get_progress_photo_analytics(&self, request: &ApiGatewayProxyRequest) -> Result<ApiGatewayProxyResponse, String> {
        let user_id = self.extract_user_id(request)?;
        let payload = serde_json::to_value(request).map_err(|e| e.to_string())?;
        let time_range = payload["queryStringParameters"]["time_range"].as_str().unwrap_or("30d");

        match self.database.get_progress_photo_analytics(&user_id, &time_range).await {
            Ok(analytics) => Ok(self.create_success_response(&analytics)),
            Err(e) => Ok(self.create_error_response(500, &format!("Failed to get progress photo analytics: {}", e))),
        }
    }

    pub async fn handle_get_progress_photo_comparison(&self, request: &ApiGatewayProxyRequest) -> Result<ApiGatewayProxyResponse, String> {
        let body: Value = request.body.as_ref()
            .and_then(|b| serde_json::from_str(b).ok())
            .ok_or_else(|| "Invalid request body".to_string())?;

        let photo_ids: Vec<String> = body.get("photoIds")
            .and_then(|ids| ids.as_array())
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
            .ok_or_else(|| "Missing or invalid photoIds".to_string())?;

        let user_id = self.extract_user_id(request)?;
        match self.database.get_progress_photo_comparison(&user_id, &photo_ids).await {
            Ok(comparison) => Ok(self.create_success_response(&comparison)),
            Err(e) => Ok(self.create_error_response(500, &format!("Failed to create photo comparison: {}", e))),
        }
    }

    pub async fn handle_get_progress_photo_timeline(&self, request: &ApiGatewayProxyRequest) -> Result<ApiGatewayProxyResponse, String> {
        let user_id = self.extract_user_id(request)?;
        let payload = serde_json::to_value(request).map_err(|e| e.to_string())?;
        let photo_type = payload["queryStringParameters"]["photo_type"].as_str().map(String::from);

        match self.database.get_progress_photo_timeline(&user_id, photo_type.as_deref()).await {
            Ok(timeline) => Ok(self.create_success_response(&timeline)),
            Err(e) => Ok(self.create_error_response(500, &format!("Failed to get progress photo timeline: {}", e))),
        }
    }
}