import os
import json
import logging
import time
from typing import Dict, Optional, List
import boto3
from botocore.exceptions import ClientError, BotoCoreError

logger = logging.getLogger(__name__)

class BedrockService:
    """Service for interacting with Amazon Bedrock"""
    
    def __init__(self):
        self.bedrock_runtime = boto3.client('bedrock-runtime', region_name=os.environ.get('AWS_REGION', 'us-east-1'))
        self.model_id = os.environ.get('BEDROCK_MODEL_ID', 'anthropic.claude-3-haiku-20240307-v1:0')
        self.max_retries = 3
        self.retry_delay = 1  # seconds
    
    def invoke_bedrock(self, prompt: str, context: Optional[Dict] = None, max_tokens: int = 1000) -> Dict[str, any]:
        """
        Invoke Bedrock model with prompt and context
        
        Args:
            prompt: The main prompt for the AI
            context: Additional context (user profile, workout history, etc.)
            max_tokens: Maximum tokens to generate
            
        Returns:
            Dict with 'response', 'tokens_used', 'model' keys
        """
        try:
            # Build the full prompt with context
            full_prompt = self._build_prompt(prompt, context)
            
            # Prepare request body based on model
            if 'deepseek' in self.model_id:
                body = self._build_deepseek_request(full_prompt, max_tokens)
            elif 'nova' in self.model_id:
                body = self._build_nova_request(full_prompt, max_tokens)
            elif 'claude-3' in self.model_id:
                body = self._build_claude_3_request(full_prompt, max_tokens)
            else:
                body = self._build_claude_instant_request(full_prompt, max_tokens)
            
            # Retry logic for rate limiting
            for attempt in range(self.max_retries):
                try:
                    response = self.bedrock_runtime.invoke_model(
                        modelId=self.model_id,
                        body=json.dumps(body),
                        contentType='application/json'
                    )
                    
                    logger.info(f"Bedrock response: {response}")
                    logger.info(f"Response body type: {type(response.get('body'))}")
                    
                    if not response or 'body' not in response:
                        raise Exception("Invalid response from Bedrock: missing body")
                    
                    response_body = json.loads(response['body'].read())
                    logger.info(f"Parsed response body: {response_body}")
                    
                    if not response_body:
                        raise Exception("Empty response from Bedrock")
                    
                    if 'deepseek' in self.model_id:
                        if 'choices' not in response_body or not response_body['choices']:
                            raise Exception("Invalid response structure: missing choices")
                        content = response_body['choices'][0]['message']['content']
                        input_tokens = response_body.get('usage', {}).get('prompt_tokens', 0)
                        output_tokens = response_body.get('usage', {}).get('completion_tokens', 0)
                    elif 'nova' in self.model_id:
                        if 'output' not in response_body or 'text' not in response_body['output']:
                            raise Exception("Invalid response structure: missing output.text")
                        content = response_body['output']['text']
                        input_tokens = response_body.get('usage', {}).get('input_tokens', 0)
                        output_tokens = response_body.get('usage', {}).get('output_tokens', 0)
                    elif 'claude-3' in self.model_id:
                        if 'content' not in response_body or not response_body['content']:
                            raise Exception("Invalid response structure: missing content")
                        content = response_body['content'][0]['text']
                        input_tokens = response_body.get('usage', {}).get('input_tokens', 0)
                        output_tokens = response_body.get('usage', {}).get('output_tokens', 0)
                    else:
                        if 'completion' not in response_body:
                            raise Exception("Invalid response structure: missing completion")
                        content = response_body['completion']
                        # Estimate tokens for Claude Instant (rough approximation)
                        input_tokens = len(full_prompt.split()) * 1.3
                        output_tokens = len(content.split()) * 1.3
                    
                    return {
                        'response': content.strip(),
                        'tokens_used': int(input_tokens + output_tokens),
                        'input_tokens': int(input_tokens),
                        'output_tokens': int(output_tokens),
                        'model': self.model_id,
                        'success': True
                    }
                    
                except ClientError as e:
                    error_code = e.response['Error']['Code']
                    
                    if error_code == 'ThrottlingException' and attempt < self.max_retries - 1:
                        logger.warning(f"Rate limited, retrying in {self.retry_delay * (2 ** attempt)} seconds...")
                        time.sleep(self.retry_delay * (2 ** attempt))  # Exponential backoff
                        continue
                    else:
                        logger.error(f"Bedrock invocation failed: {e}")
                        return {
                            'response': 'I apologize, but I\'m experiencing technical difficulties. Please try again later.',
                            'tokens_used': 0,
                            'input_tokens': 0,
                            'output_tokens': 0,
                            'model': self.model_id,
                            'success': False,
                            'error': str(e)
                        }
            
        except Exception as e:
            logger.error(f"Unexpected error in Bedrock invocation: {e}")
            return {
                'response': 'I apologize, but I\'m experiencing technical difficulties. Please try again later.',
                'tokens_used': 0,
                'input_tokens': 0,
                'output_tokens': 0,
                'model': self.model_id,
                'success': False,
                'error': str(e)
            }
    
    def _build_prompt(self, prompt: str, context: Optional[Dict] = None) -> str:
        """Build the full prompt with context"""
        
        system_prompt = """You are an AI fitness coach and trainer. You provide personalized, evidence-based advice on:
- Workout planning and exercise form
- Nutrition and meal planning
- Progress tracking and goal setting
- Motivation and mindset coaching
- Injury prevention and recovery

Guidelines:
- Be encouraging and supportive while maintaining professionalism
- Provide specific, actionable advice
- Consider the user's experience level, goals, and available equipment
- Always prioritize safety and proper form
- Keep responses concise but comprehensive
- Use motivational language when appropriate

Respond in a helpful, friendly tone as a personal trainer would."""
        
        if context:
            context_str = self._format_context(context)
            return f"{system_prompt}\n\nUser Context:\n{context_str}\n\nUser Question/Request:\n{prompt}"
        else:
            return f"{system_prompt}\n\nUser Question/Request:\n{prompt}"
    
    def _format_context(self, context: Dict) -> str:
        """Format context data into a readable string"""
        context_parts = []
        
        if 'user_profile' in context:
            profile = context['user_profile']
            context_parts.append(f"User Profile:")
            context_parts.append(f"- Name: {profile.get('firstName', '')} {profile.get('lastName', '')}")
            context_parts.append(f"- Experience Level: {profile.get('experienceLevel', 'beginner')}")
            context_parts.append(f"- Fitness Goals: {', '.join(profile.get('fitnessGoals', []))}")
            if profile.get('height') and profile.get('weight'):
                context_parts.append(f"- Height: {profile['height']}cm, Weight: {profile['weight']}kg")
        
        if 'ai_preferences' in context:
            prefs = context['ai_preferences']
            context_parts.append(f"AI Trainer Preferences:")
            context_parts.append(f"- Coaching Style: {prefs.get('coachingStyle', 'balanced')}")
            context_parts.append(f"- Focus Areas: {', '.join(prefs.get('focusAreas', []))}")
            context_parts.append(f"- Equipment Available: {', '.join(prefs.get('equipmentAvailable', []))}")
            context_parts.append(f"- Workout Duration: {prefs.get('workoutDurationPreference', 60)} minutes")
            context_parts.append(f"- Days per Week: {prefs.get('workoutDaysPerWeek', 3)}")
            if prefs.get('injuryHistory'):
                context_parts.append(f"- Injury History: {', '.join(prefs['injuryHistory'])}")
        
        if 'recent_workouts' in context:
            workouts = context['recent_workouts']
            context_parts.append(f"Recent Workouts ({len(workouts)} workouts):")
            for workout in workouts[-3:]:  # Last 3 workouts
                context_parts.append(f"- {workout.get('date', 'Unknown date')}: {workout.get('name', 'Workout')}")
        
        if 'nutrition_data' in context:
            nutrition = context['nutrition_data']
            context_parts.append(f"Recent Nutrition:")
            if nutrition.get('dailyGoals'):
                goals = nutrition['dailyGoals']
                context_parts.append(f"- Daily Goals: {goals.get('calories', 0)} cal, {goals.get('protein', 0)}g protein")
        
        return '\n'.join(context_parts)
    
    def _build_deepseek_request(self, prompt: str, max_tokens: int) -> Dict:
        """Build request body for DeepSeek models"""
        return {
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "max_tokens": max_tokens,
            "temperature": 0.7,
            "top_p": 0.9
        }
    
    def _build_nova_request(self, prompt: str, max_tokens: int) -> Dict:
        """Build request body for Amazon Nova models"""
        return {
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "text": prompt
                        }
                    ]
                }
            ],
            "inferenceConfig": {
                "maxTokens": max_tokens,
                "temperature": 0.7,
                "topP": 0.9
            }
        }
    
    def _build_claude_3_request(self, prompt: str, max_tokens: int) -> Dict:
        """Build request body for Claude 3 models"""
        return {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": max_tokens,
            "temperature": 0.7,
            "top_p": 0.9,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        }
    
    def _build_claude_instant_request(self, prompt: str, max_tokens: int) -> Dict:
        """Build request body for Claude Instant models"""
        return {
            "prompt": f"\n\nHuman: {prompt}\n\nAssistant:",
            "max_tokens_to_sample": max_tokens,
            "temperature": 0.7,
            "top_p": 0.9,
            "stop_sequences": ["\n\nHuman:"]
        }
    
    def estimate_tokens(self, text: str) -> int:
        """Estimate token count for text (rough approximation)"""
        return int(len(text.split()) * 1.3)
    
    def get_model_info(self) -> Dict[str, str]:
        """Get information about the current model"""
        return {
            'model_id': self.model_id,
            'model_name': self.model_id.split('/')[-1] if '/' in self.model_id else self.model_id,
            'region': os.environ.get('AWS_REGION', 'us-east-1')
        }
