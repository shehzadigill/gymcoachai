<!-- 4cf4c2b8-3c34-4120-a165-e7eebcc9266e d6e06768-b129-4f71-a935-634799331058 -->
# AI Gym Coach Service Implementation Plan

## Overview

Build an AI-powered gym coach/trainer using Amazon Bedrock (Claude Instant or Haiku for cost efficiency), providing personalized workout generation, meal plans, coaching advice, and progress analysis. The service will integrate with existing user profiles, workout history, nutrition data, and analytics.

## Architecture Components

### 1. AI Service Infrastructure (AWS CDK)

**File**: `/Users/babar/projects/gymcoach-ai/infrastructure/src/gymcoach-ai-stack.ts`

- Add Amazon Bedrock permissions to IAM roles
- Create AI Service Lambda (Python 3.11) with:
                - Timeout: 5 minutes (AI inference can be slow)
                - Memory: 1024 MB (sufficient for Bedrock SDK)
                - Reserved concurrency: 5 (cost control)
                - Environment variables: Bedrock model ID, rate limit config
- Create DynamoDB table for:
                - AI conversation history (PK: `USER#{userId}`, SK: `CONVERSATION#{timestamp}`)
                - Rate limiting tracking (PK: `RATE_LIMIT#{userId}`, SK: `DATE#{date}`)
                - AI-generated workout plans (PK: `USER#{userId}`, SK: `AI_PLAN#{planId}`)
- Add CloudFront behavior for `/api/ai/*` route
- Create S3 bucket for AI-generated content caching (optional, cost optimization)

### 2. User Profile Enhancements

**Files**:

- `/Users/babar/projects/gymcoach-ai/services/user-profile-service/src/models/models.rs`
- `/Users/babar/projects/gymcoach-ai/services/user-profile-service/src/repository/user_profile_repository.rs`

Add AI trainer preferences to `UserPreferences`:

```rust
pub struct AITrainerPreferences {
    pub enabled: bool,
    pub coaching_style: String, // "motivational", "strict", "balanced", "technical"
    pub communication_frequency: String, // "daily", "weekly", "on-demand"
    pub focus_areas: Vec<String>, // ["strength", "cardio", "flexibility", "nutrition"]
    pub injury_history: Vec<String>,
    pub equipment_available: Vec<String>, // ["dumbbells", "barbell", "resistance_bands", "bodyweight"]
    pub workout_duration_preference: i32, // minutes
    pub workout_days_per_week: i32,
    pub meal_preferences: Vec<String>, // ["vegetarian", "vegan", "keto", "paleo", "no_restrictions"]
    pub allergies: Vec<String>,
    pub supplement_preferences: Vec<String>,
}
```

### 3. AI Service Implementation (Python)

**File**: `/Users/babar/projects/gymcoach-ai/services/ai-service-python/lambda_function.py`

Replace placeholder AI logic with Amazon Bedrock integration:

#### Core Features:

1. **Chat with AI Trainer** (`POST /api/ai/chat`)

                        - Input: user message, conversation history
                        - Uses Bedrock Claude Instant/Haiku
                        - Context: user profile, recent workouts, nutrition data
                        - Rate limiting: check before inference
                        - Store conversation in DynamoDB

2. **Generate Personalized Workout Plan** (`POST /api/ai/workout-plan/generate`)

                        - Input: user goals, preferences, equipment
                        - Output: 4-12 week structured plan with exercises, sets, reps, progression
                        - Store in DynamoDB with `AI_PLAN` SK prefix

3. **Generate Meal Plan** (`POST /api/ai/meal-plan/generate`)

                        - Input: user goals, dietary preferences, allergies
                        - Output: 7-day meal plan with macros, recipes, shopping list
                        - Integrate with nutrition service data

4. **Analyze Progress & Provide Insights** (`POST /api/ai/progress/analyze`)

                        - Input: user_id, time range
                        - Fetch: workout history, body measurements, nutrition logs
                        - Output: AI analysis, recommendations, goal adjustments

5. **Form Check Advice** (`POST /api/ai/form-check`)

                        - Input: exercise name, user description of issue
                        - Output: text-based form tips (no image analysis for cost)

6. **Motivation & Coaching** (`POST /api/ai/motivation`)

                        - Input: user context (missed workouts, plateaus, achievements)
                        - Output: personalized motivational message

#### Rate Limiting Implementation:

```python
class RateLimiter:
    def __init__(self, dynamodb_table):
        self.table = dynamodb_table
    
    async def check_limit(self, user_id: str, tier: str) -> dict:
        # Free tier: 10 requests/day
        # Premium tier: 50 requests/day (future)
        # Check DynamoDB for today's usage
        # Return: {"allowed": bool, "remaining": int, "reset_at": timestamp}
    
    async def increment_usage(self, user_id: str):
        # Atomic increment in DynamoDB
```

#### Bedrock Integration:

