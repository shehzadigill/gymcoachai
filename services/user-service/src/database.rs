use aws_sdk_dynamodb::{Client as DynamoDbClient, types::AttributeValue};
use aws_sdk_dynamodb::types::ReturnValue;
use serde_json::Value;
use std::collections::HashMap;
use anyhow::Result;
use tracing::{info, error, warn};

use crate::models::*;

pub struct UserRepository {
    client: DynamoDbClient,
    table_name: String,
}

impl UserRepository {
    pub fn new(client: DynamoDbClient, table_name: String) -> Self {
        Self { client, table_name }
    }

    pub async fn create_user(&self, user: &User) -> Result<User> {
        let mut item = HashMap::new();
        
        // Primary key
        item.insert("PK".to_string(), AttributeValue::S(format!("USER#{}", user.id)));
        item.insert("SK".to_string(), AttributeValue::S(format!("USER#{}", user.id)));
        item.insert("GSI1PK".to_string(), AttributeValue::S(format!("USER#{}", user.email)));
        item.insert("GSI1SK".to_string(), AttributeValue::S(format!("USER#{}", user.id)));
        
        // Entity type
        item.insert("EntityType".to_string(), AttributeValue::S("USER".to_string()));
        
        // User data
        item.insert("UserId".to_string(), AttributeValue::S(user.id.clone()));
        item.insert("Email".to_string(), AttributeValue::S(user.email.clone()));
        item.insert("Name".to_string(), AttributeValue::S(user.name.clone()));
        
        if let Some(first_name) = &user.first_name {
            item.insert("FirstName".to_string(), AttributeValue::S(first_name.clone()));
        }
        
        if let Some(last_name) = &user.last_name {
            item.insert("LastName".to_string(), AttributeValue::S(last_name.clone()));
        }
        
        if let Some(username) = &user.username {
            item.insert("Username".to_string(), AttributeValue::S(username.clone()));
        }
        
        if let Some(phone_number) = &user.phone_number {
            item.insert("PhoneNumber".to_string(), AttributeValue::S(phone_number.clone()));
        }
        
        if let Some(date_of_birth) = &user.date_of_birth {
            item.insert("DateOfBirth".to_string(), AttributeValue::S(date_of_birth.to_rfc3339()));
        }
        
        if let Some(gender) = &user.gender {
            item.insert("Gender".to_string(), AttributeValue::S(serde_json::to_string(gender)?));
        }
        
        if let Some(profile_picture_url) = &user.profile_picture_url {
            item.insert("ProfilePictureUrl".to_string(), AttributeValue::S(profile_picture_url.clone()));
        }
        
        item.insert("IsActive".to_string(), AttributeValue::Bool(user.is_active));
        item.insert("IsVerified".to_string(), AttributeValue::Bool(user.is_verified));
        item.insert("EmailVerified".to_string(), AttributeValue::Bool(user.email_verified));
        item.insert("PhoneVerified".to_string(), AttributeValue::Bool(user.phone_verified));
        
        item.insert("CreatedAt".to_string(), AttributeValue::S(user.created_at.to_rfc3339()));
        item.insert("UpdatedAt".to_string(), AttributeValue::S(user.updated_at.to_rfc3339()));
        
        if let Some(last_login_at) = &user.last_login_at {
            item.insert("LastLoginAt".to_string(), AttributeValue::S(last_login_at.to_rfc3339()));
        }
        
        // Preferences
        item.insert("Preferences".to_string(), AttributeValue::S(serde_json::to_string(&user.preferences)?));
        
        // Subscription
        if let Some(subscription) = &user.subscription {
            item.insert("Subscription".to_string(), AttributeValue::S(serde_json::to_string(subscription)?));
        }
        
        // Roles
        let roles_json = serde_json::to_string(&user.roles)?;
        item.insert("Roles".to_string(), AttributeValue::S(roles_json));
        
        // TTL for soft deletes (30 days)
        let ttl = (chrono::Utc::now() + chrono::Duration::days(30)).timestamp();
        item.insert("TTL".to_string(), AttributeValue::N(ttl.to_string()));

        let request = self.client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .condition_expression("attribute_not_exists(PK)");

        match request.send().await {
            Ok(_) => {
                info!("User created successfully: {}", user.id);
                Ok(user.clone())
            }
            Err(e) => {
                error!("Failed to create user: {}", e);
                Err(anyhow::anyhow!("Failed to create user: {}", e))
            }
        }
    }

