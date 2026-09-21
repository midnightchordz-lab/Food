/**
 * MOBILE SPEECH ENGINE - Isolated Speech Recovery
 * 
 * This module provides mobile-safe speech synthesis and recognition
 * with strict user activation requirements and no auto-cancellation.
 * 
 * DESIGN PRINCIPLES:
 * 1. Separate TTS and Recognition engines (no mutual interference)
 * 2. User tap required to activate on mobile
 * 3. No auto-start, no background start
 * 4. Graceful degradation for WebView/insecure contexts
 * 5. UI state always reflects actual engine state
 */

// ============================================
// ENVIRONMENT DETECTION
// ============================================

const ENV = {
  isMobile: false,
  isWebView: false,
  isSecureContext: true,
  isIOS: false,
  isAndroid: false,
  hasSpeechSynthesis: false,
  hasSpeechRecognition: false,
};

function detectEnvironment() {
  if (typeof window === 'undefined') return;
  
  const ua = navigator.userAgent;
  
  // Mobile detection
  ENV.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
    (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
  
  // iOS detection
  ENV.isIOS = /iPad|iPhone|iPod/.test(ua) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  
  // Android detection
  ENV.isAndroid = /Android/i.test(ua);
  
  // WebView detection
  ENV.isWebView = !!(
    window.Capacitor ||
    window.cordova ||
    ua.includes('wv') ||
    ua.includes('WebView') ||
    (window.webkit && window.webkit.messageHandlers) ||
    (ENV.isAndroid && ua.includes('Version/'))
  );
  
  // Secure context (HTTPS or localhost)
  ENV.isSecureContext = window.isSecureContext !== false && 
    (window.location.protocol === 'https:' || 
     window.location.hostname === 'localhost' ||
     window.location.hostname === '127.0.0.1');
  
  // API availability
  ENV.hasSpeechSynthesis = 'speechSynthesis' in window;
  ENV.hasSpeechRecognition = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  
  console.log('[MobileSpeech] Environment:', ENV);
}

// Initialize on load
if (typeof window !== 'undefined') {
  detectEnvironment();
}

export function getEnvironment() {
  return { ...ENV };
}

export function isMobileDevice() {
  return ENV.isMobile;
}

export function canUseSpeech() {
  return ENV.isSecureContext && ENV.hasSpeechSynthesis;
}

export function canUseRecognition() {
  return ENV.isSecureContext && ENV.hasSpeechRecognition && !ENV.isWebView;
}

// ============================================
// UI STATE MANAGEMENT
// ============================================

const UI_STATES = {
  DISABLED: 'disabled',           // Permission denied or not supported
  TAP_TO_ENABLE: 'tap-to-enable', // Ready for user activation
  STARTING: 'starting',           // Initializing
  LISTENING: 'listening',         // Recognition active
  SPEAKING: 'speaking',           // TTS active
  ERROR: 'error',                 // Recoverable error
};

let currentUIState = UI_STATES.TAP_TO_ENABLE;
let uiStateCallback = null;

function setUIState(state) {
  currentUIState = state;
  console.log('[MobileSpeech] UI State:', state);
  uiStateCallback?.(state);
}

export function getUIState() {
  return currentUIState;
}

export function setUIStateCallback(callback) {
  uiStateCallback = callback;
}

export { UI_STATES };

// ============================================
// SYNTHESIS ENGINE (TTS) - Completely Isolated
// ============================================

let ttsUtterance = null;
let ttsIsSpeaking = false;
let ttsQueue = [];
let ttsOnComplete = null;
let ttsVoice = null;
let ttsInitialized = false;

/**
 * Initialize TTS engine (call once)
 */
export function initTTS() {
  if (ttsInitialized) return true;
  if (!ENV.hasSpeechSynthesis) {
    console.log('[MobileSpeech] TTS not supported');
    return false;
  }
  
  // Load voices
  const loadVoices = () => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      // Prefer English voices
      ttsVoice = voices.find(v => 
        v.lang.startsWith('en') && (v.localService || v.name.includes('Google') || v.name.includes('Samantha'))
      ) || voices.find(v => v.lang.startsWith('en')) || voices[0];
      console.log('[MobileSpeech] TTS voice selected:', ttsVoice?.name);
    }
  };
  
  // Chrome needs onvoiceschanged
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
  loadVoices();
  
  ttsInitialized = true;
  console.log('[MobileSpeech] TTS initialized');
  return true;
}

/**
 * Check if TTS is currently speaking
 */
export function isTTSSpeaking() {
  return ttsIsSpeaking || (window.speechSynthesis?.speaking ?? false);
}

/**
 * Speak text - ISOLATED from recognition
 * Only user actions can cancel this (not orchestrator)
 * 
 * @param {string} text - Text to speak
 * @param {function} onComplete - Callback when done
 */
