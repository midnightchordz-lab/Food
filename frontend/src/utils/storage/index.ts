import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/**
 * Credential storage: Keychain (iOS) / Keystore (Android) via expo-secure-store on
 * native, with an AsyncStorage fallback on web (SecureStore is native-only).
 * Used for the auth access + refresh tokens, so they never sit in plaintext
 * AsyncStorage / device backups.
 */
const isWeb = Platform.OS === 'web';

export const storage = {
  async get(key: string): Promise<string | null> {
    try {
      return isWeb ? await AsyncStorage.getItem(key) : await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    try {
      if (isWeb) await AsyncStorage.setItem(key, value);
      else await SecureStore.setItemAsync(key, value);
    } catch {
      /* noop */
    }
  },
  async remove(key: string): Promise<void> {
    try {
      if (isWeb) await AsyncStorage.removeItem(key);
      else await SecureStore.deleteItemAsync(key);
    } catch {
      /* noop */
    }
  },
};
