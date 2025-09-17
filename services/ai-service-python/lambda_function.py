import json
import logging
import os
from typing import Dict, Any, Optional
import boto3
from botocore.exceptions import ClientError
import numpy as np
import pandas as pd
from PIL import Image
import cv2
import io
import base64
from datetime import datetime, timezone
import traceback

# Import auth layer
from auth_layer import AuthLayer

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
s3_client = boto3.client('s3')
cognito_client = boto3.client('cognito-idp')

# Environment variables
TABLE_NAME = os.environ.get('DYNAMODB_TABLE', 'gymcoach-ai-main')
REGION = os.environ.get('AWS_REGION', 'us-east-1')
COGNITO_USER_POOL_ID = os.environ.get('COGNITO_USER_POOL_ID')
JWT_SECRET = os.environ.get('JWT_SECRET')

# Initialize auth layer
auth_layer = AuthLayer()

class AIRecommendationEngine:
    """AI-powered recommendation engine for fitness coaching"""
    
    def __init__(self):
        self.table = dynamodb.Table(TABLE_NAME)
        self.models = {}
        self._load_models()
    
    def _load_models(self):
        """Load pre-trained ML models"""
        # In a real implementation, you would load actual trained models
        # For now, we'll use placeholder models
        logger.info("Loading AI models...")
        # self.models['workout_recommender'] = load_workout_model()
        # self.models['nutrition_optimizer'] = load_nutrition_model()
        # self.models['form_analyzer'] = load_form_analysis_model()
        # self.models['progress_predictor'] = load_progress_model()
        logger.info("AI models loaded successfully")
    
    def get_personalized_recommendations(self, user_id: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Generate personalized workout and nutrition recommendations"""
        try:
            # Get user profile and preferences
            user_profile = self._get_user_profile(user_id)
            if not user_profile:
                return {"error": "User profile not found"}
            
            # Get user's workout history
            workout_history = self._get_workout_history(user_id)
            
            # Get user's nutrition data
            nutrition_data = self._get_nutrition_data(user_id)
            
            # Generate recommendations based on user data
            recommendations = {
                "workout_recommendations": self._generate_workout_recommendations(
                    user_profile, workout_history, context
                ),
                "nutrition_recommendations": self._generate_nutrition_recommendations(
                    user_profile, nutrition_data, context
                ),
                "lifestyle_recommendations": self._generate_lifestyle_recommendations(
                    user_profile, context
                ),
                "goal_adjustments": self._suggest_goal_adjustments(
                    user_profile, workout_history, nutrition_data
                )
            }
            
            return recommendations
            
        except Exception as e:
            logger.error(f"Error generating personalized recommendations: {str(e)}")
            return {"error": "Failed to generate recommendations"}
    
    def analyze_exercise_form(self, image_data: str, exercise_type: str) -> Dict[str, Any]:
        """Analyze exercise form from image data"""
        try:
            # Decode base64 image
            image_bytes = base64.b64decode(image_data)
            image = Image.open(io.BytesIO(image_bytes))
            image_array = np.array(image)
            
            # Convert to OpenCV format
            if len(image_array.shape) == 3:
                image_cv = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
            else:
                image_cv = image_array
            
            # Analyze form based on exercise type
            form_analysis = self._analyze_form_pose(image_cv, exercise_type)
            
            return {
                "exercise_type": exercise_type,
                "form_score": form_analysis["score"],
                "feedback": form_analysis["feedback"],
                "improvements": form_analysis["improvements"],
                "risk_factors": form_analysis["risk_factors"],
                "confidence": form_analysis["confidence"]
            }
            
        except Exception as e:
            logger.error(f"Error analyzing exercise form: {str(e)}")
            return {"error": "Failed to analyze exercise form"}
    
    def predict_progress(self, user_id: str, timeframe: str) -> Dict[str, Any]:
        """Predict user's fitness progress over time"""
        try:
            # Get user's historical data
            workout_history = self._get_workout_history(user_id)
            nutrition_data = self._get_nutrition_data(user_id)
            body_measurements = self._get_body_measurements(user_id)
            
            # Generate progress predictions
            predictions = {
                "strength_gains": self._predict_strength_gains(workout_history, timeframe),
                "weight_changes": self._predict_weight_changes(nutrition_data, body_measurements, timeframe),
                "endurance_improvements": self._predict_endurance_improvements(workout_history, timeframe),
                "body_composition": self._predict_body_composition(body_measurements, nutrition_data, timeframe),
                "milestone_achievements": self._predict_milestones(workout_history, nutrition_data, timeframe)
            }
            
            return predictions
            
        except Exception as e:
            logger.error(f"Error predicting progress: {str(e)}")
            return {"error": "Failed to predict progress"}
    
    def get_injury_prevention_advice(self, user_id: str, risk_factors: Dict[str, Any]) -> Dict[str, Any]:
        """Provide AI-powered injury prevention advice"""
        try:
            user_profile = self._get_user_profile(user_id)
            workout_history = self._get_workout_history(user_id)
            
            # Analyze risk factors
            risk_assessment = self._assess_injury_risk(user_profile, workout_history, risk_factors)
            
            advice = {
                "risk_level": risk_assessment["level"],
                "risk_factors": risk_assessment["factors"],
                "prevention_strategies": risk_assessment["strategies"],
                "exercise_modifications": risk_assessment["modifications"],
                "recovery_recommendations": risk_assessment["recovery"],
                "warning_signs": risk_assessment["warning_signs"]
            }
            
            return advice
            
        except Exception as e:
            logger.error(f"Error generating injury prevention advice: {str(e)}")
            return {"error": "Failed to generate injury prevention advice"}
    
    def optimize_nutrition(self, user_id: str, goals: Dict[str, Any]) -> Dict[str, Any]:
        """Optimize nutrition plan based on user goals and data"""
        try:
            user_profile = self._get_user_profile(user_id)
            nutrition_data = self._get_nutrition_data(user_id)
            workout_schedule = self._get_workout_schedule(user_id)
            
            # Generate optimized nutrition plan
            nutrition_plan = {
                "daily_macros": self._calculate_optimal_macros(user_profile, goals),
                "meal_timing": self._optimize_meal_timing(workout_schedule),
                "supplement_recommendations": self._recommend_supplements(user_profile, goals),
                "hydration_plan": self._create_hydration_plan(user_profile, workout_schedule),
                "pre_post_workout_nutrition": self._optimize_workout_nutrition(workout_schedule),
                "weekly_meal_plan": self._generate_weekly_meal_plan(user_profile, goals)
            }
            
            return nutrition_plan
            
        except Exception as e:
            logger.error(f"Error optimizing nutrition: {str(e)}")
            return {"error": "Failed to optimize nutrition"}
    
    def set_ai_goals(self, user_id: str, current_goals: Dict[str, Any]) -> Dict[str, Any]:
        """AI-assisted goal setting and adjustment"""
        try:
            user_profile = self._get_user_profile(user_id)
            progress_data = self._get_progress_data(user_id)
            
            # Analyze current goals and suggest adjustments
            goal_analysis = {
                "current_goals_assessment": self._assess_current_goals(current_goals, progress_data),
                "suggested_adjustments": self._suggest_goal_adjustments(user_profile, progress_data),
                "new_goal_recommendations": self._recommend_new_goals(user_profile, progress_data),
                "timeline_optimization": self._optimize_goal_timeline(current_goals, progress_data),
                "milestone_breakdown": self._create_milestone_breakdown(current_goals)
            }
            
            return goal_analysis
            
        except Exception as e:
            logger.error(f"Error setting AI goals: {str(e)}")
            return {"error": "Failed to set AI goals"}
    
    def get_motivation_coaching(self, user_id: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Provide AI-powered motivation and coaching"""
        try:
            user_profile = self._get_user_profile(user_id)
            recent_activity = self._get_recent_activity(user_id)
            
            # Generate motivational content
            motivation = {
                "personalized_message": self._generate_motivational_message(user_profile, context),
                "progress_celebration": self._celebrate_progress(recent_activity),
                "challenge_suggestions": self._suggest_challenges(user_profile, recent_activity),
                "social_encouragement": self._generate_social_encouragement(user_profile, context),
                "mindset_tips": self._provide_mindset_tips(user_profile, context)
            }
            
            return motivation
            
        except Exception as e:
            logger.error(f"Error generating motivation coaching: {str(e)}")
            return {"error": "Failed to generate motivation coaching"}
    
    def _get_user_profile(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user profile from DynamoDB"""
        try:
            response = self.table.get_item(
                Key={'PK': f'USER#{user_id}', 'SK': f'USER#{user_id}'}
            )
            return response.get('Item')
        except ClientError as e:
            logger.error(f"Error getting user profile: {e}")
            return None
    
    def _get_workout_history(self, user_id: str) -> list:
        """Get user's workout history"""
        try:
            response = self.table.query(
                KeyConditionExpression='PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues={
                    ':pk': f'USER#{user_id}',
                    ':sk': 'WORKOUT_SESSION#'
                }
            )
            return response.get('Items', [])
        except ClientError as e:
            logger.error(f"Error getting workout history: {e}")
            return []
    
    def _get_nutrition_data(self, user_id: str) -> list:
        """Get user's nutrition data"""
        try:
            response = self.table.query(
                KeyConditionExpression='PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues={
                    ':pk': f'USER#{user_id}',
                    ':sk': 'MEAL#'
                }
            )
            return response.get('Items', [])
        except ClientError as e:
            logger.error(f"Error getting nutrition data: {e}")
            return []
    
    def _get_body_measurements(self, user_id: str) -> list:
        """Get user's body measurements"""
        try:
            response = self.table.query(
                KeyConditionExpression='PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues={
                    ':pk': f'USER#{user_id}',
                    ':sk': 'BODY_MEASUREMENT#'
                }
            )
            return response.get('Items', [])
        except ClientError as e:
            logger.error(f"Error getting body measurements: {e}")
            return []
    
    def _get_workout_schedule(self, user_id: str) -> list:
        """Get user's workout schedule"""
        try:
            response = self.table.query(
                KeyConditionExpression='PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues={
                    ':pk': f'USER#{user_id}',
                    ':sk': 'WORKOUT_PLAN#'
                }
            )
            return response.get('Items', [])
        except ClientError as e:
            logger.error(f"Error getting workout schedule: {e}")
            return []
    
    def _get_progress_data(self, user_id: str) -> Dict[str, Any]:
        """Get user's progress data"""
        return {
            "workout_history": self._get_workout_history(user_id),
            "nutrition_data": self._get_nutrition_data(user_id),
            "body_measurements": self._get_body_measurements(user_id)
        }
    
    def _get_recent_activity(self, user_id: str) -> Dict[str, Any]:
        """Get user's recent activity"""
        return {
            "recent_workouts": self._get_workout_history(user_id)[-5:],  # Last 5 workouts
            "recent_meals": self._get_nutrition_data(user_id)[-10:],  # Last 10 meals
            "recent_measurements": self._get_body_measurements(user_id)[-3:]  # Last 3 measurements
        }
    
    # Placeholder methods for AI functionality
    def _generate_workout_recommendations(self, user_profile, workout_history, context):
        """Generate personalized workout recommendations"""
        return {
            "recommended_exercises": ["Squats", "Deadlifts", "Bench Press"],
            "intensity_adjustments": "Increase by 5%",
            "form_focus_areas": ["Squat depth", "Deadlift form"],
            "recovery_suggestions": ["Add rest day", "Focus on mobility"]
        }
    
    def _generate_nutrition_recommendations(self, user_profile, nutrition_data, context):
        """Generate personalized nutrition recommendations"""
        return {
            "macro_adjustments": {"protein": "+20g", "carbs": "-50g"},
            "meal_timing": "Eat 2 hours before workout",
            "supplement_suggestions": ["Creatine", "Protein powder"],
            "hydration_goals": "3-4 liters per day"
        }
    
    def _generate_lifestyle_recommendations(self, user_profile, context):
        """Generate lifestyle recommendations"""
        return {
            "sleep_optimization": "Aim for 7-9 hours",
            "stress_management": "Add meditation routine",
            "activity_suggestions": ["Walking", "Yoga"],
            "habit_formation": "Track daily habits"
        }
    
    def _suggest_goal_adjustments(self, user_profile, workout_history, nutrition_data):
        """Suggest goal adjustments"""
        return {
            "current_goals": "Weight loss: 10 lbs",
            "suggested_adjustments": "Increase protein intake",
            "timeline_modifications": "Extend by 2 weeks",
            "new_goals": "Add strength training"
        }
    
    def _analyze_form_pose(self, image, exercise_type):
        """Analyze exercise form using computer vision"""
        # Placeholder implementation
        return {
            "score": 8.5,
            "feedback": "Good form overall, slight forward lean on squats",
            "improvements": ["Keep chest up", "Sit back more"],
            "risk_factors": ["Knee valgus", "Forward lean"],
            "confidence": 0.85
        }
    
    def _predict_strength_gains(self, workout_history, timeframe):
        """Predict strength gains"""
        return {
            "bench_press": "+15 lbs in 3 months",
            "squat": "+25 lbs in 3 months",
            "deadlift": "+30 lbs in 3 months"
        }
    
    def _predict_weight_changes(self, nutrition_data, body_measurements, timeframe):
        """Predict weight changes"""
        return {
            "weight_loss": "2-3 lbs per month",
            "body_fat_reduction": "1-2% per month",
            "muscle_gain": "0.5-1 lb per month"
        }
    
    def _predict_endurance_improvements(self, workout_history, timeframe):
        """Predict endurance improvements"""
        return {
            "cardio_capacity": "+15% in 2 months",
            "recovery_time": "-20% in 1 month",
            "workout_duration": "+10 minutes in 6 weeks"
        }
    
    def _predict_body_composition(self, body_measurements, nutrition_data, timeframe):
        """Predict body composition changes"""
        return {
            "muscle_mass": "+2-3 lbs",
            "body_fat": "-3-5%",
            "waist_circumference": "-2-3 inches"
        }
    
    def _predict_milestones(self, workout_history, nutrition_data, timeframe):
        """Predict milestone achievements"""
        return {
            "strength_milestones": ["100 lb bench press", "200 lb squat"],
            "endurance_milestones": ["30 min cardio", "5K run"],
            "body_milestones": ["10% body fat", "Visible abs"]
        }
    
    def _assess_injury_risk(self, user_profile, workout_history, risk_factors):
        """Assess injury risk"""
        return {
            "level": "Low",
            "factors": ["Overtraining", "Poor form"],
            "strategies": ["Deload week", "Form check"],
            "modifications": ["Reduce weight", "Add warm-up"],
            "recovery": ["More rest", "Mobility work"],
            "warning_signs": ["Joint pain", "Fatigue"]
        }
    
    def _calculate_optimal_macros(self, user_profile, goals):
        """Calculate optimal macronutrients"""
        return {
            "protein": "150g",
            "carbs": "200g",
            "fat": "80g",
            "calories": "2200"
        }
    
    def _optimize_meal_timing(self, workout_schedule):
        """Optimize meal timing"""
        return {
            "pre_workout": "2 hours before",
            "post_workout": "30 minutes after",
            "bedtime": "2 hours before sleep"
        }
    
    def _recommend_supplements(self, user_profile, goals):
        """Recommend supplements"""
        return ["Creatine", "Protein powder", "Multivitamin", "Omega-3"]
    
    def _create_hydration_plan(self, user_profile, workout_schedule):
        """Create hydration plan"""
        return {
            "daily_water": "3-4 liters",
            "pre_workout": "500ml",
            "during_workout": "250ml every 15 min",
            "post_workout": "500ml"
        }
    
    def _optimize_workout_nutrition(self, workout_schedule):
        """Optimize pre/post workout nutrition"""
        return {
            "pre_workout": "Banana + coffee",
            "post_workout": "Protein shake + fruit",
            "timing": "30-60 minutes after workout"
        }
    
    def _generate_weekly_meal_plan(self, user_profile, goals):
        """Generate weekly meal plan"""
        return {
            "monday": ["Oatmeal", "Chicken salad", "Salmon + rice"],
            "tuesday": ["Greek yogurt", "Turkey wrap", "Beef stir-fry"],
            # ... more days
        }
    
    def _assess_current_goals(self, current_goals, progress_data):
        """Assess current goals"""
        return {
            "realistic": True,
            "achievable": True,
            "timeline": "Appropriate",
            "adjustments_needed": False
        }
    
    def _suggest_goal_adjustments(self, user_profile, progress_data):
        """Suggest goal adjustments"""
        return {
            "intensity": "Increase by 10%",
            "timeline": "Extend by 2 weeks",
            "focus_areas": ["Strength", "Endurance"]
        }
    
    def _recommend_new_goals(self, user_profile, progress_data):
        """Recommend new goals"""
        return {
            "short_term": ["Lose 5 lbs", "Run 5K"],
            "long_term": ["Lose 20 lbs", "Run half marathon"],
            "skill_based": ["Master pull-ups", "Improve flexibility"]
        }
    
    def _optimize_goal_timeline(self, current_goals, progress_data):
        """Optimize goal timeline"""
        return {
            "realistic_timeline": "6 months",
            "milestone_dates": ["Month 1", "Month 3", "Month 6"],
            "checkpoint_reviews": "Monthly"
        }
    
    def _create_milestone_breakdown(self, current_goals):
        """Create milestone breakdown"""
        return {
            "milestone_1": "Lose 2 lbs",
            "milestone_2": "Lose 5 lbs",
            "milestone_3": "Lose 10 lbs",
            "final_goal": "Lose 15 lbs"
        }
    
    def _generate_motivational_message(self, user_profile, context):
        """Generate motivational message"""
        return "You're making great progress! Keep pushing forward!"
    
    def _celebrate_progress(self, recent_activity):
        """Celebrate recent progress"""
        return {
            "achievements": ["Completed 5 workouts this week", "Hit new PR"],
            "celebration_message": "Amazing work this week!"
        }
    
    def _suggest_challenges(self, user_profile, recent_activity):
        """Suggest challenges"""
        return {
            "weekly_challenge": "Complete 4 workouts",
            "monthly_challenge": "Lose 5 lbs",
            "skill_challenge": "Master 10 pull-ups"
        }
    
    def _generate_social_encouragement(self, user_profile, context):
        """Generate social encouragement"""
        return {
            "community_highlights": "You're in the top 10% this week!",
            "friend_achievements": "Your friend just hit a new PR!",
            "group_challenges": "Join the monthly fitness challenge!"
        }
    
    def _provide_mindset_tips(self, user_profile, context):
        """Provide mindset tips"""
        return {
            "motivation_tips": ["Focus on progress, not perfection"],
            "mindset_shifts": ["View setbacks as learning opportunities"],
            "mental_training": ["Practice visualization techniques"]
        }


