import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/src/api/client';
import { makeStyles, useTheme, fonts } from '@/src/theme';
import { Icon, Button, Loading, useToast } from '@/src/components/ui';
import { MOODS, DIETARY_PREFS } from '@/src/constants/data';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEALS = ['breakfast', 'lunch', 'dinner'];

export default function Planner() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [mood, setMood] = useState('cozy');
  const [dietary, setDietary] = useState('vegetarian');

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
        dietary_preference: dietary,
        cuisine_preferences: [],
        focus_areas: [],
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
            <Text style={[styles.controlTitle, { marginTop: 14 }]}>Dietary</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {DIETARY_PREFS.map((d) => (
                <Pressable
                  key={d.id}
                  testID={`plan-diet-${d.id}`}
                  onPress={() => setDietary(d.id)}
                  style={[styles.chip, { backgroundColor: dietary === d.id ? colors.accent : colors.secondary }]}
                >
                  <Text style={[styles.chipText, { color: dietary === d.id ? colors.accentForeground : colors.secondaryForeground }]}>{d.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
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
            DAYS.map((day) => {
              const dayMeals = meals[day] || meals[day.toLowerCase()] || {};
              const hasAny = MEALS.some((mt) => dayMeals[mt]);
              if (!hasAny) return null;
              return (
                <View key={day} style={styles.dayCard}>
                  <Text style={styles.dayTitle}>{day}</Text>
                  {MEALS.map((mt) => {
                    const val = dayMeals[mt];
                    if (!val) return null;
                    return (
                      <View key={mt} style={styles.mealRow}>
                        <View style={styles.mealTypePill}>
                          <Text style={styles.mealTypeText}>{mt[0].toUpperCase() + mt.slice(1)}</Text>
                        </View>
                        <Text style={styles.mealName} numberOfLines={2}>{typeof val === 'string' ? val : JSON.stringify(val)}</Text>
                      </View>
                    );
                  })}
                </View>
              );
            })
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
}));
