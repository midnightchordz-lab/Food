# MOOD FOOD - Mobile App Build Guide

## Overview
This guide explains how to build the MOOD FOOD app for iOS and Android using Capacitor.

## Prerequisites

### For iOS Build (Mac Required)
- macOS computer
- Xcode 14+ installed (from Mac App Store)
- Apple Developer Account ($99/year for App Store distribution)
- CocoaPods installed: `sudo gem install cocoapods`

### For Android Build
- Android Studio installed
- Android SDK (API Level 33+)
- Java Development Kit (JDK 17+)

## Project Structure
```
frontend/
├── ios/                    # iOS native project
│   └── App/
│       ├── App.xcworkspace # Open this in Xcode
│       └── Podfile         # iOS dependencies
├── android/                # Android native project
│   └── app/
│       └── build.gradle    # Android build config
├── build/                  # Web assets (synced to native)
└── capacitor.config.json   # Capacitor configuration
```

## App Configuration
- **App ID**: `com.moodfood.app`
- **App Name**: `MOOD FOOD`
- **Primary Color**: `#4a7c59` (Sage Green)
- **Background**: `#faf9f6` (Off-White)

## Building the App

### Step 1: Build Web Assets
```bash
cd frontend
yarn build
```

### Step 2: Sync to Native Projects
```bash
npx cap sync
```

### Step 3: Build for iOS

1. **Open Xcode Project**
   ```bash
   npx cap open ios
   ```
   Or manually open: `frontend/ios/App/App.xcworkspace`

2. **Install CocoaPods** (first time only)
   ```bash
   cd ios/App
   pod install
   ```

3. **Configure Signing in Xcode**
   - Select "App" target
   - Go to "Signing & Capabilities"
   - Select your Development Team
   - Enable "Automatically manage signing"

4. **Build for Device/Simulator**
   - Select target device (iPhone)
   - Press `Cmd + R` to build and run
   - Or `Product > Archive` for App Store build

5. **Create App Store Build**
   - `Product > Archive`
   - `Distribute App > App Store Connect`
   - Upload to App Store Connect

### Step 4: Build for Android

1. **Open Android Studio**
   ```bash
   npx cap open android
   ```
   Or manually open: `frontend/android/` folder

2. **Build Debug APK**
   - `Build > Build Bundle(s) / APK(s) > Build APK(s)`
   - APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

3. **Build Release APK/AAB**
   ```bash
   cd android
   ./gradlew assembleRelease    # For APK
   ./gradlew bundleRelease      # For AAB (Play Store)
   ```

4. **Sign Release Build**
   - Create keystore: `keytool -genkey -v -keystore release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias moodfood`
   - Update `android/app/build.gradle` with signing config

## App Icons & Splash Screen

### iOS Icons
Location: `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
Required sizes: 20, 29, 40, 60, 76, 83.5, 1024 points (various scales)

### Android Icons
Location: `android/app/src/main/res/`
- `mipmap-mdpi/` - 48x48
- `mipmap-hdpi/` - 72x72
- `mipmap-xhdpi/` - 96x96
- `mipmap-xxhdpi/` - 144x144
- `mipmap-xxxhdpi/` - 192x192

### Splash Screen
Configured in `capacitor.config.json`:
- Background: `#faf9f6`
- Duration: 2 seconds
- Style: Full screen, immersive

## Environment Configuration

### API URL
The app connects to the backend at:
- **Production**: Set in `.env` file
- **Current**: `https://tts-refactor.preview.emergentagent.com`

For production, update `frontend/.env`:
```
REACT_APP_BACKEND_URL=https://your-production-api.com
```

Then rebuild:
```bash
yarn build && npx cap sync
```

## Installed Capacitor Plugins
- `@capacitor/app` - App lifecycle events
- `@capacitor/browser` - In-app browser
- `@capacitor/haptics` - Vibration feedback
- `@capacitor/keyboard` - Keyboard handling
- `@capacitor/share` - Native share sheet
- `@capacitor/splash-screen` - Splash screen
- `@capacitor/status-bar` - Status bar styling

## Testing

### iOS Simulator
```bash
npx cap run ios
```

### Android Emulator
```bash
npx cap run android
```

### Live Reload (Development)
```bash
# Start dev server
yarn start

# Update capacitor.config.json to use local server
# Then sync and run
npx cap sync && npx cap run ios
```

## Troubleshooting

### iOS: "Code Signing" Errors
- Ensure you have a valid Apple Developer account
- Check signing settings in Xcode
- Try: `Xcode > Preferences > Accounts > Download Manual Profiles`

### Android: "SDK not found"
- Open Android Studio
- `Tools > SDK Manager`
- Install required SDK platforms

### Web Assets Not Updating
```bash
rm -rf build
yarn build
npx cap sync
```

### Plugin Not Working
```bash
npx cap sync
# Then rebuild in Xcode/Android Studio
```

## App Store Submission Checklist

### iOS (App Store)
- [ ] App Icons (all sizes)
- [ ] Screenshots (6.5", 5.5", 12.9" iPad)
- [ ] App description and keywords
- [ ] Privacy policy URL
- [ ] Support URL
- [ ] App review information

### Android (Play Store)
- [ ] App Icons (512x512 hi-res)
- [ ] Feature graphic (1024x500)
- [ ] Screenshots (phone, 7" tablet, 10" tablet)
- [ ] App description (short & full)
- [ ] Privacy policy URL
- [ ] Content rating questionnaire
- [ ] Signed AAB file

## Quick Commands Summary

```bash
# Build web assets
yarn build

# Sync to native
npx cap sync

# Open iOS project
npx cap open ios

# Open Android project
npx cap open android

# Run on iOS simulator
npx cap run ios

# Run on Android emulator
npx cap run android
```

## Support
For issues with the mobile build, check:
- [Capacitor Documentation](https://capacitorjs.com/docs)
- [iOS Development Guide](https://developer.apple.com/documentation/)
- [Android Development Guide](https://developer.android.com/docs)