    pub async fn get_user_by_id(&self, user_id: &str) -> Result<Option<User>> {
        let request = self.client
            .get_item()
            .table_name(&self.table_name)
            .key("PK", AttributeValue::S(format!("USER#{}", user_id)))
            .key("SK", AttributeValue::S(format!("USER#{}", user_id)));

        match request.send().await {
            Ok(response) => {
                if let Some(item) = response.item() {
                    self.item_to_user(item)
                } else {
                    Ok(None)
                }
            }
            Err(e) => {
                error!("Failed to get user by ID: {}", e);
                Err(anyhow::anyhow!("Failed to get user: {}", e))
            }
        }
    }

    pub async fn get_user_by_email(&self, email: &str) -> Result<Option<User>> {
        let request = self.client
            .query()
            .table_name(&self.table_name)
            .index_name("GSI1")
            .key_condition_expression("GSI1PK = :gsi1pk")
            .expression_attribute_values(":gsi1pk", AttributeValue::S(format!("USER#{}", email)));

        match request.send().await {
            Ok(response) => {
                if let Some(items) = response.items() {
                    if let Some(item) = items.first() {
                        self.item_to_user(item)
                    } else {
                        Ok(None)
                    }
                } else {
                    Ok(None)
                }
            }
            Err(e) => {
                error!("Failed to get user by email: {}", e);
                Err(anyhow::anyhow!("Failed to get user: {}", e))
            }
        }
    }

    pub async fn get_user_by_username(&self, username: &str) -> Result<Option<User>> {
        // Use Scan with filter expression since username lookups are rare
        let request = self.client
            .scan()
            .table_name(&self.table_name)
            .filter_expression("EntityType = :entity_type AND Username = :username")
            .expression_attribute_values(":entity_type", AttributeValue::S("USER".to_string()))
            .expression_attribute_values(":username", AttributeValue::S(username.to_string()));

        match request.send().await {
            Ok(response) => {
                if let Some(items) = response.items() {
                    if let Some(item) = items.first() {
                        self.item_to_user(item)
                    } else {
                        Ok(None)
                    }
                } else {
                    Ok(None)
                }
            }
            Err(e) => {
                error!("Failed to get user by username: {}", e);
                Err(anyhow::anyhow!("Failed to get user: {}", e))
            }
        }
    }

