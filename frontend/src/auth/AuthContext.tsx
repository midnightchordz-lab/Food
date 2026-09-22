import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { api, setAuthToken } from '@/src/api/client';
import { storage } from '@/src/utils/storage';

const TOKEN_KEY = 'moodfood_token';

export type User = {
  id: string;
  email?: string | null;
  name: string;
  dietary_restrictions?: string[];
  cuisine_preferences?: string[];
};

type AuthState = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  appleLogin: (identityToken: string, name?: string | null, email?: string | null) => Promise<void>;
  googleLogin: (sessionId: string) => Promise<void>;
  sendPhoneOtp: (phone: string) => Promise<{ demo_otp?: string; message?: string }>;
  phoneLogin: (phone: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({} as AuthState);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const applyToken = useCallback(async (tk: string | null) => {
    setToken(tk);
    setAuthToken(tk);
    if (tk) await storage.set(TOKEN_KEY, tk);
    else await storage.remove(TOKEN_KEY);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data);
    } catch {
      /* token invalid */
    }
  }, []);

  useEffect(() => {
    (async () => {
      const saved = await storage.get(TOKEN_KEY);
      if (saved) {
        setAuthToken(saved);
        setToken(saved);
        try {
          const res = await api.get('/auth/me');
          setUser(res.data);
        } catch {
          await applyToken(null);
        }
      }
      setLoading(false);
    })();
  }, [applyToken]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    await applyToken(res.data.access_token);
    setUser(res.data.user);
  }, [applyToken]);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const res = await api.post('/auth/register', { name, email, password });
    await applyToken(res.data.access_token);
    setUser(res.data.user);
  }, [applyToken]);

  const logout = useCallback(async () => {
    await applyToken(null);
    setUser(null);
  }, [applyToken]);

  const appleLogin = useCallback(async (identityToken: string, name?: string | null, email?: string | null) => {
    const res = await api.post('/auth/apple', { identity_token: identityToken, name, email });
    await applyToken(res.data.access_token);
    setUser(res.data.user);
  }, [applyToken]);

  const handledSessions = useRef<Set<string>>(new Set());
  const googleLogin = useCallback(async (sessionId: string) => {
    if (!sessionId || handledSessions.current.has(sessionId)) return;
    handledSessions.current.add(sessionId);
    const res = await api.post('/auth/session', { session_id: sessionId });
    await applyToken(res.data.access_token);
    setUser(res.data.user);
  }, [applyToken]);

  // Capture the Google redirect: web URL on mount + mobile cold-start/hot links.
  useEffect(() => {
    const extract = (url?: string | null) => {
      if (!url) return null;
      const m = url.match(/[?#&]session_id=([^&#]+)/);
      return m ? decodeURIComponent(m[1]) : null;
    };
    const process = async (url?: string | null) => {
      const sid = extract(url);
      if (!sid) return;
      try {
        await googleLogin(sid);
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.history.replaceState(window.history.state, '', window.location.pathname);
        }
      } catch {
        /* invalid session */
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      process(window.location.href);
    } else {
      Linking.getInitialURL().then(process);
      const sub = Linking.addEventListener('url', (e) => process(e.url));
      return () => sub.remove();
    }
  }, [googleLogin]);

  const sendPhoneOtp = useCallback(async (phone: string) => {
    const res = await api.post('/auth/phone/send-otp', { phone_number: phone });
    return res.data as { demo_otp?: string; message?: string };
  }, []);

  const phoneLogin = useCallback(async (phone: string, code: string) => {
    const res = await api.post('/auth/phone/verify-otp', { phone_number: phone, code });
    await applyToken(res.data.access_token);
    setUser(res.data.user);
  }, [applyToken]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, appleLogin, googleLogin, sendPhoneOtp, phoneLogin, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
