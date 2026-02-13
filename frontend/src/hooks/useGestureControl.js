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
   * SYNC FIX: More tolerant of low FPS, better noise filtering
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
    const step = 5; // Sample every 5 pixels for better coverage
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
    
    // Need minimum motion to be considered (noise filter)
    if (totalMotion < CONFIG.MIN_MOTION_PIXELS) return null;
    
    // Determine dominant direction with higher confidence threshold
    const directionRatio = (rightMotion - leftMotion) / totalMotion;
    
    if (Math.abs(directionRatio) > CONFIG.DIRECTION_CONFIDENCE) {
      return {
        direction: directionRatio > 0 ? 'right' : 'left',
        confidence: Math.abs(directionRatio),
        totalMotion,
      };
    }
    
    return null;
  }, []);
  
  /**
   * Process gesture with STABLE DETECTION (500ms confirmation)
   * SYNC FIX: Requires consistent direction for 500ms before triggering
   * Only allows ONE step change per gesture cycle
   */
  const processGesture = useCallback((motion) => {
    const now = Date.now();
    const stable = stableDetectionRef.current;
    
    // Check voice priority cooldown
    if (now - lastVoiceTimeRef.current < CONFIG.VOICE_PRIORITY_COOLDOWN) {
      return;
    }
    
    // Check gesture cooldown (one change per gesture)
    if (now - lastGestureTimeRef.current < CONFIG.GESTURE_COOLDOWN) {
      return;
    }
    
    // SYNC FIX: Track stable detection over time
    if (motion === null) {
      // No motion - reset tracking
      if (stable.direction !== null) {
        stableDetectionRef.current = {
          direction: null,
          startTime: null,
          consecutiveFrames: 0,
          isConfirmed: false,
        };
      }
      return;
    }
    
    // Check if direction matches what we're tracking
    if (stable.direction === motion.direction) {
      // Same direction - increment consecutive frames
      stable.consecutiveFrames++;
      
      // Check if we've reached 500ms of stable detection
      const elapsed = now - stable.startTime;
      if (elapsed >= CONFIG.STABLE_DETECTION_MS && 
          stable.consecutiveFrames >= CONFIG.CONSECUTIVE_FRAMES_REQUIRED &&
          !stable.isConfirmed) {
        
        // CONFIRMED! Trigger the gesture
        stable.isConfirmed = true;
        const { onNext, onPrev } = callbacksRef.current;
        
        if (motion.direction === 'right' && onNext) {
          console.log('[Gesture] ✓ STABLE Swipe RIGHT → Next Step (500ms confirmed)');
          try {
            onNext();
          } catch (e) {
            console.error('[Gesture] Failed to trigger next:', e);
          }
        } else if (motion.direction === 'left' && onPrev) {
          console.log('[Gesture] ✓ STABLE Swipe LEFT → Previous Step (500ms confirmed)');
          try {
            onPrev();
          } catch (e) {
            console.error('[Gesture] Failed to trigger prev:', e);
          }
        }
        
        // Set cooldown - prevent rapid repeats
        lastGestureTimeRef.current = now;
        
        // Reset after trigger (require new gesture cycle)
        stableDetectionRef.current = {
          direction: null,
          startTime: null,
          consecutiveFrames: 0,
          isConfirmed: false,
        };
      }
    } else {
      // Different direction - start new tracking
      stableDetectionRef.current = {
        direction: motion.direction,
        startTime: now,
        consecutiveFrames: 1,
        isConfirmed: false,
      };
    }
  }, []);
  
  /**
   * Main detection loop - with web browser safety and low FPS tolerance
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
      console.log('[Gesture] Video ready, detection active (500ms debounce enabled)');
    }
    
    // LOW FPS TOLERANCE: Check frame timing
    const now = Date.now();
    const frameDelta = now - lastFrameTimeRef.current;
    lastFrameTimeRef.current = now;
    
    // If frame rate is unstable (> 200ms between frames), skip this frame
    if (frameDelta > 200 && prevFrameRef.current) {
      console.debug('[Gesture] Low FPS detected, skipping frame');
      animationFrameRef.current = setTimeout(() => detectGestures(), CONFIG.SAMPLE_INTERVAL);
      return;
    }
    
    try {
      // Draw current frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const currentFrame = context.getImageData(0, 0, canvas.width, canvas.height).data;
      
      // Analyze motion if we have a previous frame
      if (prevFrameRef.current) {
        const motion = analyzeMotion(currentFrame, prevFrameRef.current, canvas.width, canvas.height);
        processGesture(motion); // Handles null motion (resets tracking)
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
