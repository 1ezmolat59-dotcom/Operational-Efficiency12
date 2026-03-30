import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { authApi } from '../api/client';
import { User } from '../types';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore auth state from AsyncStorage on mount
  useEffect(() => {
    const restoreAuth = async () => {
      try {
        const [storedToken, storedUser] = await AsyncStorage.multiGet([
          TOKEN_KEY,
          USER_KEY,
        ]);
        const tokenValue = storedToken[1];
        const userRaw = storedUser[1];

        if (tokenValue && userRaw) {
          const parsedUser: User = JSON.parse(userRaw) as User;
          setToken(tokenValue);
          setUser(parsedUser);
        }
      } catch {
        // Corrupted storage — start fresh
        await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
      } finally {
        setIsLoading(false);
      }
    };

    void restoreAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await authApi.login(email, password);
    const { token: newToken, user: newUser } = response;

    await AsyncStorage.multiSet([
      [TOKEN_KEY, newToken],
      [USER_KEY, JSON.stringify(newUser)],
    ]);

    setToken(newToken);
    setUser(newUser);

    // Navigate based on role
    if (newUser.role === 'housekeeper') {
      router.replace('/(housekeeper)');
    } else if (newUser.role === 'transporter') {
      router.replace('/(transporter)');
    } else {
      // Supervisors/admins directed to web dashboard — show message
      router.replace('/login');
    }
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    setToken(null);
    setUser(null);
    router.replace('/login');
  }, []);

  const value: AuthContextValue = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
