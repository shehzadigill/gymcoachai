import os
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
import boto3
from botocore.exceptions import ClientError
import asyncio
from collections import defaultdict, deque

from bedrock_service import BedrockService
from memory_service import MemoryService

logger = logging.getLogger(__name__)

class ConversationService:
    """Service for managing AI conversation history"""
    
    def __init__(self, dynamodb_table_name: str):
        self.dynamodb = boto3.resource('dynamodb')
        self.table = self.dynamodb.Table(dynamodb_table_name)
        self.conversation_ttl_days = int(os.environ.get('CONVERSATION_TTL_DAYS', '30'))
        
        # Enhanced conversation management
        self.bedrock_service = BedrockService()
        self.memory_service = MemoryService()
        
        # Conversation threading and summarization
        self.summarization_threshold = 20  # Messages before summarization
        self.max_thread_depth = 5  # Maximum thread depth
        self.context_window_size = 10  # Messages to keep in context
    
    async def save_message(self, user_id: str, conversation_id: str, role: str, content: str, 
                          tokens_used: int = 0, model: str = '') -> bool:
        """
        Save a message to conversation history
        
        Args:
            user_id: User ID
            conversation_id: Conversation ID
            role: 'user' or 'assistant'
            content: Message content
            tokens_used: Number of tokens used
            model: Model used for generation
            
        Returns:
            True if successful, False otherwise
        """
        try:
            timestamp = datetime.now(timezone.utc).isoformat()
            pk = f"USER#{user_id}"
            sk = f"CONVERSATION#{timestamp}"
            
            # Calculate TTL (30 days from now)
            ttl = int((datetime.now(timezone.utc) + timedelta(days=self.conversation_ttl_days)).timestamp())
            
            item = {
                'PK': pk,
                'SK': sk,
                'conversationId': conversation_id,
                'role': role,
                'content': content,
                'tokens': tokens_used,
                'model': model,
                'createdAt': timestamp,
                'ttl': ttl
            }
            
            self.table.put_item(Item=item)
            logger.info(f"Saved message for user {user_id} in conversation {conversation_id}")
            return True
            
        except ClientError as e:
            logger.error(f"Error saving message for user {user_id}: {e}")
            return False
    
    async def get_conversation_history(self, user_id: str, conversation_id: Optional[str] = None, 
                                     limit: int = 10) -> List[Dict]:
        """
        Get conversation history for a user
        
        Args:
            user_id: User ID
            conversation_id: Specific conversation ID (optional)
            limit: Maximum number of messages to return
            
        Returns:
            List of message dictionaries
        """
        try:
            pk = f"USER#{user_id}"
            
            if conversation_id:
                # Get specific conversation
                response = self.table.query(
                    KeyConditionExpression='PK = :pk AND begins_with(SK, :sk)',
                    FilterExpression='conversationId = :conversation_id',
                    ExpressionAttributeValues={
                        ':pk': pk,
                        ':sk': 'CONVERSATION#',
                        ':conversation_id': conversation_id
                    },
                    ScanIndexForward=False,  # Most recent first
                    Limit=limit
                )
            else:
                # Get recent messages across all conversations
                response = self.table.query(
                    KeyConditionExpression='PK = :pk AND begins_with(SK, :sk)',
                    ExpressionAttributeValues={
                        ':pk': pk,
                        ':sk': 'CONVERSATION#'
                    },
                    ScanIndexForward=False,  # Most recent first
                    Limit=limit
                )
            
            messages = []
            for item in response.get('Items', []):
                messages.append({
                    'conversationId': item.get('conversationId', ''),
                    'role': item.get('role', ''),
                    'content': item.get('content', ''),
                    'tokens': item.get('tokens', 0),
                    'model': item.get('model', ''),
                    'createdAt': item.get('createdAt', ''),
                    'timestamp': item.get('SK', '').replace('CONVERSATION#', ''),
                    'title': item.get('title', '')  # Include title field
                })
            
            # Sort by timestamp (oldest first for context)
            messages.sort(key=lambda x: x['timestamp'])
            
            return messages
            
        except ClientError as e:
            logger.error(f"Error getting conversation history for user {user_id}: {e}")
            return []
    
    async def get_conversations(self, user_id: str, limit: int = 20) -> List[Dict]:
        """
        Get list of conversations for a user
        
        Args:
            user_id: User ID
            limit: Maximum number of conversations to return
            
        Returns:
            List of conversation summaries
        """
        try:
            pk = f"USER#{user_id}"
            
            response = self.table.query(
                KeyConditionExpression='PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues={
                    ':pk': pk,
                    ':sk': 'CONVERSATION#'
                },
                ScanIndexForward=False,  # Most recent first
                Limit=limit * 2  # Get more to account for multiple messages per conversation
            )
            
            # First pass: collect all messages by conversation
            conversation_messages = {}
            for item in response.get('Items', []):
                conv_id = item.get('conversationId', '')
                if conv_id not in conversation_messages:
                    conversation_messages[conv_id] = []
                conversation_messages[conv_id].append(item)
            
            # Second pass: process each conversation
            conversations = {}
            for conv_id, messages in conversation_messages.items():
                # Sort messages by timestamp (oldest first)
                messages.sort(key=lambda x: x.get('createdAt', ''))
                
                # Find first user message for title
                first_user_message = ''
                conversation_title = None
                for msg in messages:
                    if msg.get('role') == 'user':
                        first_user_message = msg.get('content', '')
                        # Check if this message has a custom title
                        if msg.get('title'):
                            conversation_title = msg.get('title')
                            logger.info(f"Found custom title for conversation {conv_id}: {conversation_title}")
                        break
                
                # Get last message time
                last_message_time = max(msg.get('createdAt', '') for msg in messages)
                
                # Calculate totals
                total_tokens = sum(msg.get('tokens', 0) for msg in messages)
                
                conversations[conv_id] = {
                    'conversationId': conv_id,
                    'firstMessage': first_user_message,
                    'lastMessageAt': last_message_time,
                    'messageCount': len(messages),
                    'totalTokens': total_tokens,
                    'title': conversation_title  # Use custom title if available
                }
            
            # Convert to list and sort by last message time
            conversation_list = list(conversations.values())
            conversation_list.sort(key=lambda x: x['lastMessageAt'], reverse=True)
            
            return conversation_list[:limit]
            
        except ClientError as e:
            logger.error(f"Error getting conversations for user {user_id}: {e}")
            return []
    
    async def update_conversation_title(self, user_id: str, conversation_id: str, title: str) -> bool:
        """
        Update conversation title
        
        Args:
            user_id: User ID
            conversation_id: Conversation ID
            title: New title for the conversation
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Find all messages in this conversation
            pk = f"USER#{user_id}"
            
            response = self.table.query(
                KeyConditionExpression='PK = :pk',
                FilterExpression='conversationId = :conv_id',
                ExpressionAttributeValues={
                    ':pk': pk,
                    ':conv_id': conversation_id
                }
            )
            
            if not response['Items']:
                logger.warning(f"No conversation found with ID {conversation_id} for user {user_id}")
                return False
            
            # Update the first message with the title
            first_message = min(response['Items'], key=lambda x: x.get('createdAt', ''))
            
            logger.info(f"Updating title for message PK: {first_message['PK']}, SK: {first_message['SK']}")
            
            self.table.update_item(
                Key={
                    'PK': first_message['PK'],
                    'SK': first_message['SK']
                },
                UpdateExpression='SET title = :title',
                ExpressionAttributeValues={
                    ':title': title
                }
            )
            
            logger.info(f"Updated conversation title for user {user_id}, conversation {conversation_id}")
            return True
            
        except ClientError as e:
            logger.error(f"Error updating conversation title for user {user_id}: {e}")
            return False
    
    async def delete_conversation(self, user_id: str, conversation_id: str) -> bool:
        """
        Delete a specific conversation
        
        Args:
            user_id: User ID
            conversation_id: Conversation ID to delete
            
        Returns:
            True if successful, False otherwise
        """
        try:
            pk = f"USER#{user_id}"
            
            # Get all messages in the conversation
            response = self.table.query(
                KeyConditionExpression='PK = :pk AND begins_with(SK, :sk)',
                FilterExpression='conversationId = :conversation_id',
                ExpressionAttributeValues={
                    ':pk': pk,
                    ':sk': 'CONVERSATION#',
                    ':conversation_id': conversation_id
                }
            )
            
            # Delete each message
            with self.table.batch_writer() as batch:
                for item in response.get('Items', []):
                    batch.delete_item(
                        Key={'PK': item['PK'], 'SK': item['SK']}
                    )
            
            logger.info(f"Deleted conversation {conversation_id} for user {user_id}")
            return True
            
        except ClientError as e:
            logger.error(f"Error deleting conversation {conversation_id} for user {user_id}: {e}")
            return False
    
    async def build_conversation_context(self, user_id: str, conversation_id: Optional[str] = None, 
                                       max_messages: int = 5) -> str:
        """
        Build conversation context for AI prompts
        
        Args:
            user_id: User ID
            conversation_id: Specific conversation ID (optional)
            max_messages: Maximum number of recent messages to include
            
        Returns:
            Formatted conversation context string
        """
        try:
            messages = await self.get_conversation_history(user_id, conversation_id, max_messages)
            
            if not messages:
                return ""
            
            context_parts = ["Recent conversation:"]
            for message in messages[-max_messages:]:  # Get last N messages
                role = "User" if message['role'] == 'user' else "Assistant"
                context_parts.append(f"{role}: {message['content']}")
            
            return '\n'.join(context_parts)
            
        except Exception as e:
            logger.error(f"Error building conversation context for user {user_id}: {e}")
            return ""
    
    async def get_conversation_stats(self, user_id: str) -> Dict:
        """
        Get conversation statistics for a user
        
        Args:
            user_id: User ID
            
        Returns:
            Dictionary with conversation statistics
        """
        try:
            pk = f"USER#{user_id}"
            
            response = self.table.query(
                KeyConditionExpression='PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues={
                    ':pk': pk,
                    ':sk': 'CONVERSATION#'
                }
            )
            
            total_messages = len(response.get('Items', []))
            total_tokens = sum(item.get('tokens', 0) for item in response.get('Items', []))
            
            # Count unique conversations
            conversations = set()
            for item in response.get('Items', []):
                conversations.add(item.get('conversationId', ''))
            
            return {
                'totalMessages': total_messages,
                'totalConversations': len(conversations),
                'totalTokens': total_tokens,
                'averageTokensPerMessage': total_tokens / max(total_messages, 1)
            }
            
        except ClientError as e:
            logger.error(f"Error getting conversation stats for user {user_id}: {e}")
            return {
                'totalMessages': 0,
                'totalConversations': 0,
                'totalTokens': 0,
                'averageTokensPerMessage': 0
            }
    
    # Enhanced conversation management methods
    
    async def create_conversation_thread(self, user_id: str, conversation_id: str, 
                                       thread_topic: str) -> Dict[str, Any]:
        """
        Create a new conversation thread for topic organization
        
        Args:
            user_id: User ID
            conversation_id: Parent conversation ID
            thread_topic: Topic for the thread
            
        Returns:
            Dictionary with thread information
        """
        try:
            thread_id = f"{conversation_id}_thread_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            
            thread_data = {
                'threadId': thread_id,
                'parentConversationId': conversation_id,
                'topic': thread_topic,
                'createdAt': datetime.now(timezone.utc).isoformat(),
                'messageCount': 0,
                'lastActivity': datetime.now(timezone.utc).isoformat()
            }
            
            # Store thread metadata
            pk = f"USER#{user_id}"
            sk = f"THREAD#{thread_id}"
            
            self.table.put_item(Item={
                'PK': pk,
                'SK': sk,
                **thread_data,
                'ttl': int((datetime.now(timezone.utc) + timedelta(days=self.conversation_ttl_days)).timestamp())
            })
            
            logger.info(f"Created conversation thread {thread_id} for user {user_id}")
            
            return {
                'success': True,
                'threadId': thread_id,
                'threadData': thread_data
            }
            
        except Exception as e:
            logger.error(f"Error creating conversation thread for user {user_id}: {e}")
            return {'success': False, 'error': str(e)}
    
    async def summarize_conversation(self, user_id: str, conversation_id: str) -> Dict[str, Any]:
        """
        Generate AI-powered conversation summary
        
        Args:
            user_id: User ID
            conversation_id: Conversation ID to summarize
            
        Returns:
            Dictionary with summary information
        """
        try:
            # Get conversation messages
            messages = await self.get_conversation_history(user_id, conversation_id, 50)
            
            if not messages:
                return {'error': 'No messages found for conversation'}
            
            # Create summary prompt
            conversation_text = "\n".join([
                f"{'User' if msg['role'] == 'user' else 'Assistant'}: {msg['content']}"
                for msg in messages
            ])
            
            summary_prompt = f"""
            Summarize this fitness coaching conversation, focusing on:
            1. Main topics discussed
            2. User goals and objectives mentioned
            3. Key decisions or commitments made
            4. Progress or achievements noted
            5. Challenges or obstacles identified
            6. Next steps or action items
            
            Conversation:
            {conversation_text}
            
            Provide a concise but comprehensive summary that captures the essential information for future reference.
            """
            
            bedrock_result = self.bedrock_service.invoke_bedrock(
                summary_prompt,
                {'conversation': messages},
                max_tokens=400
            )
            
            if bedrock_result['success']:
                summary = bedrock_result['response']
                
                # Store summary
                summary_id = f"summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                pk = f"USER#{user_id}"
                sk = f"SUMMARY#{summary_id}"
                
                summary_data = {
                    'PK': pk,
                    'SK': sk,
                    'conversationId': conversation_id,
                    'summary': summary,
                    'messageCount': len(messages),
                    'createdAt': datetime.now(timezone.utc).isoformat(),
                    'ttl': int((datetime.now(timezone.utc) + timedelta(days=self.conversation_ttl_days)).timestamp())
                }
                
                self.table.put_item(Item=summary_data)
                
                return {
                    'success': True,
                    'summaryId': summary_id,
                    'summary': summary,
                    'messageCount': len(messages)
                }
            else:
                return {'error': 'Failed to generate summary'}
                
        except Exception as e:
            logger.error(f"Error summarizing conversation for user {user_id}: {e}")
            return {'error': str(e)}
    
    async def get_conversation_summary(self, user_id: str, conversation_id: str) -> Optional[str]:
        """
        Get existing conversation summary
        
        Args:
            user_id: User ID
            conversation_id: Conversation ID
            
        Returns:
            Summary text if found, None otherwise
        """
        try:
            pk = f"USER#{user_id}"
            
            response = self.table.query(
                KeyConditionExpression='PK = :pk AND begins_with(SK, :sk)',
                FilterExpression='conversationId = :conv_id',
                ExpressionAttributeValues={
                    ':pk': pk,
                    ':sk': 'SUMMARY#',
                    ':conv_id': conversation_id
                },
                ScanIndexForward=False,
                Limit=1
            )
            
            if response['Items']:
                return response['Items'][0].get('summary', '')
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting conversation summary for user {user_id}: {e}")
            return None
    
    async def build_enhanced_context(self, user_id: str, conversation_id: Optional[str] = None,
                                   include_memories: bool = True, include_summary: bool = True) -> Dict[str, Any]:
        """
        Build enhanced conversation context with memories and summaries
        
        Args:
            user_id: User ID
            conversation_id: Specific conversation ID (optional)
            include_memories: Whether to include relevant memories
            include_summary: Whether to include conversation summary
            
        Returns:
            Dictionary with enhanced context
        """
        try:
            context = {
                'conversation_context': '',
                'relevant_memories': [],
                'conversation_summary': '',
                'context_metadata': {}
            }
            
            # Get recent conversation messages
            messages = await self.get_conversation_history(user_id, conversation_id, self.context_window_size)
            
            if messages:
                # Build conversation context
                context_parts = ["Recent conversation:"]
                for message in messages[-self.context_window_size:]:
                    role = "User" if message['role'] == 'user' else "Assistant"
                    context_parts.append(f"{role}: {message['content']}")
                
                context['conversation_context'] = '\n'.join(context_parts)
                context['context_metadata']['message_count'] = len(messages)
            
            # Include relevant memories if requested
            if include_memories:
                try:
                    # Get recent user message for memory retrieval
                    recent_user_message = ""
                    for message in reversed(messages):
                        if message['role'] == 'user':
                            recent_user_message = message['content']
                            break
                    
                    if recent_user_message:
                        memory_result = await self.memory_service.retrieve_relevant_memories(
                            user_id, recent_user_message, {'conversation_id': conversation_id}
                        )
                        
                        if 'memories' in memory_result:
                            context['relevant_memories'] = memory_result['memories']
                            context['context_metadata']['memory_count'] = len(memory_result['memories'])
                except Exception as e:
                    logger.warning(f"Error retrieving memories for context: {e}")
            
            # Include conversation summary if requested
            if include_summary and conversation_id:
                try:
                    summary = await self.get_conversation_summary(user_id, conversation_id)
                    if summary:
                        context['conversation_summary'] = summary
                        context['context_metadata']['has_summary'] = True
                except Exception as e:
                    logger.warning(f"Error getting conversation summary: {e}")
            
            return context
            
        except Exception as e:
            logger.error(f"Error building enhanced context for user {user_id}: {e}")
            return {'conversation_context': '', 'relevant_memories': [], 'conversation_summary': ''}
    
    async def auto_summarize_if_needed(self, user_id: str, conversation_id: str) -> Dict[str, Any]:
        """
        Automatically summarize conversation if it exceeds threshold
        
        Args:
            user_id: User ID
            conversation_id: Conversation ID
            
        Returns:
            Dictionary with summarization result
        """
        try:
            # Get conversation message count
            messages = await self.get_conversation_history(user_id, conversation_id, 100)
            
            if len(messages) >= self.summarization_threshold:
                # Check if summary already exists
                existing_summary = await self.get_conversation_summary(user_id, conversation_id)
                
                if not existing_summary:
                    # Generate new summary
                    summary_result = await self.summarize_conversation(user_id, conversation_id)
                    
                    if summary_result.get('success'):
                        logger.info(f"Auto-summarized conversation {conversation_id} for user {user_id}")
                        return {
                            'summarized': True,
                            'summary': summary_result.get('summary', ''),
                            'message_count': len(messages)
                        }
                    else:
                        return {'summarized': False, 'error': summary_result.get('error', 'Unknown error')}
                else:
                    return {'summarized': False, 'reason': 'Summary already exists'}
            else:
                return {'summarized': False, 'reason': f'Only {len(messages)} messages, threshold is {self.summarization_threshold}'}
                
        except Exception as e:
            logger.error(f"Error auto-summarizing conversation for user {user_id}: {e}")
            return {'summarized': False, 'error': str(e)}
    
    async def store_conversation_memory(self, user_id: str, conversation_id: str) -> Dict[str, Any]:
        """
        Store conversation data in memory service for long-term retention
        
        Args:
            user_id: User ID
            conversation_id: Conversation ID
            
        Returns:
            Dictionary with storage result
        """
        try:
            # Get conversation messages
            messages = await self.get_conversation_history(user_id, conversation_id, 50)
            
            if not messages:
                return {'error': 'No messages found for conversation'}
            
            # Prepare conversation data for memory service
            conversation_data = {
                'messages': messages,
                'conversation_id': conversation_id,
                'context': {
                    'conversation_type': 'fitness_coaching',
                    'message_count': len(messages),
                    'last_activity': datetime.now(timezone.utc).isoformat()
                }
            }
            
            # Store in memory service
            memory_result = await self.memory_service.store_conversation_memory(user_id, conversation_data)
            
            return memory_result
            
        except Exception as e:
            logger.error(f"Error storing conversation memory for user {user_id}: {e}")
            return {'error': str(e)}
    
    async def get_conversation_threads(self, user_id: str, conversation_id: str) -> List[Dict[str, Any]]:
        """
        Get all threads for a conversation
        
        Args:
            user_id: User ID
            conversation_id: Parent conversation ID
            
        Returns:
            List of thread information
        """
        try:
            pk = f"USER#{user_id}"
            
            response = self.table.query(
                KeyConditionExpression='PK = :pk AND begins_with(SK, :sk)',
                FilterExpression='parentConversationId = :conv_id',
                ExpressionAttributeValues={
                    ':pk': pk,
                    ':sk': 'THREAD#',
                    ':conv_id': conversation_id
                },
                ScanIndexForward=False
            )
            
            threads = []
            for item in response.get('Items', []):
                threads.append({
                    'threadId': item.get('threadId', ''),
                    'topic': item.get('topic', ''),
                    'createdAt': item.get('createdAt', ''),
                    'messageCount': item.get('messageCount', 0),
                    'lastActivity': item.get('lastActivity', '')
                })
            
            # Sort by last activity (most recent first)
            threads.sort(key=lambda x: x['lastActivity'], reverse=True)
            
            return threads
            
        except Exception as e:
            logger.error(f"Error getting conversation threads for user {user_id}: {e}")
            return []
    
    async def get_conversation_analytics(self, user_id: str, conversation_id: str) -> Dict[str, Any]:
        """
        Get analytics for a specific conversation
        
        Args:
            user_id: User ID
            conversation_id: Conversation ID
            
        Returns:
            Dictionary with conversation analytics
        """
        try:
            # Get conversation messages
            messages = await self.get_conversation_history(user_id, conversation_id, 100)
            
            if not messages:
                return {'error': 'No messages found for conversation'}
            
            # Calculate analytics
            user_messages = [msg for msg in messages if msg['role'] == 'user']
            assistant_messages = [msg for msg in messages if msg['role'] == 'assistant']
            
            total_tokens = sum(msg.get('tokens', 0) for msg in messages)
            avg_message_length = sum(len(msg['content']) for msg in messages) / len(messages)
            
            # Analyze topics (simple keyword analysis)
            all_content = ' '.join([msg['content'].lower() for msg in messages])
            topic_keywords = {
                'workout': ['exercise', 'workout', 'training', 'gym', 'fitness'],
                'nutrition': ['food', 'diet', 'nutrition', 'meal', 'calorie'],
                'progress': ['progress', 'improvement', 'better', 'stronger'],
                'goals': ['goal', 'target', 'objective', 'aim']
            }
            
            topic_counts = {}
            for topic, keywords in topic_keywords.items():
                topic_counts[topic] = sum(all_content.count(keyword) for keyword in keywords)
            
            # Get conversation summary if available
            summary = await self.get_conversation_summary(user_id, conversation_id)
            
            return {
                'conversationId': conversation_id,
                'totalMessages': len(messages),
                'userMessages': len(user_messages),
                'assistantMessages': len(assistant_messages),
                'totalTokens': total_tokens,
                'averageMessageLength': avg_message_length,
                'topicAnalysis': topic_counts,
                'hasSummary': bool(summary),
                'summary': summary,
                'firstMessageAt': messages[0]['createdAt'] if messages else '',
                'lastMessageAt': messages[-1]['createdAt'] if messages else ''
            }
            
        except Exception as e:
            logger.error(f"Error getting conversation analytics for user {user_id}: {e}")
            return {'error': str(e)}
