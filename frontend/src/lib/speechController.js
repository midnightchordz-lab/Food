/**
 * SPEECH CONTROLLER - CLEAN RESET (Dec 2025)
 * 
 * Single centralized module for all speech operations.
 * No other component may directly call speech APIs.
 * 
 * SUPPORTED OPERATIONS:
 * - initialize()     - Must be called before any speech operations
 * - speak(text)      - TTS narration
 * - startListening() - Voice recognition  
 * - stopListening()  - Stop recognition
 * - destroy()        - Full cleanup
 * 
 * MOBILE AUDIO RULES:
 * - TTS and Recognition CANNOT run simultaneously
 * - User tap required to "arm" session on mobile
 * - Turn-taking: TTS → pause → Recognition → pause → TTS
 * 
 * MOBILE COMPATIBILITY (Feb 2026):
 * - Uses mobileVoiceCompat for iOS speech synthesis
 * - Uses mobileSpeechRecognition for iOS speech recognition
 * - Uses AndroidVoiceEngine for Android (production-grade)
 * - Handles AudioContext initialization, voice loading, permissions
 */

import { mobileVoiceCompat, initVoiceModeForMobile } from '../utils/mobileVoiceCompat';
import { mobileSpeechRecognition } from '../utils/mobileSpeechRecognition';
import { androidVoiceEngine } from '../services/AndroidVoiceEngine';

// ============================================
// STATE
// ============================================

let initialized = false;
let destroyed = false;
let mobileInitialized = false;
let androidEngineActive = false;

// Environment
let isMobile = false;
let isIOS = false;
let isAndroid = false;
let isSecureContext = true;

// TTS State
let synthesis = null;
let currentUtterance = null;
let isSpeaking = false;
let selectedVoice = null;
let voicesLoaded = false;
let speechEndCallback = null;
let keepAliveInterval = null;

// Recognition State
let recognition = null;
let isListening = false;
let sessionArmed = false;
let shouldBeListening = false;

// Callbacks
let onRecognitionResult = null;
let onRecognitionStateChange = null;
let onSynthesisStateChange = null;

// ============================================
// ENVIRONMENT DETECTION
// ============================================

function detectEnvironment() {
  if (typeof window === 'undefined') {
    return { isMobile: false, isIOS: false, isAndroid: false, isSecureContext: false };
  }
  
  const ua = navigator.userAgent || '';
  
  isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  isAndroid = /Android/.test(ua);
  isMobile = isIOS || isAndroid || 
    /webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
    ('ontouchstart' in window) ||
    (navigator.maxTouchPoints > 2);
  
  isSecureContext = window.isSecureContext === true || 
    window.location.protocol === 'https:' || 
    window.location.hostname === 'localhost';
  
  console.log(`[Speech] Environment: mobile=${isMobile}, iOS=${isIOS}, Android=${isAndroid}, secure=${isSecureContext}`);
  return { isMobile, isIOS, isAndroid, isSecureContext };
}

function getEnvironment() {
  return { isMobile, isIOS, isAndroid, isSecureContext, sessionArmed };
}

// ============================================
// TTS ENGINE
// ============================================

function initTTS() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.log('[TTS] Not supported');
    return false;
  }
  
  synthesis = window.speechSynthesis;
  
  // Load voices
  const loadVoices = () => {
    const voices = synthesis.getVoices();
    if (voices.length === 0) return;
    
    voicesLoaded = true;
    selectedVoice = voices.find(v => 
      v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Alex')
    ) || voices.find(v => v.lang.startsWith('en') && v.localService
    ) || voices.find(v => v.lang.startsWith('en')
    ) || voices[0];
    
    console.log('[TTS] Voice:', selectedVoice?.name);
  };
  
  loadVoices();
  synthesis.onvoiceschanged = loadVoices;
  
  console.log('[TTS] Ready');
  return true;
}

/**
 * Initialize mobile voice compatibility
 * Called from user gesture to enable iOS/Android speech
 */
