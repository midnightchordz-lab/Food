"""
Quick Recipes (<=10 min) generation.

Returns structured recipes (name, timing, ingredients, steps, pro tip). Images are
NOT generated inline (that would make the request very slow); the app shows a fast
CDN photo on the card and generates the accurate AI photo on the recipe detail screen
(reusing /recipe-image/ai-generate), consistent with the rest of the app.
"""
import os
import json
import re
import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from emergentintegrations.llm.chat import LlmChat, UserMessage

from .deps import User, get_current_user
from .exclusions import get_user_excluded_ingredients

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/quick-recipes", tags=["Quick Recipes"])


class QuickRecipeRequest(BaseModel):
    count: int = 3
    dietary: str = "non-vegetarian"
    cuisine: str = "international"
    mood: str = "energizing"
    ingredients: list[str] = []
    equipment: str = "basic"


class QuickRecipe(BaseModel):
    name: str
    timing: str
    total_minutes: int
    cuisine: str
    difficulty: str
    ingredients: list[str]
    instructions: list[str]
    pro_tip: str = ""


class QuickRecipeResponse(BaseModel):
    recipes: list[QuickRecipe]
    speed_tips: list[str]
    count: int
    timestamp: datetime


def _extract_json(text: str):
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except Exception:
        return None


def _build_prompt(req: QuickRecipeRequest, exclusions: list[str]) -> str:
    ingredients_str = ", ".join(req.ingredients) if req.ingredients else "common pantry items"
    exclusion_line = ""
    if exclusions:
        exclusion_line = f"\nNEVER use these ingredients (allergies/exclusions): {', '.join(exclusions)}."
    return (
        "You are a fast-food recipe expert specializing in meals that take 10 minutes or less "
        "from start to finish (prep + cook combined).\n\n"
        f"Generate {req.count} quick recipes for:\n"
        f"- Dietary: {req.dietary}\n- Cuisine: {req.cuisine}\n- Mood: {req.mood}\n"
        f"- Available ingredients: {ingredients_str}\n- Equipment: {req.equipment}.{exclusion_line}\n\n"
        "STRICT RULES:\n"
        "1. EVERY recipe total time MUST be <= 10 minutes. Skip anything longer.\n"
        "2. No marinading/rising/waiting; prioritise no-cook, stir-fry, quick saute, assembly.\n"
        "3. Max 3-4 short steps. Use only common pantry items or the provided ones.\n"
        "4. Recipe names MUST be SPECIFIC and DISTINCTIVE (e.g. 'Garlic Butter Cherry Tomato Pasta', "
        "not 'Pasta') so they render good photos.\n\n"
        "Return ONLY valid JSON (no markdown, no commentary) in EXACTLY this shape:\n"
        '{"recipes":[{"name":"Specific Name","prep_minutes":3,"cook_minutes":4,"total_minutes":7,'
        '"cuisine":"Italian","difficulty":"Simple","ingredients":["item with qty"],'
        '"instructions":["step 1","step 2","step 3"],"pro_tip":"one speed hack"}],'
        '"speed_tips":["hack 1","hack 2","hack 3"]}\n'
        f"Provide exactly {req.count} recipes, each with total_minutes <= 10 and 3-6 ingredients."
    )


@router.post("/generate", response_model=QuickRecipeResponse)
async def generate_quick_recipes(req: QuickRecipeRequest, current_user: User = Depends(get_current_user)):
    if req.count < 1 or req.count > 8:
        raise HTTPException(status_code=400, detail="count must be between 1 and 8")

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="AI service not configured")

    exclusions = await get_user_excluded_ingredients(current_user.id)
    prompt = _build_prompt(req, exclusions)

    chat = LlmChat(
        api_key=api_key,
        session_id=f"quick-{current_user.id}-{uuid.uuid4().hex[:8]}",
        system_message="You are a professional chef for 10-minute meals. Be precise with timing and use distinctive recipe names. Always respond with valid JSON only.",
    ).with_model("openai", "gpt-4o-mini")

    try:
        raw = await chat.send_message(UserMessage(text=prompt))
    except Exception as e:
        logger.error(f"[Quick Recipes] AI error: {e}")
        raise HTTPException(status_code=502, detail="Could not generate recipes, please try again")

    parsed = _extract_json(raw)
    if not parsed or "recipes" not in parsed:
        raise HTTPException(status_code=502, detail="Could not generate valid recipes, please try again")

    recipes: list[QuickRecipe] = []
    for r in parsed.get("recipes", []):
        try:
            total = int(r.get("total_minutes") or (int(r.get("prep_minutes", 0)) + int(r.get("cook_minutes", 0))))
        except Exception:
            total = 10
        if total <= 0 or total > 10:
            total = min(max(total, 1), 10)
        prep = r.get("prep_minutes")
        cook = r.get("cook_minutes")
        timing = (
            f"Prep: {prep} min | Cook: {cook} min | Total: {total} min"
            if prep is not None and cook is not None
            else f"Total: {total} min"
        )
        ings = [str(x).strip() for x in (r.get("ingredients") or []) if str(x).strip()]
        steps = [str(x).strip() for x in (r.get("instructions") or []) if str(x).strip()]
        name = str(r.get("name", "")).strip()
        if not name or not ings or not steps:
            continue
        recipes.append(QuickRecipe(
            name=name,
            timing=timing,
            total_minutes=total,
            cuisine=str(r.get("cuisine", req.cuisine)).strip() or req.cuisine,
            difficulty=str(r.get("difficulty", "Quick")).strip() or "Quick",
            ingredients=ings,
            instructions=steps,
            pro_tip=str(r.get("pro_tip", "")).strip(),
        ))

    if not recipes:
        raise HTTPException(status_code=502, detail="Could not generate valid recipes, please try again")

    speed_tips = [str(t).strip() for t in (parsed.get("speed_tips") or []) if str(t).strip()][:3]

    return QuickRecipeResponse(
        recipes=recipes,
        speed_tips=speed_tips,
        count=len(recipes),
        timestamp=datetime.now(timezone.utc),
    )
