import React, { useRef, useEffect, useCallback, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight, Pause, Play, Mic, MicOff, RotateCcw, Timer } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useLiveCooking } from "@/stores/useLiveCooking";
import { useEmotionalVoiceOrchestrator } from "@/hooks/useEmotionalVoiceOrchestrator";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import axios from "axios";
import { 
  narrateStep, 
  stopSpeech, 
  isSpeechSupported,
  startVoiceControl,
  stopVoiceControl,
  setHandlers as setVoiceHandlers,
  setVisualCallbacks,
  isVoiceListening,
  isSpeaking,
  speakText,
} from "@/lib/browserSpeech";
// Phase-1 Feature Gate
import {
  PHASE_1_MODE,
  ENABLE_CAMERA_PREVIEW,
  ENABLE_GESTURE_DETECTION,
  ENABLE_AI_OBSERVER,
  ENABLE_VOICE_COMMANDS,
  logFeatureStatus,
} from "@/config/handsFreeConfig";

// DORMANT IMPORTS - Code exists but feature-gated
// These modules are NOT deleted, just conditionally disabled
import { useGestureControl } from "@/hooks/useGestureControl";
import { useHandsFreePermissions, PermissionStatus } from "@/hooks/useHandsFreePermissions";
import { useEngineOrchestrator, EngineState } from "@/hooks/useEngineOrchestrator";
import { useAIObserver, ObserverEvents } from "@/hooks/useAIObserver";

const API = process.env.REACT_APP_BACKEND_URL;

// ============================================
// STEP TIMER UTILITIES
// ============================================

/**
 * Parse time string to seconds
 * Handles formats: "5 minutes", "2-3 min", "30 seconds", "1 hour", etc.
 * For ranges like "2-3 min", uses the higher value
 */
function parseTimeToSeconds(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  
  const normalized = timeStr.toLowerCase().trim();
  
  // Match patterns like "5 minutes", "2-3 min", "30 sec", "1 hour"
  const hourMatch = normalized.match(/(\d+)\s*(?:hour|hr|h)/);
  const minMatch = normalized.match(/(\d+)(?:\s*[-–]\s*(\d+))?\s*(?:min|minute|m(?!\w))/);
  const secMatch = normalized.match(/(\d+)\s*(?:sec|second|s(?!\w))/);
  
  let totalSeconds = 0;
  
  if (hourMatch) {
    totalSeconds += parseInt(hourMatch[1], 10) * 3600;
  }
  
  if (minMatch) {
    // For ranges "2-3 min", use the higher value (minMatch[2])
    const minutes = minMatch[2] ? parseInt(minMatch[2], 10) : parseInt(minMatch[1], 10);
    totalSeconds += minutes * 60;
  }
  
  if (secMatch) {
    totalSeconds += parseInt(secMatch[1], 10);
  }
  
  // If nothing matched but there's a number, assume minutes
  if (totalSeconds === 0) {
    const plainNumber = normalized.match(/^(\d+)$/);
    if (plainNumber) {
      totalSeconds = parseInt(plainNumber[1], 10) * 60;
    }
  }
  
  return totalSeconds > 0 ? totalSeconds : null;
}

/**
 * Format seconds to MM:SS display
 */
function formatTime(seconds) {
  if (seconds === null || seconds < 0) return null;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}


/**
 * Mood-based color themes for the futuristic UI
 * Each mood has: glow, tint, accent colors
 */
const MOOD_THEMES = {
  happy: {
    glow: 'rgba(250, 204, 21, 0.4)',
    glowStrong: 'rgba(250, 204, 21, 0.6)',
    tint: 'rgba(250, 204, 21, 0.08)',
    accent: '#facc15',
    ring: 'ring-yellow-400/50',
    text: 'text-yellow-300',
    gradient: 'from-yellow-500/20 via-amber-500/10 to-transparent',
  },
  sad: {
    glow: 'rgba(96, 165, 250, 0.4)',
    glowStrong: 'rgba(96, 165, 250, 0.6)',
    tint: 'rgba(96, 165, 250, 0.08)',
    accent: '#60a5fa',
    ring: 'ring-blue-400/50',
    text: 'text-blue-300',
    gradient: 'from-blue-500/20 via-indigo-500/10 to-transparent',
  },
  angry: {
    glow: 'rgba(248, 113, 113, 0.4)',
    glowStrong: 'rgba(248, 113, 113, 0.6)',
    tint: 'rgba(248, 113, 113, 0.08)',
    accent: '#f87171',
    ring: 'ring-red-400/50',
    text: 'text-red-300',
    gradient: 'from-red-500/20 via-orange-500/10 to-transparent',
  },
  excited: {
    glow: 'rgba(244, 114, 182, 0.4)',
    glowStrong: 'rgba(244, 114, 182, 0.6)',
    tint: 'rgba(244, 114, 182, 0.08)',
    accent: '#f472b6',
    ring: 'ring-pink-400/50',
    text: 'text-pink-300',
    gradient: 'from-pink-500/20 via-fuchsia-500/10 to-transparent',
  },
  calm: {
    glow: 'rgba(45, 212, 191, 0.4)',
    glowStrong: 'rgba(45, 212, 191, 0.6)',
    tint: 'rgba(45, 212, 191, 0.08)',
    accent: '#2dd4bf',
    ring: 'ring-teal-400/50',
    text: 'text-teal-300',
    gradient: 'from-teal-500/20 via-cyan-500/10 to-transparent',
  },
  stressed: {
    glow: 'rgba(251, 146, 60, 0.4)',
    glowStrong: 'rgba(251, 146, 60, 0.6)',
    tint: 'rgba(251, 146, 60, 0.08)',
    accent: '#fb923c',
    ring: 'ring-orange-400/50',
    text: 'text-orange-300',
    gradient: 'from-orange-500/20 via-amber-500/10 to-transparent',
  },
  romantic: {
    glow: 'rgba(251, 113, 133, 0.4)',
    glowStrong: 'rgba(251, 113, 133, 0.6)',
    tint: 'rgba(251, 113, 133, 0.08)',
    accent: '#fb7185',
    ring: 'ring-rose-400/50',
    text: 'text-rose-300',
    gradient: 'from-rose-500/20 via-pink-500/10 to-transparent',
  },
  cozy: {
    glow: 'rgba(251, 191, 36, 0.4)',
    glowStrong: 'rgba(251, 191, 36, 0.6)',
    tint: 'rgba(251, 191, 36, 0.08)',
    accent: '#fbbf24',
    ring: 'ring-amber-400/50',
    text: 'text-amber-300',
    gradient: 'from-amber-500/20 via-yellow-500/10 to-transparent',
  },
};

// VOICE SYNC TIMING CONFIG - moved outside component for stable reference
// These values create "cinematic smooth" transitions
const VOICE_TIMING = {
  WARM_START_DELAY: 180,      // ms pause before speaking (feels intentional)
  POST_NARRATION_WAIT: 1400,  // ms breathing space after narration ends
  STEP_CHANGE_DELAY: 150,     // ms delay after step change before new narration
  FADE_IN_DURATION: 0.3,      // seconds for audio volume fade-in
};

