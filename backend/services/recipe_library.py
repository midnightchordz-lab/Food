"""
Recipe Library Service - Stores and retrieves AI-generated recipes

This creates a growing, proprietary library of recipes that:
1. Reduces reliance on repeated LLM calls for similar queries
2. Improves performance by serving cached recipes
3. Builds a valuable recipe database over time
"""
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import hashlib
import logging
import re

# Database connection will be imported from deps
from motor.motor_asyncio import AsyncIOMotorDatabase

# Recipe Library Collection Schema:
# {
#     "id": str,                    # Unique recipe ID
#     "title": str,                 # Recipe title
#     "title_normalized": str,      # Lowercase title for dedup
#     "description": str,           # Recipe description
#     "cooking_time": str,          # e.g., "30 min"
#     "difficulty": str,            # Easy/Medium/Hard
#     "cuisine": str,               # e.g., "Indian", "Italian"
#     "dietary": str,               # e.g., "vegetarian", "vegan"
#     "meal_type": str,             # e.g., "breakfast", "lunch", "dinner"
#     "mood": str,                  # e.g., "happy", "cozy", "stressed"
#     "ingredients": List[str],     # List of ingredients
#     "full_content": str,          # Full recipe text from LLM
#     "source": str,                # "ai_generated" or "serpapi"
#     "times_served": int,          # How many times this recipe was shown
#     "created_at": datetime,       # When first generated
#     "last_served": datetime,      # When last shown to a user
#     "tags": List[str],            # Searchable tags
#     "is_premium": bool,           # NEW: Whether recipe requires premium subscription
#     "premium_reason": str,        # NEW: Why recipe is premium (gourmet, complex, etc.)
# }

# Premium recipe criteria - recipes matching these patterns are marked as premium
PREMIUM_INDICATORS = {
    "ingredients": [
        "truffle", "saffron", "wagyu", "caviar", "foie gras", "lobster",
        "crab", "champagne", "balsamic reduction", "aged cheese", "prosciutto",
        "iberico", "matsutake", "black cod", "sea urchin", "uni", "scallop"
    ],
    "cooking_methods": [
        "sous vide", "confit", "braise", "slow-cooked", "flambé",
        "dehydrated", "fermented", "smoked", "aged", "cured"
    ],
    "cuisine_styles": [
        "fine dining", "molecular gastronomy", "fusion", "tasting menu",
        "michelin", "gourmet", "artisanal", "chef's special"
    ]
}


def is_recipe_premium(recipe: Dict[str, Any]) -> tuple[bool, str]:
    """
    Determine if a recipe should be marked as premium based on its attributes.
    
    Returns:
        (is_premium: bool, reason: str)
    """
    title_lower = recipe.get('title', '').lower()
    description_lower = recipe.get('description', '').lower()
    ingredients = [ing.lower() for ing in recipe.get('ingredients', [])]
    full_content = recipe.get('full_content', '').lower()
    
    all_text = f"{title_lower} {description_lower} {' '.join(ingredients)} {full_content}"
    
    # Check for premium ingredients
    for ing in PREMIUM_INDICATORS["ingredients"]:
        if ing in all_text:
            return True, f"Contains premium ingredient: {ing}"
    
    # Check for advanced cooking methods
    for method in PREMIUM_INDICATORS["cooking_methods"]:
        if method in all_text:
            return True, f"Uses advanced technique: {method}"
    
    # Check for premium cuisine styles
    for style in PREMIUM_INDICATORS["cuisine_styles"]:
        if style in all_text:
            return True, f"Premium cuisine style: {style}"
    
    # Check for high complexity (many ingredients or long cooking time)
    if len(ingredients) > 15:
        return True, "Complex recipe with 15+ ingredients"
    
    cooking_time = recipe.get('cooking_time', '').lower()
    if 'hour' in cooking_time:
        try:
            hours = int(''.join(filter(str.isdigit, cooking_time.split('hour')[0])))
            if hours >= 3:
                return True, f"Extended cooking time: {hours}+ hours"
        except:
            pass
    
    # Default: not premium
    return False, ""


def normalize_title(title: str) -> str:
    """Normalize title for deduplication"""
    # Lowercase, remove extra spaces, remove special chars
    normalized = title.lower().strip()
    normalized = re.sub(r'[^\w\s]', '', normalized)
    normalized = re.sub(r'\s+', ' ', normalized)
    return normalized


def generate_recipe_id(title: str, cuisine: str, dietary: str) -> str:
    """Generate unique recipe ID from title and attributes"""
    key = f"{normalize_title(title)}:{cuisine.lower()}:{dietary.lower()}"
    return hashlib.md5(key.encode()).hexdigest()[:16]


