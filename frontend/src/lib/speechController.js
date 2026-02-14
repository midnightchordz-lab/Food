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
 * 4. STRICT TTS/MIC EXCLUSION - recognition DISABLED while speaking
 * 5. UI decoupled - no React state dependencies
 * 6. Chrome workaround - keep-alive prevents 15s timeout
 * 
 * STOP CONDITIONS FILTERING:
 * Speech should ONLY be cancelled when:
 * - User presses Pause
 * - User presses Next/Back
 * - Voice command recognized (user-initiated action)
 * - App exits cooking mode
 * 
 * Speech should NOT be cancelled when:
 * - Timer starts/updates
 * - Recognition restarts
 * - Gestures idle
 * - Orchestrator cleanup runs automatically
 * - ANY non-user-initiated event
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
  MIC_DELAY_AFTER_TTS: 500,    // ms to wait after TTS ends before starting mic
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
 * CRITICAL: Stop recognition while TTS is active
 * This prevents recognition from hearing TTS output
 */
function disableRecognitionDuringTTS() {
  if (recognition && isListening) {
    console.log('[SpeechController] Disabling recognition during TTS');
    try {
      recognition.abort();
    } catch {}
    isListening = false;
  }
}

/**
 * Re-enable recognition after TTS completes
 */
function enableRecognitionAfterTTS() {
  if (shouldBeListening && !isListening && !checkIsSpeaking()) {
    console.log('[SpeechController] Re-enabling recognition after TTS');
    setTimeout(() => {
      if (shouldBeListening && !isListening && !checkIsSpeaking()) {
        startRecognition();
      }
    }, CONFIG.MIC_DELAY_AFTER_TTS);
  }
}

/**
 * Speak text with completion guarantee
 * 
 * BULLETPROOF SPEECH EXECUTION:
 * 1. Always creates NEW SpeechSynthesisUtterance immediately before speak()
 * 2. Speaking lock prevents double triggers
 * 3. Text sanitization (null/undefined/HTML removal)
 * 4. onend/onerror handlers release lock
 * 
 * @param {string} text - Text to speak
 * @param {function} onComplete - Callback when speech finishes
 * @returns {boolean} - true if speech started, false if blocked
 */
