use lambda_runtime::{Error as LambdaError, L        let exercise        let measurement_type = query_params.first("type").map(|s| s.as_str());
        let _start_date = query_params.first("start_date").map(|s| s.as_str());
        let _end_date = query_params.first("end_date").map(|s| s.as_str()); = query_params.first("exercise_id").map(|s| s.as_str());
        let _start_date = query_params.first("start_date").map(|s| s.as_str());
        let _end_date = query_params.first("end_date").map(|s| s.as_str());daEvent};
use aws_lambda_events::event::apigw::{ApiGatewayProxyRequest, ApiGatewayProxyResponse};
use serde_json::{json, Value};
use uuid::Uuid;
use chrono::Utc;
use std::collections::HashMap;

use crate::enhanced_database::AnalyticsDatabase;
use crate::models::*;

pub struct EnhancedHandlers {
    pub database: AnalyticsDatabase,
}

impl EnhancedHandlers {
    pub fn new(database: AnalyticsDatabase) -> Self {
        Self { database }
    }

    // Analytics Handlers
    async fn handle_get_analytics(
        &self,
        request: &ApiGatewayProxyRequest,
    ) -> Result<ApiGatewayProxyResponse, LambdaError> {
        let user_id = self.extract_user_id(request)?;
        let query_params = &request.query_string_parameters;
        
        let _start_date = query_params.first("start_date").map(|s| s.as_str());
        let _end_date = query_params.first("end_date").map(|s| s.as_str());

        match self.database.get_workout_insights(&user_id).await {
            Ok(analytics) => Ok(self.create_success_response(&analytics)),
            Err(e) => Ok(self.create_error_response(500, &format!("Database error: {}", e))),
        }
    }

    // Strength Progress Handlers  
    async fn handle_get_strength_progress(
        &self,
        request: &ApiGatewayProxyRequest,
    ) -> Result<ApiGatewayProxyResponse, LambdaError> {
        let user_id = self.extract_user_id(request)?;
        let query_params = &request.query_string_parameters;
        
        let exercise_id = query_params.first("exercise_id").map(|s| s.as_str());
        let _start_date = query_params.get("start_date").map(|s| s.as_str());
        let _end_date = query_params.get("end_date").map(|s| s.as_str());

        match self.database.get_strength_progress(&user_id, exercise_id, None, None).await {
            Ok(progress) => Ok(self.create_success_response(&progress)),
            Err(e) => Ok(self.create_error_response(500, &format!("Database error: {}", e))),
        }
    }

    // Body Measurements Handlers
    async fn handle_get_body_measurements(
        &self,
        request: &ApiGatewayProxyRequest,
    ) -> Result<ApiGatewayProxyResponse, LambdaError> {
        let user_id = self.extract_user_id(request)?;
        let query_params = &request.query_string_parameters;
        
        let measurement_type = query_params.first("type").map(|s| s.as_str());
        let _start_date = query_params.get("start_date").map(|s| s.as_str());
        let _end_date = query_params.get("end_date").map(|s| s.as_str());

        match self.database.get_body_measurements(&user_id, measurement_type, None, None).await {
            Ok(measurements) => Ok(self.create_success_response(&measurements)),
            Err(e) => Ok(self.create_error_response(500, &format!("Database error: {}", e))),
        }
    }

    // Milestone Handlers
    async fn handle_create_milestone(
        &self,
        request: &ApiGatewayProxyRequest,
    ) -> Result<ApiGatewayProxyResponse, LambdaError> {
        let user_id = self.extract_user_id(request)?;
        
        let body: Value = serde_json::from_str(
            request.body.as_ref().unwrap_or(&"{}".to_string())
        ).map_err(|_| LambdaError::from("Invalid JSON body"))?;

        let milestone = Milestone {
            id: Uuid::new_v4().to_string(),
            user_id: user_id.to_string(),
            milestone_type: body.get("milestone_type")
                .and_then(|v| v.as_str())
                .unwrap_or("strength")
                .to_string(),
            title: body.get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("New Milestone")
                .to_string(),
            description: body.get("description")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            target_value: body.get("target_value")
                .and_then(|v| v.as_f64())
                .unwrap_or(0.0) as f32,
            current_value: 0.0,
            unit: body.get("unit")
                .and_then(|v| v.as_str())
                .unwrap_or("kg")
                .to_string(),
            target_date: body.get("target_date")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            created_at: chrono::Utc::now().to_rfc3339(),
            status: "active".to_string(),
            progress_percentage: 0.0,
            achieved: false,
            achieved_at: None,
            metadata: None,
        };

        match self.database.create_milestone(&milestone).await {
            Ok(_) => Ok(self.create_success_response(&milestone)),
            Err(e) => Ok(self.create_error_response(500, &format!("Database error: {}", e))),
        }
    }

    // Export Data Handler
    async fn handle_export_data(
        &self,
        _request: &ApiGatewayProxyRequest,
    ) -> Result<ApiGatewayProxyResponse, LambdaError> {
        // Simplified implementation
        let export_data = json!({
            "status": "success",
            "message": "Data export requested"
        });
        Ok(self.create_success_response(&export_data))
    }

    // Data Analytics Handler
    async fn handle_data_analytics(
        &self,
        _request: &ApiGatewayProxyRequest,
    ) -> Result<ApiGatewayProxyResponse, LambdaError> {
        // Simplified implementation
        let analytics_data = json!({
            "status": "success",
            "message": "Analytics data retrieved"
        });
        Ok(self.create_success_response(&analytics_data))
    }

    // Workout History Handler
    async fn handle_get_workout_history(
        &self,
        request: &ApiGatewayProxyRequest,
    ) -> Result<ApiGatewayProxyResponse, LambdaError> {
        let user_id = self.extract_user_id(request)?;
        let query_params = &request.query_string_parameters;
        
        let history_request = GetWorkoutHistoryRequest {
            user_id,
            start_date: query_params.first("start_date").map(|s| s.to_string()),
            end_date: query_params.first("end_date").map(|s| s.to_string()),
            workout_type: query_params.first("workout_type").map(|s| s.to_string()),
            limit: query_params.first("limit").and_then(|s| s.parse().ok()),
            offset: query_params.first("offset").and_then(|s| s.parse().ok()),
            sort_by: query_params.first("sort_by").map(|s| s.to_string()),
            sort_order: query_params.first("sort_order").map(|s| s.to_string()),
        };

        // Simplified response
        let history = json!({
            "status": "success",
            "request": history_request
        });
        
        Ok(self.create_success_response(&history))
    }

    // Helper Methods
    fn extract_user_id(&self, request: &ApiGatewayProxyRequest) -> Result<String, String> {
        request
            .path_parameters
            .get("user_id")
            .map(|id| id.clone())
            .ok_or_else(|| "Missing user_id parameter".to_string())
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
}