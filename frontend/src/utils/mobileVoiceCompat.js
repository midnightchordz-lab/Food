/**
 * Mobile Voice Compatibility Layer
 * Drop-in replacement for Web Speech API that works on iOS + Android
 * NO FEATURE CHANGES - just makes existing code work
 */

class MobileVoiceCompat {
  constructor() {
    this.platform = this.detectPlatform();
    this.voicesReady = false;
    this.voiceQueue = [];
    this.audioContext = null;
    this.initPromise = null;
  }

  detectPlatform() {
    const ua = navigator.userAgent;
    return {
      isIOS: /iPad|iPhone|iPod/.test(ua) && !window.MSStream,
      isAndroid: /Android/.test(ua),
      isMobile: /Mobile|Android|iPhone|iPad|iPod/.test(ua),
      isSafari: /Safari/.test(ua) && !/Chrome/.test(ua)
    };
  }

  /**
   * Initialize voices - must be called from user interaction
   * This is transparent to existing code
   */
  async ensureVoicesReady() {
    if (this.voicesReady) return true;

    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve) => {
      const synth = window.speechSynthesis;

      // Try getting voices immediately
      let voices = synth.getVoices();

      if (voices.length > 0) {
        this.voicesReady = true;
        console.log('[MobileVoice] Voices ready immediately:', voices.length);
        resolve(true);
        return;
      }

      // Mobile: Wait for voices to load
      console.log('[MobileVoice] Waiting for voices (mobile)...');

      const timeout = setTimeout(() => {
        voices = synth.getVoices();
        if (voices.length > 0) {
          this.voicesReady = true;
          console.log('[MobileVoice] Voices loaded after timeout:', voices.length);
          resolve(true);
        } else {
          console.warn('[MobileVoice] No voices found, proceeding anyway');
          this.voicesReady = true; // Proceed even if no voices
          resolve(false);
        }
      }, 1500); // iOS can take up to 1.5 seconds

      synth.onvoiceschanged = () => {
        clearTimeout(timeout);
        voices = synth.getVoices();
        this.voicesReady = true;
        console.log('[MobileVoice] Voices changed event:', voices.length);
        resolve(true);
      };
    });

    return this.initPromise;
  }

  /**
   * Initialize AudioContext for iOS
   * iOS requires AudioContext to be created from user interaction
   */
  initAudioContext() {
    if (this.audioContext) return;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContext();

      // Resume context if suspended (iOS)
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      console.log('[MobileVoice] AudioContext initialized');
    } catch (e) {
      console.warn('[MobileVoice] AudioContext init failed:', e);
    }
  }

  /**
   * Pre-warm speech synthesis
   * iOS needs this to be called from user interaction
   */
  prewarm() {
    try {
      const synth = window.speechSynthesis;

      // Cancel any existing
      synth.cancel();

      // Speak silence to initialize (iOS requirement)
      const utterance = new SpeechSynthesisUtterance('');
      utterance.volume = 0;
      synth.speak(utterance);

      console.log('[MobileVoice] Speech synthesis prewarmed');
    } catch (e) {
      console.warn('[MobileVoice] Prewarm failed:', e);
    }
  }

  /**
   * Enhanced speak function that works on mobile
   * Drop-in replacement for existing speak calls
   */
  async speak(text, options = {}) {
    const synth = window.speechSynthesis;

    // Ensure voices are ready
    await this.ensureVoicesReady();

    // Cancel any ongoing speech
    synth.cancel();

    // iOS: Split long text automatically
    if (this.platform.isIOS && text.length > 200) {
      return this.speakInChunks(text, options);
    }

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);

      // Configure
      utterance.rate = options.rate || 0.9;
      utterance.pitch = options.pitch || 1.0;
      utterance.volume = options.volume || 1.0;
      utterance.lang = options.lang || 'en-US';

      // Select best voice
      const voices = synth.getVoices();
      if (voices.length > 0) {
        // Prefer local voices on iOS
        let voice = voices.find(v =>
          v.lang.startsWith(utterance.lang.split('-')[0]) &&
          v.localService === true
        );

        if (!voice) {
          voice = voices.find(v => v.lang.startsWith(utterance.lang.split('-')[0]));
        }

        if (!voice) {
          voice = voices[0];
        }

        utterance.voice = voice;
      }

      // Events
      utterance.onstart = () => {
        console.log('[MobileVoice] Speech started');
      };

      utterance.onend = () => {
        console.log('[MobileVoice] Speech ended');
        resolve();
      };

      utterance.onerror = (event) => {
        console.error('[MobileVoice] Speech error:', event.error);

        // Don't reject for "interrupted" - this is normal
        if (event.error === 'interrupted' || event.error === 'canceled') {
          resolve();
        } else {
          reject(new Error(event.error));
        }
      };

      // Queue speech
      try {
        synth.speak(utterance);
      } catch (e) {
        console.error('[MobileVoice] Speak failed:', e);
        reject(e);
      }
    });
  }

  /**
   * Speak in chunks for long text (iOS requirement)
   */
  async speakInChunks(text, options = {}) {
    // Split into sentences
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

    for (const sentence of sentences) {
      if (sentence.trim()) {
        try {
          await this.speak(sentence.trim(), options);
          // Small pause between sentences
          await new Promise(r => setTimeout(r, 150));
        } catch (e) {
          console.error('[MobileVoice] Chunk failed:', e);
          // Continue to next sentence
        }
      }
    }
  }

  /**
   * Cancel speech
   */
  cancel() {
    window.speechSynthesis.cancel();
  }

  /**
   * Check if speaking
   */
  isSpeaking() {
    return window.speechSynthesis.speaking;
  }
}

// Singleton instance
export const mobileVoiceCompat = new MobileVoiceCompat();

/**
 * Initialize function - call this from your "Start Voice Mode" button
 * This handles all mobile initialization in one place
 */
export async function initVoiceModeForMobile() {
  console.log('[MobileVoice] Initializing voice mode for mobile...');

  // 1. Initialize AudioContext (iOS requirement)
  mobileVoiceCompat.initAudioContext();

  // 2. Prewarm speech synthesis (iOS requirement)
  mobileVoiceCompat.prewarm();

  // 3. Load voices
  await mobileVoiceCompat.ensureVoicesReady();

  console.log('[MobileVoice] Voice mode ready for mobile');
  return true;
}

export default mobileVoiceCompat;
