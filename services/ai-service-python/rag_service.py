import os
import json
import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timezone
import asyncio

from s3_vectors_service import S3VectorsService
from embedding_service import EmbeddingService

logger = logging.getLogger(__name__)

class RAGService:
    """Service for Retrieval Augmented Generation using S3 Vectors"""
    
    def __init__(self):
        self.s3_vectors = S3VectorsService()
        self.embedding_service = EmbeddingService()
        
                # RAG configuration
        self.default_top_k = 5
        self.default_similarity_threshold = 0.6  # Lowered to 0.6 for better recall
        self.max_context_length = 4000  # characters
        
        # Namespaces for different knowledge types
        self.namespaces = {
            'exercises': 'exercise_library',
            'nutrition': 'nutrition_database',
            'knowledge': 'fitness_knowledge',
            'workouts': 'workout_plans',
            'injuries': 'injuries',  # Updated to match stored data
            'research': 'research',  # Added for research articles
            'training': 'training'   # Added for training methodology
        }
    
    async def retrieve_relevant_context(self, 
                                      query: str, 
                                      context: Optional[Dict[str, Any]] = None,
                                      namespaces: Optional[List[str]] = None,
                                      top_k: int = None,
                                      similarity_threshold: float = None) -> Dict[str, Any]:
        """
        Retrieve relevant context for a user query using RAG
        
        Args:
            query: User query
            context: Optional user context
            namespaces: Specific namespaces to search (default: all)
            top_k: Number of results per namespace
            similarity_threshold: Minimum similarity score
            
        Returns:
            Dictionary with retrieved context and metadata
        """
        try:
            # Set defaults
            if top_k is None:
                top_k = self.default_top_k
            if similarity_threshold is None:
                similarity_threshold = self.default_similarity_threshold
            if namespaces is None:
                # Use only the namespaces that actually exist in the bucket
                namespaces = ['injuries', 'research', 'training']
            
            # Generate query embedding
            query_embedding = await self.embedding_service.generate_query_embedding(query, context)
            if not query_embedding:
                logger.error("Failed to generate query embedding")
                return {'context': '', 'sources': [], 'metadata': {'error': 'embedding_failed'}}
            
            # Search across namespaces
            all_results = []
            namespace_results = {}
            
            for namespace in namespaces:
                try:
                    results = await self.s3_vectors.search_vectors(
                        query_embedding,
                        namespace=namespace,
                        top_k=top_k,
                        similarity_threshold=similarity_threshold
                    )
                    
                    namespace_results[namespace] = results
                    all_results.extend(results)
                    
                    logger.info(f"Found {len(results)} results in namespace {namespace}")
                    
                except Exception as e:
                    logger.error(f"Error searching namespace {namespace}: {e}")
                    namespace_results[namespace] = []
            
            # Sort all results by similarity
            all_results.sort(key=lambda x: x['similarity'], reverse=True)
            
            # Take top results across all namespaces
            top_results = all_results[:top_k * 2]  # Get more results for better context
            
            # Build context string
            context_parts = []
            sources = []
            
            for i, result in enumerate(top_results):
                metadata = result['metadata']
                similarity = result['similarity']
                
                # Build context entry
                context_entry = self._build_context_entry(metadata, similarity, i + 1)
                if context_entry:
                    context_parts.append(context_entry)
                
                # Add source information
                sources.append({
                    'id': result['id'],
                    'namespace': result['namespace'],
                    'similarity': similarity,
                    'metadata': metadata
                })
            
            # Combine context
            combined_context = '\n\n'.join(context_parts)
            
            # Truncate if too long
            if len(combined_context) > self.max_context_length:
                combined_context = combined_context[:self.max_context_length] + "..."
                logger.warning(f"Context truncated to {self.max_context_length} characters")
            
            return {
                'context': combined_context,
                'sources': sources,
                'metadata': {
                    'total_results': len(all_results),
                    'namespaces_searched': namespaces,
                    'top_k': top_k,
                    'similarity_threshold': similarity_threshold,
                    'context_length': len(combined_context),
                    'namespace_results': {ns: len(results) for ns, results in namespace_results.items()}
                }
            }
            
        except Exception as e:
            logger.error(f"Error in retrieve_relevant_context: {e}")
            return {'context': '', 'sources': [], 'metadata': {'error': str(e)}}
    
    async def retrieve_exercise_context(self, 
                                      query: str, 
                                      user_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Retrieve exercise-specific context
        
        Args:
            query: User query about exercises
            user_context: User context (goals, equipment, etc.)
            
        Returns:
            Exercise context and recommendations
        """
        try:
            # Search exercise namespace
            result = await self.retrieve_relevant_context(
                query=query,
                context=user_context,
                namespaces=['exercise_library'],
                top_k=3,
                similarity_threshold=0.6
            )
            
            # Enhance with exercise-specific processing
            if result['sources']:
                exercise_recommendations = []
                
                for source in result['sources']:
                    metadata = source['metadata']
                    recommendation = {
                        'exercise_id': source['id'],
                        'name': metadata.get('name', 'Unknown Exercise'),
                        'similarity': source['similarity'],
                        'muscle_groups': metadata.get('muscleGroups', []),
                        'equipment': metadata.get('equipment', []),
                        'difficulty': metadata.get('difficulty', 'intermediate'),
                        'description': metadata.get('description', ''),
                        'instructions': metadata.get('instructions', [])
                    }
                    exercise_recommendations.append(recommendation)
                
                result['exercise_recommendations'] = exercise_recommendations
            
            return result
            
        except Exception as e:
            logger.error(f"Error retrieving exercise context: {e}")
            return {'context': '', 'sources': [], 'exercise_recommendations': [], 'metadata': {'error': str(e)}}
    
    async def retrieve_nutrition_context(self, 
                                       query: str, 
                                       user_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Retrieve nutrition-specific context
        
        Args:
            query: User query about nutrition
            user_context: User context (goals, dietary restrictions, etc.)
            
        Returns:
            Nutrition context and recommendations
        """
        try:
            # Search nutrition namespace
            result = await self.retrieve_relevant_context(
                query=query,
                context=user_context,
                namespaces=['nutrition_database'],
                top_k=3,
                similarity_threshold=0.6
            )
            
            # Enhance with nutrition-specific processing
            if result['sources']:
                nutrition_recommendations = []
                
                for source in result['sources']:
                    metadata = source['metadata']
                    recommendation = {
                        'food_id': source['id'],
                        'name': metadata.get('name', 'Unknown Food'),
                        'similarity': source['similarity'],
                        'category': metadata.get('category', ''),
                        'nutrition': metadata.get('nutrition', {}),
                        'allergens': metadata.get('allergens', []),
                        'dietary_restrictions': metadata.get('dietaryRestrictions', [])
                    }
                    nutrition_recommendations.append(recommendation)
                
                result['nutrition_recommendations'] = nutrition_recommendations
            
            return result
            
        except Exception as e:
            logger.error(f"Error retrieving nutrition context: {e}")
            return {'context': '', 'sources': [], 'nutrition_recommendations': [], 'metadata': {'error': str(e)}}
    
    async def retrieve_workout_context(self, 
                                     query: str, 
                                     user_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Retrieve workout plan context
        
        Args:
            query: User query about workouts
            user_context: User context (goals, experience, etc.)
            
        Returns:
            Workout context and recommendations
        """
        try:
            # Search workout and exercise namespaces
            result = await self.retrieve_relevant_context(
                query=query,
                context=user_context,
                namespaces=['workout_plans', 'exercise_library'],
                top_k=5,
                similarity_threshold=0.6
            )
            
            # Enhance with workout-specific processing
            if result['sources']:
                workout_recommendations = []
                
                for source in result['sources']:
                    metadata = source['metadata']
                    recommendation = {
                        'workout_id': source['id'],
                        'name': metadata.get('name', 'Unknown Workout'),
                        'similarity': source['similarity'],
                        'type': metadata.get('type', ''),
                        'duration': metadata.get('duration', 0),
                        'difficulty': metadata.get('difficulty', 'intermediate'),
                        'exercises': metadata.get('exercises', []),
                        'description': metadata.get('description', '')
                    }
                    workout_recommendations.append(recommendation)
                
                result['workout_recommendations'] = workout_recommendations
            
            return result
            
        except Exception as e:
            logger.error(f"Error retrieving workout context: {e}")
            return {'context': '', 'sources': [], 'workout_recommendations': [], 'metadata': {'error': str(e)}}
    
    async def retrieve_injury_prevention_context(self, 
                                               query: str, 
                                               user_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Retrieve injury prevention context
        
        Args:
            query: User query about injuries or prevention
            user_context: User context (injury history, current pain, etc.)
            
        Returns:
            Injury prevention context and recommendations
        """
        try:
            # Search injury prevention namespace
            result = await self.retrieve_relevant_context(
                query=query,
                context=user_context,
                namespaces=['injury_prevention'],
                top_k=3,
                similarity_threshold=0.6
            )
            
            # Enhance with injury-specific processing
            if result['sources']:
                prevention_recommendations = []
                
                for source in result['sources']:
                    metadata = source['metadata']
                    recommendation = {
                        'prevention_id': source['id'],
                        'title': metadata.get('title', 'Unknown Prevention Tip'),
                        'similarity': source['similarity'],
                        'category': metadata.get('category', ''),
                        'risk_level': metadata.get('riskLevel', 'medium'),
                        'prevention_tips': metadata.get('preventionTips', []),
                        'warning_signs': metadata.get('warningSigns', []),
                        'exercises_to_avoid': metadata.get('exercisesToAvoid', [])
                    }
                    prevention_recommendations.append(recommendation)
                
                result['prevention_recommendations'] = prevention_recommendations
            
            return result
            
        except Exception as e:
            logger.error(f"Error retrieving injury prevention context: {e}")
            return {'context': '', 'sources': [], 'prevention_recommendations': [], 'metadata': {'error': str(e)}}
    
    def _build_context_entry(self, metadata: Dict[str, Any], similarity: float, rank: int) -> str:
        """
        Build a context entry from metadata
        
        Args:
            metadata: Source metadata
            similarity: Similarity score
            rank: Rank in results
            
        Returns:
            Formatted context string
        """
        try:
            context_parts = []
            
            # Add title/name
            if 'title' in metadata:
                context_parts.append(f"**{metadata['title']}**")
            elif 'name' in metadata:
                context_parts.append(f"**{metadata['name']}**")
            
            # Add description
            if 'description' in metadata:
                context_parts.append(f"Description: {metadata['description']}")
            
            # Add content
            if 'content' in metadata:
                content = metadata['content']
                if len(content) > 200:
                    content = content[:200] + "..."
                context_parts.append(f"Content: {content}")
            
            # Add instructions
            if 'instructions' in metadata:
                instructions = metadata['instructions']
                if isinstance(instructions, list):
                    instructions_text = " ".join(instructions[:3])  # First 3 instructions
                else:
                    instructions_text = instructions
                context_parts.append(f"Instructions: {instructions_text}")
            
            # Add summary
            if 'summary' in metadata:
                context_parts.append(f"Summary: {metadata['summary']}")
            
            # Add tags
            if 'tags' in metadata:
                tags = metadata['tags']
                if isinstance(tags, list):
                    tags_text = ", ".join(tags[:5])  # First 5 tags
                else:
                    tags_text = tags
                context_parts.append(f"Tags: {tags_text}")
            
            # Add similarity score
            context_parts.append(f"(Relevance: {similarity:.2f})")
            
            return "\n".join(context_parts)
            
        except Exception as e:
            logger.error(f"Error building context entry: {e}")
            return ""
    
    async def get_rag_stats(self) -> Dict[str, Any]:
        """
        Get RAG service statistics
        
        Returns:
            Dictionary with service statistics
        """
        try:
            stats = {
                'namespaces': {},
                'total_vectors': 0,
                'last_updated': datetime.now(timezone.utc).isoformat()
            }
            
            # Get stats for each namespace
            for namespace in self.namespaces.values():
                namespace_stats = await self.s3_vectors.get_namespace_stats(namespace)
                stats['namespaces'][namespace] = namespace_stats
                stats['total_vectors'] += namespace_stats.get('total_vectors', 0)
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting RAG stats: {e}")
            return {'error': str(e)}
    
    async def search_similar_content(self, 
                                   content: str, 
                                   content_type: str = 'general',
                                   top_k: int = 3) -> List[Dict[str, Any]]:
        """
        Search for content similar to the given text
        
        Args:
            content: Text content to find similar items for
            content_type: Type of content ('exercise', 'nutrition', 'workout', 'general')
            top_k: Number of similar items to return
            
        Returns:
            List of similar content items
        """
        try:
            # Generate embedding for the content
            embedding = await self.embedding_service.generate_embedding(content)
            if not embedding:
                return []
            
            # Determine namespace based on content type
            namespace_map = {
                'exercise': 'exercise_library',
                'nutrition': 'nutrition_database',
                'workout': 'workout_plans',
                'general': 'fitness_knowledge'
            }
            
            namespace = namespace_map.get(content_type, 'fitness_knowledge')
            
            # Search for similar content
            results = await self.s3_vectors.search_vectors(
                embedding,
                namespace=namespace,
                top_k=top_k,
                similarity_threshold=0.6
            )
            
            return results
            
        except Exception as e:
            logger.error(f"Error searching similar content: {e}")
            return []
    
    async def validate_rag_setup(self) -> Dict[str, Any]:
        """
        Validate that RAG setup is working correctly
        
        Returns:
            Validation results
        """
        try:
            validation_results = {
                's3_vectors': False,
                'embedding_service': False,
                'namespaces': {},
                'test_query': False,
                'overall_status': False
            }
            
            # Test S3 Vectors service
            try:
                namespaces = await self.s3_vectors.list_namespaces()
                validation_results['s3_vectors'] = True
                validation_results['available_namespaces'] = namespaces
            except Exception as e:
                logger.error(f"S3 Vectors validation failed: {e}")
            
            # Test embedding service
            try:
                test_embedding = await self.embedding_service.generate_embedding("test query")
                if test_embedding and len(test_embedding) == 1024:
                    validation_results['embedding_service'] = True
                    validation_results['embedding_dimensions'] = len(test_embedding)
            except Exception as e:
                logger.error(f"Embedding service validation failed: {e}")
            
            # Test each namespace
            for namespace in self.namespaces.values():
                try:
                    stats = await self.s3_vectors.get_namespace_stats(namespace)
                    validation_results['namespaces'][namespace] = {
                        'exists': stats.get('total_vectors', 0) > 0,
                        'vector_count': stats.get('total_vectors', 0)
                    }
                except Exception as e:
                    validation_results['namespaces'][namespace] = {'exists': False, 'error': str(e)}
            
            # Test a simple query
            try:
                test_result = await self.retrieve_relevant_context("test query", top_k=1)
                validation_results['test_query'] = True
            except Exception as e:
                logger.error(f"Test query validation failed: {e}")
            
            # Overall status
            validation_results['overall_status'] = (
                validation_results['s3_vectors'] and 
                validation_results['embedding_service'] and
                validation_results['test_query']
            )
            
            return validation_results
            
        except Exception as e:
            logger.error(f"Error validating RAG setup: {e}")
            return {'error': str(e), 'overall_status': False}
