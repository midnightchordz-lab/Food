/**
 * useAIObserver Hook
 * 
 * AI Observer layer for future cooking detection capabilities.
 * This is a PASSIVE SENSOR LAYER that:
 * - Observes the camera stream
 * - Can run lightweight on-device vision analysis
 * - Emits NON-INVASIVE events (for future use)
 * 
 * CRITICAL: This module does NOT:
 * - Trigger any cooking actions
 * - Modify recipe state, timers, or navigation
 * - Control playback or voice narration
 * - Make any decisions that affect user experience
 * 
 * Events emitted are for FUTURE READINESS only.
 * In this phase, event callbacks are optional and do nothing by default.
 */

import { useEffect, useRef, useCallback, useState } from 'react';

// Observer event types (for future AI integration)
export const ObserverEvents = {
  MOTION_DETECTED: 'motionDetected',
  MOTION_STOPPED: 'motionStopped',
  POSSIBLE_STEP_COMPLETION: 'possibleStepCompletion',
  HANDS_IN_FRAME: 'handsInFrame',
  HANDS_OUT_OF_FRAME: 'handsOutOfFrame',
  COOKING_ACTIVITY: 'cookingActivity',
  IDLE_DETECTED: 'idleDetected',
};

export function useAIObserver({
  enabled = false,
  videoElement = null,
  // Event callbacks (all optional, no-op by default)
  onMotionDetected = null,
  onMotionStopped = null,
  onPossibleStepCompletion = null,
  onEvent = null, // Generic event handler
}) {
  const [isObserving, setIsObserving] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const previousFrameRef = useRef(null);
  const animationFrameRef = useRef(null);
  const motionStateRef = useRef({ isMoving: false, idleFrames: 0 });

  // Configuration for motion detection
  const CONFIG = {
    MOTION_THRESHOLD: 30,        // Pixel difference threshold
    MOTION_PERCENTAGE: 0.5,      // % of pixels that need to change
    IDLE_FRAME_THRESHOLD: 90,    // ~3 seconds at 30fps
    ANALYSIS_INTERVAL: 100,      // Analyze every 100ms (not every frame)
    SAMPLE_SIZE: 100,            // Sample grid size for performance
  };

  // Emit an observer event (passive, non-invasive)
  const emitEvent = useCallback((eventType, data = {}) => {
    const event = {
      type: eventType,
      timestamp: Date.now(),
      data,
    };
    
    setLastEvent(event);
    
    // Log for debugging (can be removed in production)
    console.log(`[AIObserver] Event: ${eventType}`, data);

    // Call specific handlers if provided
    if (eventType === ObserverEvents.MOTION_DETECTED && onMotionDetected) {
      onMotionDetected(event);
    } else if (eventType === ObserverEvents.MOTION_STOPPED && onMotionStopped) {
      onMotionStopped(event);
    } else if (eventType === ObserverEvents.POSSIBLE_STEP_COMPLETION && onPossibleStepCompletion) {
      onPossibleStepCompletion(event);
    }

    // Call generic handler if provided
    if (onEvent) {
      onEvent(event);
    }
  }, [onMotionDetected, onMotionStopped, onPossibleStepCompletion, onEvent]);

  // Simple motion detection using frame differencing
  const detectMotion = useCallback((currentImageData) => {
    if (!previousFrameRef.current) {
      previousFrameRef.current = currentImageData;
      return false;
    }

    const current = currentImageData.data;
    const previous = previousFrameRef.current.data;
    const pixelCount = current.length / 4;
    
    let changedPixels = 0;
    const sampleStep = Math.floor(pixelCount / CONFIG.SAMPLE_SIZE);

    // Sample pixels for performance
    for (let i = 0; i < pixelCount; i += sampleStep) {
      const idx = i * 4;
      const rDiff = Math.abs(current[idx] - previous[idx]);
      const gDiff = Math.abs(current[idx + 1] - previous[idx + 1]);
      const bDiff = Math.abs(current[idx + 2] - previous[idx + 2]);
      
      const avgDiff = (rDiff + gDiff + bDiff) / 3;
      
      if (avgDiff > CONFIG.MOTION_THRESHOLD) {
        changedPixels++;
      }
    }

    previousFrameRef.current = currentImageData;

    const motionPercentage = (changedPixels / CONFIG.SAMPLE_SIZE) * 100;
    return motionPercentage > CONFIG.MOTION_PERCENTAGE;
  }, [CONFIG.MOTION_THRESHOLD, CONFIG.MOTION_PERCENTAGE, CONFIG.SAMPLE_SIZE]);

  // Main frame analysis loop
  const analyzeFrame = useCallback(() => {
    if (!canvasRef.current || !contextRef.current || !videoElement) {
      return;
    }

    try {
      // Draw current video frame to canvas
      contextRef.current.drawImage(
        videoElement,
        0, 0,
        canvasRef.current.width,
        canvasRef.current.height
      );

      // Get image data for analysis
      const imageData = contextRef.current.getImageData(
        0, 0,
        canvasRef.current.width,
        canvasRef.current.height
      );

      // Detect motion
      const hasMotion = detectMotion(imageData);
      const motionState = motionStateRef.current;

      if (hasMotion) {
        motionState.idleFrames = 0;
        
        if (!motionState.isMoving) {
          motionState.isMoving = true;
          emitEvent(ObserverEvents.MOTION_DETECTED, {
            confidence: 'low', // Basic detection, low confidence
          });
        }
      } else {
        motionState.idleFrames++;
        
        if (motionState.isMoving && motionState.idleFrames > 10) {
          motionState.isMoving = false;
          emitEvent(ObserverEvents.MOTION_STOPPED, {
            idleDuration: motionState.idleFrames * CONFIG.ANALYSIS_INTERVAL,
          });
        }

        // Possible step completion after extended idle
        if (motionState.idleFrames === CONFIG.IDLE_FRAME_THRESHOLD) {
          emitEvent(ObserverEvents.POSSIBLE_STEP_COMPLETION, {
            reason: 'extended_idle',
            idleDuration: motionState.idleFrames * CONFIG.ANALYSIS_INTERVAL,
            confidence: 'very_low', // Just a hint, not actionable
          });
        }
      }
    } catch (err) {
      // Fail silently - frame analysis errors shouldn't affect cooking
      console.log('[AIObserver] Frame analysis error:', err.message);
    }
  }, [videoElement, detectMotion, emitEvent, CONFIG.ANALYSIS_INTERVAL, CONFIG.IDLE_FRAME_THRESHOLD]);

  // Start observation loop
  const startObserving = useCallback(() => {
    if (!videoElement || isObserving) return;

    // Create offscreen canvas for analysis
    canvasRef.current = document.createElement('canvas');
    canvasRef.current.width = 160;  // Low res for performance
    canvasRef.current.height = 120;
    contextRef.current = canvasRef.current.getContext('2d', {
      willReadFrequently: true,
    });

    setIsObserving(true);
    console.log('[AIObserver] Started observing');

    // Analysis loop with interval (not every frame)
    let lastAnalysis = 0;
    const loop = (timestamp) => {
      if (timestamp - lastAnalysis >= CONFIG.ANALYSIS_INTERVAL) {
        analyzeFrame();
        lastAnalysis = timestamp;
      }
      animationFrameRef.current = requestAnimationFrame(loop);
    };
    
    animationFrameRef.current = requestAnimationFrame(loop);
  }, [videoElement, isObserving, analyzeFrame, CONFIG.ANALYSIS_INTERVAL]);

  // Stop observation
  const stopObserving = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    previousFrameRef.current = null;
    motionStateRef.current = { isMoving: false, idleFrames: 0 };
    canvasRef.current = null;
    contextRef.current = null;
    
    setIsObserving(false);
    setLastEvent(null);
    console.log('[AIObserver] Stopped observing');
  }, []);

  // Main effect - start/stop based on enabled and video element
  useEffect(() => {
    if (enabled && videoElement) {
      // Wait for video to be ready
      const checkReady = () => {
        if (videoElement.readyState >= 2) {
          startObserving();
        } else {
          videoElement.addEventListener('loadeddata', startObserving, { once: true });
        }
      };
      checkReady();
    } else {
      stopObserving();
    }

    return () => {
      stopObserving();
    };
  }, [enabled, videoElement, startObserving, stopObserving]);

  return {
    isObserving,
    lastEvent,
    // Expose event types for external use
    events: ObserverEvents,
  };
}

export default useAIObserver;
