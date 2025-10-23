import os
import json
import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timezone, timedelta
import statistics
from collections import defaultdict, Counter
import numpy as np

from user_data_service import UserDataService
from pattern_analyzer import PatternAnalyzer
from rag_service import RAGService
from bedrock_service import BedrockService

logger = logging.getLogger(__name__)

class WorkoutAdaptationService:
    """Service for intelligent workout plan adaptation based on performance and progress"""
    
    def __init__(self):
        self.table_name = os.environ.get('DYNAMODB_TABLE', 'gymcoach-ai-main')
        self.user_data_service = UserDataService(self.table_name)
        self.pattern_analyzer = PatternAnalyzer()
        self.rag_service = RAGService()
        self.bedrock_service = BedrockService()
        
        # Adaptation thresholds
        self.progress_threshold = 0.05  # 5% improvement threshold
        self.plateau_threshold_weeks = 2  # Weeks without progress
        self.fatigue_threshold = 0.8  # High intensity threshold
        self.volume_increase_limit = 0.2  # Max 20% volume increase per week
        
    async def adapt_workout_plan(self, user_id: str, current_plan: Dict[str, Any]) -> Dict[str, Any]:
        """
        Intelligently adapt a workout plan based on user performance and progress
        
        Args:
            user_id: User ID
            current_plan: Current workout plan to adapt
            
        Returns:
            Dictionary with adapted workout plan and reasoning
        """
        try:
            logger.info(f"Adapting workout plan for user {user_id}")
            
            # Get user context and performance data
            user_profile = await self.user_data_service.get_user_profile(user_id)
            recent_workouts = await self.user_data_service.get_historical_workouts(user_id, 30)
            measurements = await self.user_data_service.get_historical_measurements(user_id, 90)
            
            if not user_profile:
                return {'error': 'User profile not found'}
            
            # Analyze current performance
            performance_analysis = await self._analyze_performance_trends(recent_workouts, measurements)
            
            # Determine adaptation strategy
            adaptation_strategy = await self._determine_adaptation_strategy(
                performance_analysis, user_profile, current_plan
            )
            
            # Generate adapted plan
            adapted_plan = await self._generate_adapted_plan(
                current_plan, adaptation_strategy, user_profile, performance_analysis
            )
            
            # Add adaptation reasoning
            adaptation_result = {
                'user_id': user_id,
                'original_plan': current_plan,
                'adapted_plan': adapted_plan,
                'adaptation_strategy': adaptation_strategy,
                'performance_analysis': performance_analysis,
                'reasoning': await self._generate_adaptation_reasoning(
                    adaptation_strategy, performance_analysis
                ),
                'adaptation_date': datetime.now(timezone.utc).isoformat()
            }
            
            logger.info(f"Workout plan adapted successfully for user {user_id}")
            return adaptation_result
            
        except Exception as e:
            logger.error(f"Error adapting workout plan for user {user_id}: {e}")
            return {'error': str(e)}
    
    async def suggest_exercise_substitutions(self, user_id: str, unavailable_exercises: List[str]) -> Dict[str, Any]:
        """
        Suggest exercise substitutions using RAG-powered knowledge
        
        Args:
            user_id: User ID
            unavailable_exercises: List of exercises that are unavailable
            
        Returns:
            Dictionary with substitution suggestions
        """
        try:
            logger.info(f"Suggesting exercise substitutions for user {user_id}")
            
            # Get user context
            user_profile = await self.user_data_service.get_user_profile(user_id)
            recent_workouts = await self.user_data_service.get_recent_workouts(user_id, 10)
            
            if not user_profile:
                return {'error': 'User profile not found'}
            
            substitutions = {}
            
            for exercise_name in unavailable_exercises:
                # Use RAG to find similar exercises
                rag_context = await self.rag_service.retrieve_exercise_context(
                    query=f"exercises similar to {exercise_name}",
                    user_context={
                        'experience_level': user_profile.get('experienceLevel', 'beginner'),
                        'equipment_available': user_profile.get('equipmentAvailable', []),
                        'goals': user_profile.get('fitnessGoals', [])
                    }
                )
                
                # Generate substitution suggestions using AI
                substitution_prompt = f"""
                Suggest 3-5 exercise substitutions for "{exercise_name}" based on the user's context.
                
                User Context:
                - Experience Level: {user_profile.get('experienceLevel', 'beginner')}
                - Available Equipment: {', '.join(user_profile.get('equipmentAvailable', []))}
                - Fitness Goals: {', '.join(user_profile.get('fitnessGoals', []))}
                
                Similar Exercises Knowledge:
                {rag_context['context']}
                
                For each substitution, provide:
                1. Exercise name
                2. Why it's a good substitute
                3. Any modifications needed
                4. Difficulty level compared to original
                
                Focus on exercises that target the same muscle groups and movement patterns.
                """
                
                bedrock_result = self.bedrock_service.invoke_bedrock(
                    substitution_prompt,
                    {
                        'user_profile': user_profile,
                        'original_exercise': exercise_name,
                        'rag_context': rag_context
                    },
                    max_tokens=400
                )
                
                if bedrock_result['success']:
                    substitutions[exercise_name] = {
                        'suggestions': bedrock_result['response'],
                        'rag_sources': rag_context['sources']
                    }
                else:
                    substitutions[exercise_name] = {
                        'error': 'Failed to generate substitutions'
                    }
            
            return {
                'user_id': user_id,
                'substitutions': substitutions,
                'generated_at': datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error suggesting exercise substitutions for user {user_id}: {e}")
            return {'error': str(e)}
    
    async def adjust_workout_difficulty(self, user_id: str, workout_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Adjust workout difficulty based on performance and fatigue
        
        Args:
            user_id: User ID
            workout_data: Current workout data
            
        Returns:
            Dictionary with difficulty adjustments
        """
        try:
            logger.info(f"Adjusting workout difficulty for user {user_id}")
            
            # Get recent performance data
            recent_workouts = await self.user_data_service.get_historical_workouts(user_id, 14)
            user_profile = await self.user_data_service.get_user_profile(user_id)
            
            if not recent_workouts or not user_profile:
                return {'error': 'Insufficient data for difficulty adjustment'}
            
            # Analyze recent performance
            performance_metrics = await self._calculate_performance_metrics(recent_workouts)
            
            # Determine difficulty adjustment
            difficulty_adjustment = await self._calculate_difficulty_adjustment(
                performance_metrics, workout_data, user_profile
            )
            
            # Generate adjusted workout
            adjusted_workout = await self._apply_difficulty_adjustment(
                workout_data, difficulty_adjustment
            )
            
            return {
                'user_id': user_id,
                'original_workout': workout_data,
                'adjusted_workout': adjusted_workout,
                'difficulty_adjustment': difficulty_adjustment,
                'performance_metrics': performance_metrics,
                'reasoning': await self._generate_difficulty_reasoning(difficulty_adjustment, performance_metrics),
                'adjusted_at': datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error adjusting workout difficulty for user {user_id}: {e}")
            return {'error': str(e)}
    
    async def implement_periodization(self, user_id: str, training_plan: Dict[str, Any]) -> Dict[str, Any]:
        """
        Implement intelligent periodization based on user progress and goals
        
        Args:
            user_id: User ID
            training_plan: Current training plan
            
        Returns:
            Dictionary with periodized training plan
        """
        try:
            logger.info(f"Implementing periodization for user {user_id}")
            
            # Get user context and progress data
            user_profile = await self.user_data_service.get_user_profile(user_id)
            recent_workouts = await self.user_data_service.get_historical_workouts(user_id, 60)
            measurements = await self.user_data_service.get_historical_measurements(user_id, 120)
            
            if not user_profile:
                return {'error': 'User profile not found'}
            
            # Analyze training history for periodization
            training_analysis = await self._analyze_training_history(recent_workouts)
            
            # Determine periodization strategy
            periodization_strategy = await self._determine_periodization_strategy(
                user_profile, training_analysis, measurements
            )
            
            # Generate periodized plan
            periodized_plan = await self._generate_periodized_plan(
                training_plan, periodization_strategy, user_profile
            )
            
            return {
                'user_id': user_id,
                'original_plan': training_plan,
                'periodized_plan': periodized_plan,
                'periodization_strategy': periodization_strategy,
                'training_analysis': training_analysis,
                'reasoning': await self._generate_periodization_reasoning(periodization_strategy),
                'generated_at': datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error implementing periodization for user {user_id}: {e}")
            return {'error': str(e)}
    
    # Helper methods for workout adaptation
    
    async def _analyze_performance_trends(self, workouts: List[Dict[str, Any]], measurements: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze performance trends from workouts and measurements"""
        try:
            if not workouts:
                return {'status': 'no_data', 'message': 'No workout data available'}
            
            # Analyze workout patterns
            workout_patterns = await self.pattern_analyzer.analyze_workout_patterns(workouts)
            
            # Calculate performance metrics
            performance_metrics = {
                'strength_trend': await self._analyze_strength_trends(workouts),
                'volume_trend': await self._analyze_volume_trends(workouts),
                'intensity_trend': await self._analyze_intensity_trends(workouts),
                'consistency_score': workout_patterns.get('consistency_patterns', {}).get('consistency_score', 0.5),
                'plateau_detection': workout_patterns.get('plateau_detection', {}),
                'fatigue_indicators': await self._detect_fatigue_indicators(workouts)
            }
            
            # Analyze body composition trends
            if measurements:
                body_trends = await self._analyze_body_composition_trends(measurements)
                performance_metrics['body_composition'] = body_trends
            
            return performance_metrics
            
        except Exception as e:
            logger.error(f"Error analyzing performance trends: {e}")
            return {'error': str(e)}
    
    async def _determine_adaptation_strategy(self, performance_analysis: Dict[str, Any], user_profile: Dict[str, Any], current_plan: Dict[str, Any]) -> Dict[str, Any]:
        """Determine the best adaptation strategy based on performance analysis"""
        try:
            strategy = {
                'primary_action': 'maintain',
                'secondary_actions': [],
                'intensity_adjustment': 0.0,
                'volume_adjustment': 0.0,
                'exercise_changes': [],
                'periodization_phase': 'maintenance'
            }
            
            # Analyze performance indicators
            strength_trend = performance_analysis.get('strength_trend', {}).get('overall_trend', 'stable')
            plateau_detection = performance_analysis.get('plateau_detection', {})
            fatigue_indicators = performance_analysis.get('fatigue_indicators', {})
            consistency_score = performance_analysis.get('consistency_score', 0.5)
            
            # Determine primary action based on trends
            if plateau_detection.get('plateaus_detected', False):
                strategy['primary_action'] = 'break_plateau'
                strategy['secondary_actions'].append('change_exercises')
                strategy['secondary_actions'].append('adjust_intensity')
                strategy['intensity_adjustment'] = 0.1  # Increase intensity by 10%
                
            elif strength_trend == 'declining':
                strategy['primary_action'] = 'reduce_load'
                strategy['secondary_actions'].append('deload_week')
                strategy['intensity_adjustment'] = -0.15  # Reduce intensity by 15%
                strategy['volume_adjustment'] = -0.2  # Reduce volume by 20%
                
            elif strength_trend == 'improving' and consistency_score > 0.7:
                strategy['primary_action'] = 'progressive_overload'
                strategy['secondary_actions'].append('increase_intensity')
                strategy['intensity_adjustment'] = 0.05  # Increase intensity by 5%
                strategy['volume_adjustment'] = 0.1  # Increase volume by 10%
                
            elif fatigue_indicators.get('high_fatigue', False):
                strategy['primary_action'] = 'recovery_focus'
                strategy['secondary_actions'].append('reduce_volume')
                strategy['secondary_actions'].append('increase_rest')
                strategy['volume_adjustment'] = -0.25  # Reduce volume by 25%
                
            elif consistency_score < 0.4:
                strategy['primary_action'] = 'simplify'
                strategy['secondary_actions'].append('reduce_complexity')
                strategy['secondary_actions'].append('focus_fundamentals')
                strategy['volume_adjustment'] = -0.3  # Reduce volume by 30%
            
            # Determine periodization phase
            if strategy['primary_action'] == 'progressive_overload':
                strategy['periodization_phase'] = 'accumulation'
            elif strategy['primary_action'] == 'break_plateau':
                strategy['periodization_phase'] = 'intensification'
            elif strategy['primary_action'] == 'recovery_focus':
                strategy['periodization_phase'] = 'deload'
            else:
                strategy['periodization_phase'] = 'maintenance'
            
            return strategy
            
        except Exception as e:
            logger.error(f"Error determining adaptation strategy: {e}")
            return {'primary_action': 'maintain', 'error': str(e)}
    
    async def _generate_adapted_plan(self, current_plan: Dict[str, Any], strategy: Dict[str, Any], user_profile: Dict[str, Any], performance_analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Generate adapted workout plan based on strategy"""
        try:
            adapted_plan = current_plan.copy()
            
            # Apply intensity adjustments
            intensity_multiplier = 1.0 + strategy.get('intensity_adjustment', 0.0)
            volume_multiplier = 1.0 + strategy.get('volume_adjustment', 0.0)
            
            # Modify exercises based on strategy
            if 'exercises' in adapted_plan:
                for exercise in adapted_plan['exercises']:
                    # Adjust weight/intensity
                    if 'weight' in exercise:
                        exercise['weight'] = int(exercise['weight'] * intensity_multiplier)
                    
                    # Adjust volume (sets x reps)
                    if 'sets' in exercise:
                        exercise['sets'] = max(1, int(exercise['sets'] * volume_multiplier))
                    
                    if 'reps' in exercise:
                        exercise['reps'] = max(1, int(exercise['reps'] * volume_multiplier))
            
            # Add strategy-specific modifications
            if strategy['primary_action'] == 'break_plateau':
                adapted_plan['notes'] = adapted_plan.get('notes', '') + '\n\nPlateau-breaking modifications applied.'
                
            elif strategy['primary_action'] == 'deload_week':
                adapted_plan['notes'] = adapted_plan.get('notes', '') + '\n\nDeload week - reduced intensity for recovery.'
                
            elif strategy['primary_action'] == 'progressive_overload':
                adapted_plan['notes'] = adapted_plan.get('notes', '') + '\n\nProgressive overload applied - increased intensity.'
            
            # Add periodization information
            adapted_plan['periodization_phase'] = strategy.get('periodization_phase', 'maintenance')
            adapted_plan['adaptation_date'] = datetime.now(timezone.utc).isoformat()
            
            return adapted_plan
            
        except Exception as e:
            logger.error(f"Error generating adapted plan: {e}")
            return current_plan
    
    async def _generate_adaptation_reasoning(self, strategy: Dict[str, Any], performance_analysis: Dict[str, Any]) -> str:
        """Generate human-readable reasoning for adaptation"""
        try:
            primary_action = strategy.get('primary_action', 'maintain')
            intensity_adj = strategy.get('intensity_adjustment', 0.0)
            volume_adj = strategy.get('volume_adjustment', 0.0)
            
            reasoning_parts = []
            
            if primary_action == 'break_plateau':
                reasoning_parts.append("Plateaus detected in your training. Adjusting intensity and exercise selection to break through.")
                
            elif primary_action == 'reduce_load':
                reasoning_parts.append("Performance declining detected. Reducing training load to prevent overtraining.")
                
            elif primary_action == 'progressive_overload':
                reasoning_parts.append("Strong performance trends detected. Applying progressive overload to continue gains.")
                
            elif primary_action == 'recovery_focus':
                reasoning_parts.append("High fatigue indicators detected. Focusing on recovery and reducing training volume.")
                
            elif primary_action == 'simplify':
                reasoning_parts.append("Low consistency detected. Simplifying program to build sustainable habits.")
            
            # Add specific adjustments
            if intensity_adj != 0:
                direction = "increased" if intensity_adj > 0 else "decreased"
                percentage = abs(intensity_adj) * 100
                reasoning_parts.append(f"Training intensity {direction} by {percentage:.0f}%.")
            
            if volume_adj != 0:
                direction = "increased" if volume_adj > 0 else "decreased"
                percentage = abs(volume_adj) * 100
                reasoning_parts.append(f"Training volume {direction} by {percentage:.0f}%.")
            
            return " ".join(reasoning_parts)
            
        except Exception as e:
            logger.error(f"Error generating adaptation reasoning: {e}")
            return "Workout plan adapted based on performance analysis."
    
    async def _calculate_performance_metrics(self, workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate performance metrics from recent workouts"""
        try:
            if not workouts:
                return {'status': 'no_data'}
            
            metrics = {
                'avg_intensity': 0.0,
                'avg_volume': 0.0,
                'consistency_score': 0.0,
                'strength_progression': {},
                'fatigue_score': 0.0
            }
            
            # Calculate average intensity and volume
            intensities = []
            volumes = []
            
            for workout in workouts:
                exercises = workout.get('exercises', [])
                workout_intensity = 0
                workout_volume = 0
                
                for exercise in exercises:
                    weight = exercise.get('weight', 0)
                    reps = exercise.get('reps', 0)
                    sets = exercise.get('sets', 1)
                    
                    if weight > 0 and reps > 0:
                        # Calculate intensity as percentage of estimated max
                        estimated_max = weight * (1 + reps / 30)
                        intensity = (weight / estimated_max) * 100
                        workout_intensity += intensity
                        
                        # Calculate volume
                        volume = weight * reps * sets
                        workout_volume += volume
                
                if exercises:
                    intensities.append(workout_intensity / len(exercises))
                    volumes.append(workout_volume)
            
            if intensities:
                metrics['avg_intensity'] = statistics.mean(intensities)
                metrics['avg_volume'] = statistics.mean(volumes)
            
            # Calculate consistency score
            gaps = self._calculate_workout_gaps(workouts)
            if gaps:
                avg_gap = statistics.mean(gaps)
                std_gap = statistics.stdev(gaps) if len(gaps) > 1 else 0
                metrics['consistency_score'] = max(0, 1 - (std_gap / max(avg_gap, 1)))
            
            # Calculate fatigue score based on recent intensity trends
            if len(intensities) >= 3:
                recent_avg = statistics.mean(intensities[-3:])
                earlier_avg = statistics.mean(intensities[:3])
                metrics['fatigue_score'] = min(1.0, recent_avg / max(earlier_avg, 1))
            
            return metrics
            
        except Exception as e:
            logger.error(f"Error calculating performance metrics: {e}")
            return {'error': str(e)}
    
    async def _calculate_difficulty_adjustment(self, performance_metrics: Dict[str, Any], workout_data: Dict[str, Any], user_profile: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate difficulty adjustment based on performance metrics"""
        try:
            adjustment = {
                'intensity_change': 0.0,
                'volume_change': 0.0,
                'complexity_change': 0.0,
                'reasoning': []
            }
            
            avg_intensity = performance_metrics.get('avg_intensity', 0)
            consistency_score = performance_metrics.get('consistency_score', 0.5)
            fatigue_score = performance_metrics.get('fatigue_score', 0.5)
            
            # Adjust based on intensity trends
            if avg_intensity > 85:  # Very high intensity
                adjustment['intensity_change'] = -0.1  # Reduce intensity
                adjustment['reasoning'].append("High intensity detected - reducing difficulty")
                
            elif avg_intensity < 60:  # Low intensity
                adjustment['intensity_change'] = 0.1  # Increase intensity
                adjustment['reasoning'].append("Low intensity detected - increasing difficulty")
            
            # Adjust based on consistency
            if consistency_score < 0.4:
                adjustment['volume_change'] = -0.2  # Reduce volume
                adjustment['complexity_change'] = -0.3  # Reduce complexity
                adjustment['reasoning'].append("Low consistency - simplifying workout")
                
            elif consistency_score > 0.8:
                adjustment['volume_change'] = 0.1  # Increase volume
                adjustment['reasoning'].append("High consistency - increasing volume")
            
            # Adjust based on fatigue
            if fatigue_score > 0.8:
                adjustment['intensity_change'] = -0.15  # Reduce intensity
                adjustment['volume_change'] = -0.2  # Reduce volume
                adjustment['reasoning'].append("High fatigue detected - reducing load")
            
            return adjustment
            
        except Exception as e:
            logger.error(f"Error calculating difficulty adjustment: {e}")
            return {'intensity_change': 0.0, 'volume_change': 0.0, 'error': str(e)}
    
    async def _apply_difficulty_adjustment(self, workout_data: Dict[str, Any], adjustment: Dict[str, Any]) -> Dict[str, Any]:
        """Apply difficulty adjustments to workout"""
        try:
            adjusted_workout = workout_data.copy()
            
            intensity_multiplier = 1.0 + adjustment.get('intensity_change', 0.0)
            volume_multiplier = 1.0 + adjustment.get('volume_change', 0.0)
            
            # Apply adjustments to exercises
            if 'exercises' in adjusted_workout:
                for exercise in adjusted_workout['exercises']:
                    # Adjust weight/intensity
                    if 'weight' in exercise:
                        exercise['weight'] = max(1, int(exercise['weight'] * intensity_multiplier))
                    
                    # Adjust sets and reps
                    if 'sets' in exercise:
                        exercise['sets'] = max(1, int(exercise['sets'] * volume_multiplier))
                    
                    if 'reps' in exercise:
                        exercise['reps'] = max(1, int(exercise['reps'] * volume_multiplier))
            
            # Add adjustment notes
            reasoning = adjustment.get('reasoning', [])
            if reasoning:
                adjusted_workout['adjustment_notes'] = '; '.join(reasoning)
            
            return adjusted_workout
            
        except Exception as e:
            logger.error(f"Error applying difficulty adjustment: {e}")
            return workout_data
    
    async def _generate_difficulty_reasoning(self, adjustment: Dict[str, Any], performance_metrics: Dict[str, Any]) -> str:
        """Generate reasoning for difficulty adjustment"""
        try:
            reasoning_parts = []
            
            intensity_change = adjustment.get('intensity_change', 0.0)
            volume_change = adjustment.get('volume_change', 0.0)
            
            if intensity_change > 0:
                reasoning_parts.append(f"Increasing intensity by {intensity_change*100:.0f}% based on performance trends.")
            elif intensity_change < 0:
                reasoning_parts.append(f"Reducing intensity by {abs(intensity_change)*100:.0f}% to prevent overtraining.")
            
            if volume_change > 0:
                reasoning_parts.append(f"Increasing volume by {volume_change*100:.0f}% due to good consistency.")
            elif volume_change < 0:
                reasoning_parts.append(f"Reducing volume by {abs(volume_change)*100:.0f}% to improve consistency.")
            
            if not reasoning_parts:
                reasoning_parts.append("No adjustments needed - performance is optimal.")
            
            return " ".join(reasoning_parts)
            
        except Exception as e:
            logger.error(f"Error generating difficulty reasoning: {e}")
            return "Difficulty adjusted based on performance analysis."
    
    # Additional helper methods for periodization and analysis
    
    async def _analyze_strength_trends(self, workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze strength progression trends"""
        try:
            if len(workouts) < 5:
                return {'overall_trend': 'insufficient_data'}
            
            # Track progression for major exercises
            progression_data = defaultdict(list)
            
            for workout in workouts:
                exercises = workout.get('exercises', [])
                workout_date = workout.get('date', '')
                
                for exercise in exercises:
                    exercise_name = exercise.get('name', '').lower()
                    weight = exercise.get('weight', 0)
                    reps = exercise.get('reps', 0)
                    
                    if weight > 0 and reps > 0:
                        # Calculate estimated 1RM
                        estimated_1rm = weight * (1 + reps / 30)
                        progression_data[exercise_name].append({
                            'date': workout_date,
                            'estimated_1rm': estimated_1rm
                        })
            
            # Calculate overall trend
            improving_exercises = 0
            total_exercises = 0
            
            for exercise, data in progression_data.items():
                if len(data) >= 3:
                    total_exercises += 1
                    sorted_data = sorted(data, key=lambda x: x['date'])
                    first_1rm = sorted_data[0]['estimated_1rm']
                    last_1rm = sorted_data[-1]['estimated_1rm']
                    improvement = ((last_1rm - first_1rm) / first_1rm) * 100
                    
                    if improvement > 5:
                        improving_exercises += 1
            
            if total_exercises == 0:
                return {'overall_trend': 'insufficient_data'}
            
            improvement_ratio = improving_exercises / total_exercises
            
            if improvement_ratio >= 0.6:
                return {'overall_trend': 'improving', 'improvement_ratio': improvement_ratio}
            elif improvement_ratio <= 0.2:
                return {'overall_trend': 'declining', 'improvement_ratio': improvement_ratio}
            else:
                return {'overall_trend': 'stable', 'improvement_ratio': improvement_ratio}
                
        except Exception as e:
            logger.error(f"Error analyzing strength trends: {e}")
            return {'overall_trend': 'stable'}
    
    async def _analyze_volume_trends(self, workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze training volume trends"""
        try:
            if len(workouts) < 5:
                return {'trend': 'insufficient_data'}
            
            volumes = []
            for workout in workouts:
                exercises = workout.get('exercises', [])
                workout_volume = sum(
                    ex.get('weight', 0) * ex.get('reps', 0) * ex.get('sets', 1)
                    for ex in exercises
                )
                volumes.append(workout_volume)
            
            if len(volumes) >= 3:
                # Simple trend detection
                recent_avg = statistics.mean(volumes[-3:])
                earlier_avg = statistics.mean(volumes[:3])
                
                if recent_avg > earlier_avg * 1.1:
                    return {'trend': 'increasing', 'change_percent': ((recent_avg - earlier_avg) / earlier_avg) * 100}
                elif recent_avg < earlier_avg * 0.9:
                    return {'trend': 'decreasing', 'change_percent': ((recent_avg - earlier_avg) / earlier_avg) * 100}
                else:
                    return {'trend': 'stable', 'change_percent': 0}
            
            return {'trend': 'stable'}
            
        except Exception as e:
            logger.error(f"Error analyzing volume trends: {e}")
            return {'trend': 'stable'}
    
    async def _analyze_intensity_trends(self, workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze training intensity trends"""
        try:
            if len(workouts) < 5:
                return {'trend': 'insufficient_data'}
            
            intensities = []
            for workout in workouts:
                exercises = workout.get('exercises', [])
                workout_intensity = 0
                
                for exercise in exercises:
                    weight = exercise.get('weight', 0)
                    reps = exercise.get('reps', 0)
                    
                    if weight > 0 and reps > 0:
                        # Calculate intensity as percentage of estimated max
                        estimated_max = weight * (1 + reps / 30)
                        intensity = (weight / estimated_max) * 100
                        workout_intensity += intensity
                
                if exercises:
                    intensities.append(workout_intensity / len(exercises))
            
            if len(intensities) >= 3:
                recent_avg = statistics.mean(intensities[-3:])
                earlier_avg = statistics.mean(intensities[:3])
                
                if recent_avg > earlier_avg * 1.05:
                    return {'trend': 'increasing', 'avg_intensity': recent_avg}
                elif recent_avg < earlier_avg * 0.95:
                    return {'trend': 'decreasing', 'avg_intensity': recent_avg}
                else:
                    return {'trend': 'stable', 'avg_intensity': recent_avg}
            
            return {'trend': 'stable'}
            
        except Exception as e:
            logger.error(f"Error analyzing intensity trends: {e}")
            return {'trend': 'stable'}
    
    async def _detect_fatigue_indicators(self, workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Detect fatigue indicators from workout data"""
        try:
            if len(workouts) < 5:
                return {'high_fatigue': False, 'indicators': []}
            
            indicators = []
            high_fatigue = False
            
            # Analyze recent performance vs earlier performance
            recent_workouts = workouts[-3:]
            earlier_workouts = workouts[:3]
            
            recent_volumes = []
            earlier_volumes = []
            
            for workout in recent_workouts:
                exercises = workout.get('exercises', [])
                volume = sum(
                    ex.get('weight', 0) * ex.get('reps', 0) * ex.get('sets', 1)
                    for ex in exercises
                )
                recent_volumes.append(volume)
            
            for workout in earlier_workouts:
                exercises = workout.get('exercises', [])
                volume = sum(
                    ex.get('weight', 0) * ex.get('reps', 0) * ex.get('sets', 1)
                    for ex in exercises
                )
                earlier_volumes.append(volume)
            
            if recent_volumes and earlier_volumes:
                recent_avg = statistics.mean(recent_volumes)
                earlier_avg = statistics.mean(earlier_volumes)
                
                # Significant drop in volume might indicate fatigue
                if recent_avg < earlier_avg * 0.8:
                    indicators.append('Significant drop in training volume')
                    high_fatigue = True
            
            return {
                'high_fatigue': high_fatigue,
                'indicators': indicators,
                'fatigue_score': min(1.0, recent_avg / max(earlier_avg, 1)) if recent_volumes and earlier_volumes else 0.5
            }
            
        except Exception as e:
            logger.error(f"Error detecting fatigue indicators: {e}")
            return {'high_fatigue': False, 'indicators': [], 'error': str(e)}
    
    async def _analyze_body_composition_trends(self, measurements: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze body composition trends"""
        try:
            if len(measurements) < 2:
                return {'trend': 'insufficient_data'}
            
            # Sort by date
            sorted_measurements = sorted(measurements, key=lambda x: x.get('date', ''))
            
            # Calculate trends
            weights = [m.get('weight', 0) for m in sorted_measurements if m.get('weight', 0) > 0]
            
            if len(weights) >= 2:
                weight_change = weights[-1] - weights[0]
                weight_change_percent = (weight_change / weights[0]) * 100 if weights[0] > 0 else 0
                
                if weight_change_percent < -2:
                    return {'trend': 'improving', 'weight_change_percent': weight_change_percent}
                elif weight_change_percent > 2:
                    return {'trend': 'declining', 'weight_change_percent': weight_change_percent}
                else:
                    return {'trend': 'stable', 'weight_change_percent': weight_change_percent}
            
            return {'trend': 'stable'}
            
        except Exception as e:
            logger.error(f"Error analyzing body composition trends: {e}")
            return {'trend': 'stable'}
    
    def _calculate_workout_gaps(self, workouts: List[Dict[str, Any]]) -> List[int]:
        """Calculate gaps between workouts in days"""
        gaps = []
        sorted_workouts = sorted(workouts, key=lambda x: x.get('date', ''))
        
        for i in range(1, len(sorted_workouts)):
            try:
                prev_date = datetime.fromisoformat(sorted_workouts[i-1].get('date', '').replace('Z', '+00:00'))
                curr_date = datetime.fromisoformat(sorted_workouts[i].get('date', '').replace('Z', '+00:00'))
                gap = (curr_date - prev_date).days
                gaps.append(gap)
            except Exception:
                continue
        
        return gaps
    
    async def assess_injury_risk(self, user_id: str, workout_plan: Dict[str, Any]) -> Dict[str, Any]:
        """
        Assess injury risk for a workout plan
        
        Args:
            user_id: User ID
            workout_plan: Workout plan to assess
            
        Returns:
            Dictionary with injury risk assessment
        """
        try:
            logger.info(f"Assessing injury risk for user {user_id}")
            
            # Get user context
            user_profile = await self.user_data_service.get_user_profile(user_id)
            recent_workouts = await self.user_data_service.get_historical_workouts(user_id, 30)
            measurements = await self.user_data_service.get_historical_measurements(user_id, 90)
            
            if not user_profile:
                return {'error': 'User profile not found'}
            
            # Analyze injury risk factors
            risk_factors = await self._analyze_injury_risk_factors(
                user_profile, recent_workouts, measurements, workout_plan
            )
            
            # Generate injury prevention recommendations
            prevention_recommendations = await self._generate_injury_prevention_recommendations(
                risk_factors, user_profile, workout_plan
            )
            
            # Calculate overall risk score
            overall_risk_score = await self._calculate_overall_risk_score(risk_factors)
            
            return {
                'user_id': user_id,
                'workout_plan': workout_plan,
                'risk_factors': risk_factors,
                'overall_risk_score': overall_risk_score,
                'risk_level': self._determine_risk_level(overall_risk_score),
                'prevention_recommendations': prevention_recommendations,
                'assessment_date': datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error assessing injury risk for user {user_id}: {e}")
            return {'error': str(e)}
    
    async def _analyze_injury_risk_factors(self, user_profile: Dict[str, Any], recent_workouts: List[Dict[str, Any]], measurements: List[Dict[str, Any]], workout_plan: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze various injury risk factors"""
        try:
            risk_factors = {
                'training_load_risk': await self._assess_training_load_risk(recent_workouts, workout_plan),
                'movement_pattern_risk': await self._assess_movement_pattern_risk(recent_workouts, workout_plan),
                'fatigue_risk': await self._assess_fatigue_risk(recent_workouts),
                'imbalance_risk': await self._assess_muscle_imbalance_risk(recent_workouts),
                'progression_risk': await self._assess_progression_risk(recent_workouts, workout_plan),
                'equipment_risk': await self._assess_equipment_risk(user_profile, workout_plan),
                'injury_history_risk': await self._assess_injury_history_risk(user_profile),
                'age_fitness_risk': await self._assess_age_fitness_risk(user_profile, measurements)
            }
            
            return risk_factors
            
        except Exception as e:
            logger.error(f"Error analyzing injury risk factors: {e}")
            return {'error': str(e)}
    
    async def _assess_training_load_risk(self, recent_workouts: List[Dict[str, Any]], workout_plan: Dict[str, Any]) -> Dict[str, Any]:
        """Assess training load-related injury risk"""
        try:
            if not recent_workouts:
                return {'risk_score': 0.3, 'factors': ['Insufficient training history']}
            
            # Calculate recent training load
            recent_volumes = []
            recent_intensities = []
            
            for workout in recent_workouts[-7:]:  # Last week
                exercises = workout.get('exercises', [])
                workout_volume = 0
                workout_intensities = []
                
                for exercise in exercises:
                    weight = exercise.get('weight', 0)
                    reps = exercise.get('reps', 0)
                    sets = exercise.get('sets', 1)
                    
                    if weight > 0 and reps > 0:
                        volume = weight * reps * sets
                        workout_volume += volume
                        
                        # Calculate intensity
                        estimated_max = weight * (1 + reps / 30)
                        intensity = (weight / estimated_max) * 100
                        workout_intensities.append(intensity)
                
                recent_volumes.append(workout_volume)
                if workout_intensities:
                    recent_intensities.append(statistics.mean(workout_intensities))
            
            # Calculate planned load
            planned_exercises = workout_plan.get('exercises', [])
            planned_volume = sum(
                ex.get('weight', 0) * ex.get('reps', 0) * ex.get('sets', 1)
                for ex in planned_exercises
            )
            
            # Assess load progression
            avg_recent_volume = statistics.mean(recent_volumes) if recent_volumes else 0
            load_increase = ((planned_volume - avg_recent_volume) / max(avg_recent_volume, 1)) * 100 if avg_recent_volume > 0 else 0
            
            risk_factors = []
            risk_score = 0.0
            
            # High load increase risk
            if load_increase > 20:
                risk_factors.append(f'High load increase: {load_increase:.1f}%')
                risk_score += 0.4
            elif load_increase > 10:
                risk_factors.append(f'Moderate load increase: {load_increase:.1f}%')
                risk_score += 0.2
            
            # High intensity risk
            if recent_intensities:
                avg_intensity = statistics.mean(recent_intensities)
                if avg_intensity > 85:
                    risk_factors.append(f'High training intensity: {avg_intensity:.1f}%')
                    risk_score += 0.3
                elif avg_intensity > 75:
                    risk_factors.append(f'Moderate-high intensity: {avg_intensity:.1f}%')
                    risk_score += 0.1
            
            # Volume consistency risk
            if recent_volumes:
                volume_std = statistics.stdev(recent_volumes) if len(recent_volumes) > 1 else 0
                volume_cv = volume_std / max(statistics.mean(recent_volumes), 1)
                if volume_cv > 0.3:
                    risk_factors.append('Inconsistent training volume')
                    risk_score += 0.2
            
            return {
                'risk_score': min(1.0, risk_score),
                'factors': risk_factors,
                'load_increase_percent': load_increase,
                'recent_avg_volume': avg_recent_volume,
                'planned_volume': planned_volume
            }
            
        except Exception as e:
            logger.error(f"Error assessing training load risk: {e}")
            return {'risk_score': 0.5, 'factors': ['Assessment error']}
    
    async def _assess_movement_pattern_risk(self, recent_workouts: List[Dict[str, Any]], workout_plan: Dict[str, Any]) -> Dict[str, Any]:
        """Assess movement pattern-related injury risk"""
        try:
            # Analyze exercise patterns in recent workouts
            exercise_patterns = defaultdict(int)
            movement_patterns = defaultdict(int)
            
            for workout in recent_workouts:
                exercises = workout.get('exercises', [])
                for exercise in exercises:
                    exercise_name = exercise.get('name', '').lower()
                    exercise_patterns[exercise_name] += 1
                    
                    # Categorize movement patterns (simplified)
                    if any(word in exercise_name for word in ['squat', 'lunge', 'leg press']):
                        movement_patterns['knee_dominant'] += 1
                    elif any(word in exercise_name for word in ['deadlift', 'hip thrust', 'romanian']):
                        movement_patterns['hip_dominant'] += 1
                    elif any(word in exercise_name for word in ['press', 'push', 'bench']):
                        movement_patterns['push'] += 1
                    elif any(word in exercise_name for word in ['pull', 'row', 'lat']):
                        movement_patterns['pull'] += 1
            
            # Analyze planned workout patterns
            planned_exercises = workout_plan.get('exercises', [])
            planned_patterns = defaultdict(int)
            
            for exercise in planned_exercises:
                exercise_name = exercise.get('name', '').lower()
                if any(word in exercise_name for word in ['squat', 'lunge', 'leg press']):
                    planned_patterns['knee_dominant'] += 1
                elif any(word in exercise_name for word in ['deadlift', 'hip thrust', 'romanian']):
                    planned_patterns['hip_dominant'] += 1
                elif any(word in exercise_name for word in ['press', 'push', 'bench']):
                    planned_patterns['push'] += 1
                elif any(word in exercise_name for word in ['pull', 'row', 'lat']):
                    planned_patterns['pull'] += 1
            
            risk_factors = []
            risk_score = 0.0
            
            # Check for movement pattern imbalances
            total_patterns = sum(movement_patterns.values())
            if total_patterns > 0:
                push_pull_ratio = movement_patterns['push'] / max(movement_patterns['pull'], 1)
                if push_pull_ratio > 2:
                    risk_factors.append('Push/pull imbalance (too much pushing)')
                    risk_score += 0.3
                elif push_pull_ratio < 0.5:
                    risk_factors.append('Push/pull imbalance (too much pulling)')
                    risk_score += 0.3
                
                knee_hip_ratio = movement_patterns['knee_dominant'] / max(movement_patterns['hip_dominant'], 1)
                if knee_hip_ratio > 2:
                    risk_factors.append('Knee/hip dominant imbalance')
                    risk_score += 0.2
            
            # Check for repetitive patterns
            if len(exercise_patterns) < 5 and total_patterns > 10:
                risk_factors.append('Limited exercise variety')
                risk_score += 0.2
            
            # Check for high-risk exercises
            high_risk_exercises = ['overhead', 'snatch', 'clean', 'jerk', 'plyometric']
            for exercise_name in exercise_patterns:
                if any(risk_word in exercise_name for risk_word in high_risk_exercises):
                    risk_factors.append(f'High-risk exercise: {exercise_name}')
                    risk_score += 0.1
            
            return {
                'risk_score': min(1.0, risk_score),
                'factors': risk_factors,
                'movement_patterns': dict(movement_patterns),
                'planned_patterns': dict(planned_patterns),
                'exercise_variety': len(exercise_patterns)
            }
            
        except Exception as e:
            logger.error(f"Error assessing movement pattern risk: {e}")
            return {'risk_score': 0.3, 'factors': ['Assessment error']}
    
    async def _assess_fatigue_risk(self, recent_workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Assess fatigue-related injury risk"""
        try:
            if len(recent_workouts) < 5:
                return {'risk_score': 0.3, 'factors': ['Insufficient data']}
            
            # Analyze recent performance trends
            recent_performance = []
            earlier_performance = []
            
            # Split workouts into recent and earlier
            mid_point = len(recent_workouts) // 2
            recent_workouts_subset = recent_workouts[mid_point:]
            earlier_workouts_subset = recent_workouts[:mid_point]
            
            # Calculate performance metrics
            for workout in recent_workouts_subset:
                exercises = workout.get('exercises', [])
                workout_performance = sum(
                    ex.get('weight', 0) * ex.get('reps', 0) * ex.get('sets', 1)
                    for ex in exercises
                )
                recent_performance.append(workout_performance)
            
            for workout in earlier_workouts_subset:
                exercises = workout.get('exercises', [])
                workout_performance = sum(
                    ex.get('weight', 0) * ex.get('reps', 0) * ex.get('sets', 1)
                    for ex in exercises
                )
                earlier_performance.append(workout_performance)
            
            risk_factors = []
            risk_score = 0.0
            
            if recent_performance and earlier_performance:
                recent_avg = statistics.mean(recent_performance)
                earlier_avg = statistics.mean(earlier_performance)
                
                # Performance decline indicates fatigue
                performance_drop = ((earlier_avg - recent_avg) / max(earlier_avg, 1)) * 100
                
                if performance_drop > 20:
                    risk_factors.append(f'Significant performance decline: {performance_drop:.1f}%')
                    risk_score += 0.5
                elif performance_drop > 10:
                    risk_factors.append(f'Moderate performance decline: {performance_drop:.1f}%')
                    risk_score += 0.3
            
            # Check workout frequency
            workout_dates = [w.get('date', '') for w in recent_workouts]
            if len(workout_dates) >= 2:
                try:
                    start_date = datetime.fromisoformat(workout_dates[0].replace('Z', '+00:00'))
                    end_date = datetime.fromisoformat(workout_dates[-1].replace('Z', '+00:00'))
                    days_span = (end_date - start_date).days
                    frequency = len(recent_workouts) / max(days_span / 7, 1)
                    
                    if frequency > 6:  # More than 6 workouts per week
                        risk_factors.append(f'Very high training frequency: {frequency:.1f} workouts/week')
                        risk_score += 0.4
                    elif frequency > 5:
                        risk_factors.append(f'High training frequency: {frequency:.1f} workouts/week')
                        risk_score += 0.2
                except Exception:
                    pass
            
            return {
                'risk_score': min(1.0, risk_score),
                'factors': risk_factors,
                'performance_trend': performance_drop if recent_performance and earlier_performance else 0,
                'training_frequency': frequency if 'frequency' in locals() else 0
            }
            
        except Exception as e:
            logger.error(f"Error assessing fatigue risk: {e}")
            return {'risk_score': 0.3, 'factors': ['Assessment error']}
    
    async def _assess_muscle_imbalance_risk(self, recent_workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Assess muscle imbalance-related injury risk"""
        try:
            # Analyze muscle group training frequency
            muscle_groups = defaultdict(int)
            
            for workout in recent_workouts:
                exercises = workout.get('exercises', [])
                for exercise in exercises:
                    exercise_name = exercise.get('name', '').lower()
                    
                    # Categorize by muscle groups (simplified)
                    if any(word in exercise_name for word in ['chest', 'bench', 'press']):
                        muscle_groups['chest'] += 1
                    elif any(word in exercise_name for word in ['back', 'row', 'pull', 'lat']):
                        muscle_groups['back'] += 1
                    elif any(word in exercise_name for word in ['shoulder', 'deltoid', 'overhead']):
                        muscle_groups['shoulders'] += 1
                    elif any(word in exercise_name for word in ['bicep', 'curl']):
                        muscle_groups['biceps'] += 1
                    elif any(word in exercise_name for word in ['tricep', 'extension']):
                        muscle_groups['triceps'] += 1
                    elif any(word in exercise_name for word in ['quad', 'squat', 'leg press']):
                        muscle_groups['quads'] += 1
                    elif any(word in exercise_name for word in ['hamstring', 'deadlift', 'romanian']):
                        muscle_groups['hamstrings'] += 1
                    elif any(word in exercise_name for word in ['glute', 'hip', 'thrust']):
                        muscle_groups['glutes'] += 1
            
            risk_factors = []
            risk_score = 0.0
            
            # Check for common imbalances
            if muscle_groups['chest'] > muscle_groups['back'] * 1.5:
                risk_factors.append('Chest/back imbalance (rounded shoulders risk)')
                risk_score += 0.3
            
            if muscle_groups['quads'] > muscle_groups['hamstrings'] * 2:
                risk_factors.append('Quad/hamstring imbalance (knee injury risk)')
                risk_score += 0.3
            
            if muscle_groups['biceps'] > muscle_groups['triceps'] * 1.5:
                risk_factors.append('Bicep/tricep imbalance')
                risk_score += 0.2
            
            # Check for neglected muscle groups
            total_exercises = sum(muscle_groups.values())
            if total_exercises > 0:
                for muscle_group, count in muscle_groups.items():
                    if count == 0 and total_exercises > 10:
                        risk_factors.append(f'Neglected muscle group: {muscle_group}')
                        risk_score += 0.1
            
            return {
                'risk_score': min(1.0, risk_score),
                'factors': risk_factors,
                'muscle_group_frequency': dict(muscle_groups),
                'imbalance_score': risk_score
            }
            
        except Exception as e:
            logger.error(f"Error assessing muscle imbalance risk: {e}")
            return {'risk_score': 0.3, 'factors': ['Assessment error']}
    
    async def _assess_progression_risk(self, recent_workouts: List[Dict[str, Any]], workout_plan: Dict[str, Any]) -> Dict[str, Any]:
        """Assess progression-related injury risk"""
        try:
            # Analyze progression patterns
            progression_data = defaultdict(list)
            
            for workout in recent_workouts:
                exercises = workout.get('exercises', [])
                workout_date = workout.get('date', '')
                
                for exercise in exercises:
                    exercise_name = exercise.get('name', '').lower()
                    weight = exercise.get('weight', 0)
                    reps = exercise.get('reps', 0)
                    
                    if weight > 0 and reps > 0:
                        estimated_1rm = weight * (1 + reps / 30)
                        progression_data[exercise_name].append({
                            'date': workout_date,
                            'estimated_1rm': estimated_1rm,
                            'weight': weight,
                            'reps': reps
                        })
            
            risk_factors = []
            risk_score = 0.0
            
            # Check for rapid progression
            for exercise_name, data in progression_data.items():
                if len(data) >= 3:
                    sorted_data = sorted(data, key=lambda x: x['date'])
                    first_1rm = sorted_data[0]['estimated_1rm']
                    last_1rm = sorted_data[-1]['estimated_1rm']
                    
                    days_span = self._calculate_days_span(sorted_data[0]['date'], sorted_data[-1]['date'])
                    if days_span > 0:
                        weekly_progression = ((last_1rm - first_1rm) / first_1rm) * 100 / (days_span / 7)
                        
                        if weekly_progression > 10:  # More than 10% per week
                            risk_factors.append(f'Rapid progression in {exercise_name}: {weekly_progression:.1f}% per week')
                            risk_score += 0.4
                        elif weekly_progression > 5:
                            risk_factors.append(f'Fast progression in {exercise_name}: {weekly_progression:.1f}% per week')
                            risk_score += 0.2
            
            # Check planned progression
            planned_exercises = workout_plan.get('exercises', [])
            for exercise in planned_exercises:
                exercise_name = exercise.get('name', '').lower()
                planned_weight = exercise.get('weight', 0)
                
                if exercise_name in progression_data:
                    recent_data = progression_data[exercise_name][-3:]  # Last 3 instances
                    if recent_data:
                        recent_avg_weight = statistics.mean([d['weight'] for d in recent_data])
                        weight_increase = ((planned_weight - recent_avg_weight) / max(recent_avg_weight, 1)) * 100
                        
                        if weight_increase > 15:
                            risk_factors.append(f'Large weight jump in {exercise_name}: {weight_increase:.1f}%')
                            risk_score += 0.3
                        elif weight_increase > 10:
                            risk_factors.append(f'Moderate weight jump in {exercise_name}: {weight_increase:.1f}%')
                            risk_score += 0.1
            
            return {
                'risk_score': min(1.0, risk_score),
                'factors': risk_factors,
                'progression_data': {k: len(v) for k, v in progression_data.items()}
            }
            
        except Exception as e:
            logger.error(f"Error assessing progression risk: {e}")
            return {'risk_score': 0.3, 'factors': ['Assessment error']}
    
    async def _assess_equipment_risk(self, user_profile: Dict[str, Any], workout_plan: Dict[str, Any]) -> Dict[str, Any]:
        """Assess equipment-related injury risk"""
        try:
            available_equipment = user_profile.get('equipmentAvailable', [])
            planned_exercises = workout_plan.get('exercises', [])
            
            risk_factors = []
            risk_score = 0.0
            
            # Check for equipment mismatches
            for exercise in planned_exercises:
                exercise_name = exercise.get('name', '').lower()
                required_equipment = exercise.get('equipment', 'bodyweight')
                
                if required_equipment != 'bodyweight' and required_equipment not in available_equipment:
                    risk_factors.append(f'Missing equipment for {exercise_name}: {required_equipment}')
                    risk_score += 0.2
            
            # Check for high-risk equipment usage
            high_risk_equipment = ['barbell', 'dumbbell', 'kettlebell']
            for exercise in planned_exercises:
                exercise_name = exercise.get('name', '').lower()
                weight = exercise.get('weight', 0)
                
                if any(equipment in exercise_name for equipment in high_risk_equipment) and weight > 0:
                    # Check if weight is appropriate for user level
                    experience_level = user_profile.get('experienceLevel', 'beginner')
                    
                    if experience_level == 'beginner' and weight > 50:  # kg
                        risk_factors.append(f'High weight for beginner: {weight}kg in {exercise_name}')
                        risk_score += 0.3
                    elif experience_level == 'intermediate' and weight > 100:
                        risk_factors.append(f'Very high weight for intermediate: {weight}kg in {exercise_name}')
                        risk_score += 0.2
            
            return {
                'risk_score': min(1.0, risk_score),
                'factors': risk_factors,
                'available_equipment': available_equipment,
                'equipment_mismatches': len([f for f in risk_factors if 'Missing equipment' in f])
            }
            
        except Exception as e:
            logger.error(f"Error assessing equipment risk: {e}")
            return {'risk_score': 0.3, 'factors': ['Assessment error']}
    
    async def _assess_injury_history_risk(self, user_profile: Dict[str, Any]) -> Dict[str, Any]:
        """Assess injury history-related risk"""
        try:
            injuries_or_limitations = user_profile.get('injuriesOrLimitations', [])
            
            risk_factors = []
            risk_score = 0.0
            
            if injuries_or_limitations:
                risk_factors.append(f'Previous injuries/limitations: {", ".join(injuries_or_limitations)}')
                risk_score += 0.4
                
                # Check for specific high-risk injuries
                high_risk_injuries = ['back', 'spine', 'knee', 'shoulder', 'neck']
                for injury in injuries_or_limitations:
                    if any(risk_word in injury.lower() for risk_word in high_risk_injuries):
                        risk_factors.append(f'High-risk injury history: {injury}')
                        risk_score += 0.2
            
            return {
                'risk_score': min(1.0, risk_score),
                'factors': risk_factors,
                'injury_count': len(injuries_or_limitations),
                'has_injury_history': len(injuries_or_limitations) > 0
            }
            
        except Exception as e:
            logger.error(f"Error assessing injury history risk: {e}")
            return {'risk_score': 0.3, 'factors': ['Assessment error']}
    
    async def _assess_age_fitness_risk(self, user_profile: Dict[str, Any], measurements: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Assess age and fitness level-related risk"""
        try:
            age = user_profile.get('age', 0)
            experience_level = user_profile.get('experienceLevel', 'beginner')
            
            risk_factors = []
            risk_score = 0.0
            
            # Age-related risk
            if age > 50:
                risk_factors.append(f'Age-related risk: {age} years old')
                risk_score += 0.2
            elif age > 40:
                risk_factors.append(f'Moderate age-related risk: {age} years old')
                risk_score += 0.1
            
            # Experience level risk
            if experience_level == 'beginner':
                risk_factors.append('Beginner level - higher injury risk')
                risk_score += 0.3
            elif experience_level == 'intermediate':
                risk_factors.append('Intermediate level - moderate risk')
                risk_score += 0.1
            
            # Fitness level assessment (if measurements available)
            if measurements:
                recent_measurements = sorted(measurements, key=lambda x: x.get('date', ''))[-1]
                weight = recent_measurements.get('weight', 0)
                height = recent_measurements.get('height', 0)
                
                if weight > 0 and height > 0:
                    bmi = weight / ((height / 100) ** 2)
                    if bmi > 30:
                        risk_factors.append(f'High BMI risk: {bmi:.1f}')
                        risk_score += 0.2
                    elif bmi > 25:
                        risk_factors.append(f'Moderate BMI risk: {bmi:.1f}')
                        risk_score += 0.1
            
            return {
                'risk_score': min(1.0, risk_score),
                'factors': risk_factors,
                'age': age,
                'experience_level': experience_level,
                'bmi': bmi if 'bmi' in locals() else None
            }
            
        except Exception as e:
            logger.error(f"Error assessing age/fitness risk: {e}")
            return {'risk_score': 0.3, 'factors': ['Assessment error']}
    
    async def _calculate_overall_risk_score(self, risk_factors: Dict[str, Any]) -> float:
        """Calculate overall injury risk score"""
        try:
            # Weight different risk factors
            weights = {
                'training_load_risk': 0.25,
                'movement_pattern_risk': 0.20,
                'fatigue_risk': 0.20,
                'imbalance_risk': 0.15,
                'progression_risk': 0.10,
                'equipment_risk': 0.05,
                'injury_history_risk': 0.15,
                'age_fitness_risk': 0.10
            }
            
            overall_score = 0.0
            for risk_type, weight in weights.items():
                if risk_type in risk_factors:
                    risk_score = risk_factors[risk_type].get('risk_score', 0)
                    overall_score += risk_score * weight
            
            return min(1.0, overall_score)
            
        except Exception as e:
            logger.error(f"Error calculating overall risk score: {e}")
            return 0.5
    
    def _determine_risk_level(self, risk_score: float) -> str:
        """Determine risk level based on score"""
        if risk_score >= 0.7:
            return 'high'
        elif risk_score >= 0.4:
            return 'medium'
        else:
            return 'low'
    
    async def _generate_injury_prevention_recommendations(self, risk_factors: Dict[str, Any], user_profile: Dict[str, Any], workout_plan: Dict[str, Any]) -> List[str]:
        """Generate injury prevention recommendations"""
        try:
            recommendations = []
            
            # Generate recommendations based on risk factors
            for risk_type, risk_data in risk_factors.items():
                if risk_data.get('risk_score', 0) > 0.3:
                    factors = risk_data.get('factors', [])
                    
                    if risk_type == 'training_load_risk':
                        recommendations.append('Reduce training load increase to <10% per week')
                        recommendations.append('Include deload weeks every 4-6 weeks')
                        
                    elif risk_type == 'movement_pattern_risk':
                        recommendations.append('Balance push/pull exercises')
                        recommendations.append('Include unilateral exercises for stability')
                        
                    elif risk_type == 'fatigue_risk':
                        recommendations.append('Increase rest days between intense sessions')
                        recommendations.append('Monitor sleep and recovery')
                        
                    elif risk_type == 'imbalance_risk':
                        recommendations.append('Add corrective exercises for weak muscle groups')
                        recommendations.append('Focus on posterior chain development')
                        
                    elif risk_type == 'progression_risk':
                        recommendations.append('Follow 5-10% progression rule')
                        recommendations.append('Use RPE (Rate of Perceived Exertion) to guide intensity')
                        
                    elif risk_type == 'equipment_risk':
                        recommendations.append('Ensure proper equipment setup and form')
                        recommendations.append('Start with lighter weights to practice technique')
                        
                    elif risk_type == 'injury_history_risk':
                        recommendations.append('Avoid exercises that aggravate previous injuries')
                        recommendations.append('Include rehabilitation exercises')
                        
                    elif risk_type == 'age_fitness_risk':
                        recommendations.append('Include mobility and flexibility work')
                        recommendations.append('Progress more conservatively')
            
            # Add general recommendations
            recommendations.extend([
                'Always warm up before training',
                'Focus on proper form over heavy weights',
                'Listen to your body and rest when needed',
                'Include recovery and mobility work'
            ])
            
            return list(set(recommendations))  # Remove duplicates
            
        except Exception as e:
            logger.error(f"Error generating injury prevention recommendations: {e}")
            return ['Focus on proper form and gradual progression']
    
    # Placeholder methods for periodization (to be implemented)
    
    async def _analyze_training_history(self, workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze training history for periodization"""
        # Implementation for training history analysis
        return {'status': 'placeholder'}
    
    async def _determine_periodization_strategy(self, user_profile: Dict[str, Any], training_analysis: Dict[str, Any], measurements: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Determine periodization strategy"""
        # Implementation for periodization strategy
        return {'strategy': 'placeholder'}
    
    async def _generate_periodized_plan(self, training_plan: Dict[str, Any], strategy: Dict[str, Any], user_profile: Dict[str, Any]) -> Dict[str, Any]:
        """Generate periodized training plan"""
        # Implementation for periodized plan generation
        return training_plan
    
    async def _generate_periodization_reasoning(self, strategy: Dict[str, Any]) -> str:
        """Generate periodization reasoning"""
        # Implementation for periodization reasoning
        return "Periodization applied based on training analysis."
