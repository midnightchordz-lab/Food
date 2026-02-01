# MOOD FOOD - Native Mobile App Build Guide

## Overview
This guide explains how to build native iOS and Android apps from the MOOD FOOD React web application using Capacitor.

## Prerequisites

### For iOS Development
- macOS computer
- Xcode 14+ (from Mac App Store)
- Apple Developer Account ($99/year for App Store publishing)
- CocoaPods: `sudo gem install cocoapods`

### For Android Development
- Android Studio (any OS)
- JDK 17+
- Android SDK (API 33+)
- Google Play Developer Account ($25 one-time for Play Store publishing)

## Project Structure
```
frontend/
├── capacitor.config.json    # Capacitor configuration
├── src/
│   └── capacitor.js         # Native feature integration
├── ios/                     # iOS native project (generated)
└── android/                 # Android native project (generated)
```

## Build Steps

### 1. Build the Web App
```bash
cd frontend
yarn build
```

### 2. Add Native Platforms (First Time Only)
```bash
# Add iOS platform
npx cap add ios

# Add Android platform
npx cap add android
```

### 3. Sync Web Build to Native Projects
```bash
npx cap sync
```

### 4. Open Native IDEs

**For iOS:**
```bash
npx cap open ios
```
This opens Xcode where you can:
- Set your Team/Signing credentials
- Configure app icons and splash screens
- Build and run on simulator or device
- Archive for App Store submission

**For Android:**
```bash
npx cap open android
```
This opens Android Studio where you can:
- Configure signing keys
- Build APK or App Bundle
- Run on emulator or device
- Prepare for Play Store submission

## Configuration

### App Icons
Place app icons in:
- iOS: `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
- Android: `android/app/src/main/res/mipmap-*/`

Use the existing PWA icons from `public/icons/` as source images.

### Splash Screen
Configure in `capacitor.config.json`:
```json
{
  "plugins": {
    "SplashScreen": {
      "launchShowDuration": 2000,
      "backgroundColor": "#faf9f6"
    }
  }
}
```

### Deep Linking (Optional)
To enable deep links (e.g., `moodfood://recipe/123`):

**iOS:** Add URL schemes in Xcode under Target > Info > URL Types

**Android:** Add intent filters in `android/app/src/main/AndroidManifest.xml`

## Native Features Available

The app includes these native capabilities via Capacitor plugins:

| Feature | Plugin | Usage |
|---------|--------|-------|
| Status Bar | @capacitor/status-bar | Custom status bar styling |
| Splash Screen | @capacitor/splash-screen | Native splash screen |
| Keyboard | @capacitor/keyboard | Keyboard event handling |
| Haptics | @capacitor/haptics | Vibration feedback |
| Share | @capacitor/share | Native share dialog |
| Browser | @capacitor/browser | In-app browser |
| App | @capacitor/app | App lifecycle events |

## API Configuration

The app uses environment variables for the backend API:

**For Development:**
The app connects to the configured `REACT_APP_BACKEND_URL` from `.env`

**For Production:**
Update the server URL in `capacitor.config.json`:
```json
{
  "server": {
    "url": "https://your-production-api.com",
    "cleartext": false
  }
}
```

Or keep the bundled web app and let it use the built-in API URL.

## Publishing

### iOS App Store
1. Create App Store Connect record
2. Configure signing in Xcode
3. Archive the app (Product > Archive)
4. Upload via Xcode Organizer
5. Submit for review

### Google Play Store
1. Create Google Play Console listing
2. Generate signed App Bundle: `./gradlew bundleRelease`
3. Upload AAB file to Play Console
4. Complete store listing
5. Submit for review

## Updating the App

After making changes to the web app:
```bash
# Rebuild web app
yarn build

# Sync to native projects
npx cap sync

# Open and rebuild in native IDE
npx cap open ios
# or
npx cap open android
```

## Troubleshooting

### iOS Build Issues
- Clean build folder: Xcode > Product > Clean Build Folder
- Reset pods: `cd ios && pod deintegrate && pod install`

### Android Build Issues
- Clean project: Android Studio > Build > Clean Project
- Invalidate caches: File > Invalidate Caches / Restart

### General Issues
- Ensure `yarn build` completed successfully
- Run `npx cap sync` after any web changes
- Check Capacitor version compatibility

## Support

For Capacitor documentation: https://capacitorjs.com/docs
