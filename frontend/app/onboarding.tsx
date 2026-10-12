import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { makeStyles, useTheme, fonts } from '@/src/theme';
import { Button, Icon } from '@/src/components/ui';
import { storage } from '@/src/utils/storage';

const ONBOARDED_KEY = 'moodfood_onboarded';

// Real mood → dish pairs the app actually generates — not stock marketing copy.
// Each ties to one of the brand's existing mood color tokens (see src/theme.ts).
const MOOD_PAIRS = [
  { mood: 'Stressed', dish: 'Creamy Mac & Cheese', icon: 'emoticon-sad-outline', colorKey: 'moodStressed' as const },
  { mood: 'Heartbroken', dish: 'Butter Chicken', icon: 'heart-broken', colorKey: 'moodSad' as const },
  { mood: 'Post-Workout', dish: 'Protein Power Bowl', icon: 'arm-flex-outline', colorKey: 'moodEnergetic' as const },
  { mood: 'Celebrating', dish: 'Paneer Biryani', icon: 'party-popper', colorKey: 'moodCelebratory' as const },
];

const CYCLE_MS = 2400;
const FADE_MS = 300;

// Each badge gets its own color so the row reads as colorful, not a flat gray list.
// Labels kept to one or two words — the icon carries most of the meaning.
const BADGES = [
  { label: 'AI', icon: 'creation', colorKey: 'accent' as const, softKey: 'accentSoft' as const },
  { label: 'Veg-Friendly', icon: 'leaf', colorKey: 'primary' as const, softKey: 'primarySoft' as const },
  { label: 'Fridge Scan', icon: 'fridge-outline', colorKey: 'moodEnergetic' as const, softKey: 'moodEnergetic' as const },
  { label: 'Free Trial', icon: 'gift-outline', colorKey: 'moodCelebratory' as const, softKey: 'moodCelebratory' as const },
];

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();

  const [index, setIndex] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setInterval(() => {
      Animated.timing(fade, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(() => {
        setIndex((i) => (i + 1) % MOOD_PAIRS.length);
        Animated.timing(fade, { toValue: 1, duration: FADE_MS, useNativeDriver: true }).start();
      });
    }, CYCLE_MS);
    return () => clearInterval(timer);
  }, [fade]);

  const finish = async (mode: 'signup' | 'signin') => {
    await storage.set(ONBOARDED_KEY, '1');
    if (mode === 'signin') router.replace({ pathname: '/welcome', params: { mode: 'signin' } });
    else router.replace('/welcome');
  };

  const current = MOOD_PAIRS[index];
  const moodColor = colors[current.colorKey];

  return (
    <LinearGradient
      colors={[colors.accentSoft, colors.background, colors.primarySoft]}
      locations={[0, 0.45, 1]}
      style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
    >
      <View style={styles.headlineWrap}>
        <Text style={styles.headlineBig}>
          What's your <Text style={{ color: colors.accent }}>mood</Text>?
        </Text>
      </View>

      <View style={styles.demoWrap}>
        <Animated.View style={[styles.demoCard, { opacity: fade, backgroundColor: `${moodColor}2E`, borderColor: `${moodColor}66` }]}>
          <View style={[styles.moodBadge, { backgroundColor: moodColor }]}>
            <Icon name={current.icon} size={30} color={colors.primaryForeground} />
          </View>
          <View style={styles.demoTextCol}>
            <Text style={[styles.moodLabel, { color: moodColor }]}>{current.mood}</Text>
            <View style={styles.dishRow}>
              <Icon name="arrow-right-thin" size={18} color={colors.mutedForeground} />
              <Text style={styles.dishLabel}>{current.dish}</Text>
            </View>
          </View>
        </Animated.View>

        <View style={styles.dotsRow}>
          {MOOD_PAIRS.map((pair, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === index && { backgroundColor: colors[pair.colorKey], width: 20 },
              ]}
            />
          ))}
        </View>
      </View>

      <View style={styles.badgesRow}>
        {BADGES.map((b) => {
          const fg = colors[b.colorKey];
          const bg = colors[b.softKey];
          return (
            <View key={b.label} style={[styles.badge, { backgroundColor: `${bg}55` }]}>
              <Icon name={b.icon} size={15} color={fg} />
              <Text style={[styles.badgeText, { color: fg }]}>{b.label}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.ctaWrap}>
        <Button label="Get started" icon="arrow-right" onPress={() => finish('signup')} testID="onboarding-get-started" />
        <View style={{ height: 10 }} />
        <Button label="Log in" variant="outline" onPress={() => finish('signin')} testID="onboarding-login" />
      </View>
    </LinearGradient>
  );
}

const useStyles = makeStyles(({ colors, spacing, radius }) => ({
  root: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'space-between',
  },
  headlineWrap: { marginTop: spacing.md },
  headlineBig: {
    fontFamily: fonts.serif,
    fontSize: 36,
    color: colors.foreground,
    marginTop: 2,
    lineHeight: 42,
  },
  demoWrap: { alignItems: 'center' },
  demoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1.5,
    borderRadius: radius.xl,
    paddingVertical: 24,
    paddingHorizontal: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  moodBadge: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoTextCol: { flex: 1, gap: 4 },
  moodLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 17,
  },
  dishRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dishLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15.5,
    color: colors.foreground,
    flexShrink: 1,
  },
  dotsRow: { flexDirection: 'row', gap: 6, marginTop: 18 },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.borderStrong,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  badgeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
  },
  ctaWrap: { marginTop: spacing.md },
}));
