# MoodFood - Mood-Based Meal Planning App

## Overview
MoodFood is a compassionate AI chef that understands your mood and suggests meals that heal, comfort, and energize. The app uses mood-based recipe generation to help users discover delicious meals that match their feelings.

## Core Features

### 0. Subscription Feature Gating ✅ FULLY FIXED (Feb 13, 2026)
**Fixed critical bug where Chef Pro users saw "Feature Locked" modal.**

**Root Cause (Original):**
- Frontend `SubscriptionProvider` wasn't properly propagating subscription changes
- Scattered `refreshSubscription()` calls in individual components (not centralized)
- `useFeatureAccess` hook used a one-time check that didn't react to updates
- No event system to notify all components when subscription changed

**Comprehensive Fix (v2):**
1. **Centralized State Architecture:** `SubscriptionProvider` is now the SINGLE SOURCE OF TRUTH
2. **Version-based Updates:** Added `version` counter that increments on refresh, forcing all `useFeatureAccess` hooks to re-evaluate
3. **Event-driven Propagation:** Added `subscription-updated` custom event for cross-component notification
4. **Global Refresh Trigger:** Components can dispatch `trigger-subscription-refresh` event to force refresh
5. **Complete Feature Mapping:** All features now properly mapped in `useFeatureAccess`:
   - `fridge_scanner` → `ai_photo_recognition_enabled`
   - `ai_image_generation` → `ai_image_generation_enabled`
   - `meal_planner_extended` → `meal_planner_weeks > 1`
   - `advanced_filters` → `advanced_filters`
   - And all other features
6. **Removed Scattered Refresh Calls:** Removed manual `refreshSubscription()` from `FridgeScannerPage` - now relies on global state

**Files Changed:**
- `frontend/src/components/FeatureGate.jsx` - Complete refactor: version counter, event system, comprehensive feature mapping
- `frontend/src/pages/CheckoutSuccessPage.js` - Uses `refreshSubscription()` from context, updates global state
- `frontend/src/pages/FridgeScannerPage.js` - Removed manual refresh, relies on global state

**Test Status:** ✅ VERIFIED (11/11 backend tests + E2E frontend test passed)

#### Mobile Entitlement Sync Fix ✅ NEW (Feb 13, 2026)
**Created unified `isUserPremium()` helper for consistent premium detection across web and mobile.**

**Problem Solved:**
- Mobile users with active premium subscriptions saw features as locked
- Multiple scattered premium checks using different patterns (`subscriptionTier`, `plan_id`, etc.)
- Inconsistent premium detection between web and Capacitor mobile builds

**Solution - Unified Helper Function:**
Created `/app/frontend/src/utils/auth.js` with `isUserPremium(user)` function that checks ALL possible subscription data structures:
- `user.subscriptionTier !== 'free'`
- `user.plan_id !== 'free'`
- `user.subscription?.plan_id !== 'free'`
- `user.plan !== 'free'`
- `user.subscription?.status === 'active' && plan_id !== 'free'`

**Files Changed:**
- `frontend/src/utils/auth.js` - NEW: Unified premium helper function
- `frontend/src/components/RecipeVoicePlayer.jsx` - Uses `isUserPremium(user)` (line 48)
- `frontend/src/components/CookingModePlayer.jsx` - Uses `isUserPremium(user)` (line 29)

**Test Status:** ✅ VERIFIED (iteration_76.json - 100% frontend tests passed)
- Premium user access to Fridge Scanner: PASS
- Free user correctly gated with Feature Locked modal: PASS
- Subscription context loading: PASS
- Premium badge shows for premium users: PASS

#### Production Entitlement Hotfix ✅ NEW (Feb 13, 2026)
**Added robust entitlement refresh for mobile apps.**

**Problem Solved:**
- Mobile app was not refreshing subscription on load, causing UI to fall back to free state
- Paid users saw locked features despite active subscriptions
- Inconsistent behavior between web and mobile

**Solution - Minimal Isolated Changes:**
1. **Force refresh on app start:** `loadSubscription(true)` on mount instead of lazy load
2. **Offline caching:** `localStorage.cached_subscription` stores last known valid entitlement
3. **App foreground resume:** `app-foreground-resume` event triggers subscription refresh
4. **Auth-triggered refresh:** All auth methods (login, register, loginWithToken) dispatch `trigger-subscription-refresh`

**Files Changed:**
- `frontend/src/components/FeatureGate.jsx` - Added forceRefresh on mount, localStorage caching, foreground listener
- `frontend/src/context/AuthContext.js` - Added subscription refresh trigger after all auth methods
- `frontend/src/capacitor.js` - Added `app-foreground-resume` event dispatch on active state

**Safety Constraints Met:**
- ✅ Free users remain restricted
- ✅ Paid tiers only access allowed features
- ✅ No hardcoded premium flags
- ✅ Works offline using cached entitlement
- ✅ No UI changes, no pricing changes, no business logic changes

**Test Status:** ✅ VERIFIED (iteration_77.json - 100% all verification points passed)

#### Production Hotfix: Incorrect Default Plan Assignment ✅ NEW (Feb 14, 2026)
**Fixed critical bug where new users were incorrectly assigned Chef Pro Annual instead of Free plan.**

**Root Cause:**
- `/api/subscription/create` endpoint created paid subscriptions without payment verification
- No validation of subscription source before granting premium access
- Missing guard to distinguish between demo/test subscriptions and real payments

**Solution - Minimal Production-Safe Fix:**
1. **Source Tracking:** Added `source` field to subscription creation:
   - `source: "demo"` - Test subscriptions via `/create` endpoint
   - `source: "payment"` - Real payments via Razorpay
   - Valid sources: `payment`, `trial`, `admin`, `razorpay`, `stripe`

2. **Entitlement Guard in `get_user_subscription()`:**
   - Validates subscription has valid source OR `razorpay_order_id`
   - Invalid subscriptions return FREE plan with warning
   - Logs suspicious subscriptions for audit trail

3. **Admin Endpoints for Correction:**
   - `GET /api/subscription/admin/subscription-integrity-check` - Reports integrity status
   - `POST /api/subscription/admin/fix-invalid-subscriptions` - Corrects invalid subs in last 24h

**Files Changed:**
- `backend/routes/subscription.py` - Lines 26-65: Entitlement guard in `get_user_subscription()`
- `backend/routes/subscription.py` - Lines 437-528: `/create` endpoint marks `source: "demo"`
- `backend/routes/subscription.py` - Lines 1362-1480: Admin fix and integrity endpoints

**Safety Constraints Met:**
- ✅ Free users remain restricted
- ✅ Real paid users (with Razorpay payment) NOT affected
- ✅ No hardcoded premium flags
- ✅ No UI changes, no pricing changes, no business logic changes
- ✅ Zero impact on existing valid paid users

**Test Status:** ✅ VERIFIED (iteration_78.json - 100% backend tests passed)

#### Production Entitlement Guard - PERMANENT SAFE FIX ✅ (Feb 14, 2026)
**FINAL STABLE MODEL: Default = FREE, Upgrade = Payment/Trial only, Resolver = Validator**

**CORE BUG SOLVED:**
Previous implementation auto-upgraded users and had fallback logic that assigned premium without payment.

**USER CREATION DEFAULTS (HARD-SET):**
```python
# On EVERY new user registration:
default_plan = "free"           # ALWAYS "free"
subscription_status = "inactive" # ALWAYS "inactive"
trial_active = False            # ALWAYS False
entitlement_tier = "free"       # ALWAYS "free"
# Values NEVER null or undefined
```

**ENTITLEMENT RESOLVER RULES:**
```
Resolver may ONLY:
  - Confirm premium (valid payment/trial exists)
  - Restore premium (payment found in source of truth)
  - Downgrade expired premium (trial expired, no payment)

Resolver must NOT:
  - Upgrade free users to premium
  - Auto-assign premium as fallback

Safety Check (runs before ANY premium return):
  if (!payment_exists && !trial_active) return FREE
```

**UPGRADE TRIGGERS (ONLY VALID SOURCES):**
- Successful payment webhook (razorpay, stripe)
- Explicit trial activation from valid source
- Admin override

**REMOVED FALLBACK LOGIC:**
```
REMOVED: "if plan null → CHEF_PRO"
REMOVED: "if user has no tier → assign highest"
REMOVED: "if entitlement undefined → premium"
REPLACED WITH: "if undefined → FREE"
```

