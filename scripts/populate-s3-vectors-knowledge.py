#!/usr/bin/env python3
"""
S3 Vectors Knowledge Population Script
Populates S3 Vectors with comprehensive fitness knowledge including exercises, nutrition, and research
"""

import os
import json
import logging
import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime
import boto3
from botocore.exceptions import ClientError

# Import our services
from embedding_service import EmbeddingService
from s3_vectors_service import S3VectorsService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class KnowledgePopulationService:
    """Service for populating S3 Vectors with comprehensive fitness knowledge"""
    
    def __init__(self):
        self.vectors_bucket = os.environ.get('VECTORS_BUCKET', 'gymcoach-ai-vectors')
        self.embedding_service = EmbeddingService()
        self.s3_vectors_service = S3VectorsService()
        
    async def populate_all_knowledge(self) -> Dict[str, Any]:
        """Populate S3 Vectors with all knowledge types"""
        try:
            logger.info("Starting comprehensive knowledge population...")
            
            results = {
                'total_items': 0,
                'successful_embeddings': 0,
                'failed_embeddings': 0,
                'errors': [],
                'categories': {}
            }
            
            # Populate exercise knowledge
            logger.info("Populating exercise knowledge...")
            exercise_results = await self._populate_exercise_knowledge()
            results['successful_embeddings'] += exercise_results['successful']
            results['failed_embeddings'] += exercise_results['failed']
            results['errors'].extend(exercise_results['errors'])
            results['categories']['exercises'] = exercise_results['total']
            
            # Populate nutrition knowledge
            logger.info("Populating nutrition knowledge...")
            nutrition_results = await self._populate_nutrition_knowledge()
            results['successful_embeddings'] += nutrition_results['successful']
            results['failed_embeddings'] += nutrition_results['failed']
            results['errors'].extend(nutrition_results['errors'])
            results['categories']['nutrition'] = nutrition_results['total']
            
            # Populate fitness research knowledge
            logger.info("Populating fitness research knowledge...")
            research_results = await self._populate_research_knowledge()
            results['successful_embeddings'] += research_results['successful']
            results['failed_embeddings'] += research_results['failed']
            results['errors'].extend(research_results['errors'])
            results['categories']['research'] = research_results['total']
            
            # Populate injury prevention knowledge
            logger.info("Populating injury prevention knowledge...")
            injury_results = await self._populate_injury_knowledge()
            results['successful_embeddings'] += injury_results['successful']
            results['failed_embeddings'] += injury_results['failed']
            results['errors'].extend(injury_results['errors'])
            results['categories']['injury_prevention'] = injury_results['total']
            
            # Populate training methodology knowledge
            logger.info("Populating training methodology knowledge...")
            training_results = await self._populate_training_knowledge()
            results['successful_embeddings'] += training_results['successful']
            results['failed_embeddings'] += training_results['failed']
            results['errors'].extend(training_results['errors'])
            results['categories']['training_methodology'] = training_results['total']
            
            results['total_items'] = sum(results['categories'].values())
            
            logger.info(f"Knowledge population completed. Total: {results['total_items']}, Success: {results['successful_embeddings']}, Failed: {results['failed_embeddings']}")
            
            return results
            
        except Exception as e:
            logger.error(f"Error populating knowledge: {e}")
            return {'error': str(e)}
    
    async def _populate_exercise_knowledge(self) -> Dict[str, Any]:
        """Populate exercise knowledge"""
        try:
            # Import exercise knowledge builder
            import sys
            sys.path.append('/Users/babar/projects/gymcoach-ai/scripts')
            from exercise_knowledge_builder import ExerciseKnowledgeBuilder
            
            builder = ExerciseKnowledgeBuilder()
            exercise_library = await builder.build_exercise_library()
            
            if 'error' in exercise_library:
                return {'error': exercise_library['error'], 'total': 0, 'successful': 0, 'failed': 0, 'errors': []}
            
            # Populate S3 Vectors
            population_results = await builder.populate_s3_vectors(exercise_library['exercises'])
            
            return {
                'total': exercise_library['total_exercises'],
                'successful': population_results.get('successful_embeddings', 0),
                'failed': population_results.get('failed_embeddings', 0),
                'errors': population_results.get('errors', [])
            }
            
        except Exception as e:
            logger.error(f"Error populating exercise knowledge: {e}")
            return {'error': str(e), 'total': 0, 'successful': 0, 'failed': 0, 'errors': []}
    
    async def _populate_nutrition_knowledge(self) -> Dict[str, Any]:
        """Populate nutrition knowledge"""
        try:
            # Import nutrition knowledge builder
            import sys
            sys.path.append('/Users/babar/projects/gymcoach-ai/scripts')
            from nutrition_knowledge_builder import NutritionKnowledgeBuilder
            
            builder = NutritionKnowledgeBuilder()
            nutrition_database = await builder.build_nutrition_database()
            
            if 'error' in nutrition_database:
                return {'error': nutrition_database['error'], 'total': 0, 'successful': 0, 'failed': 0, 'errors': []}
            
            # Populate S3 Vectors
            population_results = await builder.populate_s3_vectors(nutrition_database['items'])
            
            return {
                'total': nutrition_database['total_items'],
                'successful': population_results.get('successful_embeddings', 0),
                'failed': population_results.get('failed_embeddings', 0),
                'errors': population_results.get('errors', [])
            }
            
        except Exception as e:
            logger.error(f"Error populating nutrition knowledge: {e}")
            return {'error': str(e), 'total': 0, 'successful': 0, 'failed': 0, 'errors': []}
    
    async def _populate_research_knowledge(self) -> Dict[str, Any]:
        """Populate fitness research knowledge"""
        try:
            research_articles = await self._generate_fitness_research()
            
            results = {
                'total': len(research_articles),
                'successful': 0,
                'failed': 0,
                'errors': []
            }
            
            # Process research articles in batches
            batch_size = 20
            for i in range(0, len(research_articles), batch_size):
                batch = research_articles[i:i + batch_size]
                batch_results = await self._process_research_batch(batch)
                
                results['successful'] += batch_results['successful']
                results['failed'] += batch_results['failed']
                results['errors'].extend(batch_results['errors'])
                
                logger.info(f"Processed research batch {i//batch_size + 1}/{(len(research_articles) + batch_size - 1)//batch_size}")
            
            return results
            
        except Exception as e:
            logger.error(f"Error populating research knowledge: {e}")
            return {'error': str(e), 'total': 0, 'successful': 0, 'failed': 0, 'errors': []}
    
    async def _populate_injury_knowledge(self) -> Dict[str, Any]:
        """Populate injury prevention knowledge"""
        try:
            injury_knowledge = await self._generate_injury_knowledge()
            
            results = {
                'total': len(injury_knowledge),
                'successful': 0,
                'failed': 0,
                'errors': []
            }
            
            # Process injury knowledge in batches
            batch_size = 20
            for i in range(0, len(injury_knowledge), batch_size):
                batch = injury_knowledge[i:i + batch_size]
                batch_results = await self._process_injury_batch(batch)
                
                results['successful'] += batch_results['successful']
                results['failed'] += batch_results['failed']
                results['errors'].extend(batch_results['errors'])
                
                logger.info(f"Processed injury batch {i//batch_size + 1}/{(len(injury_knowledge) + batch_size - 1)//batch_size}")
            
            return results
            
        except Exception as e:
            logger.error(f"Error populating injury knowledge: {e}")
            return {'error': str(e), 'total': 0, 'successful': 0, 'failed': 0, 'errors': []}
    
    async def _populate_training_knowledge(self) -> Dict[str, Any]:
        """Populate training methodology knowledge"""
        try:
            training_knowledge = await self._generate_training_knowledge()
            
            results = {
                'total': len(training_knowledge),
                'successful': 0,
                'failed': 0,
                'errors': []
            }
            
            # Process training knowledge in batches
            batch_size = 20
            for i in range(0, len(training_knowledge), batch_size):
                batch = training_knowledge[i:i + batch_size]
                batch_results = await self._process_training_batch(batch)
                
                results['successful'] += batch_results['successful']
                results['failed'] += batch_results['failed']
                results['errors'].extend(batch_results['errors'])
                
                logger.info(f"Processed training batch {i//batch_size + 1}/{(len(training_knowledge) + batch_size - 1)//batch_size}")
            
            return results
            
        except Exception as e:
            logger.error(f"Error populating training knowledge: {e}")
            return {'error': str(e), 'total': 0, 'successful': 0, 'failed': 0, 'errors': []}
    
    async def _generate_fitness_research(self) -> List[Dict[str, Any]]:
        """Generate fitness research articles"""
        research_articles = [
            {
                'title': 'Progressive Overload Principles',
                'category': 'training_methodology',
                'topic': 'progressive_overload',
                'description': 'Fundamental principles of progressive overload in strength training',
                'content': """
                Progressive overload is the cornerstone of strength training and muscle development. 
                It involves gradually increasing the demands placed on the body to continue making gains.
                
                Key Principles:
                1. Increase weight gradually (2.5-5% per week)
                2. Add repetitions to existing sets
                3. Increase training volume (sets x reps x weight)
                4. Improve exercise technique and range of motion
                5. Reduce rest periods between sets
                
                Application:
                - Beginners: Focus on technique and consistency
                - Intermediate: Systematic progression with periodization
                - Advanced: Advanced techniques like drop sets and supersets
                
                Monitoring:
                - Track workout logs consistently
                - Monitor recovery and performance
                - Adjust based on individual response
                """,
                'key_points': [
                    'Gradual progression prevents plateaus',
                    'Multiple progression methods available',
                    'Individual response varies',
                    'Consistent tracking essential'
                ],
                'references': ['Schoenfeld, B. (2010). The mechanisms of muscle hypertrophy']
            },
            {
                'title': 'Nutrition Timing for Performance',
                'category': 'nutrition',
                'topic': 'meal_timing',
                'description': 'Optimal nutrition timing for athletic performance and recovery',
                'content': """
                Nutrition timing plays a crucial role in optimizing performance and recovery.
                The timing of macronutrient intake can significantly impact training adaptations.
                
                Pre-Workout Nutrition (1-3 hours before):
                - Carbohydrates: 1-4g per kg body weight
                - Protein: 0.3-0.4g per kg body weight
                - Low fat and fiber to avoid GI distress
                - Examples: Banana with Greek yogurt, oatmeal with berries
                
                Post-Workout Nutrition (within 30 minutes):
                - Carbohydrates: 1-1.2g per kg body weight
                - Protein: 0.3-0.4g per kg body weight
                - High glycemic index carbs for rapid glycogen replenishment
                - Examples: Protein shake with banana, chocolate milk
                
                Daily Distribution:
                - 4-6 meals per day for optimal nutrient absorption
                - Consistent protein intake throughout the day
                - Carbohydrate timing around training sessions
                """,
                'key_points': [
                    'Pre-workout: Carbs and protein 1-3 hours before',
                    'Post-workout: Immediate carb and protein intake',
                    'Daily distribution matters for muscle protein synthesis',
                    'Individual tolerance varies'
                ],
                'references': ['Aragon, A. (2013). Nutrient timing revisited']
            },
            {
                'title': 'Recovery and Sleep Optimization',
                'category': 'recovery',
                'topic': 'sleep_optimization',
                'description': 'The role of sleep in athletic performance and recovery',
                'content': """
                Sleep is one of the most important factors in athletic performance and recovery.
                Quality sleep enhances physical performance, cognitive function, and immune health.
                
                Sleep Requirements:
                - Athletes: 7-9 hours per night
                - High-intensity training: 8-10 hours
                - Recovery from injury: Additional 1-2 hours
                
                Sleep Quality Factors:
                1. Consistent sleep schedule
                2. Cool, dark, quiet environment
                3. No screens 1 hour before bed
                4. Caffeine cutoff 6-8 hours before sleep
                5. Regular exercise (but not too close to bedtime)
                
                Performance Impact:
                - Reaction time decreases with poor sleep
                - Strength and power output reduced
                - Increased injury risk
                - Impaired decision-making
                
                Recovery Benefits:
                - Growth hormone release during deep sleep
                - Muscle protein synthesis optimization
                - Immune system restoration
                - Mental recovery and stress reduction
                """,
                'key_points': [
                    'Athletes need 7-9 hours of quality sleep',
                    'Sleep quality affects performance more than quantity',
                    'Consistent schedule is crucial',
                    'Poor sleep increases injury risk'
                ],
                'references': ['Halson, S. (2014). Sleep in elite athletes']
            }
        ]
        
        return research_articles
    
    async def _generate_injury_knowledge(self) -> List[Dict[str, Any]]:
        """Generate injury prevention knowledge"""
        injury_knowledge = [
            {
                'title': 'Lower Back Injury Prevention',
                'category': 'injury_prevention',
                'body_part': 'lower_back',
                'description': 'Comprehensive guide to preventing lower back injuries',
                'content': """
                Lower back injuries are among the most common in fitness and daily life.
                Prevention focuses on proper movement patterns and strengthening.
                
                Common Causes:
                1. Poor lifting technique
                2. Weak core muscles
                3. Tight hip flexors
                4. Sedentary lifestyle
                5. Sudden increases in training load
                
                Prevention Strategies:
                1. Core Strengthening:
                   - Planks and variations
                   - Dead bugs and bird dogs
                   - Pallof presses
                   - Anti-rotation exercises
                
                2. Hip Mobility:
                   - Hip flexor stretches
                   - Glute activation exercises
                   - Hip circles and leg swings
                   - Foam rolling
                
                3. Proper Lifting Technique:
                   - Neutral spine position
                   - Hip hinge pattern
                   - Bracing core before lifting
                   - Gradual progression
                
                4. Lifestyle Modifications:
                   - Regular movement breaks
                   - Ergonomic workspace setup
                   - Stress management
                   - Adequate sleep
                
                Warning Signs:
                - Sharp pain during movement
                - Pain that radiates down legs
                - Numbness or tingling
                - Difficulty standing or sitting
                """,
                'prevention_exercises': [
                    'Dead bug', 'Bird dog', 'Plank', 'Hip flexor stretch',
                    'Glute bridges', 'Pallof press', 'Foam rolling'
                ],
                'warning_signs': [
                    'Sharp pain', 'Radiating pain', 'Numbness', 'Difficulty moving'
                ]
            },
            {
                'title': 'Shoulder Injury Prevention',
                'category': 'injury_prevention',
                'body_part': 'shoulder',
                'description': 'Preventing shoulder injuries in upper body training',
                'content': """
                Shoulder injuries are common in upper body training due to the joint's complexity.
                Prevention focuses on mobility, stability, and balanced development.
                
                Common Shoulder Injuries:
                1. Rotator cuff impingement
                2. Shoulder instability
                3. Labral tears
                4. Biceps tendonitis
                5. AC joint sprains
                
                Risk Factors:
                1. Overhead activities
                2. Repetitive motions
                3. Muscle imbalances
                4. Poor posture
                5. Inadequate warm-up
                
                Prevention Exercises:
                1. Mobility:
                   - Arm circles and swings
                   - Wall slides
                   - Doorway stretches
                   - Band pull-aparts
                
                2. Stability:
                   - External rotation exercises
                   - Face pulls
                   - Scapular wall slides
                   - Prone Y-T-W exercises
                
                3. Strengthening:
                   - Balanced push/pull ratio
                   - Rotator cuff strengthening
                   - Scapular stabilizers
                   - Posterior deltoid work
                
                Training Modifications:
                1. Proper warm-up (10-15 minutes)
                2. Gradual progression
                3. Balanced programming
                4. Rest and recovery
                5. Listen to your body
                """,
                'prevention_exercises': [
                    'Wall slides', 'Band pull-aparts', 'Face pulls', 'External rotations',
                    'Prone Y-T-W', 'Doorway stretches', 'Scapular wall slides'
                ],
                'warning_signs': [
                    'Pain during overhead movements', 'Clicking or popping',
                    'Weakness in arm', 'Limited range of motion'
                ]
            }
        ]
        
        return injury_knowledge
    
    async def _generate_training_knowledge(self) -> List[Dict[str, Any]]:
        """Generate training methodology knowledge"""
        training_knowledge = [
            {
                'title': 'Periodization Principles',
                'category': 'training_methodology',
                'topic': 'periodization',
                'description': 'Systematic approach to training progression and variation',
                'content': """
                Periodization is the systematic planning of training variables to optimize performance.
                It involves planned variation in intensity, volume, and exercise selection.
                
                Types of Periodization:
                1. Linear Periodization:
                   - Gradual increase in intensity
                   - Decrease in volume over time
                   - Best for beginners and powerlifters
                
                2. Undulating Periodization:
                   - Frequent changes in intensity and volume
                   - Daily or weekly variations
                   - Better for intermediate to advanced athletes
                
                3. Block Periodization:
                   - Concentrated training blocks
                   - Focus on specific qualities
                   - Advanced athletes and sport-specific training
                
                Training Phases:
                1. Base Phase (General Preparation):
                   - High volume, moderate intensity
                   - Focus on technique and work capacity
                   - 4-8 weeks duration
                
                2. Build Phase (Specific Preparation):
                   - Moderate volume, higher intensity
                   - Sport-specific movements
                   - 4-6 weeks duration
                
                3. Peak Phase (Competition Preparation):
                   - Low volume, high intensity
                   - Competition-specific training
                   - 2-4 weeks duration
                
                4. Recovery Phase (Active Rest):
                   - Low intensity, recreational activities
                   - Mental and physical recovery
                   - 1-2 weeks duration
                
                Key Principles:
                - Progressive overload
                - Specificity
                - Individuality
                - Reversibility
                - Variation
                """,
                'key_points': [
                    'Systematic planning prevents overtraining',
                    'Multiple periodization models available',
                    'Individual response varies',
                    'Recovery phases are essential'
                ],
                'applications': [
                    'Strength training', 'Endurance training', 'Sport-specific training',
                    'Rehabilitation', 'General fitness'
                ]
            },
            {
                'title': 'Exercise Selection Principles',
                'category': 'training_methodology',
                'topic': 'exercise_selection',
                'description': 'Guidelines for selecting appropriate exercises for different goals',
                'content': """
                Exercise selection is crucial for achieving specific training goals.
                The right exercises maximize training adaptations while minimizing injury risk.
                
                Exercise Categories:
                1. Compound Movements:
                   - Multi-joint exercises
                   - High muscle activation
                   - Examples: Squats, deadlifts, presses
                   - Best for: Strength, power, muscle mass
                
                2. Isolation Movements:
                   - Single-joint exercises
                   - Targeted muscle development
                   - Examples: Bicep curls, leg extensions
                   - Best for: Muscle definition, weak points
                
                3. Functional Movements:
                   - Movement pattern based
                   - Real-world applications
                   - Examples: Turkish get-ups, carries
                   - Best for: General fitness, daily activities
                
                Selection Criteria:
                1. Training Goal Alignment:
                   - Strength: Compound movements
                   - Hypertrophy: Mix of compound and isolation
                   - Endurance: High-rep, low-load exercises
                   - Power: Explosive movements
                
                2. Individual Factors:
                   - Experience level
                   - Injury history
                   - Movement limitations
                   - Equipment availability
                
                3. Movement Patterns:
                   - Push movements (horizontal and vertical)
                   - Pull movements (horizontal and vertical)
                   - Squat pattern
                   - Hinge pattern
                   - Lunge pattern
                   - Carry pattern
                
                4. Muscle Balance:
                   - Agonist-antagonist balance
                   - Left-right symmetry
                   - Upper-lower balance
                   - Anterior-posterior balance
                
                Progression Considerations:
                - Start with basic movements
                - Master technique before adding load
                - Progress complexity gradually
                - Include variety for adaptation
                """,
                'key_points': [
                    'Exercise selection should match training goals',
                    'Compound movements provide greatest benefits',
                    'Individual factors influence selection',
                    'Movement pattern balance is important'
                ],
                'selection_factors': [
                    'Training goals', 'Experience level', 'Injury history',
                    'Equipment access', 'Time constraints', 'Preferences'
                ]
            }
        ]
        
        return training_knowledge
    
    async def _process_research_batch(self, articles: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Process a batch of research articles for S3 Vectors"""
        results = {
            'successful': 0,
            'failed': 0,
            'errors': []
        }
        
        for article in articles:
            try:
                # Create research knowledge text
                knowledge_text = self._create_research_knowledge_text(article)
                
                # Generate embedding
                embedding = await self.embedding_service.get_knowledge_embedding(knowledge_text)
                
                if embedding:
                    # Store in S3 Vectors
                    vector_id = f"research_{article['title'].lower().replace(' ', '_')}"
                    
                    await self.s3_vectors_service.put_vector(
                        vector_id=vector_id,
                        vector=embedding,
                        metadata={
                            'type': 'research',
                            'category': article.get('category', 'unknown'),
                            'title': article['title'],
                            'topic': article.get('topic', ''),
                            'key_points': article.get('key_points', []),
                            'text': knowledge_text
                        },
                        namespace='research'
                    )
                    
                    results['successful'] += 1
                else:
                    results['failed'] += 1
                    results['errors'].append(f"Failed to generate embedding for {article['title']}")
                    
            except Exception as e:
                results['failed'] += 1
                results['errors'].append(f"Error processing {article['title']}: {str(e)}")
        
        return results
    
    async def _process_injury_batch(self, knowledge_items: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Process a batch of injury knowledge for S3 Vectors"""
        results = {
            'successful': 0,
            'failed': 0,
            'errors': []
        }
        
        for item in knowledge_items:
            try:
                # Create injury knowledge text
                knowledge_text = self._create_injury_knowledge_text(item)
                
                # Generate embedding
                embedding = await self.embedding_service.get_knowledge_embedding(knowledge_text)
                
                if embedding:
                    # Store in S3 Vectors
                    vector_id = f"injury_{item['title'].lower().replace(' ', '_')}"
                    
                    await self.s3_vectors_service.put_vector(
                        vector_id=vector_id,
                        vector=embedding,
                        metadata={
                            'type': 'injury_prevention',
                            'category': item.get('category', 'unknown'),
                            'title': item['title'],
                            'body_part': item.get('body_part', ''),
                            'prevention_exercises': item.get('prevention_exercises', []),
                            'text': knowledge_text
                        },
                        namespace='injuries'
                    )
                    
                    results['successful'] += 1
                else:
                    results['failed'] += 1
                    results['errors'].append(f"Failed to generate embedding for {item['title']}")
                    
            except Exception as e:
                results['failed'] += 1
                results['errors'].append(f"Error processing {item['title']}: {str(e)}")
        
        return results
    
    async def _process_training_batch(self, knowledge_items: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Process a batch of training knowledge for S3 Vectors"""
        results = {
            'successful': 0,
            'failed': 0,
            'errors': []
        }
        
        for item in knowledge_items:
            try:
                # Create training knowledge text
                knowledge_text = self._create_training_knowledge_text(item)
                
                # Generate embedding
                embedding = await self.embedding_service.get_knowledge_embedding(knowledge_text)
                
                if embedding:
                    # Store in S3 Vectors
                    vector_id = f"training_{item['title'].lower().replace(' ', '_')}"
                    
                    await self.s3_vectors_service.put_vector(
                        vector_id=vector_id,
                        vector=embedding,
                        metadata={
                            'type': 'training_methodology',
                            'category': item.get('category', 'unknown'),
                            'title': item['title'],
                            'topic': item.get('topic', ''),
                            'key_points': item.get('key_points', []),
                            'text': knowledge_text
                        },
                        namespace='training'
                    )
                    
                    results['successful'] += 1
                else:
                    results['failed'] += 1
                    results['errors'].append(f"Failed to generate embedding for {item['title']}")
                    
            except Exception as e:
                results['failed'] += 1
                results['errors'].append(f"Error processing {item['title']}: {str(e)}")
        
        return results
    
    def _create_research_knowledge_text(self, article: Dict[str, Any]) -> str:
        """Create comprehensive knowledge text for research article"""
        text_parts = []
        
        text_parts.append(f"Research Article: {article['title']}")
        text_parts.append(f"Category: {article.get('category', 'Unknown')}")
        text_parts.append(f"Topic: {article.get('topic', '')}")
        text_parts.append(f"Description: {article.get('description', '')}")
        text_parts.append("")
        text_parts.append("Content:")
        text_parts.append(article.get('content', ''))
        
        if 'key_points' in article and article['key_points']:
            text_parts.append("")
            text_parts.append("Key Points:")
            for point in article['key_points']:
                text_parts.append(f"- {point}")
        
        if 'references' in article and article['references']:
            text_parts.append("")
            text_parts.append("References:")
            for ref in article['references']:
                text_parts.append(f"- {ref}")
        
        return '\n'.join(text_parts)
    
    def _create_injury_knowledge_text(self, item: Dict[str, Any]) -> str:
        """Create comprehensive knowledge text for injury prevention"""
        text_parts = []
        
        text_parts.append(f"Injury Prevention: {item['title']}")
        text_parts.append(f"Category: {item.get('category', 'Unknown')}")
        text_parts.append(f"Body Part: {item.get('body_part', '')}")
        text_parts.append(f"Description: {item.get('description', '')}")
        text_parts.append("")
        text_parts.append("Content:")
        text_parts.append(item.get('content', ''))
        
        if 'prevention_exercises' in item and item['prevention_exercises']:
            text_parts.append("")
            text_parts.append("Prevention Exercises:")
            for exercise in item['prevention_exercises']:
                text_parts.append(f"- {exercise}")
        
        if 'warning_signs' in item and item['warning_signs']:
            text_parts.append("")
            text_parts.append("Warning Signs:")
            for sign in item['warning_signs']:
                text_parts.append(f"- {sign}")
        
        return '\n'.join(text_parts)
    
    def _create_training_knowledge_text(self, item: Dict[str, Any]) -> str:
        """Create comprehensive knowledge text for training methodology"""
        text_parts = []
        
        text_parts.append(f"Training Methodology: {item['title']}")
        text_parts.append(f"Category: {item.get('category', 'Unknown')}")
        text_parts.append(f"Topic: {item.get('topic', '')}")
        text_parts.append(f"Description: {item.get('description', '')}")
        text_parts.append("")
        text_parts.append("Content:")
        text_parts.append(item.get('content', ''))
        
        if 'key_points' in item and item['key_points']:
            text_parts.append("")
            text_parts.append("Key Points:")
            for point in item['key_points']:
                text_parts.append(f"- {point}")
        
        if 'applications' in item and item['applications']:
            text_parts.append("")
            text_parts.append("Applications:")
            for app in item['applications']:
                text_parts.append(f"- {app}")
        
        return '\n'.join(text_parts)

async def main():
    """Main function to populate all knowledge"""
    try:
        service = KnowledgePopulationService()
        
        # Populate all knowledge
        logger.info("Starting comprehensive knowledge population...")
        results = await service.populate_all_knowledge()
        
        if 'error' in results:
            logger.error(f"Error populating knowledge: {results['error']}")
            return
        
        logger.info("Knowledge population completed successfully!")
        logger.info(f"Total items: {results['total_items']}")
        logger.info(f"Successful embeddings: {results['successful_embeddings']}")
        logger.info(f"Failed embeddings: {results['failed_embeddings']}")
        logger.info(f"Categories: {results['categories']}")
        
        if results['errors']:
            logger.warning(f"Errors encountered: {len(results['errors'])}")
            for error in results['errors'][:10]:  # Show first 10 errors
                logger.warning(f"Error: {error}")
        
    except Exception as e:
        logger.error(f"Error in main: {e}")

if __name__ == "__main__":
    asyncio.run(main())
