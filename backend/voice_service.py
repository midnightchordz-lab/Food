from emergentintegrations.llm.openai import OpenAISpeechToText, OpenAITextToSpeech
import os
from typing import Optional
import base64

# Language support for voice
SUPPORTED_LANGUAGES = {
    'english': {'code': 'en', 'name': 'English', 'flag': '🇺🇸'},
    'hindi': {'code': 'hi', 'name': 'Hindi', 'flag': '🇮🇳'},
    'mandarin': {'code': 'zh', 'name': 'Mandarin', 'flag': '🇨🇳'},
    'spanish': {'code': 'es', 'name': 'Spanish', 'flag': '🇪🇸'},
    'french': {'code': 'fr', 'name': 'French', 'flag': '🇫🇷'},
    'japanese': {'code': 'ja', 'name': 'Japanese', 'flag': '🇯🇵'},
    'korean': {'code': 'ko', 'name': 'Korean', 'flag': '🇰🇷'},
    'thai': {'code': 'th', 'name': 'Thai', 'flag': '🇹🇭'},
    'arabic': {'code': 'ar', 'name': 'Arabic', 'flag': '🇸🇦'},
    'italian': {'code': 'it', 'name': 'Italian', 'flag': '🇮🇹'},
    'portuguese': {'code': 'pt', 'name': 'Portuguese', 'flag': '🇧🇷'},
    'vietnamese': {'code': 'vi', 'name': 'Vietnamese', 'flag': '🇻🇳'},
}

# Mood to voice mapping with speed adjustments (OPTIMIZED for faster response)
MOOD_VOICE_CONFIG = {
    'sad': {'voice': 'echo', 'speed': 1.0, 'description': 'Calm and comforting'},  # Increased speed
    'stressed': {'voice': 'coral', 'speed': 1.0, 'description': 'Warm and soothing'},
    'anxious': {'voice': 'sage', 'speed': 1.0, 'description': 'Wise and reassuring'},
    'tired': {'voice': 'nova', 'speed': 1.2, 'description': 'Energetic and uplifting'},  # Faster for energy
    'sluggish': {'voice': 'nova', 'speed': 1.25, 'description': 'Bright and energizing'},
    'overwhelmed': {'voice': 'ash', 'speed': 0.95, 'description': 'Clear and grounding'},
    'excited': {'voice': 'shimmer', 'speed': 1.15, 'description': 'Cheerful and vibrant'},
    'happy': {'voice': 'shimmer', 'speed': 1.1, 'description': 'Joyful and bright'},
    'calm': {'voice': 'echo', 'speed': 1.0, 'description': 'Peaceful and gentle'},
    'creative': {'voice': 'fable', 'speed': 1.05, 'description': 'Expressive and inspiring'},
    'romantic': {'voice': 'coral', 'speed': 0.95, 'description': 'Warm and intimate'},
    'celebratory': {'voice': 'nova', 'speed': 1.15, 'description': 'Upbeat and festive'},
    'default': {'voice': 'alloy', 'speed': 1.1, 'description': 'Balanced and neutral'}
}

def detect_mood_from_text(text: str) -> str:
    """
    Detect mood from user's message using keyword matching.
    Returns the detected mood or 'default'.
    """
    text_lower = text.lower()
    
    # Check for mood keywords
    mood_keywords = {
        'sad': ['sad', 'down', 'depressed', 'melancholy', 'heartbroken', 'grief', 'mourning'],
        'stressed': ['stressed', 'pressure', 'overwhelmed', 'tense', 'worried', 'anxious'],
        'anxious': ['anxious', 'nervous', 'worried', 'uneasy', 'concerned', 'fearful'],
        'tired': ['tired', 'exhausted', 'fatigued', 'drained', 'weary', 'sleepy'],
        'sluggish': ['sluggish', 'lethargic', 'low energy', 'unmotivated', 'lazy'],
        'overwhelmed': ['overwhelmed', 'swamped', 'buried', 'too much', 'can\'t cope'],
        'excited': ['excited', 'thrilled', 'pumped', 'enthusiastic', 'eager'],
        'happy': ['happy', 'joyful', 'delighted', 'cheerful', 'content', 'pleased'],
        'calm': ['calm', 'peaceful', 'relaxed', 'serene', 'tranquil', 'zen'],
        'creative': ['creative', 'inspired', 'artistic', 'imaginative', 'inventive'],
        'romantic': ['romantic', 'love', 'date night', 'special evening', 'intimate'],
        'celebratory': ['celebrating', 'party', 'special occasion', 'birthday', 'anniversary']
    }
    
    for mood, keywords in mood_keywords.items():
        if any(keyword in text_lower for keyword in keywords):
            return mood
    
    return 'default'

async def transcribe_audio(audio_file, api_key: str, language: str = 'en') -> str:
    """
    Transcribe audio file to text using Whisper with language support.
    Optimized for faster response.
    """
    try:
        stt = OpenAISpeechToText(api_key=api_key)
        response = await stt.transcribe(
            file=audio_file,
            model="whisper-1",
            language=language,  # Specify language for faster processing
            response_format="json"
        )
        return response.text
    except Exception as e:
        raise Exception(f"Transcription failed: {str(e)}")

async def generate_mood_aware_speech(
    text: str, 
    mood: str,
    api_key: str,
    language: str = 'en',
    model: str = "tts-1",  # Use tts-1 for faster response (not tts-1-hd)
    return_base64: bool = False
) -> bytes:
    """
    Generate speech with voice and speed adjusted for the detected mood.
    OPTIMIZED for faster response with tts-1 model.
    """
    try:
        # AGGRESSIVE text truncation for faster response (max 300 chars)
        # Remove markdown formatting for cleaner speech
        clean_text = text.replace('**', '').replace('*', '').replace('#', '').replace('`', '')
        clean_text = ' '.join(clean_text.split())  # Normalize whitespace
        
        if len(clean_text) > 300:
            # Smart truncation at sentence boundary
            truncated = clean_text[:300]
            last_period = truncated.rfind('.')
            last_question = truncated.rfind('?')
            last_exclaim = truncated.rfind('!')
            cut_point = max(last_period, last_question, last_exclaim)
            if cut_point > 150:  # Only use sentence boundary if reasonable
                clean_text = truncated[:cut_point + 1]
            else:
                clean_text = truncated[:297] + "..."
        text = clean_text
        
        # Get voice configuration for mood
        voice_config = MOOD_VOICE_CONFIG.get(mood, MOOD_VOICE_CONFIG['default'])
        
        tts = OpenAITextToSpeech(api_key=api_key)
        
        if return_base64:
            audio_base64 = await tts.generate_speech_base64(
                text=text,
                model=model,
                voice=voice_config['voice'],
                speed=voice_config['speed'],
                response_format="mp3"
            )
            return audio_base64
        else:
            audio_bytes = await tts.generate_speech(
                text=text,
                model=model,
                voice=voice_config['voice'],
                speed=voice_config['speed'],
                response_format="mp3"
            )
            return audio_bytes
    except Exception as e:
        raise Exception(f"Speech generation failed: {str(e)}")

def get_voice_description(mood: str) -> str:
    """
    Get the description of the voice used for a particular mood.
    """
    config = MOOD_VOICE_CONFIG.get(mood, MOOD_VOICE_CONFIG['default'])
    return config['description']