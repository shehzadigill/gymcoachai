import os
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional
import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

class ConversationService:
    """Service for managing AI conversation history"""
    
    def __init__(self, dynamodb_table_name: str):
        self.dynamodb = boto3.resource('dynamodb')
        self.table = self.dynamodb.Table(dynamodb_table_name)
        self.conversation_ttl_days = int(os.environ.get('CONVERSATION_TTL_DAYS', '30'))
    
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
