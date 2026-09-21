import React, { useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/src/api/client';
import { makeStyles, useTheme } from '@/src/theme';
import { Loading, EmptyState, Icon, useToast } from '@/src/components/ui';
import { RecipeCard } from '@/src/components/RecipeCard';

type SavedRecipe = {
  id: string;
  title: string;
  description?: string;
  prep_time?: string;
  cook_time?: string;
  complexity?: string;
  cuisine_type?: string;
  image_url?: string;
  ingredients?: string[];
};

export default function Saved() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['saved-recipes'],
    queryFn: async () => {
      const res = await api.get('/recipes/saved');
      return (Array.isArray(res.data?.recipes) ? res.data.recipes : []) as SavedRecipe[];
    },
  });

  const cartMut = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/recipes/${id}/add-to-shopping-list`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
      toast.show('Ingredients added to shopping list', 'success');
    },
    onError: () => toast.show('Could not add to shopping list', 'error'),
  });

  const { data: ratingsMap } = useQuery({
    queryKey: ['my-ratings'],
    queryFn: async () => {
      const res = await api.get('/recipes/my-ratings');
      return (res.data.ratings || {}) as Record<string, number>;
    },
  });

  const rateMut = useMutation({
    mutationFn: async ({ id, rating }: { id: string; rating: number }) => {
      await api.post(`/recipes/${id}/rate`, { rating });
    },
    onSuccess: (_d, { id, rating }) => {
      queryClient.setQueryData(['my-ratings'], (prev: Record<string, number> = {}) => ({ ...prev, [id]: rating }));
      toast.show('Thanks for rating!', 'success');
    },
    onError: () => toast.show('Could not save rating', 'error'),
  });

  const [topRatedOnly, setTopRatedOnly] = useState(false);

  const ratings = ratingsMap || {};
  const allRecipes = (Array.isArray(data) ? data : [])
    .slice()
    .sort((a, b) => (ratings[b.id] || 0) - (ratings[a.id] || 0));
  const recipes = topRatedOnly ? allRecipes.filter((r) => (ratings[r.id] || 0) >= 4) : allRecipes;
  const topRatedCount = allRecipes.filter((r) => (ratings[r.id] || 0) >= 4).length;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Your Collection</Text>
          <Text style={styles.sub}>{allRecipes.length} saved recipe{allRecipes.length === 1 ? '' : 's'}</Text>
        </View>
        <Pressable style={styles.importBtn} onPress={() => router.push('/import')} testID="open-import">
          <Icon name="plus" size={22} color={colors.primaryForeground} />
        </Pressable>
      </View>
      {allRecipes.length > 0 ? (
        <View style={styles.filterRow}>
          <Pressable
            testID="filter-all"
            onPress={() => setTopRatedOnly(false)}
            style={[styles.filterChip, { backgroundColor: !topRatedOnly ? colors.primary : colors.secondary }]}
          >
            <Text style={[styles.filterText, { color: !topRatedOnly ? colors.primaryForeground : colors.secondaryForeground }]}>All</Text>
          </Pressable>
          <Pressable
            testID="filter-top-rated"
            onPress={() => setTopRatedOnly(true)}
            style={[styles.filterChip, { backgroundColor: topRatedOnly ? colors.accent : colors.secondary }]}
          >
            <Icon name="star" size={14} color={topRatedOnly ? colors.accentForeground : colors.accent} />
            <Text style={[styles.filterText, { color: topRatedOnly ? colors.accentForeground : colors.secondaryForeground }]}>4★ &amp; up{topRatedCount ? ` · ${topRatedCount}` : ''}</Text>
          </Pressable>
        </View>
      ) : null}
      {isLoading ? (
        <Loading />
      ) : recipes.length === 0 ? (
        topRatedOnly ? (
          <EmptyState icon="star-outline" title="No 4★ recipes yet" subtitle="Rate your favourites 4 stars or higher and they'll show up here." />
        ) : (
          <EmptyState icon="heart-outline" title="No saved recipes yet" subtitle="Tap the heart on any recipe to keep it here for later." />
        )
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        >
          {recipes.map((r) => (
            <RecipeCard
              key={r.id}
              recipe={{
                title: r.title,
                description: r.description,
                cooking_time: r.cook_time || r.prep_time,
                difficulty: r.complexity,
                cuisine: r.cuisine_type,
                image_url: r.image_url,
              }}
              onPress={() =>
                router.push({
                  pathname: '/recipe',
                  params: {
                    title: r.title,
                    description: r.description || '',
                    cuisine: r.cuisine_type || 'International',
                    meal: 'Dinner',
                    dietary: 'Any',
                    cooking_time: r.cook_time || '',
                    difficulty: r.complexity || '',
                    ingredients: JSON.stringify(r.ingredients || []),
                  },
                })
              }
              onAddToCart={() => cartMut.mutate(r.id)}
              rating={ratings[r.id]}
              onRate={(value) => rateMut.mutate({ id: r.id, rating: value })}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const useStyles = makeStyles(({ colors, spacing, fonts: f }) => ({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: 10, paddingBottom: 8 },
  importBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.lg, paddingTop: 4, paddingBottom: 8 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  filterText: { fontFamily: f.bodyMedium, fontSize: 13 },
  title: { fontFamily: f.serif, fontSize: 32, color: colors.foreground },
  sub: { fontFamily: f.body, fontSize: 14, color: colors.mutedForeground, marginTop: 2 },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: 10 },
}));
