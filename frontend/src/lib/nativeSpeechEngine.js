/**
 * NATIVE SPEECH ENGINE - Capacitor Plugin Integration
 * 
 * This module provides native speech recognition and synthesis for mobile apps
 * using the @capgo/capacitor-speech-recognition plugin.
 * 
 * ARCHITECTURE:
 * - Mobile (Capacitor native): Uses native plugin for recognition, Web Speech API for TTS
 * - Desktop/Web: Falls back to Web Speech API for both
 * 
 * DESIGN PRINCIPLES:
 * 1. Native plugin provides better accuracy and battery life on mobile
 * 2. Graceful fallback to Web Speech API when native unavailable
 * 3. Same API interface regardless of underlying engine
 * 4. Proper permission handling for native platforms
 */

import { Capacitor } from '@capacitor/core';

// Lazy import to avoid errors on web
let SpeechRecognition = null;

// ============================================
// ENVIRONMENT DETECTION
// ============================================

const ENV = {
  isNative: false,
  platform: 'web',
  isIOS: false,
  isAndroid: false,
  hasNativePlugin: false,
  hasWebSpeech: false,
  isSecureContext: true,
};

let envInitialized = false;

async function initEnvironment() {
  if (envInitialized) return ENV;
  
  ENV.isNative = Capacitor.isNativePlatform();
  ENV.platform = Capacitor.getPlatform();
  ENV.isIOS = ENV.platform === 'ios';
  ENV.isAndroid = ENV.platform === 'android';
  ENV.isSecureContext = typeof window !== 'undefined' && 
    (window.isSecureContext || window.location.protocol === 'https:' || window.location.hostname === 'localhost');
  
  // Check Web Speech API availability
  ENV.hasWebSpeech = typeof window !== 'undefined' && 
    ('speechSynthesis' in window) && 
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  
  // Check native plugin availability
  if (ENV.isNative) {
    try {
      const module = await import('@capgo/capacitor-speech-recognition');
      SpeechRecognition = module.SpeechRecognition;
      ENV.hasNativePlugin = !!SpeechRecognition;
      console.log('[NativeSpeech] Native plugin loaded successfully');
    } catch (e) {
      console.log('[NativeSpeech] Native plugin not available:', e.message);
      ENV.hasNativePlugin = false;
    }
  }
  
  envInitialized = true;
  console.log('[NativeSpeech] Environment:', ENV);
  return ENV;
}

export function getEnvironment() {
  return { ...ENV };
}

export function isNativeAvailable() {
  return ENV.isNative && ENV.hasNativePlugin;
}

// ============================================
// PERMISSION HANDLING
// ============================================

let permissionState = 'unknown'; // 'unknown', 'granted', 'denied', 'prompt'

/**
 * Check current permission state
 */
export async function checkPermissions() {
  await initEnvironment();
  
  if (!ENV.isNative || !SpeechRecognition) {
    // Web fallback - check via navigator.permissions
    try {
      const result = await navigator.permissions.query({ name: 'microphone' });
      permissionState = result.state;
      return { status: permissionState };
    } catch {
      permissionState = 'unknown';
      return { status: 'unknown' };
    }
  }
  
  try {
    const status = await SpeechRecognition.checkPermissions();
    permissionState = status.speechRecognition;
    console.log('[NativeSpeech] Permission status:', permissionState);
    return status;
  } catch (e) {
    console.error('[NativeSpeech] Permission check error:', e);
    permissionState = 'unknown';
    return { status: 'unknown' };
  }
}

/**
 * Request speech recognition permissions
 * MUST be called from a user gesture on mobile
 */
export async function requestPermissions() {
  await initEnvironment();
  
  if (!ENV.isNative || !SpeechRecognition) {
    // Web fallback - trigger permission via getUserMedia
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      permissionState = 'granted';
      return { status: 'granted' };
    } catch (e) {
      permissionState = 'denied';
      return { status: 'denied' };
    }
  }
  
  try {
    const status = await SpeechRecognition.requestPermissions();
    permissionState = status.speechRecognition;
    console.log('[NativeSpeech] Permission granted:', permissionState);
    return status;
  } catch (e) {
    console.error('[NativeSpeech] Permission request error:', e);
    permissionState = 'denied';
    return { status: 'denied' };
  }
}

export function getPermissionState() {
  return permissionState;
}

// ============================================
// NATIVE RECOGNITION ENGINE
// ============================================

let isListening = false;
let shouldBeListening = false;
let recognitionCallbacks = {
  onResult: null,
  onStart: null,
  onEnd: null,
  onError: null,
  onPartialResult: null,
};
let recognitionListeners = [];

/**
 * Check if recognition is currently active
 */
export function isRecognitionActive() {
  return isListening;
}

/**
 * Set callbacks for recognition events
 */
export function setRecognitionCallbacks(callbacks) {
  recognitionCallbacks = {
    onResult: callbacks.onResult || null,
    onStart: callbacks.onStart || null,
    onEnd: callbacks.onEnd || null,
    onError: callbacks.onError || null,
    onPartialResult: callbacks.onPartialResult || null,
  };
}

/**
 * Start native speech recognition
 * @param {Object} options - Recognition options
 */
