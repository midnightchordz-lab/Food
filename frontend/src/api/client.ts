import axios from 'axios';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

export const API_ROOT = `${BASE}/api`;

export const api = axios.create({
  baseURL: API_ROOT,
  timeout: 60000,
});

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

export function getAuthToken(): string | null {
  return authToken;
}

api.interceptors.request.use((config) => {
  if (authToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});
