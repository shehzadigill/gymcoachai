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

logger = logging.getLogger(__name__)

class ProgressMonitor:
    """Service for monitoring user progress and detecting deviations"""
    
    def __init__(self):
        self.table_name = os.environ.get('DYNAMODB_TABLE', 'gymcoach-ai-main')
        self.user_data_service = UserDataService(self.table_name)
        self.pattern_analyzer = PatternAnalyzer()
        
        # Monitoring thresholds
        self.consistency_threshold = 0.3  # Below this triggers intervention
        self.progress_threshold = -0.05  # Negative progress threshold (-5%)
        self.plateau_threshold_weeks = 2  # Weeks without progress
        self.missed_workout_threshold = 3  # Days without workout
        self.nutrition_deviation_threshold = 0.2  # 20% deviation from goals
        
    async def monitor_user_progress(self, user_id: str) -> Dict[str, Any]:
        """
        Comprehensive progress monitoring for a user
        
        Args:
            user_id: User ID to monitor
            
        Returns:
            Dictionary with monitoring results and alerts
        """
        try:
            logger.info(f"Starting progress monitoring for user {user_id}")
            
            # Get user data
            user_profile = await self.user_data_service.get_user_profile(user_id)
            workouts = await self.user_data_service.get_historical_workouts(user_id, 30)
            measurements = await self.user_data_service.get_historical_measurements(user_id, 90)
            nutrition_data = await self.user_data_service.get_historical_nutrition(user_id, 14)
            
            if not user_profile:
                return {'error': 'User profile not found'}
            
            # Perform various monitoring checks
            monitoring_results = {
                'user_id': user_id,
                'monitoring_date': datetime.now(timezone.utc).isoformat(),
                'alerts': [],
                'metrics': {},
                'recommendations': [],
                'risk_factors': []
            }
            
            # 1. Workout consistency monitoring
            consistency_result = await self._monitor_workout_consistency(workouts)
            monitoring_results['metrics']['consistency'] = consistency_result
            if consistency_result['alert_level'] == 'high':
                monitoring_results['alerts'].append({
                    'type': 'consistency',
                    'level': 'high',
                    'message': 'Workout consistency is very low',
                    'details': consistency_result
                })
            
            # 2. Progress trend monitoring
            progress_result = await self._monitor_progress_trends(measurements, workouts)
            monitoring_results['metrics']['progress'] = progress_result
            if progress_result['alert_level'] == 'high':
                monitoring_results['alerts'].append({
                    'type': 'progress',
                    'level': 'high',
                    'message': 'Progress has stalled or declined',
                    'details': progress_result
                })
            
            # 3. Nutrition adherence monitoring
            nutrition_result = await self._monitor_nutrition_adherence(nutrition_data, user_profile)
            monitoring_results['metrics']['nutrition'] = nutrition_result
            if nutrition_result['alert_level'] == 'high':
                monitoring_results['alerts'].append({
                    'type': 'nutrition',
                    'level': 'high',
                    'message': 'Nutrition goals not being met',
                    'details': nutrition_result
                })
            
            # 4. Plateau detection
            plateau_result = await self._detect_plateaus(workouts)
            monitoring_results['metrics']['plateaus'] = plateau_result
            if plateau_result['plateaus_detected']:
                monitoring_results['alerts'].append({
                    'type': 'plateau',
                    'level': 'medium',
                    'message': f"Plateaus detected in {plateau_result['plateau_count']} exercises",
                    'details': plateau_result
                })
            
            # 5. Injury risk assessment
            injury_result = await self._assess_injury_risk(workouts, user_profile)
            monitoring_results['metrics']['injury_risk'] = injury_result
            if injury_result['risk_level'] == 'high':
                monitoring_results['alerts'].append({
                    'type': 'injury_risk',
                    'level': 'high',
                    'message': 'High injury risk detected',
                    'details': injury_result
                })
            
            # 6. Motivation assessment
            motivation_result = await self._assess_motivation_level(workouts, nutrition_data)
            monitoring_results['metrics']['motivation'] = motivation_result
            if motivation_result['motivation_level'] == 'low':
                monitoring_results['alerts'].append({
                    'type': 'motivation',
                    'level': 'medium',
                    'message': 'Low motivation detected',
                    'details': motivation_result
                })
            
            # Generate recommendations based on monitoring results
            recommendations = await self._generate_recommendations(monitoring_results)
            monitoring_results['recommendations'] = recommendations
            
            # Calculate overall risk score
            risk_score = self._calculate_overall_risk_score(monitoring_results)
            monitoring_results['overall_risk_score'] = risk_score
            
            logger.info(f"Progress monitoring completed for user {user_id}: {len(monitoring_results['alerts'])} alerts")
            return monitoring_results
            
        except Exception as e:
            logger.error(f"Error monitoring progress for user {user_id}: {e}")
            return {'error': str(e)}
    
    async def _monitor_workout_consistency(self, workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Monitor workout consistency patterns"""
        try:
            if not workouts:
                return {
                    'alert_level': 'high',
                    'consistency_score': 0.0,
                    'message': 'No workout data available',
                    'recommendations': ['Start tracking workouts']
                }
            
            # Analyze workout patterns
            patterns = await self.pattern_analyzer.analyze_workout_patterns(workouts)
            consistency_patterns = patterns.get('consistency_patterns', {})
            
            consistency_score = consistency_patterns.get('consistency_score', 0.0)
            avg_gap_days = consistency_patterns.get('avg_gap_days', 0)
            
            # Determine alert level
            if consistency_score < 0.3:
                alert_level = 'high'
            elif consistency_score < 0.6:
                alert_level = 'medium'
            else:
                alert_level = 'low'
            
            # Check for missed workouts
            days_since_last = self._calculate_days_since_last_workout(workouts)
            if days_since_last > self.missed_workout_threshold:
                alert_level = 'high'
            
            return {
                'alert_level': alert_level,
                'consistency_score': consistency_score,
                'avg_gap_days': avg_gap_days,
                'days_since_last_workout': days_since_last,
                'total_workouts': len(workouts),
                'recommendations': self._get_consistency_recommendations(consistency_score, days_since_last)
            }
            
        except Exception as e:
            logger.error(f"Error monitoring workout consistency: {e}")
            return {'alert_level': 'medium', 'error': str(e)}
    
    async def _monitor_progress_trends(self, measurements: List[Dict[str, Any]], workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Monitor progress trends in measurements and workouts"""
        try:
            progress_result = {
                'alert_level': 'low',
                'body_composition_trend': 'stable',
                'strength_trend': 'stable',
                'overall_trend': 'stable',
                'recommendations': []
            }
            
            # Analyze body composition trends
            if measurements and len(measurements) >= 2:
                body_trends = await self._analyze_body_composition_trends(measurements)
                progress_result['body_composition_trend'] = body_trends['overall_trend']
                
                if body_trends['overall_trend'] == 'declining':
                    progress_result['alert_level'] = 'high'
                    progress_result['recommendations'].append('Body composition declining - review nutrition and training')
            
            # Analyze strength trends
            if workouts and len(workouts) >= 5:
                strength_trends = await self._analyze_strength_trends(workouts)
                progress_result['strength_trend'] = strength_trends['overall_trend']
                
                if strength_trends['overall_trend'] == 'declining':
                    if progress_result['alert_level'] == 'low':
                        progress_result['alert_level'] = 'medium'
                    progress_result['recommendations'].append('Strength declining - review training program')
            
            # Determine overall trend
            if progress_result['body_composition_trend'] == 'declining' or progress_result['strength_trend'] == 'declining':
                progress_result['overall_trend'] = 'declining'
            elif progress_result['body_composition_trend'] == 'improving' or progress_result['strength_trend'] == 'improving':
                progress_result['overall_trend'] = 'improving'
            
            return progress_result
            
        except Exception as e:
            logger.error(f"Error monitoring progress trends: {e}")
            return {'alert_level': 'medium', 'error': str(e)}
    
    async def _monitor_nutrition_adherence(self, nutrition_data: Dict[str, Any], user_profile: Dict[str, Any]) -> Dict[str, Any]:
        """Monitor nutrition adherence to goals"""
        try:
            meals = nutrition_data.get('meals', [])
            daily_goals = nutrition_data.get('dailyGoals', {})
            
            if not meals or not daily_goals:
                return {
                    'alert_level': 'medium',
                    'adherence_score': 0.0,
                    'message': 'Insufficient nutrition data',
                    'recommendations': ['Start tracking meals and set daily goals']
                }
            
            # Analyze nutrition patterns
            nutrition_patterns = await self.pattern_analyzer.analyze_nutrition_patterns(nutrition_data)
            adherence_patterns = nutrition_patterns.get('adherence_patterns', {})
            
            adherence_score = adherence_patterns.get('avg_adherence', 0.0)
            
            # Determine alert level
            if adherence_score < 0.5:
                alert_level = 'high'
            elif adherence_score < 0.7:
                alert_level = 'medium'
            else:
                alert_level = 'low'
            
            # Check for specific macro deviations
            macro_distribution = nutrition_patterns.get('macro_distribution', {})
            calorie_consistency = nutrition_patterns.get('calorie_consistency', {})
            
            recommendations = []
            if adherence_score < 0.7:
                recommendations.append('Improve adherence to daily nutrition goals')
            
            if calorie_consistency.get('consistency_score', 1.0) < 0.5:
                recommendations.append('Maintain more consistent daily calorie intake')
            
            return {
                'alert_level': alert_level,
                'adherence_score': adherence_score,
                'macro_distribution': macro_distribution,
                'calorie_consistency': calorie_consistency,
                'recommendations': recommendations
            }
            
        except Exception as e:
            logger.error(f"Error monitoring nutrition adherence: {e}")
            return {'alert_level': 'medium', 'error': str(e)}
    
    async def _detect_plateaus(self, workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Detect workout plateaus"""
        try:
            if not workouts or len(workouts) < 10:
                return {
                    'plateaus_detected': False,
                    'plateau_count': 0,
                    'message': 'Insufficient data for plateau detection'
                }
            
            # Analyze workout patterns for plateaus
            patterns = await self.pattern_analyzer.analyze_workout_patterns(workouts)
            plateau_detection = patterns.get('plateau_detection', {})
            
            plateaus_detected = plateau_detection.get('plateau_count', 0) > 0
            plateau_count = plateau_detection.get('plateau_count', 0)
            
            return {
                'plateaus_detected': plateaus_detected,
                'plateau_count': plateau_count,
                'plateau_details': plateau_detection.get('detected_plateaus', {}),
                'recommendations': ['Consider changing workout routine'] if plateaus_detected else []
            }
            
        except Exception as e:
            logger.error(f"Error detecting plateaus: {e}")
            return {'plateaus_detected': False, 'error': str(e)}
    
    async def _assess_injury_risk(self, workouts: List[Dict[str, Any]], user_profile: Dict[str, Any]) -> Dict[str, Any]:
        """Assess injury risk based on workout patterns and user profile"""
        try:
            risk_factors = []
            risk_score = 0.0
            
            # Check for overtraining indicators
            if workouts:
                # Analyze workout frequency and intensity
                patterns = await self.pattern_analyzer.analyze_workout_patterns(workouts)
                frequency_patterns = patterns.get('frequency_patterns', {})
                intensity_patterns = patterns.get('intensity_patterns', {})
                
                avg_per_week = frequency_patterns.get('avg_per_week', 0)
                avg_intensity = intensity_patterns.get('avg_intensity', 0)
                
                # High frequency + high intensity = increased risk
                if avg_per_week > 6 and avg_intensity > 80:
                    risk_factors.append('High training volume and intensity')
                    risk_score += 0.3
                
                # Check for sudden increases in volume
                if self._detect_sudden_volume_increase(workouts):
                    risk_factors.append('Sudden increase in training volume')
                    risk_score += 0.2
            
            # Check injury history
            injury_history = user_profile.get('injuryHistory', [])
            if injury_history:
                risk_factors.append(f'Previous injuries: {", ".join(injury_history)}')
                risk_score += 0.2
            
            # Check age factor
            age = self._calculate_age(user_profile.get('dateOfBirth'))
            if age and age > 50:
                risk_factors.append('Age-related injury risk')
                risk_score += 0.1
            
            # Determine risk level
            if risk_score >= 0.6:
                risk_level = 'high'
            elif risk_score >= 0.3:
                risk_level = 'medium'
            else:
                risk_level = 'low'
            
            recommendations = []
            if risk_level == 'high':
                recommendations.extend([
                    'Consider reducing training volume',
                    'Increase rest days',
                    'Focus on recovery and mobility'
                ])
            elif risk_level == 'medium':
                recommendations.extend([
                    'Monitor training load carefully',
                    'Ensure adequate recovery'
                ])
            
            return {
                'risk_level': risk_level,
                'risk_score': risk_score,
                'risk_factors': risk_factors,
                'recommendations': recommendations
            }
            
        except Exception as e:
            logger.error(f"Error assessing injury risk: {e}")
            return {'risk_level': 'medium', 'error': str(e)}
    
    async def _assess_motivation_level(self, workouts: List[Dict[str, Any]], nutrition_data: Dict[str, Any]) -> Dict[str, Any]:
        """Assess user motivation level based on patterns"""
        try:
            motivation_indicators = []
            motivation_score = 0.5  # Start neutral
            
            # Analyze workout consistency
            if workouts:
                patterns = await self.pattern_analyzer.analyze_workout_patterns(workouts)
                consistency_score = patterns.get('consistency_patterns', {}).get('consistency_score', 0.5)
                
                if consistency_score < 0.3:
                    motivation_indicators.append('Low workout consistency')
                    motivation_score -= 0.3
                elif consistency_score > 0.8:
                    motivation_indicators.append('High workout consistency')
                    motivation_score += 0.2
            
            # Analyze nutrition tracking
            meals = nutrition_data.get('meals', [])
            if len(meals) < 7:  # Less than a week of tracking
                motivation_indicators.append('Inconsistent nutrition tracking')
                motivation_score -= 0.2
            
            # Check for recent activity
            days_since_last = self._calculate_days_since_last_workout(workouts)
            if days_since_last > 7:
                motivation_indicators.append('Extended break from workouts')
                motivation_score -= 0.3
            
            # Determine motivation level
            if motivation_score >= 0.7:
                motivation_level = 'high'
            elif motivation_score >= 0.4:
                motivation_level = 'medium'
            else:
                motivation_level = 'low'
            
            recommendations = []
            if motivation_level == 'low':
                recommendations.extend([
                    'Set smaller, achievable goals',
                    'Find workout buddy or accountability partner',
                    'Focus on enjoyable activities'
                ])
            elif motivation_level == 'medium':
                recommendations.extend([
                    'Maintain current momentum',
                    'Celebrate small wins'
                ])
            
            return {
                'motivation_level': motivation_level,
                'motivation_score': motivation_score,
                'motivation_indicators': motivation_indicators,
                'recommendations': recommendations
            }
            
        except Exception as e:
            logger.error(f"Error assessing motivation level: {e}")
            return {'motivation_level': 'medium', 'error': str(e)}
    
    async def _generate_recommendations(self, monitoring_results: Dict[str, Any]) -> List[str]:
        """Generate personalized recommendations based on monitoring results"""
        try:
            recommendations = []
            alerts = monitoring_results.get('alerts', [])
            
            # Generate recommendations based on alert types
            alert_types = [alert['type'] for alert in alerts]
            
            if 'consistency' in alert_types:
                recommendations.append('Focus on building a consistent workout routine')
                recommendations.append('Start with shorter, more manageable sessions')
            
            if 'progress' in alert_types:
                recommendations.append('Review and adjust your training program')
                recommendations.append('Consider working with a trainer or coach')
            
            if 'nutrition' in alert_types:
                recommendations.append('Improve meal planning and preparation')
                recommendations.append('Track nutrition more consistently')
            
            if 'plateau' in alert_types:
                recommendations.append('Change up your workout routine')
                recommendations.append('Try new exercises or training methods')
            
            if 'injury_risk' in alert_types:
                recommendations.append('Reduce training volume and intensity')
                recommendations.append('Focus on recovery and mobility work')
            
            if 'motivation' in alert_types:
                recommendations.append('Set smaller, achievable goals')
                recommendations.append('Find activities you enjoy')
            
            # Add general recommendations if no specific alerts
            if not alerts:
                recommendations.append('Keep up the great work!')
                recommendations.append('Continue tracking your progress')
            
            return recommendations
            
        except Exception as e:
            logger.error(f"Error generating recommendations: {e}")
            return ['Continue monitoring your progress']
    
    def _calculate_overall_risk_score(self, monitoring_results: Dict[str, Any]) -> float:
        """Calculate overall risk score based on monitoring results"""
        try:
            alerts = monitoring_results.get('alerts', [])
            risk_score = 0.0
            
            # Weight different alert types
            alert_weights = {
                'consistency': 0.3,
                'progress': 0.25,
                'nutrition': 0.2,
                'plateau': 0.15,
                'injury_risk': 0.2,
                'motivation': 0.1
            }
            
            for alert in alerts:
                alert_type = alert['type']
                level = alert['level']
                
                weight = alert_weights.get(alert_type, 0.1)
                level_multiplier = {'low': 0.2, 'medium': 0.5, 'high': 1.0}.get(level, 0.5)
                
                risk_score += weight * level_multiplier
            
            # Cap at 1.0
            return min(risk_score, 1.0)
            
        except Exception as e:
            logger.error(f"Error calculating risk score: {e}")
            return 0.5
    
    # Helper methods
    
    def _calculate_days_since_last_workout(self, workouts: List[Dict[str, Any]]) -> int:
        """Calculate days since last workout"""
        if not workouts:
            return 999
        
        try:
            latest_workout = max(workouts, key=lambda x: x.get('date', ''))
            latest_date = datetime.fromisoformat(latest_workout['date'].replace('Z', '+00:00'))
            days_since = (datetime.now(timezone.utc) - latest_date).days
            return days_since
        except Exception:
            return 999
    
    def _detect_sudden_volume_increase(self, workouts: List[Dict[str, Any]]) -> bool:
        """Detect sudden increases in training volume"""
        try:
            if len(workouts) < 4:
                return False
            
            # Calculate weekly volumes
            weekly_volumes = self._calculate_weekly_volumes(workouts)
            
            if len(weekly_volumes) < 2:
                return False
            
            # Check for >50% increase in consecutive weeks
            for i in range(1, len(weekly_volumes)):
                if weekly_volumes[i] > weekly_volumes[i-1] * 1.5:
                    return True
            
            return False
            
        except Exception:
            return False
    
    def _calculate_weekly_volumes(self, workouts: List[Dict[str, Any]]) -> List[float]:
        """Calculate weekly training volumes"""
        try:
            weekly_volumes = defaultdict(float)
            
            for workout in workouts:
                workout_date = workout.get('date', '')
                if workout_date:
                    try:
                        date_obj = datetime.fromisoformat(workout_date.replace('Z', '+00:00'))
                        week_key = date_obj.isocalendar()[:2]  # (year, week)
                        
                        # Calculate volume for this workout
                        exercises = workout.get('exercises', [])
                        workout_volume = sum(
                            ex.get('weight', 0) * ex.get('reps', 0) * ex.get('sets', 1)
                            for ex in exercises
                        )
                        
                        weekly_volumes[week_key] += workout_volume
                    except Exception:
                        continue
            
            return list(weekly_volumes.values())
            
        except Exception:
            return []
    
    def _calculate_age(self, date_of_birth: Optional[str]) -> Optional[int]:
        """Calculate age from date of birth"""
        if not date_of_birth:
            return None
        
        try:
            birth_date = datetime.fromisoformat(date_of_birth.replace('Z', '+00:00'))
            today = datetime.now(timezone.utc)
            age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
            return age
        except Exception:
            return None
    
    def _get_consistency_recommendations(self, consistency_score: float, days_since_last: int) -> List[str]:
        """Get recommendations based on consistency score"""
        recommendations = []
        
        if consistency_score < 0.3:
            recommendations.extend([
                'Start with 2-3 workouts per week',
                'Focus on building the habit first',
                'Set realistic, achievable goals'
            ])
        elif consistency_score < 0.6:
            recommendations.extend([
                'Work on maintaining regular schedule',
                'Plan workouts in advance',
                'Find accountability partner'
            ])
        
        if days_since_last > 7:
            recommendations.append('Start with a light workout to get back into routine')
        
        return recommendations
    
    async def _analyze_body_composition_trends(self, measurements: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze body composition trends"""
        try:
            if len(measurements) < 2:
                return {'overall_trend': 'insufficient_data'}
            
            # Sort by date
            sorted_measurements = sorted(measurements, key=lambda x: x.get('date', ''))
            
            # Calculate trends
            weights = [m.get('weight', 0) for m in sorted_measurements if m.get('weight', 0) > 0]
            
            if len(weights) >= 2:
                weight_change = weights[-1] - weights[0]
                weight_change_percent = (weight_change / weights[0]) * 100 if weights[0] > 0 else 0
                
                if weight_change_percent < -2:
                    return {'overall_trend': 'improving', 'weight_change_percent': weight_change_percent}
                elif weight_change_percent > 2:
                    return {'overall_trend': 'declining', 'weight_change_percent': weight_change_percent}
                else:
                    return {'overall_trend': 'stable', 'weight_change_percent': weight_change_percent}
            
            return {'overall_trend': 'stable'}
            
        except Exception as e:
            logger.error(f"Error analyzing body composition trends: {e}")
            return {'overall_trend': 'stable'}
    
    async def _analyze_strength_trends(self, workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze strength trends from workouts"""
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
