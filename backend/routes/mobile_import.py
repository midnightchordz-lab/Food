"""
Mobile Recipe Import — unguarded URL/text conversion endpoints.
Premium gating for the mobile app is handled client-side via RevenueCat
(subscription state lives on-device), so these endpoints do not enforce the
legacy server-side FeatureGate. Saving reuses /api/import/save.
"""
from fastapi import APIRouter, HTTPException, Depends
import os
import json
import uuid
import logging
from datetime import datetime, timezone
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

from .deps import User, get_current_user
from .import_recipe import (
    ImportURLRequest,
    ImportTextRequest,
    ImportImageRequest,
    IMPORT_RECIPE_PROMPT,
    extract_recipe_from_url,
    convert_to_standard_recipe,
)

router = APIRouter(prefix="/mobile-import", tags=["Mobile Import"])


@router.post("/url")
async def mobile_import_from_url(request: ImportURLRequest, current_user: User = Depends(get_current_user)):
    if not request.url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Please enter a valid link starting with http")
    content = await extract_recipe_from_url(request.url)
    if not content or len(content) < 100:
        raise HTTPException(status_code=400, detail="Couldn't find a recipe on that page")
    recipe = await convert_to_standard_recipe(content, "url", request.url)
    return {"recipe": recipe, "source": request.url}


@router.post("/text")
async def mobile_import_from_text(request: ImportTextRequest, current_user: User = Depends(get_current_user)):
    if len(request.recipe_text) < 20:
        raise HTTPException(status_code=400, detail="Please paste a bit more recipe text")
    recipe = await convert_to_standard_recipe(request.recipe_text, "text", "User submitted")
    return {"recipe": recipe, "source": "User submitted text"}


@router.post("/image")
async def mobile_import_from_image(request: ImportImageRequest, current_user: User = Depends(get_current_user)):
    if not request.image_data:
        raise HTTPException(status_code=400, detail="No image provided")
    llm_api_key = os.environ.get("EMERGENT_LLM_KEY")
    vision_chat = LlmChat(
        api_key=llm_api_key,
        session_id=f"mob-vision-{uuid.uuid4().hex[:8]}",
        system_message=f"""{IMPORT_RECIPE_PROMPT}

SOURCE CONTEXT: The recipe is being extracted from an image.
1. If the image shows a recipe card/text, extract and convert it.
2. If the image shows a finished dish, identify it and create a professional recipe.
3. ALWAYS output a valid recipe JSON. Output ONLY JSON, no markdown.""",
    )
    vision_chat.with_model("openai", "gpt-4o-mini")
    try:
        image_content = ImageContent(image_base64=request.image_data)
        response = await vision_chat.send_message(
            UserMessage(
                text="Analyze this image and create a complete, detailed recipe. Output ONLY the JSON object.",
                file_contents=[image_content],
            )
        )
        json_match = response
        if "```json" in response:
            json_match = response.split("```json")[1].split("```")[0]
        elif "```" in response:
            json_match = response.split("```")[1].split("```")[0]
        recipe = json.loads(json_match.strip())
        recipe["importMethod"] = "image"
        recipe["importDate"] = datetime.now(timezone.utc).isoformat()
        return {"recipe": recipe, "source": "Photo"}
    except json.JSONDecodeError:
        raise HTTPException(status_code=422, detail="Couldn't read a recipe from that photo. Try a clearer shot.")
    except Exception as e:
        logging.error(f"[Mobile Image Import] {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail="Could not process the photo")
