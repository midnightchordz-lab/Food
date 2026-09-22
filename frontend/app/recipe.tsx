import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Image } from 'expo-image';
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
    const out: string[] = [];
    let inIng = false;
    for (const raw of recipeContent.split('\n')) {
      const l = raw.trim();
      if (/^#+\s*ingredients/i.test(l)) { inIng = true; continue; }
      if (inIng && /^#+\s/.test(l)) break;
      if (inIng && (l.startsWith('-') || l.startsWith('*'))) out.push(l.replace(/^[-*]\s*/, '').replace(/\*\*/g, '').trim());
    }
    return out.filter(Boolean);
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
          <Pressable style={[styles.closeBtn, { top: insets.top + 8 }]} onPress={() => router.back()} testID="close-recipe" hitSlop={8}>
            <Icon name="close" size={22} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.metaRow}>
            {p.cuisine ? <Meta icon="earth" text={String(p.cuisine)} /> : null}
            {p.cooking_time ? <Meta icon="clock-outline" text={String(p.cooking_time)} /> : null}
            {p.difficulty ? <Meta icon="chef-hat" text={String(p.difficulty)} /> : null}
          </View>
          {p.description ? <Text style={styles.desc}>{String(p.description)}</Text> : null}

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

function Meta({ icon, text }: { icon: string; text: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.meta}>
      <Icon name={icon} size={14} color={colors.mutedForeground} />
      <Text style={styles.metaText}>{text}</Text>
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
            <View key={idx} style={styles.bulletRow}>
              <Text style={[styles.num, { color: colors.accent }]}>{num}.</Text>
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
  heroWrap: { width: '100%', height: 240 },
  hero: { width: '100%', height: '100%', backgroundColor: colors.secondary },
  closeBtn: { position: 'absolute', right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  title: { fontFamily: f.serif, fontSize: 32, color: colors.foreground, lineHeight: 36 },
  metaRow: { flexDirection: 'row', gap: 14, marginTop: 12, flexWrap: 'wrap' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontFamily: f.bodyMedium, fontSize: 13, color: colors.mutedForeground },
  desc: { fontFamily: f.body, fontSize: 15, color: colors.mutedForeground, marginTop: 14, lineHeight: 22 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18, backgroundColor: colors.accentSoft, borderRadius: 999, paddingVertical: 13 },
  saveText: { fontFamily: f.bodySemiBold, fontSize: 15, color: colors.accent },
  cookBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10, backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 13 },
  cookText: { fontFamily: f.bodySemiBold, fontSize: 15, color: colors.primaryForeground },
  listBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, backgroundColor: colors.primarySoft, borderRadius: 999, paddingVertical: 13 },
  listText: { fontFamily: f.bodySemiBold, fontSize: 15, color: colors.primary },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 22 },
  h1: { fontFamily: f.serif, fontSize: 26, color: colors.foreground, marginTop: 12, marginBottom: 4 },
  h2: { fontFamily: f.serif, fontSize: 22, color: colors.foreground, marginTop: 16, marginBottom: 4 },
  h3: { fontFamily: f.bodyBold, fontSize: 16, color: colors.foreground, marginTop: 12, marginBottom: 2 },
  p: { fontFamily: f.body, fontSize: 15, color: colors.foreground, lineHeight: 23 },
  bold: { fontFamily: f.bodyBold, color: colors.foreground },
  bulletRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 2 },
  bulletDot: { width: 6, height: 6, borderRadius: 3, marginTop: 9 },
  num: { fontFamily: f.bodyBold, fontSize: 15, marginTop: 0 },
}));
