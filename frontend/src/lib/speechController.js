/**
 * GLOBAL SPEECH CONTROLLER - Singleton Pattern
 * 
 * MOBILE AUDIO FOCUS SEQUENCING
 * 
 * SINGLE AUDIO OWNER RULE:
 * Mobile OS allows only ONE audio owner at a time.
 * TTS and Recognition CANNOT run simultaneously.
 * 
 * TURN-TAKING SEQUENCE (Mobile):
 * 1. User taps Start Cooking (arms session)
 * 2. TTS narrates full step
 * 3. TTS onend fires
 * 4. Delay 400ms (audio focus buffer)
 * 5. Start Recognition
 * 6. Command detected → callback fires
 * 7. Stop Recognition
 * 8. Delay 200ms
 * 9. Speak next step
 * 10. Repeat from step 2
 * 
 * STRICT RULES:
 * - Recognition NEVER starts while TTS is speaking
 * - TTS NEVER starts while Recognition is active
 * - One initial tap arms the session
 * - After armed, continuous speak-listen loop
 * - Only cancel on: user pause, step change, exit cooking mode
 */

// Singleton instance
let instance = null;

// ============================================
// ENVIRONMENT DETECTION
// ============================================

let isMobile = false;
let isWebView = false;
let isSecureContext = true;
let isPWA = false;
let environmentChecked = false;

function detectEnvironment() {
  if (typeof window === 'undefined') {
    return { isMobile: false, isWebView: false, isSecureContext: false, isPWA: false, isSupported: false };
  }
  
  if (environmentChecked) {
    return { isMobile, isWebView, isSecureContext, isPWA, isSupported: isSecureContext };
  }
  
  const userAgent = navigator.userAgent || '';
  isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) ||
    ('ontouchstart' in window) ||
    (navigator.maxTouchPoints && navigator.maxTouchPoints > 2) ||
    (window.innerWidth <= 768 && 'ontouchstart' in window);
  
  isWebView = !!(
    window.Capacitor ||
    window.cordova ||
    userAgent.includes('wv') ||
    userAgent.includes('WebView') ||
    (userAgent.includes('iPhone') && !userAgent.includes('Safari')) ||
    (userAgent.includes('Android') && userAgent.includes('Version/')) ||
    (window.webkit && window.webkit.messageHandlers)
  );
  
  isPWA = window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator?.standalone === true;
  
  isSecureContext = window.isSecureContext === true || 
    window.location.protocol === 'https:' || 
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';
  
  environmentChecked = true;
  
  console.log(`[SpeechController] Environment: Mobile=${isMobile}, WebView=${isWebView}, Secure=${isSecureContext}`);
  
  return { isMobile, isWebView, isSecureContext, isPWA, isSupported: isSecureContext };
}

function getEnvironment() {
  if (!environmentChecked) detectEnvironment();
  return { isMobile, isWebView, isSecureContext, isPWA, micPermissionState };
}

// ============================================
// AUDIO FOCUS MANAGEMENT (MOBILE)
// ============================================

// Audio owner states
const AUDIO_OWNER = {
  NONE: 'none',
  TTS: 'tts',
  RECOGNITION: 'recognition'
};

let currentAudioOwner = AUDIO_OWNER.NONE;
let sessionArmed = false; // One-time activation flag

// Audio focus delay buffers (ms)
const AUDIO_DELAYS = {
  TTS_TO_RECOGNITION: 400, // After TTS ends, before recognition starts
  RECOGNITION_TO_TTS: 200, // After recognition stops, before TTS starts
  RECOGNITION_COOLDOWN: 100 // Brief cooldown after stopping recognition
};

/**
 * Check if we can acquire audio focus for an engine
 */
function canAcquireAudioFocus(requestedOwner) {
  if (!isMobile) return true; // Desktop: no restrictions
  
  // Single audio owner rule
  if (currentAudioOwner === AUDIO_OWNER.NONE) return true;
  if (currentAudioOwner === requestedOwner) return true;
  
  console.log(`[AudioFocus] BLOCKED: ${requestedOwner} cannot start while ${currentAudioOwner} is active`);
  return false;
}

/**
 * Acquire audio focus
 */
