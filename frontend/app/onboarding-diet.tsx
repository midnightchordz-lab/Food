import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/src/api/client';
import { useAuth } from '@/src/auth/AuthContext';
import { makeStyles, useTheme } from '@/src/theme';
import { Icon, Button } from '@/src/components/ui';

export const dietOnboardedKey = (userId: string) => `dietOnboarded:${userId}`;

const DIET_OPTIONS = [
  { id: 'non-vegetarian', label: 'Non-vegetarian', emoji: '🥩', desc: 'Includes meat, poultry & seafood' },
  { id: 'vegetarian', label: 'Vegetarian', emoji: '🥗', desc: 'No meat or seafood' },
  { id: 'vegan', label: 'Vegan', emoji: '🌱', desc: 'No animal products at all' },
  { id: 'halal', label: 'Halal', emoji: '☪️', desc: 'Halal-certified ingredients only' },
  { id: 'jain', label: 'Jain', emoji: '🙏', desc: 'No root vegetables, strict vegetarian' },
];

export default function OnboardingDiet() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [selected, setSelected] = useState<string>('non-vegetarian');

  const saveMut = useMutation({
    mutationFn: async () => {
      await api.put('/auth/profile', { dietary_preference: selected });
    },
    onSuccess: async () => {
      if (user?.id) await AsyncStorage.setItem(dietOnboardedKey(user.id), '1');
      router.replace('/(tabs)');
    },
    onError: async () => {
      // Even on error, mark done and continue so the user isn't stuck
      if (user?.id) await AsyncStorage.setItem(dietOnboardedKey(user.id), '1');
      router.replace('/(tabs)');
    },
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.iconWrap}>
          <Icon name="silverware-fork-knife" size={30} color={colors.accent} />
        </View>
        <Text style={styles.title}>What best describes your diet?</Text>
        <Text style={styles.lead}>
          We will tailor every recipe, meal plan and suggestion to match how you eat. You can change this anytime.
        </Text>

        <View style={styles.options}>
          {DIET_OPTIONS.map((opt) => {
            const active = selected === opt.id;
            return (
              <Pressable
                key={opt.id}
                testID={`diet-opt-${opt.id}`}
                style={[styles.optionCard, active && styles.optionCardActive]}
                onPress={() => setSelected(opt.id)}
              >
                <Text style={styles.optionEmoji}>{opt.emoji}</Text>
                <View style={styles.optionText}>
                  <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{opt.label}</Text>
                  <Text style={styles.optionDesc}>{opt.desc}</Text>
                </View>
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active ? <View style={styles.radioDot} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          testID="diet-continue"
          label="Continue"
          onPress={() => saveMut.mutate()}
          loading={saveMut.isPending}
        />
        <Pressable
          testID="diet-skip"
          onPress={async () => {
            if (user?.id) await AsyncStorage.setItem(dietOnboardedKey(user.id), '1');
            router.replace('/(tabs)');
          }}
          style={styles.skipBtn}
        >
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors, radius, spacing, fonts: f }) => ({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: 8, paddingBottom: 16 },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
    marginTop: 8,
  },
  title: { fontFamily: f.serif, fontSize: 28, color: colors.foreground, textAlign: 'center', marginBottom: 10 },
  lead: { fontFamily: f.body, fontSize: 15, color: colors.mutedForeground, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  options: { gap: 12 },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  optionCardActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  optionEmoji: { fontSize: 26, width: 36, textAlign: 'center' },
  optionText: { flex: 1 },
  optionLabel: { fontFamily: f.bodyMedium, fontSize: 16, color: colors.foreground },
  optionLabelActive: { color: colors.accent, fontFamily: f.bodyBold },
  optionDesc: { fontFamily: f.body, fontSize: 13, color: colors.mutedForeground, marginTop: 1 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  footer: { paddingHorizontal: spacing.lg, paddingTop: 8, gap: 4 },
  skipBtn: { alignItems: 'center', paddingVertical: 14 },
  skipText: { fontFamily: f.bodyMedium, fontSize: 14, color: colors.mutedForeground },
}));
