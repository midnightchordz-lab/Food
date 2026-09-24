import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/src/api/client';
import { makeStyles, useTheme, fonts } from '@/src/theme';
import { Icon } from '@/src/components/ui';

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

// Curated, fast-loading direct Unsplash CDN food photos (source.unsplash.com is retired
// and hangs, so we never use it). We pick a relevant photo by keyword, else deterministically.
const FOOD_IMAGES: { kw: string[]; url: string }[] = [
  // Cuisine/dish-specific buckets FIRST so e.g. "butter chicken" doesn't grab a grilled-meat photo.
  { kw: ['butter chicken', 'tikka', 'masala', 'paneer', 'korma', 'biryani', 'dal', 'curry', 'indian', 'tandoori'], url: 'photo-1585937421612-70a008356fbe' },
  { kw: ['pizza'], url: 'photo-1513104890138-7c749659a591' },
  { kw: ['pasta', 'spaghetti', 'italian', 'lasagna', 'risotto'], url: 'photo-1621996346565-e3dbc646d9a9' },
  { kw: ['taco', 'mexican', 'burrito', 'wrap', 'quesadilla', 'enchilada'], url: 'photo-1565299624946-b28f40a0ae38' },
  { kw: ['pad thai', 'thai', 'green curry', 'tom yum', 'asian', 'stir fry', 'stir-fry'], url: 'photo-1585937421612-70a008356fbe' },
  { kw: ['sushi', 'teriyaki', 'katsu', 'ramen', 'miso', 'japanese', 'noodle'], url: 'photo-1547592166-23ac45744acd' },
  { kw: ['salad', 'greens', 'bowl', 'vegan', 'vegetable', 'veg'], url: 'photo-1512621776951-a57141f2eefd' },
  { kw: ['soup', 'stew', 'broth', 'chowder'], url: 'photo-1547592166-23ac45744acd' },
  { kw: ['fish', 'salmon', 'seafood', 'shrimp', 'prawn'], url: 'photo-1467003909585-2f8a72700288' },
  { kw: ['pancake', 'waffle', 'oat', 'toast', 'omelette', 'breakfast', 'egg'], url: 'photo-1525351484163-7529414344d8' },
  { kw: ['dessert', 'cake', 'sweet', 'chocolate', 'cookie', 'pudding', 'brownie'], url: 'photo-1488477181946-6428a0291777' },
  { kw: ['sandwich', 'burger'], url: 'photo-1568901346375-23c9450c58cd' },
  { kw: ['smoothie', 'juice', 'beverage', 'latte', 'coffee'], url: 'photo-1610970881699-44a5587cabec' },
  // Generic grilled-meat bucket LAST — only when nothing more specific matched.
  { kw: ['steak', 'grill', 'bbq', 'beef', 'pork', 'chicken', 'meat', 'drumstick', 'kebab', 'skewer'], url: 'photo-1432139555190-58524dae6a55' },
];
const FALLBACK_FOOD = [
  'photo-1504674900247-0877df9cc836',
  'photo-1476224203421-9ac39bcb3327',
  'photo-1490645935967-10de6ba17061',
  'photo-1546069901-ba9599a7e63c',
];

// Deterministic, reliable food image for a recipe title (direct Unsplash CDN, cached).
export function foodImage(title: string, cuisine?: string) {
  const hay = `${title} ${cuisine || ''}`.toLowerCase();
  const match = FOOD_IMAGES.find((f) => f.kw.some((k) => hay.includes(k)));
  let id = match?.url;
  if (!id) {
    let h = 0;
    for (let i = 0; i < hay.length; i++) h = (h * 31 + hay.charCodeAt(i)) >>> 0;
    id = FALLBACK_FOOD[h % FALLBACK_FOOD.length];
  }
  return `https://images.unsplash.com/${id}?w=500&q=70&auto=format&fit=crop`;
}

