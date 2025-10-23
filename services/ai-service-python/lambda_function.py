import json
import logging
import os
import uuid
import asyncio
import boto3
from typing import Dict, Any, Optional
import traceback
from decimal import Decimal

# Import our services
from auth_layer import AuthLayer
from rate_limiter import RateLimiter
from bedrock_service import BedrockService
from conversation_service import ConversationService
from user_data_service import UserDataService
from rag_service import RAGService
from proactive_coach_service import ProactiveCoachService
from progress_monitor import ProgressMonitor
from memory_service import MemoryService
from personalization_engine import PersonalizationEngine
from workout_adaptation_service import WorkoutAdaptationService
from performance_analyzer import PerformanceAnalyzer
from exercise_substitution import ExerciseSubstitutionService
from nutrition_intelligence import NutritionIntelligence
from macro_optimizer import MacroOptimizer
from meal_timing_service import MealTimingService

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)
# Updated auth layer with Cognito token verification

# Environment variables
TABLE_NAME = os.environ.get('DYNAMODB_TABLE', 'gymcoach-ai-main')
REGION = os.environ.get('AWS_REGION', 'us-east-1')

# Initialize services
auth_layer = AuthLayer()
rate_limiter = RateLimiter(TABLE_NAME)
bedrock_service = BedrockService()
conversation_service = ConversationService(TABLE_NAME)
user_data_service = UserDataService(TABLE_NAME)
rag_service = RAGService()
proactive_coach_service = ProactiveCoachService()
progress_monitor = ProgressMonitor()
workout_adaptation_service = WorkoutAdaptationService()
performance_analyzer = PerformanceAnalyzer()
exercise_substitution_service = ExerciseSubstitutionService()
nutrition_intelligence = NutritionIntelligence()
macro_optimizer = MacroOptimizer()
meal_timing_service = MealTimingService()
memory_service = MemoryService()
personalization_engine = PersonalizationEngine()

# Initialize CloudWatch client for metrics
cloudwatch = boto3.client('cloudwatch')

def emit_metric(metric_name: str, value: float, unit: str = 'Count', dimensions: Optional[Dict[str, str]] = None):
    """Emit custom CloudWatch metric"""
    try:
        metric_data = {
            'MetricName': metric_name,
            'Value': value,
            'Unit': unit
        }
        
        if dimensions:
            metric_data['Dimensions'] = [{'Name': k, 'Value': v} for k, v in dimensions.items()]
        
        cloudwatch.put_metric_data(
            Namespace='GymCoachAI/AI',
            MetricData=[metric_data]
        )
    except Exception as e:
        logger.error(f"Failed to emit metric {metric_name}: {e}")

def calculate_cost(input_tokens: int, output_tokens: int) -> float:
    """Calculate estimated cost based on DeepSeek v3 pricing"""
    # DeepSeek v3 pricing (approximate)
    input_cost_per_1k = 0.00027  # $0.27 per 1M input tokens
    output_cost_per_1k = 0.0011  # $1.10 per 1M output tokens
    
    input_cost = (input_tokens / 1000) * input_cost_per_1k
    output_cost = (output_tokens / 1000) * output_cost_per_1k
    
    return input_cost + output_cost

