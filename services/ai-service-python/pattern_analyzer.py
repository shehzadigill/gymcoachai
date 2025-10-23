import os
import json
import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timezone, timedelta
import statistics
from collections import defaultdict, Counter
# import numpy as np  # Removed to avoid Lambda dependency issues

logger = logging.getLogger(__name__)

class PatternAnalyzer:
    """Service for analyzing workout and nutrition patterns to identify trends and insights"""
    
    def __init__(self):
        self.min_data_points = 3  # Minimum data points for pattern analysis
        self.trend_threshold = 0.1  # 10% change threshold for trend detection
        self.anomaly_threshold = 2.0  # Standard deviations for anomaly detection
        
    async def analyze_workout_patterns(self, workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Analyze workout patterns and trends
        
        Args:
            workouts: List of workout sessions
            
        Returns:
            Dictionary with pattern analysis results
        """
        try:
            if len(workouts) < self.min_data_points:
                return {'status': 'insufficient_data', 'message': f'Need at least {self.min_data_points} workouts for analysis'}
            
            analysis = {
                'frequency_patterns': await self._analyze_frequency_patterns(workouts),
                'intensity_patterns': await self._analyze_intensity_patterns(workouts),
                'exercise_patterns': await self._analyze_exercise_patterns(workouts),
                'progression_patterns': await self._analyze_progression_patterns(workouts),
                'consistency_patterns': await self._analyze_consistency_patterns(workouts),
                'plateau_detection': await self._detect_plateaus(workouts),
                'anomaly_detection': await self._detect_anomalies(workouts),
                'seasonal_patterns': await self._analyze_seasonal_patterns(workouts),
                'recommendations': await self._generate_workout_recommendations(workouts)
            }
            
            return analysis
            
        except Exception as e:
            logger.error(f"Error analyzing workout patterns: {e}")
            return {'error': str(e)}
    
    async def analyze_nutrition_patterns(self, nutrition_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze nutrition patterns and trends
        
        Args:
            nutrition_data: Nutrition tracking data
            
        Returns:
            Dictionary with nutrition pattern analysis
        """
        try:
            meals = nutrition_data.get('meals', [])
            daily_goals = nutrition_data.get('dailyGoals', {})
            
            if len(meals) < self.min_data_points:
                return {'status': 'insufficient_data', 'message': f'Need at least {self.min_data_points} meals for analysis'}
            
            analysis = {
                'macro_patterns': await self._analyze_macro_patterns(meals, daily_goals),
                'meal_timing_patterns': await self._analyze_meal_timing_patterns(meals),
                'adherence_patterns': await self._analyze_adherence_patterns(meals, daily_goals),
                'calorie_patterns': await self._analyze_calorie_patterns(meals),
                'food_preference_patterns': await self._analyze_food_preference_patterns(meals),
                'hydration_patterns': await self._analyze_hydration_patterns(meals),
                'deficiency_patterns': await self._analyze_deficiency_patterns(meals, daily_goals),
                'recommendations': await self._generate_nutrition_recommendations(meals, daily_goals)
            }
            
            return analysis
            
        except Exception as e:
            logger.error(f"Error analyzing nutrition patterns: {e}")
            return {'error': str(e)}
    
    async def analyze_combined_patterns(self, 
                                     workouts: List[Dict[str, Any]], 
                                     nutrition_data: Dict[str, Any],
                                     measurements: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Analyze combined patterns across workouts, nutrition, and body measurements
        
        Args:
            workouts: Workout sessions
            nutrition_data: Nutrition tracking data
            measurements: Body measurements
            
        Returns:
            Dictionary with combined pattern analysis
        """
        try:
            analysis = {
                'correlation_analysis': await self._analyze_correlations(workouts, nutrition_data, measurements),
                'synergy_patterns': await self._analyze_synergy_patterns(workouts, nutrition_data),
                'recovery_patterns': await self._analyze_recovery_patterns(workouts, nutrition_data),
                'performance_patterns': await self._analyze_performance_patterns(workouts, nutrition_data, measurements),
                'goal_alignment': await self._analyze_goal_alignment(workouts, nutrition_data, measurements),
                'intervention_points': await self._identify_intervention_points(workouts, nutrition_data, measurements),
                'optimization_opportunities': await self._identify_optimization_opportunities(workouts, nutrition_data, measurements)
            }
            
            return analysis
            
        except Exception as e:
            logger.error(f"Error analyzing combined patterns: {e}")
            return {'error': str(e)}
    
    # Workout Pattern Analysis Methods
    
    async def _analyze_frequency_patterns(self, workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze workout frequency patterns"""
        try:
            # Sort workouts by date
            sorted_workouts = sorted(workouts, key=lambda x: x.get('date', ''))
            
            # Calculate frequency metrics
            total_workouts = len(workouts)
            days_span = self._calculate_days_span(sorted_workouts)
            avg_frequency = total_workouts / max(days_span, 1) * 7  # workouts per week
            
            # Analyze weekly patterns
            weekly_counts = self._count_workouts_by_week(sorted_workouts)
            weekly_consistency = 1 - (statistics.stdev(weekly_counts) / max(statistics.mean(weekly_counts), 1))
            
            # Analyze gaps
            gaps = self._calculate_workout_gaps(sorted_workouts)
            avg_gap = statistics.mean(gaps) if gaps else 0
            gap_consistency = 1 - (statistics.stdev(gaps) / max(avg_gap, 1)) if len(gaps) > 1 else 0
            
            # Detect frequency trends
            frequency_trend = self._detect_frequency_trend(weekly_counts)
            
            return {
                'total_workouts': total_workouts,
                'avg_per_week': round(avg_frequency, 2),
                'weekly_consistency': round(weekly_consistency, 2),
                'avg_gap_days': round(avg_gap, 1),
                'gap_consistency': round(gap_consistency, 2),
                'frequency_trend': frequency_trend,
                'days_span': days_span
            }
            
        except Exception as e:
            logger.error(f"Error analyzing frequency patterns: {e}")
            return {'error': str(e)}
    
    async def _analyze_intensity_patterns(self, workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze workout intensity patterns"""
        try:
            intensity_data = []
            
            for workout in workouts:
                exercises = workout.get('exercises', [])
                workout_intensity = 0
                total_volume = 0
                
                for exercise in exercises:
                    weight = exercise.get('weight', 0)
                    reps = exercise.get('reps', 0)
                    sets = exercise.get('sets', 1)
                    
                    if weight > 0 and reps > 0:
                        volume = weight * reps * sets
                        total_volume += volume
                        
                        # Calculate intensity as percentage of estimated max
                        estimated_max = weight * (1 + reps / 30)  # Epley formula approximation
                        intensity = (weight / estimated_max) * 100
                        workout_intensity += intensity
                
                if exercises:
                    avg_intensity = workout_intensity / len(exercises)
                    intensity_data.append({
                        'date': workout.get('date', ''),
                        'intensity': avg_intensity,
                        'volume': total_volume,
                        'duration': workout.get('duration', 0)
                    })
            
            if not intensity_data:
                return {'status': 'no_data', 'message': 'No intensity data available'}
            
            # Analyze intensity trends
            intensities = [d['intensity'] for d in intensity_data]
            volumes = [d['volume'] for d in intensity_data]
            
            intensity_trend = self._detect_trend(intensities)
            volume_trend = self._detect_trend(volumes)
            
            # Analyze intensity distribution
            intensity_distribution = self._analyze_distribution(intensities)
            
            return {
                'avg_intensity': round(statistics.mean(intensities), 2),
                'intensity_trend': intensity_trend,
                'volume_trend': volume_trend,
                'intensity_distribution': intensity_distribution,
                'data_points': len(intensity_data)
            }
            
        except Exception as e:
            logger.error(f"Error analyzing intensity patterns: {e}")
            return {'error': str(e)}
    
    async def _analyze_exercise_patterns(self, workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze exercise selection and progression patterns"""
        try:
            exercise_data = defaultdict(list)
            exercise_frequency = Counter()
            muscle_group_frequency = Counter()
            
            for workout in workouts:
                exercises = workout.get('exercises', [])
                workout_date = workout.get('date', '')
                
                for exercise in exercises:
                    exercise_name = exercise.get('name', '').lower()
                    if exercise_name:
                        exercise_frequency[exercise_name] += 1
                        
                        # Track progression
                        weight = exercise.get('weight', 0)
                        reps = exercise.get('reps', 0)
                        if weight > 0 and reps > 0:
                            exercise_data[exercise_name].append({
                                'date': workout_date,
                                'weight': weight,
                                'reps': reps,
                                'sets': exercise.get('sets', 1)
                            })
                        
                        # Track muscle groups
                        muscle_groups = exercise.get('muscleGroups', [])
                        for muscle_group in muscle_groups:
                            muscle_group_frequency[muscle_group] += 1
            
            # Analyze exercise diversity
            exercise_diversity = len(exercise_frequency)
            muscle_group_diversity = len(muscle_group_frequency)
            
            # Analyze progression patterns
            progression_patterns = {}
            for exercise, data in exercise_data.items():
                if len(data) >= 3:
                    progression_patterns[exercise] = self._analyze_exercise_progression(data)
            
            # Identify exercise preferences
            top_exercises = dict(exercise_frequency.most_common(10))
            top_muscle_groups = dict(muscle_group_frequency.most_common(5))
            
            return {
                'exercise_diversity': exercise_diversity,
                'muscle_group_diversity': muscle_group_diversity,
                'top_exercises': top_exercises,
                'top_muscle_groups': top_muscle_groups,
                'progression_patterns': progression_patterns,
                'exercise_balance': self._analyze_exercise_balance(muscle_group_frequency)
            }
            
        except Exception as e:
            logger.error(f"Error analyzing exercise patterns: {e}")
            return {'error': str(e)}
    
    async def _analyze_progression_patterns(self, workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze strength progression patterns"""
        try:
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
                            'weight': weight,
                            'reps': reps,
                            'estimated_1rm': estimated_1rm
                        })
            
            # Analyze progression for each exercise
            progression_analysis = {}
            for exercise, data in progression_data.items():
                if len(data) >= 3:
                    progression_analysis[exercise] = self._analyze_exercise_progression(data)
            
            # Calculate overall progression metrics
            overall_progression = self._calculate_overall_progression(progression_analysis)
            
            return {
                'exercise_progressions': progression_analysis,
                'overall_progression': overall_progression,
                'exercises_tracked': len(progression_data),
                'progression_consistency': self._calculate_progression_consistency(progression_analysis)
            }
            
        except Exception as e:
            logger.error(f"Error analyzing progression patterns: {e}")
            return {'error': str(e)}
    
    async def _analyze_consistency_patterns(self, workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze workout consistency patterns"""
        try:
            # Analyze by day of week
            day_of_week_counts = Counter()
            for workout in workouts:
                workout_date = workout.get('date', '')
                if workout_date:
                    try:
                        date_obj = datetime.fromisoformat(workout_date.replace('Z', '+00:00'))
                        day_name = date_obj.strftime('%A')
                        day_of_week_counts[day_name] += 1
                    except Exception:
                        continue
            
            # Analyze gaps between workouts
            gaps = self._calculate_workout_gaps(workouts)
            
            # Calculate consistency metrics
            consistency_score = self._calculate_consistency_score(gaps)
            
            # Analyze workout duration consistency
            durations = [w.get('duration', 0) for w in workouts if w.get('duration', 0) > 0]
            duration_consistency = 1 - (statistics.stdev(durations) / max(statistics.mean(durations), 1)) if len(durations) > 1 else 0
            
            return {
                'day_of_week_distribution': dict(day_of_week_counts),
                'avg_gap_days': round(statistics.mean(gaps), 1) if gaps else 0,
                'max_gap_days': max(gaps) if gaps else 0,
                'consistency_score': consistency_score,
                'duration_consistency': round(duration_consistency, 2),
                'preferred_workout_days': [day for day, count in day_of_week_counts.most_common(3)]
            }
            
        except Exception as e:
            logger.error(f"Error analyzing consistency patterns: {e}")
            return {'error': str(e)}
    
    async def _detect_plateaus(self, workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Detect strength plateaus in workout data"""
        try:
            plateau_data = defaultdict(list)
            
            # Collect progression data for each exercise
            for workout in workouts:
                exercises = workout.get('exercises', [])
                workout_date = workout.get('date', '')
                
                for exercise in exercises:
                    exercise_name = exercise.get('name', '').lower()
                    weight = exercise.get('weight', 0)
                    reps = exercise.get('reps', 0)
                    
                    if weight > 0 and reps > 0:
                        estimated_1rm = weight * (1 + reps / 30)
                        plateau_data[exercise_name].append({
                            'date': workout_date,
                            'estimated_1rm': estimated_1rm
                        })
            
            # Detect plateaus for each exercise
            plateaus = {}
            for exercise, data in plateau_data.items():
                if len(data) >= 5:  # Need at least 5 data points
                    plateau_info = self._detect_exercise_plateau(data)
                    if plateau_info['is_plateau']:
                        plateaus[exercise] = plateau_info
            
            return {
                'detected_plateaus': plateaus,
                'plateau_count': len(plateaus),
                'plateau_exercises': list(plateaus.keys())
            }
            
        except Exception as e:
            logger.error(f"Error detecting plateaus: {e}")
            return {'error': str(e)}
    
    async def _detect_anomalies(self, workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Detect anomalous workout patterns"""
        try:
            anomalies = []
            
            # Analyze workout duration anomalies
            durations = [w.get('duration', 0) for w in workouts if w.get('duration', 0) > 0]
            if len(durations) >= 3:
                duration_anomalies = self._detect_numerical_anomalies(durations)
                for i, is_anomaly in enumerate(duration_anomalies):
                    if is_anomaly:
                        anomalies.append({
                            'type': 'duration',
                            'workout_index': i,
                            'value': durations[i],
                            'severity': 'high' if durations[i] > statistics.mean(durations) + 2 * statistics.stdev(durations) else 'medium'
                        })
            
            # Analyze workout frequency anomalies
            gaps = self._calculate_workout_gaps(workouts)
            if len(gaps) >= 3:
                gap_anomalies = self._detect_numerical_anomalies(gaps)
                for i, is_anomaly in enumerate(gap_anomalies):
                    if is_anomaly:
                        anomalies.append({
                            'type': 'frequency',
                            'gap_index': i,
                            'value': gaps[i],
                            'severity': 'high' if gaps[i] > statistics.mean(gaps) + 2 * statistics.stdev(gaps) else 'medium'
                        })
            
            return {
                'anomalies': anomalies,
                'anomaly_count': len(anomalies),
                'anomaly_types': list(set([a['type'] for a in anomalies]))
            }
            
        except Exception as e:
            logger.error(f"Error detecting anomalies: {e}")
            return {'error': str(e)}
    
    async def _analyze_seasonal_patterns(self, workouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze seasonal patterns in workout data"""
        try:
            monthly_counts = Counter()
            seasonal_intensity = defaultdict(list)
            
            for workout in workouts:
                workout_date = workout.get('date', '')
                if workout_date:
                    try:
                        date_obj = datetime.fromisoformat(workout_date.replace('Z', '+00:00'))
                        month = date_obj.month
                        monthly_counts[month] += 1
                        
                        # Calculate workout intensity
                        exercises = workout.get('exercises', [])
                        total_volume = sum(
                            ex.get('weight', 0) * ex.get('reps', 0) * ex.get('sets', 1)
                            for ex in exercises
                        )
                        seasonal_intensity[month].append(total_volume)
                    except Exception:
                        continue
            
            # Analyze seasonal trends
            seasonal_trends = {}
            for month, intensities in seasonal_intensity.items():
                if intensities:
                    seasonal_trends[month] = {
                        'avg_intensity': round(statistics.mean(intensities), 2),
                        'workout_count': monthly_counts[month]
                    }
            
            return {
                'monthly_distribution': dict(monthly_counts),
                'seasonal_intensity': seasonal_trends,
                'peak_month': monthly_counts.most_common(1)[0][0] if monthly_counts else None,
                'low_month': monthly_counts.most_common()[-1][0] if monthly_counts else None
            }
            
        except Exception as e:
            logger.error(f"Error analyzing seasonal patterns: {e}")
            return {'error': str(e)}
    
    async def _generate_workout_recommendations(self, workouts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generate workout recommendations based on pattern analysis"""
        try:
            recommendations = []
            
            # Analyze patterns to generate recommendations
            frequency_patterns = await self._analyze_frequency_patterns(workouts)
            consistency_patterns = await self._analyze_consistency_patterns(workouts)
            plateaus = await self._detect_plateaus(workouts)
            
            # Frequency recommendations
            if frequency_patterns.get('avg_per_week', 0) < 2:
                recommendations.append({
                    'type': 'frequency',
                    'priority': 'high',
                    'message': 'Consider increasing workout frequency to at least 2-3 times per week for better results',
                    'action': 'increase_frequency'
                })
            elif frequency_patterns.get('avg_per_week', 0) > 6:
                recommendations.append({
                    'type': 'frequency',
                    'priority': 'medium',
                    'message': 'High workout frequency detected. Consider adding more rest days for recovery',
                    'action': 'add_rest_days'
                })
            
            # Consistency recommendations
            if consistency_patterns.get('consistency_score', 0) < 0.5:
                recommendations.append({
                    'type': 'consistency',
                    'priority': 'high',
                    'message': 'Workout consistency is low. Try to establish a regular schedule',
                    'action': 'improve_consistency'
                })
            
            # Plateau recommendations
            if plateaus.get('plateau_count', 0) > 0:
                recommendations.append({
                    'type': 'plateau',
                    'priority': 'medium',
                    'message': f"Plateaus detected in {plateaus['plateau_count']} exercises. Consider changing your routine",
                    'action': 'change_routine'
                })
            
            return recommendations
            
        except Exception as e:
            logger.error(f"Error generating workout recommendations: {e}")
            return []
    
    # Helper methods
    
    def _calculate_days_span(self, records: List[Dict[str, Any]]) -> int:
        """Calculate days span between first and last record"""
        if len(records) < 2:
            return 0
        
        try:
            first_date = datetime.fromisoformat(records[0].get('date', '').replace('Z', '+00:00'))
            last_date = datetime.fromisoformat(records[-1].get('date', '').replace('Z', '+00:00'))
            return (last_date - first_date).days
        except Exception:
            return 0
    
    def _count_workouts_by_week(self, workouts: List[Dict[str, Any]]) -> List[int]:
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
    
    def _detect_trend(self, values: List[float]) -> str:
        """Detect trend in a series of values"""
        if len(values) < 3:
            return 'insufficient_data'
        
        # Simple linear trend detection using least squares
        n = len(values)
        x = list(range(n))
        sum_x = sum(x)
        sum_y = sum(values)
        sum_xy = sum(x[i] * values[i] for i in range(n))
        sum_x2 = sum(x_val ** 2 for x_val in x)
        
        # Calculate slope using least squares formula
        slope = (n * sum_xy - sum_x * sum_y) / (n * sum_x2 - sum_x ** 2)
        
        if slope > self.trend_threshold:
            return 'increasing'
        elif slope < -self.trend_threshold:
            return 'decreasing'
        else:
            return 'stable'
    
    def _detect_numerical_anomalies(self, values: List[float]) -> List[bool]:
        """Detect anomalies in numerical data using statistical methods"""
        if len(values) < 3:
            return [False] * len(values)
        
        mean_val = statistics.mean(values)
        std_val = statistics.stdev(values)
        
        anomalies = []
        for value in values:
            z_score = abs(value - mean_val) / std_val if std_val > 0 else 0
            anomalies.append(z_score > self.anomaly_threshold)
        
        return anomalies
    
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
    
    # Additional helper methods for nutrition analysis would be implemented here
    # following similar patterns to the workout analysis methods
