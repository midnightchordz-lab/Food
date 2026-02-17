/**
 * Firebase Messaging Service Worker
 * Handles background push notifications for web
 */

/* eslint-disable no-restricted-globals */
/* eslint-disable no-undef */

importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Initialize Firebase in service worker
firebase.initializeApp({
  apiKey: "AIzaSyAF2MQYvIw4p8YV7uB9EIR_3V0n8RxDNCY",
  authDomain: "moodfood-8fd69.firebaseapp.com",
  projectId: "moodfood-8fd69",
  storageBucket: "moodfood-8fd69.firebasestorage.app",
  messagingSenderId: "294124792212",
  appId: "1:294124792212:android:c11f67c5cce6400f734781"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message received:', payload);

  const notificationTitle = payload.notification?.title || 'MoodFood';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/logo192.png',
    badge: '/logo192.png',
    tag: payload.data?.type || 'default',
    data: payload.data || {},
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const data = event.notification.data || {};
  let urlToOpen = '/family';

  // Route based on notification type
  switch (data.type) {
    case 'voting_session':
      urlToOpen = data.sessionId ? `/family/vote/${data.sessionId}` : '/family';
      break;
    case 'winner_announcement':
      urlToOpen = data.recipeId ? `/recipe/${data.recipeId}` : '/family';
      break;
    case 'member_joined':
      urlToOpen = '/family';
      break;
    default:
      urlToOpen = '/family';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
