import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/auth/AuthContext';
import { useToast } from '@/src/components/ui';
import { useTheme } from '@/src/theme';

export function AppleSignInButton() {
  const { colors, isDark } = useTheme();
  const { appleLogin } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setAvailable).catch(() => setAvailable(false));
    }
  }, []);

  if (Platform.OS !== 'ios' || !available) return null;

  const onPress = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        toast.show('Apple sign in failed', 'error');
        return;
      }
      const fullName = credential.fullName
        ? [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean).join(' ')
        : null;
      await appleLogin(credential.identityToken, fullName || null, credential.email || null, credential.authorizationCode || null);
      router.replace('/(tabs)');
    } catch (e: any) {
      if (e?.code === 'ERR_REQUEST_CANCELED') return; // user cancelled
      toast.show('Could not sign in with Apple', 'error');
    }
  };

  return (
    <View style={{ marginTop: 12 }}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={
          isDark
            ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
            : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
        }
        cornerRadius={999}
        style={{ width: '100%', height: 52 }}
        onPress={onPress}
      />
    </View>
  );
}
