/**
 * Push Notification Service — Frontend
 * Phase 1: Handles FCM token registration and notification display
 * 
 * Usage:
 *   import { initPushNotifications } from '@/services/pushNotificationService';
 *   
 *   // In your app initialization (after login):
 *   await initPushNotifications(token);
 */

import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Initialize push notifications (call after user login)
 * @param {string} authToken - User's JWT auth token
 */
export const initPushNotifications = async (authToken) => {
  // Only run on native platforms
  if (!Capacitor.isNativePlatform()) {
    console.log('Push notifications only available on native platforms');
    return { success: false, reason: 'web_platform' };
  }

  try {
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
      
      // Send token to backend
      await sendTokenToBackend(token.value, authToken);
    });

    // Listen for registration errors
    PushNotifications.addListener('registrationError', (error) => {
      console.error('Push registration error:', error);
    });

    // Listen for incoming notifications (foreground)
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push received (foreground):', notification);
      // You can show an in-app notification here
      handleForegroundNotification(notification);
    });

    // Listen for notification taps
    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('Push notification tapped:', notification);
      handleNotificationTap(notification);
    });

    return { success: true };
    
  } catch (error) {
    console.error('Push notification init error:', error);
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
 * Handle foreground notification (optional: show toast/banner)
 */
const handleForegroundNotification = (notification) => {
  const { title, body, data } = notification;
  
  // You can integrate with your toast/notification system here
  // For example, using sonner:
  // toast(title, { description: body });
  
  console.log('Foreground notification:', { title, body, data });
};

/**
 * Handle notification tap (navigate to relevant screen)
 */
const handleNotificationTap = (notification) => {
  const data = notification.notification?.data || {};
  
  switch (data.type) {
    case 'voting_session':
      // Navigate to voting page
      if (data.sessionId) {
        window.location.href = `/family/vote/${data.sessionId}`;
      } else {
        window.location.href = '/family';
      }
      break;
      
    case 'winner_announcement':
      // Navigate to recipe detail
      if (data.recipeId) {
        window.location.href = `/recipe/${data.recipeId}`;
      } else {
        window.location.href = '/family';
      }
      break;
      
    case 'member_joined':
      // Navigate to family page
      window.location.href = '/family';
      break;
      
    default:
      // Default: go to family page
      window.location.href = '/family';
  }
};

/**
 * Unregister from push notifications (call on logout)
 */
export const unregisterPushNotifications = async () => {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    await PushNotifications.removeAllListeners();
    console.log('Push notifications unregistered');
  } catch (error) {
    console.error('Error unregistering push:', error);
  }
};

/**
 * Check if push notifications are available
 */
export const isPushAvailable = () => {
  return Capacitor.isNativePlatform();
};

export default {
  initPushNotifications,
  unregisterPushNotifications,
  isPushAvailable
};
