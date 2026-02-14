/**
 * GLOBAL SPEECH CONTROLLER - Singleton Pattern
 * 
 * MOBILE VOICE FULL RECOVERY - 10 Phase Implementation
 * 
 * This module provides a persistent speech engine that exists OUTSIDE
 * of React's component lifecycle. Speech synthesis objects are never
 * recreated on UI updates, timer changes, or state transitions.
 * 
 * DESIGN PRINCIPLES:
 * 1. Singleton instance - one controller for entire app
 * 2. Persistent utterance - not recreated on re-renders
 * 3. Speech lock - prevents overlapping speak() calls
 * 4. ISOLATED ENGINES - Recognition and Synthesis are separate
 * 5. UI decoupled - no React state dependencies
 * 6. Chrome workaround - keep-alive prevents 15s timeout
 * 7. MOBILE-FIRST - Tap-to-activate, no auto-start
 * 
 * STRICT STOP RULES:
 * Speech ONLY stops when:
 * - User presses Pause
 * - User presses Stop
 * - User presses Next/Back (step navigation)
 * - User closes modal
 * 
 * Speech NEVER stops from:
 * - Timer updates
 * - Gesture engine
 * - Recognition events
 * - Orchestrator cleanup
 * - Any automatic system event
 */

// Singleton instance
let instance = null;

// ============================================
// PHASE 1: MOBILE ENVIRONMENT DETECTION
// ============================================

let isMobile = false;
let isWebView = false;
let isSecureContext = true;
let isPWA = false;
let environmentChecked = false;

/**
 * Comprehensive environment detection
 * Must run BEFORE any speech initialization
 */
function detectEnvironment() {
  if (typeof window === 'undefined') {
    console.log('[SpeechController] No window - SSR environment');
    return { isMobile: false, isWebView: false, isSecureContext: false, isPWA: false, isSupported: false };
  }
  
  if (environmentChecked) {
    return { isMobile, isWebView, isSecureContext, isPWA, isSupported: isSecureContext };
  }
  
  // Mobile detection - comprehensive check
  const userAgent = navigator.userAgent || '';
  isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) ||
    ('ontouchstart' in window) ||
    (navigator.maxTouchPoints && navigator.maxTouchPoints > 2) ||
    (window.innerWidth <= 768 && 'ontouchstart' in window);
  
  // WebView/Capacitor/Cordova detection
  isWebView = !!(
    window.Capacitor ||
    window.cordova ||
    userAgent.includes('wv') ||
    userAgent.includes('WebView') ||
    (userAgent.includes('iPhone') && !userAgent.includes('Safari')) ||
    (userAgent.includes('Android') && userAgent.includes('Version/')) ||
    (window.webkit && window.webkit.messageHandlers)
  );
  
  // PWA detection
  isPWA = window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator?.standalone === true;
  
  // Secure context check (required for Web Speech API on mobile)
  isSecureContext = window.isSecureContext === true || 
    window.location.protocol === 'https:' || 
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';
  
  environmentChecked = true;
  
  console.log(`[SpeechController] PHASE 1 - Environment Detection:`);
  console.log(`  - Mobile: ${isMobile}`);
  console.log(`  - WebView: ${isWebView}`);
  console.log(`  - PWA: ${isPWA}`);
  console.log(`  - Secure Context: ${isSecureContext}`);
  console.log(`  - User Agent: ${userAgent.substring(0, 80)}...`);
  
  return { isMobile, isWebView, isSecureContext, isPWA, isSupported: isSecureContext };
}

/**
 * Get current environment (for external use)
 */
function getEnvironment() {
  if (!environmentChecked) detectEnvironment();
  return { isMobile, isWebView, isSecureContext, isPWA, micPermissionState };
}

// ============================================
// PHASE 2: USER ACTIVATION STATE
// ============================================

let hasUserGesture = false;
let userActivationTime = 0;
const USER_GESTURE_TIMEOUT = 5000; // 5 seconds - gesture validity window

/**
 * Check if user gesture is valid (recent enough)
 */
function hasValidUserGesture() {
  if (!isMobile) return true; // Desktop doesn't require gesture
  if (!hasUserGesture) return false;
  
  // Check if gesture is still valid (within timeout window)
  const elapsed = Date.now() - userActivationTime;
  return elapsed < USER_GESTURE_TIMEOUT;
}

