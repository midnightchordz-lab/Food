/**
 * Push Notification Service — DISABLED
 * Temporarily disabled for debugging Android crash
 */

export const initPushNotifications = async (authToken) => {
  console.log('Push notifications disabled');
  return { success: false, reason: 'disabled' };
};

export const unregisterPushNotifications = async () => {
  console.log('Push notifications disabled');
};

export const isPushAvailable = () => {
  return false;
};

export const getNotificationPermission = async () => {
  return 'denied';
};

export default {
  initPushNotifications,
  unregisterPushNotifications,
  isPushAvailable,
  getNotificationPermission
};
