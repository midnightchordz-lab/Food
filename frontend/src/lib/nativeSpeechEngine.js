/**
 * NATIVE SPEECH ENGINE - Capacitor Plugin Integration
 * 
 * This module provides native speech recognition for mobile apps
 * using the @capacitor-community/speech-recognition plugin (Capacitor 5 compatible).
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
      const module = await import('@capacitor-community/speech-recognition');
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
      return { speechRecognition: permissionState };
    } catch {
      permissionState = 'unknown';
      return { speechRecognition: 'unknown' };
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
    return { speechRecognition: 'unknown' };
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
      return { speechRecognition: 'granted' };
    } catch (e) {
      permissionState = 'denied';
      return { speechRecognition: 'denied' };
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
    return { speechRecognition: 'denied' };
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
let partialResultsListener = null;
let listeningStateListener = null;

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
    if (status.speechRecognition !== 'granted') {
      console.log('[NativeSpeech] Permission not granted');
      recognitionCallbacks.onError?.('permission-denied');
      return false;
    }
  }
  
  // Native plugin recognition
  if (ENV.isNative && SpeechRecognition) {
    try {
      // Remove any existing listeners
      await cleanupListeners();
      
      // Add event listeners BEFORE starting (per plugin docs)
      partialResultsListener = await SpeechRecognition.addListener('partialResults', (data) => {
        console.log('[NativeSpeech] Partial results:', data.matches);
        if (data.matches && data.matches.length > 0) {
          const transcript = data.matches[0];
          recognitionCallbacks.onPartialResult?.(transcript);
          // Also treat as final result for command processing
          recognitionCallbacks.onResult?.(transcript);
        }
      });
      
      listeningStateListener = await SpeechRecognition.addListener('listeningState', (data) => {
        console.log('[NativeSpeech] Listening state:', data.status);
        if (data.status === 'started') {
          isListening = true;
          recognitionCallbacks.onStart?.();
        } else if (data.status === 'stopped') {
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
        }
      });
      
      // Start listening
      await SpeechRecognition.start({
        language: options.language || 'en-US',
        maxResults: options.maxResults || 3,
        partialResults: options.partialResults ?? true,
        popup: false, // No popup on Android - required for partialResults
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
  
  await cleanupListeners();
}

/**
 * Clean up event listeners
 */
async function cleanupListeners() {
  if (partialResultsListener) {
    try {
      await partialResultsListener.remove();
    } catch {}
    partialResultsListener = null;
  }
  
  if (listeningStateListener) {
    try {
      await listeningStateListener.remove();
    } catch {}
    listeningStateListener = null;
  }
  
  // Also remove all listeners as safety
  if (ENV.isNative && SpeechRecognition) {
    try {
      await SpeechRecognition.removeAllListeners();
    } catch {}
  }
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

export async function cleanup() {
  await stopRecognition();
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
