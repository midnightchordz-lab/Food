/**
 * Recipe Voice Player Component
 * ElevenLabs TTS with language selector
 * Works on Web, iOS (Capacitor), and Android (Capacitor)
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Volume2, VolumeX, Play, Pause, Loader2, Globe, Lock, Crown, ChevronDown } from 'lucide-react';
import { Button } from './ui/button';
import { useAuth } from '../context/AuthContext';
import { isNative, platform, hapticFeedback } from '../capacitor';
import { isUserPremium } from '../utils/auth';

const API = process.env.REACT_APP_BACKEND_URL;

const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', flag: '🇮🇹' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
  { code: 'pt', name: 'Portuguese', flag: '🇧🇷' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺' },
  { code: 'id', name: 'Indonesian', flag: '🇮🇩' },
];

const RecipeVoicePlayer = ({ recipe, isPremiumUser = false }) => {
  const { user } = useAuth();
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [error, setError] = useState(null);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const audioRef = useRef(null);

  // Determine if user is premium using unified helper
  const isPremium = isPremiumUser || isUserPremium(user);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const generateAudio = async (language) => {
    // Free users: only English, show upgrade for others
    if (!isPremium && language !== 'en') {
      setShowUpgradePrompt(true);
      setError('upgrade_required');
      return;
    }

    setIsLoading(true);
    setError(null);
    setShowUpgradePrompt(false);

    try {
      const token = localStorage.getItem('token');
      const recipeId = recipe._id || recipe.id || recipe.recipe_id;
      
      let response;
      
      // Check if recipe has a valid database ID or if it's a chat-generated recipe
      const hasValidId = recipeId && !recipeId.includes('undefined') && recipeId.length > 10;
      
      if (hasValidId) {
        // Try fetching by ID first (for saved recipes)
        try {
          response = await axios.post(
            `${API}/api/audio/recipe/${recipeId}`,
            { language },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch (idError) {
          // If recipe not found by ID, fall back to generating from data
          if (idError.response?.status === 404) {
            console.log('Recipe not found by ID, generating from data...');
            response = await axios.post(
              `${API}/api/audio/generate`,
              { 
                language,
                recipe: {
                  name: recipe.name || recipe.title,
                  cuisine: recipe.cuisine,
                  totalTime: recipe.totalTime || recipe.cookTime || '30',
                  servings: recipe.servings || '4',
                  ingredients: recipe.ingredients || [],
                  instructions: recipe.instructions || [],
                  tips: recipe.tips || []
                }
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );
          } else {
            throw idError;
          }
        }
      } else {
        // No valid ID, generate from recipe data directly
        response = await axios.post(
          `${API}/api/audio/generate`,
          { 
            language,
            recipe: {
              name: recipe.name || recipe.title,
              cuisine: recipe.cuisine,
              totalTime: recipe.totalTime || recipe.cookTime || '30',
              servings: recipe.servings || '4',
              ingredients: recipe.ingredients || [],
              instructions: recipe.instructions || [],
              tips: recipe.tips || []
            }
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      if (response.data.success) {
        const fullUrl = response.data.audioUrl.startsWith('http') 
          ? response.data.audioUrl 
          : `${API}${response.data.audioUrl}`;
        
        setAudioUrl(fullUrl);
        
        // Auto-play when ready
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.play().catch(e => console.error('Autoplay failed:', e));
            setIsPlaying(true);
          }
        }, 100);
      } else if (response.data.error === 'multilingual_locked') {
        setShowUpgradePrompt(true);
        setError('upgrade_required');
      }
    } catch (err) {
      console.error('Audio generation error:', err);
      const errorMsg = err.response?.data?.detail || err.message || 'Unknown error';
      
      if (err.response?.status === 402 || err.response?.data?.error === 'multilingual_locked') {
        setShowUpgradePrompt(true);
        setError('upgrade_required');
      } else if (errorMsg.includes('ElevenLabs Free Tier') || errorMsg.includes('unusual activity')) {
        setError('elevenlabs_disabled');
      } else {
        setError('generation_failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLanguageSelect = (langCode) => {
    setSelectedLanguage(langCode);
    setShowLanguagePicker(false);
    setAudioUrl(null);
    setProgress(0);
    setCurrentTime(0);
    generateAudio(langCode);
  };

  const handlePlayPause = async () => {
    // Haptic feedback on mobile
    if (isNative) {
      hapticFeedback('light');
    }
    
    if (!audioUrl) {
      generateAudio(selectedLanguage);
      return;
    }

    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        try {
          await audioRef.current.play();
          setIsPlaying(true);
        } catch (e) {
          console.error('Play failed:', e);
          // On iOS, user interaction is required - try regenerating
          if (platform === 'ios') {
            generateAudio(selectedLanguage);
          }
        }
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const prog = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setProgress(isNaN(prog) ? 0 : prog);
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleSeek = (e) => {
    if (audioRef.current && duration > 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = x / rect.width;
      audioRef.current.currentTime = pct * audioRef.current.duration;
    }
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds === 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage);

  return (
    <div className="voice-player bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200" data-testid="voice-player">
      {/* Hidden Audio Element */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
          onEnded={() => setIsPlaying(false)}
          onError={() => setError('playback_failed')}
        />
      )}

      {/* Player Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-amber-600" />
          <span className="font-medium text-stone-700">Voice Cooking Guide</span>
        </div>
        {isPremium && (
          <span className="flex items-center gap-1 text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full">
            <Crown className="w-3 h-3" /> Premium
          </span>
        )}
      </div>

      {/* Language Selector */}
      <div className="relative mb-3">
        <button
          className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-stone-200 hover:border-amber-300 transition-colors w-full justify-between"
          onClick={() => setShowLanguagePicker(!showLanguagePicker)}
          data-testid="language-selector"
        >
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-stone-400" />
            <span>{currentLang?.flag} {currentLang?.name}</span>
          </div>
          <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform ${showLanguagePicker ? 'rotate-180' : ''}`} />
        </button>

        {showLanguagePicker && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg border border-stone-200 shadow-lg z-10 max-h-60 overflow-y-auto">
            {SUPPORTED_LANGUAGES.map(lang => (
              <button
                key={lang.code}
                className={`flex items-center justify-between w-full px-3 py-2 hover:bg-amber-50 transition-colors ${
                  lang.code === selectedLanguage ? 'bg-amber-50 text-amber-700' : ''
                } ${!isPremium && lang.code !== 'en' ? 'opacity-60' : ''}`}
                onClick={() => handleLanguageSelect(lang.code)}
                data-testid={`lang-option-${lang.code}`}
              >
                <span>{lang.flag} {lang.name}</span>
                {!isPremium && lang.code !== 'en' && (
                  <Lock className="w-4 h-4 text-stone-400" />
                )}
              </button>
            ))}
            
            {!isPremium && (
              <div className="px-3 py-2 bg-stone-50 text-xs text-stone-500 border-t">
                <Lock className="w-3 h-3 inline mr-1" />
                Unlock all 14 languages with Premium
              </div>
            )}
          </div>
        )}
      </div>

      {/* Player Controls */}
      <div className="flex items-center gap-3">
        {/* Play/Pause Button */}
        <Button
          variant="default"
          size="icon"
          className={`h-10 w-10 rounded-full ${isLoading ? 'bg-amber-400' : 'bg-amber-500 hover:bg-amber-600'}`}
          onClick={handlePlayPause}
          disabled={isLoading}
          data-testid="play-pause-btn"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin text-white" />
          ) : isPlaying ? (
            <Pause className="w-5 h-5 text-white" />
          ) : (
            <Play className="w-5 h-5 text-white ml-0.5" />
          )}
        </Button>

        {/* Progress Bar */}
        <div 
          className="flex-1 h-2 bg-stone-200 rounded-full cursor-pointer overflow-hidden"
          onClick={handleSeek}
          data-testid="progress-bar"
        >
          <div
            className="h-full bg-amber-500 rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Duration */}
        <span className="text-sm text-stone-500 min-w-[45px] text-right">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      {/* Status Messages */}
      {isLoading && (
        <p className="text-sm text-amber-600 mt-2 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Generating {currentLang?.name} narration...
        </p>
      )}

      {/* Upgrade Prompt */}
      {showUpgradePrompt && (
        <div className="mt-3 p-3 bg-white rounded-lg border border-amber-200" data-testid="upgrade-prompt">
          <div className="flex items-start gap-2">
            <Lock className="w-5 h-5 text-amber-500 mt-0.5" />
            <div>
              <p className="font-medium text-stone-700 text-sm">Multilingual Voice Requires Premium</p>
              <p className="text-xs text-stone-500 mt-1">Get recipes narrated in 14+ languages</p>
              <Button
                variant="default"
                size="sm"
                className="mt-2 bg-amber-500 hover:bg-amber-600"
                onClick={() => window.location.href = '/pricing'}
              >
                Upgrade — $9.99/month
              </Button>
            </div>
          </div>
        </div>
      )}

      {error === 'generation_failed' && (
        <p className="text-sm text-red-500 mt-2">
          Failed to generate audio. Please try again.
        </p>
      )}

      {error === 'elevenlabs_disabled' && (
        <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
          <p className="text-sm text-amber-700">
            Voice feature temporarily unavailable. The ElevenLabs API requires a paid subscription.
          </p>
        </div>
      )}

      {error === 'playback_failed' && (
        <p className="text-sm text-red-500 mt-2">
          Audio playback failed. Please try again.
        </p>
      )}
    </div>
  );
};

export default RecipeVoicePlayer;