def convert_decimals(obj):
    """Convert Decimal objects to regular numbers for JSON serialization"""
    if isinstance(obj, Decimal):
        return float(obj)
    elif isinstance(obj, dict):
        return {key: convert_decimals(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_decimals(item) for item in obj]
    else:
        return obj

def lambda_handler(event, context):
    """Main Lambda handler for AI service"""
    try:
        logger.info(f"Received event: {json.dumps(event)}")
        
        # Handle EventBridge events (proactive coaching)
        if 'source' in event and event['source'] == 'aws.events':
            return asyncio.run(handle_eventbridge_event(event))
        
        # Handle CORS preflight requests
        if event.get('requestContext', {}).get('http', {}).get('method') == 'OPTIONS':
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, DELETE'
                },
                'body': json.dumps({'message': 'CORS preflight'})
            }
        
        # Authenticate request
        auth_result = auth_layer.authenticate(event)
        if not auth_result['is_authorized']:
            return {
                'statusCode': 403,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, DELETE'
                },
                'body': json.dumps({
                    'error': 'Forbidden',
                    'message': auth_result.get('error', 'Access denied')
                })
            }
        
        # Extract user context
        auth_context = auth_result.get('context', {})
        user_id = auth_context.get('user_id')
        
        if not user_id:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'error': 'Bad Request',
                    'message': 'User ID not found in authentication context'
                })
            }
        
        # Parse the event
        http_method = event.get('requestContext', {}).get('http', {}).get('method', 'GET')
        path = event.get('rawPath', '/')
        body = event.get('body', '{}')
        
        # Parse body if it's a string
        if isinstance(body, str):
            try:
                body = json.loads(body)
            except json.JSONDecodeError:
                body = {}
        
        # Route to appropriate handler using asyncio.run
        if http_method == 'POST':
            if '/chat' in path:
                return asyncio.run(handle_chat(user_id, body))
            elif '/workout-plan/generate' in path:
                return asyncio.run(handle_workout_plan_generation(user_id, body))
            elif '/meal-plan/generate' in path:
                return asyncio.run(handle_meal_plan_generation(user_id, body))
            elif '/progress/analyze' in path:
                return asyncio.run(handle_progress_analysis(user_id, body))
            elif '/form-check' in path:
                return asyncio.run(handle_form_check(user_id, body))
            elif '/motivation' in path:
                return asyncio.run(handle_motivation(user_id, body))
        elif '/progress/monitor' in path:
            return asyncio.run(handle_progress_monitoring(user_id, body))
        elif '/workout/adapt' in path:
            return asyncio.run(handle_workout_adaptation(user_id, body))
        elif '/workout/substitute' in path:
            return asyncio.run(handle_exercise_substitution(user_id, body))
        elif '/workout/assess-risk' in path:
            return asyncio.run(handle_injury_risk_assessment(user_id, body))
        elif '/performance/analyze' in path:
            return asyncio.run(handle_performance_analysis(user_id, body))
        elif '/performance/anomalies' in path:
            return asyncio.run(handle_anomaly_detection(user_id, body))
        elif '/performance/predict' in path:
            return asyncio.run(handle_performance_prediction(user_id, body))
        elif '/performance/report' in path:
            return asyncio.run(handle_performance_report(user_id, body))
        elif '/nutrition/analyze' in path:
            return asyncio.run(handle_nutrition_analysis(user_id, body))
        elif '/nutrition/adjust' in path:
            return asyncio.run(handle_nutrition_adjustment(user_id, body))
        elif '/nutrition/substitute' in path:
            return asyncio.run(handle_food_substitution(user_id, body))
        elif '/nutrition/hydration' in path:
            return asyncio.run(handle_hydration_analysis(user_id, body))
        elif '/macros/calculate' in path:
            return asyncio.run(handle_macro_calculation(user_id, body))
        elif '/macros/adjust' in path:
            return asyncio.run(handle_macro_adjustment(user_id, body))
        elif '/macros/timing' in path:
            return asyncio.run(handle_macro_timing(user_id, body))
        elif '/macros/modify' in path:
            return asyncio.run(handle_macro_modification(user_id, body))
        elif '/meals/schedule' in path:
            return asyncio.run(handle_meal_schedule(user_id, body))
        elif '/meals/pre-workout' in path:
            return asyncio.run(handle_pre_workout_nutrition(user_id, body))
        elif '/meals/post-workout' in path:
            return asyncio.run(handle_post_workout_nutrition(user_id, body))
        elif '/meals/timing-analysis' in path:
            return asyncio.run(handle_meal_timing_analysis(user_id, body))
        elif '/meals/fasting' in path:
            return asyncio.run(handle_intermittent_fasting(user_id, body))
        elif '/memory/store' in path:
            return asyncio.run(handle_memory_storage(user_id, body))
        elif '/memory/retrieve' in path:
            return asyncio.run(handle_memory_retrieval(user_id, body))
        elif '/memory/update' in path:
            return asyncio.run(handle_memory_update(user_id, body))
        elif '/memory/cleanup' in path:
            return asyncio.run(handle_memory_cleanup(user_id, body))
        elif '/memory/summary' in path:
            return asyncio.run(handle_memory_summary(user_id, body))
        elif '/personalization/analyze' in path:
            return asyncio.run(handle_preference_analysis(user_id, body))
        elif '/personalization/style' in path:
            return asyncio.run(handle_coaching_style(user_id, body))
        elif '/personalization/adapt' in path:
            return asyncio.run(handle_message_adaptation(user_id, body))
        elif '/personalization/feedback' in path:
            return asyncio.run(handle_feedback_learning(user_id, body))
        elif '/conversation/thread' in path:
            return asyncio.run(handle_conversation_thread(user_id, body))
        elif '/conversation/summarize' in path:
            return asyncio.run(handle_conversation_summarization(user_id, body))
        elif '/conversation/analytics' in path:
            return asyncio.run(handle_conversation_analytics(user_id, body))
        
        elif http_method == 'GET':
            if '/conversations' in path:
                return asyncio.run(handle_get_conversations(user_id, path))
            elif '/rate-limit' in path:
                return asyncio.run(handle_get_rate_limit(user_id))
            elif '/rag/validate' in path:
                return asyncio.run(handle_rag_validation())
            elif '/rag/stats' in path:
                return asyncio.run(handle_rag_stats())
            else:
                return create_error_response(404, 'Endpoint not found')
        
        elif http_method == 'PUT':
            if '/conversations' in path and '/title' in path:
                return asyncio.run(handle_update_conversation_title(user_id, path, body))
            else:
                return create_error_response(404, 'Endpoint not found')
        
        elif http_method == 'DELETE':
            if '/conversations' in path:
                return asyncio.run(handle_delete_conversation(user_id, path))
            else:
                return create_error_response(404, 'Endpoint not found')
        
        else:
            return create_error_response(405, 'Method not allowed')
        
    except Exception as e:
        logger.error(f"Error in lambda_handler: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e)
            })
        }

