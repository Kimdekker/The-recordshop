import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../api/client.ts';
import type { User } from '../../shared/types.ts';

interface AuthValue {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setTokens: (tokens: number) => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { user } = await api.me().catch(() => ({ user: null }));
    setUser(user);
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      refresh,
      login: async (u, p) => setUser((await api.login(u, p)).user),
      register: async (u, p) => setUser((await api.register(u, p)).user),
      logout: async () => {
        await api.logout();
        setUser(null);
      },
      setTokens: (tokens) => setUser((cur) => (cur ? { ...cur, tokens } : cur)),
    }),
    [user, loading, refresh],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
