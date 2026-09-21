import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Platform, KeyboardAvoidingView, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/src/api/client';
import { makeStyles, useTheme, fonts } from '@/src/theme';
import { Icon, Button, useToast } from '@/src/components/ui';
import { useSubscription } from '@/src/lib/revenuecat';

type ImportedRecipe = {
  name?: string;
  description?: string;
  cuisine?: string;
  difficulty?: string;
  totalTime?: string;
  ingredients?: any[];
  instructions?: any[];
};

export default function ImportRecipe() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isSubscribed } = useSubscription();

  const [tab, setTab] = useState<'link' | 'text' | 'photo'>('link');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<ImportedRecipe | null>(null);

  const importMut = useMutation({
    mutationFn: async () => {
      if (tab === 'link') {
        const res = await api.post('/mobile-import/url', { url: url.trim() });
        return res.data.recipe as ImportedRecipe;
      }
      const res = await api.post('/mobile-import/text', { recipe_text: text.trim() });
      return res.data.recipe as ImportedRecipe;
    },
    onSuccess: (recipe) => setPreview(recipe),
    onError: (e: any) => toast.show(e?.response?.data?.detail || 'Could not import recipe', 'error'),
  });

  const imageMut = useMutation({
    mutationFn: async (base64: string) => {
      const res = await api.post('/mobile-import/image', { image_data: base64, filename: 'photo.jpg' });
      return res.data.recipe as ImportedRecipe;
    },
    onSuccess: (recipe) => setPreview(recipe),
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

  const saveMut = useMutation({
    mutationFn: async () => {
      await api.post('/import/save', { recipe: preview });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-recipes'] });
      toast.show('Recipe added to your collection', 'success');
      router.replace('/(tabs)/saved');
    },
    onError: () => toast.show('Could not save recipe', 'error'),
  });

  // Non-subscribers see a paywall gate
  if (!isSubscribed) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Header onClose={() => router.back()} />
        <View style={styles.lockWrap}>
          <View style={styles.lockIcon}><Icon name="import" size={34} color={colors.accent} /></View>
          <Text style={styles.lockTitle}>Import any recipe</Text>
          <Text style={styles.lockDesc}>Paste a link or text and we'll turn it into a beautiful MoodFood recipe. This is a Premium feature.</Text>
          <View style={{ height: 20 }} />
          <Button label="Unlock with Premium" icon="crown" onPress={() => router.replace('/paywall')} testID="import-upgrade" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Header onClose={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {!preview ? (
            <>
              <View style={styles.segment}>
                {(['link', 'text', 'photo'] as const).map((t) => (
                  <Pressable key={t} testID={`import-tab-${t}`} onPress={() => setTab(t)} style={[styles.segBtn, tab === t && styles.segBtnActive]}>
                    <Icon name={t === 'link' ? 'link-variant' : t === 'text' ? 'text' : 'camera'} size={16} color={tab === t ? colors.foreground : colors.mutedForeground} />
                    <Text style={[styles.segText, tab === t && styles.segTextActive]}>{t === 'link' ? 'Link' : t === 'text' ? 'Text' : 'Photo'}</Text>
                  </Pressable>
                ))}
              </View>

              {tab === 'link' ? (
                <View style={styles.inputRow}>
                  <Icon name="link-variant" size={20} color={colors.mutedForeground} />
                  <TextInput
                    testID="import-url"
                    style={styles.input}
                    placeholder="https://example.com/recipe"
                    placeholderTextColor={colors.mutedForeground}
                    value={url}
                    onChangeText={setUrl}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                  />
                </View>
              ) : tab === 'text' ? (
                <TextInput
                  testID="import-text"
                  style={styles.textArea}
                  placeholder="Paste the full recipe text here…"
                  placeholderTextColor={colors.mutedForeground}
                  value={text}
                  onChangeText={setText}
                  multiline
                  textAlignVertical="top"
                />
              ) : (
                <View style={styles.photoWrap}>
                  <Pressable style={styles.photoBtn} onPress={() => pickImage(true)} testID="import-camera">
                    <Icon name="camera" size={26} color={colors.primary} />
                    <Text style={styles.photoBtnText}>Take a photo</Text>
                  </Pressable>
                  <Pressable style={styles.photoBtn} onPress={() => pickImage(false)} testID="import-library">
                    <Icon name="image-multiple" size={26} color={colors.primary} />
                    <Text style={styles.photoBtnText}>Choose from library</Text>
                  </Pressable>
                </View>
              )}

              <View style={{ height: 16 }} />
              {tab !== 'photo' ? (
                <Button
                  label="Import recipe"
                  icon="magic-staff"
                  onPress={() => importMut.mutate()}
                  loading={importMut.isPending}
                  disabled={tab === 'link' ? !url.trim() : text.trim().length < 20}
                  testID="import-submit"
                />
              ) : imageMut.isPending ? (
                <Button label="Reading your photo…" icon="loading" onPress={() => {}} loading testID="import-photo-loading" />
              ) : null}
              <Text style={styles.hint}>Our AI chef rewrites it into clear steps with timings and tips.</Text>
            </>
          ) : (
            <>
              <Text style={styles.previewTitle}>{preview.name || 'Imported Recipe'}</Text>
              {preview.description ? <Text style={styles.previewDesc}>{preview.description}</Text> : null}
              <View style={styles.metaRow}>
                {preview.cuisine ? <Meta icon="earth" text={preview.cuisine} /> : null}
                {preview.totalTime ? <Meta icon="clock-outline" text={preview.totalTime} /> : null}
                {preview.difficulty ? <Meta icon="chef-hat" text={preview.difficulty} /> : null}
              </View>
              <Text style={styles.section}>Ingredients</Text>
              {(preview.ingredients || []).slice(0, 20).map((ing, i) => (
                <Text key={i} style={styles.li}>• {typeof ing === 'string' ? ing : ing?.name || JSON.stringify(ing)}</Text>
              ))}
              <View style={{ height: 20 }} />
              <Button label="Save to my collection" icon="heart" onPress={() => saveMut.mutate()} loading={saveMut.isPending} testID="import-save" />
              <View style={{ height: 10 }} />
              <Button label="Import another" variant="outline" icon="refresh" onPress={() => { setPreview(null); setUrl(''); setText(''); }} testID="import-again" />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Header({ onClose }: { onClose: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      <Pressable onPress={onClose} hitSlop={8} testID="import-close"><Icon name="close" size={24} color={colors.foreground} /></Pressable>
      <Text style={styles.headerTitle}>Import Recipe</Text>
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
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 12 },
  headerTitle: { fontFamily: f.serif, fontSize: 24, color: colors.foreground },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: 8 },
  segment: { flexDirection: 'row', backgroundColor: colors.secondary, borderRadius: 999, padding: 4, marginBottom: 18 },
  segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 999 },
  segBtnActive: { backgroundColor: colors.card },
  segText: { fontFamily: f.bodyMedium, fontSize: 14, color: colors.mutedForeground },
  segTextActive: { color: colors.foreground, fontFamily: f.bodySemiBold },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 16, height: 56 },
  input: { flex: 1, fontFamily: f.body, fontSize: 15, color: colors.foreground, height: '100%' },
  textArea: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, fontFamily: f.body, fontSize: 15, color: colors.foreground, minHeight: 200 },
  photoWrap: { gap: 12 },
  photoBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 20 },
  photoBtnText: { fontFamily: f.bodySemiBold, fontSize: 15.5, color: colors.foreground },
  hint: { fontFamily: f.body, fontSize: 13, color: colors.mutedForeground, textAlign: 'center', marginTop: 14, lineHeight: 19 },
  previewTitle: { fontFamily: f.serif, fontSize: 28, color: colors.foreground, lineHeight: 32 },
  previewDesc: { fontFamily: f.body, fontSize: 14.5, color: colors.mutedForeground, marginTop: 8, lineHeight: 21 },
  metaRow: { flexDirection: 'row', gap: 14, marginTop: 12, flexWrap: 'wrap' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontFamily: f.bodyMedium, fontSize: 13, color: colors.mutedForeground },
  section: { fontFamily: f.bodySemiBold, fontSize: 13, color: colors.mutedForeground, marginTop: 22, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  li: { fontFamily: f.body, fontSize: 15, color: colors.foreground, lineHeight: 24 },
  lockWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 8 },
  lockIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  lockTitle: { fontFamily: f.serif, fontSize: 26, color: colors.foreground },
  lockDesc: { fontFamily: f.body, fontSize: 14.5, color: colors.mutedForeground, textAlign: 'center', lineHeight: 21 },
}));
