import os
import json
import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timezone, timedelta
import statistics
from collections import defaultdict, Counter

from user_data_service import UserDataService
from rag_service import RAGService
from bedrock_service import BedrockService
from embedding_service import EmbeddingService

logger = logging.getLogger(__name__)

class ExerciseSubstitutionService:
    """Service for intelligent exercise substitution using RAG-powered knowledge"""
    
    def __init__(self):
        self.table_name = os.environ.get('DYNAMODB_TABLE', 'gymcoach-ai-main')
        self.user_data_service = UserDataService(self.table_name)
        self.rag_service = RAGService()
        self.bedrock_service = BedrockService()
        self.embedding_service = EmbeddingService()
        
        # Substitution criteria weights
        self.muscle_group_weight = 0.4
        self.movement_pattern_weight = 0.3
        self.equipment_weight = 0.2
        self.difficulty_weight = 0.1
        
    async def find_exercise_substitutions(self, user_id: str, unavailable_exercises: List[str], context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Find intelligent exercise substitutions using RAG-powered knowledge
        
        Args:
            user_id: User ID
            unavailable_exercises: List of exercises that are unavailable
            context: Additional context for substitution (equipment, preferences, etc.)
            
        Returns:
            Dictionary with substitution suggestions
        """
        try:
            logger.info(f"Finding exercise substitutions for user {user_id}")
            
            # Get user context
            user_profile = await self.user_data_service.get_user_profile(user_id)
            recent_workouts = await self.user_data_service.get_recent_workouts(user_id, 10)
            
            if not user_profile:
                return {'error': 'User profile not found'}
            
            # Build substitution context
            substitution_context = await self._build_substitution_context(
                user_profile, recent_workouts, context
            )
            
            substitutions = {}
            
            for exercise_name in unavailable_exercises:
                # Get exercise details from recent workouts
                exercise_details = await self._get_exercise_details(exercise_name, recent_workouts)
                
                # Use RAG to find similar exercises
                rag_results = await self._find_similar_exercises_rag(
                    exercise_name, exercise_details, substitution_context
                )
                
                # Generate AI-powered substitution suggestions
                ai_suggestions = await self._generate_ai_substitutions(
                    exercise_name, exercise_details, rag_results, substitution_context
                )
                
                # Score and rank substitutions
                ranked_substitutions = await self._rank_substitutions(
                    exercise_name, exercise_details, ai_suggestions, substitution_context
                )
                
                substitutions[exercise_name] = {
                    'original_exercise': exercise_details,
                    'substitutions': ranked_substitutions,
                    'rag_sources': rag_results.get('sources', []),
                    'substitution_reasoning': await self._generate_substitution_reasoning(
                        exercise_name, ranked_substitutions, substitution_context
                    )
                }
            
            return {
                'user_id': user_id,
                'substitutions': substitutions,
                'substitution_context': substitution_context,
                'generated_at': datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error finding exercise substitutions for user {user_id}: {e}")
            return {'error': str(e)}
    
    async def suggest_equipment_alternatives(self, user_id: str, exercise_name: str, unavailable_equipment: List[str]) -> Dict[str, Any]:
        """
        Suggest equipment alternatives for a specific exercise
        
        Args:
            user_id: User ID
            exercise_name: Name of the exercise
            unavailable_equipment: List of unavailable equipment
            
        Returns:
            Dictionary with equipment alternatives
        """
        try:
            logger.info(f"Suggesting equipment alternatives for {exercise_name}")
            
            user_profile = await self.user_data_service.get_user_profile(user_id)
            recent_workouts = await self.user_data_service.get_recent_workouts(user_id, 10)
            
            if not user_profile:
                return {'error': 'User profile not found'}
            
            # Get exercise details
            exercise_details = await self._get_exercise_details(exercise_name, recent_workouts)
            
            # Use RAG to find equipment alternatives
            rag_query = f"equipment alternatives for {exercise_name} without {', '.join(unavailable_equipment)}"
            rag_context = await self.rag_service.retrieve_exercise_context(
                query=rag_query,
                user_context={
                    'available_equipment': user_profile.get('equipmentAvailable', []),
                    'experience_level': user_profile.get('experienceLevel', 'beginner')
                }
            )
            
            # Generate equipment alternatives using AI
            alternatives_prompt = f"""
            Suggest equipment alternatives for the exercise "{exercise_name}" when the following equipment is unavailable: {', '.join(unavailable_equipment)}
            
            Original Exercise Details:
            {json.dumps(exercise_details, indent=2)}
            
            User's Available Equipment:
            {', '.join(user_profile.get('equipmentAvailable', []))}
            
            User Experience Level:
            {user_profile.get('experienceLevel', 'beginner')}
            
            Equipment Knowledge:
            {rag_context['context']}
            
            For each alternative, provide:
            1. Equipment needed
            2. How to perform the exercise
            3. Any modifications needed
            4. Difficulty level compared to original
            5. Safety considerations
            
            Focus on exercises that target the same muscle groups and movement patterns.
            """
            
            bedrock_result = self.bedrock_service.invoke_bedrock(
                alternatives_prompt,
                {
                    'exercise_name': exercise_name,
                    'exercise_details': exercise_details,
                    'unavailable_equipment': unavailable_equipment,
                    'user_profile': user_profile,
                    'rag_context': rag_context
                },
                max_tokens=500
            )
            
            if bedrock_result['success']:
                return {
                    'user_id': user_id,
                    'exercise_name': exercise_name,
                    'unavailable_equipment': unavailable_equipment,
                    'equipment_alternatives': bedrock_result['response'],
                    'rag_sources': rag_context['sources'],
                    'generated_at': datetime.now(timezone.utc).isoformat()
                }
            else:
                return {'error': 'Failed to generate equipment alternatives'}
                
        except Exception as e:
            logger.error(f"Error suggesting equipment alternatives for user {user_id}: {e}")
            return {'error': str(e)}
    
    async def suggest_injury_modifications(self, user_id: str, exercise_name: str, injury_limitations: List[str]) -> Dict[str, Any]:
        """
        Suggest exercise modifications for injury limitations
        
        Args:
            user_id: User ID
            exercise_name: Name of the exercise
            injury_limitations: List of injury limitations
            
        Returns:
            Dictionary with injury-safe modifications
        """
        try:
            logger.info(f"Suggesting injury modifications for {exercise_name}")
            
            user_profile = await self.user_data_service.get_user_profile(user_id)
            recent_workouts = await self.user_data_service.get_recent_workouts(user_id, 10)
            
            if not user_profile:
                return {'error': 'User profile not found'}
            
            # Get exercise details
            exercise_details = await self._get_exercise_details(exercise_name, recent_workouts)
            
            # Use RAG to find injury-safe alternatives
            rag_query = f"injury-safe modifications for {exercise_name} with limitations: {', '.join(injury_limitations)}"
            rag_context = await self.rag_service.retrieve_exercise_context(
                query=rag_query,
                user_context={
                    'injury_limitations': injury_limitations,
                    'experience_level': user_profile.get('experienceLevel', 'beginner')
                }
            )
            
            # Generate injury-safe modifications using AI
            modifications_prompt = f"""
            Suggest injury-safe modifications for the exercise "{exercise_name}" given these limitations: {', '.join(injury_limitations)}
            
            Original Exercise Details:
            {json.dumps(exercise_details, indent=2)}
            
            User Experience Level:
            {user_profile.get('experienceLevel', 'beginner')}
            
            Injury Prevention Knowledge:
            {rag_context['context']}
            
            For each modification, provide:
            1. Modified exercise name
            2. How to perform safely
            3. Range of motion adjustments
            4. Weight/load modifications
            5. Safety precautions
            6. When to avoid this exercise entirely
            
            Prioritize safety and pain-free movement patterns.
            """
            
            bedrock_result = self.bedrock_service.invoke_bedrock(
                modifications_prompt,
                {
                    'exercise_name': exercise_name,
                    'exercise_details': exercise_details,
                    'injury_limitations': injury_limitations,
                    'user_profile': user_profile,
                    'rag_context': rag_context
                },
                max_tokens=500
            )
            
            if bedrock_result['success']:
                return {
                    'user_id': user_id,
                    'exercise_name': exercise_name,
                    'injury_limitations': injury_limitations,
                    'injury_safe_modifications': bedrock_result['response'],
                    'rag_sources': rag_context['sources'],
                    'safety_warning': 'Always consult with a healthcare professional before exercising with injuries.',
                    'generated_at': datetime.now(timezone.utc).isoformat()
                }
            else:
                return {'error': 'Failed to generate injury modifications'}
                
        except Exception as e:
            logger.error(f"Error suggesting injury modifications for user {user_id}: {e}")
            return {'error': str(e)}
    
    async def suggest_progression_alternatives(self, user_id: str, exercise_name: str, current_difficulty: str) -> Dict[str, Any]:
        """
        Suggest progression alternatives (easier or harder variations)
        
        Args:
            user_id: User ID
            exercise_name: Name of the exercise
            current_difficulty: Current difficulty level ('too_easy', 'too_hard', 'just_right')
            
        Returns:
            Dictionary with progression alternatives
        """
        try:
            logger.info(f"Suggesting progression alternatives for {exercise_name}")
            
            user_profile = await self.user_data_service.get_user_profile(user_id)
            recent_workouts = await self.user_data_service.get_recent_workouts(user_id, 10)
            
            if not user_profile:
                return {'error': 'User profile not found'}
            
            # Get exercise details
            exercise_details = await self._get_exercise_details(exercise_name, recent_workouts)
            
            # Determine progression direction
            if current_difficulty == 'too_easy':
                progression_direction = 'harder'
                rag_query = f"harder variations and progressions for {exercise_name}"
            elif current_difficulty == 'too_hard':
                progression_direction = 'easier'
                rag_query = f"easier variations and regressions for {exercise_name}"
            else:
                progression_direction = 'both'
                rag_query = f"easier and harder variations for {exercise_name}"
            
            # Use RAG to find progression alternatives
            rag_context = await self.rag_service.retrieve_exercise_context(
                query=rag_query,
                user_context={
                    'experience_level': user_profile.get('experienceLevel', 'beginner'),
                    'current_difficulty': current_difficulty
                }
            )
            
            # Generate progression alternatives using AI
            progression_prompt = f"""
            Suggest {progression_direction} variations for the exercise "{exercise_name}" based on current difficulty: {current_difficulty}
            
            Original Exercise Details:
            {json.dumps(exercise_details, indent=2)}
            
            User Experience Level:
            {user_profile.get('experienceLevel', 'beginner')}
            
            Progression Knowledge:
            {rag_context['context']}
            
            For each variation, provide:
            1. Variation name
            2. How it differs from original
            3. Difficulty level (easier/harder)
            4. When to use this variation
            5. Progression tips
            6. Safety considerations
            
            Focus on maintaining the same movement pattern while adjusting difficulty.
            """
            
            bedrock_result = self.bedrock_service.invoke_bedrock(
                progression_prompt,
                {
                    'exercise_name': exercise_name,
                    'exercise_details': exercise_details,
                    'current_difficulty': current_difficulty,
                    'progression_direction': progression_direction,
                    'user_profile': user_profile,
                    'rag_context': rag_context
                },
                max_tokens=500
            )
            
            if bedrock_result['success']:
                return {
                    'user_id': user_id,
                    'exercise_name': exercise_name,
                    'current_difficulty': current_difficulty,
                    'progression_direction': progression_direction,
                    'progression_alternatives': bedrock_result['response'],
                    'rag_sources': rag_context['sources'],
                    'generated_at': datetime.now(timezone.utc).isoformat()
                }
            else:
                return {'error': 'Failed to generate progression alternatives'}
                
        except Exception as e:
            logger.error(f"Error suggesting progression alternatives for user {user_id}: {e}")
            return {'error': str(e)}
    
    # Helper methods for exercise substitution
    
    async def _build_substitution_context(self, user_profile: Dict[str, Any], recent_workouts: List[Dict[str, Any]], additional_context: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """Build comprehensive context for exercise substitution"""
        try:
            context = {
                'user_profile': {
                    'experience_level': user_profile.get('experienceLevel', 'beginner'),
                    'fitness_goals': user_profile.get('fitnessGoals', []),
                    'equipment_available': user_profile.get('equipmentAvailable', []),
                    'injuries_or_limitations': user_profile.get('injuriesOrLimitations', []),
                    'preferred_exercises': user_profile.get('preferredExercises', []),
                    'avoided_exercises': user_profile.get('avoidedExercises', [])
                },
                'recent_workout_patterns': await self._analyze_recent_patterns(recent_workouts),
                'equipment_preferences': await self._analyze_equipment_preferences(recent_workouts),
                'exercise_preferences': await self._analyze_exercise_preferences(recent_workouts)
            }
            
            # Add additional context if provided
            if additional_context:
                context.update(additional_context)
            
            return context
            
        except Exception as e:
            logger.error(f"Error building substitution context: {e}")
            return {'user_profile': user_profile}
    
    async def _get_exercise_details(self, exercise_name: str, recent_workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Get detailed information about an exercise from recent workouts"""
        try:
            exercise_instances = []
            
            for workout in recent_workouts:
                exercises = workout.get('exercises', [])
                for exercise in exercises:
                    if exercise.get('name', '').lower() == exercise_name.lower():
                        exercise_instances.append({
                            'weight': exercise.get('weight', 0),
                            'reps': exercise.get('reps', 0),
                            'sets': exercise.get('sets', 1),
                            'rest_time': exercise.get('restTime', 0),
                            'notes': exercise.get('notes', ''),
                            'workout_date': workout.get('date', '')
                        })
            
            if exercise_instances:
                # Calculate averages and ranges
                weights = [ex['weight'] for ex in exercise_instances if ex['weight'] > 0]
                reps = [ex['reps'] for ex in exercise_instances if ex['reps'] > 0]
                sets = [ex['sets'] for ex in exercise_instances if ex['sets'] > 0]
                
                return {
                    'exercise_name': exercise_name,
                    'recent_instances': len(exercise_instances),
                    'average_weight': statistics.mean(weights) if weights else 0,
                    'average_reps': statistics.mean(reps) if reps else 0,
                    'average_sets': statistics.mean(sets) if sets else 0,
                    'weight_range': {'min': min(weights), 'max': max(weights)} if weights else {'min': 0, 'max': 0},
                    'reps_range': {'min': min(reps), 'max': max(reps)} if reps else {'min': 0, 'max': 0},
                    'latest_instance': exercise_instances[-1] if exercise_instances else {},
                    'all_instances': exercise_instances
                }
            else:
                return {
                    'exercise_name': exercise_name,
                    'recent_instances': 0,
                    'message': 'No recent instances found'
                }
                
        except Exception as e:
            logger.error(f"Error getting exercise details for {exercise_name}: {e}")
            return {'exercise_name': exercise_name, 'error': str(e)}
    
    async def _find_similar_exercises_rag(self, exercise_name: str, exercise_details: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """Use RAG to find similar exercises"""
        try:
            # Build comprehensive query
            query_parts = [f"exercises similar to {exercise_name}"]
            
            # Add context-specific queries
            if exercise_details.get('average_weight', 0) > 0:
                query_parts.append(f"strength exercises with {exercise_details['average_weight']:.0f}kg weight")
            
            if exercise_details.get('average_reps', 0) > 0:
                query_parts.append(f"exercises with {exercise_details['average_reps']:.0f} reps")
            
            # Add equipment context
            available_equipment = context.get('user_profile', {}).get('equipment_available', [])
            if available_equipment:
                query_parts.append(f"exercises using {', '.join(available_equipment)}")
            
            # Combine queries
            rag_query = " ".join(query_parts)
            
            # Retrieve similar exercises using RAG
            rag_results = await self.rag_service.retrieve_exercise_context(
                query=rag_query,
                user_context=context.get('user_profile', {})
            )
            
            return rag_results
            
        except Exception as e:
            logger.error(f"Error finding similar exercises via RAG: {e}")
            return {'context': '', 'sources': []}
    
    async def _generate_ai_substitutions(self, exercise_name: str, exercise_details: Dict[str, Any], rag_results: Dict[str, Any], context: Dict[str, Any]) -> str:
        """Generate AI-powered substitution suggestions"""
        try:
            substitution_prompt = f"""
            Suggest 3-5 exercise substitutions for "{exercise_name}" based on the user's context and exercise details.
            
            Original Exercise Details:
            {json.dumps(exercise_details, indent=2)}
            
            User Context:
            - Experience Level: {context.get('user_profile', {}).get('experience_level', 'beginner')}
            - Available Equipment: {', '.join(context.get('user_profile', {}).get('equipment_available', []))}
            - Fitness Goals: {', '.join(context.get('user_profile', {}).get('fitness_goals', []))}
            - Injuries/Limitations: {', '.join(context.get('user_profile', {}).get('injuries_or_limitations', []))}
            
            Similar Exercises Knowledge:
            {rag_results.get('context', '')}
            
            For each substitution, provide:
            1. Exercise name
            2. Why it's a good substitute (muscle groups, movement pattern)
            3. Equipment needed
            4. Difficulty level compared to original
            5. Any modifications needed for user's level/limitations
            6. Sets/reps/weight recommendations based on original exercise
            
            Prioritize exercises that:
            - Target the same primary muscle groups
            - Use similar movement patterns
            - Match the user's available equipment
            - Are appropriate for their experience level
            - Consider any injuries or limitations
            """
            
            bedrock_result = self.bedrock_service.invoke_bedrock(
                substitution_prompt,
                {
                    'exercise_name': exercise_name,
                    'exercise_details': exercise_details,
                    'rag_results': rag_results,
                    'context': context
                },
                max_tokens=600
            )
            
            if bedrock_result['success']:
                return bedrock_result['response']
            else:
                return f"Consider alternative exercises that target the same muscle groups as {exercise_name}."
                
        except Exception as e:
            logger.error(f"Error generating AI substitutions: {e}")
            return f"Consider alternative exercises that target the same muscle groups as {exercise_name}."
    
    async def _rank_substitutions(self, exercise_name: str, exercise_details: Dict[str, Any], ai_suggestions: str, context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Rank substitution suggestions based on multiple criteria"""
        try:
            # This is a simplified ranking - in a real implementation, you might
            # parse the AI suggestions and score them based on various criteria
            
            # For now, return the AI suggestions as-is with basic scoring
            substitutions = []
            
            # Split AI suggestions into individual exercises (simplified)
            suggestion_lines = ai_suggestions.split('\n')
            current_exercise = {}
            
            for line in suggestion_lines:
                line = line.strip()
                if line and not line.startswith('For each') and not line.startswith('Prioritize'):
                    if line[0].isdigit() or line.startswith('1.') or line.startswith('2.') or line.startswith('3.'):
                        if current_exercise:
                            substitutions.append(current_exercise)
                        current_exercise = {
                            'name': line,
                            'description': '',
                            'score': 0.8,  # Default score
                            'reasoning': 'AI-generated suggestion'
                        }
                    elif current_exercise:
                        current_exercise['description'] += line + ' '
            
            if current_exercise:
                substitutions.append(current_exercise)
            
            # Sort by score (highest first)
            substitutions.sort(key=lambda x: x['score'], reverse=True)
            
            return substitutions[:5]  # Return top 5
            
        except Exception as e:
            logger.error(f"Error ranking substitutions: {e}")
            return [{'name': f'Alternative to {exercise_name}', 'score': 0.5, 'reasoning': 'Fallback suggestion'}]
    
    async def _generate_substitution_reasoning(self, exercise_name: str, substitutions: List[Dict[str, Any]], context: Dict[str, Any]) -> str:
        """Generate reasoning for substitution choices"""
        try:
            if not substitutions:
                return f"No suitable substitutions found for {exercise_name}."
            
            reasoning_parts = []
            
            # Analyze why substitutions were chosen
            user_equipment = context.get('user_profile', {}).get('equipment_available', [])
            experience_level = context.get('user_profile', {}).get('experience_level', 'beginner')
            
            reasoning_parts.append(f"Selected {len(substitutions)} substitutions for {exercise_name} based on:")
            
            if user_equipment:
                reasoning_parts.append(f"- Available equipment: {', '.join(user_equipment)}")
            
            reasoning_parts.append(f"- Experience level: {experience_level}")
            
            injuries = context.get('user_profile', {}).get('injuries_or_limitations', [])
            if injuries:
                reasoning_parts.append(f"- Injury considerations: {', '.join(injuries)}")
            
            return " ".join(reasoning_parts)
            
        except Exception as e:
            logger.error(f"Error generating substitution reasoning: {e}")
            return f"Substitutions selected for {exercise_name} based on user context and exercise similarity."
    
    # Analysis helper methods
    
    async def _analyze_recent_patterns(self, recent_workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze recent workout patterns"""
        try:
            if not recent_workouts:
                return {'pattern': 'no_data'}
            
            # Analyze frequency, intensity, and volume patterns
            workout_dates = [w.get('date', '') for w in recent_workouts]
            intensities = []
            volumes = []
            
            for workout in recent_workouts:
                exercises = workout.get('exercises', [])
                
                # Calculate workout intensity
                workout_intensities = []
                workout_volume = 0
                
                for exercise in exercises:
                    weight = exercise.get('weight', 0)
                    reps = exercise.get('reps', 0)
                    sets = exercise.get('sets', 1)
                    
                    if weight > 0 and reps > 0:
                        # Calculate intensity
                        estimated_max = weight * (1 + reps / 30)
                        intensity = (weight / estimated_max) * 100
                        workout_intensities.append(intensity)
                        
                        # Calculate volume
                        volume = weight * reps * sets
                        workout_volume += volume
                
                if workout_intensities:
                    intensities.append(statistics.mean(workout_intensities))
                volumes.append(workout_volume)
            
            return {
                'frequency_per_week': len(recent_workouts) / max(1, self._calculate_days_span(workout_dates[0], workout_dates[-1]) / 7),
                'average_intensity': statistics.mean(intensities) if intensities else 0,
                'average_volume': statistics.mean(volumes) if volumes else 0,
                'workout_count': len(recent_workouts)
            }
            
        except Exception as e:
            logger.error(f"Error analyzing recent patterns: {e}")
            return {'pattern': 'error'}
    
    async def _analyze_equipment_preferences(self, recent_workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze equipment usage preferences"""
        try:
            equipment_usage = defaultdict(int)
            
            for workout in recent_workouts:
                exercises = workout.get('exercises', [])
                for exercise in exercises:
                    equipment = exercise.get('equipment', 'bodyweight')
                    equipment_usage[equipment] += 1
            
            # Sort by usage frequency
            sorted_equipment = sorted(equipment_usage.items(), key=lambda x: x[1], reverse=True)
            
            return {
                'most_used_equipment': [eq[0] for eq in sorted_equipment[:5]],
                'equipment_frequency': dict(sorted_equipment),
                'equipment_diversity': len(equipment_usage)
            }
            
        except Exception as e:
            logger.error(f"Error analyzing equipment preferences: {e}")
            return {'most_used_equipment': []}
    
    async def _analyze_exercise_preferences(self, recent_workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze exercise preferences"""
        try:
            exercise_frequency = defaultdict(int)
            exercise_intensities = defaultdict(list)
            
            for workout in recent_workouts:
                exercises = workout.get('exercises', [])
                for exercise in exercises:
                    exercise_name = exercise.get('name', '').lower()
                    exercise_frequency[exercise_name] += 1
                    
                    # Track intensity for each exercise
                    weight = exercise.get('weight', 0)
                    reps = exercise.get('reps', 0)
                    
                    if weight > 0 and reps > 0:
                        estimated_max = weight * (1 + reps / 30)
                        intensity = (weight / estimated_max) * 100
                        exercise_intensities[exercise_name].append(intensity)
            
            # Calculate average intensities
            avg_intensities = {}
            for exercise, intensities in exercise_intensities.items():
                avg_intensities[exercise] = statistics.mean(intensities)
            
            # Sort by frequency
            sorted_exercises = sorted(exercise_frequency.items(), key=lambda x: x[1], reverse=True)
            
            return {
                'most_frequent_exercises': [ex[0] for ex in sorted_exercises[:10]],
                'exercise_frequency': dict(sorted_exercises),
                'exercise_intensities': avg_intensities,
                'exercise_diversity': len(exercise_frequency)
            }
            
        except Exception as e:
            logger.error(f"Error analyzing exercise preferences: {e}")
            return {'most_frequent_exercises': []}
    
    def _calculate_days_span(self, start_date: str, end_date: str) -> int:
        """Calculate days between two dates"""
        try:
            start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            return (end - start).days
        except Exception:
            return 0
