/**
 * Firebase Configuration for Web Push Notifications
 * Phase 1: Push Notifications for Family Plan
 */
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

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

export const initFirebase = () => {
  if (!app) {
    app = initializeApp(firebaseConfig);
  }
  return app;
};

export const getFirebaseMessaging = () => {
  if (!messaging) {
    const app = initFirebase();
    // Only initialize messaging in browser with service worker support
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      messaging = getMessaging(app);
    }
  }
  return messaging;
};

export { getToken, onMessage };

export default { initFirebase, getFirebaseMessaging, getToken, onMessage };
