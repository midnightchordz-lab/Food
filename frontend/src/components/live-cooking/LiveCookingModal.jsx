import React, { useRef, useEffect, useCallback, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight, Pause, Play, Mic, Camera, CameraOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLiveCooking } from "@/stores/useLiveCooking";
import { useHandsFreeControls } from "@/hooks/useHandsFreeControls";
import { useCameraPreview } from "@/hooks/useCameraPreview";
import { useAIObserver, ObserverEvents } from "@/hooks/useAIObserver";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import axios from "axios";

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
  
  // Camera preview state - Default OFF to prevent permission dialogs from closing modal
  const [showCamera, setShowCamera] = useState(false);
  const [cameraVideoReady, setCameraVideoReady] = useState(false);
  
  // AI Observer visual states (presentation only)
  const [aiState, setAiState] = useState('idle'); // idle, active, completion
  const [whisperText, setWhisperText] = useState('');
  const [showWhisper, setShowWhisper] = useState(false);

  // Get mood from store or localStorage fallback
  const mood = storeMood || localStorage.getItem('selectedMood') || 'calm';
  
  // Get mood theme
  const theme = MOOD_THEMES[mood] || MOOD_THEMES.calm;

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

  // Voice narration for current step
  const readCurrentStep = async () => {
    if (!instructions.length || currentStep >= instructions.length) return;
    
    try {
      const token = localStorage.getItem('token');
      const stepText = typeof instructions[currentStep] === 'string' 
        ? instructions[currentStep] 
        : instructions[currentStep]?.text || instructions[currentStep]?.instruction;
      
      if (!stepText) return;
      
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

      if (response.data.success && audioRef.current) {
        const fullUrl = response.data.audioUrl.startsWith('http')
          ? response.data.audioUrl
          : `${API}${response.data.audioUrl}`;
        
        audioRef.current.src = fullUrl;
        audioRef.current.play().catch(e => console.error('Play failed:', e));
      }
    } catch (error) {
      console.error('Voice narration error:', error);
    }
  };

  // Video playback when modal opens (no voice auto-play)
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
  }, [open, recipeVideo]);

  // Read step when step changes (only if user has started)
  useEffect(() => {
    if (!open) return;
    if (!hasUserStartedRef.current) return;
    
    readCurrentStep();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  // Modified play handler - start voice on first play
  const handleTogglePlayWithVoice = useCallback(() => {
    const newIsPlaying = !isPlaying;
    togglePlay();
    
    if (newIsPlaying && !hasUserStartedRef.current) {
      hasUserStartedRef.current = true;
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
  }, [isPlaying, togglePlay]);

  // Handle next with voice trigger
  const handleNextWithVoice = useCallback(() => {
    hasUserStartedRef.current = true;
    nextStep();
    readCurrentStep();
  }, [nextStep]);

  // Handle prev with voice trigger
  const handlePrevWithVoice = useCallback(() => {
    hasUserStartedRef.current = true;
    prevStep();
    readCurrentStep();
  }, [prevStep]);

  // Handle repeat - replay current step narration
  const handleRepeat = useCallback(() => {
    hasUserStartedRef.current = true;
    readCurrentStep();
  }, []);

  // Reset hasUserStarted when modal closes
  useEffect(() => {
    if (!open) {
      hasUserStartedRef.current = false;
      setAiState('idle');
      setShowWhisper(false);
    }
  }, [open]);

  // Hands-free controls (voice commands + double clap)
  useHandsFreeControls({
    enabled: open,
    onNext: handleNextWithVoice,
    onPrev: handlePrevWithVoice,
    onTogglePlay: handleTogglePlayWithVoice,
    onRepeat: handleRepeat,
    isPlaying,
  });

  // Camera preview
  const { 
    isActive: isCameraActive, 
    hasPermission: hasCameraPermission,
    stream: cameraStream,
  } = useCameraPreview({
    enabled: open && showCamera,
    preferRearCamera: true,
  });

  // Attach camera stream to video element
  useEffect(() => {
    const videoEl = cameraVideoRef.current;
    if (videoEl && cameraStream) {
      videoEl.srcObject = cameraStream;
      setCameraVideoReady(true);
    } else {
      setCameraVideoReady(false);
    }
    return () => {
      if (videoEl) {
        videoEl.srcObject = null;
      }
      setCameraVideoReady(false);
    };
  }, [cameraStream]);

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
    enabled: open && isCameraActive && showCamera && cameraVideoReady,
    videoElement: cameraVideoReady ? cameraVideoRef.current : null,
    onEvent: handleAIEvent,
  });

  // Toggle camera visibility
  const toggleCamera = useCallback(() => {
    setShowCamera(prev => !prev);
  }, []);

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

  // ============================================
  // END EXISTING LOGIC
  // ============================================

  if (!open) return null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={() => {}} modal={false}>
      <DialogPrimitive.Portal forceMount>
        <AnimatePresence>
          {open && (
            <DialogPrimitive.Content
              forceMount
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
          
          <AnimatePresence>
            {open && (
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
                  {(!showCamera || !isCameraActive) && (
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
                          AI Observer
                        </span>
                        <span className="text-[10px] text-white/50">
                          {aiState === 'idle' ? 'Watching' : aiState === 'active' ? 'Activity detected' : 'Step ready?'}
                        </span>
                      </div>
                    </div>

                    {/* Right: Control buttons */}
                    <div className="flex items-center gap-2">
                      {/* Hands-free indicator */}
                      <motion.div
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.6 }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-xl border border-white/10"
                        style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
                      >
                        <Mic className="w-3 h-3 text-emerald-400" />
                        <span className="text-xs text-white/60 hidden sm:inline">Voice</span>
                      </motion.div>

                      {/* Camera toggle */}
                      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={toggleCamera}
                          className={`w-10 h-10 rounded-full backdrop-blur-xl border border-white/10 text-white hover:bg-white/10 ${
                            showCamera && isCameraActive ? 'bg-emerald-500/20' : 'bg-black/30'
                          }`}
                          data-testid="live-cooking-camera-btn"
                        >
                          {showCamera && isCameraActive ? (
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
            )}
          </AnimatePresence>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
