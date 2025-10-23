#!/usr/bin/env python3
"""
Performance Optimization Script for AI Service
Optimizes response times, token usage, and cost efficiency
"""

import os
import json
import asyncio
import time
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone
import statistics
from collections import defaultdict

# Import our services
from s3_vectors_service import S3VectorsService
from embedding_service import EmbeddingService
from rag_service import RAGService
from context_builder import ContextBuilder
from memory_service import MemoryService
from personalization_engine import PersonalizationEngine
from conversation_service import ConversationService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PerformanceOptimizer:
    """Performance optimization for AI service"""
    
    def __init__(self):
        self.table_name = os.environ.get('DYNAMODB_TABLE', 'gymcoach-ai-main')
        self.vectors_bucket = os.environ.get('VECTORS_BUCKET', 'gymcoach-ai-vectors')
        
        # Performance targets
        self.target_response_time = 3.0  # seconds
        self.max_context_tokens = 2000
        self.max_memory_items = 10
        self.cache_ttl = 300  # 5 minutes
        
        # Performance metrics
        self.metrics = {
            'response_times': [],
            'token_usage': [],
            'cache_hits': 0,
            'cache_misses': 0,
            'error_count': 0
        }
        
        # Initialize services
        self.s3_vectors_service = S3VectorsService()
        self.embedding_service = EmbeddingService()
        self.rag_service = RAGService()
        self.context_builder = ContextBuilder()
        self.memory_service = MemoryService()
        self.personalization_engine = PersonalizationEngine()
        self.conversation_service = ConversationService(self.table_name)
        
        # Cache for frequently accessed data
        self.cache = {}
        self.cache_timestamps = {}
    
    async def optimize_rag_performance(self) -> Dict[str, Any]:
        """Optimize RAG service performance"""
        try:
            logger.info("Optimizing RAG service performance...")
            
            optimizations = {
                'vector_search_limit': 5,  # Reduce from default 10
                'similarity_threshold': 0.7,  # Increase threshold for better quality
                'namespace_priority': ['exercises', 'nutrition', 'research'],  # Priority order
                'batch_processing': True,
                'caching_enabled': True
            }
            
            # Test optimized RAG performance
            test_queries = [
                "How to do push-ups correctly?",
                "What should I eat before a workout?",
                "How to prevent workout injuries?",
                "Best exercises for beginners",
                "Nutrition for muscle building"
            ]
            
            performance_results = []
            for query in test_queries:
                start_time = time.time()
                
                # Use optimized parameters
                context = await self.rag_service.retrieve_relevant_context(
                    query, 
                    {"fitnessLevel": "intermediate"},
                    limit=optimizations['vector_search_limit'],
                    threshold=optimizations['similarity_threshold']
                )
                
                response_time = time.time() - start_time
                performance_results.append({
                    'query': query,
                    'response_time': response_time,
                    'sources_count': len(context.get('sources', [])),
                    'context_length': len(context.get('context', ''))
                })
            
            avg_response_time = statistics.mean([r['response_time'] for r in performance_results])
            
            return {
                'optimizations': optimizations,
                'performance_results': performance_results,
                'average_response_time': avg_response_time,
                'meets_target': avg_response_time < self.target_response_time,
                'optimization_timestamp': datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error optimizing RAG performance: {e}")
            return {'error': str(e)}
    
    async def optimize_context_building(self) -> Dict[str, Any]:
        """Optimize context building performance"""
        try:
            logger.info("Optimizing context building performance...")
            
            test_user_id = "test-user-optimization"
            
            # Test different context building strategies
            strategies = [
                {
                    'name': 'minimal',
                    'include_patterns': False,
                    'include_nutrition': False,
                    'include_progress': False
                },
                {
                    'name': 'balanced',
                    'include_patterns': True,
                    'include_nutrition': True,
                    'include_progress': False
                },
                {
                    'name': 'comprehensive',
                    'include_patterns': True,
                    'include_nutrition': True,
                    'include_progress': True
                }
            ]
            
            strategy_results = []
            for strategy in strategies:
                start_time = time.time()
                
                # Build context with strategy
                context = await self.context_builder.build_full_context(
                    test_user_id,
                    include_patterns=strategy['include_patterns'],
                    include_nutrition=strategy['include_nutrition'],
                    include_progress=strategy['include_progress']
                )
                
                response_time = time.time() - start_time
                context_size = len(json.dumps(context))
                estimated_tokens = context_size / 4  # Rough estimation
                
                strategy_results.append({
                    'strategy': strategy['name'],
                    'response_time': response_time,
                    'context_size': context_size,
                    'estimated_tokens': estimated_tokens,
                    'meets_token_limit': estimated_tokens < self.max_context_tokens
                })
            
            # Find optimal strategy
            optimal_strategy = min(strategy_results, key=lambda x: x['response_time'])
            
            return {
                'strategy_results': strategy_results,
                'optimal_strategy': optimal_strategy,
                'recommendations': {
                    'use_minimal_for_simple_queries': True,
                    'use_balanced_for_most_queries': True,
                    'use_comprehensive_for_complex_queries': False,
                    'cache_user_context': True
                },
                'optimization_timestamp': datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error optimizing context building: {e}")
            return {'error': str(e)}
    
    async def optimize_memory_retrieval(self) -> Dict[str, Any]:
        """Optimize memory retrieval performance"""
        try:
            logger.info("Optimizing memory retrieval performance...")
            
            test_user_id = "test-user-optimization"
            test_queries = [
                "strength training goals",
                "nutrition preferences",
                "workout schedule",
                "injury history",
                "fitness level"
            ]
            
            # Test different memory retrieval strategies
            strategies = [
                {'limit': 5, 'threshold': 0.5},
                {'limit': 10, 'threshold': 0.7},
                {'limit': 15, 'threshold': 0.6}
            ]
            
            strategy_results = []
            for strategy in strategies:
                total_time = 0
                total_memories = 0
                
                for query in test_queries:
                    start_time = time.time()
                    
                    memories = await self.memory_service.retrieve_relevant_memories(
                        test_user_id, 
                        query, 
                        {},
                        limit=strategy['limit'],
                        threshold=strategy['threshold']
                    )
                    
                    response_time = time.time() - start_time
                    total_time += response_time
                    total_memories += len(memories.get('memories', []))
                
                avg_time = total_time / len(test_queries)
                avg_memories = total_memories / len(test_queries)
                
                strategy_results.append({
                    'limit': strategy['limit'],
                    'threshold': strategy['threshold'],
                    'average_response_time': avg_time,
                    'average_memories_retrieved': avg_memories,
                    'efficiency_score': avg_memories / avg_time if avg_time > 0 else 0
                })
            
            # Find optimal strategy
            optimal_strategy = max(strategy_results, key=lambda x: x['efficiency_score'])
            
            return {
                'strategy_results': strategy_results,
                'optimal_strategy': optimal_strategy,
                'recommendations': {
                    'memory_limit': optimal_strategy['limit'],
                    'relevance_threshold': optimal_strategy['threshold'],
                    'cache_frequent_queries': True,
                    'batch_memory_retrieval': True
                },
                'optimization_timestamp': datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error optimizing memory retrieval: {e}")
            return {'error': str(e)}
    
    async def optimize_personalization(self) -> Dict[str, Any]:
        """Optimize personalization performance"""
        try:
            logger.info("Optimizing personalization performance...")
            
            test_user_id = "test-user-optimization"
            
            # Test personalization analysis performance
            start_time = time.time()
            preferences = await self.personalization_engine.analyze_user_preferences(test_user_id)
            analysis_time = time.time() - start_time
            
            # Test coaching style determination performance
            start_time = time.time()
            coaching_style = await self.personalization_engine.determine_optimal_coaching_style(
                test_user_id, 
                {"conversation_type": "workout_planning"}
            )
            style_time = time.time() - start_time
            
            # Test message adaptation performance
            test_message = "You should do more cardio to improve your endurance."
            start_time = time.time()
            adapted_message = await self.personalization_engine.adapt_coaching_message(
                test_user_id,
                test_message,
                "motivational",
                {"user_mood": "motivated"}
            )
            adaptation_time = time.time() - start_time
            
            total_time = analysis_time + style_time + adaptation_time
            
            return {
                'performance_metrics': {
                    'preference_analysis_time': analysis_time,
                    'coaching_style_time': style_time,
                    'message_adaptation_time': adaptation_time,
                    'total_personalization_time': total_time
                },
                'optimization_recommendations': {
                    'cache_user_preferences': True,
                    'batch_preference_analysis': True,
                    'precompute_coaching_styles': True,
                    'use_simplified_adaptation_for_simple_messages': True
                },
                'meets_target': total_time < self.target_response_time,
                'optimization_timestamp': datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error optimizing personalization: {e}")
            return {'error': str(e)}
    
    async def optimize_conversation_management(self) -> Dict[str, Any]:
        """Optimize conversation management performance"""
        try:
            logger.info("Optimizing conversation management performance...")
            
            test_user_id = "test-user-optimization"
            test_conversation_id = "test-conversation-optimization"
            
            # Test conversation summarization performance
            start_time = time.time()
            summary = await self.conversation_service.summarize_conversation(
                test_user_id, 
                test_conversation_id
            )
            summarization_time = time.time() - start_time
            
            # Test enhanced context building performance
            start_time = time.time()
            enhanced_context = await self.conversation_service.build_enhanced_context(
                test_user_id,
                test_conversation_id,
                include_memories=True,
                include_summary=True
            )
            context_time = time.time() - start_time
            
            # Test auto-summarization performance
            start_time = time.time()
            auto_summary = await self.conversation_service.auto_summarize_if_needed(
                test_user_id,
                test_conversation_id
            )
            auto_summary_time = time.time() - start_time
            
            return {
                'performance_metrics': {
                    'summarization_time': summarization_time,
                    'enhanced_context_time': context_time,
                    'auto_summarization_time': auto_summary_time
                },
                'optimization_recommendations': {
                    'async_summarization': True,
                    'cache_conversation_summaries': True,
                    'optimize_context_window_size': True,
                    'batch_conversation_operations': True
                },
                'optimization_timestamp': datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error optimizing conversation management: {e}")
            return {'error': str(e)}
    
    async def implement_caching_strategy(self) -> Dict[str, Any]:
        """Implement caching strategy for performance optimization"""
        try:
            logger.info("Implementing caching strategy...")
            
            cache_strategies = {
                'user_preferences': {
                    'ttl': 3600,  # 1 hour
                    'max_size': 1000,
                    'description': 'Cache user preference analysis results'
                },
                'rag_context': {
                    'ttl': 1800,  # 30 minutes
                    'max_size': 500,
                    'description': 'Cache RAG context for similar queries'
                },
                'conversation_summaries': {
                    'ttl': 7200,  # 2 hours
                    'max_size': 200,
                    'description': 'Cache conversation summaries'
                },
                'memory_retrieval': {
                    'ttl': 900,  # 15 minutes
                    'max_size': 1000,
                    'description': 'Cache memory retrieval results'
                }
            }
            
            # Test cache performance
            cache_performance = {}
            for cache_type, config in cache_strategies.items():
                # Simulate cache operations
                cache_hits = 0
                cache_misses = 0
                
                # Simulate 100 operations
                for i in range(100):
                    cache_key = f"{cache_type}_{i % 10}"  # 10 unique keys
                    
                    if cache_key in self.cache:
                        cache_hits += 1
                    else:
                        cache_misses += 1
                        # Simulate cache storage
                        self.cache[cache_key] = f"cached_data_{i}"
                        self.cache_timestamps[cache_key] = time.time()
                
                hit_rate = cache_hits / (cache_hits + cache_misses)
                cache_performance[cache_type] = {
                    'hit_rate': hit_rate,
                    'config': config
                }
            
            return {
                'cache_strategies': cache_strategies,
                'cache_performance': cache_performance,
                'implementation_recommendations': {
                    'implement_redis_cache': True,
                    'use_memory_cache_for_frequent_access': True,
                    'implement_cache_invalidation': True,
                    'monitor_cache_hit_rates': True
                },
                'optimization_timestamp': datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error implementing caching strategy: {e}")
            return {'error': str(e)}
    
    async def optimize_token_usage(self) -> Dict[str, Any]:
        """Optimize token usage for cost efficiency"""
        try:
            logger.info("Optimizing token usage...")
            
            # Test different prompt optimization strategies
            strategies = [
                {
                    'name': 'minimal_prompt',
                    'system_prompt_length': 200,
                    'context_limit': 1000,
                    'response_limit': 500
                },
                {
                    'name': 'balanced_prompt',
                    'system_prompt_length': 400,
                    'context_limit': 1500,
                    'response_limit': 800
                },
                {
                    'name': 'comprehensive_prompt',
                    'system_prompt_length': 600,
                    'context_limit': 2000,
                    'response_limit': 1200
                }
            ]
            
            token_usage_results = []
            for strategy in strategies:
                # Estimate token usage
                total_tokens = (
                    strategy['system_prompt_length'] +
                    strategy['context_limit'] +
                    strategy['response_limit']
                )
                
                # Estimate cost (DeepSeek R1 pricing)
                input_cost = (strategy['system_prompt_length'] + strategy['context_limit']) * 0.27 / 1000000
                output_cost = strategy['response_limit'] * 1.10 / 1000000
                total_cost = input_cost + output_cost
                
                token_usage_results.append({
                    'strategy': strategy['name'],
                    'total_tokens': total_tokens,
                    'estimated_cost': total_cost,
                    'efficiency_score': 1 / total_cost if total_cost > 0 else 0
                })
            
            # Find optimal strategy
            optimal_strategy = max(token_usage_results, key=lambda x: x['efficiency_score'])
            
            return {
                'token_usage_results': token_usage_results,
                'optimal_strategy': optimal_strategy,
                'optimization_recommendations': {
                    'use_minimal_prompts_for_simple_queries': True,
                    'implement_context_pruning': True,
                    'use_response_templates': True,
                    'batch_similar_requests': True,
                    'implement_token_budget_per_user': True
                },
                'cost_optimization_timestamp': datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error optimizing token usage: {e}")
            return {'error': str(e)}
    
    async def run_comprehensive_optimization(self) -> Dict[str, Any]:
        """Run comprehensive performance optimization"""
        try:
            logger.info("Starting comprehensive performance optimization...")
            
            optimization_results = {}
            
            # Run all optimizations
            optimization_results['rag_performance'] = await self.optimize_rag_performance()
            optimization_results['context_building'] = await self.optimize_context_building()
            optimization_results['memory_retrieval'] = await self.optimize_memory_retrieval()
            optimization_results['personalization'] = await self.optimize_personalization()
            optimization_results['conversation_management'] = await self.optimize_conversation_management()
            optimization_results['caching_strategy'] = await self.implement_caching_strategy()
            optimization_results['token_usage'] = await self.optimize_token_usage()
            
            # Generate overall recommendations
            overall_recommendations = self._generate_overall_recommendations(optimization_results)
            
            return {
                'optimization_results': optimization_results,
                'overall_recommendations': overall_recommendations,
                'optimization_summary': {
                    'total_optimizations': len(optimization_results),
                    'successful_optimizations': len([r for r in optimization_results.values() if 'error' not in r]),
                    'optimization_timestamp': datetime.now(timezone.utc).isoformat()
                }
            }
            
        except Exception as e:
            logger.error(f"Error in comprehensive optimization: {e}")
            return {'error': str(e)}
    
    def _generate_overall_recommendations(self, optimization_results: Dict[str, Any]) -> Dict[str, Any]:
        """Generate overall optimization recommendations"""
        recommendations = {
            'immediate_actions': [],
            'medium_term_improvements': [],
            'long_term_optimizations': [],
            'monitoring_recommendations': []
        }
        
        # Immediate actions
        recommendations['immediate_actions'] = [
            'Implement caching for user preferences and RAG context',
            'Optimize vector search limits and similarity thresholds',
            'Use minimal context building for simple queries',
            'Implement token budget per user to control costs'
        ]
        
        # Medium term improvements
        recommendations['medium_term_improvements'] = [
            'Implement Redis cache for better performance',
            'Add async processing for non-real-time features',
            'Implement context pruning and summarization',
            'Add batch processing for similar requests'
        ]
        
        # Long term optimizations
        recommendations['long_term_optimizations'] = [
            'Implement hybrid search (vector + keyword)',
            'Add predictive caching based on user patterns',
            'Implement model fine-tuning for specific use cases',
            'Add edge computing for frequently accessed data'
        ]
        
        # Monitoring recommendations
        recommendations['monitoring_recommendations'] = [
            'Monitor response times and set up alerts',
            'Track token usage and costs per user',
            'Monitor cache hit rates and optimize accordingly',
            'Set up performance dashboards for key metrics'
        ]
        
        return recommendations

async def main():
    """Main function to run performance optimization"""
    try:
        optimizer = PerformanceOptimizer()
        
        logger.info("Starting AI Service Performance Optimization...")
        
        # Run comprehensive optimization
        results = await optimizer.run_comprehensive_optimization()
        
        if 'error' in results:
            logger.error(f"Optimization failed: {results['error']}")
            return
        
        # Save results
        results_file = f"optimization_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(results_file, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        
        logger.info(f"Optimization completed successfully!")
        logger.info(f"Results saved to: {results_file}")
        
        # Print summary
        summary = results['optimization_summary']
        logger.info(f"Total optimizations: {summary['total_optimizations']}")
        logger.info(f"Successful optimizations: {summary['successful_optimizations']}")
        
        # Print key recommendations
        overall_recs = results['overall_recommendations']
        logger.info("Key Recommendations:")
        for category, recs in overall_recs.items():
            logger.info(f"{category.replace('_', ' ').title()}:")
            for rec in recs:
                logger.info(f"  - {rec}")
        
    except Exception as e:
        logger.error(f"Error in main optimization: {e}")

if __name__ == "__main__":
    asyncio.run(main())
