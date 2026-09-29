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
import os
import base64
import hashlib
import logging
import asyncio
import requests as _requests
from PIL import Image
import io

from starlette.concurrency import run_in_threadpool
from lazy_emergent import LlmChat, UserMessage

from .deps import db, User, get_optional_user, check_and_increment_daily_image_cap

router = APIRouter(prefix="/recipe-image", tags=["AI Recipe Image"])

IMAGE_DIR = Path("/app/backend/generated/recipe-images")
IMAGE_DIR.mkdir(parents=True, exist_ok=True)

MODEL = "gemini-3.1-flash-image-preview"

# Hard cap on image generation before falling back to a stock photo
IMAGE_GEN_TIMEOUT_SECONDS = 15

# WebP quality (25-34% smaller than PNG at equivalent quality)
WEBP_QUALITY = 80


def _to_webp(png_bytes: bytes) -> bytes:
    """Re-encode raw PNG bytes from Gemini as WebP. Falls back to original on error."""
    try:
        img = Image.open(io.BytesIO(png_bytes))
        img = img.convert('RGBA') if img.mode in ('RGBA', 'LA') else img.convert('RGB')
        out = io.BytesIO()
        img.save(out, format='WEBP', quality=WEBP_QUALITY, method=6)
        return out.getvalue()
    except Exception as e:
        logging.error(f"WebP conversion failed, serving original bytes: {e}")
        return png_bytes


# NOT named "recipe_images" — that collection is used by the legacy OpenAI path
# (ai_image_service.py/image_generation.py) whose cache-clear does delete_many({})
# on it. Different name keeps this permanent cache safe from that operation.
IMAGE_CACHE_COLLECTION = "verified_recipe_photos"

# --- Object storage helpers (Fix 4) ---
_STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
_STORAGE_URL = _STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
_EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
_storage_key: str | None = None


def _init_storage() -> str:
    global _storage_key, _EMERGENT_KEY
    if _storage_key:
        return _storage_key
    _EMERGENT_KEY = _EMERGENT_KEY or os.environ.get("EMERGENT_LLM_KEY")
    resp = _requests.post(f"{_STORAGE_URL}/init", json={"emergent_key": _EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def _put_object_sync(path: str, data: bytes) -> None:
    key = _init_storage()
    resp = _requests.put(
        f"{_STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": "image/webp"},
        data=data, timeout=60,
    )
    resp.raise_for_status()


def _get_object_sync(path: str) -> bytes:
    key = _init_storage()
    resp = _requests.get(
        f"{_STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=30,
    )
    resp.raise_for_status()
    return resp.content


def _obj_path(key: str) -> str:
    return f"moodfood/recipe-images/{key}.webp"


async def load_cached_image(key: str) -> bytes | None:
    """Look up a previously generated image. Fetches bytes from object storage
    using the path recorded in MongoDB. Returns None on any miss or error."""
    try:
        doc = await db[IMAGE_CACHE_COLLECTION].find_one({"_id": key}, {"storage_path": 1})
        if not doc or not doc.get("storage_path"):
            return None
        return await run_in_threadpool(_get_object_sync, doc["storage_path"])
    except Exception as e:
        logging.error(f"Failed to load cached image for key {key}: {e}")
        return None


async def save_cached_image(key: str, title: str, cuisine: str, image_bytes: bytes, validated: bool) -> None:
    """Upload image bytes to object storage and record the reference in MongoDB
    so the image survives backend restarts and container replacements."""
    try:
        path = _obj_path(key)
        await run_in_threadpool(_put_object_sync, path, image_bytes)
        await db[IMAGE_CACHE_COLLECTION].update_one(
            {"_id": key},
            {"$set": {
                "title": title,
                "cuisine": cuisine,
                "storage_path": path,
                "validated": validated,
                "created_at": datetime.now(timezone.utc),
            }},
            upsert=True,
        )
    except Exception as e:
        logging.error(f"Failed to persist image to storage for key {key}: {e}")


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
    """Generate (or return cached) an AI food photo for a recipe. Returns a relative /api url.
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

    def build_prompt() -> str:
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
- Immediately recognizable as {req.title}"""

    # Single generation so images arrive fast; detailed specs keep results accurate.
    # Wrapped in a timeout so a slow/hung Gemini call degrades to a stock photo
    # instead of hanging the request.
    async def _generate() -> dict | None:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"img-{key}",
            system_message="You are a professional food photographer. Generate a single high-quality, appetizing image that is immediately recognizable as the named dish.",
        )
        chat.with_model("gemini", MODEL).with_params(modalities=["image", "text"])
        _text, images = await chat.send_message_multimodal_response(UserMessage(text=build_prompt()))
        if not images:
            return None
        image_bytes = _to_webp(base64.b64decode(images[0]["data"]))
        with open(dest, "wb") as f:
            f.write(image_bytes)
        await save_cached_image(key, req.title, req.cuisine, image_bytes, validated=False)
        logging.info(f"Generated recipe image for '{req.title}' -> {rel_url}")
        return {"url": rel_url, "cached": False}

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


