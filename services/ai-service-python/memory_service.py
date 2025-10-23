import os
import json
import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timezone, timedelta
import asyncio
from collections import defaultdict, deque
import statistics

from user_data_service import UserDataService
from bedrock_service import BedrockService

logger = logging.getLogger(__name__)

class MemoryService:
    """Service for long-term conversation memory and context management"""
    
    def __init__(self):
        self.table_name = os.environ.get('DYNAMODB_TABLE', 'gymcoach-ai-main')
        self.user_data_service = UserDataService(self.table_name)
        self.bedrock_service = BedrockService()
        
        # Memory configuration
        self.max_conversation_length = 50  # Maximum messages per conversation
        self.max_memory_items = 100  # Maximum memory items per user
        self.memory_retention_days = 90  # Days to retain memories
        self.summarization_threshold = 20  # Messages before summarization
        
        # Memory types and their importance weights
        self.memory_types = {
            'goal': 1.0,  # User goals and objectives
            'preference': 0.9,  # User preferences and dislikes
            'achievement': 0.8,  # User achievements and milestones
            'challenge': 0.7,  # Challenges and obstacles
            'feedback': 0.6,  # User feedback and responses
            'pattern': 0.5,  # Behavioral patterns
            'context': 0.4,  # General context
            'temporary': 0.1  # Temporary information
        }
        
    async def store_conversation_memory(self, user_id: str, conversation_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Store conversation data and extract important memories
        
        Args:
            user_id: User ID
            conversation_data: Conversation data including messages and context
            
        Returns:
            Dictionary with stored memory information
        """
        try:
            logger.info(f"Storing conversation memory for user {user_id}")
            
            # Extract conversation context
            messages = conversation_data.get('messages', [])
            context = conversation_data.get('context', {})
            
            if not messages:
                return {'status': 'no_messages', 'message': 'No messages to store'}
            
            # Get existing conversation history
            existing_conversation = await self._get_conversation_history(user_id)
            
            # Add new messages to conversation
            updated_conversation = await self._add_messages_to_conversation(
                existing_conversation, messages, context
            )
            
            # Check if summarization is needed
            if len(updated_conversation.get('messages', [])) > self.summarization_threshold:
                # Summarize older messages
                summarized_conversation = await self._summarize_conversation(updated_conversation)
                updated_conversation = summarized_conversation
            
            # Extract important memories from conversation
            memories = await self._extract_memories_from_conversation(
                user_id, updated_conversation
            )
            
            # Store updated conversation
            await self._store_conversation_history(user_id, updated_conversation)
            
            # Store new memories
            stored_memories = []
            for memory in memories:
                memory_id = await self._store_memory(user_id, memory)
                if memory_id:
                    stored_memories.append(memory_id)
            
            return {
                'user_id': user_id,
                'conversation_stored': True,
                'messages_count': len(updated_conversation.get('messages', [])),
                'memories_extracted': len(memories),
                'memories_stored': len(stored_memories),
                'summarized': len(updated_conversation.get('messages', [])) < len(messages),
                'timestamp': datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error storing conversation memory for user {user_id}: {e}")
            return {'error': str(e)}
    
    async def retrieve_relevant_memories(self, user_id: str, query: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Retrieve relevant memories based on query and context
        
        Args:
            user_id: User ID
            query: Query to find relevant memories
            context: Current conversation context
            
        Returns:
            Dictionary with relevant memories
        """
        try:
            logger.info(f"Retrieving relevant memories for user {user_id}")
            
            # Get user's memories
            memories = await self._get_user_memories(user_id)
            
            if not memories:
                return {'status': 'no_memories', 'memories': []}
            
            # Score memories based on relevance
            scored_memories = await self._score_memories_relevance(memories, query, context)
            
            # Filter and rank memories
            relevant_memories = await self._filter_and_rank_memories(scored_memories)
            
            # Format memories for use
            formatted_memories = await self._format_memories_for_context(relevant_memories)
            
            return {
                'user_id': user_id,
                'query': query,
                'total_memories': len(memories),
                'relevant_memories': len(relevant_memories),
                'memories': formatted_memories,
                'retrieval_timestamp': datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error retrieving memories for user {user_id}: {e}")
            return {'error': str(e)}
    
    async def update_memory_importance(self, user_id: str, memory_id: str, importance_score: float) -> Dict[str, Any]:
        """
        Update the importance score of a memory based on user interaction
        
        Args:
            user_id: User ID
            memory_id: Memory ID to update
            importance_score: New importance score (0.0 to 1.0)
            
        Returns:
            Dictionary with update result
        """
        try:
            logger.info(f"Updating memory importance for user {user_id}, memory {memory_id}")
            
            # Get existing memory
            memory = await self._get_memory(user_id, memory_id)
            
            if not memory:
                return {'error': 'Memory not found'}
            
            # Update importance score
            memory['importance_score'] = importance_score
            memory['last_accessed'] = datetime.now(timezone.utc).isoformat()
            memory['access_count'] = memory.get('access_count', 0) + 1
            
            # Store updated memory
            await self._store_memory(user_id, memory, memory_id)
            
            return {
                'user_id': user_id,
                'memory_id': memory_id,
                'updated_importance': importance_score,
                'access_count': memory['access_count'],
                'update_timestamp': datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error updating memory importance for user {user_id}: {e}")
            return {'error': str(e)}
    
    async def cleanup_old_memories(self, user_id: str) -> Dict[str, Any]:
        """
        Clean up old and low-importance memories
        
        Args:
            user_id: User ID
            
        Returns:
            Dictionary with cleanup results
        """
        try:
            logger.info(f"Cleaning up old memories for user {user_id}")
            
            # Get all user memories
            memories = await self._get_user_memories(user_id)
            
            if not memories:
                return {'status': 'no_memories', 'cleaned': 0}
            
            # Identify memories to clean up
            memories_to_remove = []
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=self.memory_retention_days)
            
            for memory in memories:
                memory_date = datetime.fromisoformat(memory.get('created_at', '').replace('Z', '+00:00'))
                
                # Remove old memories or very low importance memories
                if (memory_date < cutoff_date or 
                    memory.get('importance_score', 0) < 0.1 or
                    memory.get('access_count', 0) == 0):
                    memories_to_remove.append(memory['memory_id'])
            
            # Remove identified memories
            removed_count = 0
            for memory_id in memories_to_remove:
                if await self._remove_memory(user_id, memory_id):
                    removed_count += 1
            
            return {
                'user_id': user_id,
                'total_memories': len(memories),
                'memories_removed': removed_count,
                'cleanup_timestamp': datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error cleaning up memories for user {user_id}: {e}")
            return {'error': str(e)}
    
    async def get_memory_summary(self, user_id: str) -> Dict[str, Any]:
        """
        Get a summary of user's memory profile
        
        Args:
            user_id: User ID
            
        Returns:
            Dictionary with memory summary
        """
        try:
            logger.info(f"Getting memory summary for user {user_id}")
            
            # Get user memories
            memories = await self._get_user_memories(user_id)
            
            if not memories:
                return {'status': 'no_memories', 'summary': {}}
            
            # Analyze memory patterns
            memory_analysis = await self._analyze_memory_patterns(memories)
            
            # Generate AI-powered summary
            ai_summary = await self._generate_memory_summary(memories, memory_analysis)
            
            return {
                'user_id': user_id,
                'total_memories': len(memories),
                'memory_analysis': memory_analysis,
                'ai_summary': ai_summary,
                'summary_timestamp': datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting memory summary for user {user_id}: {e}")
            return {'error': str(e)}
    
    # Helper methods for memory management
    
    async def _get_conversation_history(self, user_id: str) -> Dict[str, Any]:
        """Get user's conversation history"""
        try:
            # Get conversation data from DynamoDB
            conversation_data = await self.user_data_service.get_user_data(
                user_id, 'conversation_history'
            )
            
            if conversation_data:
                return conversation_data
            else:
                return {
                    'user_id': user_id,
                    'messages': [],
                    'summaries': [],
                    'created_at': datetime.now(timezone.utc).isoformat(),
                    'last_updated': datetime.now(timezone.utc).isoformat()
                }
                
        except Exception as e:
            logger.error(f"Error getting conversation history for user {user_id}: {e}")
            return {'messages': [], 'summaries': []}
    
    async def _add_messages_to_conversation(self, conversation: Dict[str, Any], 
                                         new_messages: List[Dict[str, Any]], 
                                         context: Dict[str, Any]) -> Dict[str, Any]:
        """Add new messages to conversation history"""
        try:
            updated_conversation = conversation.copy()
            
            # Add new messages with context
            for message in new_messages:
                message_with_context = {
                    **message,
                    'context': context,
                    'timestamp': datetime.now(timezone.utc).isoformat()
                }
                updated_conversation['messages'].append(message_with_context)
            
            # Limit conversation length
            if len(updated_conversation['messages']) > self.max_conversation_length:
                # Keep most recent messages
                updated_conversation['messages'] = updated_conversation['messages'][-self.max_conversation_length:]
            
            updated_conversation['last_updated'] = datetime.now(timezone.utc).isoformat()
            
            return updated_conversation
            
        except Exception as e:
            logger.error(f"Error adding messages to conversation: {e}")
            return conversation
    
    async def _summarize_conversation(self, conversation: Dict[str, Any]) -> Dict[str, Any]:
        """Summarize older conversation messages using AI"""
        try:
            messages = conversation.get('messages', [])
            
            if len(messages) <= self.summarization_threshold:
                return conversation
            
            # Split messages into old and recent
            old_messages = messages[:-self.summarization_threshold//2]
            recent_messages = messages[-self.summarization_threshold//2:]
            
            # Generate summary of old messages
            summary_prompt = f"""
            Summarize this conversation between a fitness coach and user, focusing on:
            1. Key topics discussed
            2. User goals and preferences mentioned
            3. Important decisions or commitments made
            4. Challenges or obstacles identified
            5. Achievements or progress noted
            
            Conversation messages:
            {json.dumps(old_messages, indent=2)}
            
            Provide a concise summary that captures the essential information for future reference.
            """
            
            bedrock_result = self.bedrock_service.invoke_bedrock(
                summary_prompt,
                {'conversation': old_messages},
                max_tokens=300
            )
            
            if bedrock_result['success']:
                # Create summarized conversation
                summarized_conversation = conversation.copy()
                summarized_conversation['messages'] = recent_messages
                summarized_conversation['summaries'] = summarized_conversation.get('summaries', [])
                summarized_conversation['summaries'].append({
                    'summary': bedrock_result['response'],
                    'message_count': len(old_messages),
                    'created_at': datetime.now(timezone.utc).isoformat()
                })
                
                return summarized_conversation
            else:
                # If summarization fails, just truncate
                return self._truncate_conversation(conversation)
                
        except Exception as e:
            logger.error(f"Error summarizing conversation: {e}")
            return self._truncate_conversation(conversation)
    
    def _truncate_conversation(self, conversation: Dict[str, Any]) -> Dict[str, Any]:
        """Truncate conversation to recent messages"""
        try:
            messages = conversation.get('messages', [])
            if len(messages) > self.max_conversation_length:
                conversation['messages'] = messages[-self.max_conversation_length:]
                conversation['last_updated'] = datetime.now(timezone.utc).isoformat()
            
            return conversation
            
        except Exception as e:
            logger.error(f"Error truncating conversation: {e}")
            return conversation
    
    async def _extract_memories_from_conversation(self, user_id: str, conversation: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract important memories from conversation using AI"""
        try:
            messages = conversation.get('messages', [])
            summaries = conversation.get('summaries', [])
            
            if not messages and not summaries:
                return []
            
            # Create extraction prompt
            extraction_prompt = f"""
            Extract important memories from this fitness coaching conversation. 
            Focus on information that would be valuable for future coaching sessions.
            
            Look for:
            1. User goals and objectives
            2. Preferences and dislikes
            3. Achievements and milestones
            4. Challenges and obstacles
            5. Important decisions or commitments
            6. Behavioral patterns
            7. Feedback and responses
            
            Conversation summaries:
            {json.dumps(summaries, indent=2)}
            
            Recent messages:
            {json.dumps(messages[-10:], indent=2)}  # Last 10 messages
            
            For each memory, provide:
            - type: goal, preference, achievement, challenge, feedback, pattern, context, temporary
            - content: The actual memory content
            - importance: 0.0 to 1.0 based on significance
            - context: Additional context about when/why this is important
            
            Return as JSON array of memory objects.
            """
            
            bedrock_result = self.bedrock_service.invoke_bedrock(
                extraction_prompt,
                {'conversation': conversation},
                max_tokens=500
            )
            
            if bedrock_result['success']:
                try:
                    # Parse AI response as JSON
                    memories_data = json.loads(bedrock_result['response'])
                    
                    # Process and validate memories
                    processed_memories = []
                    for memory_data in memories_data:
                        if isinstance(memory_data, dict) and 'content' in memory_data:
                            memory = {
                                'user_id': user_id,
                                'memory_id': f"mem_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{len(processed_memories)}",
                                'type': memory_data.get('type', 'context'),
                                'content': memory_data['content'],
                                'importance_score': memory_data.get('importance', 0.5),
                                'context': memory_data.get('context', ''),
                                'created_at': datetime.now(timezone.utc).isoformat(),
                                'last_accessed': datetime.now(timezone.utc).isoformat(),
                                'access_count': 0
                            }
                            processed_memories.append(memory)
                    
                    return processed_memories
                    
                except json.JSONDecodeError:
                    logger.warning("Failed to parse AI memory extraction response as JSON")
                    return []
            else:
                logger.warning("Failed to extract memories using AI")
                return []
                
        except Exception as e:
            logger.error(f"Error extracting memories from conversation: {e}")
            return []
    
    async def _store_conversation_history(self, user_id: str, conversation: Dict[str, Any]) -> bool:
        """Store conversation history in DynamoDB"""
        try:
            await self.user_data_service.update_user_data(
                user_id, 'conversation_history', conversation
            )
            return True
            
        except Exception as e:
            logger.error(f"Error storing conversation history for user {user_id}: {e}")
            return False
    
    async def _store_memory(self, user_id: str, memory: Dict[str, Any], memory_id: Optional[str] = None) -> Optional[str]:
        """Store a memory in DynamoDB"""
        try:
            if not memory_id:
                memory_id = memory.get('memory_id', f"mem_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
            
            memory['memory_id'] = memory_id
            
            # Store in user's memory collection
            await self.user_data_service.update_user_data(
                user_id, f'memory_{memory_id}', memory
            )
            
            return memory_id
            
        except Exception as e:
            logger.error(f"Error storing memory for user {user_id}: {e}")
            return None
    
    async def _get_user_memories(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all memories for a user"""
        try:
            # Get user data and find memory items
            user_data = await self.user_data_service.get_user_data(user_id)
            
            memories = []
            for key, value in user_data.items():
                if key.startswith('memory_') and isinstance(value, dict):
                    memories.append(value)
            
            # Sort by creation date (newest first)
            memories.sort(key=lambda x: x.get('created_at', ''), reverse=True)
            
            return memories
            
        except Exception as e:
            logger.error(f"Error getting memories for user {user_id}: {e}")
            return []
    
    async def _get_memory(self, user_id: str, memory_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific memory"""
        try:
            memory = await self.user_data_service.get_user_data(user_id, f'memory_{memory_id}')
            return memory
            
        except Exception as e:
            logger.error(f"Error getting memory {memory_id} for user {user_id}: {e}")
            return None
    
    async def _remove_memory(self, user_id: str, memory_id: str) -> bool:
        """Remove a memory"""
        try:
            await self.user_data_service.delete_user_data(user_id, f'memory_{memory_id}')
            return True
            
        except Exception as e:
            logger.error(f"Error removing memory {memory_id} for user {user_id}: {e}")
            return False
    
    async def _score_memories_relevance(self, memories: List[Dict[str, Any]], 
                                      query: str, context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Score memories based on relevance to query and context"""
        try:
            scored_memories = []
            
            for memory in memories:
                # Calculate relevance score
                relevance_score = await self._calculate_memory_relevance(memory, query, context)
                
                scored_memory = memory.copy()
                scored_memory['relevance_score'] = relevance_score
                scored_memories.append(scored_memory)
            
            return scored_memories
            
        except Exception as e:
            logger.error(f"Error scoring memories relevance: {e}")
            return memories
    
    async def _calculate_memory_relevance(self, memory: Dict[str, Any], 
                                        query: str, context: Dict[str, Any]) -> float:
        """Calculate relevance score for a memory"""
        try:
            score = 0.0
            
            # Base importance score
            importance = memory.get('importance_score', 0.5)
            score += importance * 0.4
            
            # Memory type weight
            memory_type = memory.get('type', 'context')
            type_weight = self.memory_types.get(memory_type, 0.4)
            score += type_weight * 0.3
            
            # Recency factor
            created_at = memory.get('created_at', '')
            if created_at:
                try:
                    memory_date = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    days_old = (datetime.now(timezone.utc) - memory_date).days
                    recency_factor = max(0.1, 1.0 - (days_old / 90))  # Decay over 90 days
                    score += recency_factor * 0.2
                except ValueError:
                    pass
            
            # Access count factor
            access_count = memory.get('access_count', 0)
            access_factor = min(1.0, access_count / 10)  # Cap at 10 accesses
            score += access_factor * 0.1
            
            return min(1.0, score)
            
        except Exception as e:
            logger.error(f"Error calculating memory relevance: {e}")
            return 0.5
    
    async def _filter_and_rank_memories(self, scored_memories: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Filter and rank memories by relevance"""
        try:
            # Filter memories with minimum relevance score
            relevant_memories = [
                mem for mem in scored_memories 
                if mem.get('relevance_score', 0) > 0.3
            ]
            
            # Sort by relevance score (highest first)
            relevant_memories.sort(key=lambda x: x.get('relevance_score', 0), reverse=True)
            
            # Limit to top memories
            return relevant_memories[:10]  # Top 10 most relevant memories
            
        except Exception as e:
            logger.error(f"Error filtering and ranking memories: {e}")
            return scored_memories[:10]
    
    async def _format_memories_for_context(self, memories: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Format memories for use in AI context"""
        try:
            formatted_memories = []
            
            for memory in memories:
                formatted_memory = {
                    'type': memory.get('type', 'context'),
                    'content': memory.get('content', ''),
                    'context': memory.get('context', ''),
                    'importance': memory.get('importance_score', 0.5),
                    'created_at': memory.get('created_at', ''),
                    'relevance_score': memory.get('relevance_score', 0.5)
                }
                formatted_memories.append(formatted_memory)
            
            return formatted_memories
            
        except Exception as e:
            logger.error(f"Error formatting memories for context: {e}")
            return []
    
    async def _analyze_memory_patterns(self, memories: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze patterns in user's memories"""
        try:
            if not memories:
                return {}
            
            # Count by memory type
            type_counts = defaultdict(int)
            importance_scores = []
            access_counts = []
            
            for memory in memories:
                memory_type = memory.get('type', 'context')
                type_counts[memory_type] += 1
                
                importance_scores.append(memory.get('importance_score', 0.5))
                access_counts.append(memory.get('access_count', 0))
            
            # Calculate statistics
            analysis = {
                'total_memories': len(memories),
                'memory_types': dict(type_counts),
                'avg_importance': statistics.mean(importance_scores) if importance_scores else 0,
                'avg_access_count': statistics.mean(access_counts) if access_counts else 0,
                'most_common_type': max(type_counts.items(), key=lambda x: x[1])[0] if type_counts else 'context',
                'high_importance_count': len([s for s in importance_scores if s > 0.7]),
                'frequently_accessed': len([c for c in access_counts if c > 5])
            }
            
            return analysis
            
        except Exception as e:
            logger.error(f"Error analyzing memory patterns: {e}")
            return {}
    
    async def _generate_memory_summary(self, memories: List[Dict[str, Any]], 
                                     analysis: Dict[str, Any]) -> str:
        """Generate AI-powered memory summary"""
        try:
            if not memories:
                return "No memories available for this user."
            
            # Create summary prompt
            summary_prompt = f"""
            Generate a comprehensive summary of this user's memory profile based on their fitness coaching conversations.
            
            Memory Analysis:
            {json.dumps(analysis, indent=2)}
            
            Sample Memories (most important):
            {json.dumps(memories[:5], indent=2)}
            
            Provide insights about:
            1. User's primary goals and objectives
            2. Key preferences and patterns
            3. Important achievements and milestones
            4. Ongoing challenges or obstacles
            5. Coaching style preferences
            6. Areas for improvement or focus
            
            Keep the summary concise but comprehensive for coaching purposes.
            """
            
            bedrock_result = self.bedrock_service.invoke_bedrock(
                summary_prompt,
                {'memories': memories, 'analysis': analysis},
                max_tokens=400
            )
            
            if bedrock_result['success']:
                return bedrock_result['response']
            else:
                return "Memory summary generation failed."
                
        except Exception as e:
            logger.error(f"Error generating memory summary: {e}")
            return "Error generating memory summary."
