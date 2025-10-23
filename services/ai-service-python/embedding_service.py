import os
import json
import logging
import boto3
from typing import List, Dict, Optional, Any
from botocore.exceptions import ClientError
import time

logger = logging.getLogger(__name__)

class EmbeddingService:
    """Service for generating embeddings using AWS Bedrock Titan Embeddings"""
    
    def __init__(self):
        self.bedrock_runtime = boto3.client('bedrock-runtime', region_name=os.environ.get('AWS_REGION', 'us-east-1'))
        self.embedding_model_id = 'amazon.titan-embed-text-v1'
        self.max_retries = 3
        self.retry_delay = 1  # seconds
        self.max_tokens = 8192  # Titan embedding model limit
        
    async def generate_embedding(self, text: str) -> Optional[List[float]]:
        """
        Generate embedding for a single text
        
        Args:
            text: Text to embed
            
        Returns:
            Embedding vector or None if failed
        """
        try:
            # Truncate text if too long
            if len(text) > self.max_tokens:
                text = text[:self.max_tokens]
                logger.warning(f"Text truncated to {self.max_tokens} tokens")
            
            # Prepare request body for Titan Embeddings
            body = {
                "inputText": text
            }
            
            # Retry logic for rate limiting
            for attempt in range(self.max_retries):
                try:
                    response = self.bedrock_runtime.invoke_model(
                        modelId=self.embedding_model_id,
                        body=json.dumps(body),
                        contentType='application/json'
                    )
                    
                    response_body = json.loads(response['body'].read())
                    
                    if 'embedding' in response_body:
                        embedding = response_body['embedding']
                        logger.info(f"Generated embedding with {len(embedding)} dimensions")
                        return embedding
                    else:
                        logger.error(f"Invalid response structure: {response_body}")
                        return None
                        
                except ClientError as e:
                    error_code = e.response['Error']['Code']
                    
                    if error_code == 'ThrottlingException' and attempt < self.max_retries - 1:
                        logger.warning(f"Rate limited, retrying in {self.retry_delay * (2 ** attempt)} seconds...")
                        time.sleep(self.retry_delay * (2 ** attempt))  # Exponential backoff
                        continue
                    else:
                        logger.error(f"Bedrock embedding invocation failed: {e}")
                        return None
            
            return None
            
        except Exception as e:
            logger.error(f"Unexpected error generating embedding: {e}")
            return None
    
    async def generate_embeddings_batch(self, texts: List[str]) -> List[Optional[List[float]]]:
        """
        Generate embeddings for multiple texts
        
        Args:
            texts: List of texts to embed
            
        Returns:
            List of embedding vectors (None for failed embeddings)
        """
        embeddings = []
        
        for i, text in enumerate(texts):
            logger.info(f"Generating embedding {i+1}/{len(texts)}")
            embedding = await self.generate_embedding(text)
            embeddings.append(embedding)
            
            # Small delay to avoid rate limiting
            if i < len(texts) - 1:
                time.sleep(0.1)
        
        return embeddings
    
    async def generate_embedding_for_exercise(self, exercise_data: Dict[str, Any]) -> Optional[List[float]]:
        """
        Generate embedding for exercise data
        
        Args:
            exercise_data: Exercise information dictionary
            
        Returns:
            Embedding vector or None if failed
        """
        try:
            # Create comprehensive text representation
            text_parts = []
            
            # Exercise name
            if 'name' in exercise_data:
                text_parts.append(f"Exercise: {exercise_data['name']}")
            
            # Description
            if 'description' in exercise_data:
                text_parts.append(f"Description: {exercise_data['description']}")
            
            # Instructions
            if 'instructions' in exercise_data:
                if isinstance(exercise_data['instructions'], list):
                    instructions_text = " ".join(exercise_data['instructions'])
                else:
                    instructions_text = exercise_data['instructions']
                text_parts.append(f"Instructions: {instructions_text}")
            
            # Muscle groups
            if 'muscleGroups' in exercise_data:
                if isinstance(exercise_data['muscleGroups'], list):
                    muscle_text = ", ".join(exercise_data['muscleGroups'])
                else:
                    muscle_text = exercise_data['muscleGroups']
                text_parts.append(f"Muscle groups: {muscle_text}")
            
            # Equipment
            if 'equipment' in exercise_data:
                if isinstance(exercise_data['equipment'], list):
                    equipment_text = ", ".join(exercise_data['equipment'])
                else:
                    equipment_text = exercise_data['equipment']
                text_parts.append(f"Equipment: {equipment_text}")
            
            # Difficulty level
            if 'difficulty' in exercise_data:
                text_parts.append(f"Difficulty: {exercise_data['difficulty']}")
            
            # Exercise type
            if 'type' in exercise_data:
                text_parts.append(f"Type: {exercise_data['type']}")
            
            # Combine all parts
            combined_text = " ".join(text_parts)
            
            return await self.generate_embedding(combined_text)
            
        except Exception as e:
            logger.error(f"Error generating embedding for exercise: {e}")
            return None
    
    async def generate_embedding_for_nutrition(self, nutrition_data: Dict[str, Any]) -> Optional[List[float]]:
        """
        Generate embedding for nutrition data
        
        Args:
            nutrition_data: Nutrition information dictionary
            
        Returns:
            Embedding vector or None if failed
        """
        try:
            # Create comprehensive text representation
            text_parts = []
            
            # Food name
            if 'name' in nutrition_data:
                text_parts.append(f"Food: {nutrition_data['name']}")
            
            # Description
            if 'description' in nutrition_data:
                text_parts.append(f"Description: {nutrition_data['description']}")
            
            # Category
            if 'category' in nutrition_data:
                text_parts.append(f"Category: {nutrition_data['category']}")
            
            # Nutritional information
            if 'nutrition' in nutrition_data:
                nutrition = nutrition_data['nutrition']
                nutrition_parts = []
                
                if 'calories' in nutrition:
                    nutrition_parts.append(f"{nutrition['calories']} calories")
                
                if 'protein' in nutrition:
                    nutrition_parts.append(f"{nutrition['protein']}g protein")
                
                if 'carbs' in nutrition:
                    nutrition_parts.append(f"{nutrition['carbs']}g carbs")
                
                if 'fat' in nutrition:
                    nutrition_parts.append(f"{nutrition['fat']}g fat")
                
                if nutrition_parts:
                    text_parts.append(f"Nutrition: {', '.join(nutrition_parts)}")
            
            # Allergens
            if 'allergens' in nutrition_data:
                if isinstance(nutrition_data['allergens'], list):
                    allergens_text = ", ".join(nutrition_data['allergens'])
                else:
                    allergens_text = nutrition_data['allergens']
                text_parts.append(f"Allergens: {allergens_text}")
            
            # Dietary restrictions
            if 'dietaryRestrictions' in nutrition_data:
                if isinstance(nutrition_data['dietaryRestrictions'], list):
                    restrictions_text = ", ".join(nutrition_data['dietaryRestrictions'])
                else:
                    restrictions_text = nutrition_data['dietaryRestrictions']
                text_parts.append(f"Dietary restrictions: {restrictions_text}")
            
            # Combine all parts
            combined_text = " ".join(text_parts)
            
            return await self.generate_embedding(combined_text)
            
        except Exception as e:
            logger.error(f"Error generating embedding for nutrition: {e}")
            return None
    
    async def generate_embedding_for_knowledge(self, knowledge_data: Dict[str, Any]) -> Optional[List[float]]:
        """
        Generate embedding for general knowledge content
        
        Args:
            knowledge_data: Knowledge content dictionary
            
        Returns:
            Embedding vector or None if failed
        """
        try:
            # Create comprehensive text representation
            text_parts = []
            
            # Title
            if 'title' in knowledge_data:
                text_parts.append(f"Title: {knowledge_data['title']}")
            
            # Content
            if 'content' in knowledge_data:
                text_parts.append(f"Content: {knowledge_data['content']}")
            
            # Summary
            if 'summary' in knowledge_data:
                text_parts.append(f"Summary: {knowledge_data['summary']}")
            
            # Tags
            if 'tags' in knowledge_data:
                if isinstance(knowledge_data['tags'], list):
                    tags_text = ", ".join(knowledge_data['tags'])
                else:
                    tags_text = knowledge_data['tags']
                text_parts.append(f"Tags: {tags_text}")
            
            # Category
            if 'category' in knowledge_data:
                text_parts.append(f"Category: {knowledge_data['category']}")
            
            # Combine all parts
            combined_text = " ".join(text_parts)
            
            return await self.generate_embedding(combined_text)
            
        except Exception as e:
            logger.error(f"Error generating embedding for knowledge: {e}")
            return None
    
    async def generate_query_embedding(self, query: str, context: Optional[Dict[str, Any]] = None) -> Optional[List[float]]:
        """
        Generate embedding for a user query with optional context
        
        Args:
            query: User query text
            context: Optional context information
            
        Returns:
            Embedding vector or None if failed
        """
        try:
            # Build query text with context
            query_parts = [query]
            
            if context:
                # Add relevant context information
                if 'user_goals' in context:
                    goals_text = ", ".join(context['user_goals']) if isinstance(context['user_goals'], list) else context['user_goals']
                    query_parts.append(f"User goals: {goals_text}")
                
                if 'experience_level' in context:
                    query_parts.append(f"Experience level: {context['experience_level']}")
                
                if 'equipment_available' in context:
                    equipment_text = ", ".join(context['equipment_available']) if isinstance(context['equipment_available'], list) else context['equipment_available']
                    query_parts.append(f"Available equipment: {equipment_text}")
                
                if 'current_focus' in context:
                    query_parts.append(f"Current focus: {context['current_focus']}")
            
            # Combine query and context
            combined_query = " ".join(query_parts)
            
            return await self.generate_embedding(combined_query)
            
        except Exception as e:
            logger.error(f"Error generating query embedding: {e}")
            return None
    
    def get_embedding_dimensions(self) -> int:
        """
        Get the number of dimensions for Titan embeddings
        
        Returns:
            Number of dimensions (1536 for Titan v1)
        """
        return 1536
    
    def estimate_embedding_cost(self, text_length: int) -> float:
        """
        Estimate the cost of generating an embedding
        
        Args:
            text_length: Length of text in characters
            
        Returns:
            Estimated cost in USD
        """
        # Titan Embeddings pricing: $0.0001 per 1K tokens
        # Rough estimate: 1 token ≈ 4 characters
        estimated_tokens = text_length / 4
        cost_per_1k_tokens = 0.0001
        
        return (estimated_tokens / 1000) * cost_per_1k_tokens
    
    async def validate_embedding(self, embedding: List[float]) -> bool:
        """
        Validate that an embedding has the correct format
        
        Args:
            embedding: Embedding vector to validate
            
        Returns:
            True if valid, False otherwise
        """
        try:
            # Check if it's a list
            if not isinstance(embedding, list):
                return False
            
            # Check dimensions
            if len(embedding) != self.get_embedding_dimensions():
                return False
            
            # Check if all elements are numbers
            for value in embedding:
                if not isinstance(value, (int, float)):
                    return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error validating embedding: {e}")
            return False