/**
 * Record user gesture (called on tap/click)
 */
function recordUserGesture() {
  hasUserGesture = true;
  userActivationTime = Date.now();
  console.log('[SpeechController] PHASE 2 - User gesture recorded');
}

/**
 * Clear user gesture (for security)
 */
function clearUserGesture() {
  hasUserGesture = false;
  userActivationTime = 0;
}

// ============================================
// PHASE 3: ISOLATED SYNTHESIS ENGINE
// ============================================

// Synthesis state (ISOLATED from recognition)
let synthesisInstance = null;
let currentUtterance = null;
let isSpeaking = false;
let speechCancelled = false;
let onSpeechEndCallback = null;
let keepAliveTimer = null;
let selectedVoice = null;
let voicesLoaded = false;
let voiceLoadAttempts = 0;
const MAX_VOICE_LOAD_ATTEMPTS = 2;

// Synthesis state for UI
let synthesisState = 'idle'; // 'idle', 'speaking', 'paused', 'error'
let synthesisStateCallback = null;

const SYNTHESIS_CONFIG = {
  SPEECH_RATE: 0.95,
  SPEECH_PITCH: 1,
  SPEECH_VOLUME: 1,
  KEEP_ALIVE_INTERVAL: 10000, // Chrome bug workaround
  CHUNK_MAX_LENGTH: 180,
  SAFETY_TIMEOUT: 5000,
};

/**
 * Set synthesis state and notify UI
 */
function setSynthesisState(state) {
  synthesisState = state;
  console.log('[SpeechController] Synthesis state:', state);
  synthesisStateCallback?.(state);
}

/**
 * Initialize synthesis engine (PHASE 5 - Fallback voices)
 */
function initSynthesis() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.log('[SpeechController] Speech synthesis not supported');
    setSynthesisState('error');
    return false;
  }
  
  synthesisInstance = window.speechSynthesis;
  
  // Load voices (PHASE 5)
  loadVoices();
  
  // Chrome needs voiceschanged event
  synthesisInstance.onvoiceschanged = loadVoices;
  
  console.log('[SpeechController] PHASE 3 - Synthesis engine initialized');
  return true;
}

/**
 * PHASE 5: Load and select fallback voice
 */
function loadVoices() {
  if (voicesLoaded || voiceLoadAttempts >= MAX_VOICE_LOAD_ATTEMPTS) return;
  voiceLoadAttempts++;
  
  const voices = window.speechSynthesis?.getVoices() || [];
  
  if (voices.length === 0) {
    console.log('[SpeechController] No voices available yet, attempt:', voiceLoadAttempts);
    return;
  }
  
  voicesLoaded = true;
  
  // Select best voice (prefer Google/Samantha/Alex, fallback to any English)
  selectedVoice = voices.find(v => 
    v.name.includes('Google') || 
    v.name.includes('Samantha') || 
    v.name.includes('Alex')
  ) || voices.find(v => 
    v.lang.startsWith('en') && v.localService
  ) || voices.find(v => 
    v.lang.startsWith('en')
  ) || voices[0];
  
  console.log(`[SpeechController] PHASE 5 - Voice selected: ${selectedVoice?.name || 'default'} (${voices.length} available)`);
}

/**
 * Check if synthesis is currently speaking
 */
function checkIsSpeaking() {
  return isSpeaking || (synthesisInstance?.speaking === true);
}

/**
 * Split text into chunks for Chrome compatibility
 */
function splitIntoChunks(text) {
  const MAX = SYNTHESIS_CONFIG.CHUNK_MAX_LENGTH;
  if (text.length <= MAX) return [text];
  
  const chunks = [];
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  let current = '';
  
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (current && (current.length + trimmed.length + 1) > MAX) {
      chunks.push(current.trim());
      current = trimmed;
    } else {
      current += (current ? ' ' : '') + trimmed;
    }
  }
  
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [text];
}

/**
 * PHASE 3 & 6: Speak text (ISOLATED from recognition)
 * Recognition state is NOT checked or modified here
 */
