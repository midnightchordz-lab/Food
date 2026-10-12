import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

const BADGES = ['AI-Powered', 'Veg · Vegan · Jain', 'Fridge Scanner', '7-Day Free Trial'];

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
    <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.headlineWrap}>
        <Text style={styles.headlineSmall}>Tell us how you feel.</Text>
        <Text style={styles.headlineBig}>We'll tell you what to cook.</Text>
      </View>

      <View style={styles.demoWrap}>
        <Animated.View style={[styles.demoCard, { opacity: fade }]}>
          <View style={[styles.moodBadge, { backgroundColor: moodColor }]}>
            <Icon name={current.icon} size={26} color={colors.primaryForeground} />
          </View>
          <Text style={styles.moodLabel}>{current.mood}</Text>
          <Icon name="arrow-right-thin" size={22} color={colors.mutedForeground} />
          <Text style={styles.dishLabel}>{current.dish}</Text>
        </Animated.View>

        <View style={styles.dotsRow}>
          {MOOD_PAIRS.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      </View>

      <View style={styles.badgesRow}>
        {BADGES.map((b) => (
          <View key={b} style={styles.badge}>
            <Text style={styles.badgeText}>{b}</Text>
          </View>
        ))}
      </View>

      <View style={styles.ctaWrap}>
        <Button label="Get started" icon="arrow-right" onPress={() => finish('signup')} testID="onboarding-get-started" />
        <View style={{ height: 10 }} />
        <Button label="Log in" variant="outline" onPress={() => finish('signin')} testID="onboarding-login" />
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors, spacing, radius }) => ({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    justifyContent: 'space-between',
  },
  headlineWrap: { marginTop: spacing.md },
  headlineSmall: {
    fontFamily: fonts.bodyMedium,
    fontSize: 17,
    color: colors.mutedForeground,
  },
  headlineBig: {
    fontFamily: fonts.serif,
    fontSize: 34,
    color: colors.foreground,
    marginTop: 2,
    lineHeight: 40,
  },
  demoWrap: { alignItems: 'center' },
  demoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 20,
    paddingHorizontal: 16,
    width: '100%',
  },
  moodBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14.5,
    color: colors.foreground,
  },
  dishLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14.5,
    color: colors.accent,
    flexShrink: 1,
  },
  dotsRow: { flexDirection: 'row', gap: 6, marginTop: 16 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 18,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  badge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  badgeText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12.5,
    color: colors.foreground,
  },
  ctaWrap: { marginTop: spacing.md },
}));
