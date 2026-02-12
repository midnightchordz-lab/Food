"""
Ingredient Guide Routes
Visual encyclopedia of spices, pulses, and common ingredients
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from bson import ObjectId
from datetime import datetime, timezone
import os
import re
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ingredients", tags=["ingredient-guide"])

# Database connection
mongo_url = os.environ.get('MONGO_URL')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'moodfood')]

# ═══════════════════════════════════════════════════════════════
# PYDANTIC MODELS
# ═══════════════════════════════════════════════════════════════

class AppearanceModel(BaseModel):
    color: str = ""
    shape: str = ""
    size: str = ""
    texture: str = ""
    visual_description: str = ""

class ImageComparison(BaseModel):
    url: str
    caption: str

class ImagesModel(BaseModel):
    primary: str
    comparison: List[ImageComparison] = []
    closeup: str = ""

class SimilarIngredient(BaseModel):
    name: str
    how_to_differentiate: str

class ConfusedWith(BaseModel):
    name: str
    warning: str

class StorageModel(BaseModel):
    method: str = ""
    shelf_life: str = ""
    signs_of_spoilage: List[str] = []

class SubstituteModel(BaseModel):
    name: str
    ratio: str = ""
    notes: str = ""

class IngredientGuideResponse(BaseModel):
    id: str
    name: str
    display_name: str
    alternate_names: List[str] = []
    category: str
    subcategory: str = ""
    images: ImagesModel
    appearance: AppearanceModel
    similar_to: List[SimilarIngredient] = []
    confused_with: List[ConfusedWith] = []
    aroma: str = ""
    taste: str = ""
    common_uses: List[str] = []
    cuisines: List[str] = []
    preparation_tips: List[str] = []
    storage: StorageModel
    substitutes: List[SubstituteModel] = []
    nutritional_highlights: List[str] = []
    beginner_notes: str = ""
    difficulty_level: str = "beginner"
    where_to_find: str = ""
    what_to_look_for: str = ""
    featured: bool = False
    popularity: int = 0

# ═══════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════

def serialize_ingredient(doc: dict) -> dict:
    """Convert MongoDB document to API response format"""
    if not doc:
        return None
    
    return {
        "id": str(doc.get("_id", "")),
        "name": doc.get("name", ""),
        "display_name": doc.get("display_name", ""),
        "alternate_names": doc.get("alternate_names", []),
        "category": doc.get("category", ""),
        "subcategory": doc.get("subcategory", ""),
        "images": doc.get("images", {"primary": "", "comparison": [], "closeup": ""}),
        "appearance": doc.get("appearance", {}),
        "similar_to": doc.get("similar_to", []),
        "confused_with": doc.get("confused_with", []),
        "aroma": doc.get("aroma", ""),
        "taste": doc.get("taste", ""),
        "common_uses": doc.get("common_uses", []),
        "cuisines": doc.get("cuisines", []),
        "preparation_tips": doc.get("preparation_tips", []),
        "storage": doc.get("storage", {}),
        "substitutes": doc.get("substitutes", []),
        "nutritional_highlights": doc.get("nutritional_highlights", []),
        "beginner_notes": doc.get("beginner_notes", ""),
        "difficulty_level": doc.get("difficulty_level", "beginner"),
        "where_to_find": doc.get("where_to_find", ""),
        "what_to_look_for": doc.get("what_to_look_for", ""),
        "featured": doc.get("featured", False),
        "popularity": doc.get("popularity", 0)
    }

def normalize_ingredient_name(name: str) -> str:
    """Normalize ingredient name for matching"""
    # Remove quantities and units
    normalized = re.sub(r'^[\d\s\/½¼¾⅓⅔⅛⅜⅝⅞]+', '', name).strip()
    normalized = re.sub(r'^(cup|cups|tbsp|tablespoon|tablespoons|tsp|teaspoon|teaspoons|oz|ounce|ounces|lb|pound|pounds|g|gram|grams|kg|ml|liter|liters|pinch|dash|bunch|clove|cloves|piece|pieces|slice|slices|can|cans|package|packages|head|heads|stalk|stalks|large|medium|small)\s*', '', normalized, flags=re.IGNORECASE).strip()
    # Remove descriptors like "finely chopped", "minced", etc.
    normalized = re.sub(r',.*$', '', normalized).strip()
    normalized = re.sub(r'\(.*?\)', '', normalized).strip()
    normalized = re.sub(r'\s+(finely|roughly|coarsely|thinly|freshly|chopped|minced|diced|sliced|grated|crushed|ground|whole|dried|fresh|frozen|canned|optional).*$', '', normalized, flags=re.IGNORECASE).strip()
    return normalized.lower()

# ═══════════════════════════════════════════════════════════════
# API ROUTES
# ═══════════════════════════════════════════════════════════════

@router.get("/search")
async def search_ingredients(
    q: str = Query(..., description="Search query"),
    category: Optional[str] = Query(None, description="Filter by category"),
    limit: int = Query(20, ge=1, le=100)
):
    """
    GET /api/ingredients/search?q=cumin
    Search ingredients by name or alternate names
    """
    try:
        search_regex = {"$regex": q, "$options": "i"}
        
        filter_query = {
            "$or": [
                {"name": search_regex},
                {"display_name": search_regex},
                {"alternate_names": search_regex}
            ]
        }
        
        if category:
            filter_query["category"] = category
        
        cursor = db.ingredient_guide.find(filter_query).sort("popularity", -1).limit(limit)
        results = await cursor.to_list(length=limit)
        
        return {
            "success": True,
            "results": [serialize_ingredient(doc) for doc in results],
            "count": len(results)
        }
    except Exception as e:
        logger.error(f"Search error: {e}")
        raise HTTPException(status_code=500, detail="Search failed")


@router.get("/featured")
async def get_featured_ingredients(
    limit: int = Query(10, ge=1, le=50)
):
    """
    GET /api/ingredients/featured
    Get featured/popular ingredients
    """
    try:
        cursor = db.ingredient_guide.find({"featured": True}).sort("popularity", -1).limit(limit)
        results = await cursor.to_list(length=limit)
        
        return {
            "success": True,
            "ingredients": [serialize_ingredient(doc) for doc in results]
        }
    except Exception as e:
        logger.error(f"Featured error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get featured")


@router.get("/category/{category}")
async def get_by_category(
    category: str,
    limit: int = Query(50, ge=1, le=100)
):
    """
    GET /api/ingredients/category/spice_whole
    Get ingredients by category
    """
    try:
        cursor = db.ingredient_guide.find({"category": category}).sort("popularity", -1).limit(limit)
        results = await cursor.to_list(length=limit)
        
        return {
            "success": True,
            "category": category,
            "ingredients": [serialize_ingredient(doc) for doc in results],
            "count": len(results)
        }
    except Exception as e:
        logger.error(f"Category error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get category")


@router.get("/beginner")
async def get_beginner_ingredients(
    limit: int = Query(20, ge=1, le=50)
):
    """
    GET /api/ingredients/beginner
    Get beginner-friendly ingredients
    """
    try:
        cursor = db.ingredient_guide.find({"difficulty_level": "beginner"}).sort("popularity", -1).limit(limit)
        results = await cursor.to_list(length=limit)
        
        return {
            "success": True,
            "ingredients": [serialize_ingredient(doc) for doc in results]
        }
    except Exception as e:
        logger.error(f"Beginner error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get beginners")


@router.get("/name/{ingredient_name:path}")
async def get_by_name(ingredient_name: str):
    """
    GET /api/ingredients/name/cumin seeds
    Get ingredient by name (for recipe linking)
    Normalizes the name to handle variations like "cumin seeds, toasted" -> "cumin seeds"
    """
    try:
        # Normalize the ingredient name
        normalized = normalize_ingredient_name(ingredient_name)
        
        # Try exact match first
        ingredient = await db.ingredient_guide.find_one({
            "$or": [
                {"name": normalized},
                {"alternate_names": normalized}
            ]
        })
        
        # If no exact match, try partial match
        if not ingredient:
            search_regex = {"$regex": f"^{re.escape(normalized)}", "$options": "i"}
            ingredient = await db.ingredient_guide.find_one({
                "$or": [
                    {"name": search_regex},
                    {"alternate_names": search_regex}
                ]
            })
        
        # Try even more fuzzy - contains match
        if not ingredient:
            # Extract key words (remove common words)
            words = [w for w in normalized.split() if w not in ['and', 'or', 'the', 'a', 'an', 'of', 'for', 'to']]
            if words:
                main_word = words[-1] if len(words) > 1 else words[0]  # Usually the main ingredient is last
                search_regex = {"$regex": main_word, "$options": "i"}
                ingredient = await db.ingredient_guide.find_one({
                    "$or": [
                        {"name": search_regex},
                        {"alternate_names": search_regex}
                    ]
                })
        
        if not ingredient:
            return {
                "success": False,
                "error": "Not found",
                "searched_for": normalized
            }
        
        # Increment view count
        await db.ingredient_guide.update_one(
            {"_id": ingredient["_id"]},
            {"$inc": {"view_count": 1}}
        )
        
        return {
            "success": True,
            "ingredient": serialize_ingredient(ingredient)
        }
    except Exception as e:
        logger.error(f"Get by name error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get ingredient")


@router.get("/id/{ingredient_id}")
async def get_by_id(ingredient_id: str):
    """
    GET /api/ingredients/id/{id}
    Get full ingredient details by ID
    """
    try:
        ingredient = await db.ingredient_guide.find_one({"_id": ObjectId(ingredient_id)})
        
        if not ingredient:
            raise HTTPException(status_code=404, detail="Not found")
        
        # Increment view count
        await db.ingredient_guide.update_one(
            {"_id": ingredient["_id"]},
            {"$inc": {"view_count": 1}}
        )
        
        return {
            "success": True,
            "ingredient": serialize_ingredient(ingredient)
        }
    except Exception as e:
        logger.error(f"Get by ID error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get ingredient")


@router.post("/compare")
async def compare_ingredients(ingredient_ids: List[str]):
    """
    POST /api/ingredients/compare
    Compare multiple ingredients side-by-side
    """
    try:
        if len(ingredient_ids) < 2:
            raise HTTPException(status_code=400, detail="At least 2 ingredient IDs required")
        
        object_ids = [ObjectId(id) for id in ingredient_ids]
        cursor = db.ingredient_guide.find({"_id": {"$in": object_ids}})
        ingredients = await cursor.to_list(length=len(ingredient_ids))
        
        return {
            "success": True,
            "ingredients": [serialize_ingredient(doc) for doc in ingredients],
            "comparison_fields": [
                "appearance.color",
                "appearance.shape",
                "appearance.size",
                "aroma",
                "taste",
                "common_uses"
            ]
        }
    except Exception as e:
        logger.error(f"Compare error: {e}")
        raise HTTPException(status_code=500, detail="Comparison failed")


@router.get("/categories")
async def get_all_categories():
    """
    GET /api/ingredients/categories
    Get all available categories with counts
    """
    try:
        pipeline = [
            {"$group": {"_id": "$category", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        
        cursor = db.ingredient_guide.aggregate(pipeline)
        results = await cursor.to_list(length=100)
        
        categories = [
            {"category": r["_id"], "count": r["count"]} 
            for r in results if r["_id"]
        ]
        
        return {
            "success": True,
            "categories": categories
        }
    except Exception as e:
        logger.error(f"Categories error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get categories")
