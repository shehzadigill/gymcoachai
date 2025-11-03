import os
import json
import logging
import time
from typing import Dict, Optional, List
import boto3
from botocore.exceptions import ClientError, BotoCoreError

logger = logging.getLogger(__name__)

class BedrockService:
    """Service for interacting with Amazon Bedrock with intelligent caching"""
    
    def __init__(self, cache_service=None):
        self.bedrock_runtime = boto3.client('bedrock-runtime', region_name=os.environ.get('AWS_REGION', 'eu-west-1'))
        # Claude 3 Haiku - well-supported, reliable model in eu-west-1
        # Cost: ~$0.00025/1K input tokens, ~$0.00125/1K output tokens
        # Native support in eu-west-1 with on-demand throughput
        self.model_id = os.environ.get('BEDROCK_MODEL_ID', 'anthropic.claude-3-haiku-20240307-v1:0')
        self.max_retries = 3
        self.retry_delay = 1  # seconds
        
        # Cache service integration
        self.cache_service = cache_service
        self.cache_enabled = os.environ.get('CACHE_ENABLED', 'true').lower() == 'true'
    
    async def invoke_bedrock_with_cache(self, 
                                       prompt: str, 
                                       context: Optional[Dict] = None, 
                                       max_tokens: int = 1000,
                                       endpoint_type: str = 'chat',
                                       user_id: str = None,
                                       bypass_cache: bool = False) -> Dict[str, any]:
        """
        Invoke Bedrock model with intelligent caching
        
        Args:
            prompt: The main prompt for the AI
            context: Additional context (user profile, workout history, etc.)
            max_tokens: Maximum tokens to generate
            endpoint_type: Type of endpoint for cache TTL
            user_id: User ID for cache key generation
            bypass_cache: Force bypass cache and call Bedrock directly
            
        Returns:
            Dict with 'response', 'tokens_used', 'model', 'cached' keys
        """
        # If cache is enabled and we have a cache service and user_id, try cache first
        if self.cache_enabled and self.cache_service and user_id and not bypass_cache:
            try:
                # Generate cache key
                cache_key = self.cache_service.generate_cache_key(
                    user_id=user_id,
                    prompt=prompt,
                    context=context or {},
                    endpoint_type=endpoint_type,
                    model_id=self.model_id
                )
                
                # Try to get cached response
                cached_response = await self.cache_service.get_cached_response(
                    cache_key=cache_key,
                    user_id=user_id,
                    endpoint_type=endpoint_type
                )
                
                if cached_response:
                    logger.info(f"✓ Cache HIT for {endpoint_type} (source: {cached_response.get('cache_source')})")
                    return cached_response
                
                logger.info(f"✗ Cache MISS for {endpoint_type}, calling Bedrock...")
                
            except Exception as e:
                logger.error(f"Cache error (falling back to Bedrock): {e}")
        
        # Cache miss or disabled - call Bedrock
        bedrock_result = self.invoke_bedrock(prompt, context, max_tokens)
        
        # Cache the response if successful
        if (self.cache_enabled and 
            self.cache_service and 
            user_id and 
            bedrock_result.get('success')):
            try:
                cache_key = self.cache_service.generate_cache_key(
                    user_id=user_id,
                    prompt=prompt,
                    context=context or {},
                    endpoint_type=endpoint_type,
                    model_id=self.model_id
                )
                
                await self.cache_service.cache_response(
                    cache_key=cache_key,
                    user_id=user_id,
                    endpoint_type=endpoint_type,
                    prompt=prompt,
                    response=bedrock_result['response'],
                    tokens={
                        'input': bedrock_result['input_tokens'],
                        'output': bedrock_result['output_tokens'],
                        'total': bedrock_result['tokens_used']
                    },
                    model=self.model_id,
                    metadata={
                        'max_tokens': max_tokens,
                        'context_keys': list(context.keys()) if context else []
                    }
                )
                
                logger.info(f"✓ Cached response for {endpoint_type}")
                
            except Exception as e:
                logger.error(f"Failed to cache response: {e}")
        
        # Mark as not cached
        bedrock_result['cached'] = False
        bedrock_result['cache_source'] = 'bedrock'
        
        return bedrock_result
    
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

CRITICAL: You will receive detailed user context below including their profile, goals, preferences, equipment, workout history, and measurements. ALWAYS use this information to personalize your responses. DO NOT ask the user for information that is already provided in their context. Reference their specific goals, experience level, and available equipment in your recommendations.

