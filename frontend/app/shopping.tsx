import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Platform, KeyboardAvoidingView, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/src/api/client';
import { makeStyles, useTheme, fonts } from '@/src/theme';
import { Icon, Loading, EmptyState, useToast } from '@/src/components/ui';
import { buildShoppingView, AISLE_ICON, type RawItem } from '@/src/utils/shopping';

type Item = { name: string; checked: boolean };

export default function Shopping() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [items, setItems] = useState<Item[] | null>(null);
  const [input, setInput] = useState('');

  const { isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['shopping-list'],
    queryFn: async () => {
      const res = await api.get('/shopping-list');
      const list: Item[] = (res.data.items || []).map((i: any) => ({ name: i.name, checked: !!i.checked }));
      setItems(list);
      return list;
    },
  });

  const list = items || [];

  const saveMut = useMutation({
    mutationFn: async (next: Item[]) => {
      await api.post('/shopping-list', { items: next });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shopping-list'] }),
  });

  const persist = (next: Item[]) => {
    setItems(next);
    saveMut.mutate(next);
  };

  const add = () => {
    const v = input.trim();
    if (!v) return;
    if (list.some((i) => i.name.toLowerCase() === v.toLowerCase())) {
      setInput('');
      return;
    }
    persist([{ name: v, checked: false }, ...list]);
    setInput('');
  };
  // Merged-row helpers operate on all underlying raw items the row represents.
  const toggleRow = (names: string[], nextChecked: boolean) => {
    const set = new Set(names);
    persist(list.map((i) => (set.has(i.name) ? { ...i, checked: nextChecked } : i)));
  };
  const removeRow = (names: string[]) => {
    const set = new Set(names);
    persist(list.filter((i) => !set.has(i.name)));
  };
  const clearChecked = () => {
    const remaining = list.filter((i) => !i.checked);
    persist(remaining);
    toast.show('Cleared checked items', 'success');
  };

  const checkedCount = list.filter((i) => i.checked).length;
  const sections = buildShoppingView(list as RawItem[]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} testID="shop-back">
          <Icon name="chevron-left" size={26} color={colors.foreground} />
        </Pressable>
        <Text style={styles.title}>Shopping List</Text>
        {checkedCount > 0 ? (
          <Pressable onPress={clearChecked} hitSlop={8} testID="shop-clear">
            <Text style={styles.clear}>Clear ({checkedCount})</Text>
          </Pressable>
        ) : (
          <View style={{ width: 26 }} />
        )}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.inputRowWrap}>
          <View style={styles.inputRow}>
            <Icon name="plus" size={20} color={colors.mutedForeground} />
            <TextInput
              testID="shop-input"
              style={styles.input}
              placeholder="Add an item…"
              placeholderTextColor={colors.mutedForeground}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={add}
              returnKeyType="done"
            />
            {input.trim() ? (
              <Pressable onPress={add} testID="shop-add" hitSlop={8}>
                <Icon name="arrow-up-circle" size={26} color={colors.primary} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {isLoading && !items ? (
          <Loading />
        ) : list.length === 0 ? (
          <EmptyState icon="cart-outline" title="Your list is empty" subtitle="Add items above, or tap the cart on any saved recipe to add its ingredients." />
        ) : (
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          >
            {sections.map((section) => (
              <View key={section.aisle} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Icon name={AISLE_ICON[section.aisle] || 'basket-outline'} size={16} color={colors.mutedForeground} />
                  <Text style={styles.sectionTitle}>{section.aisle}</Text>
                  <Text style={styles.sectionCount}>{section.rows.length}</Text>
                </View>
                {section.rows.map((row) => (
                  <Pressable key={row.key} style={styles.itemRow} onPress={() => toggleRow(row.names, !row.checked)} testID={`shop-item-${row.key}`}>
                    <View style={[styles.checkbox, row.checked && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                      {row.checked ? <Icon name="check" size={15} color={colors.primaryForeground} /> : null}
                    </View>
                    <Text style={[styles.itemText, row.checked && styles.itemTextChecked]}>{row.display}</Text>
                    <Pressable onPress={() => removeRow(row.names)} hitSlop={10} testID={`shop-remove-${row.key}`}>
                      <Icon name="close" size={18} color={colors.mutedForeground} />
                    </Pressable>
                  </Pressable>
                ))}
              </View>
            ))}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles(({ colors, spacing, fonts: f }) => ({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 12 },
  title: { fontFamily: f.serif, fontSize: 24, color: colors.foreground },
  clear: { fontFamily: f.bodySemiBold, fontSize: 14, color: colors.accent },
  inputRowWrap: { paddingHorizontal: spacing.lg, paddingBottom: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 16, height: 54 },
  input: { flex: 1, fontFamily: f.body, fontSize: 15, color: colors.foreground, height: '100%' },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: 4 },
  section: { marginBottom: 18 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, paddingHorizontal: 2 },
  sectionTitle: { flex: 1, fontFamily: f.bodyBold, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.mutedForeground },
  sectionCount: { fontFamily: f.bodySemiBold, fontSize: 12, color: colors.mutedForeground },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 15, marginBottom: 10 },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  itemText: { flex: 1, fontFamily: f.bodyMedium, fontSize: 15.5, color: colors.foreground },
  itemTextChecked: { textDecorationLine: 'line-through', color: colors.mutedForeground },
}));
