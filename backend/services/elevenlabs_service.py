"""
ElevenLabs Text-to-Speech Service
Converts recipe text to audio in multiple languages
"""
import os
import hashlib
import aiofiles
import aiofiles.os
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Dict, Optional, List
import logging
import httpx

from .recipe_text_prep_service import recipe_text_prep_service

# Get API key from environment
ELEVENLABS_API_KEY = os.environ.get('ELEVENLABS_API_KEY', '')
ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1'

# Audio cache settings
AUDIO_CACHE_DIR = os.environ.get('AUDIO_CACHE_DIR', '/app/uploads/audio-cache')
AUDIO_CACHE_HOURS = int(os.environ.get('AUDIO_CACHE_HOURS', '168'))  # 7 days

# Voice IDs per language - from ElevenLabs voice library
# These are pre-built voices, no cloning needed
VOICE_MAP = {
    'en': os.environ.get('ELEVENLABS_VOICE_EN', '21m00Tcm4TlvDq8ikWAM'),  # Rachel - warm, clear
    'hi': os.environ.get('ELEVENLABS_VOICE_HI', 'pFZP5JQG7iQjIQuC4Bku'),  # Hindi
    'es': os.environ.get('ELEVENLABS_VOICE_ES', 'ErXwobaYiN019PkySvjV'),  # Spanish
    'fr': os.environ.get('ELEVENLABS_VOICE_FR', 'VR6AewLTigWG4xSOukaG'),  # French
    'de': os.environ.get('ELEVENLABS_VOICE_DE', 'AZnzlk1XvdvUeBnXmlld'),  # German
    'it': os.environ.get('ELEVENLABS_VOICE_IT', 'EXAVITQu4vr4xnSDxMaL'),  # Italian
    'ja': os.environ.get('ELEVENLABS_VOICE_JA', 'XB0fDUnXU5powFXDhCwa'),  # Japanese
    'zh': os.environ.get('ELEVENLABS_VOICE_ZH', 'onwK4e9ZLuTAKqWW03F9'),  # Chinese
    'ar': os.environ.get('ELEVENLABS_VOICE_AR', 'pqHfZKP75CvOlQylNhV4'),  # Arabic
    'pt': os.environ.get('ELEVENLABS_VOICE_PT', 'GBv7mTt0atIp3Br8iCZE'),  # Portuguese
    'ko': os.environ.get('ELEVENLABS_VOICE_KO', 'IKne3meq5aSn9XLyUdCD'),  # Korean
    'tr': os.environ.get('ELEVENLABS_VOICE_TR', 'TxGEqnHWrfWFTfGW9XjX'),  # Turkish
    'ru': os.environ.get('ELEVENLABS_VOICE_RU', 'EXAVITQu4vr4xnSDxMaL'),  # Russian
    'id': os.environ.get('ELEVENLABS_VOICE_ID', '21m00Tcm4TlvDq8ikWAM'),  # Indonesian
}

# Models
STANDARD_MODEL = 'eleven_multilingual_v2'  # Best quality
FAST_MODEL = 'eleven_flash_v2_5'           # Best latency (~75ms)

# Supported languages list
SUPPORTED_LANGUAGES = [
    {'code': 'en', 'name': 'English', 'flag': '🇺🇸'},
    {'code': 'hi', 'name': 'Hindi', 'flag': '🇮🇳'},
    {'code': 'es', 'name': 'Spanish', 'flag': '🇪🇸'},
    {'code': 'fr', 'name': 'French', 'flag': '🇫🇷'},
    {'code': 'de', 'name': 'German', 'flag': '🇩🇪'},
    {'code': 'it', 'name': 'Italian', 'flag': '🇮🇹'},
    {'code': 'ja', 'name': 'Japanese', 'flag': '🇯🇵'},
    {'code': 'zh', 'name': 'Chinese', 'flag': '🇨🇳'},
    {'code': 'ar', 'name': 'Arabic', 'flag': '🇸🇦'},
    {'code': 'pt', 'name': 'Portuguese', 'flag': '🇧🇷'},
    {'code': 'ko', 'name': 'Korean', 'flag': '🇰🇷'},
    {'code': 'tr', 'name': 'Turkish', 'flag': '🇹🇷'},
    {'code': 'ru', 'name': 'Russian', 'flag': '🇷🇺'},
    {'code': 'id', 'name': 'Indonesian', 'flag': '🇮🇩'},
]


