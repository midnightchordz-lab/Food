import { useEffect, useRef, useState, useCallback } from 'react';
import { Platform, PermissionsAndroid, Linking } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

export type VoiceCommand = 'next' | 'back' | 'repeat';
export type VoicePermission = 'unknown' | 'granted' | 'denied' | 'blocked';

// @react-native-voice/voice is a NATIVE module: it is absent in Expo Go and on
// web, where importing/using it throws. It only works in a real dev/prod build.
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
export const voiceSupported = (Platform.OS === 'ios' || Platform.OS === 'android') && !isExpoGo;

function getVoice() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@react-native-voice/voice').default;
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

    const Voice = getVoice();
    let cancelled = false;

    const fire = (text: string) => {
      const cmd = parseCommand(text);
      if (!cmd) return;
      const now = Date.now();
      // Debounce: partial + final results repeat the same word rapidly.
      if (now - lastFireRef.current < 1600) return;
      lastFireRef.current = now;
      onCommandRef.current(cmd);
    };

    const start = async () => {
      if (cancelled) return;
      try {
        await Voice.start('en-US');
        setListening(true);
      } catch {
        // ignore transient start errors; onSpeechError will retry
      }
    };

    Voice.onSpeechResults = (e: { value?: string[] }) => {
      for (const v of e.value || []) fire(v);
    };
    Voice.onSpeechPartialResults = (e: { value?: string[] }) => {
      for (const v of e.value || []) fire(v);
    };
    Voice.onSpeechEnd = () => {
      if (!cancelled) setTimeout(start, 250);
    };
    Voice.onSpeechError = (e: { error?: { code?: string; message?: string } }) => {
      const code = String(e?.error?.code || e?.error?.message || '');
      // Permission-related errors on iOS surface here.
      if (/permission|denied|not-authorized|9|4/i.test(code) && /permission|denied|authoriz/i.test(code)) {
        setPermission('blocked');
        setListening(false);
        return;
      }
      if (!cancelled) setTimeout(start, 600);
    };

    (async () => {
      if (Platform.OS === 'android') {
        try {
          const already = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
          if (already) {
            setPermission('granted');
          } else {
            const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
            if (res === PermissionsAndroid.RESULTS.GRANTED) {
              setPermission('granted');
            } else if (res === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
              setPermission('blocked');
              return;
            } else {
              setPermission('denied');
              return;
            }
          }
        } catch {
          setPermission('denied');
          return;
        }
      } else {
        // iOS prompts on first start(); assume grantable until an error says otherwise.
        setPermission('granted');
      }
      start();
    })();

    return () => {
      cancelled = true;
      setListening(false);
      try {
        Voice.destroy().then(() => Voice.removeAllListeners());
      } catch {
        // ignore teardown errors
      }
    };
  }, [active]);

  return { listening, permission, openSettings };
}
