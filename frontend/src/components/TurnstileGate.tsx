import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

/**
 * Hidden Cloudflare Turnstile (Invisible mode) challenge, run inside an
 * off-screen WebView. Mount this once near a sign-in screen and call
 * requestToken() right before sending an OTP — resolves with a token to
 * attach to the request, or null if anything went wrong (network, timeout,
 * Turnstile rejecting the environment). Always resolves — never throws —
 * so a Turnstile hiccup can never block a real sign-in; the backend fails
 * open on a missing token too (see turnstile_check.py).
 */

const CHALLENGE_URL = `${process.env.EXPO_PUBLIC_BACKEND_URL}/static/turnstile-challenge.html`;
const RESPONSE_TIMEOUT_MS = 8000;

export type TurnstileGateHandle = {
  requestToken: () => Promise<string | null>;
};

export const TurnstileGate = forwardRef<TurnstileGateHandle>((_props, ref) => {
  const [reloadKey, setReloadKey] = useState(0);
  const resolverRef = useRef<((token: string | null) => void) | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const settle = (token: string | null) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (resolverRef.current) {
      resolverRef.current(token);
      resolverRef.current = null;
    }
  };

  useImperativeHandle(ref, () => ({
    requestToken: () =>
      new Promise<string | null>((resolve) => {
        resolverRef.current = resolve;
        timeoutRef.current = setTimeout(() => settle(null), RESPONSE_TIMEOUT_MS);
        // Remount the WebView so the Invisible widget runs a fresh
        // challenge for this request (tokens are single-use).
        setReloadKey((k) => k + 1);
      }),
  }));

  return (
    <View style={{ width: 0, height: 0, overflow: 'hidden' }} pointerEvents="none">
      <WebView
        key={reloadKey}
        source={{ uri: CHALLENGE_URL }}
        javaScriptEnabled
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data?.type === 'turnstile-token') settle(data.token ?? null);
            else if (data?.type === 'turnstile-error') settle(null);
          } catch {
            settle(null);
          }
        }}
        onError={() => settle(null)}
        onHttpError={() => settle(null)}
      />
    </View>
  );
});

TurnstileGate.displayName = 'TurnstileGate';
