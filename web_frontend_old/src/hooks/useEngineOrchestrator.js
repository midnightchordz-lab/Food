/**
 * useEngineOrchestrator - Phase-1 Engine Synchronization
 * 
 * CORE RESPONSIBILITY:
 * Synchronize voice narration, voice commands, and gesture detection
 * to work together in the correct order WITHOUT modifying any cooking logic.
 * 
 * NEVER CHANGES:
 * - Recipe data structure
 * - Step navigation logic
 * - UI components
 * - Existing Phase-1 features
 * 
 * ONLY CONTROLS:
 * - Microphone ownership
 * - Camera selection
 * - AI detection startup timing
 * - Engine start/stop order
 * 
 * ENGINE ORCHESTRATION SEQUENCE:
 * 1. Camera (gesture) - Request video-only, wait for readyState === 4
 * 2. TTS (narration) - Stop recognition before speaking, cancel previous, wait 150ms
 * 3. Voice Commands - Start ONLY when TTS stopped, proper sequencing
 * 4. Gesture Bridge - Separate loop, 500ms stable gesture confirmation
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

// Engine states
export const EngineState = {
  IDLE: 'idle',
  STARTING: 'starting',
  RUNNING: 'running',
  PAUSED: 'paused',
  ERROR: 'error',
};

// Orchestrator timing configuration
const TIMING = {
  TTS_CANCEL_WAIT: 150,        // ms to wait after canceling TTS
  RECOGNITION_START_WAIT: 200, // ms to wait before starting recognition
  RECOGNITION_RESUME_WAIT: 150,// ms to wait before resuming TTS after command
  CAMERA_READY_CHECK: 100,     // ms between camera readyState checks
  CAMERA_TIMEOUT: 10000,       // Max ms to wait for camera ready
  RECOGNITION_RETRY_DELAY: 1000, // ms before retry after recognition failure
};

/**
 * Main Orchestrator Hook
 * Coordinates all hands-free engines to work in harmony
 */
