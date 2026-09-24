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
import base64
import asyncio
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from lazy_emergent import LlmChat, UserMessage

from .deps import User, get_current_user, check_and_increment_daily_image_cap
from .exclusions import get_user_excluded_ingredients
from .gen_image import IMAGE_DIR, MODEL, _key as image_key

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
        "3. Write 5-8 DETAILED sequential steps. Each step MUST be a complete, clear sentence a "
        "beginner can follow, with a specific action, the exact time (e.g. 'saute for 2 minutes'), "
        "heat level (e.g. 'over medium-high heat'), quantities where relevant, and a sensory/doneness "
        "cue (e.g. 'until golden and fragrant'). Do NOT compress the whole recipe into 1-2 lines even "
        "for a 10-minute meal — break it into clear ordered actions from prep to plating.\n"
        "4. Use only common pantry items or the provided ones.\n"
        "5. Recipe names MUST be SPECIFIC and DISTINCTIVE (e.g. 'Garlic Butter Cherry Tomato Pasta', "
        "not 'Pasta') so they render good photos.\n\n"
        "Return ONLY valid JSON (no markdown, no commentary) in EXACTLY this shape:\n"
        '{"recipes":[{"name":"Specific Name","prep_minutes":3,"cook_minutes":4,"total_minutes":7,'
        '"cuisine":"Italian","difficulty":"Simple","ingredients":["item with qty"],'
        '"instructions":["Detailed step with time & heat","Detailed step 2","Detailed step 3",'
        '"Detailed step 4","Detailed step 5"],"pro_tip":"one speed hack"}],'
        '"speed_tips":["hack 1","hack 2","hack 3"]}\n'
        f"Provide exactly {req.count} recipes, each with total_minutes <= 10, 3-6 ingredients, "
        "and 5-8 detailed instruction steps."
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


# ============== VALIDATION-FIRST TWO-STEP PARALLEL PIPELINE ==============
# Step 1: generate recipes + per-recipe image_spec (must_show / must_not_show /
# validation_rule) in ONE call. Step 2: generate + self-validate each image IN
# PARALLEL (asyncio.gather), regenerating on a mismatch. Images are saved to disk
# and served by URL (keeps the JSON payload light — no base64 in the response).


class ValidatedQuickRecipe(BaseModel):
    name: str
    timing: str
    total_minutes: int
    cuisine: str
    difficulty: str
    ingredients: list[str]
    instructions: list[str]
    pro_tip: str = ""
    image_url: str | None = None
    image_validated: bool = False
    validation_proof: str | None = None


class ValidatedQuickResponse(BaseModel):
    recipes: list[ValidatedQuickRecipe]
    count: int
    timestamp: datetime
    validation_enabled: bool = True
    all_validated: bool = False


def _build_validation_specs_prompt(req: QuickRecipeRequest, exclusions: list[str]) -> str:
    ingredients_str = ", ".join(req.ingredients) if req.ingredients else "common pantry items"
    exclusion_line = ""
    if exclusions:
        exclusion_line = f"\nNEVER use these ingredients (allergies/exclusions): {', '.join(exclusions)}."
    return (
        f"Generate {req.count} quick recipes (each <= 10 minutes total) in STRICT JSON.\n"
        f"- Dietary: {req.dietary}\n- Cuisine: {req.cuisine}\n- Mood: {req.mood}\n"
        f"- Available ingredients: {ingredients_str}\n- Equipment: {req.equipment}.{exclusion_line}\n\n"
        "Recipe names MUST be SPECIFIC and DISTINCTIVE (e.g. 'Creamy Butter Chicken Curry', not 'Curry').\n"
        "Each recipe's \"instructions\" MUST contain 5-8 DETAILED sequential steps. Every step is a full, "
        "clear sentence with a specific action, exact time, heat level, quantities where relevant, and a "
        "doneness/sensory cue. Do NOT compress the recipe into 1-2 lines.\n"
        "For EACH recipe include an image_spec with validation rules so a generated photo can be verified.\n\n"
        "Return ONLY valid JSON (no markdown) in EXACTLY this shape:\n"
        '{"recipes":[{'
        '"name":"Specific Name","prep_minutes":3,"cook_minutes":4,"total_minutes":7,'
        '"cuisine":"Italian","difficulty":"Simple","ingredients":["item with qty"],'
        '"instructions":["Detailed step with time & heat","Detailed step 2","Detailed step 3",'
        '"Detailed step 4","Detailed step 5"],"pro_tip":"one speed hack",'
        '"image_spec":{"prompt":"Professional food photo of the dish showing its key visuals",'
        '"visual_essence":"how the dish should look","must_show":["visual 1","visual 2","visual 3"],'
        '"must_not_show":["wrong dish 1","wrong style 2"],"validation_rule":"how to verify it is the correct dish"}'
        '}]}\n\n'
        "Image spec rules:\n"
        "- must_show: elements that PROVE it's the right dish.\n"
        "- must_not_show: similar dishes / wrong styles to reject.\n"
        "Examples: Butter Chicken must_show ['creamy tomato sauce','chicken chunks'] must_not_show ['grilled meat','steak']; "
        "Biryani must_show ['layered rice','saffron color','fried onions'] must_not_show ['grilled fish','plain curry']; "
        "Pad Thai must_show ['wide rice noodles','crushed peanuts','scrambled egg'] must_not_show ['thin noodles','soup'].\n"
        f"Provide exactly {req.count} recipes, each total_minutes <= 10 with 3-6 ingredients."
    )