function speak(text, onComplete = null) {
  // Environment check
  if (!synthesisInstance && !initSynthesis()) {
    console.log('[SpeechController] Synthesis not available');
    onComplete?.();
    return false;
  }
  
  // Text sanitization
  if (text === null || text === undefined) {
    onComplete?.();
    return false;
  }
  
  let cleanText = String(text).replace(/<[^>]*>/g, '').trim();
  if (cleanText === '') {
    onComplete?.();
    return false;
  }
  
  console.log('[SpeechController] speak() called, length:', cleanText.length);
  
  // Speaking lock - block if already speaking
  if (isSpeaking) {
    console.log('[SpeechController] Already speaking, blocking new request');
    return false;
  }
  
  // PHASE 5: Ensure voices are loaded
  if (!voicesLoaded) {
    loadVoices();
    // Force a voice reload on first speak
    const voices = window.speechSynthesis?.getVoices() || [];
    if (voices.length > 0 && !selectedVoice) {
      selectedVoice = voices[0];
    }
  }
  
  // Acquire lock
  isSpeaking = true;
  speechCancelled = false;
  onSpeechEndCallback = onComplete;
  setSynthesisState('speaking');
  
  // Safety timeout
  const safetyTimeout = setTimeout(() => {
    if (isSpeaking && !synthesisInstance?.speaking) {
      console.log('[SpeechController] Safety timeout - releasing stuck lock');
      releaseSpeechLock();
      onComplete?.();
    }
  }, SYNTHESIS_CONFIG.SAFETY_TIMEOUT);
  
  // PHASE 3: Do NOT touch recognition here - they are isolated
  // Recognition will naturally pause itself if it's listening
  
  // Clear keep-alive
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
  
  // Chunk and speak
  const chunks = splitIntoChunks(cleanText);
  console.log(`[SpeechController] Speaking ${chunks.length} chunk(s)`);
  
  let chunkIndex = 0;
  
  const speakNextChunk = () => {
    clearTimeout(safetyTimeout);
    
    if (speechCancelled || chunkIndex >= chunks.length) {
      console.log('[SpeechController] Speech', speechCancelled ? 'cancelled' : 'completed');
      releaseSpeechLock();
      
      if (!speechCancelled && onSpeechEndCallback) {
        const cb = onSpeechEndCallback;
        onSpeechEndCallback = null;
        setTimeout(() => cb(), 50);
      }
      return;
    }
    
    const chunkText = chunks[chunkIndex];
    const utterance = new SpeechSynthesisUtterance(chunkText);
    currentUtterance = utterance;
    
    // Configure
    utterance.rate = SYNTHESIS_CONFIG.SPEECH_RATE;
    utterance.pitch = SYNTHESIS_CONFIG.SPEECH_PITCH;
    utterance.volume = SYNTHESIS_CONFIG.SPEECH_VOLUME;
    
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    
    utterance.onstart = () => {
      console.log('[SpeechController] >>> SPEECH STARTED');
      // Chrome keep-alive
      if (!keepAliveTimer) {
        keepAliveTimer = setInterval(() => {
          if (synthesisInstance?.speaking && !synthesisInstance?.paused) {
            synthesisInstance.pause();
            synthesisInstance.resume();
          }
        }, SYNTHESIS_CONFIG.KEEP_ALIVE_INTERVAL);
      }
    };
    
    utterance.onend = () => {
      console.log(`[SpeechController] Chunk ${chunkIndex + 1}/${chunks.length} done`);
      chunkIndex++;
      setTimeout(speakNextChunk, 100);
    };
    
    utterance.onerror = (event) => {
      console.log('[SpeechController] Speech error:', event.error);
      releaseSpeechLock();
      onSpeechEndCallback?.();
      onSpeechEndCallback = null;
    };
    
    synthesisInstance.speak(utterance);
    
    // Safari kick
    setTimeout(() => {
      if (currentUtterance === utterance && !synthesisInstance?.speaking && !speechCancelled) {
        try { synthesisInstance?.resume(); } catch (e) {}
      }
    }, 250);
  };
  
  speakNextChunk();
  return true;
}

/**
 * Release speech lock (internal helper)
 */
function releaseSpeechLock() {
  isSpeaking = false;
  currentUtterance = null;
  setSynthesisState('idle');
  
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}

