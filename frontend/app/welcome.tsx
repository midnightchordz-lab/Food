import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/auth/AuthContext';
import { makeStyles, useTheme, fonts } from '@/src/theme';
import { Button, Icon, useToast } from '@/src/components/ui';
import { AppleSignInButton } from '@/src/components/AppleSignInButton';

const HERO = 'https://images.unsplash.com/photo-1761662826410-3218852da3bf?w=900&q=80';

export default function Welcome() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const { login, register } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password.trim() || (mode === 'signup' && !name.trim())) {
      toast.show('Please fill in all fields', 'error');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signup') await register(name.trim(), email.trim().toLowerCase(), password);
      else await login(email.trim().toLowerCase(), password);
      router.replace('/(tabs)');
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      toast.show(typeof detail === 'string' ? detail : 'Something went wrong. Try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.heroWrap}>
        <Image source={{ uri: HERO }} style={styles.hero} contentFit="cover" transition={300} />
        <LinearGradient
          colors={['transparent', colors.background]}
          style={styles.heroFade}
          locations={[0.35, 1]}
        />
        <View style={[styles.heroContent, { paddingTop: insets.top + 40 }]}>
          <View style={styles.badge}>
            <Icon name="chef-hat" size={16} color={colors.primaryForeground} />
            <Text style={styles.badgeText}>AI Chef</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 28 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.brand} numberOfLines={1} adjustsFontSizeToFit>MOOD<Text style={styles.brandAccent}>FOOD</Text></Text>
          <Text style={styles.tagline}>When feelings need feeding</Text>
          <Text style={styles.sub}>
            A compassionate AI chef that reads your mood and serves meals to heal, comfort and energize.
          </Text>

          <View style={styles.segment}>
            {(['signup', 'signin'] as const).map((m) => (
              <Pressable
                key={m}
                testID={`auth-tab-${m}`}
                onPress={() => setMode(m)}
                style={[styles.segmentBtn, mode === m && styles.segmentBtnActive]}
              >
                <Text style={[styles.segmentText, mode === m && styles.segmentTextActive]}>
                  {m === 'signup' ? 'Create account' : 'Sign in'}
                </Text>
              </Pressable>
            ))}
          </View>

          {mode === 'signup' && (
            <Field icon="account-outline" placeholder="Your name" value={name} onChange={setName} testID="input-name" />
          )}
          <Field icon="email-outline" placeholder="Email address" value={email} onChange={setEmail} keyboardType="email-address" testID="input-email" />
          <Field icon="lock-outline" placeholder="Password" value={password} onChange={setPassword} secure testID="input-password" />

          <View style={{ height: 8 }} />
          <Button
            label={mode === 'signup' ? 'Start cooking' : 'Welcome back'}
            icon="arrow-right"
            onPress={submit}
            loading={busy}
            testID="auth-submit"
          />

          {Platform.OS === 'ios' && (
            <>
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>
              <AppleSignInButton />
            </>
          )}

          <Text style={styles.fineprint}>Free to use • 7-day premium trial included</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({
  icon, placeholder, value, onChange, secure, keyboardType, testID,
}: {
  icon: string; placeholder: string; value: string; onChange: (v: string) => void;
  secure?: boolean; keyboardType?: any; testID?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Icon name={icon} size={20} color={colors.mutedForeground} />
      <TextInput
        testID={testID}
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
        autoCorrect={false}
      />
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  heroWrap: { height: 260, width: '100%' },
  hero: { width: '100%', height: '100%' },
  heroFade: { position: 'absolute', left: 0, right: 0, bottom: 0, top: 0 },
  heroContent: { position: 'absolute', left: 0, right: 0, top: 0, alignItems: 'center' },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
  },
  badgeText: { color: colors.primaryForeground, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  body: { paddingHorizontal: 24, marginTop: -20 },
  brand: { fontFamily: fonts.serif, fontSize: 42, color: colors.foreground, letterSpacing: 0.5 },
  brandAccent: { color: colors.primary },
  tagline: { fontFamily: fonts.serifMedium, fontSize: 20, fontStyle: 'italic', color: colors.accent, marginTop: -4 },
  sub: { fontFamily: fonts.body, fontSize: 15, color: colors.mutedForeground, marginTop: 12, lineHeight: 22 },
  segment: {
    flexDirection: 'row', backgroundColor: colors.secondary, borderRadius: 999, padding: 4, marginTop: 26, marginBottom: 18,
  },
  segmentBtn: { flex: 1, paddingVertical: 11, borderRadius: 999, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: colors.card, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  segmentText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.mutedForeground },
  segmentTextActive: { color: colors.foreground, fontFamily: fonts.bodySemiBold },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 16, paddingHorizontal: 16, height: 56, marginBottom: 12,
  },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.foreground, height: '100%' },
  fineprint: { fontFamily: fonts.body, fontSize: 12.5, color: colors.mutedForeground, textAlign: 'center', marginTop: 14 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontFamily: fonts.body, fontSize: 13, color: colors.mutedForeground },
}));
