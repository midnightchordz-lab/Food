import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/auth/AuthContext';
import { Loading } from '@/src/components/ui';
import { useTheme } from '@/src/theme';

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();

  useEffect(() => {
    if (loading) return;
    if (user) router.replace('/(tabs)');
    else router.replace('/welcome');
  }, [user, loading, router]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Loading />
    </View>
  );
}
