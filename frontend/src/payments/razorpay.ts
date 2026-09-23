import { Platform } from 'react-native';
import { api } from '@/src/api/client';

export type RzpPlanId = 'premium_monthly' | 'premium_annual';

type Profile = { name?: string | null; email?: string | null; contact?: string | null };

/**
 * Android-only auto-renewing subscription via Razorpay Checkout (native SDK).
 * iOS uses RevenueCat. Requires a real Android build — the native module is not
 * available in Expo Go. Flow: backend creates the subscription (with 7-day trial),
 * the device authorizes it in Razorpay Checkout, then the backend verifies the
 * signature and grants premium. Premium state always comes from the server.
 */
export async function startRazorpaySubscription(planId: RzpPlanId, profile: Profile): Promise<void> {
  if (Platform.OS !== 'android') throw new Error('Razorpay is only used on Android');
  // Lazy require so the native module never loads on web/iOS/Expo Go bundling.
  const RazorpayCheckout = require('react-native-razorpay').default;

  const { data: created } = await api.post('/subscription/razorpay/create-subscription', { plan_id: planId });
  const sub = created.subscription;

  const options = {
    key: sub.key_id,
    subscription_id: sub.id,
    name: 'MoodFood',
    description: `${created.plan.name} · ${created.plan.trial_days}-day free trial`,
    prefill: {
      name: profile.name || '',
      email: profile.email || '',
      contact: profile.contact || '',
    },
    theme: { color: '#C87D56' },
  };

  const result = await RazorpayCheckout.open(options);

  await api.post('/subscription/razorpay/verify-subscription', {
    razorpay_payment_id: result.razorpay_payment_id,
    razorpay_subscription_id: result.razorpay_subscription_id || sub.id,
    razorpay_signature: result.razorpay_signature,
  });
}