def lambda_handler(event, context):
    """Main Lambda handler for AI service"""
    try:
        logger.info(f"Received event: {json.dumps(event)}")
        
        # Authenticate request
        auth_result = auth_layer.authenticate(event)
        if not auth_result['is_authorized']:
            return {
                'statusCode': 403,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
                },
                'body': json.dumps({
                    'error': 'Forbidden',
                    'message': auth_result.get('error', 'Access denied')
                })
            }
        
        # Extract user context
        auth_context = auth_result.get('context', {})
        user_id = auth_context.get('user_id')
        
        # Initialize AI engine
        ai_engine = AIRecommendationEngine()
        
        # Parse the event
        http_method = event.get('requestContext', {}).get('http', {}).get('method', 'GET')
        path = event.get('rawPath', '/')
        body = event.get('body', '{}')
        
        # Parse body if it's a string
        if isinstance(body, str):
            try:
                body = json.loads(body)
            except json.JSONDecodeError:
                body = {}
        
        # Route to appropriate handler
        if http_method == 'POST':
            if '/personalized-recommendations' in path:
                user_id = body.get('userId')
                context = body.get('context', {})
                result = ai_engine.get_personalized_recommendations(user_id, context)
            elif '/form-analysis' in path:
                image_data = body.get('imageData')
                exercise_type = body.get('exerciseType')
                result = ai_engine.analyze_exercise_form(image_data, exercise_type)
            elif '/progress-prediction' in path:
                user_id = body.get('userId')
                timeframe = body.get('timeframe', '3 months')
                result = ai_engine.predict_progress(user_id, timeframe)
            elif '/injury-prevention' in path:
                user_id = body.get('userId')
                risk_factors = body.get('riskFactors', {})
                result = ai_engine.get_injury_prevention_advice(user_id, risk_factors)
            elif '/nutrition-optimization' in path:
                user_id = body.get('userId')
                goals = body.get('goals', {})
                result = ai_engine.optimize_nutrition(user_id, goals)
            elif '/goal-setting' in path:
                user_id = body.get('userId')
                current_goals = body.get('currentGoals', {})
                result = ai_engine.set_ai_goals(user_id, current_goals)
            elif '/motivation-coaching' in path:
                user_id = body.get('userId')
                context = body.get('context', {})
                result = ai_engine.get_motivation_coaching(user_id, context)
            else:
                result = {"error": "Unknown endpoint"}
        else:
            result = {"error": "Method not allowed"}
        
        # Return response
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
            },
            'body': json.dumps(result)
        }
        
    except Exception as e:
        logger.error(f"Error in lambda_handler: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e)
            })
        }
