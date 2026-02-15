/**
 * Platform Detector - Detects current platform (Web, iOS, Android)
 * 100% isolated - no dependencies on existing code
 */

class PlatformDetector {
  constructor() {
    this.userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    this.platform = this.detectPlatform();
  }

  detectPlatform() {
    const ua = this.userAgent.toLowerCase();
    
    // Check for Capacitor native
    const isCapacitor = typeof window !== 'undefined' && 
      (window.Capacitor?.isNative || window.Capacitor?.platform);
    
    if (isCapacitor) {
      if (/iphone|ipad|ipod/.test(ua)) {
        return 'ios-native';
      }
      if (/android/.test(ua)) {
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

  getPlatform() {
    return this.platform;
  }

  getCapabilities() {
    return {
      speechSynthesis: 'speechSynthesis' in window,
      speechRecognition: 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window,
      mediaDevices: 'mediaDevices' in navigator,
      audioContext: 'AudioContext' in window || 'webkitAudioContext' in window
    };
  }
}

export const platformDetector = new PlatformDetector();
export default platformDetector;
