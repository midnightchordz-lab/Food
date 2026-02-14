/**
 * HYBRID SPEECH CONTROLLER - Native + Web Bridge
 * 
 * This is the SINGLE entry point for speech functionality in the app.
 * It automatically selects the best speech engine based on the platform:
 * 
 * PLATFORM SELECTION:
 * - iOS Native App: Capacitor native plugin for recognition + Web TTS
 * - Android Native App: Capacitor native plugin for recognition + Web TTS
 * - Desktop Browser: Web Speech API for both
 * - Mobile Browser (PWA): Web Speech API with graceful degradation
 * 
 * DESIGN PRINCIPLES:
 * 1. Same API regardless of platform
 * 2. Automatic engine selection
 * 3. Graceful fallback chain
 * 4. Turn-taking audio focus on mobile (TTS blocks recognition)
 * 5. Session arming for mobile (one-time user gesture required)
 */

import { Capacitor } from '@capacitor/core';
import nativeSpeechEngine, {
  isNativeAvailable,
  requestPermissions as nativeRequestPermissions,
  checkPermissions as nativeCheckPermissions,
  startRecognition as nativeStartRecognition,
  stopRecognition as nativeStopRecognition,
  setRecognitionCallbacks as nativeSetRecognitionCallbacks,
  isRecognitionActive as nativeIsRecognitionActive,
  cleanup as nativeCleanup,
} from './nativeSpeechEngine';

// ============================================
// SINGLETON INSTANCE
// ============================================

let instance = null;

// ============================================
// ENVIRONMENT & STATE
// ============================================

const STATE = {
  initialized: false,
  usingNative: false,
  isMobile: false,
  isNativeApp: false,
  sessionArmed: false,
  permissionState: 'unknown',
};

// TTS State
let isSpeaking = false;
let currentUtterance = null;
let speechQueue = [];
let onSpeechEndCallback = null;
let selectedVoice = null;
let voicesLoaded = false;
let keepAliveTimer = null;

// Recognition State
let recognitionInstance = null;
let isListening = false;
let shouldBeListening = false;
let recognitionCallbacks = {
  onResult: null,
  onStart: null,
  onEnd: null,
  onError: null,
};

// Audio Focus (Mobile)
const AUDIO_OWNER = {
  NONE: 'none',
  TTS: 'tts',
  RECOGNITION: 'recognition',
};
let currentAudioOwner = AUDIO_OWNER.NONE;

// Delays for turn-taking
const AUDIO_DELAYS = {
  TTS_TO_RECOGNITION: 400,
  RECOGNITION_TO_TTS: 200,
};

// State callbacks
let stateChangeCallback = null;
let synthesisStateCallback = null;

// ============================================
// INITIALIZATION
// ============================================

async function initializeEngine() {
  if (STATE.initialized) return STATE;
  
  // Platform detection
  STATE.isNativeApp = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();
  
  // Mobile detection (both native and PWA)
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  STATE.isMobile = STATE.isNativeApp || 
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
    (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 2);
  
  // Determine if we should use native plugin
  if (STATE.isNativeApp) {
    const nativeEnv = nativeSpeechEngine.getEnvironment();
    await nativeSpeechEngine.isAvailable().then(result => {
      STATE.usingNative = result.available;
    }).catch(() => {
      STATE.usingNative = false;
    });
  }
  
  // Initialize TTS (always uses Web Speech API)
  initializeTTS();
  
  // Initialize Recognition based on platform
  if (STATE.usingNative) {
    console.log('[HybridSpeech] Using native recognition engine');
    setupNativeRecognition();
  } else {
    console.log('[HybridSpeech] Using web recognition engine');
    initializeWebRecognition();
  }
  
  STATE.initialized = true;
  console.log('[HybridSpeech] Initialized:', STATE);
  
  return STATE;
}

// ============================================
// TTS ENGINE (Web Speech API)
// ============================================

function initializeTTS() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.log('[HybridSpeech] TTS not supported');
    return false;
  }
  
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
  return true;
}

