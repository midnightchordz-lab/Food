import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Platform, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/src/api/client';
import { makeStyles, useTheme, fonts } from '@/src/theme';
import { Icon, Button, Loading, useToast } from '@/src/components/ui';

const COMMON = ['Eggs', 'Milk', 'Peanuts', 'Tree Nuts', 'Soy', 'Wheat', 'Fish', 'Shellfish', 'Sesame', 'Gluten', 'Pork', 'Beef', 'Mushroom', 'Onion', 'Garlic'];

export default function Exclusions() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [items, setItems] = useState<string[] | null>(null);
  const [input, setInput] = useState('');

  const { isLoading } = useQuery({
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

  const list = items || [];

  const add = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    if (list.some((x) => x.toLowerCase() === v.toLowerCase())) return;
    setItems([...list, v]);
    setInput('');
  };
  const remove = (name: string) => setItems(list.filter((x) => x !== name));

  const saveMut = useMutation({
    mutationFn: async () => {
      await api.post('/exclusions', {
        excluded_ingredients: list.map((name) => ({ name, category: 'preference', severity: 'preference' })),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exclusions'] });
      toast.show('Exclusions saved', 'success');
      router.back();
    },
    onError: () => toast.show('Could not save', 'error'),
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} testID="excl-back">
          <Icon name="chevron-left" size={26} color={colors.foreground} />
        </Pressable>
        <Text style={styles.title}>Food Exclusions</Text>
        <View style={{ width: 26 }} />
      </View>

      {isLoading && !items ? (
        <Loading />
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.lead}>Ingredients you never want in your recipes. The AI chef will avoid these and their variations.</Text>

            <View style={styles.inputRow}>
              <Icon name="magnify" size={20} color={colors.mutedForeground} />
              <TextInput
                testID="excl-input"
                style={styles.input}
                placeholder="Add an ingredient…"
                placeholderTextColor={colors.mutedForeground}
                value={input}
                onChangeText={setInput}
                onSubmitEditing={() => add(input)}
                returnKeyType="done"
                autoCapitalize="none"
              />
              {input.trim() ? (
                <Pressable onPress={() => add(input)} testID="excl-add" hitSlop={8}>
                  <Icon name="plus-circle" size={24} color={colors.primary} />
                </Pressable>
              ) : null}
            </View>

            {list.length > 0 && (
              <View style={styles.chipWrap}>
                {list.map((name) => (
                  <Pressable key={name} style={styles.activeChip} onPress={() => remove(name)} testID={`excl-remove-${name}`}>
                    <Text style={styles.activeChipText}>{name}</Text>
                    <Icon name="close" size={14} color={colors.accentForeground} />
                  </Pressable>
                ))}
              </View>
            )}

            <Text style={styles.section}>Common allergens</Text>
            <View style={styles.chipWrap}>
              {COMMON.map((name) => {
                const active = list.some((x) => x.toLowerCase() === name.toLowerCase());
                return (
                  <Pressable
                    key={name}
                    testID={`excl-common-${name}`}
                    onPress={() => (active ? remove(list.find((x) => x.toLowerCase() === name.toLowerCase())!) : add(name))}
                    style={[styles.suggestChip, active && styles.suggestChipActive]}
                  >
                    <Text style={[styles.suggestChipText, active && { color: colors.primaryForeground }]}>{name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
            <Button label="Save exclusions" icon="check" onPress={() => saveMut.mutate()} loading={saveMut.isPending} testID="excl-save" />
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const useStyles = makeStyles(({ colors, radius, spacing, fonts: f }) => ({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 12 },
  title: { fontFamily: f.serif, fontSize: 24, color: colors.foreground },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: 8, paddingBottom: 24 },
  lead: { fontFamily: f.body, fontSize: 14.5, color: colors.mutedForeground, lineHeight: 21, marginBottom: 18 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 16, height: 54 },
  input: { flex: 1, fontFamily: f.body, fontSize: 15, color: colors.foreground, height: '100%' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  activeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.accent, borderRadius: 999, paddingLeft: 14, paddingRight: 10, paddingVertical: 8 },
  activeChipText: { fontFamily: f.bodyMedium, fontSize: 13.5, color: colors.accentForeground },
  section: { fontFamily: f.bodySemiBold, fontSize: 13, color: colors.mutedForeground, marginTop: 26, textTransform: 'uppercase', letterSpacing: 0.5 },
  suggestChip: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  suggestChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  suggestChipText: { fontFamily: f.bodyMedium, fontSize: 13.5, color: colors.foreground },
  footer: { paddingHorizontal: spacing.lg, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
}));
