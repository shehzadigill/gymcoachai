import os
import json
import logging
from typing import Dict, List, Optional
import boto3
from botocore.exceptions import ClientError

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