function acquireAudioFocus(owner) {
  if (isMobile && currentAudioOwner !== AUDIO_OWNER.NONE && currentAudioOwner !== owner) {
    console.log(`[AudioFocus] WARNING: Forcing ${owner}, releasing ${currentAudioOwner}`);
  }
  currentAudioOwner = owner;
  console.log(`[AudioFocus] Acquired by: ${owner}`);
}

/**
 * Release audio focus
 */
function releaseAudioFocus(owner) {
  if (currentAudioOwner === owner) {
    currentAudioOwner = AUDIO_OWNER.NONE;
    console.log(`[AudioFocus] Released by: ${owner}`);
  }
}

// ============================================
// SYNTHESIS ENGINE (TTS)
// ============================================

let synthesisInstance = null;
let currentUtterance = null;
let isSpeaking = false;
let speechCancelled = false;
let onSpeechEndCallback = null;
let keepAliveTimer = null;
let selectedVoice = null;
let voicesLoaded = false;
let voiceLoadAttempts = 0;

let synthesisState = 'idle';
let synthesisStateCallback = null;

const SYNTHESIS_CONFIG = {
  SPEECH_RATE: 0.95,
  SPEECH_PITCH: 1,
  SPEECH_VOLUME: 1,
  KEEP_ALIVE_INTERVAL: 10000,
  CHUNK_MAX_LENGTH: 180,
  SAFETY_TIMEOUT: 8000,
};

function setSynthesisState(state) {
  synthesisState = state;
  console.log('[TTS] State:', state);
  synthesisStateCallback?.(state);
}

function initSynthesis() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.log('[TTS] Not supported');
    setSynthesisState('error');
    return false;
  }
  
  synthesisInstance = window.speechSynthesis;
  loadVoices();
  synthesisInstance.onvoiceschanged = loadVoices;
  
  console.log('[TTS] Initialized');
  return true;
}

function loadVoices() {
  if (voicesLoaded || voiceLoadAttempts >= 2) return;
  voiceLoadAttempts++;
  
  const voices = window.speechSynthesis?.getVoices() || [];
  if (voices.length === 0) return;
  
  voicesLoaded = true;
  selectedVoice = voices.find(v => 
    v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Alex')
  ) || voices.find(v => v.lang.startsWith('en') && v.localService
  ) || voices.find(v => v.lang.startsWith('en')
  ) || voices[0];
  
  console.log(`[TTS] Voice: ${selectedVoice?.name || 'default'}`);
}

function checkIsSpeaking() {
  return isSpeaking || (synthesisInstance?.speaking === true);
}

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
 * Speak text with SINGLE AUDIO OWNER enforcement
 * On mobile: Stops recognition first, acquires TTS focus
 */
