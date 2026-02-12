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

### Order Now Delivery Options Fix ✅ NEW
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

### Recipe Detail Modal Mobile Fix ✅ NEW
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
- Case-insensitive user search bug fix
- Add voice player to more recipe views (DiscoverRecipes if needed)

### P2 - Future
- Offline voice caching for mobile
- Push notifications
- Stripe payment integration
