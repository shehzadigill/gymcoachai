use anyhow::Result;
use chrono::Utc;
use uuid::Uuid;

use crate::models::{ProgressPhoto, PhotoMetadata};
use crate::repository::ProgressPhotoRepository;

pub struct ProgressPhotoService {
    repository: ProgressPhotoRepository,
}

impl ProgressPhotoService {
    pub fn new(repository: ProgressPhotoRepository) -> Self {
        Self { repository }
    }

    pub async fn get_progress_photos(
        &self,
        user_id: &str,
        photo_type: Option<&str>,
        start_date: Option<&str>,
        end_date: Option<&str>,
        limit: Option<u32>,
    ) -> Result<Vec<ProgressPhoto>> {
        self.repository.get_progress_photos(user_id, photo_type, start_date, end_date, limit).await
    }

    pub async fn upload_progress_photo(
        &self,
        user_id: String,
        image_data: String,
        photo_type: Option<String>,
        content_type: Option<String>,
        notes: Option<String>,
        workout_session_id: Option<String>,
        tags: Option<Vec<String>>,
    ) -> Result<ProgressPhoto> {
        let photo_id = Uuid::new_v4().to_string();
        let taken_at = Utc::now().to_rfc3339();
        let created_at = taken_at.clone();
        
        let photo_url = self.repository.upload_progress_photo_to_s3(
            &user_id,
            &photo_id,
            &content_type.unwrap_or_else(|| "image/jpeg".to_string()),
            &image_data,
        ).await?;

        let progress_photo = ProgressPhoto {
            id: photo_id.clone(),
            user_id: user_id.clone(),
            workout_session_id,
            photo_type: photo_type.unwrap_or_else(|| "progress".to_string()),
            photo_url: photo_url.clone(),
            s3_key: format!("users/{}/progress-photos/{}", user_id, photo_id),
            taken_at: taken_at.clone(),
            notes,
            created_at: created_at.clone(),
            updated_at: created_at,
            tags: tags.unwrap_or_default(),
            metadata: None,
        };

        self.repository.create_progress_photo(&progress_photo).await
    }
}
