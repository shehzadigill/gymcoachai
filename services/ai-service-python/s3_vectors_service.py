import os
import json
import logging
import boto3
from typing import Dict, List, Optional, Any
from botocore.exceptions import ClientError
# import numpy as np  # Removed to avoid Lambda dependency issues
import math
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

class S3VectorsService:
    """Service for managing vector storage and retrieval using AWS S3 Vectors"""
    
    def __init__(self):
        self.s3_client = boto3.client('s3')
        self.vectors_bucket = os.environ.get('VECTORS_BUCKET', 'gymcoach-ai-vectors')
        self.region = os.environ.get('AWS_REGION', 'us-east-1')
        
        # Vector dimensions for Titan Embeddings (v1 = 1024, v2 = 1536)
        # Use v1 dimensions for compatibility with stored vectors
        self.vector_dimensions = 1024  # Use v1 dimensions for consistency
        self.legacy_dimensions = 1024  # Support legacy v1 vectors
        
        # Index structure
        self.index_prefix = 'vectors/'
        self.metadata_prefix = 'metadata/'
        
    async def store_vector(self, 
                          vector_id: str, 
                          vector: List[float], 
                          metadata: Dict[str, Any],
                          namespace: str = 'default') -> bool:
        """
        Store a vector with metadata in S3 Vectors
        
        Args:
            vector_id: Unique identifier for the vector
            vector: The embedding vector
            metadata: Associated metadata
            namespace: Namespace for organization (e.g., 'exercises', 'nutrition')
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Validate vector dimensions (support both v1 and v2)
            if len(vector) not in [self.vector_dimensions, self.legacy_dimensions]:
                logger.error(f"Vector dimension mismatch: expected {self.vector_dimensions} or {self.legacy_dimensions}, got {len(vector)}")
                return False
            
            # Create vector document
            vector_doc = {
                'id': vector_id,
                'vector': vector,
                'metadata': metadata,
                'namespace': namespace,
                'created_at': datetime.now(timezone.utc).isoformat(),
                'dimensions': self.vector_dimensions
            }
            
            # Store in S3 Vectors format
            key = f"{self.index_prefix}{namespace}/{vector_id}.json"
            
            self.s3_client.put_object(
                Bucket=self.vectors_bucket,
                Key=key,
                Body=json.dumps(vector_doc),
                ContentType='application/json',
                Metadata={
                    'vector-id': vector_id,
                    'namespace': namespace,
                    'dimensions': str(self.vector_dimensions)
                }
            )
            
            logger.info(f"Stored vector {vector_id} in namespace {namespace}")
            return True
            
        except ClientError as e:
            logger.error(f"Error storing vector {vector_id}: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error storing vector {vector_id}: {e}")
            return False
    
    async def search_vectors(self, 
                           query_vector: List[float], 
                           namespace: str = 'default',
                           top_k: int = 5,
                           similarity_threshold: float = 0.7) -> List[Dict[str, Any]]:
        """
        Search for similar vectors using cosine similarity
        
        Args:
            query_vector: The query embedding vector
            namespace: Namespace to search in
            top_k: Number of top results to return
            similarity_threshold: Minimum similarity score
            
        Returns:
            List of similar vectors with metadata and scores
        """
        try:
            # Validate query vector (support both v1 and v2)
            if len(query_vector) not in [self.vector_dimensions, self.legacy_dimensions]:
                logger.error(f"Query vector dimension mismatch: expected {self.vector_dimensions} or {self.legacy_dimensions}, got {len(query_vector)}")
                return []
            
            # List all vectors in the namespace
            prefix = f"{self.index_prefix}{namespace}/"
            paginator = self.s3_client.get_paginator('list_objects_v2')
            
            results = []
            
            for page in paginator.paginate(Bucket=self.vectors_bucket, Prefix=prefix):
                if 'Contents' not in page:
                    continue
                    
                for obj in page['Contents']:
                    try:
                        # Get vector document
                        response = self.s3_client.get_object(
                            Bucket=self.vectors_bucket,
                            Key=obj['Key']
                        )
                        
                        vector_doc = json.loads(response['Body'].read().decode('utf-8'))
                        
                        # Calculate cosine similarity
                        similarity = self._cosine_similarity(query_vector, vector_doc['vector'])
                        logger.info(f"Similarity for {vector_doc['id']}: {similarity:.4f} (threshold: {similarity_threshold})")
                        
                        if similarity >= similarity_threshold:
                            results.append({
                                'id': vector_doc['id'],
                                'metadata': vector_doc['metadata'],
                                'similarity': similarity,
                                'namespace': vector_doc['namespace']
                            })
                            
                    except Exception as e:
                        logger.warning(f"Error processing vector from {obj['Key']}: {e}")
                        continue
            
            # Sort by similarity and return top_k
            results.sort(key=lambda x: x['similarity'], reverse=True)
            return results[:top_k]
            
        except ClientError as e:
            logger.error(f"Error searching vectors: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error searching vectors: {e}")
            return []
    
    async def get_vector_by_id(self, vector_id: str, namespace: str = 'default') -> Optional[Dict[str, Any]]:
        """
        Retrieve a specific vector by ID
        
        Args:
            vector_id: The vector identifier
            namespace: Namespace to search in
            
        Returns:
            Vector document or None if not found
        """
        try:
            key = f"{self.index_prefix}{namespace}/{vector_id}.json"
            
            response = self.s3_client.get_object(
                Bucket=self.vectors_bucket,
                Key=key
            )
            
            vector_doc = json.loads(response['Body'].read().decode('utf-8'))
            return vector_doc
            
        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchKey':
                logger.info(f"Vector {vector_id} not found in namespace {namespace}")
                return None
            logger.error(f"Error retrieving vector {vector_id}: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error retrieving vector {vector_id}: {e}")
            return None
    
    async def delete_vector(self, vector_id: str, namespace: str = 'default') -> bool:
        """
        Delete a vector by ID
        
        Args:
            vector_id: The vector identifier
            namespace: Namespace to delete from
            
        Returns:
            True if successful, False otherwise
        """
        try:
            key = f"{self.index_prefix}{namespace}/{vector_id}.json"
            
            self.s3_client.delete_object(
                Bucket=self.vectors_bucket,
                Key=key
            )
            
            logger.info(f"Deleted vector {vector_id} from namespace {namespace}")
            return True
            
        except ClientError as e:
            logger.error(f"Error deleting vector {vector_id}: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error deleting vector {vector_id}: {e}")
            return False
    
    async def list_namespaces(self) -> List[str]:
        """
        List all available namespaces
        
        Returns:
            List of namespace names
        """
        try:
            paginator = self.s3_client.get_paginator('list_objects_v2')
            namespaces = set()
            
            for page in paginator.paginate(Bucket=self.vectors_bucket, Prefix=self.index_prefix):
                if 'Contents' not in page:
                    continue
                    
                for obj in page['Contents']:
                    # Extract namespace from key
                    key_parts = obj['Key'].split('/')
                    if len(key_parts) >= 3:  # vectors/namespace/file.json
                        namespaces.add(key_parts[1])
            
            return list(namespaces)
            
        except ClientError as e:
            logger.error(f"Error listing namespaces: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error listing namespaces: {e}")
            return []
    
    async def get_namespace_stats(self, namespace: str) -> Dict[str, Any]:
        """
        Get statistics for a namespace
        
        Args:
            namespace: Namespace to get stats for
            
        Returns:
            Dictionary with namespace statistics
        """
        try:
            prefix = f"{self.index_prefix}{namespace}/"
            paginator = self.s3_client.get_paginator('list_objects_v2')
            
            total_vectors = 0
            total_size = 0
            
            for page in paginator.paginate(Bucket=self.vectors_bucket, Prefix=prefix):
                if 'Contents' not in page:
                    continue
                    
                for obj in page['Contents']:
                    total_vectors += 1
                    total_size += obj['Size']
            
            return {
                'namespace': namespace,
                'total_vectors': total_vectors,
                'total_size_bytes': total_size,
                'average_size_bytes': total_size / max(total_vectors, 1)
            }
            
        except ClientError as e:
            logger.error(f"Error getting namespace stats for {namespace}: {e}")
            return {'namespace': namespace, 'error': str(e)}
        except Exception as e:
            logger.error(f"Unexpected error getting namespace stats for {namespace}: {e}")
            return {'namespace': namespace, 'error': str(e)}
    
    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """
        Calculate cosine similarity between two vectors
        Handles dimension mismatches by truncating to the shorter vector length
        
        Args:
            vec1: First vector
            vec2: Second vector
            
        Returns:
            Cosine similarity score (0-1)
        """
        try:
            # Handle dimension mismatch by using the shorter vector length
            min_length = min(len(vec1), len(vec2))
            vec1_truncated = vec1[:min_length]
            vec2_truncated = vec2[:min_length]
            
            # Calculate cosine similarity using pure Python
            dot_product = sum(a * b for a, b in zip(vec1_truncated, vec2_truncated))
            norm_a = math.sqrt(sum(a * a for a in vec1_truncated))
            norm_b = math.sqrt(sum(b * b for b in vec2_truncated))
            
            if norm_a == 0 or norm_b == 0:
                return 0.0
            
            similarity = dot_product / (norm_a * norm_b)
            
            # Ensure result is between 0 and 1
            return max(0.0, min(1.0, similarity))
            
        except Exception as e:
            logger.error(f"Error calculating cosine similarity: {e}")
            return 0.0
    
    async def batch_store_vectors(self, 
                                 vectors: List[Dict[str, Any]], 
                                 namespace: str = 'default') -> Dict[str, int]:
        """
        Store multiple vectors in batch
        
        Args:
            vectors: List of vector documents with 'id', 'vector', and 'metadata'
            namespace: Namespace to store in
            
        Returns:
            Dictionary with success/failure counts
        """
        success_count = 0
        failure_count = 0
        
        for vector_doc in vectors:
            success = await self.store_vector(
                vector_doc['id'],
                vector_doc['vector'],
                vector_doc['metadata'],
                namespace
            )
            
            if success:
                success_count += 1
            else:
                failure_count += 1
        
        return {
            'success': success_count,
            'failures': failure_count,
            'total': len(vectors)
        }
    
    async def create_vector_index(self, namespace: str, description: str = '') -> bool:
        """
        Create a vector index for a namespace (metadata only)
        
        Args:
            namespace: Namespace name
            description: Description of the index
            
        Returns:
            True if successful, False otherwise
        """
        try:
            index_metadata = {
                'namespace': namespace,
                'description': description,
                'created_at': datetime.now(timezone.utc).isoformat(),
                'vector_dimensions': self.vector_dimensions,
                'index_type': 'cosine_similarity'
            }
            
            key = f"{self.metadata_prefix}{namespace}/index.json"
            
            self.s3_client.put_object(
                Bucket=self.vectors_bucket,
                Key=key,
                Body=json.dumps(index_metadata),
                ContentType='application/json'
            )
            
            logger.info(f"Created vector index for namespace {namespace}")
            return True
            
        except ClientError as e:
            logger.error(f"Error creating vector index for {namespace}: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error creating vector index for {namespace}: {e}")
            return False
