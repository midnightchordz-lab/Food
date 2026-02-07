"""
Recipe Library Routes - Browse and search the AI-generated recipe library
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import logging
import sys

sys.path.append('/app/backend')
from services.recipe_library import (
    get_recipes_from_library,
    search_recipe_library,
    get_library_stats,
    get_random_recipes
)

from .deps import db, User, get_current_user

router = APIRouter(prefix="/recipe-library", tags=["Recipe Library"])


class LibrarySearchRequest(BaseModel):
    query: str
    limit: int = 10


class LibraryFilterRequest(BaseModel):
    cuisine: Optional[str] = None
    dietary: Optional[str] = None
    meal_type: Optional[str] = None
    mood: Optional[str] = None
    limit: int = 12
    exclude_ids: Optional[List[str]] = None


@router.get("/stats")
async def get_stats(current_user: User = Depends(get_current_user)):
    """
    Get statistics about the recipe library.
    
    Returns:
        - total_recipes: Total number of recipes in the library
        - cuisines: Count by cuisine type
        - dietary: Count by dietary preference
        - most_popular: Top 5 most served recipes
    """
    try:
        stats = await get_library_stats(db)
        return stats
    except Exception as e:
        logging.error(f"Error getting library stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/browse")
async def browse_recipes(
    cuisine: Optional[str] = Query(None, description="Filter by cuisine (e.g., Indian, Italian)"),
    dietary: Optional[str] = Query(None, description="Filter by dietary preference (e.g., vegetarian, vegan)"),
    meal_type: Optional[str] = Query(None, description="Filter by meal type (e.g., breakfast, lunch, dinner)"),
    mood: Optional[str] = Query(None, description="Filter by mood (e.g., happy, cozy, stressed)"),
    limit: int = Query(12, ge=1, le=50, description="Number of recipes to return"),
    current_user: User = Depends(get_current_user)
):
    """
    Browse recipes from the library with optional filters.
    Returns the most popular matching recipes.
    """
    try:
        recipes = await get_recipes_from_library(
            db,
            mood=mood or '',
            meal_type=meal_type or '',
            dietary=dietary or '',
            cuisine=cuisine or '',
            limit=limit
        )
        
        return {
            "success": True,
            "count": len(recipes),
            "recipes": recipes,
            "filters": {
                "cuisine": cuisine,
                "dietary": dietary,
                "meal_type": meal_type,
                "mood": mood
            }
        }
    except Exception as e:
        logging.error(f"Error browsing recipes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/filter")
async def filter_recipes(
    request: LibraryFilterRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Filter recipes from the library.
    Supports excluding specific recipe IDs (for "show more" functionality).
    """
    try:
        recipes = await get_recipes_from_library(
            db,
            mood=request.mood or '',
            meal_type=request.meal_type or '',
            dietary=request.dietary or '',
            cuisine=request.cuisine or '',
            limit=request.limit,
            exclude_ids=request.exclude_ids
        )
        
        return {
            "success": True,
            "count": len(recipes),
            "recipes": recipes
        }
    except Exception as e:
        logging.error(f"Error filtering recipes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/search")
async def search_recipes(
    request: LibrarySearchRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Full-text search in the recipe library.
    Searches recipe titles and tags.
    """
    try:
        if not request.query or len(request.query) < 2:
            raise HTTPException(status_code=400, detail="Search query must be at least 2 characters")
        
        recipes = await search_recipe_library(
            db,
            query_text=request.query,
            limit=request.limit
        )
        
        return {
            "success": True,
            "count": len(recipes),
            "query": request.query,
            "recipes": recipes
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error searching recipes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/discover")
async def discover_recipes(
    cuisine: Optional[str] = Query(None, description="Optional cuisine filter"),
    dietary: Optional[str] = Query(None, description="Optional dietary filter"),
    limit: int = Query(6, ge=1, le=20, description="Number of random recipes"),
    current_user: User = Depends(get_current_user)
):
    """
    Discover random recipes from the library.
    Great for recipe exploration and suggestions.
    """
    try:
        recipes = await get_random_recipes(
            db,
            limit=limit,
            cuisine=cuisine or '',
            dietary=dietary or ''
        )
        
        return {
            "success": True,
            "count": len(recipes),
            "recipes": recipes
        }
    except Exception as e:
        logging.error(f"Error discovering recipes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/recipe/{recipe_id}")
async def get_recipe_by_id(
    recipe_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific recipe from the library by ID.
    """
    try:
        recipe = await db.recipe_library.find_one(
            {"id": recipe_id},
            {"_id": 0}
        )
        
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
        
        # Increment times_served
        await db.recipe_library.update_one(
            {"id": recipe_id},
            {
                "$inc": {"times_served": 1},
                "$set": {"last_served": datetime.now(timezone.utc)}
            }
        )
        
        return {
            "success": True,
            "recipe": recipe
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting recipe {recipe_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cuisines")
async def get_available_cuisines(current_user: User = Depends(get_current_user)):
    """
    Get list of all cuisines available in the library with counts.
    """
    try:
        pipeline = [
            {"$match": {"cuisine": {"$ne": None, "$ne": ""}}},
            {"$group": {"_id": "$cuisine", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        
        cuisines = await db.recipe_library.aggregate(pipeline).to_list(length=50)
        
        return {
            "success": True,
            "cuisines": [
                {"name": c["_id"], "count": c["count"]}
                for c in cuisines if c["_id"]
            ]
        }
    except Exception as e:
        logging.error(f"Error getting cuisines: {e}")
        raise HTTPException(status_code=500, detail=str(e))
