import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, setCsrfToken, errorMessage } from '../lib/api';
import type { Session } from '../types';

interface AuthState {
  session: Session | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  demoSwitch: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<Session>('/auth/me');
      setCsrfToken(data.csrf_token);
      setSession(data);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
      setSession({ authenticated: false, user: null, org: null, membership: null });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<{ csrf_token: string; user: Session['user'] }>('/auth/login', {
      body: { email, password },
    });
    setCsrfToken(data.csrf_token);
    const me = await api<Session>('/auth/me');
    setSession(me);
  }, []);

  const demoSwitch = useCallback(async (email: string) => {
    const data = await api<{ csrf_token: string }>('/auth/demo-switch', { body: { email } });
    setCsrfToken(data.csrf_token);
    const me = await api<Session>('/auth/me');
    setSession(me);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      setCsrfToken('');
      setSession({ authenticated: false, user: null, org: null, membership: null });
    }
  }, []);

  const value = useMemo(
    () => ({ session, loading, error, login, demoSwitch, logout, refresh: load }),
    [session, loading, error, login, demoSwitch, logout, load],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
