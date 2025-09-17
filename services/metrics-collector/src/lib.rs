use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize)]
pub struct Metric {
    pub namespace: String,
    pub metric_name: String,
    pub value: f64,
    pub unit: MetricUnit,
    pub timestamp: DateTime<Utc>,
    pub dimensions: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum MetricUnit {
    Count,
    Duration,
    Percentage,
    Bytes,
    Requests,
    Errors,
}

impl MetricUnit {
    pub fn as_str(&self) -> &'static str {
        match self {
            MetricUnit::Count => "Count",
            MetricUnit::Duration => "Milliseconds",
            MetricUnit::Percentage => "Percent",
            MetricUnit::Bytes => "Bytes",
            MetricUnit::Requests => "Count",
            MetricUnit::Errors => "Count",
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CustomMetric {
    pub namespace: String,
    pub metric_name: String,
    pub value: f64,
    pub unit: MetricUnit,
    pub timestamp: DateTime<Utc>,
    pub dimensions: HashMap<String, String>,
}

impl CustomMetric {
    pub fn new(namespace: String, metric_name: String, value: f64, unit: MetricUnit) -> Self {
        Self {
            namespace,
            metric_name,
            value,
            unit,
            timestamp: Utc::now(),
            dimensions: HashMap::new(),
        }
    }

    pub fn with_dimension(mut self, key: String, value: String) -> Self {
        self.dimensions.insert(key, value);
        self
    }

    pub fn with_dimensions(mut self, dimensions: HashMap<String, String>) -> Self {
        self.dimensions.extend(dimensions);
        self
    }
}

pub struct MetricsCollector {
    namespace: String,
    metrics: Vec<CustomMetric>,
}

impl MetricsCollector {
    pub fn new(namespace: String) -> Self {
        Self {
            namespace,
            metrics: Vec::new(),
        }
    }

    pub fn increment_counter(&mut self, metric_name: String, value: f64) {
        let metric = CustomMetric::new(
            self.namespace.clone(),
            metric_name,
            value,
            MetricUnit::Count,
        );
        self.metrics.push(metric);
    }

    pub fn record_duration(&mut self, metric_name: String, duration_ms: f64) {
        let metric = CustomMetric::new(
            self.namespace.clone(),
            metric_name,
            duration_ms,
            MetricUnit::Duration,
        );
        self.metrics.push(metric);
    }

    pub fn record_percentage(&mut self, metric_name: String, percentage: f64) {
        let metric = CustomMetric::new(
            self.namespace.clone(),
            metric_name,
            percentage,
            MetricUnit::Percentage,
        );
        self.metrics.push(metric);
    }

    pub fn record_bytes(&mut self, metric_name: String, bytes: f64) {
        let metric = CustomMetric::new(
            self.namespace.clone(),
            metric_name,
            bytes,
            MetricUnit::Bytes,
        );
        self.metrics.push(metric);
    }

    pub fn record_requests(&mut self, metric_name: String, count: f64) {
        let metric = CustomMetric::new(
            self.namespace.clone(),
            metric_name,
            count,
            MetricUnit::Requests,
        );
        self.metrics.push(metric);
    }

    pub fn record_errors(&mut self, metric_name: String, count: f64) {
        let metric = CustomMetric::new(
            self.namespace.clone(),
            metric_name,
            count,
            MetricUnit::Errors,
        );
        self.metrics.push(metric);
    }

    pub fn record_custom_metric(&mut self, metric: CustomMetric) {
        self.metrics.push(metric);
    }

    pub fn get_metrics(&self) -> &[CustomMetric] {
        &self.metrics
    }

    pub fn clear_metrics(&mut self) {
        self.metrics.clear();
    }

    pub fn get_metric_summary(&self) -> HashMap<String, f64> {
        let mut summary = HashMap::new();
        
        for metric in &self.metrics {
            let key = format!("{}.{}", metric.namespace, metric.metric_name);
            *summary.entry(key).or_insert(0.0) += metric.value;
        }
        
        summary
    }
}

// Predefined metrics for common operations
pub struct ApplicationMetrics {
    pub user_registrations: f64,
    pub user_logins: f64,
    pub workout_sessions: f64,
    pub workout_plans_created: f64,
    pub progress_photos_uploaded: f64,
    pub ai_recommendations_generated: f64,
    pub errors: f64,
    pub response_time_ms: f64,
    pub active_users: f64,
}

impl ApplicationMetrics {
    pub fn new() -> Self {
        Self {
            user_registrations: 0.0,
            user_logins: 0.0,
            workout_sessions: 0.0,
            workout_plans_created: 0.0,
            progress_photos_uploaded: 0.0,
            ai_recommendations_generated: 0.0,
            errors: 0.0,
            response_time_ms: 0.0,
            active_users: 0.0,
        }
    }

    pub fn to_metrics(&self, namespace: String) -> Vec<CustomMetric> {
        let mut metrics = Vec::new();
        
        if self.user_registrations > 0.0 {
            metrics.push(CustomMetric::new(
                namespace.clone(),
                "UserRegistrations".to_string(),
                self.user_registrations,
                MetricUnit::Count,
            ));
        }
        
        if self.user_logins > 0.0 {
            metrics.push(CustomMetric::new(
                namespace.clone(),
                "UserLogins".to_string(),
                self.user_logins,
                MetricUnit::Count,
            ));
        }
        
        if self.workout_sessions > 0.0 {
            metrics.push(CustomMetric::new(
                namespace.clone(),
                "WorkoutSessions".to_string(),
                self.workout_sessions,
                MetricUnit::Count,
            ));
        }
        
        if self.workout_plans_created > 0.0 {
            metrics.push(CustomMetric::new(
                namespace.clone(),
                "WorkoutPlansCreated".to_string(),
                self.workout_plans_created,
                MetricUnit::Count,
            ));
        }
        
        if self.progress_photos_uploaded > 0.0 {
            metrics.push(CustomMetric::new(
                namespace.clone(),
                "ProgressPhotosUploaded".to_string(),
                self.progress_photos_uploaded,
                MetricUnit::Count,
            ));
        }
        
        if self.ai_recommendations_generated > 0.0 {
            metrics.push(CustomMetric::new(
                namespace.clone(),
                "AIRecommendationsGenerated".to_string(),
                self.ai_recommendations_generated,
                MetricUnit::Count,
            ));
        }
        
        if self.errors > 0.0 {
            metrics.push(CustomMetric::new(
                namespace.clone(),
                "Errors".to_string(),
                self.errors,
                MetricUnit::Errors,
            ));
        }
        
        if self.response_time_ms > 0.0 {
            metrics.push(CustomMetric::new(
                namespace.clone(),
                "ResponseTime".to_string(),
                self.response_time_ms,
                MetricUnit::Duration,
            ));
        }
        
        if self.active_users > 0.0 {
            metrics.push(CustomMetric::new(
                namespace.clone(),
                "ActiveUsers".to_string(),
                self.active_users,
                MetricUnit::Count,
            ));
        }
        
        metrics
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_metrics_collector_creation() {
        let collector = MetricsCollector::new("TestNamespace".to_string());
        assert_eq!(collector.namespace, "TestNamespace");
        assert_eq!(collector.metrics.len(), 0);
    }

    #[test]
    fn test_increment_counter() {
        let mut collector = MetricsCollector::new("TestNamespace".to_string());
        collector.increment_counter("test_metric".to_string(), 1.0);
        
        assert_eq!(collector.metrics.len(), 1);
        assert_eq!(collector.metrics[0].metric_name, "test_metric");
        assert_eq!(collector.metrics[0].value, 1.0);
    }

    #[test]
    fn test_record_duration() {
        let mut collector = MetricsCollector::new("TestNamespace".to_string());
        collector.record_duration("test_duration".to_string(), 100.0);
        
        assert_eq!(collector.metrics.len(), 1);
        assert_eq!(collector.metrics[0].metric_name, "test_duration");
        assert_eq!(collector.metrics[0].value, 100.0);
        assert!(matches!(collector.metrics[0].unit, MetricUnit::Duration));
    }

    #[test]
    fn test_get_metric_summary() {
        let mut collector = MetricsCollector::new("TestNamespace".to_string());
        collector.increment_counter("test_metric".to_string(), 1.0);
        collector.increment_counter("test_metric".to_string(), 2.0);
        
        let summary = collector.get_metric_summary();
        assert_eq!(summary.get("TestNamespace.test_metric"), Some(&3.0));
    }
}
