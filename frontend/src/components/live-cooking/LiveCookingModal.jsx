import React, { useRef, useEffect, useCallback, useState } from "react";
import { Dialog, DialogContent, DialogPortal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight, Pause, Play, Mic, Camera, CameraOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLiveCooking } from "@/stores/useLiveCooking";
import { useHandsFreeControls } from "@/hooks/useHandsFreeControls";
import { useCameraPreview } from "@/hooks/useCameraPreview";
import { useAIObserver } from "@/hooks/useAIObserver";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * LiveCookingModal - Premium Cinematic Design
 * Root-mounted for true fullscreen experience
 * Uses Zustand store for global state management
 * Supports hands-free control via voice commands and double-clap
 * Includes camera preview and AI observer layer (passive, future-ready)
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
    togglePlay
  } = useLiveCooking();

  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const hasUserStartedRef = useRef(false);
  
  // Camera preview state
  const [showCamera, setShowCamera] = useState(true);
  const [cameraVideoReady, setCameraVideoReady] = useState(false);

  // Get current step text
  const currentStepText = instructions[currentStep]?.text || 
                          instructions[currentStep]?.instruction || 
                          instructions[currentStep] || 
                          "Preparing your next step...";
  
  const helperText = instructions.length > 0 
    ? `Step ${currentStep + 1} of ${instructions.length}` 
    : null;

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
    
    // Only start video playback, NOT voice
    if (videoRef.current && recipeVideo) {
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.muted = true; // Start muted until user clicks play
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Read step when step changes (only if user has started)
  useEffect(() => {
    if (!open) return;
    if (!hasUserStartedRef.current) return; // Don't auto-play on open
    
    readCurrentStep();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  // Modified play handler - start voice on first play
  const handleTogglePlayWithVoice = useCallback(() => {
    const newIsPlaying = !isPlaying;
    togglePlay();
    
    // Mark that user has started
    if (newIsPlaying && !hasUserStartedRef.current) {
      hasUserStartedRef.current = true;
      readCurrentStep(); // Start voice on first play
    }
    
    // Sync video
    if (videoRef.current) {
      if (newIsPlaying) {
        videoRef.current.muted = false;
        videoRef.current.volume = 1;
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
    
    // Sync audio
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

  // Camera preview (passive, fails silently if unavailable)
  const { 
    isActive: isCameraActive, 
    hasPermission: hasCameraPermission,
    stream: cameraStream,
  } = useCameraPreview({
    enabled: open && showCamera,
    preferRearCamera: true,
  });

  // Attach camera stream to video element when ready
  useEffect(() => {
    const videoEl = cameraVideoRef.current;
    if (videoEl && cameraStream) {
      videoEl.srcObject = cameraStream;
    }
    return () => {
      if (videoEl) {
        videoEl.srcObject = null;
      }
    };
  }, [cameraStream]);

  // AI Observer layer (passive sensor, no decision-making)
  // Events are logged but do NOT trigger any cooking actions in this phase
  useAIObserver({
    enabled: open && isCameraActive && showCamera,
    videoElement: cameraVideoRef.current,
    // Future: these callbacks can be connected to cooking handlers
    // For now, they just log events (handled inside the hook)
    onMotionDetected: null,
    onMotionStopped: null,
    onPossibleStepCompletion: null,
  });

  // Toggle camera visibility
  const toggleCamera = useCallback(() => {
    setShowCamera(prev => !prev);
  }, []);

  // Sync video play/pause events with modal state and audio
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleVideoPause = () => {
      // Pause audio when video pauses
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      }
      // Update state if needed
      if (isPlaying) {
        togglePlay();
      }
    };

    const handleVideoPlay = () => {
      // Resume audio when video plays
      if (audioRef.current && audioRef.current.paused && audioRef.current.src) {
        audioRef.current.play().catch(() => {});
      }
      // Update state if needed
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

  // Sync audio play/pause events with modal state and video
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleAudioPause = () => {
      // Pause video when audio pauses (if not already paused)
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
      }
      // Update state if needed
      if (isPlaying) {
        togglePlay();
      }
    };

    const handleAudioPlay = () => {
      // Resume video when audio plays
      if (videoRef.current && videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      }
      // Update state if needed
      if (!isPlaying) {
        togglePlay();
      }
    };

    audio.addEventListener("pause", handleAudioPause);
    audio.addEventListener("play", handleAudioPlay);

    return () => {
      audio.removeEventListener("pause", handleAudioPause);
      audio.removeEventListener("play", handleAudioPlay);
    };
  }, [isPlaying, togglePlay]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && closeModal()}>
      <DialogPortal>
        <DialogContent 
          className="fixed inset-0 left-0 top-0 w-screen h-screen max-w-none max-h-none rounded-none border-0 p-0 m-0 translate-x-0 translate-y-0 bg-black z-[9999]"
          hideCloseButton={true}
        >
        {/* Hidden audio element for voice narration */}
        <audio ref={audioRef} className="hidden" />
        
        <AnimatePresence mode="wait">
          {open && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="relative h-full w-full"
            >
              {/* Cinematic Background */}
              <div className="absolute inset-0">
                {/* Video background (if available) */}
                {recipeVideo && (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    controls={false}
                    loop
                    className="w-full h-full object-cover absolute inset-0"
                    style={{ opacity: 0.5 }}
                    onLoadedMetadata={() => {
                      if (videoRef.current) {
                        videoRef.current.muted = false;
                        videoRef.current.volume = 1;
                        videoRef.current.play().catch(() => {});
                      }
                    }}
                  >
                    <source src={recipeVideo} type="video/mp4" />
                  </video>
                )}
                
                {/* Animated background image (fallback if no video) */}
                {!recipeVideo && recipeImage && (
                  <motion.img
                    src={recipeImage}
                    alt="Recipe"
                    className="h-full w-full object-cover"
                    initial={{ scale: 1.1, filter: "blur(20px)" }}
                    animate={{ 
                      scale: 1.15, 
                      filter: "blur(30px)",
                    }}
                    transition={{ 
                      duration: 20, 
                      repeat: Infinity, 
                      repeatType: "reverse",
                      ease: "linear" 
                    }}
                    style={{ opacity: 0.4 }}
                  />
                )}
                
                {/* Premium gradient overlays */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/50 to-black/90" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-black/30" />
                
                {/* Ambient glow effect */}
                <motion.div
                  className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full"
                  style={{
                    background: "radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)",
                  }}
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.3, 0.5, 0.3],
                  }}
                  transition={{
                    duration: 8,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              </div>

              {/* Main Content */}
              <div className="relative z-10 flex h-full w-full flex-col">
                
                {/* Top Bar */}
                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="flex items-center justify-between p-4 md:p-6"
                >
                  {/* Live indicator */}
                  <div className="flex items-center gap-3">
                    <motion.div
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10"
                      animate={{ opacity: [1, 0.7, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <motion.div
                        className="w-2 h-2 rounded-full bg-red-500"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      />
                      <span className="text-xs font-medium text-white/90 uppercase tracking-wider">
                        Live Cooking
                      </span>
                    </motion.div>
                    
                    {/* Hands-free indicator */}
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10"
                      title="Voice commands active: say 'next', 'pause', 'play', or 'repeat'"
                    >
                      <Mic className="w-3 h-3 text-emerald-400" />
                      <span className="text-xs text-white/60">Hands-free</span>
                    </motion.div>
                  </div>

                  {/* Right side controls */}
                  <div className="flex items-center gap-2">
                    {/* Camera toggle button */}
                    <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleCamera}
                        className={`w-10 h-10 rounded-full backdrop-blur-md border border-white/10 text-white hover:bg-white/20 hover:text-white ${
                          showCamera && isCameraActive ? 'bg-emerald-500/20' : 'bg-white/10'
                        }`}
                        data-testid="live-cooking-camera-btn"
                        title={showCamera ? 'Hide camera preview' : 'Show camera preview'}
                      >
                        {showCamera && isCameraActive ? (
                          <Camera className="h-5 w-5 text-emerald-400" />
                        ) : (
                          <CameraOff className="h-5 w-5 text-white/60" />
                        )}
                      </Button>
                    </motion.div>

                    {/* Close button */}
                    <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={closeModal}
                        className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 hover:text-white"
                        data-testid="live-cooking-close-btn"
                      >
                        <X className="h-5 w-5" />
                      </Button>
                    </motion.div>
                  </div>
                </motion.div>

                {/* Camera Preview PiP (Picture-in-Picture style) */}
                <AnimatePresence>
                  {showCamera && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8, y: 20 }}
                      transition={{ duration: 0.3 }}
                      className="absolute top-20 right-4 md:top-24 md:right-6 z-30"
                    >
                      <div className="relative overflow-hidden rounded-2xl border border-white/20 shadow-2xl shadow-black/50">
                        {/* Camera video feed */}
                        <video
                          ref={cameraVideoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-32 h-24 md:w-40 md:h-30 object-cover bg-black/50"
                          style={{ transform: 'scaleX(-1)' }} // Mirror for natural feel
                        />
                        
                        {/* Camera status overlay */}
                        {!isCameraActive && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                            <div className="text-center">
                              <CameraOff className="w-6 h-6 text-white/40 mx-auto mb-1" />
                              <span className="text-xs text-white/40">
                                {hasCameraPermission === false ? 'No access' : 'Loading...'}
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {/* AI Observer indicator (subtle) */}
                        {isCameraActive && (
                          <motion.div
                            className="absolute bottom-1 left-1 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/40 backdrop-blur-sm"
                            animate={{ opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                            <span className="text-[10px] text-white/70">AI</span>
                          </motion.div>
                        )}
                        
                        {/* Decorative frame */}
                        <div className="absolute inset-0 border border-white/10 rounded-2xl pointer-events-none" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Center Content - Step Display */}
                <div className="flex flex-1 items-center justify-center px-6 md:px-12">
                  <motion.div
                    key={currentStepText}
                    initial={{ opacity: 0, y: 30, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -30, scale: 0.95 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="max-w-4xl text-center"
                  >
                    {/* Step indicator pill */}
                    {helperText && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/10 mb-6"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span className="text-sm font-medium text-white/80">
                          {helperText}
                        </span>
                      </motion.div>
                    )}

                    {/* Main step text */}
                    <motion.h1
                      className="text-3xl md:text-5xl lg:text-6xl font-bold leading-tight text-white"
                      style={{
                        textShadow: "0 4px 30px rgba(0,0,0,0.5)",
                      }}
                    >
                      {currentStepText}
                    </motion.h1>
                  </motion.div>
                </div>

                {/* Bottom Controls */}
                <motion.div
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  className="pb-safe flex flex-col items-center gap-6 p-6 md:p-8"
                >
                  {/* Progress bar */}
                  <div className="w-full max-w-md">
                    <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full"
                        initial={{ width: "0%" }}
                        animate={{ width: isPlaying ? "100%" : "0%" }}
                        transition={{ 
                          duration: isPlaying ? 30 : 0.3, 
                          ease: "linear" 
                        }}
                      />
                    </div>
                  </div>

                  {/* Control buttons */}
                  <div className="flex items-center gap-4 md:gap-6">
                    {/* Previous */}
                    <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handlePrevWithVoice}
                        className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 hover:text-white"
                        data-testid="live-cooking-prev-btn"
                      >
                        <ChevronLeft className="h-7 w-7" />
                      </Button>
                    </motion.div>

                    {/* Play/Pause - Main button */}
                    <motion.div 
                      whileHover={{ scale: 1.05 }} 
                      whileTap={{ scale: 0.95 }}
                    >
                      <Button
                        onClick={handleTogglePlayWithVoice}
                        className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 hover:from-violet-400 hover:to-fuchsia-500 text-white shadow-2xl shadow-violet-500/30 border-0"
                        data-testid="live-cooking-play-btn"
                      >
                        <motion.div
                          key={isPlaying ? "pause" : "play"}
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        >
                          {isPlaying ? (
                            <Pause className="h-8 w-8 md:h-10 md:w-10" />
                          ) : (
                            <Play className="h-8 w-8 md:h-10 md:w-10 ml-1" />
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
                        className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 hover:text-white"
                        data-testid="live-cooking-next-btn"
                      >
                        <ChevronRight className="h-7 w-7" />
                      </Button>
                    </motion.div>
                  </div>

                  {/* Exit hint */}
                  <motion.button
                    onClick={closeModal}
                    className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors"
                    whileHover={{ y: -2 }}
                    data-testid="live-cooking-exit-btn"
                  >
                    <span>Press ESC or tap to exit</span>
                  </motion.button>
                </motion.div>
              </div>

              {/* Decorative elements */}
              <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
              
              {/* Corner accents */}
              <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-violet-500/10 to-transparent pointer-events-none" />
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-fuchsia-500/10 to-transparent pointer-events-none" />
            </motion.div>
          )}
        </AnimatePresence>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
