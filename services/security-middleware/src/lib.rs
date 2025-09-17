use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use anyhow::{Result, anyhow};
use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct SecurityContext {
    pub request_id: String,
    pub user_id: Option<String>,
    pub ip_address: String,
    pub user_agent: String,
    pub timestamp: DateTime<Utc>,
    pub rate_limit_key: String,
    pub security_headers: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RateLimitInfo {
    pub key: String,
    pub limit: u32,
    pub remaining: u32,
    pub reset_time: DateTime<Utc>,
    pub retry_after: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SecurityValidationResult {
    pub is_valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
    pub rate_limit_info: Option<RateLimitInfo>,
}

pub struct SecurityMiddleware {
    rate_limits: HashMap<String, RateLimitConfig>,
    blocked_ips: std::collections::HashSet<String>,
    suspicious_patterns: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct RateLimitConfig {
    pub requests_per_minute: u32,
    pub requests_per_hour: u32,
    pub requests_per_day: u32,
    pub burst_limit: u32,
}

impl SecurityMiddleware {
    pub fn new() -> Self {
        let mut rate_limits = HashMap::new();
        
        // Default rate limits for different endpoints
        rate_limits.insert("auth".to_string(), RateLimitConfig {
            requests_per_minute: 5,
            requests_per_hour: 20,
            requests_per_day: 100,
            burst_limit: 10,
        });
        
        rate_limits.insert("api".to_string(), RateLimitConfig {
            requests_per_minute: 60,
            requests_per_hour: 1000,
            requests_per_day: 10000,
            burst_limit: 100,
        });
        
        rate_limits.insert("upload".to_string(), RateLimitConfig {
            requests_per_minute: 10,
            requests_per_hour: 100,
            requests_per_day: 500,
            burst_limit: 20,
        });

        Self {
            rate_limits,
            blocked_ips: std::collections::HashSet::new(),
            suspicious_patterns: vec![
                "script".to_string(),
                "javascript".to_string(),
                "eval".to_string(),
                "expression".to_string(),
                "onload".to_string(),
                "onerror".to_string(),
                "onclick".to_string(),
                "onmouseover".to_string(),
                "onfocus".to_string(),
                "onblur".to_string(),
                "onchange".to_string(),
                "onsubmit".to_string(),
                "onreset".to_string(),
                "onselect".to_string(),
                "onkeydown".to_string(),
                "onkeyup".to_string(),
                "onkeypress".to_string(),
                "onmousedown".to_string(),
                "onmouseup".to_string(),
                "onmousemove".to_string(),
                "onmouseout".to_string(),
                "onmouseenter".to_string(),
                "onmouseleave".to_string(),
                "oncontextmenu".to_string(),
                "ondblclick".to_string(),
                "onwheel".to_string(),
                "ontouchstart".to_string(),
                "ontouchend".to_string(),
                "ontouchmove".to_string(),
                "ontouchcancel".to_string(),
                "onpointerdown".to_string(),
                "onpointerup".to_string(),
                "onpointermove".to_string(),
                "onpointercancel".to_string(),
                "onpointerenter".to_string(),
                "onpointerleave".to_string(),
                "onpointerover".to_string(),
                "onpointerout".to_string(),
                "onpointerlockchange".to_string(),
                "onpointerlockerror".to_string(),
                "ongotpointercapture".to_string(),
                "onlostpointercapture".to_string(),
                "onpointerdown".to_string(),
                "onpointerup".to_string(),
                "onpointermove".to_string(),
                "onpointercancel".to_string(),
                "onpointerenter".to_string(),
                "onpointerleave".to_string(),
                "onpointerover".to_string(),
                "onpointerout".to_string(),
                "onpointerlockchange".to_string(),
                "onpointerlockerror".to_string(),
                "ongotpointercapture".to_string(),
                "onlostpointercapture".to_string(),
            ],
        }
    }

    pub async fn validate_request(&self, context: &SecurityContext) -> Result<SecurityValidationResult> {
        let mut errors = Vec::new();
        let mut warnings = Vec::new();
        let mut rate_limit_info = None;

        // Check if IP is blocked
        if self.blocked_ips.contains(&context.ip_address) {
            errors.push("IP address is blocked".to_string());
            return Ok(SecurityValidationResult {
                is_valid: false,
                errors,
                warnings,
                rate_limit_info,
            });
        }

        // Validate rate limiting
        if let Some(rate_limit) = self.check_rate_limit(context).await? {
            if rate_limit.remaining == 0 {
                errors.push("Rate limit exceeded".to_string());
                return Ok(SecurityValidationResult {
                    is_valid: false,
                    errors,
                    warnings,
                    rate_limit_info: Some(rate_limit),
                });
            }
            rate_limit_info = Some(rate_limit);
        }

        // Validate input for XSS
        if let Some(body) = context.security_headers.get("body") {
            if self.contains_xss_patterns(body) {
                errors.push("Potential XSS attack detected".to_string());
            }
        }

        // Validate input for SQL injection
        if let Some(body) = context.security_headers.get("body") {
            if self.contains_sql_injection_patterns(body) {
                errors.push("Potential SQL injection attack detected".to_string());
            }
        }

        // Validate input for NoSQL injection
        if let Some(body) = context.security_headers.get("body") {
            if self.contains_nosql_injection_patterns(body) {
                errors.push("Potential NoSQL injection attack detected".to_string());
            }
        }

        // Check for suspicious user agent
        if self.is_suspicious_user_agent(&context.user_agent) {
            warnings.push("Suspicious user agent detected".to_string());
        }

        // Validate request size
        if let Some(body) = context.security_headers.get("body") {
            if body.len() > 10 * 1024 * 1024 { // 10MB limit
                errors.push("Request body too large".to_string());
            }
        }

        // Check for required security headers
        if !context.security_headers.contains_key("content-type") {
            warnings.push("Missing Content-Type header".to_string());
        }

        Ok(SecurityValidationResult {
            is_valid: errors.is_empty(),
            errors,
            warnings,
            rate_limit_info,
        })
    }

    async fn check_rate_limit(&self, context: &SecurityContext) -> Result<Option<RateLimitInfo>> {
        let endpoint_type = self.get_endpoint_type(&context.security_headers);
        let config = self.rate_limits.get(&endpoint_type)
            .ok_or_else(|| anyhow!("No rate limit configuration found for endpoint type: {}", endpoint_type))?;

        // In a real implementation, you would check against a cache like Redis
        // For now, we'll simulate the rate limit check
        let rate_limit_info = RateLimitInfo {
            key: context.rate_limit_key.clone(),
            limit: config.requests_per_minute,
            remaining: config.requests_per_minute - 1, // Simulate some usage
            reset_time: Utc::now() + chrono::Duration::minutes(1),
            retry_after: None,
        };

        Ok(Some(rate_limit_info))
    }

    fn get_endpoint_type(&self, headers: &HashMap<String, String>) -> String {
        if let Some(path) = headers.get("path") {
            if path.contains("/auth/") {
                "auth".to_string()
            } else if path.contains("/upload/") {
                "upload".to_string()
            } else {
                "api".to_string()
            }
        } else {
            "api".to_string()
        }
    }

    fn contains_xss_patterns(&self, input: &str) -> bool {
        let input_lower = input.to_lowercase();
        self.suspicious_patterns.iter().any(|pattern| input_lower.contains(pattern))
    }

    fn contains_sql_injection_patterns(&self, input: &str) -> bool {
        let sql_patterns = vec![
            "union select",
            "drop table",
            "delete from",
            "insert into",
            "update set",
            "create table",
            "alter table",
            "exec(",
            "execute(",
            "sp_",
            "xp_",
            "waitfor delay",
            "benchmark(",
            "sleep(",
            "pg_sleep(",
            "load_file(",
            "into outfile",
            "into dumpfile",
            "char(",
            "ascii(",
            "ord(",
            "hex(",
            "unhex(",
            "concat(",
            "group_concat(",
            "version()",
            "database()",
            "user()",
            "current_user",
            "current_database",
            "information_schema",
            "sys.tables",
            "sys.columns",
            "sys.databases",
            "sys.users",
            "sys.schemas",
            "sys.objects",
            "sys.tables",
            "sys.columns",
            "sys.databases",
            "sys.users",
            "sys.schemas",
            "sys.objects",
        ];

        let input_lower = input.to_lowercase();
        sql_patterns.iter().any(|pattern| input_lower.contains(pattern))
    }

    fn contains_nosql_injection_patterns(&self, input: &str) -> bool {
        let nosql_patterns = vec![
            "$where",
            "$ne",
            "$gt",
            "$lt",
            "$gte",
            "$lte",
            "$in",
            "$nin",
            "$exists",
            "$regex",
            "$text",
            "$search",
            "$geoWithin",
            "$geoIntersects",
            "$near",
            "$nearSphere",
            "$center",
            "$centerSphere",
            "$box",
            "$polygon",
            "$geometry",
            "$maxDistance",
            "$minDistance",
            "$all",
            "$elemMatch",
            "$size",
            "$type",
            "$mod",
            "$bitsAllSet",
            "$bitsAnySet",
            "$bitsAllClear",
            "$bitsAnyClear",
            "$rand",
            "$expr",
            "$jsonSchema",
            "$or",
            "$and",
            "$not",
            "$nor",
        ];

        let input_lower = input.to_lowercase();
        nosql_patterns.iter().any(|pattern| input_lower.contains(pattern))
    }

    fn is_suspicious_user_agent(&self, user_agent: &str) -> bool {
        let suspicious_agents = vec![
            "sqlmap",
            "nikto",
            "nmap",
            "masscan",
            "zap",
            "burp",
            "w3af",
            "acunetix",
            "nessus",
            "openvas",
            "qualys",
            "rapid7",
            "tenable",
            "veracode",
            "checkmarx",
            "fortify",
            "appscan",
            "webinspect",
            "paros",
            "wget",
            "curl",
            "python-requests",
            "go-http-client",
            "java-http-client",
            "okhttp",
            "apache-httpclient",
            "libwww-perl",
            "lwp-trivial",
            "wget",
            "curl",
            "python-requests",
            "go-http-client",
            "java-http-client",
            "okhttp",
            "apache-httpclient",
            "libwww-perl",
            "lwp-trivial",
        ];

        let user_agent_lower = user_agent.to_lowercase();
        suspicious_agents.iter().any(|agent| user_agent_lower.contains(agent))
    }

    pub fn add_blocked_ip(&mut self, ip: String) {
        self.blocked_ips.insert(ip);
    }

    pub fn remove_blocked_ip(&mut self, ip: &str) {
        self.blocked_ips.remove(ip);
    }

    pub fn is_ip_blocked(&self, ip: &str) -> bool {
        self.blocked_ips.contains(ip)
    }

    pub fn get_security_headers() -> HashMap<String, String> {
        let mut headers = HashMap::new();
        headers.insert("X-Content-Type-Options".to_string(), "nosniff".to_string());
        headers.insert("X-Frame-Options".to_string(), "DENY".to_string());
        headers.insert("X-XSS-Protection".to_string(), "1; mode=block".to_string());
        headers.insert("Strict-Transport-Security".to_string(), "max-age=31536000; includeSubDomains".to_string());
        headers.insert("Content-Security-Policy".to_string(), "default-src 'self'".to_string());
        headers.insert("Referrer-Policy".to_string(), "strict-origin-when-cross-origin".to_string());
        headers.insert("Permissions-Policy".to_string(), "geolocation=(), microphone=(), camera=()".to_string());
        headers
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_security_middleware_creation() {
        let middleware = SecurityMiddleware::new();
        assert!(!middleware.rate_limits.is_empty());
        assert!(middleware.blocked_ips.is_empty());
    }

    #[test]
    fn test_xss_detection() {
        let middleware = SecurityMiddleware::new();
        assert!(middleware.contains_xss_patterns("<script>alert('xss')</script>"));
        assert!(middleware.contains_xss_patterns("onclick=\"alert('xss')\""));
        assert!(!middleware.contains_xss_patterns("normal text"));
    }

    #[test]
    fn test_sql_injection_detection() {
        let middleware = SecurityMiddleware::new();
        assert!(middleware.contains_sql_injection_patterns("'; DROP TABLE users; --"));
        assert!(middleware.contains_sql_injection_patterns("UNION SELECT * FROM users"));
        assert!(!middleware.contains_sql_injection_patterns("normal query"));
    }

    #[test]
    fn test_nosql_injection_detection() {
        let middleware = SecurityMiddleware::new();
        assert!(middleware.contains_nosql_injection_patterns("{\"$where\": \"this.password == this.username\"}"));
        assert!(middleware.contains_nosql_injection_patterns("{\"$ne\": null}"));
        assert!(!middleware.contains_nosql_injection_patterns("{\"username\": \"test\"}"));
    }

    #[test]
    fn test_suspicious_user_agent_detection() {
        let middleware = SecurityMiddleware::new();
        assert!(middleware.is_suspicious_user_agent("sqlmap/1.0"));
        assert!(middleware.is_suspicious_user_agent("curl/7.68.0"));
        assert!(!middleware.is_suspicious_user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"));
    }

    #[test]
    fn test_ip_blocking() {
        let mut middleware = SecurityMiddleware::new();
        let ip = "192.168.1.1";
        
        assert!(!middleware.is_ip_blocked(ip));
        middleware.add_blocked_ip(ip.to_string());
        assert!(middleware.is_ip_blocked(ip));
        
        middleware.remove_blocked_ip(ip);
        assert!(!middleware.is_ip_blocked(ip));
    }
}