    pub async fn update_user(&self, user_id: &str, updates: &UpdateUserRequest) -> Result<User> {
        let mut update_expression = "SET UpdatedAt = :updated_at".to_string();
        let mut expression_attribute_names = HashMap::new();
        let mut expression_attribute_values = HashMap::new();

        expression_attribute_values.insert(":updated_at".to_string(), 
            AttributeValue::S(chrono::Utc::now().to_rfc3339()));

        if let Some(name) = &updates.name {
            update_expression.push_str(", #name = :name");
            expression_attribute_names.insert("#name".to_string(), "Name".to_string());
            expression_attribute_values.insert(":name".to_string(), AttributeValue::S(name.clone()));
        }

        if let Some(first_name) = &updates.first_name {
            update_expression.push_str(", FirstName = :first_name");
            expression_attribute_values.insert(":first_name".to_string(), AttributeValue::S(first_name.clone()));
        }

        if let Some(last_name) = &updates.last_name {
            update_expression.push_str(", LastName = :last_name");
            expression_attribute_values.insert(":last_name".to_string(), AttributeValue::S(last_name.clone()));
        }

        if let Some(username) = &updates.username {
            update_expression.push_str(", Username = :username");
            expression_attribute_values.insert(":username".to_string(), AttributeValue::S(username.clone()));
        }

        if let Some(phone_number) = &updates.phone_number {
            update_expression.push_str(", PhoneNumber = :phone_number");
            expression_attribute_values.insert(":phone_number".to_string(), AttributeValue::S(phone_number.clone()));
        }

        if let Some(date_of_birth) = &updates.date_of_birth {
            update_expression.push_str(", DateOfBirth = :date_of_birth");
            expression_attribute_values.insert(":date_of_birth".to_string(), AttributeValue::S(date_of_birth.to_rfc3339()));
        }

        if let Some(gender) = &updates.gender {
            update_expression.push_str(", Gender = :gender");
            expression_attribute_values.insert(":gender".to_string(), AttributeValue::S(serde_json::to_string(gender)?));
        }

        if let Some(profile_picture_url) = &updates.profile_picture_url {
            update_expression.push_str(", ProfilePictureUrl = :profile_picture_url");
            expression_attribute_values.insert(":profile_picture_url".to_string(), AttributeValue::S(profile_picture_url.clone()));
        }

        if let Some(preferences) = &updates.preferences {
            update_expression.push_str(", Preferences = :preferences");
            expression_attribute_values.insert(":preferences".to_string(), AttributeValue::S(serde_json::to_string(preferences)?));
        }

        if let Some(subscription) = &updates.subscription {
            update_expression.push_str(", Subscription = :subscription");
            expression_attribute_values.insert(":subscription".to_string(), AttributeValue::S(serde_json::to_string(subscription)?));
        }

        if let Some(roles) = &updates.roles {
            update_expression.push_str(", Roles = :roles");
            expression_attribute_values.insert(":roles".to_string(), AttributeValue::S(serde_json::to_string(roles)?));
        }

        let mut request = self.client
            .update_item()
            .table_name(&self.table_name)
            .key("PK", AttributeValue::S(format!("USER#{}", user_id)))
            .key("SK", AttributeValue::S(format!("USER#{}", user_id)))
            .update_expression(update_expression)
            .expression_attribute_values(expression_attribute_values)
            .return_values(ReturnValue::AllNew);

        if !expression_attribute_names.is_empty() {
            request = request.expression_attribute_names(expression_attribute_names);
        }

        match request.send().await {
            Ok(response) => {
                if let Some(attributes) = response.attributes() {
                    self.item_to_user(attributes)
                } else {
                    Err(anyhow::anyhow!("No attributes returned from update"))
                }
            }
            Err(e) => {
                error!("Failed to update user: {}", e);
                Err(anyhow::anyhow!("Failed to update user: {}", e))
            }
        }
    }

    pub async fn delete_user(&self, user_id: &str) -> Result<()> {
        let request = self.client
            .delete_item()
            .table_name(&self.table_name)
            .key("PK", AttributeValue::S(format!("USER#{}", user_id)))
            .key("SK", AttributeValue::S(format!("USER#{}", user_id)));

        match request.send().await {
            Ok(_) => {
                info!("User deleted successfully: {}", user_id);
                Ok(())
            }
            Err(e) => {
                error!("Failed to delete user: {}", e);
                Err(anyhow::anyhow!("Failed to delete user: {}", e))
            }
        }
    }

    pub async fn list_users(&self, page: u32, limit: u32) -> Result<UserListResponse> {
        let request = self.client
            .scan()
            .table_name(&self.table_name)
            .filter_expression("EntityType = :entity_type")
            .expression_attribute_values(":entity_type", AttributeValue::S("USER".to_string()))
            .limit(limit as i32);

        match request.send().await {
            Ok(response) => {
                let mut users = Vec::new();
                
                if let Some(items) = response.items() {
                    for item in items {
                        if let Ok(user) = self.item_to_user(item) {
                            users.push(UserSummary {
                                id: user.id,
                                email: user.email,
                                name: user.name,
                                username: user.username,
                                profile_picture_url: user.profile_picture_url,
                                is_active: user.is_active,
                                is_verified: user.is_verified,
                                created_at: user.created_at,
                                last_login_at: user.last_login_at,
                                roles: user.roles,
                            });
                        }
                    }
                }

                let total = response.count().unwrap_or(0) as u32;
                let total_pages = (total + limit - 1) / limit;
                let has_next = page < total_pages;
                let has_prev = page > 1;

                Ok(UserListResponse {
                    users,
                    pagination: PaginationInfo {
                        page,
                        limit,
                        total,
                        total_pages,
                        has_next,
                        has_prev,
                    },
                })
            }
            Err(e) => {
                error!("Failed to list users: {}", e);
                Err(anyhow::anyhow!("Failed to list users: {}", e))
            }
        }
    }

