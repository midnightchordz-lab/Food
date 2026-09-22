import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useAuth } from '@/src/auth/AuthContext';
import { makeStyles, useTheme, fonts } from '@/src/theme';
import { Button, Icon, useToast } from '@/src/components/ui';
import { AppleSignInButton } from '@/src/components/AppleSignInButton';

WebBrowser.maybeCompleteAuthSession();

const HERO = 'https://images.unsplash.com/photo-1761662826410-3218852da3bf?w=900&q=80';

export default function Welcome() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const { login, register, sendPhoneOtp, phoneLogin, googleLogin, user } = useAuth();

  useEffect(() => {
    if (user) router.replace('/(tabs)');
  }, [user, router]);

  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const [phoneMode, setPhoneMode] = useState(false);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const handleGoogle = async () => {
    setGoogleBusy(true);
    try {
      if (Platform.OS === 'web') {
        const redirect = window.location.origin + '/';
        window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirect)}`;
        return; // AuthContext handles the return on mount
      }
      const redirect = Linking.createURL('');
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirect)}`;
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirect);
      let url: string | null = result.type === 'success' ? result.url : null;
      if (!url) url = await Linking.getInitialURL();
      const m = url ? url.match(/[?#&]session_id=([^&#]+)/) : null;
      if (m) {
        await googleLogin(decodeURIComponent(m[1]));
        router.replace('/(tabs)');
      }
      // If no session_id here, the AuthContext url listener will pick it up.
    } catch {
      toast.show('Google sign-in failed. Please try again.', 'error');
    } finally {
      setGoogleBusy(false);
    }
  };

  const sendCode = async () => {
    if (!/^\+\d{7,15}$/.test(phone.trim())) {
      toast.show('Enter your number in +countrycode format, e.g. +14155551234', 'error');
      return;
    }
    setPhoneBusy(true);
    try {
      const res = await sendPhoneOtp(phone.trim());
      setOtpSent(true);
      if (res?.demo_otp) toast.show(`Demo code: ${res.demo_otp}`, 'info');
      else toast.show('We texted you a 6-digit code', 'success');
    } catch (e: any) {
      toast.show(e?.response?.data?.detail || 'Could not send the code', 'error');
    } finally {
      setPhoneBusy(false);
    }
  };

  const verifyCode = async () => {
    if (code.trim().length < 4) { toast.show('Enter the code we sent you', 'error'); return; }
    setPhoneBusy(true);
    try {
      await phoneLogin(phone.trim(), code.trim());
      router.replace('/(tabs)');
    } catch (e: any) {
      toast.show(e?.response?.data?.detail || 'That code did not work', 'error');
    } finally {
      setPhoneBusy(false);
    }
  };

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
          colors={['rgba(45,42,38,0.35)', 'transparent', colors.background]}
          style={styles.heroFade}
          locations={[0, 0.4, 0.98]}
        />
        <View style={[styles.heroTop, { paddingTop: insets.top + 16 }]}>
          <View style={styles.badge}>
            <Icon name="chef-hat" size={15} color={colors.primaryForeground} />
            <Text style={styles.badgeText}>AI Chef</Text>
          </View>
        </View>
        <View style={styles.heroBottom}>
          <Text style={styles.brand} numberOfLines={1}>MOOD<Text style={styles.brandAccent}>FOOD</Text></Text>
          <Text style={styles.tagline}>When feelings need feeding</Text>
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
          <Text style={styles.sub}>
            A compassionate AI chef that reads your mood and serves meals to heal, comfort and energize.
          </Text>

          <View style={styles.pillsRow}>
            <FeaturePill icon="emoticon-happy-outline" label="Mood-matched" />
            <FeaturePill icon="silverware-fork-knife" label="AI recipes" />
            <FeaturePill icon="calendar-heart" label="Weekly plans" />
          </View>

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

          {!phoneMode ? (
            <>
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
            </>
          ) : (
            <>
              <Field icon="phone-outline" placeholder="+1 415 555 1234" value={phone} onChange={setPhone} keyboardType="phone-pad" testID="input-phone" />
              {otpSent ? (
                <Field icon="numeric" placeholder="6-digit code" value={code} onChange={setCode} keyboardType="number-pad" testID="input-otp" />
              ) : null}
              <View style={{ height: 8 }} />
              {!otpSent ? (
                <Button label="Send code" icon="message-text-outline" onPress={sendCode} loading={phoneBusy} testID="phone-send" />
              ) : (
                <Button label="Verify & continue" icon="arrow-right" onPress={verifyCode} loading={phoneBusy} testID="phone-verify" />
              )}
              {otpSent ? (
                <Pressable onPress={sendCode} style={styles.resendRow} testID="phone-resend">
                  <Text style={styles.resendText}>Resend code</Text>
                </Pressable>
              ) : null}
            </>
          )}

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.socialGrid}>
            <Pressable
              style={styles.altBtn}
              testID="google-signin"
              onPress={handleGoogle}
              disabled={googleBusy}
            >
              <Icon name="google" size={19} color={colors.foreground} />
              <Text style={styles.altBtnText}>{googleBusy ? 'Connecting…' : 'Google'}</Text>
            </Pressable>
            <Pressable
              style={styles.altBtn}
              testID="toggle-phone"
              onPress={() => { setPhoneMode((v) => !v); setOtpSent(false); setCode(''); }}
            >
              <Icon name={phoneMode ? 'email-outline' : 'phone-outline'} size={19} color={colors.foreground} />
              <Text style={styles.altBtnText}>{phoneMode ? 'Email' : 'Phone'}</Text>
            </Pressable>
          </View>

          {Platform.OS === 'ios' && (
            <View style={{ marginTop: 10 }}>
              <AppleSignInButton />
            </View>
          )}

          <Text style={styles.fineprint}>Free to use · 7-day premium trial included</Text>
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

function FeaturePill({ icon, label }: { icon: string; label: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.pill}>
      <Icon name={icon} size={14} color={colors.primary} />
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  heroWrap: { height: 300, width: '100%' },
  hero: { width: '100%', height: '100%' },
  heroFade: { position: 'absolute', left: 0, right: 0, bottom: 0, top: 0 },
  heroTop: { position: 'absolute', left: 0, right: 0, top: 0, alignItems: 'center' },
  heroBottom: { position: 'absolute', left: 24, right: 24, bottom: 18 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
  },
  badgeText: { color: colors.primaryForeground, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  body: { paddingHorizontal: 24, marginTop: 4 },
  brand: { fontFamily: fonts.serif, fontSize: 40, color: colors.foreground, letterSpacing: 0.5 },
  brandAccent: { color: colors.accent },
  tagline: { fontFamily: fonts.serifMedium, fontSize: 21, fontStyle: 'italic', color: colors.mutedForeground, marginTop: -2 },
  sub: { fontFamily: fonts.body, fontSize: 15, color: colors.mutedForeground, marginTop: 4, lineHeight: 22 },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primarySoft, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
  },
  pillText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.foreground },
  segment: {
    flexDirection: 'row', backgroundColor: colors.secondary, borderRadius: 999, padding: 4, marginTop: 24, marginBottom: 18,
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
  fineprint: { fontFamily: fonts.body, fontSize: 12.5, color: colors.mutedForeground, textAlign: 'center', marginTop: 18 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.mutedForeground },
  socialGrid: { flexDirection: 'row', gap: 12, marginTop: 16 },
  altBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, height: 54 },
  altBtnText: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.foreground },
  resendRow: { alignItems: 'center', paddingVertical: 12 },
  resendText: { fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.primary },
}));
