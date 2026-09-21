/**
 * PRODUCTION-GRADE ANDROID VOICE ENGINE
 * Handles both TTS and STT with military-grade reliability
 * 
 * Key optimizations:
 * - Aggressive cleanup to prevent sluggishness
 * - Proper audio initialization
 * - Event loop optimization
 * - Memory leak prevention
 * - Fallback mechanisms
 */

class AndroidVoiceEngine {
  constructor() {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.recognition = null;
    this.isInitialized = false;
    this.isSpeaking = false;
    this.isListening = false;
    this.audioContext = null;
    this.currentUtterance = null;
    this.recognitionRestartTimer = null;
    this.voicesCache = [];
    this.shouldAutoRestart = false;
    
    // Performance optimization flags
    this.useAggressiveCleanup = true;
    this.useEventThrottling = true;
    
    // Platform detection
    this.platform = {
      isAndroid: typeof navigator !== 'undefined' && /Android/.test(navigator.userAgent),
      chromeVersion: this.getChromeVersion()
    };

    // Callbacks
    this.onCommand = null;
    this.onListeningStart = null;
    this.onListeningEnd = null;
    this.onPermissionDenied = null;
    this.onNetworkError = null;
    this.onSpeakingStart = null;
    this.onSpeakingEnd = null;

    console.log('[AndroidVoice] Engine created');
  }