async def handle_chat(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle AI chat requests"""
    try:
        message = body.get('message', '').strip()
        conversation_id = body.get('conversationId', str(uuid.uuid4()))
        
        if not message:
            return create_error_response(400, 'Message is required')
        
        if len(message) > 2000:
            return create_error_response(400, 'Message too long (max 2000 characters)')
        
        # Check rate limit
        user_tier = await rate_limiter.get_user_tier(user_id)
        rate_limit_result = await rate_limiter.check_limit(user_id, user_tier)
        
        if not rate_limit_result['allowed']:
            return {
                'statusCode': 429,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps(convert_decimals({
                    'error': 'Rate limit exceeded',
                    'message': f'You have reached your daily limit of {rate_limit_result["limit"]} AI requests',
                    'resetAt': rate_limit_result['reset_at'],
                    'remaining': rate_limit_result['remaining']
                }))
            }
        
        # Get user context and conversation history
        user_context = await user_data_service.build_user_context(user_id)
        conversation_context = await conversation_service.build_conversation_context(
            user_id, conversation_id, max_messages=5
        )
        
        # Retrieve relevant context using RAG
        rag_context = await rag_service.retrieve_relevant_context(
            query=message,
            context=user_context,
            top_k=3,
            similarity_threshold=0.7
        )
        
        # Build enhanced AI prompt with RAG context
        prompt_parts = []
        
        # Add RAG context if available
        if rag_context['context']:
            prompt_parts.append(f"Relevant Knowledge:\n{rag_context['context']}")
        
        # Add conversation context
        if conversation_context:
            prompt_parts.append(f"Recent conversation:\n{conversation_context}")
        
        # Add user message
        prompt_parts.append(f"User: {message}")
        
        # Combine all parts
        prompt = "\n\n".join(prompt_parts)
        
        # Invoke Bedrock
        bedrock_result = bedrock_service.invoke_bedrock(prompt, user_context, max_tokens=1000)
        
        if not bedrock_result['success']:
            return create_error_response(500, 'AI service temporarily unavailable')
        
        # Save messages to conversation history
        await conversation_service.save_message(
            user_id, conversation_id, 'user', message, 
            bedrock_result['input_tokens'], bedrock_service.model_id
        )
        await conversation_service.save_message(
            user_id, conversation_id, 'assistant', bedrock_result['response'],
            bedrock_result['output_tokens'], bedrock_service.model_id
        )
        
        # Increment usage
        await rate_limiter.increment_usage(user_id, user_tier)
        
        # Update rate limit result (convert to int to avoid Decimal issues)
        rate_limit_result['remaining'] = int(rate_limit_result['remaining']) - 1
        
        # Emit metrics
        emit_metric('ChatRequests', 1)
        emit_metric('InputTokens', bedrock_result['input_tokens'])
        emit_metric('OutputTokens', bedrock_result['output_tokens'])
        emit_metric('RAGSources', len(rag_context['sources']))
        
        # Calculate and emit cost
        cost = calculate_cost(bedrock_result['input_tokens'], bedrock_result['output_tokens'])
        emit_metric('EstimatedCost', cost, 'None')
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(convert_decimals({
                'reply': bedrock_result['response'],
                'conversationId': conversation_id,
                'tokensUsed': bedrock_result['tokens_used'],
                'remainingRequests': rate_limit_result['remaining'],
                'resetAt': rate_limit_result['reset_at'],
                'tier': user_tier,
                'ragSources': len(rag_context['sources']),
                'ragMetadata': rag_context['metadata']
            }))
        }
        
    except Exception as e:
        logger.error(f"Error in handle_chat: {e}")
        emit_metric('ChatErrors', 1)
        return create_error_response(500, 'Failed to process chat request')

async def handle_workout_plan_generation(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle workout plan generation requests"""
    try:
        goals = body.get('goals', [])
        duration = body.get('duration', 4)  # weeks
        days_per_week = body.get('daysPerWeek', 3)
        equipment = body.get('equipment', [])
        
        if not goals:
            return create_error_response(400, 'Fitness goals are required')
        
        # Check rate limit
        user_tier = await rate_limiter.get_user_tier(user_id)
        rate_limit_result = await rate_limiter.check_limit(user_id, user_tier)
        
        if not rate_limit_result['allowed']:
            return create_error_response(429, 'Rate limit exceeded')
        
        # Get user context
        user_context = await user_data_service.build_user_context(user_id)
        
        # Build workout plan prompt
        prompt = f"""Create a personalized {duration}-week workout plan for someone with these goals: {', '.join(goals)}.

Requirements:
- {days_per_week} workout days per week
- Available equipment: {', '.join(equipment) if equipment else 'bodyweight only'}
- Duration: {duration} weeks
- Include progression and variation
- Provide specific exercises, sets, reps, and rest periods
- Include warm-up and cool-down recommendations

Format the response as a structured workout plan with weekly breakdowns."""
        
        # Invoke Bedrock
        bedrock_result = bedrock_service.invoke_bedrock(prompt, user_context, max_tokens=2000)
        
        if not bedrock_result['success']:
            return create_error_response(500, 'AI service temporarily unavailable')
        
        # Save workout plan
        plan_id = str(uuid.uuid4())
        await save_ai_generated_plan(user_id, plan_id, 'workout', bedrock_result['response'], {
            'goals': goals,
            'duration': duration,
            'daysPerWeek': days_per_week,
            'equipment': equipment
        })
        
        # Increment usage
        await rate_limiter.increment_usage(user_id, user_tier)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(convert_decimals({
                'planId': plan_id,
                'plan': bedrock_result['response'],
                'tokensUsed': bedrock_result['tokens_used'],
                'remainingRequests': rate_limit_result['remaining'] - 1
            }))
        }
        
    except Exception as e:
        logger.error(f"Error in handle_workout_plan_generation: {e}")
        return create_error_response(500, 'Failed to generate workout plan')

async def handle_meal_plan_generation(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle meal plan generation requests"""
    try:
        goals = body.get('goals', [])
        dietary_preferences = body.get('dietaryPreferences', [])
        allergies = body.get('allergies', [])
        
        if not goals:
            return create_error_response(400, 'Nutrition goals are required')
        
        # Check rate limit
        user_tier = await rate_limiter.get_user_tier(user_id)
        rate_limit_result = await rate_limiter.check_limit(user_id, user_tier)
        
        if not rate_limit_result['allowed']:
            return create_error_response(429, 'Rate limit exceeded')
        
        # Get user context
        user_context = await user_data_service.build_user_context(user_id)
        
        # Build meal plan prompt
        prompt = f"""Create a personalized 7-day meal plan for someone with these nutrition goals: {', '.join(goals)}.

Requirements:
- Dietary preferences: {', '.join(dietary_preferences) if dietary_preferences else 'no restrictions'}
- Allergies: {', '.join(allergies) if allergies else 'none'}
- Include breakfast, lunch, dinner, and snacks
- Provide macro breakdown for each meal
- Include shopping list
- Consider meal prep and cooking time

Format the response as a structured meal plan with daily breakdowns, recipes, and shopping list."""
        
        # Invoke Bedrock
        bedrock_result = bedrock_service.invoke_bedrock(prompt, user_context, max_tokens=2000)
        
        if not bedrock_result['success']:
            return create_error_response(500, 'AI service temporarily unavailable')
        
        # Save meal plan
        plan_id = str(uuid.uuid4())
        await save_ai_generated_plan(user_id, plan_id, 'meal', bedrock_result['response'], {
            'goals': goals,
            'dietaryPreferences': dietary_preferences,
            'allergies': allergies
        })
        
        # Increment usage
        await rate_limiter.increment_usage(user_id, user_tier)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(convert_decimals({
                'planId': plan_id,
                'plan': bedrock_result['response'],
                'tokensUsed': bedrock_result['tokens_used'],
                'remainingRequests': rate_limit_result['remaining'] - 1
            }))
        }
        
    except Exception as e:
        logger.error(f"Error in handle_meal_plan_generation: {e}")
        return create_error_response(500, 'Failed to generate meal plan')

async def handle_progress_analysis(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle progress analysis requests"""
    try:
        time_range = body.get('timeRange', '30 days')
        
        # Check rate limit
        user_tier = await rate_limiter.get_user_tier(user_id)
        rate_limit_result = await rate_limiter.check_limit(user_id, user_tier)
        
        if not rate_limit_result['allowed']:
            return create_error_response(429, 'Rate limit exceeded')
        
        # Get user context
        user_context = await user_data_service.build_user_context(user_id)
        
        # Build analysis prompt
        prompt = f"""Analyze the user's fitness progress over the last {time_range} and provide insights and recommendations.

Focus on:
- Workout consistency and progression
- Body measurements and changes
- Nutrition adherence
- Goal achievement
- Areas for improvement
- Specific recommendations for the next period

Provide actionable insights and celebrate achievements."""
        
        # Invoke Bedrock
        bedrock_result = bedrock_service.invoke_bedrock(prompt, user_context, max_tokens=1500)
        
        if not bedrock_result['success']:
            return create_error_response(500, 'AI service temporarily unavailable')
        
        # Increment usage
        await rate_limiter.increment_usage(user_id, user_tier)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(convert_decimals({
                'analysis': bedrock_result['response'],
                'tokensUsed': bedrock_result['tokens_used'],
                'remainingRequests': rate_limit_result['remaining'] - 1
            }))
        }
        
    except Exception as e:
        logger.error(f"Error in handle_progress_analysis: {e}")
        return create_error_response(500, 'Failed to analyze progress')

