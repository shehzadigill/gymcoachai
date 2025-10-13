use regex::Regex;
use lazy_static::lazy_static;
use std::collections::HashMap;

lazy_static! {
    static ref PARAM_REGEX: Regex = Regex::new(r":([a-zA-Z_][a-zA-Z0-9_]*)").unwrap();
}

/// Path matcher with parameter extraction
#[derive(Debug, Clone)]
pub struct PathMatcher {
    pattern: String,
    regex: Regex,
    param_names: Vec<String>,
}

impl PathMatcher {
    /// Create a new PathMatcher from a route pattern
    /// Supports Express-like patterns: /api/users/:userId/posts/:postId
    pub fn new(pattern: &str) -> Self {
        let mut param_names = Vec::new();
        
        // Extract parameter names
        for cap in PARAM_REGEX.captures_iter(pattern) {
            param_names.push(cap[1].to_string());
        }
        
        // Convert Express-style pattern to regex
        let regex_pattern = PARAM_REGEX
            .replace_all(pattern, r"([^/]+)")
            .replace("/", r"/");
        
        let regex_pattern = format!("^{}$", regex_pattern);
        let regex = Regex::new(&regex_pattern).unwrap();
        
        Self {
            pattern: pattern.to_string(),
            regex,
            param_names,
        }
    }
    
    /// Check if path matches this pattern and extract parameters
    pub fn matches(&self, path: &str) -> Option<HashMap<String, String>> {
        self.regex.captures(path).map(|captures| {
            self.param_names
                .iter()
                .enumerate()
                .filter_map(|(i, name)| {
                    captures.get(i + 1).map(|m| (name.clone(), m.as_str().to_string()))
                })
                .collect()
        })
    }
    
    /// Get the original pattern
    pub fn pattern(&self) -> &str {
        &self.pattern
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_path() {
        let matcher = PathMatcher::new("/api/users");
        assert!(matcher.matches("/api/users").is_some());
        assert!(matcher.matches("/api/posts").is_none());
    }

    #[test]
    fn test_single_param() {
        let matcher = PathMatcher::new("/api/users/:userId");
        
        let params = matcher.matches("/api/users/123").unwrap();
        assert_eq!(params.get("userId"), Some(&"123".to_string()));
        
        assert!(matcher.matches("/api/users").is_none());
        assert!(matcher.matches("/api/users/123/extra").is_none());
    }

    #[test]
    fn test_multiple_params() {
        let matcher = PathMatcher::new("/api/users/:userId/posts/:postId");
        
        let params = matcher.matches("/api/users/123/posts/456").unwrap();
        assert_eq!(params.get("userId"), Some(&"123".to_string()));
        assert_eq!(params.get("postId"), Some(&"456".to_string()));
    }

    #[test]
    fn test_nested_paths() {
        let matcher = PathMatcher::new("/api/nutrition/users/:userId/meals/:mealId");
        
        let params = matcher.matches("/api/nutrition/users/user123/meals/meal456").unwrap();
        assert_eq!(params.get("userId"), Some(&"user123".to_string()));
        assert_eq!(params.get("mealId"), Some(&"meal456".to_string()));
    }
}
