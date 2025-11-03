import os
import json
import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timezone, timedelta
import asyncio
from collections import defaultdict, Counter
import statistics

from user_data_service import UserDataService
from memory_service import MemoryService
from bedrock_service import BedrockService

logger = logging.getLogger(__name__)

class PersonalizationEngine:
    """Engine for personalized coaching style adaptation and user preference learning"""
    
    def __init__(self):
        self.table_name = os.environ.get('DYNAMODB_TABLE', 'gymcoach-ai-main')
        self.user_data_service = UserDataService(self.table_name)
        self.memory_service = MemoryService()
        self.bedrock_service = BedrockService()
        
        # Coaching style dimensions
        self.coaching_styles = {
            'motivational': {
                'traits': ['encouraging', 'positive', 'energetic', 'supportive'],
                'language': ['You can do it!', 'Great job!', 'Keep pushing!', 'Amazing progress!'],
                'approach': 'Focus on encouragement and positive reinforcement'
            },
            'analytical': {
                'traits': ['data-driven', 'precise', 'logical', 'systematic'],
                'language': ['Based on the data', 'Let\'s analyze', 'The numbers show', 'Systematic approach'],
                'approach': 'Focus on data analysis and systematic improvement'
            },
            'educational': {
                'traits': ['informative', 'explanatory', 'teaching', 'detailed'],
                'language': ['Let me explain', 'Here\'s why', 'The science shows', 'Understanding this'],
                'approach': 'Focus on education and understanding'
            },
            'supportive': {
                'traits': ['empathetic', 'understanding', 'patient', 'caring'],
                'language': ['I understand', 'That\'s okay', 'Take your time', 'We\'ll work through this'],
                'approach': 'Focus on emotional support and understanding'
            },
            'challenging': {
                'traits': ['demanding', 'pushing', 'intense', 'goal-oriented'],
                'language': ['Push harder', 'No excuses', 'Dig deeper', 'Rise to the challenge'],
                'approach': 'Focus on pushing limits and achieving goals'
            }
        }
        
        # User preference categories
        self.preference_categories = {
            'communication_style': ['direct', 'gentle', 'detailed', 'brief'],
            'motivation_type': ['intrinsic', 'extrinsic', 'social', 'achievement'],
            'feedback_frequency': ['frequent', 'moderate', 'minimal'],
            'goal_approach': ['aggressive', 'moderate', 'conservative'],
            'learning_style': ['visual', 'auditory', 'kinesthetic', 'reading'],
            'interaction_preference': ['formal', 'casual', 'friendly', 'professional']
        }
        
    async def analyze_user_preferences(self, user_id: str) -> Dict[str, Any]:
        """
        Analyze user preferences based on conversation history and interactions
        
        Args:
            user_id: User ID
            
        Returns:
            Dictionary with analyzed user preferences
        """
        try:
            logger.info(f"Analyzing user preferences for user {user_id}")
            
            # Get user memories and conversation history
            memories = await self.memory_service.get_user_memories(user_id)
            conversation_history = await self.memory_service.get_conversation_history(user_id)
            
            # Analyze communication patterns
            communication_analysis = await self._analyze_communication_patterns(
                conversation_history, memories
            )
            
            # Analyze motivation patterns
            motivation_analysis = await self._analyze_motivation_patterns(memories)
            
            # Analyze feedback preferences
            feedback_analysis = await self._analyze_feedback_preferences(
                conversation_history, memories
            )
            
            # Analyze goal approach
            goal_analysis = await self._analyze_goal_approach(memories)
            
            # Analyze learning style
            learning_analysis = await self._analyze_learning_style(memories)
            
            # Generate AI-powered preference insights
            preference_insights = await self._generate_preference_insights(
                communication_analysis, motivation_analysis, feedback_analysis,
                goal_analysis, learning_analysis
            )
            
            return {
                'user_id': user_id,
                'analysis_date': datetime.now(timezone.utc).isoformat(),
                'communication_style': communication_analysis,
                'motivation_type': motivation_analysis,
                'feedback_preferences': feedback_analysis,
                'goal_approach': goal_analysis,
                'learning_style': learning_analysis,
                'preference_insights': preference_insights,
                'confidence_score': await self._calculate_preference_confidence(
                    communication_analysis, motivation_analysis, feedback_analysis,
                    goal_analysis, learning_analysis
                )
            }
            
        except Exception as e:
            logger.error(f"Error analyzing user preferences for user {user_id}: {e}")
            return {'error': str(e)}
    
    async def determine_optimal_coaching_style(self, user_id: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Determine optimal coaching style based on user preferences and current context
        
        Args:
            user_id: User ID
            context: Current conversation context
            
        Returns:
            Dictionary with optimal coaching style recommendations
        """
        try:
            logger.info(f"Determining optimal coaching style for user {user_id}")
            
            # Get user preferences
            preferences = await self.analyze_user_preferences(user_id)
            
            if 'error' in preferences:
                return preferences
            
            # Get user profile for additional context
            user_profile = await self.user_data_service.get_user_profile(user_id)
            
            # Analyze current context
            context_analysis = await self._analyze_current_context(context, user_profile)
            
            # Score coaching styles based on preferences and context
            style_scores = await self._score_coaching_styles(
                preferences, context_analysis, user_profile
            )
            
            # Select optimal style
            optimal_style = await self._select_optimal_style(style_scores, context_analysis)
            
            # Generate style-specific recommendations
            style_recommendations = await self._generate_style_recommendations(
                optimal_style, preferences, context_analysis
            )
            
            return {
                'user_id': user_id,
                'optimal_style': optimal_style,
                'style_scores': style_scores,
                'context_analysis': context_analysis,
                'style_recommendations': style_recommendations,
                'adaptation_reasoning': await self._generate_adaptation_reasoning(
                    optimal_style, preferences, context_analysis
                ),
                'timestamp': datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error determining coaching style for user {user_id}: {e}")
            return {'error': str(e)}
    
    async def adapt_coaching_message(self, user_id: str, base_message: str, 
                                   coaching_style: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Adapt a coaching message to match the user's preferred style
        
        Args:
            user_id: User ID
            base_message: Base message to adapt
            coaching_style: Desired coaching style
            context: Current context
            
        Returns:
            Dictionary with adapted message
        """
        try:
            logger.info(f"Adapting coaching message for user {user_id}")
            
            # Get user preferences
            preferences = await self.analyze_user_preferences(user_id)
            
            if 'error' in preferences:
                return {'error': 'Failed to get user preferences'}
            
            # Create adaptation prompt
            adaptation_prompt = f"""
            Adapt this coaching message to match the user's preferred communication style and the specified coaching approach.
            
            Base Message:
            {base_message}
            
            Desired Coaching Style: {coaching_style}
            Style Traits: {', '.join(self.coaching_styles.get(coaching_style, {}).get('traits', []))}
            Style Approach: {self.coaching_styles.get(coaching_style, {}).get('approach', '')}
            
            User Preferences:
            Communication Style: {preferences.get('communication_style', {}).get('primary_style', 'balanced')}
            Motivation Type: {preferences.get('motivation_type', {}).get('primary_type', 'intrinsic')}
            Feedback Preference: {preferences.get('feedback_preferences', {}).get('preferred_frequency', 'moderate')}
            Learning Style: {preferences.get('learning_style', {}).get('primary_style', 'mixed')}
            
            Current Context:
            {json.dumps(context, indent=2)}
            
            Adapt the message to:
            1. Match the coaching style traits and approach
            2. Align with user's communication preferences
            3. Use appropriate motivation techniques
            4. Provide feedback at the preferred frequency level
            5. Use language that resonates with their learning style
            6. Consider the current context and situation
            
            Maintain the core message content while adapting the tone, style, and delivery approach.
            """
            
            bedrock_result = self.bedrock_service.invoke_bedrock(
                adaptation_prompt,
                {
                    'base_message': base_message,
                    'coaching_style': coaching_style,
                    'preferences': preferences,
                    'context': context
                },
                max_tokens=400
            )
            
            if bedrock_result['success']:
                return {
                    'user_id': user_id,
                    'original_message': base_message,
                    'adapted_message': bedrock_result['response'],
                    'coaching_style': coaching_style,
                    'adaptation_timestamp': datetime.now(timezone.utc).isoformat()
                }
            else:
                return {'error': 'Failed to adapt message'}
                
        except Exception as e:
            logger.error(f"Error adapting coaching message for user {user_id}: {e}")
            return {'error': str(e)}
    
    async def learn_from_user_feedback(self, user_id: str, feedback_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Learn from user feedback to improve personalization
        
        Args:
            user_id: User ID
            feedback_data: User feedback data
            
        Returns:
            Dictionary with learning results
        """
        try:
            logger.info(f"Learning from user feedback for user {user_id}")
            
            # Extract feedback information
            feedback_type = feedback_data.get('type', 'general')  # positive, negative, neutral
            feedback_content = feedback_data.get('content', '')
            context = feedback_data.get('context', {})
            
            # Analyze feedback sentiment and content
            feedback_analysis = await self._analyze_feedback_content(feedback_content, context)
            
            # Update user preferences based on feedback
            preference_updates = await self._generate_preference_updates(
                feedback_analysis, feedback_type, context
            )
            
            # Store feedback as memory
            feedback_memory = {
                'user_id': user_id,
                'memory_id': f"feedback_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                'type': 'feedback',
                'content': feedback_content,
                'importance_score': 0.7 if feedback_type == 'negative' else 0.5,
                'context': {
                    'feedback_type': feedback_type,
                    'analysis': feedback_analysis,
                    'preference_updates': preference_updates
                },
                'created_at': datetime.now(timezone.utc).isoformat(),
                'last_accessed': datetime.now(timezone.utc).isoformat(),
                'access_count': 0
            }
            
            await self.memory_service._store_memory(user_id, feedback_memory)
            
            # Update user preferences
            await self._update_user_preferences(user_id, preference_updates)
            
            return {
                'user_id': user_id,
                'feedback_type': feedback_type,
                'feedback_analysis': feedback_analysis,
                'preference_updates': preference_updates,
                'learning_timestamp': datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error learning from user feedback for user {user_id}: {e}")
            return {'error': str(e)}
    
    # Helper methods for preference analysis
    
    async def _analyze_communication_patterns(self, conversation_history: Dict[str, Any], 
                                            memories: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze user's communication patterns"""
        try:
            messages = conversation_history.get('messages', [])
            
            if not messages:
                return {'primary_style': 'balanced', 'confidence': 0.3}
            
            # Analyze message characteristics
            message_lengths = []
            question_counts = []
            emotional_indicators = []
            
            for message in messages:
                if message.get('role') == 'user':
                    content = message.get('content', '')
                    message_lengths.append(len(content))
                    question_counts.append(content.count('?'))
                    
                    # Simple emotional indicators
                    if any(word in content.lower() for word in ['great', 'awesome', 'love', 'excited']):
                        emotional_indicators.append('positive')
                    elif any(word in content.lower() for word in ['difficult', 'hard', 'struggling', 'frustrated']):
                        emotional_indicators.append('negative')
                    else:
                        emotional_indicators.append('neutral')
            
            # Determine communication style
            avg_length = statistics.mean(message_lengths) if message_lengths else 0
            avg_questions = statistics.mean(question_counts) if question_counts else 0
            emotional_tendency = Counter(emotional_indicators).most_common(1)[0][0] if emotional_indicators else 'neutral'
            
            # Classify style
            if avg_length > 100 and avg_questions > 1:
                primary_style = 'detailed'
            elif avg_length < 50 and avg_questions < 0.5:
                primary_style = 'brief'
            elif emotional_tendency == 'positive':
                primary_style = 'gentle'
            else:
                primary_style = 'direct'
            
            return {
                'primary_style': primary_style,
                'avg_message_length': avg_length,
                'avg_questions_per_message': avg_questions,
                'emotional_tendency': emotional_tendency,
                'confidence': min(0.9, len(messages) / 20)  # Confidence based on data volume
            }
            
        except Exception as e:
            logger.error(f"Error analyzing communication patterns: {e}")
            return {'primary_style': 'balanced', 'confidence': 0.3}
    
    async def _analyze_motivation_patterns(self, memories: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze user's motivation patterns"""
        try:
            if not memories:
                return {'primary_type': 'intrinsic', 'confidence': 0.3}
            
            # Analyze memory content for motivation indicators
            motivation_indicators = {
                'intrinsic': 0,
                'extrinsic': 0,
                'social': 0,
                'achievement': 0
            }
            
            for memory in memories:
                content = memory.get('content', '').lower()
                
                # Intrinsic motivation indicators
                if any(word in content for word in ['enjoy', 'fun', 'love', 'passion', 'personal']):
                    motivation_indicators['intrinsic'] += 1
                
                # Extrinsic motivation indicators
                if any(word in content for word in ['reward', 'prize', 'incentive', 'bonus']):
                    motivation_indicators['extrinsic'] += 1
                
                # Social motivation indicators
                if any(word in content for word in ['friends', 'family', 'social', 'group', 'team']):
                    motivation_indicators['social'] += 1
                
                # Achievement motivation indicators
                if any(word in content for word in ['goal', 'target', 'achievement', 'success', 'win']):
                    motivation_indicators['achievement'] += 1
            
            # Determine primary motivation type
            primary_type = max(motivation_indicators.items(), key=lambda x: x[1])[0]
            confidence = min(0.9, sum(motivation_indicators.values()) / 10)
            
            return {
                'primary_type': primary_type,
                'motivation_scores': motivation_indicators,
                'confidence': confidence
            }
            
        except Exception as e:
            logger.error(f"Error analyzing motivation patterns: {e}")
            return {'primary_type': 'intrinsic', 'confidence': 0.3}
    
    async def _analyze_feedback_preferences(self, conversation_history: Dict[str, Any], 
                                         memories: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze user's feedback preferences"""
        try:
            messages = conversation_history.get('messages', [])
            
            if not messages:
                return {'preferred_frequency': 'moderate', 'confidence': 0.3}
            
            # Count feedback-related interactions
            feedback_requests = 0
            positive_responses = 0
            negative_responses = 0
            
            for message in messages:
                content = message.get('content', '').lower()
                
                if any(word in content for word in ['feedback', 'how am i doing', 'progress', 'update']):
                    feedback_requests += 1
                
                if message.get('role') == 'user':
                    if any(word in content for word in ['good', 'great', 'helpful', 'thanks']):
                        positive_responses += 1
                    elif any(word in content for word in ['not helpful', 'wrong', 'confused']):
                        negative_responses += 1
            
            # Determine feedback preference
            if feedback_requests > len(messages) * 0.3:
                preferred_frequency = 'frequent'
            elif feedback_requests < len(messages) * 0.1:
                preferred_frequency = 'minimal'
            else:
                preferred_frequency = 'moderate'
            
            confidence = min(0.9, len(messages) / 15)
            
            return {
                'preferred_frequency': preferred_frequency,
                'feedback_requests': feedback_requests,
                'positive_responses': positive_responses,
                'negative_responses': negative_responses,
                'confidence': confidence
            }
            
        except Exception as e:
            logger.error(f"Error analyzing feedback preferences: {e}")
            return {'preferred_frequency': 'moderate', 'confidence': 0.3}
    
    async def _analyze_goal_approach(self, memories: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze user's goal approach"""
        try:
            if not memories:
                return {'approach': 'moderate', 'confidence': 0.3}
            
            # Analyze goal-related memories
            goal_memories = [mem for mem in memories if mem.get('type') == 'goal']
            
            if not goal_memories:
                return {'approach': 'moderate', 'confidence': 0.3}
            
            # Analyze goal characteristics
            aggressive_indicators = 0
            conservative_indicators = 0
            
            for memory in goal_memories:
                content = memory.get('content', '').lower()
                
                if any(word in content for word in ['aggressive', 'fast', 'quick', 'challenge', 'push']):
                    aggressive_indicators += 1
                elif any(word in content for word in ['gradual', 'slow', 'steady', 'careful', 'safe']):
                    conservative_indicators += 1
            
            # Determine approach
            if aggressive_indicators > conservative_indicators:
                approach = 'aggressive'
            elif conservative_indicators > aggressive_indicators:
                approach = 'conservative'
            else:
                approach = 'moderate'
            
            confidence = min(0.9, len(goal_memories) / 5)
            
            return {
                'approach': approach,
                'aggressive_indicators': aggressive_indicators,
                'conservative_indicators': conservative_indicators,
                'confidence': confidence
            }
            
        except Exception as e:
            logger.error(f"Error analyzing goal approach: {e}")
            return {'approach': 'moderate', 'confidence': 0.3}
    
    async def _analyze_learning_style(self, memories: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze user's learning style"""
        try:
            if not memories:
                return {'primary_style': 'mixed', 'confidence': 0.3}
            
            # Analyze learning-related memories
            learning_indicators = {
                'visual': 0,
                'auditory': 0,
                'kinesthetic': 0,
                'reading': 0
            }
            
            for memory in memories:
                content = memory.get('content', '').lower()
                
                # Visual learning indicators
                if any(word in content for word in ['see', 'show', 'visual', 'picture', 'diagram']):
                    learning_indicators['visual'] += 1
                
                # Auditory learning indicators
                if any(word in content for word in ['hear', 'listen', 'audio', 'sound', 'explain']):
                    learning_indicators['auditory'] += 1
                
                # Kinesthetic learning indicators
                if any(word in content for word in ['feel', 'touch', 'practice', 'hands-on', 'experience']):
                    learning_indicators['kinesthetic'] += 1
                
                # Reading learning indicators
                if any(word in content for word in ['read', 'text', 'article', 'book', 'written']):
                    learning_indicators['reading'] += 1
            
            # Determine primary learning style
            primary_style = max(learning_indicators.items(), key=lambda x: x[1])[0]
            confidence = min(0.9, sum(learning_indicators.values()) / 8)
            
            return {
                'primary_style': primary_style,
                'learning_scores': learning_indicators,
                'confidence': confidence
            }
            
        except Exception as e:
            logger.error(f"Error analyzing learning style: {e}")
            return {'primary_style': 'mixed', 'confidence': 0.3}
    
    async def _generate_preference_insights(self, communication_analysis: Dict[str, Any],
                                          motivation_analysis: Dict[str, Any],
                                          feedback_analysis: Dict[str, Any],
                                          goal_analysis: Dict[str, Any],
                                          learning_analysis: Dict[str, Any]) -> str:
        """Generate AI-powered preference insights"""
        try:
            insights_prompt = f"""
            Generate insights about this user's preferences based on the analysis data.
            
            Communication Style: {communication_analysis.get('primary_style', 'balanced')}
            Motivation Type: {motivation_analysis.get('primary_type', 'intrinsic')}
            Feedback Preference: {feedback_analysis.get('preferred_frequency', 'moderate')}
            Goal Approach: {goal_analysis.get('approach', 'moderate')}
            Learning Style: {learning_analysis.get('primary_style', 'mixed')}
            
            Provide insights about:
            1. How to communicate effectively with this user
            2. What motivates them most
            3. How often to provide feedback
            4. How to approach goal setting
            5. How to present information for optimal learning
            
            Keep insights practical and actionable for coaching purposes.
            """
            
            bedrock_result = self.bedrock_service.invoke_bedrock(
                insights_prompt,
                {
                    'communication': communication_analysis,
                    'motivation': motivation_analysis,
                    'feedback': feedback_analysis,
                    'goal': goal_analysis,
                    'learning': learning_analysis
                },
                max_tokens=300
            )
            
            if bedrock_result['success']:
                return bedrock_result['response']
            else:
                return "Preference insights generation failed."
                
        except Exception as e:
            logger.error(f"Error generating preference insights: {e}")
            return "Error generating preference insights."
    
    async def _calculate_preference_confidence(self, communication_analysis: Dict[str, Any],
                                             motivation_analysis: Dict[str, Any],
                                             feedback_analysis: Dict[str, Any],
                                             goal_analysis: Dict[str, Any],
                                             learning_analysis: Dict[str, Any]) -> float:
        """Calculate overall confidence in preference analysis"""
        try:
            confidences = [
                communication_analysis.get('confidence', 0.3),
                motivation_analysis.get('confidence', 0.3),
                feedback_analysis.get('confidence', 0.3),
                goal_analysis.get('confidence', 0.3),
                learning_analysis.get('confidence', 0.3)
            ]
            
            return statistics.mean(confidences)
            
        except Exception as e:
            logger.error(f"Error calculating preference confidence: {e}")
            return 0.3
    
    # Additional helper methods
    
    async def _analyze_current_context(self, context: Dict[str, Any], user_profile: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze current conversation context"""
        # Implementation for context analysis
        return {'context_type': 'general', 'urgency': 'normal'}
    
    async def _score_coaching_styles(self, preferences: Dict[str, Any], 
                                   context_analysis: Dict[str, Any], 
                                   user_profile: Dict[str, Any]) -> Dict[str, float]:
        """Score coaching styles based on preferences and context"""
        # Implementation for style scoring
        return {'motivational': 0.8, 'analytical': 0.6, 'educational': 0.7, 'supportive': 0.9, 'challenging': 0.5}
    
    async def _select_optimal_style(self, style_scores: Dict[str, float], 
                                  context_analysis: Dict[str, Any]) -> str:
        """Select optimal coaching style"""
        return max(style_scores.items(), key=lambda x: x[1])[0]
    
    async def _generate_style_recommendations(self, optimal_style: str, 
                                            preferences: Dict[str, Any], 
                                            context_analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Generate style-specific recommendations"""
        # Implementation for style recommendations
        return {'recommendations': f'Use {optimal_style} coaching style'}
    
    async def _generate_adaptation_reasoning(self, optimal_style: str, 
                                           preferences: Dict[str, Any], 
                                           context_analysis: Dict[str, Any]) -> str:
        """Generate reasoning for style adaptation"""
        # Implementation for adaptation reasoning
        return f'Selected {optimal_style} style based on user preferences'
    
    async def _analyze_feedback_content(self, feedback_content: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze feedback content"""
        # Implementation for feedback analysis
        return {'sentiment': 'positive', 'key_points': []}
    
    async def _generate_preference_updates(self, feedback_analysis: Dict[str, Any], 
                                         feedback_type: str, 
                                         context: Dict[str, Any]) -> Dict[str, Any]:
        """Generate preference updates based on feedback"""
        # Implementation for preference updates
        return {'updates': []}
    
    async def _update_user_preferences(self, user_id: str, preference_updates: Dict[str, Any]) -> bool:
        """Update user preferences in storage"""
        # Implementation for preference updates
        return True