async def handle_form_check(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle exercise form check requests"""
    try:
        exercise_name = body.get('exerciseName', '')
        issue_description = body.get('issueDescription', '')
        
        if not exercise_name:
            return create_error_response(400, 'Exercise name is required')
        
        # Check rate limit
        user_tier = await rate_limiter.get_user_tier(user_id)
        rate_limit_result = await rate_limiter.check_limit(user_id, user_tier)
        
        if not rate_limit_result['allowed']:
            return create_error_response(429, 'Rate limit exceeded')
        
        # Get user context
        user_context = await user_data_service.build_user_context(user_id)
        
        # Build form check prompt
        prompt = f"""Provide form tips and corrections for {exercise_name} exercise.

User's concern: {issue_description if issue_description else 'General form check'}

Provide:
- Proper form technique
- Common mistakes to avoid
- Specific cues for this exercise
- Safety considerations
- Progression tips"""
        
        # Invoke Bedrock
        bedrock_result = bedrock_service.invoke_bedrock(prompt, user_context, max_tokens=800)
        
        if not bedrock_result['success']:
            return create_error_response(500, 'AI service temporarily unavailable')
        
        # Increment usage
        await rate_limiter.increment_usage(user_id, user_tier)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(convert_decimals({
                'formTips': bedrock_result['response'],
                'tokensUsed': bedrock_result['tokens_used'],
                'remainingRequests': rate_limit_result['remaining'] - 1
            }))
        }
        
    except Exception as e:
        logger.error(f"Error in handle_form_check: {e}")
        return create_error_response(500, 'Failed to provide form tips')

async def handle_motivation(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle motivation and coaching requests"""
    try:
        context = body.get('context', {})
        
        # Check rate limit
        user_tier = await rate_limiter.get_user_tier(user_id)
        rate_limit_result = await rate_limiter.check_limit(user_id, user_tier)
        
        if not rate_limit_result['allowed']:
            return create_error_response(429, 'Rate limit exceeded')
        
        # Get user context
        user_context = await user_data_service.build_user_context(user_id)
        
        # Build motivation prompt
        prompt = f"""Provide personalized motivation and coaching based on the user's current situation.

Context: {json.dumps(context)}

Provide:
- Encouraging message
- Progress celebration if applicable
- Challenge suggestions
- Mindset tips
- Next steps recommendations"""
        
        # Invoke Bedrock
        bedrock_result = bedrock_service.invoke_bedrock(prompt, user_context, max_tokens=600)
        
        if not bedrock_result['success']:
            return create_error_response(500, 'AI service temporarily unavailable')
        
        # Increment usage
        await rate_limiter.increment_usage(user_id, user_tier)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(convert_decimals({
                'motivation': bedrock_result['response'],
                'tokensUsed': bedrock_result['tokens_used'],
                'remainingRequests': rate_limit_result['remaining'] - 1
            }))
        }
        
    except Exception as e:
        logger.error(f"Error in handle_motivation: {e}")
        return create_error_response(500, 'Failed to provide motivation')