```python
import boto3
bedrock_runtime = boto3.client('bedrock-runtime', region_name='us-east-1')

def invoke_bedrock(prompt: str, context: dict, max_tokens: int = 500):
    # Use anthropic.claude-instant-v1 (cheapest) or anthropic.claude-3-haiku
    model_id = "anthropic.claude-instant-v1"
    
    body = {
        "prompt": f"\n\nHuman: {prompt}\n\nAssistant:",
        "max_tokens_to_sample": max_tokens,
        "temperature": 0.7,
        "top_p": 0.9,
    }
    
    response = bedrock_runtime.invoke_model(
        modelId=model_id,
        body=json.dumps(body)
    )
    
    return json.loads(response['body'].read())['completion']
```

#### Conversation History:

```python
async def get_conversation_history(user_id: str, limit: int = 10):
    # Query last N messages from DynamoDB
    # Return list of {role: "user"|"assistant", content: str, timestamp: str}

async def save_message(user_id: str, role: str, content: str):
    # Store in DynamoDB with TTL (30 days for free tier)
```

### 4. Dependencies Update

**File**: `/Users/babar/projects/gymcoach-ai/services/ai-service-python/requirements.txt`

Replace heavy ML libraries with lightweight Bedrock SDK:

```
boto3==1.34.0
botocore==1.34.0
pydantic==2.1.1
python-dotenv==1.0.0
structlog==23.1.0
aws-lambda-powertools==2.20.0
```

Remove: tensorflow, torch, transformers, opencv-python, scikit-learn (save ~500MB deployment size)

### 5. Frontend Integration

**Files**:

- `/Users/babar/projects/gymcoach-ai/apps/web/src/` (new AI trainer pages)
- `/Users/babar/projects/gymcoach-ai/GymCoachClean/src/screens/` (mobile AI trainer screens)

Create:

- AI Chat interface (like ChatGPT)
- Workout plan generator form
- Meal plan generator form
- Progress insights dashboard
- Rate limit indicator (requests remaining today)

### 6. Cost Optimization Strategies

1. **Bedrock Model Selection**:

                        - Use `anthropic.claude-instant-v1` ($0.80 per 1M input tokens, $2.40 per 1M output tokens)
                        - Or `anthropic.claude-3-haiku` ($0.25 per 1M input tokens, $1.25 per 1M output tokens) - CHEAPEST
                        - Avoid Claude 3 Sonnet/Opus (10x more expensive)

2. **Token Optimization**:

                        - Limit max_tokens to 500-1000 per request
                        - Truncate conversation history to last 5-10 messages
                        - Use concise system prompts

3. **Caching**:

                        - Cache common AI responses (e.g., exercise form tips) in DynamoDB with 24h TTL
                        - Cache user context (profile + recent data) for 1 hour

4. **Rate Limiting**:

                        - Free tier: 10 AI requests/day per user
                        - Premium tier (future): 50 requests/day
                        - Hard limit: 100 requests/day (abuse prevention)

