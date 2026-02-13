# MoodFood - Mood-Based Meal Planning App

## Overview
MoodFood is a compassionate AI chef that understands your mood and suggests meals that heal, comfort, and energize. The app uses mood-based recipe generation to help users discover delicious meals that match their feelings.

## Core Features

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
