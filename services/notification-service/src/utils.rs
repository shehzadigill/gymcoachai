use anyhow::{anyhow, Result};
use chrono::{DateTime, Utc, TimeZone, Timelike};
use serde_json::Value;
use std::collections::HashMap;

pub fn validate_notification_type(notification_type: &str) -> Result<()> {
    let valid_types = [
        "workout_reminder",
        "nutrition_reminder",
        "water_reminder",
        "achievement",
        "ai_suggestion",
        "progress_photo",
        "streak_reminder",
        "goal_achieved",
    ];
    
    if valid_types.contains(&notification_type) {
        Ok(())
    } else {
        Err(anyhow!("Invalid notification type: {}", notification_type))
    }
}

pub fn validate_platform(platform: &str) -> Result<()> {
    let valid_platforms = ["ios", "android", "web"];
    
    if valid_platforms.contains(&platform) {
        Ok(())
    } else {
        Err(anyhow!("Invalid platform: {}", platform))
    }
}

pub fn validate_time_format(time: &str) -> Result<()> {
    if time.len() != 5 || !time.contains(':') {
        return Err(anyhow!("Invalid time format. Expected HH:MM"));
    }
    
    let parts: Vec<&str> = time.split(':').collect();
    if parts.len() != 2 {
        return Err(anyhow!("Invalid time format. Expected HH:MM"));
    }
    
    let hour: u32 = parts[0].parse()
        .map_err(|_| anyhow!("Invalid hour format"))?;
    let minute: u32 = parts[1].parse()
        .map_err(|_| anyhow!("Invalid minute format"))?;
    
    if hour > 23 || minute > 59 {
        return Err(anyhow!("Invalid time values. Hour must be 0-23, minute must be 0-59"));
    }
    
    Ok(())
}

pub fn validate_timezone(timezone: &str) -> Result<()> {
    // Basic timezone validation - in a real implementation, you'd use a proper timezone library
    let valid_timezones = [
        "UTC", "GMT", "EST", "PST", "CST", "MST",
        "America/New_York", "America/Los_Angeles", "America/Chicago",
        "Europe/London", "Europe/Paris", "Asia/Tokyo",
    ];
    
    if valid_timezones.contains(&timezone) {
        Ok(())
    } else {
        Err(anyhow!("Invalid timezone: {}", timezone))
    }
}

pub fn parse_timezone(timezone: &str) -> Result<chrono_tz::Tz> {
    timezone.parse()
        .map_err(|_| anyhow!("Invalid timezone: {}", timezone))
}

pub fn convert_to_user_timezone(utc_time: DateTime<Utc>, timezone: &str) -> Result<DateTime<chrono_tz::Tz>> {
    let tz: chrono_tz::Tz = parse_timezone(timezone)?;
    Ok(utc_time.with_timezone(&tz))
}

pub fn convert_from_user_timezone(user_time: DateTime<chrono_tz::Tz>) -> DateTime<Utc> {
    user_time.with_timezone(&Utc)
}

pub fn is_time_for_reminder(
    current_time: DateTime<Utc>,
    reminder_time: &str,
    user_timezone: &str,
) -> Result<bool> {
    let user_tz: chrono_tz::Tz = parse_timezone(user_timezone)?;
    let user_time = current_time.with_timezone(&user_tz);
    
    let reminder_parts: Vec<&str> = reminder_time.split(':').collect();
    if reminder_parts.len() != 2 {
        return Err(anyhow!("Invalid reminder time format"));
    }
    
    let reminder_hour: u32 = reminder_parts[0].parse()
        .map_err(|_| anyhow!("Invalid hour in reminder time"))?;
    let reminder_minute: u32 = reminder_parts[1].parse()
        .map_err(|_| anyhow!("Invalid minute in reminder time"))?;
    
    Ok(user_time.hour() == reminder_hour && user_time.minute() == reminder_minute)
}

