"""
Mobile Voice - unguarded TTS for the hands-free Cooking Mode.

Premium gating is handled client-side via RevenueCat (consistent with mobile_import).
Generates an mp3 per text chunk (cached on disk) and returns a URL served by
the existing /api/audio/file/{filename} endpoint.
"""
import os
import hashlib
import logging
import uuid
import asyncio
from pathlib import Path
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from emergentintegrations.llm.openai import OpenAITextToSpeech
from emergentintegrations.llm.chat import LlmChat, UserMessage

from .deps import db, User, get_current_user, check_rate_limit

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


# ============== Multi-language narration (add-on, opt-in) ==============
# Everything below is new and separate from /tts above, which is untouched.
# This only ever runs when a user explicitly picks a non-English language in
# Cook Mode; the default (English, no language picked) behaves exactly as
# before. Cache keys ("mv_ml_" prefix, own DB collection) are namespaced
# separately from /tts's own cache so neither path can ever collide with or
# invalidate the other's cached files.

TRANSLATION_TIMEOUT_SECONDS = 15

# Launch set: the 5 most-spoken languages after English (by total speakers).
SUPPORTED_NARRATION_LANGUAGES = {
    "hindi": "Hindi",
    "mandarin": "Mandarin Chinese",
    "spanish": "Spanish",
    "french": "French",
    "arabic": "Arabic",
}

# Distinct collection name — deliberately not reusing any existing collection
# (this project has had real bugs before from two features sharing one name).
TRANSLATION_CACHE_COLLECTION = "narration_translations"


async def _load_cached_translation(key: str) -> str | None:
    try:
        doc = await db[TRANSLATION_CACHE_COLLECTION].find_one({"_id": key}, {"text": 1})
        return doc["text"] if doc else None
    except Exception as e:
        logger.error(f"Failed to read cached translation for key {key}: {e}")
        return None


async def _save_cached_translation(key: str, original: str, language: str, translated: str) -> None:
    try:
        await db[TRANSLATION_CACHE_COLLECTION].update_one(
            {"_id": key},
            {"$set": {
                "original": original,
                "language": language,
                "text": translated,
                "created_at": datetime.now(timezone.utc),
            }},
            upsert=True,
        )
    except Exception as e:
        logger.error(f"Failed to persist translation for key {key}: {e}")


async def _translate_step(text: str, language_label: str, api_key: str) -> str:
    """Translate one cooking-instruction step. Quantities, units, and temperatures
    must be preserved exactly — a mistranslated number in a recipe is a real hazard,
    not just a quality issue, so the prompt is explicit about never altering them."""
    chat = LlmChat(
        api_key=api_key,
        session_id=f"narration-translate-{uuid.uuid4().hex[:8]}",
        system_message=(
            f"You are a professional culinary translator. Translate the given cooking "
            f"instruction into {language_label}. Preserve all numbers, quantities, units, "
            f"and temperatures EXACTLY as given in the original — never convert or alter "
            f"them. Output ONLY the translated text: no notes, no quotation marks, no "
            f"markdown, nothing else."
        ),
    )
    chat.with_model("openai", "gpt-4o-mini")
    result = await chat.send_message(UserMessage(text=text))
    return result.strip()


class MultilingualTTSRequest(BaseModel):
    text: str
    language: str  # one of SUPPORTED_NARRATION_LANGUAGES' keys
    voice: str = "nova"


@router.get("/languages")
async def get_narration_languages():
    """List the languages Cook Mode's language picker can offer."""
    return {"languages": SUPPORTED_NARRATION_LANGUAGES}


@router.post("/tts-multilingual")
async def tts_multilingual(req: MultilingualTTSRequest, current_user: User = Depends(get_current_user)):
    """Add-on: translate a cooking step, then narrate it in the chosen language.
    Falls back to English narration (never blocks Cook Mode) if translation is
    slow or fails for any reason."""
    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")

    language_key = (req.language or "").strip().lower()
    language_label = SUPPORTED_NARRATION_LANGUAGES.get(language_key)
    if not language_label:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported language. Choose one of: {', '.join(SUPPORTED_NARRATION_LANGUAGES)}",
        )

    # Translation doubles the AI calls per narration step, so this gets its own
    # rate limit — the base /tts endpoint above has none today, but this new
    # path shouldn't inherit that gap.
    await check_rate_limit(f"narration-translate-{current_user.id}", max_requests=60, window_seconds=3600)

    clean = text.replace("**", "").replace("*", "").replace("#", "").replace("`", "")
    clean = " ".join(clean.split())
    if len(clean) > 700:
        clean = clean[:697] + "..."

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="LLM key not configured")

    translation_key = hashlib.md5(f"{clean}|{language_key}".encode()).hexdigest()
    translated = await _load_cached_translation(translation_key)

    if not translated:
        try:
            translated = await asyncio.wait_for(
                _translate_step(clean, language_label, api_key),
                timeout=TRANSLATION_TIMEOUT_SECONDS,
            )
            await _save_cached_translation(translation_key, clean, language_key, translated)
        except asyncio.TimeoutError:
            logger.warning(f"Narration translation timed out for language={language_key}, falling back to English audio")
            translated = None
        except Exception as e:
            logger.error(f"Narration translation failed for language={language_key}: {e}, falling back to English audio")
            translated = None

    # Speak the translation, or fall back to the original English text if the
    # translation didn't come through — narration still plays either way.
    speak_text = translated or clean
    voice = req.voice if req.voice in ALLOWED_VOICES else "nova"
    cache_key = hashlib.md5(f"{speak_text}|{voice}|{language_key}".encode()).hexdigest()[:20]
    filename = f"mv_ml_{cache_key}.mp3"
    file_path = CACHE_DIR / filename

    if not file_path.exists():
        try:
            speech = OpenAITextToSpeech(api_key=api_key)
            audio_bytes = await speech.generate_speech(
                text=speak_text, model="tts-1", voice=voice, speed=1.0, response_format="mp3"
            )
            file_path.write_bytes(audio_bytes)
        except Exception as e:
            logger.error(f"Multilingual TTS generation failed: {e}")
            raise HTTPException(status_code=502, detail="Could not generate audio")

    return {
        "url": f"/api/audio/file/{filename}",
        "translated_text": translated,  # None means it fell back to English audio
        "language": language_key,
        "fallback_to_english": translated is None,
    }