**DEMO SUBSCRIPTIONS:**
- Source marked as "demo" (invalid for premium)
- NO trial period granted
- Immediately blocked by safety check

**Files Changed:**
- `backend/services/entitlement_guard.py` - enforce_free_default(), safety_check_before_premium()
- `backend/routes/auth.py` - Hard defaults on register (email + phone)
- `backend/routes/subscription.py` - Demo endpoint no longer creates trials
- `backend/tests/test_entitlement_scenarios.py` - 14 scenario tests

**Test Results (14/14 Passed):**
1. ✅ New signup → FREE
2. ✅ Free plan always valid
3. ✅ Payment markers → Premium valid
4. ✅ Order ID only → Premium valid
5. ✅ Valid source → Premium valid
6. ✅ Grace period protection
7. ✅ Outside grace → Needs verification
8. ✅ Demo without payment → Invalid
9. ✅ Expired trial → FREE
10. ✅ Active trial (valid source) → Premium
11. ✅ Demo trial → BLOCKED
12. ✅ Grace period = 10 min
13. ✅ Min account age = 5 min
14. ✅ Edge of grace period

**SUCCESS CONDITIONS MET:**
✔ New users → always FREE
✔ Paid users → retain tier (never incorrectly downgraded)
✔ No auto premium assignment
✔ No regression to downgrade paid users
✔ Production safe - DEPLOYED

#### Subscription Audit Log System ✅ NEW (Feb 14, 2026)
**Simple audit log for tracking all subscription plan changes.**

**Purpose:**
- Track all subscription plan changes (upgrades, downgrades, cancellations)
- Provide visibility into why and when user plans changed
- Reduce future debugging time from hours to minutes
- Create permanent, append-only audit trail for compliance

**Audit Log Entry Fields:**
```json
{
  "id": "uuid",
  "user_id": "user_id",
  "old_plan": "free",
  "new_plan": "premium_monthly",
  "reason": "payment_verified",
  "timestamp": "ISO 8601 timestamp",
  "metadata": {
    "subscription_id": "sub_123",
    "payment_id": "pay_456",
    "payment_provider": "razorpay"
  }
}
```

**Tracked Events (reason field):**
| Reason | When Logged |
|--------|-------------|
| `payment_verified` | User upgrades via Razorpay payment verification |
| `webhook_payment_captured` | Payment captured via webhook |
| `user_canceled_immediately` | User cancels subscription immediately |
| `user_scheduled_cancellation` | User schedules cancellation for period end |
| `admin_bulk_restoration` | Admin restores falsely downgraded user |
| `admin_bulk_correction` | Admin corrects invalid subscription |

**API Endpoints:**
- `GET /api/subscription/admin/audit-logs?user_id=&limit=100` - Get all audit logs (optionally filter by user)
- `GET /api/subscription/admin/audit-logs/user/{user_id}` - Get plan change history for specific user

**Files Changed:**
- `backend/services/entitlement_guard.py` - Added `log_plan_change()` and `get_plan_change_history()` functions
- `backend/routes/subscription.py` - Added audit logging to payment verification, webhooks, cancellation, and admin endpoints
- `backend/tests/test_audit_log.py` - 8 test cases for audit log functionality

**Test Status:** ✅ VERIFIED (8/8 tests passed)

#### Hands-Free Cooking Phase-1 Stabilization ✅ NEW (Feb 14, 2026)
**Stabilized Hands-Free Cooking with Basic Voice Only - Camera/Gesture Systems DORMANT**

**PHASE-1 MODE ACTIVE FEATURES:**
- ✓ Voice Narration (TTS) - Read current step, stop on pause, resume on play
- ✓ Voice Commands - Limited set: "next step", "previous step", "repeat", "pause", "resume"
- ✓ Large On-Screen Controls - Play/Pause, Next, Previous, Repeat buttons
- ✓ Tap step card to repeat narration
- ✓ Works without camera permission
- ✓ Works without microphone permission (narration still works)
- ✓ Falls back to touch controls automatically

**DORMANT FEATURES (code intact, not executed):**
- ○ Camera Preview - Behind feature gate, no permission popup
- ○ Hand Gesture Detection - Code exists, not attached
- ○ AI Observer - Code exists, not running
- ○ Motion Tracking - Code exists, not initialized

**Feature Gate Location:**
`/app/frontend/src/config/handsFreeConfig.js`
```javascript
export const PHASE_1_MODE = true;  // Set to false to enable all features
export const ENABLE_CAMERA_PREVIEW = !PHASE_1_MODE;
export const ENABLE_GESTURE_DETECTION = !PHASE_1_MODE;
export const ENABLE_AI_OBSERVER = !PHASE_1_MODE;
```

**Modules Wrapped with Feature Gate:**
| Module | File | Gate Check |
|--------|------|------------|
| Camera Stream | LiveCookingModal.jsx | `!PHASE_1_MODE && showCamera` |
| Gesture Control | useGestureControl.js | `!PHASE_1_MODE && enabled` |
| AI Observer | useAIObserver.js | `!PHASE_1_MODE && enabled` |
| Engine Orchestrator | useEngineOrchestrator.js | `!PHASE_1_MODE && enabled` |
| Permission Requests | LiveCookingModal.jsx | Camera permissions skipped in Phase-1 |

**Files Changed:**
- `frontend/src/config/handsFreeConfig.js` - NEW: Central feature gate configuration
- `frontend/src/components/live-cooking/LiveCookingModal.jsx` - Modified: Feature-gated all camera/gesture code
- `frontend/src/hooks/useGestureControl.js` - Code intact (dormant)
- `frontend/src/hooks/useAIObserver.js` - Code intact (dormant)
- `frontend/src/hooks/useEngineOrchestrator.js` - Code intact (dormant)

**SUCCESS CONDITIONS MET:**
✔ Hands-Free Mode stable on Web + Mobile
✔ Voice narration synchronized with steps
✔ No camera permission popup
✔ No gesture interference
✔ No entitlement regressions
✔ AI/gesture code present but inactive
✔ Zero business logic changes

#### Phase-1 Voice Command Reliability ✅ NEW (Feb 14, 2026)
**Improved voice command reliability for Hands-Free Cooking Phase-1 mode**

**RELIABILITY IMPROVEMENTS IMPLEMENTED:**

1. **Strict Vocabulary Filter**
   - Only exact phrases trigger actions: "next", "back", "repeat", "pause", "resume"
   - Ignores partial matches and random speech
   - Prevents accidental triggers from background noise

2. **Continuous Listening Loop**
   - Auto-restarts speech recognition via `onend` event
   - `shouldBeListening` flag controls intent
   - Recoverable errors (network, no-speech) trigger automatic retry

3. **Command Confirmation Delay**
   - 400ms delay before executing action
   - Prevents rapid double-triggers
   - 800ms cooldown between commands

4. **TTS/Mic Mutual Exclusion**
   - `stopSpeech()` called before starting recognition
   - `pauseVoiceControl()` and `resumeVoiceControl()` for TTS playback
   - Prevents audio feedback loop

5. **Visual Feedback States**
   - Pulsing green dot when listening
   - Status indicator shows "Listening..." with mic icon
   - Yellow flash on command received
   - Status text shows available commands

**Technical Implementation:**
| Feature | Location | Implementation |
|---------|----------|----------------|
| Strict Vocabulary | browserSpeech.js:19-25 | `STRICT_COMMANDS` object with exact phrases |
| Continuous Loop | browserSpeech.js:223-247 | `shouldBeListening` + `onend` handler |
| Confirmation Delay | browserSpeech.js:137 | `COMMAND_CONFIRMATION_DELAY_MS = 400` |
| Mutual Exclusion | browserSpeech.js:153 | `stopSpeech()` before `recognition.start()` |
| Visual Callbacks | browserSpeech.js:54-62 | `setVisualCallbacks()` function |

**Files Changed:**
- `frontend/src/lib/browserSpeech.js` - Added strict vocabulary, continuous loop, confirmation delay, visual callbacks
- `frontend/src/components/live-cooking/LiveCookingModal.jsx` - Added visual feedback states, voice control setup for Phase-1

**Test Status:** ✅ VERIFIED (iteration_80.json - 100% frontend tests passed)
- Live Cooking Modal opens: PASS
- Voice button toggle: PASS
- Visual listening indicator: PASS
- All control buttons work: PASS
- Step navigation: PASS
- Browser speech fallback: PASS

