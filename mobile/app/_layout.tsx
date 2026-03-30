import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { OfflineProvider } from '@/contexts/OfflineContext';
import { useRouter, useSegments } from 'expo-router';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(housekeeper)' || segments[0] === '(transporter)';

    if (!isAuthenticated && inAuthGroup) {
      router.replace('/login');
    } else if (isAuthenticated && !inAuthGroup && segments[0] !== undefined) {
      if (user?.role === 'housekeeper') {
        router.replace('/(housekeeper)');
      } else if (user?.role === 'transporter') {
        router.replace('/(transporter)');
      }
    }
  }, [isAuthenticated, isLoading, segments, router, user]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <OfflineProvider>
        <StatusBar style="light" />
        <AuthGuard>
          <Stack screenOptions={{ headerShown: false }} />
        </AuthGuard>
      </OfflineProvider>
    </AuthProvider>
  );
}
