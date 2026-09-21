import React, { useEffect, useRef, useState } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '@/src/auth/AuthContext';
import { ToastProvider } from '@/src/components/ui';
import { useTheme } from '@/src/theme';
import { initializeRevenueCat, SubscriptionProvider, rcEnabled, useSubscription } from '@/src/lib/revenuecat';

SplashScreen.preventAutoHideAsync().catch(() => {});

try {
  initializeRevenueCat();
} catch (err) {
  console.warn('RevenueCat unavailable:', err);
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

// Binds RevenueCat identity to the app's stable backend user id on every auth path.
function RevenueCatIdentityBridge() {
  const { user } = useAuth();
  const { bindIdentity, unbindIdentity } = useSubscription();
  const rcIdentityRef = useRef<string | null>(null);

  useEffect(() => {
    if (!rcEnabled) return;
    (async () => {
      try {
        if (user?.id && rcIdentityRef.current !== user.id) {
          await bindIdentity(user.id);
          rcIdentityRef.current = user.id;
        } else if (!user?.id && rcIdentityRef.current) {
          await unbindIdentity();
          rcIdentityRef.current = null;
        }
      } catch (e) {
        console.warn('[RevenueCat] identity bind failed:', e);
      }
    })();
  }, [user?.id, bindIdentity, unbindIdentity]);

  return null;
}

function ThemedStack() {
  const { colors, isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="welcome" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="recipe" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="exclusions" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="shopping" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="paywall" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="import" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    'CormorantGaramond-SemiBold': require('@/assets/fonts/CormorantGaramond-SemiBold.ttf'),
    'CormorantGaramond-Medium': require('@/assets/fonts/CormorantGaramond-Medium.ttf'),
    'Manrope-Regular': require('@/assets/fonts/Manrope-Regular.ttf'),
    'Manrope-Medium': require('@/assets/fonts/Manrope-Medium.ttf'),
    'Manrope-SemiBold': require('@/assets/fonts/Manrope-SemiBold.ttf'),
    'Manrope-Bold': require('@/assets/fonts/Manrope-Bold.ttf'),
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  if (!loaded && !error) return <View style={{ flex: 1, backgroundColor: '#F9F8F6' }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <SubscriptionProvider>
              <ToastProvider>
                <RevenueCatIdentityBridge />
                <ThemedStack />
              </ToastProvider>
            </SubscriptionProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
