import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/src/api/client';
import { useAuth } from '@/src/auth/AuthContext';

const REVENUECAT_TEST_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
const REVENUECAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const REVENUECAT_ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

export const REVENUECAT_ENTITLEMENT_IDENTIFIER = 'pro';

// react-native-purchases is a NATIVE module that is NOT bundled in Expo Go — its
// native calls hang/crash on Android there. Payments are split by platform:
// iOS uses RevenueCat (Apple requirement), Android uses Razorpay. So RevenueCat
// is enabled ONLY on iOS real builds, plus web-dev preview (Test Store browser
// mode). Never on Android, never in Expo Go.
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
export const rcEnabled = Platform.OS === 'ios' ? !isExpoGo : (Platform.OS === 'web' ? __DEV__ : false);

function getRevenueCatApiKey() {
  if (!REVENUECAT_TEST_API_KEY || !REVENUECAT_IOS_API_KEY || !REVENUECAT_ANDROID_API_KEY) {
    throw new Error('RevenueCat public API keys not found — run the Setup section first');
  }
  if (Platform.OS === 'web' || __DEV__) return REVENUECAT_TEST_API_KEY;
  if (Platform.OS === 'ios') return REVENUECAT_IOS_API_KEY;
  if (Platform.OS === 'android') return REVENUECAT_ANDROID_API_KEY;
  return REVENUECAT_TEST_API_KEY;
}

export function initializeRevenueCat() {
  if (!rcEnabled) return;
  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
  Purchases.configure({ apiKey: getRevenueCatApiKey() });
}

function useSubscriptionContext() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [identityBound, setIdentityBound] = useState(false);
  const identityBoundRef = useRef(false);

  // Backend is the source of truth for premium on Android (Razorpay) — and a
  // safety net on iOS. Premium if the server subscription is a paid plan that is
  // active or trialing. Refetches whenever the signed-in user changes.
  const backendPremiumQuery = useQuery({
    queryKey: ['premium', 'backend', user?.id ?? null],
    enabled: !!user?.id,
    staleTime: 60 * 1000,
    retry: 0,
    queryFn: async () => {
      const r = await api.get('/subscription/current');
      const s = r.data?.subscription;
      return !!(s && s.plan_id && s.plan_id !== 'free' && ['active', 'trialing'].includes(s.status));
    },
  });

  const refetchPremium = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['premium', 'backend'] });
  }, [queryClient]);

  const customerInfoQuery = useQuery({
    queryKey: ['revenuecat', 'customer-info'],
    queryFn: () => Purchases.getCustomerInfo(),
    enabled: rcEnabled,
    staleTime: 60 * 1000,
  });

  const offeringsQuery = useQuery({
    queryKey: ['revenuecat', 'offerings'],
    queryFn: () => Purchases.getOfferings(),
    enabled: rcEnabled,
    staleTime: 300 * 1000,
  });

  useEffect(() => {
    if (!rcEnabled) return;
    const listener = (info: CustomerInfo) => queryClient.setQueryData(['revenuecat', 'customer-info'], info);
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [queryClient]);

  // Bind RevenueCat to the app's stable backend user id. logIn aliases the
  // initial anonymous id, so we track binding explicitly rather than inferring
  // from originalAppUserId (which keeps the aliased anonymous value).
  const bindIdentity = useCallback(async (userId: string) => {
    if (!rcEnabled) return;
    const { customerInfo } = await Purchases.logIn(userId);
    queryClient.setQueryData(['revenuecat', 'customer-info'], customerInfo);
    identityBoundRef.current = true;
    setIdentityBound(true);
  }, [queryClient]);

  const unbindIdentity = useCallback(async () => {
    if (!rcEnabled) return;
    await Purchases.logOut();
    const info = await Purchases.getCustomerInfo();
    queryClient.setQueryData(['revenuecat', 'customer-info'], info);
    identityBoundRef.current = false;
    setIdentityBound(false);
  }, [queryClient]);

  const purchaseMutation = useMutation({
    mutationFn: async (packageToPurchase: PurchasesPackage) => {
      if (!identityBoundRef.current) throw new Error('identity_not_ready');
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
      return customerInfo;
    },
    onSuccess: (customerInfo) => {
      queryClient.setQueryData(['revenuecat', 'customer-info'], customerInfo);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: () => Purchases.restorePurchases(),
    onSuccess: (customerInfo) => {
      queryClient.setQueryData(['revenuecat', 'customer-info'], customerInfo);
    },
  });

  const rcSubscribed =
    customerInfoQuery.data?.entitlements.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER] !== undefined;
  const isSubscribed = rcSubscribed || backendPremiumQuery.data === true;

  return {
    customerInfo: customerInfoQuery.data,
    offerings: offeringsQuery.data,
    isSubscribed,
    identityReady: identityBound,
    bindIdentity,
    unbindIdentity,
    refetchPremium,
    isLoading: customerInfoQuery.isLoading || offeringsQuery.isLoading,
    purchase: purchaseMutation.mutateAsync,
    restore: restoreMutation.mutateAsync,
    isPurchasing: purchaseMutation.isPending,
    isRestoring: restoreMutation.isPending,
  };
}

type SubscriptionContextValue = ReturnType<typeof useSubscriptionContext>;
const Context = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const value = useSubscriptionContext();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSubscription() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('useSubscription must be used within a SubscriptionProvider');
  return ctx;
}