#### Voice Commands Tutorial Overlay ✅ NEW (Feb 14, 2026)
**First-time user tutorial showing available voice commands**

**Features:**
- Shows automatically on first voice enable (localStorage persisted)
- Displays all 5 voice commands with icons: "Next", "Back", "Repeat", "Pause", "Resume"
- Helpful tip about speaking clearly
- Glassmorphic design matching the Live Cooking modal aesthetic
- Dismissible with "Got it, let's cook!" button
- Toast notification shown after dismissal

**Implementation:**
- `showVoiceTutorial` state controls visibility
- `hasSeenTutorialKey` localStorage key persists preference
- Tutorial overlay with AnimatePresence for smooth animations
- `dismissVoiceTutorial` callback saves preference and shows confirmation toast

**Files Changed:**
- `frontend/src/components/live-cooking/LiveCookingModal.jsx` - Added tutorial overlay and dismiss logic

#### Step Countdown Timer ✅ NEW (Feb 14, 2026)
**Automatic countdown timer for recipe steps with duration values**

**Timer Activation:**
- Activates when step becomes active AND step.time exists
- Parses time strings: "5 minutes", "2-3 min", "30 seconds", "1 hour"
- For ranges like "2-3 min", uses higher value (3 minutes)

**Timer Display:**
- MM:SS format near step indicator
- Circular progress ring showing visual countdown
- Color transitions: white → orange (≤30s) → green (complete)
- "✓ Done" text when timer reaches zero

**Timer Stop Conditions:**
- Step change (Next/Prev) - timer cleared
- Pause cooking - timer paused
- User exits modal - timer cleared
- Timer reaches zero - completion triggered

**Timer Reset:**
- Repeat button click - timer restarts from initial value
- Navigate away and return - timer restarts

**Completion Enhancements:**
- Soft two-note chime (C5 + E5) using Web Audio API
- Voice cue "Step time complete" via browser speech
- Green glow animation on card border
- Auto-clears glow after 3 seconds

**Technical Implementation:**
| Feature | Location |
|---------|----------|
| parseTimeToSeconds() | lines 51-86 |
| formatTime() | lines 91-96 |
| Timer state | lines 313-317 |
| Timer logic effect | lines 516-568 |
| Completion handling | lines 571-625 |
| resetStepTimer() | lines 628-652 |
| Timer UI | lines 1683-1757 |
| Green glow | lines 1636-1654 |

**Files Changed:**
- `frontend/src/components/live-cooking/LiveCookingModal.jsx` - Added timer utilities, state, logic, and UI

**Test Status:** ✅ Code Review VERIFIED (iteration_81.json)
- parseTimeToSeconds function: IMPLEMENTED
- Timer state management: IMPLEMENTED
- Timer activation logic: IMPLEMENTED
- Timer stop conditions: IMPLEMENTED
- Timer reset on repeat: IMPLEMENTED
- Completion chime: IMPLEMENTED
- Voice cue: IMPLEMENTED
- Timer UI display: IMPLEMENTED
- Green glow on complete: IMPLEMENTED

#### TTS Speech Orchestration Fix ✅ UPDATED (Feb 14, 2026)
**Fixed Text-to-Speech cutting off mid-sentence in Hands-Free Cooking Mode**

**Root Cause:** Two issues:
1. Web Speech API (`window.speechSynthesis`) was tied to React component lifecycle - timer state changes caused re-renders that interrupted TTS
2. **Chrome Bug:** Browser kills `speechSynthesis` after ~15 seconds of perceived silence

**Final Solution - Global Singleton Controller + Chrome Workaround:**
Created `speechController.js` - a persistent speech engine that exists OUTSIDE React's component lifecycle, with a keep-alive timer to prevent Chrome's 15-second timeout.

**Architecture:**
```
speechController.js (Singleton)
├── speak(text, onComplete)     - Single speech lock + Chrome keep-alive
├── cancelSpeech()              - Explicit cancel only on user actions
├── isSpeaking()                - State check immune to re-renders
├── narrateStep()               - Step narration with context
├── startRecognition()          - Voice command listener
├── stopRecognition()           - Stop listening
└── setRecognitionCallbacks()   - Command handlers
```

**Key Design Principles:**
1. **Singleton Instance** - One controller for entire app
2. **Persistent State** - Speech state (`isSpeaking`, `currentUtterance`) lives outside React
3. **Speech Lock** - New `speak()` calls blocked if already speaking
4. **Chrome Keep-Alive** - `pause()/resume()` every 10 seconds prevents browser timeout
5. **MIC Exclusion** - Recognition only starts after TTS `onend` + 400ms delay
6. **Cancel Discipline** - `cancelSpeech()` ONLY called on user actions

**Chrome Workaround Implementation:**
```javascript
// In speak() onstart handler:
keepAliveTimer = setInterval(() => {
  if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
    window.speechSynthesis.pause();
    window.speechSynthesis.resume();
  }
}, 10000); // Every 10 seconds
```

**Files Changed:**
- `frontend/src/lib/speechController.js` - Global singleton TTS controller with Chrome workaround
- `frontend/src/components/live-cooking/LiveCookingModal.jsx` - Refactored to use global controller

**Note:** ElevenLabs quota is exhausted, so app falls back to browser speech (Web Speech API).

**Success Conditions:**
✔ Voice reads entire step without interruption
✔ Timer ticks every second without cutting off TTS
✔ Chrome keep-alive prevents 15-second timeout
✔ Mobile + Web stable

### 1. Mood-Based Recipe Generation
- Users select their current mood (Happy, Sad, Stressed, Tired, Cozy, Energetic, etc.)
- Select meal type (Breakfast, Lunch, Dinner)
- Choose dietary preference (Vegetarian, Vegan, Non-Vegetarian, Pescatarian, Any)
- Pick cuisine(s) from 20+ options
- AI generates 4 personalized recipes based on selections

### 2. Freemium Usage Limit System
**Business logic system that enforces subscription tiers.**

- **Free Tier**: 5 recipes/day, 3 meal plans/week
- **Premium/Chef Pro**: Unlimited

### 3. ElevenLabs Voice Cooking Guide ✅ WORKING
**Text-to-Speech feature for recipe narration in 14+ languages.**

#### Status: FULLY OPERATIONAL (Feb 11, 2026)
- ElevenLabs Starter plan active and working
- Tested and confirmed working for English and Hindi narration


#### Recipe Image Search Fix ✅ NEW (Dec 2025)
**Fixed incorrect/irrelevant recipe images (restaurant scenes instead of food close-ups)**

**Problem:**
- Recipe images for certain dishes (e.g., "Thai Garlic Butter Crab") were showing restaurant/dining scenes instead of actual food photos
- SerpAPI image search was returning images of outdoor patios, restaurant interiors, and table settings

**Solution:**
1. **Negative Keywords in Search Query** - Added exclusion terms to filter out irrelevant images:
   - `-restaurant -dining -patio -outdoor -table -setting -scene -people`
   - Added `close-up` to prioritize food photography
   
2. **Title-based Filtering** - Added logic to skip images with restaurant-related titles:
   - Skips: "restaurant", "dining", "patio", "outdoor", "table setting", "chef", "kitchen staff", "waiter", "menu", "ambiance", "interior", "exterior", "seating"

**File Changed:**
- `backend/services/serpapi_service.py` - Modified `search_food_images()` function (lines ~1027, ~1060-1070)

**Test Status:** ✅ VERIFIED
- "Thai Garlic Butter Crab" now returns crab dish images (not restaurant scenes)
- "Spicy Prawn Curry" returns curry recipe photos

### UI Bug Fixes

#### Subscription Page Text Cut-Off Fix ✅ (Feb 14, 2026)
**Fixed layout issue where page header text was being clipped by fixed navigation.**

**Problem:**
- On the `/subscription` page, the text "Subscription Management" and "Manage your plan, billing, and usage" was getting cut off below the navigation tabs
- The fixed navigation bar (h-16/64px) was overlapping the page content

**Solution:**
- Added `pt-16 md:pt-20` (64px/80px top padding) to the main container in `SubscriptionManagementPage.js`
- This accounts for the fixed navigation height and ensures all content is visible

**File Changed:**
- `frontend/src/pages/SubscriptionManagementPage.js` - Line 209: Added `pt-16 md:pt-20` class

