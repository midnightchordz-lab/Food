import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/src/api/client';
import { makeStyles, useTheme } from '@/src/theme';
import { Icon, Button, useToast } from '@/src/components/ui';
import { useSubscription } from '@/src/lib/revenuecat';

type Ingredient = { name: string; category?: string; quantity?: string | null };
type FridgeRecipe = {
  title: string;
  description?: string;
  cooking_time?: string;
  difficulty?: string;
  ingredients_used?: string[];
  missing_ingredients?: string[];
  instructions?: string[];
};
type ScanResult = { ingredients: Ingredient[]; recipes: FridgeRecipe[] };

export default function Fridge() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const { isSubscribed } = useSubscription();

  const [result, setResult] = useState<ScanResult | null>(null);

  const scanMut = useMutation({
    mutationFn: async (base64: string) => {
      const res = await api.post('/mobile-fridge/scan', { image_data: base64 });
      return res.data as ScanResult;
    },
    onSuccess: (data) => setResult(data),
    onError: (e: any) => toast.show(e?.response?.data?.detail || 'Could not scan that photo', 'error'),
  });

  const pickImage = async (fromCamera: boolean) => {
    try {
      let perm;
      if (fromCamera) {
        perm = await ImagePicker.getCameraPermissionsAsync();
        if (!perm.granted && perm.canAskAgain) perm = await ImagePicker.requestCameraPermissionsAsync();
      } else {
        perm = await ImagePicker.getMediaLibraryPermissionsAsync();
        if (!perm.granted && perm.canAskAgain) perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      }
      if (!perm.granted) {
        toast.show(fromCamera ? 'Camera access is needed' : 'Photo access is needed', 'error');
        if (!perm.canAskAgain) Linking.openSettings();
        return;
      }
      const opts: ImagePicker.ImagePickerOptions = { quality: 0.6, base64: true, mediaTypes: ['images'] };
      const res = fromCamera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled || !res.assets?.[0]?.base64) return;
      setResult(null);
      scanMut.mutate(res.assets[0].base64);
    } catch {
      toast.show('Could not open the camera', 'error');
    }
  };

  const openRecipe = (r: FridgeRecipe) => {
    const ing = (r.ingredients_used || []).map((i: any) => (typeof i === 'string' ? i : i?.name || String(i)));
    const steps = (r.instructions || []).map((s: any) => (typeof s === 'string' ? s : s?.instruction || s?.text || s?.step || String(s)));
    const parts: string[] = [];
    if (ing.length) parts.push('## Ingredients', ...ing.map((x) => `- ${x}`), '');
    if (r.missing_ingredients && r.missing_ingredients.length) {
      parts.push('## Also grab', ...r.missing_ingredients.map((x) => `- ${x}`), '');
    }
    if (steps.length) parts.push('## Instructions', ...steps.map((x, i) => `${i + 1}. ${x}`));
    const content = parts.join('\n').trim();
    router.push({
      pathname: '/recipe',
      params: {
        title: r.title,
        description: r.description || '',
        cuisine: 'International',
        meal: 'Dinner',
        dietary: 'Any',
        cooking_time: r.cooking_time || '',
        difficulty: r.difficulty || '',
        ingredients: JSON.stringify(ing),
        ...(content ? { content } : {}),
      },
    });
  };

  if (!isSubscribed) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Header onClose={() => router.back()} />
        <View style={styles.lockWrap}>
          <View style={styles.lockIcon}><Icon name="fridge-outline" size={34} color={colors.accent} /></View>
          <Text style={styles.lockTitle}>Scan your fridge</Text>
          <Text style={styles.lockDesc}>Snap what&apos;s in your fridge and our AI chef spots the ingredients and suggests recipes you can cook right now. This is a Premium feature.</Text>
          <View style={{ height: 20 }} />
          <Button label="Unlock with Premium" icon="crown" onPress={() => router.replace('/paywall')} testID="fridge-upgrade" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Header onClose={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.photoWrap}>
          <Pressable style={styles.photoBtn} onPress={() => pickImage(true)} testID="fridge-camera">
            <Icon name="camera" size={26} color={colors.primary} />
            <Text style={styles.photoBtnText}>Take a photo</Text>
          </Pressable>
          <Pressable style={styles.photoBtn} onPress={() => pickImage(false)} testID="fridge-library">
            <Icon name="image-multiple" size={26} color={colors.primary} />
            <Text style={styles.photoBtnText}>Choose from library</Text>
          </Pressable>
        </View>

        {scanMut.isPending ? (
          <View style={styles.loadingBox}>
            <Icon name="fridge" size={36} color={colors.primary} />
            <Text style={styles.loadingText}>Peeking inside your fridge…</Text>
          </View>
        ) : !result ? (
          <Text style={styles.hint}>Open the fridge, snap a clear, well-lit photo, and we&apos;ll turn what you have into dinner ideas.</Text>
        ) : (
          <>
            <Text style={styles.section}>Spotted in your fridge</Text>
            <View style={styles.chipWrap}>
              {result.ingredients.map((ing, i) => (
                <View key={`${ing.name}-${i}`} style={styles.ingChip} testID={`fridge-ing-${i}`}>
                  <Text style={styles.ingChipText}>{ing.name}{ing.quantity ? ` · ${ing.quantity}` : ''}</Text>
                </View>
              ))}
            </View>

            <Text style={[styles.section, { marginTop: 24 }]}>Recipes you can make</Text>
            {result.recipes.map((r, i) => (
              <Pressable key={`${r.title}-${i}`} style={styles.recipeCard} onPress={() => openRecipe(r)} testID={`fridge-recipe-${i}`}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recipeTitle}>{r.title}</Text>
                  {r.description ? <Text style={styles.recipeDesc} numberOfLines={2}>{r.description}</Text> : null}
                  <View style={styles.recipeMeta}>
                    {r.cooking_time ? <MetaPill icon="clock-outline" text={r.cooking_time} /> : null}
                    {r.difficulty ? <MetaPill icon="chef-hat" text={r.difficulty} /> : null}
                  </View>
                  {r.missing_ingredients && r.missing_ingredients.length > 0 ? (
                    <Text style={styles.missing}>You&apos;ll also need: {r.missing_ingredients.slice(0, 4).join(', ')}</Text>
                  ) : null}
                </View>
                <Icon name="chevron-right" size={22} color={colors.mutedForeground} />
              </Pressable>
            ))}
            <View style={{ height: 12 }} />
            <Button label="Scan again" variant="outline" icon="refresh" onPress={() => setResult(null)} testID="fridge-again" />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Header({ onClose }: { onClose: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      <Pressable onPress={onClose} hitSlop={8} testID="fridge-close"><Icon name="close" size={24} color={colors.foreground} /></Pressable>
      <Text style={styles.headerTitle}>Fridge Scanner</Text>
      <View style={{ width: 24 }} />
    </View>
  );
}

function MetaPill({ icon, text }: { icon: string; text: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.metaPill}>
      <Icon name={icon} size={13} color={colors.mutedForeground} />
      <Text style={styles.metaPillText}>{text}</Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors, radius, spacing, fonts: f }) => ({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 12 },
  headerTitle: { fontFamily: f.serif, fontSize: 24, color: colors.foreground },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: 8 },
  photoWrap: { gap: 12 },
  photoBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 20 },
  photoBtnText: { fontFamily: f.bodySemiBold, fontSize: 15.5, color: colors.foreground },
  loadingBox: { alignItems: 'center', gap: 12, paddingVertical: 40 },
  loadingText: { fontFamily: f.serifMedium, fontSize: 18, color: colors.foreground },
  hint: { fontFamily: f.body, fontSize: 13.5, color: colors.mutedForeground, textAlign: 'center', marginTop: 18, lineHeight: 20 },
  section: { fontFamily: f.bodySemiBold, fontSize: 13, color: colors.mutedForeground, marginTop: 22, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ingChip: { backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 },
  ingChipText: { fontFamily: f.bodyMedium, fontSize: 13, color: colors.primary },
  recipeCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 16, marginBottom: 12 },
  recipeTitle: { fontFamily: f.serif, fontSize: 20, color: colors.foreground },
  recipeDesc: { fontFamily: f.body, fontSize: 13.5, color: colors.mutedForeground, marginTop: 3, lineHeight: 19 },
  recipeMeta: { flexDirection: 'row', gap: 10, marginTop: 8 },
  metaPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaPillText: { fontFamily: f.bodyMedium, fontSize: 12.5, color: colors.mutedForeground },
  missing: { fontFamily: f.body, fontSize: 12.5, color: colors.accent, marginTop: 8, fontStyle: 'italic' },
  lockWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 8 },
  lockIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  lockTitle: { fontFamily: f.serif, fontSize: 26, color: colors.foreground },
  lockDesc: { fontFamily: f.body, fontSize: 14.5, color: colors.mutedForeground, textAlign: 'center', lineHeight: 21 },
}));