function speak(text, onComplete = null) {
  if (!synthesisInstance && !initSynthesis()) {
    onComplete?.();
    return false;
  }
  
  if (text === null || text === undefined) {
    onComplete?.();
    return false;
  }
  
  let cleanText = String(text).replace(/<[^>]*>/g, '').trim();
  if (cleanText === '') {
    onComplete?.();
    return false;
  }
  
  // Already speaking - block
  if (isSpeaking) {
    console.log('[TTS] Already speaking, blocking');
    return false;
  }
  
  // MOBILE: Single audio owner - stop recognition first
  if (isMobile && isListening) {
    console.log('[TTS] Mobile: Stopping recognition before TTS');
    forceStopRecognition();
  }
  
  // Check audio focus
  if (!canAcquireAudioFocus(AUDIO_OWNER.TTS)) {
    console.log('[TTS] Cannot acquire audio focus');
    onComplete?.();
    return false;
  }
  
  // Ensure voices loaded
  if (!voicesLoaded) {
    loadVoices();
    const voices = window.speechSynthesis?.getVoices() || [];
    if (voices.length > 0 && !selectedVoice) selectedVoice = voices[0];
  }
  
  // Acquire focus and lock
  acquireAudioFocus(AUDIO_OWNER.TTS);
  isSpeaking = true;
  speechCancelled = false;
  onSpeechEndCallback = onComplete;
  setSynthesisState('speaking');
  
  console.log(`[TTS] Speaking: "${cleanText.substring(0, 50)}..."`);
  
  // Safety timeout
  const safetyTimeout = setTimeout(() => {
    if (isSpeaking && !synthesisInstance?.speaking) {
      console.log('[TTS] Safety timeout - releasing');
      releaseSpeechLock();
      onComplete?.();
    }
  }, SYNTHESIS_CONFIG.SAFETY_TIMEOUT);
  
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
  
  const chunks = splitIntoChunks(cleanText);
  let chunkIndex = 0;
  
  const speakNextChunk = () => {
    clearTimeout(safetyTimeout);
    
    if (speechCancelled || chunkIndex >= chunks.length) {
      console.log('[TTS]', speechCancelled ? 'Cancelled' : 'Completed');
      releaseSpeechLock();
      
      if (!speechCancelled && onSpeechEndCallback) {
        const cb = onSpeechEndCallback;
        onSpeechEndCallback = null;
        // MOBILE: Audio focus buffer before callback
        const delay = isMobile ? AUDIO_DELAYS.TTS_TO_RECOGNITION : 50;
        setTimeout(() => cb(), delay);
      }
      return;
    }
    
    const chunkText = chunks[chunkIndex];
    const utterance = new SpeechSynthesisUtterance(chunkText);
    currentUtterance = utterance;
    
    utterance.rate = SYNTHESIS_CONFIG.SPEECH_RATE;
    utterance.pitch = SYNTHESIS_CONFIG.SPEECH_PITCH;
    utterance.volume = SYNTHESIS_CONFIG.SPEECH_VOLUME;
    if (selectedVoice) utterance.voice = selectedVoice;
    
    utterance.onstart = () => {
      console.log('[TTS] >>> AUDIO PLAYING');
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
      chunkIndex++;
      setTimeout(speakNextChunk, 100);
    };
    
    utterance.onerror = (event) => {
      console.log('[TTS] Error:', event.error);
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

function releaseSpeechLock() {
  isSpeaking = false;
  currentUtterance = null;
  releaseAudioFocus(AUDIO_OWNER.TTS);
  setSynthesisState('idle');
  
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}

/**
 * Cancel speech - USER ACTIONS ONLY
 */
function cancelSpeech(reason = 'unknown') {
  if (!synthesisInstance) return;
  
  // Strict user-only whitelist
  const userOnlyReasons = ['userPause', 'userNext', 'userBack', 'userRepeat', 'modalClose', 'disableHandsFree', 'destroy'];
  
  if (!userOnlyReasons.includes(reason)) {
    if (reason !== 'unknown') {
      console.log('[TTS] BLOCKED cancel:', reason);
    }
    return;
  }
  
  if (!isSpeaking && !synthesisInstance?.speaking) return;
  
  console.log('[TTS] Canceling:', reason);
  speechCancelled = true;
  synthesisInstance.cancel();
  releaseSpeechLock();
  onSpeechEndCallback = null;
}

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

let recognitionInstance = null;
let isListening = false;
let shouldBeListening = false;
let pendingRecognitionStart = false;
let recognitionCallbacks = {
  onResult: null,
  onStart: null,
  onEnd: null,
  onError: null,
};

let recognitionState = 'idle';
let recognitionStateCallback = null;
let micPermissionState = 'unknown';

function setRecognitionState(state) {
  recognitionState = state;
  console.log('[Recognition] State:', state);
  recognitionStateCallback?.(state);
}

function getRecognitionState() {
  return recognitionState;
}

async function checkMicPermission() {
  try {
    if (navigator.permissions) {
      const result = await navigator.permissions.query({ name: 'microphone' });
      micPermissionState = result.state;
      result.onchange = () => {
        micPermissionState = result.state;
        if (micPermissionState === 'denied') setRecognitionState('disabled');
      };
    }
  } catch (e) {
    micPermissionState = 'unknown';
  }
  return micPermissionState;
}

function initRecognition() {
  detectEnvironment();
  
  if (!isSecureContext) {
    console.log('[Recognition] Not secure context');
    setRecognitionState('disabled');
    return false;
  }
  
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.log('[Recognition] Not supported');
    setRecognitionState('disabled');
    return false;
  }
  
  recognitionInstance = new SpeechRecognition();
  recognitionInstance.continuous = true;
  recognitionInstance.interimResults = false;
  recognitionInstance.lang = 'en-US';
  recognitionInstance.maxAlternatives = 1;
  
  recognitionInstance.onstart = () => {
    isListening = true;
    pendingRecognitionStart = false;
    setRecognitionState('listening');
    console.log('[Recognition] >>> LISTENING');
    recognitionCallbacks.onStart?.();
  };
  
  recognitionInstance.onresult = (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
    console.log('[Recognition] Heard:', transcript);
    recognitionCallbacks.onResult?.(transcript);
  };
  
  recognitionInstance.onerror = (event) => {
    console.log('[Recognition] Error:', event.error);
    isListening = false;
    pendingRecognitionStart = false;
    releaseAudioFocus(AUDIO_OWNER.RECOGNITION);
    
    if (event.error === 'not-allowed') {
      micPermissionState = 'denied';
      setRecognitionState('permission-needed');
      shouldBeListening = false;
      sessionArmed = false;
      recognitionCallbacks.onError?.(event.error);
      return;
    }
    
    if (event.error === 'aborted') {
      recognitionCallbacks.onError?.(event.error);
      return;
    }
    
    setRecognitionState('error');
    recognitionCallbacks.onError?.(event.error);
  };
  
  recognitionInstance.onend = () => {
    const wasListening = isListening;
    isListening = false;
    releaseAudioFocus(AUDIO_OWNER.RECOGNITION);
    console.log('[Recognition] Ended');
    
    if (recognitionState !== 'permission-needed' && recognitionState !== 'disabled') {
      setRecognitionState('idle');
    }
    
    recognitionCallbacks.onEnd?.();
    
    // MOBILE: If session armed and should be listening, restart after delay
    // But ONLY if TTS is not speaking
    if (isMobile && sessionArmed && shouldBeListening && wasListening && !isSpeaking) {
      console.log('[Recognition] Mobile: Will restart after buffer');
      setTimeout(() => {
        if (shouldBeListening && !isListening && !isSpeaking) {
          safeStartRecognition();
        }
      }, AUDIO_DELAYS.RECOGNITION_COOLDOWN);
    }
  };
  
  // Tab visibility
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && isListening) {
        console.log('[Recognition] Tab hidden - pausing');
        forceStopRecognition();
      }
    });
  }
  
  console.log('[Recognition] Initialized');
  return true;
}

