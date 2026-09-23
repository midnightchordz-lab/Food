import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Platform, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/src/api/client';
import { useAuth } from '@/src/auth/AuthContext';
import { makeStyles, useTheme } from '@/src/theme';
import { Icon, Button, useToast } from '@/src/components/ui';

const COMMON = ['Eggs', 'Milk', 'Peanuts', 'Tree Nuts', 'Soy', 'Wheat', 'Fish', 'Shellfish', 'Sesame', 'Gluten', 'Pork', 'Beef', 'Mushroom', 'Onion', 'Garlic'];

export const onboardedKey = (userId: string) => `allergyOnboarded:${userId}`;

export default function OnboardingAllergies() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [items, setItems] = useState<string[]>([]);
  const [input, setInput] = useState('');

  // Prefill anything already set (returning users just confirm and continue).
  useQuery({
    queryKey: ['exclusions'],
    queryFn: async () => {
      const res = await api.get('/exclusions');
      const names: string[] = (res.data.excluded_ingredient_names || []).map((n: string) =>
        n.replace(/\b\w/g, (c) => c.toUpperCase())
      );
      setItems(names);
      return names;
    },
  });

  const add = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    if (items.some((x) => x.toLowerCase() === v.toLowerCase())) { setInput(''); return; }
    setItems([...items, v]);
    setInput('');
  };
  const remove = (name: string) => setItems(items.filter((x) => x !== name));

  const finish = async () => {
    if (user?.id) await AsyncStorage.setItem(onboardedKey(user.id), '1');
    queryClient.invalidateQueries({ queryKey: ['exclusions'] });
    router.replace('/(tabs)');
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      await api.post('/exclusions', {
        excluded_ingredients: items.map((name) => ({ name, category: 'preference', severity: 'preference' })),
      });
    },
    onSuccess: async () => {
      toast.show(items.length ? 'Got it — we\u2019ll keep these out of your recipes' : 'All set!', 'success');
      await finish();
    },
    onError: () => toast.show('Could not save, please try again', 'error'),
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.iconWrap}>
            <Icon name="shield-check" size={30} color={colors.accent} />
          </View>
          <Text style={styles.title}>Any allergies or foods to avoid?</Text>
          <Text style={styles.lead}>
            Tell us what to keep out of your kitchen and every recipe, meal plan and shopping list will avoid these ingredients and their variations. You can change this anytime.
          </Text>

          <View style={styles.inputRow}>
            <Icon name="magnify" size={20} color={colors.mutedForeground} />
            <TextInput
              testID="onb-input"
              style={styles.input}
              placeholder="Add an ingredient (e.g. cashew)…"
              placeholderTextColor={colors.mutedForeground}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => add(input)}
              returnKeyType="done"
              autoCapitalize="none"
            />
            {input.trim() ? (
              <Pressable onPress={() => add(input)} testID="onb-add" hitSlop={8}>
                <Icon name="plus-circle" size={24} color={colors.primary} />
              </Pressable>
            ) : null}
          </View>

          {items.length > 0 && (
            <View style={styles.chipWrap}>
              {items.map((name) => (
                <Pressable key={name} style={styles.activeChip} onPress={() => remove(name)} testID={`onb-remove-${name}`}>
                  <Text style={styles.activeChipText}>{name}</Text>
                  <Icon name="close" size={14} color={colors.accentForeground} />
                </Pressable>
              ))}
            </View>
          )}

          <Text style={styles.section}>Common allergens — tap to add</Text>
          <View style={styles.chipWrap}>
            {COMMON.map((name) => {
              const active = items.some((x) => x.toLowerCase() === name.toLowerCase());
              return (
                <Pressable
                  key={name}
                  testID={`onb-common-${name}`}
                  onPress={() => (active ? remove(items.find((x) => x.toLowerCase() === name.toLowerCase())!) : add(name))}
                  style={[styles.suggestChip, active && styles.suggestChipActive]}
                >
                  {active ? <Icon name="check" size={13} color={colors.primaryForeground} /> : null}
                  <Text style={[styles.suggestChipText, active && { color: colors.primaryForeground }]}>{name}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Button
            label={items.length ? 'Save & continue' : 'Continue'}
            icon="arrow-right"
            onPress={() => saveMut.mutate()}
            loading={saveMut.isPending}
            testID="onb-save"
          />
          <Pressable onPress={finish} hitSlop={8} testID="onb-skip" style={styles.skip}>
            <Text style={styles.skipText}>Skip for now</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles(({ colors, radius, spacing, fonts: f }) => ({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: 8, paddingBottom: 24 },
  iconWrap: { width: 60, height: 60, borderRadius: 18, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontFamily: f.serif, fontSize: 30, color: colors.foreground, lineHeight: 36 },
  lead: { fontFamily: f.body, fontSize: 15, color: colors.mutedForeground, lineHeight: 22, marginTop: 10, marginBottom: 22 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 16, height: 54 },
  input: { flex: 1, fontFamily: f.body, fontSize: 15, color: colors.foreground, height: '100%' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  activeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.accent, borderRadius: 999, paddingLeft: 14, paddingRight: 10, paddingVertical: 8 },
  activeChipText: { fontFamily: f.bodyMedium, fontSize: 13.5, color: colors.accentForeground },
  section: { fontFamily: f.bodySemiBold, fontSize: 13, color: colors.mutedForeground, marginTop: 26, textTransform: 'uppercase', letterSpacing: 0.5 },
  suggestChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  suggestChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  suggestChipText: { fontFamily: f.bodyMedium, fontSize: 13.5, color: colors.foreground },
  footer: { paddingHorizontal: spacing.lg, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
  skip: { alignItems: 'center', paddingVertical: 14 },
  skipText: { fontFamily: f.bodySemiBold, fontSize: 14.5, color: colors.mutedForeground },
}));
