"""
SerpAPI Routes - Recipe Search, Grocery Store Finder, Price Check
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional
from routes.deps import get_current_user, User
import sys
sys.path.append('/app/backend')
from services.serpapi_service import (
    search_recipes, 
    find_grocery_stores, 
    check_ingredient_prices,
    search_recipe_videos,
    search_food_images
)

router = APIRouter(prefix="/search", tags=["search"])


class RecipeSearchRequest(BaseModel):
    query: str
    cuisine: Optional[str] = None
    dietary: Optional[str] = None
    limit: Optional[int] = 10


class GroceryStoreRequest(BaseModel):
    location: str
    ingredient: Optional[str] = None


class PriceCheckRequest(BaseModel):
    ingredient: str
    location: Optional[str] = "USA"


class VideoSearchRequest(BaseModel):
    recipe_name: str
    limit: Optional[int] = 5


class FoodImageRequest(BaseModel):
    dish_name: str
    cuisine: Optional[str] = ""
    limit: Optional[int] = 3


@router.post("/recipes")
async def api_search_recipes(request: RecipeSearchRequest, current_user: User = Depends(get_current_user)):
    """
    Search for recipes from external websites
    """
    result = await search_recipes(
        query=request.query,
        cuisine=request.cuisine,
        dietary=request.dietary,
        limit=request.limit
    )
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Search failed"))
    
    return result


@router.get("/recipes")
async def api_search_recipes_get(
    query: str = Query(..., description="Recipe search query"),
    cuisine: Optional[str] = Query(None, description="Cuisine type"),
    dietary: Optional[str] = Query(None, description="Dietary preference"),
    limit: Optional[int] = Query(10, description="Number of results"),
    current_user: User = Depends(get_current_user)
):
    """
    Search for recipes from external websites (GET endpoint)
    """
    result = await search_recipes(
        query=query,
        cuisine=cuisine,
        dietary=dietary,
        limit=limit
    )
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Search failed"))
    
    return result


@router.post("/grocery-stores")
async def api_find_grocery_stores(request: GroceryStoreRequest, current_user: User = Depends(get_current_user)):
    """
    Find nearby grocery stores
    """
    result = await find_grocery_stores(
        location=request.location,
        ingredient=request.ingredient
    )
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Store search failed"))
    
    return result


@router.get("/grocery-stores")
async def api_find_grocery_stores_get(
    location: str = Query(..., description="Location (city, address, or coordinates)"),
    ingredient: Optional[str] = Query(None, description="Specific ingredient to find"),
    current_user: User = Depends(get_current_user)
):
    """
    Find nearby grocery stores (GET endpoint)
    """
    result = await find_grocery_stores(
        location=location,
        ingredient=ingredient
    )
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Store search failed"))
    
    return result


@router.post("/ingredient-prices")
async def api_check_ingredient_prices(request: PriceCheckRequest, current_user: User = Depends(get_current_user)):
    """
    Check ingredient prices from various stores
    """
    result = await check_ingredient_prices(
        ingredient=request.ingredient,
        location=request.location
    )
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Price check failed"))
    
    return result


@router.get("/ingredient-prices")
async def api_check_ingredient_prices_get(
    ingredient: str = Query(..., description="Ingredient to check prices for"),
    location: Optional[str] = Query("USA", description="Location for pricing"),
    current_user: User = Depends(get_current_user)
):
    """
    Check ingredient prices from various stores (GET endpoint)
    """
    result = await check_ingredient_prices(
        ingredient=ingredient,
        location=location
    )
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Price check failed"))
    
    return result


@router.post("/recipe-videos")
async def api_search_recipe_videos(request: VideoSearchRequest, current_user: User = Depends(get_current_user)):
    """
    Search for recipe tutorial videos on YouTube
    """
    result = await search_recipe_videos(
        recipe_name=request.recipe_name,
        limit=request.limit
    )
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Video search failed"))
    
    return result


@router.get("/status")
async def search_api_status():
    """
    Check SerpAPI integration status
    """
    import os
    has_key = bool(os.environ.get('SERPAPI_KEY'))
    
    return {
        "service": "serpapi_search",
        "status": "operational" if has_key else "no_api_key",
        "features": [
            "recipe_search",
            "grocery_store_finder", 
            "ingredient_price_check",
            "recipe_videos",
            "food_images"
        ]
    }


@router.post("/food-images")
async def api_search_food_images(request: FoodImageRequest, current_user: User = Depends(get_current_user)):
    """
    Search for food/dish images using Google Images (fast alternative to AI generation)
    """
    result = await search_food_images(
        dish_name=request.dish_name,
        cuisine=request.cuisine,
        limit=request.limit
    )
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Image search failed"))
    
    return result


@router.get("/food-images")
async def api_search_food_images_get(
    dish_name: str = Query(..., description="Name of the dish"),
    cuisine: Optional[str] = Query("", description="Cuisine type"),
    limit: Optional[int] = Query(3, description="Number of images"),
    current_user: User = Depends(get_current_user)
):
    """
    Search for food/dish images (GET endpoint)
    """
    result = await search_food_images(
        dish_name=dish_name,
        cuisine=cuisine,
        limit=limit
    )
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Image search failed"))
    
    return result
