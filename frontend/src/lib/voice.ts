import { useEffect, useRef, useState, useCallback } from 'react';
import { Platform, Linking } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

export type VoiceCommand = 'next' | 'back' | 'repeat';
export type VoicePermission = 'unknown' | 'granted' | 'denied' | 'blocked';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
export const voiceSupported = (Platform.OS === 'ios' || Platform.OS === 'android') && !isExpoGo;

function getModule() {
  return require('expo-speech-recognition');
}

function parseCommand(text: string): VoiceCommand | null {
  const t = text.toLowerCase();
  if (/\b(next|forward|continue|skip)\b/.test(t)) return 'next';
  if (/\b(back|previous|prev)\b/.test(t)) return 'back';
  if (/\b(repeat|again|replay)\b/.test(t)) return 'repeat';
  return null;
}

export function useVoiceCommands(
  active: boolean,
  onCommand: (cmd: VoiceCommand) => void,
  isNarrating: boolean = false,
) {
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;
  // Ref (not state) so the listener-setup effect below never needs isNarrating
  // in its dependency array — recognition itself keeps running continuously;
  // only whether a recognized command is ACTED on changes with narration state.
  const isNarratingRef = useRef(isNarrating);
  isNarratingRef.current = isNarrating;

  const [listening, setListening] = useState(false);
  const [permission, setPermission] = useState<VoicePermission>('unknown');
  const lastFireRef = useRef(0);

  const openSettings = useCallback(() => {
    Linking.openSettings().catch(() => {});
  }, []);

  useEffect(() => {
    if (!active || !voiceSupported) {
      setListening(false);
      return;
    }

    const { ExpoSpeechRecognitionModule } = getModule();
    let cancelled = false;
    const subs: { remove: () => void }[] = [];
    // Coordinates restarts scheduled from the 'error' and 'end' listeners so a
    // single failed attempt (which commonly fires both events) can't schedule
    // two overlapping restarts. Without this, error->500ms and end->250ms could
    // both fire startRecognition() for the same failure, each restart colliding
    // with the other and producing a near-continuous retry storm.
    const retryTimeoutRef = { current: null as ReturnType<typeof setTimeout> | null };
    const scheduleRestart = (delay: number) => {
      if (cancelled) return;
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = setTimeout(() => {
        retryTimeoutRef.current = null;
        startRecognition();
      }, delay);
    };

    const fire = (text?: string) => {
      if (!text) return;
      // Ignore anything heard while our own narration is playing through the
      // speaker — otherwise the mic can pick up the app's own TTS audio (or a
      // step that happens to contain a command word, e.g. "...go back to
      // medium heat") and misfire a command. Recognition keeps running
      // continuously; only acting on results is gated.
      if (isNarratingRef.current) return;
      const cmd = parseCommand(text);
      if (!cmd) return;
      const now = Date.now();
      if (now - lastFireRef.current < 1600) return;
      lastFireRef.current = now;
      onCommandRef.current(cmd);
    };

    const startRecognition = () => {
      if (cancelled) return;
      try {
        ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous: true });
      } catch {
        // transient; error/end listeners will retry
      }
    };

    subs.push(ExpoSpeechRecognitionModule.addListener('start', () => setListening(true)));
    subs.push(
      ExpoSpeechRecognitionModule.addListener('result', (e: { results?: { transcript?: string }[] }) => {
        for (const r of e?.results || []) fire(r?.transcript);
      }),
    );
    subs.push(
      ExpoSpeechRecognitionModule.addListener('end', () => {
        setListening(false);
        if (!cancelled) scheduleRestart(250);
      }),
    );
    subs.push(
      ExpoSpeechRecognitionModule.addListener('error', (e: { error?: string }) => {
        const code = String(e?.error || '');
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          setPermission('blocked');
          setListening(false);
          return;
        }
        if (!cancelled) scheduleRestart(500);
      }),
    );

    (async () => {
      try {
        let perm = await ExpoSpeechRecognitionModule.getPermissionsAsync();
        if (!perm.granted) perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (perm.granted) {
          setPermission('granted');
          startRecognition();
        } else if (perm.canAskAgain === false) {
          setPermission('blocked');
        } else {
          setPermission('denied');
        }
      } catch {
        setPermission('denied');
      }
    })();

    return () => {
      cancelled = true;
      setListening(false);
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      try { ExpoSpeechRecognitionModule.abort(); } catch {}
      subs.forEach((s) => { try { s.remove(); } catch {} });
    };
  }, [active]);

  return { listening, permission, openSettings };
}