  getChromeVersion() {
    if (typeof navigator === 'undefined') return 0;
    const match = navigator.userAgent.match(/Chrome\/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  // ═══════════════════════════════════════════════════════════
  // INITIALIZATION — CALL FROM USER INTERACTION
  // ═══════════════════════════════════════════════════════════

  async initialize() {
    if (this.isInitialized) {
      console.log('[AndroidVoice] Already initialized');
      return true;
    }

    console.log('[AndroidVoice] Initializing...');

    try {
      // Step 1: Initialize Audio System
      await this.initializeAudioSystem();

      // Step 2: Load voices
      await this.loadVoices();

      // Step 3: Initialize Speech Recognition
      this.initializeSpeechRecognition();

      // Step 4: Setup cleanup handlers
      this.setupCleanupHandlers();

      this.isInitialized = true;
      console.log('[AndroidVoice] Ready');
      return true;

    } catch (error) {
      console.error('[AndroidVoice] Initialization failed:', error);
      return false;
    }
  }

  // ───────────────────────────────────────────────────────────
  // Audio System Initialization
  // ───────────────────────────────────────────────────────────

  async initializeAudioSystem() {
    console.log('[AndroidVoice] Initializing audio system...');

    // Method 1: AudioContext initialization
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContext();

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      console.log('[AndroidVoice] AudioContext state:', this.audioContext.state);
    } catch (e) {
      console.warn('[AndroidVoice] AudioContext failed:', e);
    }

    // Method 2: Play silent audio to unlock audio system
    try {
      const silentAudio = new Audio(
        'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='
      );
      silentAudio.volume = 0.01;
      await silentAudio.play();
      console.log('[AndroidVoice] Silent audio played');
    } catch (e) {
      console.warn('[AndroidVoice] Silent audio failed:', e);
    }

    // Method 3: Prewarm speech synthesis
    try {
      if (this.synth) {
        this.synth.cancel();
        const prewarm = new SpeechSynthesisUtterance('');
        prewarm.volume = 0;
        this.synth.speak(prewarm);
        console.log('[AndroidVoice] Speech synthesis prewarmed');
      }
    } catch (e) {
      console.warn('[AndroidVoice] Prewarm failed:', e);
    }

    // Wait for audio to be ready
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // ───────────────────────────────────────────────────────────
  // Voice Loading with Caching
  // ───────────────────────────────────────────────────────────

  async loadVoices() {
    if (!this.synth) return;

    return new Promise((resolve) => {
      this.voicesCache = this.synth.getVoices();

      if (this.voicesCache.length > 0) {
        console.log('[AndroidVoice] Voices loaded immediately:', this.voicesCache.length);
        resolve();
        return;
      }

      console.log('[AndroidVoice] Waiting for voices...');

      const timeout = setTimeout(() => {
        this.voicesCache = this.synth.getVoices();
        console.log('[AndroidVoice] Voices (timeout):', this.voicesCache.length);
        resolve();
      }, 500);

      this.synth.onvoiceschanged = () => {
        clearTimeout(timeout);
        this.voicesCache = this.synth.getVoices();
        console.log('[AndroidVoice] Voices (event):', this.voicesCache.length);
        resolve();
      };
    });
  }

  selectBestVoice(lang = 'en-US') {
    if (this.voicesCache.length === 0) return null;

    // Priority: Google voices > English > Default > Any
    let voice = this.voicesCache.find(v =>
      v.name.toLowerCase().includes('google') &&
      v.lang.startsWith(lang.split('-')[0])
    );

    if (!voice) {
      voice = this.voicesCache.find(v => v.lang.startsWith(lang.split('-')[0]));
    }

    if (!voice) {
      voice = this.voicesCache.find(v => v.default);
    }

    if (!voice) {
      voice = this.voicesCache[0];
    }

    return voice;
  }

  // ═══════════════════════════════════════════════════════════
  // SPEECH SYNTHESIS (TTS) — OPTIMIZED FOR ANDROID
  // ═══════════════════════════════════════════════════════════

  async speak(text, options = {}) {
    if (!text || text.trim().length === 0) {
      console.warn('[AndroidVoice] Empty text, skipping speak');
      return;
    }

    if (!this.synth) {
      console.error('[AndroidVoice] Speech synthesis not available');
      return;
    }

    console.log('[AndroidVoice] Speaking:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));

    // CRITICAL: Cancel any existing speech AGGRESSIVELY
    this.forceStopSpeech();

    // Wait for cancel to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);

      // Configure utterance
      utterance.lang = options.lang || 'en-US';
      utterance.rate = options.rate || 0.95; // Slightly slower for clarity
      utterance.pitch = options.pitch || 1.0;
      utterance.volume = 1.0; // Always max

      // Select voice
      const voice = this.selectBestVoice(utterance.lang);
      if (voice) {
        utterance.voice = voice;
        console.log('[AndroidVoice] Voice:', voice.name);
      }

      let hasStarted = false;
      let hasEnded = false;

      // Event handlers
      utterance.onstart = () => {
        hasStarted = true;
        this.isSpeaking = true;
        this.currentUtterance = utterance;
        console.log('[AndroidVoice] Speech started');
        this.onSpeakingStart?.();
      };

      utterance.onend = () => {
        hasEnded = true;
        this.isSpeaking = false;
        this.currentUtterance = null;
        console.log('[AndroidVoice] Speech ended');
        this.onSpeakingEnd?.();
        resolve();
      };

      utterance.onerror = (event) => {
        console.error('[AndroidVoice] Speech error:', event.error);
        this.isSpeaking = false;
        this.currentUtterance = null;
        this.onSpeakingEnd?.();

        // Don't fail on interrupted/cancelled
        if (event.error === 'interrupted' || event.error === 'canceled') {
          resolve();
        } else {
          reject(new Error(event.error));
        }
      };

      // Speak
      try {
        this.synth.speak(utterance);
        console.log('[AndroidVoice] Queued to speak');
      } catch (error) {
        console.error('[AndroidVoice] Speak threw:', error);
        this.isSpeaking = false;
        reject(error);
      }

      // Safety timeout: If speech doesn't start in 2 seconds, something is wrong
      setTimeout(() => {
        if (!hasStarted && !hasEnded) {
          console.error('[AndroidVoice] Speech timeout - never started');
          console.error('   Synth state:', {
            speaking: this.synth.speaking,
            pending: this.synth.pending,
            paused: this.synth.paused
          });

          this.forceStopSpeech();
          reject(new Error('Speech timeout'));
        }
      }, 2000);
    });
  }

  // Aggressive speech cancellation
  forceStopSpeech() {
    if (!this.synth) return;

    if (this.isSpeaking || this.synth.speaking || this.synth.pending) {
      console.log('[AndroidVoice] Force stopping speech');

      // Method 1: Cancel
      this.synth.cancel();

      // Method 2: Clear current utterance
      this.currentUtterance = null;

      // Method 3: Pause and cancel (some browsers need this)
      if (this.synth.speaking) {
        this.synth.pause();
        this.synth.cancel();
      }

      this.isSpeaking = false;
      this.onSpeakingEnd?.();
    }
  }

  // ═══════════════════════════════════════════════════════════
  // SPEECH RECOGNITION (STT) — OPTIMIZED FOR RESPONSIVENESS
  // ═══════════════════════════════════════════════════════════

  initializeSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('[AndroidVoice] Speech Recognition not supported');
      return;
    }

    this.recognition = new SpeechRecognition();

    // Android optimization: Short bursts instead of continuous
    this.recognition.continuous = false; // More responsive on Android
    this.recognition.interimResults = false; // Only final results
    this.recognition.maxAlternatives = 1; // Faster processing
    this.recognition.lang = 'en-US';

    // Event handlers
    this.recognition.onstart = () => {
      this.isListening = true;
      console.log('[AndroidVoice] Listening started');
      this.onListeningStart?.();
    };

    this.recognition.onend = () => {
      this.isListening = false;
      console.log('[AndroidVoice] Listening ended');
      this.onListeningEnd?.();

      // Auto-restart with delay (prevents sluggishness)
      if (this.shouldAutoRestart) {
        // Clear any existing restart timer
        if (this.recognitionRestartTimer) {
          clearTimeout(this.recognitionRestartTimer);
        }

        // Restart after small delay
        this.recognitionRestartTimer = setTimeout(() => {
          if (this.shouldAutoRestart && !this.isSpeaking) {
            this.startListeningInternal().catch(console.error);
          }
        }, 300); // 300ms delay prevents event loop congestion
      }
    };