function safeStartRecognition() {
  if (!recognitionInstance) return false;
  if (isListening || pendingRecognitionStart) return true;
  
  // MOBILE: Single audio owner - cannot start while TTS is speaking
  if (isMobile && isSpeaking) {
    console.log('[Recognition] BLOCKED: TTS is speaking');
    return false;
  }
  
  if (!canAcquireAudioFocus(AUDIO_OWNER.RECOGNITION)) {
    return false;
  }
  
  try {
    pendingRecognitionStart = true;
    acquireAudioFocus(AUDIO_OWNER.RECOGNITION);
    recognitionInstance.start();
    return true;
  } catch (e) {
    pendingRecognitionStart = false;
    releaseAudioFocus(AUDIO_OWNER.RECOGNITION);
    
    if (e.name === 'InvalidStateError') {
      console.log('[Recognition] Already starting, retry later');
      setTimeout(() => {
        if (shouldBeListening && !isListening && !isSpeaking) {
          safeStartRecognition();
        }
      }, 200);
      return true;
    }
    console.log('[Recognition] Start failed:', e.message);
    setRecognitionState('error');
    return false;
  }
}

function forceStopRecognition() {
  if (!recognitionInstance) return;
  
  pendingRecognitionStart = false;
  
  try {
    recognitionInstance.abort();
  } catch (e) {}
  
  isListening = false;
  releaseAudioFocus(AUDIO_OWNER.RECOGNITION);
}

/**
 * Start recognition - PUBLIC API
 * MOBILE: Only starts if TTS not speaking
 */
function startRecognition() {
  detectEnvironment();
  
  if (!isSecureContext) {
    setRecognitionState('disabled');
    return false;
  }
  
  if (!recognitionInstance && !initRecognition()) return false;
  
  if (isListening) {
    console.log('[Recognition] Already listening');
    return true;
  }
  
  // MOBILE: Block if TTS is speaking (single audio owner)
  if (isMobile && isSpeaking) {
    console.log('[Recognition] Mobile: TTS speaking, will start after TTS ends');
    shouldBeListening = true;
    return false;
  }
  
  // MOBILE: Require session armed (initial user tap)
  if (isMobile && !sessionArmed) {
    console.log('[Recognition] Mobile: Session not armed, need user tap');
    setRecognitionState('permission-needed');
    return false;
  }
  
  shouldBeListening = true;
  setRecognitionState('starting');
  
  return safeStartRecognition();
}