// Fetches (and caches on the backend) an AI-generated food photo for the recipe.
export function useRecipeImage(
  title: string,
  cuisine?: string,
  description?: string,
  ingredients?: string[],
  enabled = true,
) {
  return useQuery({
    queryKey: ['recipe-image', title, cuisine, ingredients?.join(',')],
    enabled: enabled && !!title,
    staleTime: Infinity,
    retry: 1,
    queryFn: async () => {
      const res = await api.post('/recipe-image/ai-generate', {
        title,
        cuisine: cuisine || '',
        description: description || '',
        ingredients: ingredients || [],
      });
      return `${BACKEND}${res.data.url}` as string;
    },
  });
}

// Fetches (and caches on the backend) a SELF-VALIDATED AI food photo — same
// pipeline as the 10-minute meals flow. Returns the url plus whether the image
// passed the model's own verification (drives the "Verified photo" badge).
export function useValidatedRecipeImage(
  title: string,
  cuisine?: string,
  description?: string,
  ingredients?: string[],
  enabled = true,
) {
  return useQuery({
    queryKey: ['recipe-image-validated', title, cuisine, ingredients?.join(',')],
    enabled: enabled && !!title,
    staleTime: Infinity,
    retry: 1,
    queryFn: async () => {
      const res = await api.post('/recipe-image/ai-generate-validated', {
        title,
        cuisine: cuisine || '',
        description: description || '',
        ingredients: ingredients || [],
      });
      return {
        url: `${BACKEND}${res.data.url}` as string,
        validated: !!res.data.validated,
        proof: (res.data.proof || '') as string,
      };
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
  ingredients?: string[];
};

export function RecipeCard({
  recipe, onPress, onSave, saved, saving, onAddToCart, rating, onRate, verified, useAiImage, validatedAiImage,
}: {
  recipe: RecipeCardData;
  onPress: () => void;
  onSave?: () => void;
  saved?: boolean;
  saving?: boolean;
  onAddToCart?: () => void;
  rating?: number;
  onRate?: (value: number) => void;
  verified?: boolean;
  useAiImage?: boolean;
  validatedAiImage?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const resolvedImageUrl = recipe.image_url && recipe.image_url.startsWith('/') ? `${BACKEND}${recipe.image_url}` : recipe.image_url;
  // When opted in (e.g. Discover results), fetch the dish-accurate AI photo so each
  // recipe gets its own image instead of a shared cuisine stock photo. The fast CDN
  // photo shows instantly as a placeholder until the AI image is plated (backend-cached).
  const ai = useRecipeImage(
    recipe.title,
    recipe.cuisine,
    recipe.description,
    recipe.ingredients,
    !!useAiImage && !validatedAiImage && !resolvedImageUrl,
  );
  // Self-validated variant (same logic as 10-minute meals) — also drives the badge.
  const validatedAi = useValidatedRecipeImage(
    recipe.title,
    recipe.cuisine,
    recipe.description,
    recipe.ingredients,
    !!validatedAiImage && !resolvedImageUrl,
  );
  const img = resolvedImageUrl || validatedAi.data?.url || ai.data || foodImage(recipe.title, recipe.cuisine);
  const showVerified = verified || (!!validatedAiImage && validatedAi.data?.validated === true);

  return (
    <Pressable
      testID={`recipe-card-${recipe.title}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] }]}
    >
      <View>
        <Image source={{ uri: img }} style={styles.img} contentFit="cover" transition={250} cachePolicy="memory-disk" recyclingKey={img} />
        {showVerified ? (
          <View style={styles.verifiedBadge}>
            <Icon name="check-decagram" size={13} color="#FFFFFF" />
            <Text style={styles.verifiedText}>Verified photo</Text>
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
  verifiedBadge: {
    position: 'absolute', left: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(46,125,50,0.92)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
  },
  verifiedText: { color: '#FFFFFF', fontFamily: fonts.bodySemiBold, fontSize: 11 },
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
