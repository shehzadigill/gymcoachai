use serde::{Deserialize, Serialize};
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use anyhow::{Result, anyhow};
use std::collections::HashMap;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthContext {
    pub user_id: String,
    pub email: String,
    pub roles: Vec<String>,
    pub permissions: Vec<String>,
    pub exp: i64,
    pub iat: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthResult {
    pub is_authorized: bool,
    pub context: Option<AuthContext>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LambdaEvent {
    pub headers: Option<HashMap<String, String>>,
    pub request_context: Option<RequestContext>,
    pub path_parameters: Option<HashMap<String, String>>,
    pub query_string_parameters: Option<HashMap<String, String>>,
    pub body: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RequestContext {
    pub authorizer: Option<Authorizer>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Authorizer {
    pub user_id: Option<String>,
    pub claims: Option<HashMap<String, serde_json::Value>>,
}

pub struct AuthLayer {
    jwt_secret: String,
    cognito_region: String,
    cognito_user_pool_id: String,
}

impl AuthLayer {
    pub fn new() -> Self {
        Self {
            jwt_secret: std::env::var("JWT_SECRET").unwrap_or_else(|_| "default-secret".to_string()),
            cognito_region: std::env::var("COGNITO_REGION").unwrap_or_else(|_| "us-east-1".to_string()),
            cognito_user_pool_id: std::env::var("COGNITO_USER_POOL_ID").unwrap_or_else(|_| "".to_string()),
        }
    }

    pub async fn authenticate(&self, event: &LambdaEvent) -> Result<AuthResult> {
        // Extract token from Authorization header
        let token = self.extract_token(event)?;
        
        // Validate JWT token
        let claims = self.validate_jwt_token(&token)?;
        
        // Extract user context
        let context = self.extract_user_context(&claims)?;
        
        // Check if user is authorized
        let is_authorized = self.check_authorization(&context, event).await?;
        
        Ok(AuthResult {
            is_authorized,
            context: Some(context),
            error: None,
        })
    }

    fn extract_token(&self, event: &LambdaEvent) -> Result<String> {
        let headers = event.headers.as_ref()
            .ok_or_else(|| anyhow!("No headers found"))?;
        
        let auth_header = headers.get("authorization")
            .or_else(|| headers.get("Authorization"))
            .ok_or_else(|| anyhow!("No authorization header found"))?;
        
        if !auth_header.starts_with("Bearer ") {
            return Err(anyhow!("Invalid authorization header format"));
        }
        
        Ok(auth_header[7..].to_string())
    }

    fn validate_jwt_token(&self, token: &str) -> Result<HashMap<String, serde_json::Value>> {
        let mut validation = Validation::new(Algorithm::RS256);
        validation.set_issuer(&[&format!("https://cognito-idp.{}.amazonaws.com/{}", 
            self.cognito_region, self.cognito_user_pool_id)]);
        
        // For now, we'll use a simple validation approach
        // In production, you should fetch the public key from Cognito
        let claims: HashMap<String, serde_json::Value> = serde_json::from_str(token)?;
        
        // Check if token is expired
        if let Some(exp) = claims.get("exp") {
            if let Some(exp_timestamp) = exp.as_i64() {
                let now = Utc::now().timestamp();
                if now > exp_timestamp {
                    return Err(anyhow!("Token has expired"));
                }
            }
        }
        
        Ok(claims)
    }

    fn extract_user_context(&self, claims: &HashMap<String, serde_json::Value>) -> Result<AuthContext> {
        let user_id = claims.get("sub")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("No user ID found in token"))?;
        
        let email = claims.get("email")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("No email found in token"))?;
        
        let roles = claims.get("cognito:groups")
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|v| v.as_str()).map(|s| s.to_string()).collect())
            .unwrap_or_default();
        
        let permissions = claims.get("permissions")
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|v| v.as_str()).map(|s| s.to_string()).collect())
            .unwrap_or_default();
        
        let exp = claims.get("exp")
            .and_then(|v| v.as_i64())
            .unwrap_or(0);
        
        let iat = claims.get("iat")
            .and_then(|v| v.as_i64())
            .unwrap_or(0);
        
        Ok(AuthContext {
            user_id: user_id.to_string(),
            email: email.to_string(),
            roles,
            permissions,
            exp,
            iat,
        })
    }

    async fn check_authorization(&self, context: &AuthContext, event: &LambdaEvent) -> Result<bool> {
        // Check if user has required permissions for the requested resource
        let resource = self.extract_resource(event)?;
        let action = self.extract_action(event)?;
        
        // Check role-based access
        if self.check_role_access(context, &resource, &action) {
            return Ok(true);
        }
        
        // Check permission-based access
        if self.check_permission_access(context, &resource, &action) {
            return Ok(true);
        }
        
        // Check resource ownership
        if self.check_resource_ownership(context, event) {
            return Ok(true);
        }
        
        Ok(false)
    }

    fn extract_resource(&self, event: &LambdaEvent) -> Result<String> {
        let path = event.request_context.as_ref()
            .and_then(|ctx| ctx.authorizer.as_ref())
            .and_then(|auth| auth.claims.as_ref())
            .and_then(|claims| claims.get("path"))
            .and_then(|v| v.as_str())
            .unwrap_or("/");
        
        Ok(path.to_string())
    }

    fn extract_action(&self, event: &LambdaEvent) -> Result<String> {
        let method = event.request_context.as_ref()
            .and_then(|ctx| ctx.authorizer.as_ref())
            .and_then(|auth| auth.claims.as_ref())
            .and_then(|claims| claims.get("httpMethod"))
            .and_then(|v| v.as_str())
            .unwrap_or("GET");
        
        Ok(method.to_string())
    }

    fn check_role_access(&self, context: &AuthContext, resource: &str, action: &str) -> bool {
        // Define role-based access rules
        let admin_resources = ["/api/admin", "/api/analytics", "/api/coaching"];
        let user_resources = ["/api/user-profiles", "/api/workouts", "/api/nutrition"];
        
        if context.roles.contains(&"admin".to_string()) {
            return true; // Admin has access to everything
        }
        
        if context.roles.contains(&"user".to_string()) {
            return user_resources.iter().any(|&r| resource.starts_with(r));
        }
        
        false
    }

    fn check_permission_access(&self, context: &AuthContext, resource: &str, action: &str) -> bool {
        // Define permission-based access rules
        let required_permissions = match (resource, action) {
            (r, "GET") if r.starts_with("/api/user-profiles") => vec!["read:profile"],
            (r, "PUT") if r.starts_with("/api/user-profiles") => vec!["write:profile"],
            (r, "POST") if r.starts_with("/api/workouts") => vec!["write:workout"],
            (r, "GET") if r.starts_with("/api/workouts") => vec!["read:workout"],
            (r, "POST") if r.starts_with("/api/analytics") => vec!["write:analytics"],
            (r, "GET") if r.starts_with("/api/analytics") => vec!["read:analytics"],
            _ => vec![],
        };
        
        required_permissions.iter().all(|perm| context.permissions.contains(&perm.to_string()))
    }

    fn check_resource_ownership(&self, context: &AuthContext, event: &LambdaEvent) -> bool {
        // Check if user is accessing their own resources
        if let Some(path_params) = &event.path_parameters {
            if let Some(user_id) = path_params.get("userId") {
                return user_id == &context.user_id;
            }
        }
        
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn test_extract_token() {
        let mut headers = HashMap::new();
        headers.insert("authorization".to_string(), "Bearer test-token".to_string());
        
        let event = LambdaEvent {
            headers: Some(headers),
            request_context: None,
            path_parameters: None,
            query_string_parameters: None,
            body: None,
        };
        
        let auth_layer = AuthLayer::new();
        let result = auth_layer.extract_token(&event);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "test-token");
    }

    #[test]
    fn test_check_role_access() {
        let context = AuthContext {
            user_id: "user123".to_string(),
            email: "test@example.com".to_string(),
            roles: vec!["user".to_string()],
            permissions: vec![],
            exp: 0,
            iat: 0,
        };
        
        let auth_layer = AuthLayer::new();
        assert!(auth_layer.check_role_access(&context, "/api/user-profiles", "GET"));
        assert!(!auth_layer.check_role_access(&context, "/api/admin", "GET"));
    }

    #[test]
    fn test_check_permission_access() {
        let context = AuthContext {
            user_id: "user123".to_string(),
            email: "test@example.com".to_string(),
            roles: vec![],
            permissions: vec!["read:profile".to_string(), "write:workout".to_string()],
            exp: 0,
            iat: 0,
        };
        
        let auth_layer = AuthLayer::new();
        assert!(auth_layer.check_permission_access(&context, "/api/user-profiles", "GET"));
        assert!(auth_layer.check_permission_access(&context, "/api/workouts", "POST"));
        assert!(!auth_layer.check_permission_access(&context, "/api/analytics", "GET"));
    }
}
