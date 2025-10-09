use serde_json::Value;
use std::collections::HashMap;

use crate::utils::parse_query_string;

/// Route matcher for efficient path matching
pub struct RouteMatcher;

impl RouteMatcher {
    /// Match routes based on HTTP method and path patterns
    pub fn match_route(method: &str, path: &str) -> Option<Route> {
        match (method, path) {
            // Meal routes
            ("POST", path)
                if Self::is_meal_path(path)
                    && path.ends_with("/meals")
                    && !path.contains("/water/") =>
            {
                Some(Route::CreateMeal)
            }
            ("GET", path)
                if Self::is_meal_path(path)
                    && path.contains("/meals/")
                    && !path.contains("/date") =>
            {
                Some(Route::GetMeal)
            }
            ("GET", path) if Self::is_meal_path(path) && path.contains("/meals/date/") => {
                Some(Route::GetMealsByDate)
            }
            ("GET", path) if Self::is_meal_path(path) && path.ends_with("/meals") => {
                Some(Route::GetUserMeals)
            }
            ("PUT", path)
                if Self::is_meal_path(path)
                    && path.contains("/meals/")
                    && !path.contains("/date") =>
            {
                Some(Route::UpdateMeal)
            }
            ("DELETE", path)
                if Self::is_meal_path(path)
                    && path.contains("/meals/")
                    && !path.contains("/date") =>
            {
                Some(Route::DeleteMeal)
            }

            // Food routes
            ("POST", path) if Self::is_food_path(path) => Some(Route::CreateFood),
            ("GET", path) if Self::is_food_path(path) && !path.contains("/search") => {
                Some(Route::GetFood)
            }
            ("GET", path) if Self::is_food_search_path(path) => Some(Route::SearchFoods),

            // Favorite food routes
            ("POST", path) if Self::is_meal_path(path) && path.contains("/favorites/foods/") => {
                Some(Route::AddFavoriteFood)
            }
            ("DELETE", path) if Self::is_meal_path(path) && path.contains("/favorites/foods/") => {
                Some(Route::RemoveFavoriteFood)
            }
            ("GET", path) if Self::is_meal_path(path) && path.ends_with("/favorites/foods") => {
                Some(Route::ListFavoriteFoods)
            }

            // Nutrition plan routes
            ("POST", path) if Self::is_meal_path(path) && path.ends_with("/nutrition-plans") => {
                Some(Route::CreateNutritionPlan)
            }
            ("GET", path) if Self::is_meal_path(path) && path.contains("/nutrition-plans/") => {
                Some(Route::GetNutritionPlan)
            }

            // Nutrition statistics routes
            ("GET", path) if Self::is_meal_path(path) && path.ends_with("/stats") => {
                Some(Route::GetNutritionStats)
            }

            // Water intake routes
            ("GET", path) if Self::is_meal_path(path) && path.contains("/water/date/") => {
                Some(Route::GetWater)
            }
            ("POST", path) if Self::is_meal_path(path) && path.contains("/water/date/") => {
                Some(Route::SetWater)
            }

            _ => None,
        }
    }

    /// Check if path is a meal-related path (user-specific)
    fn is_meal_path(path: &str) -> bool {
        path.starts_with("/api/nutrition/users/")
            || path.starts_with("/api/users/")
            || path.starts_with("/users/")
            || path.starts_with("/api/nutrition/me/")
            || path.starts_with("/nutrition/me/")
            || path.starts_with("/me/")
    }

    /// Check if path is a food-related path (global)
    fn is_food_path(path: &str) -> bool {
        path == "/api/foods"
            || path == "/foods"
            || path == "/api/nutrition/foods"
            || path == "/nutrition/foods"
            || path.starts_with("/api/foods/")
            || path.starts_with("/foods/")
            || path.starts_with("/api/nutrition/foods/")
            || path.starts_with("/nutrition/foods/")
    }

    /// Check if path is a food search path
    fn is_food_search_path(path: &str) -> bool {
        path == "/api/foods/search"
            || path == "/foods/search"
            || path == "/api/nutrition/foods/search"
            || path == "/nutrition/foods/search"
    }

    /// Extract query parameters for routes that need them
    pub fn extract_query_params(event: &Value) -> HashMap<String, String> {
        parse_query_string(event)
    }
}

/// Route enum for type-safe routing
#[derive(Debug, Clone, PartialEq)]
pub enum Route {
    // Meal Routes
    CreateMeal,
    GetMeal,
    GetMealsByDate,
    GetUserMeals,
    UpdateMeal,
    DeleteMeal,

    // Food Routes
    CreateFood,
    GetFood,
    SearchFoods,

    // Favorite Food Routes
    AddFavoriteFood,
    RemoveFavoriteFood,
    ListFavoriteFoods,

    // Nutrition Plan Routes
    CreateNutritionPlan,
    GetNutritionPlan,

    // Nutrition Statistics Routes
    GetNutritionStats,

    // Water Intake Routes
    GetWater,
    SetWater,
}

impl Route {
    /// Get the controller method name for logging (optional)
    pub fn method_name(&self) -> &'static str {
        match self {
            Route::CreateMeal => "POST create meal",
            Route::GetMeal => "GET meal",
            Route::GetMealsByDate => "GET meals by date",
            Route::GetUserMeals => "GET user meals",
            Route::UpdateMeal => "PUT update meal",
            Route::DeleteMeal => "DELETE meal",
            Route::CreateFood => "POST create food",
            Route::GetFood => "GET food",
            Route::SearchFoods => "GET search foods",
            Route::AddFavoriteFood => "POST add favorite food",
            Route::RemoveFavoriteFood => "DELETE remove favorite food",
            Route::ListFavoriteFoods => "GET list favorite foods",
            Route::CreateNutritionPlan => "POST create nutrition plan",
            Route::GetNutritionPlan => "GET nutrition plan",
            Route::GetNutritionStats => "GET nutrition stats",
            Route::GetWater => "GET water intake",
            Route::SetWater => "POST set water intake",
        }
    }
}
