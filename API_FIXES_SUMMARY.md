# API Fixes Summary

## Issues Fixed

### 1. Progress Photo Upload Route Error ✅

**Error:** `{"error":"Not Found","message":"Route not found: POST /api/analytics/progress-photos/40ccb9bc-e091-7079-4c1d-3a2c47e01000/upload"}`

**Root Cause:** The analytics-service only had the route `/api/analytics/progress-photos/upload` but the frontend was calling `/api/analytics/progress-photos/:userId/upload`

**Fix:** Added an additional route in `services/analytics-service/src/main.rs`:

```rust
router.post(
    "/api/analytics/progress-photos/:userId/upload",
    handler!(upload_progress_photo),
);
```

Now both routes work:

- `POST /api/analytics/progress-photos/upload` (for authenticated user)
- `POST /api/analytics/progress-photos/:userId/upload` (with userId in path)

---

### 2. User Preferences Validation Error ✅

**Error:** `{"error":"Validation Error","message":"Invalid preferences data"}`

**Root Cause:** The `UserPreferences` model had required fields that weren't being sent by the frontend, causing deserialization failures.

**Fix:** Added `#[serde(default)]` attributes and default implementations in `services/user-profile-service/src/models/models.rs`:

#### DailyGoals

```rust
#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DailyGoals {
    #[serde(default)]
    pub calories: i32,
    #[serde(default)]
    pub water: i32,
    #[serde(default)]
    pub protein: i32,
    #[serde(default)]
    pub carbs: i32,
    #[serde(default)]
    pub fat: i32,
}
```

#### NotificationSettings

```rust
#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NotificationSettings {
    #[serde(default)]
    pub email: bool,
    #[serde(default)]
    pub push: bool,
    #[serde(default)]
    pub workout_reminders: bool,
    #[serde(default)]
    pub nutrition_reminders: bool,
    #[serde(default)]
    pub water_reminders: bool,
    #[serde(default)]
    pub progress_photos: bool,
    #[serde(default)]
    pub achievements: bool,
    #[serde(default)]
    pub ai_suggestions: bool,
    pub workout_reminder_time: Option<String>,
    pub nutrition_reminder_times: Option<Vec<String>>,
}

impl Default for NotificationSettings {
    fn default() -> Self {
        Self {
            email: true,
            push: true,
            workout_reminders: true,
            nutrition_reminders: true,
            water_reminders: true,
            progress_photos: true,
            achievements: true,
            ai_suggestions: true,
            workout_reminder_time: None,
            nutrition_reminder_times: None,
        }
    }
}
```

#### PrivacySettings

```rust
#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PrivacySettings {
    #[serde(default = "default_profile_visibility")]
    pub profile_visibility: String,
    #[serde(default)]
    pub workout_sharing: bool,
    #[serde(default)]
    pub progress_sharing: bool,
}

impl Default for PrivacySettings {
    fn default() -> Self {
        Self {
            profile_visibility: "private".to_string(),
            workout_sharing: false,
            progress_sharing: false,
        }
    }
}
```

#### UserPreferences

```rust
#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UserPreferences {
    #[serde(default = "default_units")]
    pub units: String,
    #[serde(default = "default_timezone")]
    pub timezone: String,
    #[serde(default)]
    pub notifications: NotificationSettings,
    #[serde(default)]
    pub privacy: PrivacySettings,
    pub daily_goals: Option<DailyGoals>,
    pub ai_trainer: Option<AITrainerPreferences>,
}

fn default_units() -> String {
    "metric".to_string()
}

fn default_timezone() -> String {
    "UTC".to_string()
}
```

**Benefits:**

- Partial updates now work correctly
- Missing fields use sensible defaults
- Better backwards compatibility
- More flexible API for frontend

---

### 3. Daily Calories Showing 0 ✅

**Issue:** Analytics page showing "Daily Calories: 0kcal"

**Root Cause:** The `WorkoutAnalytics` model didn't include `calories_burned_this_week` field that the frontend expected.

**Fix:**

1. Added fields to `WorkoutAnalytics` model in `services/analytics-service/src/models.rs`:

```rust
pub struct WorkoutAnalytics {
    // ... existing fields ...
    pub calories_burned_this_week: u32, // estimated calories burned
    pub workouts_this_week: u32,
    // ... other fields ...
}
```

