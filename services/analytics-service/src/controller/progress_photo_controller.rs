use anyhow::Result;
use serde_json::Value;

use crate::service::ProgressPhotoService;
use crate::utils::ResponseBuilder;

pub struct ProgressPhotoController {
    service: ProgressPhotoService,
}

impl ProgressPhotoController {
    pub fn new(service: ProgressPhotoService) -> Self {
        Self { service }
    }

    pub async fn get_progress_photos(
        &self,
        user_id: &str,
        photo_type: Option<&str>,
        start_date: Option<&str>,
        end_date: Option<&str>,
        limit: Option<u32>,
    ) -> Result<Value> {
        if user_id.is_empty() {
            return Ok(ResponseBuilder::bad_request("User ID is required"));
        }

        match self
            .service
            .get_progress_photos(user_id, photo_type, start_date, end_date, limit)
            .await
        {
            Ok(photos) => Ok(ResponseBuilder::ok(photos)),
            Err(e) => Ok(ResponseBuilder::internal_server_error(&format!(
                "Failed to retrieve progress photos: {}",
                e
            ))),
        }
    }

    pub async fn upload_progress_photo(&self, body: &str) -> Result<Value> {
        let body: Value = serde_json::from_str(body)?;

        let user_id = body["userId"].as_str().unwrap_or("").to_string();
        let image_data = body["imageData"].as_str().unwrap_or("").to_string();
        let photo_type = body["photoType"].as_str().map(|s| s.to_string());
        let content_type = body["contentType"].as_str().map(|s| s.to_string());
        let notes = body["notes"].as_str().map(|s| s.to_string());
        let workout_session_id = body["workoutSessionId"].as_str().map(|s| s.to_string());
        let tags = body["tags"].as_array().map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str())
                .map(|s| s.to_string())
                .collect()
        });

        if user_id.is_empty() || image_data.is_empty() {
            return Ok(ResponseBuilder::bad_request(
                "User ID and image data are required",
            ));
        }

        // Validate file size (max 10MB)
        if image_data.len() > 10 * 1024 * 1024 {
            return Ok(ResponseBuilder::payload_too_large(
                "Maximum file size is 10MB",
            ));
        }

        match self
            .service
            .upload_progress_photo(
                user_id,
                image_data,
                photo_type,
                content_type,
                notes,
                workout_session_id,
                tags,
            )
            .await
        {
            Ok(photo) => Ok(ResponseBuilder::created(photo)),
            Err(e) => Ok(ResponseBuilder::internal_server_error(&format!(
                "Failed to upload progress photo: {}",
                e
            ))),
        }
    }

    pub async fn update_progress_photo(&self, photo_id: &str, body: &str) -> Result<Value> {
        let body: Value = serde_json::from_str(body)?;

        let notes = body["notes"].as_str().map(|s| s.to_string());
        let tags = body["tags"].as_array().map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str())
                .map(|s| s.to_string())
                .collect()
        });

        if photo_id.is_empty() {
            return Ok(ResponseBuilder::bad_request("Photo ID is required"));
        }

        match self
            .service
            .update_progress_photo(photo_id, notes, tags)
            .await
        {
            Ok(photo) => Ok(ResponseBuilder::ok(photo)),
            Err(e) => Ok(ResponseBuilder::internal_server_error(&format!(
                "Failed to update progress photo: {}",
                e
            ))),
        }
    }

    pub async fn delete_progress_photo(&self, photo_id: &str) -> Result<Value> {
        if photo_id.is_empty() {
            return Ok(ResponseBuilder::bad_request("Photo ID is required"));
        }

        match self.service.delete_progress_photo(photo_id).await {
            Ok(_) => Ok(ResponseBuilder::ok(
                serde_json::json!({"message": "Progress photo deleted successfully"}),
            )),
            Err(e) => Ok(ResponseBuilder::internal_server_error(&format!(
                "Failed to delete progress photo: {}",
                e
            ))),
        }
    }

    pub async fn get_progress_photo_analytics(
        &self,
        user_id: &str,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<Value> {
        if user_id.is_empty() {
            return Ok(ResponseBuilder::bad_request("User ID is required"));
        }

        match self
            .service
            .get_progress_photo_analytics(user_id, start_date, end_date)
            .await
        {
            Ok(analytics) => Ok(ResponseBuilder::ok(analytics)),
            Err(e) => Ok(ResponseBuilder::internal_server_error(&format!(
                "Failed to get progress photo analytics: {}",
                e
            ))),
        }
    }

    pub async fn get_progress_photo_timeline(
        &self,
        user_id: &str,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<Value> {
        if user_id.is_empty() {
            return Ok(ResponseBuilder::bad_request("User ID is required"));
        }

        match self
            .service
            .get_progress_photo_timeline(user_id, start_date, end_date)
            .await
        {
            Ok(timeline) => Ok(ResponseBuilder::ok(timeline)),
            Err(e) => Ok(ResponseBuilder::internal_server_error(&format!(
                "Failed to get progress photo timeline: {}",
                e
            ))),
        }
    }
}
