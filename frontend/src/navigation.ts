import { Platform } from 'react-native';

// Native liquid-glass tabs only exist on iOS 26+. Everything else uses the classic JS bar.
export const usesNativeTabs =
  Platform.OS === 'ios' && parseInt(String(Platform.Version), 10) >= 26;
