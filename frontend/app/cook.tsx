import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { useKeepAwake } from 'expo-keep-awake';
import { API_ROOT, api } from '@/src/api/client';
import { makeStyles, useTheme } from '@/src/theme';
import { Icon, useToast } from '@/src/components/ui';
import { useVoiceCommands, voiceSupported } from '@/src/lib/voice';

const TIMER_OPTIONS = [15, 30, 60] as const;
const DEFAULT_TIMER = 30;

export default function CookMode() {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const p = useLocalSearchParams<{ title?: string; steps?: string }>();

  const steps = useMemo<string[]>(() => {
    try {
      const parsed = JSON.parse(String(p.steps || '[]'));
      return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string' && s.trim()) : [];
    } catch {
      return [];
    }
  }, [p.steps]);

  const title = String(p.title || 'Recipe');
  const [index, setIndex] = useState(0);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [stepSeconds, setStepSeconds] = useState<number>(DEFAULT_TIMER);
  const [voiceOn, setVoiceOn] = useState(true);
  const [remaining, setRemaining] = useState(DEFAULT_TIMER);
  const [timerDone, setTimerDone] = useState(false);
  const [audioDone, setAudioDone] = useState(false);

  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const wasFinishedRef = useRef(false);
  const cache = useRef<Record<number, string>>({});

  const isLastStep = index >= steps.length - 1;

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  const loadAndPlay = async (i: number) => {
    if (i < 0 || i >= steps.length) return;
    try {
      let uri = cache.current[i];
      if (!uri) {
        setLoadingAudio(true);
        const res = await api.post('/mobile-voice/tts', { text: steps[i], voice: 'nova' });
        const path = res.data?.url as string;
        uri = path?.startsWith('http') ? path : `${API_ROOT.replace(/\/api$/, '')}${path}`;
        cache.current[i] = uri;
      }
      // Mark that we're starting fresh playback for this step so a lingering
      // "didJustFinish" from the previous step can't trigger another advance.
      wasFinishedRef.current = true;
      player.replace({ uri });
      player.play();
    } catch {
      toast.show('Could not play this step', 'error');
      // Don't block auto-advance if the voice failed to load.
      setAudioDone(true);
    } finally {
      setLoadingAudio(false);
    }
  };

  // Play whenever the step changes, and reset the auto-advance trackers.
  useEffect(() => {
    if (steps.length) loadAndPlay(index);
    setTimerDone(false);
    setAudioDone(false);
    setRemaining(stepSeconds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Countdown timer: runs `stepSeconds` per step while auto-advance is on (never on the last step).
  useEffect(() => {
    if (!autoAdvance || isLastStep) {
      setRemaining(stepSeconds);
      setTimerDone(false);
      return;
    }
    setRemaining(stepSeconds);
    setTimerDone(false);
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(id);
          setTimerDone(true);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [index, autoAdvance, isLastStep, stepSeconds]);

  // Track when the spoken audio for this step has finished (false->true edge).
  useEffect(() => {
    const finished = !!status?.didJustFinish;
    if (finished && !wasFinishedRef.current) {
      setAudioDone(true);
    }
    wasFinishedRef.current = finished;
  }, [status?.didJustFinish]);

  // Advance once BOTH the 30s timer has elapsed AND the voice has finished.
  useEffect(() => {
    if (autoAdvance && timerDone && audioDone && !isLastStep) {
      setIndex((v) => (v < steps.length - 1 ? v + 1 : v));
    }
  }, [autoAdvance, timerDone, audioDone, isLastStep, steps.length]);

  const isPlaying = !!status?.playing;

  const togglePlay = () => {
    if (isPlaying) {
      player.pause();
    } else {
      if (status?.isLoaded) player.play();
      else loadAndPlay(index);
    }
  };

  const goPrev = () => setIndex((v) => Math.max(0, v - 1));
  const goNext = () => setIndex((v) => Math.min(steps.length - 1, v + 1));

  // Continuous hands-free voice control. onCommandRef inside the hook is refreshed
  // every render, so this inline closure always sees the latest index/steps.
  const { listening, permission, openSettings } = useVoiceCommands(voiceOn, (cmd) => {
    if (cmd === 'next') setIndex((v) => Math.min(steps.length - 1, v + 1));
    else if (cmd === 'back') setIndex((v) => Math.max(0, v - 1));
    else loadAndPlay(index);
  });

  if (!steps.length) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
        <Header title={title} onClose={() => router.back()} />
        <View style={styles.center}>
          <Icon name="chef-hat" size={40} color={colors.mutedForeground} />
          <Text style={styles.emptyText}>No cooking steps found for this recipe.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <Header title={title} onClose={() => router.back()} />

      <View style={styles.progressWrap}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${((index + 1) / steps.length) * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>Step {index + 1} of {steps.length}</Text>
      </View>

      <View style={styles.stepCard}>
        <Text style={styles.stepNumber}>{index + 1}</Text>
        <Text style={styles.stepText}>{steps[index]}</Text>
        {loadingAudio ? (
          <View style={styles.audioLoading}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.audioLoadingText}>Warming up the voice…</Text>
          </View>
        ) : (
          <View style={styles.speakingRow}>
            <Icon name={isPlaying ? 'volume-high' : 'volume-medium'} size={16} color={colors.primary} />
            <Text style={styles.speakingText}>{isPlaying ? 'Reading aloud' : 'Paused'}</Text>
          </View>
        )}
      </View>

      <Pressable
        style={styles.autoRow}
        onPress={() => setAutoAdvance((v) => !v)}
        testID="toggle-autoadvance"
      >
        <Icon name={autoAdvance ? 'checkbox-marked' : 'checkbox-blank-outline'} size={20} color={colors.primary} />
        <Text style={styles.autoText}>Auto-advance to the next step</Text>
        {autoAdvance && !isLastStep && (
          <View style={styles.countdownPill} testID="autoadvance-countdown">
            <Icon name="timer-outline" size={14} color={colors.primary} />
            <Text style={styles.countdownText}>
              {timerDone && !audioDone ? 'Waiting for voice…' : `Next in ${remaining}s`}
            </Text>
          </View>
        )}
      </Pressable>

      {autoAdvance && (
        <View style={styles.timerRow}>
          <Text style={styles.timerLabel}>Seconds per step</Text>
          <View style={styles.timerOptions}>
            {TIMER_OPTIONS.map((s) => (
              <Pressable
                key={s}
                style={[styles.timerPill, stepSeconds === s && styles.timerPillActive]}
                onPress={() => setStepSeconds(s)}
                testID={`timer-${s}`}
              >
                <Text style={[styles.timerPillText, stepSeconds === s && styles.timerPillTextActive]}>{s}s</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <Pressable style={styles.voiceRow} onPress={() => setVoiceOn((v) => !v)} testID="toggle-voice">
        <Icon
          name={voiceOn ? 'microphone' : 'microphone-off'}
          size={20}
          color={voiceOn ? colors.primary : colors.mutedForeground}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.autoText}>Voice control</Text>
          <Text style={styles.voiceHint}>
            {!voiceSupported
              ? 'Say “next”, “back” or “repeat” — needs a real device build.'
              : permission === 'blocked'
              ? 'Microphone access is blocked in settings.'
              : 'Say “next”, “back” or “repeat”.'}
          </Text>
        </View>
        {voiceOn && voiceSupported && listening && permission !== 'blocked' && (
          <View style={styles.countdownPill}>
            <Icon name="access-point" size={14} color={colors.primary} />
            <Text style={styles.countdownText}>Listening</Text>
          </View>
        )}
      </Pressable>

      {voiceOn && voiceSupported && permission === 'blocked' && (
        <Pressable style={styles.settingsBtn} onPress={openSettings} testID="voice-open-settings">
          <Icon name="cog" size={16} color={colors.primaryForeground} />
          <Text style={styles.settingsBtnText}>Open Settings</Text>
        </Pressable>
      )}

      <View style={[styles.controls, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={[styles.sideBtn, index === 0 && styles.disabledBtn]}
          onPress={goPrev}
          disabled={index === 0}
          testID="cook-prev"
        >
          <Icon name="skip-previous" size={26} color={index === 0 ? colors.mutedForeground : colors.foreground} />
        </Pressable>

        <Pressable style={styles.playBtn} onPress={togglePlay} testID="cook-playpause">
          <Icon name={isPlaying ? 'pause' : 'play'} size={34} color={colors.primaryForeground} />
        </Pressable>

        <Pressable
          style={[styles.sideBtn, index === steps.length - 1 && styles.disabledBtn]}
          onPress={goNext}
          disabled={index === steps.length - 1}
          testID="cook-next"
        >
          <Icon name="skip-next" size={26} color={index === steps.length - 1 ? colors.mutedForeground : colors.foreground} />
        </Pressable>
      </View>
    </View>
  );
}

function Header({ title, onClose }: { title: string; onClose: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.kicker}>Hands-free cooking</Text>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
      </View>
      <Pressable style={styles.closeBtn} onPress={onClose} testID="cook-close" hitSlop={8}>
        <Icon name="close" size={22} color={colors.foreground} />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles(({ colors, radius, spacing, fonts: f }) => ({
  root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  kicker: { fontFamily: f.bodySemiBold, fontSize: 12, color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.6 },
  title: { fontFamily: f.serif, fontSize: 26, color: colors.foreground, marginTop: 2 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontFamily: f.body, fontSize: 15, color: colors.mutedForeground, textAlign: 'center' },
  progressWrap: { marginTop: 8, marginBottom: 18 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.secondary, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
  progressText: { fontFamily: f.bodyMedium, fontSize: 13, color: colors.mutedForeground, marginTop: 8 },
  stepCard: { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 22, justifyContent: 'center' },
  stepNumber: { fontFamily: f.serif, fontSize: 48, color: colors.primary, marginBottom: 8 },
  stepText: { fontFamily: f.body, fontSize: 22, lineHeight: 32, color: colors.foreground },
  audioLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20 },
  audioLoadingText: { fontFamily: f.body, fontSize: 13, color: colors.mutedForeground },
  speakingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20 },
  speakingText: { fontFamily: f.bodyMedium, fontSize: 13, color: colors.primary },
  autoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  autoText: { fontFamily: f.bodyMedium, fontSize: 14, color: colors.foreground },
  countdownPill: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto', backgroundColor: colors.secondary, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 5 },
  countdownText: { fontFamily: f.bodySemiBold, fontSize: 12, color: colors.primary },
  timerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8 },
  timerLabel: { fontFamily: f.bodyMedium, fontSize: 14, color: colors.foreground },
  timerOptions: { flexDirection: 'row', gap: 8 },
  timerPill: { minWidth: 48, alignItems: 'center', borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 7 },
  timerPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  timerPillText: { fontFamily: f.bodySemiBold, fontSize: 13, color: colors.foreground },
  timerPillTextActive: { color: colors.primaryForeground },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  voiceHint: { fontFamily: f.body, fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  settingsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 9, marginBottom: 6 },
  settingsBtnText: { fontFamily: f.bodySemiBold, fontSize: 13, color: colors.primaryForeground },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28 },
  sideBtn: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' },
  disabledBtn: { opacity: 0.4 },
  playBtn: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
}));
