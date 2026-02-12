/**
 * useHandsFreeControls Hook
 * 
 * Provides hands-free control for Live Cooking via:
 * - Voice commands: "next", "pause", "play", "repeat"
 * - Double clap gesture detection
 * 
 * Fails silently if microphone or speech recognition is unavailable.
 * This is a pure control layer - it only triggers callbacks, no side effects.
 */

import { useEffect, useRef, useCallback } from 'react';

// Check for browser support
const SpeechRecognition = typeof window !== 'undefined' 
  ? window.SpeechRecognition || window.webkitSpeechRecognition 
  : null;

const AudioContext = typeof window !== 'undefined'
  ? window.AudioContext || window.webkitAudioContext
  : null;

export function useHandsFreeControls({
  enabled = false,
  onNext,
  onPrev,
  onTogglePlay,
  onRepeat,
  isPlaying = false,
}) {
  const recognitionRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const micStreamRef = useRef(null);
  const lastClapTimeRef = useRef(0);
  const clapCountRef = useRef(0);
  const animationFrameRef = useRef(null);
  const isListeningRef = useRef(false);
  
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

  // Voice command handler - uses ref to get latest callbacks
  const handleVoiceCommand = useCallback((command) => {
    const normalizedCommand = command.toLowerCase().trim();
    const { onNext, onPrev, onTogglePlay, onRepeat, isPlaying } = callbacksRef.current;
    
    console.log('[HandsFree] Heard:', normalizedCommand);
    
    // Check for keywords
    if (normalizedCommand.includes('next') || normalizedCommand.includes('forward')) {
      console.log('[HandsFree] Voice command: next');
      onNext?.();
    } else if (normalizedCommand.includes('back') || normalizedCommand.includes('previous')) {
      console.log('[HandsFree] Voice command: previous');
      onPrev?.();
    } else if (normalizedCommand.includes('pause') || normalizedCommand.includes('stop')) {
      console.log('[HandsFree] Voice command: pause');
      if (isPlaying) {
        onTogglePlay?.();
      }
    } else if (normalizedCommand.includes('play') || normalizedCommand.includes('start') || normalizedCommand.includes('resume')) {
      console.log('[HandsFree] Voice command: play');
      if (!isPlaying) {
        onTogglePlay?.();
      }
    } else if (normalizedCommand.includes('repeat') || normalizedCommand.includes('again')) {
      console.log('[HandsFree] Voice command: repeat');
      onRepeat?.();
    }
  }, []);

  // Double clap detection using audio analysis
  const detectClaps = useCallback((analyser, dataArray) => {
    if (!analyser || !isListeningRef.current) return;

    analyser.getByteFrequencyData(dataArray);
    
    // Calculate average volume
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const average = sum / dataArray.length;

    // Detect sudden loud sound (clap threshold)
    const CLAP_THRESHOLD = 100;
    const DOUBLE_CLAP_WINDOW = 500; // ms between claps
    const CLAP_COOLDOWN = 200; // ms minimum between claps

    const now = Date.now();
    const timeSinceLastClap = now - lastClapTimeRef.current;

    if (average > CLAP_THRESHOLD && timeSinceLastClap > CLAP_COOLDOWN) {
      lastClapTimeRef.current = now;
      
      if (timeSinceLastClap < DOUBLE_CLAP_WINDOW) {
        // Double clap detected!
        clapCountRef.current = 0;
        console.log('[HandsFree] Double clap detected - next step');
        callbacksRef.current.onNext?.();
      } else {
        // First clap
        clapCountRef.current = 1;
      }
    }

    // Reset clap count if too much time has passed
    if (timeSinceLastClap > DOUBLE_CLAP_WINDOW && clapCountRef.current > 0) {
      clapCountRef.current = 0;
    }

    // Continue monitoring
    animationFrameRef.current = requestAnimationFrame(() => {
      detectClaps(analyser, dataArray);
    });
  }, []);

  // Initialize clap detection
  const initClapDetection = useCallback(async () => {
    if (!AudioContext) {
      console.log('[HandsFree] AudioContext not supported');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
        } 
      });
      
      micStreamRef.current = stream;
      audioContextRef.current = new AudioContext();
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.3;
      
      source.connect(analyser);
      analyserRef.current = analyser;
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      // Start detection loop
      detectClaps(analyser, dataArray);
      
      console.log('[HandsFree] Clap detection initialized');
    } catch (e) {
      // Fail silently - user may have denied mic access
      console.log('[HandsFree] Clap detection unavailable:', e.message);
    }
  }, [detectClaps]);

  // Cleanup function
  const cleanup = useCallback(() => {
    isListeningRef.current = false;

    // Stop speech recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
      } catch (e) {
        // Ignore errors during cleanup
      }
      recognitionRef.current = null;
    }

    // Stop animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Stop audio context
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {
        // Ignore errors during cleanup
      }
      audioContextRef.current = null;
    }

    // Stop mic stream
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }

    analyserRef.current = null;
  }, []);

  // Main effect - start/stop based on enabled prop
  useEffect(() => {
    if (enabled) {
      isListeningRef.current = true;

      // Initialize speech recognition
      if (SpeechRecognition && !recognitionRef.current) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = false;
          recognition.lang = 'en-US';
          recognition.maxAlternatives = 1;

          recognition.onresult = (event) => {
            const last = event.results.length - 1;
            const command = event.results[last][0].transcript;
            handleVoiceCommand(command);
          };

          recognition.onerror = (event) => {
            if (event.error === 'no-speech' || event.error === 'aborted') {
              return;
            }
            console.log('[HandsFree] Speech recognition error:', event.error);
          };

          recognition.onend = () => {
            // Restart if still enabled
            if (isListeningRef.current && recognitionRef.current) {
              try {
                setTimeout(() => {
                  if (isListeningRef.current && recognitionRef.current) {
                    recognitionRef.current.start();
                  }
                }, 100);
              } catch (e) {
                // Already started or other error
              }
            }
          };

          recognitionRef.current = recognition;
          recognition.start();
          console.log('[HandsFree] Voice commands active');
        } catch (e) {
          console.log('[HandsFree] Could not start speech recognition:', e.message);
        }
      }

      // Initialize clap detection
      initClapDetection();

    } else {
      cleanup();
    }

    return cleanup;
  }, [enabled, handleVoiceCommand, initClapDetection, cleanup]);

  return {
    isSupported: !!SpeechRecognition || !!AudioContext,
  };
}

export default useHandsFreeControls;
