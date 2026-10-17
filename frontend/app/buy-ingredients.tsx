import React from 'react';
import { View, Text, ScrollView, Pressable, Linking } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/src/api/client';
import { makeStyles, useTheme } from '@/src/theme';
import { Icon, Loading, EmptyState, useToast } from '@/src/components/ui';

type DeliveryApp = {
  id: string;
  name: string;
  logo: string;
  color: string;
  text_color: string;
  delivery_time: string;
  search_url: string;
  available: boolean;
};

type DeliveryAppsResponse = {
  success: boolean;
  country: string;
  country_code: string;
  currency_symbol: string;
  apps: DeliveryApp[];
  detected_from: string;
};

const REGION_CHOICES: { code: string; label: string }[] = [
  { code: 'IN', label: 'India' },
  { code: 'US', label: 'USA' },
  { code: 'GB', label: 'UK' },
  { code: 'AE', label: 'UAE' },
  { code: 'AU', label: 'Australia' },
  { code: 'SG', label: 'Singapore' },
  { code: 'CA', label: 'Canada' },
];

export default function BuyIngredients() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();

  const params = useLocalSearchParams<{ ingredients?: string; title?: string }>();

  const providedIngredients = (() => {
    try {
      const arr = params.ingredients ? JSON.parse(String(params.ingredients)) : [];
      return Array.isArray(arr)
        ? arr.map((x) => (typeof x === 'string' ? x : x?.name || '')).filter(Boolean)
        : [];
    } catch {
      return [];
    }
  })();

  // Fall back to the general shopping list when no ingredients were handed in directly.
  const shoppingListQuery = useQuery({
    queryKey: ['shopping-list'],
    enabled: providedIngredients.length === 0,
    queryFn: async () => {
      const res = await api.get('/shopping-list');
      return ((res.data.items || []) as any[]).map((i) => String(i.name)).filter(Boolean);
    },
  });

  const poolIngredients = providedIngredients.length ? providedIngredients : (shoppingListQuery.data || []);

  const [selected, setSelected] = React.useState<Record<string, boolean>>({});
  const initializedFor = React.useRef<string>('');

  React.useEffect(() => {
    const key = poolIngredients.join('|');
    if (poolIngredients.length && initializedFor.current !== key) {
      initializedFor.current = key;
      const next: Record<string, boolean> = {};
      poolIngredients.forEach((n) => { next[n] = true; });
      setSelected(next);
    }
  }, [poolIngredients]);

  const toggle = (name: string) => setSelected((s) => ({ ...s, [name]: !s[name] }));
  const allSelected = poolIngredients.length > 0 && poolIngredients.every((n) => selected[n]);
  const toggleAll = () => {
    const next: Record<string, boolean> = {};
    poolIngredients.forEach((n) => { next[n] = !allSelected; });
    setSelected(next);
  };
  const selectedNames = poolIngredients.filter((n) => selected[n]);

  const [countryHint, setCountryHint] = React.useState<string | null>(null);

  const appsQuery = useQuery({
    queryKey: ['delivery-apps', countryHint],
    queryFn: async () => {
      const res = await api.get('/shopping/delivery-apps', {
        params: countryHint ? { country_hint: countryHint } : undefined,
      });
      return res.data as DeliveryAppsResponse;
    },
  });

  const setCountryMut = useMutation({
    mutationFn: async (code: string) => {
      await api.post('/shopping/set-country', { country_code: code });
    },
  });

  const pickRegion = (code: string) => {
    setCountryHint(code);
    setCountryMut.mutate(code);
  };

  const buildUrlMut = useMutation({
    mutationFn: async (app: DeliveryApp) => {
      if (!selectedNames.length) throw new Error('no ingredients selected');
      const res = await api.post('/shopping/build-url', {
        app_id: app.id,
        ingredients: selectedNames.map((name) => ({ name })),
        country_code: appsQuery.data?.country_code || 'DEFAULT',
      });
      return res.data as { url: string; app_name: string };
    },
    onSuccess: (data) => {
      Linking.openURL(data.url);
    },
    onError: (e: any) => {
      if (e?.message === 'no ingredients selected') {
        toast.show('Select at least one ingredient first', 'error');
      } else {
        toast.show(e?.response?.data?.detail || 'Could not open that app', 'error');
      }
    },
  });

  const loadingIngredients = providedIngredients.length === 0 && shoppingListQuery.isLoading;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} testID="buy-ing-close">
          <Icon name="close" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={styles.headerTitle}>Buy Ingredients</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        {params.title ? <Text style={styles.subtitle}>For {String(params.title)}</Text> : null}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.section}>What do you need?</Text>
          {poolIngredients.length > 0 ? (
            <Pressable onPress={toggleAll} hitSlop={8} testID="buy-ing-toggle-all">
              <Text style={styles.toggleAll}>{allSelected ? 'Clear all' : 'Select all'}</Text>
            </Pressable>
          ) : null}
        </View>

        {loadingIngredients ? (
          <Loading />
        ) : poolIngredients.length === 0 ? (
          <EmptyState icon="cart-outline" title="No ingredients yet" subtitle="Add ingredients to your shopping list first, or open this from a recipe." />
        ) : (
          <View style={styles.ingList}>
            {poolIngredients.map((name) => (
              <Pressable key={name} style={styles.ingRow} onPress={() => toggle(name)} testID={`buy-ing-${name}`}>
                <View style={[styles.checkbox, selected[name] && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                  {selected[name] ? <Icon name="check" size={14} color={colors.primaryForeground} /> : null}
                </View>
                <Text style={styles.ingText}>{name}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.divider} />

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.section}>Choose where to buy</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.regionRow} contentContainerStyle={{ gap: 8 }}>
          {REGION_CHOICES.map((r) => {
            const active = (appsQuery.data?.country_code || '') === r.code;
            return (
              <Pressable
                key={r.code}
                onPress={() => pickRegion(r.code)}
                style={[styles.regionChip, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                testID={`buy-ing-region-${r.code}`}
              >
                <Text style={[styles.regionChipText, active && { color: colors.primaryForeground }]}>{r.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {appsQuery.isLoading ? (
          <Loading />
        ) : appsQuery.data ? (
          <>
            <Text style={styles.regionLabel}>
              Showing apps for {appsQuery.data.country}
            </Text>
            <View style={styles.appList}>
              {appsQuery.data.apps.map((app) => (
                <Pressable
                  key={app.id}
                  style={styles.appCard}
                  onPress={() => buildUrlMut.mutate(app)}
                  disabled={buildUrlMut.isPending || selectedNames.length === 0}
                  testID={`buy-ing-app-${app.id}`}
                >
                  <View style={[styles.appLogoWrap, { backgroundColor: app.color }]}>
                    <Image source={{ uri: app.logo }} style={styles.appLogo} contentFit="contain" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.appName}>{app.name}</Text>
                    <Text style={styles.appTime}>{app.delivery_time} delivery</Text>
                  </View>
                  {buildUrlMut.isPending && buildUrlMut.variables?.id === app.id ? (
                    <Icon name="loading" size={20} color={colors.mutedForeground} />
                  ) : (
                    <Icon name="chevron-right" size={20} color={colors.mutedForeground} />
                  )}
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {selectedNames.length === 0 && poolIngredients.length > 0 ? (
          <Text style={styles.hint}>Select at least one ingredient above to enable buying.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles(({ colors, radius, spacing, fonts: f }) => ({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 12 },
  headerTitle: { fontFamily: f.serif, fontSize: 24, color: colors.foreground },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: 4 },
  subtitle: { fontFamily: f.body, fontSize: 13.5, color: colors.mutedForeground, marginBottom: 10 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 10 },
  section: { fontFamily: f.bodySemiBold, fontSize: 13, color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.5 },
  toggleAll: { fontFamily: f.bodySemiBold, fontSize: 13, color: colors.accent },
  ingList: { gap: 8 },
  ingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  ingText: { flex: 1, fontFamily: f.bodyMedium, fontSize: 15, color: colors.foreground },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 20 },
  regionRow: { marginBottom: 14, flexGrow: 0 },
  regionChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  regionChipText: { fontFamily: f.bodyMedium, fontSize: 13, color: colors.foreground },
  regionLabel: { fontFamily: f.body, fontSize: 12.5, color: colors.mutedForeground, marginBottom: 10 },
  appList: { gap: 10 },
  appCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 12 },
  appLogoWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', padding: 6 },
  appLogo: { width: '100%', height: '100%' },
  appName: { fontFamily: f.bodyBold, fontSize: 15, color: colors.foreground },
  appTime: { fontFamily: f.body, fontSize: 12.5, color: colors.mutedForeground, marginTop: 1 },
  hint: { fontFamily: f.body, fontSize: 12.5, color: colors.mutedForeground, textAlign: 'center', marginTop: 16 },
}));