/**
 * Start recognition from user gesture - ARMS SESSION
 * This is THE mobile activation entry point
 */
function startRecognitionFromUserGesture() {
  console.log('[Recognition] User gesture - arming session');
  sessionArmed = true;
  
  // Reset error states
  if (micPermissionState === 'denied') micPermissionState = 'prompt';
  if (recognitionState === 'error' || recognitionState === 'permission-needed') {
    setRecognitionState('idle');
  }
  
  // MOBILE: If TTS is speaking, just arm the session - recognition will start after TTS ends
  if (isMobile && isSpeaking) {
    console.log('[Recognition] TTS speaking - armed for later');
    shouldBeListening = true;
    return true;
  }
  
  shouldBeListening = true;
  return safeStartRecognition();
}

/**
 * Stop recognition
 */
function stopRecognition() {
  shouldBeListening = false;
  forceStopRecognition();
  setRecognitionState('idle');
  console.log('[Recognition] Stopped');
}

/**
 * Disable session - clears armed state
 */
function disarmSession() {
  sessionArmed = false;
  shouldBeListening = false;
  forceStopRecognition();
  console.log('[Recognition] Session disarmed');
}

function setRecognitionCallbacks(callbacks) {
  recognitionCallbacks = {
    onResult: callbacks.onResult || null,
    onStart: callbacks.onStart || null,
    onEnd: callbacks.onEnd || null,
    onError: callbacks.onError || null,
  };
  
  if (callbacks.onResult) {
    console.log('[Recognition] Callbacks set');
  }
}

function setStateChangeCallback(callback) {
  recognitionStateCallback = callback;
}

function setSynthesisStateCallback(callback) {
  synthesisStateCallback = callback;
}

// ============================================
// TURN-TAKING HELPERS
// ============================================

/**
 * Start recognition after TTS completes (mobile turn-taking)
 * Called automatically when TTS ends and session is armed
 */
function startRecognitionAfterTTS() {
  if (!sessionArmed || !shouldBeListening) return;
  if (isListening) return;
  
  // Audio focus buffer delay
  setTimeout(() => {
    if (shouldBeListening && !isListening && !isSpeaking) {
      console.log('[TurnTaking] TTS ended -> Starting recognition');
      safeStartRecognition();
    }
  }, AUDIO_DELAYS.TTS_TO_RECOGNITION);
}

/**
 * Speak and auto-start recognition after (mobile turn-taking)
 */
function speakThenListen(text, stepNumber, totalSteps) {
  return narrateStep(text, stepNumber, totalSteps, () => {
    if (isMobile && sessionArmed) {
      startRecognitionAfterTTS();
    }
  });
}

/**
 * Check if session is armed
 */
function isSessionArmed() {
  return sessionArmed;
}

// ============================================
// SINGLETON CONTROLLER CLASS
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
    
    this.initialized = true;
    console.log('[SpeechController] Ready');
    return this;
  }
  
  // Synthesis
  speak(text, onComplete) { return speak(text, onComplete); }
  cancel(reason) { cancelSpeech(reason); }
  isSpeaking() { return checkIsSpeaking(); }
  narrateStep(text, stepNumber, totalSteps, onComplete) {
    return narrateStep(text, stepNumber, totalSteps, onComplete);
  }
  speakThenListen(text, stepNumber, totalSteps) {
    return speakThenListen(text, stepNumber, totalSteps);
  }
  
  // Recognition
  startListening() { return startRecognition(); }
  startListeningFromGesture() { return startRecognitionFromUserGesture(); }
  stopListening() { stopRecognition(); }
  isListening() { return isListening; }
  setRecognitionCallbacks(callbacks) { setRecognitionCallbacks(callbacks); }
  
  // Session
  isSessionArmed() { return sessionArmed; }
  disarmSession() { disarmSession(); }
  
  // State
  setStateChangeCallback(callback) { setStateChangeCallback(callback); }
  setSynthesisStateCallback(callback) { setSynthesisStateCallback(callback); }
  getRecognitionState() { return getRecognitionState(); }
  getSynthesisState() { return synthesisState; }
  getEnvironment() { return getEnvironment(); }
  
  // Cleanup
  destroy() {
    cancelSpeech('destroy');
    disarmSession();
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

export default speechController;
