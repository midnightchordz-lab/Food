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

### 4. Smart Shopping Flow ✅ NEW (Feb 11, 2026)
**Regional grocery delivery integration with ingredient selection.**

#### Features
- **Single "Buy Ingredients" Button**: Replaces old confusing dual-button UI
- **Ingredient Selection Sheet**: Bottom sheet where users can uncheck ingredients they already have
- **Regional Delivery Apps**: Auto-detects user's country and shows relevant delivery apps
- **Direct Deep Links**: Opens delivery app with ingredients pre-filled in search
- **Save to Shopping List**: Persist ingredients to MongoDB for later

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

#### API Endpoints
- `GET /api/shopping/delivery-apps` - Get delivery apps for user's region
- `POST /api/shopping/build-url` - Build deep link with ingredients
- `POST /api/shopping/list/add` - Save ingredients to shopping list
- `GET /api/shopping/list` - Get user's shopping list
- `POST /api/shopping/set-country` - Set preferred country

#### Files
- `backend/config/delivery_apps.py` - Regional app configuration
- `backend/routes/shopping.py` - API endpoints
- `frontend/src/components/BuyIngredientsSheet.jsx` - Bottom sheet UI

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

## Recent Changes (Feb 11, 2026)

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