/**
 * PHASE 6: Cancel speech - STRICT USER-ONLY
 * 
 * ALLOWED REASONS (User actions ONLY):
 * - userPause, userNext, userBack, userRepeat
 * - modalClose, disableHandsFree, destroy
 * 
 * BLOCKED (ALL automatic/system events):
 * - Everything else
 */
function cancelSpeech(reason = 'unknown') {
  if (!synthesisInstance) return;
  
  // STRICT USER-ONLY WHITELIST
  const userOnlyReasons = [
    'userPause',
    'userNext', 
    'userBack',
    'userRepeat',
    'modalClose',
    'disableHandsFree',
    'destroy'
  ];
  
  if (!userOnlyReasons.includes(reason)) {
    // PHASE 6: Block ALL non-user cancellations silently
    if (reason !== 'unknown') {
      console.log('[SpeechController] PHASE 6 - BLOCKED cancel:', reason);
    }
    return;
  }
  
  if (!isSpeaking && !synthesisInstance?.speaking) return;
  
  console.log('[SpeechController] Canceling speech, reason:', reason);
  
  speechCancelled = true;
  synthesisInstance.cancel();
  releaseSpeechLock();
  onSpeechEndCallback = null;
}

/**
 * Narrate a step with context
 */
function narrateStep(text, stepNumber, totalSteps, onComplete = null) {
  if (typeof text !== 'string' || !text.trim()) {
    onComplete?.();
    return false;
  }
  
  const step = parseInt(stepNumber, 10) || 1;
  const total = parseInt(totalSteps, 10) || 1;
  
  let narration = '';
  if (step === 1) {
    narration = `Let's begin. Step ${step} of ${total}. ${text}`;
  } else if (step === total) {
    narration = `Final step. ${text}`;
  } else {
    narration = `Step ${step}. ${text}`;
  }
  
  console.log('[SpeechController] narrateStep:', narration.substring(0, 50) + '...');
  return speak(narration, onComplete);
}

// ============================================
// PHASE 3: ISOLATED RECOGNITION ENGINE
// ============================================

// Recognition state (ISOLATED from synthesis)
let recognitionInstance = null;
let isListening = false;
let shouldBeListening = false;
let recognitionCallbacks = {
  onResult: null,
  onStart: null,
  onEnd: null,
  onError: null,
};

// Recognition state for UI
let recognitionState = 'idle'; // 'idle', 'starting', 'listening', 'error', 'permission-needed', 'disabled'
let recognitionStateCallback = null;
let micPermissionState = 'unknown'; // 'unknown', 'granted', 'denied', 'prompt'

/**
 * Set recognition state and notify UI (PHASE 7)
 */
function setRecognitionState(state) {
  recognitionState = state;
  console.log('[SpeechController] Recognition state:', state);
  recognitionStateCallback?.(state);
}

/**
 * Get recognition state (for UI)
 */
function getRecognitionState() {
  return recognitionState;
}

/**
 * Check microphone permission
 */
async function checkMicPermission() {
  try {
    if (navigator.permissions) {
      const result = await navigator.permissions.query({ name: 'microphone' });
      micPermissionState = result.state;
      result.onchange = () => {
        micPermissionState = result.state;
        console.log('[SpeechController] Mic permission:', micPermissionState);
        if (micPermissionState === 'denied') {
          setRecognitionState('disabled');
        }
      };
    }
  } catch (e) {
    micPermissionState = 'unknown';
  }
  return micPermissionState;
}

/**
 * PHASE 4: Initialize recognition engine (ISOLATED)
 * Does NOT auto-start - waits for explicit user action
 */
