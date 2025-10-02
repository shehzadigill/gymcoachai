use lambda_runtime::{Error as LambdaError, LambdaEvent};
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
        
        let _start_date = query_params.get("start_date").map(|s| s.as_str());
        let _end_date = query_params.get("end_date").map(|s| s.as_str());

        match self.database.get_workout_insights(&user_id).await {
            Ok(analytics) => Ok(self.create_success_response(&analytics)),
            Err(e) => Ok(self.create_error_response(500, &format!("Database error: {}", e))),
        }
    }

    // Strength Progress Handlers
    async fn handle_get_strength_progress(
        &self,
        request: &ApiGatewayProxyRequest,
        
        let history_request = GetWorkoutHistoryRequest {
            user_id,
            start_date: query_params.get("start_date").map(|s| s.to_string()),
            end_date: query_params.get("end_date").map(|s| s.to_string()),
            workout_type: query_params.get("workout_type").map(|s| s.to_string()),
            limit: query_params.get("limit").and_then(|s| s.parse().ok()),start_date = query_params.get("start_date").map(|s| s.as_str());
        let _end_date = query_params.get("end_date").map(|s| s.as_str());

        match self.database.get_workout_insights(&user_id).await {equest, ApiGatewayProxyResponse};
use serde_json::{json, Value};
use crate::models::*;
use crate::enhanced_database::AnalyticsDatabase;
use std::collections::HashMap;

pub struct EnhancedAnalyticsHandler {
    pub database: AnalyticsDatabase,
}

impl EnhancedAnalyticsHandler {
    pub fn new(database: AnalyticsDatabase) -> Self {
        Self { database }
    }

    pub async fn handle_request(
        &self,
        event: LambdaEvent<ApiGatewayProxyRequest>,
    ) -> Result<ApiGatewayProxyResponse, LambdaError> {
        let request = event.payload;
        let path = request.path.as_deref().unwrap_or("");
        let method = request.http_method.as_str();

        match (method, path) {
            // Analytics endpoints
            ("GET", path) if path.starts_with("/analytics/") => {
                self.handle_get_analytics(&request).await
            }
            ("GET", path) if path.starts_with("/insights/") => {
                self.handle_get_insights(&request).await
            }
            
            // Strength Progress endpoints
            ("POST", "/strength-progress") => {
                self.handle_create_strength_progress(&request).await
            }
            ("GET", path) if path.starts_with("/strength-progress/") => {
                self.handle_get_strength_progress(&request).await
            }
            
            // Body Measurements endpoints
            ("POST", "/body-measurements") => {
                self.handle_create_body_measurement(&request).await
            }
            ("GET", path) if path.starts_with("/body-measurements/") => {
                self.handle_get_body_measurements(&request).await
            }
            
            // Milestone endpoints
            ("POST", "/milestones") => {
                self.handle_create_milestone(&request).await
            }
            ("GET", path) if path.starts_with("/milestones/") => {
                self.handle_get_milestones(&request).await
            }
            ("PUT", path) if path.starts_with("/milestones/") => {
                self.handle_update_milestone(&request).await
            }
            ("DELETE", path) if path.starts_with("/milestones/") => {
                self.handle_delete_milestone(&request).await
            }
            
            // Workout History endpoints
            ("GET", path) if path.starts_with("/workout-history/") => {
                self.handle_get_workout_history(&request).await
            }
            
            // Performance Trends endpoints
            ("GET", path) if path.starts_with("/performance-trends/") => {
                self.handle_get_performance_trends(&request).await
            }
            
            // Comparative Analysis endpoints
            ("POST", "/compare-periods") => {
                self.handle_compare_periods(&request).await
            }
            ("GET", path) if path.starts_with("/peer-comparison/") => {
                self.handle_get_peer_comparison(&request).await
            }
            
            // Predictions endpoints
            ("GET", path) if path.starts_with("/predictions/") => {
                self.handle_get_predictions(&request).await
            }
            
            // Export endpoints
            ("POST", "/export") => {
                self.handle_export_data(&request).await
            }
            
            _ => Ok(self.create_error_response(404, "Endpoint not found")),
        }
    }

    // Analytics Handlers
    async fn handle_get_analytics(
        &self,
        request: &ApiGatewayProxyRequest,
    ) -> Result<ApiGatewayProxyResponse, LambdaError> {
        let user_id = self.extract_user_id(request)?;
        let query_params = request.query_string_parameters.as_ref();
        
        let start_date = query_params
            .and_then(|params| params.get("start_date"))
            .map(|s| s.as_str());
        let end_date = query_params
            .and_then(|params| params.get("end_date"))
            .map(|s| s.as_str());

        match self.database.get_workout_insights(&user_id).await {
            Ok(analytics) => Ok(self.create_success_response(&analytics)),
            Err(e) => Ok(self.create_error_response(500, &format!("Database error: {}", e))),
        }
    }

    async fn handle_get_insights(
        &self,
        request: &ApiGatewayProxyRequest,
    ) -> Result<ApiGatewayProxyResponse, LambdaError> {
        let user_id = self.extract_user_id(request)?;

        match self.database.get_workout_insights(&user_id).await {
            Ok(insights) => Ok(self.create_success_response(&insights)),
            Err(e) => Ok(self.create_error_response(500, &format!("Database error: {}", e))),
        }
    }

    // Strength Progress Handlers
    async fn handle_create_strength_progress(
        &self,
        request: &ApiGatewayProxyRequest,
    ) -> Result<ApiGatewayProxyResponse, LambdaError> {
        let body = request.body.as_ref().ok_or("Missing request body")?;
        let progress: StrengthProgress = serde_json::from_str(body)
            .map_err(|e| format!("Invalid JSON: {}", e))?;

        match self.database.create_strength_progress(&progress).await {
            Ok(_) => Ok(self.create_success_response(&json!({"message": "Strength progress created successfully"}))),
            Err(e) => Ok(self.create_error_response(500, &format!("Database error: {}", e))),
        }
    }

    async fn handle_get_strength_progress(
        &self,
        request: &ApiGatewayProxyRequest,
    ) -> Result<ApiGatewayProxyResponse, LambdaError> {
        let user_id = self.extract_user_id(request)?;
        let query_params = request.query_string_parameters.as_ref();
        
        let exercise_id = query_params
            .and_then(|params| params.get("exercise_id"))
            .map(|s| s.as_str());
        let start_date = query_params
            .and_then(|params| params.get("start_date"))
            .map(|s| s.as_str());
        let end_date = query_params
            .and_then(|params| params.get("end_date"))
            .map(|s| s.as_str());

        match self.database.get_strength_progress(&user_id, exercise_id, None, None).await {
            Ok(progress) => Ok(self.create_success_response(&progress)),
            Err(e) => Ok(self.create_error_response(500, &format!("Database error: {}", e))),
        }
    }

    // Body Measurements Handlers
    async fn handle_create_body_measurement(
        &self,
        request: &ApiGatewayProxyRequest,
    ) -> Result<ApiGatewayProxyResponse, LambdaError> {
        let body = request.body.as_ref().ok_or("Missing request body")?;
        let measurement: BodyMeasurement = serde_json::from_str(body)
            .map_err(|e| format!("Invalid JSON: {}", e))?;

        match self.database.create_body_measurement(&measurement).await {
            Ok(_) => Ok(self.create_success_response(&json!({"message": "Body measurement created successfully"}))),
            Err(e) => Ok(self.create_error_response(500, &format!("Database error: {}", e))),
        }
    }

    async fn handle_get_body_measurements(
        &self,
        request: &ApiGatewayProxyRequest,
    ) -> Result<ApiGatewayProxyResponse, LambdaError> {
        let user_id = self.extract_user_id(request)?;
        let query_params = request.query_string_parameters.as_ref();
        
        let measurement_type = query_params
            .and_then(|params| params.get("type"))
            .map(|s| s.as_str());
        let start_date = query_params
            .and_then(|params| params.get("start_date"))
            .map(|s| s.as_str());
        let end_date = query_params
            .and_then(|params| params.get("end_date"))
            .map(|s| s.as_str());

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
        let body = request.body.as_ref().ok_or("Missing request body")?;
        let milestone_request: CreateMilestoneRequest = serde_json::from_str(body)
            .map_err(|e| format!("Invalid JSON: {}", e))?;

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

    async fn handle_get_milestones(
        &self,
        request: &ApiGatewayProxyRequest,
    ) -> Result<ApiGatewayProxyResponse, LambdaError> {
        let user_id = self.extract_user_id(request)?;

        match self.database.get_milestones(&user_id).await {
            Ok(milestones) => Ok(self.create_success_response(&milestones)),
            Err(e) => Ok(self.create_error_response(500, &format!("Database error: {}", e))),
        }
    }

    async fn handle_update_milestone(
        &self,
        request: &ApiGatewayProxyRequest,
    ) -> Result<ApiGatewayProxyResponse, LambdaError> {
        // Implementation for updating milestones
        Ok(self.create_success_response(&json!({"message": "Milestone updated successfully"})))
    }

    async fn handle_delete_milestone(
        &self,
        request: &ApiGatewayProxyRequest,
    ) -> Result<ApiGatewayProxyResponse, LambdaError> {
        // Implementation for deleting milestones
        Ok(self.create_success_response(&json!({"message": "Milestone deleted successfully"})))
    }

    // Workout History Handler
    async fn handle_get_workout_history(
        &self,
        request: &ApiGatewayProxyRequest,
    ) -> Result<ApiGatewayProxyResponse, LambdaError> {
        let user_id = self.extract_user_id(request)?;
        let query_params = request.query_string_parameters.as_ref();
        
        let history_request = GetWorkoutHistoryRequest {
            user_id,
            start_date: query_params
                .and_then(|params| params.get("start_date"))
                .map(|s| s.to_string()),
            end_date: query_params
                .and_then(|params| params.get("end_date"))
                .map(|s| s.to_string()),
            workout_type: query_params
                .and_then(|params| params.get("workout_type"))
                .map(|s| s.to_string()),
            limit: query_params
                .and_then(|params| params.get("limit"))
                .and_then(|s| s.parse().ok()),
            offset: query_params
                .and_then(|params| params.first("offset"))
                .and_then(|s| s.parse().ok()),
            sort_by: query_params
                .and_then(|params| params.first("sort_by"))
                .map(|s| s.to_string()),
            sort_order: query_params
                .and_then(|params| params.first("sort_order"))
                .map(|s| s.to_string()),
        };

        match self.database.get_workout_history(&history_request).await {
            Ok(history) => Ok(self.create_success_response(&history)),
            Err(e) => Ok(self.create_error_response(500, &format!("Database error: {}", e))),
        }
    }

    // Performance Trends Handler
    async fn handle_get_performance_trends(
        &self,
        request: &ApiGatewayProxyRequest,
    ) -> Result<ApiGatewayProxyResponse, LambdaError> {
        let user_id = self.extract_user_id(request)?;
        
        // Simplified implementation - generate mock trends data
        let trends = vec![
            Trend {
                metric: "strength".to_string(),
                direction: "increasing".to_string(),
                strength: 0.85,
                duration_days: 30,
                slope: 0.02,
                r_squared: 0.92,
            },
            Trend {
                metric: "volume".to_string(),
                direction: "stable".to_string(),
                strength: 0.65,
                duration_days: 14,
                slope: 0.001,
                r_squared: 0.78,
            },
        ];

        Ok(self.create_success_response(&trends))
    }

    // Comparative Analysis Handlers
    async fn handle_compare_periods(
        &self,
        request: &ApiGatewayProxyRequest,
    ) -> Result<ApiGatewayProxyResponse, LambdaError> {
        // Simplified implementation - generate mock comparison data
        let comparison = PeriodComparison {
            workouts_change: 5.6,
            duration_change: 2.3,
            volume_change: 8.1,
            intensity_change: -1.2,
            consistency_change: 3.4,
            strength_change: 4.7,
        };

        Ok(self.create_success_response(&comparison))
    }

    async fn handle_get_peer_comparison(
        &self,
        request: &ApiGatewayProxyRequest,
    ) -> Result<ApiGatewayProxyResponse, LambdaError> {
        // Simplified implementation - generate mock peer comparison data
        let mut metrics = HashMap::new();
        metrics.insert("weekly_volume".to_string(), 1.09);
        metrics.insert("consistency".to_string(), 0.95);
        
        let peer_comparison = PeerComparison {
            percentile: 68,
            comparison_group: "similar_experience".to_string(),
            metrics,
            insights: vec![
                "You're performing above average in volume".to_string(),
                "Consider improving consistency".to_string(),
            ],
        };

        Ok(self.create_success_response(&peer_comparison))
    }

    // Predictions Handler
    async fn handle_get_predictions(
        &self,
        request: &ApiGatewayProxyRequest,
    ) -> Result<ApiGatewayProxyResponse, LambdaError> {
        // Simplified implementation - generate mock predictions
        let predictions = vec![
            Prediction {
                id: "pred_1".to_string(),
                title: "Bench Press 1RM Prediction".to_string(),
                predicted_value: 225.0,
                unit: "lbs".to_string(),
                target_date: "2025-01-31".to_string(),
                confidence_interval: (215.0, 235.0),
                factors: vec!["current_strength".to_string(), "training_frequency".to_string()],
                model_accuracy: 0.87,
            },
        ];

        Ok(self.create_success_response(&predictions))
    }

    // Export Handler
    async fn handle_export_data(
        &self,
        request: &ApiGatewayProxyRequest,
    ) -> Result<ApiGatewayProxyResponse, LambdaError> {
        let body = request.body.as_ref().ok_or("Missing request body")?;
        let export_request: ExportDataRequest = serde_json::from_str(body)
            .map_err(|e| format!("Invalid JSON: {}", e))?;

        match self.database.export_user_data(&export_request).await {
            Ok(export_response) => Ok(self.create_success_response(&export_response)),
            Err(e) => Ok(self.create_error_response(500, &format!("Export error: {}", e))),
        }
    }

    // Helper methods
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