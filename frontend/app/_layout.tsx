import React, { useEffect, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { View, Platform, Alert, Linking } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, useAuth } from '@/src/auth/AuthContext';
import { ToastProvider } from '@/src/components/ui';
import { useTheme } from '@/src/theme';
import { initializeRevenueCat, SubscriptionProvider, rcEnabled, useSubscription } from '@/src/lib/revenuecat';
import { registerForPush } from '@/src/lib/push';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Push: foreground display behavior — MODULE SCOPE
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// Push: Android channel — MODULE SCOPE
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
  }).catch(() => {});
}

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

// Registers for push on auth, and wires notification tap handling + denied-permission nudge.
function PushBridge() {
  const { user } = useAuth();
  const router = useRouter();
  const registeredRef = useRef<string | null>(null);

  // Register the device whenever we have an authenticated user.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (user?.id && registeredRef.current !== user.id) {
      registeredRef.current = user.id;
      registerForPush(user.id);
    } else if (!user?.id) {
      registeredRef.current = null;
    }
  }, [user?.id]);

  // Notification tap routing + cold-start + denied nudge.
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const openUrl = (data: Record<string, any>) => {
      const url = data?.deeplink || data?.action_url;
      if (!url) return;
      if (String(url).startsWith('http')) Linking.openURL(url);
      else router.push(url);
    };

    const tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
      openUrl(response.notification.request.content.data || {});
    });

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) openUrl(response.notification.request.content.data || {});
    });

    (async () => {
      const { status, canAskAgain } = await Notifications.getPermissionsAsync();
      if (status !== 'denied' || canAskAgain) return;
      const lastNudge = await AsyncStorage.getItem('pushNudgeAt');
      const oneWeek = 7 * 24 * 60 * 60 * 1000;
      if (lastNudge && Date.now() - Number(lastNudge) <= oneWeek) return;
      Alert.alert(
        'Turn on reminders',
        'Enable notifications to get a gentle Sunday nudge to plan your week of meals.',
        [
          { text: 'Later', style: 'cancel', onPress: () => AsyncStorage.setItem('pushNudgeAt', String(Date.now())) },
          { text: 'Open Settings', onPress: () => { AsyncStorage.setItem('pushNudgeAt', String(Date.now())); Linking.openSettings(); } },
        ],
      );
    })();

    return () => {
      tapSub.remove();
    };
  }, []);

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
                <PushBridge />
                <ThemedStack />
              </ToastProvider>
            </SubscriptionProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
