# AI Service - Python Lambda Function

This is the AI service for the GymCoach AI application, built with Python and optimized for AWS Lambda. It provides AI-powered features including personalized recommendations, form analysis, progress prediction, and more.

## Features

### Core AI Capabilities

1. **Personalized Recommendations**
   - Workout recommendations based on user profile and history
   - Nutrition recommendations tailored to user goals
   - Lifestyle recommendations for optimal fitness

2. **Exercise Form Analysis**
   - Computer vision-based form analysis from images
   - Real-time feedback on exercise technique
   - Risk factor identification and improvement suggestions

3. **Progress Prediction**
   - ML-powered progress predictions
   - Strength gains forecasting
   - Weight and body composition predictions
   - Milestone achievement predictions

4. **Injury Prevention**
   - AI-powered injury risk assessment
   - Prevention strategy recommendations
   - Exercise modification suggestions
   - Recovery recommendations

5. **Nutrition Optimization**
   - AI-optimized nutrition plans
   - Macro and micronutrient recommendations
   - Meal timing optimization
   - Supplement recommendations

6. **Goal Setting & Adjustment**
   - AI-assisted goal setting
   - Goal timeline optimization
   - Milestone breakdown
   - Progress-based goal adjustments

7. **Motivation & Coaching**
   - Personalized motivational messages
   - Progress celebration
   - Challenge suggestions
   - Social encouragement

## Architecture

### Technology Stack

- **Runtime**: Python 3.11
- **Framework**: AWS Lambda
- **ML Libraries**: TensorFlow, PyTorch, scikit-learn, OpenCV
- **Data Processing**: NumPy, Pandas, SciPy
- **Image Processing**: OpenCV, PIL, scikit-image
- **NLP**: NLTK, spaCy, Transformers
- **Database**: DynamoDB
- **Authentication**: Custom Python auth layer

### Dependencies

Key dependencies include:

- `boto3` - AWS SDK
- `numpy` - Numerical computing
- `pandas` - Data manipulation
- `scikit-learn` - Machine learning
- `opencv-python` - Computer vision
- `tensorflow` - Deep learning
- `torch` - PyTorch for ML
- `transformers` - Hugging Face transformers
- `Pillow` - Image processing
- `requests` - HTTP requests

## API Endpoints

### Base URL

```
https://api.gymcoach-ai.com/api/ai
```

### Authentication

All endpoints require JWT authentication:

```
Authorization: Bearer <jwt_token>
```

### Endpoints

#### 1. Personalized Recommendations

```http
POST /api/ai/personalized-recommendations
```

**Request Body:**

```json
{
  "userId": "user123",
  "context": {
    "currentGoals": ["weight_loss", "strength_gain"],
    "timeframe": "3_months",
    "preferences": {
      "workoutFrequency": 4,
      "workoutDuration": 45,
      "equipment": ["dumbbells", "barbell"]
    }
  }
}
```

**Response:**

```json
{
  "workout_recommendations": {
    "recommended_exercises": ["Squats", "Deadlifts", "Bench Press"],
    "intensity_adjustments": "Increase by 5%",
    "form_focus_areas": ["Squat depth", "Deadlift form"],
    "recovery_suggestions": ["Add rest day", "Focus on mobility"]
  },
  "nutrition_recommendations": {
    "macro_adjustments": { "protein": "+20g", "carbs": "-50g" },
    "meal_timing": "Eat 2 hours before workout",
    "supplement_suggestions": ["Creatine", "Protein powder"],
    "hydration_goals": "3-4 liters per day"
  },
  "lifestyle_recommendations": {
    "sleep_optimization": "Aim for 7-9 hours",
    "stress_management": "Add meditation routine",
    "activity_suggestions": ["Walking", "Yoga"],
    "habit_formation": "Track daily habits"
  }
}
```

#### 2. Exercise Form Analysis

```http
POST /api/ai/form-analysis
```

**Request Body:**

```json
{
  "imageData": "base64_encoded_image",
  "exerciseType": "squat"
}
```

**Response:**

```json
{
  "exercise_type": "squat",
  "form_score": 8.5,
  "feedback": "Good form overall, slight forward lean on squats",
  "improvements": ["Keep chest up", "Sit back more"],
  "risk_factors": ["Knee valgus", "Forward lean"],
  "confidence": 0.85
}
```

#### 3. Progress Prediction

```http
POST /api/ai/progress-prediction
```

**Request Body:**

```json
{
  "userId": "user123",
  "timeframe": "3_months"
}
```

**Response:**

```json
{
  "strength_gains": {
    "bench_press": "+15 lbs in 3 months",
    "squat": "+25 lbs in 3 months",
    "deadlift": "+30 lbs in 3 months"
  },
  "weight_changes": {
    "weight_loss": "2-3 lbs per month",
    "body_fat_reduction": "1-2% per month",
    "muscle_gain": "0.5-1 lb per month"
  },
  "endurance_improvements": {
    "cardio_capacity": "+15% in 2 months",
    "recovery_time": "-20% in 1 month",
    "workout_duration": "+10 minutes in 6 weeks"
  }
}
```

#### 4. Injury Prevention

```http
POST /api/ai/injury-prevention
```

**Request Body:**

```json
{
  "userId": "user123",
  "riskFactors": {
    "previousInjuries": ["knee", "shoulder"],
    "currentPain": ["lower_back"],
    "trainingVolume": "high",
    "recoveryTime": "insufficient"
  }
}
```

**Response:**

```json
{
  "risk_level": "Medium",
  "risk_factors": ["Overtraining", "Poor form"],
  "prevention_strategies": ["Deload week", "Form check"],
  "exercise_modifications": ["Reduce weight", "Add warm-up"],
  "recovery_recommendations": ["More rest", "Mobility work"],
  "warning_signs": ["Joint pain", "Fatigue"]
}
```