def generate_tags(recipe: Dict[str, Any]) -> List[str]:
    """Generate searchable tags from recipe attributes"""
    tags = []
    
    # Add cuisine
    if recipe.get('cuisine'):
        tags.append(recipe['cuisine'].lower())
    
    # Add dietary preference
    if recipe.get('dietary'):
        tags.append(recipe['dietary'].lower())
    
    # Add meal type
    if recipe.get('meal_type'):
        tags.append(recipe['meal_type'].lower())
    
    # Add mood
    if recipe.get('mood'):
        tags.append(recipe['mood'].lower())
    
    # Add difficulty
    if recipe.get('difficulty'):
        tags.append(recipe['difficulty'].lower())
    
    # Extract key ingredients as tags
    if recipe.get('ingredients'):
        for ing in recipe['ingredients'][:5]:  # First 5 ingredients
            # Clean up ingredient name
            ing_clean = re.sub(r'\d+.*?(cups?|tbsp|tsp|oz|g|ml|lb|kg)?\s*', '', ing.lower()).strip()
            if len(ing_clean) > 2:
                tags.append(ing_clean.split(',')[0].strip())
    
    # Extract keywords from title
    title_words = normalize_title(recipe.get('title', '')).split()
    for word in title_words:
        if len(word) > 3 and word not in ['with', 'and', 'the', 'for']:
            tags.append(word)
    
    return list(set(tags))


async def save_recipes_to_library(
    db: AsyncIOMotorDatabase,
    recipes: List[Dict[str, Any]],
    mood: str = '',
    meal_type: str = '',
    dietary: str = '',
    cuisine: str = ''
) -> int:
    """
    Save AI-generated recipes to the library.
    Deduplicates by normalized title + cuisine + dietary.
    Automatically marks premium recipes based on content.
    
    Returns: Number of new recipes saved
    """
    saved_count = 0
    
    for recipe in recipes:
        try:
            title = recipe.get('title', '')
            if not title or len(title) < 5:
                continue
            
            recipe_cuisine = recipe.get('cuisine', cuisine) or cuisine
            recipe_dietary = recipe.get('dietary', dietary) or dietary
            
            # Generate unique ID
            recipe_id = generate_recipe_id(title, recipe_cuisine, recipe_dietary)
            
            # Check if recipe already exists
            existing = await db.recipe_library.find_one({"id": recipe_id})
            
            if existing:
                # Update times_served and last_served
                await db.recipe_library.update_one(
                    {"id": recipe_id},
                    {
                        "$inc": {"times_served": 1},
                        "$set": {"last_served": datetime.now(timezone.utc)}
                    }
                )
                logging.debug(f"Recipe already exists, updated times_served: {title}")
            else:
                # Determine if recipe is premium
                is_premium, premium_reason = is_recipe_premium(recipe)
                
                # Create new recipe entry
                recipe_doc = {
                    "id": recipe_id,
                    "title": title,
                    "title_normalized": normalize_title(title),
                    "description": recipe.get('description', ''),
                    "cooking_time": recipe.get('cooking_time', '30 min'),
                    "difficulty": recipe.get('difficulty', 'Medium'),
                    "cuisine": recipe_cuisine,
                    "dietary": recipe_dietary,
                    "meal_type": meal_type,
                    "mood": mood,
                    "ingredients": recipe.get('ingredients', []),
                    "full_content": recipe.get('full_content', ''),
                    "source": "ai_generated",
                    "times_served": 1,
                    "created_at": datetime.now(timezone.utc),
                    "last_served": datetime.now(timezone.utc),
                    "is_premium": is_premium,
                    "premium_reason": premium_reason if is_premium else None,
                    "tags": generate_tags({
                        **recipe,
                        'dietary': recipe_dietary,
                        'meal_type': meal_type,
                        'mood': mood
                    })
                }
                
                await db.recipe_library.insert_one(recipe_doc)
                saved_count += 1
                premium_label = " [PREMIUM]" if is_premium else ""
                logging.info(f"Saved new recipe to library: {title} ({recipe_cuisine}){premium_label}")
        
        except Exception as e:
            logging.error(f"Error saving recipe '{recipe.get('title', 'unknown')}': {e}")
            continue
    
    return saved_count


