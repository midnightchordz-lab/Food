/**
 * Firebase Configuration for Web Push Notifications
 * Phase 1: Push Notifications for Family Plan
 * 
 * NOTE: All Firebase imports are dynamic to prevent crashes on native platforms
 */
import { Capacitor } from '@capacitor/core';

// Firebase config from your Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyAF2MQYvIw4p8YV7uB9EIR_3V0n8RxDNCY",
  authDomain: "moodfood-8fd69.firebaseapp.com",
  projectId: "moodfood-8fd69",
  storageBucket: "moodfood-8fd69.firebasestorage.app",
  messagingSenderId: "294124792212",
  appId: "1:294124792212:android:c11f67c5cce6400f734781"
};

// Initialize Firebase
let app = null;
let messaging = null;

export const initFirebase = async () => {
  // Skip Firebase web SDK initialization on native platforms
  if (Capacitor.isNativePlatform()) {
    console.log('Skipping Firebase web SDK on native platform');
    return null;
  }
  
  if (!app) {
    const { initializeApp } = await import('firebase/app');
    app = initializeApp(firebaseConfig);
  }
  return app;
};

export const getFirebaseMessaging = async () => {
  // Skip on native platforms
  if (Capacitor.isNativePlatform()) {
    return null;
  }
  
  if (!messaging) {
    const app = await initFirebase();
    if (!app) return null;
    
    // Only initialize messaging in browser with service worker support
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const { getMessaging } = await import('firebase/messaging');
      messaging = getMessaging(app);
    }
  }
  return messaging;
};

export const getToken = async (messaging, options) => {
  if (Capacitor.isNativePlatform()) return null;
  const { getToken: firebaseGetToken } = await import('firebase/messaging');
  return firebaseGetToken(messaging, options);
};

export const onMessage = async (messaging, callback) => {
  if (Capacitor.isNativePlatform()) return null;
  const { onMessage: firebaseOnMessage } = await import('firebase/messaging');
  return firebaseOnMessage(messaging, callback);
};

export default { initFirebase, getFirebaseMessaging, getToken, onMessage };
