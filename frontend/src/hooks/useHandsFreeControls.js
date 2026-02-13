/**
 * useHandsFreeControls Hook
 * 
 * Reliable hands-free voice control for Live Cooking:
 * - "next step" / "next" / "forward" → Next Step
 * - "previous step" / "back" / "go back" → Previous Step
 * - "repeat step" / "repeat" / "again" → Repeat Current Step
 * - "pause" / "stop" → Pause Voice
 * - "resume" / "play" / "continue" → Resume Voice
 * 
 * Features:
 * - High confidence threshold (ignores unclear speech)
 * - Cooldown between commands (prevents double triggers)
 * - Continuous listening with auto-restart
 * - Silent failure if browser doesn't support
 * 
 * This is a pure control layer - only triggers existing callbacks.
 */

import { useEffect, useRef, useCallback, useState } from 'react';

// Check for browser support
const SpeechRecognition = typeof window !== 'undefined' 
  ? window.SpeechRecognition || window.webkitSpeechRecognition 
  : null;

// Command definitions with variations and confidence requirements
const VOICE_COMMANDS = {
  next: {
    phrases: ['next step', 'next', 'forward', 'go forward', 'move forward', 'continue'],
    action: 'next',
    minConfidence: 0.7,
  },
  previous: {
    phrases: ['previous step', 'previous', 'back', 'go back', 'move back', 'last step'],
    action: 'previous',
    minConfidence: 0.7,
  },
  repeat: {
    phrases: ['repeat step', 'repeat', 'again', 'say again', 'one more time', 'repeat that'],
    action: 'repeat',
    minConfidence: 0.7,
  },
  pause: {
    phrases: ['pause', 'stop', 'hold', 'wait', 'pause voice'],
    action: 'pause',
    minConfidence: 0.75,
  },
  resume: {
    phrases: ['resume', 'play', 'continue', 'start', 'go', 'resume voice'],
    action: 'resume',
    minConfidence: 0.75,
  },
};

// Configuration
const CONFIG = {
  COMMAND_COOLDOWN: 1500,      // ms between commands (prevents double triggers)
  RESTART_DELAY: 300,          // ms before restarting recognition
  MAX_RESTART_ATTEMPTS: 3,     // Max consecutive restart attempts
  RESTART_BACKOFF: 1000,       // ms backoff after max attempts
};

