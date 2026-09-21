import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/src/api/client';
import { makeStyles, useTheme, fonts } from '@/src/theme';
import { Icon } from '@/src/components/ui';
import { useSubscription } from '@/src/lib/revenuecat';

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

// Deterministic food image for a recipe title using Unsplash source keywords.
export function foodImage(title: string, cuisine?: string) {
  const q = encodeURIComponent(`${title} ${cuisine || ''} food dish`.trim());
  return `https://source.unsplash.com/400x300/?${q}`;
}

// Fetches (and caches on the backend) an AI-generated food photo for the recipe.
export function useRecipeImage(title: string, cuisine?: string, description?: string, enabled = true) {
  return useQuery({
    queryKey: ['recipe-image', title, cuisine],
    enabled: enabled && !!title,
    staleTime: Infinity,
    retry: 1,
    queryFn: async () => {
      const res = await api.post('/recipe-image/ai-generate', { title, cuisine: cuisine || '', description: description || '' });
      return `${BACKEND}${res.data.url}` as string;
    },
  });
}

export type RecipeCardData = {
  id?: string;
  title: string;
  description?: string;
  cooking_time?: string;
  difficulty?: string;
  cuisine?: string;
  image_url?: string;
};

export function RecipeCard({
  recipe, onPress, onSave, saved, saving, onAddToCart, rating, onRate,
}: {
  recipe: RecipeCardData;
  onPress: () => void;
  onSave?: () => void;
  saved?: boolean;
  saving?: boolean;
  onAddToCart?: () => void;
  rating?: number;
  onRate?: (value: number) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { isSubscribed } = useSubscription();
  const aiImg = useRecipeImage(recipe.title, recipe.cuisine, recipe.description, !recipe.image_url && isSubscribed);
  const resolvedImageUrl = recipe.image_url && recipe.image_url.startsWith('/') ? `${BACKEND}${recipe.image_url}` : recipe.image_url;
  const img = resolvedImageUrl || aiImg.data || foodImage(recipe.title, recipe.cuisine);
  const showPremiumPhotoHint = !recipe.image_url && !isSubscribed;

  return (
    <Pressable
      testID={`recipe-card-${recipe.title}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] }]}
    >
      <View>
        <Image source={{ uri: img }} style={styles.img} contentFit="cover" transition={250} />
        {!recipe.image_url && isSubscribed && aiImg.isLoading ? (
          <View style={styles.imgBadge}>
            <Icon name="creation" size={12} color="#FFFFFF" />
            <Text style={styles.imgBadgeText}>Plating…</Text>
          </View>
        ) : null}
        {showPremiumPhotoHint ? (
          <View style={styles.premiumBadge}>
            <Icon name="crown" size={12} color="#FFFFFF" />
            <Text style={styles.imgBadgeText}>AI photo · Premium</Text>
          </View>
        ) : null}
        <View style={styles.actions}>
          {onAddToCart ? (
            <Pressable testID={`cart-${recipe.title}`} onPress={onAddToCart} style={styles.actionBtn} hitSlop={8}>
              <Icon name="cart-plus" size={19} color="#FFFFFF" />
            </Pressable>
          ) : null}
          {onSave ? (
            <Pressable testID={`save-${recipe.title}`} onPress={onSave} style={styles.actionBtn} hitSlop={8}>
              <Icon name={saved ? 'heart' : 'heart-outline'} size={19} color={saved ? colors.accent : '#FFFFFF'} />
            </Pressable>
          ) : null}
        </View>
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>{recipe.title}</Text>
        {recipe.description ? (
          <Text style={styles.desc} numberOfLines={2}>{recipe.description}</Text>
        ) : null}
        <View style={styles.metaRow}>
          {recipe.cuisine ? (
            <View style={styles.tag}><Text style={styles.tagText}>{recipe.cuisine}</Text></View>
          ) : null}
          {recipe.cooking_time ? (
            <View style={styles.metaItem}>
              <Icon name="clock-outline" size={13} color={colors.mutedForeground} />
              <Text style={styles.metaText}>{recipe.cooking_time}</Text>
            </View>
          ) : null}
          {recipe.difficulty ? (
            <View style={styles.metaItem}>
              <Icon name="chef-hat" size={13} color={colors.mutedForeground} />
              <Text style={styles.metaText}>{recipe.difficulty}</Text>
            </View>
          ) : null}
        </View>
        {onRate ? (
          <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} testID={`rate-${recipe.title}-${n}`} onPress={() => onRate(n)} hitSlop={6} style={styles.star}>
                <Icon name={(rating || 0) >= n ? 'star' : 'star-outline'} size={20} color={(rating || 0) >= n ? colors.accent : colors.borderStrong} />
              </Pressable>
            ))}
            {rating ? <Text style={styles.ratingText}>Your rating</Text> : <Text style={styles.ratingText}>Rate this</Text>}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors, radius }) => ({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  img: { width: '100%', height: 168, backgroundColor: colors.secondary },
  imgBadge: {
    position: 'absolute', left: 12, top: 12, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4,
  },
  premiumBadge: {
    position: 'absolute', left: 12, top: 12, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(198,107,61,0.92)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4,
  },
  imgBadgeText: { color: '#FFFFFF', fontFamily: fonts.bodyMedium, fontSize: 11 },
  saveBtn: {
    position: 'absolute', top: 12, right: 12,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center',
  },
  actions: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', gap: 8 },
  actionBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center',
  },
  body: { padding: 16 },
  title: { fontFamily: fonts.serif, fontSize: 21, color: colors.foreground, lineHeight: 25 },
  desc: { fontFamily: fonts.body, fontSize: 13.5, color: colors.mutedForeground, marginTop: 5, lineHeight: 19 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' },
  tag: { backgroundColor: colors.accentSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontFamily: fonts.bodyMedium, fontSize: 11.5, color: colors.accent },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.mutedForeground },
  starRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  star: { padding: 2 },
  ratingText: { fontFamily: fonts.body, fontSize: 12, color: colors.mutedForeground, marginLeft: 8 },
}));
