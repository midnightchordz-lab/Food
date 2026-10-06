import React, { useState, useMemo } from 'react';
import {
  View, Text, Pressable, Modal, TextInput, FlatList, SafeAreaView,
} from 'react-native';
import { makeStyles, useTheme, fonts } from '@/src/theme';
import { Icon } from '@/src/components/ui';
import { COUNTRY_CODES_DEDUPED, CountryCode } from '@/src/constants/countryCodes';

type Props = {
  selected: CountryCode;
  onSelect: (c: CountryCode) => void;
};

export function CountryCodePicker({ selected, onSelect }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return COUNTRY_CODES_DEDUPED;
    return COUNTRY_CODES_DEDUPED.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.code.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <>
      <Pressable
        style={styles.trigger}
        onPress={() => { setQuery(''); setOpen(true); }}
        testID="country-code-trigger"
        accessibilityLabel={`Country code ${selected.dial}`}
      >
        <Text style={styles.flag}>{selected.flag}</Text>
        <Text style={styles.dial}>{selected.dial}</Text>
        <Icon name="chevron-down" size={14} color={colors.mutedForeground} />
      </Pressable>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Select country</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={10} testID="country-picker-close">
              <Icon name="close" size={22} color={colors.foreground} />
            </Pressable>
          </View>

          <View style={styles.searchWrap}>
            <Icon name="magnify" size={18} color={colors.mutedForeground} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search country or dial code"
              placeholderTextColor={colors.mutedForeground}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              testID="country-search"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Icon name="close-circle" size={16} color={colors.mutedForeground} />
              </Pressable>
            )}
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.code + item.dial}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                style={[styles.row, item.code === selected.code && styles.rowActive]}
                onPress={() => { onSelect(item); setOpen(false); }}
                testID={`country-option-${item.code}`}
              >
                <Text style={styles.rowFlag}>{item.flag}</Text>
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={styles.rowDial}>{item.dial}</Text>
                {item.code === selected.code && (
                  <Icon name="check" size={16} color={colors.primary} />
                )}
              </Pressable>
            )}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const useStyles = makeStyles(({ colors, radius }) => ({
  trigger: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.secondary, borderRadius: radius.md,
    paddingHorizontal: 10, height: 56,
  },
  flag: { fontSize: 20 },
  dial: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.foreground },
  sheet: { flex: 1, backgroundColor: colors.background },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  sheetTitle: { fontFamily: fonts.bodySemiBold, fontSize: 17, color: colors.foreground },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, marginHorizontal: 16, marginVertical: 12,
    paddingHorizontal: 14, height: 48,
  },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.foreground },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
  },
  rowActive: { backgroundColor: colors.secondary },
  rowFlag: { fontSize: 22, width: 30, textAlign: 'center' },
  rowName: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.foreground },
  rowDial: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.mutedForeground, marginRight: 4 },
  sep: { height: 1, backgroundColor: colors.border, marginLeft: 62 },
}));
