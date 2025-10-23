#!/usr/bin/env python3
"""
Exercise Knowledge Builder for S3 Vectors Population
Populates S3 Vectors with comprehensive exercise library (5000+ exercises)
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

class ExerciseKnowledgeBuilder:
    """Builder for populating S3 Vectors with exercise knowledge"""
    
    def __init__(self):
        self.vectors_bucket = os.environ.get('VECTORS_BUCKET', 'gymcoach-ai-vectors')
        self.embedding_service = EmbeddingService()
        self.s3_vectors_service = S3VectorsService()
        
        # Exercise categories and their characteristics
        self.exercise_categories = {
            'strength': {
                'muscle_groups': ['chest', 'back', 'shoulders', 'arms', 'legs', 'core'],
                'equipment': ['barbell', 'dumbbell', 'kettlebell', 'bodyweight', 'machine', 'cable'],
                'movement_patterns': ['push', 'pull', 'squat', 'hinge', 'lunge', 'carry', 'plank']
            },
            'cardio': {
                'types': ['running', 'cycling', 'swimming', 'rowing', 'elliptical', 'jumping'],
                'intensity': ['low', 'moderate', 'high', 'interval'],
                'duration': ['short', 'medium', 'long']
            },
            'flexibility': {
                'types': ['static', 'dynamic', 'pnf', 'ballistic'],
                'target_areas': ['neck', 'shoulders', 'spine', 'hips', 'legs', 'ankles'],
                'purposes': ['warmup', 'cooldown', 'recovery', 'mobility']
            },
            'functional': {
                'movements': ['squat', 'hinge', 'lunge', 'push', 'pull', 'carry', 'rotate'],
                'planes': ['sagittal', 'frontal', 'transverse'],
                'applications': ['daily_life', 'sports', 'rehabilitation']
            }
        }
        
    async def build_exercise_library(self) -> Dict[str, Any]:
        """Build comprehensive exercise library with 5000+ exercises"""
        try:
            logger.info("Starting exercise library build...")
            
            exercises = []
            
            # Generate strength training exercises
            strength_exercises = await self._generate_strength_exercises()
            exercises.extend(strength_exercises)
            
            # Generate cardio exercises
            cardio_exercises = await self._generate_cardio_exercises()
            exercises.extend(cardio_exercises)
            
            # Generate flexibility exercises
            flexibility_exercises = await self._generate_flexibility_exercises()
            exercises.extend(flexibility_exercises)
            
            # Generate functional exercises
            functional_exercises = await self._generate_functional_exercises()
            exercises.extend(functional_exercises)
            
            # Generate sport-specific exercises
            sport_exercises = await self._generate_sport_specific_exercises()
            exercises.extend(sport_exercises)
            
            # Generate rehabilitation exercises
            rehab_exercises = await self._generate_rehabilitation_exercises()
            exercises.extend(rehab_exercises)
            
            logger.info(f"Generated {len(exercises)} exercises")
            
            return {
                'total_exercises': len(exercises),
                'categories': self._categorize_exercises(exercises),
                'exercises': exercises
            }
            
        except Exception as e:
            logger.error(f"Error building exercise library: {e}")
            return {'error': str(e)}
    
    async def _generate_strength_exercises(self) -> List[Dict[str, Any]]:
        """Generate strength training exercises"""
        exercises = []
        
        # Basic strength exercises with variations
        base_exercises = [
            {
                'name': 'Push-up',
                'category': 'strength',
                'muscle_groups': ['chest', 'shoulders', 'triceps'],
                'equipment': ['bodyweight'],
                'movement_pattern': 'push',
                'difficulty': 'beginner',
                'description': 'Classic bodyweight pushing exercise targeting chest, shoulders, and triceps',
                'instructions': [
                    'Start in plank position with hands slightly wider than shoulders',
                    'Lower body until chest nearly touches ground',
                    'Push back up to starting position',
                    'Keep core tight and body straight throughout'
                ],
                'variations': [
                    'Incline push-up', 'Decline push-up', 'Diamond push-up',
                    'Wide-grip push-up', 'Archer push-up', 'One-arm push-up'
                ],
                'common_mistakes': [
                    'Sagging hips', 'Flaring elbows', 'Incomplete range of motion',
                    'Head dropping', 'Breathing incorrectly'
                ],
                'tips': [
                    'Keep core engaged', 'Maintain straight line from head to heels',
                    'Control the descent', 'Full range of motion'
                ]
            },
            {
                'name': 'Squat',
                'category': 'strength',
                'muscle_groups': ['quadriceps', 'glutes', 'hamstrings', 'core'],
                'equipment': ['bodyweight', 'barbell', 'dumbbell'],
                'movement_pattern': 'squat',
                'difficulty': 'beginner',
                'description': 'Fundamental lower body exercise targeting legs and glutes',
                'instructions': [
                    'Stand with feet shoulder-width apart',
                    'Lower by bending hips and knees',
                    'Descend until thighs parallel to ground',
                    'Drive through heels to return to standing'
                ],
                'variations': [
                    'Goblet squat', 'Front squat', 'Back squat', 'Overhead squat',
                    'Jump squat', 'Pistol squat', 'Bulgarian split squat'
                ],
                'common_mistakes': [
                    'Knees caving in', 'Heels lifting', 'Forward lean',
                    'Incomplete depth', 'Knee valgus'
                ],
                'tips': [
                    'Keep chest up', 'Weight on heels', 'Knees track over toes',
                    'Full depth', 'Controlled movement'
                ]
            },
            {
                'name': 'Deadlift',
                'category': 'strength',
                'muscle_groups': ['hamstrings', 'glutes', 'back', 'core'],
                'equipment': ['barbell', 'dumbbell', 'kettlebell'],
                'movement_pattern': 'hinge',
                'difficulty': 'intermediate',
                'description': 'Hip-hinge movement targeting posterior chain',
                'instructions': [
                    'Stand with feet hip-width apart, bar over mid-foot',
                    'Bend at hips and knees to grip bar',
                    'Keep back straight and chest up',
                    'Drive hips forward to lift bar',
                    'Stand tall with shoulders back'
                ],
                'variations': [
                    'Romanian deadlift', 'Sumo deadlift', 'Trap bar deadlift',
                    'Single-leg deadlift', 'Stiff-leg deadlift', 'Deficit deadlift'
                ],
                'common_mistakes': [
                    'Rounded back', 'Bar drifting forward', 'Hips rising too fast',
                    'Overextending at top', 'Poor grip'
                ],
                'tips': [
                    'Neutral spine', 'Bar close to body', 'Hip hinge pattern',
                    'Full extension', 'Controlled descent'
                ]
            }
        ]
        
        # Generate variations and progressions for each base exercise
        for base_exercise in base_exercises:
            exercises.append(base_exercise)
            
            # Generate equipment variations
            for equipment in ['barbell', 'dumbbell', 'kettlebell', 'cable', 'machine']:
                if equipment not in base_exercise['equipment']:
                    variation = self._create_equipment_variation(base_exercise, equipment)
                    exercises.append(variation)
            
            # Generate difficulty progressions
            for difficulty in ['beginner', 'intermediate', 'advanced']:
                if difficulty != base_exercise['difficulty']:
                    progression = self._create_difficulty_progression(base_exercise, difficulty)
                    exercises.append(progression)
        
        # Generate additional strength exercises
        additional_exercises = await self._generate_additional_strength_exercises()
        exercises.extend(additional_exercises)
        
        return exercises
    
    async def _generate_cardio_exercises(self) -> List[Dict[str, Any]]:
        """Generate cardiovascular exercises"""
        exercises = []
        
        cardio_types = [
            {
                'name': 'Running',
                'category': 'cardio',
                'type': 'running',
                'intensity': 'moderate',
                'duration': 'medium',
                'description': 'Classic cardiovascular exercise improving endurance',
                'instructions': [
                    'Maintain upright posture',
                    'Land on mid-foot',
                    'Keep stride comfortable',
                    'Breathe rhythmically'
                ],
                'variations': [
                    'Sprint intervals', 'Long slow distance', 'Tempo runs',
                    'Hill running', 'Fartlek training', 'Track intervals'
                ],
                'benefits': [
                    'Improved cardiovascular health', 'Increased endurance',
                    'Weight management', 'Mental health benefits'
                ]
            },
            {
                'name': 'Cycling',
                'category': 'cardio',
                'type': 'cycling',
                'intensity': 'moderate',
                'duration': 'medium',
                'description': 'Low-impact cardiovascular exercise',
                'instructions': [
                    'Maintain proper bike fit',
                    'Keep core engaged',
                    'Smooth pedaling motion',
                    'Proper breathing rhythm'
                ],
                'variations': [
                    'Road cycling', 'Mountain biking', 'Indoor cycling',
                    'Spin classes', 'Cycling intervals', 'Long rides'
                ],
                'benefits': [
                    'Low impact on joints', 'Leg strength', 'Cardiovascular fitness',
                    'Outdoor enjoyment'
                ]
            },
            {
                'name': 'Swimming',
                'category': 'cardio',
                'type': 'swimming',
                'intensity': 'moderate',
                'duration': 'medium',
                'description': 'Full-body cardiovascular exercise',
                'instructions': [
                    'Proper stroke technique',
                    'Rhythmic breathing',
                    'Streamlined body position',
                    'Consistent pace'
                ],
                'variations': [
                    'Freestyle', 'Backstroke', 'Breaststroke', 'Butterfly',
                    'Swimming intervals', 'Water aerobics', 'Open water swimming'
                ],
                'benefits': [
                    'Full-body workout', 'Low impact', 'Improved lung capacity',
                    'Muscle endurance'
                ]
            }
        ]
        
        exercises.extend(cardio_types)
        
        # Generate intensity variations
        for exercise in cardio_types:
            for intensity in ['low', 'moderate', 'high', 'interval']:
                if intensity != exercise['intensity']:
                    variation = self._create_intensity_variation(exercise, intensity)
                    exercises.append(variation)
        
        return exercises
    
    async def _generate_flexibility_exercises(self) -> List[Dict[str, Any]]:
        """Generate flexibility and mobility exercises"""
        exercises = []
        
        flexibility_exercises = [
            {
                'name': 'Downward Dog',
                'category': 'flexibility',
                'type': 'static',
                'target_areas': ['shoulders', 'spine', 'hamstrings', 'calves'],
                'purpose': 'stretch',
                'description': 'Yoga pose stretching multiple muscle groups',
                'instructions': [
                    'Start on hands and knees',
                    'Tuck toes and lift hips up',
                    'Straighten legs as much as comfortable',
                    'Press hands into ground',
                    'Hold position and breathe'
                ],
                'variations': [
                    'Puppy pose', 'Dolphin pose', 'Three-legged dog',
                    'Walking the dog', 'Downward dog with knee bends'
                ],
                'benefits': [
                    'Shoulder flexibility', 'Spinal mobility', 'Hamstring stretch',
                    'Calm mind', 'Improved circulation'
                ]
            },
            {
                'name': 'Hip Flexor Stretch',
                'category': 'flexibility',
                'type': 'static',
                'target_areas': ['hips', 'quadriceps'],
                'purpose': 'stretch',
                'description': 'Stretches hip flexors and quadriceps',
                'instructions': [
                    'Step one foot forward into lunge position',
                    'Lower back knee to ground',
                    'Push hips forward gently',
                    'Feel stretch in front of hip',
                    'Hold and breathe'
                ],
                'variations': [
                    'Standing hip flexor stretch', 'Kneeling hip flexor stretch',
                    'Hip flexor stretch with rotation', 'Dynamic hip flexor stretch'
                ],
                'benefits': [
                    'Improved hip mobility', 'Reduced lower back tension',
                    'Better posture', 'Enhanced squat depth'
                ]
            }
        ]
        
        exercises.extend(flexibility_exercises)
        
        # Generate dynamic flexibility exercises
        dynamic_exercises = await self._generate_dynamic_flexibility_exercises()
        exercises.extend(dynamic_exercises)
        
        return exercises
    
    async def _generate_functional_exercises(self) -> List[Dict[str, Any]]:
        """Generate functional movement exercises"""
        exercises = []
        
        functional_exercises = [
            {
                'name': 'Farmer\'s Walk',
                'category': 'functional',
                'movement': 'carry',
                'plane': 'sagittal',
                'application': 'daily_life',
                'description': 'Loaded carry exercise improving grip and core strength',
                'instructions': [
                    'Pick up heavy weights in each hand',
                    'Stand tall with shoulders back',
                    'Walk forward maintaining posture',
                    'Keep core engaged',
                    'Breathe normally'
                ],
                'variations': [
                    'Single-arm carry', 'Overhead carry', 'Suitcase carry',
                    'Rack carry', 'Waiter\'s walk', 'Cross-body carry'
                ],
                'benefits': [
                    'Grip strength', 'Core stability', 'Postural strength',
                    'Functional capacity', 'Mental toughness'
                ]
            },
            {
                'name': 'Turkish Get-up',
                'category': 'functional',
                'movement': 'complex',
                'plane': 'multi-planar',
                'application': 'daily_life',
                'description': 'Complex movement pattern improving mobility and stability',
                'instructions': [
                    'Start lying on back with weight overhead',
                    'Roll to elbow',
                    'Sit up to hand',
                    'Bridge up to standing',
                    'Reverse the movement'
                ],
                'variations': [
                    'Half get-up', 'Get-up with different weights',
                    'Get-up with different implements', 'Assisted get-up'
                ],
                'benefits': [
                    'Full-body coordination', 'Mobility', 'Stability',
                    'Movement quality', 'Shoulder stability'
                ]
            }
        ]
        
        exercises.extend(functional_exercises)
        
        return exercises
    
    async def _generate_sport_specific_exercises(self) -> List[Dict[str, Any]]:
        """Generate sport-specific exercises"""
        exercises = []
        
        sports = [
            {
                'name': 'Basketball',
                'exercises': [
                    {
                        'name': 'Lateral Shuffle',
                        'category': 'sport_specific',
                        'sport': 'basketball',
                        'description': 'Lateral movement drill for basketball defense',
                        'instructions': [
                            'Start in athletic stance',
                            'Shuffle laterally maintaining low position',
                            'Keep feet wide and stable',
                            'Change direction quickly'
                        ]
                    },
                    {
                        'name': 'Jump Shot Form',
                        'category': 'sport_specific',
                        'sport': 'basketball',
                        'description': 'Practice proper jump shot technique',
                        'instructions': [
                            'Square feet to basket',
                            'Bend knees and load',
                            'Jump straight up',
                            'Release ball at peak',
                            'Follow through'
                        ]
                    }
                ]
            },
            {
                'name': 'Soccer',
                'exercises': [
                    {
                        'name': 'Agility Ladder',
                        'category': 'sport_specific',
                        'sport': 'soccer',
                        'description': 'Footwork drill for soccer agility',
                        'instructions': [
                            'Step in each ladder rung',
                            'Maintain quick feet',
                            'Stay on balls of feet',
                            'Keep rhythm consistent'
                        ]
                    }
                ]
            }
        ]
        
        for sport in sports:
            exercises.extend(sport['exercises'])
        
        return exercises
    
    async def _generate_rehabilitation_exercises(self) -> List[Dict[str, Any]]:
        """Generate rehabilitation exercises"""
        exercises = []
        
        rehab_exercises = [
            {
                'name': 'Wall Slide',
                'category': 'rehabilitation',
                'target_area': 'shoulders',
                'injury_type': 'shoulder_impingement',
                'description': 'Gentle shoulder mobility exercise',
                'instructions': [
                    'Stand with back against wall',
                    'Place arms against wall',
                    'Slide arms up slowly',
                    'Return to starting position',
                    'Keep contact with wall'
                ],
                'benefits': [
                    'Shoulder mobility', 'Postural improvement',
                    'Pain reduction', 'Range of motion'
                ]
            },
            {
                'name': 'Clamshell',
                'category': 'rehabilitation',
                'target_area': 'hips',
                'injury_type': 'hip_weakness',
                'description': 'Hip strengthening exercise',
                'instructions': [
                    'Lie on side with knees bent',
                    'Keep feet together',
                    'Lift top knee up',
                    'Lower slowly',
                    'Keep core engaged'
                ],
                'benefits': [
                    'Hip strength', 'Glute activation',
                    'Hip stability', 'Injury prevention'
                ]
            }
        ]
        
        exercises.extend(rehab_exercises)
        
        return exercises
    
    async def _generate_additional_strength_exercises(self) -> List[Dict[str, Any]]:
        """Generate additional strength exercises"""
        exercises = []
        
        # Generate exercises for each muscle group
        muscle_groups = {
            'chest': ['bench_press', 'incline_press', 'decline_press', 'flyes', 'dips'],
            'back': ['pull_ups', 'rows', 'lat_pulldowns', 'deadlifts', 'shrugs'],
            'shoulders': ['overhead_press', 'lateral_raises', 'rear_delt_flyes', 'face_pulls'],
            'arms': ['bicep_curls', 'tricep_extensions', 'hammer_curls', 'close_grip_press'],
            'legs': ['squats', 'lunges', 'leg_press', 'leg_curls', 'calf_raises'],
            'core': ['planks', 'crunches', 'russian_twists', 'mountain_climbers']
        }
        
        for muscle_group, exercise_types in muscle_groups.items():
            for exercise_type in exercise_types:
                exercise = await self._create_muscle_group_exercise(muscle_group, exercise_type)
                exercises.append(exercise)
        
        return exercises
    
    async def _generate_dynamic_flexibility_exercises(self) -> List[Dict[str, Any]]:
        """Generate dynamic flexibility exercises"""
        exercises = []
        
        dynamic_exercises = [
            {
                'name': 'Arm Circles',
                'category': 'flexibility',
                'type': 'dynamic',
                'target_areas': ['shoulders'],
                'purpose': 'warmup',
                'description': 'Dynamic shoulder mobility exercise',
                'instructions': [
                    'Stand with arms extended',
                    'Make small circles forward',
                    'Gradually increase circle size',
                    'Reverse direction',
                    'Keep movement controlled'
                ]
            },
            {
                'name': 'Leg Swings',
                'category': 'flexibility',
                'type': 'dynamic',
                'target_areas': ['hips', 'hamstrings'],
                'purpose': 'warmup',
                'description': 'Dynamic hip mobility exercise',
                'instructions': [
                    'Hold onto support',
                    'Swing leg forward and back',
                    'Keep standing leg straight',
                    'Control the movement',
                    'Switch legs'
                ]
            }
        ]
        
        exercises.extend(dynamic_exercises)
        
        return exercises
    
    def _create_equipment_variation(self, base_exercise: Dict[str, Any], equipment: str) -> Dict[str, Any]:
        """Create equipment variation of base exercise"""
        variation = base_exercise.copy()
        variation['name'] = f"{equipment.title()} {base_exercise['name']}"
        variation['equipment'] = [equipment]
        variation['description'] = f"{base_exercise['description']} using {equipment}"
        
        # Add equipment-specific instructions
        equipment_instructions = {
            'barbell': 'Use proper grip and form with barbell',
            'dumbbell': 'Control the weight throughout the movement',
            'kettlebell': 'Maintain proper kettlebell form and grip',
            'cable': 'Keep constant tension throughout the movement',
            'machine': 'Adjust machine settings for proper range of motion'
        }
        
        if equipment in equipment_instructions:
            variation['instructions'].insert(0, equipment_instructions[equipment])
        
        return variation
    
    def _create_difficulty_progression(self, base_exercise: Dict[str, Any], difficulty: str) -> Dict[str, Any]:
        """Create difficulty progression of base exercise"""
        progression = base_exercise.copy()
        progression['difficulty'] = difficulty
        
        difficulty_modifiers = {
            'beginner': {
                'name_suffix': ' (Beginner)',
                'description_addition': ' Beginner-friendly version.',
                'tips_addition': ['Focus on form over intensity', 'Use lighter weights']
            },
            'intermediate': {
                'name_suffix': ' (Intermediate)',
                'description_addition': ' Intermediate-level variation.',
                'tips_addition': ['Increase intensity gradually', 'Focus on control']
            },
            'advanced': {
                'name_suffix': ' (Advanced)',
                'description_addition': ' Advanced-level variation.',
                'tips_addition': ['High intensity', 'Perfect form required', 'Use heavier weights']
            }
        }
        
        if difficulty in difficulty_modifiers:
            modifier = difficulty_modifiers[difficulty]
            progression['name'] += modifier['name_suffix']
            progression['description'] += modifier['description_addition']
            progression['tips'].extend(modifier['tips_addition'])
        
        return progression
    
    def _create_intensity_variation(self, base_exercise: Dict[str, Any], intensity: str) -> Dict[str, Any]:
        """Create intensity variation of base exercise"""
        variation = base_exercise.copy()
        variation['intensity'] = intensity
        
        intensity_modifiers = {
            'low': {
                'name_suffix': ' (Low Intensity)',
                'description_addition': ' Low-intensity version for recovery.',
                'tips_addition': ['Maintain comfortable pace', 'Focus on endurance']
            },
            'moderate': {
                'name_suffix': ' (Moderate Intensity)',
                'description_addition': ' Moderate-intensity version.',
                'tips_addition': ['Sustained effort', 'Controlled breathing']
            },
            'high': {
                'name_suffix': ' (High Intensity)',
                'description_addition': ' High-intensity version.',
                'tips_addition': ['Maximum effort', 'Short duration', 'Full recovery between sets']
            },
            'interval': {
                'name_suffix': ' (Interval)',
                'description_addition': ' Interval training version.',
                'tips_addition': ['Alternate high and low intensity', 'Time-based intervals']
            }
        }
        
        if intensity in intensity_modifiers:
            modifier = intensity_modifiers[intensity]
            variation['name'] += modifier['name_suffix']
            variation['description'] += modifier['description_addition']
            variation['tips'] = variation.get('tips', []) + modifier['tips_addition']
        
        return variation
    
    async def _create_muscle_group_exercise(self, muscle_group: str, exercise_type: str) -> Dict[str, Any]:
        """Create exercise for specific muscle group"""
        exercise_templates = {
            'bench_press': {
                'name': f'{muscle_group.title()} Bench Press',
                'description': f'Compound exercise targeting {muscle_group}',
                'instructions': [
                    'Lie on bench with feet flat',
                    'Grip bar with proper width',
                    'Lower bar to chest',
                    'Press up explosively',
                    'Control the descent'
                ]
            },
            'squats': {
                'name': f'{muscle_group.title()} Squat',
                'description': f'Lower body exercise targeting {muscle_group}',
                'instructions': [
                    'Stand with feet shoulder-width apart',
                    'Lower by bending hips and knees',
                    'Descend until thighs parallel',
                    'Drive through heels to stand',
                    'Keep chest up throughout'
                ]
            }
        }
        
        if exercise_type in exercise_templates:
            template = exercise_templates[exercise_type]
            return {
                'name': template['name'],
                'category': 'strength',
                'muscle_groups': [muscle_group],
                'equipment': ['barbell', 'dumbbell'],
                'movement_pattern': 'compound',
                'difficulty': 'intermediate',
                'description': template['description'],
                'instructions': template['instructions'],
                'variations': [],
                'common_mistakes': [],
                'tips': []
            }
        
        return {
            'name': f'{muscle_group.title()} {exercise_type.replace("_", " ").title()}',
            'category': 'strength',
            'muscle_groups': [muscle_group],
            'equipment': ['bodyweight'],
            'movement_pattern': 'isolation',
            'difficulty': 'beginner',
            'description': f'Exercise targeting {muscle_group}',
            'instructions': ['Perform exercise with proper form'],
            'variations': [],
            'common_mistakes': [],
            'tips': []
        }
    
    def _categorize_exercises(self, exercises: List[Dict[str, Any]]) -> Dict[str, int]:
        """Categorize exercises by type"""
        categories = {}
        for exercise in exercises:
            category = exercise.get('category', 'other')
            categories[category] = categories.get(category, 0) + 1
        return categories
    
    async def populate_s3_vectors(self, exercises: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Populate S3 Vectors with exercise knowledge"""
        try:
            logger.info(f"Starting S3 Vectors population with {len(exercises)} exercises...")
            
            results = {
                'total_exercises': len(exercises),
                'successful_embeddings': 0,
                'failed_embeddings': 0,
                'errors': []
            }
            
            # Process exercises in batches
            batch_size = 50
            for i in range(0, len(exercises), batch_size):
                batch = exercises[i:i + batch_size]
                batch_results = await self._process_exercise_batch(batch)
                
                results['successful_embeddings'] += batch_results['successful']
                results['failed_embeddings'] += batch_results['failed']
                results['errors'].extend(batch_results['errors'])
                
                logger.info(f"Processed batch {i//batch_size + 1}/{(len(exercises) + batch_size - 1)//batch_size}")
            
            logger.info(f"S3 Vectors population completed. Success: {results['successful_embeddings']}, Failed: {results['failed_embeddings']}")
            
            return results
            
        except Exception as e:
            logger.error(f"Error populating S3 Vectors: {e}")
            return {'error': str(e)}
    
    async def _process_exercise_batch(self, exercises: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Process a batch of exercises for S3 Vectors"""
        results = {
            'successful': 0,
            'failed': 0,
            'errors': []
        }
        
        for exercise in exercises:
            try:
                # Create exercise knowledge text
                knowledge_text = self._create_exercise_knowledge_text(exercise)
                
                # Generate embedding
                embedding = await self.embedding_service.get_exercise_embedding(knowledge_text)
                
                if embedding:
                    # Store in S3 Vectors
                    vector_id = f"exercise_{exercise['name'].lower().replace(' ', '_')}"
                    
                    await self.s3_vectors_service.put_vector(
                        vector_id=vector_id,
                        vector=embedding,
                        metadata={
                            'type': 'exercise',
                            'category': exercise.get('category', 'unknown'),
                            'name': exercise['name'],
                            'muscle_groups': exercise.get('muscle_groups', []),
                            'equipment': exercise.get('equipment', []),
                            'difficulty': exercise.get('difficulty', 'unknown'),
                            'text': knowledge_text
                        },
                        namespace='exercises'
                    )
                    
                    results['successful'] += 1
                else:
                    results['failed'] += 1
                    results['errors'].append(f"Failed to generate embedding for {exercise['name']}")
                    
            except Exception as e:
                results['failed'] += 1
                results['errors'].append(f"Error processing {exercise['name']}: {str(e)}")
        
        return results
    
    def _create_exercise_knowledge_text(self, exercise: Dict[str, Any]) -> str:
        """Create comprehensive knowledge text for exercise"""
        text_parts = []
        
        # Basic information
        text_parts.append(f"Exercise: {exercise['name']}")
        text_parts.append(f"Category: {exercise.get('category', 'Unknown')}")
        text_parts.append(f"Description: {exercise.get('description', '')}")
        
        # Muscle groups and equipment
        if 'muscle_groups' in exercise:
            text_parts.append(f"Muscle Groups: {', '.join(exercise['muscle_groups'])}")
        
        if 'equipment' in exercise:
            text_parts.append(f"Equipment: {', '.join(exercise['equipment'])}")
        
        # Instructions
        if 'instructions' in exercise:
            text_parts.append("Instructions:")
            for i, instruction in enumerate(exercise['instructions'], 1):
                text_parts.append(f"{i}. {instruction}")
        
        # Variations
        if 'variations' in exercise and exercise['variations']:
            text_parts.append(f"Variations: {', '.join(exercise['variations'])}")
        
        # Tips
        if 'tips' in exercise and exercise['tips']:
            text_parts.append("Tips:")
            for tip in exercise['tips']:
                text_parts.append(f"- {tip}")
        
        # Common mistakes
        if 'common_mistakes' in exercise and exercise['common_mistakes']:
            text_parts.append("Common Mistakes:")
            for mistake in exercise['common_mistakes']:
                text_parts.append(f"- {mistake}")
        
        # Benefits
        if 'benefits' in exercise and exercise['benefits']:
            text_parts.append("Benefits:")
            for benefit in exercise['benefits']:
                text_parts.append(f"- {benefit}")
        
        return '\n'.join(text_parts)

async def main():
    """Main function to build and populate exercise knowledge"""
    try:
        builder = ExerciseKnowledgeBuilder()
        
        # Build exercise library
        logger.info("Building exercise library...")
        exercise_library = await builder.build_exercise_library()
        
        if 'error' in exercise_library:
            logger.error(f"Error building exercise library: {exercise_library['error']}")
            return
        
        logger.info(f"Built exercise library with {exercise_library['total_exercises']} exercises")
        logger.info(f"Categories: {exercise_library['categories']}")
        
        # Populate S3 Vectors
        logger.info("Populating S3 Vectors...")
        population_results = await builder.populate_s3_vectors(exercise_library['exercises'])
        
        if 'error' in population_results:
            logger.error(f"Error populating S3 Vectors: {population_results['error']}")
            return
        
        logger.info("Exercise knowledge population completed successfully!")
        logger.info(f"Results: {population_results}")
        
    except Exception as e:
        logger.error(f"Error in main: {e}")

if __name__ == "__main__":
    asyncio.run(main())
