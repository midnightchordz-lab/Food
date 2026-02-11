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
  - `get_user_usage_status()` - Returns tier, used, limit, remaining, reset_at
  - `check_recipe_limit()` - Checks if user can generate more recipes
  - `increment_recipe_count()` - Increments after successful generation
  - `check_meal_plan_limit()` - Checks meal plan quota
  - `increment_meal_plan_count()` - Increments meal plan counter

- **Routes**: `/app/backend/routes/usage.py`
  - `GET /api/usage/status` - Returns full usage status
  - `GET /api/usage/check/recipes` - Quick recipe limit check
  - `GET /api/usage/check/meal-plans` - Quick meal plan limit check

#### Frontend Implementation
- **Service**: `/app/frontend/src/services/usageLimitService.js`
- **Hook**: `/app/frontend/src/hooks/useUsageLimit.js` - Provides global usage state
- **Provider**: `UsageLimitProvider` wraps the app in App.js
- **Components**:
  - `UsageLimitBanner.jsx` - Shows usage status at top of ChatPage
  - `UpgradeModal.jsx` - Appears when limit is reached

#### Limits
- **Free Tier**: 5 recipes/day, 3 meal plans/week
- **Premium/Chef Pro**: Unlimited (-1)

#### Key Technical Details
- Counter increments by NUMBER OF RECIPES generated (not requests)
- Daily reset at midnight UTC
- Weekly reset on Monday
- Stored in `user_usage` MongoDB collection
- Automatic date-based reset logic (no cron needed)

### 3. Feature Gating
- Diabetes Module: Premium only
- Fridge Scanner: Premium only
- Recipe Import: Premium only
- Basic Chat: All users

### 4. Other Features
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

### user_subscriptions Collection
```javascript
{
  user_id: string,
  plan_id: string, // "free", "premium_monthly", "chef_pro_annual", etc.
  status: string,  // "active", "trialing", "canceled"
  created_at: datetime
}
```

## API Endpoints

### Usage System
- `GET /api/usage/status` - Get usage status (auth required)
- `GET /api/usage/check/recipes` - Check recipe quota (auth required)
- `GET /api/usage/check/meal-plans` - Check meal plan quota (auth required)

### Recipe Generation
- `POST /api/chat/send` - Generate recipes (rate limited for free users)

## Test Credentials
- Email: lloydmasih1976@gmail.com
- Password: Milokiko*25
- Tier: Free

## Recent Changes (Feb 11, 2026)

### Freemium System Complete Rewrite
1. Created new database-centric usage tracking system
2. Backend service tracks RECIPES (not requests)
3. Counter increments AFTER successful generation
4. Frontend shows UsageLimitBanner with remaining count
5. UpgradeModal appears when limit reached with 403 response
6. Fixed bug in `is_recipe_generation_request()` to properly detect recipe requests

### Testing Results
- All 10 backend tests passing
- Frontend components working correctly
- Usage tracking accurate
- Reset logic verified
- Modal displays correctly on limit

## Backlog

### P1 - Next Priority
- Case-insensitive user search bug fix

### P2 - Future
- Mobile improvements (offline mode, push notifications, haptic feedback)
- Stripe payment integration for actual subscriptions
- Email notifications for usage warnings

## Known Issues
- None currently blocking

## Files of Reference
- Backend Usage Service: `/app/backend/services/usage_limit_service.py`
- Backend Usage Routes: `/app/backend/routes/usage.py`
- Backend Chat Routes: `/app/backend/routes/chat.py`
- Frontend Usage Service: `/app/frontend/src/services/usageLimitService.js`
- Frontend Usage Hook: `/app/frontend/src/hooks/useUsageLimit.js`
- Frontend Banner: `/app/frontend/src/components/UsageLimitBanner.jsx`
- Frontend Modal: `/app/frontend/src/components/UpgradeModal.jsx`
- App.js: `/app/frontend/src/App.js`