@router.post("/ai-generate-validated")
async def generate_recipe_image_validated(req: GenerateImageRequest, request: Request, current_user: User = Depends(get_optional_user)):
    """Generate (or return cached) a SELF-VALIDATED AI food photo, using the exact
    same pipeline as the 10-minute meals flow: an AI image_spec (must_show /
    must_not_show / validation_rule) drives a generate-and-verify image call that
    retries once on rejection. Returns {url, validated, proof}."""
    key = _key(req.title, req.cuisine)
    dest = IMAGE_DIR / f"{key}.webp"
    rel_url = f"/api/recipe-image/img/{key}.webp"

    if dest.exists() and dest.stat().st_size > 0:
        return {"url": rel_url, "validated": True, "proof": "Cached verified image"}

    cached_bytes = await load_cached_image(key)
    if cached_bytes:
        with open(dest, "wb") as f:
            f.write(cached_bytes)
        return {"url": rel_url, "validated": True, "proof": "Cached verified image"}

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        from image_service import get_food_image
        logging.error("Image generation not configured; using stock photo")
        return {"url": get_food_image(req.title, req.cuisine), "validated": False, "proof": "Stock photo (AI not configured)"}

    # Same per-user (or per-IP) daily cap as /ai-generate, charged on cache-miss.
    if current_user:
        identity = current_user.id
    else:
        fwd = request.headers.get("x-forwarded-for")
        identity = f"ip:{(fwd.split(',')[0].strip() if fwd else (request.client.host if request.client else 'unknown'))}"
    await check_and_increment_daily_image_cap(identity)

    # Lazy import to avoid a circular import (quick_recipes imports from gen_image).
    from .quick_recipes import _generate_and_validate_image, _extract_json

    ing = ", ".join([i for i in req.ingredients[:6] if i]) or "typical ingredients"
    spec_prompt = (
        f'For the dish "{req.title}" ({req.cuisine or "International"} cuisine; key ingredients: {ing}), '
        "return ONLY valid JSON describing how to verify a generated food photo is the correct dish:\n"
        '{"must_show":["visual 1","visual 2","visual 3"],"must_not_show":["wrong dish 1","wrong style 2"],'
        '"validation_rule":"how to verify it is the correct dish"}\n'
        "must_show: elements that PROVE it's the right dish. must_not_show: similar dishes / wrong styles to reject.\n"
        "Examples: Butter Chicken must_show ['creamy tomato sauce','chicken chunks'] must_not_show ['grilled meat','steak']; "
        "Biryani must_show ['layered rice','saffron color','fried onions'] must_not_show ['grilled fish','plain curry']."
    )
    image_spec: dict = {}
    try:
        spec_chat = LlmChat(
            api_key=api_key,
            session_id=f"imgspec-{key}",
            system_message="You output only valid JSON.",
        ).with_model("openai", "gpt-4o-mini")
        spec_raw = await spec_chat.send_message(UserMessage(text=spec_prompt))
        parsed = _extract_json(spec_raw)
        if isinstance(parsed, dict):
            image_spec = parsed
    except Exception as e:
        logging.error(f"Image spec generation failed for '{req.title}': {e}")

    try:
        result = await asyncio.wait_for(
            _generate_and_validate_image(req.title, req.cuisine, req.ingredients, image_spec, api_key),
            timeout=IMAGE_GEN_TIMEOUT_SECONDS,
        )
        if result:
            return result
    except asyncio.TimeoutError:
        logging.warning(f"Validated image generation timed out for '{req.title}', using stock photo")
    except Exception as e:
        logging.error(f"Validated image generation failed for '{req.title}': {e}, using stock photo")
    from image_service import get_food_image
    return {"url": get_food_image(req.title, req.cuisine), "validated": False, "proof": "Stock photo (AI generation unavailable)"}


@router.get("/img/{name}")
async def get_recipe_image(name: str):
    """Serve a cached generated image, rehydrating from the persistent DB cache
    if the local disk cache doesn't have it (e.g. right after a backend restart).
    Supports both .webp (current) and legacy .png paths."""
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
