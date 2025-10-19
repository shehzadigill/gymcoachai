use anyhow::Result;
use chrono::Utc;
use std::collections::HashMap;

use crate::models::{
    WorkoutAnalytics, WorkoutInsights, ExerciseStats,
    StrengthProgress, BodyMeasurement, Milestone, PerformanceTrend, WorkoutSession
};
use crate::service::{
    StrengthProgressService, BodyMeasurementService, ProgressChartService,
    MilestoneService, AchievementService, PerformanceTrendService,
    WorkoutSessionService, ProgressPhotoService
};

pub struct AnalyticsService {
    strength_progress_service: StrengthProgressService,
    body_measurement_service: BodyMeasurementService,
    progress_chart_service: ProgressChartService,
    milestone_service: MilestoneService,
    achievement_service: AchievementService,
    performance_trend_service: PerformanceTrendService,
    workout_session_service: WorkoutSessionService,
    progress_photo_service: ProgressPhotoService,
}

impl AnalyticsService {
    pub fn new(
        strength_progress_service: StrengthProgressService,
        body_measurement_service: BodyMeasurementService,
        progress_chart_service: ProgressChartService,
        milestone_service: MilestoneService,
        achievement_service: AchievementService,
        performance_trend_service: PerformanceTrendService,
        workout_session_service: WorkoutSessionService,
        progress_photo_service: ProgressPhotoService,
    ) -> Self {
        Self {
            strength_progress_service,
            body_measurement_service,
            progress_chart_service,
            milestone_service,
            achievement_service,
            performance_trend_service,
            workout_session_service,
            progress_photo_service,
        }
    }