async def get_recipes_from_library(
    db: AsyncIOMotorDatabase,
    mood: str = '',
    meal_type: str = '',
    dietary: str = '',
    cuisine: str = '',
    limit: int = 6,
    exclude_ids: List[str] = None
) -> List[Dict[str, Any]]:
    """
    Retrieve recipes from the library matching the criteria.
    
    Args:
        db: Database connection
        mood: User's mood (optional)
        meal_type: Meal type (optional)
        dietary: Dietary preference (optional)
        cuisine: Cuisine type (optional)
        limit: Max recipes to return
        exclude_ids: Recipe IDs to exclude (for "show more")
    
    Returns: List of matching recipes
    """
    query = {}
    
    # Build query based on provided criteria
    if cuisine and cuisine.lower() not in ['any', 'any cuisine']:
        query["cuisine"] = {"$regex": cuisine, "$options": "i"}
    
    if dietary and dietary.lower() not in ['any', 'none']:
        query["dietary"] = {"$regex": dietary, "$options": "i"}
    
    if meal_type:
        query["meal_type"] = {"$regex": meal_type, "$options": "i"}
    
    if mood:
        query["mood"] = {"$regex": mood, "$options": "i"}
    
    # Exclude specific recipes (for "show more" functionality)
    if exclude_ids:
        query["id"] = {"$nin": exclude_ids}
    
    try:
        # Sort by times_served (most popular) and last_served (recent)
        cursor = db.recipe_library.find(
            query,
            {"_id": 0}
        ).sort([
            ("times_served", -1),
            ("last_served", -1)
        ]).limit(limit)
        
        recipes = await cursor.to_list(length=limit)
        
        if recipes:
            logging.info(f"Found {len(recipes)} recipes in library for: cuisine={cuisine}, dietary={dietary}, meal={meal_type}, mood={mood}")
        
        return recipes
    
    except Exception as e:
        logging.error(f"Error retrieving recipes from library: {e}")
        return []


async def search_recipe_library(
    db: AsyncIOMotorDatabase,
    query_text: str,
    limit: int = 10
) -> List[Dict[str, Any]]:
    """
    Full-text search in recipe library.
    
    Args:
        db: Database connection
        query_text: Search query
        limit: Max results
    
    Returns: List of matching recipes
    """
    try:
        # Search in tags and title
        search_terms = query_text.lower().split()
        
        # Build OR query for each term
        or_conditions = []
        for term in search_terms:
            or_conditions.append({"tags": {"$regex": term, "$options": "i"}})
            or_conditions.append({"title_normalized": {"$regex": term, "$options": "i"}})
        
        cursor = db.recipe_library.find(
            {"$or": or_conditions},
            {"_id": 0}
        ).sort("times_served", -1).limit(limit)
        
        recipes = await cursor.to_list(length=limit)
        return recipes
    
    except Exception as e:
        logging.error(f"Error searching recipe library: {e}")
        return []


async def get_library_stats(db: AsyncIOMotorDatabase) -> Dict[str, Any]:
    """Get statistics about the recipe library"""
    try:
        total_recipes = await db.recipe_library.count_documents({})
        
        # Count by cuisine
        cuisine_pipeline = [
            {"$group": {"_id": "$cuisine", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]
        cuisines = await db.recipe_library.aggregate(cuisine_pipeline).to_list(length=10)
        
        # Count by dietary
        dietary_pipeline = [
            {"$group": {"_id": "$dietary", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        dietary = await db.recipe_library.aggregate(dietary_pipeline).to_list(length=10)
        
        # Most popular recipes
        popular = await db.recipe_library.find(
            {},
            {"_id": 0, "title": 1, "cuisine": 1, "times_served": 1}
        ).sort("times_served", -1).limit(5).to_list(length=5)
        
        return {
            "total_recipes": total_recipes,
            "cuisines": {c["_id"]: c["count"] for c in cuisines if c["_id"]},
            "dietary": {d["_id"]: d["count"] for d in dietary if d["_id"]},
            "most_popular": popular
        }
    
    except Exception as e:
        logging.error(f"Error getting library stats: {e}")
        return {"total_recipes": 0, "error": str(e)}


async def get_random_recipes(
    db: AsyncIOMotorDatabase,
    limit: int = 6,
    cuisine: str = '',
    dietary: str = ''
) -> List[Dict[str, Any]]:
    """
    Get random recipes from the library for discovery.
    Uses MongoDB's $sample for true randomness.
    """
    try:
        pipeline = []
        
        # Add match stage if filters provided
        match_stage = {}
        if cuisine and cuisine.lower() not in ['any', 'any cuisine']:
            match_stage["cuisine"] = {"$regex": cuisine, "$options": "i"}
        if dietary and dietary.lower() not in ['any', 'none']:
            match_stage["dietary"] = {"$regex": dietary, "$options": "i"}
        
        if match_stage:
            pipeline.append({"$match": match_stage})
        
        # Random sample
        pipeline.append({"$sample": {"size": limit}})
        
        # Project fields
        pipeline.append({"$project": {"_id": 0}})
        
        recipes = await db.recipe_library.aggregate(pipeline).to_list(length=limit)
        return recipes
    
    except Exception as e:
        logging.error(f"Error getting random recipes: {e}")
        return []
