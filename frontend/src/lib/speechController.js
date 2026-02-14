/**
 * GLOBAL SPEECH CONTROLLER - Singleton Pattern
 * 
 * This module provides a persistent speech engine that exists OUTSIDE
 * of React's component lifecycle. Speech synthesis objects are never
 * recreated on UI updates, timer changes, or state transitions.
 * 
 * DESIGN PRINCIPLES:
 * 1. Singleton instance - one controller for entire app
 * 2. Persistent utterance - not recreated on re-renders
 * 3. Speech lock - prevents overlapping speak() calls
 * 4. MIC exclusion - recognition only after TTS completion + delay
 * 5. UI decoupled - no React state dependencies
 * 6. Chrome workaround - keep-alive prevents 15s timeout
 */

// ============================================
// SINGLETON STATE (Outside React lifecycle)
// ============================================

let instance = null;

// Speech synthesis state
let currentUtterance = null;
let isSpeaking = false;
let speechQueue = [];
let onSpeechEndCallback = null;
let speechCancelled = false; // Global cancel flag for chunked speech

// Chrome bug workaround: keep-alive timer
// Chrome/WebKit cancels speechSynthesis after ~15 seconds of silence detection
// This timer "pokes" the speech engine to keep it alive
let keepAliveTimer = null;
const KEEP_ALIVE_INTERVAL = 10000; // 10 seconds

// Voice recognition state
let recognition = null;
let isListening = false;
let shouldBeListening = false;
let recognitionCallbacks = {
  onResult: null,
  onStart: null,
  onEnd: null,
  onError: null,
};

// Configuration
const CONFIG = {
  MIC_DELAY_AFTER_TTS: 400,    // ms to wait after TTS ends before starting mic
  SPEECH_RATE: 0.95,
  SPEECH_PITCH: 1,
  SPEECH_VOLUME: 1,
};

// ============================================
// SPEECH SYNTHESIS ENGINE
// ============================================

/**
 * Initialize speech synthesis (call once on app load)
 */
function initSpeechSynthesis() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.log('[SpeechController] Speech synthesis not supported');
    return false;
  }
  
  // Load voices (required for some browsers)
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
  
  // Force load voices
  window.speechSynthesis.getVoices();
  
  console.log('[SpeechController] Speech synthesis initialized');
  return true;
}

/**
 * Get preferred voice for natural speech
 */
function getPreferredVoice() {
  const voices = window.speechSynthesis.getVoices();
  return voices.find(v => 
    v.name.includes('Google') || 
    v.name.includes('Samantha') || 
    v.name.includes('Alex') ||
    (v.lang.startsWith('en') && v.localService)
  ) || voices[0];
}

/**
 * Check if TTS is currently speaking
 * @returns {boolean}
 */
function checkIsSpeaking() {
  return isSpeaking || (typeof window !== 'undefined' && 
    'speechSynthesis' in window && 
    window.speechSynthesis.speaking);
}

/**
 * Speak text with completion guarantee
 * SPEECH LOCK: Will not start if already speaking
 * CHROME/SAFARI WORKAROUND: Uses text chunking for long text
 * 
 * @param {string} text - Text to speak
 * @param {function} onComplete - Callback when speech finishes
 * @returns {boolean} - true if speech started, false if blocked
 */
function speak(text, onComplete = null) {
  console.log('[SpeechController] speak() called with text length:', text?.length);
  
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.log('[SpeechController] Speech not supported');
    onComplete?.();
    return false;
  }
  
  if (!text || text.trim() === '') {
    console.log('[SpeechController] Empty text, skipping');
    onComplete?.();
    return false;
  }
  
  // SAFARI FIX: Check if voices are loaded, if not wait for them
  const voices = window.speechSynthesis.getVoices();
  console.log('[SpeechController] Available voices:', voices.length);
  
  // SPEECH LOCK: Prevent new speak() if already speaking
  const currentlySpeaking = checkIsSpeaking();
  console.log('[SpeechController] Currently speaking:', currentlySpeaking, 'isSpeaking var:', isSpeaking, 'synth.speaking:', window.speechSynthesis.speaking);
  
  if (currentlySpeaking) {
    console.log('[SpeechController] Already speaking, blocking new request');
    return false;
  }
  
  // Reset cancel flag for new speech
  speechCancelled = false;
  
  // Clear any keep-alive timer from previous speech
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
  
  // SAFARI FIX: Don't cancel before speaking - Safari might not restart properly
  // Only cancel if we're 100% sure something is stuck
  if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
    console.log('[SpeechController] Cancelling stuck speech');
    window.speechSynthesis.cancel();
    // Small delay after cancel for Safari
    setTimeout(() => speakInternal(text, onComplete), 100);
    return true;
  }
  
  return speakInternal(text, onComplete);
}

