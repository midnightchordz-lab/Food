# Recipe Loader App - Product Requirements Document

## Original Problem Statement
A Capacitor-based hybrid cooking app with React frontend and FastAPI backend, featuring:
- Recipe generation with AI (OpenAI)
- Voice-controlled hands-free cooking mode
- Fridge scanner for ingredient detection
- Meal planning with dietary preferences
- Premium AI Chef feature
- **7-Day Trial System** for premium features (cross-platform)
- **Family Plan** with SMS/Push notifications

## User Personas
- Home cooks wanting recipe inspiration
- Users with dietary restrictions (diabetes, allergies)
- Mobile users needing hands-free cooking guidance
- Families wanting to coordinate meal planning

## Core Requirements
1. Recipe discovery and generation
2. Hands-free voice-controlled cooking
3. User authentication and preferences (Email + Phone OTP)
4. Subscription/entitlement system (free/premium)
5. **7-Day Trial System** (Web, iOS, Android compatible)
6. **Family Plan** with invite system and notifications

## Tech Stack
- **Frontend**: React + Capacitor 6 (hybrid mobile app)
- **Backend**: FastAPI + MongoDB
- **Voice**: Web Speech API + Capacitor plugins
- **AI**: OpenAI via emergentintegrations library
- **TTS**: ElevenLabs (premium), browser fallback
- **Notifications**: Twilio SMS, FCM Push

---

## Changelog

### 2026-02-21 - Phone Input Screen Fix ✅
- **COMPLETED**: Fixed critical Android phone input screen rendering bug
  - Replaced custom phone input with `react-phone-number-input` library
  - Fixed broken/orphaned JSX code in AuthModal.js
  - Added custom CSS for phone input styling (Android WebView compatible)
  - Updated versionCode to 15
- **MODIFIED FILES**:
  - `frontend/src/components/AuthModal.js` - Refactored phone auth with new library
  - `frontend/src/index.css` - Added phone input styling
  - `frontend/android/app/build.gradle` - Updated versionCode to 15
  - `frontend/package.json` - Added react-phone-number-input dependency

### 2026-02-20 - Capacitor 6 Migration & Android Stabilization
- **COMPLETED**: Upgraded entire Capacitor ecosystem from v5 to v6
  - Fixed Android 13+ compatibility issues
  - Configured signed AAB builds for Play Store
  - Managed multiple version code updates
- **MODIFIED FILES**:
  - `frontend/package.json` - All @capacitor/* packages to v6
  - `frontend/android/app/build.gradle` - Signing config, SDK versions
  - `codemagic.yaml` - AAB build configuration

### 2026-02-16 - WhatsApp Family Integration
- **COMPLETED**: Full WhatsApp integration for Family Plan users
  - WhatsApp notification service using Twilio API
  - Family account creation with invite codes
  - Recipe voting system for families

---

## P0 - Critical Issues
1. ✅ ~~Phone input screen broken on Android~~ (FIXED 2026-02-21)
2. 🔄 Verify 7-day trial flow on Android (blocked until login confirmed working)

## P1 - High Priority
1. iOS Push Notification Setup (GoogleService-Info.plist)
2. Full E2E Test of Family Invite Flow
3. Re-enable AI Chef feature
4. Android status bar issue

## P2 - Medium Priority
1. Implement Ingredient Encyclopedia Page
2. UI for ElevenLabs Quota
3. Ingredient Detail Page

## P3 - Future/Backlog
1. Production WhatsApp setup (Twilio Business API)
2. Chunk loading error on Subscription Page (user verification pending)

---

## Key Files Reference
- `/app/frontend/src/components/AuthModal.js` - Phone authentication UI
- `/app/frontend/android/app/build.gradle` - Android build config
- `/app/frontend/capacitor.config.json` - Capacitor configuration
- `/app/codemagic.yaml` - CI/CD build configuration
- `/app/backend/routes/auth.py` - Phone OTP endpoints

## 3rd Party Integrations
- **Capacitor v6**: Native mobile shell
- **OpenAI GPT**: AI features (Emergent LLM Key)
- **ElevenLabs**: Text-to-speech (User API Key)
- **SerpApi**: Image search (User API Key)
- **Twilio**: SMS notifications (User API Key)
- **FCM**: Push notifications (disabled during debug)
- **react-phone-number-input**: Phone number input library

## Environment Configuration
- Production Backend: `https://moodfood.in`
- Development Backend: `https://trial-bug-fix.emergent.host` (current Android build target)
- Preview URL: `https://moodfood-android.preview.emergentagent.com`
