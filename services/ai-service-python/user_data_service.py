import os
import json
import logging
from typing import Dict, List, Optional
import boto3
from botocore.exceptions import ClientError
from datetime import datetime, timezone, timedelta
from collections import defaultdict, Counter
import statistics

logger = logging.getLogger(__name__)

class UserDataService:
    """Service for fetching user data from DynamoDB"""
    
    def __init__(self, dynamodb_table_name: str):
        self.dynamodb = boto3.resource('dynamodb')
        self.table = self.dynamodb.Table(dynamodb_table_name)
    
    async def get_user_profile(self, user_id: str) -> Optional[Dict]:
        """
        Get user profile data
        
        Args:
            user_id: User ID
            
        Returns:
            User profile dictionary or None
        """
        try:
            response = self.table.get_item(
                Key={'PK': f'USER#{user_id}', 'SK': 'PROFILE'}
            )
            
            if 'Item' in response:
                return response['Item']
            return None
            
        except ClientError as e:
            logger.error(f"Error getting user profile for {user_id}: {e}")
            return None
    
    async def get_recent_workouts(self, user_id: str, limit: int = 5) -> List[Dict]:
        """
        Get recent workout sessions
        
        Args:
            user_id: User ID
            limit: Maximum number of workouts to return
            
        Returns:
            List of workout dictionaries
        """
        try:
            response = self.table.query(
                KeyConditionExpression='PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues={
                    ':pk': f'USER#{user_id}',
                    ':sk': 'WORKOUT_SESSION#'
                },
                ScanIndexForward=False,  # Most recent first
                Limit=limit
            )
            
            workouts = []
            for item in response.get('Items', []):
                workouts.append({
                    'id': item.get('id', ''),
                    'name': item.get('name', 'Workout'),
                    'date': item.get('date', ''),
                    'duration': item.get('duration', 0),
                    'exercises': item.get('exercises', []),
                    'notes': item.get('notes', '')
                })
            
            return workouts
            
        except ClientError as e:
            logger.error(f"Error getting recent workouts for {user_id}: {e}")
            return []
    
    async def get_body_measurements(self, user_id: str, limit: int = 3) -> List[Dict]:
        """
        Get recent body measurements
        
        Args:
            user_id: User ID
            limit: Maximum number of measurements to return
            
        Returns:
            List of body measurement dictionaries
        """
        try:
            response = self.table.query(
                KeyConditionExpression='PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues={
                    ':pk': f'USER#{user_id}',
                    ':sk': 'BODY_MEASUREMENT#'
                },
                ScanIndexForward=False,  # Most recent first
                Limit=limit
            )
            
            measurements = []
            for item in response.get('Items', []):
                measurements.append({
                    'date': item.get('date', ''),
                    'weight': item.get('weight', 0),
                    'bodyFat': item.get('bodyFat', 0),
                    'muscleMass': item.get('muscleMass', 0),
                    'measurements': item.get('measurements', {})
                })
            
            return measurements
            
        except ClientError as e:
            logger.error(f"Error getting body measurements for {user_id}: {e}")
            return []
    
    async def get_nutrition_data(self, user_id: str, limit: int = 7) -> Dict:
        """
        Get recent nutrition data
        
        Args:
            user_id: User ID
            limit: Maximum number of days to return
            
        Returns:
            Dictionary with nutrition data
        """
        try:
            # Get recent meals
            response = self.table.query(
                KeyConditionExpression='PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues={
                    ':pk': f'USER#{user_id}',
                    ':sk': 'MEAL#'
                },
                ScanIndexForward=False,  # Most recent first
                Limit=limit * 3  # Assume 3 meals per day
            )
            
            meals = []
            for item in response.get('Items', []):
                meals.append({
                    'date': item.get('date', ''),
                    'mealType': item.get('mealType', ''),
                    'foods': item.get('foods', []),
                    'calories': item.get('calories', 0),
                    'macros': item.get('macros', {})
                })
            
            # Get daily goals from profile
            profile = await self.get_user_profile(user_id)
            daily_goals = None
            if profile and 'dailyGoals' in profile:
                daily_goals = profile['dailyGoals']
            
            return {
                'meals': meals,
                'dailyGoals': daily_goals
            }
            
        except ClientError as e:
            logger.error(f"Error getting nutrition data for {user_id}: {e}")
            return {'meals': [], 'dailyGoals': None}
    
    async def get_ai_preferences(self, user_id: str) -> Optional[Dict]:
        """
        Get AI trainer preferences from user profile
        
        Args:
            user_id: User ID
            
        Returns:
            AI trainer preferences dictionary or None
        """
        try:
            profile = await self.get_user_profile(user_id)
            if profile and 'aiTrainer' in profile:
                return profile['aiTrainer']
            return None
            
        except Exception as e:
            logger.error(f"Error getting AI preferences for {user_id}: {e}")
            return None
    
    async def build_user_context(self, user_id: str) -> Dict:
        """
        Build comprehensive user context for AI prompts
        
        Args:
            user_id: User ID
            
        Returns:
            Dictionary with user context
        """
        try:
            # Fetch all user data in parallel
            profile = await self.get_user_profile(user_id)
            workouts = await self.get_recent_workouts(user_id, 3)
            measurements = await self.get_body_measurements(user_id, 2)
            nutrition = await self.get_nutrition_data(user_id, 3)
            ai_prefs = await self.get_ai_preferences(user_id)
            
            context = {
                'user_profile': profile or {},
                'recent_workouts': workouts or [],
                'body_measurements': measurements or [],
                'nutrition_data': nutrition or {},
                'ai_preferences': ai_prefs or {}
            }
            
            return context
            
        except Exception as e:
            logger.error(f"Error building user context for {user_id}: {e}")
            return {}
    
    async def get_user_stats(self, user_id: str) -> Dict:
        """
        Get user fitness statistics
        
        Args:
            user_id: User ID
            
        Returns:
            Dictionary with user stats
        """
        try:
            # Get workout count
            workout_response = self.table.query(
                KeyConditionExpression='PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues={
                    ':pk': f'USER#{user_id}',
                    ':sk': 'WORKOUT_SESSION#'
                },
                Select='COUNT'
            )
            
            # Get measurement count
            measurement_response = self.table.query(
                KeyConditionExpression='PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues={
                    ':pk': f'USER#{user_id}',
                    ':sk': 'BODY_MEASUREMENT#'
                },
                Select='COUNT'
            )
            
            return {
                'totalWorkouts': workout_response.get('Count', 0),
                'totalMeasurements': measurement_response.get('Count', 0),
                'hasRecentActivity': len(await self.get_recent_workouts(user_id, 1)) > 0
            }
            
        except ClientError as e:
            logger.error(f"Error getting user stats for {user_id}: {e}")
            return {
                'totalWorkouts': 0,
                'totalMeasurements': 0,
                'hasRecentActivity': False
            }
    
    async def get_historical_workouts(self, user_id: str, days: int = 30) -> List[Dict]:
        """
        Get historical workout sessions for pattern analysis
        
        Args:
            user_id: User ID
            days: Number of days to look back
            
        Returns:
            List of workout dictionaries
        """
        try:
            # Calculate date range
            end_date = datetime.now(timezone.utc)
            start_date = end_date - timedelta(days=days)
            
            response = self.table.query(
                KeyConditionExpression='PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues={
                    ':pk': f'USER#{user_id}',
                    ':sk': 'WORKOUT_SESSION#'
                },
                ScanIndexForward=False  # Most recent first
            )
            
            workouts = []
            for item in response.get('Items', []):
                workout_date = item.get('date', '')
                if workout_date:
                    try:
                        date_obj = datetime.fromisoformat(workout_date.replace('Z', '+00:00'))
                        if start_date <= date_obj <= end_date:
                            workouts.append({
                                'id': item.get('id', ''),
                                'name': item.get('name', 'Workout'),
                                'date': workout_date,
                                'duration': item.get('duration', 0),
                                'exercises': item.get('exercises', []),
                                'notes': item.get('notes', ''),
                                'completed': item.get('completed', True)
                            })
                    except Exception as e:
                        logger.warning(f"Error parsing workout date {workout_date}: {e}")
                        continue
            
            return workouts
            
        except ClientError as e:
            logger.error(f"Error getting historical workouts for {user_id}: {e}")
            return []
    
    async def get_historical_measurements(self, user_id: str, days: int = 90) -> List[Dict]:
        """
        Get historical body measurements for trend analysis
        
        Args:
            user_id: User ID
            days: Number of days to look back
            
        Returns:
            List of measurement dictionaries
        """
        try:
            # Calculate date range
            end_date = datetime.now(timezone.utc)
            start_date = end_date - timedelta(days=days)
            
            response = self.table.query(
                KeyConditionExpression='PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues={
                    ':pk': f'USER#{user_id}',
                    ':sk': 'BODY_MEASUREMENT#'
                },
                ScanIndexForward=False  # Most recent first
            )
            
            measurements = []
            for item in response.get('Items', []):
                measurement_date = item.get('date', '')
                if measurement_date:
                    try:
                        date_obj = datetime.fromisoformat(measurement_date.replace('Z', '+00:00'))
                        if start_date <= date_obj <= end_date:
                            measurements.append({
                                'date': measurement_date,
                                'weight': item.get('weight', 0),
                                'bodyFat': item.get('bodyFat', 0),
                                'muscleMass': item.get('muscleMass', 0),
                                'measurements': item.get('measurements', {}),
                                'notes': item.get('notes', '')
                            })
                    except Exception as e:
                        logger.warning(f"Error parsing measurement date {measurement_date}: {e}")
                        continue
            
            return measurements
            
        except ClientError as e:
            logger.error(f"Error getting historical measurements for {user_id}: {e}")
            return []
    
    async def get_historical_nutrition(self, user_id: str, days: int = 14) -> Dict:
        """
        Get historical nutrition data for pattern analysis
        
        Args:
            user_id: User ID
            days: Number of days to look back
            
        Returns:
            Dictionary with nutrition data
        """
        try:
            # Calculate date range
            end_date = datetime.now(timezone.utc)
            start_date = end_date - timedelta(days=days)
            
            response = self.table.query(
                KeyConditionExpression='PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues={
                    ':pk': f'USER#{user_id}',
                    ':sk': 'MEAL#'
                },
                ScanIndexForward=False  # Most recent first
            )
            
            meals = []
            for item in response.get('Items', []):
                meal_date = item.get('date', '')
                if meal_date:
                    try:
                        date_obj = datetime.fromisoformat(meal_date.replace('Z', '+00:00'))
                        if start_date <= date_obj <= end_date:
                            meals.append({
                                'date': meal_date,
                                'mealType': item.get('mealType', ''),
                                'foods': item.get('foods', []),
                                'calories': item.get('calories', 0),
                                'macros': item.get('macros', {}),
                                'notes': item.get('notes', '')
                            })
                    except Exception as e:
                        logger.warning(f"Error parsing meal date {meal_date}: {e}")
                        continue
            
            # Get daily goals from profile
            profile = await self.get_user_profile(user_id)
            daily_goals = None
            if profile and 'dailyGoals' in profile:
                daily_goals = profile['dailyGoals']
            
            return {
                'meals': meals,
                'dailyGoals': daily_goals,
                'days_analyzed': days
            }
            
        except ClientError as e:
            logger.error(f"Error getting historical nutrition for {user_id}: {e}")
            return {'meals': [], 'dailyGoals': None, 'days_analyzed': days}
    
    async def get_workout_patterns(self, user_id: str, days: int = 30) -> Dict:
        """
        Get workout patterns and statistics
        
        Args:
            user_id: User ID
            days: Number of days to analyze
            
        Returns:
            Dictionary with workout patterns
        """
        try:
            workouts = await self.get_historical_workouts(user_id, days)
            
            if not workouts:
                return {'status': 'no_data', 'message': 'No workout data available'}
            
            # Analyze patterns
            patterns = {
                'frequency': self._analyze_workout_frequency(workouts),
                'consistency': self._analyze_workout_consistency(workouts),
                'exercise_preferences': self._analyze_exercise_preferences(workouts),
                'duration_patterns': self._analyze_duration_patterns(workouts),
                'day_of_week_patterns': self._analyze_day_of_week_patterns(workouts)
            }
            
            return patterns
            
        except Exception as e:
            logger.error(f"Error getting workout patterns for {user_id}: {e}")
            return {'error': str(e)}
    
    async def get_nutrition_patterns(self, user_id: str, days: int = 14) -> Dict:
        """
        Get nutrition patterns and statistics
        
        Args:
            user_id: User ID
            days: Number of days to analyze
            
        Returns:
            Dictionary with nutrition patterns
        """
        try:
            nutrition_data = await self.get_historical_nutrition(user_id, days)
            meals = nutrition_data.get('meals', [])
            daily_goals = nutrition_data.get('dailyGoals', {})
            
            if not meals:
                return {'status': 'no_data', 'message': 'No nutrition data available'}
            
            # Analyze patterns
            patterns = {
                'macro_distribution': self._analyze_macro_distribution(meals),
                'meal_timing': self._analyze_meal_timing(meals),
                'calorie_consistency': self._analyze_calorie_consistency(meals),
                'adherence_to_goals': self._analyze_goal_adherence(meals, daily_goals),
                'food_preferences': self._analyze_food_preferences(meals)
            }
            
            return patterns
            
        except Exception as e:
            logger.error(f"Error getting nutrition patterns for {user_id}: {e}")
            return {'error': str(e)}
    
    async def get_progress_trends(self, user_id: str, days: int = 90) -> Dict:
        """
        Get progress trends and analysis
        
        Args:
            user_id: User ID
            days: Number of days to analyze
            
        Returns:
            Dictionary with progress trends
        """
        try:
            measurements = await self.get_historical_measurements(user_id, days)
            workouts = await self.get_historical_workouts(user_id, days)
            
            trends = {
                'body_composition_trends': self._analyze_body_composition_trends(measurements),
                'strength_trends': self._analyze_strength_trends(workouts),
                'fitness_trends': self._analyze_fitness_trends(workouts),
                'overall_progress': self._calculate_overall_progress(measurements, workouts)
            }
            
            return trends
            
        except Exception as e:
            logger.error(f"Error getting progress trends for {user_id}: {e}")
            return {'error': str(e)}
    
    # Helper methods for pattern analysis
    
    def _analyze_workout_frequency(self, workouts: List[Dict]) -> Dict:
        """Analyze workout frequency patterns"""
        if not workouts:
            return {'status': 'no_data'}
        
        # Sort by date
        sorted_workouts = sorted(workouts, key=lambda x: x.get('date', ''))
        
        # Calculate frequency metrics
        total_workouts = len(workouts)
        days_span = self._calculate_days_span(sorted_workouts)
        avg_per_week = total_workouts / max(days_span, 1) * 7
        
        # Calculate gaps
        gaps = self._calculate_workout_gaps(sorted_workouts)
        avg_gap = statistics.mean(gaps) if gaps else 0
        
        return {
            'total_workouts': total_workouts,
            'avg_per_week': round(avg_per_week, 2),
            'avg_gap_days': round(avg_gap, 1),
            'days_span': days_span
        }
    
    def _analyze_workout_consistency(self, workouts: List[Dict]) -> Dict:
        """Analyze workout consistency patterns"""
        if not workouts:
            return {'status': 'no_data'}
        
        # Analyze by day of week
        day_counts = Counter()
        for workout in workouts:
            workout_date = workout.get('date', '')
            if workout_date:
                try:
                    date_obj = datetime.fromisoformat(workout_date.replace('Z', '+00:00'))
                    day_name = date_obj.strftime('%A')
                    day_counts[day_name] += 1
                except Exception:
                    continue
        
        # Calculate consistency score
        gaps = self._calculate_workout_gaps(workouts)
        consistency_score = self._calculate_consistency_score(gaps)
        
        return {
            'day_distribution': dict(day_counts),
            'consistency_score': consistency_score,
            'preferred_days': [day for day, count in day_counts.most_common(3)]
        }
    
    def _analyze_exercise_preferences(self, workouts: List[Dict]) -> Dict:
        """Analyze exercise preferences"""
        if not workouts:
            return {'status': 'no_data'}
        
        exercise_counts = Counter()
        muscle_group_counts = Counter()
        
        for workout in workouts:
            exercises = workout.get('exercises', [])
            for exercise in exercises:
                exercise_name = exercise.get('name', '')
                if exercise_name:
                    exercise_counts[exercise_name] += 1
                
                muscle_groups = exercise.get('muscleGroups', [])
                for muscle_group in muscle_groups:
                    muscle_group_counts[muscle_group] += 1
        
        return {
            'top_exercises': dict(exercise_counts.most_common(10)),
            'top_muscle_groups': dict(muscle_group_counts.most_common(5)),
            'exercise_diversity': len(exercise_counts)
        }
    
    def _analyze_duration_patterns(self, workouts: List[Dict]) -> Dict:
        """Analyze workout duration patterns"""
        if not workouts:
            return {'status': 'no_data'}
        
        durations = [w.get('duration', 0) for w in workouts if w.get('duration', 0) > 0]
        
        if not durations:
            return {'status': 'no_data'}
        
        return {
            'avg_duration': round(statistics.mean(durations), 1),
            'min_duration': min(durations),
            'max_duration': max(durations),
            'duration_consistency': round(1 - (statistics.stdev(durations) / statistics.mean(durations)), 2) if len(durations) > 1 else 1.0
        }
    
    def _analyze_day_of_week_patterns(self, workouts: List[Dict]) -> Dict:
        """Analyze day of week patterns"""
        if not workouts:
            return {'status': 'no_data'}
        
        day_counts = Counter()
        for workout in workouts:
            workout_date = workout.get('date', '')
            if workout_date:
                try:
                    date_obj = datetime.fromisoformat(workout_date.replace('Z', '+00:00'))
                    day_name = date_obj.strftime('%A')
                    day_counts[day_name] += 1
                except Exception:
                    continue
        
        return {
            'distribution': dict(day_counts),
            'most_active_day': day_counts.most_common(1)[0][0] if day_counts else None,
            'least_active_day': day_counts.most_common()[-1][0] if day_counts else None
        }
    
    def _analyze_macro_distribution(self, meals: List[Dict]) -> Dict:
        """Analyze macro distribution patterns"""
        if not meals:
            return {'status': 'no_data'}
        
        total_calories = 0
        total_protein = 0
        total_carbs = 0
        total_fat = 0
        
        for meal in meals:
            macros = meal.get('macros', {})
            total_calories += meal.get('calories', 0)
            total_protein += macros.get('protein', 0)
            total_carbs += macros.get('carbs', 0)
            total_fat += macros.get('fat', 0)
        
        if total_calories == 0:
            return {'status': 'no_data'}
        
        return {
            'avg_daily_calories': round(total_calories / max(len(meals) / 3, 1), 0),  # Assuming 3 meals per day
            'protein_percentage': round((total_protein * 4) / total_calories * 100, 1),
            'carbs_percentage': round((total_carbs * 4) / total_calories * 100, 1),
            'fat_percentage': round((total_fat * 9) / total_calories * 100, 1)
        }
    
    def _analyze_meal_timing(self, meals: List[Dict]) -> Dict:
        """Analyze meal timing patterns"""
        if not meals:
            return {'status': 'no_data'}
        
        meal_times = defaultdict(list)
        
        for meal in meals:
            meal_type = meal.get('mealType', '')
            meal_date = meal.get('date', '')
            
            if meal_type and meal_date:
                try:
                    date_obj = datetime.fromisoformat(meal_date.replace('Z', '+00:00'))
                    hour = date_obj.hour
                    meal_times[meal_type].append(hour)
                except Exception:
                    continue
        
        # Calculate average times
        avg_times = {}
        for meal_type, times in meal_times.items():
            if times:
                avg_times[meal_type] = round(statistics.mean(times), 1)
        
        return {
            'avg_meal_times': avg_times,
            'meal_frequency': {meal_type: len(times) for meal_type, times in meal_times.items()}
        }
    
    def _analyze_calorie_consistency(self, meals: List[Dict]) -> Dict:
        """Analyze calorie consistency"""
        if not meals:
            return {'status': 'no_data'}
        
        calories = [meal.get('calories', 0) for meal in meals if meal.get('calories', 0) > 0]
        
        if not calories:
            return {'status': 'no_data'}
        
        return {
            'avg_calories': round(statistics.mean(calories), 0),
            'calorie_variance': round(statistics.stdev(calories), 0) if len(calories) > 1 else 0,
            'consistency_score': round(1 - (statistics.stdev(calories) / statistics.mean(calories)), 2) if len(calories) > 1 and statistics.mean(calories) > 0 else 1.0
        }
    
    def _analyze_goal_adherence(self, meals: List[Dict], daily_goals: Dict) -> Dict:
        """Analyze adherence to daily goals"""
        if not meals or not daily_goals:
            return {'status': 'no_data'}
        
        # Group meals by day
        daily_meals = defaultdict(list)
        for meal in meals:
            meal_date = meal.get('date', '')
            if meal_date:
                try:
                    date_obj = datetime.fromisoformat(meal_date.replace('Z', '+00:00'))
                    day_key = date_obj.strftime('%Y-%m-%d')
                    daily_meals[day_key].append(meal)
                except Exception:
                    continue
        
        adherence_scores = []
        for day, day_meals in daily_meals.items():
            total_calories = sum(meal.get('calories', 0) for meal in day_meals)
            goal_calories = daily_goals.get('calories', 0)
            
            if goal_calories > 0:
                adherence = min(total_calories / goal_calories, 1.0)  # Cap at 100%
                adherence_scores.append(adherence)
        
        if not adherence_scores:
            return {'status': 'no_data'}
        
        return {
            'avg_adherence': round(statistics.mean(adherence_scores), 2),
            'adherence_consistency': round(1 - statistics.stdev(adherence_scores), 2) if len(adherence_scores) > 1 else 1.0,
            'days_analyzed': len(adherence_scores)
        }
    
    def _analyze_food_preferences(self, meals: List[Dict]) -> Dict:
        """Analyze food preferences"""
        if not meals:
            return {'status': 'no_data'}
        
        food_counts = Counter()
        category_counts = Counter()
        
        for meal in meals:
            foods = meal.get('foods', [])
            for food in foods:
                food_name = food.get('name', '')
                if food_name:
                    food_counts[food_name] += 1
                
                category = food.get('category', '')
                if category:
                    category_counts[category] += 1
        
        return {
            'top_foods': dict(food_counts.most_common(10)),
            'top_categories': dict(category_counts.most_common(5)),
            'food_diversity': len(food_counts)
        }
    
    def _analyze_body_composition_trends(self, measurements: List[Dict]) -> Dict:
        """Analyze body composition trends"""
        if not measurements:
            return {'status': 'no_data'}
        
        # Sort by date
        sorted_measurements = sorted(measurements, key=lambda x: x.get('date', ''))
        
        if len(sorted_measurements) < 2:
            return {'status': 'insufficient_data'}
        
        # Calculate trends
        weights = [m.get('weight', 0) for m in sorted_measurements if m.get('weight', 0) > 0]
        body_fats = [m.get('bodyFat', 0) for m in sorted_measurements if m.get('bodyFat', 0) > 0]
        
        trends = {}
        
        if len(weights) >= 2:
            weight_change = weights[-1] - weights[0]
            weight_change_percent = (weight_change / weights[0]) * 100 if weights[0] > 0 else 0
            trends['weight'] = {
                'change': round(weight_change, 2),
                'change_percent': round(weight_change_percent, 2),
                'trend': 'increasing' if weight_change > 0 else 'decreasing' if weight_change < 0 else 'stable'
            }
        
        if len(body_fats) >= 2:
            body_fat_change = body_fats[-1] - body_fats[0]
            trends['body_fat'] = {
                'change': round(body_fat_change, 2),
                'trend': 'increasing' if body_fat_change > 0 else 'decreasing' if body_fat_change < 0 else 'stable'
            }
        
        return {
            'trends': trends,
            'measurements_count': len(sorted_measurements),
            'time_span_days': self._calculate_days_span(sorted_measurements)
        }
    
    def _analyze_strength_trends(self, workouts: List[Dict]) -> Dict:
        """Analyze strength trends"""
        if not workouts:
            return {'status': 'no_data'}
        
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
        
        # Calculate trends
        strength_trends = {}
        for exercise, data in progression_data.items():
            if len(data) >= 3:
                sorted_data = sorted(data, key=lambda x: x['date'])
                first_1rm = sorted_data[0]['estimated_1rm']
                last_1rm = sorted_data[-1]['estimated_1rm']
                improvement = ((last_1rm - first_1rm) / first_1rm) * 100
                
                strength_trends[exercise] = {
                    'improvement_percentage': round(improvement, 2),
                    'trend': 'improving' if improvement > 5 else 'stable' if improvement > -5 else 'declining'
                }
        
        return {
            'strength_trends': strength_trends,
            'exercises_tracked': len(progression_data)
        }
    
    def _analyze_fitness_trends(self, workouts: List[Dict]) -> Dict:
        """Analyze general fitness trends"""
        if not workouts:
            return {'status': 'no_data'}
        
        # Analyze workout frequency over time
        weekly_counts = self._count_workouts_by_week(workouts)
        
        # Analyze duration trends
        durations = [w.get('duration', 0) for w in workouts if w.get('duration', 0) > 0]
        
        return {
            'frequency_trend': self._detect_frequency_trend(weekly_counts),
            'avg_duration': round(statistics.mean(durations), 1) if durations else 0,
            'total_workouts': len(workouts),
            'consistency_score': self._calculate_consistency_score(self._calculate_workout_gaps(workouts))
        }
    
    def _calculate_overall_progress(self, measurements: List[Dict], workouts: List[Dict]) -> Dict:
        """Calculate overall progress score"""
        progress_score = 0
        factors = []
        
        # Body composition progress
        if measurements:
            body_trends = self._analyze_body_composition_trends(measurements)
            if 'trends' in body_trends:
                # Positive progress for weight loss or muscle gain
                weight_trend = body_trends['trends'].get('weight', {}).get('trend', 'stable')
                if weight_trend == 'decreasing':  # Assuming weight loss goal
                    progress_score += 0.3
                    factors.append('weight_loss')
        
        # Strength progress
        if workouts:
            strength_trends = self._analyze_strength_trends(workouts)
            improving_exercises = sum(1 for trend in strength_trends.get('strength_trends', {}).values() 
                                    if trend.get('trend') == 'improving')
            total_exercises = strength_trends.get('exercises_tracked', 1)
            strength_progress = improving_exercises / total_exercises
            progress_score += strength_progress * 0.4
            factors.append(f'strength_improvement_{improving_exercises}/{total_exercises}')
        
        # Consistency progress
        if workouts:
            gaps = self._calculate_workout_gaps(workouts)
            consistency_score = self._calculate_consistency_score(gaps)
            progress_score += consistency_score * 0.3
            factors.append(f'consistency_{consistency_score:.2f}')
        
        return {
            'overall_score': round(progress_score, 2),
            'factors': factors,
            'grade': self._get_progress_grade(progress_score)
        }
    
    def _get_progress_grade(self, score: float) -> str:
        """Get progress grade based on score"""
        if score >= 0.8:
            return 'A'
        elif score >= 0.6:
            return 'B'
        elif score >= 0.4:
            return 'C'
        elif score >= 0.2:
            return 'D'
        else:
            return 'F'
    
    def _detect_frequency_trend(self, weekly_counts: List[int]) -> str:
        """Detect frequency trend"""
        if len(weekly_counts) < 3:
            return 'insufficient_data'
        
        # Simple trend detection
        if len(weekly_counts) >= 3:
            recent_avg = statistics.mean(weekly_counts[-3:])
            earlier_avg = statistics.mean(weekly_counts[:3])
            
            if recent_avg > earlier_avg * 1.1:
                return 'increasing'
            elif recent_avg < earlier_avg * 0.9:
                return 'decreasing'
            else:
                return 'stable'
        
        return 'stable'
    
    def _count_workouts_by_week(self, workouts: List[Dict]) -> List[int]:
        """Count workouts by week"""
        weekly_counts = defaultdict(int)
        
        for workout in workouts:
            workout_date = workout.get('date', '')
            if workout_date:
                try:
                    date_obj = datetime.fromisoformat(workout_date.replace('Z', '+00:00'))
                    week_key = date_obj.isocalendar()[:2]  # (year, week)
                    weekly_counts[week_key] += 1
                except Exception:
                    continue
        
        return list(weekly_counts.values())
    
    def _calculate_workout_gaps(self, workouts: List[Dict]) -> List[int]:
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
    
    def _calculate_consistency_score(self, gaps: List[int]) -> float:
        """Calculate consistency score based on workout gaps"""
        if not gaps:
            return 0.0
        
        # Lower standard deviation = more consistent
        avg_gap = statistics.mean(gaps)
        std_dev = statistics.stdev(gaps) if len(gaps) > 1 else 0
        
        # Score between 0 and 1, higher is more consistent
        consistency_score = max(0, 1 - (std_dev / max(avg_gap, 1)))
        return round(consistency_score, 2)
    
    def _calculate_days_span(self, records: List[Dict]) -> int:
        """Calculate days span between first and last record"""
        if len(records) < 2:
            return 0
        
        try:
            first_date = datetime.fromisoformat(records[0].get('date', '').replace('Z', '+00:00'))
            last_date = datetime.fromisoformat(records[-1].get('date', '').replace('Z', '+00:00'))
            return (last_date - first_date).days
        except Exception:
            return 0