async def _generate_and_validate_image(name: str, cuisine: str, ingredients: list[str],
                                        image_spec: dict, api_key: str, max_attempts: int = 2):
    """Generate + self-validate one dish photo. Returns {url, validated, proof} or None."""
    key = image_key(name, cuisine)
    dest = IMAGE_DIR / f"{key}.png"
    rel_url = f"/api/recipe-image/img/{key}.png"
    if dest.exists() and dest.stat().st_size > 0:
        return {"url": rel_url, "validated": True, "proof": "Cached verified image"}

    must_show = ", ".join([str(x) for x in image_spec.get("must_show", [])]) or "the dish's signature elements"
    must_not = ", ".join([str(x) for x in image_spec.get("must_not_show", [])]) or "any different dish"
    rule = image_spec.get("validation_rule", f"clearly recognizable as {name}")
    ing_str = ", ".join([i for i in ingredients[:6] if i]) or "typical ingredients"

    def prompt(extra: str = "") -> str:
        return (
            f"GENERATE: Professional food photograph of {name} ({cuisine}).\n"
            f"Key ingredients: {ing_str}.\n"
            f"MUST SHOW (all visible): {must_show}.\n"
            f"MUST NOT SHOW: {must_not}.\n"
            "Restaurant-quality plating, 45-degree angle, sharp focus, natural warm light, "
            "clean neutral background, no text/watermarks.\n"
            f"{extra}\n"
            f"VALIDATE after generating against this rule: {rule}. On the FINAL text line output exactly "
            '"VALIDATION: VERIFIED - <what proves it>" if it matches, else "VALIDATION: REJECTED - <reason>".'
        )

    fallback = None
    extra = ""
    for attempt in range(max_attempts):
        try:
            chat = LlmChat(
                api_key=api_key,
                session_id=f"qimg-{key}-{attempt}",
                system_message="You are a professional food photographer and strict image validator.",
            ).with_model("gemini", MODEL).with_params(modalities=["image", "text"])
            text, images = await chat.send_message_multimodal_response(UserMessage(text=prompt(extra)))
        except Exception as e:
            logger.error(f"[Quick validated img] error for {name}: {e}")
            continue
        if not images:
            continue
        img_bytes = base64.b64decode(images[0]["data"])
        fallback = img_bytes
        verdict = (text or "").upper()
        rejected = "REJECTED" in verdict and "VERIFIED" not in verdict
        if rejected and attempt < max_attempts - 1:
            extra = f"PREVIOUS ATTEMPT REJECTED: {str(text)[:200]}. Regenerate strictly matching MUST SHOW for {name}."
            continue
        with open(dest, "wb") as f:
            f.write(img_bytes)
        proof = ""
        if "VERIFIED" in verdict:
            idx = (text or "").upper().find("VERIFIED")
            proof = str(text)[idx:].split("\n")[0].strip()
        return {"url": rel_url, "validated": not rejected, "proof": proof or f"Image shows {name}"}

    if fallback:
        with open(dest, "wb") as f:
            f.write(fallback)
        return {"url": rel_url, "validated": False, "proof": "Best-effort image (validation inconclusive)"}
    return None


