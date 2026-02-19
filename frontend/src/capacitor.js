/**
 * Capacitor Native Integration
 * Handles native mobile features when running as a native app
 */

import { Capacitor } from '@capacitor/core';

// Check if running as native app
export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // 'ios', 'android', or 'web'

/**
 * Initialize Capacitor plugins when app starts
 */
export const initializeCapacitor = async () => {
  if (!isNative) {
    console.log('Running as web app - skipping native initialization');
    return;
  }

  console.log(`Running as native ${platform} app`);

  try {
    // Dynamically import plugins to avoid crashes if not available
    const [
      { StatusBar, Style },
      { SplashScreen },
      { Keyboard },
      { App }
    ] = await Promise.all([
      import('@capacitor/status-bar'),
      import('@capacitor/splash-screen'),
      import('@capacitor/keyboard'),
      import('@capacitor/app')
    ]);

    // Configure Status Bar
    try {
      await StatusBar.setStyle({ style: Style.Dark });
      if (platform === 'android') {
        await StatusBar.setBackgroundColor({ color: '#4a7c59' });
      }
    } catch (e) {
      console.warn('StatusBar setup error:', e);
    }

    // Hide splash screen after app is ready
    try {
      await SplashScreen.hide();
    } catch (e) {
      console.warn('SplashScreen hide error:', e);
    }

    // Setup keyboard listeners for better UX
    try {
      Keyboard.addListener('keyboardWillShow', (info) => {
        document.body.classList.add('keyboard-visible');
        document.documentElement.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
      });

      Keyboard.addListener('keyboardWillHide', () => {
        document.body.classList.remove('keyboard-visible');
        document.documentElement.style.setProperty('--keyboard-height', '0px');
      });
    } catch (e) {
      console.warn('Keyboard setup error:', e);
    }

    // Handle app state changes - trigger entitlement refresh on foreground resume
    try {
      App.addListener('appStateChange', ({ isActive }) => {
        console.log('App state changed. Is active:', isActive);
        if (isActive) {
          // Dispatch event to refresh subscription when app returns to foreground
          window.dispatchEvent(new CustomEvent('app-foreground-resume'));
        }
      });

      // Handle back button on Android
      App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back();
        } else {
          App.exitApp();
        }
      });

      // Handle deep links
      App.addListener('appUrlOpen', (event) => {
        console.log('App opened with URL:', event.url);
        // Handle deep link navigation here
        try {
          const path = new URL(event.url).pathname;
          if (path) {
            window.location.href = path;
          }
        } catch (e) {
          console.warn('Deep link parse error:', e);
        }
      });
    } catch (e) {
      console.warn('App listeners setup error:', e);
    }

    console.log('Capacitor initialized successfully');
  } catch (error) {
    console.error('Error initializing Capacitor:', error);
  }
};

/**
 * Haptic feedback for button taps
 */
export const hapticFeedback = async (style = 'light') => {
  if (!isNative) return;

  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    const impactStyle = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    }[style] || ImpactStyle.Light;

    await Haptics.impact({ style: impactStyle });
  } catch (error) {
    console.error('Haptic feedback error:', error);
  }
};

/**
 * Native share functionality
 */
export const nativeShare = async (title, text, url) => {
  if (!isNative) {
    // Fallback to Web Share API
    if (navigator.share) {
      return navigator.share({ title, text, url });
    }
    return Promise.reject('Share not supported');
  }

  try {
    const { Share } = await import('@capacitor/share');
    await Share.share({
      title,
      text,
      url,
      dialogTitle: 'Share MOOD FOOD',
    });
  } catch (error) {
    console.error('Share error:', error);
  }
};

/**
 * Open external URL in native browser
 */
export const openInBrowser = async (url) => {
  if (!isNative) {
    window.open(url, '_blank');
    return;
  }

  try {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url });
  } catch (error) {
    console.error('Browser open error:', error);
  }
};

/**
 * Get safe area insets for notched devices
 */
export const getSafeAreaInsets = () => {
  const style = getComputedStyle(document.documentElement);
  return {
    top: parseInt(style.getPropertyValue('--safe-area-inset-top') || '0'),
    bottom: parseInt(style.getPropertyValue('--safe-area-inset-bottom') || '0'),
    left: parseInt(style.getPropertyValue('--safe-area-inset-left') || '0'),
    right: parseInt(style.getPropertyValue('--safe-area-inset-right') || '0'),
  };
};

export default {
  isNative,
  platform,
  initializeCapacitor,
  hapticFeedback,
  nativeShare,
  openInBrowser,
  getSafeAreaInsets,
};
