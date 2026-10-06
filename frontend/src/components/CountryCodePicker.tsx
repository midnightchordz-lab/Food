import React, { useState, useMemo } from 'react';
import { View, Text, Modal, Pressable, TextInput, FlatList, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, fonts } from '@/src/theme';
import { Icon } from '@/src/components/ui';
import { COUNTRIES, Country } from '@/src/data/countryCodes';

export function CountryCodePicker({
  value,
  onSelect,
  testID,
}: {
  value: Country;
  onSelect: (c: Country) => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.iso2.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <>
      <Pressable
        testID={testID}
        onPress={() => setOpen(true)}
        style={[styles.trigger, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <Text style={styles.flag}>{value.flag}</Text>
        <Text style={[styles.dial, { color: colors.foreground }]}>+{value.dial}</Text>
        <Icon name="chevron-down" size={16} color={colors.mutedForeground} />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Select country</Text>
              <Pressable onPress={() => setOpen(false)} testID="country-picker-close">
                <Icon name="close" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <View style={[styles.searchRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Icon name="magnify" size={18} color={colors.mutedForeground} />
              <TextInput
                style={[styles.searchInput, { color: colors.foreground }]}
                placeholder="Search country or code"
                placeholderTextColor={colors.mutedForeground}
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <FlatList
              data={filtered}
              keyExtractor={(c) => c.iso2}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  testID={`country-option-${item.iso2}`}
                  style={styles.row}
                  onPress={() => {
                    onSelect(item);
                    setQuery('');
                    setOpen(false);
                  }}
                >
                  <Text style={styles.flag}>{item.flag}</Text>
                  <Text style={[styles.rowName, { color: colors.foreground }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={[styles.rowDial, { color: colors.mutedForeground }]}>+{item.dial}</Text>
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 56,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 16,
    marginRight: 10,
  },
  flag: { fontSize: 20 },
  dial: { fontFamily: fonts.bodyMedium, fontSize: 15 },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '75%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 16 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sheetTitle: { fontFamily: fonts.serif, fontSize: 20 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, height: 46, marginBottom: 8,
  },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 15, height: '100%' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  rowName: { flex: 1, fontFamily: fonts.body, fontSize: 15 },
  rowDial: { fontFamily: fonts.bodyMedium, fontSize: 14 },
});