function speak(text, onComplete = null) {
  // ========================================
  // SAFETY GUARD 1: Check environment
  // ========================================
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.log('[SpeechController] Speech not supported');
    onComplete?.();
    return false;
  }
  
  // ========================================
  // SAFETY GUARD 2: Text sanitization
  // ========================================
  let cleanText = '';
  if (text === null || text === undefined) {
    console.log('[SpeechController] Null/undefined text, skipping');
    onComplete?.();
    return false;
  }
  
  // Force string conversion
  cleanText = String(text);
  
  // Remove HTML tags if any
  cleanText = cleanText.replace(/<[^>]*>/g, '');
  
  // Trim whitespace
  cleanText = cleanText.trim();
  
  if (cleanText === '') {
    console.log('[SpeechController] Empty text after sanitization, skipping');
    onComplete?.();
    return false;
  }
  
  console.log('[SpeechController] speak() called, text length:', cleanText.length);
  
  // ========================================
  // SAFETY GUARD 3: Speaking lock
  // ========================================
  if (isSpeaking) {
    console.log('[SpeechController] Speaking lock active, blocking new request');
    return false;
  }
  
  // ========================================
  // ACQUIRE LOCK FIRST
  // ========================================
  isSpeaking = true;
  speechCancelled = false;
  onSpeechEndCallback = onComplete;
  
  // Safety timeout - release lock if speech doesn't start within 5 seconds
  const safetyTimeout = setTimeout(() => {
    if (isSpeaking && !window.speechSynthesis.speaking) {
      console.log('[SpeechController] Safety timeout - releasing stuck lock');
      isSpeaking = false;
      currentUtterance = null;
      enableRecognitionAfterTTS();
      onComplete?.();
    }
  }, 5000);
  
  // Disable recognition during TTS
  disableRecognitionDuringTTS();
  
  // Clear any keep-alive timer
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
  
  // ========================================
  // EXECUTE SPEECH with chunking for long text
  // ========================================
  const chunks = splitIntoChunks(cleanText);
  console.log(`[SpeechController] Speaking ${chunks.length} chunk(s)`);
  
  let chunkIndex = 0;
  
  const speakNextChunk = () => {
    // Clear safety timeout once speech starts progressing
    clearTimeout(safetyTimeout);
    // Check cancel flag or completion
    if (speechCancelled || chunkIndex >= chunks.length) {
      // ========================================
      // RELEASE LOCK on completion/cancel
      // ========================================
      console.log('[SpeechController] Speech ' + (speechCancelled ? 'cancelled' : 'completed'));
      isSpeaking = false;
      currentUtterance = null;
      
      if (keepAliveTimer) {
        clearInterval(keepAliveTimer);
        keepAliveTimer = null;
      }
      
      if (!speechCancelled && onSpeechEndCallback) {
        const cb = onSpeechEndCallback;
        onSpeechEndCallback = null;
        setTimeout(() => cb(), 50);
      }
      
      enableRecognitionAfterTTS();
      return;
    }
    
    const chunkText = chunks[chunkIndex];
    console.log(`[SpeechController] Chunk ${chunkIndex + 1}/${chunks.length}: "${chunkText.substring(0, 40)}..."`);
    
    // ========================================
    // CRITICAL: Create NEW utterance HERE
    // Never reuse or pass external objects
    // ========================================
    const utterance = new SpeechSynthesisUtterance(chunkText);
    currentUtterance = utterance;
    
    // Configure
    utterance.rate = CONFIG.SPEECH_RATE;
    utterance.pitch = CONFIG.SPEECH_PITCH;
    utterance.volume = CONFIG.SPEECH_VOLUME;
    
    // Set voice if available (Safari needs this)
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      const voice = getPreferredVoice();
      if (voice) {
        utterance.voice = voice;
      }
    }
    
    // ========================================
    // EVENT HANDLERS - Release lock on end/error
    // ========================================
    utterance.onstart = () => {
      console.log('[SpeechController] >>> SPEECH STARTED - onstart fired');
      clearTimeout(safetyTimeout); // Speech started, clear safety
      // Start keep-alive for Chrome
      if (!keepAliveTimer) {
        keepAliveTimer = setInterval(() => {
          if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
          }
        }, KEEP_ALIVE_INTERVAL);
      }
    };
    
    utterance.onend = () => {
      console.log(`[SpeechController] onend - Chunk ${chunkIndex + 1} done`);
      chunkIndex++;
      setTimeout(speakNextChunk, 100);
    };
    
    utterance.onerror = (event) => {
      console.log('[SpeechController] onerror:', event.error);
      // Release lock on any error
      isSpeaking = false;
      currentUtterance = null;
      if (keepAliveTimer) {
        clearInterval(keepAliveTimer);
        keepAliveTimer = null;
      }
      enableRecognitionAfterTTS();
      
      // Call completion callback on error too
      if (onSpeechEndCallback) {
        const cb = onSpeechEndCallback;
        onSpeechEndCallback = null;
        cb();
      }
    };
    
    // ========================================
    // FINAL EXECUTION - speak() with fresh utterance
    // ========================================
    console.log('[SpeechController] Calling speechSynthesis.speak()');
    window.speechSynthesis.speak(utterance);
    
    // Safari sometimes needs a kick after a short delay
    setTimeout(() => {
      if (currentUtterance === utterance && !window.speechSynthesis.speaking && !speechCancelled) {
        console.log('[SpeechController] Safari kick - trying resume');
        try {
          window.speechSynthesis.resume();
        } catch (e) {}
      }
    }, 250);
  };
  
  // Start speaking
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
 * 
 * PHASE-1 ISOLATION: SpeechController owns speech lifecycle.
 * Orchestrator is observer only - cannot cancel TTS.
 * 
 * ALLOWED CANCEL REASONS (User-initiated only):
 * - userPause: User pressed Pause button
 * - userNext: User pressed Next button
 * - userBack: User pressed Back button  
 * - userRepeat: User pressed Repeat button
 * - modalClose: User closed the cooking modal
 * - disableHandsFree: User disabled hands-free mode
 * - stepChange: Step changed (triggers new narration)
 * - readCurrentStep: Starting new step narration
 * 
 * BLOCKED CANCEL REASONS (Orchestrator/System):
 * - orchestratorStop: Orchestrator cleanup loop
 * - Any reason containing 'orchestrator', 'cleanup', 'gesture', 'recognition'
 * 
 * @param {string} reason - Why cancel was called
 */
