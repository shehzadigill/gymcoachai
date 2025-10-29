# AI Context Debugging - Investigation & Fix

## Issue Report
User reported that AI responses are still asking about goals/preferences despite having set them in their profile. Example response:
> "Of course! I'd be happy to analyze your performance and suggest some actionable improvements. To give you the best possible advice, I need a little more detail about your recent workouts..."

This suggests the AI is not receiving or not using the user's profile data.

## Investigation Steps

### 1. Backend Context Flow Analysis

#### ✅ User Data Service (`user_data_service.py`)
**Status**: Working correctly
- `build_user_context()` function properly fetches:
  - User profile (name, age, goals, experience, height, weight)
  - User preferences (language, units, dietary)
  - AI preferences (coaching style, focus areas, equipment)
  - Recent workouts
  - Body measurements
  - Nutrition data
- Returns dictionary with correct keys: `'user_profile'`, `'user_preferences'`, `'ai_preferences'`, etc.

#### ✅ Lambda Handler (`lambda_function.py`)
**Status**: Working correctly
- `handle_chat()` function calls `user_data_service.build_user_context(user_id)`
- Passes the context to `bedrock_service.invoke_bedrock(prompt, user_context)`
- Context is fetched EVERY time, regardless of frontend input

#### ⚠️ Bedrock Service (`bedrock_service.py`)
**Status**: NEEDS VERIFICATION
- `_format_context()` method was enhanced with comprehensive formatting (10+ sections)
- `_build_prompt()` should call `_format_context()` with the user_context
- **HYPOTHESIS**: Context might not be properly included in the final prompt sent to AI model

### 2. Added Debug Logging

To diagnose the issue, added extensive logging to `bedrock_service.py`:

#### In `_build_prompt()` method:
```python
logger.info(f"Building prompt with context keys: {context.keys()}")
logger.info(f"Context user_profile: {context.get('user_profile', 'NOT FOUND')}")
logger.info(f"Context ai_preferences: {context.get('ai_preferences', 'NOT FOUND')}")
logger.info(f"Formatted context length: {len(context_str)} characters")
```

#### In `_format_context()` method:
```python
logger.info(f"_format_context called with keys: {context.keys()}")
logger.info(f"Formatting user_profile: {profile}")
```

### 3. Expected vs. Actual Behavior

#### Expected Prompt Structure:
```
<SYSTEM PROMPT>

User Context:
=== USER PROFILE ===
Name: John Doe
Age: 30 years
Gender: male
Experience Level: intermediate
Physical Stats: 175cm, 75kg (BMI: 24.5)
Primary Fitness Goals: muscle_building, strength
  → This user wants to focus on: muscle_building

=== USER PREFERENCES ===
Preferred Language: en
Unit System: metric

=== AI TRAINER PREFERENCES ===
Preferred Coaching Style: motivational
  → Use highly encouraging, energetic language with lots of positive reinforcement
Available Equipment: dumbbells, barbell, bench

=== DAILY GOALS ===
Calorie Target: 2500 kcal
Protein Target: 150g
... (more sections)

User Question/Request:
<USER MESSAGE>
```

#### Actual Behavior (based on AI response):
AI appears to not have access to user profile/goals, suggesting context might be empty or not included.

## Root Cause Hypotheses

### Hypothesis 1: Context Not Being Passed to Bedrock ❌
**Likelihood**: Low
- Code review shows `user_context` is explicitly passed to `invoke_bedrock()`
- Lambda handler correctly calls `build_user_context()`

### Hypothesis 2: Context Formatting Returns Empty String ⚠️
**Likelihood**: Medium
- If all context fields are missing/None, `_format_context()` might return empty string
- Need to verify with logs what profile data looks like

### Hypothesis 3: Profile Data Not in Database ⚠️
**Likelihood**: Medium
- User might not have profile data saved in DynamoDB
- Need to verify user actually has profile/preferences set

### Hypothesis 4: AI Model Ignoring Context 📊
**Likelihood**: Low-Medium
- Claude models should respect context in prompts
- Could test by adding explicit instruction in system prompt

## Debugging Steps

### Step 1: Deploy Backend with Logging ✅
```bash
cd /Users/babar/projects/gymcoach-ai
./scripts/deploy-ai-service.sh
```

### Step 2: Test AI Chat and Check CloudWatch Logs
1. Send a chat message via AI Trainer page
2. Check CloudWatch logs for:
   - "Building prompt with context keys: ..."
   - "_format_context called with keys: ..."
   - "Formatting user_profile: ..."
   - "Formatted context length: X characters"

### Step 3: Verify User Profile Exists in Database
```bash
# Test DynamoDB query for user profile
aws dynamodb get-item \
  --table-name gymcoach-users \
  --key '{"PK": {"S": "USER#<your-user-id>"}, "SK": {"S": "PROFILE"}}'
```

### Step 4: Check Frontend Data Fetching
1. Open browser dev tools
2. Go to AI Trainer page
3. Check console logs for:
   - "User profile loaded: ..."
   - "User preferences loaded: ..."
4. Verify profile/preferences data is not null

## Possible Fixes

### Fix 1: Add Explicit Context Enforcement in System Prompt
If AI is ignoring context, update system prompt:

```python
system_prompt = """You are an AI fitness coach and trainer...

CRITICAL: You have access to detailed user context below including their profile, goals, preferences, and workout history. ALWAYS use this context to personalize your responses. DO NOT ask for information that is already provided in the context."""
```

### Fix 2: Add Context Summary at End of Prompt
Add a reminder right before the user question:

```python
return f"""{system_prompt}

User Context:
{context_str}

REMINDER: Use the above context to personalize your response. The user has already provided their profile, goals, and preferences.

User Question/Request:
{prompt}"""
```

### Fix 3: Ensure Profile Data Exists
If user profile is empty in database, need to:
1. Verify frontend is saving profile data correctly
2. Check API endpoint `/api/user/profile` is working
3. Test profile update flow

### Fix 4: Add Fallback for Missing Data
In `_format_context()`, add warning if critical data is missing:

```python
if not profile or not profile.get('fitnessGoals'):
    context_parts.append("⚠️ WARNING: User profile incomplete. Please ask user to complete their profile for better personalization.")
```

## Testing Checklist

- [ ] Deploy backend with debug logging
- [ ] Send test chat message
- [ ] Check CloudWatch logs for context data
- [ ] Verify context includes user profile
- [ ] Verify context includes fitness goals
- [ ] Verify formatted context is ~500+ characters (not empty)
- [ ] Check if AI response changes after fix
- [ ] Test with different users to ensure consistency

## Next Steps

1. **Deploy backend** with logging enabled
2. **Test AI chat** and capture logs
3. **Analyze logs** to identify where context breaks
4. **Apply appropriate fix** based on findings
5. **Re-test** to verify AI uses context correctly

## Files Modified

### Backend:
- `services/ai-service-python/bedrock_service.py`
  - Added debug logging in `_build_prompt()` (lines 133-161)
  - Added debug logging in `_format_context()` (lines 176-178)
  - Enhanced conditional logic for context formatting

## Expected Outcome

After deploying with logging, we should be able to identify:
1. Whether context is being passed (check logs for "Building prompt with context keys")
2. What data is in the profile (check logs for "Formatting user_profile: ...")
3. How long the formatted context is (should be 500+ characters with full data)
4. Whether the issue is frontend (profile not set), backend (context not formatted), or AI (ignoring context)

---

**Status**: 🔍 Investigation in progress - awaiting deployment and log analysis  
**Next Action**: Deploy backend and test with real user data
