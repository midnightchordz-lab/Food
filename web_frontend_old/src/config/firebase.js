/**
 * Firebase Configuration - DISABLED
 * Push notifications temporarily disabled for debugging
 */

export const initFirebase = async () => {
  console.log('Firebase disabled');
  return null;
};

export const getFirebaseMessaging = async () => {
  return null;
};

export const getToken = async () => {
  return null;
};

export const onMessage = async () => {
  return null;
};

export default { initFirebase, getFirebaseMessaging, getToken, onMessage };
