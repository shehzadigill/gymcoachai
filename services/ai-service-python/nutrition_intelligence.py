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

class NutritionIntelligence:
    """Service for intelligent nutrition plan adjustments and meal optimization"""
    
    def __init__(self):
        self.table_name = os.environ.get('DYNAMODB_TABLE', 'gymcoach-ai-main')
        self.user_data_service = UserDataService(self.table_name)
        self.pattern_analyzer = PatternAnalyzer()
        self.rag_service = RAGService()
        self.bedrock_service = BedrockService()
        
        # Nutrition thresholds and targets
        self.macro_tolerance = 0.1  # 10% tolerance for macro targets
        self.calorie_tolerance = 0.05  # 5% tolerance for calorie targets
        self.adherence_threshold = 0.7  # 70% adherence threshold
        self.weight_change_threshold = 0.5  # 0.5kg weight change threshold
        
    async def analyze_nutrition_adherence(self, user_id: str, days: int = 14) -> Dict[str, Any]:
        """
        Analyze nutrition adherence and identify areas for improvement
        
        Args:
            user_id: User ID
            days: Number of days to analyze
            
        Returns:
            Dictionary with nutrition adherence analysis
        """
        try:
            logger.info(f"Analyzing nutrition adherence for user {user_id}")
            
            # Get user data
            user_profile = await self.user_data_service.get_user_profile(user_id)
            nutrition_data = await self.user_data_service.get_historical_nutrition(user_id, days)
            measurements = await self.user_data_service.get_historical_measurements(user_id, days * 2)
            
            if not user_profile:
                return {'error': 'User profile not found'}
            
            if not nutrition_data:
                return {'status': 'no_data', 'message': 'No nutrition data available'}
            
            # Analyze adherence patterns
            adherence_analysis = await self._analyze_adherence_patterns(nutrition_data, user_profile)
            
            # Analyze macro distribution
            macro_analysis = await self._analyze_macro_distribution(nutrition_data, user_profile)
            
            # Analyze meal timing
            timing_analysis = await self._analyze_meal_timing(nutrition_data)
            
            # Analyze food preferences
            preference_analysis = await self._analyze_food_preferences(nutrition_data)
            
            # Analyze progress correlation
            progress_analysis = await self._analyze_progress_correlation(nutrition_data, measurements)
            
            # Generate AI-powered recommendations
            recommendations = await self._generate_nutrition_recommendations(
                adherence_analysis, macro_analysis, timing_analysis, preference_analysis, progress_analysis, user_profile
            )
            
            return {
                'user_id': user_id,
                'analysis_period_days': days,
                'analysis_date': datetime.now(timezone.utc).isoformat(),
                'adherence_analysis': adherence_analysis,
                'macro_analysis': macro_analysis,
                'timing_analysis': timing_analysis,
                'preference_analysis': preference_analysis,
                'progress_analysis': progress_analysis,
                'recommendations': recommendations,
                'overall_score': await self._calculate_overall_nutrition_score(
                    adherence_analysis, macro_analysis, timing_analysis
                )
            }
            
        except Exception as e:
            logger.error(f"Error analyzing nutrition adherence for user {user_id}: {e}")
            return {'error': str(e)}
    
    async def suggest_nutrition_adjustments(self, user_id: str, current_plan: Dict[str, Any]) -> Dict[str, Any]:
        """
        Suggest intelligent nutrition plan adjustments based on progress and adherence
        
        Args:
            user_id: User ID
            current_plan: Current nutrition plan
            
        Returns:
            Dictionary with suggested adjustments
        """
        try:
            logger.info(f"Suggesting nutrition adjustments for user {user_id}")
            
            # Get user context and progress data
            user_profile = await self.user_data_service.get_user_profile(user_id)
            nutrition_data = await self.user_data_service.get_historical_nutrition(user_id, 30)
            measurements = await self.user_data_service.get_historical_measurements(user_id, 60)
            workouts = await self.user_data_service.get_historical_workouts(user_id, 30)
            
            if not user_profile:
                return {'error': 'User profile not found'}
            
            # Analyze current progress
            progress_analysis = await self._analyze_nutrition_progress(nutrition_data, measurements, workouts)
            
            # Determine adjustment strategy
            adjustment_strategy = await self._determine_adjustment_strategy(
                progress_analysis, user_profile, current_plan
            )
            
            # Generate adjusted plan
            adjusted_plan = await self._generate_adjusted_plan(
                current_plan, adjustment_strategy, user_profile, progress_analysis
            )
            
            return {
                'user_id': user_id,
                'original_plan': current_plan,
                'adjusted_plan': adjusted_plan,
                'adjustment_strategy': adjustment_strategy,
                'progress_analysis': progress_analysis,
                'reasoning': await self._generate_adjustment_reasoning(
                    adjustment_strategy, progress_analysis
                ),
                'adjustment_date': datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error suggesting nutrition adjustments for user {user_id}: {e}")
            return {'error': str(e)}
    
    async def optimize_meal_timing(self, user_id: str, meal_plan: Dict[str, Any]) -> Dict[str, Any]:
        """
        Optimize meal timing based on user's schedule and goals
        
        Args:
            user_id: User ID
            meal_plan: Current meal plan
            
        Returns:
            Dictionary with optimized meal timing
        """
        try:
            logger.info(f"Optimizing meal timing for user {user_id}")
            
            # Get user context
            user_profile = await self.user_data_service.get_user_profile(user_id)
            nutrition_data = await self.user_data_service.get_historical_nutrition(user_id, 14)
            workouts = await self.user_data_service.get_recent_workouts(user_id, 10)
            
            if not user_profile:
                return {'error': 'User profile not found'}
            
            # Analyze current meal timing patterns
            timing_patterns = await self._analyze_current_timing_patterns(nutrition_data)
            
            # Analyze workout schedule
            workout_schedule = await self._analyze_workout_schedule(workouts)
            
            # Use RAG to get meal timing best practices
            rag_context = await self.rag_service.retrieve_nutrition_context(
                query="meal timing optimization pre workout post workout",
                user_context={
                    'goals': user_profile.get('fitnessGoals', []),
                    'schedule': user_profile.get('schedule', {}),
                    'experience_level': user_profile.get('experienceLevel', 'beginner')
                }
            )
            
            # Generate optimized timing using AI
            timing_prompt = f"""
            Optimize meal timing for this user based on their profile and workout schedule.
            
            User Profile:
            - Goals: {', '.join(user_profile.get('fitnessGoals', []))}
            - Experience Level: {user_profile.get('experienceLevel', 'beginner')}
            - Schedule: {json.dumps(user_profile.get('schedule', {}), indent=2)}
            
            Current Meal Plan:
            {json.dumps(meal_plan, indent=2)}
            
            Current Timing Patterns:
            {json.dumps(timing_patterns, indent=2)}
            
            Workout Schedule:
            {json.dumps(workout_schedule, indent=2)}
            
            Meal Timing Best Practices:
            {rag_context['context']}
            
            Provide optimized meal timing recommendations including:
            1. Pre-workout nutrition timing and composition
            2. Post-workout nutrition timing and composition
            3. Meal spacing throughout the day
            4. Hydration timing
            5. Supplement timing recommendations
            
            Consider their goals, schedule constraints, and workout timing.
            """
            
            bedrock_result = self.bedrock_service.invoke_bedrock(
                timing_prompt,
                {
                    'user_profile': user_profile,
                    'meal_plan': meal_plan,
                    'timing_patterns': timing_patterns,
                    'workout_schedule': workout_schedule,
                    'rag_context': rag_context
                },
                max_tokens=600
            )
            
            if bedrock_result['success']:
                return {
                    'user_id': user_id,
                    'original_meal_plan': meal_plan,
                    'optimized_timing': bedrock_result['response'],
                    'timing_patterns': timing_patterns,
                    'workout_schedule': workout_schedule,
                    'rag_sources': rag_context['sources'],
                    'optimization_date': datetime.now(timezone.utc).isoformat()
                }
            else:
                return {'error': 'Failed to optimize meal timing'}
                
        except Exception as e:
            logger.error(f"Error optimizing meal timing for user {user_id}: {e}")
            return {'error': str(e)}
    
    async def suggest_food_substitutions(self, user_id: str, unavailable_foods: List[str]) -> Dict[str, Any]:
        """
        Suggest food substitutions using RAG-powered knowledge
        
        Args:
            user_id: User ID
            unavailable_foods: List of foods that are unavailable
            
        Returns:
            Dictionary with food substitution suggestions
        """
        try:
            logger.info(f"Suggesting food substitutions for user {user_id}")
            
            # Get user context
            user_profile = await self.user_data_service.get_user_profile(user_id)
            nutrition_data = await self.user_data_service.get_historical_nutrition(user_id, 14)
            
            if not user_profile:
                return {'error': 'User profile not found'}
            
            # Build substitution context
            substitution_context = await self._build_substitution_context(user_profile, nutrition_data)
            
            substitutions = {}
            
            for food_name in unavailable_foods:
                # Use RAG to find similar foods
                rag_context = await self.rag_service.retrieve_nutrition_context(
                    query=f"foods similar to {food_name} nutritional substitutes",
                    user_context={
                        'dietary_restrictions': user_profile.get('dietaryRestrictions', []),
                        'food_preferences': user_profile.get('foodPreferences', []),
                        'goals': user_profile.get('fitnessGoals', [])
                    }
                )
                
                # Generate substitution suggestions using AI
                substitution_prompt = f"""
                Suggest 3-5 food substitutions for "{food_name}" based on the user's context.
                
                User Context:
                - Dietary Restrictions: {', '.join(user_profile.get('dietaryRestrictions', []))}
                - Food Preferences: {', '.join(user_profile.get('foodPreferences', []))}
                - Goals: {', '.join(user_profile.get('fitnessGoals', []))}
                
                Similar Foods Knowledge:
                {rag_context['context']}
                
                For each substitution, provide:
                1. Food name
                2. Why it's a good substitute (nutritional similarity)
                3. Any preparation differences
                4. Macro differences compared to original
                5. When to use this substitute
                
                Focus on foods that provide similar nutritional value and fit the user's dietary needs.
                """
                
                bedrock_result = self.bedrock_service.invoke_bedrock(
                    substitution_prompt,
                    {
                        'user_profile': user_profile,
                        'original_food': food_name,
                        'rag_context': rag_context
                    },
                    max_tokens=400
                )
                
                if bedrock_result['success']:
                    substitutions[food_name] = {
                        'suggestions': bedrock_result['response'],
                        'rag_sources': rag_context['sources']
                    }
                else:
                    substitutions[food_name] = {
                        'error': 'Failed to generate substitutions'
                    }
            
            return {
                'user_id': user_id,
                'substitutions': substitutions,
                'substitution_context': substitution_context,
                'generated_at': datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error suggesting food substitutions for user {user_id}: {e}")
            return {'error': str(e)}
    
    async def analyze_hydration_patterns(self, user_id: str, days: int = 7) -> Dict[str, Any]:
        """
        Analyze hydration patterns and provide recommendations
        
        Args:
            user_id: User ID
            days: Number of days to analyze
            
        Returns:
            Dictionary with hydration analysis
        """
        try:
            logger.info(f"Analyzing hydration patterns for user {user_id}")
            
            # Get user data
            user_profile = await self.user_data_service.get_user_profile(user_id)
            nutrition_data = await self.user_data_service.get_historical_nutrition(user_id, days)
            workouts = await self.user_data_service.get_historical_workouts(user_id, days)
            
            if not user_profile:
                return {'error': 'User profile not found'}
            
            # Analyze hydration patterns
            hydration_analysis = await self._analyze_hydration_data(nutrition_data, workouts)
            
            # Calculate hydration needs
            hydration_needs = await self._calculate_hydration_needs(user_profile, workouts)
            
            # Generate recommendations
            recommendations = await self._generate_hydration_recommendations(
                hydration_analysis, hydration_needs, user_profile
            )
            
            return {
                'user_id': user_id,
                'analysis_period_days': days,
                'analysis_date': datetime.now(timezone.utc).isoformat(),
                'hydration_analysis': hydration_analysis,
                'hydration_needs': hydration_needs,
                'recommendations': recommendations,
                'hydration_score': await self._calculate_hydration_score(hydration_analysis, hydration_needs)
            }
            
        except Exception as e:
            logger.error(f"Error analyzing hydration patterns for user {user_id}: {e}")
            return {'error': str(e)}
    
    # Helper methods for nutrition analysis
    
    async def _analyze_adherence_patterns(self, nutrition_data: Dict[str, Any], user_profile: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze nutrition adherence patterns"""
        try:
            meals = nutrition_data.get('meals', [])
            daily_goals = nutrition_data.get('daily_goals', [])
            
            if not meals or not daily_goals:
                return {'status': 'insufficient_data'}
            
            adherence_scores = []
            macro_adherence = {'protein': [], 'carbs': [], 'fat': []}
            calorie_adherence = []
            
            # Analyze each day
            for day_data in daily_goals:
                if not day_data:
                    continue
                
                # Calculate daily totals
                daily_totals = self._calculate_daily_totals(meals, day_data.get('date', ''))
                
                if daily_totals:
                    # Calculate adherence scores
                    protein_adherence = self._calculate_macro_adherence(
                        daily_totals.get('protein', 0), day_data.get('protein_goal', 0)
                    )
                    carbs_adherence = self._calculate_macro_adherence(
                        daily_totals.get('carbs', 0), day_data.get('carbs_goal', 0)
                    )
                    fat_adherence = self._calculate_macro_adherence(
                        daily_totals.get('fat', 0), day_data.get('fat_goal', 0)
                    )
                    calorie_adherence_score = self._calculate_calorie_adherence(
                        daily_totals.get('calories', 0), day_data.get('calorie_goal', 0)
                    )
                    
                    # Overall adherence score
                    overall_adherence = (protein_adherence + carbs_adherence + fat_adherence + calorie_adherence_score) / 4
                    adherence_scores.append(overall_adherence)
                    
                    macro_adherence['protein'].append(protein_adherence)
                    macro_adherence['carbs'].append(carbs_adherence)
                    macro_adherence['fat'].append(fat_adherence)
                    calorie_adherence.append(calorie_adherence_score)
            
            if adherence_scores:
                avg_adherence = statistics.mean(adherence_scores)
                adherence_trend = self._calculate_trend(adherence_scores)
                
                return {
                    'overall_adherence': avg_adherence,
                    'adherence_trend': adherence_trend,
                    'macro_adherence': {
                        'protein': statistics.mean(macro_adherence['protein']) if macro_adherence['protein'] else 0,
                        'carbs': statistics.mean(macro_adherence['carbs']) if macro_adherence['carbs'] else 0,
                        'fat': statistics.mean(macro_adherence['fat']) if macro_adherence['fat'] else 0
                    },
                    'calorie_adherence': statistics.mean(calorie_adherence) if calorie_adherence else 0,
                    'consistency_score': 1 - statistics.stdev(adherence_scores) if len(adherence_scores) > 1 else 1,
                    'days_analyzed': len(adherence_scores)
                }
            
            return {'status': 'no_data'}
            
        except Exception as e:
            logger.error(f"Error analyzing adherence patterns: {e}")
            return {'error': str(e)}
    
    async def _analyze_macro_distribution(self, nutrition_data: Dict[str, Any], user_profile: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze macro distribution patterns"""
        try:
            meals = nutrition_data.get('meals', [])
            daily_goals = nutrition_data.get('daily_goals', [])
            
            if not meals or not daily_goals:
                return {'status': 'insufficient_data'}
            
            macro_distributions = []
            meal_timing_patterns = defaultdict(list)
            
            # Analyze macro distribution for each day
            for day_data in daily_goals:
                if not day_data:
                    continue
                
                daily_totals = self._calculate_daily_totals(meals, day_data.get('date', ''))
                
                if daily_totals:
                    # Calculate macro percentages
                    total_calories = daily_totals.get('calories', 0)
                    if total_calories > 0:
                        protein_percent = (daily_totals.get('protein', 0) * 4) / total_calories * 100
                        carbs_percent = (daily_totals.get('carbs', 0) * 4) / total_calories * 100
                        fat_percent = (daily_totals.get('fat', 0) * 9) / total_calories * 100
                        
                        macro_distributions.append({
                            'protein_percent': protein_percent,
                            'carbs_percent': carbs_percent,
                            'fat_percent': fat_percent,
                            'date': day_data.get('date', '')
                        })
                        
                        # Analyze meal timing patterns
                        day_meals = [meal for meal in meals if meal.get('date', '') == day_data.get('date', '')]
                        for meal in day_meals:
                            meal_time = meal.get('time', '')
                            if meal_time:
                                meal_timing_patterns[meal_time].append({
                                    'protein': meal.get('protein', 0),
                                    'carbs': meal.get('carbs', 0),
                                    'fat': meal.get('fat', 0),
                                    'calories': meal.get('calories', 0)
                                })
            
            if macro_distributions:
                avg_protein = statistics.mean([d['protein_percent'] for d in macro_distributions])
                avg_carbs = statistics.mean([d['carbs_percent'] for d in macro_distributions])
                avg_fat = statistics.mean([d['fat_percent'] for d in macro_distributions])
                
                return {
                    'average_distribution': {
                        'protein_percent': avg_protein,
                        'carbs_percent': avg_carbs,
                        'fat_percent': avg_fat
                    },
                    'distribution_consistency': {
                        'protein_cv': statistics.stdev([d['protein_percent'] for d in macro_distributions]) / avg_protein if avg_protein > 0 else 0,
                        'carbs_cv': statistics.stdev([d['carbs_percent'] for d in macro_distributions]) / avg_carbs if avg_carbs > 0 else 0,
                        'fat_cv': statistics.stdev([d['fat_percent'] for d in macro_distributions]) / avg_fat if avg_fat > 0 else 0
                    },
                    'meal_timing_patterns': dict(meal_timing_patterns),
                    'days_analyzed': len(macro_distributions)
                }
            
            return {'status': 'no_data'}
            
        except Exception as e:
            logger.error(f"Error analyzing macro distribution: {e}")
            return {'error': str(e)}
    
    async def _analyze_meal_timing(self, nutrition_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze meal timing patterns"""
        try:
            meals = nutrition_data.get('meals', [])
            
            if not meals:
                return {'status': 'no_data'}
            
            timing_patterns = defaultdict(list)
            meal_frequency = defaultdict(int)
            
            for meal in meals:
                meal_time = meal.get('time', '')
                meal_type = meal.get('meal_type', 'unknown')
                
                if meal_time:
                    # Parse time and categorize
                    try:
                        time_obj = datetime.strptime(meal_time, '%H:%M')
                        hour = time_obj.hour
                        
                        # Categorize meal times
                        if 5 <= hour < 11:
                            time_category = 'breakfast'
                        elif 11 <= hour < 15:
                            time_category = 'lunch'
                        elif 15 <= hour < 19:
                            time_category = 'afternoon_snack'
                        elif 19 <= hour < 22:
                            time_category = 'dinner'
                        else:
                            time_category = 'late_night'
                        
                        timing_patterns[time_category].append({
                            'calories': meal.get('calories', 0),
                            'protein': meal.get('protein', 0),
                            'carbs': meal.get('carbs', 0),
                            'fat': meal.get('fat', 0),
                            'time': meal_time
                        })
                        
                        meal_frequency[meal_type] += 1
                        
                    except ValueError:
                        continue
            
            # Calculate averages for each time category
            timing_averages = {}
            for category, meals in timing_patterns.items():
                if meals:
                    timing_averages[category] = {
                        'avg_calories': statistics.mean([m['calories'] for m in meals]),
                        'avg_protein': statistics.mean([m['protein'] for m in meals]),
                        'avg_carbs': statistics.mean([m['carbs'] for m in meals]),
                        'avg_fat': statistics.mean([m['fat'] for m in meals]),
                        'meal_count': len(meals)
                    }
            
            return {
                'timing_averages': timing_averages,
                'meal_frequency': dict(meal_frequency),
                'timing_consistency': len(timing_patterns),
                'total_meals': len(meals)
            }
            
        except Exception as e:
            logger.error(f"Error analyzing meal timing: {e}")
            return {'error': str(e)}
    
    async def _analyze_food_preferences(self, nutrition_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze food preferences and patterns"""
        try:
            meals = nutrition_data.get('meals', [])
            
            if not meals:
                return {'status': 'no_data'}
            
            food_frequency = defaultdict(int)
            food_categories = defaultdict(int)
            macro_preferences = defaultdict(list)
            
            for meal in meals:
                foods = meal.get('foods', [])
                
                for food in foods:
                    food_name = food.get('name', '').lower()
                    food_category = food.get('category', 'unknown')
                    
                    food_frequency[food_name] += 1
                    food_categories[food_category] += 1
                    
                    # Track macro preferences
                    macro_preferences['protein'].append(food.get('protein', 0))
                    macro_preferences['carbs'].append(food.get('carbs', 0))
                    macro_preferences['fat'].append(food.get('fat', 0))
            
            # Calculate most frequent foods
            most_frequent_foods = sorted(food_frequency.items(), key=lambda x: x[1], reverse=True)[:10]
            
            # Calculate macro preferences
            macro_prefs = {}
            for macro, values in macro_preferences.items():
                if values:
                    macro_prefs[macro] = {
                        'average': statistics.mean(values),
                        'preference_level': 'high' if statistics.mean(values) > 20 else 'medium' if statistics.mean(values) > 10 else 'low'
                    }
            
            return {
                'most_frequent_foods': most_frequent_foods,
                'food_categories': dict(food_categories),
                'macro_preferences': macro_prefs,
                'food_diversity': len(food_frequency),
                'total_foods': sum(food_frequency.values())
            }
            
        except Exception as e:
            logger.error(f"Error analyzing food preferences: {e}")
            return {'error': str(e)}
    
    async def _analyze_progress_correlation(self, nutrition_data: Dict[str, Any], measurements: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze correlation between nutrition and progress"""
        try:
            if not measurements:
                return {'status': 'no_measurements'}
            
            # Analyze weight trends
            weights = []
            dates = []
            
            for measurement in measurements:
                weight = measurement.get('weight', 0)
                date = measurement.get('date', '')
                
                if weight > 0 and date:
                    weights.append(weight)
                    dates.append(date)
            
            if len(weights) < 2:
                return {'status': 'insufficient_data'}
            
            # Calculate weight trend
            weight_change = weights[-1] - weights[0]
            weight_change_percent = (weight_change / weights[0]) * 100 if weights[0] > 0 else 0
            
            # Analyze nutrition correlation
            meals = nutrition_data.get('meals', [])
            daily_goals = nutrition_data.get('daily_goals', [])
            
            if meals and daily_goals:
                # Calculate average daily calories and macros
                daily_calories = []
                daily_protein = []
                
                for day_data in daily_goals:
                    if not day_data:
                        continue
                    
                    daily_totals = self._calculate_daily_totals(meals, day_data.get('date', ''))
                    
                    if daily_totals:
                        daily_calories.append(daily_totals.get('calories', 0))
                        daily_protein.append(daily_totals.get('protein', 0))
                
                if daily_calories and daily_protein:
                    avg_calories = statistics.mean(daily_calories)
                    avg_protein = statistics.mean(daily_protein)
                    
                    return {
                        'weight_change_kg': weight_change,
                        'weight_change_percent': weight_change_percent,
                        'average_daily_calories': avg_calories,
                        'average_daily_protein': avg_protein,
                        'calorie_consistency': 1 - (statistics.stdev(daily_calories) / avg_calories) if avg_calories > 0 else 0,
                        'protein_consistency': 1 - (statistics.stdev(daily_protein) / avg_protein) if avg_protein > 0 else 0,
                        'progress_trend': 'improving' if weight_change_percent < -1 else 'stable' if abs(weight_change_percent) < 1 else 'declining'
                    }
            
            return {
                'weight_change_kg': weight_change,
                'weight_change_percent': weight_change_percent,
                'status': 'limited_nutrition_data'
            }
            
        except Exception as e:
            logger.error(f"Error analyzing progress correlation: {e}")
            return {'error': str(e)}
    
    async def _generate_nutrition_recommendations(self, adherence_analysis: Dict[str, Any], macro_analysis: Dict[str, Any], 
                                                timing_analysis: Dict[str, Any], preference_analysis: Dict[str, Any], 
                                                progress_analysis: Dict[str, Any], user_profile: Dict[str, Any]) -> List[str]:
        """Generate AI-powered nutrition recommendations"""
        try:
            recommendations_prompt = f"""
            Based on this comprehensive nutrition analysis, generate 5-7 specific, actionable recommendations for this user.
            
            User Profile:
            - Goals: {', '.join(user_profile.get('fitnessGoals', []))}
            - Experience Level: {user_profile.get('experienceLevel', 'beginner')}
            - Dietary Restrictions: {', '.join(user_profile.get('dietaryRestrictions', []))}
            
            Analysis Results:
            - Adherence Analysis: {json.dumps(adherence_analysis, indent=2)}
            - Macro Analysis: {json.dumps(macro_analysis, indent=2)}
            - Timing Analysis: {json.dumps(timing_analysis, indent=2)}
            - Preference Analysis: {json.dumps(preference_analysis, indent=2)}
            - Progress Analysis: {json.dumps(progress_analysis, indent=2)}
            
            Focus on:
            1. Improving adherence to nutrition goals
            2. Optimizing macro distribution
            3. Better meal timing
            4. Addressing food preferences and variety
            5. Supporting progress goals
            
            Make recommendations practical and personalized to their experience level and goals.
            """
            
            bedrock_result = self.bedrock_service.invoke_bedrock(
                recommendations_prompt,
                {
                    'adherence_analysis': adherence_analysis,
                    'macro_analysis': macro_analysis,
                    'timing_analysis': timing_analysis,
                    'preference_analysis': preference_analysis,
                    'progress_analysis': progress_analysis,
                    'user_profile': user_profile
                },
                max_tokens=500
            )
            
            if bedrock_result['success']:
                return [bedrock_result['response']]
            else:
                return ['Focus on consistent meal timing and macro distribution.']
                
        except Exception as e:
            logger.error(f"Error generating nutrition recommendations: {e}")
            return ['Focus on consistent meal timing and macro distribution.']
    
    async def _calculate_overall_nutrition_score(self, adherence_analysis: Dict[str, Any], macro_analysis: Dict[str, Any], timing_analysis: Dict[str, Any]) -> float:
        """Calculate overall nutrition score"""
        try:
            score = 0.0
            
            # Adherence score (40% weight)
            if 'overall_adherence' in adherence_analysis:
                score += adherence_analysis['overall_adherence'] * 0.4
            
            # Macro distribution score (30% weight)
            if 'average_distribution' in macro_analysis:
                macro_dist = macro_analysis['average_distribution']
                # Ideal distribution: 30% protein, 40% carbs, 30% fat
                protein_score = 1 - abs(macro_dist.get('protein_percent', 0) - 30) / 30
                carbs_score = 1 - abs(macro_dist.get('carbs_percent', 0) - 40) / 40
                fat_score = 1 - abs(macro_dist.get('fat_percent', 0) - 30) / 30
                
                macro_score = (protein_score + carbs_score + fat_score) / 3
                score += macro_score * 0.3
            
            # Timing consistency score (30% weight)
            if 'timing_consistency' in timing_analysis:
                timing_score = min(1.0, timing_analysis['timing_consistency'] / 5)  # 5 meals per day ideal
                score += timing_score * 0.3
            
            return min(1.0, score)
            
        except Exception as e:
            logger.error(f"Error calculating overall nutrition score: {e}")
            return 0.5
    
    # Additional helper methods
    
    def _calculate_daily_totals(self, meals: List[Dict[str, Any]], date: str) -> Dict[str, float]:
        """Calculate daily nutrition totals"""
        try:
            daily_meals = [meal for meal in meals if meal.get('date', '') == date]
            
            totals = {
                'calories': 0,
                'protein': 0,
                'carbs': 0,
                'fat': 0
            }
            
            for meal in daily_meals:
                totals['calories'] += meal.get('calories', 0)
                totals['protein'] += meal.get('protein', 0)
                totals['carbs'] += meal.get('carbs', 0)
                totals['fat'] += meal.get('fat', 0)
            
            return totals
            
        except Exception as e:
            logger.error(f"Error calculating daily totals: {e}")
            return {'calories': 0, 'protein': 0, 'carbs': 0, 'fat': 0}
    
    def _calculate_macro_adherence(self, actual: float, goal: float) -> float:
        """Calculate macro adherence score"""
        if goal == 0:
            return 1.0
        
        adherence = actual / goal
        if adherence >= 0.9 and adherence <= 1.1:  # Within 10%
            return 1.0
        elif adherence >= 0.8 and adherence <= 1.2:  # Within 20%
            return 0.8
        else:
            return max(0.0, 1.0 - abs(adherence - 1.0))
    
    def _calculate_calorie_adherence(self, actual: float, goal: float) -> float:
        """Calculate calorie adherence score"""
        if goal == 0:
            return 1.0
        
        adherence = actual / goal
        if adherence >= 0.95 and adherence <= 1.05:  # Within 5%
            return 1.0
        elif adherence >= 0.9 and adherence <= 1.1:  # Within 10%
            return 0.8
        else:
            return max(0.0, 1.0 - abs(adherence - 1.0))
    
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
    
    # Placeholder methods for additional functionality
    
    async def _analyze_nutrition_progress(self, nutrition_data: Dict[str, Any], measurements: List[Dict[str, Any]], workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze nutrition progress correlation"""
        # Implementation for nutrition progress analysis
        return {'status': 'placeholder'}
    
    async def _determine_adjustment_strategy(self, progress_analysis: Dict[str, Any], user_profile: Dict[str, Any], current_plan: Dict[str, Any]) -> Dict[str, Any]:
        """Determine nutrition adjustment strategy"""
        # Implementation for adjustment strategy
        return {'strategy': 'placeholder'}
    
    async def _generate_adjusted_plan(self, current_plan: Dict[str, Any], strategy: Dict[str, Any], user_profile: Dict[str, Any], progress_analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Generate adjusted nutrition plan"""
        # Implementation for adjusted plan generation
        return current_plan
    
    async def _generate_adjustment_reasoning(self, strategy: Dict[str, Any], progress_analysis: Dict[str, Any]) -> str:
        """Generate adjustment reasoning"""
        # Implementation for adjustment reasoning
        return "Nutrition plan adjusted based on progress analysis."
    
    async def _analyze_current_timing_patterns(self, nutrition_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze current meal timing patterns"""
        # Implementation for timing pattern analysis
        return {'status': 'placeholder'}
    
    async def _analyze_workout_schedule(self, workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze workout schedule for meal timing optimization"""
        # Implementation for workout schedule analysis
        return {'status': 'placeholder'}
    
    async def _build_substitution_context(self, user_profile: Dict[str, Any], nutrition_data: Dict[str, Any]) -> Dict[str, Any]:
        """Build context for food substitution"""
        # Implementation for substitution context
        return {'user_profile': user_profile}
    
    async def _analyze_hydration_data(self, nutrition_data: Dict[str, Any], workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze hydration patterns"""
        # Implementation for hydration analysis
        return {'status': 'placeholder'}
    
    async def _calculate_hydration_needs(self, user_profile: Dict[str, Any], workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate hydration needs"""
        # Implementation for hydration needs calculation
        return {'status': 'placeholder'}
    
    async def _generate_hydration_recommendations(self, hydration_analysis: Dict[str, Any], hydration_needs: Dict[str, Any], user_profile: Dict[str, Any]) -> List[str]:
        """Generate hydration recommendations"""
        # Implementation for hydration recommendations
        return ['Stay hydrated throughout the day']
    
    async def _calculate_hydration_score(self, hydration_analysis: Dict[str, Any], hydration_needs: Dict[str, Any]) -> float:
        """Calculate hydration score"""
        # Implementation for hydration score calculation
        return 0.5
