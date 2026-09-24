import { useEffect, useRef, useState, useCallback } from 'react';
import { Platform, Linking } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

export type VoiceCommand = 'next' | 'back' | 'repeat';
export type VoicePermission = 'unknown' | 'granted' | 'denied' | 'blocked';

// expo-speech-recognition ships a NATIVE module that is absent in Expo Go. It
// only works in a real dev/prod build. We therefore lazy-require it inside the
// effect and gate everything behind `voiceSupported`.
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
export const voiceSupported = (Platform.OS === 'ios' || Platform.OS === 'android') && !isExpoGo;

function getModule() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-speech-recognition');
}

function parseCommand(text: string): VoiceCommand | null {
  const t = text.toLowerCase();
  if (/\b(next|forward|continue|skip)\b/.test(t)) return 'next';
  if (/\b(back|previous|prev)\b/.test(t)) return 'back';
  if (/\b(repeat|again|replay)\b/.test(t)) return 'repeat';
  return null;
}

/**
 * Continuously listens for the words "next", "back/previous" and "repeat" while
 * `active` is true, firing `onCommand` (debounced) for each. Auto-restarts the
 * recognizer after every utterance so it stays hands-free. No-op unless running
 * in a real native build.
 */
export function useVoiceCommands(active: boolean, onCommand: (cmd: VoiceCommand) => void) {
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;

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

    const fire = (text?: string) => {
      if (!text) return;
      const cmd = parseCommand(text);
      if (!cmd) return;
      const now = Date.now();
      // Debounce: interim + final results repeat the same word rapidly.
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
        if (!cancelled) setTimeout(startRecognition, 250);
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
        // no-speech / network / aborted etc. — keep it alive.
        if (!cancelled) setTimeout(startRecognition, 500);
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
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        // ignore teardown errors
      }
      subs.forEach((s) => {
        try {
          s.remove();
        } catch {
          // ignore
        }
      });
    };
  }, [active]);

  return { listening, permission, openSettings };
}
