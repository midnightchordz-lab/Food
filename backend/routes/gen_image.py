"""
AI recipe image generation using Gemini Nano Banana (gemini-3.1-flash-image-preview).
Generated images are cached on disk and served under /api so they are reachable
through the Kubernetes ingress (only /api/* is routed to the backend).
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from pathlib import Path
import os
import base64
import hashlib
import logging

from emergentintegrations.llm.chat import LlmChat, UserMessage

router = APIRouter(prefix="/recipe-image", tags=["AI Recipe Image"])

IMAGE_DIR = Path("/app/backend/generated/recipe-images")
IMAGE_DIR.mkdir(parents=True, exist_ok=True)

MODEL = "gemini-3.1-flash-image-preview"


class GenerateImageRequest(BaseModel):
    title: str
    cuisine: str = ""
    description: str = ""


def _key(title: str, cuisine: str) -> str:
    return hashlib.md5(f"{title}|{cuisine}".lower().strip().encode()).hexdigest()


@router.post("/ai-generate")
async def generate_recipe_image(req: GenerateImageRequest):
    """Generate (or return cached) an AI food photo for a recipe. Returns a relative /api url."""
    key = _key(req.title, req.cuisine)
    dest = IMAGE_DIR / f"{key}.png"
    rel_url = f"/api/recipe-image/img/{key}.png"

    if dest.exists() and dest.stat().st_size > 0:
        return {"url": rel_url, "cached": True}

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Image generation not configured")

    prompt = (
        f"A beautiful, appetizing professional food photograph of \"{req.title}\", "
        f"{req.cuisine + ' cuisine, ' if req.cuisine else ''}"
        f"plated elegantly on a rustic table with warm natural lighting, shallow depth of field, "
        f"overhead editorial food-magazine style. {req.description[:200]}"
    ).strip()

    try:
        chat = LlmChat(api_key=api_key, session_id=f"img-{key}", system_message="You are a professional food photographer.")
        chat.with_model("gemini", MODEL).with_params(modalities=["image", "text"])
        _text, images = await chat.send_message_multimodal_response(UserMessage(text=prompt))
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