@router.post("/generate-validated", response_model=ValidatedQuickResponse)
async def generate_validated_quick_recipes(req: QuickRecipeRequest, current_user: User = Depends(get_current_user)):
    """Two-step parallel pipeline: recipes+specs, then parallel image gen with validation."""
    if req.count < 1 or req.count > 5:
        raise HTTPException(status_code=400, detail="count must be between 1 and 5")

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="AI service not configured")

    exclusions = await get_user_excluded_ingredients(current_user.id)

    # STEP 1 — recipes + image specs (single JSON call).
    chat = LlmChat(
        api_key=api_key,
        session_id=f"qvalidated-{current_user.id}-{uuid.uuid4().hex[:8]}",
        system_message="You are a professional 10-minute-meal chef. Respond with valid JSON only.",
    ).with_model("openai", "gpt-4o-mini")
    try:
        raw = await chat.send_message(UserMessage(text=_build_validation_specs_prompt(req, exclusions)))
    except Exception as e:
        logger.error(f"[Quick validated] step1 error: {e}")
        raise HTTPException(status_code=502, detail="Could not generate recipes, please try again")

    parsed = _extract_json(raw)
    if not parsed or "recipes" not in parsed:
        raise HTTPException(status_code=502, detail="Could not generate valid recipes, please try again")

    raw_recipes = []
    for r in parsed.get("recipes", []):
        name = str(r.get("name", "")).strip()
        ings = [str(x).strip() for x in (r.get("ingredients") or []) if str(x).strip()]
        steps = [str(x).strip() for x in (r.get("instructions") or []) if str(x).strip()]
        if not name or not ings or not steps:
            continue
        try:
            total = int(r.get("total_minutes") or (int(r.get("prep_minutes", 0)) + int(r.get("cook_minutes", 0))))
        except Exception:
            total = 10
        total = min(max(total, 1), 10)
        prep, cook = r.get("prep_minutes"), r.get("cook_minutes")
        timing = (f"Prep: {prep} min | Cook: {cook} min | Total: {total} min"
                  if prep is not None and cook is not None else f"Total: {total} min")
        raw_recipes.append({
            "name": name, "timing": timing, "total": total,
            "cuisine": str(r.get("cuisine", req.cuisine)).strip() or req.cuisine,
            "difficulty": str(r.get("difficulty", "Quick")).strip() or "Quick",
            "ingredients": ings, "instructions": steps,
            "pro_tip": str(r.get("pro_tip", "")).strip(),
            "image_spec": r.get("image_spec") or {},
        })

    if not raw_recipes:
        raise HTTPException(status_code=502, detail="Could not generate valid recipes, please try again")

    # Cost control: count each image against the per-user daily cap up front.
    for _ in raw_recipes:
        await check_and_increment_daily_image_cap(current_user.id)

    # STEP 2 — generate + validate all images IN PARALLEL.
    results = await asyncio.gather(*[
        _generate_and_validate_image(r["name"], r["cuisine"], r["ingredients"], r["image_spec"], api_key)
        for r in raw_recipes
    ])

    out: list[ValidatedQuickRecipe] = []
    for r, img in zip(raw_recipes, results):
        out.append(ValidatedQuickRecipe(
            name=r["name"], timing=r["timing"], total_minutes=r["total"],
            cuisine=r["cuisine"], difficulty=r["difficulty"],
            ingredients=r["ingredients"], instructions=r["instructions"], pro_tip=r["pro_tip"],
            image_url=(img or {}).get("url"),
            image_validated=bool((img or {}).get("validated")),
            validation_proof=(img or {}).get("proof"),
        ))

    return ValidatedQuickResponse(
        recipes=out,
        count=len(out),
        timestamp=datetime.now(timezone.utc),
        all_validated=all(x.image_validated for x in out),
    )
