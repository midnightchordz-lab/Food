/**
 * Platform Detector - Detects current platform (Web, iOS, Android)
 * Cross-platform compatible for Capacitor native apps
 * 100% isolated - no dependencies on existing code
 */

class PlatformDetector {
  constructor() {
    this.userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    this.platform = this.detectPlatform();
    this.capabilities = null; // Lazy loaded
  }

  detectPlatform() {
    const ua = this.userAgent.toLowerCase();
    
    // Check for Capacitor native - multiple ways to detect
    const isCapacitor = typeof window !== 'undefined' && (
      window.Capacitor?.isNativePlatform?.() || 
      window.Capacitor?.isNative === true ||
      window.Capacitor?.platform === 'ios' ||
      window.Capacitor?.platform === 'android'
    );
    
    if (isCapacitor) {
      const capacitorPlatform = window.Capacitor?.getPlatform?.() || window.Capacitor?.platform;
      if (capacitorPlatform === 'ios' || /iphone|ipad|ipod/.test(ua)) {
        return 'ios-native';
      }
      if (capacitorPlatform === 'android' || /android/.test(ua)) {
        return 'android-native';
      }
    }
    
    // Web detection
    if (/iphone|ipad|ipod/.test(ua)) {
      return 'ios-web';
    }
    if (/android/.test(ua)) {
      return 'android-web';
    }
    
    return 'desktop';
  }

  isMobile() {
    return this.platform !== 'desktop';
  }

  isNative() {
    return this.platform.includes('native');
  }

  isIOS() {
    return this.platform.includes('ios');
  }

  isAndroid() {
    return this.platform.includes('android');
  }
  
  isWeb() {
    return this.platform === 'desktop' || this.platform.includes('web');
  }

  getPlatform() {
    return this.platform;
  }
  
  /**
   * Get simplified platform name for API calls
   * @returns {'web' | 'ios' | 'android'}
   */
  getSimplePlatform() {
    if (this.platform.includes('ios')) return 'ios';
    if (this.platform.includes('android')) return 'android';
    return 'web';
  }

  getCapabilities() {
    if (this.capabilities) return this.capabilities;
    
    const hasCapacitor = typeof window !== 'undefined' && !!window.Capacitor;
    
    this.capabilities = {
      // Web APIs
      speechSynthesis: typeof window !== 'undefined' && 'speechSynthesis' in window,
      speechRecognition: typeof window !== 'undefined' && 
        ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window),
      mediaDevices: typeof navigator !== 'undefined' && 'mediaDevices' in navigator,
      audioContext: typeof window !== 'undefined' && 
        ('AudioContext' in window || 'webkitAudioContext' in window),
      
      // Capacitor plugins (check if available)
      capacitor: hasCapacitor,
      capacitorSpeechRecognition: hasCapacitor && !!window.Capacitor?.Plugins?.SpeechRecognition,
      capacitorTextToSpeech: hasCapacitor && !!window.Capacitor?.Plugins?.TextToSpeech,
      
      // Platform info
      platform: this.platform,
      isNative: this.isNative(),
      isMobile: this.isMobile()
    };
    
    return this.capabilities;
  }
  
  /**
   * Log all capabilities for debugging
   */
  logCapabilities() {
    const caps = this.getCapabilities();
    console.log('[PlatformDetector] Platform:', this.platform);
    console.log('[PlatformDetector] Capabilities:', caps);
    return caps;
  }
}

export const platformDetector = new PlatformDetector();
export default platformDetector;

