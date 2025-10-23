#!/usr/bin/env python3
"""
Comprehensive Test Suite for AI Service Enhancement
Tests all modules and their integration
"""

import os
import json
import asyncio
import pytest
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone
from unittest.mock import Mock, patch, AsyncMock
import boto3
from moto import mock_dynamodb, mock_s3, mock_events

# Import our services
from s3_vectors_service import S3VectorsService
from embedding_service import EmbeddingService
from rag_service import RAGService
from context_builder import ContextBuilder
from pattern_analyzer import PatternAnalyzer
from user_data_service import UserDataService
from proactive_coach_service import ProactiveCoachService
from progress_monitor import ProgressMonitor
from workout_adaptation_service import WorkoutAdaptationService
from performance_analyzer import PerformanceAnalyzer
from exercise_substitution import ExerciseSubstitutionService
from nutrition_intelligence import NutritionIntelligence
from macro_optimizer import MacroOptimizer
from meal_timing_service import MealTimingService
from memory_service import MemoryService
from personalization_engine import PersonalizationEngine
from conversation_service import ConversationService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TestConfig:
    """Test configuration"""
    TEST_TABLE_NAME = "test-gymcoach-ai-main"
    TEST_VECTORS_BUCKET = "test-gymcoach-ai-vectors"
    TEST_USER_ID = "test-user-123"
    TEST_CONVERSATION_ID = "test-conversation-456"
    
    # Mock data
    MOCK_USER_PROFILE = {
        "userId": TEST_USER_ID,
        "name": "Test User",
        "email": "test@example.com",
        "fitnessLevel": "intermediate",
        "goals": ["strength", "muscle_gain"],
        "preferences": {
            "workoutFrequency": 4,
            "workoutDuration": 60,
            "preferredTime": "morning"
        }
    }
    
    MOCK_WORKOUT_DATA = [
        {
            "workoutId": "workout-1",
            "userId": TEST_USER_ID,
            "date": "2024-01-01",
            "exercises": [
                {"name": "Push-ups", "sets": 3, "reps": 15, "weight": 0},
                {"name": "Squats", "sets": 3, "reps": 12, "weight": 0}
            ],
            "duration": 45,
            "completed": True
        }
    ]
    
    MOCK_NUTRITION_DATA = {
        "dailyGoals": {
            "calories": 2500,
            "protein": 150,
            "carbs": 300,
            "fat": 80
        },
        "meals": [
            {
                "mealId": "meal-1",
                "name": "Breakfast",
                "foods": [
                    {"name": "Oatmeal", "calories": 300, "protein": 10},
                    {"name": "Banana", "calories": 100, "protein": 1}
                ]
            }
        ]
    }

class TestS3VectorsService:
    """Test S3 Vectors Service"""
    
    @pytest.fixture
    def s3_vectors_service(self):
        return S3VectorsService()
    
    @pytest.mark.asyncio
    async def test_put_vector(self, s3_vectors_service):
        """Test vector storage"""
        vector_id = "test-vector-1"
        vector = [0.1, 0.2, 0.3, 0.4, 0.5]
        metadata = {"type": "test", "content": "test content"}
        namespace = "test"
        
        result = await s3_vectors_service.put_vector(vector_id, vector, metadata, namespace)
        
        assert result is True
    
    @pytest.mark.asyncio
    async def test_get_vector(self, s3_vectors_service):
        """Test vector retrieval"""
        vector_id = "test-vector-1"
        namespace = "test"
        
        result = await s3_vectors_service.get_vector(vector_id, namespace)
        
        assert result is not None
        assert "vector" in result
        assert "metadata" in result
    
    @pytest.mark.asyncio
    async def test_search_vectors(self, s3_vectors_service):
        """Test vector search"""
        query_vector = [0.1, 0.2, 0.3, 0.4, 0.5]
        namespace = "test"
        limit = 5
        
        results = await s3_vectors_service.search_vectors(query_vector, namespace, limit)
        
        assert isinstance(results, list)
        assert len(results) <= limit

