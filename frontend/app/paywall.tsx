import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import type { PurchasesPackage } from 'react-native-purchases';
import { makeStyles, useTheme, fonts } from '@/src/theme';
import { Icon, useToast } from '@/src/components/ui';
import { useSubscription } from '@/src/lib/revenuecat';

const HERO = 'https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=900&q=80';

const PERKS = [
  { icon: 'infinity', title: 'Unlimited AI recipes', desc: 'Regenerate as many mood-matched recipes as you like' },
  { icon: 'image-multiple', title: 'AI food photography', desc: 'A beautiful generated photo for every dish' },
  { icon: 'calendar-star', title: 'Full weekly meal plans', desc: 'AI plans tuned to your mood and diet' },
  { icon: 'cart-check', title: 'Smart shopping lists', desc: 'One-tap ingredients from any recipe' },
  { icon: 'shield-check', title: 'Allergy-safe cooking', desc: 'Every recipe respects your exclusions' },
];

export default function Paywall() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const { offerings, isSubscribed, purchase, restore, isPurchasing, isRestoring, identityReady } = useSubscription();

  const currentOffering = offerings?.current;
  const packages = currentOffering?.availablePackages || [];
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmPkg, setConfirmPkg] = useState<PurchasesPackage | null>(null);

  const selectedPkg = packages.find((p) => p.identifier === selected) || packages[0];

  const hasTrial = (pkg?: PurchasesPackage) => !!pkg?.product?.introPrice;

  const doPurchase = async (pkg: PurchasesPackage) => {
    setConfirmPkg(null);
    try {
      await purchase(pkg);
      toast.show('Welcome to Premium! 🎉', 'success');
      router.back();
    } catch (e: any) {
      if (e?.userCancelled || String(e?.message).includes('cancel')) return;
      if (String(e?.message).includes('identity_not_ready')) {
        toast.show('Please sign in again before subscribing', 'error');
        return;
      }
      toast.show('Purchase could not be completed', 'error');
    }
  };

  const doRestore = async () => {
    try {
      await restore();
      toast.show('Purchases restored', 'success');
    } catch {
      toast.show('Nothing to restore', 'info');
    }
  };

  const periodLabel = (pkg: PurchasesPackage) => {
    const id = pkg.identifier.toLowerCase();
    if (id.includes('annual') || id.includes('year')) return 'per year';
    if (id.includes('month')) return 'per month';
    return '';
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 200 }} showsVerticalScrollIndicator={false}>
        <View style={styles.heroWrap}>
          <Image source={{ uri: HERO }} style={styles.hero} contentFit="cover" transition={250} />
          <LinearGradient colors={['transparent', colors.background]} style={styles.heroFade} locations={[0.2, 0.95]} />
          <Pressable style={[styles.close, { top: insets.top + 8 }]} onPress={() => router.back()} testID="paywall-close" hitSlop={8}>
            <Icon name="close" size={22} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.body}>
          <View style={styles.crown}><Icon name="crown" size={22} color={colors.accentForeground} /></View>
          <Text style={styles.title}>MoodFood <Text style={{ color: colors.accent }}>Premium</Text></Text>
          <Text style={styles.subtitle}>Unlock every feature and cook exactly for how you feel.</Text>

          <View style={styles.perks}>
            {PERKS.map((p) => (
              <View key={p.title} style={styles.perkRow}>
                <View style={styles.perkIcon}><Icon name={p.icon} size={19} color={colors.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.perkTitle}>{p.title}</Text>
                  <Text style={styles.perkDesc}>{p.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          {isSubscribed ? (
            <View style={styles.activeCard} testID="premium-active">
              <Icon name="check-circle" size={22} color={colors.success} />
              <Text style={styles.activeText}>You're a Premium member. Enjoy!</Text>
            </View>
          ) : packages.length === 0 ? (
            <View style={styles.unavailable} testID="paywall-unavailable">
              <Text style={styles.unavailableText}>Subscription options are unavailable right now. Please try again later.</Text>
            </View>
          ) : (
            <View style={styles.plans}>
              {packages.map((pkg) => {
                const active = (selected || packages[0]?.identifier) === pkg.identifier;
                const isAnnual = pkg.identifier.toLowerCase().includes('annual') || pkg.identifier.toLowerCase().includes('year');
                return (
                  <Pressable
                    key={pkg.identifier}
                    testID={`plan-${pkg.identifier}`}
                    onPress={() => setSelected(pkg.identifier)}
                    style={[styles.plan, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primarySoft : colors.card }]}
                  >
                    {isAnnual ? <View style={styles.bestValue}><Text style={styles.bestValueText}>BEST VALUE</Text></View> : null}
                    <View style={[styles.radio, { borderColor: active ? colors.primary : colors.borderStrong }]}>
                      {active ? <View style={[styles.radioDot, { backgroundColor: colors.primary }]} /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planName}>{pkg.product.title?.replace(/\(.*\)/, '').trim() || (isAnnual ? 'Annual' : 'Monthly')}</Text>
                      <Text style={styles.planPeriod}>{hasTrial(pkg) ? '7-day free trial, then ' + periodLabel(pkg) : periodLabel(pkg)}</Text>
                    </View>
                    <Text style={styles.planPrice}>{pkg.product.priceString}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {!isSubscribed && packages.length > 0 ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
          {!identityReady ? (
            <Text style={styles.identityWarn}>Sign in required before subscribing.</Text>
          ) : null}
          <Pressable
            testID="paywall-subscribe"
            disabled={!identityReady || isPurchasing}
            onPress={() => selectedPkg && setConfirmPkg(selectedPkg)}
            style={({ pressed }) => [styles.cta, { opacity: !identityReady ? 0.5 : pressed ? 0.9 : 1 }]}
          >
            {isPurchasing ? <ActivityIndicator color={colors.accentForeground} /> : (
              <Text style={styles.ctaText}>{hasTrial(selectedPkg) ? 'Start 7-day free trial' : `Start Premium · ${selectedPkg?.product.priceString} ${periodLabel(selectedPkg!)}`}</Text>
            )}
          </Pressable>
          <Pressable onPress={doRestore} disabled={isRestoring} testID="paywall-restore" style={styles.restore}>
            <Text style={styles.restoreText}>{isRestoring ? 'Restoring…' : 'Restore purchases'}</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Dev/test confirmation modal */}
      <Modal visible={!!confirmPkg} transparent animationType="fade" onRequestClose={() => setConfirmPkg(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirm subscription</Text>
            <Text style={styles.modalBody}>
              Subscribe to MoodFood Premium for {confirmPkg?.product.priceString} {confirmPkg ? periodLabel(confirmPkg) : ''}?
            </Text>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setConfirmPkg(null)} style={[styles.modalBtn, { backgroundColor: colors.secondary }]} testID="confirm-cancel">
                <Text style={[styles.modalBtnText, { color: colors.secondaryForeground }]}>Cancel</Text>
              </Pressable>
              <Pressable onPress={() => confirmPkg && doPurchase(confirmPkg)} style={[styles.modalBtn, { backgroundColor: colors.accent }]} testID="confirm-buy">
                <Text style={[styles.modalBtnText, { color: colors.accentForeground }]}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles(({ colors, radius, spacing, fonts: f }) => ({
  root: { flex: 1, backgroundColor: colors.background },
  heroWrap: { width: '100%', height: 220 },
  hero: { width: '100%', height: '100%', backgroundColor: colors.secondary },
  heroFade: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  close: { position: 'absolute', right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: spacing.lg, marginTop: -30 },
  crown: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { fontFamily: f.serif, fontSize: 38, color: colors.foreground },
  subtitle: { fontFamily: f.body, fontSize: 15, color: colors.mutedForeground, marginTop: 4, lineHeight: 22 },
  perks: { marginTop: 24, gap: 16 },
  perkRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  perkIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  perkTitle: { fontFamily: f.bodySemiBold, fontSize: 15.5, color: colors.foreground },
  perkDesc: { fontFamily: f.body, fontSize: 13, color: colors.mutedForeground, marginTop: 1 },
  plans: { marginTop: 26, gap: 12 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1.5, borderRadius: radius.md, padding: 16 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 12, height: 12, borderRadius: 6 },
  planName: { fontFamily: f.bodySemiBold, fontSize: 16, color: colors.foreground },
  planPeriod: { fontFamily: f.body, fontSize: 13, color: colors.mutedForeground, marginTop: 1 },
  planPrice: { fontFamily: f.serif, fontSize: 24, color: colors.foreground },
  bestValue: { position: 'absolute', top: -10, right: 14, backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  bestValueText: { fontFamily: f.bodyBold, fontSize: 10, color: colors.accentForeground, letterSpacing: 0.5 },
  activeCard: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 26, backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: 18 },
  activeText: { fontFamily: f.bodySemiBold, fontSize: 15, color: colors.foreground },
  unavailable: { marginTop: 26, backgroundColor: colors.cardAlt, borderRadius: radius.md, padding: 18 },
  unavailableText: { fontFamily: f.body, fontSize: 14, color: colors.mutedForeground, textAlign: 'center', lineHeight: 20 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingTop: 12, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border },
  identityWarn: { fontFamily: f.bodyMedium, fontSize: 12.5, color: colors.danger, textAlign: 'center', marginBottom: 8 },
  cta: { height: 56, borderRadius: 999, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: f.bodySemiBold, fontSize: 16, color: colors.accentForeground },
  restore: { alignItems: 'center', paddingVertical: 12 },
  restoreText: { fontFamily: f.bodyMedium, fontSize: 14, color: colors.mutedForeground },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: 32 },
  modalCard: { width: '100%', backgroundColor: colors.card, borderRadius: radius.lg, padding: 22 },
  modalTitle: { fontFamily: f.serif, fontSize: 24, color: colors.foreground },
  modalBody: { fontFamily: f.body, fontSize: 14.5, color: colors.mutedForeground, marginTop: 8, lineHeight: 21 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 22 },
  modalBtn: { flex: 1, height: 50, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  modalBtnText: { fontFamily: f.bodySemiBold, fontSize: 15 },
}));
