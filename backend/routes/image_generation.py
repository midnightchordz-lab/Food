"""
Recipe Image Generation API Routes
Provides endpoints for AI-powered recipe image generation with Google Images fallback
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from fastapi.responses import Response
from pydantic import BaseModel
from typing import List, Optional
import asyncio
import os
import httpx
import base64
import hashlib

router = APIRouter()

# Simple in-memory cache for proxied images
_image_proxy_cache = {}


class ImageGenerationRequest(BaseModel):
    recipe_name: str
    cuisine: Optional[str] = ""
    ingredients: Optional[List[str]] = []


class BatchImageRequest(BaseModel):
    recipes: List[ImageGenerationRequest]


class FastImageRequest(BaseModel):
    recipe_name: str
    cuisine: Optional[str] = ""
    use_ai_fallback: Optional[bool] = True


@router.get("/proxy")
async def proxy_image(url: str = Query(..., description="External image URL to proxy")):
    """
    Proxy external images to avoid CORS and referrer policy issues.
    Caches images in memory for performance.
    """
    try:
        # Create cache key from URL
        cache_key = hashlib.md5(url.encode()).hexdigest()
        
        # Check cache
        if cache_key in _image_proxy_cache:
            cached = _image_proxy_cache[cache_key]
            return Response(
                content=cached['content'],
                media_type=cached['content_type'],
                headers={"Cache-Control": "public, max-age=86400"}
            )
        
        # Fetch the image
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            response = await client.get(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
                    "Referer": ""  # Empty referrer to bypass some blocks
                }
            )
            response.raise_for_status()
            
            # Determine content type
            content_type = response.headers.get("content-type", "image/jpeg")
            if ";" in content_type:
                content_type = content_type.split(";")[0].strip()
            
            # Cache the image (limit cache size)
            if len(_image_proxy_cache) > 100:
                # Remove oldest entries
                keys_to_remove = list(_image_proxy_cache.keys())[:20]
                for k in keys_to_remove:
                    del _image_proxy_cache[k]
            
            _image_proxy_cache[cache_key] = {
                'content': response.content,
                'content_type': content_type
            }
            
            return Response(
                content=response.content,
                media_type=content_type,
                headers={"Cache-Control": "public, max-age=86400"}
            )
            
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail="Failed to fetch image")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image proxy error: {str(e)}")


@router.post("/fast")
async def get_fast_recipe_image(request: FastImageRequest):
    """
    Get a recipe image quickly using Google Images search.
    Falls back to AI generation if enabled and no good images found.
    """
    google_result = None
    
    try:
        # First try Google Images (fast)
        from services.serpapi_service import search_food_images
        
        google_result = await search_food_images(
            dish_name=request.recipe_name,
            cuisine=request.cuisine,
            limit=3
        )
        
        if google_result.get("success") and google_result.get("images"):
            # Return direct URLs - frontend will handle errors via onError
            best_image = google_result["images"][0]
            return {
                "image_url": best_image["url"],
                "thumbnail_url": best_image.get("thumbnail", best_image["url"]),
                "source": "google_images",
                "source_website": best_image.get("source", ""),
                "recipe_name": request.recipe_name,
                "alternatives": google_result["images"][1:] if len(google_result["images"]) > 1 else []
            }
    except Exception as e:
        import logging
        logging.warning(f"Google Images search failed for '{request.recipe_name}': {e}")
    
    # Fall back to AI generation if enabled
    if request.use_ai_fallback:
        try:
            from ai_image_service import get_or_generate_recipe_image
            
            ai_result = await get_or_generate_recipe_image(
                recipe_name=request.recipe_name,
                cuisine=request.cuisine
            )
            
            if ai_result and ai_result.get("image_url"):
                return {
                    "image_url": ai_result.get("image_url"),
                    "thumbnail_url": ai_result.get("image_url"),
                    "source": ai_result.get("source", "ai_generated"),
                    "recipe_name": request.recipe_name,
                    "alternatives": []
                }
        except Exception as ai_error:
            import logging
            logging.error(f"AI image generation also failed for '{request.recipe_name}': {ai_error}")
    
    # No image found
    return {
        "image_url": None,
        "source": "none",
        "recipe_name": request.recipe_name,
        "error": "No images found"
    }


class BatchImageItem(BaseModel):
    recipe_name: str
    cuisine: Optional[str] = ""


class BatchImageRequestV2(BaseModel):
    recipes: List[BatchImageItem]


@router.post("/batch")
async def get_batch_recipe_images(request: BatchImageRequestV2):
    """
    Get images for multiple recipes at once, ensuring each recipe gets a UNIQUE image.
    This prevents the issue where similar dishes get the same image.
    """
    import logging
    from services.serpapi_service import search_food_images
    
    results = []
    used_image_urls = set()  # Track used URLs to ensure uniqueness
    
    for item in request.recipes:
        image_url = None
        source = "none"
        
        try:
            # Search for images with more results to have alternatives
            google_result = await search_food_images(
                dish_name=item.recipe_name,
                cuisine=item.cuisine,
                limit=5  # Get more options
            )
            
            if google_result.get("success") and google_result.get("images"):
                # Find the first image that hasn't been used yet
                for img in google_result["images"]:
                    img_url = img.get("url", "")
                    if img_url and img_url not in used_image_urls:
                        image_url = img_url
                        used_image_urls.add(img_url)
                        source = "google_images"
                        break
                
                # If all images were used, just take the first one (fallback)
                if not image_url and google_result["images"]:
                    image_url = google_result["images"][0].get("url")
                    source = "google_images"
                    
        except Exception as e:
            logging.warning(f"Batch image fetch failed for '{item.recipe_name}': {e}")
        
        results.append({
            "recipe_name": item.recipe_name,
            "image_url": image_url,
            "source": source
        })
    
    return {
        "success": True,
        "images": results,
        "total": len(results)
    }
    
    # No image found from either source
    return {
        "image_url": None,
        "source": "none",
        "recipe_name": request.recipe_name,
        "error": "No images found"
    }


@router.get("/fast/{recipe_name}")
async def get_fast_recipe_image_get(
    recipe_name: str,
    cuisine: str = Query("", description="Cuisine type"),
    use_ai_fallback: bool = Query(True, description="Fall back to AI if no Google Images found")
):
    """
    GET endpoint for fast recipe image (Google Images with AI fallback)
    """
    request = FastImageRequest(
        recipe_name=recipe_name,
        cuisine=cuisine,
        use_ai_fallback=use_ai_fallback
    )
    return await get_fast_recipe_image(request)


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
