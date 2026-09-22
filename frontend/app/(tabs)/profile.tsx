import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/src/api/client';
import { useAuth } from '@/src/auth/AuthContext';
import { makeStyles, useTheme, fonts } from '@/src/theme';
import { Icon, Button } from '@/src/components/ui';
import { useSubscription } from '@/src/lib/revenuecat';

export default function Profile() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { isSubscribed } = useSubscription();

  const { data: savedRecipes } = useQuery({
    queryKey: ['saved-recipes'],
    queryFn: async () => {
      const res = await api.get('/recipes/saved');
      return (res.data.recipes || []) as any[];
    },
  });
  const savedCount = Array.isArray(savedRecipes) ? savedRecipes.length : 0;

  const initials = (user?.name || 'U').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  const rows = [
    { icon: 'silverware-variant', label: 'Dietary restrictions', value: (user?.dietary_restrictions?.length || 0) + ' set' },
    { icon: 'earth', label: 'Cuisine preferences', value: (user?.cuisine_preferences?.length || 0) + ' set' },
    { icon: 'heart', label: 'Saved recipes', value: `${savedCount ?? 0}` },
  ];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email || 'Signed in'}</Text>
        </View>

        <Pressable style={styles.premiumCard} onPress={() => router.push('/paywall')} testID="premium-card">
          <View style={styles.premiumIcon}><Icon name="crown" size={22} color={colors.accentForeground} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.premiumTitle}>{isSubscribed ? 'Premium active' : 'MoodFood Premium'}</Text>
            <Text style={styles.premiumDesc}>{isSubscribed ? 'You have every feature unlocked' : 'Unlimited recipes, plans & more'}</Text>
          </View>
          {isSubscribed ? (
            <Icon name="check-circle" size={22} color={colors.success} />
          ) : (
            <View style={styles.trialRibbon}>
              <Text style={styles.trialRibbonText}>7 days free</Text>
            </View>
          )}
        </Pressable>

        <View style={styles.card}>
          {rows.map((r, i) => (
            <View key={r.label} style={[styles.row, i < rows.length - 1 && styles.rowBorder]}>
              <View style={styles.rowIcon}><Icon name={r.icon} size={19} color={colors.primary} /></View>
              <Text style={styles.rowLabel}>{r.label}</Text>
              <Text style={styles.rowValue}>{r.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Pressable style={styles.linkRow} onPress={() => router.push('/exclusions')} testID="open-exclusions">
            <View style={[styles.rowIcon, { backgroundColor: colors.accentSoft }]}><Icon name="silverware-variant" size={19} color={colors.accent} /></View>
            <Text style={styles.rowLabel}>Food exclusions & allergies</Text>
            <Icon name="chevron-right" size={20} color={colors.mutedForeground} />
          </Pressable>
          <View style={styles.rowDivider} />
          <Pressable style={styles.linkRow} onPress={() => router.push('/shopping')} testID="open-shopping">
            <View style={[styles.rowIcon, { backgroundColor: colors.accentSoft }]}><Icon name="cart-outline" size={19} color={colors.accent} /></View>
            <Text style={styles.rowLabel}>Shopping list</Text>
            <Icon name="chevron-right" size={20} color={colors.mutedForeground} />
          </Pressable>
          <View style={styles.rowDivider} />
          <Pressable style={styles.linkRow} onPress={() => router.push('/(tabs)')}>
            <View style={styles.rowIcon}><Icon name="silverware-fork-knife" size={19} color={colors.primary} /></View>
            <Text style={styles.rowLabel}>Discover new recipes</Text>
            <Icon name="chevron-right" size={20} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <Text style={styles.groupLabel}>Support & legal</Text>
        <View style={styles.card}>
          <Pressable style={styles.linkRow} onPress={() => router.push({ pathname: '/legal', params: { type: 'support' } })} testID="open-support">
            <View style={[styles.rowIcon, { backgroundColor: colors.accentSoft }]}><Icon name="lifebuoy" size={19} color={colors.accent} /></View>
            <Text style={styles.rowLabel}>Support</Text>
            <Icon name="chevron-right" size={20} color={colors.mutedForeground} />
          </Pressable>
          <View style={styles.rowDivider} />
          <Pressable style={styles.linkRow} onPress={() => router.push({ pathname: '/legal', params: { type: 'terms' } })} testID="open-terms">
            <View style={styles.rowIcon}><Icon name="file-document-outline" size={19} color={colors.primary} /></View>
            <Text style={styles.rowLabel}>Terms & Conditions</Text>
            <Icon name="chevron-right" size={20} color={colors.mutedForeground} />
          </Pressable>
          <View style={styles.rowDivider} />
          <Pressable style={styles.linkRow} onPress={() => router.push({ pathname: '/legal', params: { type: 'privacy' } })} testID="open-privacy">
            <View style={styles.rowIcon}><Icon name="shield-lock-outline" size={19} color={colors.primary} /></View>
            <Text style={styles.rowLabel}>Privacy Policy</Text>
            <Icon name="chevron-right" size={20} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <View style={{ marginTop: 20 }}>
          <Button label="Sign out" variant="outline" icon="logout" onPress={() => { logout(); router.replace('/welcome'); }} testID="logout-btn" />
        </View>
        <Text style={styles.version}>MoodFood • v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles(({ colors, radius, spacing, fonts: f }) => ({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: 20 },
  hero: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: f.serif, fontSize: 34, color: colors.primaryForeground },
  name: { fontFamily: f.serif, fontSize: 28, color: colors.foreground, marginTop: 14 },
  email: { fontFamily: f.body, fontSize: 14, color: colors.mutedForeground, marginTop: 2 },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: 16, marginBottom: 14 },
  premiumCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent, borderRadius: radius.lg, padding: 16, marginBottom: 14 },
  premiumIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  premiumTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.foreground },
  premiumDesc: { fontFamily: fonts.body, fontSize: 13, color: colors.mutedForeground, marginTop: 1 },
  trialRibbon: { backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  trialRibbonText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.accentForeground, letterSpacing: 0.3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontFamily: f.bodyMedium, fontSize: 15, color: colors.foreground },
  rowValue: { fontFamily: f.body, fontSize: 14, color: colors.mutedForeground },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15 },
  rowDivider: { height: 1, backgroundColor: colors.border },
  version: { fontFamily: f.body, fontSize: 12, color: colors.mutedForeground, textAlign: 'center', marginTop: 20 },
  groupLabel: { fontFamily: f.bodySemiBold, fontSize: 12.5, color: colors.mutedForeground, marginBottom: 8, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
}));
