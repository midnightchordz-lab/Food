import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/src/api/client';
import { makeStyles, useTheme } from '@/src/theme';
import { Icon, Button, Loading, useToast } from '@/src/components/ui';
import { useSubscription } from '@/src/lib/revenuecat';
import { MOODS, DIETARY_PREFS } from '@/src/constants/data';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEALS = ['breakfast', 'lunch', 'dinner'];
const FREE_PREVIEW_DAYS = 2;

export default function Planner() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isSubscribed } = useSubscription();

  const [mood, setMood] = useState('cozy');
  const [dietary, setDietary] = useState<string[]>(['vegetarian']);
  const [dayPrefs, setDayPrefs] = useState<Record<string, string>>({});
  const [showDays, setShowDays] = useState(false);

  const toggleDietary = (id: string) => {
    setDietary((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const setDayPref = (day: string, id: string) => {
    setDayPrefs((prev) => {
      const next = { ...prev };
      if (!id || next[day] === id) delete next[day];
      else next[day] = id;
      return next;
    });
  };

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['weekly-plan'],
    queryFn: async () => {
      const res = await api.get('/weekly-plan/current');
      return res.data as { plan: any; week_start: string; has_plan: boolean };
    },
  });

  const genMut = useMutation({
    mutationFn: async () => {
      await api.post('/weekly-plan/generate', {
        mood,
        dietary_preference: dietary.length ? dietary : ['non-vegetarian'],
        cuisine_preferences: [],
        focus_areas: [],
        day_specific_preferences: Object.keys(dayPrefs).length ? dayPrefs : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-plan'] });
      toast.show('Your week is planned!', 'success');
    },
    onError: () => toast.show('Could not generate plan. Try again.', 'error'),
  });

  const plan = data?.plan;
  const meals = plan?.meals || {};

  const collectMealNames = () => {
    const names: string[] = [];
    DAYS.forEach((day) => {
      const dayMeals = meals[day] || meals[day.toLowerCase()] || {};
      MEALS.forEach((mt) => {
        const v = dayMeals[mt];
        if (v && typeof v === 'string') names.push(v);
      });
    });
    return names;
  };

  const addWeekMut = useMutation({
    mutationFn: async () => {
      const names = collectMealNames();
      const existing = await api.get('/shopping-list');
      const current = (existing.data.items || []) as { name: string; checked: boolean }[];
      const have = new Set(current.map((i) => i.name.toLowerCase()));
      const additions = names.filter((n) => !have.has(n.toLowerCase())).map((n) => ({ name: n, checked: false }));
      await api.post('/shopping-list', { items: [...current, ...additions] });
      return additions.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
      toast.show(count ? `Added ${count} meals to your list` : 'Everything is already on your list', 'success');
    },
    onError: () => toast.show('Could not update shopping list', 'error'),
  });

  const visibleDays = isSubscribed ? DAYS : DAYS.slice(0, FREE_PREVIEW_DAYS);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Weekly Planner</Text>
        <Text style={styles.sub}>AI meal plans tuned to your mood</Text>
      </View>

      {isLoading ? (
        <Loading />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        >
          {/* Controls */}
          <View style={styles.controlCard}>
            <Text style={styles.controlTitle}>Plan for a mood</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {MOODS.map((m) => (
                <Pressable
                  key={m.id}
                  testID={`plan-mood-${m.id}`}
                  onPress={() => setMood(m.id)}
                  style={[styles.chip, { backgroundColor: mood === m.id ? colors.primary : colors.secondary }]}
                >
                  <Text style={[styles.chipText, { color: mood === m.id ? colors.primaryForeground : colors.secondaryForeground }]}>{m.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={[styles.controlTitle, { marginTop: 14 }]}>Dietary <Text style={styles.controlHint}>· pick one or more</Text></Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {DIETARY_PREFS.map((d) => {
                const active = dietary.includes(d.id);
                return (
                  <Pressable
                    key={d.id}
                    testID={`plan-diet-${d.id}`}
                    onPress={() => toggleDietary(d.id)}
                    style={[styles.chip, styles.chipRowInner, { backgroundColor: active ? colors.accent : colors.secondary }]}
                  >
                    {active ? <Icon name="check" size={13} color={colors.accentForeground} /> : null}
                    <Text style={[styles.chipText, { color: active ? colors.accentForeground : colors.secondaryForeground }]}>{d.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable style={styles.dayToggle} onPress={() => setShowDays((v) => !v)} testID="toggle-day-prefs">
              <Icon name="calendar-edit" size={18} color={colors.primary} />
              <Text style={styles.dayToggleText}>Customise diet by day{Object.keys(dayPrefs).length ? ` (${Object.keys(dayPrefs).length})` : ''}</Text>
              <Icon name={showDays ? 'chevron-up' : 'chevron-down'} size={20} color={colors.mutedForeground} />
            </Pressable>
            {showDays ? (
              <View style={styles.dayPrefsBox}>
                {DAYS.map((day) => (
                  <View key={day} style={styles.dayPrefRow}>
                    <Text style={styles.dayPrefLabel}>{day.slice(0, 3)}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayChipRow}>
                      <Pressable
                        testID={`daypref-${day.toLowerCase()}-auto`}
                        onPress={() => setDayPref(day, '')}
                        style={[styles.dayChip, { backgroundColor: !dayPrefs[day] ? colors.primary : colors.secondary }]}
                      >
                        <Text style={[styles.dayChipText, { color: !dayPrefs[day] ? colors.primaryForeground : colors.secondaryForeground }]}>Auto</Text>
                      </Pressable>
                      {DIETARY_PREFS.map((d) => {
                        const on = dayPrefs[day] === d.id;
                        return (
                          <Pressable
                            key={d.id}
                            testID={`daypref-${day.toLowerCase()}-${d.id}`}
                            onPress={() => setDayPref(day, d.id)}
                            style={[styles.dayChip, { backgroundColor: on ? colors.accent : colors.secondary }]}
                          >
                            <Text style={[styles.dayChipText, { color: on ? colors.accentForeground : colors.secondaryForeground }]}>{d.label}</Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                ))}
              </View>
            ) : null}
            <View style={{ height: 14 }} />
            <Button
              label={data?.has_plan ? 'Regenerate this week' : 'Generate this week'}
              icon="calendar-check"
              onPress={() => genMut.mutate()}
              loading={genMut.isPending}
              testID="generate-plan"
            />
          </View>

          {!data?.has_plan && !genMut.isPending ? (
            <View style={styles.emptyPlan}>
              <Icon name="calendar-blank-outline" size={40} color={colors.mutedForeground} />
              <Text style={styles.emptyText}>No plan for this week yet.{'\n'}Pick a mood and generate one above.</Text>
            </View>
          ) : (
            <>
              {visibleDays.map((day) => {
                const dayMeals = meals[day] || meals[day.toLowerCase()] || {};
                const hasAny = MEALS.some((mt) => dayMeals[mt]);
                if (!hasAny) return null;
                return (
                  <View key={day} style={styles.dayCard}>
                    <Text style={styles.dayTitle}>{day}</Text>
                    {MEALS.map((mt) => {
                      const val = dayMeals[mt];
                      if (!val) return null;
                      const mealName = typeof val === 'string' ? val : JSON.stringify(val);
                      return (
                        <Pressable
                          key={mt}
                          style={styles.mealRow}
                          testID={`plan-meal-${day.toLowerCase()}-${mt}`}
                          onPress={() =>
                            router.push({
                              pathname: '/recipe',
                              params: {
                                title: mealName,
                                cuisine: 'International',
                                meal: mt[0].toUpperCase() + mt.slice(1),
                                dietary: dietary.join(', ') || 'Any',
                              },
                            })
                          }
                        >
                          <View style={styles.mealTypePill}>
                            <Text style={styles.mealTypeText}>{mt[0].toUpperCase() + mt.slice(1)}</Text>
                          </View>
                          <Text style={styles.mealName} numberOfLines={2}>{mealName}</Text>
                          <Icon name="chevron-right" size={20} color={colors.mutedForeground} />
                        </Pressable>
                      );
                    })}
                  </View>
                );
              })}

              {data?.has_plan && !isSubscribed ? (
                <Pressable style={styles.lockCard} onPress={() => router.push('/paywall')} testID="planner-upgrade">
                  <Icon name="crown" size={26} color={colors.accent} />
                  <Text style={styles.lockTitle}>Unlock the full 7-day plan</Text>
                  <Text style={styles.lockDesc}>You&apos;re seeing a {FREE_PREVIEW_DAYS}-day preview. Go Premium for the whole week plus one-tap shopping lists.</Text>
                  <View style={styles.lockCta}><Text style={styles.lockCtaText}>Go Premium</Text></View>
                </Pressable>
              ) : null}

              {data?.has_plan && isSubscribed ? (
                <View style={{ marginTop: 4 }}>
                  <Button label="Add week to shopping list" icon="cart-plus" variant="outline" onPress={() => addWeekMut.mutate()} loading={addWeekMut.isPending} testID="add-week-to-list" />
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const useStyles = makeStyles(({ colors, radius, spacing, fonts: f }) => ({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: 10, paddingBottom: 8 },
  title: { fontFamily: f.serif, fontSize: 32, color: colors.foreground },
  sub: { fontFamily: f.body, fontSize: 14, color: colors.mutedForeground, marginTop: 2 },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: 10 },
  controlCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 16, marginBottom: 16 },
  controlTitle: { fontFamily: f.bodySemiBold, fontSize: 13, color: colors.mutedForeground, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  controlHint: { fontFamily: f.body, fontSize: 11, color: colors.mutedForeground, textTransform: 'none', letterSpacing: 0 },
  chipRowInner: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dayToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingVertical: 6 },
  dayToggleText: { flex: 1, fontFamily: f.bodySemiBold, fontSize: 14, color: colors.foreground },
  dayPrefsBox: { marginTop: 6, gap: 6 },
  dayPrefRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayPrefLabel: { width: 34, fontFamily: f.bodySemiBold, fontSize: 12.5, color: colors.mutedForeground },
  dayChipRow: { gap: 6, paddingRight: 8 },
  dayChip: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, flexShrink: 0 },
  dayChipText: { fontFamily: f.bodyMedium, fontSize: 12, },
  chipRow: { gap: 8, paddingRight: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, flexShrink: 0 },
  chipText: { fontFamily: f.bodyMedium, fontSize: 13 },
  emptyPlan: { alignItems: 'center', gap: 12, paddingVertical: 40 },
  emptyText: { fontFamily: f.body, fontSize: 14, color: colors.mutedForeground, textAlign: 'center', lineHeight: 21 },
  dayCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 16, marginBottom: 12 },
  dayTitle: { fontFamily: f.serif, fontSize: 22, color: colors.foreground, marginBottom: 10 },
  mealRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 7 },
  mealTypePill: { width: 78, backgroundColor: colors.primarySoft, borderRadius: 999, paddingVertical: 5, alignItems: 'center' },
  mealTypeText: { fontFamily: f.bodySemiBold, fontSize: 11.5, color: colors.primary },
  mealName: { flex: 1, fontFamily: f.body, fontSize: 14.5, color: colors.foreground, lineHeight: 20 },
  lockCard: { alignItems: 'center', gap: 8, backgroundColor: colors.accentSoft, borderRadius: radius.lg, padding: 22, marginTop: 4, marginBottom: 12 },
  lockTitle: { fontFamily: f.serif, fontSize: 22, color: colors.foreground, textAlign: 'center' },
  lockDesc: { fontFamily: f.body, fontSize: 13.5, color: colors.mutedForeground, textAlign: 'center', lineHeight: 20 },
  lockCta: { marginTop: 8, backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 11 },
  lockCtaText: { fontFamily: f.bodySemiBold, fontSize: 14, color: colors.accentForeground },
}));