export function speak(text, onComplete = null) {
  if (!ENV.hasSpeechSynthesis) {
    console.log('[MobileSpeech] TTS not available');
    onComplete?.();
    return false;
  }
  
  // Sanitize text
  if (typeof text !== 'string' || !text.trim()) {
    console.log('[MobileSpeech] Invalid text');
    onComplete?.();
    return false;
  }
  
  const cleanText = text.replace(/<[^>]*>/g, '').trim();
  if (!cleanText) {
    onComplete?.();
    return false;
  }
  
  // If already speaking, queue it
  if (ttsIsSpeaking) {
    console.log('[MobileSpeech] TTS busy, queueing');
    ttsQueue.push({ text: cleanText, onComplete });
    return true;
  }
  
  // Acquire lock
  ttsIsSpeaking = true;
  ttsOnComplete = onComplete;
  setUIState(UI_STATES.SPEAKING);
  
  // Ensure voices are loaded
  if (!ttsVoice) {
    const voices = window.speechSynthesis.getVoices();
    ttsVoice = voices[0];
  }
  
  // Create fresh utterance
  ttsUtterance = new SpeechSynthesisUtterance(cleanText);
  ttsUtterance.rate = 0.95;
  ttsUtterance.pitch = 1;
  ttsUtterance.volume = 1;
  if (ttsVoice) {
    ttsUtterance.voice = ttsVoice;
  }
  
  ttsUtterance.onstart = () => {
    console.log('[MobileSpeech] TTS started');
  };
  
  ttsUtterance.onend = () => {
    console.log('[MobileSpeech] TTS ended');
    ttsIsSpeaking = false;
    ttsUtterance = null;
    
    const cb = ttsOnComplete;
    ttsOnComplete = null;
    cb?.();
    
    // Process queue
    if (ttsQueue.length > 0) {
      const next = ttsQueue.shift();
      speak(next.text, next.onComplete);
    } else {
      setUIState(UI_STATES.TAP_TO_ENABLE);
    }
  };
  
  ttsUtterance.onerror = (event) => {
    console.log('[MobileSpeech] TTS error:', event.error);
    ttsIsSpeaking = false;
    ttsUtterance = null;
    
    const cb = ttsOnComplete;
    ttsOnComplete = null;
    cb?.();
    
    setUIState(UI_STATES.TAP_TO_ENABLE);
  };
  
  // Speak
  console.log('[MobileSpeech] Speaking:', cleanText.substring(0, 50) + '...');
  window.speechSynthesis.speak(ttsUtterance);
  
  // iOS Safari workaround - needs resume sometimes
  if (ENV.isIOS) {
    setTimeout(() => {
      if (ttsIsSpeaking && !window.speechSynthesis.speaking) {
        console.log('[MobileSpeech] iOS kick');
        window.speechSynthesis.resume();
      }
    }, 250);
  }
  
  return true;
}

/**
 * Stop TTS - ONLY call from user action
 * @param {string} reason - Why stopping (for logging)
 */
export function stopTTS(reason = 'user') {
  // Only allow user-initiated stops
  const allowedReasons = ['user', 'userPause', 'userNext', 'userBack', 'stepChange', 'modalClose'];
  if (!allowedReasons.includes(reason)) {
    console.log('[MobileSpeech] Ignoring TTS stop from:', reason);
    return;
  }
  
  if (!ttsIsSpeaking && !window.speechSynthesis?.speaking) {
    return;
  }
  
  console.log('[MobileSpeech] Stopping TTS, reason:', reason);
  
  ttsIsSpeaking = false;
  ttsUtterance = null;
  ttsOnComplete = null;
  ttsQueue = [];
  
  try {
    window.speechSynthesis.cancel();
  } catch (e) {}
  
  setUIState(UI_STATES.TAP_TO_ENABLE);
}

// ============================================
// RECOGNITION ENGINE - Completely Isolated
// ============================================

let recognition = null;
let recognitionActive = false;
let recognitionUserActivated = false;
let recognitionCallbacks = {
  onResult: null,
  onStart: null,
  onEnd: null,
  onError: null,
};

/**
 * Initialize recognition (lazy, on first use)
 */
function initRecognition() {
  if (recognition) return true;
  if (!canUseRecognition()) {
    console.log('[MobileSpeech] Recognition not available');
    setUIState(UI_STATES.DISABLED);
    return false;
  }
  
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = 'en-US';
  recognition.maxAlternatives = 1;
  
  recognition.onstart = () => {
    recognitionActive = true;
    setUIState(UI_STATES.LISTENING);
    console.log('[MobileSpeech] Recognition started');
    recognitionCallbacks.onStart?.();
  };
  
  recognition.onresult = (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript
      .trim()
      .toLowerCase();
    console.log('[MobileSpeech] Heard:', transcript);
    recognitionCallbacks.onResult?.(transcript);
  };
  
  recognition.onerror = (event) => {
    console.log('[MobileSpeech] Recognition error:', event.error);
    recognitionActive = false;
    
    if (event.error === 'not-allowed') {
      setUIState(UI_STATES.DISABLED);
      recognitionCallbacks.onError?.('permission-denied');
      return;
    }
    
    setUIState(UI_STATES.TAP_TO_ENABLE);
    recognitionCallbacks.onError?.(event.error);
  };
  
  recognition.onend = () => {
    console.log('[MobileSpeech] Recognition ended');
    recognitionActive = false;
    
    if (currentUIState !== UI_STATES.DISABLED) {
      setUIState(UI_STATES.TAP_TO_ENABLE);
    }
    
    recognitionCallbacks.onEnd?.();
    
    // NO AUTO-RESTART on mobile - user must tap again
  };
  
  console.log('[MobileSpeech] Recognition initialized');
  return true;
}

