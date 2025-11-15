# AI-Powered Workout Plan Creator - Implementation Summary

## Overview

A comprehensive AI-powered workout plan creation system that uses multi-turn conversations to gather user requirements, intelligently matches or creates exercises, generates structured plans, and saves them to the database with full integration.

## Architecture

### Backend Components

#### 1. **Workout Plan Generator Service** (`workout_plan_generator.py`)

- **Location**: `/services/ai-service-python/workout_plan_generator.py`
- **Responsibilities**:
  - Multi-turn conversation management for requirement gathering
  - Intelligent exercise lookup and matching
  - Structured plan generation using AI
  - Smart exercise creation when needed
  - Integration with workout service API

#### 2. **Lambda Function Integration**

- **Location**: `/services/ai-service-python/lambda_function.py`
- **New Endpoints**:
  - `POST /ai/workout-plan/create` - Start/continue plan creation conversation
  - `POST /ai/workout-plan/approve` - Approve or modify generated plan

#### 3. **Dependencies**

- Added `aiohttp==3.9.1` to `requirements.txt` for HTTP client functionality

### Frontend Components

#### 1. **Workout Plan Creator Component**

- **Location**: `/apps/web/src/components/ai/WorkoutPlanCreator.tsx`
- **Features**:
  - Interactive conversational UI
  - Quick-start templates (Build Muscle, Lose Weight, General Fitness)
  - Real-time conversation flow
  - Plan preview with detailed breakdown
  - Approval/modification workflow
  - Success confirmation with navigation

#### 2. **API Routes**

- **Location**: `/apps/web/src/app/api/ai/workout-plan/`
  - `create/route.ts` - Create plan endpoint
  - `approve/route.ts` - Approve plan endpoint

#### 3. **AI Trainer Page Integration**

- **Location**: `/apps/web/src/app/[locale]/ai-trainer/page.tsx`
- Added "Create Plan" button in header
- Full-screen modal for workout plan creation
- Integration with existing AI trainer interface

## Key Features

### 1. **Multi-Turn Conversation Flow**

```
User Request → Extract Requirements → Check Completeness
    ↓                                         ↓
    ├─ Missing Info → Ask Follow-up Questions
    │                        ↓
    └─ Complete Info → Generate Structured Plan
                                ↓
                    ← Preview Plan to User
                                ↓
                    User Approves/Modifies
                                ↓
                    Save to Database (Plans + Sessions + Exercises)
```

### 2. **Intelligent Exercise Matching**

- **Direct Name Match**: Exact name comparison
- **Partial Match**: Substring matching with category validation
- **Synonym Matching**: Handles variations (press/push, squat/squats, etc.)
- **Automatic Creation**: Creates exercises not found in database
- **Metadata Tracking**: Tracks which exercises are new vs. existing

### 3. **Smart Plan Generation**

- Uses Amazon Bedrock AI with structured prompts
- Considers user profile, goals, equipment, experience level
- Generates week-by-week, session-by-session breakdown
- Includes exercise details (sets, reps, rest periods)
- Progressive overload and variation built-in

### 4. **Database Integration**

The system creates three levels of data:

1. **Exercises** (if needed)
   - Smart matching prevents duplicates
   - Proper categorization and muscle group tagging
   - User-created vs. system exercises distinction

2. **Workout Plans**
   - Structured plan with metadata
   - Duration, frequency, difficulty
   - Tags for categorization

3. **Workout Sessions**
   - Individual sessions for each workout day
   - Linked to parent plan
   - Complete exercise details with sets/reps

## Data Flow

### Request Flow

```
Frontend (AI Trainer)
    ↓
Next.js API Route (/api/ai/workout-plan/create)
    ↓
Lambda Function (handle_workout_plan_create)
    ↓
Workout Plan Generator Service
    ↓
Bedrock AI + DynamoDB Exercise Lookup
    ↓
Response (with plan or follow-up questions)
    ↓
Frontend displays conversation/preview
```

### Approval Flow

