/**
 * useEmotionalVoiceOrchestrator Hook
 * 
 * Orchestrates emotional narration throughout the cooking journey.
 * This hook ONLY sequences text and sends it to the existing voice system.
 * 
 * IMPORTANT: 
 * - Does NOT change any existing logic, UI, timers, or navigation
 * - Uses ONLY existing events and triggers
 * - All narration is optional - missing text skips silently
 * - Fully backward compatible
 */

import { useCallback, useRef, useEffect } from 'react';
import axios from 'axios';
import {
  OPENING_NARRATIONS,
  STEP_START_GUIDANCE,
  SENSORY_CUES,
  ENCOURAGEMENTS,
  WAITING_SUPPORT,
  MISTAKE_REASSURANCE,
  COMPLETION_TRANSITIONS,
  FINAL_NARRATIONS,
  getRandomVariation,
  resetSelectionTracking,
  getStepPosition,
} from '../lib/emotionalNarrationLibrary';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * Main orchestration hook
 * 
 * @param {Object} options
 * @param {boolean} options.enabled - Whether emotional narration is active
 * @param {string} options.mood - Current user mood (happy, calm, stressed, etc.)
 * @param {React.RefObject} options.audioRef - Reference to the audio element
 * @param {number} options.currentStep - Current step index (0-based)
 * @param {number} options.totalSteps - Total number of steps
 * @param {boolean} options.isPlaying - Whether cooking mode is actively playing
 * @param {Function} options.onNarrationStart - Callback when narration starts (optional)
 * @param {Function} options.onNarrationEnd - Callback when narration ends (optional)
 */