async function initMobileVoice() {
  if (mobileInitialized) return true;
  
  if (!isMobile) {
    mobileInitialized = true;
    return true;
  }
  
  console.log('[TTS] Initializing mobile voice compatibility...');
  
  try {
    // ANDROID: Use production-grade Android Voice Engine
    if (isAndroid) {
      const success = await androidVoiceEngine.initialize();
      if (success) {
        androidEngineActive = true;
        
        // Setup callbacks
        androidVoiceEngine.setOnCommand((transcript) => {
          console.log('[Android] Command received:', transcript);
          onRecognitionResult?.(transcript);
        });
        
        androidVoiceEngine.setOnListeningStart(() => {
          isListening = true;
          onRecognitionStateChange?.('listening');
        });
        
        androidVoiceEngine.setOnListeningEnd(() => {
          isListening = false;
          onRecognitionStateChange?.('idle');
        });
        
        androidVoiceEngine.setOnSpeakingStart(() => {
          isSpeaking = true;
          onSynthesisStateChange?.('speaking');
        });
        
        androidVoiceEngine.setOnSpeakingEnd(() => {
          isSpeaking = false;
          onSynthesisStateChange?.('idle');
        });
        
        androidVoiceEngine.setOnPermissionDenied(() => {
          sessionArmed = false;
          shouldBeListening = false;
          onRecognitionStateChange?.('permission-needed');
        });
        
        mobileInitialized = true;
        console.log('[TTS] Android Voice Engine ready');
        return true;
      }
    }
    
    // iOS: Use mobile compat layers
    await initVoiceModeForMobile();
    mobileInitialized = true;
    console.log('[TTS] Mobile voice compatibility ready');
    return true;
  } catch (e) {
    console.error('[TTS] Mobile voice init failed:', e);
    return false;
  }
}

/**
 * Speak text with TTS
 * @param {string} text - Text to speak
 * @param {function} onComplete - Callback when done
 */
function speak(text, onComplete = null) {
  if (destroyed) {
    onComplete?.();
    return false;
  }
  
  // Validate input
  if (text === null || text === undefined) {
    onComplete?.();
    return false;
  }
  
  const cleanText = String(text).replace(/<[^>]*>/g, '').trim();
  if (!cleanText) {
    onComplete?.();
    return false;
  }
  
  // ANDROID: Use production-grade Android Voice Engine
  if (isAndroid && androidEngineActive) {
    return speakWithAndroidEngine(cleanText, onComplete);
  }
  
  if (!synthesis) {
    if (!initTTS()) {
      onComplete?.();
      return false;
    }
  }
  
  // Block if already speaking
  if (isSpeaking) {
    console.log('[TTS] Already speaking');
    return false;
  }
  
  // MOBILE: Stop recognition first (single audio owner)
  if (isMobile && isListening) {
    console.log('[TTS] Stopping recognition for TTS');
    forceStopRecognition();
  }
  
  // iOS: Use mobile compat for long text
  if (isIOS && cleanText.length > 200) {
    return speakWithMobileCompat(cleanText, onComplete);
  }
  
  // Ensure voices loaded
  if (!voicesLoaded) {
    const voices = synthesis.getVoices();
    if (voices.length > 0) {
      // iOS: Prefer local voices
      if (isIOS) {
        selectedVoice = voices.find(v => v.lang.startsWith('en') && v.localService === true) ||
          voices.find(v => v.lang.startsWith('en')) || voices[0];
      } else {
        selectedVoice = voices.find(v => v.lang.startsWith('en')) || voices[0];
      }
      voicesLoaded = true;
    }
  }
  
  // Set state
  isSpeaking = true;
  speechEndCallback = onComplete;
  onSynthesisStateChange?.('speaking');
  
  console.log('[TTS] Speaking:', cleanText.substring(0, 60) + (cleanText.length > 60 ? '...' : ''));
  
  // Create utterance
  const utterance = new SpeechSynthesisUtterance(cleanText);
  currentUtterance = utterance;
  
  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.volume = 1;
  if (selectedVoice) utterance.voice = selectedVoice;
  
  utterance.onstart = () => {
    console.log('[TTS] >>> STARTED');
    // Chrome keep-alive workaround
    if (keepAliveInterval) clearInterval(keepAliveInterval);
    keepAliveInterval = setInterval(() => {
      if (synthesis?.speaking && !synthesis?.paused) {
        synthesis.pause();
        synthesis.resume();
      }
    }, 10000);
  };
  
  utterance.onend = () => {
    console.log('[TTS] <<< ENDED');
    cleanupTTS();
    
    const cb = speechEndCallback;
    speechEndCallback = null;
    
    // Delay before callback (audio focus handoff)
    setTimeout(() => cb?.(), isMobile ? 400 : 50);
  };
  
  utterance.onerror = (e) => {
    console.log('[TTS] Error:', e.error);
    
    // Don't treat interrupted/canceled as errors
    if (e.error === 'interrupted' || e.error === 'canceled') {
      cleanupTTS();
      speechEndCallback?.();
      speechEndCallback = null;
      return;
    }
    
    cleanupTTS();
    speechEndCallback?.();
    speechEndCallback = null;
  };
  
  // Start speaking
  synthesis.speak(utterance);
  
  // Safari kick - resume if stuck
  setTimeout(() => {
    if (currentUtterance === utterance && !synthesis?.speaking) {
      try { synthesis?.resume(); } catch {}
    }
  }, 250);
  
  return true;
}

