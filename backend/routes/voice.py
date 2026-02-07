"""
Voice Routes - Transcription and Synthesis with mood awareness
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel
from typing import Optional
from io import BytesIO
import os
import logging

from .deps import User, get_current_user
from .feature_gating import FeatureGate

router = APIRouter(prefix="/voice", tags=["Voice"])

# ============== MODELS ==============

class VoiceTranscriptionResponse(BaseModel):
    text: str
    detected_mood: Optional[str] = None

class VoiceSynthesisRequest(BaseModel):
    text: str
    mood: Optional[str] = None
    language: Optional[str] = 'en'

class VoiceSynthesisResponse(BaseModel):
    audio_base64: str
    mood: str
    voice_description: str

class LanguagesResponse(BaseModel):
    languages: dict

# ============== ROUTES ==============

@router.post("/transcribe", response_model=VoiceTranscriptionResponse)
async def transcribe_voice(
    audio: UploadFile = File(...),
    language: str = 'en',
    current_user: User = Depends(get_current_user)
):
    """
    Transcribe audio to text using Whisper with language support.
    OPTIMIZED for faster response.
    """
    try:
        # Check feature access - Voice features require Premium
        access = await FeatureGate.check_access(current_user.id, "voice_cooking")
        if not access["allowed"]:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "feature_locked",
                    "message": access["reason"],
                    "feature": "voice_cooking",
                    "upgrade_to": access["upgrade_to"],
                    "current_plan": access["current_plan"]
                }
            )
        
        from voice_service import transcribe_audio, detect_mood_from_text
        
        # Read audio file
        audio_content = await audio.read()
        audio_file = BytesIO(audio_content)
        audio_file.name = audio.filename or "audio.webm"
        
        # Transcribe with language hint for faster processing
        text = await transcribe_audio(audio_file, os.environ['EMERGENT_LLM_KEY'], language=language)
        
        # Detect mood from transcribed text
        detected_mood = detect_mood_from_text(text)
        
        return VoiceTranscriptionResponse(
            text=text,
            detected_mood=detected_mood if detected_mood != 'default' else None
        )
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error transcribing audio: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/synthesize", response_model=VoiceSynthesisResponse)
async def synthesize_speech(
    request: VoiceSynthesisRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Convert text to speech with mood-appropriate voice.
    OPTIMIZED: Using tts-1 model for 2x faster response.
    """
    try:
        # Check feature access - Voice features require Premium
        access = await FeatureGate.check_access(current_user.id, "voice_cooking")
        if not access["allowed"]:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "feature_locked",
                    "message": access["reason"],
                    "feature": "voice_cooking",
                    "upgrade_to": access["upgrade_to"],
                    "current_plan": access["current_plan"]
                }
            )
        
        from voice_service import generate_mood_aware_speech, detect_mood_from_text, get_voice_description
        
        # Detect mood if not provided
        mood = request.mood or detect_mood_from_text(request.text)
        
        # Generate speech (optimized with tts-1 and text truncation)
        audio_base64 = await generate_mood_aware_speech(
            text=request.text,
            mood=mood,
            api_key=os.environ['EMERGENT_LLM_KEY'],
            language=request.language or 'en',
            model="tts-1",  # Faster model
            return_base64=True
        )
        
        voice_description = get_voice_description(mood)
        
        return VoiceSynthesisResponse(
            audio_base64=audio_base64,
            mood=mood,
            voice_description=voice_description
        )
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error synthesizing speech: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/languages", response_model=LanguagesResponse)
async def get_supported_languages():
    """
    Get list of supported languages for voice features.
    """
    from voice_service import SUPPORTED_LANGUAGES
    return LanguagesResponse(languages=SUPPORTED_LANGUAGES)


@router.get("/mood-info")
async def get_mood_voice_info(current_user: User = Depends(get_current_user)):
    """
    Get information about available moods and their voice characteristics.
    """
    from voice_service import MOOD_VOICE_CONFIG
    
    mood_info = {
        mood: {
            'voice': config['voice'],
            'description': config['description'],
            'speed': config['speed']
        }
        for mood, config in MOOD_VOICE_CONFIG.items()
    }
    
    return {"moods": mood_info}