export function useEmotionalVoiceOrchestrator({
  enabled = true,
  mood = 'default',
  audioRef,
  currentStep = 0,
  totalSteps = 0,
  isPlaying = false,
  onNarrationStart,
  onNarrationEnd,
}) {
  // Track what we've narrated to avoid repetition
  const hasPlayedOpening = useRef(false);
  const lastNarratedStep = useRef(-1);
  const hasPlayedStepGuidance = useRef(false);
  const hasPlayedEncouragement = useRef(false);
  const isNarrating = useRef(false);
  const abortNarration = useRef(false);
  
  /**
   * Core function to speak emotional text through existing voice system
   * Uses the same /api/audio/step endpoint as regular step narration
   * 
   * SYNC FIX: Non-blocking, can be aborted, never queues
   */
  const speakEmotionalText = useCallback(async (text, priority = 'normal') => {
    if (!enabled || !text || !audioRef?.current) {
      return false;
    }
    
    // Skip if already narrating (don't queue to prevent drift)
    if (isNarrating.current && priority !== 'high') {
      return false;
    }
    
    // For high priority, stop current narration
    if (priority === 'high' && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    
    try {
      isNarrating.current = true;
      abortNarration.current = false;
      onNarrationStart?.();
      
      const token = localStorage.getItem('token');
      if (!token) return false;
      
      // Use existing step audio endpoint with emotional text
      const response = await axios.post(
        `${API}/api/audio/step`,
        {
          stepText: text,
          stepNumber: 0, // Emotional narration doesn't need step number
          totalSteps: 0,
          language: 'en'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Check if aborted during API call
      if (abortNarration.current) {
        return false;
      }
      
      if (response.data.success && audioRef.current) {
        const fullUrl = response.data.audioUrl.startsWith('http')
          ? response.data.audioUrl
          : `${API}${response.data.audioUrl}`;
        
        audioRef.current.src = fullUrl;
        audioRef.current.play().catch(() => {});
        
        // Don't await - let it play non-blocking
        return true;
      }
    } catch (error) {
      // Silently fail - emotional narration is optional
      console.debug('[EmotionalVoice] Narration skipped:', error.message);
    } finally {
      isNarrating.current = false;
      onNarrationEnd?.();
    }
    
    return false;
  }, [enabled, audioRef, onNarrationStart, onNarrationEnd]);
  
  // ========================================
  // TRIGGER 1: Opening Narration
  // Called when cooking mode first starts
  // ========================================
  const playOpeningNarration = useCallback(async () => {
    if (!enabled || hasPlayedOpening.current) return;
    
    const text = getRandomVariation(OPENING_NARRATIONS, null, mood);
    if (text) {
      hasPlayedOpening.current = true;
      await speakEmotionalText(text, 'high');
    }
  }, [enabled, mood, speakEmotionalText]);
  
  // ========================================
  // TRIGGER 2: Step Start Guidance
  // Called when step changes
  // ========================================
  const playStepStartGuidance = useCallback(async () => {
    if (!enabled || !isPlaying) return;
    if (currentStep === lastNarratedStep.current && hasPlayedStepGuidance.current) return;
    
    const position = getStepPosition(currentStep + 1, totalSteps);
    const text = getRandomVariation(STEP_START_GUIDANCE, position);
    
    if (text) {
      lastNarratedStep.current = currentStep;
      hasPlayedStepGuidance.current = true;
      hasPlayedEncouragement.current = false; // Reset for new step
      await speakEmotionalText(text);
    }
  }, [enabled, isPlaying, currentStep, totalSteps, speakEmotionalText]);
  
  // ========================================
  // TRIGGER 3: Sensory Cue
  // Called during natural pauses (optional)
  // ========================================
  const playSensoryCue = useCallback(async (type = 'general') => {
    if (!enabled || !isPlaying) return;
    
    const text = getRandomVariation(SENSORY_CUES, type);
    if (text) {
      await speakEmotionalText(text);
    }
  }, [enabled, isPlaying, speakEmotionalText]);
  
  // ========================================
  // TRIGGER 4: Encouragement
  // Called after step narration finishes
  // ========================================
  const playEncouragement = useCallback(async (type = 'gentle') => {
    if (!enabled || !isPlaying || hasPlayedEncouragement.current) return;
    
    const text = getRandomVariation(ENCOURAGEMENTS, type);
    if (text) {
      hasPlayedEncouragement.current = true;
      await speakEmotionalText(text);
    }
  }, [enabled, isPlaying, speakEmotionalText]);
  
  // ========================================
  // TRIGGER 5: Waiting/Timer Support
  // Called during timer periods
  // ========================================
  const playWaitingSupport = useCallback(async (phase = 'timer_start') => {
    if (!enabled) return;
    
    const text = getRandomVariation(WAITING_SUPPORT, phase);
    if (text) {
      await speakEmotionalText(text);
    }
  }, [enabled, speakEmotionalText]);
  
  // ========================================
  // TRIGGER 6: Completion Transition
  // Called when moving to next step
  // ========================================
  const playCompletionTransition = useCallback(async (type = 'smooth') => {
    if (!enabled || !isPlaying) return;
    
    const text = getRandomVariation(COMPLETION_TRANSITIONS, type);
    if (text) {
      await speakEmotionalText(text);
    }
  }, [enabled, isPlaying, speakEmotionalText]);
  
  // ========================================
  // TRIGGER 7: Mistake/Reassurance
  // Called on repeat, pause, or step back
  // ========================================
  const playReassurance = useCallback(async (event = 'general_mistake') => {
    if (!enabled) return;
    
    const text = getRandomVariation(MISTAKE_REASSURANCE, event);
    if (text) {
      await speakEmotionalText(text, 'high');
    }
  }, [enabled, speakEmotionalText]);
  
  // ========================================
  // TRIGGER 8: Final Reveal + Closing
  // Called when recipe is completed
  // ========================================
  const playFinalNarration = useCallback(async () => {
    if (!enabled) return;
    
    // Play reveal
    const revealText = getRandomVariation(FINAL_NARRATIONS, 'reveal');
    if (revealText) {
      await speakEmotionalText(revealText, 'high');
    }
    
    // Brief pause (handled by sequential playback)
    
    // Play closing
    const closingText = getRandomVariation(FINAL_NARRATIONS.closing, null, mood);
    if (closingText) {
      await speakEmotionalText(closingText, 'high');
    }
  }, [enabled, mood, speakEmotionalText]);
  
  // ========================================
  // Reset state when cooking session ends
  // ========================================
  const resetOrchestrator = useCallback(() => {
    hasPlayedOpening.current = false;
    lastNarratedStep.current = -1;
    hasPlayedStepGuidance.current = false;
    hasPlayedEncouragement.current = false;
    isNarrating.current = false;
    abortNarration.current = true;
    resetSelectionTracking();
  }, []);
  
  // Abort any pending emotional narration (call when step changes)
  const abortEmotionalNarration = useCallback(() => {
    abortNarration.current = true;
    isNarrating.current = false;
  }, []);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      resetOrchestrator();
    };
  }, [resetOrchestrator]);
  
  return {
    // Main trigger functions - call these from existing event handlers
    playOpeningNarration,
    playStepStartGuidance,
    playSensoryCue,
    playEncouragement,
    playWaitingSupport,
    playCompletionTransition,
    playReassurance,
    playFinalNarration,
    
    // Utility
    resetOrchestrator,
    abortEmotionalNarration, // Call when step changes to prevent drift
    speakEmotionalText, // For custom emotional text if needed
    
    // State (read-only)
    isNarrating: isNarrating.current,
  };
}

export default useEmotionalVoiceOrchestrator;
