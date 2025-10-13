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
            else:
                return create_error_response(404, 'Endpoint not found')
        
        elif http_method == 'GET':
            if '/conversations' in path:
                return asyncio.run(handle_get_conversations(user_id, path))
            elif '/rate-limit' in path:
                return asyncio.run(handle_get_rate_limit(user_id))
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
        
        # Build AI prompt
        prompt = f"{message}"
        if conversation_context:
            prompt = f"{conversation_context}\n\nUser: {message}"
        
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
                'tier': user_tier
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
