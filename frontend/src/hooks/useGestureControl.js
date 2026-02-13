/**
 * useGestureControl Hook
 * 
 * Simple hand gesture detection for step navigation:
 * - Swipe Right → Next Step
 * - Swipe Left → Previous Step
 * 
 * Uses the existing camera stream - no new permissions needed.
 * This is a pure control layer - only triggers callbacks, no side effects.
 * 
 * IMPORTANT: This does NOT use complex AI or object detection.
 * It simply tracks general motion direction in the center zone.
 */

import { useEffect, useRef, useCallback } from 'react';

// Configuration
const CONFIG = {
  // Zone detection (center 60% of video)
  DETECTION_ZONE: { x: 0.2, y: 0.2, width: 0.6, height: 0.6 },
  
  // Motion thresholds
  MIN_SWIPE_DISTANCE: 80,      // Minimum pixels for a swipe
  MIN_SWIPE_SPEED: 200,        // Minimum pixels/second
  MAX_SWIPE_DURATION: 500,     // Maximum ms for a swipe gesture
  
  // Cooldowns
  GESTURE_COOLDOWN: 1500,      // ms between gestures (prevent accidental)
  VOICE_PRIORITY_COOLDOWN: 2000, // ms to ignore gestures after voice command
  
  // Frame analysis
  SAMPLE_INTERVAL: 100,        // ms between motion samples
  MOTION_THRESHOLD: 30,        // Pixel difference to detect motion
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
  const motionStartRef = useRef(null);
  const lastGestureTimeRef = useRef(0);
  const lastVoiceTimeRef = useRef(0);
  const animationFrameRef = useRef(null);
  const isActiveRef = useRef(false);
  
  // Store callbacks in refs
  const callbacksRef = useRef({ onNext, onPrev });
  useEffect(() => {
    callbacksRef.current = { onNext, onPrev };
  }, [onNext, onPrev]);
  
  // Track when voice command happens (voice takes priority)
  useEffect(() => {
    if (voiceCommandActive) {
      lastVoiceTimeRef.current = Date.now();
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
    const step = 8; // Sample every 8 pixels for performance
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
    if (totalMotion < 50) return null;
    
    // Determine dominant direction
    const directionRatio = (rightMotion - leftMotion) / totalMotion;
    
    if (Math.abs(directionRatio) > 0.3) {
      return {
        direction: directionRatio > 0 ? 'right' : 'left',
        intensity: totalMotion,
        confidence: Math.abs(directionRatio),
      };
    }
    
    return null;
  }, []);
  
  /**
   * Process gesture based on motion tracking
   */
  const processGesture = useCallback((motion) => {
    const now = Date.now();
    
    // Check voice priority cooldown
    if (now - lastVoiceTimeRef.current < CONFIG.VOICE_PRIORITY_COOLDOWN) {
      return;
    }
    
    // Check gesture cooldown
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
        
        // Valid swipe detected!
        const { onNext, onPrev } = callbacksRef.current;
        
        if (motion.direction === 'right') {
          console.log('[Gesture] Swipe RIGHT detected - Next Step');
          onNext?.();
        } else {
          console.log('[Gesture] Swipe LEFT detected - Previous Step');
          onPrev?.();
        }
        
        lastGestureTimeRef.current = now;
        motionStartRef.current = null;
      }
    }
  }, []);
  
  /**
   * Main detection loop
   */
  const detectGestures = useCallback(() => {
    if (!isActiveRef.current) return;
    
    const video = videoRef?.current;
    const canvas = canvasRef.current;
    const context = contextRef.current;
    
    if (!video || !canvas || !context || video.readyState < 2) {
      animationFrameRef.current = setTimeout(() => detectGestures(), CONFIG.SAMPLE_INTERVAL);
      return;
    }
    
    try {
      // Draw current frame
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const currentFrame = context.getImageData(0, 0, canvas.width, canvas.height).data;
      
      // Analyze motion
      if (prevFrameRef.current) {
        const motion = analyzeMotion(currentFrame, prevFrameRef.current, canvas.width, canvas.height);
        if (motion) {
          processGesture(motion);
        } else {
          // No significant motion, reset tracking
          motionStartRef.current = null;
        }
      }
      
      // Store for next frame
      prevFrameRef.current = currentFrame;
    } catch (e) {
      // Ignore frame errors (can happen during video state changes)
    }
    
    // Continue loop
    animationFrameRef.current = setTimeout(() => detectGestures(), CONFIG.SAMPLE_INTERVAL);
  }, [videoRef, analyzeMotion, processGesture]);
  
  /**
   * Initialize gesture detection
   */
  useEffect(() => {
    if (!enabled || !videoRef?.current) {
      isActiveRef.current = false;
      return;
    }
    
    // Create offscreen canvas for frame analysis
    const canvas = document.createElement('canvas');
    canvas.width = 160;  // Low res for performance
    canvas.height = 120;
    canvasRef.current = canvas;
    contextRef.current = canvas.getContext('2d', { willReadFrequently: true });
    
    isActiveRef.current = true;
    prevFrameRef.current = null;
    motionStartRef.current = null;
    
    // Start detection loop
    detectGestures();
    
    console.log('[Gesture] Control initialized');
    
    return () => {
      isActiveRef.current = false;
      if (animationFrameRef.current) {
        clearTimeout(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      canvasRef.current = null;
      contextRef.current = null;
      prevFrameRef.current = null;
    };
  }, [enabled, videoRef, detectGestures]);
  
  return {
    isActive: isActiveRef.current,
  };
}

export default useGestureControl;