**Test Status:** ✅ VERIFIED via screenshot - text now fully visible

#### Permission Orchestration Layer ✅ NEW (Feb 13, 2026)
**Single initialization for camera + microphone + speech recognition.**

**Problem Solved:**
- Camera/voice/gesture controls were not working because permissions were requested on component mount (before user interaction)
- Mobile browsers and Capacitor apps require explicit user tap before requesting permissions

**Solution - `useHandsFreePermissions` Hook:**
1. **Centralized permission requests** - All permissions (camera, mic, speech) requested together
2. **User-initiated only** - Runs ONLY after user taps "Enable Hands-Free" button
3. **Platform support** - Works on web (https/localhost), iOS Capacitor, Android Capacitor
4. **Graceful failure** - Shows toast message if denied, no crashes

**Platform Configuration:**
| Platform | Config File | Permissions Added |
|----------|-------------|-------------------|
| Android | `AndroidManifest.xml` | CAMERA, RECORD_AUDIO, MODIFY_AUDIO_SETTINGS |
| iOS | `Info.plist` | NSCameraUsageDescription, NSMicrophoneUsageDescription, NSSpeechRecognitionUsageDescription |
| Web | N/A | Uses secure context check (HTTPS required) |

**Files Created/Modified:**
- `frontend/src/hooks/useHandsFreePermissions.js` - NEW: Permission orchestration hook
- `frontend/src/components/live-cooking/LiveCookingModal.jsx` - Uses new permission hook
- `frontend/android/app/src/main/AndroidManifest.xml` - Added permissions
- `frontend/ios/App/App/Info.plist` - Added usage descriptions

#### Hands-Free Step Control ✅ FIXED (Feb 13, 2026)
**True hands-free cooking with voice commands and gesture detection.**

**Voice Commands (Primary):**
| Command | Action | Min Confidence |
|---------|--------|----------------|
| "next step" / "next" / "forward" | Next Step | 70% |
| "previous step" / "back" | Previous Step | 70% |
| "repeat step" / "repeat" / "again" | Repeat Current | 70% |
| "pause" / "stop" | Pause Voice | 75% |
| "resume" / "play" / "continue" | Resume Voice | 75% |

**Gesture Controls (Secondary):**
| Gesture | Action |
|---------|--------|
| Swipe Right (in air) | Next Step |
| Swipe Left (in air) | Previous Step |

**Priority & Safety:**
- Voice commands take priority (2s gesture cooldown after voice)
- Command cooldown: 1.5s (prevents double triggers)
- Confidence scoring (low confidence = ignored)
- Only triggers existing button callbacks (no new logic)

**UI Controls (Header):**
- 🎤 **Voice** button (green when active) - `data-testid="live-cooking-handsfree-btn"`
- 👋 **Swipe** button (blue when active) - `data-testid="live-cooking-gesture-btn"`
- 📷 **Camera** button - `data-testid="live-cooking-camera-btn"`
- ✖️ **Close** button - `data-testid="live-cooking-close-btn"`

**Files:**
- `frontend/src/hooks/useHandsFreeControls.js` - Voice commands with confidence scoring
- `frontend/src/hooks/useGestureControl.js` - Camera-based swipe detection
- `frontend/src/hooks/useEngineOrchestrator.js` - **NEW** Phase-1 engine synchronization

#### Phase-1 Engine Orchestrator ✅ NEW (Feb 13, 2026)
**Synchronizes voice narration, voice commands, and gesture detection.**

**Purpose:**
- Stabilize all hands-free controls to work together in correct order
- NO changes to recipe logic, UI components, or navigation
- ONLY controls: microphone ownership, camera selection, AI detection timing, engine start/stop order

**Orchestration Sequence:**
1. **Camera Engine (Gestures)**
   - Request video-only stream (no audio conflict)
   - Force front camera for better gesture detection
   - Wait until `video.readyState === 4` before starting detection
   - Load hand-tracking model AFTER video ready
   - Silent failure: keeps recipe running if camera fails

2. **TTS Engine (Voice Narration)**
   - Stop any active speech recognition BEFORE speaking (MIC OWNERSHIP)
   - Cancel any previous TTS instance
   - Wait 150ms for clean audio cutover
   - Start narration only after mic released

3. **Voice Command Engine (MIC OWNERSHIP)**
   - Start recognition ONLY when TTS is fully stopped
   - Safe start: `cancelTTS() → wait 200ms → startSpeechRecognition()`
   - After command: `stopRecognition() → wait 150ms → resumeTTS`
   - Retry once after 1s if failed, then silently disable

4. **Gesture → Navigation Bridge**
   - Runs in separate loop (non-blocking)
   - Stable gesture confirmation: 500ms consistent direction
   - After navigation: `cancelTTS() → wait 150ms → speak new step`

**Timing Configuration:**
| Timing | Value | Purpose |
|--------|-------|---------|
| `TTS_CANCEL_WAIT` | 150ms | Wait after canceling TTS |
| `RECOGNITION_START_WAIT` | 200ms | Wait before starting recognition |
| `RECOGNITION_RESUME_WAIT` | 150ms | Wait before resuming TTS |
| `CAMERA_READY_CHECK` | 100ms | Interval for camera ready check |
| `CAMERA_TIMEOUT` | 10000ms | Max wait for camera |
| `RECOGNITION_RETRY_DELAY` | 1000ms | Retry after recognition failure |

**Safety Guards:**
- If any engine fails → disable only that engine, keep others running
- Never crash the app or close Step-by-Step mode
- Never reload page on failure
- Cooking flow remains unchanged

**Files:**
- `frontend/src/hooks/useEngineOrchestrator.js` - Phase-1 orchestration hook

#### Step Sync + Hands-Free Stability ✅ PERFECTED (Feb 13, 2026)
**Fixed voice sync, gesture instability, and wrong-step narration.**

**Single Authoritative Step State:**
- `stepChangeIdRef` creates unique ID per step change
- All in-flight narration requests are invalidated on step change
- UI display, voice narration, and gestures all read from same `currentStep`

**Instant Audio Cancellation:**
- On any step change: `audio.pause()` + `audio.currentTime = 0`
- `narrationAbortRef` marks pending narrations as aborted
- No queued or delayed speech from previous steps
- Also stops browser speech with `stopSpeaking()`

**Gesture Debounce & Confirmation:**
| Config | Value | Purpose |
|--------|-------|---------|
| `STABLE_DETECTION_MS` | 500ms | Must see consistent direction for 500ms |
| `GESTURE_COOLDOWN` | 1800ms | One step change per gesture |
| `VOICE_PRIORITY_COOLDOWN` | 2000ms | Voice commands take priority |
| `CONSECUTIVE_FRAMES_REQUIRED` | 3 | Need 3 consistent frames |

**Web Camera Tolerance:**
- Handles low FPS gracefully (skips frames if > 200ms apart)
- Never auto-advances step from unstable detection
- Motion analysis uses pixel brightness diff with configurable thresholds

**Voice Smooth Pacing:**
| Timing | Value | Purpose |
|--------|-------|---------|
| `WARM_START_DELAY` | 180ms | Pause before speaking (intentional feel) |
| `STEP_CHANGE_DELAY` | 150ms | Delay after step change (cinematic smooth) |
| `POST_NARRATION_WAIT` | 1400ms | Breathing space after narration |
| `FADE_IN_DURATION` | 0.3s | Smooth volume ramp (not abrupt) |

**FREE Browser Speech Fallback ✅ NEW:**
When ElevenLabs quota is exhausted or API fails, automatically falls back to browser's built-in SpeechSynthesis API:
- Zero cost (uses browser TTS)
- Works on Chrome, Safari, Firefox (web + mobile)
- Natural pacing: 0.95 rate, 1.0 pitch
- UI indicator shows "Free Voice" when fallback is active
- File: `frontend/src/lib/browserSpeech.js`

**Result:**
- Visible step and spoken step are ALWAYS identical
- No delayed or wrong narration
- Gestures feel intentional and stable on web
- Hands-free experience feels calm and premium
- Voice works even when ElevenLabs quota exhausted

#### Previous: Web Gesture Fix + Voice Sync (Feb 13, 2026)
**Fixed voice-to-step synchronization and improved voice naturalness.**

**Problem Solved:**
- Voice was out of sync (viewing Step 1, but hearing Step 2)
- Voice sounded robotic instead of calm and human-like

