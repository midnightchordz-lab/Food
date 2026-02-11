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

### 2. Freemium Usage Limit System (IMPLEMENTED - Feb 11, 2026)
**This is the primary business logic system that enforces subscription tiers.**

#### Backend Implementation
- **Service**: `/app/backend/services/usage_limit_service.py`
- **Routes**: `/app/backend/routes/usage.py`

#### Limits
- **Free Tier**: 5 recipes/day, 3 meal plans/week
- **Premium/Chef Pro**: Unlimited (-1)

### 3. ElevenLabs Voice Cooking Guide (IMPLEMENTED - Feb 11, 2026)
**Text-to-Speech feature for recipe narration in 14+ languages.**

#### Backend Implementation
- **Text Prep Service**: `/app/backend/services/recipe_text_prep_service.py`
  - Converts recipe data to speakable text
  - Handles multilingual formatting
  - Writes out numbers as words for better TTS
  
- **ElevenLabs Service**: `/app/backend/services/elevenlabs_service.py`
  - Integrates with ElevenLabs API
  - Supports 14+ languages
  - Uses caching to avoid re-generating audio
  - Standard model for full recipes, Flash model for real-time steps

- **Audio Routes**: `/app/backend/routes/audio.py`
  - `GET /api/audio/languages` - List supported languages
  - `POST /api/audio/recipe/:id` - Generate full recipe narration
  - `POST /api/audio/step` - Generate single step audio
  - `DELETE /api/audio/cache/:recipeId` - Clear cached audio

#### Frontend Components
- **RecipeVoicePlayer.jsx**: Full recipe voice player with language selector
- **CookingModePlayer.jsx**: Step-by-step cooking mode with auto-advance

#### Feature Gating
| Feature | Free User | Premium User |
|---------|-----------|-------------|
| English narration | ✅ | ✅ |
| 14+ languages (Hindi, Spanish, etc.) | 🔒 | ✅ |
| Step-by-step cooking mode | ✅ (English) | ✅ (All) |

#### IMPORTANT: ElevenLabs API Key Status
The ElevenLabs Free Tier has been disabled for the current API key due to "unusual activity" detection. 
**To enable voice features, the user needs to:**
1. Upgrade to ElevenLabs paid plan ($5/month Starter, $22/month Creator)
2. Or generate a new API key

#### Cost Calculation
- Average recipe = ~1,500 characters
- Creator plan ($22/month) = 200,000 chars = ~133 unique recipes
- With caching, same recipe can be played unlimited times at no extra cost

### 4. Feature Gating
- Diabetes Module: Premium only
- Fridge Scanner: Premium only
- Recipe Import: Premium only
- Basic Chat: All users
- Voice (English): All users
- Voice (Multilingual): Premium only

### 5. Other Features
- Recipe library with save/favorite functionality
- Weekly meal planner
- Shopping list generation
- Cuisine exploration
- Recipe import from URLs

## Tech Stack
- **Frontend**: React, TailwindCSS, Shadcn/UI, Capacitor (mobile)
- **Backend**: FastAPI (Python), MongoDB
- **AI**: OpenAI GPT-4o via Emergent LLM Key
- **Images**: SerpAPI for recipe images
- **TTS**: ElevenLabs API (requires paid subscription)

## Database Schema

### user_usage Collection
```javascript
{
  user_id: string,
  recipes_viewed_today: number,
  recipes_last_reset_date: string (YYYY-MM-DD),
  meal_plans_created_this_week: number,
  meal_plans_last_reset_date: string (YYYY-MM-DD),
  updated_at: datetime
}
```

## API Endpoints

### Audio/TTS System
- `GET /api/audio/languages` - Get supported languages (public)
- `POST /api/audio/recipe/:id` - Generate recipe narration (auth required)
- `POST /api/audio/step` - Generate step audio (auth required)
- `DELETE /api/audio/cache/:recipeId` - Clear cache (auth required)

### Usage System
- `GET /api/usage/status` - Get usage status (auth required)
- `GET /api/usage/check/recipes` - Check recipe quota (auth required)

## Test Credentials
- Email: lloydmasih1976@gmail.com
- Password: Milokiko*25
- Tier: Chef Pro (Admin-granted full access)

## Recent Changes (Feb 11, 2026)

### ElevenLabs Voice Integration
1. Created backend services for text preparation and ElevenLabs API
2. Added audio routes with proper feature gating
3. Built RecipeVoicePlayer component with language selector
4. Built CookingModePlayer for step-by-step cooking
5. Integrated voice player into SavedRecipes page
6. Added audio file caching for cost optimization

### Status
- ✅ Backend services implemented
- ✅ Frontend components implemented
- ⚠️ ElevenLabs API requires paid subscription (Free tier disabled)

## Backlog

### P0 - Immediate
- Get ElevenLabs paid API key for voice features

### P1 - Next Priority
- Case-insensitive user search bug fix

### P2 - Future
- Mobile improvements (offline mode, push notifications)
- Stripe payment integration for actual subscriptions
- Email notifications for usage warnings

## Environment Variables

### Backend (.env)
```
ELEVENLABS_API_KEY=<your_paid_api_key>
AUDIO_CACHE_DIR=/app/uploads/audio-cache
AUDIO_CACHE_HOURS=168
```

## Files of Reference
- Backend Text Prep: `/app/backend/services/recipe_text_prep_service.py`
- Backend ElevenLabs: `/app/backend/services/elevenlabs_service.py`
- Backend Audio Routes: `/app/backend/routes/audio.py`
- Frontend Voice Player: `/app/frontend/src/components/RecipeVoicePlayer.jsx`
- Frontend Cooking Mode: `/app/frontend/src/components/CookingModePlayer.jsx`
- SavedRecipes Page: `/app/frontend/src/pages/SavedRecipes.js`
