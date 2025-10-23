import os
import json
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone, timedelta
import boto3
from botocore.exceptions import ClientError

from user_data_service import UserDataService
from context_builder import ContextBuilder
from pattern_analyzer import PatternAnalyzer
from rag_service import RAGService
from bedrock_service import BedrockService

logger = logging.getLogger(__name__)

class ProactiveCoachService:
    """Service for proactive coaching interventions and check-ins"""
    
    def __init__(self):
        self.table_name = os.environ.get('DYNAMODB_TABLE', 'gymcoach-ai-main')
        self.user_data_service = UserDataService(self.table_name)
        self.context_builder = ContextBuilder()
        self.pattern_analyzer = PatternAnalyzer()
        self.rag_service = RAGService()
        self.bedrock_service = BedrockService()
        
        # Proactive coaching configuration
        self.check_in_threshold_days = 3  # Days without activity to trigger check-in
        self.plateau_threshold_weeks = 2  # Weeks without progress to detect plateau
        self.motivation_boost_threshold = 0.3  # Low consistency score triggers motivation
        
    async def handle_proactive_checkin(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle proactive check-in for users who haven't been active
        
        Args:
            event: EventBridge event with check-in trigger
            
        Returns:
            Dictionary with check-in results
        """
        try:
            logger.info("Starting proactive check-in process")
            
            # Get users who need check-ins
            users_needing_checkin = await self._get_users_needing_checkin()
            
            results = {
                'total_users_checked': len(users_needing_checkin),
                'check_ins_sent': 0,
                'errors': []
            }
            
            for user_id in users_needing_checkin:
                try:
                    checkin_result = await self._send_proactive_checkin(user_id)
                    if checkin_result['success']:
                        results['check_ins_sent'] += 1
                    else:
                        results['errors'].append({
                            'user_id': user_id,
                            'error': checkin_result['error']
                        })
                except Exception as e:
                    logger.error(f"Error sending check-in to user {user_id}: {e}")
                    results['errors'].append({
                        'user_id': user_id,
                        'error': str(e)
                    })
            
            logger.info(f"Proactive check-in completed: {results['check_ins_sent']} sent")
            return results
            
        except Exception as e:
            logger.error(f"Error in handle_proactive_checkin: {e}")
            return {'error': str(e)}
    
    async def handle_progress_monitoring(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """
        Monitor user progress and trigger interventions
        
        Args:
            event: EventBridge event with monitoring trigger
            
        Returns:
            Dictionary with monitoring results
        """
        try:
            logger.info("Starting progress monitoring process")
            
            # Get active users for monitoring
            active_users = await self._get_active_users_for_monitoring()
            
            results = {
                'total_users_monitored': len(active_users),
                'interventions_triggered': 0,
                'plateaus_detected': 0,
                'motivation_needed': 0,
                'errors': []
            }
            
            for user_id in active_users:
                try:
                    monitoring_result = await self._monitor_user_progress(user_id)
                    
                    if monitoring_result['intervention_needed']:
                        results['interventions_triggered'] += 1
                        await self._trigger_intervention(user_id, monitoring_result['intervention_type'])
                    
                    if monitoring_result['plateau_detected']:
                        results['plateaus_detected'] += 1
                        await self._handle_plateau_detection(user_id, monitoring_result['plateau_details'])
                    
                    if monitoring_result['motivation_needed']:
                        results['motivation_needed'] += 1
                        await self._send_motivation_boost(user_id, monitoring_result['motivation_context'])
                        
                except Exception as e:
                    logger.error(f"Error monitoring user {user_id}: {e}")
                    results['errors'].append({
                        'user_id': user_id,
                        'error': str(e)
                    })
            
            logger.info(f"Progress monitoring completed: {results}")
            return results
            
        except Exception as e:
            logger.error(f"Error in handle_progress_monitoring: {e}")
            return {'error': str(e)}
    
    async def handle_plateau_detection(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """
        Detect workout plateaus and suggest changes
        
        Args:
            event: EventBridge event with plateau detection trigger
            
        Returns:
            Dictionary with plateau detection results
        """
        try:
            logger.info("Starting plateau detection process")
            
            # Get users for plateau analysis
            users_for_analysis = await self._get_users_for_plateau_analysis()
            
            results = {
                'total_users_analyzed': len(users_for_analysis),
                'plateaus_detected': 0,
                'recommendations_sent': 0,
                'errors': []
            }
            
            for user_id in users_for_analysis:
                try:
                    plateau_result = await self._analyze_user_plateaus(user_id)
                    
                    if plateau_result['plateaus_found']:
                        results['plateaus_detected'] += 1
                        
                        # Send plateau recommendations
                        recommendation_result = await self._send_plateau_recommendations(
                            user_id, plateau_result['plateau_details']
                        )
                        
                        if recommendation_result['success']:
                            results['recommendations_sent'] += 1
                        
                except Exception as e:
                    logger.error(f"Error analyzing plateaus for user {user_id}: {e}")
                    results['errors'].append({
                        'user_id': user_id,
                        'error': str(e)
                    })
            
            logger.info(f"Plateau detection completed: {results}")
            return results
            
        except Exception as e:
            logger.error(f"Error in handle_plateau_detection: {e}")
            return {'error': str(e)}
    
    async def handle_motivation_boost(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """
        Send motivational messages based on user patterns
        
        Args:
            event: EventBridge event with motivation boost trigger
            
        Returns:
            Dictionary with motivation boost results
        """
        try:
            logger.info("Starting motivation boost process")
            
            # Get users who need motivation
            users_needing_motivation = await self._get_users_needing_motivation()
            
            results = {
                'total_users_analyzed': len(users_needing_motivation),
                'motivation_messages_sent': 0,
                'errors': []
            }
            
            for user_id in users_needing_motivation:
                try:
                    motivation_result = await self._send_personalized_motivation(user_id)
                    
                    if motivation_result['success']:
                        results['motivation_messages_sent'] += 1
                    
                except Exception as e:
                    logger.error(f"Error sending motivation to user {user_id}: {e}")
                    results['errors'].append({
                        'user_id': user_id,
                        'error': str(e)
                    })
            
            logger.info(f"Motivation boost completed: {results}")
            return results
            
        except Exception as e:
            logger.error(f"Error in handle_motivation_boost: {e}")
            return {'error': str(e)}
    
    async def handle_weekly_review(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate weekly progress reviews and recommendations
        
        Args:
            event: EventBridge event with weekly review trigger
            
        Returns:
            Dictionary with weekly review results
        """
        try:
            logger.info("Starting weekly review process")
            
            # Get users for weekly review
            users_for_review = await self._get_users_for_weekly_review()
            
            results = {
                'total_users_reviewed': len(users_for_review),
                'reviews_generated': 0,
                'errors': []
            }
            
            for user_id in users_for_review:
                try:
                    review_result = await self._generate_weekly_review(user_id)
                    
                    if review_result['success']:
                        results['reviews_generated'] += 1
                    
                except Exception as e:
                    logger.error(f"Error generating weekly review for user {user_id}: {e}")
                    results['errors'].append({
                        'user_id': user_id,
                        'error': str(e)
                    })
            
            logger.info(f"Weekly review completed: {results}")
            return results
            
        except Exception as e:
            logger.error(f"Error in handle_weekly_review: {e}")
            return {'error': str(e)}
    
    # Helper methods for proactive coaching
    
    async def _get_users_needing_checkin(self) -> List[str]:
        """Get users who need proactive check-ins"""
        try:
            # This would typically query DynamoDB for users who haven't been active
            # For now, we'll implement a simple version
            
            # Get users who haven't had activity in the last 3 days
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=self.check_in_threshold_days)
            
            # Query DynamoDB for inactive users
            # This is a simplified implementation - in production, you'd use GSI queries
            users_needing_checkin = []
            
            # For demonstration, we'll return a placeholder
            # In production, implement proper DynamoDB queries
            return users_needing_checkin
            
        except Exception as e:
            logger.error(f"Error getting users needing check-in: {e}")
            return []
    
    async def _send_proactive_checkin(self, user_id: str) -> Dict[str, Any]:
        """Send proactive check-in message to user"""
        try:
            # Get user context
            user_profile = await self.user_data_service.get_user_profile(user_id)
            recent_workouts = await self.user_data_service.get_recent_workouts(user_id, 5)
            
            if not user_profile:
                return {'success': False, 'error': 'User profile not found'}
            
            # Build check-in context
            checkin_context = {
                'user_profile': user_profile,
                'recent_workouts': recent_workouts,
                'checkin_type': 'proactive',
                'days_since_last_activity': self._calculate_days_since_activity(recent_workouts)
            }
            
            # Generate personalized check-in message using RAG
            rag_context = await self.rag_service.retrieve_relevant_context(
                query="motivational check-in message for inactive user",
                context=checkin_context,
                namespaces=['fitness_knowledge'],
                top_k=2
            )
            
            # Build AI prompt for check-in
            checkin_prompt = f"""
            Generate a personalized, encouraging check-in message for a user who hasn't been active recently.
            
            User Context:
            - Name: {user_profile.get('firstName', '')} {user_profile.get('lastName', '')}
            - Days since last activity: {checkin_context['days_since_last_activity']}
            - Experience level: {user_profile.get('experienceLevel', 'beginner')}
            - Goals: {', '.join(user_profile.get('fitnessGoals', []))}
            
            Create a supportive, non-judgmental message that:
            1. Acknowledges their break without making them feel guilty
            2. Offers gentle encouragement to get back on track
            3. Suggests a simple first step
            4. Maintains a positive, supportive tone
            
            Keep the message under 200 words and make it feel personal.
            """
            
            # Generate response using Bedrock
            bedrock_result = self.bedrock_service.invoke_bedrock(
                checkin_prompt, 
                checkin_context, 
                max_tokens=300
            )
            
            if bedrock_result['success']:
                # Store the check-in message
                await self._store_proactive_message(user_id, 'checkin', bedrock_result['response'])
                
                # Send notification (integrate with notification service)
                await self._send_notification(user_id, 'checkin', bedrock_result['response'])
                
                return {'success': True, 'message': bedrock_result['response']}
            else:
                return {'success': False, 'error': 'Failed to generate check-in message'}
                
        except Exception as e:
            logger.error(f"Error sending proactive check-in to user {user_id}: {e}")
            return {'success': False, 'error': str(e)}
    
    async def _monitor_user_progress(self, user_id: str) -> Dict[str, Any]:
        """Monitor individual user progress and detect issues"""
        try:
            # Get user data for analysis
            workouts = await self.user_data_service.get_historical_workouts(user_id, 30)
            measurements = await self.user_data_service.get_historical_measurements(user_id, 90)
            nutrition_data = await self.user_data_service.get_historical_nutrition(user_id, 14)
            
            # Analyze patterns
            workout_patterns = await self.pattern_analyzer.analyze_workout_patterns(workouts)
            nutrition_patterns = await self.pattern_analyzer.analyze_nutrition_patterns(nutrition_data)
            
            # Detect issues
            intervention_needed = False
            intervention_type = None
            plateau_detected = False
            plateau_details = None
            motivation_needed = False
            motivation_context = None
            
            # Check for consistency issues
            if workout_patterns.get('consistency_patterns', {}).get('consistency_score', 1.0) < 0.5:
                intervention_needed = True
                intervention_type = 'consistency'
            
            # Check for plateaus
            if workout_patterns.get('plateau_detection', {}).get('plateau_count', 0) > 0:
                plateau_detected = True
                plateau_details = workout_patterns['plateau_detection']
            
            # Check for motivation needs
            if workout_patterns.get('consistency_patterns', {}).get('consistency_score', 1.0) < self.motivation_boost_threshold:
                motivation_needed = True
                motivation_context = {
                    'consistency_score': workout_patterns['consistency_patterns']['consistency_score'],
                    'recent_patterns': workout_patterns
                }
            
            return {
                'intervention_needed': intervention_needed,
                'intervention_type': intervention_type,
                'plateau_detected': plateau_detected,
                'plateau_details': plateau_details,
                'motivation_needed': motivation_needed,
                'motivation_context': motivation_context
            }
            
        except Exception as e:
            logger.error(f"Error monitoring progress for user {user_id}: {e}")
            return {
                'intervention_needed': False,
                'plateau_detected': False,
                'motivation_needed': False,
                'error': str(e)
            }
    
    async def _analyze_user_plateaus(self, user_id: str) -> Dict[str, Any]:
        """Analyze user for workout plateaus"""
        try:
            # Get recent workout data
            workouts = await self.user_data_service.get_historical_workouts(user_id, 60)
            
            if len(workouts) < 10:
                return {'plateaus_found': False, 'message': 'Insufficient data for plateau analysis'}
            
            # Analyze workout patterns
            workout_patterns = await self.pattern_analyzer.analyze_workout_patterns(workouts)
            
            plateaus = workout_patterns.get('plateau_detection', {}).get('detected_plateaus', {})
            
            if plateaus:
                return {
                    'plateaus_found': True,
                    'plateau_details': plateaus,
                    'analysis': workout_patterns
                }
            else:
                return {'plateaus_found': False, 'message': 'No plateaus detected'}
                
        except Exception as e:
            logger.error(f"Error analyzing plateaus for user {user_id}: {e}")
            return {'plateaus_found': False, 'error': str(e)}
    
    async def _send_plateau_recommendations(self, user_id: str, plateau_details: Dict[str, Any]) -> Dict[str, Any]:
        """Send plateau-breaking recommendations to user"""
        try:
            # Get user context
            user_profile = await self.user_data_service.get_user_profile(user_id)
            
            # Build plateau-breaking prompt
            plateau_prompt = f"""
            Generate personalized plateau-breaking recommendations for a user experiencing workout plateaus.
            
            User Context:
            - Experience level: {user_profile.get('experienceLevel', 'beginner')}
            - Available equipment: {', '.join(user_profile.get('equipmentAvailable', []))}
            - Goals: {', '.join(user_profile.get('fitnessGoals', []))}
            
            Plateau Details:
            {json.dumps(plateau_details, indent=2)}
            
            Provide specific, actionable recommendations to break through plateaus:
            1. Exercise variations or substitutions
            2. Training technique changes
            3. Volume or intensity adjustments
            4. Recovery recommendations
            
            Keep recommendations practical and achievable. Focus on 3-5 key changes.
            """
            
            # Generate recommendations using RAG + Bedrock
            rag_context = await self.rag_service.retrieve_exercise_context(
                query="plateau breaking exercises and techniques",
                user_context={'experience_level': user_profile.get('experienceLevel', 'beginner')}
            )
            
            # Combine RAG context with prompt
            full_prompt = f"{plateau_prompt}\n\nRelevant Knowledge:\n{rag_context['context']}"
            
            bedrock_result = self.bedrock_service.invoke_bedrock(
                full_prompt,
                {'user_profile': user_profile, 'plateau_details': plateau_details},
                max_tokens=500
            )
            
            if bedrock_result['success']:
                # Store and send recommendations
                await self._store_proactive_message(user_id, 'plateau_recommendations', bedrock_result['response'])
                await self._send_notification(user_id, 'plateau_recommendations', bedrock_result['response'])
                
                return {'success': True, 'recommendations': bedrock_result['response']}
            else:
                return {'success': False, 'error': 'Failed to generate plateau recommendations'}
                
        except Exception as e:
            logger.error(f"Error sending plateau recommendations to user {user_id}: {e}")
            return {'success': False, 'error': str(e)}
    
    async def _send_personalized_motivation(self, user_id: str) -> Dict[str, Any]:
        """Send personalized motivational message"""
        try:
            # Get user context and patterns
            user_profile = await self.user_data_service.get_user_profile(user_id)
            workout_patterns = await self.user_data_service.get_workout_patterns(user_id, 30)
            
            # Build motivation prompt
            motivation_prompt = f"""
            Generate a personalized motivational message for a user who needs encouragement.
            
            User Context:
            - Name: {user_profile.get('firstName', '')} {user_profile.get('lastName', '')}
            - Goals: {', '.join(user_profile.get('fitnessGoals', []))}
            - Experience level: {user_profile.get('experienceLevel', 'beginner')}
            
            Recent Patterns:
            - Consistency score: {workout_patterns.get('consistency', {}).get('consistency_score', 0)}
            - Recent activity: {workout_patterns.get('frequency', {}).get('total_workouts', 0)} workouts
            
            Create an uplifting, personalized message that:
            1. Acknowledges their efforts so far
            2. Reminds them of their goals and why they started
            3. Offers encouragement for the journey ahead
            4. Includes a specific, achievable next step
            
            Use their name and make it feel personal and supportive.
            """
            
            # Generate motivation using RAG + Bedrock
            rag_context = await self.rag_service.retrieve_relevant_context(
                query="motivational fitness coaching messages",
                context={'user_profile': user_profile, 'patterns': workout_patterns},
                namespaces=['fitness_knowledge'],
                top_k=2
            )
            
            full_prompt = f"{motivation_prompt}\n\nMotivational Knowledge:\n{rag_context['context']}"
            
            bedrock_result = self.bedrock_service.invoke_bedrock(
                full_prompt,
                {'user_profile': user_profile, 'patterns': workout_patterns},
                max_tokens=300
            )
            
            if bedrock_result['success']:
                # Store and send motivation
                await self._store_proactive_message(user_id, 'motivation', bedrock_result['response'])
                await self._send_notification(user_id, 'motivation', bedrock_result['response'])
                
                return {'success': True, 'message': bedrock_result['response']}
            else:
                return {'success': False, 'error': 'Failed to generate motivational message'}
                
        except Exception as e:
            logger.error(f"Error sending motivation to user {user_id}: {e}")
            return {'success': False, 'error': str(e)}
    
    async def _generate_weekly_review(self, user_id: str) -> Dict[str, Any]:
        """Generate comprehensive weekly progress review"""
        try:
            # Get comprehensive user data
            user_profile = await self.user_data_service.get_user_profile(user_id)
            workouts = await self.user_data_service.get_historical_workouts(user_id, 7)
            measurements = await self.user_data_service.get_historical_measurements(user_id, 14)
            nutrition_data = await self.user_data_service.get_historical_nutrition(user_id, 7)
            
            # Build comprehensive context
            comprehensive_context = await self.context_builder.build_comprehensive_context(
                user_profile, workouts, measurements, nutrition_data, {}
            )
            
            # Generate weekly review prompt
            review_prompt = f"""
            Generate a comprehensive weekly progress review for a fitness user.
            
            User Profile:
            - Name: {user_profile.get('firstName', '')} {user_profile.get('lastName', '')}
            - Goals: {', '.join(user_profile.get('fitnessGoals', []))}
            
            This Week's Summary:
            - Workouts completed: {len(workouts)}
            - Recent measurements: {len(measurements)} entries
            - Nutrition tracking: {len(nutrition_data.get('meals', []))} meals
            
            Create a detailed weekly review that includes:
            1. Celebration of achievements and progress
            2. Analysis of patterns and trends
            3. Areas for improvement
            4. Specific recommendations for next week
            5. Motivational closing
            
            Make it comprehensive but easy to read, with clear sections.
            """
            
            # Generate review using RAG + Bedrock
            rag_context = await self.rag_service.retrieve_relevant_context(
                query="weekly fitness progress review template",
                context=comprehensive_context,
                namespaces=['fitness_knowledge'],
                top_k=3
            )
            
            full_prompt = f"{review_prompt}\n\nReview Knowledge:\n{rag_context['context']}"
            
            bedrock_result = self.bedrock_service.invoke_bedrock(
                full_prompt,
                comprehensive_context,
                max_tokens=800
            )
            
            if bedrock_result['success']:
                # Store and send weekly review
                await self._store_proactive_message(user_id, 'weekly_review', bedrock_result['response'])
                await self._send_notification(user_id, 'weekly_review', bedrock_result['response'])
                
                return {'success': True, 'review': bedrock_result['response']}
            else:
                return {'success': False, 'error': 'Failed to generate weekly review'}
                
        except Exception as e:
            logger.error(f"Error generating weekly review for user {user_id}: {e}")
            return {'success': False, 'error': str(e)}
    
    # Utility methods
    
    def _calculate_days_since_activity(self, workouts: List[Dict[str, Any]]) -> int:
        """Calculate days since last workout activity"""
        if not workouts:
            return 999  # No workouts ever
        
        try:
            latest_workout = max(workouts, key=lambda x: x.get('date', ''))
            latest_date = datetime.fromisoformat(latest_workout['date'].replace('Z', '+00:00'))
            days_since = (datetime.now(timezone.utc) - latest_date).days
            return days_since
        except Exception:
            return 999
    
    async def _store_proactive_message(self, user_id: str, message_type: str, content: str) -> bool:
        """Store proactive message in DynamoDB"""
        try:
            # This would store the message in DynamoDB
            # Implementation depends on your data model
            logger.info(f"Storing proactive message for user {user_id}, type: {message_type}")
            return True
        except Exception as e:
            logger.error(f"Error storing proactive message: {e}")
            return False
    
    async def _send_notification(self, user_id: str, notification_type: str, content: str) -> bool:
        """Send notification to user"""
        try:
            # This would integrate with your notification service
            # For now, just log the notification
            logger.info(f"Sending {notification_type} notification to user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Error sending notification: {e}")
            return False
    
    # Placeholder methods for user selection (implement based on your data model)
    
    async def _get_active_users_for_monitoring(self) -> List[str]:
        """Get active users for progress monitoring"""
        # Implement based on your user data model
        return []
    
    async def _get_users_for_plateau_analysis(self) -> List[str]:
        """Get users for plateau analysis"""
        # Implement based on your user data model
        return []
    
    async def _get_users_needing_motivation(self) -> List[str]:
        """Get users who need motivation"""
        # Implement based on your user data model
        return []
    
    async def _get_users_for_weekly_review(self) -> List[str]:
        """Get users for weekly review"""
        # Implement based on your user data model
        return []
    
    async def _trigger_intervention(self, user_id: str, intervention_type: str) -> bool:
        """Trigger specific intervention for user"""
        try:
            logger.info(f"Triggering {intervention_type} intervention for user {user_id}")
            # Implement intervention logic
            return True
        except Exception as e:
            logger.error(f"Error triggering intervention: {e}")
            return False
    
    async def _handle_plateau_detection(self, user_id: str, plateau_details: Dict[str, Any]) -> bool:
        """Handle plateau detection for user"""
        try:
            logger.info(f"Handling plateau detection for user {user_id}")
            # Implement plateau handling logic
            return True
        except Exception as e:
            logger.error(f"Error handling plateau detection: {e}")
            return False