pub fn calculate_next_reminder_time(
    reminder_time: &str,
    user_timezone: &str,
) -> Result<DateTime<Utc>> {
    let user_tz: chrono_tz::Tz = parse_timezone(user_timezone)?;
    let now = Utc::now().with_timezone(&user_tz);
    
    let reminder_parts: Vec<&str> = reminder_time.split(':').collect();
    if reminder_parts.len() != 2 {
        return Err(anyhow!("Invalid reminder time format"));
    }
    
    let reminder_hour: u32 = reminder_parts[0].parse()
        .map_err(|_| anyhow!("Invalid hour in reminder time"))?;
    let reminder_minute: u32 = reminder_parts[1].parse()
        .map_err(|_| anyhow!("Invalid minute in reminder time"))?;
    
    let mut next_reminder = now.date_naive().and_hms_opt(reminder_hour, reminder_minute, 0)
        .ok_or_else(|| anyhow!("Invalid reminder time"))?;
    
    // If the time has already passed today, schedule for tomorrow
    if next_reminder <= now.naive_local() {
        next_reminder = next_reminder + chrono::Duration::days(1);
    }
    
    let next_reminder_utc = user_tz.from_local_datetime(&next_reminder)
        .single()
        .ok_or_else(|| anyhow!("Invalid timezone conversion"))?
        .with_timezone(&Utc);
    
    Ok(next_reminder_utc)
}

pub fn format_notification_message(template: &str, variables: HashMap<String, String>) -> String {
    let mut message = template.to_string();
    
    for (key, value) in variables {
        let placeholder = format!("{{{}}}", key);
        message = message.replace(&placeholder, &value);
    }
    
    message
}

pub fn sanitize_notification_data(data: &Value) -> Result<Value> {
    // Remove any sensitive data from notification payload
    let mut sanitized = data.clone();
    
    if let Some(obj) = sanitized.as_object_mut() {
        // Remove sensitive fields
        obj.remove("password");
        obj.remove("token");
        obj.remove("secret");
        obj.remove("key");
        
        // Limit data size
        if obj.len() > 10 {
            let mut limited = HashMap::new();
            let mut count = 0;
            for (key, value) in obj.iter() {
                if count >= 10 {
                    break;
                }
                limited.insert(key.clone(), value.clone());
                count += 1;
            }
            sanitized = Value::Object(limited.into_iter().collect());
        }
    }
    
    Ok(sanitized)
}

pub fn validate_notification_payload(payload: &Value) -> Result<()> {
    if let Some(obj) = payload.as_object() {
        // Check required fields
        if !obj.contains_key("title") || !obj.contains_key("body") {
            return Err(anyhow!("Missing required fields: title and body"));
        }
        
        // Validate title length
        if let Some(title) = obj.get("title").and_then(|v| v.as_str()) {
            if title.len() > 200 {
                return Err(anyhow!("Title too long. Maximum 200 characters"));
            }
        }
        
        // Validate body length
        if let Some(body) = obj.get("body").and_then(|v| v.as_str()) {
            if body.len() > 500 {
                return Err(anyhow!("Body too long. Maximum 500 characters"));
            }
        }
        
        // Validate data size
        if let Some(data) = obj.get("data") {
            let data_size = serde_json::to_string(data)?.len();
            if data_size > 1000 {
                return Err(anyhow!("Data payload too large. Maximum 1000 characters"));
            }
        }
    }
    
    Ok(())
}

pub fn generate_notification_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

pub fn calculate_ttl(days: i64) -> i64 {
    Utc::now().timestamp() + (days * 24 * 60 * 60)
}

pub fn is_notification_expired(ttl: i64) -> bool {
    Utc::now().timestamp() > ttl
}

pub fn format_delivery_status(status: &str) -> String {
    match status.to_lowercase().as_str() {
        "sent" => "Sent".to_string(),
        "delivered" => "Delivered".to_string(),
        "failed" => "Failed".to_string(),
        "bounced" => "Bounced".to_string(),
        "pending" => "Pending".to_string(),
        _ => "Unknown".to_string(),
    }
}

pub fn parse_delivery_status(status: &str) -> Result<crate::models::DeliveryStatus> {
    match status.to_lowercase().as_str() {
        "sent" => Ok(crate::models::DeliveryStatus::Sent),
        "delivered" => Ok(crate::models::DeliveryStatus::Delivered),
        "failed" => Ok(crate::models::DeliveryStatus::Failed),
        "bounced" => Ok(crate::models::DeliveryStatus::Bounced),
        "pending" => Ok(crate::models::DeliveryStatus::Pending),
        _ => Err(anyhow!("Invalid delivery status: {}", status)),
    }
}

pub fn create_error_response(message: &str, status_code: u16) -> Value {
    serde_json::json!({
        "statusCode": status_code,
        "body": serde_json::json!({
            "success": false,
            "message": message
        }).to_string()
    })
}

pub fn create_success_response(message: &str, data: Option<Value>) -> Value {
    let mut body = serde_json::json!({
        "success": true,
        "message": message
    });
    
    if let Some(data) = data {
        body["data"] = data;
    }
    
    serde_json::json!({
        "statusCode": 200,
        "body": body.to_string()
    })
}