    this.recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];

      if (result.isFinal) {
        const transcript = result[0].transcript.trim().toLowerCase();
        const confidence = result[0].confidence;

        console.log('[AndroidVoice] Heard:', transcript, `(${Math.round(confidence * 100)}%)`);

        // Throttle rapid commands to prevent sluggishness
        if (this.useEventThrottling) {
          this.throttledCommandHandler(transcript);
        } else {
          this.onCommand?.(transcript);
        }
      }
    };

    this.recognition.onerror = (event) => {
      console.error('[AndroidVoice] Recognition error:', event.error);

      // Handle specific errors
      if (event.error === 'not-allowed') {
        console.error('[AndroidVoice] Microphone permission denied');
        this.onPermissionDenied?.();
        this.shouldAutoRestart = false;
      } else if (event.error === 'no-speech') {
        // Normal - just restart
        console.log('[AndroidVoice] No speech detected, continuing...');
      } else if (event.error === 'network') {
        console.error('[AndroidVoice] Network error');
        this.onNetworkError?.();
      } else if (event.error === 'aborted') {
        // Ignore - this is from manual stop
      }
    };

    console.log('[AndroidVoice] Speech Recognition configured');
  }

  // Throttle commands to prevent sluggishness
  throttledCommandHandler = (() => {
    let lastCommandTime = 0;
    const throttleMs = 500; // Min 500ms between commands

    return (transcript) => {
      const now = Date.now();
      if (now - lastCommandTime < throttleMs) {
        console.log('[AndroidVoice] Command throttled:', transcript);
        return;
      }

      lastCommandTime = now;
      this.onCommand?.(transcript);
    };
  })();

  // Internal start without permission check
  async startListeningInternal() {
    if (!this.recognition) return false;

    try {
      this.recognition.start();
      return true;
    } catch (error) {
      if (error.message && error.message.includes('already started')) {
        // Already started - restart
        this.recognition.stop();
        setTimeout(() => this.startListeningInternal(), 100);
        return true;
      } else if (error.name === 'InvalidStateError') {
        // Already running
        return true;
      }
      console.error('[AndroidVoice] Recognition start failed:', error);
      return false;
    }
  }

  async startListening() {
    if (!this.recognition) {
      throw new Error('Speech recognition not initialized');
    }

    // Request microphone permission
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      console.log('[AndroidVoice] Microphone permission OK');
    } catch (error) {
      console.error('[AndroidVoice] Microphone denied:', error);
      throw new Error('Microphone permission required');
    }

    // Start recognition
    this.shouldAutoRestart = true;
    return this.startListeningInternal();
  }

  stopListening() {
    this.shouldAutoRestart = false;

    if (this.recognitionRestartTimer) {
      clearTimeout(this.recognitionRestartTimer);
      this.recognitionRestartTimer = null;
    }

    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {
        // Ignore
      }
    }
    
    this.isListening = false;
  }

  // ═══════════════════════════════════════════════════════════
  // CLEANUP — PREVENT MEMORY LEAKS & SLUGGISHNESS
  // ═══════════════════════════════════════════════════════════

  setupCleanupHandlers() {
    if (typeof document === 'undefined') return;

    // Cleanup on page visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        console.log('[AndroidVoice] Page hidden, cleaning up...');
        this.cleanup();
      }
    });

    // Cleanup on beforeunload
    window.addEventListener('beforeunload', () => {
      console.log('[AndroidVoice] Page unloading, cleaning up...');
      this.cleanup();
    });
  }

  cleanup() {
    console.log('[AndroidVoice] Cleaning up...');

    // Stop speech
    this.forceStopSpeech();

    // Stop listening
    this.stopListening();

    // Clear timers
    if (this.recognitionRestartTimer) {
      clearTimeout(this.recognitionRestartTimer);
      this.recognitionRestartTimer = null;
    }

    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(console.warn);
    }
  }

  destroy() {
    this.cleanup();
    this.isInitialized = false;
    console.log('[AndroidVoice] Destroyed');
  }

  // ═══════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════

  setOnCommand(callback) {
    this.onCommand = callback;
  }

  setOnListeningStart(callback) {
    this.onListeningStart = callback;
  }

  setOnListeningEnd(callback) {
    this.onListeningEnd = callback;
  }

  setOnSpeakingStart(callback) {
    this.onSpeakingStart = callback;
  }

  setOnSpeakingEnd(callback) {
    this.onSpeakingEnd = callback;
  }

  setOnPermissionDenied(callback) {
    this.onPermissionDenied = callback;
  }

  setOnNetworkError(callback) {
    this.onNetworkError = callback;
  }

  getSpeakingStatus() {
    return this.isSpeaking;
  }

  getListeningStatus() {
    return this.isListening;
  }

  getIsInitialized() {
    return this.isInitialized;
  }
}

// Singleton instance
export const androidVoiceEngine = new AndroidVoiceEngine();
export default androidVoiceEngine;
