/**
 * Mobile Speech Recognition Compatibility
 * Handles permission requests and auto-restart for Android
 */

class MobileSpeechRecognition {
  constructor() {
    this.supported = false;
    this.recognition = null;
    this.isListening = false;
    this.shouldRestart = false;
    this.platform = this.detectPlatform();
    this.onResult = null;
    this.onPermissionDenied = null;
    this.onStateChange = null;
    this.permissionGranted = false;
    
    this.initRecognition();
  }

  detectPlatform() {
    const ua = navigator.userAgent;
    return {
      isIOS: /iPad|iPhone|iPod/.test(ua),
      isAndroid: /Android/.test(ua),
      isMobile: /Mobile|Android|iPhone|iPad|iPod/.test(ua)
    };
  }

  initRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      this.supported = false;
      console.warn('[MobileSpeechRecog] Speech Recognition not supported');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.supported = true;

    this.setupRecognition();
  }

  setupRecognition() {
    if (!this.recognition) return;

    // Android: Use continuous = false for better reliability
    this.recognition.continuous = !this.platform.isAndroid;
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 1;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      console.log('[MobileSpeechRecog] Recognition started');
      this.isListening = true;
      this.onStateChange?.('listening');
    };

    this.recognition.onend = () => {
      console.log('[MobileSpeechRecog] Recognition ended');
      this.isListening = false;
      this.onStateChange?.('idle');

      // Android: Auto-restart if shouldRestart is true
      if (this.shouldRestart && this.platform.isAndroid) {
        console.log('[MobileSpeechRecog] Auto-restarting (Android)');
        setTimeout(() => {
          if (this.shouldRestart) {
            this.startInternal();
          }
        }, 100);
      }
    };

    this.recognition.onerror = (event) => {
      console.error('[MobileSpeechRecog] Recognition error:', event.error);
      this.isListening = false;

      // Handle errors
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        this.permissionGranted = false;
        this.shouldRestart = false;
        this.onStateChange?.('permission-denied');
        this.onPermissionDenied?.();
      } else if (event.error === 'no-speech') {
        // Auto-restart after no-speech
        this.onStateChange?.('no-speech');
        if (this.shouldRestart) {
          setTimeout(() => {
            if (this.shouldRestart) {
              this.startInternal();
            }
          }, 500);
        }
      } else if (event.error === 'aborted') {
        // Ignore aborted errors (normal when stopping)
        this.onStateChange?.('aborted');
      } else {
        this.onStateChange?.('error');
      }
    };

    this.recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];

      if (result.isFinal) {
        const transcript = result[0].transcript.toLowerCase().trim();
        console.log('[MobileSpeechRecog] Heard:', transcript);

        if (this.onResult) {
          this.onResult(transcript);
        }
      }
    };
  }

  /**
   * Request microphone permission (mobile requirement)
   */
  async requestPermission() {
    if (this.permissionGranted) return true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Stop tracks immediately - we just needed permission
      stream.getTracks().forEach(track => track.stop());

      this.permissionGranted = true;
      console.log('[MobileSpeechRecog] Microphone permission granted');
      return true;
    } catch (error) {
      this.permissionGranted = false;
      console.error('[MobileSpeechRecog] Microphone permission denied:', error);
      return false;
    }
  }

  /**
   * Internal start without permission check
   */
  startInternal() {
    if (!this.supported || !this.recognition) return false;

    try {
      this.recognition.start();
      return true;
    } catch (error) {
      // Already started - restart
      if (error.message && error.message.includes('already started')) {
        this.recognition.stop();
        setTimeout(() => this.startInternal(), 100);
        return true;
      } else if (error.name === 'InvalidStateError') {
        // Already running, that's ok
        return true;
      }
      console.error('[MobileSpeechRecog] Start failed:', error);
      return false;
    }
  }

  /**
   * Start recognition with mobile optimizations
   */
  async start() {
    if (!this.supported) {
      throw new Error('Speech recognition not supported');
    }

    // Mobile: Request permission first
    if (this.platform.isMobile) {
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        throw new Error('Microphone permission required');
      }
    }

    this.shouldRestart = true;
    this.onStateChange?.('starting');
    return this.startInternal();
  }

  /**
   * Start from user gesture (important for mobile)
   */
  async startFromUserGesture() {
    console.log('[MobileSpeechRecog] Starting from user gesture');
    return this.start();
  }

  /**
   * Stop recognition
   */
  stop() {
    this.shouldRestart = false;
    if (this.isListening && this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        // Ignore
      }
    }
    this.isListening = false;
    this.onStateChange?.('idle');
  }

  /**
   * Abort recognition immediately
   */
  abort() {
    this.shouldRestart = false;
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (e) {
        // Ignore
      }
    }
    this.isListening = false;
  }

  /**
   * Set result callback
   */
  setOnResult(callback) {
    this.onResult = callback;
  }

  /**
   * Set permission denied callback
   */
  setOnPermissionDenied(callback) {
    this.onPermissionDenied = callback;
  }

  /**
   * Set state change callback
   */
  setOnStateChange(callback) {
    this.onStateChange = callback;
  }

  /**
   * Check if currently listening
   */
  getIsListening() {
    return this.isListening;
  }

  /**
   * Check if supported
   */
  isSupported() {
    return this.supported;
  }

  /**
   * Reinitialize recognition instance
   * Useful after errors or for fresh start
   */
  reinitialize() {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (e) {
        // Ignore
      }
      this.recognition = null;
    }
    this.isListening = false;
    this.shouldRestart = false;
    this.initRecognition();
  }
}

export const mobileSpeechRecognition = new MobileSpeechRecognition();
export default mobileSpeechRecognition;