    pub async fn get_workout_analytics(
        &self,
        user_id: &str,
        period: &str,
    ) -> Result<WorkoutAnalytics> {
        // Calculate date range based on period
        let (start_date, end_date) = match period {
            "week" => (
                (Utc::now() - chrono::Duration::days(7)).to_rfc3339(),
                Utc::now().to_rfc3339(),
            ),
            "month" => (
                (Utc::now() - chrono::Duration::days(30)).to_rfc3339(),
                Utc::now().to_rfc3339(),
            ),
            "quarter" => (
                (Utc::now() - chrono::Duration::days(90)).to_rfc3339(),
                Utc::now().to_rfc3339(),
            ),
            "year" => (
                (Utc::now() - chrono::Duration::days(365)).to_rfc3339(),
                Utc::now().to_rfc3339(),
            ),
            _ => (
                (Utc::now() - chrono::Duration::days(30)).to_rfc3339(),
                Utc::now().to_rfc3339(),
            ),
        };

        // Get all analytics data
        let sessions_result = self.workout_session_service
            .get_workout_sessions_for_analytics(user_id, Some(&start_date), Some(&end_date))
            .await;
        let strength_progress_result = self.strength_progress_service
            .get_strength_progress(user_id, Some(&start_date), Some(&end_date))
            .await;
        let body_measurements_result = self.body_measurement_service
            .get_body_measurements(user_id, Some(&start_date), Some(&end_date))
            .await;
        let milestones_result = self.milestone_service.get_milestones(user_id).await;
        let trends_result = self.performance_trend_service
            .get_performance_trends(user_id, Some(&start_date), Some(&end_date))
            .await;

        let sessions: Vec<WorkoutSession> = sessions_result.unwrap_or_default();
        let strength_progress: Vec<StrengthProgress> = strength_progress_result.unwrap_or_default();
        let body_measurements: Vec<BodyMeasurement> = body_measurements_result.unwrap_or_default();
        let milestones: Vec<Milestone> = milestones_result.unwrap_or_default();
        let trends: Vec<PerformanceTrend> = trends_result.unwrap_or_default();

        // Calculate analytics
        let total_workouts = sessions.len() as u32;
        let total_duration_minutes: u32 = sessions
            .iter()
            .filter_map(|s| s.duration_minutes)
            .map(|d| d as u32)
            .sum();
        let average_workout_duration = if total_workouts > 0 {
            total_duration_minutes as f32 / total_workouts as f32
        } else {
            0.0
        };

        // Calculate consistency score (simplified)
        let consistency_score = if period == "week" {
            (total_workouts as f32 / 7.0).min(1.0)
        } else if period == "month" {
            (total_workouts as f32 / 30.0).min(1.0)
        } else {
            0.8 // Default value
        };

        // Calculate exercise stats
        let mut exercise_stats = HashMap::new();
        for session in &sessions {
            for exercise in &session.exercises {
                let stats = exercise_stats.entry(exercise.exercise_id.clone()).or_insert(ExerciseStats {
                    exercise_id: exercise.exercise_id.clone(),
                    exercise_name: exercise.name.clone(),
                    total_sets: 0,
                    total_reps: 0,
                    total_volume: 0,
                    avg_weight: 0.0,
                    average_weight: 0.0,
                    max_weight: 0.0,
                    frequency: 0,
                    progression_rate: 0.0,
                    improvement_rate: 0.0,
                    last_performed: chrono::Utc::now().format("%Y-%m-%d").to_string(),
                });

                stats.frequency += 1;
                stats.total_sets += exercise.sets.len() as u32;
                
                for set in &exercise.sets {
                    if let Some(reps) = set.reps {
                        stats.total_reps += reps as u32;
                    }
                    if let Some(weight) = set.weight {
                        stats.total_volume += (weight * set.reps.unwrap_or(0) as f32) as u64;
                        stats.max_weight = stats.max_weight.max(weight);
                    }
                }
            }
        }

        let exercise_names: Vec<String> = exercise_stats
            .values()
            .take(5)
            .map(|stats| stats.exercise_name.clone())
            .collect();

        // Calculate calories burned (estimation based on duration and activity)
        // Average METs for strength training: 3.5-6.0, we'll use 5.0 as average
        // Calories burned per minute = (METs × weight_kg × 3.5) / 200
        // For simplicity, we'll use an average estimate: ~5-7 calories per minute of workout
        let calories_per_minute = 6.0; // Average estimate
        let calories_burned_this_week = (total_duration_minutes as f32 * calories_per_minute) as u32;

        // Calculate workouts this week (for week period)
        let workouts_this_week = if period == "week" {
            total_workouts
        } else {
            // Estimate based on weekly frequency
            (total_workouts as f32 / match period {
                "month" => 4.0,
                "quarter" => 13.0,
                "year" => 52.0,
                _ => 1.0,
            }) as u32
        };

        let analytics = WorkoutAnalytics {
            user_id: user_id.to_string(),
            period: period.to_string(),
            total_workouts,
            total_exercises: exercise_stats.len() as u32,
            total_sets: exercise_stats.values().map(|s| s.total_sets).sum(),
            total_reps: exercise_stats.values().map(|s| s.total_reps).sum(),
            total_volume: exercise_stats.values().map(|s| s.total_volume).sum(),
            total_duration_minutes,
            average_workout_duration: total_duration_minutes as f32 / total_workouts.max(1) as f32,
            avg_workout_duration: (total_duration_minutes / total_workouts.max(1) as u32),
            consistency_score,
            calories_burned_this_week,
            workouts_this_week,
            strength_trend: strength_progress.clone(),
            strength_gains: strength_progress,
            most_trained_muscle_groups: vec!["chest".to_string(), "legs".to_string()],
            favorite_exercises: exercise_names,
            weekly_frequency: 3.5,
            personal_records_count: 5,
            achievement_count: 3,
            body_measurements,
            milestones_achieved: milestones.into_iter().filter(|m| m.achieved).collect(),
            performance_trends: trends,
            generated_at: Utc::now().to_rfc3339(),
        };

        Ok(analytics)
    }

    pub async fn get_workout_insights(
        &self,
        user_id: &str,
        period: &str,
    ) -> Result<WorkoutInsights> {
        let insights = WorkoutInsights {
            user_id: user_id.to_string(),
            period: period.to_string(),
            generated_at: Utc::now().to_rfc3339(),
            strength_trend: "improving".to_string(),
            consistency_trend: "good".to_string(),
            volume_trend: "increasing".to_string(),
            recovery_analysis: "adequate".to_string(),
            recommendations: vec!["Continue current training program".to_string()],
            warnings: vec![],
            achievements_unlocked: vec![],
            next_milestones: vec![],
            plateau_risk: 0.2,
            overtraining_risk: 0.1,
            improvement_areas: vec!["Focus on proper form".to_string()],
            strength_predictions: vec![],
        };

        Ok(insights)
    }
}