/**
 * Speak using mobile compatibility layer (for iOS long text)
 */
async function speakWithMobileCompat(text, onComplete) {
  isSpeaking = true;
  onSynthesisStateChange?.('speaking');
  
  try {
    await mobileVoiceCompat.speak(text, { rate: 0.9 });
  } catch (e) {
    console.error('[TTS] Mobile compat speak failed:', e);
  }
  
  cleanupTTS();
  
  // Delay before callback (audio focus handoff)
  setTimeout(() => onComplete?.(), isMobile ? 400 : 50);
  return true;
}

/**
 * Speak using Android Voice Engine (production-grade)
 */
async function speakWithAndroidEngine(text, onComplete) {
  // Stop recognition first (single audio owner)
  if (isListening) {
    androidVoiceEngine.stopListening();
    isListening = false;
  }
  
  isSpeaking = true;
  onSynthesisStateChange?.('speaking');
  
  try {
    await androidVoiceEngine.speak(text, { rate: 0.95 });
  } catch (e) {
    console.error('[TTS] Android engine speak failed:', e);
  }
  
  isSpeaking = false;
  onSynthesisStateChange?.('idle');
  
  // Delay before callback (audio focus handoff)
  setTimeout(() => onComplete?.(), 400);
  return true;
}

function cleanupTTS() {
  isSpeaking = false;
  currentUtterance = null;
  onSynthesisStateChange?.('idle');
  
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
}

/**
 * Cancel speech (user actions only)
 */
function cancelSpeech(reason = 'unknown') {
  const validReasons = ['userPause', 'userNext', 'userBack', 'userRepeat', 'modalClose', 'disableHandsFree', 'destroy'];
  
  if (!validReasons.includes(reason)) {
    return;
  }
  
  // ANDROID: Use Android engine's force stop
  if (isAndroid && androidEngineActive) {
    androidVoiceEngine.forceStopSpeech();
    isSpeaking = false;
    onSynthesisStateChange?.('idle');
    return;
  }
  
  if (!synthesis || (!isSpeaking && !synthesis?.speaking)) return;
  
  console.log('[TTS] Cancel:', reason);
  synthesis.cancel();
  cleanupTTS();
  speechEndCallback = null;
}

function checkIsSpeaking() {
  // ANDROID: Check Android engine state
  if (isAndroid && androidEngineActive) {
    return androidVoiceEngine.getSpeakingStatus();
  }
  return isSpeaking || (synthesis?.speaking === true);
}