export function useEngineOrchestrator({
  enabled = false,
  videoRef,
  cameraStream,
  onSpeakStep,        // Callback to speak a step (TTS)
  onStopSpeaking,     // Callback to stop current speech
  onStepChange,       // Callback when gesture/voice triggers step change
}) {
  // Engine states
  const [cameraState, setCameraState] = useState(EngineState.IDLE);
  const [ttsState, setTtsState] = useState(EngineState.IDLE);
  const [recognitionState, setRecognitionState] = useState(EngineState.IDLE);
  const [gestureState, setGestureState] = useState(EngineState.IDLE);
  
  // Lock flags for microphone ownership
  const micLockRef = useRef(null); // 'tts' | 'recognition' | null
  const isTTSSpeakingRef = useRef(false);
  const isRecognitionActiveRef = useRef(false);
  const pendingRecognitionRef = useRef(false);
  
  // Recognition retry tracking
  const recognitionRetryCountRef = useRef(0);
  const maxRecognitionRetries = 1;
  
  // Cleanup tracking
  const isCleanedUpRef = useRef(false);
  
  /**
   * 1️⃣ CAMERA INITIALIZATION (GESTURE ENGINE)
   * - Request video-only stream (no audio)
   * - Force front camera
   * - Wait until video.readyState === 4
   */
  const initializeCamera = useCallback(async () => {
    if (!enabled || !videoRef?.current) {
      return false;
    }
    
    try {
      setCameraState(EngineState.STARTING);
      console.log('[Orchestrator] Starting camera initialization...');
      
      const video = videoRef.current;
      
      // Attach stream if we have one
      if (cameraStream) {
        video.srcObject = cameraStream;
      }
      
      // Wait for video to be ready (readyState === 4)
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Camera ready timeout'));
        }, TIMING.CAMERA_TIMEOUT);
        
        const checkReady = () => {
          if (video.readyState >= 4) { // HAVE_ENOUGH_DATA
            clearTimeout(timeout);
            resolve(true);
          } else {
            setTimeout(checkReady, TIMING.CAMERA_READY_CHECK);
          }
        };
        
        // Check immediately
        if (video.readyState >= 4) {
          clearTimeout(timeout);
          resolve(true);
        } else {
          video.addEventListener('loadeddata', () => {
            clearTimeout(timeout);
            resolve(true);
          }, { once: true });
          checkReady();
        }
      });
      
      setCameraState(EngineState.RUNNING);
      console.log('[Orchestrator] ✓ Camera ready (readyState:', video.readyState, ')');
      return true;
      
    } catch (error) {
      console.error('[Orchestrator] Camera initialization failed:', error.message);
      setCameraState(EngineState.ERROR);
      // Don't crash - keep recipe running
      return false;
    }
  }, [enabled, videoRef, cameraStream]);
  
  /**
   * 2️⃣ VOICE NARRATION CONTROL (TTS ENGINE)
   * - Stop any active speech recognition BEFORE speaking
   * - Cancel any previous TTS instance
   * - Wait 150ms
   * - Start narration
   */
  const speakWithOrchestration = useCallback(async (text, onComplete) => {
    if (!enabled || !text) return false;
    
    try {
      console.log('[Orchestrator] TTS: Preparing to speak...');
      
      // Step 1: Stop any active speech recognition (MIC OWNERSHIP)
      if (isRecognitionActiveRef.current) {
        console.log('[Orchestrator] TTS: Stopping recognition for TTS...');
        pauseRecognition();
        await wait(TIMING.TTS_CANCEL_WAIT);
      }
      
      // Step 2: Take mic ownership
      micLockRef.current = 'tts';
      
      // Step 3: Cancel any previous TTS
      onStopSpeaking?.();
      await wait(TIMING.TTS_CANCEL_WAIT);
      
      // Step 4: Start narration
      setTtsState(EngineState.RUNNING);
      isTTSSpeakingRef.current = true;
      
      console.log('[Orchestrator] TTS: Speaking...');
      
      // Call the TTS callback
      await onSpeakStep?.(text);
      
      // Note: Since browser TTS doesn't reliably fire 'end' events,
      // we need the caller to tell us when speech ends
      
      return true;
      
    } catch (error) {
      console.error('[Orchestrator] TTS error:', error.message);
      setTtsState(EngineState.ERROR);
      isTTSSpeakingRef.current = false;
      micLockRef.current = null;
      return false;
    }
  }, [enabled, onSpeakStep, onStopSpeaking]);
  
  /**
   * Signal that TTS has finished speaking
   * Called externally when speech ends
   */
  const onTTSComplete = useCallback(async () => {
    console.log('[Orchestrator] TTS: Speech complete');
    isTTSSpeakingRef.current = false;
    setTtsState(EngineState.IDLE);
    
    // Release mic lock
    if (micLockRef.current === 'tts') {
      micLockRef.current = null;
    }
    
    // Resume recognition if it was pending
    if (pendingRecognitionRef.current && !isCleanedUpRef.current) {
      await wait(TIMING.RECOGNITION_RESUME_WAIT);
      pendingRecognitionRef.current = false;
      resumeRecognition();
    }
  }, []);
  
  /**
   * Force stop TTS immediately
   */
  const stopTTS = useCallback(() => {
    console.log('[Orchestrator] TTS: Force stop');
    onStopSpeaking?.();
    isTTSSpeakingRef.current = false;
    setTtsState(EngineState.IDLE);
    
    if (micLockRef.current === 'tts') {
      micLockRef.current = null;
    }
  }, [onStopSpeaking]);
  
  /**
   * 3️⃣ VOICE COMMAND ENGINE (MIC OWNERSHIP RULE)
   * Start recognition ONLY when:
   * - TTS is fully stopped
   * - No previous recognition session is active
   */
  const recognitionRef = useRef(null);
  const recognitionEnabledRef = useRef(false);
  const recognitionCallbacksRef = useRef({
    onNext: null,
    onPrev: null,
    onTogglePlay: null,
    onRepeat: null,
  });
  
  const setRecognitionCallbacks = useCallback((callbacks) => {
    recognitionCallbacksRef.current = callbacks;
  }, []);
  
  /**
   * Safe start sequence for recognition
   * cancelTTS() → wait 200ms → startSpeechRecognition()
   */
  const startRecognition = useCallback(async () => {
    if (!enabled || isCleanedUpRef.current) return false;
    
    // Check if mic is locked by TTS
    if (isTTSSpeakingRef.current || micLockRef.current === 'tts') {
      console.log('[Orchestrator] Recognition: Waiting for TTS to complete...');
      pendingRecognitionRef.current = true;
      return false;
    }
    
    // Check if already active
    if (isRecognitionActiveRef.current) {
      console.log('[Orchestrator] Recognition: Already active');
      return true;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.log('[Orchestrator] Recognition: Not supported');
      return false;
    }
    
    try {
      setRecognitionState(EngineState.STARTING);
      console.log('[Orchestrator] Recognition: Starting...');
      
      // Step 1: Ensure TTS is cancelled
      stopTTS();
      await wait(TIMING.RECOGNITION_START_WAIT);
      
      // Step 2: Take mic ownership
      micLockRef.current = 'recognition';
      
      // Step 3: Create and start recognition
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      
      recognition.onresult = (event) => {
        if (isCleanedUpRef.current) return;
        
        const last = event.results.length - 1;
        const result = event.results[last];
        if (!result.isFinal) return;
        
        const transcript = result[0].transcript.toLowerCase().trim();
        const confidence = result[0].confidence;
        
        console.log(`[Orchestrator] Recognition: Heard "${transcript}" (${(confidence * 100).toFixed(0)}%)`);
        
        // Process command
        handleVoiceCommand(transcript, confidence);
      };
      
      recognition.onerror = (event) => {
        if (['no-speech', 'aborted'].includes(event.error)) return;
        console.log('[Orchestrator] Recognition error:', event.error);
        
        // Retry logic
        if (recognitionRetryCountRef.current < maxRecognitionRetries) {
          recognitionRetryCountRef.current++;
          setTimeout(() => {
            if (recognitionEnabledRef.current && !isCleanedUpRef.current) {
              resumeRecognition();
            }
          }, TIMING.RECOGNITION_RETRY_DELAY);
        } else {
          // Silently disable voice commands after max retries
          console.log('[Orchestrator] Recognition: Max retries reached, disabling');
          setRecognitionState(EngineState.ERROR);
        }
      };
      
      recognition.onend = () => {
        if (isCleanedUpRef.current) return;
        
        isRecognitionActiveRef.current = false;
        
        // Auto-restart if still enabled and not locked by TTS
        if (recognitionEnabledRef.current && !isTTSSpeakingRef.current && micLockRef.current !== 'tts') {
          setTimeout(() => {
            if (recognitionEnabledRef.current && !isCleanedUpRef.current) {
              resumeRecognition();
            }
          }, 300);
        }
      };
      
      recognitionRef.current = recognition;
      recognition.start();
      isRecognitionActiveRef.current = true;
      recognitionEnabledRef.current = true;
      recognitionRetryCountRef.current = 0;
      setRecognitionState(EngineState.RUNNING);
      
      console.log('[Orchestrator] ✓ Recognition active');
      return true;
      
    } catch (error) {
      console.error('[Orchestrator] Recognition start error:', error.message);
      setRecognitionState(EngineState.ERROR);
      return false;
    }
  }, [enabled, stopTTS]);
  
  /**
   * Handle recognized voice command
   */
  const handleVoiceCommand = useCallback(async (transcript, confidence) => {
    const callbacks = recognitionCallbacksRef.current;
    if (!callbacks) return;
    
    const minConfidence = 0.6;
    if (confidence < minConfidence) return;
    
    let command = null;
    
    // Match commands
    if (transcript.includes('next')) command = 'next';
    else if (transcript.includes('previous') || transcript.includes('back')) command = 'previous';
    else if (transcript.includes('repeat') || transcript.includes('again')) command = 'repeat';
    else if (transcript.includes('pause') || transcript.includes('stop')) command = 'pause';
    else if (transcript.includes('resume') || transcript.includes('play')) command = 'resume';
    
    if (!command) return;
    
    console.log(`[Orchestrator] Voice command: ${command}`);
    
    // Step 1: Stop recognition
    pauseRecognition();
    
    // Step 2: Wait
    await wait(TIMING.RECOGNITION_RESUME_WAIT);
    
    // Step 3: Execute command
    switch (command) {
      case 'next':
        callbacks.onNext?.();
        onStepChange?.('next');
        break;
      case 'previous':
        callbacks.onPrev?.();
        onStepChange?.('previous');
        break;
      case 'repeat':
        callbacks.onRepeat?.();
        break;
      case 'pause':
        callbacks.onTogglePlay?.();
        stopTTS();
        break;
      case 'resume':
        callbacks.onTogglePlay?.();
        break;
    }
  }, [onStepChange, stopTTS]);
  
  /**
   * Pause recognition (for TTS)
   */
  const pauseRecognition = useCallback(() => {
    if (recognitionRef.current && isRecognitionActiveRef.current) {
      try {
        recognitionRef.current.stop();
        isRecognitionActiveRef.current = false;
        setRecognitionState(EngineState.PAUSED);
        console.log('[Orchestrator] Recognition paused');
      } catch (e) {
        // Ignore
      }
    }
  }, []);
  
  /**
   * Resume recognition (after TTS)
   */
  const resumeRecognition = useCallback(() => {
    if (!recognitionEnabledRef.current || isCleanedUpRef.current) return;
    if (isTTSSpeakingRef.current || micLockRef.current === 'tts') {
      pendingRecognitionRef.current = true;
      return;
    }
    
    if (recognitionRef.current && !isRecognitionActiveRef.current) {
      try {
        recognitionRef.current.start();
        isRecognitionActiveRef.current = true;
        setRecognitionState(EngineState.RUNNING);
        console.log('[Orchestrator] Recognition resumed');
      } catch (e) {
        if (e.name !== 'InvalidStateError') {
          console.log('[Orchestrator] Resume error:', e.message);
        }
      }
    }
  }, []);
  
  /**
   * Stop recognition completely
   */
  const stopRecognition = useCallback(() => {
    recognitionEnabledRef.current = false;
    isRecognitionActiveRef.current = false;
    pendingRecognitionRef.current = false;
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      } catch (e) {
        // Ignore
      }
    }
    
    if (micLockRef.current === 'recognition') {
      micLockRef.current = null;
    }
    
    setRecognitionState(EngineState.IDLE);
    console.log('[Orchestrator] Recognition stopped');
  }, []);
  
  /**
   * 4️⃣ GESTURE → STEP NAVIGATION BRIDGE
   * After gesture navigation:
   * - cancelTTS()
   * - wait 150ms
   * - speak new step
   */
  const handleGestureNavigation = useCallback(async (direction) => {
    console.log(`[Orchestrator] Gesture navigation: ${direction}`);
    
    // Step 1: Cancel TTS
    stopTTS();
    
    // Step 2: Wait
    await wait(TIMING.TTS_CANCEL_WAIT);
    
    // Step 3: Notify step change (caller should then speak new step)
    onStepChange?.(direction);
  }, [stopTTS, onStepChange]);
  
  /**
   * Start gesture detection
   * Called after camera is ready
   */
  const startGestures = useCallback(() => {
    if (cameraState !== EngineState.RUNNING) {
      console.log('[Orchestrator] Cannot start gestures - camera not ready');
      return false;
    }
    
    setGestureState(EngineState.RUNNING);
    console.log('[Orchestrator] ✓ Gestures enabled');
    return true;
  }, [cameraState]);
  
  /**
   * Stop gesture detection
   */
  const stopGestures = useCallback(() => {
    setGestureState(EngineState.IDLE);
    console.log('[Orchestrator] Gestures stopped');
  }, []);
  
  /**
   * GLOBAL CLEANUP
   */
  const cleanup = useCallback(() => {
    console.log('[Orchestrator] Cleanup');
    isCleanedUpRef.current = true;
    
    stopRecognition();
    stopTTS();
    stopGestures();
    
    setCameraState(EngineState.IDLE);
    setTtsState(EngineState.IDLE);
    setRecognitionState(EngineState.IDLE);
    setGestureState(EngineState.IDLE);
    
    micLockRef.current = null;
    isTTSSpeakingRef.current = false;
    isRecognitionActiveRef.current = false;
    pendingRecognitionRef.current = false;
  }, [stopRecognition, stopTTS, stopGestures]);
  
  /**
   * RESET (for new session)
   */
  const reset = useCallback(() => {
    isCleanedUpRef.current = false;
    recognitionRetryCountRef.current = 0;
    micLockRef.current = null;
    isTTSSpeakingRef.current = false;
    isRecognitionActiveRef.current = false;
    pendingRecognitionRef.current = false;
    
    setCameraState(EngineState.IDLE);
    setTtsState(EngineState.IDLE);
    setRecognitionState(EngineState.IDLE);
    setGestureState(EngineState.IDLE);
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);
  
  // Cleanup when disabled
  useEffect(() => {
    if (!enabled) {
      cleanup();
    }
  }, [enabled, cleanup]);
  
  return {
    // Engine states
    cameraState,
    ttsState,
    recognitionState,
    gestureState,
    
    // State checks
    isTTSSpeaking: isTTSSpeakingRef.current,
    isRecognitionActive: isRecognitionActiveRef.current,
    isGestureReady: gestureState === EngineState.RUNNING && cameraState === EngineState.RUNNING,
    
    // Camera engine
    initializeCamera,
    
    // TTS engine
    speakWithOrchestration,
    onTTSComplete,
    stopTTS,
    
    // Recognition engine
    startRecognition,
    pauseRecognition,
    resumeRecognition,
    stopRecognition,
    setRecognitionCallbacks,
    
    // Gesture engine
    startGestures,
    stopGestures,
    handleGestureNavigation,
    
    // Lifecycle
    cleanup,
    reset,
  };
}

// Utility: Wait function
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default useEngineOrchestrator;
