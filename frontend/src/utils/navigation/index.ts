import { useRouter } from 'expo-router';

// router.back() fails silently (a "GO_BACK was not handled" error, no
// navigation at all) when the current screen has no history behind it in
// this navigator -- e.g. a fresh web preview load straight into a modal
// route -- stranding the user with a dead close/back button. Use this in
// place of a bare router.back() on any close/back button.
export function useSafeBack(fallback: string = '/(tabs)') {
  const router = useRouter();
  return () => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback as any);
  };
}
