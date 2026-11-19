'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { User, getStoredUser, isAuthenticated, refreshPortalSession, logout as apiLogout } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  loading: boolean;
  logout: () => void;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoggedIn: false,
  loading: true,
  logout: () => {},
  setUser: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function restore() {
      try {
        if (isAuthenticated() && await refreshPortalSession()) {
          const stored = getStoredUser();
          if (active && stored?.role === 'superadmin') setUser(stored);
        }
      } catch {
        // A disconnected browser can retry this check on reload.
      } finally {
        if (active) setLoading(false);
      }
    }
    void restore();
    return () => { active = false; };
  }, []);

  const logout = useCallback(async () => {
    const clearing = apiLogout();
    setUser(null);
    try { await clearing; } finally { window.location.href = '/login'; }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoggedIn: !!user, loading, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
