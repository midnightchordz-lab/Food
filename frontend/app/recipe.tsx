import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/src/api/client';
import { makeStyles, useTheme } from '@/src/theme';
import { Icon, Loading, useToast } from '@/src/components/ui';
import { foodImage, useRecipeImage } from '@/src/components/RecipeCard';
import { useSubscription } from '@/src/lib/revenuecat';

// Extract ordered cooking steps from the AI recipe markdown.
function parseSteps(md: string): string[] {
  if (!md) return [];
  const lines = md.split('\n');
  const numbered = lines
    .map((l) => l.trim())
    .filter((l) => /^\d+\.\s+/.test(l))
    .map((l) => l.replace(/^\d+\.\s+/, '').replace(/\*\*/g, '').trim())
    .filter(Boolean);
  if (numbered.length >= 2) return numbered;
  // Fallback: split the whole text into sentences.
  const clean = md.replace(/[#*`>-]/g, ' ').replace(/\s+/g, ' ').trim();
  return clean
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12)
    .slice(0, 25);
}

// Pull "- ingredient" bullets from the Ingredients section of the recipe markdown.
function extractIngredients(md: string): string[] {
  if (!md) return [];
  const out: string[] = [];
  let inIng = false;
  for (const raw of md.split('\n')) {
    const l = raw.trim();
    if (/^#+\s*ingredients/i.test(l)) { inIng = true; continue; }
    if (inIng && /^#+\s/.test(l)) break;
    if (inIng && (l.startsWith('-') || l.startsWith('*'))) out.push(l.replace(/^[-*]\s*/, '').replace(/\*\*/g, '').trim());
  }
  return out.filter(Boolean);
}

export default function RecipeDetail() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { isSubscribed } = useSubscription();
  const p = useLocalSearchParams<{
    title: string; description?: string; cuisine?: string; meal?: string; dietary?: string;
    cooking_time?: string; difficulty?: string; ingredients?: string; content?: string; image?: string;
    carbs?: string; flag?: string;
  }>();

  const title = String(p.title || 'Recipe');
  const providedContent = p.content ? String(p.content) : '';
  const providedImg = p.image
    ? (String(p.image).startsWith('/') ? `${process.env.EXPO_PUBLIC_BACKEND_URL}${p.image}` : String(p.image))
    : '';
  const providedIngredients = (() => {
    try {
      const arr = p.ingredients ? JSON.parse(String(p.ingredients)) : [];
      return Array.isArray(arr) ? arr.map((x) => (typeof x === 'string' ? x : x?.name || '')).filter(Boolean) : [];
    } catch {
      return [];
    }
  })();
  const aiImg = useRecipeImage(title, String(p.cuisine || ''), String(p.description || ''), providedIngredients, isSubscribed && !providedImg);
  const img = providedImg || aiImg.data || foodImage(title, String(p.cuisine || ''));

  const { data, isLoading } = useQuery({
    queryKey: ['detailed-recipe', title],
    enabled: !providedContent,
    queryFn: async () => {
      const res = await api.post('/recipes/detailed', {
        recipe_title: title,
        cuisine: p.cuisine || 'International',
        meal_type: p.meal || 'Dinner',
        dietary_pref: p.dietary || 'Any',
      });
      return res.data.recipe as string;
    },
  });

  const recipeContent = providedContent || data || '';
  const loadingContent = !providedContent && isLoading;

  // Quick per-serving nutrition estimate (cached backend-side by title).
  const nutritionIngredients = providedIngredients.length ? providedIngredients : extractIngredients(recipeContent);
  const nutrition = useQuery({
    queryKey: ['nutrition', title],
    enabled: !!title,
    staleTime: 1000 * 60 * 60,
    queryFn: async () => {
      const res = await api.post('/recipes/nutrition', { title, ingredients: nutritionIngredients });
      return res.data.nutrition as { calories: number; protein_g: number; carbs_g: number; fat_g: number };
    },
  });

  const carbs = p.carbs != null && p.carbs !== '' ? Number(p.carbs) : null;
  const flag = p.flag ? String(p.flag) : '';
  const flagColor = flag === 'safe' ? colors.success : flag === 'caution' ? colors.accent : flag === 'spike' ? colors.danger : colors.primary;
  const flagLabel = flag === 'safe' ? 'Steady' : flag === 'caution' ? 'Watch' : flag === 'spike' ? 'Spike risk' : '';

  const saveMut = useMutation({
    mutationFn: async () => {
      let ingredients: string[] = [];
      try { ingredients = JSON.parse(String(p.ingredients || '[]')); } catch { /* noop */ }
      await api.post('/recipes/save', {
        recipe: {
          title,
          description: String(p.description || ''),
          ingredients: ingredients.length ? ingredients : ['See recipe details'],
          instructions: ['See recipe details'],
          mood_tags: ['comfort'],
          prep_time: String(p.cooking_time || '30 min'),
          cook_time: String(p.cooking_time || '30 min'),
          complexity: String(p.difficulty || 'medium').toLowerCase(),
          nutritional_highlights: 'Mood-boosting nutrients',
          dietary_info: [],
          cuisine_type: String(p.cuisine || ''),
          image_url: p.image ? String(p.image) : (aiImg.data || foodImage(title, String(p.cuisine || ''))),
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-recipes'] });
      toast.show('Saved to your collection', 'success');
    },
    onError: () => toast.show('Could not save recipe', 'error'),
  });

  const getShoppingIngredients = (): string[] => {
    if (providedIngredients.length) return providedIngredients;
    return extractIngredients(recipeContent);
  };

  const addToListMut = useMutation({
    mutationFn: async () => {
      const ings = getShoppingIngredients();
      if (!ings.length) throw new Error('no ingredients');
      const existing = await api.get('/shopping-list');
      const current = (existing.data.items || []).map((i: any) => ({ name: i.name, checked: !!i.checked }));
      const names = new Set(current.map((i: any) => String(i.name).toLowerCase()));
      const additions = ings.filter((n) => !names.has(n.toLowerCase())).map((n) => ({ name: n, checked: false }));
      await api.post('/shopping-list', { items: [...current, ...additions] });
      return additions.length;
    },
    onSuccess: (n: number) => {
      queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
      toast.show(n > 0 ? `Added ${n} item${n === 1 ? '' : 's'} to your shopping list` : 'Those items are already on your list', 'success');
    },
    onError: () => toast.show('Could not add to shopping list', 'error'),
  });

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
        <View style={styles.heroWrap}>
          <Image source={{ uri: img }} style={styles.hero} contentFit="cover" transition={250} cachePolicy="memory-disk" recyclingKey={img} />
          <LinearGradient
            colors={['rgba(0,0,0,0.45)', 'transparent', 'rgba(0,0,0,0.75)']}
            locations={[0, 0.45, 1]}
            style={styles.heroFade}
          />
          <Pressable style={[styles.closeBtn, { top: insets.top + 8 }]} onPress={() => router.back()} testID="close-recipe" hitSlop={8}>
            <Icon name="close" size={22} color="#FFFFFF" />
          </Pressable>
          <View style={styles.heroTextWrap}>
            {p.cuisine ? (
              <View style={styles.heroTag}><Text style={styles.heroTagText}>{String(p.cuisine)}</Text></View>
            ) : null}
            <Text style={styles.heroTitle}>{title}</Text>
            <View style={styles.heroMetaRow}>
              {p.cooking_time ? <HeroMeta icon="clock-outline" text={String(p.cooking_time)} /> : null}
              {p.difficulty ? <HeroMeta icon="chef-hat" text={String(p.difficulty)} /> : null}
            </View>
          </View>
        </View>

        <View style={styles.body}>
          {p.description ? <Text style={styles.desc}>{String(p.description)}</Text> : null}

          {carbs != null ? (
            <View style={[styles.carbBanner, { backgroundColor: flagColor + '18', borderColor: flagColor + '55' }]}>
              <View style={[styles.carbDot, { backgroundColor: flagColor }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.carbBannerValue}>{carbs}g net carbs</Text>
                <Text style={styles.carbBannerSub}>Blood-sugar impact</Text>
              </View>
              {flagLabel ? (
                <View style={[styles.carbFlag, { backgroundColor: flagColor }]}>
                  <Text style={styles.carbFlagText}>{flagLabel}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.nutritionCard}>
            <View style={styles.nutritionHeader}>
              <Icon name="nutrition" size={16} color={colors.primary} />
              <Text style={styles.nutritionTitle}>Nutrition snapshot</Text>
              <Text style={styles.nutritionSub}>per serving</Text>
            </View>
            {nutrition.isLoading ? (
              <Text style={styles.nutritionLoading}>Estimating…</Text>
            ) : nutrition.data ? (
              <View style={styles.nutritionRow}>
                <NutritionStat value={`${nutrition.data.calories}`} unit="kcal" label="Calories" />
                <NutritionStat value={`${nutrition.data.protein_g}g`} label="Protein" />
                <NutritionStat value={`${nutrition.data.carbs_g}g`} label="Carbs" />
                <NutritionStat value={`${nutrition.data.fat_g}g`} label="Fat" />
              </View>
            ) : (
              <Text style={styles.nutritionLoading}>Estimate unavailable</Text>
            )}
            <Text style={styles.nutritionDisclaimer}>Approximate AI estimate</Text>
          </View>

          <Pressable style={styles.saveBtn} onPress={() => saveMut.mutate()} testID="save-detail" disabled={saveMut.isPending}>
            <Icon name="heart-outline" size={18} color={colors.accent} />
            <Text style={styles.saveText}>{saveMut.isPending ? 'Saving…' : 'Save recipe'}</Text>
          </Pressable>

          <Pressable
            style={styles.cookBtn}
            testID="cook-mode"
            onPress={() => {
              if (!isSubscribed) { router.push('/paywall'); return; }
              const steps = parseSteps(recipeContent);
              if (!steps.length) { toast.show('Recipe steps are still loading', 'error'); return; }
              router.push({ pathname: '/cook', params: { title, steps: JSON.stringify(steps) } });
            }}
          >
            <Icon name="microphone" size={18} color={colors.primaryForeground} />
            <Text style={styles.cookText}>Cook hands-free</Text>
            {!isSubscribed ? <Icon name="crown" size={15} color={colors.primaryForeground} /> : null}
          </Pressable>

          <View style={styles.divider} />

          {loadingContent ? (
            <View style={{ paddingVertical: 40 }}>
              <Loading label="Our chef is writing the full recipe…" />
            </View>
          ) : (
            <>
              <Markdown content={recipeContent} />
              {getShoppingIngredients().length > 0 ? (
                <Pressable style={styles.listBtn} onPress={() => addToListMut.mutate()} testID="add-to-list" disabled={addToListMut.isPending}>
                  <Icon name="cart-plus" size={18} color={colors.primary} />
                  <Text style={styles.listText}>{addToListMut.isPending ? 'Adding…' : 'Add ingredients to shopping list'}</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function NutritionStat({ value, unit, label }: { value: string; unit?: string; label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.nutritionStat}>
      <Text style={styles.nutritionValue}>{value}<Text style={styles.nutritionUnit}>{unit ? ` ${unit}` : ''}</Text></Text>
      <Text style={styles.nutritionLabel}>{label}</Text>
    </View>
  );
}


function HeroMeta({ icon, text }: { icon: string; text: string }) {
  const styles = useStyles();
  return (
    <View style={styles.heroMeta}>
      <Icon name={icon} size={14} color="rgba(255,255,255,0.9)" />
      <Text style={styles.heroMetaText}>{text}</Text>
    </View>
  );
}

// Lightweight markdown renderer for the AI recipe content
function Markdown({ content }: { content: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const lines = content.split('\n');

  const renderInline = (text: string, key: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    return (
      <Text key={key} style={styles.p}>
        {parts.map((seg, i) =>
          seg.startsWith('**') && seg.endsWith('**') ? (
            <Text key={i} style={styles.bold}>{seg.slice(2, -2)}</Text>
          ) : (
            <Text key={i}>{seg}</Text>
          )
        )}
      </Text>
    );
  };

  return (
    <View style={{ gap: 4 }}>
      {lines.map((raw, idx) => {
        const line = raw.trimEnd();
        if (!line.trim()) return <View key={idx} style={{ height: 8 }} />;
        if (line.startsWith('# ')) return <Text key={idx} style={styles.h1}>{line.slice(2)}</Text>;
        if (line.startsWith('## ')) return <Text key={idx} style={styles.h2}>{line.replace(/^##\s*/, '')}</Text>;
        if (line.startsWith('### ')) return <Text key={idx} style={styles.h3}>{line.replace(/^###\s*/, '')}</Text>;
        if (/^\s*[-*]\s+/.test(line)) {
          return (
            <View key={idx} style={styles.bulletRow}>
              <View style={[styles.bulletDot, { backgroundColor: colors.primary }]} />
              {renderInline(line.replace(/^\s*[-*]\s+/, ''), `b-${idx}`)}
            </View>
          );
        }
        if (/^\s*\d+\.\s+/.test(line)) {
          const num = line.match(/^\s*(\d+)\./)?.[1] || '';
          return (
            <View key={idx} style={styles.stepRow}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>{num}</Text></View>
              {renderInline(line.replace(/^\s*\d+\.\s+/, ''), `n-${idx}`)}
            </View>
          );
        }
        return renderInline(line, `l-${idx}`);
      })}
    </View>
  );
}

const useStyles = makeStyles(({ colors, radius, spacing, fonts: f }) => ({
  root: { flex: 1, backgroundColor: colors.background },
  heroWrap: { width: '100%', height: 320 },
  hero: { width: '100%', height: '100%', backgroundColor: colors.secondary },
  heroFade: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  heroTextWrap: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: 18 },
  heroTag: { alignSelf: 'flex-start', backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 10 },
  heroTagText: { fontFamily: f.bodySemiBold, fontSize: 12, color: colors.accentForeground },
  heroTitle: { fontFamily: f.serif, fontSize: 34, color: '#FFFFFF', lineHeight: 38 },
  heroMetaRow: { flexDirection: 'row', gap: 16, marginTop: 10 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroMetaText: { fontFamily: f.bodyMedium, fontSize: 13.5, color: 'rgba(255,255,255,0.92)' },
  closeBtn: { position: 'absolute', right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  desc: { fontFamily: f.body, fontSize: 15, color: colors.mutedForeground, lineHeight: 22 },
  carbBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, borderWidth: 1, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 14 },
  carbDot: { width: 12, height: 12, borderRadius: 6 },
  carbBannerValue: { fontFamily: f.bodyBold, fontSize: 16, color: colors.foreground },
  carbBannerSub: { fontFamily: f.body, fontSize: 12, color: colors.mutedForeground, marginTop: 1 },
  carbFlag: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  carbFlagText: { fontFamily: f.bodySemiBold, fontSize: 12.5, color: '#FFFFFF' },
  nutritionCard: { marginTop: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14 },
  nutritionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nutritionTitle: { fontFamily: f.bodyBold, fontSize: 14, color: colors.foreground },
  nutritionSub: { fontFamily: f.body, fontSize: 12, color: colors.mutedForeground, marginLeft: 'auto' },
  nutritionRow: { flexDirection: 'row', marginTop: 12 },
  nutritionStat: { flex: 1, alignItems: 'center' },
  nutritionValue: { fontFamily: f.serif, fontSize: 20, color: colors.primary },
  nutritionUnit: { fontFamily: f.body, fontSize: 11, color: colors.mutedForeground },
  nutritionLabel: { fontFamily: f.bodyMedium, fontSize: 11.5, color: colors.mutedForeground, marginTop: 2 },
  nutritionLoading: { fontFamily: f.body, fontSize: 13, color: colors.mutedForeground, marginTop: 10 },
  nutritionDisclaimer: { fontFamily: f.body, fontSize: 10.5, color: colors.mutedForeground, marginTop: 10, textAlign: 'right' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18, backgroundColor: colors.accentSoft, borderRadius: 999, paddingVertical: 13 },
  saveText: { fontFamily: f.bodySemiBold, fontSize: 15, color: colors.accent },
  cookBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10, backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 13 },
  cookText: { fontFamily: f.bodySemiBold, fontSize: 15, color: colors.primaryForeground },
  listBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, backgroundColor: colors.primarySoft, borderRadius: 999, paddingVertical: 13 },
  listText: { fontFamily: f.bodySemiBold, fontSize: 15, color: colors.primary },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 22 },
  h1: { fontFamily: f.serif, fontSize: 26, color: colors.foreground, marginTop: 12, marginBottom: 4 },
  h2: { fontFamily: f.serif, fontSize: 23, color: colors.foreground, marginTop: 20, marginBottom: 10 },
  h3: { fontFamily: f.bodyBold, fontSize: 16, color: colors.foreground, marginTop: 12, marginBottom: 2 },
  p: { flex: 1, fontFamily: f.body, fontSize: 15, color: colors.foreground, lineHeight: 23 },
  bold: { fontFamily: f.bodyBold, color: colors.foreground },
  bulletRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 4 },
  bulletDot: { width: 7, height: 7, borderRadius: 4, marginTop: 8, backgroundColor: colors.accent },
  stepRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 7 },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumText: { fontFamily: f.bodyBold, fontSize: 13, color: colors.primaryForeground },
  num: { fontFamily: f.bodyBold, fontSize: 15, marginTop: 0 },
}));