class TestEmbeddingService:
    """Test Embedding Service"""
    
    @pytest.fixture
    def embedding_service(self):
        return EmbeddingService()
    
    @pytest.mark.asyncio
    async def test_get_embedding(self, embedding_service):
        """Test embedding generation"""
        text = "Test text for embedding"
        
        embedding = await embedding_service.get_embedding(text)
        
        assert embedding is not None
        assert isinstance(embedding, list)
        assert len(embedding) > 0
    
    @pytest.mark.asyncio
    async def test_get_exercise_embedding(self, embedding_service):
        """Test exercise-specific embedding"""
        exercise_text = "Push-ups: Classic bodyweight exercise targeting chest, shoulders, and triceps"
        
        embedding = await embedding_service.get_exercise_embedding(exercise_text)
        
        assert embedding is not None
        assert isinstance(embedding, list)
    
    @pytest.mark.asyncio
    async def test_calculate_embedding_cost(self, embedding_service):
        """Test cost calculation"""
        text = "Test text for cost calculation"
        
        cost = embedding_service.calculate_embedding_cost(text)
        
        assert cost > 0
        assert isinstance(cost, float)

class TestRAGService:
    """Test RAG Service"""
    
    @pytest.fixture
    def rag_service(self):
        return RAGService()
    
    @pytest.mark.asyncio
    async def test_retrieve_relevant_context(self, rag_service):
        """Test context retrieval"""
        query = "How to do push-ups correctly?"
        user_context = {"fitnessLevel": "beginner"}
        
        context = await rag_service.retrieve_relevant_context(query, user_context)
        
        assert context is not None
        assert "sources" in context
        assert "context" in context
    
    @pytest.mark.asyncio
    async def test_validate_rag_setup(self, rag_service):
        """Test RAG setup validation"""
        validation = await rag_service.validate_rag_setup()
        
        assert validation is not None
        assert "status" in validation
    
    @pytest.mark.asyncio
    async def test_get_rag_stats(self, rag_service):
        """Test RAG statistics"""
        stats = await rag_service.get_rag_stats()
        
        assert stats is not None
        assert "total_vectors" in stats

class TestContextBuilder:
    """Test Context Builder"""
    
    @pytest.fixture
    def context_builder(self):
        return ContextBuilder()
    
    @pytest.mark.asyncio
    async def test_build_full_context(self, context_builder):
        """Test full context building"""
        user_id = TestConfig.TEST_USER_ID
        
        context = await context_builder.build_full_context(user_id)
        
        assert context is not None
        assert isinstance(context, dict)
        assert "user_profile" in context
        assert "fitness_analysis" in context
        assert "nutrition_analysis" in context
    
    @pytest.mark.asyncio
    async def test_build_user_profile_context(self, context_builder):
        """Test user profile context building"""
        user_id = TestConfig.TEST_USER_ID
        
        context = await context_builder.build_user_profile_context(user_id)
        
        assert context is not None
        assert "user_id" in context
        assert "profile" in context

class TestPatternAnalyzer:
    """Test Pattern Analyzer"""
    
    @pytest.fixture
    def pattern_analyzer(self):
        return PatternAnalyzer()
    
    @pytest.mark.asyncio
    async def test_analyze_workout_patterns(self, pattern_analyzer):
        """Test workout pattern analysis"""
        user_id = TestConfig.TEST_USER_ID
        days = 30
        
        patterns = await pattern_analyzer.analyze_workout_patterns(user_id, days)
        
        assert patterns is not None
        assert isinstance(patterns, dict)
        assert "frequency" in patterns
        assert "consistency" in patterns
    
    @pytest.mark.asyncio
    async def test_analyze_nutrition_patterns(self, pattern_analyzer):
        """Test nutrition pattern analysis"""
        user_id = TestConfig.TEST_USER_ID
        days = 14
        
        patterns = await pattern_analyzer.analyze_nutrition_patterns(user_id, days)
        
        assert patterns is not None
        assert isinstance(patterns, dict)
        assert "macro_distribution" in patterns
        assert "meal_timing" in patterns