/**
 * Internal speak function after safety checks
 */
function speakInternal(text, onComplete) {
  // CHROME WORKAROUND: Split long text into chunks to prevent 15s timeout
  const chunks = splitIntoChunks(text);
  console.log(`[SpeechController] Speaking ${chunks.length} chunk(s), first chunk: "${chunks[0]?.substring(0, 50)}..."`);
  
  let chunkIndex = 0;
  
  const speakNextChunk = () => {
    // Check global cancel flag
    if (speechCancelled || chunkIndex >= chunks.length) {
      console.log('[SpeechController] Speech ' + (speechCancelled ? 'cancelled' : 'completed'));
      isSpeaking = false;
      currentUtterance = null;
      
      if (keepAliveTimer) {
        clearInterval(keepAliveTimer);
        keepAliveTimer = null;
      }
      
      if (!speechCancelled) {
        const callback = onSpeechEndCallback;
        onSpeechEndCallback = null;
        if (callback) setTimeout(callback, 50);
        
        // MIC EXCLUSION: Resume recognition after delay
        if (shouldBeListening && !isListening) {
          setTimeout(() => {
            if (shouldBeListening && !isListening && !checkIsSpeaking()) {
              console.log('[SpeechController] TTS ended, resuming recognition');
              startRecognition();
            }
          }, CONFIG.MIC_DELAY_AFTER_TTS);
        }
      }
      return;
    }
    
    const chunk = chunks[chunkIndex];
    console.log(`[SpeechController] Chunk ${chunkIndex + 1}/${chunks.length}: "${chunk.substring(0, 40)}..."`);
    
    currentUtterance = new SpeechSynthesisUtterance(chunk);
    onSpeechEndCallback = onComplete;
    
    // Configure utterance
    currentUtterance.rate = CONFIG.SPEECH_RATE;
    currentUtterance.pitch = CONFIG.SPEECH_PITCH;
    currentUtterance.volume = CONFIG.SPEECH_VOLUME;
    
    // SAFARI FIX: Use a specific voice if available
    const preferredVoice = getPreferredVoice();
    if (preferredVoice) {
      currentUtterance.voice = preferredVoice;
      console.log('[SpeechController] Using voice:', preferredVoice.name);
    }
    
    currentUtterance.onstart = () => {
      isSpeaking = true;
      console.log('[SpeechController] onstart fired - Speech actually started!');
      
      // CHROME WORKAROUND: Start keep-alive timer for long chunks
      if (!keepAliveTimer) {
        keepAliveTimer = setInterval(() => {
          if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
            console.log('[SpeechController] Keep-alive poke');
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
          }
        }, KEEP_ALIVE_INTERVAL);
      }
    };
    
    currentUtterance.onend = () => {
      console.log(`[SpeechController] onend fired - Chunk ${chunkIndex + 1} completed`);
      chunkIndex++;
      setTimeout(speakNextChunk, 100);
    };
    
    currentUtterance.onerror = (event) => {
      console.log('[SpeechController] onerror fired:', event.error);
      // SAFARI: "interrupted" error is common when user navigates or cancels
      if (event.error !== 'canceled' && event.error !== 'interrupted' && !speechCancelled) {
        chunkIndex++;
        setTimeout(speakNextChunk, 100);
      } else {
        isSpeaking = false;
        currentUtterance = null;
        if (keepAliveTimer) {
          clearInterval(keepAliveTimer);
          keepAliveTimer = null;
        }
      }
    };
    
    // SAFARI FIX: Small delay before speak to ensure audio context is ready
    setTimeout(() => {
      console.log('[SpeechController] Calling speechSynthesis.speak()');
      window.speechSynthesis.speak(currentUtterance);
      
      // SAFARI FIX: Sometimes Safari needs a "kick" to start speaking
      // Check if speaking started after 200ms, if not try to resume
      setTimeout(() => {
        if (!window.speechSynthesis.speaking && !speechCancelled && currentUtterance) {
          console.log('[SpeechController] SAFARI FIX: Speech not started, trying resume...');
          window.speechSynthesis.resume();
        }
      }, 200);
    }, 50);
  };
  
  // Start speaking first chunk
  speakNextChunk();
  return true;
}