/**
 * Narrate a cooking step
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
// RECOGNITION ENGINE
// ============================================

function initRecognition() {
  if (!isSecureContext) {
    console.log('[Recognition] Not secure context');
    return false;
  }
  
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.log('[Recognition] Not supported');
    return false;
  }
  
  // Destroy existing instance
  if (recognition) {
    try { recognition.abort(); } catch {}
    recognition = null;
  }
  
  // Create fresh instance
  recognition = new SpeechRecognition();
  
  // Android: Use continuous = false for better reliability
  recognition.continuous = !isAndroid;
  recognition.interimResults = false;
  recognition.lang = 'en-US';
  recognition.maxAlternatives = 1;
  
  recognition.onstart = () => {
    isListening = true;
    console.log('[Recognition] >>> LISTENING');
    onRecognitionStateChange?.('listening');
  };
  
  recognition.onresult = (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
    console.log('[Recognition] Heard:', transcript);
    onRecognitionResult?.(transcript);
  };
  
  recognition.onerror = (event) => {
    console.log('[Recognition] Error:', event.error);
    isListening = false;
    
    if (event.error === 'not-allowed') {
      sessionArmed = false;
      shouldBeListening = false;
      onRecognitionStateChange?.('permission-needed');
      return;
    }
    
    if (event.error === 'aborted') {
      return;
    }
    
    // Android: Auto-restart on no-speech
    if (event.error === 'no-speech' && isAndroid && shouldBeListening) {
      setTimeout(() => {
        if (shouldBeListening && !isListening && !isSpeaking && !destroyed) {
          safeStartRecognition();
        }
      }, 500);
      return;
    }
    
    onRecognitionStateChange?.('error');
  };
  
  recognition.onend = () => {
    const wasListening = isListening;
    isListening = false;
    console.log('[Recognition] <<< ENDED');
    
    onRecognitionStateChange?.('idle');
    
    // Auto-restart if armed and should be listening (not during TTS)
    // Android: Always auto-restart when shouldBeListening
    if (sessionArmed && shouldBeListening && wasListening && !isSpeaking) {
      const restartDelay = isAndroid ? 100 : 100;
      setTimeout(() => {
        if (shouldBeListening && !isListening && !isSpeaking && !destroyed) {
          safeStartRecognition();
        }
      }, restartDelay);
    }
  };
  
  // Tab visibility handler
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && isListening) {
        forceStopRecognition();
      }
    });
  }
  
  // Setup mobile recognition callbacks
  if (isMobile) {
    mobileSpeechRecognition.setOnResult((transcript) => {
      console.log('[Recognition] Mobile heard:', transcript);
      onRecognitionResult?.(transcript);
    });
    
    mobileSpeechRecognition.setOnStateChange((state) => {
      console.log('[Recognition] Mobile state:', state);
      if (state === 'listening') {
        isListening = true;
        onRecognitionStateChange?.('listening');
      } else if (state === 'idle' || state === 'aborted') {
        isListening = false;
        onRecognitionStateChange?.('idle');
      } else if (state === 'permission-denied') {
        sessionArmed = false;
        shouldBeListening = false;
        onRecognitionStateChange?.('permission-needed');
      }
    });
    
    mobileSpeechRecognition.setOnPermissionDenied(() => {
      sessionArmed = false;
      shouldBeListening = false;
      onRecognitionStateChange?.('permission-needed');
    });
  }
  
  console.log('[Recognition] Ready');
  return true;
}

function safeStartRecognition() {
  if (destroyed) return false;
  
  // MOBILE: Block if TTS speaking
  if (isMobile && isSpeaking) {
    console.log('[Recognition] Blocked - TTS speaking');
    return false;
  }
  
  // ANDROID: Use Android Voice Engine for recognition
  if (isAndroid && androidEngineActive) {
    if (androidVoiceEngine.getListeningStatus()) return true;
    
    try {
      androidVoiceEngine.startListening();
      return true;
    } catch (e) {
      console.log('[Recognition] Android engine start failed:', e.message);
      onRecognitionStateChange?.('error');
      return false;
    }
  }
  
  // iOS: Use mobile speech recognition for better reliability
  if (isIOS && mobileSpeechRecognition.isSupported()) {
    if (mobileSpeechRecognition.getIsListening()) return true;
    
    try {
      mobileSpeechRecognition.start();
      return true;
    } catch (e) {
      console.log('[Recognition] Mobile start failed:', e.message);
      onRecognitionStateChange?.('error');
      return false;
    }
  }
  
  // Desktop: Use standard Web Speech API
  if (!recognition || isListening) return false;
  
  try {
    recognition.start();
    return true;
  } catch (e) {
    if (e.name === 'InvalidStateError') {
      // Already running or starting
      setTimeout(() => {
        if (shouldBeListening && !isListening && !isSpeaking && !destroyed) {
          safeStartRecognition();
        }
      }, 200);
      return true;
    }
    console.log('[Recognition] Start failed:', e.message);
    onRecognitionStateChange?.('error');
    return false;
  }
}

function forceStopRecognition() {
  // ANDROID: Use Android engine's stop
  if (isAndroid && androidEngineActive) {
    androidVoiceEngine.stopListening();
  }
  
  // iOS: Stop mobile recognition
  if (isIOS && mobileSpeechRecognition.isSupported()) {
    mobileSpeechRecognition.abort();
  }
  
  // Stop desktop recognition
  if (recognition) {
    try {
      recognition.abort();
    } catch {}
  }
  
  isListening = false;
}

/**
 * Start listening (public API)
 */
