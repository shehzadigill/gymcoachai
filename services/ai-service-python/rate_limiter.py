import os
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Optional
import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

class RateLimiter:
    """Rate limiter for AI service requests using DynamoDB"""
    
    def __init__(self, dynamodb_table_name: str):
        self.dynamodb = boto3.resource('dynamodb')
        self.table = self.dynamodb.Table(dynamodb_table_name)
        
        # Rate limits from environment variables
        self.free_tier_limit = int(os.environ.get('RATE_LIMIT_FREE_TIER', '10'))
        self.premium_tier_limit = int(os.environ.get('RATE_LIMIT_PREMIUM_TIER', '50'))
        self.hard_limit = int(os.environ.get('RATE_LIMIT_HARD_LIMIT', '100'))
        self.rate_limit_ttl_days = int(os.environ.get('RATE_LIMIT_TTL_DAYS', '7'))
    
    async def check_limit(self, user_id: str, tier: str = 'free') -> Dict[str, any]:
        """
        Check if user has remaining requests for today
        
        Args:
            user_id: User ID to check
            tier: User tier ('free' or 'premium')
            
        Returns:
            Dict with 'allowed', 'remaining', 'reset_at', 'tier' keys
        """
        try:
            today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
            pk = f"RATE_LIMIT#{user_id}"
            sk = f"DATE#{today}"
            
            # Get today's usage
            response = self.table.get_item(
                Key={'PK': pk, 'SK': sk}
            )
            
            if 'Item' in response:
                count = response['Item'].get('count', 0)
                tier = response['Item'].get('tier', 'free')
            else:
                count = 0
            
            # Determine limit based on tier
            limit = self.premium_tier_limit if tier == 'premium' else self.free_tier_limit
            
            # Apply hard limit
            limit = min(limit, self.hard_limit)
            
            remaining = max(0, limit - count)
            allowed = remaining > 0
            
            # Calculate reset time (next day at midnight UTC)
            tomorrow = datetime.now(timezone.utc) + timedelta(days=1)
            reset_at = tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)
            
            return {
                'allowed': allowed,
                'remaining': remaining,
                'reset_at': reset_at.isoformat(),
                'tier': tier,
                'limit': limit,
                'used': count
            }
            
        except ClientError as e:
            logger.error(f"Error checking rate limit for user {user_id}: {e}")
            # Fail open - allow request if we can't check rate limit
            return {
                'allowed': True,
                'remaining': 1,
                'reset_at': (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
                'tier': tier,
                'limit': self.free_tier_limit,
                'used': 0
            }
    
    async def increment_usage(self, user_id: str, tier: str = 'free') -> bool:
        """
        Increment usage count for user
        
        Args:
            user_id: User ID to increment
            tier: User tier ('free' or 'premium')
            
        Returns:
            True if successful, False otherwise
        """
        try:
            today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
            pk = f"RATE_LIMIT#{user_id}"
            sk = f"DATE#{today}"
            
            # Calculate TTL (7 days from now)
            ttl = int((datetime.now(timezone.utc) + timedelta(days=self.rate_limit_ttl_days)).timestamp())
            
            # Atomic increment
            response = self.table.update_item(
                Key={'PK': pk, 'SK': sk},
                UpdateExpression='ADD #count :inc SET #tier = :tier, #lastRequestAt = :now, #ttl = :ttl',
                ExpressionAttributeNames={
                    '#count': 'count',
                    '#tier': 'tier',
                    '#lastRequestAt': 'lastRequestAt',
                    '#ttl': 'ttl'
                },
                ExpressionAttributeValues={
                    ':inc': 1,
                    ':tier': tier,
                    ':now': datetime.now(timezone.utc).isoformat(),
                    ':ttl': ttl
                },
                ReturnValues='UPDATED_NEW'
            )
            
            logger.info(f"Incremented usage for user {user_id}: {response['Attributes']['count']}")
            return True
            
        except ClientError as e:
            logger.error(f"Error incrementing usage for user {user_id}: {e}")
            return False
    
    async def get_user_tier(self, user_id: str) -> str:
        """
        Get user's subscription tier
        
        Args:
            user_id: User ID to check
            
        Returns:
            User tier ('free' or 'premium')
        """
        try:
            # Check user profile for subscription tier
            response = self.table.get_item(
                Key={'PK': f'USER#{user_id}', 'SK': 'PROFILE'}
            )
            
            if 'Item' in response:
                # Check if user has premium subscription
                # This would be based on your subscription logic
                # For now, default to free tier
                return 'free'
            
            return 'free'
            
        except ClientError as e:
            logger.error(f"Error getting user tier for {user_id}: {e}")
            return 'free'
    
    async def reset_daily_usage(self, user_id: str) -> bool:
        """
        Reset daily usage for a user (admin function)
        
        Args:
            user_id: User ID to reset
            
        Returns:
            True if successful, False otherwise
        """
        try:
            today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
            pk = f"RATE_LIMIT#{user_id}"
            sk = f"DATE#{today}"
            
            self.table.delete_item(
                Key={'PK': pk, 'SK': sk}
            )
            
            logger.info(f"Reset daily usage for user {user_id}")
            return True
            
        except ClientError as e:
            logger.error(f"Error resetting usage for user {user_id}: {e}")
            return False
