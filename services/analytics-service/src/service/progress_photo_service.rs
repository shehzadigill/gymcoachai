use anyhow::Result;
use chrono::Utc;
use uuid::Uuid;

use crate::models::ProgressPhoto;
use crate::repository::ProgressPhotoRepository;

#[derive(Clone)]
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
        self.repository
            .get_progress_photos(user_id, photo_type, start_date, end_date, limit)
            .await
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

        let photo_url = self
            .repository
            .upload_progress_photo_to_s3(
                &user_id,
                &photo_id,
                &content_type.unwrap_or_else(|| "image/jpeg".to_string()),
                &image_data,
            )
            .await?;

        // FIXED: Store correct S3 key format matching the upload path
        let progress_photo = ProgressPhoto {
            id: photo_id.clone(),
            user_id: user_id.clone(),
            workout_session_id,
            photo_type: photo_type.unwrap_or_else(|| "progress".to_string()),
            photo_url: photo_url.clone(),
            s3_key: format!("progress-photos/{}", photo_id), // Match the actual S3 key structure
            taken_at: taken_at.clone(),
            notes,
            created_at: created_at.clone(),
            updated_at: created_at,
            tags: tags.unwrap_or_default(),
            metadata: None,
        };

        self.repository.create_progress_photo(&progress_photo).await
    }

    pub async fn get_progress_photo_by_id(&self, photo_id: &str) -> Result<ProgressPhoto> {
        self.repository.get_progress_photo_by_id(photo_id).await
    }

    pub async fn update_progress_photo(
        &self,
        photo_id: &str,
        notes: Option<String>,
        tags: Option<Vec<String>>,
    ) -> Result<ProgressPhoto> {
        let mut photo = self.repository.get_progress_photo_by_id(photo_id).await?;

        if let Some(new_notes) = notes {
            photo.notes = Some(new_notes);
        }

        if let Some(new_tags) = tags {
            photo.tags = new_tags;
        }

        photo.updated_at = Utc::now().to_rfc3339();

        self.repository.update_progress_photo(&photo).await
    }

    pub async fn delete_progress_photo(&self, photo_id: &str) -> Result<()> {
        // Get the photo first to get the S3 key
        let photo = self.repository.get_progress_photo_by_id(photo_id).await?;

        // Delete from S3
        self.repository
            .delete_progress_photo_from_s3(&photo.s3_key)
            .await?;

        // Delete from database
        self.repository.delete_progress_photo(photo_id).await
    }

    pub async fn get_progress_photo_analytics(
        &self,
        user_id: &str,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<serde_json::Value> {
        let photos = self
            .repository
            .get_progress_photos(user_id, None, start_date, end_date, None)
            .await?;

        let total_photos = photos.len();
        let photos_by_type =
            photos
                .iter()
                .fold(std::collections::HashMap::new(), |mut acc, photo| {
                    *acc.entry(&photo.photo_type).or_insert(0) += 1;
                    acc
                });

        let photos_by_month =
            photos
                .iter()
                .fold(std::collections::HashMap::new(), |mut acc, photo| {
                    let month = &photo.taken_at[..7]; // YYYY-MM
                    *acc.entry(month).or_insert(0) += 1;
                    acc
                });

        let analytics = serde_json::json!({
            "total_photos": total_photos,
            "photos_by_type": photos_by_type,
            "photos_by_month": photos_by_month,
            "date_range": {
                "start_date": start_date,
                "end_date": end_date
            }
        });

        Ok(analytics)
    }

    pub async fn get_progress_photo_timeline(
        &self,
        user_id: &str,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<Vec<serde_json::Value>> {
        let photos = self
            .repository
            .get_progress_photos(user_id, None, start_date, end_date, None)
            .await?;

        let timeline: Vec<serde_json::Value> = photos
            .into_iter()
            .map(|photo| {
                serde_json::json!({
                    "id": photo.id,
                    "photo_type": photo.photo_type,
                    "photo_url": photo.photo_url,
                    "taken_at": photo.taken_at,
                    "notes": photo.notes,
                    "tags": photo.tags,
                    "workout_session_id": photo.workout_session_id
                })
            })
            .collect();

        Ok(timeline)
    }
}
