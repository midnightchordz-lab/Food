"""
AI recipe image generation using Gemini Nano Banana (gemini-3.1-flash-image-preview).
Generated images are cached on disk and served under /api so they are reachable
through the Kubernetes ingress (only /api/* is routed to the backend).
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel
from pathlib import Path
from datetime import datetime, timezone
from bson import Binary
from PIL import Image
import io
import os
import base64
import hashlib
import logging

import asyncio

from emergentintegrations.llm.chat import LlmChat, UserMessage

from .deps import db, User, get_optional_user, check_and_increment_daily_image_cap

router = APIRouter(prefix="/recipe-image", tags=["AI Recipe Image"])

IMAGE_DIR = Path("/app/backend/generated/recipe-images")
IMAGE_DIR.mkdir(parents=True, exist_ok=True)

MODEL = "gemini-3.1-flash-image-preview"

# Hard cap on the two-attempt generate+validate loop below. Without this, a
# slow/hung Gemini call had no ceiling — the request (and the frontend's 60s
# axios wait, times a retry) could take up to ~2 minutes before failing. Set
# well below that 60s axios timeout so our own graceful fallback below always
# fires first, but generous enough that a normal (if slow) generation still
# completes rather than falling back needlessly.
IMAGE_GEN_TIMEOUT_SECONDS = 30

# WebP quality setting (80 provides good balance of quality and size, matching
# the same setting already used for AI-generated images elsewhere in this app).
WEBP_QUALITY = 80


def _to_webp(png_bytes: bytes) -> bytes:
    """Re-encode Gemini's raw PNG output as WebP (25-34% smaller at equivalent
    quality) before it's written to disk or the persistent cache. Falls back to
    the original PNG bytes on any conversion error (logged loudly since this
    would then be served under a .webp name/content-type — harmless in practice
    since image decoders sniff actual file bytes rather than trust the
    extension, but worth knowing about if it ever shows up in logs)."""
    try:
        img = Image.open(io.BytesIO(png_bytes))
        img = img.convert('RGBA') if img.mode in ('RGBA', 'LA') else img.convert('RGB')
        out = io.BytesIO()
        img.save(out, format='WEBP', quality=WEBP_QUALITY, method=6)
        return out.getvalue()
    except Exception as e:
        logging.error(f"WebP conversion failed for a generated image, serving original PNG bytes under .webp name: {e}")
        return png_bytes


# NOTE: deliberately NOT named "recipe_images" — that collection already exists,
# used by the legacy OpenAI-based image_generation.py/ai_image_service.py path,
# whose clear_recipe_image_cache() does an unfiltered delete_many({}) on it. Using
# a different name avoids that admin action silently wiping this cache too.
IMAGE_CACHE_COLLECTION = "verified_recipe_photos"


async def load_cached_image(key: str) -> bytes | None:
    """Look up a previously generated image in the persistent DB cache. Local
    disk (IMAGE_DIR) is wiped on every backend restart; the DB is not, so once
    a dish's photo has been generated and verified anywhere, it never needs to
    be generated again."""
    try:
        doc = await db[IMAGE_CACHE_COLLECTION].find_one({"_id": key}, {"data": 1})
        return bytes(doc["data"]) if doc else None
    except Exception as e:
        logging.error(f"Failed to read cached image for key {key}: {e}")
        return None


async def save_cached_image(key: str, title: str, cuisine: str, image_bytes: bytes, validated: bool) -> None:
    """Persist a generated image to the DB (in addition to local disk, which
    only serves as a fast same-container cache for the rest of this backend
    instance's lifetime)."""
    try:
        await db[IMAGE_CACHE_COLLECTION].update_one(
            {"_id": key},
            {"$set": {
                "title": title,
                "cuisine": cuisine,
                "data": Binary(image_bytes),
                "validated": validated,
                "created_at": datetime.now(timezone.utc),
            }},
            upsert=True,
        )
    except Exception as e:
        logging.error(f"Failed to persist image to DB for key {key}: {e}")


class GenerateImageRequest(BaseModel):
    title: str
    cuisine: str = ""
    description: str = ""
    ingredients: list[str] = []


# Per-dish visual specs so the model renders the RIGHT dish (biryani != curry, etc.).
# Matched by substring against the lowercased title.
SPECS_DB: dict[str, str] = {
    'biryani': "Layered long-grain rice MUST be visible | Saffron-yellow AND white grains | Whole spices (cardamom, bay leaf) | Fried onions on top | Served in a handi/plate | NOT a curry, NOT plain pulao",
    'pad thai': "Wide flat rice noodles | Scrambled egg mixed through | Crushed peanuts ON TOP | Fresh bean sprouts | Lime wedge on side | Orange-brown tamarind glaze | NOT lo mein, NOT spaghetti",
    'ramen': "Deep ceramic bowl | Steaming savoury broth | Curly wheat noodles | Halved soft-boiled egg | Sliced chashu pork | Nori + scallions | Steam rising | NOT pho",
    'pho': "Large bowl of clear beef broth | Flat rice noodles | Thin beef slices | Fresh basil, lime, bean sprouts on the side | NOT ramen",
    'sushi': "Neat pieces of nigiri/rolls | Glossy rice | Fresh fish slices | Served on a wooden board or slate | Soy dish + pickled ginger + wasabi | NOT a rice bowl",
    'pizza': "Round flatbread with melted cheese | Visible crust/cornicione | Toppings on top | Slightly charred spots | Whole or a pulled slice | NOT flatbread wrap",
    'burger': "Stacked bun, patty, cheese, lettuce, tomato | Sesame bun | Side of fries optional | NOT a sandwich",
    'taco': "Folded soft/hard tortilla | Visible filling (meat/beans), lettuce, cheese, salsa | Lime wedge | NOT a burrito, NOT a wrap",
    'burrito': "Large flour tortilla fully wrapped | Cut in half to show rice, beans, meat filling | NOT open tacos",
    'carbonara': "Spaghetti coated in creamy egg-cheese sauce | Pancetta/guanciale bits | Black pepper | Parmesan | NO green peas, NOT alfredo",
    'butter chicken': "MUST SHOW rich creamy orange-red tomato gravy | tender chicken pieces in the sauce | cream swirl + coriander | naan/rice alongside. MUST NOT be dry, grilled, or a clear broth",
    'curry': "Sauce-based dish in a bowl | Visible gravy coating protein/veg | Garnish of coriander | Rice or naan alongside",
    'green curry': "MUST SHOW creamy GREEN coconut sauce | chicken/tofu pieces | Thai basil + green chili | jasmine rice on side. MUST NOT be red or yellow curry, NOT clear broth",
    'dumpling': "Pleated steamed/pan-fried dumplings | Glossy wrappers | Dipping sauce dish | Served in bamboo steamer or plate",
    'salad': "Fresh crisp leaves and vegetables | Vibrant colours | Light dressing sheen | Served in a bowl or plate | NOT cooked",
    'pancake': "Stack of fluffy round pancakes | Butter pat melting | Maple syrup drizzle | Berries optional | NOT crepes",
    'french toast': "Thick golden-brown battered bread slices | Dusting of icing sugar | Syrup + berries | NOT plain toast",
    'tiramisu': "Layered coffee-soaked ladyfingers + mascarpone | Cocoa dusting on top | Served in a glass or square slice",
    'paella': "Wide shallow pan | Saffron-yellow rice | Mussels, prawns, chicken visible | Lemon wedges | NOT risotto",
    'omelette': "Folded fluffy egg | Melted cheese/filling peeking out | Herbs on top | NOT scrambled",
    'smoothie': "Thick blended drink in a glass | Vibrant fruit colour | Straw | Fruit garnish | NOT juice",
}


def _dish_specs(title: str, cuisine: str) -> str:
    t = title.lower()
    for key, spec in SPECS_DB.items():
        if key in t:
            return spec
    return f"Authentic, immediately-recognizable {cuisine or 'home-style'} presentation of {title}"


def _key(title: str, cuisine: str) -> str:
    return hashlib.md5(f"{title}|{cuisine}".lower().strip().encode()).hexdigest()


@router.post("/ai-generate")
async def generate_recipe_image(req: GenerateImageRequest, request: Request, current_user: User = Depends(get_optional_user)):
    """Generate (or return cached) an AI food photo for a recipe. Returns a relative /api
    url on success, or an absolute stock-photo URL if AI generation is unavailable/times
    out/fails — this endpoint never errors out for image-generation reasons, only for
    real failures (misconfiguration, rate limiting).
    Auth is OPTIONAL for backwards-compatibility: cache hits are always served, and
    paid (cache-miss) generations are capped per-user when logged in, else per-IP."""
    key = _key(req.title, req.cuisine)
    dest = IMAGE_DIR / f"{key}.webp"
    rel_url = f"/api/recipe-image/img/{key}.webp"

    if dest.exists() and dest.stat().st_size > 0:
        return {"url": rel_url, "cached": True}

    cached_bytes = await load_cached_image(key)
    if cached_bytes:
        with open(dest, "wb") as f:
            f.write(cached_bytes)
        return {"url": rel_url, "cached": True}

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        from image_service import get_food_image
        logging.error("Image generation not configured (missing EMERGENT_LLM_KEY); using stock photo")
        return {"url": get_food_image(req.title, req.cuisine), "cached": False, "validated": False}

    # 6.2 cost control: cap uncached (paid) generations. Per-user when authenticated,
    # otherwise per client IP so anonymous callers still can't run up the bill.
    if current_user:
        identity = current_user.id
    else:
        fwd = request.headers.get("x-forwarded-for")
        identity = f"ip:{(fwd.split(',')[0].strip() if fwd else (request.client.host if request.client else 'unknown'))}"
    await check_and_increment_daily_image_cap(identity)

    specs = _dish_specs(req.title, req.cuisine)
    ingredients_str = ", ".join([i for i in req.ingredients[:6] if i]) or "as typical for this dish"

    def build_prompt(extra: str = "") -> str:
        return f"""GENERATE: Professional food photograph of {req.title}
DISH INFO:
- Name: {req.title}
- Cuisine: {req.cuisine or 'International'}
- Ingredients: {ingredients_str}
CRITICAL RULES (MUST FOLLOW):
1. Image MUST show EXACTLY {req.title} - not a similar dish
2. Professional food photography quality
3. 45-degree overhead angle
4. Restaurant-quality plating
5. Sharp focus, appetizing appearance
VISUAL SPECIFICATIONS:
{specs}
QUALITY STANDARDS:
- Lighting: Natural, warm, appropriate for {req.cuisine or 'the dish'}
- Background: Clean, neutral
- Colors: Accurate to how the dish actually looks
- No text, watermarks, or logos
STYLE:
- Authentic {req.cuisine or 'home-style'} presentation
- High-end restaurant plating
- Immediately recognizable as {req.title}
{extra}
VALIDATION (do this after generating): confirm the image clearly shows {req.title} with its main ingredients visible, authentic style, correct plating and colours, and is NOT confused with a similar dish. On the FINAL text line output exactly "VALIDATION: VERIFIED" if it matches, otherwise "VALIDATION: REJECTED - <short reason>"."""

    async def _generate() -> dict:
        """Original two-attempt generate+validate loop, unchanged. Only the call
        site below is new (bounds this with a timeout)."""
        fallback_bytes = None
        extra = ""
        for attempt in range(2):
            chat = LlmChat(
                api_key=api_key,
                session_id=f"img-{key}-{attempt}",
                system_message="You are a professional food photographer and strict image validator. Generate high-quality food images that are immediately recognizable as the named dish, and honestly validate them.",
            )
            chat.with_model("gemini", MODEL).with_params(modalities=["image", "text"])
            text, images = await chat.send_message_multimodal_response(UserMessage(text=build_prompt(extra)))
            if not images:
                continue
            image_bytes = _to_webp(base64.b64decode(images[0]["data"]))
            fallback_bytes = image_bytes  # always keep the latest so the user still gets an image
            verdict = (text or "").upper()
            rejected = "REJECTED" in verdict and "VERIFIED" not in verdict
            if rejected and attempt == 0:
                logging.info(f"Image for '{req.title}' self-rejected ({text[:120]}); regenerating")
                extra = (
                    f"PREVIOUS ATTEMPT WAS REJECTED because: {text[:200]}. "
                    f"Regenerate MORE carefully and strictly follow the VISUAL SPECIFICATIONS for {req.title}."
                )
                continue
            with open(dest, "wb") as f:
                f.write(image_bytes)
            await save_cached_image(key, req.title, req.cuisine, image_bytes, validated=not rejected)
            logging.info(f"Generated recipe image for '{req.title}' -> {rel_url} (validated={not rejected})")
            return {"url": rel_url, "cached": False, "validated": not rejected}

        # Exhausted attempts: still return the best image we produced.
        if fallback_bytes:
            with open(dest, "wb") as f:
                f.write(fallback_bytes)
            await save_cached_image(key, req.title, req.cuisine, fallback_bytes, validated=False)
            logging.info(f"Saved best-effort image for '{req.title}' after validation retries")
            return {"url": rel_url, "cached": False, "validated": False}
        return None  # no usable image from either attempt — caller falls back to a stock photo

    def _stock_fallback() -> dict:
        from image_service import get_food_image
        return {"url": get_food_image(req.title, req.cuisine), "cached": False, "validated": False}

    try:
        result = await asyncio.wait_for(_generate(), timeout=IMAGE_GEN_TIMEOUT_SECONDS)
        return result or _stock_fallback()
    except asyncio.TimeoutError:
        logging.warning(f"Recipe image generation timed out after {IMAGE_GEN_TIMEOUT_SECONDS}s for '{req.title}', using stock photo")
        return _stock_fallback()
    except Exception as e:
        logging.error(f"Recipe image generation failed for '{req.title}': {e}, using stock photo")
        return _stock_fallback()


@router.get("/img/{name}")
async def get_recipe_image(name: str):
    """Serve a cached generated image, rehydrating from the persistent DB cache
    if the local disk cache doesn't have it (e.g. right after a backend restart,
    before anything has re-triggered generation for this dish). Serves both
    .webp (current format) and .png (images generated before WebP conversion
    was added, or already-saved recipes whose stored image_url still points
    at a .png path) so nothing already served/saved breaks."""
    safe = Path(name.replace("..", "").replace("/", "")).name
    path = IMAGE_DIR / safe
    if not path.exists():
        key = Path(safe).stem
        cached_bytes = await load_cached_image(key)
        if not cached_bytes:
            raise HTTPException(status_code=404, detail="Image not found")
        with open(path, "wb") as f:
            f.write(cached_bytes)
    media_type = "image/webp" if safe.endswith(".webp") else "image/png"
    return FileResponse(str(path), media_type=media_type)