async def handle_get_conversations(user_id: str, path: str) -> Dict[str, Any]:
    """Handle get conversations requests"""
    try:
        logger.info(f"Getting conversations for user: {user_id}, path: {path}")
        
        # Extract conversation ID if present
        conversation_id = None
        if '/conversations/' in path:
            conversation_id = path.split('/conversations/')[-1]
        
        if conversation_id:
            # Get specific conversation
            logger.info(f"Getting specific conversation: {conversation_id}")
            messages = await conversation_service.get_conversation_history(user_id, conversation_id)
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps(convert_decimals({
                    'conversationId': conversation_id,
                    'messages': messages
                }))
            }
        else:
            # Get all conversations
            logger.info(f"Getting all conversations for user: {user_id}")
            conversations = await conversation_service.get_conversations(user_id)
            logger.info(f"Found {len(conversations)} conversations")
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps(convert_decimals(conversations))
            }
        
    except Exception as e:
        logger.error(f"Error in handle_get_conversations: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return create_error_response(500, 'Failed to get conversations')

async def handle_update_conversation_title(user_id: str, path: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle updating conversation title"""
    try:
        logger.info(f"Updating conversation title for user: {user_id}, path: {path}, body: {body}")
        
        # Extract conversation ID from path
        conversation_id = path.split('/conversations/')[-1].split('/')[0]  # Get conversation ID before /title
        title = body.get('title', '').strip()
        
        logger.info(f"Extracted conversation_id: {conversation_id}, title: {title}")
        
        if not conversation_id:
            return create_error_response(400, 'Conversation ID is required')
        
        if not title:
            return create_error_response(400, 'Title is required')
        
        if len(title) > 100:
            return create_error_response(400, 'Title too long (max 100 characters)')
        
        # Update conversation title in DynamoDB
        success = await conversation_service.update_conversation_title(user_id, conversation_id, title)
        
        if not success:
            return create_error_response(500, 'Failed to update conversation title')
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': True,
                'message': 'Conversation title updated successfully'
            })
        }
        
    except Exception as e:
        logger.error(f"Error in handle_update_conversation_title: {e}")
        return create_error_response(500, 'Failed to update conversation title')

async def handle_delete_conversation(user_id: str, path: str) -> Dict[str, Any]:
    """Handle delete conversation requests"""
    try:
        # Extract conversation ID
        conversation_id = path.split('/conversations/')[-1]
        
        if not conversation_id:
            return create_error_response(400, 'Conversation ID is required')
        
        success = await conversation_service.delete_conversation(user_id, conversation_id)
        
        if success:
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'success': True,
                    'message': 'Conversation deleted successfully'
                })
            }
        else:
            return create_error_response(500, 'Failed to delete conversation')
        
    except Exception as e:
        logger.error(f"Error in handle_delete_conversation: {e}")
        return create_error_response(500, 'Failed to delete conversation')

async def handle_get_rate_limit(user_id: str) -> Dict[str, Any]:
    """Handle get rate limit requests"""
    try:
        logger.info(f"Getting rate limit for user: {user_id}")
        
        # Default to free tier if we can't determine user tier
        try:
            user_tier = await rate_limiter.get_user_tier(user_id)
        except Exception as e:
            logger.warning(f"Could not determine user tier for {user_id}, defaulting to free: {e}")
            user_tier = 'free'
        
        rate_limit_result = await rate_limiter.check_limit(user_id, user_tier)
        logger.info(f"Rate limit result for {user_id}: {rate_limit_result}")
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(convert_decimals({
                'requestsUsed': rate_limit_result.get('used', 0),
                'requestsRemaining': rate_limit_result.get('remaining', 10),
                'resetAt': rate_limit_result.get('reset_at', ''),
                'tier': user_tier,
                'limit': rate_limit_result.get('limit', 10)
            }))
        }
        
    except Exception as e:
        logger.error(f"Error in handle_get_rate_limit: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return create_error_response(500, 'Failed to get rate limit')

async def save_ai_generated_plan(user_id: str, plan_id: str, plan_type: str, content: str, metadata: Dict) -> bool:
    """Save AI-generated plan to DynamoDB"""
    try:
        from datetime import datetime, timezone, timedelta
        
        # Calculate TTL (30 days from now)
        ttl = int((datetime.now(timezone.utc) + timedelta(days=30)).timestamp())
        
        item = {
            'PK': f'USER#{user_id}',
            'SK': f'AI_PLAN#{plan_id}',
            'planType': plan_type,
            'content': content,
            'metadata': json.dumps(metadata),
            'generatedAt': datetime.now(timezone.utc).isoformat(),
            'active': True,
            'ttl': ttl
        }
        
        conversation_service.table.put_item(Item=item)
        return True
        
    except Exception as e:
        logger.error(f"Error saving AI plan: {e}")
        return False

async def handle_rag_validation() -> Dict[str, Any]:
    """Handle RAG validation requests"""
    try:
        logger.info("Validating RAG setup...")
        
        validation_results = await rag_service.validate_rag_setup()
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(convert_decimals(validation_results))
        }
        
    except Exception as e:
        logger.error(f"Error in handle_rag_validation: {e}")
        return create_error_response(500, 'Failed to validate RAG setup')

async def handle_rag_stats() -> Dict[str, Any]:
    """Handle RAG statistics requests"""
    try:
        logger.info("Getting RAG stats...")
        
        stats = await rag_service.get_rag_stats()
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(convert_decimals(stats))
        }
        
    except Exception as e:
        logger.error(f"Error in handle_rag_stats: {e}")
        return create_error_response(500, 'Failed to get RAG stats')

async def handle_progress_monitoring(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle manual progress monitoring requests"""
    try:
        logger.info(f"Manual progress monitoring request for user {user_id}")

        # Use the progress monitor service
        monitoring_result = await progress_monitor.monitor_user_progress(user_id)

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(convert_decimals(monitoring_result))
        }

    except Exception as e:
        logger.error(f"Error in handle_progress_monitoring: {e}")
        return create_error_response(500, 'Failed to monitor progress')

async def handle_workout_adaptation(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle workout plan adaptation requests"""
    try:
        logger.info(f"Workout adaptation request for user {user_id}")
        
        current_plan = body.get('workout_plan', {})
        if not current_plan:
            return create_error_response(400, 'Workout plan is required')
        
        # Use the workout adaptation service
        adaptation_result = await workout_adaptation_service.adapt_workout_plan(user_id, current_plan)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(convert_decimals(adaptation_result))
        }
        
    except Exception as e:
        logger.error(f"Error in handle_workout_adaptation: {e}")
        return create_error_response(500, 'Failed to adapt workout plan')

async def handle_exercise_substitution(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle exercise substitution requests"""
    try:
        logger.info(f"Exercise substitution request for user {user_id}")
        
        unavailable_exercises = body.get('unavailable_exercises', [])
        context = body.get('context', {})
        
        if not unavailable_exercises:
            return create_error_response(400, 'Unavailable exercises list is required')
        
        # Use the exercise substitution service
        substitution_result = await exercise_substitution_service.find_exercise_substitutions(
            user_id, unavailable_exercises, context
        )
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(convert_decimals(substitution_result))
        }
        
    except Exception as e:
        logger.error(f"Error in handle_exercise_substitution: {e}")
        return create_error_response(500, 'Failed to find exercise substitutions')

async def handle_injury_risk_assessment(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle injury risk assessment requests"""
    try:
        logger.info(f"Injury risk assessment request for user {user_id}")
        
        workout_plan = body.get('workout_plan', {})
        if not workout_plan:
            return create_error_response(400, 'Workout plan is required')
        
        # Use the workout adaptation service for injury risk assessment
        risk_assessment = await workout_adaptation_service.assess_injury_risk(user_id, workout_plan)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(convert_decimals(risk_assessment))
        }
        
    except Exception as e:
        logger.error(f"Error in handle_injury_risk_assessment: {e}")
        return create_error_response(500, 'Failed to assess injury risk')

async def handle_performance_analysis(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle performance analysis requests"""
    try:
        logger.info(f"Performance analysis request for user {user_id}")
        
        days = body.get('days', 30)
        
        # Use the performance analyzer service
        analysis_result = await performance_analyzer.analyze_performance_trends(user_id, days)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(convert_decimals(analysis_result))
        }
        
    except Exception as e:
        logger.error(f"Error in handle_performance_analysis: {e}")
        return create_error_response(500, 'Failed to analyze performance')

async def handle_anomaly_detection(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle performance anomaly detection requests"""
    try:
        logger.info(f"Anomaly detection request for user {user_id}")
        
        days = body.get('days', 14)
        
        # Use the performance analyzer service
        anomaly_result = await performance_analyzer.detect_performance_anomalies(user_id, days)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(convert_decimals(anomaly_result))
        }
        
    except Exception as e:
        logger.error(f"Error in handle_anomaly_detection: {e}")
        return create_error_response(500, 'Failed to detect anomalies')

async def handle_performance_prediction(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle performance prediction requests"""
    try:
        logger.info(f"Performance prediction request for user {user_id}")
        
        days_ahead = body.get('days_ahead', 30)
        
        # Use the performance analyzer service
        prediction_result = await performance_analyzer.predict_performance_trajectory(user_id, days_ahead)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(convert_decimals(prediction_result))
        }
        
    except Exception as e:
        logger.error(f"Error in handle_performance_prediction: {e}")
        return create_error_response(500, 'Failed to predict performance')

async def handle_nutrition_analysis(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle nutrition adherence analysis requests"""
    try:
        logger.info(f"Nutrition analysis request for user {user_id}")
        
        days = body.get('days', 14)
        
        # Use the nutrition intelligence service
        analysis_result = await nutrition_intelligence.analyze_nutrition_adherence(user_id, days)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(convert_decimals(analysis_result))
        }
        
    except Exception as e:
        logger.error(f"Error in handle_nutrition_analysis: {e}")
        return create_error_response(500, 'Failed to analyze nutrition')

async def handle_nutrition_adjustment(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle nutrition plan adjustment requests"""
    try:
        logger.info(f"Nutrition adjustment request for user {user_id}")
        
        current_plan = body.get('nutrition_plan', {})
        if not current_plan:
            return create_error_response(400, 'Nutrition plan is required')
        
        # Use the nutrition intelligence service
        adjustment_result = await nutrition_intelligence.suggest_nutrition_adjustments(user_id, current_plan)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(convert_decimals(adjustment_result))
        }
        
    except Exception as e:
        logger.error(f"Error in handle_nutrition_adjustment: {e}")
        return create_error_response(500, 'Failed to adjust nutrition plan')

async def handle_food_substitution(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle food substitution requests"""
    try:
        logger.info(f"Food substitution request for user {user_id}")
        
        unavailable_foods = body.get('unavailable_foods', [])
        context = body.get('context', {})
        
        if not unavailable_foods:
            return create_error_response(400, 'Unavailable foods list is required')
        
        # Use the nutrition intelligence service
        substitution_result = await nutrition_intelligence.suggest_food_substitutions(
            user_id, unavailable_foods, context
        )
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(convert_decimals(substitution_result))
        }
        
    except Exception as e:
        logger.error(f"Error in handle_food_substitution: {e}")
        return create_error_response(500, 'Failed to find food substitutions')

async def handle_hydration_analysis(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle hydration pattern analysis requests"""
    try:
        logger.info(f"Hydration analysis request for user {user_id}")
        
        days = body.get('days', 7)
        
        # Use the nutrition intelligence service
        hydration_result = await nutrition_intelligence.analyze_hydration_patterns(user_id, days)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(convert_decimals(hydration_result))
        }
        
    except Exception as e:
        logger.error(f"Error in handle_hydration_analysis: {e}")
        return create_error_response(500, 'Failed to analyze hydration')

async def handle_macro_calculation(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle macro calculation requests"""
    try:
        logger.info(f"Macro calculation request for user {user_id}")
        
        goals = body.get('goals', [])
        current_plan = body.get('current_plan')
        
        if not goals:
            return create_error_response(400, 'Goals are required')
        
        # Use the macro optimizer service
        macro_result = await macro_optimizer.calculate_optimal_macros(user_id, goals, current_plan)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(convert_decimals(macro_result))
        }
        
    except Exception as e:
        logger.error(f"Error in handle_macro_calculation: {e}")
        return create_error_response(500, 'Failed to calculate macros')

async def handle_macro_adjustment(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle macro adjustment requests"""
    try:
        logger.info(f"Macro adjustment request for user {user_id}")
        
        current_plan = body.get('current_plan', {})
        progress_data = body.get('progress_data', {})
        
        if not current_plan:
            return create_error_response(400, 'Current plan is required')
        
        # Use the macro optimizer service
        adjustment_result = await macro_optimizer.adjust_macros_for_progress(user_id, current_plan, progress_data)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(convert_decimals(adjustment_result))
        }
        
    except Exception as e:
        logger.error(f"Error in handle_macro_adjustment: {e}")
        return create_error_response(500, 'Failed to adjust macros')

async def handle_macro_timing(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle macro timing optimization requests"""
    try:
        logger.info(f"Macro timing request for user {user_id}")
        
        macro_plan = body.get('macro_plan', {})
        if not macro_plan:
            return create_error_response(400, 'Macro plan is required')
        
        # Use the macro optimizer service
        timing_result = await macro_optimizer.optimize_macro_timing(user_id, macro_plan)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(convert_decimals(timing_result))
        }
        
    except Exception as e:
        logger.error(f"Error in handle_macro_timing: {e}")
        return create_error_response(500, 'Failed to optimize macro timing')

async def handle_macro_modification(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle macro modification requests"""
    try:
        logger.info(f"Macro modification request for user {user_id}")
        
        current_macros = body.get('current_macros', {})
        issues = body.get('issues', [])
        
        if not current_macros or not issues:
            return create_error_response(400, 'Current macros and issues are required')
        
        # Use the macro optimizer service
        modification_result = await macro_optimizer.suggest_macro_modifications(user_id, current_macros, issues)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(convert_decimals(modification_result))
        }
        
    except Exception as e:
        logger.error(f"Error in handle_macro_modification: {e}")
        return create_error_response(500, 'Failed to suggest macro modifications')

async def handle_meal_schedule(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle meal schedule optimization requests"""
    try:
        logger.info(f"Meal schedule request for user {user_id}")
        
        meal_plan = body.get('meal_plan', {})
        if not meal_plan:
            return create_error_response(400, 'Meal plan is required')
        
        # Use the meal timing service
        schedule_result = await meal_timing_service.optimize_meal_schedule(user_id, meal_plan)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(convert_decimals(schedule_result))
        }
        
    except Exception as e:
        logger.error(f"Error in handle_meal_schedule: {e}")
        return create_error_response(500, 'Failed to optimize meal schedule')

async def handle_pre_workout_nutrition(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle pre-workout nutrition requests"""
    try:
        logger.info(f"Pre-workout nutrition request for user {user_id}")
        
        workout_details = body.get('workout_details', {})
        if not workout_details:
            return create_error_response(400, 'Workout details are required')
        
        # Use the meal timing service
        nutrition_result = await meal_timing_service.suggest_pre_workout_nutrition(user_id, workout_details)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(convert_decimals(nutrition_result))
        }
        
    except Exception as e:
        logger.error(f"Error in handle_pre_workout_nutrition: {e}")
        return create_error_response(500, 'Failed to suggest pre-workout nutrition')

async def handle_post_workout_nutrition(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle post-workout nutrition requests"""
    try:
        logger.info(f"Post-workout nutrition request for user {user_id}")
        
        workout_details = body.get('workout_details', {})
        if not workout_details:
            return create_error_response(400, 'Workout details are required')
        
        # Use the meal timing service
        nutrition_result = await meal_timing_service.suggest_post_workout_nutrition(user_id, workout_details)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(convert_decimals(nutrition_result))
        }
        
    except Exception as e:
        logger.error(f"Error in handle_post_workout_nutrition: {e}")
        return create_error_response(500, 'Failed to suggest post-workout nutrition')

async def handle_meal_timing_analysis(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle meal timing analysis requests"""
    try:
        logger.info(f"Meal timing analysis request for user {user_id}")
        
        days = body.get('days', 14)
        
        # Use the meal timing service
        analysis_result = await meal_timing_service.analyze_meal_timing_patterns(user_id, days)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(convert_decimals(analysis_result))
        }
        
    except Exception as e:
        logger.error(f"Error in handle_meal_timing_analysis: {e}")
        return create_error_response(500, 'Failed to analyze meal timing')

async def handle_intermittent_fasting(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle intermittent fasting requests"""
    try:
        logger.info(f"Intermittent fasting request for user {user_id}")
        
        preferences = body.get('preferences', {})
        
        # Use the meal timing service
        fasting_result = await meal_timing_service.suggest_intermittent_fasting_schedule(user_id, preferences)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(convert_decimals(fasting_result))
        }
        
    except Exception as e:
        logger.error(f"Error in handle_intermittent_fasting: {e}")
        return create_error_response(500, 'Failed to suggest fasting schedule')

# Module 7: Memory & Personalization Handlers

async def handle_memory_storage(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle memory storage requests"""
    try:
        logger.info(f"Memory storage request for user {user_id}")
        
        conversation_data = body.get('conversation_data', {})
        
        # Use the memory service
        storage_result = await memory_service.store_conversation_memory(user_id, conversation_data)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(convert_decimals(storage_result))
        }
        
    except Exception as e:
        logger.error(f"Error in handle_memory_storage: {e}")
        return create_error_response(500, 'Failed to store memory')

async def handle_memory_retrieval(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle memory retrieval requests"""
    try:
        logger.info(f"Memory retrieval request for user {user_id}")
        
        query = body.get('query', '')
        context = body.get('context', {})
        
        if not query:
            return create_error_response(400, 'Query is required')
        
        # Use the memory service
        retrieval_result = await memory_service.retrieve_relevant_memories(user_id, query, context)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(convert_decimals(retrieval_result))
        }
        
    except Exception as e:
        logger.error(f"Error in handle_memory_retrieval: {e}")
        return create_error_response(500, 'Failed to retrieve memories')

async def handle_memory_update(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle memory importance update requests"""
    try:
        logger.info(f"Memory update request for user {user_id}")
        
        memory_id = body.get('memory_id', '')
        importance_score = body.get('importance_score', 0.5)
        
        if not memory_id:
            return create_error_response(400, 'Memory ID is required')
        
        # Use the memory service
        update_result = await memory_service.update_memory_importance(user_id, memory_id, importance_score)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(convert_decimals(update_result))
        }
        
    except Exception as e:
        logger.error(f"Error in handle_memory_update: {e}")
        return create_error_response(500, 'Failed to update memory')

async def handle_memory_cleanup(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle memory cleanup requests"""
    try:
        logger.info(f"Memory cleanup request for user {user_id}")
        
        # Use the memory service
        cleanup_result = await memory_service.cleanup_old_memories(user_id)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(convert_decimals(cleanup_result))
        }
        
    except Exception as e:
        logger.error(f"Error in handle_memory_cleanup: {e}")
        return create_error_response(500, 'Failed to cleanup memories')

async def handle_memory_summary(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle memory summary requests"""
    try:
        logger.info(f"Memory summary request for user {user_id}")
        
        # Use the memory service
        summary_result = await memory_service.get_memory_summary(user_id)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(convert_decimals(summary_result))
        }
        
    except Exception as e:
        logger.error(f"Error in handle_memory_summary: {e}")
        return create_error_response(500, 'Failed to get memory summary')

async def handle_preference_analysis(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle user preference analysis requests"""
    try:
        logger.info(f"Preference analysis request for user {user_id}")
        
        # Use the personalization engine
        analysis_result = await personalization_engine.analyze_user_preferences(user_id)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(convert_decimals(analysis_result))
        }
        
    except Exception as e:
        logger.error(f"Error in handle_preference_analysis: {e}")
        return create_error_response(500, 'Failed to analyze preferences')

async def handle_coaching_style(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle coaching style determination requests"""
    try:
        logger.info(f"Coaching style request for user {user_id}")
        
        context = body.get('context', {})
        
        # Use the personalization engine
        style_result = await personalization_engine.determine_optimal_coaching_style(user_id, context)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(convert_decimals(style_result))
        }
        
    except Exception as e:
        logger.error(f"Error in handle_coaching_style: {e}")
        return create_error_response(500, 'Failed to determine coaching style')

async def handle_message_adaptation(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle message adaptation requests"""
    try:
        logger.info(f"Message adaptation request for user {user_id}")
        
        base_message = body.get('base_message', '')
        coaching_style = body.get('coaching_style', 'motivational')
        context = body.get('context', {})
        
        if not base_message:
            return create_error_response(400, 'Base message is required')
        
        # Use the personalization engine
        adaptation_result = await personalization_engine.adapt_coaching_message(
            user_id, base_message, coaching_style, context
        )
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(convert_decimals(adaptation_result))
        }
        
    except Exception as e:
        logger.error(f"Error in handle_message_adaptation: {e}")
        return create_error_response(500, 'Failed to adapt message')

async def handle_feedback_learning(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle feedback learning requests"""
    try:
        logger.info(f"Feedback learning request for user {user_id}")
        
        feedback_data = body.get('feedback_data', {})
        
        if not feedback_data:
            return create_error_response(400, 'Feedback data is required')
        
        # Use the personalization engine
        learning_result = await personalization_engine.learn_from_user_feedback(user_id, feedback_data)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(convert_decimals(learning_result))
        }
        
    except Exception as e:
        logger.error(f"Error in handle_feedback_learning: {e}")
        return create_error_response(500, 'Failed to learn from feedback')

async def handle_conversation_thread(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle conversation thread requests"""
    try:
        logger.info(f"Conversation thread request for user {user_id}")
        
        conversation_id = body.get('conversation_id', '')
        thread_topic = body.get('thread_topic', '')
        
        if not conversation_id or not thread_topic:
            return create_error_response(400, 'Conversation ID and thread topic are required')
        
        # Use the conversation service
        thread_result = await conversation_service.create_conversation_thread(
            user_id, conversation_id, thread_topic
        )
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(convert_decimals(thread_result))
        }
        
    except Exception as e:
        logger.error(f"Error in handle_conversation_thread: {e}")
        return create_error_response(500, 'Failed to create conversation thread')

async def handle_conversation_summarization(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle conversation summarization requests"""
    try:
        logger.info(f"Conversation summarization request for user {user_id}")
        
        conversation_id = body.get('conversation_id', '')
        
        if not conversation_id:
            return create_error_response(400, 'Conversation ID is required')
        
        # Use the conversation service
        summary_result = await conversation_service.summarize_conversation(user_id, conversation_id)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(convert_decimals(summary_result))
        }
        
    except Exception as e:
        logger.error(f"Error in handle_conversation_summarization: {e}")
        return create_error_response(500, 'Failed to summarize conversation')

async def handle_conversation_analytics(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle conversation analytics requests"""
    try:
        logger.info(f"Conversation analytics request for user {user_id}")
        
        conversation_id = body.get('conversation_id', '')
        
        if not conversation_id:
            return create_error_response(400, 'Conversation ID is required')
        
        # Use the conversation service
        analytics_result = await conversation_service.get_conversation_analytics(user_id, conversation_id)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(convert_decimals(analytics_result))
        }
        
    except Exception as e:
        logger.error(f"Error in handle_conversation_analytics: {e}")
        return create_error_response(500, 'Failed to get conversation analytics')

async def handle_eventbridge_event(event: Dict[str, Any]) -> Dict[str, Any]:
    """Handle EventBridge events for proactive coaching"""
    try:
        logger.info(f"Processing EventBridge event: {event}")
        
        # Extract event details
        event_source = event.get('source', '')
        event_action = event.get('action', '')
        
        # Route to appropriate proactive coaching handler
        if event_source == 'proactive-checkin':
            result = await proactive_coach_service.handle_proactive_checkin(event)
        elif event_source == 'progress-monitor':
            result = await proactive_coach_service.handle_progress_monitoring(event)
        elif event_source == 'plateau-detection':
            result = await proactive_coach_service.handle_plateau_detection(event)
        elif event_source == 'motivation-boost':
            result = await proactive_coach_service.handle_motivation_boost(event)
        elif event_source == 'weekly-review':
            result = await proactive_coach_service.handle_weekly_review(event)
        else:
            logger.warning(f"Unknown EventBridge event source: {event_source}")
            result = {'error': f'Unknown event source: {event_source}'}
        
        # Emit metrics for proactive coaching
        emit_metric('ProactiveCoachingEvents', 1, dimensions={'source': event_source})
        
        logger.info(f"EventBridge event processed successfully: {result}")
        
        return {
            'statusCode': 200,
            'body': json.dumps(convert_decimals(result))
        }
        
    except Exception as e:
        logger.error(f"Error handling EventBridge event: {e}")
        emit_metric('ProactiveCoachingErrors', 1)
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'Internal Server Error',
                'message': 'Failed to process proactive coaching event'
            })
        }

def create_error_response(status_code: int, message: str) -> Dict[str, Any]:
    """Create standardized error response"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({
            'error': 'Error',
            'message': message
            })
        }
