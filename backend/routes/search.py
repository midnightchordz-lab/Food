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
    search_food_images,
    check_ingredient_price_with_store,
    batch_ingredient_prices,
    build_shopping_cart,
    search_recipes_for_mood,
    SUPPORTED_STORES
)

router = APIRouter(prefix="/search", tags=["search"])


class RecipeSearchRequest(BaseModel):
    query: str
    cuisine: Optional[str] = None
    dietary: Optional[str] = None
    limit: Optional[int] = 10


class MoodRecipeSearchRequest(BaseModel):
    mood: str
    cuisine: str
    meal_type: Optional[str] = "dinner"
    dietary: Optional[str] = None
    limit: Optional[int] = 6


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


class StoreFilteredPriceRequest(BaseModel):
    ingredient: str
    location: Optional[str] = "USA"
    store: Optional[str] = None  # amazon, walmart, target, etc.


class BatchPriceRequest(BaseModel):
    ingredients: List[str]
    location: Optional[str] = "USA"


class ShoppingCartRequest(BaseModel):
    recipes: List[dict]  # [{"name": "Recipe Name", "ingredients": ["ing1", "ing2"]}]
    location: Optional[str] = "USA"


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


@router.post("/recipes/mood")
async def api_search_recipes_by_mood(request: MoodRecipeSearchRequest, current_user: User = Depends(get_current_user)):
    """
    Search for recipes based on mood, cuisine, and meal type.
    Returns rich recipe data from Google's recipe search results with ratings,
    cooking time, ingredients, and source links.
    
    This integrates SerpAPI's Google Recipes Results for diverse, real recipes.
    """
    result = await search_recipes_for_mood(
        mood=request.mood,
        cuisine=request.cuisine,
        meal_type=request.meal_type,
        dietary=request.dietary,
        limit=request.limit
    )
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Recipe search failed"))
    
    return result


@router.get("/recipes/mood")
async def api_search_recipes_by_mood_get(
    mood: str = Query(..., description="Mood (happy, sad, stressed, tired, cozy, etc.)"),
    cuisine: str = Query(..., description="Cuisine type (Indian, Italian, Mexican, etc.)"),
    meal_type: Optional[str] = Query("dinner", description="Meal type (breakfast, lunch, dinner, snack)"),
    dietary: Optional[str] = Query(None, description="Dietary preference (vegetarian, vegan, etc.)"),
    limit: Optional[int] = Query(6, description="Number of recipes to return"),
    current_user: User = Depends(get_current_user)
):
    """
    Search for recipes based on mood, cuisine, and meal type (GET endpoint).
    Returns rich recipe data from Google's recipe search results.
    """
    result = await search_recipes_for_mood(
        mood=mood,
        cuisine=cuisine,
        meal_type=meal_type,
        dietary=dietary,
        limit=limit
    )
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Recipe search failed"))
    
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


# ============== ENHANCED SHOPPING FEATURES ==============

@router.get("/supported-stores")
async def get_supported_stores():
    """
    Get list of supported stores for filtering
    """
    return {
        "stores": [
            {"id": k, "name": v["name"], "domain": v["domain"]} 
            for k, v in SUPPORTED_STORES.items()
        ]
    }


@router.post("/ingredient-price-filtered")
async def api_ingredient_price_with_store(
    request: StoreFilteredPriceRequest, 
    current_user: User = Depends(get_current_user)
):
    """
    Check ingredient price with optional store filter.
    Supports: amazon, walmart, target, instacart, kroger, wholefoods, costco, safeway
    """
    result = await check_ingredient_price_with_store(
        ingredient=request.ingredient,
        location=request.location,
        store_filter=request.store
    )
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Price check failed"))
    
    return result


@router.post("/batch-prices")
async def api_batch_ingredient_prices(
    request: BatchPriceRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Check prices for multiple ingredients at once.
    Returns cheapest option and price stats for each ingredient.
    Max 15 ingredients per request.
    """
    if len(request.ingredients) > 15:
        raise HTTPException(status_code=400, detail="Maximum 15 ingredients per request")
    
    result = await batch_ingredient_prices(
        ingredients=request.ingredients,
        location=request.location
    )
    
    return result


@router.post("/shopping-cart")
async def api_build_shopping_cart(
    request: ShoppingCartRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Build aggregated shopping cart from multiple recipes.
    Combines duplicate ingredients and provides price estimates.
    """
    if len(request.recipes) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 recipes per cart")
    
    result = await build_shopping_cart(
        recipes=request.recipes,
        location=request.location
    )
    
    return result


@router.post("/buy-ingredients")
async def api_buy_ingredients(
    request: BatchPriceRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Quick buy endpoint - searches all ingredients and returns buy links.
    Returns the cheapest option for each ingredient with direct purchase links.
    """
    result = await batch_ingredient_prices(
        ingredients=request.ingredients,
        location=request.location
    )
    
    # Format for quick buy
    buy_links = []
    for ing, data in result.get("ingredients", {}).items():
        if data.get("success") and data.get("cheapest"):
            buy_links.append({
                "ingredient": ing,
                "price": data["cheapest"].get("price", "N/A"),
                "source": data["cheapest"].get("source", ""),
                "link": data["cheapest"].get("link", ""),
                "thumbnail": data["cheapest"].get("thumbnail", "")
            })
    
    return {
        "success": True,
        "buy_links": buy_links,
        "estimated_total": result.get("estimated_total", {}),
        "currency": result.get("currency", "USD")
    }