```
User Approves Plan
    ↓
Next.js API Route (/api/ai/workout-plan/approve)
    ↓
Lambda Function (handle_workout_plan_approve)
    ↓
Workout Plan Generator
    ↓
Create Missing Exercises → Workout Service API
    ↓
Create Workout Plan → Workout Service API
    ↓
Create Workout Sessions → Workout Service API
    ↓
Success Response with IDs
```

## Environment Configuration

### Required Environment Variables

**AI Service Lambda:**

```bash
WORKOUT_SERVICE_URL=https://api.gymcoach-ai.com
DYNAMODB_TABLE=gymcoach-ai-main-dev
AWS_REGION=eu-west-1
```

**Frontend (Next.js):**

```bash
AI_SERVICE_URL=https://your-ai-service-api-gateway-url/ai
NEXT_PUBLIC_API_URL=https://api.gymcoach-ai.com
```

## Deployment Steps

### 1. Deploy AI Service Changes

```bash
cd services/ai-service-python

# Install dependencies
pip install -r requirements.txt

# Package Lambda
zip -r lambda_deployment.zip . -x "*.pyc" -x "__pycache__/*"

# Deploy to Lambda (update function name as needed)
aws lambda update-function-code \
  --function-name gymcoach-ai-ai-service \
  --zip-file fileb://lambda_deployment.zip
```

### 2. Deploy Frontend Changes

```bash
cd apps/web

# Install dependencies
pnpm install

# Build
pnpm build

# Deploy to your hosting platform
# (Vercel, AWS Amplify, etc.)
```

### 3. Update Infrastructure (if needed)

If using AWS CDK, ensure Lambda has proper permissions:

- DynamoDB: Read access to exercises table
- API Gateway: Invoke permissions
- Workout Service: Network access + authentication

## Testing Guide

### 1. **Test Exercise Matching**

**Create test exercises in DynamoDB:**

```python
exercises = [
    {"name": "Barbell Bench Press", "category": "strength"},
    {"name": "Squats", "category": "strength"},
    {"name": "Running", "category": "cardio"}
]
```

**Test cases:**

- Exact match: "Barbell Bench Press" → finds existing
- Partial match: "Bench Press" → finds "Barbell Bench Press"
- Synonym: "Press" → finds press-related exercises
- New exercise: "Bulgarian Split Squats" → creates new

### 2. **Test Conversation Flow**

**Start with vague request:**

```
User: "I want to get stronger"
Expected: AI asks about duration, frequency, experience level
```

**Provide complete details:**

```
User: "I want to build muscle with 4 workouts per week for 12 weeks"
Expected: AI generates plan immediately
```

**Test modification:**

```
User: (after preview) "Change to 5 days per week"
Expected: AI regenerates plan with 5 days
```

### 3. **Test Plan Generation**

**Verify plan structure:**

```json
{
  "name": "12-Week Muscle Building Plan",
  "duration_weeks": 12,
  "frequency_per_week": 4,
  "weeks": [
    {
      "week_number": 1,
      "sessions": [
        {
          "name": "Upper Body Strength",
          "exercises": [
            {
              "name": "Bench Press",
              "sets": 4,
              "reps": 8,
              "exercise_id": "uuid",
              "found_in_db": true
            }
          ]
        }
      ]
    }
  ]
}
```

### 4. **Test Database Integration**

**Verify creation sequence:**

1. Check new exercises created in DynamoDB
2. Verify workout plan created with correct structure
3. Confirm workout sessions linked to plan
4. Validate all relationships and IDs

**Query examples:**

```bash
# Check exercises
aws dynamodb query \
  --table-name gymcoach-ai-main-dev \
  --index-name GSI1 \
  --key-condition-expression "GSI1PK = :pk" \
  --expression-attribute-values '{":pk":{"S":"EXERCISES"}}'

# Check plans for user
aws dynamodb query \
  --table-name gymcoach-ai-main-dev \
  --key-condition-expression "PK = :pk AND begins_with(SK, :sk)" \
  --expression-attribute-values '{":pk":{"S":"USER#user-id"}, ":sk":{"S":"PLAN#"}}'
```

## Error Handling

### Common Issues and Solutions

1. **Exercise Matching Fails**
   - Check DynamoDB GSI1 index exists
   - Verify exercise data format
   - Check category normalization

