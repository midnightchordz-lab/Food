import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { API_ROOT, getAuthToken } from '@/src/api/client';

/**
 * Registers this device for push notifications and syncs the native token to
 * the backend relay. Safe to call on every app open (tokens rotate; backend upserts).
 * No-ops on web / Expo Go where native push tokens are unavailable.
 */
export async function registerForPush(userId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;

    const token = getAuthToken();
    if (!token) return; // backend derives the user from the auth token

    const tokenResp = await Notifications.getDevicePushTokenAsync();
    await fetch(`${API_ROOT}/register-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        platform: Platform.OS,
        device_token: tokenResp.data,
      }),
    });
  } catch (e) {
    // Push registration must never block the app.
    console.warn('[push] registration failed:', e);
  }
}
