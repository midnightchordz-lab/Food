"""
Mood Mixers — standalone bottle/spirit photo -> 3 cocktail recipes.

Reuses the same photo-persistence pattern as mobile_import.py's /image handler
(store the captured photo to disk, return it as image_url for redisplay in a
single flowing preview) rather than mobile_fridge.py's chips+list pattern,
since this is a distinct quick-action entry point, not an extension of
Snap a Dish or Scan my Fridge.

Premium gating is handled client-side via RevenueCat, consistent with the
other mobile-* endpoints.
"""
from fastapi import APIRouter, HTTPException, Depends
import os
import json
import uuid
import logging
from datetime import datetime, timezone
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

from .deps import User, get_current_user
from .import_recipe import ImportImageRequest

router = APIRouter(prefix="/mobile-mixology", tags=["Mood Mixers"])

MIXOLOGY_PROMPT = """You are an expert mixologist. The photo shows a bottle of liquor/spirit, or a bar/drinks setup.

Identify the primary spirit shown, then generate EXACTLY 3 distinct, real cocktail recipes built around it —
not 3 minor variations of the same drink (e.g. one classic, one fruit-forward/refreshing, one short and strong).
Every cocktail needs exact measurements, real glassware, and a genuine mocktail variant.

Respond ONLY with valid JSON (no markdown), in this exact shape:
{
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
async def mobile_mixology_from_image(request: ImportImageRequest, current_user: User = Depends(get_current_user)):
    if not request.image_data:
        raise HTTPException(status_code=400, detail="No image provided")
    llm_api_key = os.environ.get("EMERGENT_LLM_KEY")
    vision_chat = LlmChat(
        api_key=llm_api_key,
        session_id=f"mob-mixology-{uuid.uuid4().hex[:8]}",
        system_message=MIXOLOGY_PROMPT,
    )
    vision_chat.with_model("openai", "gpt-4o-mini")
    try:
        image_content = ImageContent(image_base64=request.image_data)
        response = await vision_chat.send_message(
            UserMessage(
                text="Identify the spirit in this photo and generate 3 distinct cocktails for it. Output ONLY the JSON object.",
                file_contents=[image_content],
            )
        )
        json_match = response
        if "```json" in response:
            json_match = response.split("```json")[1].split("```")[0]
        elif "```" in response:
            json_match = response.split("```")[1].split("```")[0]
        result = json.loads(json_match.strip())
        result["importMethod"] = "image"
        result["importDate"] = datetime.now(timezone.utc).isoformat()
        # Persist the captured photo and use it as the result image
        try:
            from .gen_image import IMAGE_DIR
            import base64 as _b64
            key = f"upload-{uuid.uuid4().hex}"
            with open(IMAGE_DIR / f"{key}.png", "wb") as f:
                f.write(_b64.b64decode(request.image_data))
            result["image_url"] = f"/api/recipe-image/img/{key}.png"
        except Exception as img_err:
            logging.warning(f"[Mood Mixers] could not store photo: {img_err}")
        return {"recipe": result, "source": "Photo"}
    except json.JSONDecodeError:
        raise HTTPException(status_code=422, detail="Couldn't spot a bottle in that photo. Try a clearer shot.")
    except Exception as e:
        logging.error(f"[Mood Mixers] {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail="Could not process the photo")
