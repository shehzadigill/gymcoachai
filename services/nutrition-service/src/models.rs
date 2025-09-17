use serde::{Deserialize, Serialize};
use validator::Validate;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct Meal {
    #[validate(length(min = 1, max = 255))]
    pub id: String,
    
    #[validate(length(min = 1, max = 255))]
    pub user_id: String,
    
    #[validate(length(min = 1, max = 100))]
    pub name: String,
    
    pub description: Option<String>,
    pub meal_type: MealType,
    pub meal_date: DateTime<Utc>,
    pub meal_time: Option<DateTime<Utc>>,
    
    pub total_calories: f32,
    pub total_protein: f32,
    pub total_carbs: f32,
    pub total_fat: f32,
    pub total_fiber: f32,
    pub total_sugar: f32,
    pub total_sodium: f32,
    
    pub foods: Vec<FoodItem>,
    pub notes: Option<String>,
    
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MealType {
    Breakfast,
    Lunch,
    Dinner,
    Snack,
    PreWorkout,
    PostWorkout,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct FoodItem {
    #[validate(length(min = 1, max = 255))]
    pub id: String,
    
    #[validate(length(min = 1, max = 255))]
    pub food_id: String,
    
    #[validate(length(min = 1, max = 100))]
    pub name: String,
    
    pub brand: Option<String>,
    pub quantity: f32,
    pub unit: String,
    pub serving_size: f32,
    pub serving_unit: String,
    
    pub calories: f32,
    pub protein: f32,
    pub carbs: f32,
    pub fat: f32,
    pub fiber: f32,
    pub sugar: f32,
    pub sodium: f32,
    
    pub barcode: Option<String>,
    pub nutrition_facts: Option<NutritionFacts>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NutritionFacts {
    pub calories: f32,
    pub protein: f32,
    pub total_carbs: f32,
    pub dietary_fiber: f32,
    pub total_sugars: f32,
    pub added_sugars: f32,
    pub total_fat: f32,
    pub saturated_fat: f32,
    pub trans_fat: f32,
    pub cholesterol: f32,
    pub sodium: f32,
    pub potassium: f32,
    pub calcium: f32,
    pub iron: f32,
    pub vitamin_a: f32,
    pub vitamin_c: f32,
    pub vitamin_d: f32,
    pub vitamin_e: f32,
    pub vitamin_k: f32,
    pub thiamin: f32,
    pub riboflavin: f32,
    pub niacin: f32,
    pub vitamin_b6: f32,
    pub folate: f32,
    pub vitamin_b12: f32,
    pub biotin: f32,
    pub pantothenic_acid: f32,
    pub phosphorus: f32,
    pub iodine: f32,
    pub magnesium: f32,
    pub zinc: f32,
    pub selenium: f32,
    pub copper: f32,
    pub manganese: f32,
    pub chromium: f32,
    pub molybdenum: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct Food {
    #[validate(length(min = 1, max = 255))]
    pub id: String,
    
    #[validate(length(min = 1, max = 100))]
    pub name: String,
    
    pub brand: Option<String>,
    pub category: FoodCategory,
    pub subcategory: Option<String>,
    pub description: Option<String>,
    
    pub barcode: Option<String>,
    pub upc: Option<String>,
    pub nutrition_facts: NutritionFacts,
    
    pub serving_size: f32,
    pub serving_unit: String,
    pub common_servings: Vec<CommonServing>,
    
    pub allergens: Vec<Allergen>,
    pub dietary_tags: Vec<DietaryTag>,
    
    pub verified: bool,
    pub verified_by: Option<String>,
    pub verified_at: Option<DateTime<Utc>>,
    
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FoodCategory {
    Fruits,
    Vegetables,
    Grains,
    Proteins,
    Dairy,
    Fats,
    Beverages,
    Snacks,
    Condiments,
    Supplements,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommonServing {
    pub name: String,
    pub quantity: f32,
    pub unit: String,
    pub calories: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Allergen {
    Milk,
    Eggs,
    Fish,
    Shellfish,
    TreeNuts,
    Peanuts,
    Wheat,
    Soybeans,
    Sesame,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DietaryTag {
    Vegetarian,
    Vegan,
    GlutenFree,
    DairyFree,
    NutFree,
    Keto,
    Paleo,
    LowCarb,
    HighProtein,
    Organic,
    NonGMO,
    SugarFree,
    LowSodium,
    HighFiber,
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct NutritionPlan {
    #[validate(length(min = 1, max = 255))]
    pub id: String,
    
    #[validate(length(min = 1, max = 255))]
    pub user_id: String,
    
    #[validate(length(min = 1, max = 100))]
    pub name: String,
    
    pub description: Option<String>,
    pub plan_type: NutritionPlanType,
    pub goal: NutritionGoal,
    
    pub daily_calories: u16,
    pub daily_protein: f32,
    pub daily_carbs: f32,
    pub daily_fat: f32,
    pub daily_fiber: f32,
    pub daily_sugar: f32,
    pub daily_sodium: f32,
    
    pub meal_plans: Vec<MealPlan>,
    pub restrictions: Vec<DietaryRestriction>,
    pub preferences: Vec<DietaryPreference>,
    
    pub start_date: DateTime<Utc>,
    pub end_date: Option<DateTime<Utc>>,
    pub is_active: bool,
    
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum NutritionPlanType {
    WeightLoss,
    WeightGain,
    MuscleGain,
    Maintenance,
    AthleticPerformance,
    Medical,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum NutritionGoal {
    LoseWeight,
    GainWeight,
    BuildMuscle,
    MaintainWeight,
    ImproveHealth,
    AthleticPerformance,
    MedicalCondition,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MealPlan {
    pub meal_type: MealType,
    pub target_calories: u16,
    pub target_protein: f32,
    pub target_carbs: f32,
    pub target_fat: f32,
    pub suggested_foods: Vec<String>,
    pub meal_timing: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DietaryRestriction {
    Vegetarian,
    Vegan,
    Pescatarian,
    GlutenFree,
    DairyFree,
    NutFree,
    Keto,
    Paleo,
    Mediterranean,
    LowCarb,
    HighProtein,
    LowSodium,
    LowSugar,
    HighFiber,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DietaryPreference {
    Organic,
    NonGMO,
    Local,
    Seasonal,
    WholeFoods,
    ProcessedFoods,
    Spicy,
    Mild,
    Sweet,
    Savory,
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct NutritionLog {
    #[validate(length(min = 1, max = 255))]
    pub id: String,
    
    #[validate(length(min = 1, max = 255))]
    pub user_id: String,
    
    pub log_date: DateTime<Utc>,
    pub meals: Vec<Meal>,
    pub water_intake: f32, // liters
    
    pub total_calories: f32,
    pub total_protein: f32,
    pub total_carbs: f32,
    pub total_fat: f32,
    pub total_fiber: f32,
    pub total_sugar: f32,
    pub total_sodium: f32,
    
    pub goal_calories: f32,
    pub goal_protein: f32,
    pub goal_carbs: f32,
    pub goal_fat: f32,
    pub goal_fiber: f32,
    pub goal_sugar: f32,
    pub goal_sodium: f32,
    
    pub calories_remaining: f32,
    pub protein_remaining: f32,
    pub carbs_remaining: f32,
    pub fat_remaining: f32,
    pub fiber_remaining: f32,
    pub sugar_remaining: f32,
    pub sodium_remaining: f32,
    
    pub notes: Option<String>,
    pub mood: Option<Mood>,
    pub energy_level: Option<u8>, // 1-10 scale
    pub hunger_level: Option<u8>, // 1-10 scale
    
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Mood {
    VeryHappy,
    Happy,
    Neutral,
    Sad,
    VerySad,
    Stressed,
    Anxious,
    Excited,
    Tired,
    Energetic,
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct CreateMealRequest {
    #[validate(length(min = 1, max = 100))]
    pub name: String,
    
    pub description: Option<String>,
    pub meal_type: MealType,
    pub meal_date: DateTime<Utc>,
    pub meal_time: Option<DateTime<Utc>>,
    
    pub foods: Vec<CreateFoodItemRequest>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct CreateFoodItemRequest {
    #[validate(length(min = 1, max = 255))]
    pub food_id: String,
    
    pub quantity: f32,
    pub unit: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct UpdateMealRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub meal_type: Option<MealType>,
    pub meal_time: Option<DateTime<Utc>>,
    pub foods: Option<Vec<CreateFoodItemRequest>>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct CreateFoodRequest {
    #[validate(length(min = 1, max = 100))]
    pub name: String,
    
    pub brand: Option<String>,
    pub category: FoodCategory,
    pub subcategory: Option<String>,
    pub description: Option<String>,
    
    pub barcode: Option<String>,
    pub upc: Option<String>,
    pub nutrition_facts: NutritionFacts,
    
    pub serving_size: f32,
    pub serving_unit: String,
    pub common_servings: Option<Vec<CommonServing>>,
    
    pub allergens: Option<Vec<Allergen>>,
    pub dietary_tags: Option<Vec<DietaryTag>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct UpdateFoodRequest {
    pub name: Option<String>,
    pub brand: Option<String>,
    pub category: Option<FoodCategory>,
    pub subcategory: Option<String>,
    pub description: Option<String>,
    
    pub barcode: Option<String>,
    pub upc: Option<String>,
    pub nutrition_facts: Option<NutritionFacts>,
    
    pub serving_size: Option<f32>,
    pub serving_unit: Option<String>,
    pub common_servings: Option<Vec<CommonServing>>,
    
    pub allergens: Option<Vec<Allergen>>,
    pub dietary_tags: Option<Vec<DietaryTag>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct CreateNutritionPlanRequest {
    #[validate(length(min = 1, max = 100))]
    pub name: String,
    
    pub description: Option<String>,
    pub plan_type: NutritionPlanType,
    pub goal: NutritionGoal,
    
    pub daily_calories: u16,
    pub daily_protein: f32,
    pub daily_carbs: f32,
    pub daily_fat: f32,
    pub daily_fiber: f32,
    pub daily_sugar: f32,
    pub daily_sodium: f32,
    
    pub meal_plans: Vec<MealPlan>,
    pub restrictions: Option<Vec<DietaryRestriction>>,
    pub preferences: Option<Vec<DietaryPreference>>,
    
    pub start_date: DateTime<Utc>,
    pub end_date: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct UpdateNutritionPlanRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub plan_type: Option<NutritionPlanType>,
    pub goal: Option<NutritionGoal>,
    
    pub daily_calories: Option<u16>,
    pub daily_protein: Option<f32>,
    pub daily_carbs: Option<f32>,
    pub daily_fat: Option<f32>,
    pub daily_fiber: Option<f32>,
    pub daily_sugar: Option<f32>,
    pub daily_sodium: Option<f32>,
    
    pub meal_plans: Option<Vec<MealPlan>>,
    pub restrictions: Option<Vec<DietaryRestriction>>,
    pub preferences: Option<Vec<DietaryPreference>>,
    
    pub end_date: Option<DateTime<Utc>>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NutritionStats {
    pub total_meals: u32,
    pub total_foods: u32,
    pub average_daily_calories: f32,
    pub average_daily_protein: f32,
    pub average_daily_carbs: f32,
    pub average_daily_fat: f32,
    pub average_daily_fiber: f32,
    pub average_daily_sugar: f32,
    pub average_daily_sodium: f32,
    pub average_water_intake: f32,
    pub most_consumed_foods: Vec<FoodConsumptionStats>,
    pub nutrition_goals_met: f32, // percentage
    pub streak_days: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FoodConsumptionStats {
    pub food_id: String,
    pub food_name: String,
    pub consumption_count: u32,
    pub total_quantity: f32,
    pub total_calories: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NutritionLogListResponse {
    pub logs: Vec<NutritionLog>,
    pub pagination: PaginationInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginationInfo {
    pub page: u32,
    pub limit: u32,
    pub total: u32,
    pub total_pages: u32,
    pub has_next: bool,
    pub has_prev: bool,
}
