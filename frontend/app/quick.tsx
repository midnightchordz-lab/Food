import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/src/api/client';
import { makeStyles, useTheme } from '@/src/theme';
import { Icon, Button, useToast } from '@/src/components/ui';
import { RecipeCard } from '@/src/components/RecipeCard';
import { DIETARY_PREFS } from '@/src/constants/data';

const CUISINES = ['International', 'Indian', 'Italian', 'Thai', 'Mexican', 'Mediterranean', 'Chinese', 'American'];

type QuickRecipe = {
  name: string;
  timing: string;
  total_minutes: number;
  cuisine: string;
  difficulty: string;
  ingredients: string[];
  instructions: string[];
  pro_tip?: string;
};

export default function Quick() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();

  const [dietary, setDietary] = useState('balanced');
  const [cuisine, setCuisine] = useState('International');
  const [recipes, setRecipes] = useState<QuickRecipe[]>([]);
  const [tips, setTips] = useState<string[]>([]);

  const genMut = useMutation({
    mutationFn: async () => {
      const res = await api.post('/quick-recipes/generate', {
        count: 3,
        dietary,
        cuisine: cuisine.toLowerCase(),
        mood: 'energizing',
        ingredients: [],
        equipment: 'basic',
      });
      return res.data as { recipes: QuickRecipe[]; speed_tips: string[] };
    },
    onSuccess: (data) => {
      setRecipes(data.recipes || []);
      setTips(data.speed_tips || []);
    },
    onError: () => toast.show('Could not generate recipes. Try again.', 'error'),
  });

  const openRecipe = (r: QuickRecipe) => {
    const parts = [
      '## Ingredients',
      ...r.ingredients.map((i) => `- ${i}`),
      '',
      '## Instructions',
      ...r.instructions.map((s, i) => `${i + 1}. ${s}`),
    ];
    if (r.pro_tip) parts.push('', `**Pro tip:** ${r.pro_tip}`);
    router.push({
      pathname: '/recipe',
      params: {
        title: r.name,
        cuisine: r.cuisine,
        cooking_time: r.timing,
        difficulty: r.difficulty,
        ingredients: JSON.stringify(r.ingredients),
        content: parts.join('\n'),
      },
    });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} testID="quick-close"><Icon name="close" size={24} color={colors.foreground} /></Pressable>
        <Text style={styles.headerTitle}>10-Minute Meals</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.controlCard}>
          <Text style={styles.controlTitle}>Dietary</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {[{ id: 'balanced', label: 'Balanced' }, ...DIETARY_PREFS].map((d) => (
              <Pressable
                key={d.id}
                testID={`quick-diet-${d.id}`}
                onPress={() => setDietary(d.id)}
                style={[styles.chip, { backgroundColor: dietary === d.id ? colors.accent : colors.secondary }]}
              >
                <Text style={[styles.chipText, { color: dietary === d.id ? colors.accentForeground : colors.secondaryForeground }]}>{d.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={[styles.controlTitle, { marginTop: 14 }]}>Cuisine</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {CUISINES.map((c) => (
              <Pressable
                key={c}
                testID={`quick-cuisine-${c.toLowerCase()}`}
                onPress={() => setCuisine(c)}
                style={[styles.chip, { backgroundColor: cuisine === c ? colors.primary : colors.secondary }]}
              >
                <Text style={[styles.chipText, { color: cuisine === c ? colors.primaryForeground : colors.secondaryForeground }]}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={{ height: 14 }} />
          <Button
            label={recipes.length ? 'Get 3 more' : 'Find 10-minute meals'}
            icon="lightning-bolt"
            onPress={() => genMut.mutate()}
            loading={genMut.isPending}
            testID="generate-quick"
          />
        </View>

        {genMut.isPending ? (
          <View style={styles.loadingBox}>
            <Icon name="lightning-bolt" size={34} color={colors.primary} />
            <Text style={styles.loadingText}>Finding speedy recipes…</Text>
          </View>
        ) : recipes.length === 0 ? (
          <View style={styles.emptyBox}>
            <Icon name="timer-outline" size={40} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>Pick your taste and get 3 recipes you can cook in 10 minutes or less.</Text>
          </View>
        ) : (
          <>
            {recipes.map((r, i) => (
              <RecipeCard
                key={`${r.name}-${i}`}
                recipe={{
                  title: r.name,
                  description: r.pro_tip,
                  cooking_time: `${r.total_minutes} min`,
                  difficulty: r.difficulty,
                  cuisine: r.cuisine,
                  ingredients: r.ingredients,
                }}
                onPress={() => openRecipe(r)}
              />
            ))}
            {tips.length > 0 ? (
              <View style={styles.tipsCard}>
                <Text style={styles.tipsTitle}>⚡ Speed cooking hacks</Text>
                {tips.map((t, i) => (
                  <View key={i} style={styles.tipRow}>
                    <Icon name="check-circle-outline" size={16} color={colors.primary} />
                    <Text style={styles.tipText}>{t}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles(({ colors, radius, spacing, fonts: f }) => ({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 12 },
  headerTitle: { fontFamily: f.serif, fontSize: 24, color: colors.foreground },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: 8 },
  controlCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 16, marginBottom: 16 },
  controlTitle: { fontFamily: f.bodySemiBold, fontSize: 13, color: colors.mutedForeground, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  chipRow: { gap: 8, paddingRight: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, flexShrink: 0 },
  chipText: { fontFamily: f.bodyMedium, fontSize: 13 },
  loadingBox: { alignItems: 'center', gap: 12, paddingVertical: 40 },
  loadingText: { fontFamily: f.serifMedium, fontSize: 18, color: colors.foreground },
  emptyBox: { alignItems: 'center', gap: 12, paddingVertical: 40 },
  emptyText: { fontFamily: f.body, fontSize: 14, color: colors.mutedForeground, textAlign: 'center', lineHeight: 21, paddingHorizontal: 20 },
  tipsCard: { backgroundColor: colors.primarySoft, borderRadius: radius.lg, padding: 18, marginTop: 4 },
  tipsTitle: { fontFamily: f.bodyBold, fontSize: 15, color: colors.foreground, marginBottom: 10 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  tipText: { flex: 1, fontFamily: f.body, fontSize: 13.5, color: colors.foreground, lineHeight: 19 },
}));
