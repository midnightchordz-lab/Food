"""
Mobile Fridge Scanner - unguarded fridge photo -> ingredients + recipe suggestions.

Premium gating is handled client-side via RevenueCat (consistent with other mobile-*
endpoints). Accepts a base64 image (JSON) instead of multipart for easy RN use.
"""
import os
import uuid
import base64
import io
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from lazy_emergent import LlmChat, UserMessage, ImageContent

from .deps import db, User, get_current_user
from .fridge_scanner import parse_combined_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mobile-fridge", tags=["Mobile Fridge Scanner"])

SYSTEM_MSG = """You are an expert chef and food identifier. Analyze fridge / pantry photos to identify ingredients AND suggest recipes in one response.

Respond ONLY with valid JSON (no markdown):
{
  "ingredients": [{"name": "item", "category": "vegetable/fruit/dairy/meat/seafood/beverage/condiment/grain/snack/other", "quantity": "amount if visible"}],
  "recipes": [{"title": "Recipe Name", "description": "Brief description", "cooking_time": "X mins", "difficulty": "Easy/Medium/Hard", "servings": "2-4", "ingredients_used": ["item1", "item2"], "missing_ingredients": ["optional item"], "instructions": ["Step 1...", "Step 2...", "Step 3..."]}]
}

Be concise. Identify 5-15 ingredients max. Suggest 3 recipes the user can mostly make with what is visible, each with 3-6 instruction steps."""


class FridgeScanRequest(BaseModel):
    image_data: str  # base64 (no data: prefix)


def _compress(image_bytes: bytes) -> bytes:
    if len(image_bytes) <= 1024 * 1024:
        return image_bytes
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(image_bytes))
        ratio = min(1024 / img.width, 1024 / img.height)
        if ratio < 1:
            img = img.resize((int(img.width * ratio), int(img.height * ratio)), Image.LANCZOS)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=75)
        return buf.getvalue()
    except Exception:
        return image_bytes


@router.post("/scan")
async def scan_fridge(req: FridgeScanRequest, current_user: User = Depends(get_current_user)):
    if not req.image_data:
        raise HTTPException(status_code=400, detail="No image provided")

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="AI service not configured")

    # Normalise + compress the incoming base64.
    raw = req.image_data
    if "," in raw and raw.strip().startswith("data:"):
        raw = raw.split(",", 1)[1]
    try:
        image_bytes = base64.b64decode(raw)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image data")
    image_bytes = _compress(image_bytes)
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")

    chat = LlmChat(
        api_key=api_key,
        session_id=f"mobile-fridge-{current_user.id}-{uuid.uuid4().hex[:8]}",
        system_message=SYSTEM_MSG,
    ).with_model("openai", "gpt-4o-mini")

    try:
        response = await chat.send_message(
            UserMessage(
                text="Identify all food ingredients in this photo and suggest 3 recipes I can make. Include cooking instructions.",
                file_contents=[ImageContent(image_base64=image_b64)],
            )
        )
    except Exception as e:
        logger.error(f"[Mobile Fridge] AI error: {e}")
        raise HTTPException(status_code=502, detail="Could not analyse the photo. Try a clearer shot.")

    parsed = parse_combined_response(response)
    ingredients = parsed.get("ingredients", [])
    recipes = parsed.get("recipes", [])

    if not ingredients:
        raise HTTPException(status_code=422, detail="Couldn't spot any ingredients. Try a clearer, well-lit photo.")

    scan_id = str(uuid.uuid4())
    try:
        await db.fridge_scans.insert_one({
            "scan_id": scan_id,
            "user_id": current_user.id,
            "ingredients": ingredients,
            "suggested_recipes": recipes,
            "scanned_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        logger.warning(f"[Mobile Fridge] could not persist scan: {e}")

    return {"scan_id": scan_id, "ingredients": ingredients, "recipes": recipes}
