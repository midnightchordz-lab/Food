/**
 * Push Notification Service — Frontend (Web + Mobile)
 * Phase 1: Handles FCM token registration and notification display
 * 
 * Usage:
 *   import { initPushNotifications } from '@/services/pushNotificationService';
 *   
 *   // In your app initialization (after login):
 *   await initPushNotifications(token);
 */

import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// VAPID key for web push (from Firebase Console > Project Settings > Cloud Messaging > Web Push certificates)
// This will be empty until user provides the key
const VAPID_KEY = process.env.REACT_APP_FIREBASE_VAPID_KEY || '';

let webMessaging = null;

/**
 * Initialize push notifications (call after user login)
 * @param {string} authToken - User's JWT auth token
 */
export const initPushNotifications = async (authToken) => {
  // Determine platform
  const isNative = Capacitor.isNativePlatform();
  
  // TEMPORARILY DISABLED on native to debug crash issue
  if (isNative) {
    console.log('Push notifications temporarily disabled on native platform');
    return { success: false, reason: 'temporarily_disabled' };
  } else {
    return initWebPush(authToken);
  }
};

/**
 * Initialize native (mobile) push notifications
 */
const initNativePush = async (authToken) => {
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    
    // Request permission
    const permResult = await PushNotifications.requestPermissions();
    
    if (permResult.receive !== 'granted') {
      console.log('Push notification permission denied');
      return { success: false, reason: 'permission_denied' };
    }

    // Register with FCM
    await PushNotifications.register();

    // Listen for registration success
    PushNotifications.addListener('registration', async (token) => {
      console.log('FCM Token received:', token.value);
      await sendTokenToBackend(token.value, authToken);
    });

    // Listen for registration errors
    PushNotifications.addListener('registrationError', (error) => {
      console.error('Push registration error:', error);
    });

    // Listen for incoming notifications (foreground)
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push received (foreground):', notification);
      handleForegroundNotification(notification);
    });

    // Listen for notification taps
    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('Push notification tapped:', notification);
      handleNotificationTap(notification);
    });

    return { success: true, platform: 'native' };
    
  } catch (error) {
    console.error('Native push init error:', error);
    return { success: false, reason: 'init_failed', error: error.message };
  }
};

/**
 * Initialize web push notifications
 */
const initWebPush = async (authToken) => {
  try {
    // Check browser support
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Web push not supported in this browser');
      return { success: false, reason: 'not_supported' };
    }

    // Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return { success: false, reason: 'permission_denied' };
    }

    // Register service worker
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('Service worker registered:', registration);

    // Wait for service worker to be ready
    await navigator.serviceWorker.ready;

    // Import Firebase messaging (now async)
    const { getFirebaseMessaging, getToken, onMessage } = await import('@/config/firebase');
    
    const messaging = await getFirebaseMessaging();
    if (!messaging) {
      console.log('Firebase messaging not available');
      return { success: false, reason: 'messaging_unavailable' };
    }
    
    webMessaging = messaging;

    // Get FCM token (now async)
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration
    });

    if (token) {
      console.log('Web FCM Token:', token);
      await sendTokenToBackend(token, authToken);
      
      // Listen for foreground messages (now async)
      await onMessage(messaging, (payload) => {
        console.log('Web push received (foreground):', payload);
        handleWebForegroundNotification(payload);
      });
      
      return { success: true, platform: 'web' };
    } else {
      console.log('No registration token available');
      return { success: false, reason: 'no_token' };
    }
    
  } catch (error) {
    console.error('Web push init error:', error);
    // Don't block the app if push fails
    return { success: false, reason: 'init_failed', error: error.message };
  }
};

/**
 * Send FCM token to backend
 */
const sendTokenToBackend = async (fcmToken, authToken) => {
  try {
    const response = await fetch(`${API_URL}/api/auth/fcm-token`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fcmToken })
    });

    if (response.ok) {
      console.log('FCM token saved to backend');
      return true;
    } else {
      console.error('Failed to save FCM token');
      return false;
    }
  } catch (error) {
    console.error('Error sending FCM token:', error);
    return false;
  }
};

/**
 * Handle foreground notification (native)
 */
const handleForegroundNotification = (notification) => {
  const { title, body } = notification;
  
  // Show toast notification
  toast(title, {
    description: body,
    duration: 5000,
    action: {
      label: 'View',
      onClick: () => handleNotificationTap({ notification })
    }
  });
};

/**
 * Handle foreground notification (web)
 */
const handleWebForegroundNotification = (payload) => {
  const { title, body } = payload.notification || {};
  
  // Show toast notification
  toast(title || 'MoodFood', {
    description: body,
    duration: 5000,
    action: {
      label: 'View',
      onClick: () => {
        const data = payload.data || {};
        navigateToNotificationTarget(data);
      }
    }
  });
};

/**
 * Handle notification tap (navigate to relevant screen)
 */
const handleNotificationTap = (notification) => {
  const data = notification.notification?.data || notification.data || {};
  navigateToNotificationTarget(data);
};

/**
 * Navigate based on notification data
 */
const navigateToNotificationTarget = (data) => {
  switch (data.type) {
    case 'voting_session':
      if (data.sessionId) {
        window.location.href = `/family/vote/${data.sessionId}`;
      } else {
        window.location.href = '/family';
      }
      break;
      
    case 'winner_announcement':
      if (data.recipeId) {
        window.location.href = `/recipe/${data.recipeId}`;
      } else {
        window.location.href = '/family';
      }
      break;
      
    case 'member_joined':
      window.location.href = '/family';
      break;
      
    default:
      window.location.href = '/family';
  }
};

/**
 * Unregister from push notifications (call on logout)
 */
export const unregisterPushNotifications = async () => {
  const isNative = Capacitor.isNativePlatform();
  
  if (isNative) {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      await PushNotifications.removeAllListeners();
      console.log('Native push notifications unregistered');
    } catch (error) {
      console.error('Error unregistering native push:', error);
    }
  } else {
    // Web - just clear the reference
    webMessaging = null;
    console.log('Web push notifications cleared');
  }
};

/**
 * Check if push notifications are available
 */
export const isPushAvailable = () => {
  const isNative = Capacitor.isNativePlatform();
  
  if (isNative) {
    return true;
  } else {
    return 'serviceWorker' in navigator && 'PushManager' in window;
  }
};

/**
 * Check current notification permission status
 */
export const getNotificationPermission = async () => {
  const isNative = Capacitor.isNativePlatform();
  
  if (isNative) {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      const result = await PushNotifications.checkPermissions();
      return result.receive;
    } catch {
      return 'unknown';
    }
  } else {
    return Notification.permission;
  }
};

export default {
  initPushNotifications,
  unregisterPushNotifications,
  isPushAvailable,
  getNotificationPermission
};
