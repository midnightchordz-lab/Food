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
    ImportVideoRequest,
    IMPORT_RECIPE_PROMPT,
    extract_recipe_from_url,
    extract_recipe_from_video,
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


@router.post("/video")
async def mobile_import_from_video(request: ImportVideoRequest, current_user: User = Depends(get_current_user)):
    return await extract_recipe_from_video(request.video_url)


@router.post("/text")
async def mobile_import_from_text(request: ImportTextRequest, current_user: User = Depends(get_current_user)):
    if len(request.recipe_text) < 20:
        raise HTTPException(status_code=400, detail="Please paste a bit more recipe text")
    recipe = await convert_to_standard_recipe(request.recipe_text, "text", "User submitted")
    return {"recipe": recipe, "source": "User submitted text"}


MIXOLOGY_SCHEMA = """{
  "content_type": "cocktails",
  "spirit_name": "Name of the identified spirit/liquor (e.g. \\"White Rum\\")",
  "cocktails": [
    {
      "name": "Cocktail Name",
      "description": "1-2 sentence description of the flavor profile",
      "glassware": "e.g. Rocks glass, Coupe, Highball",
      "method": "Shaken / Stirred / Built in glass",
      "ingredients": ["2 oz White Rum", "0.75 oz Fresh lime juice", "..."],
      "garnish": "e.g. Lime wheel, Mint sprig",
      "instructions": ["Step 1 with technique and timing...", "Step 2...", "..."],
      "abv_estimate": "e.g. ~18%",
      "mocktail_variant": "How to make a non-alcoholic version of this same drink"
    }
  ]
}"""


@router.post("/image")
async def mobile_import_from_image(request: ImportImageRequest, current_user: User = Depends(get_current_user)):
    if not request.image_data:
        raise HTTPException(status_code=400, detail="No image provided")
    llm_api_key = os.environ.get("EMERGENT_LLM_KEY")
    vision_chat = LlmChat(
        api_key=llm_api_key,
        session_id=f"mob-vision-{uuid.uuid4().hex[:8]}",
        system_message=f"""First classify what the image shows, then respond with ONE of two JSON shapes:

CASE A -- a recipe card/text, or a finished dish/meal:
{IMPORT_RECIPE_PROMPT}
Add "content_type": "recipe" to that JSON.

CASE B -- a bottle of liquor/spirit, or a bar/drinks setup:
Identify the primary spirit shown, then generate EXACTLY 3 distinct, real cocktail recipes built around it --
not 3 minor variations of the same drink (e.g. one classic, one fruit-forward/refreshing, one short and strong).
Every cocktail needs exact measurements, real glassware, and a genuine mocktail variant. Output this shape:
{MIXOLOGY_SCHEMA}

Output ONLY ONE valid JSON object matching whichever case applies. No markdown, no commentary.""",
    )
    vision_chat.with_model("openai", "gpt-4o-mini")
    try:
        image_content = ImageContent(image_base64=request.image_data)
        response = await vision_chat.send_message(
            UserMessage(
                text="Analyze this image. If it's food, create a complete recipe. If it's a spirit/bottle, generate 3 cocktails. Output ONLY the JSON object.",
                file_contents=[image_content],
            )
        )
        json_match = response
        if "```json" in response:
            json_match = response.split("```json")[1].split("```")[0]
        elif "```" in response:
            json_match = response.split("```")[1].split("```")[0]
        result = json.loads(json_match.strip())
        result.setdefault("content_type", "recipe")
        result["importMethod"] = "image"
        result["importDate"] = datetime.now(timezone.utc).isoformat()
        # Persist the captured photo and reuse it as the result image
        try:
            from .gen_image import IMAGE_DIR
            import base64 as _b64
            key = f"upload-{uuid.uuid4().hex}"
            with open(IMAGE_DIR / f"{key}.png", "wb") as f:
                f.write(_b64.b64decode(request.image_data))
            result["image_url"] = f"/api/recipe-image/img/{key}.png"
        except Exception as img_err:
            logging.warning(f"[Mobile Image Import] could not store photo: {img_err}")
        return {"recipe": result, "source": "Photo"}
    except json.JSONDecodeError:
        raise HTTPException(status_code=422, detail="Couldn't read that photo. Try a clearer shot.")
    except Exception as e:
        logging.error(f"[Mobile Image Import] {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail="Could not process the photo")
