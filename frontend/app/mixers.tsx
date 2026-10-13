import React from 'react';
import { View, Text, ScrollView, Pressable, Linking } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/src/api/client';
import { makeStyles, useTheme } from '@/src/theme';
import { Icon, Button, useToast } from '@/src/components/ui';
import { useSubscription } from '@/src/lib/revenuecat';

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

type Cocktail = {
  name?: string;
  description?: string;
  glassware?: string;
  method?: string;
  ingredients?: string[];
  garnish?: string;
  instructions?: string[];
  abv_estimate?: string;
  mocktail_variant?: string;
};

type MixologyResult = {
  spirit_name?: string;
  cocktails?: Cocktail[];
  image_url?: string;
};

export default function MoodMixers() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const { isSubscribed } = useSubscription();

  const [preview, setPreview] = React.useState<MixologyResult | null>(null);

  const imageMut = useMutation({
    mutationFn: async (base64: string) => {
      const res = await api.post('/mobile-mixology/image', { image_data: base64, filename: 'bottle.jpg' });
      return res.data.recipe as MixologyResult;
    },
    onSuccess: (result) => setPreview(result),
    onError: (e: any) => toast.show(e?.response?.data?.detail || 'Could not read that photo', 'error'),
  });

  const pickImage = async (fromCamera: boolean) => {
    try {
      let perm;
      if (fromCamera) {
        perm = await ImagePicker.getCameraPermissionsAsync();
        if (!perm.granted && perm.canAskAgain) perm = await ImagePicker.requestCameraPermissionsAsync();
      } else {
        perm = await ImagePicker.getMediaLibraryPermissionsAsync();
        if (!perm.granted && perm.canAskAgain) perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      }
      if (!perm.granted) {
        toast.show(fromCamera ? 'Camera access is needed' : 'Photo access is needed', 'error');
        if (!perm.canAskAgain) Linking.openSettings();
        return;
      }
      const opts: ImagePicker.ImagePickerOptions = { quality: 0.6, base64: true, mediaTypes: ['images'] };
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);
      if (result.canceled || !result.assets?.[0]?.base64) return;
      imageMut.mutate(result.assets[0].base64);
    } catch {
      toast.show('Could not open the camera', 'error');
    }
  };

  // Non-subscribers see a paywall gate
  if (!isSubscribed) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Header onClose={() => router.back()} />
        <View style={styles.lockWrap}>
          <View style={styles.lockIcon}><Icon name="glass-cocktail" size={34} color={colors.accent} /></View>
          <Text style={styles.lockTitle}>Mood Mixers</Text>
          <Text style={styles.lockDesc}>Snap a photo of any bottle and we&apos;ll mix up 3 real cocktails — plus a mocktail variant for each. This is a Premium feature.</Text>
          <View style={{ height: 20 }} />
          <Button label="Unlock with Premium" icon="crown" onPress={() => router.replace('/paywall')} testID="mixers-upgrade" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Header onClose={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        {!preview ? (
          <>
            <View style={styles.photoWrap}>
              <Pressable style={styles.photoBtn} onPress={() => pickImage(true)} testID="mixers-camera">
                <Icon name="camera" size={26} color={colors.primary} />
                <Text style={styles.photoBtnText}>Take a photo</Text>
              </Pressable>
              <Pressable style={styles.photoBtn} onPress={() => pickImage(false)} testID="mixers-library">
                <Icon name="image-multiple" size={26} color={colors.primary} />
                <Text style={styles.photoBtnText}>Choose from library</Text>
              </Pressable>
            </View>
            <View style={{ height: 16 }} />
            {imageMut.isPending ? (
              <Button label="Mixing it up…" icon="loading" onPress={() => {}} loading testID="mixers-loading" />
            ) : null}
            <Text style={styles.hint}>Photo any bottle of liquor and our AI mixologist whips up 3 cocktails, each with a mocktail version too.</Text>
          </>
        ) : (
          <>
            {preview.image_url ? (
              <Image
                source={{ uri: preview.image_url.startsWith('/') ? `${BACKEND}${preview.image_url}` : preview.image_url }}
                style={styles.previewImg}
                contentFit="cover"
                transition={250}
              />
            ) : null}
            <Text style={styles.previewTitle}>{preview.spirit_name || 'Your Spirit'}</Text>
            <Text style={styles.previewDesc}>3 cocktails we think you&apos;ll love</Text>
            {(preview.cocktails || []).map((c, i) => (
              <View key={i} style={styles.cocktailCard}>
                <Text style={styles.cocktailName}>{c.name}</Text>
                {c.description ? <Text style={styles.previewDesc}>{c.description}</Text> : null}
                <View style={styles.metaRow}>
                  {c.glassware ? <Meta icon="glass-cocktail" text={c.glassware} /> : null}
                  {c.method ? <Meta icon="shaker-outline" text={c.method} /> : null}
                  {c.abv_estimate ? <Meta icon="percent" text={c.abv_estimate} /> : null}
                </View>
                {(c.ingredients || []).length ? (
                  <>
                    <Text style={styles.section}>Ingredients</Text>
                    {(c.ingredients || []).map((ing, j) => (
                      <Text key={j} style={styles.li}>• {ing}</Text>
                    ))}
                  </>
                ) : null}
                {(c.instructions || []).length ? (
                  <>
                    <Text style={styles.section}>Method</Text>
                    {(c.instructions || []).map((s, j) => (
                      <Text key={j} style={styles.li}>{j + 1}. {s}</Text>
                    ))}
                  </>
                ) : null}
                {c.garnish ? <Text style={styles.garnish}>Garnish: {c.garnish}</Text> : null}
                {c.mocktail_variant ? (
                  <View style={styles.mocktailBox}>
                    <Icon name="leaf" size={14} color={colors.primary} />
                    <Text style={styles.mocktailText}>{c.mocktail_variant}</Text>
                  </View>
                ) : null}
              </View>
            ))}
            <View style={{ height: 20 }} />
            <Button label="Scan another bottle" variant="outline" icon="refresh" onPress={() => setPreview(null)} testID="mixers-again" />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Header({ onClose }: { onClose: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      <Pressable onPress={onClose} hitSlop={8} testID="mixers-close"><Icon name="close" size={24} color={colors.foreground} /></Pressable>
      <Text style={styles.headerTitle}>Mood Mixers</Text>
      <View style={{ width: 24 }} />
    </View>
  );
}

function Meta({ icon, text }: { icon: string; text: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.meta}>
      <Icon name={icon} size={14} color={colors.mutedForeground} />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors, radius, spacing, fonts: f }) => ({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 12 },
  headerTitle: { fontFamily: f.serif, fontSize: 24, color: colors.foreground },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: 8 },
  photoWrap: { gap: 12 },
  photoBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 20 },
  photoBtnText: { fontFamily: f.bodySemiBold, fontSize: 15.5, color: colors.foreground },
  hint: { fontFamily: f.body, fontSize: 13, color: colors.mutedForeground, textAlign: 'center', marginTop: 14, lineHeight: 19 },
  previewTitle: { fontFamily: f.serif, fontSize: 28, color: colors.foreground, lineHeight: 32 },
  previewImg: { width: '100%', height: 180, borderRadius: radius.lg, backgroundColor: colors.secondary, marginBottom: 16 },
  previewDesc: { fontFamily: f.body, fontSize: 14.5, color: colors.mutedForeground, marginTop: 6, lineHeight: 21 },
  cocktailCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 16, marginTop: 16 },
  cocktailName: { fontFamily: f.bodyBold, fontSize: 18, color: colors.foreground },
  metaRow: { flexDirection: 'row', gap: 14, marginTop: 10, flexWrap: 'wrap' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontFamily: f.bodyMedium, fontSize: 13, color: colors.mutedForeground },
  section: { fontFamily: f.bodySemiBold, fontSize: 13, color: colors.mutedForeground, marginTop: 14, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  li: { fontFamily: f.body, fontSize: 14.5, color: colors.foreground, lineHeight: 22 },
  garnish: { fontFamily: f.bodyMedium, fontSize: 13, color: colors.mutedForeground, marginTop: 10 },
  mocktailBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: colors.primarySoft, borderRadius: 12, padding: 12, marginTop: 12 },
  mocktailText: { flex: 1, fontFamily: f.body, fontSize: 13, color: colors.foreground, lineHeight: 19 },
  lockWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 8 },
  lockIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  lockTitle: { fontFamily: f.serif, fontSize: 26, color: colors.foreground },
  lockDesc: { fontFamily: f.body, fontSize: 14.5, color: colors.mutedForeground, textAlign: 'center', lineHeight: 21 },
}));
