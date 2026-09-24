import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/src/api/client';
import { useAuth } from '@/src/auth/AuthContext';
import { makeStyles, useTheme } from '@/src/theme';
import { Icon, Button, useToast } from '@/src/components/ui';
import { RecipeCard } from '@/src/components/RecipeCard';
import { PressableScale } from '@/src/components/PressableScale';
import { useSubscription } from '@/src/lib/revenuecat';
import { MOODS, MEAL_TYPES, DIETARY_PREFS, CUISINES, StructuredRecipe } from '@/src/constants/data';

const FREE_REGENERATIONS = 2;

type Step = 'mood' | 'meal' | 'dietary' | 'cuisine' | 'results';

export default function Discover() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isSubscribed, trialDaysLeft, trialExpired, premiumInfo } = useSubscription();
  const [regenCount, setRegenCount] = useState(0);

  const [step, setStep] = useState<Step>('mood');
  const [mood, setMood] = useState<string | null>(null);
  const [meal, setMeal] = useState<string | null>(null);
  const [dietary, setDietary] = useState<string | null>(null);
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [recipes, setRecipes] = useState<StructuredRecipe[]>([]);
  const [shownTitles, setShownTitles] = useState<string[]>([]);
  const [savedTitles, setSavedTitles] = useState<Record<string, boolean>>({});

  const sessionId = React.useRef(`session-${Date.now()}`).current;

  const exclusionsQuery = useQuery({
    queryKey: ['exclusions'],
    queryFn: async () => {
      const res = await api.get('/exclusions');
      return (res.data.excluded_ingredient_names || []) as string[];
    },
  });
  const exclusions = exclusionsQuery.data || [];

  const buildMessage = (wantDifferent = false) => {
    const m = MOODS.find((x) => x.id === mood);
    const mt = MEAL_TYPES.find((x) => x.id === meal);
    const dp = DIETARY_PREFS.find((x) => x.id === dietary);
    const cu = cuisine === 'any' ? 'any cuisine' : CUISINES.find((x) => x.id === cuisine)?.label || 'any cuisine';
    const avoid = exclusions.length ? `\n- Avoid these ingredients entirely: ${exclusions.join(', ')}` : '';
    const noRepeat = shownTitles.length
      ? `\n- ALREADY SHOWN (do NOT repeat or lightly rename any of these): ${shownTitles.join('; ')}`
      : '';
    return `[User Preferences]
- Mood: ${m?.label} (${m?.description})
- Meal Type: ${mt?.label}
- Dietary Preference: ${dp?.label}
- Cuisine(s): ${cu}${avoid}${noRepeat}

Create 4 ORIGINAL ${mt?.label?.toLowerCase()} recipes that match the ${m?.label?.toLowerCase()} mood, are ${dp?.label?.toLowerCase()} friendly, and feature authentic ${cu} flavors. Give each a creative, appetizing name.${wantDifferent || shownTitles.length ? ' Every recipe MUST be completely DIFFERENT from the already-shown list above — new dishes, not variations.' : ''}`;
  };

  const genMut = useMutation({
    mutationFn: async (wantDifferent: boolean) => {
      const res = await api.post('/chat/send', { session_id: sessionId, message: buildMessage(wantDifferent) });
      return (res.data.structured_recipes || []) as StructuredRecipe[];
    },
    onSuccess: (data) => {
      setRecipes(data);
      setShownTitles((prev) => Array.from(new Set([...prev, ...data.map((r) => r.title)])).slice(-40));
      setStep('results');
    },
    onError: (e: any) => {
      const detail = e?.response?.data?.detail;
      const msg = typeof detail === 'object' ? detail?.message : detail;
      toast.show(msg || 'Could not fetch recipes. Try again.', 'error');
    },
  });

  const saveMut = useMutation({
    mutationFn: async (r: StructuredRecipe) => {
      await api.post('/recipes/save', {
        recipe: {
          title: r.title,
          description: r.description || '',
          ingredients: r.ingredients?.length ? r.ingredients : ['See recipe details'],
          instructions: ['Open recipe for full instructions'],
          mood_tags: [mood || 'comfort'],
          prep_time: r.cooking_time || '30 min',
          cook_time: r.cooking_time || '30 min',
          complexity: (r.difficulty || 'medium').toLowerCase(),
          nutritional_highlights: 'Mood-boosting nutrients',
          dietary_info: dietary ? [dietary] : [],
          cuisine_type: r.cuisine || cuisine || '',
        },
      });
    },
    onSuccess: (_d, r) => {
      setSavedTitles((s) => ({ ...s, [r.title]: true }));
      queryClient.invalidateQueries({ queryKey: ['saved-recipes'] });
      toast.show('Saved to your collection', 'success');
    },
    onError: () => toast.show('Could not save recipe', 'error'),
  });

  const reset = () => {
    setStep('mood'); setMood(null); setMeal(null); setDietary(null); setCuisine(null); setRecipes([]); setShownTitles([]);
  };

  const regenerate = () => {
    if (!isSubscribed && regenCount >= FREE_REGENERATIONS) {
      router.push('/paywall');
      return;
    }
    setRegenCount((c) => c + 1);
    genMut.mutate(true);
  };

  const openRecipe = (r: StructuredRecipe) => {
    router.push({
      pathname: '/recipe',
      params: {
        title: r.title,
        description: r.description || '',
        cuisine: r.cuisine || cuisine || 'International',
        meal: MEAL_TYPES.find((x) => x.id === meal)?.label || 'Dinner',
        dietary: DIETARY_PREFS.find((x) => x.id === dietary)?.label || 'Any',
        cooking_time: r.cooking_time || '',
        difficulty: r.difficulty || '',
        ingredients: JSON.stringify(r.ingredients || []),
      },
    });
  };

  const stepIndex = ['mood', 'meal', 'dietary', 'cuisine'].indexOf(step);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Sticky header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.brand}>MOOD<Text style={{ color: colors.primary }}>FOOD</Text></Text>
            <Text style={styles.hi}>
              {step === 'results' ? 'Made just for your mood' : `Hi ${user?.name?.split(' ')[0] || 'there'} — how are you?`}
            </Text>
          </View>
          {step === 'results' ? (
            <Pressable testID="new-search" onPress={reset} style={styles.iconBtn}>
              <Icon name="refresh" size={20} color={colors.foreground} />
            </Pressable>
          ) : null}
        </View>

        {step !== 'results' && (
          <View style={styles.progress}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[styles.progressDot, { backgroundColor: i <= stepIndex ? colors.primary : colors.border }]} />
            ))}
          </View>
        )}

        {exclusions.length > 0 && (
          <Pressable style={styles.exclBadge} onPress={() => router.push('/exclusions')} testID="exclusion-badge">
            <Icon name="shield-check" size={14} color={colors.primary} />
            <Text style={styles.exclBadgeText} numberOfLines={1}>
              Avoiding {exclusions.slice(0, 2).join(', ')}{exclusions.length > 2 ? ` +${exclusions.length - 2}` : ''}
            </Text>
          </Pressable>
        )}
      </View>

      {isSubscribed && trialDaysLeft !== null ? (
        <Pressable
          style={[styles.trialBanner, trialDaysLeft <= 1 && styles.trialBannerUrgent]}
          onPress={() => router.push('/paywall')}
          testID="trial-banner"
        >
          <Icon name={trialDaysLeft <= 1 ? 'crown' : 'clock-outline'} size={17} color={colors.accent} />
          <Text style={styles.trialBannerText} numberOfLines={2}>
            {trialDaysLeft <= 0
              ? 'Your free trial ends today — tap to keep Premium'
              : trialDaysLeft === 1
              ? 'Last day of your free trial — tap to continue Premium'
              : `${trialDaysLeft} days left in your free trial`}
          </Text>
          <Icon name="chevron-right" size={18} color={colors.accent} />
        </Pressable>
      ) : trialExpired ? (
        <Pressable style={styles.trialEndedBanner} onPress={() => router.push('/paywall')} testID="trial-ended-banner">
          <Icon name="crown" size={18} color={colors.accentForeground} />
          <View style={{ flex: 1 }}>
            <Text style={styles.trialEndedTitle}>Your free trial has ended</Text>
            <Text style={styles.trialEndedDesc}>Continue Premium to keep unlimited recipes & meal plans</Text>
          </View>
          <View style={styles.trialEndedCta}><Text style={styles.trialEndedCtaText}>Continue</Text></View>
        </Pressable>
      ) : null}

      {step === 'results' ? (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={genMut.isPending} onRefresh={regenerate} tintColor={colors.primary} />}
        >
          <SelectionChips mood={mood} meal={meal} dietary={dietary} cuisine={cuisine} />
          {recipes.map((r) => (
            <RecipeCard
              key={r.title}
              recipe={r}
              validatedAiImage
              onPress={() => openRecipe(r)}
              onSave={() => saveMut.mutate(r)}
              saved={!!savedTitles[r.title]}
            />
          ))}
          <View style={{ height: 8 }} />
          <Button label="Show me different recipes" variant="outline" icon="shuffle-variant" onPress={regenerate} loading={genMut.isPending} testID="regenerate" />
          {!isSubscribed && regenCount >= FREE_REGENERATIONS ? (
            <Pressable style={styles.upsell} onPress={() => router.push('/paywall')} testID="regen-upsell">
              <Icon name="crown" size={16} color={colors.accent} />
              <Text style={styles.upsellText}>Go Premium for unlimited fresh recipes</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
          {step === 'mood' && (
            <>
              <Pressable style={styles.quickBanner} testID="open-quick" onPress={() => router.push('/quick')}>
                <View style={styles.quickBannerIcon}><Icon name="lightning-bolt" size={22} color={colors.primaryForeground} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.quickBannerTitle}>10-minute meals</Text>
                  <Text style={styles.quickBannerDesc}>In a rush? Get recipes you can cook fast</Text>
                </View>
                <Icon name="chevron-right" size={22} color={colors.primaryForeground} />
              </Pressable>
              <View style={styles.quickRow}>
                <Pressable style={styles.quickCard} testID="snap-dish" onPress={() => router.push('/import?tab=photo')}>
                  <View style={styles.quickIcon}><Icon name="camera-iris" size={22} color={colors.primary} /></View>
                  <Text style={styles.quickTitle}>Snap a dish</Text>
                  <Text style={styles.quickDesc} numberOfLines={2}>Photo any meal to get its recipe</Text>
                </Pressable>
                <Pressable style={styles.quickCard} testID="scan-fridge" onPress={() => router.push('/fridge')}>
                  <View style={styles.quickIcon}><Icon name="fridge-outline" size={22} color={colors.accent} /></View>
                  <Text style={styles.quickTitle}>Scan my fridge</Text>
                  <Text style={styles.quickDesc} numberOfLines={2}>Cook with what you already have</Text>
                </Pressable>
              </View>
              <Text style={styles.q}>Pick the feeling that fits right now</Text>
              <View style={styles.moodGrid}>
                {MOODS.map((mObj) => (
                  <PressableScale
                    key={mObj.id}
                    testID={`mood-${mObj.id}`}
                    onPress={() => { setMood(mObj.id); setStep('meal'); }}
                    style={styles.moodCard}
                  >
                    <View style={styles.moodImgWrap}>
                      <Image source={{ uri: mObj.image }} style={styles.moodImg} contentFit="cover" transition={200} cachePolicy="memory-disk" recyclingKey={mObj.id} />
                      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.28)']} style={styles.moodImgFade} />
                      <View style={[styles.moodDot, { backgroundColor: mObj.color }]}>
                        <Icon name={mObj.icon} size={16} color="#3A322B" />
                      </View>
                    </View>
                    <Text style={styles.moodLabel}>{mObj.label}</Text>
                    <Text style={styles.moodDesc} numberOfLines={1}>{mObj.description}</Text>
                  </PressableScale>
                ))}
              </View>
            </>
          )}

          {step === 'meal' && (
            <ChoiceList
              title="What meal are we planning?"
              items={MEAL_TYPES}
              selected={meal}
              onSelect={(id) => { setMeal(id); setStep('dietary'); }}
              onBack={() => setStep('mood')}
            />
          )}

          {step === 'dietary' && (
            <ChoiceList
              title="Any dietary preference?"
              items={DIETARY_PREFS}
              selected={dietary}
              onSelect={(id) => { setDietary(id); setStep('cuisine'); }}
              onBack={() => setStep('meal')}
            />
          )}

          {step === 'cuisine' && (
            <>
              <BackRow onBack={() => setStep('dietary')} />
              <Text style={styles.q}>What flavors are you craving?</Text>
              <View style={styles.cuisineWrap}>
                {CUISINES.map((c) => (
                  <Pressable
                    key={c.id}
                    testID={`cuisine-${c.id}`}
                    onPress={() => { setCuisine(c.id); genMut.mutate(false); }}
                    style={({ pressed }) => [styles.cuisineChip, pressed && { transform: [{ scale: 0.96 }] }]}
                  >
                    <Text style={styles.cuisineFlag}>{c.flag}</Text>
                    <Text style={styles.cuisineLabel}>{c.label}</Text>
                  </Pressable>
                ))}
              </View>
              {genMut.isPending && (
                <View style={styles.cooking}>
                  <Image source={{ uri: MOODS.find((m) => m.id === mood)?.image || '' }} style={styles.cookingImg} contentFit="cover" />
                  <Text style={styles.cookingText}>Our AI chef is crafting your recipes…</Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function BackRow({ onBack }: { onBack: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable testID="step-back" onPress={onBack} style={styles.backRow} hitSlop={8}>
      <Icon name="chevron-left" size={20} color={colors.mutedForeground} />
      <Text style={styles.backText}>Back</Text>
    </Pressable>
  );
}

function ChoiceList({
  title, items, selected, onSelect, onBack,
}: {
  title: string;
  items: { id: string; label: string; icon: string }[];
  selected: string | null;
  onSelect: (id: string) => void;
  onBack: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <>
      <BackRow onBack={onBack} />
      <Text style={styles.q}>{title}</Text>
      <View style={{ gap: 12 }}>
        {items.map((it) => {
          const active = selected === it.id;
          return (
            <Pressable
              key={it.id}
              testID={`choice-${it.id}`}
              onPress={() => onSelect(it.id)}
              style={({ pressed }) => [
                styles.choiceRow,
                { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primarySoft : colors.card },
                pressed && { transform: [{ scale: 0.99 }] },
              ]}
            >
              <View style={[styles.choiceIcon, { backgroundColor: active ? colors.primary : colors.secondary }]}>
                <Icon name={it.icon} size={20} color={active ? colors.primaryForeground : colors.foreground} />
              </View>
              <Text style={styles.choiceLabel}>{it.label}</Text>
              <Icon name="chevron-right" size={20} color={colors.mutedForeground} />
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

function SelectionChips({ mood, meal, dietary, cuisine }: { mood: string | null; meal: string | null; dietary: string | null; cuisine: string | null }) {
  const styles = useStyles();
  const chips = [
    MOODS.find((m) => m.id === mood)?.label,
    MEAL_TYPES.find((m) => m.id === meal)?.label,
    DIETARY_PREFS.find((d) => d.id === dietary)?.label,
    cuisine === 'any' ? 'Surprise' : CUISINES.find((c) => c.id === cuisine)?.label,
  ].filter(Boolean) as string[];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} style={styles.chipScroller}>
      {chips.map((c) => (
        <View key={c} style={styles.summaryChip}><Text style={styles.summaryChipText}>{c}</Text></View>
      ))}
    </ScrollView>
  );
}

const useStyles = makeStyles(({ colors, radius, spacing, fonts: f }) => ({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: 8, paddingBottom: 12 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  brand: { fontFamily: f.serif, fontSize: 30, color: colors.foreground, letterSpacing: 0.5 },
  hi: { fontFamily: f.body, fontSize: 14, color: colors.mutedForeground, marginTop: 2 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' },
  progress: { flexDirection: 'row', gap: 6, marginTop: 14 },
  progressDot: { flex: 1, height: 4, borderRadius: 2 },
  exclBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 12, backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, maxWidth: '100%' },
  exclBadgeText: { fontFamily: f.bodyMedium, fontSize: 12.5, color: colors.primary, flexShrink: 1 },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: 6 },
  q: { fontFamily: f.serifMedium, fontSize: 24, color: colors.foreground, marginBottom: 18, lineHeight: 30 },
  quickRow: { flexDirection: 'row', gap: 12, marginBottom: 22 },
  quickBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.primary, borderRadius: radius.lg, padding: 16, marginBottom: 12 },
  quickBannerIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  quickBannerTitle: { fontFamily: f.bodyBold, fontSize: 16, color: colors.primaryForeground },
  quickBannerDesc: { fontFamily: f.body, fontSize: 12.5, color: colors.primaryForeground, opacity: 0.9, marginTop: 1 },
  quickCard: { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 14 },
  quickIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  quickTitle: { fontFamily: f.bodyBold, fontSize: 15, color: colors.foreground },
  quickDesc: { fontFamily: f.body, fontSize: 12.5, color: colors.mutedForeground, marginTop: 2, lineHeight: 17 },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 16 },
  moodCard: {
    width: '48%', backgroundColor: colors.card, borderRadius: radius.xl, padding: 10, paddingBottom: 14,
    shadowColor: '#2D2A26', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  moodImgWrap: { width: '100%', height: 104, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.secondary },
  moodImg: { width: '100%', height: '100%' },
  moodImgFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 40 },
  moodDot: { position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  moodLabel: { fontFamily: f.serif, fontSize: 21, color: colors.foreground, marginTop: 10, marginLeft: 4 },
  moodDesc: { fontFamily: f.body, fontSize: 12, color: colors.mutedForeground, marginTop: 1, marginLeft: 4 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 12, marginLeft: -4 },
  backText: { fontFamily: f.bodyMedium, fontSize: 14, color: colors.mutedForeground },
  choiceRow: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1.5, borderRadius: radius.md, padding: 14 },
  choiceIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  choiceLabel: { flex: 1, fontFamily: f.bodySemiBold, fontSize: 16, color: colors.foreground },
  cuisineWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cuisineChip: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 11 },
  cuisineFlag: { fontSize: 17 },
  cuisineLabel: { fontFamily: f.bodyMedium, fontSize: 14, color: colors.foreground },
  cooking: { alignItems: 'center', marginTop: 34, gap: 14 },
  cookingImg: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.secondary },
  cookingText: { fontFamily: f.serifMedium, fontSize: 18, color: colors.foreground, textAlign: 'center' },
  chipScroller: { marginBottom: 16 },
  chipRow: { gap: 8, paddingRight: 8 },
  summaryChip: { backgroundColor: colors.secondary, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, flexShrink: 0 },
  summaryChipText: { fontFamily: f.bodyMedium, fontSize: 13, color: colors.secondaryForeground },
  upsell: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, backgroundColor: colors.accentSoft, borderRadius: 999, paddingVertical: 12 },
  upsellText: { fontFamily: f.bodySemiBold, fontSize: 14, color: colors.accent },
  trialBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginBottom: 8, backgroundColor: colors.accentSoft, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  trialBannerUrgent: { borderWidth: 1.5, borderColor: colors.accent },
  trialBannerText: { flex: 1, fontFamily: f.bodyMedium, fontSize: 13, color: colors.accent },
  trialEndedBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, marginBottom: 8, backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
  trialEndedTitle: { fontFamily: f.bodyBold, fontSize: 14.5, color: colors.accentForeground },
  trialEndedDesc: { fontFamily: f.body, fontSize: 12, color: colors.accentForeground, opacity: 0.9, marginTop: 1 },
  trialEndedCta: { backgroundColor: colors.accentForeground, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  trialEndedCtaText: { fontFamily: f.bodySemiBold, fontSize: 13, color: colors.accent },
}));
