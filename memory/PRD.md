# MoodFood - Product Requirements Document

## Original Problem Statement
Build and maintain a full-stack meal planning and recipe application (MoodFood) with native mobile apps for both Android and iOS platforms, wrapping the web application at `https://moodfood.in`.

## Current Status
- **Web App**: Production-ready at `https://moodfood.in`
- **Android App**: Build configured (`versionCode: 33`), pointing to production URL
- **iOS App**: Xcode project complete with AppIcon set (ready for build)

## Core Features
1. AI-powered meal planning
2. Recipe management and import
3. Fridge scanner for ingredient detection
4. Family plan with notifications
5. Voice-enabled AI Chef
6. Ingredient encyclopedia

## Completed Tasks (December 2024)
- [x] iOS Xcode project skeleton created
- [x] iOS AppIcon set generated (9 sizes) - Feb 24, 2025
- [x] Android app icons updated with 4-character food icon - Feb 24, 2025
- [x] Android versionCode updated to 34 - Feb 24, 2025
- [x] Play Store assets generated (512x512 icon, 1024x500 feature graphic)
- [x] Android build configuration for production
- [x] Image upload fixes for Recipe Import & Fridge Scanner
- [x] Phone number input custom dropdown implementation

## In Progress
- [ ] Cuisine Preferences grid text overlap fix (needs dropdown→grid revert)

## Prioritized Backlog
### P1 - High Priority
- Verify phone number input on Android
- Full E2E test of Family Invite Flow
- Re-enable AI Chef feature

### P2 - Medium Priority  
- Implement Ingredient Encyclopedia Page
- ElevenLabs Quota UI notification
- Ingredient Detail Page

### P3 - Lower Priority
- Production WhatsApp Integration
- Android status bar app name issue

## Technical Architecture
```
/app
├── backend/          # FastAPI + MongoDB
├── frontend/         # React + Capacitor
│   ├── android/      # Android native wrapper
│   └── src/          # React components
├── ios/              # iOS Xcode project
│   └── MoodFood/     # Swift WebView wrapper
└── codemagic.yaml    # CI/CD configuration
```

## 3rd Party Integrations
- OpenAI GPT (via emergentintegrations)
- ElevenLabs TTS
- SerpApi (image search)
- Twilio SMS
- Firebase Cloud Messaging

## Known Issues
1. Android WebView rendering inconsistencies (flexbox/grid issues)
2. Cuisine Preferences currently shows dropdown instead of checkbox grid