export function useHandsFreeControls({
  enabled = false,
  onNext,
  onPrev,
  onTogglePlay,
  onRepeat,
  isPlaying = false,
}) {
  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const lastCommandTimeRef = useRef(0);
  const restartAttemptsRef = useRef(0);
  const [lastCommand, setLastCommand] = useState(null);
  const [voiceCommandActive, setVoiceCommandActive] = useState(false);
  
  // Store callbacks in refs to avoid stale closures
  const callbacksRef = useRef({
    onNext,
    onPrev,
    onTogglePlay,
    onRepeat,
    isPlaying,
  });

  // Update callbacks ref whenever they change
  useEffect(() => {
    callbacksRef.current = {
      onNext,
      onPrev,
      onTogglePlay,
      onRepeat,
      isPlaying,
    };
  }, [onNext, onPrev, onTogglePlay, onRepeat, isPlaying]);

  /**
   * Match spoken text to commands with confidence scoring
   */
  const matchCommand = useCallback((transcript, confidence) => {
    const text = transcript.toLowerCase().trim();
    
    for (const [, command] of Object.entries(VOICE_COMMANDS)) {
      // Check if confidence meets minimum requirement
      if (confidence < command.minConfidence) {
        continue;
      }
      
      // Check for exact phrase matches first (higher reliability)
      for (const phrase of command.phrases) {
        if (text === phrase || text.includes(phrase)) {
          return {
            action: command.action,
            confidence,
            matchedPhrase: phrase,
          };
        }
      }
    }
    
    return null;
  }, []);

  /**
   * Execute matched command
   */
  const executeCommand = useCallback((match) => {
    const now = Date.now();
    
    // Check cooldown
    if (now - lastCommandTimeRef.current < CONFIG.COMMAND_COOLDOWN) {
      console.log('[HandsFree] Command ignored (cooldown)');
      return;
    }
    
    const { onNext, onPrev, onTogglePlay, onRepeat, isPlaying } = callbacksRef.current;
    
    let executed = false;
    
    switch (match.action) {
      case 'next':
        console.log('[HandsFree] ✓ Voice: NEXT STEP');
        onNext?.();
        executed = true;
        break;
        
      case 'previous':
        console.log('[HandsFree] ✓ Voice: PREVIOUS STEP');
        onPrev?.();
        executed = true;
        break;
        
      case 'repeat':
        console.log('[HandsFree] ✓ Voice: REPEAT STEP');
        onRepeat?.();
        executed = true;
        break;
        
      case 'pause':
        if (isPlaying) {
          console.log('[HandsFree] ✓ Voice: PAUSE');
          onTogglePlay?.();
          executed = true;
        }
        break;
        
      case 'resume':
        if (!isPlaying) {
          console.log('[HandsFree] ✓ Voice: RESUME');
          onTogglePlay?.();
          executed = true;
        }
        break;
        
      default:
        break;
    }
    
    if (executed) {
      lastCommandTimeRef.current = now;
      setLastCommand(match.action);
      
      // Signal that voice command was triggered (for gesture priority)
      setVoiceCommandActive(true);
      setTimeout(() => setVoiceCommandActive(false), 100);
    }
  }, []);

  /**
   * Handle speech recognition result
   */
  const handleResult = useCallback((event) => {
    try {
      const last = event.results.length - 1;
      const result = event.results[last];
      
      if (!result.isFinal) return; // Only process final results
      
      const transcript = result[0].transcript;
      const confidence = result[0].confidence;
      
      console.log(`[HandsFree] Heard: "${transcript}" (confidence: ${(confidence * 100).toFixed(0)}%)`);
      
      // Try to match command
      const match = matchCommand(transcript, confidence);
      
      if (match) {
        console.log(`[HandsFree] Matched: ${match.action} (phrase: "${match.matchedPhrase}")`);
        executeCommand(match);
      }
      
      // Reset restart counter on successful recognition
      restartAttemptsRef.current = 0;
    } catch (e) {
      console.log('[HandsFree] Result processing error:', e.message);
    }
  }, [matchCommand, executeCommand]);

  /**
   * Handle recognition end - auto-restart if still enabled
   */
  const handleEnd = useCallback(() => {
    if (!isListeningRef.current) return;
    
    // Check restart attempts
    if (restartAttemptsRef.current >= CONFIG.MAX_RESTART_ATTEMPTS) {
      console.log('[HandsFree] Max restart attempts reached, backing off...');
      setTimeout(() => {
        restartAttemptsRef.current = 0;
        if (isListeningRef.current && recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.log('[HandsFree] Could not restart after backoff');
          }
        }
      }, CONFIG.RESTART_BACKOFF);
      return;
    }
    
    // Normal restart
    setTimeout(() => {
      if (isListeningRef.current && recognitionRef.current) {
        try {
          recognitionRef.current.start();
          restartAttemptsRef.current++;
          console.log('[HandsFree] Voice recognition restarted');
        } catch (e) {
          if (e.name === 'InvalidStateError') {
            // Recognition already running, ignore
          } else {
            console.log('[HandsFree] Restart error:', e.message);
          }
        }
      }
    }, CONFIG.RESTART_DELAY);
  }, []);

  /**
   * Handle recognition error
   */
  const handleError = useCallback((event) => {
    // These errors are normal and expected
    if (['no-speech', 'aborted', 'audio-capture'].includes(event.error)) {
      return;
    }
    console.log('[HandsFree] Recognition error:', event.error);
  }, []);

  /**
   * Cleanup function
   */
  const cleanup = useCallback(() => {
    isListeningRef.current = false;
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
      } catch (e) {
        // Ignore cleanup errors
      }
      recognitionRef.current = null;
    }
  }, []);

  /**
   * Main effect - start/stop based on enabled prop
   */
  useEffect(() => {
    if (!enabled) {
      cleanup();
      return;
    }
    
    if (!SpeechRecognition) {
      console.log('[HandsFree] SpeechRecognition not supported');
      return;
    }
    
    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true; // Get interim for faster response
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 3; // More alternatives for better matching
      
      recognition.onresult = handleResult;
      recognition.onerror = handleError;
      recognition.onend = handleEnd;
      
      recognitionRef.current = recognition;
      isListeningRef.current = true;
      restartAttemptsRef.current = 0;
      
      recognition.start();
      console.log('[HandsFree] Voice commands ACTIVE');
      
    } catch (e) {
      console.log('[HandsFree] Could not initialize:', e.message);
    }
    
    return cleanup;
  }, [enabled, handleResult, handleError, handleEnd, cleanup]);

  return {
    isSupported: !!SpeechRecognition,
    isListening: isListeningRef.current,
    lastCommand,
    voiceCommandActive, // Expose for gesture priority
  };
}

export default useHandsFreeControls;
