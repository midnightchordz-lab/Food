"""
Recipe Image Generation API Routes
Provides endpoints for AI-powered recipe image generation
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
import asyncio

router = APIRouter()


class ImageGenerationRequest(BaseModel):
    recipe_name: str
    cuisine: Optional[str] = ""
    ingredients: Optional[List[str]] = []


class BatchImageRequest(BaseModel):
    recipes: List[ImageGenerationRequest]


@router.post("/generate")
async def generate_recipe_image_endpoint(request: ImageGenerationRequest):
    """
    Generate an AI-powered image for a specific recipe.
    Returns a data URL with the generated image.
    """
    try:
        from ai_image_service import get_or_generate_recipe_image
        
        result = await get_or_generate_recipe_image(
            recipe_name=request.recipe_name,
            cuisine=request.cuisine,
            ingredients=request.ingredients
        )
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image generation failed: {str(e)}")


@router.post("/generate-batch")
async def generate_batch_images(request: BatchImageRequest):
    """
    Generate images for multiple recipes.
    Useful for pre-generating images when displaying recipe lists.
    """
    try:
        from ai_image_service import batch_generate_images
        
        recipes = [
            {
                "name": r.recipe_name,
                "cuisine": r.cuisine,
                "ingredients": r.ingredients
            }
            for r in request.recipes
        ]
        
        results = await batch_generate_images(recipes)
        
        return {"results": results}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch generation failed: {str(e)}")


@router.get("/cached/{recipe_name}")
async def get_cached_image(recipe_name: str, cuisine: str = ""):
    """
    Get a cached image for a recipe if it exists.
    Returns the cached image or triggers generation.
    """
    try:
        from ai_image_service import get_or_generate_recipe_image
        
        result = await get_or_generate_recipe_image(
            recipe_name=recipe_name,
            cuisine=cuisine
        )
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/cache")
async def clear_image_cache(recipe_name: Optional[str] = None):
    """
    Clear the image cache - all images or for a specific recipe.
    """
    try:
        from ai_image_service import clear_recipe_image_cache
        
        await clear_recipe_image_cache(recipe_name)
        
        return {
            "status": "success",
            "message": f"Cache cleared for {'all recipes' if not recipe_name else recipe_name}"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def image_service_status():
    """
    Check the status of the image generation service.
    """
    import os
    
    has_key = bool(os.environ.get('EMERGENT_LLM_KEY'))
    
    return {
        "service": "ai_image_generation",
        "status": "operational" if has_key else "no_api_key",
        "model": "gpt-image-1",
        "output_format": "webp",
        "optimization": "25-34% smaller than PNG/JPEG",
        "features": [
            "ai_generation",
            "webp_conversion",
            "caching",
            "batch_processing"
        ]
    }