export async function startRecognition(options = {}) {
  await initEnvironment();
  
  if (isListening) {
    console.log('[NativeSpeech] Already listening');
    return true;
  }
  
  if (permissionState !== 'granted') {
    const status = await checkPermissions();
    if (status.status !== 'granted') {
      console.log('[NativeSpeech] Permission not granted');
      recognitionCallbacks.onError?.('permission-denied');
      return false;
    }
  }
  
  // Native plugin recognition
  if (ENV.isNative && SpeechRecognition) {
    try {
      // Remove any existing listeners
      cleanupListeners();
      
      // Add event listeners
      const startListener = await SpeechRecognition.addListener('start', () => {
        console.log('[NativeSpeech] Recognition started');
        isListening = true;
        recognitionCallbacks.onStart?.();
      });
      recognitionListeners.push(startListener);
      
      const endListener = await SpeechRecognition.addListener('end', () => {
        console.log('[NativeSpeech] Recognition ended');
        isListening = false;
        recognitionCallbacks.onEnd?.();
        
        // Auto-restart if shouldBeListening is still true
        if (shouldBeListening && !isListening) {
          setTimeout(() => {
            if (shouldBeListening && !isListening) {
              startRecognition(options);
            }
          }, 300);
        }
      });
      recognitionListeners.push(endListener);
      
      const resultListener = await SpeechRecognition.addListener('result', (result) => {
        console.log('[NativeSpeech] Result:', result);
        if (result.value) {
          const transcript = Array.isArray(result.value) ? result.value[0] : result.value;
          recognitionCallbacks.onResult?.(transcript);
        }
      });
      recognitionListeners.push(resultListener);
      
      const partialListener = await SpeechRecognition.addListener('partialResults', (result) => {
        if (result.value && recognitionCallbacks.onPartialResult) {
          const transcript = Array.isArray(result.value) ? result.value[0] : result.value;
          recognitionCallbacks.onPartialResult(transcript);
        }
      });
      recognitionListeners.push(partialListener);
      
      const errorListener = await SpeechRecognition.addListener('error', (error) => {
        console.log('[NativeSpeech] Error:', error);
        isListening = false;
        recognitionCallbacks.onError?.(error.message || 'unknown');
      });
      recognitionListeners.push(errorListener);
      
      // Start listening
      await SpeechRecognition.start({
        language: options.language || 'en-US',
        maxResults: options.maxResults || 3,
        partialResults: options.partialResults ?? true,
        popup: false, // No popup on Android
      });
      
      shouldBeListening = true;
      console.log('[NativeSpeech] Native recognition started');
      return true;
      
    } catch (e) {
      console.error('[NativeSpeech] Start error:', e);
      isListening = false;
      recognitionCallbacks.onError?.(e.message);
      return false;
    }
  }
  
  // Web fallback - should not reach here if using hybrid controller properly
  console.log('[NativeSpeech] Native plugin not available');
  return false;
}

/**
 * Stop speech recognition
 */
export async function stopRecognition() {
  shouldBeListening = false;
  isListening = false;
  
  if (ENV.isNative && SpeechRecognition) {
    try {
      await SpeechRecognition.stop();
      console.log('[NativeSpeech] Recognition stopped');
    } catch (e) {
      console.log('[NativeSpeech] Stop error (ignored):', e.message);
    }
  }
  
  cleanupListeners();
}

/**
 * Clean up event listeners
 */
function cleanupListeners() {
  recognitionListeners.forEach(listener => {
    try {
      listener.remove();
    } catch {}
  });
  recognitionListeners = [];
}

// ============================================
// SUPPORTED LANGUAGES (Native)
// ============================================

let supportedLanguages = null;

/**
 * Get supported languages for native recognition
 */
export async function getSupportedLanguages() {
  await initEnvironment();
  
  if (supportedLanguages) return supportedLanguages;
  
  if (ENV.isNative && SpeechRecognition) {
    try {
      const result = await SpeechRecognition.getSupportedLanguages();
      supportedLanguages = result.languages || [];
      return supportedLanguages;
    } catch {
      supportedLanguages = ['en-US'];
      return supportedLanguages;
    }
  }
  
  // Default for web
  supportedLanguages = ['en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'ja-JP', 'ko-KR', 'zh-CN'];
  return supportedLanguages;
}

// ============================================
// AVAILABILITY CHECK
// ============================================

/**
 * Check if native speech recognition is available
 */
export async function isAvailable() {
  await initEnvironment();
  
  if (!ENV.isNative || !SpeechRecognition) {
    return { available: false, reason: 'not-native' };
  }
  
  try {
    const result = await SpeechRecognition.available();
    return { available: result.available, reason: result.available ? 'ok' : 'not-available' };
  } catch (e) {
    return { available: false, reason: e.message };
  }
}

// ============================================
// CLEANUP
// ============================================

export function cleanup() {
  stopRecognition();
  recognitionCallbacks = {
    onResult: null,
    onStart: null,
    onEnd: null,
    onError: null,
    onPartialResult: null,
  };
}

// Initialize environment on module load
if (typeof window !== 'undefined') {
  initEnvironment().catch(() => {});
}

// ============================================
// EXPORTS
// ============================================

export default {
  getEnvironment,
  isNativeAvailable,
  checkPermissions,
  requestPermissions,
  getPermissionState,
  isRecognitionActive,
  setRecognitionCallbacks,
  startRecognition,
  stopRecognition,
  getSupportedLanguages,
  isAvailable,
  cleanup,
};
