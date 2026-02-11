"""
Audio Routes - ElevenLabs TTS endpoints for recipe narration
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
import logging
import os

from .deps import db, User, get_current_user
from services.elevenlabs_service import elevenlabs_service
from services.usage_limit_service import get_user_subscription_tier

router = APIRouter(prefix="/audio", tags=["Audio TTS"])


class RecipeAudioRequest(BaseModel):
    language: str = 'en'


class RecipeDataAudioRequest(BaseModel):
    """Request with recipe data embedded (for chat-generated recipes)"""
    language: str = 'en'
    recipe: Optional[dict] = None


class StepAudioRequest(BaseModel):
    stepText: str
    stepNumber: int
    totalSteps: int
    language: str = 'en'


@router.get("/languages")
async def get_supported_languages():
    """
    GET /api/audio/languages
    Get list of supported languages for TTS
    Public endpoint - no auth required
    """
    return {
        "success": True,
        "languages": elevenlabs_service.get_supported_languages()
    }


@router.post("/recipe/{recipe_id}")
async def generate_recipe_audio(
    recipe_id: str,
    request: RecipeAudioRequest,
    current_user: User = Depends(get_current_user)
):
    """
    POST /api/audio/recipe/:id
    Generate full recipe narration
    Premium feature - free users get English only
    
    Body: { "language": "en" | "hi" | "es" | etc. }
    """
    try:
        language = request.language
        
        # Get user's subscription tier
        tier = await get_user_subscription_tier(current_user.id)
        is_free_tier = tier == 'free'
        
        # Free users: English only, show upgrade for other languages
        if is_free_tier and language != 'en':
            return {
                "success": False,
                "error": "multilingual_locked",
                "message": "Multilingual audio is a Premium feature",
                "upgradePrompt": {
                    "title": "Unlock Multilingual Voice Cooking!",
                    "subtitle": "Get recipes narrated in 14+ languages",
                    "features": [
                        "14+ language narrations",
                        "Real-time step-by-step voice guidance",
                        "Hindi, Spanish, French, Japanese + more",
                        "Works on Web, iOS and Android"
                    ],
                    "ctaText": "Upgrade to Premium",
                    "price": "$9.99/month"
                }
            }
        
        # Get recipe from database
        recipe = await db.recipes.find_one({"id": recipe_id})
        
        if not recipe:
            # Try recipe_library collection
            recipe = await db.recipe_library.find_one({"id": recipe_id})
        
        if not recipe:
            # Try saved_recipes collection
            recipe = await db.saved_recipes.find_one({"id": recipe_id})
        
        if not recipe:
            # Try detailed_recipes
            recipe = await db.detailed_recipes.find_one({"id": recipe_id})
        
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
        
        # Remove MongoDB _id before passing
        recipe.pop('_id', None)
        recipe['id'] = recipe_id
        
        # Generate audio
        result = await elevenlabs_service.generate_recipe_audio(recipe, language)
        
        return {
            "success": True,
            "audioUrl": result['audioUrl'],
            "fromCache": result.get('fromCache', False),
            "language": language,
            "duration": result.get('duration')
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Audio generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate audio: {str(e)}")


@router.post("/step")
async def generate_step_audio(
    request: StepAudioRequest,
    current_user: User = Depends(get_current_user)
):
    """
    POST /api/audio/step
    Generate audio for a single cooking step (real-time cooking mode)
    Uses Flash model for low latency
    
    Body: { "stepText": string, "stepNumber": number, "totalSteps": number, "language": string }
    """
    try:
        if not request.stepText:
            raise HTTPException(status_code=400, detail="stepText is required")
        
        # Check premium for non-English
        tier = await get_user_subscription_tier(current_user.id)
        if tier == 'free' and request.language != 'en':
            raise HTTPException(
                status_code=402, 
                detail="Multilingual step audio is a Premium feature"
            )
        
        result = await elevenlabs_service.generate_step_audio(
            request.stepText,
            request.stepNumber,
            request.totalSteps,
            request.language
        )
        
        return {
            "success": True,
            "audioUrl": result['audioUrl'],
            "text": result['text'],
            "language": request.language
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Step audio error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate step audio: {str(e)}")


@router.delete("/cache/{recipe_id}")
async def clear_recipe_audio_cache(
    recipe_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    DELETE /api/audio/cache/:recipeId
    Clear cached audio for a recipe (when recipe is updated)
    """
    try:
        count = await elevenlabs_service.clear_recipe_cache(recipe_id)
        
        return {
            "success": True,
            "message": f"Cleared {count} cached audio files"
        }
    
    except Exception as e:
        logging.error(f"Cache clear error: {e}")
        raise HTTPException(status_code=500, detail="Failed to clear cache")
