import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/src/api/client';
import { makeStyles, useTheme } from '@/src/theme';
import { Icon, Button, Loading, useToast } from '@/src/components/ui';
import { useSubscription } from '@/src/lib/revenuecat';
import { DIETARY_PREFS } from '@/src/constants/data';

const DIABETES_TYPES = [
  { id: 'type2', label: 'Type 2' },
  { id: 'type1', label: 'Type 1' },
  { id: 'gestational', label: 'Gestational' },
  { id: 'prediabetes', label: 'Pre-diabetes' },
];

type Meal = { type: string; name: string; net_carbs: number; flag: 'safe' | 'caution' | 'spike'; note?: string };
type Day = { day: string; meals: Meal[] };
type Plan = { diabetes_label: string; dietary_preference: string; max_carbs_per_meal: number; days: Day[]; avg_carbs_per_day: number };

export default function Health() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { isSubscribed } = useSubscription();

  const [dtype, setDtype] = useState('type2');
  const [dietary, setDietary] = useState('balanced');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['diabetes-plan'],
    queryFn: async () => {
      const res = await api.get('/mobile-diabetes/plan');
      return res.data as { has_plan: boolean; plan: Plan | null };
    },
  });

  const genMut = useMutation({
    mutationFn: async () => {
      const res = await api.post('/mobile-diabetes/plan', { diabetes_type: dtype, dietary_preference: dietary });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diabetes-plan'] });
      toast.show('Your diabetes-friendly week is ready!', 'success');
    },
    onError: () => toast.show('Could not generate plan. Try again.', 'error'),
  });

  const flagColor = (flag: string) =>
    flag === 'safe' ? colors.success : flag === 'caution' ? colors.accent : colors.danger;
  const flagLabel = (flag: string) =>
    flag === 'safe' ? 'Steady' : flag === 'caution' ? 'Watch' : 'Spike risk';

  const plan = data?.plan;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Diabetes Planner</Text>
        <Text style={styles.sub}>Carb-balanced meals that keep blood sugar steady</Text>
      </View>

      {isLoading ? (
        <Loading />
      ) : !isSubscribed ? (
        <View style={styles.scroll}>
          <Pressable style={styles.lockCard} onPress={() => router.push('/paywall')} testID="diabetes-upgrade">
            <Icon name="heart-pulse" size={30} color={colors.accent} />
            <Text style={styles.lockTitle}>Unlock the Diabetes Planner</Text>
            <Text style={styles.lockDesc}>Go Premium for a personalised 7-day plan with net-carb counts and blood-sugar spike alerts for every meal.</Text>
            <View style={styles.lockCta}><Text style={styles.lockCtaText}>Go Premium</Text></View>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        >
          <View style={styles.controlCard}>
            <Text style={styles.controlTitle}>Diabetes type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {DIABETES_TYPES.map((t) => (
                <Pressable
                  key={t.id}
                  testID={`dtype-${t.id}`}
                  onPress={() => setDtype(t.id)}
                  style={[styles.chip, { backgroundColor: dtype === t.id ? colors.primary : colors.secondary }]}
                >
                  <Text style={[styles.chipText, { color: dtype === t.id ? colors.primaryForeground : colors.secondaryForeground }]}>{t.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={[styles.controlTitle, { marginTop: 14 }]}>Dietary</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {[{ id: 'balanced', label: 'Balanced', icon: 'scale-balance' }, ...DIETARY_PREFS].map((d) => (
                <Pressable
                  key={d.id}
                  testID={`ddiet-${d.id}`}
                  onPress={() => setDietary(d.id)}
                  style={[styles.chip, { backgroundColor: dietary === d.id ? colors.accent : colors.secondary }]}
                >
                  <Text style={[styles.chipText, { color: dietary === d.id ? colors.accentForeground : colors.secondaryForeground }]}>{d.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={{ height: 14 }} />
            <Button
              label={plan ? 'Regenerate this week' : 'Generate this week'}
              icon="heart-pulse"
              onPress={() => genMut.mutate()}
              loading={genMut.isPending}
              testID="generate-diabetes-plan"
            />
          </View>

          {!plan && !genMut.isPending ? (
            <View style={styles.emptyPlan}>
              <Icon name="food-apple-outline" size={40} color={colors.mutedForeground} />
              <Text style={styles.emptyText}>No plan yet.{'\n'}Pick your diabetes type and generate one above.</Text>
            </View>
          ) : plan ? (
            <>
              <View style={styles.summaryCard}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{plan.avg_carbs_per_day}g</Text>
                  <Text style={styles.summaryLabel}>Avg carbs / day</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>≤{plan.max_carbs_per_meal}g</Text>
                  <Text style={styles.summaryLabel}>Target / meal</Text>
                </View>
              </View>

              <View style={styles.legendRow}>
                {(['safe', 'caution', 'spike'] as const).map((fl) => (
                  <View key={fl} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: flagColor(fl) }]} />
                    <Text style={styles.legendText}>{flagLabel(fl)}</Text>
                  </View>
                ))}
              </View>

              {plan.days.map((d) => (
                <View key={d.day} style={styles.dayCard}>
                  <Text style={styles.dayTitle}>{d.day}</Text>
                  {d.meals.map((m) => (
                    <Pressable
                      key={m.type}
                      style={styles.mealRow}
                      testID={`diabetes-meal-${d.day}-${m.type}`}
                      onPress={() => router.push({
                        pathname: '/recipe',
                        params: {
                          title: m.name,
                          meal: m.type,
                          description: m.note || '',
                          dietary: plan.dietary_preference || 'Any',
                        },
                      })}
                    >
                      <View style={[styles.flagDot, { backgroundColor: flagColor(m.flag) }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.mealType}>{m.type}</Text>
                        <Text style={styles.mealName} numberOfLines={2}>{m.name}</Text>
                        {m.note ? <Text style={styles.mealNote} numberOfLines={2}>{m.note}</Text> : null}
                      </View>
                      <View style={[styles.carbBadge, { backgroundColor: flagColor(m.flag) + '22' }]}>
                        <Text style={[styles.carbText, { color: flagColor(m.flag) }]}>{m.net_carbs}g</Text>
                      </View>
                      <Icon name="chevron-right" size={20} color={colors.mutedForeground} />
                    </Pressable>
                  ))}
                </View>
              ))}
              <Text style={styles.disclaimer}>Estimates only — always follow your care team&apos;s guidance.</Text>
            </>
          ) : null}
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
  chipRow: { gap: 8, paddingRight: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, flexShrink: 0 },
  chipText: { fontFamily: f.bodyMedium, fontSize: 13 },
  emptyPlan: { alignItems: 'center', gap: 12, paddingVertical: 40 },
  emptyText: { fontFamily: f.body, fontSize: 14, color: colors.mutedForeground, textAlign: 'center', lineHeight: 21 },
  summaryCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: radius.lg, padding: 18, marginBottom: 12 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontFamily: f.serif, fontSize: 28, color: colors.primary },
  summaryLabel: { fontFamily: f.bodyMedium, fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  summaryDivider: { width: 1, height: 40, backgroundColor: colors.border },
  legendRow: { flexDirection: 'row', gap: 18, marginBottom: 12, paddingHorizontal: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontFamily: f.bodyMedium, fontSize: 12.5, color: colors.mutedForeground },
  dayCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 16, marginBottom: 12 },
  dayTitle: { fontFamily: f.serif, fontSize: 22, color: colors.foreground, marginBottom: 10 },
  mealRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  flagDot: { width: 10, height: 10, borderRadius: 5 },
  mealType: { fontFamily: f.bodySemiBold, fontSize: 11.5, color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.4 },
  mealName: { fontFamily: f.body, fontSize: 15, color: colors.foreground, marginTop: 1 },
  mealNote: { fontFamily: f.body, fontSize: 12.5, color: colors.mutedForeground, marginTop: 2, fontStyle: 'italic' },
  carbBadge: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  carbText: { fontFamily: f.bodyBold, fontSize: 13 },
  disclaimer: { fontFamily: f.body, fontSize: 12, color: colors.mutedForeground, textAlign: 'center', marginTop: 6, marginBottom: 4 },
  lockCard: { alignItems: 'center', gap: 8, backgroundColor: colors.accentSoft, borderRadius: radius.lg, padding: 24, marginTop: 8 },
  lockTitle: { fontFamily: f.serif, fontSize: 23, color: colors.foreground, textAlign: 'center' },
  lockDesc: { fontFamily: f.body, fontSize: 13.5, color: colors.mutedForeground, textAlign: 'center', lineHeight: 20 },
  lockCta: { marginTop: 8, backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 11 },
  lockCtaText: { fontFamily: f.bodySemiBold, fontSize: 14, color: colors.accentForeground },
}));