**Sync Fix Implementation:**
| Component | Change |
|-----------|--------|
| `LiveCookingModal.jsx` | Added `narrationAbortRef` to track abort state |
| `readCurrentStep()` | Pauses audio immediately before loading new step |
| Step change `useEffect` | Stops audio + calls `abortEmotionalNarration()` |
| `useEmotionalVoiceOrchestrator.js` | Non-queuing pattern prevents drift |

**Voice Quality Improvements (Backend):**
- `stability: 0.65` (higher = calmer, more consistent)
- `similarity_boost: 0.60` (moderate = natural variation)
- `style: 0.15` (slight warmth)
- Added `_add_natural_pauses()` for human-like pacing

**Behavior:**
- Step change → Audio stops immediately (no overlap)
- API call in progress + step changes → Audio skipped
- Emotional narration never queues → No drift
- Voice tone is warm, calm, conversational

#### Emotional Voice Orchestration ✅ NEW (Feb 13, 2026)
**Mood-adaptive emotional narration throughout the cooking journey.**

This is a pure TEXT ORCHESTRATION layer - no logic changes. It sequences emotional narration through the existing voice system.

**Emotional Narration Triggers:**
| Trigger | Event | Narration Type |
|---------|-------|----------------|
| Cooking Starts | User presses Play | Opening narration (mood-specific) |
| Step Begins | Step index changes | Step start guidance |
| Step Narration Ends | Audio 'ended' event | Gentle encouragement |
| Moving Forward | Next button pressed | Completion transition |
| Going Back | Prev button pressed | Reassurance |
| Repeat Requested | Repeat button | Reassurance |
| Recipe Completed | Final step reached | Reveal + Closing narration |

**Mood-Specific Text Library:**
- Happy, Calm, Stressed, Tired, Excited, Cozy, Romantic moods
- Random variation selection (no consecutive repeats)
- Silent fallback if text unavailable

**Files:**
- `frontend/src/lib/emotionalNarrationLibrary.js` - Text variations for all moods
- `frontend/src/hooks/useEmotionalVoiceOrchestrator.js` - Orchestration hook

**Protection Rules:**
- Does NOT change UI, logic, timers, or navigation
- Uses existing `/api/audio/step` endpoint only
- All narration is optional - missing text skips silently
- Fully backward compatible

#### Supported Languages (14+)
🇺🇸 English | 🇮🇳 Hindi | 🇪🇸 Spanish | 🇫🇷 French | 🇩🇪 German | 🇮🇹 Italian
🇯🇵 Japanese | 🇨🇳 Chinese | 🇸🇦 Arabic | 🇧🇷 Portuguese | 🇰🇷 Korean
🇹🇷 Turkish | 🇷🇺 Russian | 🇮🇩 Indonesian

#### Backend Services
- `recipe_text_prep_service.py` - Converts recipes to speakable text
- `elevenlabs_service.py` - ElevenLabs API with caching
- `routes/audio.py` - API endpoints

#### Frontend Components
- `RecipeVoicePlayer.jsx` - Main voice player with language selector
- `CookingModePlayer.jsx` - Step-by-step cooking mode

#### Integration Points
1. **SavedRecipes page** - Voice player in recipe dialog ✅
2. **RecipeDetailModal** - Used by chat recipes ✅
3. **DiabetesMealsPage** - Via RecipeMessageDisplay → RecipeDetailModal ✅

#### Mobile Support (iOS/Android via Capacitor)
- Haptic feedback on play/pause
- Haptic feedback on step navigation
- Platform-specific audio handling

#### Feature Gating
| Feature | Free User | Premium User |
|---------|-----------|-------------|
| English narration | ✅ | ✅ |
| 14+ languages | 🔒 | ✅ |
| Cooking mode (English) | ✅ | ✅ |
| Cooking mode (All languages) | 🔒 | ✅ |

#### API Endpoints
- `GET /api/audio/languages` - List supported languages (public)
- `POST /api/audio/recipe/:id` - Generate full recipe narration
- `POST /api/audio/step` - Generate single step audio
- `DELETE /api/audio/cache/:recipeId` - Clear cache

### 4. Smart Shopping Flow ✅ UPDATED (Feb 11, 2026)
**Regional grocery delivery integration with ingredient selection and multiple shopping lists.**

#### Features
- **Single "Buy Ingredients" Button**: Replaces old confusing dual-button UI
- **Ingredient Selection Sheet**: Bottom sheet where users can uncheck ingredients they already have
- **Regional Delivery Apps**: Auto-detects user's country and shows relevant delivery apps
- **Direct Deep Links**: Opens delivery app with ingredients pre-filled in search
- **Multiple Shopping Lists** ✅ NEW: Create, rename, delete, and clear multiple shopping lists
- **List Selector**: Choose which list to save ingredients to when using BuyIngredientsSheet
- **Price Comparison**: Shows estimated total price range before clicking through to delivery apps

#### Supported Regions & Apps
| Country | Delivery Apps |
|---------|---------------|
| 🇮🇳 India | Blinkit, Zepto, Swiggy Instamart, BigBasket, JioMart |
| 🇺🇸 USA | Instacart, Amazon Fresh, Walmart, Kroger, DoorDash |
| 🇬🇧 UK | Ocado, Tesco, Sainsbury's, Getir |
| 🇦🇪 UAE | Noon Daily, Carrefour, Talabat Mart |
| 🇦🇺 Australia | Woolworths, Coles |
| 🇸🇬 Singapore | RedMart, FairPrice |
| 🇨🇦 Canada | Instacart, Loblaws |

#### Shopping List API Endpoints
- `GET /api/shopping/lists` - Get all user's shopping lists
- `POST /api/shopping/lists` - Create a new shopping list
- `GET /api/shopping/lists/{id}` - Get specific list
- `PUT /api/shopping/lists/{id}` - Rename a list
- `DELETE /api/shopping/lists/{id}` - Delete a list
- `POST /api/shopping/lists/{id}/clear` - Clear all items from list
- `POST /api/shopping/lists/{id}/items` - Add items to list
- `DELETE /api/shopping/lists/{id}/items/{name}` - Remove item
- `PATCH /api/shopping/lists/{id}/items/toggle` - Toggle item checked state

#### Delivery App API Endpoints
- `GET /api/shopping/delivery-apps` - Get delivery apps for user's region
- `POST /api/shopping/build-url` - Build deep link with ingredients
- `POST /api/shopping/set-country` - Set preferred country
- `POST /api/shopping/price-estimate` - Get estimated prices via SerpAPI

#### Files
- `backend/config/delivery_apps.py` - Regional app configuration
- `backend/routes/shopping.py` - API endpoints (shopping lists + delivery)
- `frontend/src/pages/ShoppingListPage.js` - Multiple lists UI with sidebar
- `frontend/src/components/BuyIngredientsSheet.jsx` - Bottom sheet with list selector

### 5. Feature Gating
- Diabetes Module: Premium only
- Fridge Scanner: Premium only
- Recipe Import: Premium only
- Basic Chat: All users
- Voice (English): All users
- Voice (Multilingual): Premium only

### 6. Other Features
- Recipe library with save/favorite
- Weekly meal planner
- Shopping list generation
- Cuisine exploration
- Recipe import from URLs

## Tech Stack
- **Frontend**: React, TailwindCSS, Shadcn/UI, Capacitor (mobile)
- **Backend**: FastAPI (Python), MongoDB
- **AI**: OpenAI GPT-4o via Emergent LLM Key
- **Images**: SerpAPI for recipe images
- **TTS**: ElevenLabs API (Starter plan - $5/month)
- **Geo Detection**: IP-based via ipapi.co (free tier)

## Test Credentials
- Email: lloydmasih1976@gmail.com
- Password: Milokiko*25
- Tier: Chef Pro (Admin-granted full access)

- Email: shopper@test.com
- Password: shop123
- Tier: Free (for testing shopping flow)

## Environment Variables

### Backend (.env)
```
ELEVENLABS_API_KEY=sk_2c8aea57673adc0b66d447a3f1eb7b2e3ce8a80b056ea7d3
AUDIO_CACHE_DIR=/app/uploads/audio-cache
AUDIO_CACHE_HOURS=168
```

## Files of Reference

### Smart Shopping System (NEW)
- `/app/backend/config/delivery_apps.py` - Regional app configuration
- `/app/backend/routes/shopping.py` - Shopping API endpoints
- `/app/frontend/src/components/BuyIngredientsSheet.jsx` - Ingredient selection sheet
- `/app/frontend/src/components/RecipeDetailModal.js` - Updated with Buy Ingredients button

