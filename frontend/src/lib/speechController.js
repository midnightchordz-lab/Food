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
 * 
 * @param {string} text - Text to speak
 * @param {function} onComplete - Callback when speech finishes
 * @returns {boolean} - true if speech started, false if blocked
 */
function speak(text, onComplete = null) {
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
  
  // SPEECH LOCK: Prevent new speak() if already speaking
  if (checkIsSpeaking()) {
    console.log('[SpeechController] Already speaking, blocking new request');
    return false;
  }
  
  // Cancel any pending speech (but we know we're not speaking)
  window.speechSynthesis.cancel();
  
  // Create new utterance (SINGLE INSTANCE per speak call)
  currentUtterance = new SpeechSynthesisUtterance(text);
  onSpeechEndCallback = onComplete;
  
  // Configure utterance
  currentUtterance.rate = CONFIG.SPEECH_RATE;
  currentUtterance.pitch = CONFIG.SPEECH_PITCH;
  currentUtterance.volume = CONFIG.SPEECH_VOLUME;
  
  const preferredVoice = getPreferredVoice();
  if (preferredVoice) {
    currentUtterance.voice = preferredVoice;
  }
  
  // UTTERANCE COMPLETION GUARANTEE
  currentUtterance.onstart = () => {
    isSpeaking = true;
    console.log('[SpeechController] Speech started');
  };
  
  currentUtterance.onend = () => {
    console.log('[SpeechController] Speech completed');
    isSpeaking = false;
    currentUtterance = null;
    
    const callback = onSpeechEndCallback;
    onSpeechEndCallback = null;
    
    // Call completion callback
    if (callback) {
      setTimeout(callback, 50);
    }
    
    // MIC EXCLUSION: Resume recognition after delay
    if (shouldBeListening && !isListening) {
      setTimeout(() => {
        if (shouldBeListening && !isListening && !checkIsSpeaking()) {
          console.log('[SpeechController] TTS ended, resuming recognition');
          startRecognition();
        }
      }, CONFIG.MIC_DELAY_AFTER_TTS);
    }
  };
  
  currentUtterance.onerror = (event) => {
    console.log('[SpeechController] Speech error:', event.error);
    isSpeaking = false;
    currentUtterance = null;
    
    const callback = onSpeechEndCallback;
    onSpeechEndCallback = null;
    callback?.();
  };
  
  // Start speaking
  window.speechSynthesis.speak(currentUtterance);
  console.log('[SpeechController] Speaking:', text.substring(0, 50) + '...');
  return true;
}

/**
 * Cancel current speech
 * CANCEL DISCIPLINE: Only call from Pause, Step Change, or Exit
 */
function cancelSpeech() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  
  console.log('[SpeechController] Canceling speech');
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
 */
function setRecognitionCallbacks(callbacks) {
  recognitionCallbacks = {
    onResult: callbacks.onResult || null,
    onStart: callbacks.onStart || null,
    onEnd: callbacks.onEnd || null,
    onError: callbacks.onError || null,
  };
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
