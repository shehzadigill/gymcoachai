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

class PerformanceAnalyzer:
    """Service for analyzing workout performance trends and generating recommendations"""
    
    def __init__(self):
        self.table_name = os.environ.get('DYNAMODB_TABLE', 'gymcoach-ai-main')
        self.user_data_service = UserDataService(self.table_name)
        self.pattern_analyzer = PatternAnalyzer()
        self.rag_service = RAGService()
        self.bedrock_service = BedrockService()
        
        # Analysis thresholds
        self.strength_improvement_threshold = 0.05  # 5% improvement
        self.volume_increase_threshold = 0.1  # 10% volume increase
        self.plateau_detection_weeks = 2  # Weeks without progress
        self.fatigue_threshold = 0.8  # High fatigue threshold
        
    async def analyze_performance_trends(self, user_id: str, days: int = 30) -> Dict[str, Any]:
        """
        Analyze comprehensive performance trends for a user
        
        Args:
            user_id: User ID
            days: Number of days to analyze
            
        Returns:
            Dictionary with performance analysis results
        """
        try:
            logger.info(f"Analyzing performance trends for user {user_id}")
            
            # Get user data
            user_profile = await self.user_data_service.get_user_profile(user_id)
            workouts = await self.user_data_service.get_historical_workouts(user_id, days)
            measurements = await self.user_data_service.get_historical_measurements(user_id, days * 2)
            
            if not user_profile:
                return {'error': 'User profile not found'}
            
            if not workouts:
                return {'status': 'no_data', 'message': 'No workout data available'}
            
            # Perform comprehensive analysis
            analysis_results = {
                'user_id': user_id,
                'analysis_period_days': days,
                'analysis_date': datetime.now(timezone.utc).isoformat(),
                'strength_analysis': await self._analyze_strength_progression(workouts),
                'volume_analysis': await self._analyze_volume_trends(workouts),
                'intensity_analysis': await self._analyze_intensity_patterns(workouts),
                'consistency_analysis': await self._analyze_consistency_patterns(workouts),
                'plateau_detection': await self._detect_plateaus(workouts),
                'fatigue_analysis': await self._analyze_fatigue_indicators(workouts),
                'body_composition_analysis': await self._analyze_body_composition_trends(measurements),
                'exercise_performance': await self._analyze_exercise_performance(workouts),
                'recommendations': []
            }
            
            # Generate AI-powered recommendations
            recommendations = await self._generate_performance_recommendations(
                analysis_results, user_profile
            )
            analysis_results['recommendations'] = recommendations
            
            logger.info(f"Performance analysis completed for user {user_id}")
            return analysis_results
            
        except Exception as e:
            logger.error(f"Error analyzing performance trends for user {user_id}: {e}")
            return {'error': str(e)}
    
    async def detect_performance_anomalies(self, user_id: str, days: int = 14) -> Dict[str, Any]:
        """
        Detect performance anomalies and unusual patterns
        
        Args:
            user_id: User ID
            days: Number of days to analyze
            
        Returns:
            Dictionary with detected anomalies
        """
        try:
            logger.info(f"Detecting performance anomalies for user {user_id}")
            
            workouts = await self.user_data_service.get_historical_workouts(user_id, days)
            
            if not workouts:
                return {'status': 'no_data', 'message': 'No workout data available'}
            
            anomalies = {
                'user_id': user_id,
                'analysis_period_days': days,
                'detection_date': datetime.now(timezone.utc).isoformat(),
                'anomalies': [],
                'severity_scores': {},
                'recommendations': []
            }
            
            # Detect various types of anomalies
            anomalies['anomalies'].extend(await self._detect_volume_anomalies(workouts))
            anomalies['anomalies'].extend(await self._detect_intensity_anomalies(workouts))
            anomalies['anomalies'].extend(await self._detect_consistency_anomalies(workouts))
            anomalies['anomalies'].extend(await self._detect_progression_anomalies(workouts))
            
            # Calculate severity scores
            anomalies['severity_scores'] = await self._calculate_anomaly_severity(anomalies['anomalies'])
            
            # Generate recommendations for anomalies
            anomalies['recommendations'] = await self._generate_anomaly_recommendations(anomalies)
            
            logger.info(f"Performance anomaly detection completed for user {user_id}")
            return anomalies
            
        except Exception as e:
            logger.error(f"Error detecting performance anomalies for user {user_id}: {e}")
            return {'error': str(e)}
    
    async def predict_performance_trajectory(self, user_id: str, days_ahead: int = 30) -> Dict[str, Any]:
        """
        Predict future performance trajectory based on current trends
        
        Args:
            user_id: User ID
            days_ahead: Number of days to predict ahead
            
        Returns:
            Dictionary with performance predictions
        """
        try:
            logger.info(f"Predicting performance trajectory for user {user_id}")
            
            # Get historical data
            workouts = await self.user_data_service.get_historical_workouts(user_id, 90)
            measurements = await self.user_data_service.get_historical_measurements(user_id, 90)
            user_profile = await self.user_data_service.get_user_profile(user_id)
            
            if not workouts or not user_profile:
                return {'error': 'Insufficient data for prediction'}
            
            # Analyze current trends
            current_trends = await self._analyze_current_trends(workouts, measurements)
            
            # Generate predictions using AI
            prediction_prompt = f"""
            Based on the user's current performance trends, predict their fitness trajectory for the next {days_ahead} days.
            
            User Profile:
            - Experience Level: {user_profile.get('experienceLevel', 'beginner')}
            - Goals: {', '.join(user_profile.get('fitnessGoals', []))}
            - Training Frequency: {user_profile.get('trainingFrequency', 'unknown')}
            
            Current Trends:
            {json.dumps(current_trends, indent=2)}
            
            Provide predictions for:
            1. Strength progression trajectory
            2. Volume capacity changes
            3. Potential plateaus or breakthroughs
            4. Recovery needs
            5. Risk factors
            
            Format as structured predictions with confidence levels.
            """
            
            bedrock_result = self.bedrock_service.invoke_bedrock(
                prediction_prompt,
                {
                    'user_profile': user_profile,
                    'current_trends': current_trends,
                    'prediction_horizon': days_ahead
                },
                max_tokens=600
            )
            
            if bedrock_result['success']:
                predictions = {
                    'user_id': user_id,
                    'prediction_horizon_days': days_ahead,
                    'prediction_date': datetime.now(timezone.utc).isoformat(),
                    'current_trends': current_trends,
                    'predictions': bedrock_result['response'],
                    'confidence_level': await self._calculate_prediction_confidence(current_trends),
                    'risk_factors': await self._identify_risk_factors(current_trends, user_profile)
                }
                
                logger.info(f"Performance trajectory prediction completed for user {user_id}")
                return predictions
            else:
                return {'error': 'Failed to generate predictions'}
                
        except Exception as e:
            logger.error(f"Error predicting performance trajectory for user {user_id}: {e}")
            return {'error': str(e)}
    
    async def generate_performance_report(self, user_id: str, period: str = 'monthly') -> Dict[str, Any]:
        """
        Generate comprehensive performance report
        
        Args:
            user_id: User ID
            period: Report period ('weekly', 'monthly', 'quarterly')
            
        Returns:
            Dictionary with comprehensive performance report
        """
        try:
            logger.info(f"Generating {period} performance report for user {user_id}")
            
            # Determine analysis period
            days_map = {'weekly': 7, 'monthly': 30, 'quarterly': 90}
            days = days_map.get(period, 30)
            
            # Get comprehensive analysis
            performance_analysis = await self.analyze_performance_trends(user_id, days)
            anomaly_detection = await self.detect_performance_anomalies(user_id, days)
            trajectory_prediction = await self.predict_performance_trajectory(user_id, days)
            
            # Generate AI-powered report summary
            report_prompt = f"""
            Generate a comprehensive {period} performance report for this fitness user.
            
            Performance Analysis:
            {json.dumps(performance_analysis, indent=2)}
            
            Anomaly Detection:
            {json.dumps(anomaly_detection, indent=2)}
            
            Future Predictions:
            {json.dumps(trajectory_prediction, indent=2)}
            
            Create a structured report with:
            1. Executive Summary
            2. Key Achievements
            3. Areas for Improvement
            4. Recommendations
            5. Next Period Goals
            
            Make it motivational but honest, with specific actionable insights.
            """
            
            bedrock_result = self.bedrock_service.invoke_bedrock(
                report_prompt,
                {
                    'performance_analysis': performance_analysis,
                    'anomaly_detection': anomaly_detection,
                    'trajectory_prediction': trajectory_prediction,
                    'report_period': period
                },
                max_tokens=800
            )
            
            if bedrock_result['success']:
                report = {
                    'user_id': user_id,
                    'report_period': period,
                    'report_date': datetime.now(timezone.utc).isoformat(),
                    'performance_analysis': performance_analysis,
                    'anomaly_detection': anomaly_detection,
                    'trajectory_prediction': trajectory_prediction,
                    'ai_generated_summary': bedrock_result['response'],
                    'key_metrics': await self._extract_key_metrics(performance_analysis),
                    'action_items': await self._generate_action_items(performance_analysis, anomaly_detection)
                }
                
                logger.info(f"{period.capitalize()} performance report generated for user {user_id}")
                return report
            else:
                return {'error': 'Failed to generate performance report'}
                
        except Exception as e:
            logger.error(f"Error generating performance report for user {user_id}: {e}")
            return {'error': str(e)}
    
    # Core analysis methods
    
    async def _analyze_strength_progression(self, workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze strength progression across exercises"""
        try:
            if len(workouts) < 3:
                return {'status': 'insufficient_data', 'message': 'Need at least 3 workouts for analysis'}
            
            # Track progression for each exercise
            exercise_progressions = defaultdict(list)
            
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
                        exercise_progressions[exercise_name].append({
                            'date': workout_date,
                            'weight': weight,
                            'reps': reps,
                            'estimated_1rm': estimated_1rm
                        })
            
            # Analyze progression for each exercise
            progression_analysis = {}
            overall_strength_trend = []
            
            for exercise_name, data in exercise_progressions.items():
                if len(data) >= 3:
                    sorted_data = sorted(data, key=lambda x: x['date'])
                    
                    # Calculate progression metrics
                    first_1rm = sorted_data[0]['estimated_1rm']
                    last_1rm = sorted_data[-1]['estimated_1rm']
                    total_improvement = ((last_1rm - first_1rm) / first_1rm) * 100 if first_1rm > 0 else 0
                    
                    # Calculate weekly improvement rate
                    days_span = self._calculate_days_span(sorted_data[0]['date'], sorted_data[-1]['date'])
                    weekly_improvement = (total_improvement / max(days_span / 7, 1)) if days_span > 0 else 0
                    
                    # Determine trend
                    if total_improvement > 5:
                        trend = 'improving'
                    elif total_improvement < -5:
                        trend = 'declining'
                    else:
                        trend = 'stable'
                    
                    progression_analysis[exercise_name] = {
                        'total_improvement_percent': total_improvement,
                        'weekly_improvement_percent': weekly_improvement,
                        'trend': trend,
                        'data_points': len(data),
                        'first_1rm': first_1rm,
                        'last_1rm': last_1rm
                    }
                    
                    overall_strength_trend.append(total_improvement)
            
            # Calculate overall strength trend
            if overall_strength_trend:
                avg_improvement = statistics.mean(overall_strength_trend)
                if avg_improvement > 3:
                    overall_trend = 'improving'
                elif avg_improvement < -3:
                    overall_trend = 'declining'
                else:
                    overall_trend = 'stable'
            else:
                overall_trend = 'insufficient_data'
                avg_improvement = 0
            
            return {
                'overall_trend': overall_trend,
                'average_improvement_percent': avg_improvement,
                'exercise_progressions': progression_analysis,
                'analysis_date': datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error analyzing strength progression: {e}")
            return {'error': str(e)}
    
    async def _analyze_volume_trends(self, workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze training volume trends"""
        try:
            if len(workouts) < 3:
                return {'status': 'insufficient_data'}
            
            volumes = []
            dates = []
            
            for workout in workouts:
                exercises = workout.get('exercises', [])
                workout_date = workout.get('date', '')
                
                # Calculate total volume for workout
                workout_volume = sum(
                    ex.get('weight', 0) * ex.get('reps', 0) * ex.get('sets', 1)
                    for ex in exercises
                )
                
                volumes.append(workout_volume)
                dates.append(workout_date)
            
            # Sort by date
            sorted_data = sorted(zip(dates, volumes), key=lambda x: x[0])
            sorted_volumes = [v for _, v in sorted_data]
            
            # Calculate trend
            if len(sorted_volumes) >= 3:
                recent_avg = statistics.mean(sorted_volumes[-3:])
                earlier_avg = statistics.mean(sorted_volumes[:3])
                
                volume_change = ((recent_avg - earlier_avg) / earlier_avg) * 100 if earlier_avg > 0 else 0
                
                if volume_change > 10:
                    trend = 'increasing'
                elif volume_change < -10:
                    trend = 'decreasing'
                else:
                    trend = 'stable'
                
                return {
                    'trend': trend,
                    'volume_change_percent': volume_change,
                    'recent_average_volume': recent_avg,
                    'earlier_average_volume': earlier_avg,
                    'total_workouts': len(volumes),
                    'analysis_date': datetime.now(timezone.utc).isoformat()
                }
            
            return {'trend': 'stable', 'volume_change_percent': 0}
            
        except Exception as e:
            logger.error(f"Error analyzing volume trends: {e}")
            return {'error': str(e)}
    
    async def _analyze_intensity_patterns(self, workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze training intensity patterns"""
        try:
            if len(workouts) < 3:
                return {'status': 'insufficient_data'}
            
            intensities = []
            dates = []
            
            for workout in workouts:
                exercises = workout.get('exercises', [])
                workout_date = workout.get('date', '')
                
                # Calculate average intensity for workout
                workout_intensities = []
                for exercise in exercises:
                    weight = exercise.get('weight', 0)
                    reps = exercise.get('reps', 0)
                    
                    if weight > 0 and reps > 0:
                        # Calculate intensity as percentage of estimated max
                        estimated_max = weight * (1 + reps / 30)
                        intensity = (weight / estimated_max) * 100
                        workout_intensities.append(intensity)
                
                if workout_intensities:
                    avg_intensity = statistics.mean(workout_intensities)
                    intensities.append(avg_intensity)
                    dates.append(workout_date)
            
            if len(intensities) >= 3:
                # Sort by date
                sorted_data = sorted(zip(dates, intensities), key=lambda x: x[0])
                sorted_intensities = [i for _, i in sorted_data]
                
                recent_avg = statistics.mean(sorted_intensities[-3:])
                earlier_avg = statistics.mean(sorted_intensities[:3])
                
                intensity_change = recent_avg - earlier_avg
                
                if intensity_change > 5:
                    trend = 'increasing'
                elif intensity_change < -5:
                    trend = 'decreasing'
                else:
                    trend = 'stable'
                
                return {
                    'trend': trend,
                    'intensity_change': intensity_change,
                    'recent_average_intensity': recent_avg,
                    'earlier_average_intensity': earlier_avg,
                    'intensity_distribution': {
                        'low_intensity_sessions': len([i for i in intensities if i < 60]),
                        'moderate_intensity_sessions': len([i for i in intensities if 60 <= i < 80]),
                        'high_intensity_sessions': len([i for i in intensities if i >= 80])
                    },
                    'analysis_date': datetime.now(timezone.utc).isoformat()
                }
            
            return {'trend': 'stable', 'intensity_change': 0}
            
        except Exception as e:
            logger.error(f"Error analyzing intensity patterns: {e}")
            return {'error': str(e)}
    
    async def _analyze_consistency_patterns(self, workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze workout consistency patterns"""
        try:
            if len(workouts) < 5:
                return {'status': 'insufficient_data'}
            
            # Calculate workout gaps
            gaps = self._calculate_workout_gaps(workouts)
            
            if gaps:
                avg_gap = statistics.mean(gaps)
                std_gap = statistics.stdev(gaps) if len(gaps) > 1 else 0
                consistency_score = max(0, 1 - (std_gap / max(avg_gap, 1)))
                
                # Analyze frequency patterns
                frequency_analysis = await self._analyze_frequency_patterns(workouts)
                
                return {
                    'consistency_score': consistency_score,
                    'average_gap_days': avg_gap,
                    'gap_standard_deviation': std_gap,
                    'frequency_analysis': frequency_analysis,
                    'total_gaps': len(gaps),
                    'analysis_date': datetime.now(timezone.utc).isoformat()
                }
            
            return {'consistency_score': 0.5, 'average_gap_days': 0}
            
        except Exception as e:
            logger.error(f"Error analyzing consistency patterns: {e}")
            return {'error': str(e)}
    
    async def _detect_plateaus(self, workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Detect training plateaus"""
        try:
            if len(workouts) < 10:
                return {'plateaus_detected': False, 'message': 'Insufficient data for plateau detection'}
            
            # Analyze strength progression for plateau detection
            strength_analysis = await self._analyze_strength_progression(workouts)
            exercise_progressions = strength_analysis.get('exercise_progressions', {})
            
            plateaus_detected = []
            
            for exercise_name, progression in exercise_progressions.items():
                if progression.get('data_points', 0) >= 5:
                    # Check if improvement has stalled
                    total_improvement = progression.get('total_improvement_percent', 0)
                    weekly_improvement = progression.get('weekly_improvement_percent', 0)
                    
                    # Plateau criteria: less than 2% improvement over 2+ weeks
                    if total_improvement < 2 and weekly_improvement < 0.5:
                        plateaus_detected.append({
                            'exercise': exercise_name,
                            'total_improvement_percent': total_improvement,
                            'weekly_improvement_percent': weekly_improvement,
                            'plateau_duration_weeks': max(2, progression.get('data_points', 0) / 3)
                        })
            
            return {
                'plateaus_detected': len(plateaus_detected) > 0,
                'plateau_count': len(plateaus_detected),
                'plateau_details': plateaus_detected,
                'analysis_date': datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error detecting plateaus: {e}")
            return {'plateaus_detected': False, 'error': str(e)}
    
    async def _analyze_fatigue_indicators(self, workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze fatigue indicators"""
        try:
            if len(workouts) < 5:
                return {'high_fatigue': False, 'indicators': []}
            
            indicators = []
            high_fatigue = False
            
            # Analyze recent vs earlier performance
            recent_workouts = workouts[-3:]
            earlier_workouts = workouts[:3]
            
            # Compare volumes
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
                
                # Calculate fatigue score
                fatigue_score = min(1.0, recent_avg / max(earlier_avg, 1))
                
                if fatigue_score < 0.7:
                    indicators.append('Low performance relative to baseline')
                    high_fatigue = True
            
            return {
                'high_fatigue': high_fatigue,
                'indicators': indicators,
                'fatigue_score': fatigue_score if recent_volumes and earlier_volumes else 0.5,
                'analysis_date': datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error analyzing fatigue indicators: {e}")
            return {'high_fatigue': False, 'indicators': [], 'error': str(e)}
    
    async def _analyze_body_composition_trends(self, measurements: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze body composition trends"""
        try:
            if len(measurements) < 2:
                return {'trend': 'insufficient_data'}
            
            # Sort by date
            sorted_measurements = sorted(measurements, key=lambda x: x.get('date', ''))
            
            # Extract weight data
            weights = [m.get('weight', 0) for m in sorted_measurements if m.get('weight', 0) > 0]
            
            if len(weights) >= 2:
                weight_change = weights[-1] - weights[0]
                weight_change_percent = (weight_change / weights[0]) * 100 if weights[0] > 0 else 0
                
                # Determine trend
                if weight_change_percent < -2:
                    trend = 'improving'
                elif weight_change_percent > 2:
                    trend = 'declining'
                else:
                    trend = 'stable'
                
                return {
                    'trend': trend,
                    'weight_change_percent': weight_change_percent,
                    'weight_change_kg': weight_change,
                    'measurements_count': len(weights),
                    'analysis_date': datetime.now(timezone.utc).isoformat()
                }
            
            return {'trend': 'stable', 'weight_change_percent': 0}
            
        except Exception as e:
            logger.error(f"Error analyzing body composition trends: {e}")
            return {'trend': 'stable'}
    
    async def _analyze_exercise_performance(self, workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze performance for individual exercises"""
        try:
            exercise_stats = defaultdict(lambda: {
                'total_sessions': 0,
                'total_volume': 0,
                'max_weight': 0,
                'max_reps': 0,
                'avg_intensity': 0,
                'intensities': []
            })
            
            for workout in workouts:
                exercises = workout.get('exercises', [])
                
                for exercise in exercises:
                    exercise_name = exercise.get('name', '').lower()
                    weight = exercise.get('weight', 0)
                    reps = exercise.get('reps', 0)
                    sets = exercise.get('sets', 1)
                    
                    if weight > 0 and reps > 0:
                        stats = exercise_stats[exercise_name]
                        stats['total_sessions'] += 1
                        stats['total_volume'] += weight * reps * sets
                        stats['max_weight'] = max(stats['max_weight'], weight)
                        stats['max_reps'] = max(stats['max_reps'], reps)
                        
                        # Calculate intensity
                        estimated_max = weight * (1 + reps / 30)
                        intensity = (weight / estimated_max) * 100
                        stats['intensities'].append(intensity)
            
            # Calculate averages
            for exercise_name, stats in exercise_stats.items():
                if stats['intensities']:
                    stats['avg_intensity'] = statistics.mean(stats['intensities'])
            
            return dict(exercise_stats)
            
        except Exception as e:
            logger.error(f"Error analyzing exercise performance: {e}")
            return {}
    
    # Anomaly detection methods
    
    async def _detect_volume_anomalies(self, workouts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Detect volume anomalies"""
        anomalies = []
        
        try:
            volumes = []
            for workout in workouts:
                exercises = workout.get('exercises', [])
                volume = sum(
                    ex.get('weight', 0) * ex.get('reps', 0) * ex.get('sets', 1)
                    for ex in exercises
                )
                volumes.append(volume)
            
            if len(volumes) >= 5:
                avg_volume = statistics.mean(volumes)
                std_volume = statistics.stdev(volumes)
                
                # Detect outliers (2+ standard deviations from mean)
                for i, volume in enumerate(volumes):
                    if abs(volume - avg_volume) > 2 * std_volume:
                        anomalies.append({
                            'type': 'volume_anomaly',
                            'severity': 'high' if abs(volume - avg_volume) > 3 * std_volume else 'medium',
                            'description': f'Unusual training volume: {volume:.0f} (avg: {avg_volume:.0f})',
                            'workout_index': i,
                            'value': volume,
                            'expected_range': f'{avg_volume - 2*std_volume:.0f} - {avg_volume + 2*std_volume:.0f}'
                        })
            
        except Exception as e:
            logger.error(f"Error detecting volume anomalies: {e}")
        
        return anomalies
    
    async def _detect_intensity_anomalies(self, workouts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Detect intensity anomalies"""
        anomalies = []
        
        try:
            intensities = []
            for workout in workouts:
                exercises = workout.get('exercises', [])
                workout_intensities = []
                
                for exercise in exercises:
                    weight = exercise.get('weight', 0)
                    reps = exercise.get('reps', 0)
                    
                    if weight > 0 and reps > 0:
                        estimated_max = weight * (1 + reps / 30)
                        intensity = (weight / estimated_max) * 100
                        workout_intensities.append(intensity)
                
                if workout_intensities:
                    intensities.append(statistics.mean(workout_intensities))
            
            if len(intensities) >= 5:
                avg_intensity = statistics.mean(intensities)
                std_intensity = statistics.stdev(intensities)
                
                for i, intensity in enumerate(intensities):
                    if abs(intensity - avg_intensity) > 2 * std_intensity:
                        anomalies.append({
                            'type': 'intensity_anomaly',
                            'severity': 'high' if intensity > avg_intensity + 3 * std_intensity else 'medium',
                            'description': f'Unusual training intensity: {intensity:.1f}% (avg: {avg_intensity:.1f}%)',
                            'workout_index': i,
                            'value': intensity,
                            'expected_range': f'{avg_intensity - 2*std_intensity:.1f}% - {avg_intensity + 2*std_intensity:.1f}%'
                        })
            
        except Exception as e:
            logger.error(f"Error detecting intensity anomalies: {e}")
        
        return anomalies
    
    async def _detect_consistency_anomalies(self, workouts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Detect consistency anomalies"""
        anomalies = []
        
        try:
            gaps = self._calculate_workout_gaps(workouts)
            
            if gaps:
                avg_gap = statistics.mean(gaps)
                std_gap = statistics.stdev(gaps) if len(gaps) > 1 else 0
                
                for i, gap in enumerate(gaps):
                    if gap > avg_gap + 2 * std_gap:
                        anomalies.append({
                            'type': 'consistency_anomaly',
                            'severity': 'high' if gap > avg_gap + 3 * std_gap else 'medium',
                            'description': f'Unusual gap between workouts: {gap} days (avg: {avg_gap:.1f} days)',
                            'gap_index': i,
                            'value': gap,
                            'expected_range': f'0 - {avg_gap + 2*std_gap:.1f} days'
                        })
            
        except Exception as e:
            logger.error(f"Error detecting consistency anomalies: {e}")
        
        return anomalies
    
    async def _detect_progression_anomalies(self, workouts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Detect progression anomalies"""
        anomalies = []
        
        try:
            # Analyze strength progression for anomalies
            strength_analysis = await self._analyze_strength_progression(workouts)
            exercise_progressions = strength_analysis.get('exercise_progressions', {})
            
            for exercise_name, progression in exercise_progressions.items():
                weekly_improvement = progression.get('weekly_improvement_percent', 0)
                
                # Detect unusually high or negative progression
                if weekly_improvement > 10:  # Unusually high improvement
                    anomalies.append({
                        'type': 'progression_anomaly',
                        'severity': 'medium',
                        'description': f'Unusually high progression in {exercise_name}: {weekly_improvement:.1f}% per week',
                        'exercise': exercise_name,
                        'value': weekly_improvement,
                        'expected_range': '0-5% per week'
                    })
                elif weekly_improvement < -5:  # Significant decline
                    anomalies.append({
                        'type': 'progression_anomaly',
                        'severity': 'high',
                        'description': f'Significant decline in {exercise_name}: {weekly_improvement:.1f}% per week',
                        'exercise': exercise_name,
                        'value': weekly_improvement,
                        'expected_range': '0-5% per week'
                    })
            
        except Exception as e:
            logger.error(f"Error detecting progression anomalies: {e}")
        
        return anomalies
    
    # Helper methods
    
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
    
    def _calculate_days_span(self, start_date: str, end_date: str) -> int:
        """Calculate days between two dates"""
        try:
            start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            return (end - start).days
        except Exception:
            return 0
    
    async def _analyze_frequency_patterns(self, workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze workout frequency patterns"""
        try:
            # Count workouts by day of week
            day_counts = defaultdict(int)
            
            for workout in workouts:
                try:
                    workout_date = datetime.fromisoformat(workout.get('date', '').replace('Z', '+00:00'))
                    day_of_week = workout_date.strftime('%A')
                    day_counts[day_of_week] += 1
                except Exception:
                    continue
            
            return {
                'day_distribution': dict(day_counts),
                'total_workouts': len(workouts),
                'avg_workouts_per_week': len(workouts) / max(1, self._calculate_days_span(workouts[0].get('date', ''), workouts[-1].get('date', '')) / 7)
            }
            
        except Exception as e:
            logger.error(f"Error analyzing frequency patterns: {e}")
            return {}
    
    async def _analyze_current_trends(self, workouts: List[Dict[str, Any]], measurements: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze current trends for prediction"""
        try:
            return {
                'strength_trend': await self._analyze_strength_progression(workouts),
                'volume_trend': await self._analyze_volume_trends(workouts),
                'intensity_trend': await self._analyze_intensity_patterns(workouts),
                'consistency_trend': await self._analyze_consistency_patterns(workouts),
                'body_composition_trend': await self._analyze_body_composition_trends(measurements)
            }
        except Exception as e:
            logger.error(f"Error analyzing current trends: {e}")
            return {}
    
    async def _calculate_anomaly_severity(self, anomalies: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate overall anomaly severity"""
        try:
            high_severity = len([a for a in anomalies if a.get('severity') == 'high'])
            medium_severity = len([a for a in anomalies if a.get('severity') == 'medium'])
            
            total_anomalies = len(anomalies)
            
            if total_anomalies == 0:
                severity_score = 0
            elif high_severity > 0:
                severity_score = 0.8 + (high_severity * 0.1)
            else:
                severity_score = 0.3 + (medium_severity * 0.1)
            
            return {
                'overall_severity_score': min(1.0, severity_score),
                'high_severity_count': high_severity,
                'medium_severity_count': medium_severity,
                'total_anomalies': total_anomalies
            }
            
        except Exception as e:
            logger.error(f"Error calculating anomaly severity: {e}")
            return {'overall_severity_score': 0}
    
    async def _calculate_prediction_confidence(self, trends: Dict[str, Any]) -> float:
        """Calculate confidence level for predictions"""
        try:
            # Base confidence on data availability and trend consistency
            confidence = 0.5  # Base confidence
            
            # Increase confidence based on data quality
            if trends.get('strength_trend', {}).get('exercise_progressions'):
                confidence += 0.2
            
            if trends.get('volume_trend', {}).get('trend') != 'insufficient_data':
                confidence += 0.1
            
            if trends.get('consistency_trend', {}).get('consistency_score', 0) > 0.7:
                confidence += 0.1
            
            return min(1.0, confidence)
            
        except Exception as e:
            logger.error(f"Error calculating prediction confidence: {e}")
            return 0.5
    
    async def _identify_risk_factors(self, trends: Dict[str, Any], user_profile: Dict[str, Any]) -> List[str]:
        """Identify risk factors for future performance"""
        try:
            risk_factors = []
            
            # Check for high fatigue
            if trends.get('fatigue_analysis', {}).get('high_fatigue', False):
                risk_factors.append('High fatigue levels detected')
            
            # Check for declining trends
            if trends.get('strength_trend', {}).get('overall_trend') == 'declining':
                risk_factors.append('Declining strength progression')
            
            # Check for low consistency
            consistency_score = trends.get('consistency_trend', {}).get('consistency_score', 0.5)
            if consistency_score < 0.4:
                risk_factors.append('Low workout consistency')
            
            # Check for plateaus
            if trends.get('plateau_detection', {}).get('plateaus_detected', False):
                risk_factors.append('Multiple training plateaus detected')
            
            return risk_factors
            
        except Exception as e:
            logger.error(f"Error identifying risk factors: {e}")
            return []
    
    async def _generate_performance_recommendations(self, analysis: Dict[str, Any], user_profile: Dict[str, Any]) -> List[str]:
        """Generate AI-powered performance recommendations"""
        try:
            recommendations_prompt = f"""
            Based on this performance analysis, generate 3-5 specific, actionable recommendations for this fitness user.
            
            User Profile:
            - Experience Level: {user_profile.get('experienceLevel', 'beginner')}
            - Goals: {', '.join(user_profile.get('fitnessGoals', []))}
            
            Performance Analysis:
            {json.dumps(analysis, indent=2)}
            
            Focus on:
            1. Addressing any plateaus or declining trends
            2. Optimizing training consistency
            3. Managing fatigue and recovery
            4. Progressive overload strategies
            5. Specific exercise recommendations
            
            Make recommendations practical and personalized to their experience level and goals.
            """
            
            bedrock_result = self.bedrock_service.invoke_bedrock(
                recommendations_prompt,
                {
                    'analysis': analysis,
                    'user_profile': user_profile
                },
                max_tokens=400
            )
            
            if bedrock_result['success']:
                return [bedrock_result['response']]
            else:
                return ['Continue consistent training and monitor progress closely.']
                
        except Exception as e:
            logger.error(f"Error generating performance recommendations: {e}")
            return ['Continue consistent training and monitor progress closely.']
    
    async def _generate_anomaly_recommendations(self, anomalies: Dict[str, Any]) -> List[str]:
        """Generate recommendations for detected anomalies"""
        try:
            recommendations = []
            
            for anomaly in anomalies.get('anomalies', []):
                anomaly_type = anomaly.get('type', '')
                
                if anomaly_type == 'volume_anomaly':
                    if anomaly.get('severity') == 'high':
                        recommendations.append('Consider reducing training volume to prevent overtraining')
                    else:
                        recommendations.append('Monitor training volume consistency')
                        
                elif anomaly_type == 'intensity_anomaly':
                    if anomaly.get('severity') == 'high':
                        recommendations.append('Reduce training intensity to prevent burnout')
                    else:
                        recommendations.append('Maintain consistent training intensity')
                        
                elif anomaly_type == 'consistency_anomaly':
                    recommendations.append('Improve workout consistency to maximize progress')
                    
                elif anomaly_type == 'progression_anomaly':
                    if anomaly.get('value', 0) < 0:
                        recommendations.append('Address declining performance with deload or program changes')
                    else:
                        recommendations.append('Excellent progression - maintain current approach')
            
            return list(set(recommendations))  # Remove duplicates
            
        except Exception as e:
            logger.error(f"Error generating anomaly recommendations: {e}")
            return ['Monitor training patterns closely']
    
    async def _extract_key_metrics(self, analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Extract key metrics from analysis"""
        try:
            return {
                'strength_trend': analysis.get('strength_analysis', {}).get('overall_trend', 'unknown'),
                'average_improvement': analysis.get('strength_analysis', {}).get('average_improvement_percent', 0),
                'volume_trend': analysis.get('volume_analysis', {}).get('trend', 'unknown'),
                'consistency_score': analysis.get('consistency_analysis', {}).get('consistency_score', 0),
                'plateaus_detected': analysis.get('plateau_detection', {}).get('plateaus_detected', False),
                'fatigue_level': analysis.get('fatigue_analysis', {}).get('fatigue_score', 0.5)
            }
        except Exception as e:
            logger.error(f"Error extracting key metrics: {e}")
            return {}
    
    async def _generate_action_items(self, analysis: Dict[str, Any], anomalies: Dict[str, Any]) -> List[str]:
        """Generate specific action items"""
        try:
            action_items = []
            
            # Based on analysis
            if analysis.get('plateau_detection', {}).get('plateaus_detected', False):
                action_items.append('Implement plateau-breaking strategies')
            
            if analysis.get('consistency_analysis', {}).get('consistency_score', 0.5) < 0.6:
                action_items.append('Improve workout consistency')
            
            if analysis.get('fatigue_analysis', {}).get('high_fatigue', False):
                action_items.append('Focus on recovery and reduce training load')
            
            # Based on anomalies
            severity_score = anomalies.get('severity_scores', {}).get('overall_severity_score', 0)
            if severity_score > 0.7:
                action_items.append('Address high-severity performance anomalies')
            
            return action_items
            
        except Exception as e:
            logger.error(f"Error generating action items: {e}")
            return ['Continue monitoring performance']