function startListening() {
  if (!isSecureContext) {
    onRecognitionStateChange?.('disabled');
    return false;
  }
  
  // ANDROID: Use Android engine
  if (isAndroid && androidEngineActive) {
    if (androidVoiceEngine.getListeningStatus()) return true;
    
    if (isSpeaking) {
      shouldBeListening = true;
      return false;
    }
    
    shouldBeListening = true;
    onRecognitionStateChange?.('starting');
    return safeStartRecognition();
  }
  
  if (!recognition && !initRecognition()) return false;
  
  if (isListening) return true;
  
  // MOBILE: Block if TTS speaking
  if (isMobile && isSpeaking) {
    shouldBeListening = true;
    return false;
  }
  
  // MOBILE: Require session armed
  if (isMobile && !sessionArmed) {
    onRecognitionStateChange?.('permission-needed');
    return false;
  }
  
  shouldBeListening = true;
  onRecognitionStateChange?.('starting');
  
  return safeStartRecognition();
}

/**
 * Start listening from user gesture (arms session on mobile)
 */
async function startListeningFromGesture() {
  console.log('[Recognition] User gesture - arming session');
  sessionArmed = true;
  
  // MOBILE: Initialize mobile voice compatibility (AudioContext, prewarm, voices)
  if (isMobile && !mobileInitialized) {
    await initMobileVoice();
  }
  
  // MOBILE: Request microphone permission first
  if (isMobile && mobileSpeechRecognition.isSupported()) {
    try {
      const hasPermission = await mobileSpeechRecognition.requestPermission();
      if (!hasPermission) {
        onRecognitionStateChange?.('permission-needed');
        return false;
      }
    } catch (e) {
      console.log('[Recognition] Permission request failed:', e);
      onRecognitionStateChange?.('permission-needed');
      return false;
    }
  }
  
  // MOBILE: If TTS speaking, just arm session
  if (isMobile && isSpeaking) {
    shouldBeListening = true;
    return true;
  }
  
  shouldBeListening = true;
  
  if (!recognition && !initRecognition()) {
    onRecognitionStateChange?.('error');
    return false;
  }
  
  return safeStartRecognition();
}

/**
 * Stop listening
 */
function stopListening() {
  shouldBeListening = false;
  forceStopRecognition();
  onRecognitionStateChange?.('idle');
}

/**
 * Disarm session
 */
function disarmSession() {
  sessionArmed = false;
  shouldBeListening = false;
  forceStopRecognition();
  
  // Also stop mobile recognition
  if (isMobile && mobileSpeechRecognition.isSupported()) {
    mobileSpeechRecognition.stop();
  }
  
  console.log('[Recognition] Session disarmed');
}

function checkIsListening() {
  return isListening;
}

function checkIsSessionArmed() {
  return sessionArmed;
}

function getRecognitionState() {
  if (!isSecureContext) return 'disabled';
  if (isListening) return 'listening';
  return 'idle';
}

// ============================================
// TURN-TAKING (MOBILE)
// ============================================

/**
 * Speak then start listening (mobile turn-taking)
 */
function speakThenListen(text, stepNumber, totalSteps) {
  return narrateStep(text, stepNumber, totalSteps, () => {
    if (isMobile && sessionArmed && shouldBeListening) {
      setTimeout(() => {
        if (shouldBeListening && !isListening && !isSpeaking && !destroyed) {
          safeStartRecognition();
        }
      }, 400);
    }
  });
}

// ============================================
// CALLBACKS
// ============================================

function setRecognitionCallbacks(callbacks) {
  onRecognitionResult = callbacks.onResult || null;
  console.log('[Recognition] Callbacks set');
}