class ElevenLabsService:
    """ElevenLabs Text-to-Speech Service"""
    
    def __init__(self):
        self.api_key = ELEVENLABS_API_KEY
        self.base_url = ELEVENLABS_BASE_URL
        self.cache_dir = AUDIO_CACHE_DIR
        self.cache_hours = AUDIO_CACHE_HOURS
        self.voice_map = VOICE_MAP
        self.standard_model = STANDARD_MODEL
        self.fast_model = FAST_MODEL
    
    async def generate_recipe_audio(self, recipe: Dict, language: str = 'en', 
                                     mode: str = 'full') -> Dict:
        """
        Generate audio for full recipe narration
        Uses caching to avoid re-generating same content
        
        Returns:
            {
                'audioUrl': str,
                'fromCache': bool,
                'duration': int (seconds),
                'language': str,
                'characterCount': int
            }
        """
        try:
            recipe_id = recipe.get('_id') or recipe.get('id') or recipe.get('recipe_id', 'unknown')
            
            # Check cache first
            cache_key = self._get_cache_key(str(recipe_id), language, mode)
            cached_path = await self._get_from_cache(cache_key)
            
            if cached_path:
                logging.info(f"Cache hit for recipe {recipe.get('name', recipe_id)} in {language}")
                return {
                    'audioUrl': self._path_to_url(cached_path),
                    'fromCache': True,
                    'language': language
                }
            
            logging.info(f"Generating audio for '{recipe.get('name', recipe_id)}' in {language}...")
            
            # Prepare text
            text = recipe_text_prep_service.prepare_recipe_for_speech(recipe, language)
            
            # Call ElevenLabs API
            audio_buffer = await self._call_elevenlabs_api(text, language, self.standard_model)
            
            # Save to cache
            audio_path = await self._save_to_cache(cache_key, audio_buffer)
            
            logging.info(f"Audio generated: {audio_path}")
            
            return {
                'audioUrl': self._path_to_url(audio_path),
                'fromCache': False,
                'duration': self._estimate_duration(text),
                'language': language,
                'characterCount': len(text)
            }
        
        except Exception as e:
            logging.error(f"ElevenLabs audio generation error: {e}")
            raise Exception(f"Failed to generate audio: {str(e)}")
    
    async def generate_step_audio(self, step_text: str, step_number: int, 
                                   total_steps: int, language: str = 'en') -> Dict:
        """
        Generate audio for a single cooking step
        Uses Flash model for low latency in real-time cooking mode
        
        Returns:
            {
                'audioUrl': str,
                'text': str,
                'language': str
            }
        """
        try:
            text = recipe_text_prep_service.prepare_step_for_speech(
                step_number, step_text, total_steps, language
            )
            
            # Use Flash model for real-time steps (75ms latency)
            audio_buffer = await self._call_elevenlabs_api(text, language, self.fast_model)
            
            # Save temporarily
            temp_path = await self._save_temp_audio(audio_buffer)
            
            return {
                'audioUrl': self._path_to_url(temp_path),
                'text': text,
                'language': language
            }
        
        except Exception as e:
            logging.error(f"Step audio generation error: {e}")
            raise Exception(f"Failed to generate step audio: {str(e)}")
    
    async def _call_elevenlabs_api(self, text: str, language: str, model: str) -> bytes:
        """Core ElevenLabs API call"""
        voice_id = self.voice_map.get(language, self.voice_map['en'])
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.base_url}/text-to-speech/{voice_id}",
                headers={
                    'xi-api-key': self.api_key,
                    'Content-Type': 'application/json',
                    'Accept': 'audio/mpeg'
                },
                json={
                    'text': text,
                    'model_id': model,
                    'voice_settings': {
                        'stability': 0.5,          # 0-1: Lower = more expressive
                        'similarity_boost': 0.75,  # 0-1: Higher = closer to original
                        'style': 0,                # 0-1: Style exaggeration
                        'use_speaker_boost': True
                    },
                    'language_code': language,
                    'output_format': 'mp3_44100_128'
                }
            )
            
            if response.status_code != 200:
                error_detail = response.text
                logging.error(f"ElevenLabs API error: {response.status_code} - {error_detail}")
                raise Exception(f"ElevenLabs API error: {response.status_code}")
            
            return response.content
    
    # ─── CACHE MANAGEMENT ──────────────────────────────────
    
    def _get_cache_key(self, recipe_id: str, language: str, mode: str) -> str:
        """Generate cache key for audio file"""
        return f"recipe_{recipe_id}_{language}_{mode}"
    
    async def _get_from_cache(self, cache_key: str) -> Optional[str]:
        """Check if audio exists in cache and is not expired"""
        try:
            file_path = Path(self.cache_dir) / f"{cache_key}.mp3"
            
            if not file_path.exists():
                return None
            
            # Check if expired
            stat = file_path.stat()
            age_hours = (datetime.now().timestamp() - stat.st_mtime) / 3600
            
            if age_hours > self.cache_hours:
                await aiofiles.os.remove(str(file_path))
                return None
            
            return str(file_path)
        
        except Exception:
            return None
    
    async def _save_to_cache(self, cache_key: str, audio_buffer: bytes) -> str:
        """Save audio to cache directory"""
        cache_path = Path(self.cache_dir)
        cache_path.mkdir(parents=True, exist_ok=True)
        
        file_path = cache_path / f"{cache_key}.mp3"
        
        async with aiofiles.open(str(file_path), 'wb') as f:
            await f.write(audio_buffer)
        
        return str(file_path)
    
    async def _save_temp_audio(self, audio_buffer: bytes) -> str:
        """Save temporary audio file (auto-deleted later)"""
        cache_path = Path(self.cache_dir)
        cache_path.mkdir(parents=True, exist_ok=True)
        
        temp_id = hashlib.md5(str(datetime.now().timestamp()).encode()).hexdigest()[:16]
        file_path = cache_path / f"temp_{temp_id}.mp3"
        
        async with aiofiles.open(str(file_path), 'wb') as f:
            await f.write(audio_buffer)
        
        return str(file_path)
    
    def _path_to_url(self, file_path: str) -> str:
        """Convert file path to URL"""
        return file_path.replace('/app/uploads', '/uploads')
    
    def _estimate_duration(self, text: str) -> int:
        """Estimate audio duration in seconds (avg 150 words/minute)"""
        word_count = len(text.split())
        return int((word_count / 150) * 60)
    
    async def clear_recipe_cache(self, recipe_id: str) -> int:
        """Clear all cached audio for a recipe"""
        try:
            cache_path = Path(self.cache_dir)
            if not cache_path.exists():
                return 0
            
            count = 0
            for file_path in cache_path.glob(f"recipe_{recipe_id}_*.mp3"):
                await aiofiles.os.remove(str(file_path))
                count += 1
            
            return count
        except Exception as e:
            logging.error(f"Error clearing cache: {e}")
            return 0
    
    def get_supported_languages(self) -> List[Dict]:
        """Get list of supported languages"""
        return SUPPORTED_LANGUAGES


# Singleton instance
elevenlabs_service = ElevenLabsService()
