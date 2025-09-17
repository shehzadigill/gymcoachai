# Monitoring and Logging Guide

This document outlines the comprehensive monitoring and logging strategy implemented for the GymCoach AI application.

## Overview

The monitoring and logging system provides:

- Real-time performance monitoring
- Error tracking and alerting
- Custom application metrics
- Structured logging across all services
- CloudWatch dashboards and alarms
- SNS notifications for critical issues

## Architecture

### Components

1. **CloudWatch Dashboards** - Real-time visualization of metrics
2. **CloudWatch Alarms** - Automated alerting based on thresholds
3. **SNS Topics** - Notification delivery for alerts
4. **Structured Logging** - JSON-formatted logs with context
5. **Custom Metrics** - Application-specific business metrics
6. **X-Ray Tracing** - Distributed request tracing

## Monitoring Stack

### Lambda Function Monitoring

- **Invocations** - Request count per function
- **Errors** - Error count and rate
- **Duration** - Execution time metrics
- **Memory Utilization** - Memory usage patterns
- **Throttles** - Concurrent execution limits
- **Cold Starts** - Initialization time tracking

### Database Monitoring

- **Read/Write Capacity** - DynamoDB capacity utilization
- **Throttling** - Request throttling events
- **Item Count** - Table size monitoring
- **Consumed Capacity** - Resource usage tracking

### S3 Monitoring

- **Storage Usage** - Bucket size monitoring
- **Object Count** - Number of stored objects
- **Request Metrics** - API call patterns
- **Error Rates** - Failed operations

### Application Metrics

- **User Registrations** - New user signups
- **User Logins** - Authentication events
- **Workout Sessions** - Fitness activity tracking
- **Workout Plans Created** - Content creation
- **Progress Photos Uploaded** - Media uploads
- **AI Recommendations Generated** - AI service usage
- **Error Rate** - Overall application health
- **Response Time** - Performance metrics
- **Active Users** - User engagement

## Logging Strategy

### Structured Logging

All services use structured JSON logging with the following format:

```json
{
  "timestamp": "2024-01-01T00:00:00Z",
  "level": "INFO",
  "request_id": "req-123",
  "user_id": "user-456",
  "service": "user-profile-service",
  "operation": "get_user_profile",
  "duration_ms": 150,
  "status_code": 200,
  "message": "User profile retrieved successfully",
  "metadata": {
    "user_id": "user-456",
    "profile_id": "profile-789"
  }
}
```

### Log Levels

- **ERROR** - Critical errors that require immediate attention
- **WARN** - Warning conditions that may need investigation
- **INFO** - General information about application flow
- **DEBUG** - Detailed information for debugging

### Log Context

Every log entry includes:

- **Request ID** - Unique identifier for request tracing
- **User ID** - Authenticated user identifier
- **Service** - Source service name
- **Operation** - Specific operation being performed
- **Duration** - Execution time in milliseconds
- **Status Code** - HTTP response status
- **Metadata** - Additional contextual information

## Alarms and Alerting

### Critical Alarms

1. **High Error Rate** - >10 errors in 5 minutes
2. **High Duration** - >25 seconds average execution time
3. **High Memory Usage** - >80% memory utilization
4. **Throttling** - >5 throttled requests in 5 minutes
5. **Database Throttling** - >10 throttled requests in 5 minutes
6. **Low User Activity** - <10 active users in 1 hour

### Warning Alarms

1. **High Read Capacity** - >1000 read capacity units
2. **High Write Capacity** - >1000 write capacity units
3. **High Storage Usage** - >1GB S3 storage usage
4. **Application Error Rate** - >5% error rate

### Notification Channels

- **SNS Topic** - Centralized alert distribution
- **Email** - Critical alerts to operations team
- **Slack** - Real-time notifications to development team
- **PagerDuty** - Escalation for critical issues

## Dashboards

### Lambda Metrics Dashboard

- Function invocations and errors
- Duration and throttling metrics
- Memory utilization patterns
- Cold start frequency

### Database Metrics Dashboard

- Read/write capacity utilization
- Throttling events
- Item count trends
- Performance metrics

### S3 Metrics Dashboard

- Storage usage by bucket
- Object count trends
- Request patterns
- Error rates

### Application Metrics Dashboard

- User activity metrics
- Business KPIs
- Error rates by service
- Performance trends

## Custom Metrics

### Business Metrics

```rust
use metrics_collector::{MetricsCollector, ApplicationMetrics};

let mut collector = MetricsCollector::new("GymCoachAI".to_string());

// Record user registration
collector.increment_counter("UserRegistrations".to_string(), 1.0);

// Record workout session
collector.increment_counter("WorkoutSessions".to_string(), 1.0);

// Record response time
collector.record_duration("ResponseTime".to_string(), 150.0);

// Record error
collector.record_errors("Errors".to_string(), 1.0);
```

### Performance Metrics

```rust
// Record custom performance metric
let custom_metric = CustomMetric::new(
    "GymCoachAI".to_string(),
    "DatabaseQueryTime".to_string(),
    25.0,
    MetricUnit::Duration,
).with_dimension("table".to_string(), "user_profiles".to_string());

collector.record_custom_metric(custom_metric);
```

## Logging Implementation

### Service-Level Logging

```rust
use shared_logging::{Logger, LogContext};

let logger = Logger::new("user-profile-service".to_string());
let context = logger.start_request("req-123".to_string(), "get_user_profile".to_string());

// Log operation start
context.log_info("Starting user profile retrieval");

// Log operation completion
logger.end_request(context, 200, 150);
```

### Error Logging

```rust
// Log error with context
let context = LogContext::new("req-123".to_string(), "user-service".to_string(), "get_user".to_string())
    .with_user_id("user-456".to_string())
    .with_error("User not found".to_string())
    .with_status_code(404);

context.log_error("Failed to retrieve user profile");
```

### Debug Logging

```rust
// Log debug information
context.log_debug("Processing user profile data");
context.log_debug("Validating user permissions");
```

## Monitoring Best Practices

### 1. Metric Naming

- Use consistent naming conventions
- Include namespace and service information
- Use descriptive metric names
- Group related metrics together

### 2. Logging Guidelines

- Include sufficient context in logs
- Use structured logging format
- Avoid logging sensitive information
- Use appropriate log levels

### 3. Alarm Configuration

- Set appropriate thresholds
- Use multiple evaluation periods
- Configure proper notification channels
- Test alarm functionality regularly

### 4. Dashboard Design

- Group related metrics together
- Use appropriate time ranges
- Include trend analysis
- Make dashboards actionable

## Troubleshooting

### Common Issues

1. **High Error Rates**
   - Check CloudWatch logs for error details
   - Review alarm configurations
   - Investigate service dependencies

2. **Performance Issues**
   - Monitor duration metrics
   - Check memory utilization
   - Review database performance

3. **Missing Metrics**
   - Verify metric collection code
   - Check CloudWatch permissions
   - Review metric namespace configuration

### Debugging Steps

1. Check CloudWatch logs
2. Review alarm history
3. Analyze metric trends
4. Test with sample data
5. Verify configuration

## Future Enhancements

### 1. Advanced Monitoring

- Machine learning-based anomaly detection
- Predictive alerting
- Custom metric aggregation
- Real-time dashboards

### 2. Log Analysis

- Log aggregation and search
- Pattern recognition
- Automated log analysis
- Integration with SIEM systems

### 3. Performance Optimization

- Automated scaling based on metrics
- Performance regression detection
- Capacity planning
- Resource optimization

### 4. Security Monitoring

- Security event detection
- Threat analysis
- Compliance monitoring
- Audit trail analysis