/**
 * Split text into chunks for Chrome compatibility
 * Splits on sentence boundaries, keeping chunks under 200 chars
 */
function splitIntoChunks(text) {
  const MAX_CHUNK_LENGTH = 180;
  
  // If text is short enough, don't split
  if (text.length <= MAX_CHUNK_LENGTH) {
    return [text];
  }
  
  const chunks = [];
  // Split by sentence-ending punctuation while keeping the punctuation
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  
  let currentChunk = '';
  
  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    
    // If adding this sentence would make chunk too long, save current and start new
    if (currentChunk && (currentChunk.length + trimmedSentence.length + 1) > MAX_CHUNK_LENGTH) {
      chunks.push(currentChunk.trim());
      currentChunk = trimmedSentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + trimmedSentence;
    }
  }
  
  // Add any remaining text
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.length > 0 ? chunks : [text];
}

/**
 * Cancel current speech
 * CANCEL DISCIPLINE: Only call from Pause, Step Change, or Exit
 */
function cancelSpeech() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  
  console.log('[SpeechController] Canceling speech');
  
  // Set global cancel flag to stop chunk queue
  speechCancelled = true;
  
  // Clear keep-alive timer
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
  
  window.speechSynthesis.cancel();
  isSpeaking = false;
  currentUtterance = null;
  onSpeechEndCallback = null;
}

// ============================================
// VOICE RECOGNITION ENGINE
// ============================================

/**
 * Initialize speech recognition
 */
function initRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    console.log('[SpeechController] Speech recognition not supported');
    return false;
  }
  
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = 'en-US';
  recognition.maxAlternatives = 1;
  
  recognition.onstart = () => {
    isListening = true;
    console.log('[SpeechController] Recognition started');
    recognitionCallbacks.onStart?.();
  };
  
  recognition.onresult = (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript
      .trim()
      .toLowerCase();
    console.log('[SpeechController] Heard:', transcript);
    recognitionCallbacks.onResult?.(transcript);
  };
  
  recognition.onerror = (event) => {
    console.log('[SpeechController] Recognition error:', event.error);
    isListening = false;
    recognitionCallbacks.onError?.(event.error);
    
    // Don't auto-restart on fatal errors
    if (event.error === 'aborted' || event.error === 'not-allowed') {
      shouldBeListening = false;
      return;
    }
    
    // Retry for recoverable errors
    if (shouldBeListening) {
      setTimeout(() => {
        if (shouldBeListening && !isListening && !checkIsSpeaking()) {
          startRecognition();
        }
      }, 500);
    }
  };
  
  recognition.onend = () => {
    isListening = false;
    console.log('[SpeechController] Recognition ended');
    recognitionCallbacks.onEnd?.();
    
    // MIC EXCLUSION: Only restart if not speaking
    if (shouldBeListening && !checkIsSpeaking()) {
      setTimeout(() => {
        if (shouldBeListening && !isListening && !checkIsSpeaking()) {
          try {
            recognition?.start();
          } catch (e) {
            console.log('[SpeechController] Restart failed:', e.message);
            setTimeout(() => {
              if (shouldBeListening) startRecognition();
            }, 300);
          }
        }
      }, 100);
    }
  };
  
  console.log('[SpeechController] Recognition initialized');
  return true;
}

