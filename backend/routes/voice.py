"""
Voice Routes - Transcription and Synthesis
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
import os
import logging

from .deps import db, User, get_current_user

router = APIRouter(prefix="/voice", tags=["Voice"])


class VoiceTranscriptionResponse(BaseModel):
    text: str
    detected_mood: Optional[str] = None
    mood_description: Optional[str] = None
    confidence: float = 0.0

class VoiceSynthesisResponse(BaseModel):
    audio_base64: str
    voice_id: str
    voice_description: str

class LanguagesResponse(BaseModel):
    languages: List[dict]


@router.post("/transcribe", response_model=VoiceTranscriptionResponse)
async def transcribe_voice(audio_data: dict, current_user: User = Depends(get_current_user)):
    """Transcribe audio to text using Whisper"""
    try:
        from voice_service import transcribe_audio, detect_mood_from_text
        
        audio_base64 = audio_data.get("audio", "")
        language = audio_data.get("language", "en")
        
        if not audio_base64:
            raise HTTPException(status_code=400, detail="No audio data provided")
        
        text = await transcribe_audio(audio_base64, language)
        
        if not text:
            return VoiceTranscriptionResponse(text="", detected_mood=None, confidence=0.0)
        
        mood_info = detect_mood_from_text(text)
        
        return VoiceTranscriptionResponse(
            text=text,
            detected_mood=mood_info.get("mood"),
            mood_description=mood_info.get("description"),
            confidence=mood_info.get("confidence", 0.8)
        )
    except Exception as e:
        logging.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/synthesize", response_model=VoiceSynthesisResponse)
async def synthesize_speech(data: dict, current_user: User = Depends(get_current_user)):
    """Generate speech from text"""
    try:
        from voice_service import generate_mood_aware_speech, get_voice_description
        
        text = data.get("text", "")
        mood = data.get("mood", "happy")
        language = data.get("language", "en")
        
        if not text:
            raise HTTPException(status_code=400, detail="No text provided")
        
        audio_base64 = await generate_mood_aware_speech(text, mood, language)
        voice_description = get_voice_description(mood)
        
        return VoiceSynthesisResponse(
            audio_base64=audio_base64,
            voice_id=f"mood_{mood}",
            voice_description=voice_description
        )
    except Exception as e:
        logging.error(f"Speech synthesis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/languages", response_model=LanguagesResponse)
async def get_supported_languages():
    """Get list of supported languages"""
    return LanguagesResponse(languages=[
        {"code": "en", "name": "English", "flag": "🇺🇸"},
        {"code": "hi", "name": "Hindi", "flag": "🇮🇳"},
        {"code": "es", "name": "Spanish", "flag": "🇪🇸"},
        {"code": "fr", "name": "French", "flag": "🇫🇷"},
        {"code": "de", "name": "German", "flag": "🇩🇪"},
        {"code": "it", "name": "Italian", "flag": "🇮🇹"},
        {"code": "pt", "name": "Portuguese", "flag": "🇧🇷"},
        {"code": "ja", "name": "Japanese", "flag": "🇯🇵"},
        {"code": "ko", "name": "Korean", "flag": "🇰🇷"},
        {"code": "zh", "name": "Chinese", "flag": "🇨🇳"},
    ])


@router.get("/mood-info")
async def get_mood_voice_info():
    """Get mood-to-voice mapping info"""
    from voice_service import get_voice_description
    
    moods = ["happy", "sad", "energetic", "calm", "stressed", "romantic", "adventurous", "cozy"]
    return {
        "moods": [
            {"id": m, "description": get_voice_description(m)}
            for m in moods
        ]
    }