class TestProactiveCoachService:
    """Test Proactive Coach Service"""
    
    @pytest.fixture
    def proactive_coach_service(self):
        return ProactiveCoachService()
    
    @pytest.mark.asyncio
    async def test_handle_proactive_checkin(self, proactive_coach_service):
        """Test proactive check-in handling"""
        event = {
            "source": "proactive-checkin",
            "action": "checkin",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        result = await proactive_coach_service.handle_proactive_checkin(event)
        
        assert result is not None
        assert "status" in result
    
    @pytest.mark.asyncio
    async def test_handle_progress_monitoring(self, proactive_coach_service):
        """Test progress monitoring handling"""
        event = {
            "source": "progress-monitor",
            "action": "monitor",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        result = await proactive_coach_service.handle_progress_monitoring(event)
        
        assert result is not None
        assert "status" in result

class TestWorkoutAdaptationService:
    """Test Workout Adaptation Service"""
    
    @pytest.fixture
    def workout_adaptation_service(self):
        return WorkoutAdaptationService()
    
    @pytest.mark.asyncio
    async def test_adapt_workout_plan(self, workout_adaptation_service):
        """Test workout plan adaptation"""
        user_id = TestConfig.TEST_USER_ID
        current_plan = TestConfig.MOCK_WORKOUT_DATA[0]
        progress_data = {"strength_gain": 0.1, "endurance_improvement": 0.05}
        
        adaptation = await workout_adaptation_service.adapt_workout_plan(user_id, current_plan, progress_data)
        
        assert adaptation is not None
        assert "adaptations" in adaptation
        assert "reasoning" in adaptation
    
    @pytest.mark.asyncio
    async def test_assess_injury_risk(self, workout_adaptation_service):
        """Test injury risk assessment"""
        user_id = TestConfig.TEST_USER_ID
        
        risk_assessment = await workout_adaptation_service.assess_injury_risk(user_id)
        
        assert risk_assessment is not None
        assert "risk_level" in risk_assessment
        assert "risk_factors" in risk_assessment
        assert "recommendations" in risk_assessment

class TestNutritionIntelligence:
    """Test Nutrition Intelligence"""
    
    @pytest.fixture
    def nutrition_intelligence(self):
        return NutritionIntelligence()
    
    @pytest.mark.asyncio
    async def test_analyze_nutrition_adherence(self, nutrition_intelligence):
        """Test nutrition adherence analysis"""
        user_id = TestConfig.TEST_USER_ID
        days = 14
        
        analysis = await nutrition_intelligence.analyze_nutrition_adherence(user_id, days)
        
        assert analysis is not None
        assert "adherence_score" in analysis
        assert "macro_analysis" in analysis
    
    @pytest.mark.asyncio
    async def test_suggest_nutrition_adjustments(self, nutrition_intelligence):
        """Test nutrition adjustment suggestions"""
        user_id = TestConfig.TEST_USER_ID
        current_plan = TestConfig.MOCK_NUTRITION_DATA
        
        adjustments = await nutrition_intelligence.suggest_nutrition_adjustments(user_id, current_plan)
        
        assert adjustments is not None
        assert "adjustments" in adjustments
        assert "reasoning" in adjustments

class TestMemoryService:
    """Test Memory Service"""
    
    @pytest.fixture
    def memory_service(self):
        return MemoryService()
    
    @pytest.mark.asyncio
    async def test_store_conversation_memory(self, memory_service):
        """Test conversation memory storage"""
        user_id = TestConfig.TEST_USER_ID
        conversation_data = {
            "messages": [
                {"role": "user", "content": "I want to get stronger"},
                {"role": "assistant", "content": "Great goal! Let's create a strength training plan."}
            ],
            "context": {"topic": "goal_setting"}
        }
        
        result = await memory_service.store_conversation_memory(user_id, conversation_data)
        
        assert result is not None
        assert "conversation_stored" in result
        assert "memories_extracted" in result
    
    @pytest.mark.asyncio
    async def test_retrieve_relevant_memories(self, memory_service):
        """Test memory retrieval"""
        user_id = TestConfig.TEST_USER_ID
        query = "strength training goals"
        context = {"conversation_type": "workout_planning"}
        
        memories = await memory_service.retrieve_relevant_memories(user_id, query, context)
        
        assert memories is not None
        assert "memories" in memories
        assert isinstance(memories["memories"], list)

class TestPersonalizationEngine:
    """Test Personalization Engine"""
    
    @pytest.fixture
    def personalization_engine(self):
        return PersonalizationEngine()
    
    @pytest.mark.asyncio
    async def test_analyze_user_preferences(self, personalization_engine):
        """Test user preference analysis"""
        user_id = TestConfig.TEST_USER_ID
        
        preferences = await personalization_engine.analyze_user_preferences(user_id)
        
        assert preferences is not None
        assert "communication_style" in preferences
        assert "motivation_type" in preferences
        assert "confidence_score" in preferences
    
    @pytest.mark.asyncio
    async def test_determine_optimal_coaching_style(self, personalization_engine):
        """Test coaching style determination"""
        user_id = TestConfig.TEST_USER_ID
        context = {"conversation_type": "motivation", "user_mood": "frustrated"}
        
        style = await personalization_engine.determine_optimal_coaching_style(user_id, context)
        
        assert style is not None
        assert "optimal_style" in style
        assert "style_scores" in style
        assert "adaptation_reasoning" in style

class TestConversationService:
    """Test Enhanced Conversation Service"""
    
    @pytest.fixture
    def conversation_service(self):
        return ConversationService(TestConfig.TEST_TABLE_NAME)
    
    @pytest.mark.asyncio
    async def test_create_conversation_thread(self, conversation_service):
        """Test conversation thread creation"""
        user_id = TestConfig.TEST_USER_ID
        conversation_id = TestConfig.TEST_CONVERSATION_ID
        thread_topic = "strength training"
        
        thread = await conversation_service.create_conversation_thread(user_id, conversation_id, thread_topic)
        
        assert thread is not None
        assert "success" in thread
        assert "threadId" in thread
    
    @pytest.mark.asyncio
    async def test_summarize_conversation(self, conversation_service):
        """Test conversation summarization"""
        user_id = TestConfig.TEST_USER_ID
        conversation_id = TestConfig.TEST_CONVERSATION_ID
        
        summary = await conversation_service.summarize_conversation(user_id, conversation_id)
        
        assert summary is not None
        assert "summary" in summary or "error" in summary
    
    @pytest.mark.asyncio
    async def test_build_enhanced_context(self, conversation_service):
        """Test enhanced context building"""
        user_id = TestConfig.TEST_USER_ID
        conversation_id = TestConfig.TEST_CONVERSATION_ID
        
        context = await conversation_service.build_enhanced_context(user_id, conversation_id)
        
        assert context is not None
        assert "conversation_context" in context
        assert "relevant_memories" in context
        assert "conversation_summary" in context

class TestIntegration:
    """Integration Tests"""
    
    @pytest.mark.asyncio
    async def test_end_to_end_chat_flow(self):
        """Test complete chat flow with all modules"""
        # This would test the complete flow from user message to AI response
        # including RAG retrieval, context building, memory storage, and personalization
        
        user_id = TestConfig.TEST_USER_ID
        message = "I want to start strength training but I'm not sure where to begin"
        
        # Mock the complete flow
        # 1. RAG retrieval
        rag_service = RAGService()
        rag_context = await rag_service.retrieve_relevant_context(message, {"fitnessLevel": "beginner"})
        
        # 2. Context building
        context_builder = ContextBuilder()
        user_context = await context_builder.build_full_context(user_id)
        
        # 3. Memory retrieval
        memory_service = MemoryService()
        memories = await memory_service.retrieve_relevant_memories(user_id, message, {})
        
        # 4. Personalization
        personalization_engine = PersonalizationEngine()
        coaching_style = await personalization_engine.determine_optimal_coaching_style(user_id, {})
        
        # 5. Memory storage (would happen after response)
        conversation_data = {
            "messages": [{"role": "user", "content": message}],
            "context": {"topic": "workout_planning"}
        }
        memory_result = await memory_service.store_conversation_memory(user_id, conversation_data)
        
        # Assertions
        assert rag_context is not None
        assert user_context is not None
        assert memories is not None
        assert coaching_style is not None
        assert memory_result is not None
    
    @pytest.mark.asyncio
    async def test_proactive_coaching_flow(self):
        """Test proactive coaching flow"""
        # Test the complete proactive coaching flow
        
        # 1. Progress monitoring
        progress_monitor = ProgressMonitor()
        monitoring_result = await progress_monitor.monitor_user_progress(TestConfig.TEST_USER_ID)
        
        # 2. Proactive coaching
        proactive_coach_service = ProactiveCoachService()
        event = {
            "source": "progress-monitor",
            "action": "monitor",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        coaching_result = await proactive_coach_service.handle_progress_monitoring(event)
        
        # Assertions
        assert monitoring_result is not None
        assert coaching_result is not None

class TestPerformance:
    """Performance Tests"""
    
    @pytest.mark.asyncio
    async def test_response_time_requirements(self):
        """Test that response times meet requirements (<3s p95)"""
        import time
        
        # Test RAG service response time
        start_time = time.time()
        rag_service = RAGService()
        await rag_service.retrieve_relevant_context("test query", {})
        rag_time = time.time() - start_time
        
        # Test context building response time
        start_time = time.time()
        context_builder = ContextBuilder()
        await context_builder.build_full_context(TestConfig.TEST_USER_ID)
        context_time = time.time() - start_time
        
        # Test memory service response time
        start_time = time.time()
        memory_service = MemoryService()
        await memory_service.retrieve_relevant_memories(TestConfig.TEST_USER_ID, "test", {})
        memory_time = time.time() - start_time
        
        # Assertions (should be well under 3 seconds)
        assert rag_time < 3.0, f"RAG service took {rag_time:.2f}s"
        assert context_time < 3.0, f"Context building took {context_time:.2f}s"
        assert memory_time < 3.0, f"Memory service took {memory_time:.2f}s"
    
    @pytest.mark.asyncio
    async def test_concurrent_requests(self):
        """Test handling of concurrent requests"""
        import asyncio
        
        # Create multiple concurrent requests
        tasks = []
        for i in range(10):
            task = asyncio.create_task(self._mock_request(i))
            tasks.append(task)
        
        # Wait for all requests to complete
        results = await asyncio.gather(*tasks)
        
        # Assertions
        assert len(results) == 10
        assert all(result is not None for result in results)
    
    async def _mock_request(self, request_id):
        """Mock request for concurrent testing"""
        rag_service = RAGService()
        return await rag_service.retrieve_relevant_context(f"test query {request_id}", {})

class TestCostOptimization:
    """Cost Optimization Tests"""
    
    @pytest.mark.asyncio
    async def test_token_usage_optimization(self):
        """Test that token usage is optimized"""
        # Test context building efficiency
        context_builder = ContextBuilder()
        context = await context_builder.build_full_context(TestConfig.TEST_USER_ID)
        
        # Estimate token usage (rough approximation: 1 token ≈ 4 characters)
        context_text = json.dumps(context)
        estimated_tokens = len(context_text) / 4
        
        # Should be reasonable for context (under 2000 tokens)
        assert estimated_tokens < 2000, f"Context too large: {estimated_tokens} tokens"
    
    @pytest.mark.asyncio
    async def test_embedding_cost_calculation(self):
        """Test embedding cost calculation"""
        embedding_service = EmbeddingService()
        
        # Test cost calculation for different text lengths
        short_text = "Push-ups"
        long_text = "Push-ups are a classic bodyweight exercise that targets the chest, shoulders, and triceps. They can be modified for different fitness levels and require no equipment."
        
        short_cost = embedding_service.calculate_embedding_cost(short_text)
        long_cost = embedding_service.calculate_embedding_cost(long_text)
        
        # Costs should be reasonable
        assert short_cost < 0.01, f"Short text cost too high: {short_cost}"
        assert long_cost < 0.01, f"Long text cost too high: {long_cost}"
        assert long_cost > short_cost, "Longer text should cost more"

if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v", "--tb=short"])