/**
 * Start voice recognition
 * MIC EXCLUSION: Will not start if TTS is speaking
 */
function startRecognition() {
  if (!recognition) {
    if (!initRecognition()) return false;
  }
  
  if (isListening) {
    console.log('[SpeechController] Already listening');
    return true;
  }
  
  // MIC EXCLUSION: Don't start if speaking
  if (checkIsSpeaking()) {
    console.log('[SpeechController] TTS speaking, will start when done');
    shouldBeListening = true;
    return true;
  }
  
  shouldBeListening = true;
  
  try {
    recognition.start();
    console.log('[SpeechController] Starting recognition');
    return true;
  } catch (e) {
    console.log('[SpeechController] Start failed:', e.message);
    return false;
  }
}

/**
 * Stop voice recognition
 */
function stopRecognition() {
  shouldBeListening = false;
  isListening = false;
  
  if (recognition) {
    try {
      recognition.abort();
    } catch {}
  }
  
  console.log('[SpeechController] Recognition stopped');
}

/**
 * Set recognition callbacks
 * Also sets shouldBeListening flag so recognition starts after TTS
 */
function setRecognitionCallbacks(callbacks) {
  recognitionCallbacks = {
    onResult: callbacks.onResult || null,
    onStart: callbacks.onStart || null,
    onEnd: callbacks.onEnd || null,
    onError: callbacks.onError || null,
  };
  
  // If callbacks are being set, it means the user wants recognition
  // Set the flag so it starts after TTS completes
  if (callbacks.onResult) {
    shouldBeListening = true;
    console.log('[SpeechController] shouldBeListening set to true');
  }
}

// ============================================
// STEP NARRATION (Higher-level API)
// ============================================

/**
 * Narrate a cooking step
 * @param {string} text - Step text
 * @param {number} stepNumber - Current step (1-based)
 * @param {number} totalSteps - Total steps
 * @param {function} onComplete - Callback when narration finishes
 */
function narrateStep(text, stepNumber, totalSteps, onComplete = null) {
  if (!text) {
    onComplete?.();
    return false;
  }
  
  let narrationText = '';
  if (stepNumber === 1) {
    narrationText = `Let's begin. Step ${stepNumber} of ${totalSteps}. ${text}`;
  } else if (stepNumber === totalSteps) {
    narrationText = `Final step. ${text}`;
  } else {
    narrationText = `Step ${stepNumber}. ${text}`;
  }
  
  return speak(narrationText, onComplete);
}

// ============================================
// SINGLETON CONTROLLER CLASS
// ============================================

class SpeechController {
  constructor() {
    if (instance) {
      return instance;
    }
    
    this.initialized = false;
    instance = this;
  }
  
  init() {
    if (this.initialized) return this;
    
    initSpeechSynthesis();
    this.initialized = true;
    console.log('[SpeechController] Controller initialized');
    return this;
  }
  
  // Speech methods
  speak(text, onComplete) { return speak(text, onComplete); }
  cancel() { cancelSpeech(); }
  isSpeaking() { return checkIsSpeaking(); }
  
  // Step narration
  narrateStep(text, stepNumber, totalSteps, onComplete) {
    return narrateStep(text, stepNumber, totalSteps, onComplete);
  }
  
  // Recognition methods
  startListening() { return startRecognition(); }
  stopListening() { stopRecognition(); }
  isListening() { return isListening; }
  setRecognitionCallbacks(callbacks) { setRecognitionCallbacks(callbacks); }
  
  // Cleanup
  destroy() {
    this.cancel();
    this.stopListening();
    recognition = null;
    instance = null;
    this.initialized = false;
  }
}

// ============================================
// EXPORTS
// ============================================

// Singleton instance
const speechController = new SpeechController();

// Direct function exports for convenience
export {
  speechController,
  speak,
  cancelSpeech,
  checkIsSpeaking as isSpeaking,
  narrateStep,
  startRecognition,
  stopRecognition,
  setRecognitionCallbacks,
};

// Default export is the singleton
export default speechController;
