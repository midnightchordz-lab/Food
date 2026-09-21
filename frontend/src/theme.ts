import { useColorScheme } from 'react-native';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

// MoodFood brand palette — "Warm Bone" light + soft "Dim" dark
export const lightColors = {
  background: '#F9F8F6',
  backgroundAlt: '#F2EFE9',
  card: '#FFFFFF',
  cardAlt: '#F2EFE9',
  foreground: '#2D2A26',
  mutedForeground: '#5C5852',
  primary: '#768A76',
  primaryHover: '#5F705F',
  primaryForeground: '#FFFFFF',
  primarySoft: '#E7ECE7',
  secondary: '#E8E4D9',
  secondaryForeground: '#2D2A26',
  accent: '#C66B3D',
  accentForeground: '#FFFFFF',
  accentSoft: '#F5E4D8',
  border: '#E4E0D6',
  borderStrong: '#D6D1C4',
  success: '#5E8B6A',
  danger: '#C0553B',
  overlay: 'rgba(45,42,38,0.45)',
  // mood accent tokens
  moodStressed: '#9FB8AD',
  moodEnergetic: '#E6B89C',
  moodSad: '#D4CCC4',
  moodCelebratory: '#D4A373',
};

export const darkColors: typeof lightColors = {
  background: '#211F1C',
  backgroundAlt: '#2A2724',
  card: '#2E2B27',
  cardAlt: '#35322D',
  foreground: '#F1EDE6',
  mutedForeground: '#B0AA9F',
  primary: '#8CA089',
  primaryHover: '#9FB29B',
  primaryForeground: '#1C1A17',
  primarySoft: '#33463A',
  secondary: '#3A362F',
  secondaryForeground: '#F1EDE6',
  accent: '#D98453',
  accentForeground: '#1C1A17',
  accentSoft: '#4A3325',
  border: '#3E3A33',
  borderStrong: '#4C473E',
  success: '#7BAE86',
  danger: '#E08063',
  overlay: 'rgba(0,0,0,0.55)',
  moodStressed: '#9FB8AD',
  moodEnergetic: '#E6B89C',
  moodSad: '#D4CCC4',
  moodCelebratory: '#D4A373',
};

export type ThemeColors = typeof lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
};

export const fonts = {
  serif: 'CormorantGaramond-SemiBold',
  serifMedium: 'CormorantGaramond-Medium',
  body: 'Manrope-Regular',
  bodyMedium: 'Manrope-Medium',
  bodySemiBold: 'Manrope-SemiBold',
  bodyBold: 'Manrope-Bold',
};

export function useTheme() {
  const scheme = useColorScheme();
  const colors = scheme === 'dark' ? darkColors : lightColors;
  return { colors, scheme, spacing, radius, fonts, isDark: scheme === 'dark' };
}

// makeStyles wraps StyleSheet.create with the active theme colors
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (t: { colors: ThemeColors; spacing: typeof spacing; radius: typeof radius; fonts: typeof fonts }) => T
) {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory({ colors, spacing, radius, fonts })), [colors]);
  };
}