### Voice/Audio System
- `/app/backend/services/recipe_text_prep_service.py` - Text formatting
- `/app/backend/services/elevenlabs_service.py` - TTS API
- `/app/backend/routes/audio.py` - API routes
- `/app/frontend/src/components/RecipeVoicePlayer.jsx` - Voice player
- `/app/frontend/src/components/CookingModePlayer.jsx` - Cooking mode

### Usage Limit System
- `/app/backend/services/usage_limit_service.py`
- `/app/backend/routes/usage.py`
- `/app/frontend/src/hooks/useUsageLimit.js`
- `/app/frontend/src/components/UpgradeModal.jsx`
- `/app/frontend/src/components/UsageLimitBanner.jsx`

## Recent Changes (Feb 12, 2026)

### SavedRecipes Page - Unified Modal Design ✅ IMPLEMENTED (Feb 13, 2026)
Updated SavedRecipes page to use the new RecipeDetailModal component instead of the old inline dialog.

**Changes Made:**
- Replaced custom inline Dialog with RecipeDetailModal component
- Removed unused imports (RecipeRating, RecipeVoicePlayer, CookingModePlayer)
- Added intelligent data handling: recipes with existing instructions load instantly (no AI regeneration)
- Maps saved recipe data format to RecipeDetailModal expected format

**Performance Optimization:**
- Saved recipes with existing instructions now load INSTANTLY
- Only fetches AI-generated details if recipe doesn't have instructions
- Uses existing recipe images when available

**Result:**
- Unified look across Chat, Planner, and SavedRecipes pages
- Two-column layout on desktop, single column on mobile
- All features work: Cook button, Groceries, Save, Share, Print, Voice Guide

---

### RecipeDetailModal UI Redesign ✅ IMPLEMENTED (Feb 12, 2026)
Redesigned RecipeDetailModal with a clean two-column layout matching user's reference design.

**New Layout (Desktop 1024px+):**
- Left column: Title, meta info (servings, prep/cook time), action bar (Cook, Groceries, Save, Share, Print), description, voice player, instructions with step checkmarks, collapsible sections
- Right column: AI-generated recipe image, ingredients list with checkmarks and Add All button, equipment needed

**New Layout (Mobile):**
- Hero image at top with AI badge
- Single-column content flow
- Ingredients section appears below instructions

**Key Features Preserved:**
- AI image generation with loading state
- Voice Cooking Guide
- Step-by-step instructions with visual cues and important notes
- Ingredient checkmarks and Add to Cart
- Collapsible sections: Chef's Tips, Drink Pairings, Nutrition, Storage
- Star rating
- LiveCookingModal integration
- BuyIngredientsSheet
- IngredientInfoPopup

**Testing:**
- Code review: 100% verified (iteration_68.json)
- UI testing: Blocked by daily recipe limit (5/5 used)
- Components verified: Two-column layout, collapsible sections, action buttons, ingredients list

---

### Login Redirect Fix ✅ VERIFIED WORKING (Feb 12, 2026)
Fixed bug where login modal closed after successful authentication but didn't navigate to /chat page.

**Problem:**
- User successfully logs in (API returns token)
- Modal closes but user stays on landing page
- Had to click "Start Cooking" again to navigate

**Solution Applied:**
Modified `/app/frontend/src/components/AuthModal.js`:
1. Added `useNavigate` import from react-router-dom
2. Added `navigate('/chat')` after successful email login (line 91)
3. Added `navigate('/chat')` after successful registration (lines 132-133)
4. Added `navigate('/chat')` after successful phone login (lines 203-205)
5. Added `navigate('/chat')` after phone registration (line 243)

**Testing Verification (iteration_67.json):**
- ✅ After email login, user redirected to /chat
- ✅ After registration, user redirected to /chat
- ✅ All authentication flows now properly navigate

---

### Premium Features Not Unlocking After Upgrade ✅ FIXED (Feb 13, 2026)
Fixed critical bug where features remained locked after user upgraded from free to premium plan.

**Problem:**
- User upgrades via Razorpay payment
- Payment succeeds, subscription is created in database
- BUT features remain locked because frontend cache wasn't refreshed

**Root Cause:**
- `CheckoutSuccessPage.js` loaded subscription data but didn't call `refreshUsage()` or `refreshSubscription()`
- Global state in `useUsageLimit` and `SubscriptionContext` retained stale "free" tier data

**Solution:**
Updated `CheckoutSuccessPage.js` to refresh both usage limits and subscription state after payment:
```javascript
// After subscription is confirmed active
await refreshUsage();        // Updates useUsageLimit hook
refreshSubscription();       // Updates SubscriptionContext for FeatureGate
```

**Files Changed:**
- `frontend/src/pages/CheckoutSuccessPage.js` - Added refreshUsage and refreshSubscription calls

**Result:**
- After payment verification, features unlock immediately
- No page refresh required
- All premium components see the updated tier instantly

---

### Live Cooking Mode Bug Fixes ✅ VERIFIED WORKING (Feb 13, 2026)
Fixed 3 critical bugs in Live Cooking Mode:

**Bug 1: Voice Auto-Start (Regression)**
- **Problem:** Voice narration started automatically when Cook mode opened, without user pressing play button
- **Root Cause:** Previous agent added a `setTimeout` in useEffect that called `readCurrentStep()` on modal open
- **Solution:** Removed the auto-play timer. Voice now ONLY starts when user clicks the play button
- **File:** `LiveCookingModal.jsx` lines 190-203

**Bug 2: Camera Not Working**
- **Problem:** Camera didn't enable when Live Cooking mode started
- **Solution:** Camera was actually working but needed proper toggle. Added explicit hands-free toggle button for user control
- **File:** `LiveCookingModal.jsx` lines 539-560 (hands-free toggle button)

**Bug 3: Unreliable Voice Commands**
- **Problem:** Hands-free voice commands worked intermittently
- **Root Cause:** `handsFreeEnabled` was always `false` - never enabled
- **Solution:** Hands-free is now enabled when user first presses play, plus users can toggle it manually via the new Voice On/Off button
- **File:** `LiveCookingModal.jsx` line 222 - `setHandsFreeEnabled(true)` in play handler

**Testing Verification (iteration_69.json - 100% pass):**
- ✅ Voice does NOT auto-start when modal opens
- ✅ Camera toggle button present and functional
- ✅ Hands-free toggle button present (Voice On/Off)
- ✅ Play/Pause button works correctly
- ✅ Next/Prev step buttons work correctly

---

### Live Cooking Mode Crash Fix ✅ VERIFIED WORKING (Feb 12, 2026)
Fixed critical bug where clicking "Start Step-by-Step Cooking Mode" button crashed the app on mobile.

**Problem:**
- Clicking the button caused the app to shut down completely
- Root cause: Two Radix DialogPrimitive dialogs open simultaneously (RecipeDetailModal + LiveCookingModal)
- This caused a portal conflict that crashed React on mobile

**Solution Applied:**
1. Modified RecipeDetailModal.js (line 790-808):
```jsx
onClick={() => {
  onClose(); // Close RecipeDetailModal FIRST
  setTimeout(() => {
    openLiveCooking(aiImageUrl || recipe?.image, parsedRecipe?.instructions);
  }, 100); // Delay to ensure modal is closed
}}
```

2. Fixed LiveCookingModal.jsx (line 370):
- Added proper `onOpenChange` handler: `onOpenChange={(isOpen) => { if (!isOpen) closeModal(); }}`
- Removed `forceMount` flags that could cause issues
- Added proper overlay for accessibility

**Testing Verification (iteration_65.json - 100% pass):**
- ✅ Button click NO LONGER CRASHES the app
- ✅ RecipeDetailModal closes before LiveCookingModal opens
- ✅ Step text displays correctly: "Step 1 of 10 - 5 minutes - 'Marinate the fish...'"
- ✅ Navigation works (next/prev buttons)
- ✅ Close button works correctly

---

### Mobile Recipe Detail Modal Content Fix ✅ VERIFIED WORKING (Feb 12, 2026)
Fixed critical bug where recipe modal content was being truncated/clipped on mobile devices.

**Problem:**
- User-reported bug with screenshot showing:
  - Description text cut off mid-sentence
  - Timer display showing "-:- / -:-"
  - "Easy-Step Cooking Mode" button partially hidden/obscured
