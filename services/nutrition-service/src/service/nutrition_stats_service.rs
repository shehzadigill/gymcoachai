use serde_json::{json, Value};
use anyhow::Result;
use chrono::{Utc, Datelike};

use crate::repository::{MealRepository, WaterRepository};
use auth_layer::AuthContext;

#[derive(Clone)]
pub struct NutritionStatsService {
    meal_repository: MealRepository,
    water_repository: WaterRepository,
}

impl NutritionStatsService {
    pub fn new(meal_repository: MealRepository, water_repository: WaterRepository) -> Self {
        Self {
            meal_repository,
            water_repository,
        }
    }

    pub async fn get_nutrition_stats(&self, user_id: &str, auth_context: &AuthContext) -> Result<Value> {
        // Authorization check
        if auth_context.user_id != user_id {
            return Err(anyhow::anyhow!("You can only access your own nutrition statistics"));
        }

        // Get today's date
        let today = Utc::now();
        let today_str = today.format("%Y-%m-%d").to_string();
        
        // Get this week's date range
        let week_start = today - chrono::Duration::days(today.weekday().num_days_from_monday() as i64);
        let week_end = week_start + chrono::Duration::days(6);
        
        // Get this month's date range  
        let month_start = today.with_day(1).unwrap();
        
        // Get today's meals
        let today_meals = self.meal_repository.get_meals_by_date(user_id, &today).await.unwrap_or_default();
        
        // Calculate today's totals
        let mut today_calories: f32 = 0.0;
        let mut today_protein: f32 = 0.0;
        let mut today_carbs: f32 = 0.0;
        let mut today_fat: f32 = 0.0;
        let mut today_fiber: f32 = 0.0;
        let mut today_sodium: f32 = 0.0;
        let mut meals_today = 0;
        
        for meal in &today_meals {
            today_calories += meal.total_calories;
            today_protein += meal.total_protein;
            today_carbs += meal.total_carbs;
            today_fat += meal.total_fat;
            today_fiber += meal.dietary_fiber;
            today_sodium += meal.sodium;
            meals_today += 1;
        }
        
        // Get weekly stats by querying each day
        let mut weekly_calories: f32 = 0.0;
        let mut weekly_days = 0;
        let mut weekly_meals = 0;
        
        for i in 0..7 {
            let day = week_start + chrono::Duration::days(i);
            if let Ok(day_meals) = self.meal_repository.get_meals_by_date(user_id, &day).await {
                if !day_meals.is_empty() {
                    weekly_days += 1;
                    weekly_meals += day_meals.len();
                    for meal in day_meals {
                        weekly_calories += meal.total_calories;
                    }
                }
            }
        }
        
        // Get monthly stats
        let mut monthly_calories: f32 = 0.0;
        let mut monthly_days = 0;
        let mut monthly_meals = 0;
        
        // Query up to 31 days for the month
        for i in 0..31 {
            let day = month_start + chrono::Duration::days(i);
            if day.month() != today.month() {
                break;
            }
            if let Ok(day_meals) = self.meal_repository.get_meals_by_date(user_id, &day).await {
                if !day_meals.is_empty() {
                    monthly_days += 1;
                    monthly_meals += day_meals.len();
                    for meal in day_meals {
                        monthly_calories += meal.total_calories;
                    }
                }
            }
        }
        
        // Calculate averages
        let weekly_avg_calories = if weekly_days > 0 { weekly_calories as f64 / weekly_days as f64 } else { 0.0 };
        let monthly_avg_calories = if monthly_days > 0 { monthly_calories as f64 / monthly_days as f64 } else { 0.0 };
        
        // Calculate macro percentages for today
        let total_macros = today_protein * 4.0 + today_carbs * 4.0 + today_fat * 9.0;
        let protein_percentage = if total_macros > 0.0 { (today_protein * 4.0 / total_macros * 100.0).round() as f64 } else { 0.0 };
        let carbs_percentage = if total_macros > 0.0 { (today_carbs * 4.0 / total_macros * 100.0).round() as f64 } else { 0.0 };
        let fat_percentage = if total_macros > 0.0 { (today_fat * 9.0 / total_macros * 100.0).round() as f64 } else { 0.0 };
        
        // Calculate streak (consecutive days with logged meals)
        let mut streak = 0;
        let mut current_date = today;
        
        loop {
            if let Ok(day_meals) = self.meal_repository.get_meals_by_date(user_id, &current_date).await {
                if day_meals.is_empty() {
                    break;
                }
                streak += 1;
                current_date = current_date - chrono::Duration::days(1);
                
                // Limit streak calculation to avoid long queries
                if streak >= 365 {
                    break;
                }
            } else {
                break;
            }
        }
        
        // Get water intake for today
        let today_water = self.water_repository.get_water_by_date(user_id, &today_str).await.unwrap_or(None);
        let water_glasses = today_water.unwrap_or(0);
        
        // Find last meal time
        let last_meal_time = today_meals.iter()
            .filter_map(|meal| meal.meal_time.as_ref())
            .max()
            .map(|time| time.to_rfc3339())
            .or_else(|| {
                today_meals.iter()
                    .map(|meal| &meal.created_at)
                    .max()
                    .map(|time| time.to_rfc3339())
            });
        
        // Calculate nutrition score (simple scoring based on balanced macros and meeting goals)
        let mut nutrition_score = 0;
        
        // Score based on calorie intake (assume 2000 cal goal)
        let calorie_goal = 2000.0;
        if today_calories >= calorie_goal * 0.8 && today_calories <= calorie_goal * 1.2 {
            nutrition_score += 30;
        } else if today_calories >= calorie_goal * 0.6 {
            nutrition_score += 15;
        }
        
        // Score based on protein (assume 25% of calories)
        if protein_percentage >= 20.0 && protein_percentage <= 35.0 {
            nutrition_score += 25;
        } else if protein_percentage >= 15.0 {
            nutrition_score += 15;
        }
        
        // Score based on balanced macros
        if carbs_percentage >= 35.0 && carbs_percentage <= 55.0 {
            nutrition_score += 25;
        } else if carbs_percentage >= 25.0 {
            nutrition_score += 15;
        }
        
        // Score based on healthy fat intake
        if fat_percentage >= 20.0 && fat_percentage <= 35.0 {
            nutrition_score += 20;
        } else if fat_percentage >= 15.0 {
            nutrition_score += 10;
        }
        
        Ok(json!({
            "today_calories": today_calories.round(),
            "total_calories": monthly_calories.round(),
            "today_protein": today_protein.round(),
            "today_carbs": today_carbs.round(),
            "today_fat": today_fat.round(),
            "today_fiber": today_fiber.round(),
            "today_sodium": today_sodium.round(),
            "weekly_average": weekly_avg_calories.round(),
            "monthly_average": monthly_avg_calories.round(),
            "weekly_goal": 2000,
            "streak": streak,
            "last_meal_time": last_meal_time,
            "meals_today": meals_today,
            "meals_this_week": weekly_meals,
            "meals_this_month": monthly_meals,
            "active_days_this_week": weekly_days,
            "active_days_this_month": monthly_days,
            "water_intake": water_glasses,
            "water_goal": 8,
            "macro_balance": {
                "protein": protein_percentage,
                "carbs": carbs_percentage,
                "fat": fat_percentage
            },
            "nutrition_score": nutrition_score,
            "weekly_calories": weekly_calories.round(),
            "monthly_calories": monthly_calories.round(),
            "date": today_str
        }))
    }
}
