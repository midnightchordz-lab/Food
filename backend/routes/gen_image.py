"""
AI recipe image generation using Gemini Nano Banana (gemini-3.1-flash-image-preview).
Generated images are cached on disk and served under /api so they are reachable
through the Kubernetes ingress (only /api/* is routed to the backend).
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel
from pathlib import Path
import os
import base64
import hashlib
import logging

from lazy_emergent import LlmChat, UserMessage

from .deps import User, get_optional_user, check_and_increment_daily_image_cap

router = APIRouter(prefix="/recipe-image", tags=["AI Recipe Image"])

IMAGE_DIR = Path("/app/backend/generated/recipe-images")
IMAGE_DIR.mkdir(parents=True, exist_ok=True)

MODEL = "gemini-3.1-flash-image-preview"


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
    dest = IMAGE_DIR / f"{key}.png"
    rel_url = f"/api/recipe-image/img/{key}.png"

    if dest.exists() and dest.stat().st_size > 0:
        return {"url": rel_url, "cached": True}

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Image generation not configured")

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

    # Single generation (no self-validation retry) so images arrive ~2x faster.
    # The detailed dish specs above keep the result accurate; results are cached
    # on disk so every subsequent view is instant.
    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"img-{key}",
            system_message="You are a professional food photographer. Generate a single high-quality, appetizing image that is immediately recognizable as the named dish.",
        )
        chat.with_model("gemini", MODEL).with_params(modalities=["image", "text"])
        _text, images = await chat.send_message_multimodal_response(UserMessage(text=build_prompt()))
        if not images:
            raise HTTPException(status_code=502, detail="No image returned")
        image_bytes = base64.b64decode(images[0]["data"])
        with open(dest, "wb") as f:
            f.write(image_bytes)
        logging.info(f"Generated recipe image for '{req.title}' -> {rel_url}")
        return {"url": rel_url, "cached": False}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Recipe image generation failed for '{req.title}': {e}")
        raise HTTPException(status_code=500, detail="Image generation failed")


@router.get("/img/{name}")
async def get_recipe_image(name: str):
    """Serve a cached generated image."""
    safe = name.replace("..", "").replace("/", "")
    path = IMAGE_DIR / safe
    if not path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(str(path), media_type="image/png")