#### 5. Nutrition Optimization

```http
POST /api/ai/nutrition-optimization
```

**Request Body:**

```json
{
  "userId": "user123",
  "goals": {
    "primaryGoal": "weight_loss",
    "targetWeight": 150,
    "timeline": "6_months",
    "dietaryRestrictions": ["vegetarian"]
  }
}
```

**Response:**

```json
{
  "daily_macros": {
    "protein": "150g",
    "carbs": "200g",
    "fat": "80g",
    "calories": "2200"
  },
  "meal_timing": {
    "pre_workout": "2 hours before",
    "post_workout": "30 minutes after",
    "bedtime": "2 hours before sleep"
  },
  "supplement_recommendations": ["Creatine", "Protein powder", "Multivitamin"],
  "hydration_plan": {
    "daily_water": "3-4 liters",
    "pre_workout": "500ml",
    "during_workout": "250ml every 15 min",
    "post_workout": "500ml"
  }
}
```

#### 6. Goal Setting

```http
POST /api/ai/goal-setting
```

**Request Body:**

```json
{
  "userId": "user123",
  "currentGoals": {
    "weightLoss": 10,
    "strengthGain": "bench_press_100",
    "timeline": "6_months"
  }
}
```

**Response:**

```json
{
  "current_goals_assessment": {
    "realistic": true,
    "achievable": true,
    "timeline": "Appropriate",
    "adjustments_needed": false
  },
  "suggested_adjustments": {
    "intensity": "Increase by 10%",
    "timeline": "Extend by 2 weeks",
    "focus_areas": ["Strength", "Endurance"]
  },
  "milestone_breakdown": {
    "milestone_1": "Lose 2 lbs",
    "milestone_2": "Lose 5 lbs",
    "milestone_3": "Lose 10 lbs",
    "final_goal": "Lose 15 lbs"
  }
}
```

#### 7. Motivation Coaching

```http
POST /api/ai/motivation-coaching
```

**Request Body:**

```json
{
  "userId": "user123",
  "context": {
    "recentProgress": "completed_5_workouts",
    "currentMood": "motivated",
    "challenges": ["time_constraints"]
  }
}
```

**Response:**

```json
{
  "personalized_message": "You're making great progress! Keep pushing forward!",
  "progress_celebration": {
    "achievements": ["Completed 5 workouts this week", "Hit new PR"],
    "celebration_message": "Amazing work this week!"
  },
  "challenge_suggestions": {
    "weekly_challenge": "Complete 4 workouts",
    "monthly_challenge": "Lose 5 lbs",
    "skill_challenge": "Master 10 pull-ups"
  },
  "mindset_tips": {
    "motivation_tips": ["Focus on progress, not perfection"],
    "mindset_shifts": ["View setbacks as learning opportunities"],
    "mental_training": ["Practice visualization techniques"]
  }
}
```

## Development

### Local Development

1. **Install Dependencies**

   ```bash
   pip install -r requirements.txt
   ```

2. **Set Environment Variables**

   ```bash
   export DYNAMODB_TABLE="gymcoach-ai-main"
   export COGNITO_USER_POOL_ID="your-pool-id"
   export JWT_SECRET="your-jwt-secret"
   export AWS_REGION="us-east-1"
   ```

3. **Test Locally**
   ```bash
   python lambda_function.py
   ```

### Deployment

1. **Build Deployment Package**

   ```bash
   ./scripts/deploy-ai-service.sh
   ```

2. **Deploy to AWS**
   ```bash
   aws lambda update-function-code \
     --function-name gymcoach-ai-ai-service \
     --zip-file fileb://deployments/ai-service-deployment.zip
   ```

### Testing

Run tests with pytest:

```bash
pytest tests/
```

## Performance Optimization

### Cold Start Optimization

- Use connection pooling for AWS services
- Lazy load ML models
- Optimize package size
- Use provisioned concurrency for critical functions

### Memory Optimization

- Set appropriate memory allocation (1024MB for AI functions)
- Monitor memory usage with CloudWatch
- Optimize model loading and caching

### Timeout Configuration

- Set appropriate timeout (5 minutes for AI functions)
- Implement proper error handling
- Use async processing for long-running tasks

## Monitoring

### CloudWatch Metrics

- Function duration
- Memory utilization
- Error rates
- Throttle counts

### Custom Metrics

- Model inference time
- Recommendation accuracy
- User engagement metrics

### Logging

- Structured logging with AWS Lambda Powertools
- Request/response logging
- Error tracking and alerting

## Security

### Authentication

- JWT token validation
- User permission checking
- Resource ownership validation

### Data Protection

- Input validation and sanitization
- Secure image processing
- PII data handling

### API Security

- Rate limiting
- CORS configuration
- Error message sanitization

## Future Enhancements

1. **Advanced ML Models**
   - Custom trained models for specific use cases
   - Real-time model updates
   - A/B testing for recommendations

2. **Computer Vision**
   - Real-time video analysis
   - 3D pose estimation
   - Advanced form analysis

3. **Natural Language Processing**
   - Chatbot integration
   - Voice commands
   - Text-based coaching

4. **Integration**
   - Wearable device integration
   - Third-party fitness apps
   - Social media integration

## Troubleshooting

### Common Issues

1. **Memory Errors**
   - Increase Lambda memory allocation
   - Optimize model loading
   - Use smaller models

2. **Timeout Errors**
   - Increase Lambda timeout
   - Optimize processing logic
   - Use async processing

3. **Cold Start Issues**
   - Use provisioned concurrency
   - Optimize package size
   - Implement connection pooling

### Debug Mode

Enable debug logging:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## Support

For issues and questions:

- Check CloudWatch logs
- Review error messages
- Contact development team
