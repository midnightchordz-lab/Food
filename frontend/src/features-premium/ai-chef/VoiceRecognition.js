/**
 * Voice Recognition - Handles speech-to-text
 * Works on Web, iOS, and Android (including Capacitor native apps)
 * Supports CONTINUOUS HANDS-FREE listening mode
 * 100% isolated - no dependencies on existing code
 * 
 * Cross-Platform Strategy:
 * - Web: Uses Web Speech API (SpeechRecognition)
 * - iOS Native (Capacitor): Uses @capacitor-community/speech-recognition if available
 * - Android Native (Capacitor): Uses @capacitor-community/speech-recognition if available
 * - Fallback: Web Speech API on all platforms
 */

import platformDetector from './PlatformDetector';

// Try to import Capacitor Speech Recognition (may not be available)
let CapacitorSpeechRecognition = null;
try {
  // Dynamic import check - will be null if not installed
  if (window.Capacitor?.Plugins?.SpeechRecognition) {
    CapacitorSpeechRecognition = window.Capacitor.Plugins.SpeechRecognition;
    console.log('[VoiceRecognition] Capacitor SpeechRecognition plugin detected');
  }
} catch (e) {
  console.log('[VoiceRecognition] Capacitor SpeechRecognition not available, using Web API');
}

class VoiceRecognition {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.shouldAutoRestart = false;
    this.continuousMode = false; // Hands-free continuous listening
    this.onResult = null;
    this.onStateChange = null;
    this.onError = null;
    this.restartTimer = null;
    this.restartAttempts = 0;
    this.maxRestartAttempts = 10; // Prevent infinite restart loops
    this.useCapacitor = false; // Track which API we're using
    this.capacitorListener = null; // Store listener for cleanup
    
    this.initialize();
  }

  async initialize() {
    // Check if we should use Capacitor native API
    const isNative = platformDetector.isNative();
    
    if (isNative && CapacitorSpeechRecognition) {
      try {
        // Check if Capacitor Speech Recognition is available
        const available = await CapacitorSpeechRecognition.available();
        if (available.available) {
          this.useCapacitor = true;
          console.log('[VoiceRecognition] Using Capacitor native speech recognition');
          this.setupCapacitorHandlers();
          return;
        }
      } catch (e) {
        console.log('[VoiceRecognition] Capacitor speech check failed, falling back to Web API:', e);
      }
    }
    
    // Fallback to Web Speech API
    this.initializeWebSpeechAPI();
  }
  
  initializeWebSpeechAPI() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.warn('[VoiceRecognition] Speech Recognition not supported');
      return;
    }

    try {
      this.recognition = new SpeechRecognition();
      
      // Platform-specific settings
      const isAndroid = platformDetector.isAndroid();
      const isIOS = platformDetector.isIOS();
      
      // iOS Safari has specific requirements for continuous mode
      // Android Chrome works better with short bursts + auto-restart
      if (isIOS) {
        // iOS: continuous mode but shorter sessions
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
      } else if (isAndroid) {
        // Android: short bursts work better, auto-restart handles continuity
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
      } else {
        // Desktop: full continuous mode
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
      }
      
      this.recognition.maxAlternatives = 1;
      this.recognition.lang = 'en-US';

      this.setupEventHandlers();
      
      // Detect Brave browser (may have issues with Google Speech API)
      if (navigator.brave && navigator.brave.isBrave) {
        console.warn('[VoiceRecognition] Brave browser detected - may need to allow Google services for voice recognition');
      }
      
      console.log(`[VoiceRecognition] Web Speech API initialized (platform: ${platformDetector.getPlatform()})`);
    } catch (error) {
      console.error('[VoiceRecognition] Failed to initialize:', error);
      this.recognition = null;
    }
  }
  
  setupCapacitorHandlers() {
    // Capacitor speech recognition event setup
    // Will be called when using native Capacitor plugin
    console.log('[VoiceRecognition] Setting up Capacitor handlers');
  }

  setupEventHandlers() {
    if (!this.recognition) return;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.restartAttempts = 0; // Reset on successful start
      this.networkErrorCount = 0; // Reset network errors on successful start
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