/**
 * LiveCookingModal - Phase-1 Stable Hands-Free Cooking
 * 
 * PHASE-1 FEATURES (ACTIVE):
 * ✓ Voice Narration - Read current step via TTS
 * ✓ Voice Commands - "next", "previous", "repeat", "pause", "resume"
 * ✓ Large On-Screen Controls - Play/Pause, Next, Previous buttons
 * ✓ Tap step card to repeat narration
 * 
 * DORMANT FEATURES (code exists, not executed):
 * ○ Camera Preview
 * ○ Gesture Detection
 * ○ AI Observer
 * ○ Motion Tracking
 * 
 * No NLP, no AI intent parsing, no auto-step detection.
 */
export default function LiveCookingModal() {
  // Log feature status on mount (debug)
  useEffect(() => {
    if (PHASE_1_MODE) {
      logFeatureStatus();
    }
  }, []);

  const { 
    open, 
    closeModal, 
    recipeImage,
    recipeVideo,
    instructions, 
    currentStep, 
    isPlaying,
    nextStep,
    prevStep,
    togglePlay,
    mood: storeMood
  } = useLiveCooking();

  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const hasUserStartedRef = useRef(false);
  
  // ============================================
  // PHASE-1: CAMERA/GESTURE SYSTEMS DORMANT
  // Code exists but behind feature gate
  // ============================================
  
  // Only initialize permission system if camera features are enabled
  const {
    status: permissionStatus,
    isFullyGranted: hasAllPermissions,
    hasCameraAccess,
    hasMicrophoneAccess,
    cameraStream,
    errorMessage: permissionError,
    requestPermissions,
    stopCameraStream,
    reset: resetPermissions,
  } = useHandsFreePermissions();
  
  // Phase-1: Camera and gesture states default to disabled
  const [handsFreeEnabled, setHandsFreeEnabled] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraVideoReady, setCameraVideoReady] = useState(false);
  const [gestureEnabled, setGestureEnabled] = useState(false);
  
  // AI Observer visual states (dormant in Phase-1)
  const [aiState, setAiState] = useState('idle');
  const [whisperText, setWhisperText] = useState('');
  const [showWhisper, setShowWhisper] = useState(false);
  
  // PHASE-1 VOICE RELIABILITY: Visual feedback states
  const [voiceListening, setVoiceListening] = useState(false);
  const [lastCommand, setLastCommand] = useState(null); // For flash feedback
  const [commandFlash, setCommandFlash] = useState(false);
  
  // VOICE TUTORIAL: Show available commands on first enable
  const [showVoiceTutorial, setShowVoiceTutorial] = useState(false);
  const hasSeenTutorialKey = 'moodfood_voice_tutorial_seen';

  // Get mood from store or localStorage fallback
  const mood = storeMood || localStorage.getItem('selectedMood') || 'calm';
  
  // Get mood theme
  const theme = MOOD_THEMES[mood] || MOOD_THEMES.calm;

  // ============================================
  // EMOTIONAL VOICE ORCHESTRATOR
  // Pure text sequencing - no logic changes
  // ============================================
  const {
    playOpeningNarration,
    playStepStartGuidance,
    playEncouragement,
    playCompletionTransition,
    playReassurance,
    playFinalNarration,
    resetOrchestrator,
    abortEmotionalNarration,
  } = useEmotionalVoiceOrchestrator({
    enabled: open && hasUserStartedRef.current,
    mood,
    audioRef,
    currentStep,
    totalSteps: instructions.length,
    isPlaying,
  });

  // Get current step text
  const currentStepText = instructions[currentStep]?.text || 
                          instructions[currentStep]?.instruction || 
                          instructions[currentStep] || 
                          "Preparing your next step...";
  
  const stepProgress = instructions.length > 0 
    ? ((currentStep + 1) / instructions.length) * 100
    : 0;

  // Get step time if available
  const stepTime = instructions[currentStep]?.time || null;
  
  // ============================================
  // STEP COUNTDOWN TIMER
  // ============================================
  const [timerSeconds, setTimerSeconds] = useState(null); // Current countdown value
  const [timerInitialSeconds, setTimerInitialSeconds] = useState(null); // Starting value for progress
  const [timerComplete, setTimerComplete] = useState(false); // Glow animation trigger
  const timerIntervalRef = useRef(null);
  const timerChimeAudioRef = useRef(null);

  // ============================================
  // EXISTING LOGIC - PRESERVED EXACTLY AS IS
  // ============================================

  // Track current narration to prevent overlap
  const currentNarrationRef = useRef(null);
  const narrationAbortRef = useRef(false);
  const postNarrationTimerRef = useRef(null);
  const stepChangeIdRef = useRef(0); // SYNC FIX: Unique ID per step change
  const [useBrowserSpeech, setUseBrowserSpeech] = useState(false); // Fallback mode

  // SYNC FIX: Smooth fade-in instead of abrupt audio start
  const fadeInAudio = useCallback((audio, duration = 0.3) => {
    if (!audio) return;
    audio.volume = 0;
    const startTime = Date.now();
    const fadeInterval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed >= duration) {
        audio.volume = 1;
        clearInterval(fadeInterval);
      } else {
        audio.volume = Math.min(1, elapsed / duration);
      }
    }, 30); // ~33fps for smooth fade
    return fadeInterval;
  }, []);

  // Voice narration for current step - SYNC PERFECTED
  // Single authoritative source: reads ONLY from currentStep at moment of playback
  // With FREE browser speech fallback when ElevenLabs fails
  const readCurrentStep = async () => {
    if (!instructions.length || currentStep >= instructions.length) return;
    
    // SYNC FIX: Capture step ID at start - if it changes, abort
    const thisStepChangeId = ++stepChangeIdRef.current;
    
    // Clear any post-narration timer
    if (postNarrationTimerRef.current) {
      clearTimeout(postNarrationTimerRef.current);
      postNarrationTimerRef.current = null;
    }
    
    // HARD SYNC: Stop any currently playing audio INSTANTLY
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.volume = 1; // Reset volume
    }
    // Also stop browser speech if active
    stopSpeech();
    
    // Mark any pending narration as aborted
    narrationAbortRef.current = true;
    
    // EMOTIONAL TIMING: Warm start delay (makes it feel natural, not robotic)
    await new Promise(resolve => setTimeout(resolve, VOICE_TIMING.WARM_START_DELAY));
    
    // SYNC CHECK: Abort if step changed during warm-up
    if (thisStepChangeId !== stepChangeIdRef.current) {
      console.log('[VoiceSync] Step changed during warm-up, aborting');
      return;
    }
    
    narrationAbortRef.current = false;
    
    // Capture current step at start of this request (authoritative read)
    const stepAtStart = currentStep;
    const stepText = typeof instructions[currentStep] === 'string' 
      ? instructions[currentStep] 
      : instructions[currentStep]?.text || instructions[currentStep]?.instruction;
    
    if (!stepText) return;
    
    // If browser speech mode is active, use FREE browser TTS
    if (useBrowserSpeech) {
      console.log('[VoiceSync] Using FREE browser speech');
      await narrateStep(stepText, currentStep + 1, instructions.length);
      return;
    }
    
    // Try ElevenLabs first
    try {
      const token = localStorage.getItem('token');
      
      const response = await axios.post(
        `${API}/api/audio/step`,
        {
          stepText: stepText,
          stepNumber: currentStep + 1,
          totalSteps: instructions.length,
          language: 'en'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // SYNC CHECK: Only play if step hasn't changed during API call
      if (narrationAbortRef.current || 
          stepAtStart !== currentStep || 
          thisStepChangeId !== stepChangeIdRef.current) {
        console.log('[VoiceSync] Step changed during API load, skipping playback');
        return;
      }

      if (response.data.success && audioRef.current) {
        const fullUrl = response.data.audioUrl.startsWith('http')
          ? response.data.audioUrl
          : `${API}${response.data.audioUrl}`;
        
        audioRef.current.src = fullUrl;
        
        // EMOTIONAL TIMING: Small delay before play (creates cinematic feel)
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Final sync check before playing
        if (narrationAbortRef.current || 
            stepAtStart !== currentStep ||
            thisStepChangeId !== stepChangeIdRef.current) {
          return;
        }
        
        // SMOOTH FADE-IN: Volume ramps up instead of abrupt start
        fadeInAudio(audioRef.current);
        audioRef.current.play().catch(e => console.error('Play failed:', e));
      }
    } catch (error) {
      console.error('ElevenLabs error, falling back to browser speech:', error);
      
      // FALLBACK: Use FREE browser speech when ElevenLabs fails
      if (isSpeechSupported()) {
        console.log('[VoiceSync] Auto-switching to FREE browser speech');
        setUseBrowserSpeech(true);
        
        // Sync check before fallback
        if (stepAtStart === currentStep && thisStepChangeId === stepChangeIdRef.current) {
          await narrateStep(stepText, currentStep + 1, instructions.length);
        }
      }
    }
  };

  // Video playback when modal opens (NO voice auto-play - user must press play)
  useEffect(() => {
    if (!open) return;
    
    if (videoRef.current && recipeVideo) {
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.muted = true;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    }
    // Voice will only start when user explicitly presses play button
  }, [open, recipeVideo]);

  // Read step when step changes (only if user has started)
  // SYNC PERFECTED: Instant audio stop + increment step change ID
  useEffect(() => {
    if (!open) return;
    if (!hasUserStartedRef.current) return;
    
    // SYNC FIX: Increment step change ID immediately
    // This invalidates any in-flight narration requests
    stepChangeIdRef.current++;
    
    // HARD SYNC: Immediately stop any playing audio when step changes
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.volume = 1; // Reset volume for next play
    }
    stopSpeech(); // Also stop browser speech
    
    // Abort any pending narration (both step and emotional)
    narrationAbortRef.current = true;
    abortEmotionalNarration();
    
    // Clear any post-narration timer
    if (postNarrationTimerRef.current) {
      clearTimeout(postNarrationTimerRef.current);
      postNarrationTimerRef.current = null;
    }
    
    // EMOTIONAL TIMING: Delay before new step narration (cinematic smooth feel)
    const timer = setTimeout(() => {
      readCurrentStep();
    }, VOICE_TIMING.STEP_CHANGE_DELAY);
    
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, abortEmotionalNarration]);

  // ============================================
  // STEP COUNTDOWN TIMER LOGIC
  // ============================================
  
  // Initialize/reset timer when step changes or play state changes
  useEffect(() => {
    // Clear any existing timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setTimerComplete(false);
    
    // Only start timer if:
    // 1. Modal is open
    // 2. User has started cooking (isPlaying or hasUserStartedRef)
    // 3. Step has a duration
    if (!open || !isPlaying) {
      setTimerSeconds(null);
      setTimerInitialSeconds(null);
      return;
    }
    
    const stepDuration = instructions[currentStep]?.time;
    const seconds = parseTimeToSeconds(stepDuration);
    
    if (seconds === null) {
      setTimerSeconds(null);
      setTimerInitialSeconds(null);
      return;
    }
    
    // Start the timer
    setTimerSeconds(seconds);
    setTimerInitialSeconds(seconds);
    
    console.log(`[Timer] Started countdown: ${seconds}s for step ${currentStep + 1}`);
    
    timerIntervalRef.current = setInterval(() => {
      setTimerSeconds(prev => {
        if (prev === null || prev <= 0) {
          // Timer reached zero
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [open, isPlaying, currentStep, instructions]);
  
  // Handle timer completion - soft chime and voice cue
  useEffect(() => {
    if (timerSeconds === 0 && timerInitialSeconds !== null) {
      setTimerComplete(true);
      console.log('[Timer] Step timer complete!');
      
      // Soft chime using Web Audio API
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Pleasant chime sound
        oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
        oscillator.type = 'sine';
        
        // Soft envelope
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.8);
        
        // Second chime (higher pitch)
        setTimeout(() => {
          const osc2 = audioContext.createOscillator();
          const gain2 = audioContext.createGain();
          osc2.connect(gain2);
          gain2.connect(audioContext.destination);
          osc2.frequency.setValueAtTime(659.25, audioContext.currentTime); // E5
          osc2.type = 'sine';
          gain2.gain.setValueAtTime(0, audioContext.currentTime);
          gain2.gain.linearRampToValueAtTime(0.25, audioContext.currentTime + 0.05);
          gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.6);
          osc2.start(audioContext.currentTime);
          osc2.stop(audioContext.currentTime + 0.6);
        }, 200);
      } catch (e) {
        console.log('[Timer] Chime not available:', e.message);
      }
      
      // Voice cue "Step complete" (only if not currently speaking)
      if (!isSpeaking() && isSpeechSupported()) {
        setTimeout(() => {
          speakText("Step time complete");
        }, 500);
      }
      
      // Auto-clear glow after 3 seconds
      setTimeout(() => setTimerComplete(false), 3000);
    }
  }, [timerSeconds, timerInitialSeconds]);
  
  // Reset timer on repeat
  const resetStepTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    setTimerComplete(false);
    
    const stepDuration = instructions[currentStep]?.time;
    const seconds = parseTimeToSeconds(stepDuration);
    
    if (seconds !== null && isPlaying) {
      setTimerSeconds(seconds);
      setTimerInitialSeconds(seconds);
      
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev === null || prev <= 0) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, [currentStep, instructions, isPlaying]);

  // Modified play handler - start voice AND enable hands-free on first play
  const handleTogglePlayWithVoice = useCallback(async () => {
    const newIsPlaying = !isPlaying;
    togglePlay();
    
    if (newIsPlaying && !hasUserStartedRef.current) {
      hasUserStartedRef.current = true;
      // Enable hands-free controls when user first presses play
      setHandsFreeEnabled(true);
      
      // EMOTIONAL: Play opening narration when cooking starts
      await playOpeningNarration();
      
      // Then play step guidance and regular step narration
      await playStepStartGuidance();
      readCurrentStep();
    }
    
    if (videoRef.current) {
      if (newIsPlaying) {
        videoRef.current.muted = false;
        videoRef.current.volume = 1;
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
    
    if (audioRef.current && audioRef.current.src) {
      if (newIsPlaying) {
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.pause();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, togglePlay, playOpeningNarration, playStepStartGuidance]);

  // Handle next with voice trigger - SYNC: Only requests step change
  const handleNextWithVoice = useCallback(async () => {
    const isLastStep = currentStep >= instructions.length - 1;
    hasUserStartedRef.current = true;
    
    // SYNC FIX: Increment ID and stop audio BEFORE any async work
    stepChangeIdRef.current++;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    stopSpeech(); // Also stop browser speech
    narrationAbortRef.current = true;
    abortEmotionalNarration();
    
    if (isLastStep) {
      // EMOTIONAL: Play final narration when recipe is completed
      await playFinalNarration();
    } else {
      // EMOTIONAL: Play completion transition before moving to next step
      await playCompletionTransition();
      nextStep(); // This triggers the useEffect which handles narration
    }
  }, [nextStep, currentStep, instructions.length, playCompletionTransition, playFinalNarration, abortEmotionalNarration]);

  // Handle prev with voice trigger - SYNC: Only requests step change
  const handlePrevWithVoice = useCallback(async () => {
    hasUserStartedRef.current = true;
    
    // SYNC FIX: Increment ID and stop audio BEFORE any async work
    stepChangeIdRef.current++;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    stopSpeech(); // Also stop browser speech
    narrationAbortRef.current = true;
    abortEmotionalNarration();
    
    // EMOTIONAL: Play reassurance when going back
    await playReassurance('step_back');
    prevStep(); // This triggers the useEffect which handles narration
  }, [prevStep, playReassurance, abortEmotionalNarration]);

  // Handle repeat - replay current step narration
  const handleRepeat = useCallback(async () => {
    hasUserStartedRef.current = true;
    
    // SYNC FIX: Increment ID and stop audio BEFORE any async work
    stepChangeIdRef.current++;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    stopSpeech(); // Also stop browser speech
    narrationAbortRef.current = true;
    
    // EMOTIONAL: Play reassurance when user requests repeat
    await playReassurance('repeat_requested');
    readCurrentStep();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playReassurance]);

  // ============================================
  // ENGINE ORCHESTRATOR - Phase 1 Synchronization
  // DORMANT when PHASE_1_MODE is true (camera/gesture disabled)
  // Voice command portion remains active
  // ============================================
  const {
    cameraState,
    ttsState,
    recognitionState,
    gestureState,
    isTTSSpeaking,
    isRecognitionActive,
    isGestureReady,
    initializeCamera,
    speakWithOrchestration,
    onTTSComplete,
    stopTTS,
    startRecognition,
    pauseRecognition,
    resumeRecognition,
    stopRecognition,
    setRecognitionCallbacks,
    startGestures,
    stopGestures,
    handleGestureNavigation,
    cleanup: cleanupOrchestrator,
    reset: resetEngineOrchestrator,
  } = useEngineOrchestrator({
    // PHASE-1: Disable camera-dependent features via feature gate
    enabled: open && handsFreeEnabled && !PHASE_1_MODE,
    videoRef: cameraVideoRef,
    cameraStream,
    onSpeakStep: async (text) => {
      // Use browser speech for narration
      stopSpeech();
      await new Promise(resolve => setTimeout(resolve, 150));
      // Simplified narration without mood detection
      await narrateStep(text, currentStep + 1, instructions.length);
    },
    onStopSpeaking: () => {
      stopSpeech();
    },
    onStepChange: (direction) => {
      // This is called by orchestrator after gesture/voice navigation
      console.log('[LiveCooking] Orchestrator step change:', direction);
    },
  });

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      hasUserStartedRef.current = false;
      setAiState('idle');
      setShowWhisper(false);
      setHandsFreeEnabled(false);
      setShowCamera(false);
      setGestureEnabled(false);
      setUseBrowserSpeech(false);
      setVoiceListening(false);
      setCommandFlash(false);
      setLastCommand(null);
      stopSpeech();
      stopVoiceControl(); // PHASE-1: Stop voice recognition
      resetOrchestrator();
      
      // PHASE-1: Only cleanup camera if it was enabled
      if (!PHASE_1_MODE) {
        stopCameraStream();
        resetPermissions();
        resetEngineOrchestrator();
      }
    }
  }, [open, resetOrchestrator, stopCameraStream, resetPermissions, resetEngineOrchestrator]);

  // ============================================
  // HANDS-FREE ENABLE HANDLER
  // PHASE-1: Voice commands only (no camera/gesture permissions)
  // ============================================
  
  // Track voice command active state for gesture priority
  const [voiceCommandActive, setVoiceCommandActive] = useState(false);
  
  const handleEnableHandsFree = useCallback(async () => {
    if (handsFreeEnabled) {
      // Already enabled - disable it
      setHandsFreeEnabled(false);
      stopSpeech();
      
      // PHASE-1: Skip camera/gesture cleanup
      if (!PHASE_1_MODE) {
        setShowCamera(false);
        setGestureEnabled(false);
        stopCameraStream();
        cleanupOrchestrator();
      }
      
      toast.info('Hands-free controls disabled');
      return;
    }
    
    // PHASE-1: No camera/mic permissions needed for basic voice
    if (PHASE_1_MODE) {
      setHandsFreeEnabled(true);
      
      // Show voice tutorial on first enable (check localStorage)
      const hasSeenTutorial = localStorage.getItem(hasSeenTutorialKey);
      if (!hasSeenTutorial) {
        setShowVoiceTutorial(true);
      } else {
        toast.success('Voice controls enabled! Say "next" or "back" to navigate.');
      }
      
      console.log('[LiveCooking] Phase-1 hands-free enabled (voice only)');
      return;
    }
    
    // FULL MODE: Request all permissions (camera + mic + speech)
    console.log('[LiveCooking] Requesting hands-free permissions...');
    const granted = await requestPermissions();
    
    if (granted) {
      setHandsFreeEnabled(true);
      setShowCamera(true);
      toast.success('Hands-free mode enabled! Say "next step" or wave to navigate.');
      console.log('[LiveCooking] Full hands-free mode enabled');
    } else {
      toast.error(permissionError || 'Could not enable hands-free mode. Please allow camera and microphone access.');
      console.log('[LiveCooking] Permissions denied, hands-free not enabled');
    }
  }, [handsFreeEnabled, requestPermissions, stopCameraStream, permissionError, cleanupOrchestrator]);
  
  // ============================================
  // PHASE-1: Voice Command Setup & Cleanup
  // Separate from engine orchestrator (which is disabled in Phase-1)
  // ============================================
  useEffect(() => {
    if (!PHASE_1_MODE) return; // Full mode uses engine orchestrator
    
    // Set up voice handlers
    setVoiceHandlers({
      onNext: handleNextWithVoice,
      onPrev: handlePrevWithVoice,
      onTogglePlay: handleTogglePlayWithVoice,
      onRepeat: handleRepeat,
    });
    
    // Set up visual callbacks for UI feedback
    setVisualCallbacks({
      onListeningStart: () => {
        setVoiceListening(true);
        console.log('[LiveCooking] Voice listening started');
      },
      onListeningStop: () => {
        setVoiceListening(false);
        console.log('[LiveCooking] Voice listening stopped');
      },
      onCommandReceived: (command) => {
        setLastCommand(command);
        setCommandFlash(true);
        console.log('[LiveCooking] Command received:', command);
        // Auto-clear flash after 500ms
        setTimeout(() => setCommandFlash(false), 500);
      },
    });
  }, [handleNextWithVoice, handlePrevWithVoice, handleTogglePlayWithVoice, handleRepeat]);
  
  // Start/stop voice recognition based on handsFreeEnabled (Phase-1 only)
  useEffect(() => {
    if (!PHASE_1_MODE) return; // Full mode uses engine orchestrator
    
    if (open && handsFreeEnabled) {
      // MUTUAL EXCLUSION: Stop TTS before starting recognition
      stopSpeech();
      
      // Start voice recognition
      const started = startVoiceControl();
      if (started) {
        console.log('[LiveCooking] Phase-1 voice recognition started');
      }
    } else {
      // Stop voice recognition when disabled or modal closes
      stopVoiceControl();
    }
    
    return () => {
      if (!open) {
        stopVoiceControl();
      }
    };
  }, [open, handsFreeEnabled]);
  
  // Setup recognition callbacks when they change
  useEffect(() => {
    // PHASE-1: Skip if using feature gate
    if (PHASE_1_MODE) return;
    
    setRecognitionCallbacks({
      onNext: handleNextWithVoice,
      onPrev: handlePrevWithVoice,
      onTogglePlay: handleTogglePlayWithVoice,
      onRepeat: handleRepeat,
    });
  }, [setRecognitionCallbacks, handleNextWithVoice, handlePrevWithVoice, handleTogglePlayWithVoice, handleRepeat]);
  
  // Initialize camera and start recognition when hands-free is enabled
  // PHASE-1: This entire block is skipped via feature gate
  useEffect(() => {
    // PHASE-1: Skip camera/gesture initialization
    if (PHASE_1_MODE) return;
    
    if (open && handsFreeEnabled && hasCameraAccess && cameraStream) {
      // Initialize camera first (for gestures)
      initializeCamera().then(cameraReady => {
        if (cameraReady) {
          console.log('[LiveCooking] Camera ready, starting gestures...');
          startGestures();
        }
      });
      
      // Start voice recognition
      if (hasMicrophoneAccess) {
        startRecognition();
      }
    }
    
    return () => {
      if (!open || !handsFreeEnabled) {
        cleanupOrchestrator();
      }
    };
  }, [open, handsFreeEnabled, hasCameraAccess, hasMicrophoneAccess, cameraStream, initializeCamera, startGestures, startRecognition, cleanupOrchestrator]);

  // Gesture control state
  // PHASE-1: Gesture detection is DORMANT

  // Gesture controls (swipe left/right) - DORMANT in PHASE-1
  // Code exists but behind feature gate
  useGestureControl({
    // PHASE-1: Feature gate disables gesture detection
    enabled: !PHASE_1_MODE && open && gestureEnabled && showCamera && cameraVideoReady && hasCameraAccess && isGestureReady,
    videoRef: cameraVideoRef,
    onNext: async () => {
      setVoiceCommandActive(true);
      await handleGestureNavigation('next');
      handleNextWithVoice();
      setTimeout(() => setVoiceCommandActive(false), 100);
    },
    onPrev: async () => {
      setVoiceCommandActive(true);
      await handleGestureNavigation('previous');
      handlePrevWithVoice();
      setTimeout(() => setVoiceCommandActive(false), 100);
    },
    voiceCommandActive, // Voice takes priority over gestures
  });

  // Attach camera stream from permission hook to video element
  // PHASE-1: Skipped via feature gate
  useEffect(() => {
    // PHASE-1: Skip camera stream attachment
    if (PHASE_1_MODE) return;
    
    const videoEl = cameraVideoRef.current;
    if (videoEl && cameraStream && hasCameraAccess) {
      videoEl.srcObject = cameraStream;
      setCameraVideoReady(true);
      console.log('[LiveCooking] Camera stream attached to video element');
    } else {
      setCameraVideoReady(false);
    }
    return () => {
      if (videoEl) {
        videoEl.srcObject = null;
      }
      setCameraVideoReady(false);
    };
  }, [cameraStream, hasCameraAccess]);

  // AI Observer - DORMANT in PHASE-1
  // Visual state updates only (no logic changes)
  // Code exists but behind feature gate
  const handleAIEvent = useCallback((event) => {
    // PHASE-1: Skip AI event handling
    if (PHASE_1_MODE) return;
    
    if (event.type === ObserverEvents.MOTION_DETECTED) {
      setAiState('active');
    } else if (event.type === ObserverEvents.MOTION_STOPPED) {
      setAiState('idle');
    } else if (event.type === ObserverEvents.POSSIBLE_STEP_COMPLETION) {
      setAiState('completion');
      setWhisperText("Looks ready... say NEXT when you're done");
      setShowWhisper(true);
      // Auto-hide whisper after 5 seconds
      setTimeout(() => setShowWhisper(false), 5000);
    }
  }, []);

  useAIObserver({
    // PHASE-1: Feature gate disables AI observer
    enabled: !PHASE_1_MODE && open && hasCameraAccess && showCamera && cameraVideoReady,
    videoElement: cameraVideoReady ? cameraVideoRef.current : null,
    onEvent: handleAIEvent,
  });

  // Toggle camera visibility - DORMANT in PHASE-1
  const toggleCamera = useCallback(() => {
    // PHASE-1: Camera toggle disabled
    if (PHASE_1_MODE) {
      toast.info('Camera preview coming in future update');
      return;
    }
    
    if (hasCameraAccess) {
      setShowCamera(prev => !prev);
    }
  }, [hasCameraAccess]);

  // Sync video/audio with play state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleVideoPause = () => {
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      }
      if (isPlaying) {
        togglePlay();
      }
    };

    const handleVideoPlay = () => {
      if (audioRef.current && audioRef.current.paused && audioRef.current.src) {
        audioRef.current.play().catch(() => {});
      }
      if (!isPlaying) {
        togglePlay();
      }
    };

    video.addEventListener("pause", handleVideoPause);
    video.addEventListener("play", handleVideoPlay);

    return () => {
      video.removeEventListener("pause", handleVideoPause);
      video.removeEventListener("play", handleVideoPlay);
    };
  }, [isPlaying, togglePlay]);

  // EMOTIONAL: Play encouragement after step narration finishes
  // + Add breathing space for natural rhythm
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleNarrationEnded = () => {
      // Only process if we're actively cooking
      if (!hasUserStartedRef.current || !isPlaying) return;
      
      // EMOTIONAL TIMING: Post-narration breathing space
      // This creates human rhythm and prevents rushed feeling
      postNarrationTimerRef.current = setTimeout(() => {
        // Play gentle encouragement after the breathing space
        playEncouragement('gentle');
      }, VOICE_TIMING.POST_NARRATION_WAIT);
    };

    audio.addEventListener('ended', handleNarrationEnded);
    return () => {
      audio.removeEventListener('ended', handleNarrationEnded);
      // Clean up timer on unmount
      if (postNarrationTimerRef.current) {
        clearTimeout(postNarrationTimerRef.current);
      }
    };
  }, [isPlaying, playEncouragement]);

  // ============================================
  // VOICE TUTORIAL DISMISS HANDLER
  // ============================================
  const dismissVoiceTutorial = useCallback(() => {
    setShowVoiceTutorial(false);
    localStorage.setItem(hasSeenTutorialKey, 'true');
    toast.success('Voice controls ready! Start cooking.');
  }, []);

  // ============================================
  // END EXISTING LOGIC
  // ============================================

  if (!open) return null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) closeModal(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[99] bg-black/50" />
        <AnimatePresence mode="wait">
          {open && (
            <DialogPrimitive.Content
              className="fixed inset-0 z-[100] w-screen h-screen m-0 p-0 border-0 rounded-none bg-black overflow-hidden outline-none"
              onEscapeKeyDown={(e) => {
                e.preventDefault();
                closeModal();
              }}
              onPointerDownOutside={(e) => e.preventDefault()}
              onInteractOutside={(e) => e.preventDefault()}
              onOpenAutoFocus={(e) => e.preventDefault()}
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              {/* Accessibility: Hidden title for screen readers */}
              <VisuallyHidden>
                <DialogPrimitive.Title>Live Cooking Mode</DialogPrimitive.Title>
              </VisuallyHidden>
          
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="relative w-full h-full"
              >
                {/* Hidden audio element */}
                <audio ref={audioRef} className="hidden" />
                
                {/* ============================================ */}
                {/* FULL-SCREEN BACKGROUND */}
                {/* PHASE-1: Camera preview DORMANT (no camera permission popup) */}
                {/* ============================================ */}
                <div className="absolute inset-0 z-0">
                  {/* Camera feed - DORMANT in Phase-1 (code exists but not rendered) */}
                  {!PHASE_1_MODE && showCamera && (
                    <video
                      ref={cameraVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{ transform: 'scaleX(-1)' }}
                    />
                  )}
                  
                  {/* PHASE-1: Always show recipe background (no camera fallback logic) */}
                  {(PHASE_1_MODE || !showCamera || !hasCameraAccess) && (
                    <>
                      {recipeVideo ? (
                        <video
                          ref={videoRef}
                          src={recipeVideo}
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : recipeImage ? (
                        <img
                          src={recipeImage}
                          alt="Recipe"
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
                      )}
                    </>
                  )}
                  
                  {/* Mood-adaptive atmospheric tint overlay */}
                  <div 
                    className="absolute inset-0 transition-colors duration-1000"
                    style={{ backgroundColor: theme.tint }}
                  />
                  
                  {/* Cinematic dark gradient for readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40" />
                  
                  {/* Mood gradient accent (top) */}
                  <motion.div 
                    className={`absolute inset-x-0 top-0 h-64 bg-gradient-to-b ${theme.gradient}`}
                    animate={{ opacity: [0.5, 0.7, 0.5] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>

                {/* ============================================ */}
                {/* TOP BAR - PHASE-1 SIMPLIFIED CONTROLS */}
                {/* ============================================ */}
                <motion.div
                  initial={{ y: -30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
                  className="absolute top-0 left-0 right-0 z-20 p-4 md:p-6"
                >
                  <div className="flex items-center justify-between">
                    {/* Left: Voice Status Indicator (Phase-1 simplified) */}
                    <div className="flex items-center gap-3">
                      {/* Status Ring - PHASE-1: Shows listening/command state */}
                      <motion.div
                        className="relative"
                        animate={
                          voiceListening 
                            ? { scale: [1, 1.15, 1] } // Pulse when listening
                            : isPlaying 
                              ? { scale: [1, 1.1, 1] }
                              : { scale: 1 }
                        }
                        transition={{ 
                          duration: voiceListening ? 1 : 2, 
                          repeat: Infinity, 
                          ease: "easeInOut" 
                        }}
                      >
                        {/* Outer glow ring - PHASE-1: Changes color when listening */}
                        <motion.div
                          className="absolute -inset-2 rounded-full blur-md"
                          style={{ 
                            backgroundColor: voiceListening 
                              ? 'rgba(34, 197, 94, 0.6)' // Green when listening
                              : commandFlash 
                                ? 'rgba(250, 204, 21, 0.8)' // Yellow flash on command
                                : isPlaying ? theme.glowStrong : theme.glow,
                          }}
                          animate={{ 
                            opacity: voiceListening 
                              ? [0.5, 0.9, 0.5] // More pronounced pulse when listening
                              : commandFlash 
                                ? [1, 0.5, 1] // Quick flash
                                : isPlaying ? [0.5, 0.8, 0.5] : [0.3, 0.5, 0.3],
                          }}
                          transition={{ 
                            duration: voiceListening ? 0.8 : commandFlash ? 0.3 : 2, 
                            repeat: Infinity, 
                            ease: "easeInOut" 
                          }}
                        />
                        {/* Inner indicator - PHASE-1: Shows mic icon when listening */}
                        <div 
                          className={`relative w-10 h-10 rounded-full backdrop-blur-xl border flex items-center justify-center transition-colors ${
                            commandFlash ? 'bg-yellow-500/30' : ''
                          }`}
                          style={{ 
                            borderColor: voiceListening 
                              ? 'rgba(34, 197, 94, 0.5)' 
                              : theme.accent + '40',
                            backgroundColor: voiceListening 
                              ? 'rgba(34, 197, 94, 0.2)' 
                              : 'rgba(0,0,0,0.3)',
                          }}
                        >
                          {voiceListening ? (
                            <motion.div
                              animate={{ scale: [1, 1.2, 1] }}
                              transition={{ duration: 0.8, repeat: Infinity }}
                            >
                              <Mic className="w-4 h-4 text-green-400" />
                            </motion.div>
                          ) : (
                            <motion.div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: theme.accent }}
                              animate={{ 
                                scale: isPlaying ? [1, 1.4, 1] : [1, 1.2, 1],
                                opacity: isPlaying ? [0.8, 1, 0.8] : [0.6, 1, 0.6],
                              }}
                              transition={{ duration: isPlaying ? 1.5 : 3, repeat: Infinity }}
                            />
                          )}
                        </div>
                      </motion.div>
                      
                      {/* Status text - PHASE-1: Shows voice listening state */}
                      <div className="flex flex-col">
                        <span className={`text-xs font-medium ${voiceListening ? 'text-green-400' : theme.text} opacity-80`}>
                          {voiceListening 
                            ? 'Listening...' 
                            : PHASE_1_MODE 
                              ? 'Voice Cooking' 
                              : (useBrowserSpeech ? 'Free Voice' : 'AI Observer')}
                        </span>
                        <span className="text-[10px] text-white/50">
                          {voiceListening 
                            ? 'Say: next, back, repeat, pause'
                            : commandFlash 
                              ? `"${lastCommand}" received!`
                              : PHASE_1_MODE 
                                ? (handsFreeEnabled 
                                  ? (isPlaying ? 'Voice commands ready' : 'Press play to start') 
                                  : 'Tap mic to enable voice')
                                : (useBrowserSpeech 
                                  ? 'Browser TTS active' 
                                  : aiState === 'idle' 
                                    ? 'Watching' 
                                    : aiState === 'active' 
                                      ? 'Activity detected' 
                                      : 'Step ready?')}
                        </span>
                      </div>
                    </div>

                    {/* Right: Control buttons */}
                    <div className="flex items-center gap-2">
                      {/* PHASE-1: Simplified Voice Control Button with listening indicator */}
                      <motion.div
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.6 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleEnableHandsFree}
                          className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-xl border border-white/10 ${
                            voiceListening 
                              ? 'bg-green-500/30 border-green-400/30'
                              : handsFreeEnabled 
                                ? 'bg-emerald-500/20' 
                                : 'bg-black/30'
                          }`}
                          data-testid="live-cooking-handsfree-btn"
                        >
                          {/* Pulsing dot indicator when listening */}
                          {voiceListening && (
                            <motion.div
                              className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full"
                              animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                              transition={{ duration: 1, repeat: Infinity }}
                            />
                          )}
                          {handsFreeEnabled ? (
                            <motion.div
                              animate={voiceListening ? { scale: [1, 1.2, 1] } : {}}
                              transition={{ duration: 0.5, repeat: Infinity }}
                            >
                              <Mic className={`w-3 h-3 ${voiceListening ? 'text-green-400' : 'text-emerald-400'}`} />
                            </motion.div>
                          ) : (
                            <MicOff className="w-3 h-3 text-white/60" />
                          )}
                          <span className={`text-xs hidden sm:inline ${
                            voiceListening 
                              ? 'text-green-400'
                              : handsFreeEnabled 
                                ? 'text-emerald-400' 
                                : 'text-white/60'
                          }`}>
                            {voiceListening ? 'Listening' : handsFreeEnabled ? 'Voice On' : 'Voice'}
                          </span>
                        </Button>
                      </motion.div>

                      {/* PHASE-1: Camera/Gesture buttons hidden but code exists */}
                      {!PHASE_1_MODE && (
                        <>
                          {/* Gesture control toggle button - DORMANT in Phase-1 */}
                          <motion.div
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.7 }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (!hasCameraAccess) {
                                  handleEnableHandsFree();
                                  return;
                                }
                                if (!gestureEnabled && !showCamera) {
                                  setShowCamera(true);
                                }
                                setGestureEnabled(prev => !prev);
                              }}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-xl border border-white/10 ${
                                gestureEnabled && hasCameraAccess ? 'bg-blue-500/20' : 'bg-black/30'
                              }`}
                              data-testid="live-cooking-gesture-btn"
                            >
                              <span className={`text-xs ${gestureEnabled && hasCameraAccess ? 'text-blue-400' : 'text-white/60'}`}>
                                Swipe
                              </span>
                            </Button>
                          </motion.div>

                          {/* Camera toggle - DORMANT in Phase-1 */}
                          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (!hasCameraAccess) {
                                  handleEnableHandsFree();
                                  return;
                                }
                                toggleCamera();
                              }}
                              className={`w-10 h-10 rounded-full backdrop-blur-xl border border-white/10 text-white hover:bg-white/10 ${
                                showCamera && hasCameraAccess ? 'bg-emerald-500/20' : 'bg-black/30'
                              }`}
                              data-testid="live-cooking-camera-btn"
                            >
                              <span className="text-white/60 text-xs">Cam</span>
                            </Button>
                          </motion.div>
                        </>
                      )}

                      {/* Close button */}
                      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={closeModal}
                          className="w-10 h-10 rounded-full backdrop-blur-xl border border-white/10 bg-black/30 text-white hover:bg-white/10"
                          data-testid="live-cooking-close-btn"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </motion.div>
                    </div>
                  </div>
                </motion.div>

                {/* ============================================ */}
                {/* WHISPER SUGGESTION LAYER - DORMANT in PHASE-1 */}
                {/* ============================================ */}
                {!PHASE_1_MODE && (
                  <AnimatePresence>
                    {showWhisper && whisperText && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="absolute left-0 right-0 bottom-64 md:bottom-72 z-20 flex justify-center px-4"
                      >
                        <div 
                          className="px-6 py-3 rounded-2xl backdrop-blur-xl border"
                          style={{ 
                            backgroundColor: 'rgba(0,0,0,0.4)',
                            borderColor: theme.accent + '30',
                            boxShadow: `0 0 30px ${theme.glow}`,
                          }}
                        >
                          <p className={`text-sm ${theme.text} text-center`}>
                            {whisperText}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}

                {/* ============================================ */}
                {/* VOICE TUTORIAL OVERLAY - Shows on first enable */}
                {/* ============================================ */}
                <AnimatePresence>
                  {showVoiceTutorial && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
                      onClick={dismissVoiceTutorial}
                    >
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                        className="relative max-w-sm mx-4 p-6 rounded-3xl backdrop-blur-2xl border"
                        style={{ 
                          backgroundColor: 'rgba(0, 0, 0, 0.6)',
                          borderColor: 'rgba(34, 197, 94, 0.3)',
                          boxShadow: '0 0 40px rgba(34, 197, 94, 0.2)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Header with mic icon */}
                        <div className="flex items-center gap-3 mb-4">
                          <motion.div
                            className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center"
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          >
                            <Mic className="w-6 h-6 text-green-400" />
                          </motion.div>
                          <div>
                            <h3 className="text-lg font-semibold text-white">Voice Commands</h3>
                            <p className="text-xs text-white/60">Hands-free cooking is ready!</p>
                          </div>
                        </div>
                        
                        {/* Commands list */}
                        <div className="space-y-2 mb-5">
                          <p className="text-sm text-white/70 mb-3">Say these commands to control cooking:</p>
                          
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { cmd: '"Next"', desc: 'Go forward', icon: '→' },
                              { cmd: '"Back"', desc: 'Go back', icon: '←' },
                              { cmd: '"Repeat"', desc: 'Replay step', icon: '↺' },
                              { cmd: '"Pause"', desc: 'Stop voice', icon: '⏸' },
                              { cmd: '"Resume"', desc: 'Continue', icon: '▶' },
                            ].map((item) => (
                              <motion.div
                                key={item.cmd}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10"
                                whileHover={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                              >
                                <span className="text-lg">{item.icon}</span>
                                <div>
                                  <span className="text-sm font-medium text-green-400">{item.cmd}</span>
                                  <p className="text-[10px] text-white/50">{item.desc}</p>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                        
                        {/* Tips */}
                        <div className="bg-white/5 rounded-xl p-3 mb-4 border border-white/5">
                          <p className="text-xs text-white/60">
                            <span className="text-green-400 font-medium">Tip:</span> Speak clearly and wait for the green pulse before giving commands.
                          </p>
                        </div>
                        
                        {/* Dismiss button */}
                        <Button
                          onClick={dismissVoiceTutorial}
                          className="w-full py-3 rounded-xl bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30"
                          data-testid="voice-tutorial-dismiss-btn"
                        >
                          Got it, let's cook!
                        </Button>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ============================================ */}
                {/* FLOATING GLASS STEP CARD */}
                {/* ============================================ */}
                <motion.div
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4, duration: 0.6, ease: "easeOut" }}
                  className="absolute left-4 right-4 bottom-8 md:left-8 md:right-8 md:bottom-12 z-20"
                >
                  {/* Outer glow effect */}
                  <motion.div
                    className="absolute -inset-1 rounded-3xl blur-xl opacity-50"
                    style={{ backgroundColor: theme.glow }}
                    animate={{ 
                      opacity: [0.3, 0.5, 0.3],
                      scale: [1, 1.02, 1],
                    }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  />
                  
                  {/* Glass card */}
                  <motion.div
                    className="relative overflow-hidden rounded-3xl backdrop-blur-2xl border"
                    style={{ 
                      backgroundColor: 'rgba(0, 0, 0, 0.4)',
                      borderColor: theme.accent + '25',
                      boxShadow: `0 0 60px ${theme.glow}, inset 0 1px 0 rgba(255,255,255,0.1)`,
                    }}
                    animate={{ 
                      boxShadow: [
                        `0 0 40px ${theme.glow}, inset 0 1px 0 rgba(255,255,255,0.1)`,
                        `0 0 60px ${theme.glowStrong}, inset 0 1px 0 rgba(255,255,255,0.15)`,
                        `0 0 40px ${theme.glow}, inset 0 1px 0 rgba(255,255,255,0.1)`,
                      ]
                    }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  >
                    {/* Progress bar (top edge) */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-white/5">
                      <motion.div
                        className="h-full"
                        style={{ backgroundColor: theme.accent }}
                        initial={{ width: 0 }}
                        animate={{ width: `${stepProgress}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      />
                    </div>

                    {/* Card content */}
                    <div className="p-6 md:p-8">
                      {/* Step indicator & timer */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <span 
                            className="text-xs font-semibold px-3 py-1 rounded-full"
                            style={{ 
                              backgroundColor: theme.accent + '20',
                              color: theme.accent,
                            }}
                          >
                            Step {currentStep + 1} of {instructions.length || 1}
                          </span>
                          {stepTime && (
                            <span className="text-xs text-white/50">
                              {stepTime}
                            </span>
                          )}
                        </div>
                        
                        {/* Mini progress dots */}
                        <div className="hidden sm:flex items-center gap-1">
                          {instructions.slice(0, 8).map((_, idx) => (
                            <motion.div
                              key={idx}
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ 
                                backgroundColor: idx <= currentStep ? theme.accent : 'rgba(255,255,255,0.2)',
                              }}
                              animate={idx === currentStep ? { scale: [1, 1.3, 1] } : {}}
                              transition={{ duration: 1, repeat: Infinity }}
                            />
                          ))}
                          {instructions.length > 8 && (
                            <span className="text-[10px] text-white/40 ml-1">+{instructions.length - 8}</span>
                          )}
                        </div>
                      </div>

                      {/* Step instruction text */}
                      <AnimatePresence mode="wait">
                        <motion.p
                          key={currentStep}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.4 }}
                          className="text-lg md:text-xl text-white/90 font-light leading-relaxed mb-6"
                        >
                          {currentStepText}
                        </motion.p>
                      </AnimatePresence>

                      {/* Control buttons - PHASE-1: Large controls with Repeat */}
                      <div className="flex items-center justify-center gap-3 md:gap-4">
                        {/* Previous */}
                        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handlePrevWithVoice}
                            disabled={currentStep === 0}
                            className="w-12 h-12 md:w-14 md:h-14 rounded-full backdrop-blur-md border border-white/10 bg-white/5 text-white hover:bg-white/10 disabled:opacity-30"
                            data-testid="live-cooking-prev-btn"
                          >
                            <ChevronLeft className="h-6 w-6 md:h-7 md:w-7" />
                          </Button>
                        </motion.div>

                        {/* Play/Pause */}
                        <motion.div 
                          whileHover={{ scale: 1.05 }} 
                          whileTap={{ scale: 0.95 }}
                        >
                          <Button
                            onClick={handleTogglePlayWithVoice}
                            className="w-16 h-16 md:w-20 md:h-20 rounded-full border-0 text-white shadow-2xl"
                            style={{ 
                              background: `linear-gradient(135deg, ${theme.accent}90, ${theme.accent}60)`,
                              boxShadow: `0 0 40px ${theme.glow}`,
                            }}
                            data-testid="live-cooking-play-btn"
                          >
                            <motion.div
                              key={isPlaying ? "pause" : "play"}
                              initial={{ scale: 0, rotate: -90 }}
                              animate={{ scale: 1, rotate: 0 }}
                              transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            >
                              {isPlaying ? (
                                <Pause className="h-7 w-7 md:h-8 md:w-8" />
                              ) : (
                                <Play className="h-7 w-7 md:h-8 md:w-8 ml-1" />
                              )}
                            </motion.div>
                          </Button>
                        </motion.div>

                        {/* Next */}
                        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleNextWithVoice}
                            disabled={currentStep >= instructions.length - 1}
                            className="w-12 h-12 md:w-14 md:h-14 rounded-full backdrop-blur-md border border-white/10 bg-white/5 text-white hover:bg-white/10 disabled:opacity-30"
                            data-testid="live-cooking-next-btn"
                          >
                            <ChevronRight className="h-6 w-6 md:h-7 md:w-7" />
                          </Button>
                        </motion.div>

                        {/* PHASE-1: Repeat Button - Tap to repeat current step narration */}
                        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleRepeat}
                            className="w-10 h-10 md:w-12 md:h-12 rounded-full backdrop-blur-md border border-white/10 bg-white/5 text-white hover:bg-white/10"
                            data-testid="live-cooking-repeat-btn"
                            title="Repeat current step"
                          >
                            <RotateCcw className="h-4 w-4 md:h-5 md:w-5" />
                          </Button>
                        </motion.div>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>

                {/* Hidden video for recipe video playback - PHASE-1: Always show recipe */}
                {(PHASE_1_MODE || !showCamera) && recipeVideo && (
                  <video
                    ref={videoRef}
                    src={recipeVideo}
                    className="hidden"
                    loop
                  />
                )}
              </motion.div>
            </DialogPrimitive.Content>
          )}
        </AnimatePresence>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