function loadVoices() {
  if (voicesLoaded) return;
  
  const voices = window.speechSynthesis?.getVoices() || [];
  if (voices.length === 0) return;
  
  voicesLoaded = true;
  selectedVoice = voices.find(v => 
    v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Alex')
  ) || voices.find(v => v.lang.startsWith('en') && v.localService
  ) || voices.find(v => v.lang.startsWith('en')
  ) || voices[0];
  
  console.log('[HybridSpeech] TTS voice:', selectedVoice?.name);
}

/**
 * Check if TTS is currently speaking
 */
function checkIsSpeaking() {
  return isSpeaking || (window.speechSynthesis?.speaking === true);
}

/**
 * Speak text
 * On mobile: Stops recognition first (single audio owner rule)
 */
function speak(text, onComplete = null) {
  if (!window.speechSynthesis) {
    onComplete?.();
    return false;
  }
  
  if (text === null || text === undefined) {
    onComplete?.();
    return false;
  }
  
  const cleanText = String(text).replace(/<[^>]*>/g, '').trim();
  if (!cleanText) {
    onComplete?.();
    return false;
  }
  
  // Already speaking - block
  if (isSpeaking) {
    console.log('[HybridSpeech] Already speaking');
    return false;
  }
  
  // Mobile: Stop recognition before speaking (single audio owner)
  if (STATE.isMobile && isListening) {
    console.log('[HybridSpeech] Mobile: Stopping recognition before TTS');
    forceStopRecognition();
  }
  
  // Acquire TTS lock
  currentAudioOwner = AUDIO_OWNER.TTS;
  isSpeaking = true;
  onSpeechEndCallback = onComplete;
  synthesisStateCallback?.('speaking');
  
  console.log('[HybridSpeech] Speaking:', cleanText.substring(0, 50) + '...');
  
  // Chrome keep-alive workaround
  if (keepAliveTimer) clearInterval(keepAliveTimer);
  
  const utterance = new SpeechSynthesisUtterance(cleanText);
  currentUtterance = utterance;
  
  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.volume = 1;
  if (selectedVoice) utterance.voice = selectedVoice;
  
  utterance.onstart = () => {
    console.log('[HybridSpeech] TTS started');
    keepAliveTimer = setInterval(() => {
      if (window.speechSynthesis?.speaking && !window.speechSynthesis?.paused) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10000);
  };
  
  utterance.onend = () => {
    console.log('[HybridSpeech] TTS ended');
    releaseSpeechLock();
    
    const cb = onSpeechEndCallback;
    onSpeechEndCallback = null;
    
    // Delay before callback (for audio focus handoff)
    const delay = STATE.isMobile ? AUDIO_DELAYS.TTS_TO_RECOGNITION : 50;
    setTimeout(() => cb?.(), delay);
  };
  
  utterance.onerror = (e) => {
    console.log('[HybridSpeech] TTS error:', e.error);
    releaseSpeechLock();
    onSpeechEndCallback?.();
    onSpeechEndCallback = null;
  };
  
  window.speechSynthesis.speak(utterance);
  
  // Safari kick
  setTimeout(() => {
    if (currentUtterance === utterance && !window.speechSynthesis?.speaking) {
      try { window.speechSynthesis?.resume(); } catch {}
    }
  }, 250);
  
  return true;
}

function releaseSpeechLock() {
  isSpeaking = false;
  currentUtterance = null;
  currentAudioOwner = AUDIO_OWNER.NONE;
  synthesisStateCallback?.('idle');
  
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}

/**
 * Cancel speech - only for user-initiated actions
 */
function cancelSpeech(reason = 'unknown') {
  const allowedReasons = ['userPause', 'userNext', 'userBack', 'userRepeat', 'modalClose', 'disableHandsFree', 'destroy'];
  
  if (!allowedReasons.includes(reason)) {
    if (reason !== 'unknown') {
      console.log('[HybridSpeech] BLOCKED cancel:', reason);
    }
    return;
  }
  
  if (!isSpeaking && !window.speechSynthesis?.speaking) return;
  
  console.log('[HybridSpeech] Canceling TTS:', reason);
  window.speechSynthesis?.cancel();
  releaseSpeechLock();
  onSpeechEndCallback = null;
}

/**
 * Narrate a cooking step with context
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
  
  return speak(narration, onComplete);
}

// ============================================
// RECOGNITION ENGINE (Hybrid)
// ============================================

function setupNativeRecognition() {
  // Bridge native callbacks to unified callbacks
  nativeSetRecognitionCallbacks({
    onResult: (transcript) => {
      console.log('[HybridSpeech] Native result:', transcript);
      recognitionCallbacks.onResult?.(transcript);
    },
    onStart: () => {
      isListening = true;
      currentAudioOwner = AUDIO_OWNER.RECOGNITION;
      stateChangeCallback?.('listening');
      recognitionCallbacks.onStart?.();
    },
    onEnd: () => {
      isListening = false;
      if (currentAudioOwner === AUDIO_OWNER.RECOGNITION) {
        currentAudioOwner = AUDIO_OWNER.NONE;
      }
      stateChangeCallback?.('idle');
      recognitionCallbacks.onEnd?.();
      
      // Auto-restart if session armed and should be listening
      if (STATE.sessionArmed && shouldBeListening && !isSpeaking) {
        setTimeout(() => {
          if (shouldBeListening && !isListening && !isSpeaking) {
            startRecognition();
          }
        }, 100);
      }
    },
    onError: (error) => {
      isListening = false;
      if (error === 'permission-denied' || error === 'not-allowed') {
        STATE.permissionState = 'denied';
        stateChangeCallback?.('permission-needed');
        STATE.sessionArmed = false;
      } else {
        stateChangeCallback?.('error');
      }
      recognitionCallbacks.onError?.(error);
    },
  });
}

function initializeWebRecognition() {
  if (typeof window === 'undefined') return false;
  
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.log('[HybridSpeech] Web recognition not supported');
    return false;
  }
  
  recognitionInstance = new SpeechRecognition();
  recognitionInstance.continuous = true;
  recognitionInstance.interimResults = false;
  recognitionInstance.lang = 'en-US';
  recognitionInstance.maxAlternatives = 1;
  
  recognitionInstance.onstart = () => {
    isListening = true;
    currentAudioOwner = AUDIO_OWNER.RECOGNITION;
    stateChangeCallback?.('listening');
    console.log('[HybridSpeech] Web recognition started');
    recognitionCallbacks.onStart?.();
  };
  
  recognitionInstance.onresult = (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
    console.log('[HybridSpeech] Web result:', transcript);
    recognitionCallbacks.onResult?.(transcript);
  };
  
  recognitionInstance.onerror = (event) => {
    console.log('[HybridSpeech] Web recognition error:', event.error);
    isListening = false;
    if (currentAudioOwner === AUDIO_OWNER.RECOGNITION) {
      currentAudioOwner = AUDIO_OWNER.NONE;
    }
    
    if (event.error === 'not-allowed') {
      STATE.permissionState = 'denied';
      stateChangeCallback?.('permission-needed');
      STATE.sessionArmed = false;
      recognitionCallbacks.onError?.(event.error);
      return;
    }
    
    if (event.error === 'aborted') {
      recognitionCallbacks.onError?.(event.error);
      return;
    }
    
    stateChangeCallback?.('error');
    recognitionCallbacks.onError?.(event.error);
  };
  
  recognitionInstance.onend = () => {
    const wasListening = isListening;
    isListening = false;
    if (currentAudioOwner === AUDIO_OWNER.RECOGNITION) {
      currentAudioOwner = AUDIO_OWNER.NONE;
    }
    console.log('[HybridSpeech] Web recognition ended');
    
    if (STATE.permissionState !== 'denied') {
      stateChangeCallback?.('idle');
    }
    
    recognitionCallbacks.onEnd?.();
    
    // Auto-restart on mobile if armed and not speaking
    if (STATE.isMobile && STATE.sessionArmed && shouldBeListening && wasListening && !isSpeaking) {
      setTimeout(() => {
        if (shouldBeListening && !isListening && !isSpeaking) {
          safeStartWebRecognition();
        }
      }, AUDIO_DELAYS.TTS_TO_RECOGNITION);
    }
  };
  
  // Tab visibility handling
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && isListening) {
        console.log('[HybridSpeech] Tab hidden - pausing recognition');
        forceStopRecognition();
      }
    });
  }
  
  console.log('[HybridSpeech] Web recognition initialized');
  return true;
}

function safeStartWebRecognition() {
  if (!recognitionInstance || isListening) return false;
  
  // Mobile: Cannot start while TTS is speaking
  if (STATE.isMobile && isSpeaking) {
    console.log('[HybridSpeech] BLOCKED: TTS speaking');
    return false;
  }
  
  try {
    currentAudioOwner = AUDIO_OWNER.RECOGNITION;
    recognitionInstance.start();
    return true;
  } catch (e) {
    if (e.name === 'InvalidStateError') {
      setTimeout(() => {
        if (shouldBeListening && !isListening && !isSpeaking) {
          safeStartWebRecognition();
        }
      }, 200);
      return true;
    }
    console.log('[HybridSpeech] Web start failed:', e.message);
    currentAudioOwner = AUDIO_OWNER.NONE;
    stateChangeCallback?.('error');
    return false;
  }
}

/**
 * Start recognition
 */
async function startRecognition() {
  await initializeEngine();
  
  if (isListening) {
    console.log('[HybridSpeech] Already listening');
    return true;
  }
  
  // Mobile: Block if TTS is speaking
  if (STATE.isMobile && isSpeaking) {
    console.log('[HybridSpeech] TTS speaking, will start after');
    shouldBeListening = true;
    return false;
  }
  
  // Mobile: Require session armed (user gesture)
  if (STATE.isMobile && !STATE.sessionArmed) {
    console.log('[HybridSpeech] Mobile: Session not armed');
    stateChangeCallback?.('permission-needed');
    return false;
  }
  
  shouldBeListening = true;
  stateChangeCallback?.('starting');
  
  if (STATE.usingNative) {
    return nativeStartRecognition({ language: 'en-US', partialResults: true });
  } else {
    return safeStartWebRecognition();
  }
}

/**
 * Start recognition from user gesture - ARMS SESSION
 */
async function startRecognitionFromUserGesture() {
  await initializeEngine();
  
  console.log('[HybridSpeech] User gesture - arming session');
  STATE.sessionArmed = true;
  
  // Reset error states
  if (STATE.permissionState === 'denied') {
    STATE.permissionState = 'prompt';
  }
  
  // Mobile: If TTS speaking, just arm session
  if (STATE.isMobile && isSpeaking) {
    console.log('[HybridSpeech] TTS speaking - armed for later');
    shouldBeListening = true;
    return true;
  }
  
  shouldBeListening = true;
  
  if (STATE.usingNative) {
    // Request permissions first
    const permStatus = await nativeCheckPermissions();
    if (permStatus.speechRecognition !== 'granted') {
      const reqStatus = await nativeRequestPermissions();
      if (reqStatus.speechRecognition !== 'granted') {
        stateChangeCallback?.('permission-needed');
        return false;
      }
    }
    STATE.permissionState = 'granted';
    return nativeStartRecognition({ language: 'en-US', partialResults: true });
  } else {
    return safeStartWebRecognition();
  }
}

/**
 * Stop recognition
 */
function stopRecognition() {
  shouldBeListening = false;
  forceStopRecognition();
  stateChangeCallback?.('idle');
}

function forceStopRecognition() {
  if (STATE.usingNative) {
    nativeStopRecognition();
  } else if (recognitionInstance) {
    try {
      recognitionInstance.abort();
    } catch {}
  }
  isListening = false;
  if (currentAudioOwner === AUDIO_OWNER.RECOGNITION) {
    currentAudioOwner = AUDIO_OWNER.NONE;
  }
}

/**
 * Disarm session
 */
function disarmSession() {
  STATE.sessionArmed = false;
  shouldBeListening = false;
  forceStopRecognition();
  console.log('[HybridSpeech] Session disarmed');
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
// TURN-TAKING HELPERS (Mobile)
// ============================================

/**
 * Start recognition after TTS completes
 */
function startRecognitionAfterTTS() {
  if (!STATE.sessionArmed || !shouldBeListening) return;
  if (isListening) return;
  
  setTimeout(() => {
    if (shouldBeListening && !isListening && !isSpeaking) {
      console.log('[HybridSpeech] TTS ended -> Starting recognition');
      startRecognition();
    }
  }, AUDIO_DELAYS.TTS_TO_RECOGNITION);
}

/**
 * Speak then auto-start recognition (mobile turn-taking)
 */
function speakThenListen(text, stepNumber, totalSteps) {
  return narrateStep(text, stepNumber, totalSteps, () => {
    if (STATE.isMobile && STATE.sessionArmed) {
      startRecognitionAfterTTS();
    }
  });
}

// ============================================
// STATE GETTERS
// ============================================

function getRecognitionState() {
  if (!STATE.initialized) return 'idle';
  if (isListening) return 'listening';
  if (STATE.permissionState === 'denied') return 'permission-needed';
  return 'idle';
}

function getEnvironment() {
  return {
    ...STATE,
    micPermissionState: STATE.permissionState,
  };
}

function isSessionArmed() {
  return STATE.sessionArmed;
}

// ============================================
// CALLBACKS
// ============================================

function setStateChangeCallback(callback) {
  stateChangeCallback = callback;
}

function setSynthesisStateCallback(callback) {
  synthesisStateCallback = callback;
}

// ============================================
// CLEANUP
// ============================================

function destroy() {
  cancelSpeech('destroy');
  disarmSession();
  
  if (STATE.usingNative) {
    nativeCleanup();
  }
  
  recognitionInstance = null;
  instance = null;
  STATE.initialized = false;
}

// ============================================
// CONTROLLER CLASS
// ============================================

class HybridSpeechController {
  constructor() {
    if (instance) return instance;
    instance = this;
  }
  
  async init() {
    await initializeEngine();
    return this;
  }
  
  // TTS
  speak(text, onComplete) { return speak(text, onComplete); }
  cancel(reason) { cancelSpeech(reason); }
  isSpeaking() { return checkIsSpeaking(); }
  narrateStep(text, step, total, onComplete) { return narrateStep(text, step, total, onComplete); }
  speakThenListen(text, step, total) { return speakThenListen(text, step, total); }
  
  // Recognition
  startListening() { return startRecognition(); }
  startListeningFromGesture() { return startRecognitionFromUserGesture(); }
  stopListening() { stopRecognition(); }
  isListening() { return isListening; }
  setRecognitionCallbacks(callbacks) { setRecognitionCallbacks(callbacks); }
  
  // Session
  isSessionArmed() { return STATE.sessionArmed; }
  disarmSession() { disarmSession(); }
  
  // State
  setStateChangeCallback(callback) { setStateChangeCallback(callback); }
  setSynthesisStateCallback(callback) { setSynthesisStateCallback(callback); }
  getRecognitionState() { return getRecognitionState(); }
  getSynthesisState() { return isSpeaking ? 'speaking' : 'idle'; }
  getEnvironment() { return getEnvironment(); }
  
  // Cleanup
  destroy() { destroy(); }
}

// ============================================
// EXPORTS
// ============================================

const hybridSpeechController = new HybridSpeechController();

export {
  hybridSpeechController,
  speak,
  cancelSpeech,
  checkIsSpeaking as isSpeaking,
  narrateStep,
  speakThenListen,
  startRecognition,
  startRecognitionFromUserGesture,
  stopRecognition,
  setRecognitionCallbacks,
  setStateChangeCallback,
  setSynthesisStateCallback,
  getRecognitionState,
  getEnvironment,
  isSessionArmed,
  disarmSession,
};

export default hybridSpeechController;
