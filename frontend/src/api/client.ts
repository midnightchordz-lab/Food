import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { storage } from '@/src/utils/storage';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

export const API_ROOT = `${BASE}/api`;

export const ACCESS_KEY = 'moodfood_token';
export const REFRESH_KEY = 'moodfood_refresh';

export const api = axios.create({
  baseURL: API_ROOT,
  timeout: 60000,
});

// Bare client for the refresh call so it can never re-trigger the interceptor.
const bare = axios.create({ baseURL: API_ROOT, timeout: 60000 });

let authToken: string | null = null;
let refreshToken: string | null = null;
let onAuthFailure: (() => void) | null = null;

export function setOnAuthFailure(cb: (() => void) | null) {
  onAuthFailure = cb;
}

export function getAuthToken(): string | null {
  return authToken;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

/** Set (or clear) the access token only. Used during boot for legacy sessions. */
export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete api.defaults.headers.common.Authorization;
}

/** Set both tokens and persist them (pass nulls to clear + wipe storage). */
export async function setTokens(access: string | null, refresh: string | null) {
  authToken = access;
  refreshToken = refresh;
  if (access) api.defaults.headers.common.Authorization = `Bearer ${access}`;
  else delete api.defaults.headers.common.Authorization;

  if (access) await storage.set(ACCESS_KEY, access);
  else await storage.remove(ACCESS_KEY);
  if (refresh) await storage.set(REFRESH_KEY, refresh);
  else await storage.remove(REFRESH_KEY);
}

/** Load persisted tokens on app start. Returns the access token (or null). */
export async function loadTokens(): Promise<string | null> {
  authToken = await storage.get(ACCESS_KEY);
  refreshToken = await storage.get(REFRESH_KEY);
  if (authToken) api.defaults.headers.common.Authorization = `Bearer ${authToken}`;
  return authToken;
}

api.interceptors.request.use((config) => {
  if (authToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

let refreshPromise: Promise<string> | null = null;

async function refreshAccess(): Promise<string> {
  if (!refreshToken) throw new Error('no refresh token');
  const res = await bare.post('/auth/refresh', { refresh_token: refreshToken });
  const { access_token, refresh_token } = res.data;
  await setTokens(access_token, refresh_token); // rotation: persist the new refresh too
  return access_token;
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const status = error.response?.status;
    // Only try to recover 401s on non-auth endpoints, once, and only if we have a refresh token.
    if (
      status !== 401 ||
      !original ||
      original._retry ||
      (original.url && original.url.includes('/auth/')) ||
      !refreshToken
    ) {
      throw error;
    }
    original._retry = true;
    try {
      refreshPromise = refreshPromise ?? refreshAccess().finally(() => { refreshPromise = null; });
      const access = await refreshPromise; // concurrent 401s share one refresh
      original.headers.Authorization = `Bearer ${access}`;
      return api.request(original);
    } catch (refreshError) {
      // Refresh failed (expired / revoked / stolen-token detected) → hard logout.
      await setTokens(null, null);
      onAuthFailure?.();
      throw refreshError;
    }
  },
);