function initRecognition() {
  detectEnvironment();
  
  // PHASE 1: Security check
  if (!isSecureContext) {
    console.log('[SpeechController] PHASE 1 - Not secure context, recognition disabled');
    setRecognitionState('disabled');
    return false;
  }
  
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    console.log('[SpeechController] Speech recognition not supported');
    setRecognitionState('disabled');
    return false;
  }
  
  // PHASE 8: WebView check
  if (isWebView) {
    console.log('[SpeechController] PHASE 8 - WebView detected, manual mic only');
    // Don't auto-disable, but require manual activation
  }
  
  recognitionInstance = new SpeechRecognition();
  recognitionInstance.continuous = true;
  recognitionInstance.interimResults = false;
  recognitionInstance.lang = 'en-US';
  recognitionInstance.maxAlternatives = 1;
  
  recognitionInstance.onstart = () => {
    isListening = true;
    setRecognitionState('listening');
    console.log('[SpeechController] Recognition started');
    recognitionCallbacks.onStart?.();
  };
  
  recognitionInstance.onresult = (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript
      .trim()
      .toLowerCase();
    console.log('[SpeechController] Heard:', transcript);
    recognitionCallbacks.onResult?.(transcript);
  };
  
  recognitionInstance.onerror = (event) => {
    console.log('[SpeechController] Recognition error:', event.error);
    isListening = false;
    
    // PHASE 9: Error handling - don't crash
    if (event.error === 'not-allowed') {
      micPermissionState = 'denied';
      setRecognitionState('permission-needed');
      shouldBeListening = false;
      recognitionCallbacks.onError?.(event.error);
      return;
    }
    
    if (event.error === 'aborted') {
      // Aborted is normal (e.g., when we stop it)
      if (shouldBeListening) {
        setRecognitionState('idle');
      }
      recognitionCallbacks.onError?.(event.error);
      return;
    }
    
    setRecognitionState('error');
    recognitionCallbacks.onError?.(event.error);
    
    // PHASE 2: Mobile - no auto-retry, wait for user gesture
    if (isMobile) {
      shouldBeListening = false;
      setRecognitionState('idle');
      return;
    }
    
    // Desktop: Limited retry
    if (shouldBeListening) {
      setTimeout(() => {
        if (shouldBeListening && !isListening) {
          safeStartRecognition();
        }
      }, 1000);
    }
  };
  
  recognitionInstance.onend = () => {
    isListening = false;
    console.log('[SpeechController] Recognition ended');
    
    if (recognitionState !== 'permission-needed' && recognitionState !== 'disabled') {
      setRecognitionState('idle');
    }
    
    recognitionCallbacks.onEnd?.();
    
    // PHASE 2: Mobile - NO auto-restart
    if (isMobile) {
      console.log('[SpeechController] Mobile - not auto-restarting');
      shouldBeListening = false;
      return;
    }
    
    // Desktop: Auto-restart if intended
    if (shouldBeListening) {
      setTimeout(() => {
        if (shouldBeListening && !isListening) {
          safeStartRecognition();
        }
      }, 300);
    }
  };
  
  // Tab visibility
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && isListening) {
        console.log('[SpeechController] Tab hidden - pausing recognition');
        safeStopRecognition();
      }
      // Don't auto-restart on return - wait for user
    });
  }
  
  console.log('[SpeechController] PHASE 4 - Recognition initialized (waiting for user activation)');
  return true;
}

/**
 * PHASE 4: Safe start recognition (internal)
 * Handles errors gracefully
 */
function safeStartRecognition() {
  if (!recognitionInstance) return false;
  if (isListening) return true;
  
  try {
    recognitionInstance.start();
    return true;
  } catch (e) {
    // PHASE 9: Handle errors, don't crash
    if (e.name === 'InvalidStateError') {
      // Already started or in transition
      console.log('[SpeechController] Recognition in transition, retrying...');
      setTimeout(() => {
        if (shouldBeListening && !isListening) {
          try { recognitionInstance?.start(); } catch (e2) {}
        }
      }, 200);
      return true;
    }
    console.log('[SpeechController] Start failed:', e.message);
    setRecognitionState('error');
    return false;
  }
}

/**
 * PHASE 4: Safe stop recognition (internal)
 */
function safeStopRecognition() {
  if (!recognitionInstance) return;
  
  try {
    recognitionInstance.abort();
  } catch (e) {
    // Ignore stop errors
  }
  isListening = false;
}

/**
 * PHASE 2 & 4: Start recognition (requires user activation on mobile)
 */
