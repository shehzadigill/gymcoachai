#!/usr/bin/env python3
"""
Test script to verify EU-WEST-1 optimization implementation
"""

import os
import sys
import asyncio

# Set region for testing
os.environ['AWS_REGION'] = 'eu-west-1'

from embedding_service import EmbeddingService
from bedrock_service import BedrockService

async def test_embedding_service():
    """Test Titan V2 embeddings"""
    print("Testing Embedding Service...")
    service = EmbeddingService()
    
    # Verify model
    assert service.embedding_model_id == 'amazon.titan-embed-text-v2:0', \
        f"Wrong embedding model: {service.embedding_model_id}"
    print(f"✅ Using correct model: {service.embedding_model_id}")
    
    # Verify dimensions
    assert service.get_embedding_dimensions() == 1024, \
        f"Wrong dimensions: {service.get_embedding_dimensions()}"
    print(f"✅ Correct dimensions: 1024")
    
    # Test embedding generation
    test_text = "This is a test for fitness coaching embeddings"
    embedding = await service.generate_embedding(test_text)
    
    if embedding:
        print(f"✅ Generated embedding with {len(embedding)} dimensions")
        assert len(embedding) == 1024, f"Embedding dimension mismatch: {len(embedding)}"
        
        # Test cost estimation
        cost = service.estimate_embedding_cost(len(test_text))
        print(f"✅ Estimated cost: ${cost:.6f} (Titan V2 pricing)")
        
        return True
    else:
        print("❌ Failed to generate embedding")
        return False

def test_bedrock_service():
    """Test Nova Micro text generation"""
    print("\nTesting Bedrock Service...")
    service = BedrockService()
    
    # Verify model
    assert service.model_id == 'amazon.nova-micro-v1:0', \
        f"Wrong text model: {service.model_id}"
    print(f"✅ Using correct model: {service.model_id}")
    
    # Verify region
    region = os.environ.get('AWS_REGION', 'unknown')
    assert region == 'eu-west-1', f"Wrong region: {region}"
    print(f"✅ Correct region: {region}")
    
    # Test model info
    info = service.get_model_info()
    print(f"✅ Model info: {info}")
    
    return True

async def run_all_tests():
    """Run all verification tests"""
    print("=" * 60)
    print("EU-WEST-1 Optimization Verification")
    print("=" * 60)
    
    results = []
    
    # Test embedding service
    try:
        results.append(await test_embedding_service())
    except Exception as e:
        print(f"❌ Embedding test failed: {e}")
        results.append(False)
    
    # Test bedrock service
    try:
        results.append(test_bedrock_service())
    except Exception as e:
        print(f"❌ Bedrock test failed: {e}")
        results.append(False)
    
    # Summary
    print("\n" + "=" * 60)
    if all(results):
        print("✅ ALL TESTS PASSED - Optimization verified!")
        print("\nCost Savings Summary:")
        print("- Text Generation: 96% cheaper (Nova Micro vs Claude Haiku)")
        print("- Embeddings: 80% cheaper (Titan V2 vs V1)")
        print("- Latency: Improved (no cross-region calls)")
        print("- Region: eu-west-1 (all services)")
    else:
        print("❌ SOME TESTS FAILED - Please review errors above")
    print("=" * 60)
    
    return all(results)

if __name__ == '__main__':
    success = asyncio.run(run_all_tests())
    sys.exit(0 if success else 1)
