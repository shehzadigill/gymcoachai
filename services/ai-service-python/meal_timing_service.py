import os
import json
import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timezone, timedelta
import statistics
from collections import defaultdict, Counter

from user_data_service import UserDataService
from pattern_analyzer import PatternAnalyzer
from rag_service import RAGService
from bedrock_service import BedrockService

logger = logging.getLogger(__name__)

class MealTimingService:
    """Service for optimal meal timing and nutrition scheduling"""
    
    def __init__(self):
        self.table_name = os.environ.get('DYNAMODB_TABLE', 'gymcoach-ai-main')
        self.user_data_service = UserDataService(self.table_name)
        self.pattern_analyzer = PatternAnalyzer()
        self.rag_service = RAGService()
        self.bedrock_service = BedrockService()
        
        # Meal timing parameters
        self.pre_workout_window = 2  # hours before workout
        self.post_workout_window = 1  # hours after workout
        self.meal_spacing_min = 3  # minimum hours between meals
        self.meal_spacing_max = 5  # maximum hours between meals
        
    async def optimize_meal_schedule(self, user_id: str, meal_plan: Dict[str, Any]) -> Dict[str, Any]:
        """
        Optimize meal schedule based on user's lifestyle and goals
        
        Args:
            user_id: User ID
            meal_plan: Current meal plan
            
        Returns:
            Dictionary with optimized meal schedule
        """
        try:
            logger.info(f"Optimizing meal schedule for user {user_id}")
            
            # Get user context
            user_profile = await self.user_data_service.get_user_profile(user_id)
            workouts = await self.user_data_service.get_historical_workouts(user_id, 14)
            nutrition_data = await self.user_data_service.get_historical_nutrition(user_id, 14)
            
            if not user_profile:
                return {'error': 'User profile not found'}
            
            # Analyze current schedule patterns
            schedule_patterns = await self._analyze_schedule_patterns(user_profile, workouts, nutrition_data)
            
            # Use RAG to get meal timing best practices
            rag_context = await self.rag_service.retrieve_nutrition_context(
                query="meal timing optimization schedule circadian rhythm intermittent fasting",
                user_context={
                    'goals': user_profile.get('fitnessGoals', []),
                    'schedule': user_profile.get('schedule', {}),
                    'dietary_restrictions': user_profile.get('dietaryRestrictions', [])
                }
            )
            
            # Generate optimized schedule using AI
            schedule_prompt = f"""
            Optimize meal timing and schedule for this user based on their lifestyle and goals.
            
            User Profile:
            - Goals: {', '.join(user_profile.get('fitnessGoals', []))}
            - Schedule: {json.dumps(user_profile.get('schedule', {}), indent=2)}
            - Dietary Restrictions: {', '.join(user_profile.get('dietaryRestrictions', []))}
            
            Current Meal Plan:
            {json.dumps(meal_plan, indent=2)}
            
            Schedule Patterns:
            {json.dumps(schedule_patterns, indent=2)}
            
            Meal Timing Best Practices:
            {rag_context['context']}
            
            Provide optimized meal timing recommendations including:
            1. Optimal meal times throughout the day
            2. Pre-workout nutrition timing
            3. Post-workout nutrition timing
            4. Meal spacing and frequency
            5. Hydration schedule
            6. Intermittent fasting recommendations (if applicable)
            7. Weekend vs weekday schedule differences
            
            Consider their work schedule, workout times, and lifestyle constraints.
            """
            
            bedrock_result = self.bedrock_service.invoke_bedrock(
                schedule_prompt,
                {
                    'user_profile': user_profile,
                    'meal_plan': meal_plan,
                    'schedule_patterns': schedule_patterns,
                    'rag_context': rag_context
                },
                max_tokens=600
            )
            
            if bedrock_result['success']:
                return {
                    'user_id': user_id,
                    'original_plan': meal_plan,
                    'optimized_schedule': bedrock_result['response'],
                    'schedule_patterns': schedule_patterns,
                    'rag_sources': rag_context['sources'],
                    'optimization_date': datetime.now(timezone.utc).isoformat()
                }
            else:
                return {'error': 'Failed to optimize meal schedule'}
                
        except Exception as e:
            logger.error(f"Error optimizing meal schedule for user {user_id}: {e}")
            return {'error': str(e)}
    
    async def suggest_pre_workout_nutrition(self, user_id: str, workout_details: Dict[str, Any]) -> Dict[str, Any]:
        """
        Suggest optimal pre-workout nutrition based on workout type and timing
        
        Args:
            user_id: User ID
            workout_details: Details about the upcoming workout
            
        Returns:
            Dictionary with pre-workout nutrition recommendations
        """
        try:
            logger.info(f"Suggesting pre-workout nutrition for user {user_id}")
            
            # Get user context
            user_profile = await self.user_data_service.get_user_profile(user_id)
            
            if not user_profile:
                return {'error': 'User profile not found'}
            
            # Use RAG to get pre-workout nutrition knowledge
            rag_context = await self.rag_service.retrieve_nutrition_context(
                query=f"pre workout nutrition {workout_details.get('type', 'strength')} training",
                user_context={
                    'goals': user_profile.get('fitnessGoals', []),
                    'dietary_restrictions': user_profile.get('dietaryRestrictions', [])
                }
            )
            
            # Generate pre-workout recommendations using AI
            pre_workout_prompt = f"""
            Suggest optimal pre-workout nutrition for this user based on their upcoming workout.
            
            User Profile:
            - Goals: {', '.join(user_profile.get('fitnessGoals', []))}
            - Experience Level: {user_profile.get('experienceLevel', 'beginner')}
            - Dietary Restrictions: {', '.join(user_profile.get('dietaryRestrictions', []))}
            
            Workout Details:
            {json.dumps(workout_details, indent=2)}
            
            Pre-Workout Nutrition Knowledge:
            {rag_context['context']}
            
            Provide specific recommendations for:
            1. Timing (how long before workout)
            2. Macronutrient composition
            3. Specific food suggestions
            4. Hydration recommendations
            5. Supplement suggestions (if applicable)
            6. What to avoid before workout
            
            Consider the workout type, intensity, and duration.
            """
            
            bedrock_result = self.bedrock_service.invoke_bedrock(
                pre_workout_prompt,
                {
                    'user_profile': user_profile,
                    'workout_details': workout_details,
                    'rag_context': rag_context
                },
                max_tokens=400
            )
            
            if bedrock_result['success']:
                return {
                    'user_id': user_id,
                    'workout_details': workout_details,
                    'pre_workout_recommendations': bedrock_result['response'],
                    'rag_sources': rag_context['sources'],
                    'generated_at': datetime.now(timezone.utc).isoformat()
                }
            else:
                return {'error': 'Failed to generate pre-workout recommendations'}
                
        except Exception as e:
            logger.error(f"Error suggesting pre-workout nutrition for user {user_id}: {e}")
            return {'error': str(e)}
    
    async def suggest_post_workout_nutrition(self, user_id: str, workout_details: Dict[str, Any]) -> Dict[str, Any]:
        """
        Suggest optimal post-workout nutrition for recovery
        
        Args:
            user_id: User ID
            workout_details: Details about the completed workout
            
        Returns:
            Dictionary with post-workout nutrition recommendations
        """
        try:
            logger.info(f"Suggesting post-workout nutrition for user {user_id}")
            
            # Get user context
            user_profile = await self.user_data_service.get_user_profile(user_id)
            
            if not user_profile:
                return {'error': 'User profile not found'}
            
            # Use RAG to get post-workout nutrition knowledge
            rag_context = await self.rag_service.retrieve_nutrition_context(
                query=f"post workout nutrition recovery {workout_details.get('type', 'strength')} training",
                user_context={
                    'goals': user_profile.get('fitnessGoals', []),
                    'dietary_restrictions': user_profile.get('dietaryRestrictions', [])
                }
            )
            
            # Generate post-workout recommendations using AI
            post_workout_prompt = f"""
            Suggest optimal post-workout nutrition for this user based on their completed workout.
            
            User Profile:
            - Goals: {', '.join(user_profile.get('fitnessGoals', []))}
            - Experience Level: {user_profile.get('experienceLevel', 'beginner')}
            - Dietary Restrictions: {', '.join(user_profile.get('dietaryRestrictions', []))}
            
            Workout Details:
            {json.dumps(workout_details, indent=2)}
            
            Post-Workout Nutrition Knowledge:
            {rag_context['context']}
            
            Provide specific recommendations for:
            1. Timing (immediate vs delayed nutrition)
            2. Macronutrient composition for recovery
            3. Specific food suggestions
            4. Hydration and electrolyte replacement
            5. Supplement suggestions (if applicable)
            6. Meal timing after workout
            
            Focus on recovery, muscle repair, and glycogen replenishment.
            """
            
            bedrock_result = self.bedrock_service.invoke_bedrock(
                post_workout_prompt,
                {
                    'user_profile': user_profile,
                    'workout_details': workout_details,
                    'rag_context': rag_context
                },
                max_tokens=400
            )
            
            if bedrock_result['success']:
                return {
                    'user_id': user_id,
                    'workout_details': workout_details,
                    'post_workout_recommendations': bedrock_result['response'],
                    'rag_sources': rag_context['sources'],
                    'generated_at': datetime.now(timezone.utc).isoformat()
                }
            else:
                return {'error': 'Failed to generate post-workout recommendations'}
                
        except Exception as e:
            logger.error(f"Error suggesting post-workout nutrition for user {user_id}: {e}")
            return {'error': str(e)}
    
    async def analyze_meal_timing_patterns(self, user_id: str, days: int = 14) -> Dict[str, Any]:
        """
        Analyze current meal timing patterns and identify optimization opportunities
        
        Args:
            user_id: User ID
            days: Number of days to analyze
            
        Returns:
            Dictionary with meal timing pattern analysis
        """
        try:
            logger.info(f"Analyzing meal timing patterns for user {user_id}")
            
            # Get nutrition data
            nutrition_data = await self.user_data_service.get_historical_nutrition(user_id, days)
            workouts = await self.user_data_service.get_historical_workouts(user_id, days)
            
            if not nutrition_data:
                return {'status': 'no_data', 'message': 'No nutrition data available'}
            
            meals = nutrition_data.get('meals', [])
            
            if not meals:
                return {'status': 'no_meals', 'message': 'No meal data available'}
            
            # Analyze timing patterns
            timing_analysis = await self._analyze_timing_patterns(meals, workouts)
            
            # Analyze consistency
            consistency_analysis = await self._analyze_timing_consistency(meals)
            
            # Analyze meal frequency
            frequency_analysis = await self._analyze_meal_frequency(meals)
            
            # Analyze workout correlation
            workout_correlation = await self._analyze_workout_correlation(meals, workouts)
            
            # Generate recommendations
            recommendations = await self._generate_timing_recommendations(
                timing_analysis, consistency_analysis, frequency_analysis, workout_correlation
            )
            
            return {
                'user_id': user_id,
                'analysis_period_days': days,
                'analysis_date': datetime.now(timezone.utc).isoformat(),
                'timing_analysis': timing_analysis,
                'consistency_analysis': consistency_analysis,
                'frequency_analysis': frequency_analysis,
                'workout_correlation': workout_correlation,
                'recommendations': recommendations,
                'overall_score': await self._calculate_timing_score(
                    timing_analysis, consistency_analysis, frequency_analysis
                )
            }
            
        except Exception as e:
            logger.error(f"Error analyzing meal timing patterns for user {user_id}: {e}")
            return {'error': str(e)}
    
    async def suggest_intermittent_fasting_schedule(self, user_id: str, preferences: Dict[str, Any]) -> Dict[str, Any]:
        """
        Suggest intermittent fasting schedule based on user preferences and goals
        
        Args:
            user_id: User ID
            preferences: User preferences for fasting
            
        Returns:
            Dictionary with intermittent fasting recommendations
        """
        try:
            logger.info(f"Suggesting intermittent fasting schedule for user {user_id}")
            
            # Get user context
            user_profile = await self.user_data_service.get_user_profile(user_id)
            workouts = await self.user_data_service.get_historical_workouts(user_id, 14)
            
            if not user_profile:
                return {'error': 'User profile not found'}
            
            # Use RAG to get intermittent fasting knowledge
            rag_context = await self.rag_service.retrieve_nutrition_context(
                query="intermittent fasting schedules benefits timing",
                user_context={
                    'goals': user_profile.get('fitnessGoals', []),
                    'schedule': user_profile.get('schedule', {}),
                    'dietary_restrictions': user_profile.get('dietaryRestrictions', [])
                }
            )
            
            # Generate fasting schedule using AI
            fasting_prompt = f"""
            Suggest an intermittent fasting schedule for this user based on their profile and preferences.
            
            User Profile:
            - Goals: {', '.join(user_profile.get('fitnessGoals', []))}
            - Schedule: {json.dumps(user_profile.get('schedule', {}), indent=2)}
            - Dietary Restrictions: {', '.join(user_profile.get('dietaryRestrictions', []))}
            - Experience Level: {user_profile.get('experienceLevel', 'beginner')}
            
            User Preferences:
            {json.dumps(preferences, indent=2)}
            
            Intermittent Fasting Knowledge:
            {rag_context['context']}
            
            Provide recommendations for:
            1. Fasting schedule type (16:8, 18:6, 20:4, etc.)
            2. Optimal eating window timing
            3. Workout timing considerations
            4. Hydration during fasting
            5. Breaking the fast properly
            6. Potential benefits and considerations
            7. Gradual implementation plan
            
            Consider their lifestyle, workout schedule, and experience level.
            """
            
            bedrock_result = self.bedrock_service.invoke_bedrock(
                fasting_prompt,
                {
                    'user_profile': user_profile,
                    'preferences': preferences,
                    'rag_context': rag_context
                },
                max_tokens=500
            )
            
            if bedrock_result['success']:
                return {
                    'user_id': user_id,
                    'preferences': preferences,
                    'fasting_recommendations': bedrock_result['response'],
                    'rag_sources': rag_context['sources'],
                    'generated_at': datetime.now(timezone.utc).isoformat()
                }
            else:
                return {'error': 'Failed to generate fasting recommendations'}
                
        except Exception as e:
            logger.error(f"Error suggesting intermittent fasting schedule for user {user_id}: {e}")
            return {'error': str(e)}
    
    # Helper methods for meal timing analysis
    
    async def _analyze_schedule_patterns(self, user_profile: Dict[str, Any], workouts: List[Dict[str, Any]], nutrition_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze user's schedule patterns"""
        try:
            patterns = {
                'work_schedule': user_profile.get('schedule', {}),
                'workout_patterns': await self._analyze_workout_timing_patterns(workouts),
                'meal_patterns': await self._analyze_current_meal_patterns(nutrition_data),
                'sleep_patterns': user_profile.get('sleepSchedule', {}),
                'lifestyle_factors': {
                    'work_type': user_profile.get('workType', 'unknown'),
                    'commute_time': user_profile.get('commuteTime', 0),
                    'meal_prep_preference': user_profile.get('mealPrepPreference', 'unknown')
                }
            }
            
            return patterns
            
        except Exception as e:
            logger.error(f"Error analyzing schedule patterns: {e}")
            return {'error': str(e)}
    
    async def _analyze_timing_patterns(self, meals: List[Dict[str, Any]], workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze meal timing patterns"""
        try:
            meal_times = []
            meal_types = defaultdict(list)
            
            for meal in meals:
                meal_time = meal.get('time', '')
                meal_type = meal.get('meal_type', 'unknown')
                
                if meal_time:
                    try:
                        time_obj = datetime.strptime(meal_time, '%H:%M')
                        hour = time_obj.hour
                        meal_times.append(hour)
                        meal_types[meal_type].append(hour)
                    except ValueError:
                        continue
            
            if meal_times:
                # Calculate timing statistics
                avg_meal_time = statistics.mean(meal_times)
                meal_spread = max(meal_times) - min(meal_times)
                
                # Analyze meal distribution
                meal_distribution = {}
                for meal_type, times in meal_types.items():
                    if times:
                        meal_distribution[meal_type] = {
                            'avg_time': statistics.mean(times),
                            'time_range': f"{min(times):02d}:00 - {max(times):02d}:00",
                            'frequency': len(times)
                        }
                
                # Analyze workout correlation
                workout_correlation = await self._analyze_workout_meal_correlation(meals, workouts)
                
                return {
                    'average_meal_time': avg_meal_time,
                    'meal_spread_hours': meal_spread,
                    'meal_distribution': meal_distribution,
                    'workout_correlation': workout_correlation,
                    'total_meals': len(meal_times)
                }
            
            return {'status': 'no_timing_data'}
            
        except Exception as e:
            logger.error(f"Error analyzing timing patterns: {e}")
            return {'error': str(e)}
    
    async def _analyze_timing_consistency(self, meals: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze meal timing consistency"""
        try:
            daily_meal_times = defaultdict(list)
            
            for meal in meals:
                meal_date = meal.get('date', '')
                meal_time = meal.get('time', '')
                
                if meal_date and meal_time:
                    try:
                        time_obj = datetime.strptime(meal_time, '%H:%M')
                        daily_meal_times[meal_date].append(time_obj.hour)
                    except ValueError:
                        continue
            
            consistency_scores = []
            for date, times in daily_meal_times.items():
                if len(times) > 1:
                    # Calculate consistency score based on time spread
                    time_spread = max(times) - min(times)
                    consistency_score = max(0, 1 - (time_spread / 12))  # Normalize to 12-hour spread
                    consistency_scores.append(consistency_score)
            
            if consistency_scores:
                avg_consistency = statistics.mean(consistency_scores)
                consistency_trend = self._calculate_trend(consistency_scores)
                
                return {
                    'average_consistency': avg_consistency,
                    'consistency_trend': consistency_trend,
                    'days_analyzed': len(consistency_scores),
                    'consistency_score': avg_consistency
                }
            
            return {'status': 'insufficient_data'}
            
        except Exception as e:
            logger.error(f"Error analyzing timing consistency: {e}")
            return {'error': str(e)}
    
    async def _analyze_meal_frequency(self, meals: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze meal frequency patterns"""
        try:
            daily_meal_counts = defaultdict(int)
            
            for meal in meals:
                meal_date = meal.get('date', '')
                if meal_date:
                    daily_meal_counts[meal_date] += 1
            
            if daily_meal_counts:
                meal_counts = list(daily_meal_counts.values())
                avg_meals_per_day = statistics.mean(meal_counts)
                meal_frequency_consistency = 1 - (statistics.stdev(meal_counts) / avg_meals_per_day) if avg_meals_per_day > 0 else 0
                
                return {
                    'average_meals_per_day': avg_meals_per_day,
                    'frequency_consistency': meal_frequency_consistency,
                    'meal_count_distribution': {
                        'min': min(meal_counts),
                        'max': max(meal_counts),
                        'most_common': Counter(meal_counts).most_common(1)[0][0] if meal_counts else 0
                    },
                    'days_analyzed': len(meal_counts)
                }
            
            return {'status': 'no_data'}
            
        except Exception as e:
            logger.error(f"Error analyzing meal frequency: {e}")
            return {'error': str(e)}
    
    async def _analyze_workout_correlation(self, meals: List[Dict[str, Any]], workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze correlation between meals and workouts"""
        try:
            workout_days = set()
            for workout in workouts:
                workout_date = workout.get('date', '')
                if workout_date:
                    workout_days.add(workout_date)
            
            meal_days = set()
            for meal in meals:
                meal_date = meal.get('date', '')
                if meal_date:
                    meal_days.add(meal_date)
            
            # Calculate overlap
            overlap_days = workout_days.intersection(meal_days)
            total_days = len(workout_days.union(meal_days))
            
            if total_days > 0:
                correlation_score = len(overlap_days) / total_days
                
                # Analyze pre/post workout meal timing
                pre_workout_meals = 0
                post_workout_meals = 0
                
                for workout in workouts:
                    workout_date = workout.get('date', '')
                    workout_time = workout.get('time', '')
                    
                    if workout_date and workout_time:
                        try:
                            workout_time_obj = datetime.strptime(workout_time, '%H:%M')
                            
                            for meal in meals:
                                meal_date = meal.get('date', '')
                                meal_time = meal.get('time', '')
                                
                                if meal_date == workout_date and meal_time:
                                    try:
                                        meal_time_obj = datetime.strptime(meal_time, '%H:%M')
                                        time_diff = (workout_time_obj - meal_time_obj).total_seconds() / 3600
                                        
                                        if 0.5 <= time_diff <= 2:  # 30 minutes to 2 hours before
                                            pre_workout_meals += 1
                                        elif -2 <= time_diff <= -0.5:  # 30 minutes to 2 hours after
                                            post_workout_meals += 1
                                    except ValueError:
                                        continue
                        except ValueError:
                            continue
                
                return {
                    'correlation_score': correlation_score,
                    'workout_days': len(workout_days),
                    'meal_days': len(meal_days),
                    'overlap_days': len(overlap_days),
                    'pre_workout_meals': pre_workout_meals,
                    'post_workout_meals': post_workout_meals,
                    'timing_optimization_score': (pre_workout_meals + post_workout_meals) / max(len(workout_days), 1)
                }
            
            return {'status': 'no_correlation_data'}
            
        except Exception as e:
            logger.error(f"Error analyzing workout correlation: {e}")
            return {'error': str(e)}
    
    async def _generate_timing_recommendations(self, timing_analysis: Dict[str, Any], consistency_analysis: Dict[str, Any], 
                                            frequency_analysis: Dict[str, Any], workout_correlation: Dict[str, Any]) -> List[str]:
        """Generate AI-powered timing recommendations"""
        try:
            recommendations_prompt = f"""
            Generate meal timing recommendations based on this analysis of the user's current patterns.
            
            Timing Analysis:
            {json.dumps(timing_analysis, indent=2)}
            
            Consistency Analysis:
            {json.dumps(consistency_analysis, indent=2)}
            
            Frequency Analysis:
            {json.dumps(frequency_analysis, indent=2)}
            
            Workout Correlation:
            {json.dumps(workout_correlation, indent=2)}
            
            Provide 5-7 specific recommendations for:
            1. Improving meal timing consistency
            2. Optimizing meal frequency
            3. Better workout-nutrition timing
            4. Meal spacing optimization
            5. Hydration timing
            6. Weekend vs weekday adjustments
            7. Implementation strategies
            
            Focus on practical, actionable improvements.
            """
            
            bedrock_result = self.bedrock_service.invoke_bedrock(
                recommendations_prompt,
                {
                    'timing_analysis': timing_analysis,
                    'consistency_analysis': consistency_analysis,
                    'frequency_analysis': frequency_analysis,
                    'workout_correlation': workout_correlation
                },
                max_tokens=400
            )
            
            if bedrock_result['success']:
                return [bedrock_result['response']]
            else:
                return ['Focus on consistent meal timing throughout the day.']
                
        except Exception as e:
            logger.error(f"Error generating timing recommendations: {e}")
            return ['Focus on consistent meal timing throughout the day.']
    
    async def _calculate_timing_score(self, timing_analysis: Dict[str, Any], consistency_analysis: Dict[str, Any], frequency_analysis: Dict[str, Any]) -> float:
        """Calculate overall meal timing score"""
        try:
            score = 0.0
            
            # Consistency score (40% weight)
            if 'average_consistency' in consistency_analysis:
                score += consistency_analysis['average_consistency'] * 0.4
            
            # Frequency score (30% weight)
            if 'average_meals_per_day' in frequency_analysis:
                meals_per_day = frequency_analysis['average_meals_per_day']
                # Ideal: 3-5 meals per day
                if 3 <= meals_per_day <= 5:
                    frequency_score = 1.0
                elif meals_per_day < 3:
                    frequency_score = meals_per_day / 3
                else:
                    frequency_score = max(0.5, 1.0 - (meals_per_day - 5) / 5)
                
                score += frequency_score * 0.3
            
            # Timing spread score (30% weight)
            if 'meal_spread_hours' in timing_analysis:
                spread = timing_analysis['meal_spread_hours']
                # Ideal: 8-12 hour spread
                if 8 <= spread <= 12:
                    spread_score = 1.0
                else:
                    spread_score = max(0.0, 1.0 - abs(spread - 10) / 10)
                
                score += spread_score * 0.3
            
            return min(1.0, score)
            
        except Exception as e:
            logger.error(f"Error calculating timing score: {e}")
            return 0.5
    
    # Additional helper methods
    
    def _calculate_trend(self, values: List[float]) -> str:
        """Calculate trend direction"""
        if len(values) < 2:
            return 'stable'
        
        first_half = values[:len(values)//2]
        second_half = values[len(values)//2:]
        
        first_avg = statistics.mean(first_half)
        second_avg = statistics.mean(second_half)
        
        change = (second_avg - first_avg) / first_avg if first_avg > 0 else 0
        
        if change > 0.1:
            return 'improving'
        elif change < -0.1:
            return 'declining'
        else:
            return 'stable'
    
    async def _analyze_workout_timing_patterns(self, workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze workout timing patterns"""
        # Implementation for workout timing analysis
        return {'status': 'placeholder'}
    
    async def _analyze_current_meal_patterns(self, nutrition_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze current meal patterns"""
        # Implementation for current meal pattern analysis
        return {'status': 'placeholder'}
    
    async def _analyze_workout_meal_correlation(self, meals: List[Dict[str, Any]], workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze workout-meal correlation"""
        # Implementation for workout-meal correlation analysis
        return {'status': 'placeholder'}