Respond in a helpful, friendly tone as a personal trainer would."""
        
        if context:
            # Log the context to debug
            logger.info(f"Building prompt with context keys: {context.keys()}")
            logger.info(f"Context user_profile: {context.get('user_profile', 'NOT FOUND')}")
            logger.info(f"Context ai_preferences: {context.get('ai_preferences', 'NOT FOUND')}")
            
            # Try enhanced context formatting first, fallback to basic formatting
            if any(key in context for key in ['user_profile', 'fitness_analysis', 'nutrition_analysis', 'progress_summary']):
                if 'fitness_analysis' in context or 'nutrition_analysis' in context or 'progress_summary' in context:
                    context_str = self._format_enhanced_context(context)
                else:
                    # Use regular formatting for user_profile
                    context_str = self._format_context(context)
            else:
                logger.warning(f"Context missing expected keys. Available keys: {context.keys()}")
                context_str = self._format_context(context)
            
            logger.info(f"Formatted context length: {len(context_str)} characters")
            
            # Add context with explicit reminder to use it
            return f"""{system_prompt}

=== USER CONTEXT ===
{context_str}

=== IMPORTANT ===
Use the above user context to provide PERSONALIZED advice. The user has already shared their profile, goals, equipment, and preferences. Do not ask them to repeat this information.

