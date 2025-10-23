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

class MacroOptimizer:
    """Service for personalized macro recommendations and optimization"""
    
    def __init__(self):
        self.table_name = os.environ.get('DYNAMODB_TABLE', 'gymcoach-ai-main')
        self.user_data_service = UserDataService(self.table_name)
        self.pattern_analyzer = PatternAnalyzer()
        self.rag_service = RAGService()
        self.bedrock_service = BedrockService()
        
        # Macro optimization parameters
        self.protein_per_kg_lbm = 2.2  # grams per kg lean body mass
        self.carb_timing_factor = 1.2  # carb timing multiplier
        self.fat_minimum_percent = 0.2  # minimum 20% calories from fat
        self.calorie_deficit_max = 0.25  # maximum 25% calorie deficit
        
    async def calculate_optimal_macros(self, user_id: str, goals: List[str], current_plan: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Calculate optimal macro distribution based on user profile and goals
        
        Args:
            user_id: User ID
            goals: List of fitness goals
            current_plan: Current nutrition plan (optional)
            
        Returns:
            Dictionary with optimal macro recommendations
        """
        try:
            logger.info(f"Calculating optimal macros for user {user_id}")
            
            # Get user profile and measurements
            user_profile = await self.user_data_service.get_user_profile(user_id)
            measurements = await self.user_data_service.get_historical_measurements(user_id, 30)
            workouts = await self.user_data_service.get_historical_workouts(user_id, 14)
            
            if not user_profile:
                return {'error': 'User profile not found'}
            
            # Calculate baseline metrics
            baseline_metrics = await self._calculate_baseline_metrics(user_profile, measurements)
            
            # Determine calorie needs
            calorie_needs = await self._calculate_calorie_needs(baseline_metrics, goals, workouts)
            
            # Calculate macro distribution
            macro_distribution = await self._calculate_macro_distribution(
                calorie_needs, goals, baseline_metrics, workouts
            )
            
            # Optimize based on current plan if provided
            if current_plan:
                optimization = await self._optimize_current_plan(
                    current_plan, macro_distribution, baseline_metrics, goals
                )
            else:
                optimization = None
            
            # Generate AI-powered recommendations
            recommendations = await self._generate_macro_recommendations(
                macro_distribution, baseline_metrics, goals, workouts
            )
            
            return {
                'user_id': user_id,
                'goals': goals,
                'baseline_metrics': baseline_metrics,
                'calorie_needs': calorie_needs,
                'macro_distribution': macro_distribution,
                'optimization': optimization,
                'recommendations': recommendations,
                'calculation_date': datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error calculating optimal macros for user {user_id}: {e}")
            return {'error': str(e)}
    
    async def adjust_macros_for_progress(self, user_id: str, current_plan: Dict[str, Any], progress_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Adjust macros based on progress and adherence
        
        Args:
            user_id: User ID
            current_plan: Current nutrition plan
            progress_data: Progress analysis data
            
        Returns:
            Dictionary with adjusted macro recommendations
        """
        try:
            logger.info(f"Adjusting macros for progress for user {user_id}")
            
            # Get user context
            user_profile = await self.user_data_service.get_user_profile(user_id)
            measurements = await self.user_data_service.get_historical_measurements(user_id, 60)
            
            if not user_profile:
                return {'error': 'User profile not found'}
            
            # Analyze progress trends
            progress_trends = await self._analyze_progress_trends(progress_data, measurements)
            
            # Determine adjustment strategy
            adjustment_strategy = await self._determine_macro_adjustment_strategy(
                progress_trends, current_plan, user_profile
            )
            
            # Calculate adjusted macros
            adjusted_macros = await self._calculate_adjusted_macros(
                current_plan, adjustment_strategy, progress_trends
            )
            
            # Generate adjustment reasoning
            reasoning = await self._generate_adjustment_reasoning(
                adjustment_strategy, progress_trends
            )
            
            return {
                'user_id': user_id,
                'original_plan': current_plan,
                'adjusted_plan': adjusted_macros,
                'adjustment_strategy': adjustment_strategy,
                'progress_trends': progress_trends,
                'reasoning': reasoning,
                'adjustment_date': datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error adjusting macros for progress for user {user_id}: {e}")
            return {'error': str(e)}
    
    async def optimize_macro_timing(self, user_id: str, macro_plan: Dict[str, Any]) -> Dict[str, Any]:
        """
        Optimize macro timing based on workout schedule and goals
        
        Args:
            user_id: User ID
            macro_plan: Current macro plan
            
        Returns:
            Dictionary with optimized macro timing
        """
        try:
            logger.info(f"Optimizing macro timing for user {user_id}")
            
            # Get user context
            user_profile = await self.user_data_service.get_user_profile(user_id)
            workouts = await self.user_data_service.get_historical_workouts(user_id, 14)
            
            if not user_profile:
                return {'error': 'User profile not found'}
            
            # Analyze workout patterns
            workout_patterns = await self._analyze_workout_patterns(workouts)
            
            # Use RAG to get macro timing best practices
            rag_context = await self.rag_service.retrieve_nutrition_context(
                query="macro timing optimization pre workout post workout meal timing",
                user_context={
                    'goals': user_profile.get('fitnessGoals', []),
                    'workout_patterns': workout_patterns
                }
            )
            
            # Generate optimized timing using AI
            timing_prompt = f"""
            Optimize macro timing for this user based on their workout schedule and goals.
            
            User Profile:
            - Goals: {', '.join(user_profile.get('fitnessGoals', []))}
            - Experience Level: {user_profile.get('experienceLevel', 'beginner')}
            
            Current Macro Plan:
            {json.dumps(macro_plan, indent=2)}
            
            Workout Patterns:
            {json.dumps(workout_patterns, indent=2)}
            
            Macro Timing Best Practices:
            {rag_context['context']}
            
            Provide optimized macro timing recommendations including:
            1. Pre-workout nutrition (timing and macro composition)
            2. Post-workout nutrition (timing and macro composition)
            3. Meal timing throughout the day
            4. Carb cycling recommendations
            5. Protein distribution across meals
            
            Consider their workout schedule, goals, and experience level.
            """
            
            bedrock_result = self.bedrock_service.invoke_bedrock(
                timing_prompt,
                {
                    'user_profile': user_profile,
                    'macro_plan': macro_plan,
                    'workout_patterns': workout_patterns,
                    'rag_context': rag_context
                },
                max_tokens=600
            )
            
            if bedrock_result['success']:
                return {
                    'user_id': user_id,
                    'original_plan': macro_plan,
                    'optimized_timing': bedrock_result['response'],
                    'workout_patterns': workout_patterns,
                    'rag_sources': rag_context['sources'],
                    'optimization_date': datetime.now(timezone.utc).isoformat()
                }
            else:
                return {'error': 'Failed to optimize macro timing'}
                
        except Exception as e:
            logger.error(f"Error optimizing macro timing for user {user_id}: {e}")
            return {'error': str(e)}
    
    async def suggest_macro_modifications(self, user_id: str, current_macros: Dict[str, Any], issues: List[str]) -> Dict[str, Any]:
        """
        Suggest macro modifications to address specific issues
        
        Args:
            user_id: User ID
            current_macros: Current macro plan
            issues: List of issues to address
            
        Returns:
            Dictionary with macro modification suggestions
        """
        try:
            logger.info(f"Suggesting macro modifications for user {user_id}")
            
            # Get user context
            user_profile = await self.user_data_service.get_user_profile(user_id)
            
            if not user_profile:
                return {'error': 'User profile not found'}
            
            # Use RAG to get issue-specific recommendations
            rag_context = await self.rag_service.retrieve_nutrition_context(
                query=f"macro modifications for {', '.join(issues)} nutrition adjustments",
                user_context={
                    'goals': user_profile.get('fitnessGoals', []),
                    'dietary_restrictions': user_profile.get('dietaryRestrictions', [])
                }
            )
            
            # Generate modification suggestions using AI
            modification_prompt = f"""
            Suggest macro modifications to address these specific issues: {', '.join(issues)}
            
            User Profile:
            - Goals: {', '.join(user_profile.get('fitnessGoals', []))}
            - Dietary Restrictions: {', '.join(user_profile.get('dietaryRestrictions', []))}
            - Experience Level: {user_profile.get('experienceLevel', 'beginner')}
            
            Current Macros:
            {json.dumps(current_macros, indent=2)}
            
            Issues to Address:
            {', '.join(issues)}
            
            Nutrition Knowledge:
            {rag_context['context']}
            
            For each issue, provide:
            1. Specific macro adjustments needed
            2. Reasoning for the changes
            3. Expected timeline for results
            4. Monitoring recommendations
            5. Potential side effects to watch for
            
            Focus on practical, sustainable changes.
            """
            
            bedrock_result = self.bedrock_service.invoke_bedrock(
                modification_prompt,
                {
                    'user_profile': user_profile,
                    'current_macros': current_macros,
                    'issues': issues,
                    'rag_context': rag_context
                },
                max_tokens=500
            )
            
            if bedrock_result['success']:
                return {
                    'user_id': user_id,
                    'current_macros': current_macros,
                    'issues': issues,
                    'modifications': bedrock_result['response'],
                    'rag_sources': rag_context['sources'],
                    'generated_at': datetime.now(timezone.utc).isoformat()
                }
            else:
                return {'error': 'Failed to generate macro modifications'}
                
        except Exception as e:
            logger.error(f"Error suggesting macro modifications for user {user_id}: {e}")
            return {'error': str(e)}
    
    # Helper methods for macro calculation
    
    async def _calculate_baseline_metrics(self, user_profile: Dict[str, Any], measurements: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate baseline metabolic metrics"""
        try:
            # Get latest measurements
            if measurements:
                latest_measurement = sorted(measurements, key=lambda x: x.get('date', ''))[-1]
                weight = latest_measurement.get('weight', 0)
                height = latest_measurement.get('height', 0)
                body_fat = latest_measurement.get('bodyFat', 0)
            else:
                weight = user_profile.get('weight', 0)
                height = user_profile.get('height', 0)
                body_fat = user_profile.get('bodyFat', 0)
            
            if weight <= 0 or height <= 0:
                return {'error': 'Invalid weight or height'}
            
            # Calculate BMI
            bmi = weight / ((height / 100) ** 2)
            
            # Calculate lean body mass
            lean_body_mass = weight * (1 - body_fat / 100) if body_fat > 0 else weight * 0.8  # Default 20% body fat
            
            # Calculate BMR using Mifflin-St Jeor Equation
            age = user_profile.get('age', 30)
            gender = user_profile.get('gender', 'male')
            
            if gender.lower() == 'male':
                bmr = 10 * weight + 6.25 * height - 5 * age + 5
            else:
                bmr = 10 * weight + 6.25 * height - 5 * age - 161
            
            return {
                'weight_kg': weight,
                'height_cm': height,
                'bmi': bmi,
                'body_fat_percent': body_fat,
                'lean_body_mass_kg': lean_body_mass,
                'bmr_calories': bmr,
                'age': age,
                'gender': gender
            }
            
        except Exception as e:
            logger.error(f"Error calculating baseline metrics: {e}")
            return {'error': str(e)}
    
    async def _calculate_calorie_needs(self, baseline_metrics: Dict[str, Any], goals: List[str], workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate daily calorie needs based on goals and activity"""
        try:
            if 'error' in baseline_metrics:
                return baseline_metrics
            
            bmr = baseline_metrics['bmr_calories']
            
            # Calculate activity level multiplier
            activity_multiplier = await self._calculate_activity_multiplier(workouts, baseline_metrics)
            
            # Calculate TDEE (Total Daily Energy Expenditure)
            tdee = bmr * activity_multiplier
            
            # Adjust based on goals
            goal_adjustment = await self._calculate_goal_adjustment(goals, tdee)
            
            return {
                'bmr_calories': bmr,
                'activity_multiplier': activity_multiplier,
                'tdee_calories': tdee,
                'goal_adjustment': goal_adjustment,
                'target_calories': tdee + goal_adjustment,
                'deficit_calories': abs(goal_adjustment) if goal_adjustment < 0 else 0,
                'surplus_calories': goal_adjustment if goal_adjustment > 0 else 0
            }
            
        except Exception as e:
            logger.error(f"Error calculating calorie needs: {e}")
            return {'error': str(e)}
    
    async def _calculate_macro_distribution(self, calorie_needs: Dict[str, Any], goals: List[str], 
                                         baseline_metrics: Dict[str, Any], workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate optimal macro distribution"""
        try:
            if 'error' in calorie_needs:
                return calorie_needs
            
            target_calories = calorie_needs['target_calories']
            lean_body_mass = baseline_metrics['lean_body_mass_kg']
            
            # Calculate protein needs
            protein_grams = lean_body_mass * self.protein_per_kg_lbm
            protein_calories = protein_grams * 4
            
            # Calculate fat needs (minimum 20% of calories)
            fat_percent = max(0.2, await self._calculate_fat_percentage(goals, workouts))
            fat_calories = target_calories * fat_percent
            fat_grams = fat_calories / 9
            
            # Calculate carb needs (remaining calories)
            remaining_calories = target_calories - protein_calories - fat_calories
            carb_calories = max(0, remaining_calories)
            carb_grams = carb_calories / 4
            
            # Adjust for workout timing
            carb_timing_adjustment = await self._calculate_carb_timing_adjustment(workouts, carb_grams)
            
            return {
                'protein': {
                    'grams': protein_grams,
                    'calories': protein_calories,
                    'percent': (protein_calories / target_calories) * 100
                },
                'carbs': {
                    'grams': carb_grams,
                    'calories': carb_calories,
                    'percent': (carb_calories / target_calories) * 100,
                    'timing_adjustment': carb_timing_adjustment
                },
                'fat': {
                    'grams': fat_grams,
                    'calories': fat_calories,
                    'percent': (fat_calories / target_calories) * 100
                },
                'total_calories': target_calories,
                'distribution_summary': {
                    'protein_percent': (protein_calories / target_calories) * 100,
                    'carbs_percent': (carb_calories / target_calories) * 100,
                    'fat_percent': (fat_calories / target_calories) * 100
                }
            }
            
        except Exception as e:
            logger.error(f"Error calculating macro distribution: {e}")
            return {'error': str(e)}
    
    async def _calculate_activity_multiplier(self, workouts: List[Dict[str, Any]], baseline_metrics: Dict[str, Any]) -> float:
        """Calculate activity level multiplier based on workout frequency and intensity"""
        try:
            if not workouts:
                return 1.2  # Sedentary
            
            # Analyze workout frequency and intensity
            workout_frequency = len(workouts) / 14  # workouts per week
            
            # Calculate average workout intensity
            total_volume = 0
            for workout in workouts:
                exercises = workout.get('exercises', [])
                workout_volume = sum(
                    ex.get('weight', 0) * ex.get('reps', 0) * ex.get('sets', 1)
                    for ex in exercises
                )
                total_volume += workout_volume
            
            avg_volume_per_workout = total_volume / len(workouts) if workouts else 0
            
            # Determine activity level based on frequency and intensity
            if workout_frequency >= 5 and avg_volume_per_workout > 1000:
                return 1.9  # Very active
            elif workout_frequency >= 4 and avg_volume_per_workout > 500:
                return 1.7  # Active
            elif workout_frequency >= 3:
                return 1.5  # Moderately active
            elif workout_frequency >= 2:
                return 1.3  # Lightly active
            else:
                return 1.2  # Sedentary
                
        except Exception as e:
            logger.error(f"Error calculating activity multiplier: {e}")
            return 1.5  # Default moderately active
    
    async def _calculate_goal_adjustment(self, goals: List[str], tdee: float) -> float:
        """Calculate calorie adjustment based on goals"""
        try:
            goal_lower = [goal.lower() for goal in goals]
            
            if any(word in ' '.join(goal_lower) for word in ['lose', 'weight', 'fat', 'cut']):
                # Weight loss: 20% deficit
                return -tdee * 0.2
            elif any(word in ' '.join(goal_lower) for word in ['gain', 'muscle', 'bulk', 'mass']):
                # Muscle gain: 10% surplus
                return tdee * 0.1
            elif any(word in ' '.join(goal_lower) for word in ['maintain', 'maintenance']):
                # Maintenance: no adjustment
                return 0
            else:
                # Default: slight deficit for body recomposition
                return -tdee * 0.1
                
        except Exception as e:
            logger.error(f"Error calculating goal adjustment: {e}")
            return 0
    
    async def _calculate_fat_percentage(self, goals: List[str], workouts: List[Dict[str, Any]]) -> float:
        """Calculate optimal fat percentage based on goals and training"""
        try:
            goal_lower = [goal.lower() for goal in goals]
            
            if any(word in ' '.join(goal_lower) for word in ['lose', 'weight', 'fat', 'cut']):
                # Fat loss: lower fat intake
                return 0.25
            elif any(word in ' '.join(goal_lower) for word in ['gain', 'muscle', 'bulk']):
                # Muscle gain: higher fat intake
                return 0.35
            else:
                # Maintenance/recomp: moderate fat intake
                return 0.3
                
        except Exception as e:
            logger.error(f"Error calculating fat percentage: {e}")
            return 0.3
    
    async def _calculate_carb_timing_adjustment(self, workouts: List[Dict[str, Any]], base_carbs: float) -> Dict[str, Any]:
        """Calculate carb timing adjustments based on workout schedule"""
        try:
            if not workouts:
                return {'pre_workout': 0, 'post_workout': 0, 'rest_day': base_carbs}
            
            # Analyze workout timing patterns
            workout_times = []
            for workout in workouts:
                workout_time = workout.get('time', '')
                if workout_time:
                    try:
                        time_obj = datetime.strptime(workout_time, '%H:%M')
                        workout_times.append(time_obj.hour)
                    except ValueError:
                        continue
            
            if workout_times:
                avg_workout_time = statistics.mean(workout_times)
                
                # Distribute carbs around workout times
                pre_workout_carbs = base_carbs * 0.2  # 20% pre-workout
                post_workout_carbs = base_carbs * 0.3  # 30% post-workout
                rest_day_carbs = base_carbs * 0.8  # 80% on rest days
                
                return {
                    'pre_workout': pre_workout_carbs,
                    'post_workout': post_workout_carbs,
                    'rest_day': rest_day_carbs,
                    'workout_day_total': base_carbs * 1.2,
                    'avg_workout_time': avg_workout_time
                }
            else:
                return {'pre_workout': 0, 'post_workout': 0, 'rest_day': base_carbs}
                
        except Exception as e:
            logger.error(f"Error calculating carb timing adjustment: {e}")
            return {'pre_workout': 0, 'post_workout': 0, 'rest_day': base_carbs}
    
    async def _generate_macro_recommendations(self, macro_distribution: Dict[str, Any], baseline_metrics: Dict[str, Any], 
                                            goals: List[str], workouts: List[Dict[str, Any]]) -> List[str]:
        """Generate AI-powered macro recommendations"""
        try:
            recommendations_prompt = f"""
            Generate personalized macro recommendations based on this user's profile and calculated macros.
            
            User Goals:
            {', '.join(goals)}
            
            Calculated Macros:
            {json.dumps(macro_distribution, indent=2)}
            
            Baseline Metrics:
            {json.dumps(baseline_metrics, indent=2)}
            
            Provide 5-7 specific recommendations covering:
            1. Protein timing and distribution
            2. Carb timing around workouts
            3. Fat intake optimization
            4. Meal frequency and timing
            5. Hydration recommendations
            6. Supplement suggestions
            7. Monitoring and adjustment guidelines
            
            Make recommendations practical and personalized to their goals and experience level.
            """
            
            bedrock_result = self.bedrock_service.invoke_bedrock(
                recommendations_prompt,
                {
                    'macro_distribution': macro_distribution,
                    'baseline_metrics': baseline_metrics,
                    'goals': goals,
                    'workouts': workouts
                },
                max_tokens=500
            )
            
            if bedrock_result['success']:
                return [bedrock_result['response']]
            else:
                return ['Focus on consistent protein intake throughout the day.']
                
        except Exception as e:
            logger.error(f"Error generating macro recommendations: {e}")
            return ['Focus on consistent protein intake throughout the day.']
    
    # Additional helper methods
    
    async def _optimize_current_plan(self, current_plan: Dict[str, Any], macro_distribution: Dict[str, Any], 
                                   baseline_metrics: Dict[str, Any], goals: List[str]) -> Dict[str, Any]:
        """Optimize current plan based on calculated macros"""
        # Implementation for current plan optimization
        return {'status': 'placeholder'}
    
    async def _analyze_progress_trends(self, progress_data: Dict[str, Any], measurements: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze progress trends for macro adjustments"""
        # Implementation for progress trend analysis
        return {'status': 'placeholder'}
    
    async def _determine_macro_adjustment_strategy(self, progress_trends: Dict[str, Any], current_plan: Dict[str, Any], user_profile: Dict[str, Any]) -> Dict[str, Any]:
        """Determine macro adjustment strategy"""
        # Implementation for adjustment strategy
        return {'strategy': 'placeholder'}
    
    async def _calculate_adjusted_macros(self, current_plan: Dict[str, Any], adjustment_strategy: Dict[str, Any], progress_trends: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate adjusted macros"""
        # Implementation for adjusted macro calculation
        return current_plan
    
    async def _generate_adjustment_reasoning(self, adjustment_strategy: Dict[str, Any], progress_trends: Dict[str, Any]) -> str:
        """Generate adjustment reasoning"""
        # Implementation for adjustment reasoning
        return "Macros adjusted based on progress analysis."
    
    async def _analyze_workout_patterns(self, workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze workout patterns for timing optimization"""
        # Implementation for workout pattern analysis
        return {'status': 'placeholder'}
