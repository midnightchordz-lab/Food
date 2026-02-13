import React, { useRef, useEffect, useCallback, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight, Pause, Play, Mic, MicOff, Camera, CameraOff, Hand, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useLiveCooking } from "@/stores/useLiveCooking";
import { useGestureControl } from "@/hooks/useGestureControl";
import { useHandsFreePermissions, PermissionStatus } from "@/hooks/useHandsFreePermissions";
import { useEngineOrchestrator, EngineState } from "@/hooks/useEngineOrchestrator";
import { useAIObserver, ObserverEvents } from "@/hooks/useAIObserver";
import { useEmotionalVoiceOrchestrator } from "@/hooks/useEmotionalVoiceOrchestrator";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import axios from "axios";
import { 
  narrateStep, 
  narrateCurrentStep, 
  stopSpeech, 
  isSpeechSupported, 
  setHandlers as setBrowserSpeechHandlers,
  connectGestureEvents 
} from "@/lib/browserSpeech";

const API = process.env.REACT_APP_BACKEND_URL;

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
 * LiveCookingModal - Futuristic Mood-Adaptive AI Interface
 * Full-screen cinematic camera experience with glassmorphism UI
 * Preserves all existing cooking logic, voice behavior, and navigation
 */
export default function LiveCookingModal() {
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
  // PERMISSION ORCHESTRATION LAYER
  // Handles camera + mic + speech permissions together
  // Only activates after explicit user interaction
  // ============================================
  const {
    status: permissionStatus,
    isFullyGranted: hasAllPermissions,
    hasCameraAccess,
    hasMicrophoneAccess,
    hasSpeechRecognition,
    cameraStream,
    errorMessage: permissionError,
    requestPermissions,
    stopCameraStream,
    reset: resetPermissions,
  } = useHandsFreePermissions();
  
  // Hands-free mode state
  const [handsFreeEnabled, setHandsFreeEnabled] = useState(false);
  const [showCamera, setShowCamera] = useState(false); // Start hidden, enable after permissions
  const [cameraVideoReady, setCameraVideoReady] = useState(false);
  
  // AI Observer visual states (presentation only)
  const [aiState, setAiState] = useState('idle'); // idle, active, completion
  const [whisperText, setWhisperText] = useState('');
  const [showWhisper, setShowWhisper] = useState(false);

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

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      hasUserStartedRef.current = false;
      setAiState('idle');
      setShowWhisper(false);
      setHandsFreeEnabled(false); // Reset hands-free when modal closes
      setShowCamera(false); // Hide camera
      setGestureEnabled(false); // Reset gesture state
      setUseBrowserSpeech(false); // Reset fallback mode
      stopSpeech(); // Stop any browser speech
      resetOrchestrator(); // Reset emotional voice state
      stopCameraStream(); // Stop camera stream from permission hook
      resetPermissions(); // Reset permission state
      resetEngineOrchestrator(); // Reset engine orchestrator state
    }
  }, [open, resetOrchestrator, stopCameraStream, resetPermissions, resetEngineOrchestrator]);

  // ============================================
  // HANDS-FREE ENABLE HANDLER
  // Requests all permissions together on user tap
  // ============================================
  
  // Engine Orchestrator - coordinates TTS, recognition, gestures
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
    enabled: open && handsFreeEnabled,
    videoRef: cameraVideoRef,
    cameraStream,
    onSpeakStep: async (text) => {
      // Use browser speech for narration
      stopSpeech();
      await new Promise(resolve => setTimeout(resolve, 150));
      narrateCurrentStep(text, true);
    },
    onStopSpeaking: () => {
      stopSpeech();
    },
    onStepChange: (direction) => {
      // This is called by orchestrator after gesture/voice navigation
      console.log('[LiveCooking] Orchestrator step change:', direction);
    },
  });
  
  // Track voice command active state for gesture priority
  const [voiceCommandActive, setVoiceCommandActive] = useState(false);
  
  const handleEnableHandsFree = useCallback(async () => {
    if (handsFreeEnabled) {
      // Already enabled - disable it
      setHandsFreeEnabled(false);
      setShowCamera(false);
      setGestureEnabled(false);
      stopCameraStream();
      cleanupOrchestrator();
      toast.info('Hands-free controls disabled');
      return;
    }
    
    // Request permissions (camera + mic + speech) on explicit user action
    console.log('[LiveCooking] Requesting hands-free permissions...');
    const granted = await requestPermissions();
    
    if (granted) {
      setHandsFreeEnabled(true);
      setShowCamera(true);
      toast.success('Hands-free mode enabled! Say "next step" or wave to navigate.');
      console.log('[LiveCooking] Hands-free mode enabled with all permissions');
    } else {
      // Show error toast with the specific error message
      toast.error(permissionError || 'Could not enable hands-free mode. Please allow camera and microphone access.');
      console.log('[LiveCooking] Permissions denied, hands-free not enabled');
    }
  }, [handsFreeEnabled, requestPermissions, stopCameraStream, permissionError, cleanupOrchestrator]);
  
  // Setup recognition callbacks when they change
  useEffect(() => {
    setRecognitionCallbacks({
      onNext: handleNextWithVoice,
      onPrev: handlePrevWithVoice,
      onTogglePlay: handleTogglePlayWithVoice,
      onRepeat: handleRepeat,
    });
  }, [setRecognitionCallbacks, handleNextWithVoice, handlePrevWithVoice, handleTogglePlayWithVoice, handleRepeat]);
  
  // Initialize camera and start recognition when hands-free is enabled
  useEffect(() => {
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
  const [gestureEnabled, setGestureEnabled] = useState(false);

  // Gesture controls (swipe left/right) - uses camera stream from permissions
  // Now controlled by orchestrator for proper sequencing
  useGestureControl({
    enabled: open && gestureEnabled && showCamera && cameraVideoReady && hasCameraAccess && isGestureReady,
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
  useEffect(() => {
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

  // AI Observer - visual state updates only (no logic changes)
  const handleAIEvent = useCallback((event) => {
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
    enabled: open && hasCameraAccess && showCamera && cameraVideoReady,
    videoElement: cameraVideoReady ? cameraVideoRef.current : null,
    onEvent: handleAIEvent,
  });

  // Toggle camera visibility (only if permissions granted)
  const toggleCamera = useCallback(() => {
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
                {/* FULL-SCREEN CAMERA BACKGROUND */}
                {/* ============================================ */}
                <div className="absolute inset-0 z-0">
                  {/* Camera feed as full background */}
                  {showCamera && (
                    <video
                      ref={cameraVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{ transform: 'scaleX(-1)' }}
                    />
                  )}
                  
                  {/* Fallback background when camera is off */}
                  {(!showCamera || !hasCameraAccess) && (
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
                {/* TOP BAR - AI INDICATOR & CONTROLS */}
                {/* ============================================ */}
                <motion.div
                  initial={{ y: -30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
                  className="absolute top-0 left-0 right-0 z-20 p-4 md:p-6"
                >
                  <div className="flex items-center justify-between">
                    {/* Left: AI Awareness Indicator */}
                    <div className="flex items-center gap-3">
                      {/* AI Ring Indicator */}
                      <motion.div
                        className="relative"
                        animate={
                          aiState === 'completion' 
                            ? { scale: [1, 1.2, 1] }
                            : aiState === 'active'
                            ? { scale: [1, 1.05, 1] }
                            : { scale: 1 }
                        }
                        transition={{ 
                          duration: aiState === 'completion' ? 1.5 : 2, 
                          repeat: Infinity, 
                          ease: "easeInOut" 
                        }}
                      >
                        {/* Outer glow ring */}
                        <motion.div
                          className="absolute -inset-2 rounded-full blur-md"
                          style={{ 
                            backgroundColor: aiState === 'idle' ? theme.glow : theme.glowStrong,
                          }}
                          animate={{ 
                            opacity: aiState === 'idle' ? [0.3, 0.5, 0.3] : [0.5, 0.8, 0.5],
                          }}
                          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        />
                        {/* Inner indicator */}
                        <div 
                          className="relative w-10 h-10 rounded-full backdrop-blur-xl border flex items-center justify-center"
                          style={{ 
                            borderColor: theme.accent + '40',
                            backgroundColor: 'rgba(0,0,0,0.3)',
                          }}
                        >
                          <motion.div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: theme.accent }}
                            animate={{ 
                              scale: aiState === 'idle' ? [1, 1.2, 1] : [1, 1.4, 1],
                              opacity: aiState === 'idle' ? [0.6, 1, 0.6] : [0.8, 1, 0.8],
                            }}
                            transition={{ duration: aiState === 'idle' ? 3 : 1.5, repeat: Infinity }}
                          />
                        </div>
                      </motion.div>
                      
                      {/* Status text */}
                      <div className="flex flex-col">
                        <span className={`text-xs font-medium ${theme.text} opacity-80`}>
                          {useBrowserSpeech ? 'Free Voice' : 'AI Observer'}
                        </span>
                        <span className="text-[10px] text-white/50">
                          {useBrowserSpeech 
                            ? 'Browser TTS active' 
                            : aiState === 'idle' 
                              ? 'Watching' 
                              : aiState === 'active' 
                                ? 'Activity detected' 
                                : 'Step ready?'}
                        </span>
                      </div>
                    </div>

                    {/* Right: Control buttons */}
                    <div className="flex items-center gap-2">
                      {/* Enable Hands-Free button - requests ALL permissions on tap */}
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
                          disabled={permissionStatus === PermissionStatus.REQUESTING}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-xl border border-white/10 ${
                            handsFreeEnabled && hasAllPermissions 
                              ? 'bg-emerald-500/20' 
                              : permissionStatus === PermissionStatus.DENIED 
                                ? 'bg-red-500/20' 
                                : 'bg-black/30'
                          }`}
                          data-testid="live-cooking-handsfree-btn"
                        >
                          {permissionStatus === PermissionStatus.REQUESTING ? (
                            <div className="w-3 h-3 border border-white/60 border-t-transparent rounded-full animate-spin" />
                          ) : handsFreeEnabled && hasAllPermissions ? (
                            <Mic className="w-3 h-3 text-emerald-400" />
                          ) : permissionStatus === PermissionStatus.DENIED ? (
                            <AlertCircle className="w-3 h-3 text-red-400" />
                          ) : (
                            <MicOff className="w-3 h-3 text-white/60" />
                          )}
                          <span className={`text-xs hidden sm:inline ${
                            handsFreeEnabled && hasAllPermissions 
                              ? 'text-emerald-400' 
                              : permissionStatus === PermissionStatus.DENIED
                                ? 'text-red-400'
                                : 'text-white/60'
                          }`}>
                            {handsFreeEnabled && hasAllPermissions ? 'Voice On' : 'Voice'}
                          </span>
                        </Button>
                      </motion.div>

                      {/* Gesture control toggle button - only works after permissions granted */}
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
                              // Need to request permissions first
                              handleEnableHandsFree();
                              return;
                            }
                            // Enable camera if not already on when enabling gestures
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
                          <Hand className={`w-3 h-3 ${gestureEnabled && hasCameraAccess ? 'text-blue-400' : 'text-white/60'}`} />
                          <span className={`text-xs hidden sm:inline ${gestureEnabled && hasCameraAccess ? 'text-blue-400' : 'text-white/60'}`}>
                            Swipe
                          </span>
                        </Button>
                      </motion.div>

                      {/* Camera toggle - only works after permissions granted */}
                      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (!hasCameraAccess) {
                              // Need to request permissions first
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
                          {showCamera && hasCameraAccess ? (
                            <Camera className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <CameraOff className="h-4 w-4 text-white/60" />
                          )}
                        </Button>
                      </motion.div>

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
                {/* WHISPER SUGGESTION LAYER */}
                {/* ============================================ */}
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

                      {/* Control buttons */}
                      <div className="flex items-center justify-center gap-4">
                        {/* Previous */}
                        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handlePrevWithVoice}
                            disabled={currentStep === 0}
                            className="w-12 h-12 rounded-full backdrop-blur-md border border-white/10 bg-white/5 text-white hover:bg-white/10 disabled:opacity-30"
                            data-testid="live-cooking-prev-btn"
                          >
                            <ChevronLeft className="h-6 w-6" />
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
                            className="w-12 h-12 rounded-full backdrop-blur-md border border-white/10 bg-white/5 text-white hover:bg-white/10 disabled:opacity-30"
                            data-testid="live-cooking-next-btn"
                          >
                            <ChevronRight className="h-6 w-6" />
                          </Button>
                        </motion.div>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>

                {/* Hidden video for recipe video playback when camera is off */}
                {!showCamera && recipeVideo && (
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
