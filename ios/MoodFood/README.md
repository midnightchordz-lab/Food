# MOOD FOOD iOS App

A native iOS app for MOOD FOOD - When Feelings Need Feeding.

## Project Configuration

- **App Name:** MOOD FOOD
- **Bundle Identifier:** in.moodfood.app
- **Version:** 1.0.0
- **Build:** 1
- **Backend URL:** https://moodfood.in
- **Minimum iOS:** 13.0
- **Devices:** iPhone only
- **Orientation:** Portrait

## Setup Instructions

1. **Open in Xcode:**
   ```
   open MoodFood.xcodeproj
   ```

2. **Add App Icons:**
   - Open `Assets.xcassets/AppIcon.appiconset`
   - Add your app icon images in required sizes:
     - 40x40 (20pt @2x)
     - 60x60 (20pt @3x)
     - 58x58 (29pt @2x)
     - 87x87 (29pt @3x)
     - 80x80 (40pt @2x)
     - 120x120 (40pt @3x, 60pt @2x)
     - 180x180 (60pt @3x)
     - 1024x1024 (App Store)

3. **Configure Signing:**
   - Select the MoodFood target
   - Go to "Signing & Capabilities"
   - Select your Team
   - Xcode will automatically manage signing

4. **Build & Run:**
   - Select your device or simulator
   - Press Cmd+R to build and run

## Features

- WKWebView loading https://moodfood.in
- Camera access for fridge scanner & recipe import
- Photo library access
- Microphone for voice commands
- Safe area handling
- Light status bar on green header
- Back swipe navigation
- JavaScript alerts/confirms handled
- Loading indicator

## Permissions Required

- **Camera:** For fridge scanner and recipe photo import
- **Photo Library:** For importing recipes from photos
- **Microphone:** For hands-free cooking voice commands
- **Speech Recognition:** For voice control

## Building for App Store

1. Select "Any iOS Device" as build target
2. Product → Archive
3. In Organizer, click "Distribute App"
4. Select "App Store Connect"
5. Follow the upload process

## File Structure

```
MoodFood/
├── MoodFood.xcodeproj/
│   └── project.pbxproj
└── MoodFood/
    ├── AppDelegate.swift
    ├── SceneDelegate.swift
    ├── MainViewController.swift
    ├── Info.plist
    ├── Assets.xcassets/
    │   └── AppIcon.appiconset/
    └── Base.lproj/
        └── LaunchScreen.storyboard
```

## Customization

To change the backend URL, edit `MainViewController.swift`:
```swift
private let backendURL = "https://moodfood.in"
```

To change the primary color:
```swift
private let primaryColor = UIColor(red: 74/255, green: 124/255, blue: 89/255, alpha: 1.0)
```