/**
 * Start recognition - REQUIRES USER GESTURE on mobile
 * Must be called from click/tap handler
 */
export function startRecognition() {
  if (!canUseRecognition()) {
    console.log('[MobileSpeech] Recognition not supported');
    setUIState(UI_STATES.DISABLED);
    return false;
  }
  
  if (recognitionActive) {
    console.log('[MobileSpeech] Already listening');
    return true;
  }
  
  if (!initRecognition()) {
    return false;
  }
  
  recognitionUserActivated = true;
  setUIState(UI_STATES.STARTING);
  
  try {
    recognition.start();
    console.log('[MobileSpeech] Starting recognition');
    return true;
  } catch (e) {
    console.log('[MobileSpeech] Recognition start error:', e.message);
    setUIState(UI_STATES.ERROR);
    
    // Try to recover
    setTimeout(() => {
      if (recognitionUserActivated && !recognitionActive) {
        setUIState(UI_STATES.TAP_TO_ENABLE);
      }
    }, 1000);
    
    return false;
  }
}

/**
 * Stop recognition
 */
export function stopRecognition() {
  recognitionUserActivated = false;
  recognitionActive = false;
  
  if (recognition) {
    try {
      recognition.abort();
    } catch (e) {}
  }
  
  if (currentUIState !== UI_STATES.DISABLED && currentUIState !== UI_STATES.SPEAKING) {
    setUIState(UI_STATES.TAP_TO_ENABLE);
  }
  
  console.log('[MobileSpeech] Recognition stopped');
}

/**
 * Check if recognition is active
 */
export function isRecognitionActive() {
  return recognitionActive;
}

/**
 * Set recognition callbacks
 */
export function setRecognitionCallbacks(callbacks) {
  recognitionCallbacks = {
    onResult: callbacks.onResult || null,
    onStart: callbacks.onStart || null,
    onEnd: callbacks.onEnd || null,
    onError: callbacks.onError || null,
  };
}

// ============================================
// COMBINED ACTIVATION (User Tap Handler)
// ============================================

/**
 * Activate voice on user tap
 * This is the ONLY entry point for mobile voice activation
 * Must be called from a click/tap/touchstart handler
 */
export function activateVoiceFromTap() {
  console.log('[MobileSpeech] User tap activation');
  
  if (!ENV.isSecureContext) {
    console.log('[MobileSpeech] Not secure context');
    setUIState(UI_STATES.DISABLED);
    return { success: false, reason: 'insecure' };
  }
  
  // Initialize TTS
  initTTS();
  
  // Start recognition if available
  if (canUseRecognition()) {
    const started = startRecognition();
    return { success: started, reason: started ? 'ok' : 'recognition-failed' };
  } else if (ENV.isWebView) {
    // WebView: TTS only mode
    setUIState(UI_STATES.TAP_TO_ENABLE);
    return { success: true, reason: 'tts-only' };
  } else {
    setUIState(UI_STATES.DISABLED);
    return { success: false, reason: 'not-supported' };
  }
}

/**
 * Deactivate voice
 */
export function deactivateVoice() {
  stopRecognition();
  stopTTS('user');
  setUIState(UI_STATES.TAP_TO_ENABLE);
}

// ============================================
// STEP NARRATION HELPER
// ============================================

/**
 * Narrate a cooking step
 */
export function narrateStep(text, stepNumber, totalSteps, onComplete = null) {
  if (!text || typeof text !== 'string') {
    onComplete?.();
    return false;
  }
  
  let narration = '';
  const step = parseInt(stepNumber, 10) || 1;
  const total = parseInt(totalSteps, 10) || 1;
  
  if (step === 1) {
    narration = `Let's begin. Step ${step} of ${total}. ${text}`;
  } else if (step === total) {
    narration = `Final step. ${text}`;
  } else {
    narration = `Step ${step}. ${text}`;
  }
  
  return speak(narration, onComplete);
}

// ============================================
// CLEANUP
// ============================================

export function cleanup() {
  stopRecognition();
  stopTTS('modalClose');
  ttsQueue = [];
  recognitionUserActivated = false;
}

// Export default object for convenience
export default {
  // Environment
  getEnvironment,
  isMobileDevice,
  canUseSpeech,
  canUseRecognition,
  
  // UI State
  getUIState,
  setUIStateCallback,
  UI_STATES,
  
  // TTS
  initTTS,
  speak,
  stopTTS,
  isTTSSpeaking,
  narrateStep,
  
  // Recognition
  startRecognition,
  stopRecognition,
  isRecognitionActive,
  setRecognitionCallbacks,
  
  // Combined
  activateVoiceFromTap,
  deactivateVoice,
  cleanup,
};
