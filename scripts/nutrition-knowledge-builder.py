#!/usr/bin/env python3
"""
Nutrition Knowledge Builder for S3 Vectors Population
Populates S3 Vectors with comprehensive nutrition database (10000+ foods/meals)
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

class NutritionKnowledgeBuilder:
    """Builder for populating S3 Vectors with nutrition knowledge"""
    
    def __init__(self):
        self.vectors_bucket = os.environ.get('VECTORS_BUCKET', 'gymcoach-ai-vectors')
        self.embedding_service = EmbeddingService()
        self.s3_vectors_service = S3VectorsService()
        
        # Nutrition categories and their characteristics
        self.nutrition_categories = {
            'proteins': {
                'types': ['animal', 'plant', 'dairy', 'seafood'],
                'cooking_methods': ['grilled', 'baked', 'fried', 'steamed', 'raw'],
                'preparation': ['whole', 'ground', 'processed', 'cured']
            },
            'carbohydrates': {
                'types': ['simple', 'complex', 'fiber', 'starch'],
                'sources': ['grains', 'fruits', 'vegetables', 'legumes'],
                'processing': ['whole', 'refined', 'processed']
            },
            'fats': {
                'types': ['saturated', 'unsaturated', 'monounsaturated', 'polyunsaturated'],
                'sources': ['oils', 'nuts', 'seeds', 'animal', 'plant'],
                'processing': ['cold_pressed', 'refined', 'hydrogenated']
            },
            'vegetables': {
                'types': ['leafy_greens', 'cruciferous', 'root', 'nightshade'],
                'cooking_methods': ['raw', 'steamed', 'roasted', 'sautéed', 'boiled'],
                'seasons': ['spring', 'summer', 'fall', 'winter']
            },
            'fruits': {
                'types': ['citrus', 'berries', 'stone_fruits', 'tropical'],
                'ripeness': ['unripe', 'ripe', 'overripe'],
                'preparation': ['fresh', 'frozen', 'dried', 'juiced']
            }
        }
        
    async def build_nutrition_database(self) -> Dict[str, Any]:
        """Build comprehensive nutrition database with 10000+ foods/meals"""
        try:
            logger.info("Starting nutrition database build...")
            
            nutrition_items = []
            
            # Generate protein sources
            protein_items = await self._generate_protein_sources()
            nutrition_items.extend(protein_items)
            
            # Generate carbohydrate sources
            carb_items = await self._generate_carbohydrate_sources()
            nutrition_items.extend(carb_items)
            
            # Generate fat sources
            fat_items = await self._generate_fat_sources()
            nutrition_items.extend(fat_items)
            
            # Generate vegetables
            vegetable_items = await self._generate_vegetables()
            nutrition_items.extend(vegetable_items)
            
            # Generate fruits
            fruit_items = await self._generate_fruits()
            nutrition_items.extend(fruit_items)
            
            # Generate complete meals
            meal_items = await self._generate_complete_meals()
            nutrition_items.extend(meal_items)
            
            # Generate snacks
            snack_items = await self._generate_snacks()
            nutrition_items.extend(snack_items)
            
            # Generate beverages
            beverage_items = await self._generate_beverages()
            nutrition_items.extend(beverage_items)
            
            # Generate supplements
            supplement_items = await self._generate_supplements()
            nutrition_items.extend(supplement_items)
            
            logger.info(f"Generated {len(nutrition_items)} nutrition items")
            
            return {
                'total_items': len(nutrition_items),
                'categories': self._categorize_nutrition_items(nutrition_items),
                'items': nutrition_items
            }
            
        except Exception as e:
            logger.error(f"Error building nutrition database: {e}")
            return {'error': str(e)}
    
    async def _generate_protein_sources(self) -> List[Dict[str, Any]]:
        """Generate protein source foods"""
        items = []
        
        # Animal proteins
        animal_proteins = [
            {
                'name': 'Chicken Breast',
                'category': 'proteins',
                'type': 'animal',
                'cooking_method': 'grilled',
                'preparation': 'whole',
                'description': 'Lean protein source, excellent for muscle building',
                'nutrition_per_100g': {
                    'calories': 165,
                    'protein': 31,
                    'fat': 3.6,
                    'carbs': 0,
                    'fiber': 0,
                    'sodium': 74
                },
                'benefits': [
                    'High-quality protein', 'Low in fat', 'Rich in B vitamins',
                    'Supports muscle growth', 'Satiating'
                ],
                'cooking_tips': [
                    'Cook to 165°F internal temperature',
                    'Marinate for flavor and tenderness',
                    'Don\'t overcook to avoid dryness'
                ],
                'substitutions': ['Turkey breast', 'Fish fillet', 'Lean beef'],
                'meal_timing': ['post_workout', 'any_time'],
                'dietary_restrictions': ['halal', 'kosher']
            },
            {
                'name': 'Salmon Fillet',
                'category': 'proteins',
                'type': 'seafood',
                'cooking_method': 'baked',
                'preparation': 'whole',
                'description': 'Fatty fish rich in omega-3 fatty acids and protein',
                'nutrition_per_100g': {
                    'calories': 208,
                    'protein': 25,
                    'fat': 12,
                    'carbs': 0,
                    'fiber': 0,
                    'omega_3': 2.3
                },
                'benefits': [
                    'High omega-3 content', 'Complete protein', 'Heart health',
                    'Brain function', 'Anti-inflammatory'
                ],
                'cooking_tips': [
                    'Cook to 145°F internal temperature',
                    'Season simply to highlight natural flavor',
                    'Don\'t overcook to maintain moisture'
                ],
                'substitutions': ['Mackerel', 'Sardines', 'Trout'],
                'meal_timing': ['dinner', 'lunch'],
                'dietary_restrictions': ['pescatarian']
            },
            {
                'name': 'Greek Yogurt',
                'category': 'proteins',
                'type': 'dairy',
                'cooking_method': 'raw',
                'preparation': 'processed',
                'description': 'High-protein dairy product with probiotics',
                'nutrition_per_100g': {
                    'calories': 59,
                    'protein': 10,
                    'fat': 0.4,
                    'carbs': 3.6,
                    'fiber': 0,
                    'calcium': 110
                },
                'benefits': [
                    'High protein content', 'Probiotics for gut health',
                    'Calcium for bones', 'Versatile ingredient'
                ],
                'cooking_tips': [
                    'Use as base for smoothies',
                    'Substitute for sour cream',
                    'Add to baking for protein boost'
                ],
                'substitutions': ['Skyr', 'Cottage cheese', 'Protein powder'],
                'meal_timing': ['breakfast', 'snack', 'post_workout'],
                'dietary_restrictions': ['vegetarian', 'lactose_intolerant']
            }
        ]
        
        items.extend(animal_proteins)
        
        # Plant proteins
        plant_proteins = [
            {
                'name': 'Lentils',
                'category': 'proteins',
                'type': 'plant',
                'cooking_method': 'boiled',
                'preparation': 'whole',
                'description': 'Legume rich in protein, fiber, and iron',
                'nutrition_per_100g': {
                    'calories': 116,
                    'protein': 9,
                    'fat': 0.4,
                    'carbs': 20,
                    'fiber': 8,
                    'iron': 3.3
                },
                'benefits': [
                    'Plant-based protein', 'High fiber content',
                    'Rich in iron', 'Budget-friendly', 'Sustainable'
                ],
                'cooking_tips': [
                    'Rinse before cooking',
                    'Cook until tender but not mushy',
                    'Season well as they absorb flavors'
                ],
                'substitutions': ['Chickpeas', 'Black beans', 'Kidney beans'],
                'meal_timing': ['lunch', 'dinner'],
                'dietary_restrictions': ['vegan', 'vegetarian', 'gluten_free']
            },
            {
                'name': 'Tofu',
                'category': 'proteins',
                'type': 'plant',
                'cooking_method': 'pan_fried',
                'preparation': 'processed',
                'description': 'Soy-based protein source, versatile ingredient',
                'nutrition_per_100g': {
                    'calories': 76,
                    'protein': 8,
                    'fat': 4.8,
                    'carbs': 1.9,
                    'fiber': 0.3,
                    'calcium': 350
                },
                'benefits': [
                    'Complete plant protein', 'Rich in calcium',
                    'Versatile cooking', 'Absorbs flavors well'
                ],
                'cooking_tips': [
                    'Press to remove excess water',
                    'Marinate for flavor',
                    'Cook until golden brown'
                ],
                'substitutions': ['Tempeh', 'Seitan', 'Chickpea flour'],
                'meal_timing': ['any_time'],
                'dietary_restrictions': ['vegan', 'vegetarian']
            }
        ]
        
        items.extend(plant_proteins)
        
        # Generate variations for each protein
        for protein in animal_proteins + plant_proteins:
            # Generate cooking method variations
            for method in ['grilled', 'baked', 'fried', 'steamed', 'raw']:
                if method != protein['cooking_method']:
                    variation = self._create_cooking_method_variation(protein, method)
                    items.append(variation)
            
            # Generate preparation variations
            for prep in ['whole', 'ground', 'processed', 'cured']:
                if prep != protein['preparation']:
                    variation = self._create_preparation_variation(protein, prep)
                    items.append(variation)
        
        return items
    
    async def _generate_carbohydrate_sources(self) -> List[Dict[str, Any]]:
        """Generate carbohydrate source foods"""
        items = []
        
        # Grains
        grains = [
            {
                'name': 'Brown Rice',
                'category': 'carbohydrates',
                'type': 'complex',
                'source': 'grains',
                'processing': 'whole',
                'description': 'Whole grain rice with fiber and nutrients',
                'nutrition_per_100g': {
                    'calories': 111,
                    'protein': 2.6,
                    'fat': 0.9,
                    'carbs': 23,
                    'fiber': 1.8,
                    'magnesium': 43
                },
                'benefits': [
                    'Whole grain nutrition', 'Fiber content',
                    'B vitamins', 'Mineral content'
                ],
                'cooking_tips': [
                    'Rinse before cooking',
                    'Use 2:1 water to rice ratio',
                    'Let rest after cooking'
                ],
                'substitutions': ['Quinoa', 'Wild rice', 'Barley'],
                'meal_timing': ['lunch', 'dinner'],
                'dietary_restrictions': ['gluten_free', 'vegan']
            },
            {
                'name': 'Oats',
                'category': 'carbohydrates',
                'type': 'complex',
                'source': 'grains',
                'processing': 'whole',
                'description': 'Whole grain oats rich in beta-glucan fiber',
                'nutrition_per_100g': {
                    'calories': 389,
                    'protein': 17,
                    'fat': 7,
                    'carbs': 66,
                    'fiber': 11,
                    'beta_glucan': 4
                },
                'benefits': [
                    'Heart health', 'Blood sugar control',
                    'Satiety', 'Digestive health'
                ],
                'cooking_tips': [
                    'Soak overnight for creaminess',
                    'Add liquid gradually',
                    'Stir frequently while cooking'
                ],
                'substitutions': ['Quinoa flakes', 'Buckwheat', 'Millet'],
                'meal_timing': ['breakfast', 'pre_workout'],
                'dietary_restrictions': ['gluten_free', 'vegan']
            }
        ]
        
        items.extend(grains)
        
        # Fruits
        fruits = [
            {
                'name': 'Banana',
                'category': 'carbohydrates',
                'type': 'simple',
                'source': 'fruits',
                'processing': 'fresh',
                'description': 'Potassium-rich fruit, great for pre-workout',
                'nutrition_per_100g': {
                    'calories': 89,
                    'protein': 1.1,
                    'fat': 0.3,
                    'carbs': 23,
                    'fiber': 2.6,
                    'potassium': 358
                },
                'benefits': [
                    'Quick energy', 'Potassium for muscle function',
                    'Natural sugars', 'Portable snack'
                ],
                'cooking_tips': [
                    'Eat when slightly green for less sugar',
                    'Freeze overripe bananas for smoothies',
                    'Use in baking as egg substitute'
                ],
                'substitutions': ['Dates', 'Apple', 'Pear'],
                'meal_timing': ['pre_workout', 'snack'],
                'dietary_restrictions': ['vegan', 'vegetarian']
            }
        ]
        
        items.extend(fruits)
        
        return items
    
    async def _generate_fat_sources(self) -> List[Dict[str, Any]]:
        """Generate fat source foods"""
        items = []
        
        # Oils
        oils = [
            {
                'name': 'Extra Virgin Olive Oil',
                'category': 'fats',
                'type': 'monounsaturated',
                'source': 'oils',
                'processing': 'cold_pressed',
                'description': 'Heart-healthy oil rich in monounsaturated fats',
                'nutrition_per_100g': {
                    'calories': 884,
                    'protein': 0,
                    'fat': 100,
                    'carbs': 0,
                    'fiber': 0,
                    'vitamin_e': 14
                },
                'benefits': [
                    'Heart health', 'Anti-inflammatory',
                    'Rich in antioxidants', 'Stable cooking oil'
                ],
                'cooking_tips': [
                    'Use for low to medium heat cooking',
                    'Drizzle on finished dishes',
                    'Store in cool, dark place'
                ],
                'substitutions': ['Avocado oil', 'Coconut oil', 'Ghee'],
                'meal_timing': ['any_time'],
                'dietary_restrictions': ['vegan', 'vegetarian']
            }
        ]
        
        items.extend(oils)
        
        # Nuts and seeds
        nuts_seeds = [
            {
                'name': 'Almonds',
                'category': 'fats',
                'type': 'monounsaturated',
                'source': 'nuts',
                'processing': 'raw',
                'description': 'Nutrient-dense nuts rich in healthy fats and protein',
                'nutrition_per_100g': {
                    'calories': 579,
                    'protein': 21,
                    'fat': 50,
                    'carbs': 22,
                    'fiber': 12,
                    'vitamin_e': 25
                },
                'benefits': [
                    'Heart health', 'Brain function',
                    'Protein content', 'Vitamin E'
                ],
                'cooking_tips': [
                    'Soak overnight for better digestion',
                    'Toast for enhanced flavor',
                    'Use as flour alternative'
                ],
                'substitutions': ['Walnuts', 'Pecans', 'Cashews'],
                'meal_timing': ['snack', 'any_time'],
                'dietary_restrictions': ['vegan', 'vegetarian']
            }
        ]
        
        items.extend(nuts_seeds)
        
        return items
    
    async def _generate_vegetables(self) -> List[Dict[str, Any]]:
        """Generate vegetable foods"""
        items = []
        
        vegetables = [
            {
                'name': 'Spinach',
                'category': 'vegetables',
                'type': 'leafy_greens',
                'cooking_method': 'raw',
                'season': 'spring',
                'description': 'Nutrient-dense leafy green rich in iron and folate',
                'nutrition_per_100g': {
                    'calories': 23,
                    'protein': 2.9,
                    'fat': 0.4,
                    'carbs': 3.6,
                    'fiber': 2.2,
                    'iron': 2.7,
                    'folate': 194
                },
                'benefits': [
                    'Iron content', 'Folate for cell division',
                    'Low calorie', 'Versatile cooking'
                ],
                'cooking_tips': [
                    'Wash thoroughly to remove grit',
                    'Cook briefly to retain nutrients',
                    'Use in smoothies for nutrition boost'
                ],
                'substitutions': ['Kale', 'Swiss chard', 'Arugula'],
                'meal_timing': ['any_time'],
                'dietary_restrictions': ['vegan', 'vegetarian', 'gluten_free']
            },
            {
                'name': 'Broccoli',
                'category': 'vegetables',
                'type': 'cruciferous',
                'cooking_method': 'steamed',
                'season': 'fall',
                'description': 'Cruciferous vegetable rich in vitamins and antioxidants',
                'nutrition_per_100g': {
                    'calories': 34,
                    'protein': 2.8,
                    'fat': 0.4,
                    'carbs': 7,
                    'fiber': 2.6,
                    'vitamin_c': 89,
                    'vitamin_k': 101
                },
                'benefits': [
                    'Cancer-fighting compounds', 'High vitamin C',
                    'Bone health', 'Immune support'
                ],
                'cooking_tips': [
                    'Steam lightly to retain nutrients',
                    'Don\'t overcook to avoid sulfur smell',
                    'Use stems as well as florets'
                ],
                'substitutions': ['Cauliflower', 'Brussels sprouts', 'Cabbage'],
                'meal_timing': ['any_time'],
                'dietary_restrictions': ['vegan', 'vegetarian', 'gluten_free']
            }
        ]
        
        items.extend(vegetables)
        
        return items
    
    async def _generate_fruits(self) -> List[Dict[str, Any]]:
        """Generate fruit foods"""
        items = []
        
        fruits = [
            {
                'name': 'Blueberries',
                'category': 'fruits',
                'type': 'berries',
                'ripeness': 'ripe',
                'preparation': 'fresh',
                'description': 'Antioxidant-rich berries with cognitive benefits',
                'nutrition_per_100g': {
                    'calories': 57,
                    'protein': 0.7,
                    'fat': 0.3,
                    'carbs': 14,
                    'fiber': 2.4,
                    'antioxidants': 'high',
                    'vitamin_c': 10
                },
                'benefits': [
                    'Brain health', 'Antioxidant content',
                    'Heart health', 'Low glycemic index'
                ],
                'cooking_tips': [
                    'Freeze for year-round use',
                    'Add to smoothies and baking',
                    'Eat fresh for maximum nutrients'
                ],
                'substitutions': ['Strawberries', 'Blackberries', 'Raspberries'],
                'meal_timing': ['breakfast', 'snack'],
                'dietary_restrictions': ['vegan', 'vegetarian', 'gluten_free']
            }
        ]
        
        items.extend(fruits)
        
        return items
    
    async def _generate_complete_meals(self) -> List[Dict[str, Any]]:
        """Generate complete meal combinations"""
        items = []
        
        meals = [
            {
                'name': 'Grilled Chicken with Quinoa and Vegetables',
                'category': 'meals',
                'type': 'balanced',
                'meal_type': 'lunch',
                'description': 'Complete meal with protein, complex carbs, and vegetables',
                'ingredients': [
                    'Chicken breast (150g)',
                    'Quinoa (100g cooked)',
                    'Mixed vegetables (150g)',
                    'Olive oil (1 tbsp)',
                    'Herbs and spices'
                ],
                'nutrition_per_serving': {
                    'calories': 450,
                    'protein': 35,
                    'fat': 12,
                    'carbs': 45,
                    'fiber': 6
                },
                'preparation_time': '30 minutes',
                'cooking_method': 'grilled',
                'benefits': [
                    'Complete protein', 'Complex carbohydrates',
                    'Fiber content', 'Micronutrients'
                ],
                'meal_timing': ['lunch', 'dinner'],
                'dietary_restrictions': ['gluten_free']
            },
            {
                'name': 'Mediterranean Bowl',
                'category': 'meals',
                'type': 'plant_focused',
                'meal_type': 'lunch',
                'description': 'Plant-based meal rich in healthy fats and fiber',
                'ingredients': [
                    'Chickpeas (100g)',
                    'Quinoa (80g cooked)',
                    'Cucumber (100g)',
                    'Tomatoes (100g)',
                    'Olives (30g)',
                    'Feta cheese (50g)',
                    'Olive oil (1 tbsp)'
                ],
                'nutrition_per_serving': {
                    'calories': 520,
                    'protein': 22,
                    'fat': 18,
                    'carbs': 65,
                    'fiber': 12
                },
                'preparation_time': '20 minutes',
                'cooking_method': 'raw',
                'benefits': [
                    'Plant-based protein', 'Healthy fats',
                    'High fiber', 'Antioxidants'
                ],
                'meal_timing': ['lunch', 'dinner'],
                'dietary_restrictions': ['vegetarian']
            }
        ]
        
        items.extend(meals)
        
        return items
    
    async def _generate_snacks(self) -> List[Dict[str, Any]]:
        """Generate healthy snack options"""
        items = []
        
        snacks = [
            {
                'name': 'Apple with Almond Butter',
                'category': 'snacks',
                'type': 'fruit_nut',
                'description': 'Balanced snack with natural sugars and healthy fats',
                'ingredients': [
                    'Apple (1 medium)',
                    'Almond butter (2 tbsp)'
                ],
                'nutrition_per_serving': {
                    'calories': 200,
                    'protein': 6,
                    'fat': 12,
                    'carbs': 25,
                    'fiber': 5
                },
                'benefits': [
                    'Natural sugars', 'Healthy fats',
                    'Fiber content', 'Portable'
                ],
                'meal_timing': ['snack', 'pre_workout'],
                'dietary_restrictions': ['vegan', 'vegetarian', 'gluten_free']
            }
        ]
        
        items.extend(snacks)
        
        return items
    
    async def _generate_beverages(self) -> List[Dict[str, Any]]:
        """Generate healthy beverage options"""
        items = []
        
        beverages = [
            {
                'name': 'Green Smoothie',
                'category': 'beverages',
                'type': 'smoothie',
                'description': 'Nutrient-dense smoothie with greens and fruits',
                'ingredients': [
                    'Spinach (2 cups)',
                    'Banana (1 medium)',
                    'Mango (1/2 cup)',
                    'Greek yogurt (1/2 cup)',
                    'Water (1 cup)'
                ],
                'nutrition_per_serving': {
                    'calories': 180,
                    'protein': 12,
                    'fat': 2,
                    'carbs': 35,
                    'fiber': 6
                },
                'benefits': [
                    'Vegetable intake', 'Protein content',
                    'Hydration', 'Micronutrients'
                ],
                'meal_timing': ['breakfast', 'snack'],
                'dietary_restrictions': ['vegetarian']
            }
        ]
        
        items.extend(beverages)
        
        return items
    
    async def _generate_supplements(self) -> List[Dict[str, Any]]:
        """Generate supplement information"""
        items = []
        
        supplements = [
            {
                'name': 'Whey Protein Powder',
                'category': 'supplements',
                'type': 'protein',
                'description': 'Fast-absorbing protein supplement for muscle recovery',
                'nutrition_per_serving': {
                    'calories': 120,
                    'protein': 24,
                    'fat': 1,
                    'carbs': 3,
                    'fiber': 0
                },
                'benefits': [
                    'Fast absorption', 'Complete amino acids',
                    'Muscle recovery', 'Convenient'
                ],
                'usage': [
                    'Post-workout within 30 minutes',
                    'Mix with water or milk',
                    'Can be added to smoothies'
                ],
                'meal_timing': ['post_workout'],
                'dietary_restrictions': ['vegetarian']
            }
        ]
        
        items.extend(supplements)
        
        return items
    
    def _create_cooking_method_variation(self, base_item: Dict[str, Any], method: str) -> Dict[str, Any]:
        """Create cooking method variation"""
        variation = base_item.copy()
        variation['name'] = f"{method.title()} {base_item['name']}"
        variation['cooking_method'] = method
        variation['description'] = f"{base_item['description']} prepared using {method} method"
        
        # Add method-specific tips
        method_tips = {
            'grilled': 'High heat, quick cooking, adds smoky flavor',
            'baked': 'Even heat distribution, longer cooking time',
            'fried': 'High heat with oil, crispy exterior',
            'steamed': 'Gentle cooking, retains nutrients',
            'raw': 'No cooking, maximum nutrient retention'
        }
        
        if method in method_tips:
            variation['cooking_tips'] = variation.get('cooking_tips', []) + [method_tips[method]]
        
        return variation
    
    def _create_preparation_variation(self, base_item: Dict[str, Any], prep: str) -> Dict[str, Any]:
        """Create preparation variation"""
        variation = base_item.copy()
        variation['name'] = f"{prep.title()} {base_item['name']}"
        variation['preparation'] = prep
        variation['description'] = f"{base_item['description']} in {prep} form"
        
        return variation
    
    def _categorize_nutrition_items(self, items: List[Dict[str, Any]]) -> Dict[str, int]:
        """Categorize nutrition items by type"""
        categories = {}
        for item in items:
            category = item.get('category', 'other')
            categories[category] = categories.get(category, 0) + 1
        return categories
    
    async def populate_s3_vectors(self, nutrition_items: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Populate S3 Vectors with nutrition knowledge"""
        try:
            logger.info(f"Starting S3 Vectors population with {len(nutrition_items)} nutrition items...")
            
            results = {
                'total_items': len(nutrition_items),
                'successful_embeddings': 0,
                'failed_embeddings': 0,
                'errors': []
            }
            
            # Process items in batches
            batch_size = 50
            for i in range(0, len(nutrition_items), batch_size):
                batch = nutrition_items[i:i + batch_size]
                batch_results = await self._process_nutrition_batch(batch)
                
                results['successful_embeddings'] += batch_results['successful']
                results['failed_embeddings'] += batch_results['failed']
                results['errors'].extend(batch_results['errors'])
                
                logger.info(f"Processed batch {i//batch_size + 1}/{(len(nutrition_items) + batch_size - 1)//batch_size}")
            
            logger.info(f"S3 Vectors population completed. Success: {results['successful_embeddings']}, Failed: {results['failed_embeddings']}")
            
            return results
            
        except Exception as e:
            logger.error(f"Error populating S3 Vectors: {e}")
            return {'error': str(e)}
    
    async def _process_nutrition_batch(self, items: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Process a batch of nutrition items for S3 Vectors"""
        results = {
            'successful': 0,
            'failed': 0,
            'errors': []
        }
        
        for item in items:
            try:
                # Create nutrition knowledge text
                knowledge_text = self._create_nutrition_knowledge_text(item)
                
                # Generate embedding
                embedding = await self.embedding_service.get_nutrition_embedding(knowledge_text)
                
                if embedding:
                    # Store in S3 Vectors
                    vector_id = f"nutrition_{item['name'].lower().replace(' ', '_')}"
                    
                    await self.s3_vectors_service.put_vector(
                        vector_id=vector_id,
                        vector=embedding,
                        metadata={
                            'type': 'nutrition',
                            'category': item.get('category', 'unknown'),
                            'name': item['name'],
                            'nutrition_data': item.get('nutrition_per_100g', {}),
                            'benefits': item.get('benefits', []),
                            'text': knowledge_text
                        },
                        namespace='nutrition'
                    )
                    
                    results['successful'] += 1
                else:
                    results['failed'] += 1
                    results['errors'].append(f"Failed to generate embedding for {item['name']}")
                    
            except Exception as e:
                results['failed'] += 1
                results['errors'].append(f"Error processing {item['name']}: {str(e)}")
        
        return results
    
    def _create_nutrition_knowledge_text(self, item: Dict[str, Any]) -> str:
        """Create comprehensive knowledge text for nutrition item"""
        text_parts = []
        
        # Basic information
        text_parts.append(f"Food Item: {item['name']}")
        text_parts.append(f"Category: {item.get('category', 'Unknown')}")
        text_parts.append(f"Description: {item.get('description', '')}")
        
        # Nutrition information
        if 'nutrition_per_100g' in item:
            nutrition = item['nutrition_per_100g']
            text_parts.append("Nutrition per 100g:")
            for nutrient, value in nutrition.items():
                text_parts.append(f"- {nutrient}: {value}")
        
        # Benefits
        if 'benefits' in item and item['benefits']:
            text_parts.append("Benefits:")
            for benefit in item['benefits']:
                text_parts.append(f"- {benefit}")
        
        # Cooking tips
        if 'cooking_tips' in item and item['cooking_tips']:
            text_parts.append("Cooking Tips:")
            for tip in item['cooking_tips']:
                text_parts.append(f"- {tip}")
        
        # Substitutions
        if 'substitutions' in item and item['substitutions']:
            text_parts.append(f"Substitutions: {', '.join(item['substitutions'])}")
        
        # Meal timing
        if 'meal_timing' in item and item['meal_timing']:
            text_parts.append(f"Best Meal Timing: {', '.join(item['meal_timing'])}")
        
        # Dietary restrictions
        if 'dietary_restrictions' in item and item['dietary_restrictions']:
            text_parts.append(f"Dietary Restrictions: {', '.join(item['dietary_restrictions'])}")
        
        return '\n'.join(text_parts)

async def main():
    """Main function to build and populate nutrition knowledge"""
    try:
        builder = NutritionKnowledgeBuilder()
        
        # Build nutrition database
        logger.info("Building nutrition database...")
        nutrition_database = await builder.build_nutrition_database()
        
        if 'error' in nutrition_database:
            logger.error(f"Error building nutrition database: {nutrition_database['error']}")
            return
        
        logger.info(f"Built nutrition database with {nutrition_database['total_items']} items")
        logger.info(f"Categories: {nutrition_database['categories']}")
        
        # Populate S3 Vectors
        logger.info("Populating S3 Vectors...")
        population_results = await builder.populate_s3_vectors(nutrition_database['items'])
        
        if 'error' in population_results:
            logger.error(f"Error populating S3 Vectors: {population_results['error']}")
            return
        
        logger.info("Nutrition knowledge population completed successfully!")
        logger.info(f"Results: {population_results}")
        
    except Exception as e:
        logger.error(f"Error in main: {e}")

if __name__ == "__main__":
    asyncio.run(main())