function cancelSpeech(reason = 'unknown') {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  
  // ========================================
  // PHASE-1 ISOLATION: Block orchestrator cancels
  // Only user-initiated actions may cancel speech
  // ========================================
  const allowedReasons = [
    'userPause',
    'userNext', 
    'userBack',
    'userRepeat',
    'modalClose',
    'disableHandsFree',
    'stepChange',
    'readCurrentStep'
  ];
  
  const blockedPatterns = [
    'orchestrator',
    'cleanup',
    'gesture',
    'recognition',
    'camera',
    'timer'
  ];
  
  // Check if reason is blocked
  const reasonLower = reason.toLowerCase();
  const isBlocked = blockedPatterns.some(pattern => reasonLower.includes(pattern));
  const isAllowed = allowedReasons.includes(reason);
  
  if (isBlocked && !isAllowed) {
    // Silently ignore orchestrator/system cancels
    return;
  }
  
  // ========================================
  // GUARD: Only cancel if actually speaking
  // ========================================
  if (!isSpeaking && !window.speechSynthesis.speaking) {
    return;
  }
  
  console.log('[SpeechController] Canceling speech, reason:', reason);
  
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
    
    // Retry for recoverable errors - but ONLY if not speaking
    if (shouldBeListening && !checkIsSpeaking()) {
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
    
    // CRITICAL: Only restart if NOT speaking
    // This is the key fix - don't restart while TTS is active
    if (shouldBeListening && !checkIsSpeaking()) {
      setTimeout(() => {
        if (shouldBeListening && !isListening && !checkIsSpeaking()) {
          try {
            recognition?.start();
          } catch (e) {
            console.log('[SpeechController] Restart failed:', e.message);
            setTimeout(() => {
              if (shouldBeListening && !checkIsSpeaking()) startRecognition();
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
 * CRITICAL: Will NOT start if TTS is speaking
 */
function startRecognition() {
  if (!recognition) {
    if (!initRecognition()) return false;
  }
  
  if (isListening) {
    console.log('[SpeechController] Already listening');
    return true;
  }
  
  // CRITICAL: Don't start if speaking - this is the key mutual exclusion
  if (checkIsSpeaking()) {
    console.log('[SpeechController] TTS speaking, will NOT start recognition until done');
    shouldBeListening = true;
    // Recognition will be started by enableRecognitionAfterTTS() when TTS ends
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
  // TYPE ENFORCEMENT: Ensure text is a string
  if (typeof text !== 'string' || !text.trim()) {
    console.log('[SpeechController] narrateStep: Invalid or empty text');
    onComplete?.();
    return false;
  }
  
  // Ensure stepNumber and totalSteps are numbers
  const step = parseInt(stepNumber, 10) || 1;
  const total = parseInt(totalSteps, 10) || 1;
  
  let narrationText = '';
  if (step === 1) {
    narrationText = `Let's begin. Step ${step} of ${total}. ${text}`;
  } else if (step === total) {
    narrationText = `Final step. ${text}`;
  } else {
    narrationText = `Step ${step}. ${text}`;
  }
  
  console.log('[SpeechController] narrateStep: Speaking:', narrationText.substring(0, 50) + '...');
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
  
  /**
   * Cancel speech - ONLY call for user-initiated actions
   * @param {string} reason - Required: document why cancel is being called
   */
  cancel(reason) { 
    if (!reason) {
      console.warn('[SpeechController] cancel() called without reason - this may indicate improper usage');
    }
    cancelSpeech(reason); 
  }
  
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
    this.cancel('destroy');
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
