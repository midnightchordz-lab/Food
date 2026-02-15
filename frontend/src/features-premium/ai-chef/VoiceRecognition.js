/**
 * Voice Recognition - Handles speech-to-text
 * Works on Web, iOS, and Android
 * Supports CONTINUOUS HANDS-FREE listening mode
 * 100% isolated - no dependencies on existing code
 */

import platformDetector from './PlatformDetector';

class VoiceRecognition {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.shouldAutoRestart = false;
    this.continuousMode = false; // NEW: Hands-free continuous listening
    this.onResult = null;
    this.onStateChange = null;
    this.onError = null;
    this.restartTimer = null;
    this.restartAttempts = 0;
    this.maxRestartAttempts = 10; // Prevent infinite restart loops
    
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
    
    // Use continuous mode for web, short bursts + auto-restart for mobile
    this.recognition.continuous = !isAndroid;
    this.recognition.interimResults = true; // Enable interim results for responsive UX
    this.recognition.maxAlternatives = 1;
    this.recognition.lang = 'en-US';

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    if (!this.recognition) return;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.restartAttempts = 0; // Reset on successful start
      console.log('[VoiceRecognition] Started listening (continuous:', this.continuousMode, ')');
      this.onStateChange?.('listening');
    };

    this.recognition.onend = () => {
      this.isListening = false;
      console.log('[VoiceRecognition] Session ended');

      // CONTINUOUS MODE: Auto-restart on ALL platforms when in hands-free mode
      if (this.continuousMode && this.shouldAutoRestart) {
        if (this.restartAttempts < this.maxRestartAttempts) {
          this.restartAttempts++;
          const delay = Math.min(300 * this.restartAttempts, 1500); // Progressive backoff
          console.log(`[VoiceRecognition] Auto-restarting in ${delay}ms (attempt ${this.restartAttempts})`);
          
          this.onStateChange?.('restarting');
          
          this.restartTimer = setTimeout(() => {
            if (this.shouldAutoRestart && this.continuousMode) {
              this.startInternal();
            }
          }, delay);
        } else {
          console.warn('[VoiceRecognition] Max restart attempts reached, pausing');
          this.onStateChange?.('paused');
          // Reset after a longer delay to allow recovery
          setTimeout(() => {
            this.restartAttempts = 0;
            if (this.continuousMode && this.shouldAutoRestart) {
              this.startInternal();
            }
          }, 3000);
        }
      } else {
        this.onStateChange?.('idle');
      }
    };

    this.recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      
      if (result.isFinal) {
        const transcript = result[0].transcript.trim().toLowerCase();
        const confidence = result[0].confidence;
        
        console.log('[VoiceRecognition] Heard:', transcript, `(${Math.round(confidence * 100)}%)`);
        this.restartAttempts = 0; // Reset on successful recognition
        this.onResult?.(transcript, confidence);
      } else {
        // Interim result - show user that we're hearing them
        const interim = result[0].transcript.trim();
        if (interim.length > 0) {
          this.onStateChange?.('hearing');
        }
      }
    };

    this.recognition.onerror = (event) => {
      console.error('[VoiceRecognition] Error:', event.error);
      
      if (event.error === 'not-allowed') {
        this.shouldAutoRestart = false;
        this.continuousMode = false;
        this.onError?.('permission-denied');
      } else if (event.error === 'no-speech') {
        // Normal in continuous mode - just means silence, will auto-restart
        console.log('[VoiceRecognition] No speech detected, continuing to listen...');
        this.onStateChange?.('waiting');
      } else if (event.error === 'aborted') {
        // Manual stop or browser interrupted - don't treat as error
        if (this.continuousMode && this.shouldAutoRestart) {
          // Try to restart if we're in continuous mode
          this.restartTimer = setTimeout(() => {
            if (this.shouldAutoRestart && this.continuousMode) {
              this.startInternal();
            }
          }, 500);
        }
      } else if (event.error === 'network') {
        // Network errors are common with Web Speech API - auto-retry in continuous mode
        console.log('[VoiceRecognition] Network error - will retry in continuous mode');
        this.networkErrorCount = (this.networkErrorCount || 0) + 1;
        
        if (this.continuousMode && this.shouldAutoRestart && this.networkErrorCount < 5) {
          // Retry with exponential backoff
          const retryDelay = Math.min(1000 * this.networkErrorCount, 5000);
          console.log(`[VoiceRecognition] Retrying in ${retryDelay}ms (attempt ${this.networkErrorCount})`);
          this.onStateChange?.('reconnecting');
          
          this.restartTimer = setTimeout(() => {
            if (this.shouldAutoRestart && this.continuousMode) {
              this.startInternal();
            }
          }, retryDelay);
        } else if (this.networkErrorCount >= 5) {
          // Too many network errors - notify user but keep listening capability
          console.warn('[VoiceRecognition] Multiple network errors - pausing auto-reconnect');
          this.onError?.('network-error');
          this.networkErrorCount = 0;
          
          // Reset after a delay and try again
          setTimeout(() => {
            if (this.continuousMode && this.shouldAutoRestart) {
              console.log('[VoiceRecognition] Attempting to restore connection...');
              this.startInternal();
            }
          }, 10000);
        } else {
          this.onError?.('network-error');
        }
      } else if (event.error === 'audio-capture') {
        // Microphone issue - inform user
        this.onError?.('audio-capture-error');
      } else if (event.error === 'service-not-allowed') {
        // Service blocked - inform user
        this.shouldAutoRestart = false;
        this.continuousMode = false;
        this.onError?.('service-blocked');
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

  /**
   * Start listening in TAP-TO-SPEAK mode (original behavior)
   */
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
    this.continuousMode = false;
    this.onStateChange?.('starting');
    return this.startInternal();
  }

  /**
   * Start CONTINUOUS HANDS-FREE listening mode
   * Automatically restarts after speech ends or silence detected
   */
  async startContinuous() {
    if (!this.recognition) {
      throw new Error('Speech recognition not supported');
    }

    // Request permission
    const hasPermission = await this.requestPermission();
    if (!hasPermission) {
      throw new Error('Microphone permission required');
    }

    console.log('[VoiceRecognition] Starting CONTINUOUS hands-free mode');
    this.shouldAutoRestart = true;
    this.continuousMode = true;
    this.restartAttempts = 0;
    this.onStateChange?.('continuous-starting');
    return this.startInternal();
  }

  /**
   * Check if in continuous hands-free mode
   */
  isContinuousMode() {
    return this.continuousMode;
  }

  stop() {
    this.shouldAutoRestart = false;
    this.continuousMode = false;
    
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
    this.restartAttempts = 0;
    this.onStateChange?.('idle');
  }

  /**
   * Temporarily pause continuous listening (e.g., while AI is speaking)
   */
  pause() {
    console.log('[VoiceRecognition] Pausing continuous mode');
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
    this.onStateChange?.('paused');
  }

  /**
   * Resume continuous listening after pause
   */
  async resume() {
    if (!this.continuousMode) {
      console.log('[VoiceRecognition] Not in continuous mode, using regular start');
      return this.start();
    }

    console.log('[VoiceRecognition] Resuming continuous mode');
    this.shouldAutoRestart = true;
    this.restartAttempts = 0;
    this.onStateChange?.('resuming');
    
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(this.startInternal());
      }, 300);
    });
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