User Question/Request:
{prompt}"""
        else:
            logger.warning("No context provided to _build_prompt")
            return f"{system_prompt}\n\nUser Question/Request:\n{prompt}"
    
    def _format_context(self, context: Dict) -> str:
        """Format context data into a readable string"""
        logger.info(f"_format_context called with keys: {context.keys()}")
        
        context_parts = []
        
        # USER PROFILE - Enhanced with more details
        if 'user_profile' in context:
            profile = context['user_profile']
            logger.info(f"Formatting user_profile: {profile}")
            context_parts.append("=== USER PROFILE ===")
            
            # Basic Information
            name = f"{profile.get('firstName', '')} {profile.get('lastName', '')}".strip()
            if name:
                context_parts.append(f"Name: {name}")
            
            if profile.get('age'):
                context_parts.append(f"Age: {profile['age']} years")
            
            if profile.get('gender'):
                context_parts.append(f"Gender: {profile['gender']}")
            
            if profile.get('experienceLevel'):
                context_parts.append(f"Experience Level: {profile['experienceLevel']}")
            
            # Physical Stats
            if profile.get('height') and profile.get('weight'):
                bmi = None
                try:
                    height_m = float(profile['height']) / 100
                    weight_kg = float(profile['weight'])
                    bmi = weight_kg / (height_m * height_m)
                    context_parts.append(f"Physical Stats: {profile['height']}cm, {profile['weight']}kg (BMI: {bmi:.1f})")
                except:
                    context_parts.append(f"Physical Stats: {profile['height']}cm, {profile['weight']}kg")
            
            # Fitness Goals - Primary motivation
            if profile.get('fitnessGoals') and len(profile.get('fitnessGoals', [])) > 0:
                goals = profile['fitnessGoals']
                context_parts.append(f"Primary Fitness Goals: {', '.join(goals)}")
                context_parts.append(f"  → This user wants to focus on: {goals[0]}")
            
            # Target metrics
            if profile.get('targetWeight'):
                context_parts.append(f"Target Weight Goal: {profile['targetWeight']}kg")
            
            if profile.get('targetBodyFat'):
                context_parts.append(f"Target Body Fat Goal: {profile['targetBodyFat']}%")
        
        # USER PREFERENCES - Enhanced AI Trainer specific settings
        if 'user_preferences' in context:
            prefs = context['user_preferences']
            context_parts.append("\n=== USER PREFERENCES ===")
            
            # Language preference
            if prefs.get('language'):
                context_parts.append(f"Preferred Language: {prefs['language']}")
            
            # Units preference
            if prefs.get('units'):
                context_parts.append(f"Unit System: {prefs['units']}")
        
        # AI TRAINER PREFERENCES - Coaching style and personalization
        if 'ai_preferences' in context:
            prefs = context['ai_preferences']
            # Handle case where ai_preferences might be a JSON string
            if isinstance(prefs, str):
                import json
                try:
                    prefs = json.loads(prefs)
                except:
                    logger.error(f"Failed to parse ai_preferences JSON string: {prefs}")
                    prefs = {}
            
            context_parts.append("\n=== AI TRAINER PREFERENCES ===")
            
            # Coaching style - CRITICAL for personalization
            coaching_style = prefs.get('coachingStyle', 'balanced') if isinstance(prefs, dict) else 'balanced'
            context_parts.append(f"Preferred Coaching Style: {coaching_style}")
            
            coaching_style_guide = {
                'motivational': '→ Use highly encouraging, energetic language with lots of positive reinforcement',
                'analytical': '→ Focus on data, metrics, and scientific explanations',
                'balanced': '→ Mix motivation with practical advice and data insights',
                'gentle': '→ Use supportive, non-judgmental tone with gradual progression',
                'direct': '→ Be straightforward and efficient with clear instructions'
            }
            if coaching_style in coaching_style_guide:
                context_parts.append(f"  {coaching_style_guide[coaching_style]}")
            
            # Only process if prefs is a dict
            if isinstance(prefs, dict):
                # Focus areas
                if prefs.get('focusAreas') and len(prefs.get('focusAreas', [])) > 0:
                    context_parts.append(f"Primary Focus Areas: {', '.join(prefs['focusAreas'])}")
                
                # Equipment and constraints
                if prefs.get('equipmentAvailable') and len(prefs.get('equipmentAvailable', [])) > 0:
                    context_parts.append(f"Available Equipment: {', '.join(prefs['equipmentAvailable'])}")
                else:
                    context_parts.append(f"Available Equipment: Bodyweight only (no equipment)")
                
                # Workout preferences
                if prefs.get('workoutDurationPreference'):
                    context_parts.append(f"Preferred Workout Duration: {prefs['workoutDurationPreference']} minutes")
                
                if prefs.get('workoutDaysPerWeek'):
                    context_parts.append(f"Workout Frequency: {prefs['workoutDaysPerWeek']} days per week")
                
                if prefs.get('preferredWorkoutTime'):
                    context_parts.append(f"Preferred Workout Time: {prefs['preferredWorkoutTime']}")
                
                # Injury history and limitations - IMPORTANT for safety
                if prefs.get('injuryHistory') and len(prefs.get('injuryHistory', [])) > 0:
                    context_parts.append(f"⚠️ Injury History: {', '.join(prefs['injuryHistory'])}")
                    context_parts.append(f"  → IMPORTANT: Provide modifications and avoid exercises that stress these areas")
                
                if prefs.get('physicalLimitations') and len(prefs.get('physicalLimitations', [])) > 0:
                    context_parts.append(f"⚠️ Physical Limitations: {', '.join(prefs['physicalLimitations'])}")
        
        # DAILY GOALS - Current targets
        if 'daily_goals' in context:
            goals = context['daily_goals']
            context_parts.append("\n=== DAILY GOALS ===")
            
            if goals.get('calories'):
                context_parts.append(f"Calorie Target: {goals['calories']} cal/day")
            
            if goals.get('protein'):
                context_parts.append(f"Protein Target: {goals['protein']}g/day")
            
            if goals.get('carbs'):
                context_parts.append(f"Carbohydrates Target: {goals['carbs']}g/day")
            
            if goals.get('fat'):
                context_parts.append(f"Fat Target: {goals['fat']}g/day")
            
            if goals.get('water'):
                context_parts.append(f"Water Target: {goals['water']}L/day")
            
            if goals.get('steps'):
                context_parts.append(f"Steps Target: {goals['steps']:,} steps/day")
            
            if goals.get('workouts'):
                context_parts.append(f"Workout Sessions Target: {goals['workouts']} per week")
        
        # RECENT WORKOUTS - Activity history
        if 'recent_workouts' in context:
            workouts = context['recent_workouts']
            if len(workouts) > 0:
                context_parts.append(f"\n=== RECENT WORKOUT ACTIVITY ({len(workouts)} sessions) ===")
                for workout in workouts[:5]:  # Last 5 workouts
                    workout_name = workout.get('name', 'Workout')
                    workout_date = workout.get('date', 'Unknown date')
                    workout_duration = workout.get('duration', 0)
                    exercise_count = len(workout.get('exercises', []))
                    
                    context_parts.append(f"• {workout_date}: {workout_name}")
                    if workout_duration:
                        context_parts.append(f"  Duration: {workout_duration} min, {exercise_count} exercises")
            else:
                context_parts.append(f"\n=== RECENT WORKOUT ACTIVITY ===")
                context_parts.append("No recent workout sessions recorded")
                context_parts.append("  → This user may be just starting out or returning after a break")
        
        # BODY MEASUREMENTS - Progress tracking
        if 'body_measurements' in context:
            measurements = context['body_measurements']
            if len(measurements) > 0:
                context_parts.append(f"\n=== BODY MEASUREMENTS ===")
                latest = measurements[0]
                context_parts.append(f"Latest Measurement ({latest.get('date', 'Recent')}):")
                if latest.get('weight'):
                    context_parts.append(f"  Weight: {latest['weight']}kg")
                if latest.get('bodyFat'):
                    context_parts.append(f"  Body Fat: {latest['bodyFat']}%")
                if latest.get('muscleMass'):
                    context_parts.append(f"  Muscle Mass: {latest['muscleMass']}kg")
                
                # Show trend if multiple measurements
                if len(measurements) > 1:
                    older = measurements[-1]
                    if latest.get('weight') and older.get('weight'):
                        weight_change = latest['weight'] - older['weight']
                        context_parts.append(f"  Weight Trend: {'+' if weight_change > 0 else ''}{weight_change:.1f}kg")
        
        # NUTRITION DATA - Eating patterns
        if 'nutrition_data' in context:
            nutrition = context['nutrition_data']
            
            if nutrition.get('dailyGoals'):
                daily_goals = nutrition['dailyGoals']
                # Only add nutrition section if we have valid goals
                if daily_goals.get('calories') or daily_goals.get('protein'):
                    context_parts.append(f"\n=== NUTRITION TARGETS ===")
                    if daily_goals.get('calories'):
                        context_parts.append(f"Daily Calorie Goal: {daily_goals['calories']} cal")
                    if daily_goals.get('protein'):
                        context_parts.append(f"Daily Protein Goal: {daily_goals['protein']}g")
                    if daily_goals.get('carbs'):
                        context_parts.append(f"Daily Carbs Goal: {daily_goals['carbs']}g")
                    if daily_goals.get('fat'):
                        context_parts.append(f"Daily Fat Goal: {daily_goals['fat']}g")
            
            # Recent meals summary
            if nutrition.get('meals') and len(nutrition.get('meals', [])) > 0:
                meals = nutrition['meals']
                context_parts.append(f"Recent Meals: {len(meals)} meals logged")
        
        # Add a summary line to guide the AI
        context_parts.append("\n=== COACHING INSTRUCTIONS ===")
        context_parts.append("Based on the above context, personalize your response to match:")
        context_parts.append("1. The user's experience level and current fitness state")
        context_parts.append("2. Their specific goals and preferences")
        context_parts.append("3. Their preferred coaching style and communication approach")
        context_parts.append("4. Any limitations, injuries, or equipment constraints")
        context_parts.append("5. Their current progress and recent activity patterns")
        
        return '\n'.join(context_parts)
    
    def _format_enhanced_context(self, context: Dict) -> str:
        """Format enhanced context data from context builder into a readable string"""
        context_parts = []
        
        # User Profile Context
        if 'user_profile' in context:
            profile = context['user_profile']
            context_parts.append("=== USER PROFILE ===")
            
            basic_info = profile.get('basic_info', {})
            if basic_info.get('name'):
                context_parts.append(f"Name: {basic_info['name']}")
            if basic_info.get('age'):
                context_parts.append(f"Age: {basic_info['age']}")
            if basic_info.get('experience_level'):
                context_parts.append(f"Experience Level: {basic_info['experience_level']}")
            if basic_info.get('height') and basic_info.get('weight'):
                context_parts.append(f"Physical Stats: {basic_info['height']}cm, {basic_info['weight']}kg")
            
            goals = profile.get('goals', {})
            if goals.get('primary_goals'):
                context_parts.append(f"Primary Goals: {', '.join(goals['primary_goals'])}")
            if goals.get('target_weight'):
                context_parts.append(f"Target Weight: {goals['target_weight']}kg")
            if goals.get('timeline'):
                context_parts.append(f"Goal Timeline: {goals['timeline']}")
            
            preferences = profile.get('preferences', {})
            if preferences.get('equipment_available'):
                context_parts.append(f"Available Equipment: {', '.join(preferences['equipment_available'])}")
            if preferences.get('workout_duration'):
                context_parts.append(f"Preferred Workout Duration: {preferences['workout_duration']} minutes")
            if preferences.get('workout_days_per_week'):
                context_parts.append(f"Workout Days per Week: {preferences['workout_days_per_week']}")
        
        # Fitness Analysis Context
        if 'fitness_analysis' in context:
            fitness = context['fitness_analysis']
            context_parts.append("\n=== FITNESS ANALYSIS ===")
            
            if 'workout_frequency' in fitness:
                freq = fitness['workout_frequency']
                context_parts.append(f"Workout Frequency: {freq.get('avg_per_week', 0):.1f} workouts/week")
                context_parts.append(f"Consistency Score: {freq.get('consistency_score', 0):.2f}")
            
            if 'exercise_preferences' in fitness:
                exercises = fitness['exercise_preferences']
                if exercises.get('top_exercises'):
                    top_exercises = list(exercises['top_exercises'].keys())[:3]
                    context_parts.append(f"Favorite Exercises: {', '.join(top_exercises)}")
                if exercises.get('top_muscle_groups'):
                    top_muscles = list(exercises['top_muscle_groups'].keys())[:3]
                    context_parts.append(f"Focus Areas: {', '.join(top_muscles)}")
            
            if 'strength_progression' in fitness:
                progression = fitness['strength_progression']
                if progression.get('overall_trend'):
                    context_parts.append(f"Strength Trend: {progression['overall_trend']}")
        
        # Nutrition Analysis Context
        if 'nutrition_analysis' in context:
            nutrition = context['nutrition_analysis']
            context_parts.append("\n=== NUTRITION ANALYSIS ===")
            
            if 'macro_adherence' in nutrition:
                macros = nutrition['macro_adherence']
                if macros.get('avg_adherence'):
                    context_parts.append(f"Goal Adherence: {macros['avg_adherence']:.1%}")
            
            if 'calorie_consistency' in nutrition:
                calories = nutrition['calorie_consistency']
                if calories.get('avg_calories'):
                    context_parts.append(f"Average Daily Calories: {calories['avg_calories']:.0f}")
                if calories.get('consistency_score'):
                    context_parts.append(f"Calorie Consistency: {calories['consistency_score']:.2f}")
        
        # Progress Summary Context
        if 'progress_summary' in context:
            progress = context['progress_summary']
            context_parts.append("\n=== PROGRESS SUMMARY ===")
            
            recent_activity = progress.get('recent_activity', {})
            if recent_activity.get('workouts_last_week'):
                context_parts.append(f"Workouts This Week: {recent_activity['workouts_last_week']}")
            if recent_activity.get('current_streak'):
                context_parts.append(f"Current Streak: {recent_activity['current_streak']} days")
            
            body_changes = progress.get('body_changes', {})
            if body_changes.get('weight_change'):
                weight_change = body_changes['weight_change']
                context_parts.append(f"Weight Change: {weight_change:.1f}kg ({body_changes.get('weight_change_percent', 0):.1f}%)")
            
            achievements = progress.get('achievements', [])
            if achievements:
                context_parts.append(f"Recent Achievements: {', '.join(achievements[:2])}")
        
        # Coaching Preferences Context
        if 'coaching_preferences' in context:
            coaching = context['coaching_preferences']
            context_parts.append("\n=== COACHING PREFERENCES ===")
            
            if coaching.get('coaching_style'):
                context_parts.append(f"Preferred Style: {coaching['coaching_style']}")
            if coaching.get('communication_tone'):
                context_parts.append(f"Communication Tone: {coaching['communication_tone']}")
            if coaching.get('motivation_level'):
                context_parts.append(f"Motivation Level: {coaching['motivation_level']}")
            if coaching.get('focus_areas'):
                context_parts.append(f"Focus Areas: {', '.join(coaching['focus_areas'])}")
        
        # Recommendations Context
        if 'recommendations_context' in context:
            recommendations = context['recommendations_context']
            context_parts.append("\n=== RECOMMENDATIONS CONTEXT ===")
            
            if recommendations.get('current_challenges'):
                challenges = recommendations['current_challenges']
                if challenges:
                    context_parts.append(f"Current Challenges: {', '.join(challenges[:2])}")
            
            if recommendations.get('improvement_opportunities'):
                opportunities = recommendations['improvement_opportunities']
                if opportunities:
                    context_parts.append(f"Improvement Areas: {', '.join(opportunities[:2])}")
            
            if recommendations.get('risk_factors'):
                risks = recommendations['risk_factors']
                if risks:
                    context_parts.append(f"Risk Factors: {', '.join(risks[:2])}")
        
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