2. Updated analytics calculation in `services/analytics-service/src/service/analytics_service.rs`:

```rust
// Calculate calories burned (estimation based on duration and activity)
// Average METs for strength training: 3.5-6.0, we'll use 5.0 as average
// Calories burned per minute = (METs × weight_kg × 3.5) / 200
// For simplicity, we'll use an average estimate: ~5-7 calories per minute of workout
let calories_per_minute = 6.0; // Average estimate
let calories_burned_this_week = (total_duration_minutes as f32 * calories_per_minute) as u32;

// Calculate workouts this week (for week period)
let workouts_this_week = if period == "week" {
    total_workouts
} else {
    // Estimate based on weekly frequency
    (total_workouts as f32 / match period {
        "month" => 4.0,
        "quarter" => 13.0,
        "year" => 52.0,
        _ => 1.0,
    }) as u32
};
```

**Calorie Calculation Method:**

- Uses average METs (Metabolic Equivalent of Task) for strength training: 5.0
- Estimates ~6 calories burned per minute of workout
- Formula: `total_duration_minutes × 6.0 = calories_burned`
- This is a conservative estimate suitable for strength training workouts

**Example:**

- 45-minute workout = ~270 calories burned
- 60-minute workout = ~360 calories burned

---

## Compilation Status

✅ **analytics-service** - Compiles successfully with 18 warnings (unused functions)
✅ **user-profile-service** - Compiles successfully with 42 warnings (unused functions)

All warnings are for unused utility functions, not errors.

---

## Testing Recommendations

### 1. Progress Photo Upload

Test both routes:

```bash
# With userId in path
POST /api/analytics/progress-photos/40ccb9bc-e091-7079-4c1d-3a2c47e01000/upload

# Without userId (uses authenticated user)
POST /api/analytics/progress-photos/upload
```

### 2. User Preferences

Test partial updates:

```bash
PUT /api/user-profiles/profile/preferences/40ccb9bc-e091-7079-4c1d-3a2c47e01000
Content-Type: application/json

{
  "units": "imperial",
  "timezone": "America/New_York"
  // Other fields will use defaults
}
```

### 3. Analytics with Calories

Verify the analytics endpoint returns calories:

```bash
GET /api/analytics/workout?period=week
```

Expected response should include:

```json
{
  "calories_burned_this_week": 1200,
  "workouts_this_week": 5,
  "total_workouts": 5,
  "total_duration_minutes": 200
  // ... other fields
}
```

---

## Deployment Steps

1. **Build Services:**

```bash
cd /Users/babar/projects/gymcoach-ai
./scripts/build-lambdas.sh
```

2. **Deploy Infrastructure:**

```bash
cd infrastructure
pnpm run cdk:deploy
```

3. **Verify Endpoints:**

- Test progress photo upload with both route patterns
- Test user preferences update with partial data
- Verify analytics page shows calories correctly

---

## Impact Summary

### Services Modified:

- ✅ `analytics-service` - Added route, updated model, added calorie calculation
- ✅ `user-profile-service` - Made models more flexible with defaults

### API Changes:

- ✅ **New Route:** `POST /api/analytics/progress-photos/:userId/upload`
- ✅ **Enhanced:** User preferences now support partial updates
- ✅ **New Fields:** `calories_burned_this_week` and `workouts_this_week` in WorkoutAnalytics

### Frontend Benefits:

- ✅ Progress photo uploads will work with userId in path
- ✅ User preferences updates won't fail on missing fields
- ✅ Analytics page will display calories burned correctly

---

## Notes

1. **Calorie Calculation:** The current implementation uses a simplified estimation. For more accurate results, consider:
   - Fetching user's weight from profile
   - Using exercise-specific MET values
   - Accounting for workout intensity
   - Integrating with nutrition service for actual calorie intake vs burned

2. **Backward Compatibility:** All changes are backward compatible. Existing clients will continue to work.

3. **Default Values:** All default values are sensible and follow common fitness app patterns.

---

## Next Steps

1. Deploy the updated services to production
2. Monitor API logs for any errors
3. Verify analytics page displays correctly
4. Consider enhancing calorie calculation with user weight and exercise-specific METs
5. Add integration tests for new routes and validation logic