- Root cause: Radix DialogPrimitive uses `grid` display and `translate` positioning that conflicts with mobile full-screen scrolling

**Solution - Added `fullScreenMobile` prop to DialogContent:**
```jsx
// dialog.jsx - NEW fullScreenMobile mode
fullScreenMobile 
  ? "fixed inset-0 z-50 flex flex-col w-full h-full bg-background overflow-y-auto overflow-x-hidden sm:inset-auto sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:h-auto sm:max-h-[95vh] sm:max-w-4xl sm:rounded-lg sm:border sm:shadow-lg"
  : // default centered layout

// RecipeDetailModal.js - uses fullScreenMobile
<DialogContent fullScreenMobile={true} className="p-0 border-0">
```

**Key CSS Properties for Mobile:**
- `fixed inset-0` - Full viewport coverage (top/right/bottom/left = 0)
- `flex flex-col` - Vertical flex layout (replaces problematic `grid`)
- `w-full h-full` - 100% width and height
- `overflow-y-auto` - Enables vertical scrolling

**Testing Verification (iteration_64.json - 100% pass):**
- ✅ Modal width: 390px (full viewport)
- ✅ Modal height: 844px (full viewport)  
- ✅ Position: top=0, left=0, position=fixed
- ✅ Display: flex (not grid)
- ✅ Overflow: auto (scrollable)
- ✅ Description: "Chicken Biryani is a classic Indian dish..." - FULLY VISIBLE
- ✅ Timer: Shows "Total: 1 hour 30 minutes" - CORRECT
- ✅ "Start Cooking Mode" button at Y=522 - FULLY VISIBLE
- ✅ All 6 tabs accessible and working

**Files Modified:**
- `/app/frontend/src/components/ui/dialog.jsx` - Added fullScreenMobile prop
- `/app/frontend/src/components/RecipeDetailModal.js` - Uses fullScreenMobile={true}

---

### Futuristic Mood-Adaptive AI Live Cooking Interface ✅ NEW (Feb 12, 2026)
Complete UI transformation of Live Cooking to a cinematic, mood-aware experience.

**Visual Transformation:**
- Full-screen camera feed as background (replaces PiP)
- Floating glassmorphism step card at bottom
- Mood-adaptive color system (8 moods with unique themes)
- AI Observer indicator with state-based animations
- Whisper suggestion layer for future AI hints

**Mood Color Themes:**
- Happy → Yellow glow
- Sad → Blue glow  
- Angry → Red glow
- Excited → Pink glow
- Calm → Teal glow (default)
- Stressed → Orange glow
- Romantic → Rose glow
- Cozy → Amber glow

**UI Elements:**
- Glass card: Backdrop blur, rounded corners, mood-colored edge glow
- Progress bar: Top of card, animated with mood accent color
- Step dots: Mini indicators showing progress through recipe
- AI Ring: Top-left corner with pulse animation based on observer state
- Whisper area: Floating subtitle that appears on AI events

**Technical Details:**
- Mood stored in localStorage by ChatPage
- LiveCookingModal reads from store or localStorage fallback
- All existing cooking logic 100% preserved
- DialogTitle added for accessibility (screen readers)

**Testing Status:** 95% success (iteration_62.json)
- Full-screen camera background: ✅
- Floating glass step card: ✅
- Mood-based glow colors: ✅
- AI Observer indicator: ✅
- All controls working: ✅
- Voice narration unchanged: ✅
- No JavaScript errors: ✅

---

### AI Camera Preview & Observer Layer ✅ (Feb 12, 2026)
Added live camera preview and AI observer infrastructure to Live Cooking Modal.

**Camera Preview Features:**
- Camera now serves as full-screen background (upgraded from PiP)
- Camera toggle button in top bar
- Mirror effect for natural feel
- Fallback to recipe image/video when camera off
- Silent failure - doesn't affect cooking experience

**AI Observer Layer (Passive Infrastructure):**
- Motion detection using frame differencing
- Emits events: `motionDetected`, `motionStopped`, `possibleStepCompletion`
- Events update visual indicators ONLY - do NOT trigger cooking actions
- Observer state drives AI ring animation and whisper suggestions

**Technical Implementation:**
- `frontend/src/hooks/useCameraPreview.js` - Camera stream with getUserMedia
- `frontend/src/hooks/useAIObserver.js` - Passive vision analysis
- Uses Canvas API for lightweight frame processing
- Proper cleanup on unmount

**Protection Rules Met:**
- ✅ No changes to existing cooking logic
- ✅ No changes to voice narration or timers
- ✅ No backend APIs or cloud services
- ✅ Silent failure if camera unavailable

---

### Hands-Free Cooking Control ✅ (Feb 12, 2026)
Added hands-free control to Live Cooking Modal for convenience while cooking with messy hands.

**Voice Commands Supported:**
- "next" / "forward" → Move to next step
- "back" / "previous" → Move to previous step  
- "pause" / "stop" → Pause playback
- "play" / "start" / "resume" → Resume playback
- "repeat" / "again" → Replay current step narration

**Gesture Support:**
- Double clap → Move to next step

**Technical Implementation:**
- `frontend/src/hooks/useHandsFreeControls.js` - Custom hook with Web Speech API + Web Audio API
- Uses SpeechRecognition for voice commands (continuous listening)
- Uses AudioContext + frequency analysis for clap detection
- Silent failure if browser APIs unavailable
- Proper cleanup on unmount

**UI Indicator:**
- Subtle "Hands-free" badge with mic icon in top bar
- Non-intrusive, matches existing design

**Testing Status:** All tests passed (iteration_60.json)
- Voice commands initialized: ✅
- Existing controls no regressions: ✅
- Silent failure in unsupported browsers: ✅

---

### Live Cooking Modal with Voice Narration ✅ VERIFIED WORKING (Feb 12, 2026)
A premium cinematic full-screen cooking experience that guides users step-by-step through recipes with voice narration.

**Features Verified by Testing:**
- ✅ True full-screen modal with cinematic video/image background
- ✅ Voice narration starts when user clicks Play or Next (not auto-play)
- ✅ Voice narration triggers when navigating steps (Next/Prev)
- ✅ Step counter shows "Step X of Y" format
- ✅ Progress bar with animated gradient
- ✅ Play/Pause, Next, Prev buttons all functional
- ✅ Video/Audio synced with Play/Pause button
- ✅ Close button and ESC key work
- ✅ Uses Zustand global store for state management
- ✅ Hands-free voice commands and double-clap gesture

**Technical Implementation:**
- `frontend/src/components/live-cooking/LiveCookingModal.jsx` - Main modal component
- `frontend/src/stores/useLiveCooking.js` - Zustand store with openModal, nextStep, prevStep, togglePlay
- `frontend/src/hooks/useHandsFreeControls.js` - Voice commands and clap detection
- `backend/routes/audio.py` - `/api/audio/step` endpoint returns audio URLs

**Integration Point:**
- RecipeDetailModal.js line 771 - "Start Step-by-Step Cooking Mode" button calls `openLiveCooking()`

**Testing Status:** All tests passed (iteration_59.json, iteration_60.json)
- Modal opens: ✅
- Voice on user action: ✅
- Navigation works: ✅
- Audio API returns 200: ✅
- Hands-free controls: ✅

---

### Visual Ingredient Identification System ✅ NEW
Implemented a visual guide system that helps beginner cooks identify ingredients they don't recognize:

**Problem Solved:** Beginner cooks see "cumin seeds" in a recipe and don't know what they look like. They leave the app to Google, get confused by similar-looking spices, or buy the wrong ingredient.

**Solution:**
- ✅ Tap any ingredient name in recipe → see high-quality image + details popup
- ✅ Visual description (color, shape, size, texture)
- ✅ "Don't confuse with" warnings (e.g., curry powder vs turmeric)
- ✅ Similar ingredients comparison (cumin vs caraway vs fennel)
- ✅ Preparation tips and substitutes with ratios
- ✅ Storage info and shelf life
- ✅ Beginner-friendly notes

**Backend API Endpoints:**
- `GET /api/ingredients/name/{name}` - Get ingredient by name (handles normalized names)
- `GET /api/ingredients/search?q={query}` - Search ingredients
- `GET /api/ingredients/featured` - Get featured ingredients
- `GET /api/ingredients/category/{category}` - Get by category
- `GET /api/ingredients/categories` - Get all category counts