5. **Lambda Optimization**:

                        - Use Lambda SnapStart (Python 3.11 doesn't support it yet, but plan for future)
                        - Reuse Bedrock client across invocations
                        - Set reserved concurrency to 5 (prevent runaway costs)

6. **DynamoDB**:

                        - Use on-demand billing (pay per request)
                        - Set TTL on conversation history (30 days)
                        - Set TTL on rate limit records (7 days)

### 7. Security & Abuse Prevention

1. **Authentication**: Reuse existing `auth-layer` for all AI endpoints
2. **Authorization**: Users can only access their own AI conversations
3. **Rate Limiting**: Enforce at Lambda level before Bedrock call
4. **Input Validation**: Sanitize user inputs, max message length 2000 chars
5. **Cost Alerts**: CloudWatch alarm if daily Bedrock spend > $10
6. **Monitoring**: Track per-user AI usage in DynamoDB

### 8. Database Schema (DynamoDB)

```
# Conversation History
PK: USER#{userId}
SK: CONVERSATION#{timestamp}
Attributes:
 - conversationId: string
 - role: "user" | "assistant"
 - content: string
 - tokens: number
 - model: string
 - createdAt: string (ISO 8601)
 - ttl: number (30 days from now)

# Rate Limiting
PK: RATE_LIMIT#{userId}
SK: DATE#{YYYY-MM-DD}
Attributes:
 - count: number
 - tier: "free" | "premium"
 - lastRequestAt: string
 - ttl: number (7 days from now)

# AI-Generated Plans
PK: USER#{userId}
SK: AI_PLAN#{planId}
Attributes:
 - planType: "workout" | "meal"
 - content: string (JSON)
 - generatedAt: string
 - active: boolean
 - duration: number (weeks)
```

### 9. API Endpoints

```
POST /api/ai/chat
  Body: { message: string, conversationId?: string }
  Response: { reply: string, conversationId: string, tokensUsed: number, remainingRequests: number }

POST /api/ai/workout-plan/generate
  Body: { goals: string[], duration: number, daysPerWeek: number, equipment: string[] }
  Response: { planId: string, plan: WorkoutPlan, tokensUsed: number }

POST /api/ai/meal-plan/generate
  Body: { goals: string[], dietaryPreferences: string[], allergies: string[] }
  Response: { planId: string, plan: MealPlan, tokensUsed: number }

POST /api/ai/progress/analyze
  Body: { timeRange: string }
  Response: { insights: string[], recommendations: string[], goalAdjustments: string[] }

GET /api/ai/conversations
  Response: { conversations: Conversation[] }

GET /api/ai/conversations/{conversationId}
  Response: { messages: Message[] }

DELETE /api/ai/conversations/{conversationId}
  Response: { success: boolean }

GET /api/ai/rate-limit
  Response: { requestsUsed: number, requestsRemaining: number, resetAt: string, tier: string }
```

### 10. Implementation Order

1. Update infrastructure (CDK) - add Bedrock permissions, AI Lambda, DynamoDB schema
2. Enhance user profile models with AI preferences
3. Implement rate limiting service (Python)
4. Implement Bedrock integration (Python)
5. Implement conversation history storage
6. Implement AI chat endpoint
7. Implement workout plan generation
8. Implement meal plan generation
9. Implement progress analysis
10. Add frontend AI chat interface (web + mobile)
11. Add workout/meal plan generator UI
12. Add rate limit indicators
13. Testing & cost monitoring
14. Deploy to production

## Cost Estimates (Monthly)

Assumptions: 100 active users, 5 AI requests/day average

- **Bedrock (Claude Haiku)**: 
                - Input: 100 users × 5 req/day × 30 days × 1000 tokens = 15M tokens = $3.75
                - Output: 15M tokens × 0.5 (avg output/input ratio) × 500 tokens = 7.5M tokens = $9.38
                - **Total: ~$13/month**

- **Lambda**: 
                - 15,000 requests/month × 5 sec avg = 75,000 sec
                - Free tier: 400,000 GB-sec/month (1024 MB × 75,000 sec = 76,800 GB-sec)
                - **Total: FREE (within free tier)**

- **DynamoDB**:
                - 15,000 writes/month + 30,000 reads/month
                - Free tier: 25 WCU, 25 RCU
                - **Total: FREE (within free tier)**

- **CloudFront**: Minimal (same as existing)

**Total Estimated Cost: $13-20/month for 100 active users**

## Risk Mitigation

1. **Cost Overrun**: Set CloudWatch billing alarm at $50/month
2. **Abuse**: Hard rate limit of 100 requests/day per user
3. **Poor AI Responses**: Implement feedback mechanism, fine-tune prompts
4. **Latency**: Set Lambda timeout to 30 seconds, show loading state in UI
5. **Bedrock Throttling**: Implement exponential backoff retry logic

## Future Enhancements (Phase 2)

1. Premium tier with higher rate limits ($9.99/month)
2. Voice-based AI coaching (Amazon Polly integration)
3. Image-based form analysis (Bedrock Multimodal)
4. AI-powered injury risk prediction
5. Integration with wearables (Apple Health, Google Fit)
6. Social features (share AI-generated plans)

### To-dos

- [ ] Update CDK stack: Add Bedrock IAM permissions, create AI Lambda function, add DynamoDB tables for conversations and rate limiting, configure CloudFront route for /api/ai/*
- [ ] Enhance user profile models with AITrainerPreferences struct (coaching style, focus areas, equipment, meal preferences, allergies, workout preferences)
- [ ] Implement RateLimiter class in Python: check_limit(), increment_usage(), DynamoDB integration with daily usage tracking and tier-based limits
- [ ] Implement Bedrock client wrapper: invoke_bedrock() function, model selection (Claude Haiku), prompt engineering, token optimization, error handling with retries
- [ ] Implement conversation history storage: get_conversation_history(), save_message(), DynamoDB queries with TTL, context building for AI prompts
- [ ] Implement POST /api/ai/chat endpoint: message handling, rate limit check, conversation context, Bedrock invocation, response formatting
- [ ] Implement POST /api/ai/workout-plan/generate: fetch user profile and preferences, build workout plan prompt, invoke Bedrock, parse and validate plan, store in DynamoDB
- [ ] Implement POST /api/ai/meal-plan/generate: fetch nutrition preferences, build meal plan prompt with macros, invoke Bedrock, parse recipes and shopping list, store plan
- [ ] Implement POST /api/ai/progress/analyze: fetch workout history, body measurements, nutrition logs from existing services, build analysis prompt, generate insights and recommendations
- [ ] Implement remaining AI endpoints: GET /api/ai/conversations, GET /api/ai/conversations/{id}, DELETE /api/ai/conversations/{id}, GET /api/ai/rate-limit
- [ ] Update requirements.txt: remove heavy ML libraries (tensorflow, torch, opencv), keep only boto3, pydantic, aws-lambda-powertools, reduce deployment package size
- [ ] Create web AI chat interface: chat component with message history, input field, rate limit indicator, conversation list, responsive design
- [ ] Create web workout and meal plan generator forms: multi-step forms with preferences, equipment selection, dietary options, plan preview and save
- [ ] Create mobile AI trainer screens: chat screen, workout plan generator, meal plan generator, progress insights, rate limit display
- [ ] Set up cost monitoring: CloudWatch billing alarm at $50/month, dashboard for Bedrock token usage, per-user cost tracking, daily usage reports
- [ ] Test all AI endpoints with real Bedrock calls, verify rate limiting works, test conversation history, validate cost per request, deploy to production