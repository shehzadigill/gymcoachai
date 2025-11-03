import os
import json
import hashlib
import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timezone, timedelta
import boto3
from botocore.exceptions import ClientError
import zlib
import base64

logger = logging.getLogger(__name__)

class CacheService:
    """
    Intelligent caching service for AI responses using DynamoDB
    
    Features:
    - Hash-based cache keys for deterministic caching
    - TTL-based expiration
    - Context-aware caching
    - Cache invalidation strategies
    - Compression for large responses
    - Hit/miss tracking
    - Cost savings metrics
    """
    
    def __init__(self, table_name: str = None):
        self.dynamodb = boto3.resource('dynamodb')
        self.table_name = table_name or os.environ.get('DYNAMODB_TABLE', 'gymcoach-ai-main')
        self.table = self.dynamodb.Table(self.table_name)
        
        # Cache configuration
        self.enabled = os.environ.get('CACHE_ENABLED', 'true').lower() == 'true'
        self.compression_enabled = True
        self.compression_threshold = 1000  # bytes
        
        # TTL configuration by endpoint type (in seconds)
        self.ttl_config = {
            'chat': 3600,                    # 1 hour
            'workout-plan': 86400,           # 24 hours
            'meal-plan': 86400,              # 24 hours
            'progress-analysis': 1800,       # 30 minutes
            'form-check': 7200,              # 2 hours
            'motivation': 3600,              # 1 hour
            'nutrition-analysis': 3600,      # 1 hour
            'macro-calculation': 86400,      # 24 hours
            'workout-adaptation': 7200,      # 2 hours
            'exercise-substitution': 43200,  # 12 hours
            'performance-analysis': 3600,    # 1 hour
            'personalization': 7200,         # 2 hours
            'memory': 1800,                  # 30 minutes
            'default': 3600                  # 1 hour default
        }
        
        # Cache statistics (in-memory for current Lambda execution)
        self.stats = {
            'hits': 0,
            'misses': 0,
            'writes': 0,
            'invalidations': 0,
            'errors': 0
        }
        
        # In-memory cache for hot data (most recent 50 items per Lambda instance)
        self.hot_cache = {}
        self.hot_cache_max_size = 50
        
    def generate_cache_key(self, 
                          user_id: str, 
                          prompt: str, 
                          context: Dict[str, Any], 
                          endpoint_type: str,
                          model_id: str = None) -> str:
        """
        Generate deterministic cache key from request parameters
        
        Args:
            user_id: User ID
            prompt: AI prompt
            context: User context dictionary
            endpoint_type: Type of endpoint (chat, workout-plan, etc.)
            model_id: Model identifier
            
        Returns:
            SHA256 hash as cache key
        """
        try:
            # Normalize prompt (lowercase, strip whitespace)
            normalized_prompt = prompt.strip().lower()
            
            # Create context hash (only include relevant fields)
            context_parts = []
            
            # User profile hash (stable user info)
            if 'user_profile' in context:
                profile = context['user_profile']
                profile_key_fields = [
                    str(profile.get('experienceLevel', '')),
                    str(profile.get('fitnessGoals', [])),
                    str(profile.get('height', '')),
                    str(profile.get('weight', '')),
                ]
                context_parts.append('|'.join(profile_key_fields))
            
            # AI preferences hash
            if 'ai_preferences' in context:
                prefs = context['ai_preferences']
                if isinstance(prefs, str):
                    try:
                        prefs = json.loads(prefs)
                    except:
                        prefs = {}
                
                if isinstance(prefs, dict):
                    pref_key_fields = [
                        str(prefs.get('coachingStyle', '')),
                        str(prefs.get('equipmentAvailable', [])),
                        str(prefs.get('workoutDaysPerWeek', '')),
                    ]
                    context_parts.append('|'.join(pref_key_fields))
            
            # Combine all parts
            cache_input = '|'.join([
                user_id,
                normalized_prompt,
                '|'.join(context_parts),
                endpoint_type,
                model_id or 'default'
            ])
            
            # Generate SHA256 hash
            cache_key = hashlib.sha256(cache_input.encode('utf-8')).hexdigest()
            
            logger.debug(f"Generated cache key: {cache_key[:16]}... for user {user_id}, endpoint {endpoint_type}")
            
            return cache_key
            
        except Exception as e:
            logger.error(f"Error generating cache key: {e}")
            # Return a unique key on error to prevent caching
            return hashlib.sha256(f"{user_id}_{datetime.now().isoformat()}".encode()).hexdigest()
    
    def _compress_response(self, response: str) -> str:
        """Compress response using zlib"""
        try:
            if len(response) < self.compression_threshold:
                return response
            
            compressed = zlib.compress(response.encode('utf-8'))
            encoded = base64.b64encode(compressed).decode('utf-8')
            logger.debug(f"Compressed response from {len(response)} to {len(encoded)} bytes")
            return encoded
        except Exception as e:
            logger.error(f"Error compressing response: {e}")
            return response
    
    def _decompress_response(self, compressed_response: str, is_compressed: bool) -> str:
        """Decompress response if needed"""
        try:
            if not is_compressed:
                return compressed_response
            
            decoded = base64.b64decode(compressed_response.encode('utf-8'))
            decompressed = zlib.decompress(decoded).decode('utf-8')
            return decompressed
        except Exception as e:
            logger.error(f"Error decompressing response: {e}")
            return compressed_response
    
    async def get_cached_response(self, 
                                  cache_key: str, 
                                  user_id: str,
                                  endpoint_type: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve cached response if available and not expired
        
        Args:
            cache_key: Cache key
            user_id: User ID
            endpoint_type: Endpoint type
            
        Returns:
            Cached response dict or None if not found/expired
        """
        if not self.enabled:
            return None
        
        try:
            # Check hot cache first (in-memory)
            if cache_key in self.hot_cache:
                cached_item = self.hot_cache[cache_key]
                if datetime.fromisoformat(cached_item['expiresAt'].replace('Z', '+00:00')) > datetime.now(timezone.utc):
                    logger.info(f"HOT CACHE HIT for key {cache_key[:16]}...")
                    self.stats['hits'] += 1
                    
                    # Update last accessed
                    cached_item['lastAccessedAt'] = datetime.now(timezone.utc).isoformat()
                    cached_item['hits'] = cached_item.get('hits', 0) + 1
                    
                    return {
                        'response': cached_item['response'],
                        'tokens_used': cached_item['tokens']['total'],
                        'input_tokens': cached_item['tokens']['input'],
                        'output_tokens': cached_item['tokens']['output'],
                        'model': cached_item['model'],
                        'success': True,
                        'cached': True,
                        'cache_source': 'hot',
                        'cache_age_seconds': (datetime.now(timezone.utc) - 
                                            datetime.fromisoformat(cached_item['createdAt'].replace('Z', '+00:00'))).total_seconds()
                    }
                else:
                    # Expired, remove from hot cache
                    del self.hot_cache[cache_key]
            
            # Check DynamoDB cache
            pk = f"CACHE#{cache_key}"
            sk = f"RESPONSE#{endpoint_type}"
            
            response = self.table.get_item(
                Key={
                    'PK': pk,
                    'SK': sk
                }
            )
            
            if 'Item' not in response:
                logger.debug(f"Cache miss for key {cache_key[:16]}...")
                self.stats['misses'] += 1
                return None
            
            item = response['Item']
            
            # Check if expired
            expires_at = datetime.fromisoformat(item['expiresAt'].replace('Z', '+00:00'))
            if expires_at <= datetime.now(timezone.utc):
                logger.debug(f"Cache expired for key {cache_key[:16]}...")
                self.stats['misses'] += 1
                return None
            
            # Decompress response if needed
            response_text = self._decompress_response(
                item['response'],
                item.get('compressed', False)
            )
            
            # Update hit count and last accessed time
            try:
                self.table.update_item(
                    Key={'PK': pk, 'SK': sk},
                    UpdateExpression='SET hits = hits + :inc, lastAccessedAt = :now',
                    ExpressionAttributeValues={
                        ':inc': 1,
                        ':now': datetime.now(timezone.utc).isoformat()
                    }
                )
            except Exception as e:
                logger.warning(f"Failed to update cache hit count: {e}")
            
            logger.info(f"WARM CACHE HIT for key {cache_key[:16]}... (age: {item.get('cacheAgeSeconds', 0)}s)")
            self.stats['hits'] += 1
            
            # Add to hot cache
            self._add_to_hot_cache(cache_key, item)
            
            cache_age = (datetime.now(timezone.utc) - 
                        datetime.fromisoformat(item['createdAt'].replace('Z', '+00:00'))).total_seconds()
            
            return {
                'response': response_text,
                'tokens_used': item['tokens']['total'],
                'input_tokens': item['tokens']['input'],
                'output_tokens': item['tokens']['output'],
                'model': item['model'],
                'success': True,
                'cached': True,
                'cache_source': 'warm',
                'cache_age_seconds': cache_age,
                'hits': item.get('hits', 1)
            }
            
        except ClientError as e:
            logger.error(f"DynamoDB error retrieving cache: {e}")
            self.stats['errors'] += 1
            return None
        except Exception as e:
            logger.error(f"Error retrieving cached response: {e}")
            self.stats['errors'] += 1
            return None
    
    async def cache_response(self,
                           cache_key: str,
                           user_id: str,
                           endpoint_type: str,
                           prompt: str,
                           response: str,
                           tokens: Dict[str, int],
                           model: str,
                           metadata: Dict[str, Any] = None) -> bool:
        """
        Cache AI response in DynamoDB
        
        Args:
            cache_key: Cache key
            user_id: User ID
            endpoint_type: Endpoint type
            prompt: Original prompt
            response: AI response
            tokens: Token usage dict
            model: Model ID
            metadata: Additional metadata
            
        Returns:
            True if cached successfully
        """
        if not self.enabled:
            return False
        
        try:
            # Get TTL for this endpoint type
            ttl_seconds = self.ttl_config.get(endpoint_type, self.ttl_config['default'])
            
            created_at = datetime.now(timezone.utc)
            expires_at = created_at + timedelta(seconds=ttl_seconds)
            ttl_timestamp = int(expires_at.timestamp())
            
            # Compress response if enabled and large enough
            is_compressed = False
            cached_response = response
            if self.compression_enabled and len(response) >= self.compression_threshold:
                cached_response = self._compress_response(response)
                is_compressed = True
            
            # Create cache item
            pk = f"CACHE#{cache_key}"
            sk = f"RESPONSE#{endpoint_type}"
            
            item = {
                'PK': pk,
                'SK': sk,
                'userId': user_id,
                'endpoint': endpoint_type,
                'promptHash': hashlib.sha256(prompt.encode('utf-8')).hexdigest()[:16],
                'response': cached_response,
                'compressed': is_compressed,
                'tokens': {
                    'input': tokens.get('input', 0),
                    'output': tokens.get('output', 0),
                    'total': tokens.get('total', 0)
                },
                'model': model,
                'createdAt': created_at.isoformat(),
                'expiresAt': expires_at.isoformat(),
                'ttl': ttl_timestamp,
                'hits': 0,
                'lastAccessedAt': created_at.isoformat(),
                'metadata': metadata or {},
                'cacheVersion': 1
            }
            
            # Add to DynamoDB
            self.table.put_item(Item=item)
            
            # Add to hot cache
            item['response'] = response  # Store uncompressed in hot cache
            self._add_to_hot_cache(cache_key, item)
            
            logger.info(f"Cached response for key {cache_key[:16]}... (TTL: {ttl_seconds}s)")
            self.stats['writes'] += 1
            
            return True
            
        except ClientError as e:
            logger.error(f"DynamoDB error caching response: {e}")
            self.stats['errors'] += 1
            return False
        except Exception as e:
            logger.error(f"Error caching response: {e}")
            self.stats['errors'] += 1
            return False
    
    def _add_to_hot_cache(self, cache_key: str, item: Dict[str, Any]):
        """Add item to hot cache with LRU eviction"""
        try:
            # Remove oldest item if cache is full
            if len(self.hot_cache) >= self.hot_cache_max_size:
                oldest_key = min(self.hot_cache.keys(), 
                               key=lambda k: self.hot_cache[k].get('lastAccessedAt', ''))
                del self.hot_cache[oldest_key]
            
            self.hot_cache[cache_key] = item
        except Exception as e:
            logger.error(f"Error adding to hot cache: {e}")
    
    async def invalidate_user_cache(self, user_id: str, endpoint_type: str = None) -> int:
        """
        Invalidate all cache entries for a user
        
        Args:
            user_id: User ID
            endpoint_type: Optional specific endpoint type to invalidate
            
        Returns:
            Number of items invalidated
        """
        try:
            invalidated_count = 0
            
            # Query all cache items for user
            # Note: This requires GSI on userId
            # For now, we'll use a simpler approach with known cache keys
            
            # Clear from hot cache
            keys_to_remove = [k for k, v in self.hot_cache.items() 
                            if v.get('userId') == user_id and 
                            (endpoint_type is None or v.get('endpoint') == endpoint_type)]
            
            for key in keys_to_remove:
                del self.hot_cache[key]
                invalidated_count += 1
            
            logger.info(f"Invalidated {invalidated_count} cache entries for user {user_id}")
            self.stats['invalidations'] += invalidated_count
            
            return invalidated_count
            
        except Exception as e:
            logger.error(f"Error invalidating user cache: {e}")
            return 0
    
    async def invalidate_cache_key(self, cache_key: str, endpoint_type: str) -> bool:
        """
        Invalidate specific cache entry
        
        Args:
            cache_key: Cache key to invalidate
            endpoint_type: Endpoint type
            
        Returns:
            True if successful
        """
        try:
            # Remove from hot cache
            if cache_key in self.hot_cache:
                del self.hot_cache[cache_key]
            
            # Remove from DynamoDB
            pk = f"CACHE#{cache_key}"
            sk = f"RESPONSE#{endpoint_type}"
            
            self.table.delete_item(
                Key={
                    'PK': pk,
                    'SK': sk
                }
            )
            
            logger.info(f"Invalidated cache key {cache_key[:16]}...")
            self.stats['invalidations'] += 1
            
            return True
            
        except Exception as e:
            logger.error(f"Error invalidating cache key: {e}")
            return False
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get current cache statistics"""
        total_requests = self.stats['hits'] + self.stats['misses']
        hit_rate = (self.stats['hits'] / total_requests * 100) if total_requests > 0 else 0
        
        return {
            'enabled': self.enabled,
            'hits': self.stats['hits'],
            'misses': self.stats['misses'],
            'writes': self.stats['writes'],
            'invalidations': self.stats['invalidations'],
            'errors': self.stats['errors'],
            'total_requests': total_requests,
            'hit_rate_percent': round(hit_rate, 2),
            'hot_cache_size': len(self.hot_cache),
            'hot_cache_max_size': self.hot_cache_max_size
        }
    
    async def warm_cache(self, user_id: str, common_queries: List[Dict[str, Any]]) -> int:
        """
        Warm cache with common queries for a user
        
        Args:
            user_id: User ID
            common_queries: List of query dicts with prompt, context, endpoint
            
        Returns:
            Number of queries warmed
        """
        warmed_count = 0
        
        for query in common_queries:
            try:
                cache_key = self.generate_cache_key(
                    user_id=user_id,
                    prompt=query.get('prompt', ''),
                    context=query.get('context', {}),
                    endpoint_type=query.get('endpoint', 'chat'),
                    model_id=query.get('model')
                )
                
                # Check if already cached
                cached = await self.get_cached_response(
                    cache_key, user_id, query.get('endpoint', 'chat')
                )
                
                if cached:
                    warmed_count += 1
                    
            except Exception as e:
                logger.error(f"Error warming cache for query: {e}")
        
        logger.info(f"Warmed {warmed_count}/{len(common_queries)} cache entries for user {user_id}")
        return warmed_count
