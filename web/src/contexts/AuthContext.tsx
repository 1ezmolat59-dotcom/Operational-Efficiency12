import React, { createContext, useState, useEffect, useCallback } from 'react';
import { User, StaffRole } from '@/types';
import { authApi } from '@/api/client';

const TOKEN_KEY = 'hospital_ops_token';
const REFRESH_TOKEN_KEY = 'hospital_ops_refresh_token';
const USER_KEY = 'hospital_ops_user';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  logout: () => {},
});

function parseJwtExpiry(token: string): number | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload) as { exp?: number };
    return payload.exp ?? null;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const exp = parseJwtExpiry(token);
  if (!exp) return true;
  return Date.now() >= exp * 1000 - 60000; // 60s buffer
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    try {
      authApi.logout().catch(() => {});
    } catch {}
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setToken(null);
  }, []);

  const attemptTokenRefresh = useCallback(async (): Promise<boolean> => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) return false;

    try {
      const response = await authApi.refresh(refreshToken);
      const newToken = response.data.token;
      localStorage.setItem(TOKEN_KEY, newToken);
      setToken(newToken);
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);

      if (!storedToken || !storedUser) {
        setIsLoading(false);
        return;
      }

      try {
        const parsedUser: User = JSON.parse(storedUser);

        if (isTokenExpired(storedToken)) {
          const refreshed = await attemptTokenRefresh();
          if (!refreshed) {
            logout();
            setIsLoading(false);
            return;
          }
        } else {
          setToken(storedToken);
        }

        setUser(parsedUser);
      } catch {
        logout();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [logout, attemptTokenRefresh]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await authApi.login(email, password);
    const { token: newToken, refreshToken, user: userData } = response.data;

    const appUser: User = {
      id: userData.id,
      name: userData.name,
      email: userData.email,
      role: userData.role as StaffRole,
      wingId: userData.wingId,
    };

    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(appUser));

    setToken(newToken);
    setUser(appUser);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
