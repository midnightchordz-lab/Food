import React from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/src/api/client';
import { makeStyles, useTheme, fonts } from '@/src/theme';
import { Loading, EmptyState } from '@/src/components/ui';
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

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['saved-recipes'],
    queryFn: async () => {
      const res = await api.get('/recipes/saved');
      return (res.data.recipes || []) as SavedRecipe[];
    },
  });

  const recipes = data || [];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Collection</Text>
        <Text style={styles.sub}>{recipes.length} saved recipe{recipes.length === 1 ? '' : 's'}</Text>
      </View>
      {isLoading ? (
        <Loading />
      ) : recipes.length === 0 ? (
        <EmptyState icon="heart-outline" title="No saved recipes yet" subtitle="Tap the heart on any recipe to keep it here for later." />
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
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const useStyles = makeStyles(({ colors, spacing, fonts: f }) => ({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: 10, paddingBottom: 8 },
  title: { fontFamily: f.serif, fontSize: 32, color: colors.foreground },
  sub: { fontFamily: f.body, fontSize: 14, color: colors.mutedForeground, marginTop: 2 },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: 10 },
}));
