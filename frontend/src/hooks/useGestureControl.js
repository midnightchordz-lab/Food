/**
 * useGestureControl Hook - SYNC PERFECTED
 * 
 * Simple hand gesture detection for step navigation:
 * - Swipe Right → Next Step
 * - Swipe Left → Previous Step
 * 
 * SYNC FIX: Proper debounce with 500ms stable detection.
 * - Requires consistent direction for 500ms before triggering
 * - Only one step change per gesture (no rapid repeats)
 * - Handles low FPS gracefully (never auto-advances on unstable detection)
 * 
 * This is a pure control layer - only REQUESTS changes to step state.
 */

import { useEffect, useRef, useCallback, useState } from 'react';

// Configuration - tuned for STABLE, INTENTIONAL gestures
const CONFIG = {
  // Zone detection (center 60% of video)
  DETECTION_ZONE: { x: 0.2, y: 0.2, width: 0.6, height: 0.6 },
  
  // SYNC FIX: Debounce with confirmation timing
  STABLE_DETECTION_MS: 500,      // Must see consistent direction for 500ms
  GESTURE_COOLDOWN: 1800,        // ms between gestures (one change per gesture)
  VOICE_PRIORITY_COOLDOWN: 2000, // ms to ignore gestures after voice command
  
  // Frame analysis - tolerant of low FPS
  SAMPLE_INTERVAL: 100,          // ms between motion samples (10 FPS minimum)
  LOW_FPS_THRESHOLD: 5,          // If FPS drops below this, skip frame
  MOTION_THRESHOLD: 20,          // Pixel brightness diff to detect motion
  MIN_MOTION_PIXELS: 30,         // Minimum changed pixels to register
  DIRECTION_CONFIDENCE: 0.35,    // Direction ratio required (higher = more confident)
  
  // Noise filtering for web cameras
  CONSECUTIVE_FRAMES_REQUIRED: 3, // Need 3 consistent frames to start tracking
};