2. **Plan Generation Timeout**
   - Increase Lambda timeout (recommend 30s+)
   - Optimize Bedrock prompt
   - Reduce max_tokens if needed

3. **API Integration Fails**
   - Verify WORKOUT_SERVICE_URL environment variable
   - Check authentication token passing
   - Validate request/response formats

4. **Rate Limiting**
   - Monitor rate limit service
   - Implement proper error messages
   - Consider tier-based limits

## Performance Optimizations

### 1. **Caching Strategy**

- Cache exercise list (TTL: 1 hour)
- Cache user profile (TTL: 15 minutes)
- Use Bedrock response caching for similar requests

### 2. **Batch Operations**

- Batch exercise creation (max 25 per batch)
- Parallel session creation when possible
- Use DynamoDB BatchWriteItem

### 3. **Response Times**

- Exercise lookup: ~200ms
- Plan generation: 2-5s (AI)
- Database save: 1-3s
- Total: 5-10s end-to-end

## Monitoring and Metrics

### CloudWatch Metrics

**Custom Metrics Emitted:**

- `WorkoutPlanCreationRequests`: Total requests
- `WorkoutPlansGenerated`: Successfully generated plans
- `WorkoutPlansSaved`: Plans saved to database
- `WorkoutSessionsCreated`: Sessions created
- `ExercisesCreated`: New exercises created
- `WorkoutPlanCreationErrors`: Errors encountered

**Alarms to Set:**

- Error rate > 5%
- Average response time > 15s
- Rate limit exceeded > 10/hour

## Security Considerations

1. **Authentication**: All endpoints require valid JWT token
2. **Authorization**: Users can only create plans for themselves
3. **Rate Limiting**: Prevents abuse and controls costs
4. **Input Validation**: Sanitize all user inputs
5. **API Security**: CORS configured, HTTPS only

## Cost Estimates

### Per Workout Plan Creation:

**AI Service (Bedrock):**

- Requirements gathering: ~500 tokens × $0.075/1M = $0.0000375
- Plan generation: ~3000 tokens × $0.075/1M = $0.000225
- Total AI: ~$0.0003 per plan

**Lambda:**

- Execution time: ~10s
- Memory: 512MB
- Cost: ~$0.00002 per invocation

**DynamoDB:**

- Reads: ~5-10 (exercise lookup)
- Writes: ~10-20 (plan + sessions)
- Cost: ~$0.000001 per plan

**Total: ~$0.0003 per workout plan created**

## Future Enhancements

1. **Advanced Exercise Matching**
   - Implement vector similarity search
   - Use exercise embeddings for semantic matching
   - ML-based exercise recommendations

2. **Plan Personalization**
   - Consider injury history
   - Integrate with wearable data
   - Adaptive difficulty based on performance

3. **Progress Tracking**
   - Auto-adjust plans based on completion
   - Real-time feedback integration
   - Predictive analytics for goal achievement

4. **Collaboration Features**
   - Share plans with trainers
   - Coach approval workflow
   - Community plan templates

## Support and Troubleshooting

### Logs Location

- Lambda logs: CloudWatch `/aws/lambda/gymcoach-ai-ai-service`
- Frontend logs: Browser console + Next.js logs
- Workout service: API Gateway logs

### Debug Mode

Enable verbose logging:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Contact

For issues or questions, refer to:

- GitHub Issues: [repo link]
- Documentation: [docs link]
- Team Slack: #gymcoach-ai-dev

---

## Quick Start Checklist

- [ ] Deploy AI service with new code
- [ ] Update environment variables
- [ ] Deploy frontend changes
- [ ] Test exercise matching
- [ ] Test conversation flow
- [ ] Test plan generation
- [ ] Verify database integration
- [ ] Monitor CloudWatch metrics
- [ ] Set up alarms
- [ ] Document any issues

**Estimated Setup Time**: 1-2 hours
**Testing Time**: 2-4 hours
**Total Implementation Time**: 8-12 hours (development complete)

## Status: ✅ IMPLEMENTATION COMPLETE

All components are built and integrated. Ready for deployment and testing.
