import React from 'react';
import { View, Text, ScrollView, Pressable, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { makeStyles, useTheme } from '@/src/theme';
import { Icon } from '@/src/components/ui';
import { LEGAL_CONTENT, LEGAL_META, LegalKey, SUPPORT_EMAIL, SUPPORT_TOPICS } from '@/src/content/legal';

const ACCOUNT_DELETION_URL = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/account-deletion`;

function renderInline(text: string, styles: any, keyPrefix: string) {
  // Split on **bold** segments.
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <Text style={styles.p}>
      {parts.map((seg, i) =>
        seg.startsWith('**') && seg.endsWith('**') ? (
          <Text key={`${keyPrefix}-${i}`} style={styles.bold}>{seg.slice(2, -2)}</Text>
        ) : (
          <Text key={`${keyPrefix}-${i}`}>{seg}</Text>
        ),
      )}
    </Text>
  );
}

function Markdown({ content }: { content: string }) {
  const styles = useStyles();
  const lines = content.split('\n');
  return (
    <View>
      {lines.map((raw, idx) => {
        const line = raw.trim();
        if (!line) return <View key={idx} style={{ height: 10 }} />;
        if (line.startsWith('### ')) return <Text key={idx} style={styles.h3}>{line.slice(4)}</Text>;
        if (line.startsWith('## ')) return <Text key={idx} style={styles.h2}>{line.slice(3)}</Text>;
        if (line.startsWith('- ')) {
          return (
            <View key={idx} style={styles.bulletRow}>
              <View style={styles.bulletDot} />
              {renderInline(line.slice(2), styles, `b-${idx}`)}
            </View>
          );
        }
        return <View key={idx} style={styles.pWrap}>{renderInline(line, styles, `p-${idx}`)}</View>;
      })}
    </View>
  );
}

export default function LegalScreen() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type: LegalKey }>();
  const key: LegalKey = type === 'privacy' || type === 'support' || type === 'refund' ? type : 'terms';
  const meta = LEGAL_META[key];

  const emailSupport = (subject?: string) => {
    const q = subject ? `?subject=${encodeURIComponent(subject)}` : '';
    Linking.openURL(`mailto:${SUPPORT_EMAIL}${q}`).catch(() => {});
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} testID="legal-back" hitSlop={8}>
          <Icon name="chevron-left" size={26} color={colors.foreground} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{meta.title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.titleBlock}>
          <View style={styles.titleIcon}><Icon name={meta.icon} size={22} color={colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{meta.title}</Text>
            <Text style={styles.subtitle}>{meta.subtitle}</Text>
          </View>
        </View>

        {key === 'support' && (
          <>
            <Pressable style={styles.emailCard} onPress={() => emailSupport()} testID="support-email">
              <View style={styles.emailIcon}><Icon name="email-outline" size={20} color={colors.primaryForeground} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.emailTitle}>Email our support team</Text>
                <Text style={styles.emailAddr}>{SUPPORT_EMAIL}</Text>
              </View>
              <Icon name="chevron-right" size={20} color={colors.mutedForeground} />
            </Pressable>

            <Text style={styles.sectionLabel}>What can we help with?</Text>
            <View style={styles.topics}>
              {SUPPORT_TOPICS.map((t) => (
                <Pressable key={t.label} style={styles.topicRow} onPress={() => emailSupport(t.subject)} testID={`support-topic-${t.subject}`}>
                  <View style={styles.topicIcon}><Icon name={t.icon} size={18} color={colors.accent} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.topicLabel}>{t.label}</Text>
                    <Text style={styles.topicDesc}>{t.desc}</Text>
                  </View>
                  <Icon name="chevron-right" size={18} color={colors.mutedForeground} />
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionLabel}>Account</Text>
            <Pressable style={styles.deleteCard} onPress={() => Linking.openURL(ACCOUNT_DELETION_URL).catch(() => {})} testID="support-delete-account">
              <View style={styles.deleteIcon}><Icon name="trash-can-outline" size={20} color={colors.danger} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.deleteTitle}>Delete your account</Text>
                <Text style={styles.deleteDesc}>Permanently remove your account and all your data</Text>
              </View>
              <Icon name="chevron-right" size={20} color={colors.mutedForeground} />
            </Pressable>
          </>
        )}

        <Markdown content={LEGAL_CONTENT[key]} />
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles(({ colors, radius, spacing, fonts: f }) => ({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: f.bodySemiBold, fontSize: 17, color: colors.foreground },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: 16 },
  titleBlock: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  titleIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: f.serif, fontSize: 24, color: colors.foreground },
  subtitle: { fontFamily: f.body, fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
  h2: { fontFamily: f.bodyBold, fontSize: 17, color: colors.foreground, marginTop: 18, marginBottom: 6 },
  h3: { fontFamily: f.bodySemiBold, fontSize: 15, color: colors.foreground, marginTop: 12, marginBottom: 4 },
  pWrap: { marginVertical: 3 },
  p: { fontFamily: f.body, fontSize: 14.5, color: colors.foreground, lineHeight: 22 },
  bold: { fontFamily: f.bodyBold, color: colors.foreground },
  bulletRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 3 },
  bulletDot: { width: 6, height: 6, borderRadius: 3, marginTop: 8, backgroundColor: colors.accent },
  emailCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 14, marginBottom: 18 },
  emailIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  emailTitle: { fontFamily: f.bodySemiBold, fontSize: 15, color: colors.foreground },
  emailAddr: { fontFamily: f.body, fontSize: 13, color: colors.primary, marginTop: 1 },
  sectionLabel: { fontFamily: f.bodySemiBold, fontSize: 13, color: colors.mutedForeground, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  topics: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: 14, marginBottom: 8 },
  topicRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border },
  topicIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  topicLabel: { fontFamily: f.bodyMedium, fontSize: 14.5, color: colors.foreground },
  topicDesc: { fontFamily: f.body, fontSize: 12, color: colors.mutedForeground, marginTop: 1 },
  deleteCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 14, marginBottom: 18 },
  deleteIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  deleteTitle: { fontFamily: f.bodySemiBold, fontSize: 15, color: colors.danger },
  deleteDesc: { fontFamily: f.body, fontSize: 12, color: colors.mutedForeground, marginTop: 1 },
}));
