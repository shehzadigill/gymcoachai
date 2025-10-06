# User Profile Service - Daily Goals Update

## Overview

This document outlines the comprehensive updates made to the user-profile-service to support daily nutrition goals functionality. The changes enable users to set and persist daily targets for calories, water, protein, carbohydrates, and fat intake.

## Changes Made

### 1. Models (src/models.rs)

#### Added DailyGoals Struct

```rust
#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DailyGoals {
    pub calories: i32,
    pub water: i32,
    pub protein: i32,
    pub carbs: i32,
    pub fat: i32,
}
```

#### Updated UserPreferences Struct

- Added optional `daily_goals` field to `UserPreferences`
- Field is optional to maintain backward compatibility

```rust
pub struct UserPreferences {
    pub units: String,
    pub timezone: String,
    pub notifications: NotificationSettings,
    pub privacy: PrivacySettings,
    pub daily_goals: Option<DailyGoals>, // New field
}
```

### 2. Database Operations (src/database.rs)

#### Updated Profile Retrieval

- Modified `get_user_profile_from_db()` to load daily goals from DynamoDB
- Added parsing of `dailyGoals` map from database
- Provides default values if goals are not set

#### Updated Profile Storage

- Modified `update_user_profile_in_db()` to save daily goals as a DynamoDB Map
- Goals are stored in nested structure: `dailyGoals.calories`, `dailyGoals.water`, etc.

#### Added Partial Update Function

- Created `partial_update_user_profile_in_db()` for flexible profile updates
- Allows updating only specific fields without requiring full profile
- Supports incremental updates for daily goals and fitness goals

#### Updated Preferences Functions

- Fixed `get_user_preferences_from_db()` to include daily goals
- Updated default preferences to include `daily_goals: None`

### 3. Request Handlers (src/handlers.rs)

#### Added Partial Update Handler

- Created `handle_partial_update_user_profile()` for flexible profile updates
- Includes proper authentication and authorization checks
- Supports updating preferences.dailyGoals and fitness goals arrays
- Provides comprehensive error handling and validation

#### Enhanced Security

- Added authorization checks for profile modifications
- Users can only update their own profiles
- Proper error responses for unauthorized access

### 4. API Routing (src/main.rs)

#### Updated Main PUT Route

- Modified the main profile PUT route to use partial update handler
- Changed from `handle_update_user_profile` to `handle_partial_update_user_profile`
- Maintains backward compatibility while adding flexibility

### 5. API Documentation (docs/api/user-profile-service.yaml)

#### Updated UserPreferences Schema

- Added `dailyGoals` reference to UserPreferences schema
- Maintains OpenAPI specification compliance

#### Added DailyGoals Schema

- Complete schema definition with validation rules
- Includes reasonable min/max values for each nutrition metric
- Proper documentation and examples

```yaml
DailyGoals:
  type: object
  description: Daily nutrition and health goals
  properties:
    calories:
      type: integer
      minimum: 1000
      maximum: 5000
      example: 2000
    # ... other fields
```

## Database Schema Changes

### DynamoDB Structure

Daily goals are stored as a nested Map in the user profile record:

```json
{
  "PK": "USER#user123",
  "SK": "PROFILE",
  "dailyGoals": {
    "calories": 2000,
    "water": 8,
    "protein": 150,
    "carbs": 200,
    "fat": 65
  }
}
```

## API Usage Examples

### Setting Daily Goals

```http
PUT /api/user-profiles/profile
Content-Type: application/json
Authorization: Bearer <token>

{
  "preferences": {
    "dailyGoals": {
      "calories": 2200,
      "water": 10,
      "protein": 160,
      "carbs": 220,
      "fat": 70
    }
  }
}
```

### Updating Fitness Goals

```http
PUT /api/user-profiles/profile
Content-Type: application/json
Authorization: Bearer <token>

{
  "goals": [
    "Lose 10 pounds",
    "Run a 5K",
    "Build muscle mass"
  ]
}
```

## Backward Compatibility

All changes maintain backward compatibility:

- Daily goals are optional fields
- Existing profiles without daily goals continue to work
- Default values are provided when goals are not set
- No breaking changes to existing API contracts

## Error Handling

Comprehensive error handling includes:

- Validation of goal values within reasonable ranges
- Proper HTTP status codes for different error conditions
- Detailed error messages for debugging
- Graceful fallbacks for missing data

## Testing Considerations

The service should be tested for:

- Creating profiles with daily goals
- Updating existing profiles to include daily goals
- Partial updates of daily goals only
- Backward compatibility with existing profiles
- Error conditions and validation
- Authorization and security

## Deployment Notes

1. The service compiles successfully with all changes
2. No database migrations required (DynamoDB is schema-less)
3. API changes are additive and non-breaking
4. All existing functionality remains intact

## Integration with Frontend

The mobile app ProfileScreen now properly:

- Loads daily goals from user preferences
- Saves daily goals via the updated API
- Handles loading states and error conditions
- Provides immediate feedback on save operations

This comprehensive update enables full daily goals functionality while maintaining system reliability and backward compatibility.