function startRecognition() {
  detectEnvironment();
  
  // PHASE 1: Security check
  if (!isSecureContext) {
    console.log('[SpeechController] Not secure - cannot start recognition');
    setRecognitionState('disabled');
    return false;
  }
  
  // Initialize if needed
  if (!recognitionInstance) {
    if (!initRecognition()) return false;
  }
  
  if (isListening) {
    console.log('[SpeechController] Already listening');
    return true;
  }
  
  // PHASE 2: Mobile requires user gesture
  if (isMobile && !hasValidUserGesture()) {
    console.log('[SpeechController] PHASE 2 - Mobile needs user gesture');
    setRecognitionState('permission-needed');
    shouldBeListening = true;
    return false;
  }
  
  // PHASE 8: WebView - only manual activation
  if (isWebView && !hasUserGesture) {
    console.log('[SpeechController] PHASE 8 - WebView needs explicit tap');
    setRecognitionState('permission-needed');
    shouldBeListening = true;
    return false;
  }
  
  shouldBeListening = true;
  setRecognitionState('starting');
  
  console.log('[SpeechController] Starting recognition...');
  return safeStartRecognition();
}

/**
 * PHASE 2: Start recognition from user gesture (mobile entry point)
 * This is THE mobile activation point
 */
function startRecognitionFromUserGesture() {
  console.log('[SpeechController] PHASE 2 - User gesture activation');
  recordUserGesture();
  
  // Reset error states
  if (micPermissionState === 'denied') {
    micPermissionState = 'prompt';
  }
  if (recognitionState === 'error' || recognitionState === 'permission-needed') {
    setRecognitionState('idle');
  }
  
  return startRecognition();
}

/**
 * Stop recognition
 */
function stopRecognition() {
  shouldBeListening = false;
  isListening = false;
  clearUserGesture(); // Reset gesture for next activation
  
  safeStopRecognition();
  setRecognitionState('idle');
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
  
  if (callbacks.onResult) {
    shouldBeListening = true;
    console.log('[SpeechController] Recognition callbacks set');
  }
}

/**
 * Set state change callback for UI
 */
function setStateChangeCallback(callback) {
  recognitionStateCallback = callback;
}

/**
 * Set synthesis state callback for UI
 */
function setSynthesisStateCallback(callback) {
  synthesisStateCallback = callback;
}

// ============================================
// PHASE 10: SINGLETON CONTROLLER CLASS
// (Non-goals preserved - no recipe/timer/subscription logic)
// ============================================

class SpeechController {
  constructor() {
    if (instance) return instance;
    this.initialized = false;
    instance = this;
  }
  
  init() {
    if (this.initialized) return this;
    
    detectEnvironment();
    initSynthesis();
    // Don't auto-init recognition - wait for user action
    
    this.initialized = true;
    console.log('[SpeechController] Controller initialized');
    return this;
  }
  
  // Synthesis methods
  speak(text, onComplete) { return speak(text, onComplete); }
  cancel(reason) { cancelSpeech(reason); }
  isSpeaking() { return checkIsSpeaking(); }
  narrateStep(text, stepNumber, totalSteps, onComplete) {
    return narrateStep(text, stepNumber, totalSteps, onComplete);
  }
  
  // Recognition methods
  startListening() { return startRecognition(); }
  startListeningFromGesture() { return startRecognitionFromUserGesture(); }
  stopListening() { stopRecognition(); }
  isListening() { return isListening; }
  setRecognitionCallbacks(callbacks) { setRecognitionCallbacks(callbacks); }
  
  // State methods
  setStateChangeCallback(callback) { setStateChangeCallback(callback); }
  setSynthesisStateCallback(callback) { setSynthesisStateCallback(callback); }
  getRecognitionState() { return getRecognitionState(); }
  getSynthesisState() { return synthesisState; }
  getEnvironment() { return getEnvironment(); }
  
  // Cleanup
  destroy() {
    cancelSpeech('destroy');
    stopRecognition();
    recognitionInstance = null;
    instance = null;
    this.initialized = false;
  }
}

// ============================================
// EXPORTS
// ============================================

const speechController = new SpeechController();

export {
  speechController,
  speak,
  cancelSpeech,
  checkIsSpeaking as isSpeaking,
  narrateStep,
  startRecognition,
  startRecognitionFromUserGesture,
  stopRecognition,
  setRecognitionCallbacks,
  setStateChangeCallback,
  getRecognitionState,
  getEnvironment,
};

export default speechController;
