"""
AI Workout Plan Generator Service

This service handles the complete workflow for creating AI-powered workout plans:
1. Multi-turn conversation to gather user requirements
2. Intelligent exercise lookup and matching
3. Structured plan generation with proper database schema
4. Smart exercise creation when needed
5. Preview generation before database commit
6. Integration with workout service API
"""

import json
import logging
import uuid
import os
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timezone, timedelta
import asyncio
import boto3
from decimal import Decimal

from bedrock_service import BedrockService
from user_data_service import UserDataService
from cache_service import CacheService

logger = logging.getLogger(__name__)

# DynamoDB Configuration
TABLE_NAME = os.environ.get('DYNAMODB_TABLE', 'gymcoach-ai-main')


class WorkoutPlanGenerator:
    """Service for generating AI-powered workout plans with database integration"""
    
    def __init__(self):
        self.bedrock_service = BedrockService()
        self.user_data_service = UserDataService(TABLE_NAME)
        self.cache_service = CacheService(TABLE_NAME)
        self.dynamodb = boto3.resource('dynamodb')
        self.table = self.dynamodb.Table(TABLE_NAME)
        
        # Conversation states for multi-turn flow (in-memory for local dev)
        self.conversation_states = {}
        
        # Check if we're in local development mode
        self.is_local = os.environ.get('AWS_EXECUTION_ENV') is None
        
        # Exercise categories and muscle groups for validation
        self.valid_categories = ['strength', 'cardio', 'flexibility', 'sports']
        self.valid_muscle_groups = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core']
        self.valid_difficulties = ['beginner', 'intermediate', 'advanced']
    
    def _strip_reasoning_tags(self, text: str) -> str:
        """
        Remove <reasoning> tags and their content from AI responses
        Handles both standalone tags and tags embedded within JSON strings
        
        Args:
            text: The text to clean
            
        Returns:
            Cleaned text without reasoning tags
        """
        import re
        # Remove <reasoning>...</reasoning> tags and their content (non-greedy)
        cleaned = re.sub(r'<reasoning>.*?</reasoning>', '', text, flags=re.DOTALL | re.IGNORECASE)
        # Remove any standalone opening or closing tags
        cleaned = re.sub(r'</?reasoning[^>]*>', '', cleaned, flags=re.IGNORECASE)
        # Clean up artifacts: empty quotes, multiple spaces
        cleaned = re.sub(r'"\s*"', '""', cleaned)  # Fix empty strings from tag removal
        cleaned = re.sub(r'\s+', ' ', cleaned)  # Normalize whitespace
        cleaned = re.sub(r'\n\s*\n', '\n', cleaned)  # Remove extra newlines
        cleaned = cleaned.strip()
        return cleaned
    
    def _clean_for_json_parsing(self, response: str) -> str:
        """
        Aggressively clean AI response to extract valid JSON
        Removes reasoning tags, markdown, and finds JSON boundaries
        
        Args:
            response: Raw AI response
            
        Returns:
            Cleaned text ready for JSON parsing
        """
        import re
        
        # Step 1: Remove reasoning tags
        cleaned = self._strip_reasoning_tags(response)
        
        # Step 2: Remove markdown code fences
        cleaned = re.sub(r'```json\s*', '', cleaned)
        cleaned = re.sub(r'```\s*', '', cleaned)
        
        # Step 3: Remove any text before the first {
        first_brace = cleaned.find('{')
        if first_brace > 0:
            # Log what we're removing
            removed = cleaned[:first_brace]
            if removed.strip():
                logger.debug(f"Removing prefix before JSON: {removed[:100]}")
            cleaned = cleaned[first_brace:]
        
        # Step 4: Find the last closing brace and remove anything after
        last_brace = cleaned.rfind('}')
        if last_brace > 0 and last_brace < len(cleaned) - 1:
            removed = cleaned[last_brace + 1:]
            if removed.strip():
                logger.debug(f"Removing suffix after JSON: {removed[:100]}")
            cleaned = cleaned[:last_brace + 1]
        
        return cleaned.strip()
    
    def _clean_plan_recursively(self, obj):
        """Recursively clean reasoning tags from all string values in a nested structure"""
        if isinstance(obj, dict):
            return {key: self._clean_plan_recursively(value) for key, value in obj.items()}
        elif isinstance(obj, list):
            return [self._clean_plan_recursively(item) for item in obj]
        elif isinstance(obj, str):
            return self._strip_reasoning_tags(obj)
        else:
            return obj
        
    async def start_plan_creation_conversation(self, user_id: str, initial_message: str, 
                                               conversation_id: str) -> Dict[str, Any]:
        """
        Start a multi-turn conversation for workout plan creation
        
        Args:
            user_id: User ID
            initial_message: User's initial request
            conversation_id: Conversation ID for tracking
            
        Returns:
            Response with questions or generated plan
        """
        try:
            # Get user context
            user_context = await self.user_data_service.build_user_context(user_id)
            
            # Initialize or retrieve conversation state from DynamoDB
            state = await self._load_conversation_state(user_id, conversation_id)
            state['messages'].append({'role': 'user', 'content': initial_message})
            
            # Determine what information we need
            requirements = state['requirements']
            
            # Pre-fill from user profile if available and not already set
            if 'experience_level' not in requirements and user_context.get('experienceLevel'):
                requirements['experience_level'] = user_context.get('experienceLevel').lower()
                logger.info(f"Pre-filled experience_level from profile: {requirements['experience_level']}")
            
            if 'available_equipment' not in requirements and user_context.get('equipmentAvailable'):
                requirements['available_equipment'] = user_context.get('equipmentAvailable')
                logger.info(f"Pre-filled equipment from profile: {requirements['available_equipment']}")
            
            # Infer primary goal from user's fitness goals if available
            if 'primary_fitness_goal' not in requirements and user_context.get('fitnessGoals'):
                goals = user_context.get('fitnessGoals', [])
                # Map common goal phrases to our standard format
                goal_mapping = {
                    'lose weight': 'lose_weight',
                    'weight loss': 'lose_weight',
                    'build muscle': 'build_muscle',
                    'muscle gain': 'build_muscle',
                    'gain muscle': 'build_muscle',
                    'improve endurance': 'improve_endurance',
                    'increase strength': 'increase_strength',
                    'get stronger': 'increase_strength',
                    'general fitness': 'general_fitness',
                    'stay fit': 'general_fitness'
                }
                for goal in goals:
                    goal_lower = goal.lower()
                    if goal_lower in goal_mapping:
                        requirements['primary_fitness_goal'] = goal_mapping[goal_lower]
                        logger.info(f"Pre-filled primary_fitness_goal from profile: {requirements['primary_fitness_goal']}")
                        break
            
            # Suggest defaults based on experience level if not provided
            if 'workout_duration' not in requirements and requirements.get('experience_level'):
                exp_level = requirements['experience_level']
                default_durations = {
                    'beginner': 40,
                    'intermediate': 60,
                    'advanced': 75
                }
                suggested_duration = default_durations.get(exp_level, 45)
                logger.info(f"Suggested workout_duration based on {exp_level}: {suggested_duration} mins")
            
            if 'frequency_per_week' not in requirements and requirements.get('experience_level'):
                exp_level = requirements['experience_level']
                default_frequencies = {
                    'beginner': 3,
                    'intermediate': 4,
                    'advanced': 5
                }
                suggested_frequency = default_frequencies.get(exp_level, 4)
                logger.info(f"Suggested frequency_per_week based on {exp_level}: {suggested_frequency} days")
            
            # Extract information from user message using AI
            extraction_prompt = f"""CRITICAL: You MUST respond with ONLY a JSON object. NO reasoning tags, NO explanations, NO extra text. Just pure JSON.

Analyze this user message about creating a workout plan and extract specific information:

User message: "{initial_message}"

Current conversation history:
{json.dumps(state['messages'][-3:], indent=2) if len(state['messages']) > 1 else 'First message'}

User profile context (use this to fill in missing info):
- Experience level: {user_context.get('experienceLevel', 'beginner')}
- Current goals: {user_context.get('fitnessGoals', [])}
- Available equipment: {user_context.get('equipmentAvailable', [])}
- Age: {user_context.get('age', 'unknown')}
- Gender: {user_context.get('gender', 'unknown')}

Already gathered requirements:
{json.dumps(requirements, indent=2)}

Extract ALL information mentioned in the user message. Look for:
- Keywords like "lose weight", "build muscle", "cardio", "strength"
- Numbers for duration (e.g., "40 mins", "1 hour"), frequency (e.g., "4 days", "5 times a week"), program length (e.g., "8 weeks", "one month")
- Experience level indicators (e.g., "beginner", "new to working out", "experienced")
- Equipment mentions (e.g., "dumbbells", "bodyweight", "gym access")

IMPORTANT: 
- If user says "lose weight" or "loose weight" → primary_fitness_goal: "lose_weight"
- If user says "X days" or "X times per week" → frequency_per_week: X
- If user says "X mins" or "X minutes" → workout_duration: X
- If user says "X weeks" or "X month" → program_duration: X (convert months to weeks: 1 month = 4 weeks)
- If user says "beginner", "new", "starting out" → experience_level: "beginner"
- If user mentions "cardio and strength" → workout_style: "strength_training"

OUTPUT FORMAT:
Return ONLY a valid JSON object with these exact fields. Use null ONLY if the field is truly not mentioned:
{{
  "primary_fitness_goal": "lose_weight" | "build_muscle" | "improve_endurance" | "increase_strength" | "general_fitness" | null,
  "workout_duration": 30 | 40 | 45 | 60 | 90 | null,
  "frequency_per_week": 3 | 4 | 5 | 6 | null,
  "program_duration": 4 | 8 | 12 | null,
  "experience_level": "beginner" | "intermediate" | "advanced" | null,
  "available_equipment": ["dumbbell", "barbell"] | null,
  "muscle_groups": ["chest", "back"] | null,
  "injuries": ["knee"] | null,
  "workout_style": "strength_training" | "hiit" | "circuit" | "powerlifting" | "bodybuilding" | "crossfit" | null
}}

CRITICAL INSTRUCTIONS:
- Output ONLY the JSON object above
- NO explanations, reasoning, or extra text before or after the JSON
- NO markdown formatting or code fences
- Must be valid, parseable JSON"""
            
            extraction_result = await self.bedrock_service.invoke_bedrock_with_cache(
                prompt=extraction_prompt,
                context=user_context,
                max_tokens=1000,  # Increased to handle reasoning if it still appears
                endpoint_type='workout-plan-extraction',
                user_id=user_id
            )
            
            # Parse extracted requirements
            try:
                # Extract clean JSON from response
                response_text = extraction_result['response'].strip()
                logger.info(f"Raw extraction response (first 300 chars): {response_text[:300]}")
                
                # Clean the response aggressively before parsing
                cleaned_response = self._clean_for_json_parsing(response_text)
                logger.info(f"Cleaned response (first 300 chars): {cleaned_response[:300]}")
                
                extracted_data = json.loads(cleaned_response)
                logger.info(f"Successfully parsed extracted data: {extracted_data}")
                
                # Update requirements with extracted data (merge, don't overwrite existing values)
                for key, value in extracted_data.items():
                    if value is not None and value != "" and value != "null":
                        # Convert string numbers to integers where appropriate
                        if key in ['workout_duration', 'frequency_per_week', 'program_duration']:
                            try:
                                requirements[key] = int(value) if isinstance(value, str) else value
                                logger.info(f"Set {key} = {requirements[key]}")
                            except (ValueError, TypeError):
                                requirements[key] = value
                                logger.info(f"Set {key} = {requirements[key]}")
                        else:
                            requirements[key] = value
                            logger.info(f"Set {key} = {requirements[key]}")
                
                logger.info(f"Updated requirements after extraction: {requirements}")
                logger.info(f"Missing required fields: {[f for f in ['primary_fitness_goal', 'workout_duration', 'frequency_per_week', 'program_duration', 'experience_level'] if f not in requirements]}")
            except json.JSONDecodeError as e:
                logger.error(f"JSON parsing failed: {e}")
                logger.error(f"Raw response: {extraction_result['response']}")
                logger.error(f"Attempted to parse: {cleaned_response if 'cleaned_response' in locals() else 'N/A'}")
            except (IndexError, KeyError) as e:
                logger.warning(f"Failed to extract requirements: {e}")
                logger.warning(f"Response was: {extraction_result['response']}")
            
            # Check if we have all required information
            required_fields = [
                'primary_fitness_goal',
                'workout_duration',
                'frequency_per_week',
                'program_duration',
                'experience_level'
            ]
            
            missing_fields = [field for field in required_fields if field not in requirements]
            
            if missing_fields:
                # Generate follow-up questions
                question_prompt = f"""You are an expert AI fitness trainer. The user wants to create a workout plan.

We have gathered: {json.dumps(requirements, indent=2)}

We still need: {missing_fields}

User profile:
- Experience level: {user_context.get('experienceLevel', 'beginner')}
- Goals: {user_context.get('fitnessGoals', [])}

Generate a friendly, conversational follow-up question to gather the missing information. 
Ask about the most important missing field first. Be specific and provide options when helpful.
Keep it concise (2-3 sentences max).

CRITICAL: Return ONLY the question text. Do NOT include <reasoning> tags or any explanation. Just the direct question to ask the user."""
                
                question_result = await self.bedrock_service.invoke_bedrock_with_cache(
                    prompt=question_prompt,
                    context=user_context,
                    max_tokens=200,
                    endpoint_type='workout-plan-question',
                    user_id=user_id
                )
                
                # Clean the response by removing reasoning tags
                response_message = self._strip_reasoning_tags(question_result['response'])
                state['messages'].append({'role': 'assistant', 'content': response_message})
                
                # Save state to DynamoDB
                await self._save_conversation_state(user_id, conversation_id, state)
                
                return {
                    'success': True,
                    'stage': 'gathering_requirements',
                    'message': response_message,
                    'requirements': requirements,
                    'plan': None,  # No plan yet, still gathering requirements
                    'missing_fields': missing_fields,
                    'conversation_id': conversation_id,
                    'tokens_used': question_result.get('tokens_used', 0)
                }
            else:
                # We have all requirements, generate the plan
                state['stage'] = 'generating_plan'
                return await self.generate_structured_plan(user_id, conversation_id, requirements, user_context)
                
        except Exception as e:
            logger.error(f"Error starting plan creation conversation: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def generate_structured_plan(self, user_id: str, conversation_id: str,
                                      requirements: Dict[str, Any], 
                                      user_context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate a structured workout plan with exercises
        
        Args:
            user_id: User ID
            conversation_id: Conversation ID
            requirements: Gathered requirements
            user_context: User profile context
            
        Returns:
            Structured plan with exercises for preview
        """
        try:
            # Fetch existing exercises from database to check availability
            existing_exercises = await self.fetch_existing_exercises()
            
            # Build comprehensive prompt for plan generation
            plan_generation_prompt = self._build_plan_generation_prompt(
                requirements, user_context, existing_exercises
            )
            
            # Generate plan using AI - scale tokens based on plan duration
            # Mistral 7B has 8k output limit, allow generous token allocation for quality
            program_weeks_raw = requirements.get('program_duration', 4)
            # Handle cases like '4 weeks' or '4' or 4
            if isinstance(program_weeks_raw, str):
                program_weeks = int(program_weeks_raw.split()[0])  # Extract first number
            else:
                program_weeks = int(program_weeks_raw)
            # Scale: 800 tokens per week + 2000 base, capped at 7000 for quality output
            max_tokens = min(7000, max(3000, program_weeks * 800 + 2000))
            plan_result = await self.bedrock_service.invoke_bedrock_with_cache(
                prompt=plan_generation_prompt,
                context=user_context,
                max_tokens=max_tokens,
                endpoint_type='workout-plan-generation',
                user_id=user_id
            )
            
            # Parse the generated plan
            try:
                # Aggressively clean response - strip reasoning tags and extract JSON
                cleaned_response = self._clean_for_json_parsing(plan_result['response'])
                logger.info(f"Cleaned response preview: {cleaned_response[:200]}")
                
                # Try to parse the cleaned JSON
                structured_plan = json.loads(cleaned_response)
                
                # Recursively clean any reasoning tags that might be in string values
                structured_plan = self._clean_plan_recursively(structured_plan)
                
                logger.info(f"Successfully parsed plan with {len(structured_plan.get('weeks', []))} weeks")
            except (json.JSONDecodeError, ValueError) as e:
                logger.error(f"Failed to parse plan JSON: {e}")
                logger.error(f"Response preview: {plan_result['response'][:500]}")
                # Fallback: Try to structure the response
                structured_plan = await self._structure_unstructured_plan(
                    plan_result['response'], requirements, user_id
                )
            
            # Enhance plan with smart exercise matching
            enhanced_plan = await self.enhance_plan_with_exercises(
                structured_plan, existing_exercises, user_id
            )
            
            # Store plan preview in conversation state and save to DynamoDB
            state = await self._load_conversation_state(user_id, conversation_id)
            state['generated_plan'] = enhanced_plan
            state['stage'] = 'awaiting_approval'
            await self._save_conversation_state(user_id, conversation_id, state)
            
            # Calculate session and exercise counts for preview
            total_sessions = 0
            total_exercises = set()  # Use set to count unique exercises
            
            if 'weeks' in enhanced_plan:
                for week in enhanced_plan['weeks']:
                    if 'sessions' in week:
                        total_sessions += len(week['sessions'])
                        for session in week['sessions']:
                            if 'exercises' in session:
                                for exercise in session['exercises']:
                                    exercise_id = exercise.get('exercise_id')
                                    if exercise_id:
                                        total_exercises.add(exercise_id)
            
            # Generate human-readable summary
            summary = self._generate_plan_summary(enhanced_plan)
            
            return {
                'success': True,
                'stage': 'awaiting_approval',
                'message': f"I've created a personalized workout plan for you!\n\n{summary}\n\nWould you like me to save this plan to your account? Reply 'yes' to confirm, or let me know if you'd like any changes.",
                'plan': enhanced_plan,
                'conversation_id': conversation_id,
                'tokens_used': plan_result['tokens_used'],
                'sessions_count': total_sessions,
                'exercises_count': len(total_exercises),
                'new_exercises_count': enhanced_plan.get('new_exercises_count', 0)
            }
            
        except Exception as e:
            logger.error(f"Error generating structured plan: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def handle_plan_approval(self, user_id: str, conversation_id: str, 
                                   user_response: str, auth_token: str) -> Dict[str, Any]:
        """
        Handle user's approval or modification request for generated plan
        
        Args:
            user_id: User ID
            conversation_id: Conversation ID
            user_response: User's response message
            auth_token: Authentication token for API calls
            
        Returns:
            Result of plan save or modification
        """
        try:
            # Load conversation state from DynamoDB
            state = await self._load_conversation_state(user_id, conversation_id)
            
            if not state.get('generated_plan'):
                return {
                    'success': False,
                    'error': 'No plan found for approval. Please start over by creating a new workout plan.'
                }
            
            # Check if user is approving the plan
            approval_keywords = ['yes', 'approve', 'confirm', 'save', 'looks good', 'perfect', 'great']
            modification_keywords = ['change', 'modify', 'adjust', 'different', 'but', 'instead']
            
            response_lower = user_response.lower()
            is_approval = any(keyword in response_lower for keyword in approval_keywords)
            needs_modification = any(keyword in response_lower for keyword in modification_keywords)
            
            if is_approval and not needs_modification:
                # User approved - save to database
                plan = state['generated_plan']
                save_result = await self.save_plan_to_database(user_id, plan, auth_token)
                
                if save_result['success']:
                    # Clean up conversation state from DynamoDB
                    self.cleanup_conversation_state(user_id, conversation_id)
                    
                    return {
                        'success': True,
                        'stage': 'completed',
                        'message': f"✅ Your workout plan has been saved! You can find it in your Workouts section. I've created:\n\n- {save_result['summary']}\n\nReady to start your fitness journey? 💪",
                        'plan_id': save_result['plan_id'],
                        'sessions_created': save_result.get('sessions_created', 0),
                        'exercises_created': save_result.get('exercises_created', 0)
                    }
                else:
                    return {
                        'success': False,
                        'error': f"Failed to save plan: {save_result.get('error', 'Unknown error')}"
                    }
            
            else:
                # User wants modifications
                modification_prompt = f"""The user wants to modify their workout plan.

Current plan overview:
{json.dumps(state['generated_plan'], indent=2)[:500]}...

User's modification request: "{user_response}"

Generate a friendly response acknowledging their request and asking for clarification if needed.
Then update the plan according to their request."""
                
                user_context = await self.user_data_service.build_user_context(user_id)
                modification_result = await self.bedrock_service.invoke_bedrock_with_cache(
                    prompt=modification_prompt,
                    context=user_context,
                    max_tokens=500,
                    endpoint_type='workout-plan-modification',
                    user_id=user_id
                )
                
                return {
                    'success': True,
                    'stage': 'gathering_requirements',
                    'message': self._strip_reasoning_tags(modification_result['response']),
                    'conversation_id': conversation_id
                }
                
        except Exception as e:
            logger.error(f"Error handling plan approval: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def fetch_existing_exercises(self) -> List[Dict[str, Any]]:
        """
        Fetch all existing exercises from DynamoDB
        
        Returns:
            List of exercise dictionaries
        """
        try:
            exercises = []
            
            # Query for system exercises
            response = self.table.query(
                IndexName='GSI1',
                KeyConditionExpression='GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
                ExpressionAttributeValues={
                    ':pk': 'EXERCISES',
                    ':sk': 'EXERCISE#'
                }
            )
            
            exercises.extend(response.get('Items', []))
            
            # Handle pagination
            while 'LastEvaluatedKey' in response:
                response = self.table.query(
                    IndexName='GSI1',
                    KeyConditionExpression='GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
                    ExpressionAttributeValues={
                        ':pk': 'EXERCISES',
                        ':sk': 'EXERCISE#'
                    },
                    ExclusiveStartKey=response['LastEvaluatedKey']
                )
                exercises.extend(response.get('Items', []))
            
            logger.info(f"Fetched {len(exercises)} existing exercises")
            return exercises
            
        except Exception as e:
            logger.error(f"Error fetching exercises: {e}")
            return []
    
    async def find_matching_exercise(self, exercise_name: str, category: str,
                                    existing_exercises: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """
        Find a matching exercise in existing database using fuzzy matching
        
        Args:
            exercise_name: Name of exercise to find
            category: Exercise category
            existing_exercises: List of existing exercises
            
        Returns:
            Matching exercise or None
        """
        try:
            # Normalize search term
            search_name = exercise_name.lower().strip()
            
            # Direct name match
            for exercise in existing_exercises:
                if exercise.get('name', '').lower() == search_name:
                    return exercise
            
            # Partial match
            for exercise in existing_exercises:
                exercise_name_lower = exercise.get('name', '').lower()
                if search_name in exercise_name_lower or exercise_name_lower in search_name:
                    # Also check category matches
                    if exercise.get('category', '').lower() == category.lower():
                        return exercise
            
            # Synonym/variation matching
            synonyms = {
                'press': ['push', 'pressing'],
                'pull': ['row', 'pulling'],
                'squat': ['squats', 'squatting'],
                'deadlift': ['dead lift', 'dl'],
                'curl': ['curls', 'curling'],
                'raise': ['raises', 'raising', 'lift', 'lifts']
            }
            
            for key, variations in synonyms.items():
                if key in search_name:
                    for exercise in existing_exercises:
                        exercise_name_lower = exercise.get('name', '').lower()
                        if any(var in exercise_name_lower for var in variations):
                            if exercise.get('category', '').lower() == category.lower():
                                return exercise
            
            return None
            
        except Exception as e:
            logger.error(f"Error finding matching exercise: {e}")
            return None
    
    async def enhance_plan_with_exercises(self, plan: Dict[str, Any],
                                         existing_exercises: List[Dict[str, Any]],
                                         user_id: str) -> Dict[str, Any]:
        """
        Enhance plan by matching exercises with database or preparing for creation
        
        Args:
            plan: Generated workout plan
            existing_exercises: List of existing exercises
            user_id: User ID
            
        Returns:
            Enhanced plan with exercise IDs and creation flags
        """
        try:
            enhanced_plan = plan.copy()
            exercises_to_create = []
            
            # Process each week/session in the plan
            if 'weeks' in enhanced_plan:
                for week in enhanced_plan['weeks']:
                    if 'sessions' in week:
                        for session in week['sessions']:
                            if 'exercises' in session:
                                enhanced_exercises = []
                                
                                for exercise in session['exercises']:
                                    exercise_name = exercise.get('name', '')
                                    category = exercise.get('category', 'strength')
                                    
                                    # Try to find matching exercise
                                    matching_exercise = await self.find_matching_exercise(
                                        exercise_name, category, existing_exercises
                                    )
                                    
                                    if matching_exercise:
                                        # Use existing exercise
                                        exercise['exercise_id'] = matching_exercise.get('id')
                                        exercise['found_in_db'] = True
                                    else:
                                        # Mark for creation
                                        exercise['exercise_id'] = str(uuid.uuid4())
                                        exercise['found_in_db'] = False
                                        exercise['needs_creation'] = True
                                        
                                        # Prepare exercise for creation
                                        exercises_to_create.append({
                                            'id': exercise['exercise_id'],
                                            'name': exercise_name,
                                            'category': category,
                                            'muscle_groups': exercise.get('muscle_groups', []),
                                            'equipment': exercise.get('equipment', []),
                                            'difficulty': exercise.get('difficulty', 'beginner'),
                                            'description': exercise.get('description', ''),
                                            'instructions': exercise.get('instructions', []),
                                            'created_by': user_id
                                        })
                                    
                                    enhanced_exercises.append(exercise)
                                
                                session['exercises'] = enhanced_exercises
            
            enhanced_plan['exercises_to_create'] = exercises_to_create
            enhanced_plan['total_exercises'] = len(existing_exercises) if exercises_to_create else 0
            enhanced_plan['new_exercises_count'] = len(exercises_to_create)
            
            return enhanced_plan
            
        except Exception as e:
            logger.error(f"Error enhancing plan with exercises: {e}")
            return plan
    
    async def save_plan_to_database(self, user_id: str, plan: Dict[str, Any],
                                   auth_token: str) -> Dict[str, Any]:
        """
        Save the complete workout plan directly to DynamoDB
        
        Args:
            user_id: User ID
            plan: Enhanced workout plan
            auth_token: Authentication token (not used for direct DynamoDB)
            
        Returns:
            Result with created IDs and summary
        """
        try:
            # Step 1: Create exercises that don't exist
            exercises_to_create = plan.get('exercises_to_create', [])
            created_exercise_ids = []
            
            if exercises_to_create:
                for exercise_data in exercises_to_create:
                    exercise_result = await self._create_exercise_in_dynamodb(
                        exercise_data, user_id
                    )
                    if exercise_result['success']:
                        created_exercise_ids.append(exercise_result['exercise_id'])
            
            # Step 2: Create the workout plan
            plan_id = str(uuid.uuid4())
            plan_data = {
                'PK': f'USER#{user_id}',
                'SK': f'WORKOUT_PLAN#{plan_id}',
                'id': plan_id,
                'user_id': user_id,
                'name': plan.get('name', 'AI Generated Workout Plan'),
                'description': plan.get('description', ''),
                'difficulty': plan.get('difficulty', 'intermediate'),
                'duration_weeks': plan.get('duration_weeks', 4),
                'frequency_per_week': plan.get('frequency_per_week', 3),
                'tags': plan.get('tags', ['ai-generated']),
                'is_template': False,
                'created_at': datetime.now(timezone.utc).isoformat(),
                'updated_at': datetime.now(timezone.utc).isoformat(),
                'entity_type': 'workout_plan'
            }
            
            self.table.put_item(Item=plan_data)
            logger.info(f"Created workout plan {plan_id} for user {user_id}")
            
            # Step 3: Create workout sessions for each week
            sessions_created = 0
            
            if 'weeks' in plan:
                for week_idx, week in enumerate(plan['weeks']):
                    if 'sessions' in week:
                        for session_idx, session in enumerate(week['sessions']):
                            session_id = str(uuid.uuid4())
                            session_data = {
                                'PK': f'USER#{user_id}',
                                'SK': f'WORKOUT_SESSION#{session_id}',
                                'id': session_id,
                                'user_id': user_id,
                                'workout_plan_id': plan_id,
                                'name': session.get('name', f"Week {week_idx + 1} - Day {session_idx + 1}"),
                                'week_number': week_idx + 1,
                                'day_number': session.get('day', session_idx + 1),
                                'duration_minutes': session.get('duration_minutes', 60),
                                'exercises': self._format_session_exercises(session.get('exercises', [])),
                                'notes': session.get('notes', ''),
                                'started_at': datetime.now(timezone.utc).isoformat(),
                                'created_at': datetime.now(timezone.utc).isoformat(),
                                'entity_type': 'workout_session',
                                'status': 'planned'
                            }
                            
                            self.table.put_item(Item=session_data)
                            sessions_created += 1
                            logger.info(f"Created session {session_id} for plan {plan_id}")
            
            return {
                'success': True,
                'plan_id': plan_id,
                'sessions_created': sessions_created,
                'exercises_created': len(created_exercise_ids),
                'summary': f"{plan_data['name']} ({sessions_created} sessions, {len(created_exercise_ids)} new exercises)"
            }
            
        except Exception as e:
            logger.error(f"Error saving plan to database: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def _create_exercise_in_dynamodb(self, exercise_data: Dict[str, Any],
                                           user_id: str) -> Dict[str, Any]:
        """Create exercise directly in DynamoDB"""
        try:
            exercise_id = exercise_data.get('id', str(uuid.uuid4()))
            
            # Store exercise with proper DynamoDB keys
            item = {
                'PK': f'USER#{user_id}',
                'SK': f'EXERCISE#{exercise_id}',
                'GSI1PK': 'EXERCISES',
                'GSI1SK': f'EXERCISE#{exercise_id}',
                'id': exercise_id,
                'name': exercise_data.get('name', ''),
                'category': exercise_data.get('category', 'strength'),
                'muscle_groups': exercise_data.get('muscle_groups', []),
                'equipment': exercise_data.get('equipment', []),
                'difficulty': exercise_data.get('difficulty', 'beginner'),
                'description': exercise_data.get('description', ''),
                'instructions': exercise_data.get('instructions', []),
                'created_by': user_id,
                'created_at': datetime.now(timezone.utc).isoformat(),
                'updated_at': datetime.now(timezone.utc).isoformat(),
                'entity_type': 'exercise',
                'is_custom': True
            }
            
            self.table.put_item(Item=item)
            logger.info(f"Created exercise {exercise_id}: {exercise_data.get('name')}")
            
            return {
                'success': True,
                'exercise_id': exercise_id
            }
        except Exception as e:
            logger.error(f"Error creating exercise in DynamoDB: {e}")
            return {'success': False, 'error': str(e)}
    
    def _format_session_exercises(self, exercises: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Format exercises for session creation"""
        formatted = []
        for idx, exercise in enumerate(exercises):
            formatted.append({
                'exercise_id': exercise.get('exercise_id'),
                'name': exercise.get('name'),
                'sets': [
                    {
                        'set_number': i + 1,
                        'reps': exercise.get('reps'),
                        'weight': exercise.get('weight'),
                        'duration_seconds': exercise.get('duration_seconds'),
                        'rest_seconds': exercise.get('rest_seconds', 60),
                        'completed': False
                    } for i in range(exercise.get('sets', 3))
                ],
                'notes': exercise.get('notes', ''),
                'order': idx + 1
            })
        return formatted
    
    def _build_plan_generation_prompt(self, requirements: Dict[str, Any],
                                     user_context: Dict[str, Any],
                                     existing_exercises: List[Dict[str, Any]]) -> str:
        """Build comprehensive prompt for plan generation"""
        
        # Format existing exercises for reference
        exercise_names = [ex.get('name', '') for ex in existing_exercises[:50]]  # Limit to avoid token overflow
        
        prompt = f"""You are an expert AI fitness trainer creating a personalized workout plan.

USER REQUIREMENTS:
- Goal: {requirements.get('primary_fitness_goal', 'general_fitness')}
- Experience: {requirements.get('experience_level', 'beginner')}
- Duration: {requirements.get('program_duration', 8)} weeks
- Frequency: {requirements.get('frequency_per_week', 3)} days per week
- Session duration: {requirements.get('workout_duration', 60)} minutes
- Equipment: {requirements.get('available_equipment', ['bodyweight'])}
- Focus areas: {requirements.get('focus_muscle_groups', ['full body'])}
- Workout style: {requirements.get('workout_style', 'strength_training')}

USER PROFILE:
- Current fitness level: {user_context.get('experienceLevel', 'beginner')}
- Height: {user_context.get('height', 'N/A')}
- Weight: {user_context.get('weight', 'N/A')}

AVAILABLE EXERCISES IN DATABASE (use these when possible):
{', '.join(exercise_names[:30])}

INSTRUCTIONS:
Create a comprehensive workout plan in JSON format with this EXACT structure:

{{
  "name": "Plan name",
  "description": "Detailed plan description",
  "difficulty": "beginner|intermediate|advanced",
  "duration_weeks": number,
  "frequency_per_week": number,
  "tags": ["ai-generated", "goal-specific-tags"],
  "weeks": [
    {{
      "week_number": 1,
      "focus": "Week focus",
      "sessions": [
        {{
          "name": "Session name",
          "day": 1,
          "duration_minutes": number,
          "notes": "Session notes",
          "exercises": [
            {{
              "name": "Exercise name (use exact name from available exercises if possible)",
              "category": "strength|cardio|flexibility",
              "muscle_groups": ["primary", "secondary"],
              "equipment": ["required equipment"],
              "sets": 3,
              "reps": 10,
              "weight": null,
              "duration_seconds": null,
              "rest_seconds": 60,
              "difficulty": "beginner|intermediate|advanced",
              "instructions": ["step 1", "step 2"],
              "notes": "Exercise-specific notes"
            }}
          ]
        }}
      ]
    }}
  ]
}}

CRITICAL INSTRUCTIONS:
- Use exercise names from the available list when they match the plan requirements
- Include proper progression across weeks
- Provide specific sets, reps, and rest periods
- Include 3-5 exercises per session (keep it focused and achievable)
- Add form cues in instructions (2-3 steps max per exercise)

OUTPUT FORMAT:
- Return ONLY valid JSON
- NO markdown code fences (no ``` or ```json)
- NO explanatory text before or after the JSON
- NO reasoning, thinking, or meta-commentary
- Start your response with {{ and end with }}
- Ensure all JSON strings are properly escaped
- All array and object structures must be complete and valid"""
        
        return prompt
    
    def _extract_json_from_response(self, response: str) -> str:
        """Extract JSON from AI response that might contain markdown or extra text"""
        import re
        
        # Remove markdown code fences first
        response = re.sub(r'```json\s*', '', response)
        response = re.sub(r'```\s*$', '', response)
        response = response.strip()
        
        # Find the outermost JSON object
        start = response.find('{')
        if start < 0:
            logger.error("No opening brace found in response")
            return response
        
        # Find matching closing brace using proper bracket counting
        brace_count = 0
        end = -1
        in_string = False
        escape_next = False
        
        for i in range(start, len(response)):
            char = response[i]
            
            if escape_next:
                escape_next = False
                continue
                
            if char == '\\':
                escape_next = True
                continue
                
            if char == '"' and not escape_next:
                in_string = not in_string
                continue
                
            if not in_string:
                if char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        end = i + 1
                        break
        
        if end > start:
            json_str = response[start:end]
            logger.info(f"Extracted JSON of length {len(json_str)}")
            return json_str
        else:
            logger.error(f"Could not find matching closing brace. Brace count: {brace_count}")
            return response[start:]
    
    async def _structure_unstructured_plan(self, response: str, requirements: Dict[str, Any],
                                          user_id: str) -> Dict[str, Any]:
        """Fallback: Structure an unstructured plan response"""
        # Basic structure with defaults
        return {
            'name': f"{requirements.get('primary_fitness_goal', 'Fitness')} Plan",
            'description': response[:200],
            'difficulty': requirements.get('experience_level', 'intermediate'),
            'duration_weeks': requirements.get('program_duration', 8),
            'frequency_per_week': requirements.get('frequency_per_week', 3),
            'tags': ['ai-generated'],
            'weeks': [],
            'raw_response': response
        }
    
    def _generate_plan_summary(self, plan: Dict[str, Any]) -> str:
        """Generate human-readable summary of the plan"""
        summary_parts = []
        
        # Clean plan name and description from reasoning tags
        plan_name = self._strip_reasoning_tags(plan.get('name', 'Workout Plan'))
        summary_parts.append(f"📋 **{plan_name}**")
        summary_parts.append(f"📅 Duration: {plan.get('duration_weeks', 0)} weeks")
        summary_parts.append(f"🏋️ Frequency: {plan.get('frequency_per_week', 0)} days/week")
        summary_parts.append(f"⚡ Difficulty: {plan.get('difficulty', 'intermediate').title()}")
        
        if 'description' in plan:
            description = self._strip_reasoning_tags(plan['description'])
            if description and len(description) > 10:  # Only show if we have real description
                summary_parts.append(f"\n{description[:200]}...")
        
        # Count total sessions and exercises
        total_sessions = 0
        total_exercises = 0
        new_exercises = plan.get('new_exercises_count', 0)
        
        if 'weeks' in plan:
            logger.info(f"Counting from {len(plan['weeks'])} weeks")
            for week_idx, week in enumerate(plan['weeks']):
                if 'sessions' in week:
                    sessions = week['sessions'] if isinstance(week['sessions'], list) else []
                    total_sessions += len(sessions)
                    logger.info(f"Week {week_idx + 1} has {len(sessions)} sessions")
                    for session in sessions:
                        if 'exercises' in session:
                            exercises = session['exercises'] if isinstance(session['exercises'], list) else []
                            total_exercises += len(exercises)
        
        logger.info(f"Final counts: {total_sessions} sessions, {total_exercises} exercises")
        summary_parts.append(f"\n📊 Total: {total_sessions} sessions, {total_exercises} exercises")
        if new_exercises > 0:
            summary_parts.append(f"✨ {new_exercises} new exercises will be created")
        
        return '\n'.join(summary_parts)
    
    async def _load_conversation_state(self, user_id: str, conversation_id: str) -> Dict[str, Any]:
        """Load conversation state from DynamoDB or in-memory (for local dev)"""
        try:
            # Use in-memory storage for local development
            if self.is_local:
                state_key = f'{user_id}#{conversation_id}'
                if state_key in self.conversation_states:
                    logger.info(f"Loading state from memory for {state_key}")
                    return self.conversation_states[state_key]
                else:
                    logger.info(f"Creating new state in memory for {state_key}")
                    new_state = {
                        'stage': 'gathering_requirements',
                        'requirements': {},
                        'messages': []
                    }
                    self.conversation_states[state_key] = new_state
                    return new_state
            
            # Production: use DynamoDB
            response = self.table.get_item(
                Key={
                    'PK': f'USER#{user_id}',
                    'SK': f'WORKOUT_PLAN_CONV#{conversation_id}'
                }
            )
            
            if 'Item' in response:
                item = response['Item']
                return {
                    'stage': item.get('stage', 'gathering_requirements'),
                    'requirements': json.loads(item.get('requirements', '{}')),
                    'messages': json.loads(item.get('messages', '[]')),
                    'generated_plan': json.loads(item.get('generated_plan', 'null'))
                }
            else:
                # New conversation
                return {
                    'stage': 'gathering_requirements',
                    'requirements': {},
                    'messages': []
                }
        except Exception as e:
            logger.error(f"Error loading conversation state: {e}")
            return {
                'stage': 'gathering_requirements',
                'requirements': {},
                'messages': []
            }
    
    async def _save_conversation_state(self, user_id: str, conversation_id: str, state: Dict[str, Any]):
        """Save conversation state to DynamoDB or in-memory (for local dev)"""
        try:
            # Use in-memory storage for local development
            if self.is_local:
                state_key = f'{user_id}#{conversation_id}'
                self.conversation_states[state_key] = state
                logger.info(f"Saved state to memory for {state_key}: {list(state.get('requirements', {}).keys())}")
                return
            
            # Production: use DynamoDB
            # Set TTL to 24 hours from now
            ttl = int((datetime.now(timezone.utc) + timedelta(hours=24)).timestamp())
            
            self.table.put_item(
                Item={
                    'PK': f'USER#{user_id}',
                    'SK': f'WORKOUT_PLAN_CONV#{conversation_id}',
                    'stage': state.get('stage', 'gathering_requirements'),
                    'requirements': json.dumps(state.get('requirements', {})),
                    'messages': json.dumps(state.get('messages', [])),
                    'generated_plan': json.dumps(state.get('generated_plan')),
                    'updatedAt': datetime.now(timezone.utc).isoformat(),
                    'ttl': ttl
                }
            )
            logger.info(f"Saved conversation state for {user_id}:{conversation_id}")
        except Exception as e:
            logger.error(f"Error saving conversation state: {e}")
    
    def cleanup_conversation_state(self, user_id: str, conversation_id: str):
        """Clean up conversation state after completion or timeout"""
        try:
            # Clean up in-memory storage for local development
            if self.is_local:
                state_key = f'{user_id}#{conversation_id}'
                if state_key in self.conversation_states:
                    del self.conversation_states[state_key]
                    logger.info(f"Cleaned up in-memory conversation state for {state_key}")
                return
            
            # Production: clean up DynamoDB
            self.table.delete_item(
                Key={
                    'PK': f'USER#{user_id}',
                    'SK': f'WORKOUT_PLAN_CONV#{conversation_id}'
                }
            )
            logger.info(f"Cleaned up conversation state for {user_id}:{conversation_id}")
        except Exception as e:
            logger.error(f"Error cleaning up conversation state: {e}")