    pub async fn get_user_stats(&self) -> Result<UserStats> {
        // This would typically involve multiple queries to get comprehensive stats
        // For now, we'll implement a basic version
        
        let request = self.client
            .scan()
            .table_name(&self.table_name)
            .filter_expression("EntityType = :entity_type")
            .expression_attribute_values(":entity_type", AttributeValue::S("USER".to_string()))
            .select(aws_sdk_dynamodb::types::Select::Count);

        match request.send().await {
            Ok(response) => {
                let total_users = response.count().unwrap_or(0) as u32;
                
                // For a real implementation, you'd want to run additional queries
                // to get more detailed statistics
                Ok(UserStats {
                    total_users,
                    active_users: total_users, // Simplified
                    verified_users: total_users, // Simplified
                    new_users_today: 0,
                    new_users_this_week: 0,
                    new_users_this_month: 0,
                    subscription_stats: SubscriptionStats {
                        free_users: total_users,
                        basic_users: 0,
                        premium_users: 0,
                        pro_users: 0,
                        total_revenue: 0.0,
                        monthly_recurring_revenue: 0.0,
                    },
                })
            }
            Err(e) => {
                error!("Failed to get user stats: {}", e);
                Err(anyhow::anyhow!("Failed to get user stats: {}", e))
            }
        }
    }

    fn item_to_user(&self, item: &HashMap<String, AttributeValue>) -> Result<User> {
        let id = item.get("UserId")
            .and_then(|v| v.as_s().ok())
            .ok_or_else(|| anyhow::anyhow!("Missing UserId"))?
            .clone();

        let email = item.get("Email")
            .and_then(|v| v.as_s().ok())
            .ok_or_else(|| anyhow::anyhow!("Missing Email"))?
            .clone();

        let name = item.get("Name")
            .and_then(|v| v.as_s().ok())
            .ok_or_else(|| anyhow::anyhow!("Missing Name"))?
            .clone();

        let first_name = item.get("FirstName")
            .and_then(|v| v.as_s().ok())
            .map(|s| s.clone());

        let last_name = item.get("LastName")
            .and_then(|v| v.as_s().ok())
            .map(|s| s.clone());

        let username = item.get("Username")
            .and_then(|v| v.as_s().ok())
            .map(|s| s.clone());

        let phone_number = item.get("PhoneNumber")
            .and_then(|v| v.as_s().ok())
            .map(|s| s.clone());

        let date_of_birth = item.get("DateOfBirth")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&chrono::Utc));

        let gender = item.get("Gender")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| serde_json::from_str::<Gender>(s).ok());

        let profile_picture_url = item.get("ProfilePictureUrl")
            .and_then(|v| v.as_s().ok())
            .map(|s| s.clone());

        let is_active = item.get("IsActive")
            .and_then(|v| v.as_bool().ok())
            .unwrap_or(true);

        let is_verified = item.get("IsVerified")
            .and_then(|v| v.as_bool().ok())
            .unwrap_or(false);

        let email_verified = item.get("EmailVerified")
            .and_then(|v| v.as_bool().ok())
            .unwrap_or(false);

        let phone_verified = item.get("PhoneVerified")
            .and_then(|v| v.as_bool().ok())
            .unwrap_or(false);

        let created_at = item.get("CreatedAt")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .unwrap_or_else(|| chrono::Utc::now());

        let updated_at = item.get("UpdatedAt")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .unwrap_or_else(|| chrono::Utc::now());

        let last_login_at = item.get("LastLoginAt")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&chrono::Utc));

        let preferences = item.get("Preferences")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| serde_json::from_str::<UserPreferences>(s).ok())
            .unwrap_or_default();

        let subscription = item.get("Subscription")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| serde_json::from_str::<Subscription>(s).ok());

        let roles = item.get("Roles")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| serde_json::from_str::<Vec<Role>>(s).ok())
            .unwrap_or_else(|| vec![Role::User]);

        Ok(User {
            id,
            email,
            name,
            first_name,
            last_name,
            username,
            phone_number,
            date_of_birth,
            gender,
            profile_picture_url,
            is_active,
            is_verified,
            email_verified,
            phone_verified,
            created_at,
            updated_at,
            last_login_at,
            preferences,
            subscription,
            roles,
        })
    }
}
