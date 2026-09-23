import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { api, setTokens, loadTokens, setOnAuthFailure, getRefreshToken } from '@/src/api/client';

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
  deleteAccount: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({} as AuthState);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Persist an access+refresh pair returned by any auth endpoint.
  const applyPair = useCallback(async (access: string | null, refresh: string | null) => {
    setToken(access);
    await setTokens(access, refresh);
  }, []);

  const clearSession = useCallback(async () => {
    setToken(null);
    setUser(null);
    await setTokens(null, null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data);
    } catch {
      /* token invalid — interceptor handles refresh/logout */
    }
  }, []);

  // When a refresh fails (expired/revoked/stolen-token), the interceptor calls this.
  useEffect(() => {
    setOnAuthFailure(() => {
      setToken(null);
      setUser(null);
    });
    return () => setOnAuthFailure(null);
  }, []);

  useEffect(() => {
    (async () => {
      const saved = await loadTokens();
      if (saved) {
        setToken(saved);
        try {
          const res = await api.get('/auth/me');
          setUser(res.data);
        } catch {
          await clearSession();
        }
      }
      setLoading(false);
    })();
  }, [clearSession]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    await applyPair(res.data.access_token, res.data.refresh_token);
    setUser(res.data.user);
  }, [applyPair]);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const res = await api.post('/auth/register', { name, email, password });
    await applyPair(res.data.access_token, res.data.refresh_token);
    setUser(res.data.user);
  }, [applyPair]);

  const logout = useCallback(async () => {
    const rt = getRefreshToken();
    if (rt) {
      try { await api.post('/auth/logout', { refresh_token: rt }); } catch { /* best effort */ }
    }
    await clearSession();
  }, [clearSession]);

  const deleteAccount = useCallback(async () => {
    await api.delete('/auth/account');
    await clearSession();
  }, [clearSession]);

  const appleLogin = useCallback(async (identityToken: string, name?: string | null, email?: string | null) => {
    const res = await api.post('/auth/apple', { identity_token: identityToken, name, email });
    await applyPair(res.data.access_token, res.data.refresh_token);
    setUser(res.data.user);
  }, [applyPair]);

  const handledSessions = useRef<Set<string>>(new Set());
  const googleLogin = useCallback(async (sessionId: string) => {
    if (!sessionId || handledSessions.current.has(sessionId)) return;
    handledSessions.current.add(sessionId);
    const res = await api.post('/auth/session', { session_id: sessionId });
    await applyPair(res.data.access_token, res.data.refresh_token);
    setUser(res.data.user);
  }, [applyPair]);

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
    await applyPair(res.data.access_token, res.data.refresh_token);
    setUser(res.data.user);
  }, [applyPair]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, appleLogin, googleLogin, sendPhoneOtp, phoneLogin, logout, deleteAccount, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