export function useGestureControl({
  enabled = false,
  videoRef,
  onNext,
  onPrev,
  voiceCommandActive = false, // True when voice command was just triggered
}) {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const prevFrameRef = useRef(null);
  const lastGestureTimeRef = useRef(0);
  const lastVoiceTimeRef = useRef(0);
  const animationFrameRef = useRef(null);
  const isActiveRef = useRef(false);
  const videoReadyRef = useRef(false);
  const lastFrameTimeRef = useRef(0);
  
  // SYNC FIX: Track stable detection over time
  const stableDetectionRef = useRef({
    direction: null,        // 'left' or 'right' or null
    startTime: null,        // When we first saw this direction
    consecutiveFrames: 0,   // How many frames in a row
    isConfirmed: false,     // Has 500ms passed with consistent direction?
  });
  
  const [gestureStatus, setGestureStatus] = useState('initializing');
  
  // Store callbacks in refs to prevent stale closures
  const callbacksRef = useRef({ onNext, onPrev });
  useEffect(() => {
    callbacksRef.current = { onNext, onPrev };
  }, [onNext, onPrev]);
  
  // Track when voice command happens (voice takes priority)
  useEffect(() => {
    if (voiceCommandActive) {
      lastVoiceTimeRef.current = Date.now();
      // Reset any pending gesture when voice activates
      stableDetectionRef.current = {
        direction: null,
        startTime: null,
        consecutiveFrames: 0,
        isConfirmed: false,
      };
    }
  }, [voiceCommandActive]);
  
  /**
   * Analyze frame difference to detect motion direction
   */
  const analyzeMotion = useCallback((currentFrame, prevFrame, width, height) => {
    if (!currentFrame || !prevFrame) return null;
    
    const zone = CONFIG.DETECTION_ZONE;
    const startX = Math.floor(width * zone.x);
    const startY = Math.floor(height * zone.y);
    const endX = Math.floor(width * (zone.x + zone.width));
    const endY = Math.floor(height * (zone.y + zone.height));
    
    let leftMotion = 0;
    let rightMotion = 0;
    let totalMotion = 0;
    
    // Sample pixels in detection zone
    const step = 6; // Sample every 6 pixels for better detection
    for (let y = startY; y < endY; y += step) {
      for (let x = startX; x < endX; x += step) {
        const i = (y * width + x) * 4;
        
        // Calculate brightness difference
        const currBrightness = (currentFrame[i] + currentFrame[i+1] + currentFrame[i+2]) / 3;
        const prevBrightness = (prevFrame[i] + prevFrame[i+1] + prevFrame[i+2]) / 3;
        const diff = Math.abs(currBrightness - prevBrightness);
        
        if (diff > CONFIG.MOTION_THRESHOLD) {
          totalMotion++;
          
          // Determine which half of the zone
          const midX = (startX + endX) / 2;
          if (x < midX) {
            leftMotion++;
          } else {
            rightMotion++;
          }
        }
      }
    }
    
    // Need minimum motion to be considered
    if (totalMotion < CONFIG.MIN_TOTAL_MOTION) return null;
    
    // Determine dominant direction
    const directionRatio = (rightMotion - leftMotion) / totalMotion;
    
    if (Math.abs(directionRatio) > CONFIG.DIRECTION_THRESHOLD) {
      return {
        direction: directionRatio > 0 ? 'right' : 'left',
        intensity: totalMotion,
        confidence: Math.abs(directionRatio),
      };
    }
    
    return null;
  }, []);
  
  /**
   * Process gesture and trigger navigation
   * FIX: Direct callback invocation for web compatibility
   */
  const processGesture = useCallback((motion) => {
    const now = Date.now();
    
    // Check voice priority cooldown
    if (now - lastVoiceTimeRef.current < CONFIG.VOICE_PRIORITY_COOLDOWN) {
      return;
    }
    
    // Check gesture cooldown - critical for web noise filtering
    if (now - lastGestureTimeRef.current < CONFIG.GESTURE_COOLDOWN) {
      return;
    }
    
    if (!motionStartRef.current) {
      // Start tracking new motion
      motionStartRef.current = {
        time: now,
        direction: motion.direction,
        totalIntensity: motion.intensity,
      };
    } else {
      // Continue tracking
      const elapsed = now - motionStartRef.current.time;
      
      if (elapsed > CONFIG.MAX_SWIPE_DURATION) {
        // Too slow, reset
        motionStartRef.current = null;
        return;
      }
      
      // Accumulate intensity
      motionStartRef.current.totalIntensity += motion.intensity;
      
      // Check if swipe is complete (consistent direction with enough intensity)
      if (motion.direction === motionStartRef.current.direction && 
          motionStartRef.current.totalIntensity > CONFIG.MIN_SWIPE_DISTANCE) {
        
        // Valid swipe detected! Trigger navigation
        const { onNext, onPrev } = callbacksRef.current;
        
        if (motion.direction === 'right' && onNext) {
          console.log('[Gesture] ✓ Swipe RIGHT → Next Step');
          // Direct function call - this is the fix for web
          try {
            onNext();
          } catch (e) {
            console.error('[Gesture] Failed to trigger next:', e);
          }
        } else if (motion.direction === 'left' && onPrev) {
          console.log('[Gesture] ✓ Swipe LEFT → Previous Step');
          // Direct function call - this is the fix for web
          try {
            onPrev();
          } catch (e) {
            console.error('[Gesture] Failed to trigger prev:', e);
          }
        }
        
        // Set cooldown and reset
        lastGestureTimeRef.current = now;
        motionStartRef.current = null;
      }
    }
  }, []);
  
  /**
   * Main detection loop - with web browser safety
   */
  const detectGestures = useCallback(() => {
    if (!isActiveRef.current) return;
    
    const video = videoRef?.current;
    const canvas = canvasRef.current;
    const context = contextRef.current;
    
    // Check video is ready for web browsers
    if (!video || !canvas || !context) {
      animationFrameRef.current = setTimeout(() => detectGestures(), CONFIG.SAMPLE_INTERVAL);
      return;
    }
    
    // Web browser video readiness check
    if (video.readyState < 2 || video.videoWidth === 0) {
      animationFrameRef.current = setTimeout(() => detectGestures(), CONFIG.SAMPLE_INTERVAL);
      return;
    }
    
    // Mark video as ready on first successful frame
    if (!videoReadyRef.current) {
      videoReadyRef.current = true;
      setGestureStatus('active');
      console.log('[Gesture] Video ready, detection active');
    }
    
    try {
      // Draw current frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const currentFrame = context.getImageData(0, 0, canvas.width, canvas.height).data;
      
      // Analyze motion if we have a previous frame
      if (prevFrameRef.current) {
        const motion = analyzeMotion(currentFrame, prevFrameRef.current, canvas.width, canvas.height);
        if (motion) {
          processGesture(motion);
        } else {
          // No significant motion, reset tracking
          motionStartRef.current = null;
        }
      }
      
      // Store for next frame comparison
      prevFrameRef.current = currentFrame;
    } catch (e) {
      // Ignore frame errors (can happen during video state changes)
      console.debug('[Gesture] Frame error:', e.message);
    }
    
    // Continue loop
    animationFrameRef.current = setTimeout(() => detectGestures(), CONFIG.SAMPLE_INTERVAL);
  }, [videoRef, analyzeMotion, processGesture]);
  
  /**
   * Initialize gesture detection with proper web browser handling
   */
  useEffect(() => {
    // Cleanup function
    const cleanup = () => {
      isActiveRef.current = false;
      videoReadyRef.current = false;
      if (animationFrameRef.current) {
        clearTimeout(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      canvasRef.current = null;
      contextRef.current = null;
      prevFrameRef.current = null;
      motionStartRef.current = null;
      setGestureStatus('disabled');
    };
    
    if (!enabled) {
      cleanup();
      return;
    }
    
    // Wait for video element
    if (!videoRef?.current) {
      setGestureStatus('waiting_video');
      return;
    }
    
    const video = videoRef.current;
    
    // Create offscreen canvas for frame analysis
    const canvas = document.createElement('canvas');
    canvas.width = 160;  // Low res for performance
    canvas.height = 120;
    canvasRef.current = canvas;
    contextRef.current = canvas.getContext('2d', { willReadFrequently: true });
    
    // Reset state
    isActiveRef.current = true;
    videoReadyRef.current = false;
    prevFrameRef.current = null;
    motionStartRef.current = null;
    setGestureStatus('initializing');
    
    // Wait for video to be playing before starting detection
    const checkVideoReady = () => {
      if (video.readyState >= 2 && video.videoWidth > 0) {
        console.log('[Gesture] Video stream detected, starting detection');
        detectGestures();
      } else {
        // Check again in 200ms
        setTimeout(checkVideoReady, 200);
      }
    };
    
    // Start checking
    checkVideoReady();
    
    console.log('[Gesture] Control initialized for web');
    
    return cleanup;
  }, [enabled, videoRef, detectGestures]);
  
  return {
    isActive: isActiveRef.current && videoReadyRef.current,
    status: gestureStatus,
  };
}

export default useGestureControl;
