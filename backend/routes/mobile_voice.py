"""
Mobile Voice - unguarded TTS for the hands-free Cooking Mode.

Premium gating is handled client-side via RevenueCat (consistent with mobile_import).
Generates an mp3 per text chunk (cached on disk) and returns a URL served by
the existing /api/audio/file/{filename} endpoint.
"""
import os
import hashlib
import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from emergentintegrations.llm.openai import OpenAITextToSpeech

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mobile-voice", tags=["Mobile Voice"])

CACHE_DIR = Path("/app/uploads/audio-cache")
CACHE_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_VOICES = {"alloy", "echo", "fable", "onyx", "nova", "shimmer", "coral", "sage", "ash"}


class TTSRequest(BaseModel):
    text: str
    voice: str = "nova"


@router.post("/tts")
async def tts(req: TTSRequest):
    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")

    # Clean markdown artifacts and cap length for snappy narration.
    clean = text.replace("**", "").replace("*", "").replace("#", "").replace("`", "")
    clean = " ".join(clean.split())
    if len(clean) > 700:
        clean = clean[:697] + "..."

    voice = req.voice if req.voice in ALLOWED_VOICES else "nova"
    cache_key = hashlib.md5(f"{clean}|{voice}".encode()).hexdigest()[:20]
    filename = f"mv_{cache_key}.mp3"
    file_path = CACHE_DIR / filename

    if not file_path.exists():
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="LLM key not configured")
        try:
            speech = OpenAITextToSpeech(api_key=api_key)
            audio_bytes = await speech.generate_speech(
                text=clean, model="tts-1", voice=voice, speed=1.0, response_format="mp3"
            )
            file_path.write_bytes(audio_bytes)
        except Exception as e:
            logger.error(f"TTS generation failed: {e}")
            raise HTTPException(status_code=502, detail="Could not generate audio")

    return {"url": f"/api/audio/file/{filename}"}
