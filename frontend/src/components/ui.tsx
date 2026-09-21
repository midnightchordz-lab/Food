import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { View, Text, Pressable, ActivityIndicator, Animated, StyleSheet } from 'react-native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme, makeStyles, fonts } from '@/src/theme';

export function Icon({ name, size = 24, color }: { name: any; size?: number; color: string }) {
  return <MaterialDesignIcons name={name} size={size} color={color} />;
}

// ---------- Button ----------
type BtnProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'accent';
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
  fullWidth?: boolean;
};

export function Button({ label, onPress, variant = 'primary', icon, disabled, loading, testID, fullWidth = true }: BtnProps) {
  const { colors } = useTheme();
  const bg =
    variant === 'primary' ? colors.primary :
    variant === 'accent' ? colors.accent :
    variant === 'secondary' ? colors.secondary : 'transparent';
  const fg =
    variant === 'primary' ? colors.primaryForeground :
    variant === 'accent' ? colors.accentForeground :
    variant === 'secondary' ? colors.secondaryForeground : colors.foreground;
  const border = variant === 'outline' ? colors.borderStrong : 'transparent';

  return (
    <Pressable
      testID={testID}
      disabled={disabled || loading}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderColor: border,
          borderWidth: variant === 'outline' ? 1.5 : 0,
          opacity: disabled ? 0.5 : pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          width: fullWidth ? '100%' : undefined,
        },
        styles.btn,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.btnRow}>
          {icon ? <Icon name={icon} size={20} color={fg} /> : null}
          <Text style={[styles.btnLabel, { color: fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ---------- Loading ----------
export function Loading({ label }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} size="large" />
      {label ? <Text style={[styles.muted, { color: colors.mutedForeground }]}>{label}</Text> : null}
    </View>
  );
}

// ---------- Empty state ----------
export function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.center}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
        <Icon name={icon} size={34} color={colors.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{title}</Text>
      {subtitle ? <Text style={[styles.muted, { color: colors.mutedForeground, textAlign: 'center' }]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 54,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnLabel: { fontFamily: fonts.bodySemiBold, fontSize: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  muted: { fontFamily: fonts.body, fontSize: 14 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: fonts.serif, fontSize: 24 },
});

// ---------- Toast ----------
type ToastType = 'success' | 'error' | 'info';
type ToastCtx = { show: (msg: string, type?: ToastType) => void };
const ToastContext = createContext<ToastCtx>({ show: () => {} });
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [msg, setMsg] = useState('');
  const [type, setType] = useState<ToastType>('info');
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((m: string, t: ToastType = 'info') => {
    setMsg(m);
    setType(t);
    if (timer.current) clearTimeout(timer.current);
    Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    timer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 260, useNativeDriver: true }).start();
    }, 2600);
  }, [opacity]);

  const bg = type === 'error' ? colors.danger : type === 'success' ? colors.success : colors.foreground;
  const iconName = type === 'error' ? 'alert-circle' : type === 'success' ? 'check-circle' : 'information';

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[
          toastStyles.wrap,
          { top: insets.top + 10, opacity, transform: [{ translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }] },
        ]}
      >
        <View style={[toastStyles.toast, { backgroundColor: bg }]}>
          <MaterialDesignIcons name={iconName as any} size={20} color="#FFFFFF" />
          <Text style={toastStyles.text}>{msg}</Text>
        </View>
      </Animated.View>
    </ToastContext.Provider>
  );
}

const toastStyles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 9999, paddingHorizontal: 16 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 999,
    maxWidth: '92%',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  text: { color: '#FFFFFF', fontFamily: fonts.bodyMedium, fontSize: 14, flexShrink: 1 },
});