function setStateChangeCallback(callback) {
  onRecognitionStateChange = callback;
}

function setSynthesisStateCallback(callback) {
  onSynthesisStateChange = callback;
}

// ============================================
// LIFECYCLE
// ============================================

/**
 * Initialize speech controller
 * MUST be called before any speech operations
 */
async function initialize() {
  if (initialized && !destroyed) {
    console.log('[Speech] Already initialized');
    return true;
  }
  
  destroyed = false;
  
  detectEnvironment();
  
  const ttsOk = initTTS();
  const recOk = initRecognition();
  
  initialized = ttsOk || recOk;
  
  console.log('[Speech] Initialized:', initialized ? 'OK' : 'FAILED');
  return initialized;
}

/**
 * Initialize for mobile from user gesture
 * Call this when user taps "Start Voice Mode" button
 */
async function initializeFromUserGesture() {
  await initialize();
  
  if (isMobile) {
    await initMobileVoice();
  }
  
  return initialized;
}

/**
 * Full cleanup - destroys all speech instances
 */
function destroy() {
  console.log('[Speech] Destroying...');
  destroyed = true;
  
  // Cancel TTS
  cancelSpeech('destroy');
  
  // Stop recognition
  disarmSession();
  
  // Clear recognition instance
  if (recognition) {
    try { recognition.abort(); } catch {}
    recognition = null;
  }
  
  // Stop mobile recognition
  if (mobileSpeechRecognition.isSupported()) {
    mobileSpeechRecognition.abort();
  }
  
  // Clear callbacks
  onRecognitionResult = null;
  onRecognitionStateChange = null;
  onSynthesisStateChange = null;
  speechEndCallback = null;
  
  // Reset state
  initialized = false;
  mobileInitialized = false;
  isSpeaking = false;
  isListening = false;
  sessionArmed = false;
  shouldBeListening = false;
  
  console.log('[Speech] Destroyed');
}

// ============================================
// SINGLETON CLASS
// ============================================

let instance = null;

class SpeechController {
  constructor() {
    if (instance) return instance;
    instance = this;
  }
  
  async init() {
    await initialize();
    return this;
  }
  
  async initFromUserGesture() {
    await initializeFromUserGesture();
    return this;
  }
  
  // TTS
  speak(text, onComplete) { return speak(text, onComplete); }
  cancel(reason) { cancelSpeech(reason); }
  isSpeaking() { return checkIsSpeaking(); }
  narrateStep(text, step, total, onComplete) { return narrateStep(text, step, total, onComplete); }
  speakThenListen(text, step, total) { return speakThenListen(text, step, total); }
  
  // Recognition
  startListening() { return startListening(); }
  startListeningFromGesture() { return startListeningFromGesture(); }
  stopListening() { stopListening(); }
  isListening() { return checkIsListening(); }
  setRecognitionCallbacks(callbacks) { setRecognitionCallbacks(callbacks); }
  
  // Session
  isSessionArmed() { return checkIsSessionArmed(); }
  disarmSession() { disarmSession(); }
  
  // State
  setStateChangeCallback(callback) { setStateChangeCallback(callback); }
  setSynthesisStateCallback(callback) { setSynthesisStateCallback(callback); }
  getRecognitionState() { return getRecognitionState(); }
  getSynthesisState() { return isSpeaking ? 'speaking' : 'idle'; }
  getEnvironment() { return getEnvironment(); }
  
  // Lifecycle
  destroy() { destroy(); instance = null; }
}

// ============================================
// EXPORTS
// ============================================

export const speechController = new SpeechController();

// Named exports for direct function access
export {
  initialize,
  initializeFromUserGesture,
  initMobileVoice,
  speak,
  cancelSpeech,
  narrateStep,
  speakThenListen,
  checkIsSpeaking as isSpeaking,
  startListening as startRecognition,
  startListeningFromGesture as startRecognitionFromUserGesture,
  stopListening as stopRecognition,
  checkIsListening as isListening,
  setRecognitionCallbacks,
  setStateChangeCallback,
  setSynthesisStateCallback,
  getRecognitionState,
  getEnvironment,
  checkIsSessionArmed as isSessionArmed,
  disarmSession,
  destroy,
};

export default speechController;
