/**
 * Voice Recognition - Handles speech-to-text
 * Works on Web, iOS, and Android
 * 100% isolated - no dependencies on existing code
 */

import platformDetector from './PlatformDetector';

class VoiceRecognition {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.shouldAutoRestart = false;
    this.onResult = null;
    this.onStateChange = null;
    this.onError = null;
    this.restartTimer = null;
    
    this.initialize();
  }

  initialize() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.warn('[VoiceRecognition] Speech Recognition not supported');
      return;
    }

    this.recognition = new SpeechRecognition();
    
    // Platform-specific settings
    const isAndroid = platformDetector.isAndroid();
    
    this.recognition.continuous = !isAndroid; // Short bursts on Android
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 1;
    this.recognition.lang = 'en-US';

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    if (!this.recognition) return;

    this.recognition.onstart = () => {
      this.isListening = true;
      console.log('[VoiceRecognition] Started listening');
      this.onStateChange?.('listening');
    };

    this.recognition.onend = () => {
      this.isListening = false;
      console.log('[VoiceRecognition] Stopped listening');
      this.onStateChange?.('idle');

      // Auto-restart on Android
      if (this.shouldAutoRestart && platformDetector.isAndroid()) {
        this.restartTimer = setTimeout(() => {
          if (this.shouldAutoRestart) {
            this.startInternal();
          }
        }, 300);
      }
    };

    this.recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      
      if (result.isFinal) {
        const transcript = result[0].transcript.trim().toLowerCase();
        const confidence = result[0].confidence;
        
        console.log('[VoiceRecognition] Heard:', transcript, `(${Math.round(confidence * 100)}%)`);
        this.onResult?.(transcript, confidence);
      }
    };

    this.recognition.onerror = (event) => {
      console.error('[VoiceRecognition] Error:', event.error);
      
      if (event.error === 'not-allowed') {
        this.shouldAutoRestart = false;
        this.onError?.('permission-denied');
      } else if (event.error === 'no-speech') {
        // Normal - will auto-restart
        this.onStateChange?.('no-speech');
      } else if (event.error === 'aborted') {
        // Ignore - manual stop
      } else {
        this.onError?.(event.error);
      }
    };
  }

  async requestPermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      console.log('[VoiceRecognition] Permission granted');
      return true;
    } catch (error) {
      console.error('[VoiceRecognition] Permission denied:', error);
      return false;
    }
  }

  startInternal() {
    if (!this.recognition || this.isListening) return false;

    try {
      this.recognition.start();
      return true;
    } catch (error) {
      if (error.message?.includes('already started') || error.name === 'InvalidStateError') {
        // Already running
        return true;
      }
      console.error('[VoiceRecognition] Start failed:', error);
      return false;
    }
  }

  async start() {
    if (!this.recognition) {
      throw new Error('Speech recognition not supported');
    }

    // Request permission on mobile
    if (platformDetector.isMobile()) {
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        throw new Error('Microphone permission required');
      }
    }

    this.shouldAutoRestart = true;
    this.onStateChange?.('starting');
    return this.startInternal();
  }

  stop() {
    this.shouldAutoRestart = false;
    
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {
        // Ignore
      }
    }
    
    this.isListening = false;
    this.onStateChange?.('idle');
  }

  setOnResult(callback) {
    this.onResult = callback;
  }

  setOnStateChange(callback) {
    this.onStateChange = callback;
  }

  setOnError(callback) {
    this.onError = callback;
  }

  getIsListening() {
    return this.isListening;
  }

  isSupported() {
    return this.recognition !== null;
  }

  destroy() {
    this.stop();
    this.onResult = null;
    this.onStateChange = null;
    this.onError = null;
  }
}

export const voiceRecognition = new VoiceRecognition();
export default voiceRecognition;