**Seeded Ingredients (14 common spices & pulses):**
- Cumin seeds, Mustard seeds, Coriander seeds, Cardamom pods
- Turmeric powder, Garam masala, Red chili powder
- Red lentils, Moong dal, Chana dal, Toor dal
- Bay leaves, Cinnamon sticks, Cloves

**Files Created:**
- `/app/backend/routes/ingredient_guide.py` - API routes
- `/app/backend/scripts/seed_ingredient_guide.py` - Seed data
- `/app/frontend/src/components/IngredientInfoPopup.jsx` - Popup component

**Testing:** 22/22 backend tests passed, frontend integration verified

---

### Order Now Delivery Options Fix ✅
Fixed bug where clicking "Order Now" in the Buy Ingredients sheet went directly to a single delivery app instead of showing user a list of delivery service options:

**Root Cause:** The "Order Now" button was calling `handleOrderNow(deliveryApps[0])` directly, bypassing user selection.

**Fix Applied (BuyIngredientsSheet.jsx):**
1. ✅ Added `showDeliveryOptions` state to control delivery app selector dialog
2. ✅ Created `handleOrderNowClick` function that opens a dialog with available delivery apps
3. ✅ Created `handleSelectDeliveryApp` function to handle user's app selection
4. ✅ Added "Choose Delivery Service" dialog showing region-specific delivery options
5. ✅ Dialog shows app logo, name, delivery time, and arrow for each option

**Verified by Testing Agent:**
- India region → BigBasket, Blinkit, Zepto, Swiggy Instamart, JioMart
- USA region → Instacart, Amazon Fresh, Walmart, Kroger, DoorDash
- UK region → Ocado, Tesco, Sainsbury's, Getir

**File:** `/app/frontend/src/components/BuyIngredientsSheet.jsx`

---

### Step-by-Step Instructions Fix ✅
Fixed bug where recipe instructions were not displaying in the RecipeDetailModal:

**Root Cause:** The frontend regex parser expected format `**Step 1** (10 minutes)` but the backend was returning format `**Step 1 (10 minutes)**` (time inside bold tags).

**Fix Applied (RecipeDetailModal.js line 131):**
- Updated regex to handle both formats: `**Step X** (time)` AND `**Step X (time)**`
- Added Audio Cue extraction alongside Visual Cue
- 10/10 backend tests passed verifying the fix

**File:** `/app/frontend/src/components/RecipeDetailModal.js`

---

### Buy Ingredients Sheet Redesign ✅
Completely redesigned the BuyIngredientsSheet component to match the clean "My Shopping Cart" design:

**New Features:**
1. ✅ **Categorized Ingredients** with emoji icons:
   - 🦐 SEAFOOD (salmon, fish, shrimp, prawn, etc.)
   - 🍗 MEAT & POULTRY (chicken, beef, pork, lamb)
   - 🥛 DAIRY & EGGS (milk, cheese, yogurt, butter, eggs)
   - 🥬 VEGETABLES (onion, tomato, garlic, spinach)
   - 🍎 FRUITS (apple, banana, mango, etc.)
   - 🍚 GRAINS & PASTA (rice, pasta, bread, flour)
   - 🌿 SPICES & HERBS (salt, pepper, cumin, basil)
   - 🫒 OILS & SAUCES (olive oil, soy sauce, vinegar)
   - 🥜 LEGUMES & NUTS (lentils, chickpeas, almonds)
   - 📦 OTHER (uncategorized items)
2. ✅ **Clean item cards** showing:
   - Ingredient name (without quantity)
   - "From: Recipe Name" subtitle
   - Circle checkbox (check = already have)
   - Plus (+) and Trash action buttons
3. ✅ **Footer actions:**
   - "X of Y items checked" counter with "Clear All"
   - Copy List button (copies to clipboard)
   - Download button (downloads .txt file)
   - "Save to Grocery List" button
   - "Order Now" green button

**File:** `/app/frontend/src/components/BuyIngredientsSheet.jsx` (663 lines)

---

## Recent Changes (Feb 11, 2026)

### Recipe Detail Modal Mobile Fix ✅ (Feb 11, 2026)
Fixed the issue where step-by-step cooking instructions didn't fit properly on mobile screens:
1. ✅ Text wrapping with `wordBreak: 'break-word'` and `overflowWrap: 'anywhere'`
2. ✅ Smaller step number circles on mobile (7x7 vs 10x10)
3. ✅ Horizontally scrollable tab bar with hidden scrollbar
4. ✅ Full-width action buttons (Print/Share/Save) on mobile
5. ✅ 2-column grid layout for recipe info (time, servings)
6. ✅ Compact visual cue boxes with smaller padding/text
7. ✅ Safe-area CSS support for iOS notch
8. ✅ PWA install prompt repositioned to avoid blocking UI

### Recipe Image Matching Fix ✅ (Feb 11, 2026 - Recurring Issue RESOLVED)
Fixed recurring issue where curry dishes (like "Spicy Prawn Curry") showed raw ingredient images instead of cooked dishes:

**Root Cause:** The SerpAPI image search was building incorrect queries like "prawns dish plated" (missing the dish type).

**Fix Applied (serpapi_service.py lines 936-1028):**
1. ✅ Changed protein detection to dictionary with singular/plural forms: `{'prawn': 'prawn', 'prawns': 'prawn', ...}`
2. ✅ Added comprehensive dish_type_priority dictionary: curry, biryani, korma, masala, stew, soup, etc.
3. ✅ Fixed search query building: now builds `"{protein} {dish_type} dish plated"` instead of `"{protein} dish plated"`
4. ✅ Example: "Spicy Prawn Curry" → search query: "prawn curry dish plated Indian recipe photo"

**Verification (13/13 tests passed):**
- "Spicy Prawn Curry" → Returns Kadai Prawns curry image from foodiesterminal.com ✅
- "Chicken Biryani" → Returns plated biryani dish ✅
- "Palak Paneer" → Returns palak paneer curry ✅
- Batch images → All unique images returned ✅

### Mobile App Parity Complete ✅
The app uses **Capacitor** hybrid framework - all web features are automatically available on iOS/Android. Enhancements made:
1. ✅ Safe-area CSS support for notched devices (iPhone X+)
2. ✅ Haptic feedback on item toggles and actions
3. ✅ Native Share integration (uses native share sheet on mobile)
4. ✅ Keyboard handling for better UX
5. ✅ Touch target optimization (44px minimum)
6. ✅ Codemagic CI/CD configured for builds

### Multiple Shopping Lists Feature ✅
1. ✅ Full CRUD API for shopping lists (33/33 tests passed)
2. ✅ Multiple lists per user (create, rename, delete, clear)
3. ✅ ShoppingListPage with sidebar navigation
4. ✅ BuyIngredientsSheet list selector integration
5. ✅ Copy/Download list functionality
6. ✅ Toggle checked items, categorized view

### Smart Shopping Flow Complete ✅
1. ✅ Backend APIs implemented (23/23 tests passed)
2. ✅ Regional delivery app configuration for 7 countries
3. ✅ BuyIngredientsSheet component with ingredient selection
4. ✅ MongoDB persistence for shopping lists
5. ✅ Deep links to delivery apps with search queries
6. ✅ IP-based country detection

### Voice Integration Complete
1. ✅ Backend services implemented and tested
2. ✅ Frontend components with mobile support
3. ✅ ElevenLabs Starter plan activated - API working
4. ✅ Haptic feedback for iOS/Android
5. ✅ 14+ language support
6. ✅ Audio caching for cost optimization

## Backlog

### P1 - Next Priority
- **Ingredient Encyclopedia Page** - Create `/pages/IngredientEncyclopedia.jsx` to browse/search all ingredients from the database
- **Ingredient Detail Page** - Create dynamic route `/ingredients/:id` for individual ingredient details

### P2 - Medium Priority
- Case-insensitive user search bug fix
- Add voice player to more recipe views (DiscoverRecipes if needed)

### P3 - Future
- Offline voice caching for mobile
- Push notifications
- Stripe payment integration

### Enhancement Ideas (User Requested Reminders)
- **Subscription Sync Indicator** - Add a visual indicator in the UI that shows when subscription features are being refreshed post-payment, to improve user confidence during the checkout → feature unlock flow. Could be a subtle toast or loading state on feature-gated buttons.
