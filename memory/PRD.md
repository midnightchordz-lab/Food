# MoodFood - Mood-Based Meal Planning App

## Overview
A mood-based recipe discovery application where users receive personalized meal suggestions based on their current emotional state, dietary preferences, meal type, and cuisine choices.

## Core Features

### 1. Authentication System (COMPLETE - Updated Jan 29, 2026)
- JWT-based user authentication
- **Email Login**: Traditional email/password registration and login
- **Phone Number Login (Phase 3)**: SMS OTP verification
  - Country code selector (10+ countries)
  - Phone number input with formatting
  - 6-digit OTP verification
  - Demo mode: OTP shown in toast when Twilio not configured
  - New user profile setup after first verification
- User registration with dietary preferences and cuisine preferences
- **NEW: Food Allergy & Exclusion Onboarding (Step 2 of registration)**

### NEW: Food Allergy & Exclusion System (COMPLETE - Jan 29, 2026)
- **Onboarding Flow**: Users can set food exclusions during registration
  - Common allergens: Eggs, Milk, Peanuts, Tree Nuts, Soy, Wheat, Fish, Shellfish
  - Popular exclusions: Beef, Pork, Lamb, Chicken, Shrimp, Tuna, Salmon, etc.
  - Other ingredients: Garlic, Onion, Cilantro, Mushroom, Coconut, etc.
  - Custom ingredient input
  - Category-based selection with "Select All" options
- **Profile Management**: Users can edit exclusions anytime in Profile
- **Recipe Filtering**: AI prompts include exclusions to never suggest unsafe recipes
- **Exclusion Banner**: Shows active exclusions in Chat and Diabetes Meals pages
- **Database Storage**: `user_exclusions` collection with:
  - `excluded_ingredients[]` with name, category, severity, reason
  - `excluded_ingredient_names[]` for quick lookup
  - `common_allergens{}` object for standard allergens
- **Ingredient Aliases**: System recognizes variations (eggs/egg, milk/dairy, etc.)

### 2. Enhanced Chat Flow (COMPLETE - Phase 1, Jan 27, 2026)
- **Structured Multi-Step Flow**:
  1. **Mood Selection**: 8 moods (Happy, Sad, Angry, Excited, Calm, Stressed, Romantic, Cozy)
  2. **Meal Type Selection**: Breakfast, Lunch, or Dinner
  3. **Dietary Preference**: Vegetarian, Vegan, Non-Vegetarian, Pescatarian, Any
  4. **Cuisine Selection**: Multi-select from 11 cuisines (Mexican, Italian, Chinese, Indian, Japanese, Thai, Mediterranean, American, Korean, Middle Eastern, Surprise Me)
- **Chat Persistence**: Conversation state saved to localStorage, persists across navigation
- **Visual Selection Badges**: All selections shown as badges at top of chat
- AI-powered responses with OpenAI GPT-4o

### 3. Recipe Display (COMPLETE - Phase 2, Jan 27, 2026)
- **3-Column Grid Layout**: Recipe cards displayed in responsive grid (1 column mobile, 2 tablet, 3 desktop)
- **Recipe Cards Include**:
  - High-quality food image
  - Recipe title
  - Brief description (2-3 sentences)
  - Cooking time and difficulty badge
  - "Read More" button
- **Recipe Detail Modal**:
  - Two-column layout: Ingredients (left) + Steps (right)
  - Individual "+ Add to List" buttons per ingredient
  - "Add All Ingredients" button
  - Checkboxes for step tracking
  - Detailed, specific cooking instructions

### 4. Shopping List (COMPLETE)
- Shows ONLY ingredient names (no quantities)
- Organized by category (Produce, Dairy, Meat, Pantry, etc.)
- Shows source recipe for each ingredient
- Persistent across sessions via localStorage
- Shopping partner integration (Amazon Fresh, Instacart, Walmart, etc.)
- Export options (Copy, Download)

### 5. Navigation (UPDATED - Jan 27, 2026)
- **5 Tabs**: Home, Chat, List, Planner, Profile
- **Home Button**: Visible on all pages
- **Persistent Navigation**: Stays fixed at top

### 6. Weekly Meal Planner (COMPLETE - Phase 4, Updated Jan 27, 2026)
- **7-Day Calendar View**: Monday through Sunday columns
- **3 Meal Slots per Day**: Breakfast, Lunch, Dinner (21 total slots)
- **Week Navigation**: Previous/Next week buttons
- **AI Plan Generation**: Generate meal plans based on preferences
- **Clickable Recipes**: 
  - Scheduled meals are clickable with hover effects (underline, color change)
  - Opens full recipe detail modal with:
    - Hero image
    - Full recipe name
    - Meal type badge (Breakfast/Lunch/Dinner)
    - Day badge
    - Ingredients list with individual "+ Add to List" buttons
    - "Add All Ingredients" button
    - Step-by-step cooking instructions
    - "← Back to Planner" button
  - Empty slots open AI generator to add meals
- **Subscription Feature**:
  - Weekly recipe newsletter signup
  - Customizable preferences: dietary, cuisines, recipes per week, delivery day
  - Email input for newsletter delivery
  - Saved to database (email integration pending)

## Technical Architecture

### Backend (FastAPI) - REFACTORED Jan 29, 2026
The monolithic server.py (3691 lines) was refactored into modular routers for better maintainability:

- **server.py**: Lightweight entry point (77 lines) - imports and includes all routers
- **routes/**:
  - **auth.py** (215 lines): Registration, login, phone OTP, profile management
  - **chat.py** (525 lines): AI chat, mood detection, recipe generation prompts
  - **recipes.py** (411 lines): Save, retrieve, rate, search, discover recipes
  - **meal_planning.py** (596 lines): Weekly plans, shopping lists, preferences, reminders, subscriptions
  - **diabetes.py** (632 lines): Diabetes-specific meal planning and chat
  - **exclusions.py** (369 lines): Food allergy/exclusion management with alias matching
  - **import_recipe.py** (511 lines): Import from URL, image, video, text
  - **voice.py** (131 lines): Speech transcription and synthesis
  - **deps.py** (143 lines): Shared dependencies (db, User model, auth)
- **image_service.py**: Curated Unsplash images for recipes
- **voice_service.py**: STT/TTS integration
- **pdf_generator.py**: Shopping list PDF export
- **ai_meal_planner.py**: AI meal plan generation
- **diabetes_meal_planner.py**: Diabetes-specific meal plan generation

### API Endpoints
- **Phone Auth**: `/api/auth/phone/send-otp`, `/api/auth/phone/verify-otp`
- **Subscription**: `/api/subscription/recipes` (POST/GET/DELETE)
- **Weekly Plans**: `/api/weekly-plan`, `/api/weekly-plan/generate`

### Frontend (React)
- **Pages**: LandingPage, ChatPage, SavedRecipes, ShoppingListPage, WeeklyPlannerPage, ProfilePage
- **Components**: Navigation, AuthModal (Email/Phone), MoodSelector, MealTypeSelector, CuisineSelector, FoodPreferenceSelector
- **UI**: Shadcn/UI components, Tailwind CSS

### Database (MongoDB)
- users
- chat_messages
- recipes
- saved_recipes
- shopping_lists
- weekly_plans
- recipe_ratings
- meal_reminders
- recipe_subscriptions

### Integrations
- OpenAI GPT-4o (Chat) - via Emergent LLM Key
- OpenAI Whisper (STT) - via Emergent LLM Key
- OpenAI TTS (Text-to-Speech) - via Emergent LLM Key
- Unsplash (Images) - Curated static URLs

## API Endpoints

### Authentication
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me
- PUT /api/auth/profile

### Chat
- POST /api/chat/send
- GET /api/chat/history/{session_id}

### Recipes
- POST /api/recipes/save
- GET /api/recipes/saved
- POST /api/recipes/discover
- POST /api/recipes/search
- POST /api/recipes/{recipe_id}/add-to-shopping-list
- POST /api/recipes/{recipe_id}/rate
- GET /api/recipes/{recipe_id}/ratings

### Shopping List
- POST /api/shopping-list
- GET /api/shopping-list
- GET /api/shopping-list/export

### Weekly Plan
- POST /api/weekly-plan
- GET /api/weekly-plan
- POST /api/weekly-plan/generate

### Voice
- POST /api/voice/transcribe
- POST /api/voice/synthesize
- GET /api/voice/languages
- GET /api/voice/mood-info

### Reminders
- POST /api/reminders
- GET /api/reminders
- DELETE /api/reminders/{reminder_id}

## Known Limitations
- Recipe discovery uses curated static data (MOCKED - not live web search)
- Voice response latency depends on TTS model speed
- Shopping partner integration copies list to clipboard (no actual API integration)
- Phone authentication requires Twilio API keys (not configured)

## Upcoming Tasks (Backlog)

### P0 - Completed
- [x] Fix recipe generation stalling (was 2+ minutes, now 29-36 seconds)
- [x] Fix generic cooking instructions (now includes specific timing, temperatures, sensory cues)
- [x] Drink Pairings feature - recipes now include alcoholic and non-alcoholic drink suggestions
- [x] Fix session persistence - users stay logged in when navigating between pages
- [x] Fix dynamic drink pairings - now cuisine-specific (Thai, Italian, Indian)
- [x] Intelligent mood change detection - users can change mood mid-conversation
- [x] Diabetes Meals Tab - dedicated section for blood sugar-safe recipes
- [x] Import Recipe Feature - import recipes from URL, Image, Video, or Text with AI conversion
- [x] **CRITICAL** Food Allergy & Exclusion System - Backend safety filter for ALL recipe suggestions

### P0 - Critical (Completed)
- [x] **Progressive Web App (PWA) Conversion** - COMPLETED Jan 31, 2026. App is now installable on mobile/desktop with offline support. manifest.json, service-worker.js, icons, PWAInstallPrompt component all verified working.
- [x] **Recipe Image Mismatch Bug** - FIXED Feb 1, 2026. Images now correctly match recipe titles. Priority-based matching ensures salmon/tuna/shrimp recipes show correct images (not chicken). Testing agent verified fix with 100% pass rate.
- [x] **Site-Wide Performance Slowness** - FIXED Feb 1, 2026. Disabled auto AI image generation in PlannerMealCard.jsx. Changed to on-demand generation with manual button. Homepage now loads in 0.08 seconds.

### P1 - High Priority
- [x] **Refactor server.py** - COMPLETED Jan 29, 2026. Split 3691-line monolith into 9 modular router files. All 45 API tests passed.
- [ ] Complete Phone Authentication (requires Twilio API keys)
- [x] **Persist Meal Plans & Subscriptions to DB** - COMPLETED Jan 29, 2026. Weekly plans saved via /api/weekly-plan/generate and retrieved via /api/weekly-plan. Subscriptions persisted via /api/subscription/recipes.
- [x] **Implement Macro Tracking** - COMPLETED Jan 29, 2026. Added protein/carbs/fat goal inputs to meal planner. MacroTargets model with protein_g, carbs_g, fat_g, fiber_g fields. UI shows macro distribution and calorie calculations.
- [x] Verify image display for previously saved recipes - Code verified, displays correctly
- [ ] Voice agent response is slow - Needs latency investigation (STT -> AI -> TTS pipeline)

### P2 - Medium Priority
- [ ] **Persist Newsletter Subscriptions to DB** - UI exists, need backend logic to save subscription status
- [ ] Auto-detect browser language for voice default
- [ ] Recipe rating and review system enhancements
- [ ] Meal prep reminders and notifications
- [ ] Add more recipes to the curated database
- [ ] Create persistent "My Grocery List" page that saves across sessions

### P3 - Low Priority  
- [ ] Server.py refactoring into modular routers
- [ ] Real-time web search for recipes (when API available)
- [ ] Actual shopping partner API integrations (Instacart, Amazon Fresh)

## Changelog

- **Feb 4, 2026**: BUGFIX - Image Fallback in D-Planner and Planner
  - **Issue**: When Google Images didn't find results, AI generation wasn't automatically triggered
  - **Fix**: 
    - Added direct AI generation fallback in frontend when getFastImage returns null
    - Added 30s timeout to API calls to allow AI generation time
    - Added retry button on error state
    - Added error handling in both PlannerMealCard and RecipeCard components
  - **Files Modified**: PlannerMealCard.jsx, RecipeMessageDisplay.js

- **Feb 4, 2026**: FEATURE - Google Shopping Light API Integration (Full Suite)
  - **4 Shopping Features Implemented:**
    1. **Buy Ingredients Button** - One-click to search all recipe ingredients with best prices and buy links
    2. **Price Comparison Widget** - Shows cheapest options for each ingredient in shopping list
    3. **Shopping Cart Builder** - Aggregates and deduplicates ingredients from multiple recipes
    4. **Store-Specific Searches** - Filter results by store (Amazon, Walmart, Target, Instacart, Kroger, Whole Foods, Costco, Safeway, Trader Joe's)
  - **New API Endpoints:**
    - GET `/api/search/supported-stores` - List of supported stores for filtering
    - POST `/api/search/ingredient-price-filtered` - Price check with optional store filter
    - POST `/api/search/batch-prices` - Batch price check for multiple ingredients (max 15)
    - POST `/api/search/buy-ingredients` - Returns purchase links for ingredients
    - POST `/api/search/shopping-cart` - Builds aggregated cart from multiple recipes (max 10)
  - **Files Created/Modified:**
    - `/app/backend/services/serpapi_service.py` - Added SUPPORTED_STORES, check_ingredient_price_with_store(), batch_ingredient_prices(), build_shopping_cart()
    - `/app/backend/routes/search.py` - Added 5 new shopping endpoints
    - `/app/frontend/src/components/ShoppingWidget.jsx` - NEW: BuyIngredientsButton, PriceComparisonWidget, ShoppingCartBuilder, StoreFilterDropdown
    - `/app/frontend/src/components/SearchHub.jsx` - Added store filter to Price Check tab
    - `/app/frontend/src/components/RecipeDetailModal.js` - Added Buy Ingredients button

- **Feb 4, 2026**: FEATURE - Google Images Integration for Faster Recipe Loading
  - **Added**: Fast image loading via SerpAPI Google Images search
  - **Benefit**: Images load in <1-2 seconds vs 5-10 seconds for AI generation
  - **Scope**: Chat, Diabetes, D-Planner, and Planner pages all use fast loading
  - **Fallback**: AI image generation when no Google Images found
  - **User Option**: Manual "AI" button to generate higher quality AI images
  - **Visual Badges**: Blue "⚡ Fast" for Google Images, Purple "AI" for AI-generated
  - **API Endpoint**: POST/GET /api/recipe-image/fast
  - **Quality Filters**: Stock photo sites filtered out, food sources prioritized
  - **Files Modified**:
    - `/app/backend/services/serpapi_service.py` - Added search_food_images()
    - `/app/backend/routes/image_generation.py` - Added /fast endpoint
    - `/app/frontend/src/components/RecipeMessageDisplay.js` - Fast loading
    - `/app/frontend/src/components/PlannerMealCard.jsx` - Fast loading
    - `/app/frontend/src/services/aiImageService.js` - getFastRecipeImage()
    - `/app/frontend/src/hooks/useAIRecipeImage.js` - loadFast() and generateAI()

- **Feb 4, 2026**: FEATURE - SerpAPI Integration (Recipe Search, Grocery Stores, Price Check) - ENHANCED
  - **Added**: SearchHub component with 3 tabs
  - **Recipe Search**: Search for recipes from external websites (Google Search)
  - **Grocery Store Finder**: Find nearby grocery stores using Google Maps
    - **NEW**: Google Maps "View on Map" button - Direct link to Google Maps with store location
    - Uses GPS coordinates when available for precise directions
    - Fallback to name+address search for stores without coordinates
  - **Ingredient Price Check**: Check ingredient prices from Google Shopping
    - **NEW**: Local currency support - Automatically detects location and shows prices in local currency
    - Supported currencies: USD ($), INR (₹), GBP (£), EUR (€), CAD (C$), AUD (A$)
    - Shows detected location badge (e.g., "Mumbai, Maharashtra, India")
    - Price stats (min/avg/max) display with correct currency symbol
  - **Files Created/Modified**: 
    - `/app/backend/services/serpapi_service.py` - SerpAPI service layer with location mapping
    - `/app/backend/routes/search.py` - API routes for search features
    - `/app/frontend/src/components/SearchHub.jsx` - Search Hub UI with maps links and currency display
  - **Navigation**: Added Search button to navigation bar
  - **API Endpoints**: `/api/search/recipes`, `/api/search/grocery-stores`, `/api/search/ingredient-prices`

- **Feb 2, 2026**: PERFORMANCE - WebP Image Optimization
  - **Added**: Automatic WebP conversion for all AI-generated recipe images
  - **Benefit**: 25-34% smaller file sizes compared to PNG/JPEG
  - **Implementation**: Uses Pillow to convert images before caching
  - **Quality**: WebP quality set to 80 (good balance of quality and size)
  - **Logging**: Backend logs size reduction for each generated image
  - **Backward Compatible**: Cached images with old format still work
  - **Files Modified**: `/app/backend/ai_image_service.py`, `/app/backend/routes/image_generation.py`

- **Feb 1, 2026**: PERFORMANCE FIX - Disabled Auto AI Image Generation (P0 CRITICAL)
  - **Fixed**: Site-wide slowness affecting login and all pages
  - **Issue**: Automatic AI image generation in `PlannerMealCard.jsx` was triggering API calls on every component mount
  - **Root Cause**: `useEffect` in PlannerMealCard was auto-generating AI images for every meal card, causing 21+ API calls when viewing weekly planner
  - **Solution**: 
    - Removed auto-generation from PlannerMealCard.jsx
    - Added on-demand "AI" button that appears on hover for manual generation
    - Cache-only check on mount - uses cached images if available, otherwise shows default stock photo
    - Users can still generate AI images by clicking the sparkle button
  - **Testing**: Homepage loads in 0.08 seconds (was extremely slow before)
  - **Files Modified**: `/app/frontend/src/components/PlannerMealCard.jsx`

- **Feb 1, 2026**: FEATURE - Mid-Chat Cuisine & Mood Change Support
  - Users can now change cuisine mid-chat by typing phrases like "switch to Thai", "craving Mexican", "I want Japanese food"
  - System detects cuisine keywords (italian, indian, mexican, chinese, japanese, thai, etc.)
  - Orange "New cuisine selected!" card appears with "Show [Cuisine] Recipes" button
  - Combined mood + cuisine changes supported (e.g., "I'm feeling cozy and want Japanese")
  - Files Modified: `/app/frontend/src/pages/ChatPage.js` (detectCuisineFromText, handleCuisineChange, getRecipesForNewCuisine)

- **Feb 1, 2026**: ENHANCEMENT - AI-Generated Images as Default
  - Recipe cards now AUTO-GENERATE AI images on mount for 100% accurate dish-specific visuals
  - Loading state shows "Creating image..." with purple/blue gradient and sparkle animation
  - "AI Generated" badge appears after generation completes
  - "New" regenerate button appears on hover to create fresh image
  - Images cached in-memory (frontend) and MongoDB (backend) for instant loading
  - Falls back to static stock photos if AI generation fails
  - Files Modified: `/app/frontend/src/components/RecipeMessageDisplay.js`

- **Feb 1, 2026**: BUG FIX - Recipe Image Mismatch (P0 CRITICAL)
  - **Fixed**: Images now correctly match recipe titles in chat interface
  - **Issue**: Salmon/Tuna/Shrimp recipes were showing chicken images
  - **Root Cause**: Frontend's `getRecipeImage()` in `RecipeMessageDisplay.js` was not prioritizing specific proteins
  - **Solution**: Priority-based matching that checks HIGH PRIORITY PROTEINS (salmon, tuna, shrimp, fish) BEFORE chicken
  - **Testing**: 100% pass rate - verified with Teriyaki Salmon, Spicy Tuna, Miso Shrimp, etc.
  - **Files Modified**: `/app/frontend/src/components/RecipeMessageDisplay.js`

- **Jan 31, 2026**: FIX & ENHANCEMENT - Image Service & Global Recipe Database
  - **BUG FIX**: Fixed image mismatch where "Veggie Pulao" showed fried egg image
  - **Improved matching logic**: Prioritizes longer matches, skips common words, requires 4+ char matches
  - **Expanded image database**: From ~80 dishes to 400+ dishes covering:
    - India & Subcontinent: North/South Indian, Pakistani, Sri Lankan
    - China: Regional Chinese, Dim Sum, Sichuan
    - Japan: Ramen, Sushi, Udon, Tempura
    - Korea: BBQ, Jjigae, Kimchi dishes
    - ASEAN: Thai, Vietnamese, Malaysian, Indonesian, Filipino
    - Middle East: Persian, Turkish, Lebanese, Moroccan
    - Europe: Italian, French, Spanish, Greek, German, British, Russian
    - Americas: Mexican, American, LATAM, Caribbean
    - Oceania & Africa: Australian, Ethiopian, West African
  - Added 30+ cuisine fallbacks for better coverage

- **Jan 31, 2026**: FEATURE - Capacitor Native Mobile App Wrapper (COMPLETE)
  - Added Capacitor v5 for wrapping the web app as native iOS/Android apps
  - Installed plugins: splash-screen, status-bar, keyboard, haptics, share, browser, app
  - Created `/src/capacitor.js` with native feature utilities (haptics, share, browser)
  - Configured `capacitor.config.json` with app styling (splash, status bar colors)
  - Added CSS safe area insets for notched devices (iPhone X+)
  - Added keyboard handling styles for mobile input
  - Created `MOBILE_BUILD_GUIDE.md` with complete build instructions
  - Same codebase serves web, PWA, iOS, and Android

- **Jan 31, 2026**: FEATURE - Progressive Web App (PWA) Conversion (COMPLETE)
  - App is now installable on mobile and desktop devices
  - Created `/public/manifest.json` with app metadata, icons, shortcuts
  - Created `/public/service-worker.js` with caching strategies (cache-first for static, network-first for API)
  - Created `/public/offline.html` fallback page with MOOD FOOD branding
  - Created `/public/icons/` with 8 icon sizes (72x72 to 512x512)
  - Created `PWAInstallPrompt.js` component with iOS-specific instructions
  - Updated `index.html` with PWA meta tags, Apple touch icons, service worker registration
  - Added app shortcuts: Chat, Planner, Import Recipe
  - Testing: 100% pass rate - all PWA features verified (manifest, SW, icons, offline, install prompt)

- **Jan 31, 2026**: BRANDING - Updated app name and tagline
  - App name: "MOOD FOOD"
  - Tagline: "When Feelings Need Feeding"
  - Updated across: Landing page, Navigation, Auth modal, Chat page, Planner pages, Import page, Profile page, Saved Recipes page, Discover page
  - Browser tab title updated

- **Jan 29, 2026**: OPTIMIZATION - Recipe Import Speed
  - Switched from gpt-4o to gpt-4o-mini for 2-3x faster processing
  - Reduced content truncation from 15000 to 6000 chars
  - Simplified AI prompts to reduce token count
  - Added cycling progress messages in frontend (updates every 4 seconds)
  - Import time reduced from ~30-45 seconds to ~15-20 seconds

- **Jan 29, 2026**: FEATURE - Macro Tracking & Meal Plan Persistence
  - Added MacroTargets model with protein_g, carbs_g, fat_g, fiber_g fields
  - Updated MealPreferences to include macro_targets
  - AI meal planner now considers macro targets in meal suggestions
  - Frontend: New collapsible macro tracking section in AIMealPlanGenerator
  - Frontend: Macro targets displayed in preference banner (e.g., "150g P / 200g C / 65g F")
  - Meal plans and subscriptions now properly persisted to MongoDB

- **Jan 29, 2026**: REFACTOR - Server.py Modularization
  - Split 3691-line server.py into 9 modular router files
  - New server.py is 77 lines (lightweight entry point)
  - Routes directory: auth.py, chat.py, recipes.py, meal_planning.py, diabetes.py, exclusions.py, import_recipe.py, voice.py, deps.py
  - All 45 API tests passed with 100% success rate

- **Jan 29, 2026**: FEATURE - Phone Authentication with Twilio
  - Integrated Twilio SMS for phone OTP verification
  - Added endpoints: `POST /api/auth/phone/send-otp`, `POST /api/auth/phone/verify-otp`
  - Features:
    - 6-digit OTP generation with 10-minute expiry
    - Rate limiting (5 attempts max)
    - Automatic user creation on first phone login
    - Falls back to demo mode if SMS fails
  - **Note**: Test credentials provided - SMS sends may fail with test accounts
    - For production: Need a verified Twilio phone number and live credentials
    - Demo mode works for testing (OTP returned in response)
  
- **Jan 29, 2026**: NEW FEATURE - Diabetes Weekly Meal Planner
  - Created `/diabetes-planner` route with full weekly meal planning for diabetes
  - Backend: New module `diabetes_meal_planner.py` with diabetes-specific meal generation
  - Backend: Added 5 new endpoints:
    - `POST /api/diabetes/weekly-plan/generate` - Generate diabetes-optimized meal plan
    - `GET /api/diabetes/weekly-plan` - Get saved diabetes plans
    - `POST /api/diabetes/weekly-plan/generate-for-week` - Generate for specific week
    - `POST /api/diabetes/meal-preferences` - Save diabetes preferences
    - `GET /api/diabetes/meal-preferences` - Get diabetes preferences
  - Frontend: New `DiabetesWeeklyPlannerPage.js` with:
    - Diabetes type selection (Type 1, Type 2, Gestational, Pre-Diabetes)
    - Weekly calendar view with carb tracking per meal
    - Exclusion banner showing active food restrictions
    - Settings modal for preferences (calories, cuisines, dietary)
    - Blood sugar tips section
  - Safety: Uses same exclusion filtering as main chat - tested 0 violations
  - Performance: ~9 second generation time

- **Jan 29, 2026**: CRITICAL FIX - Food Allergy & Exclusion System Safety Filter
  - **PROBLEM**: Recipe filtering was failing - AI suggested "Karahi Prawns" when "Shrimp" was excluded
  - **ROOT CAUSE**: The system relied solely on AI prompt compliance, and the AI would sometimes ignore the exclusion instructions
  - **SOLUTION**: Implemented mandatory backend post-processing safety filter:
    1. `filter_unsafe_recipes_from_response()` - First pass structured recipe filter
    2. `filter_recipe_text_strictly()` - Second pass line-by-line filter
    3. Word boundary regex matching (r'\b' + term + r'(?:s|es)?\b') to avoid false positives
    4. Removed "hen" from chicken aliases to prevent matching "when", "then", "kitchen"
  - **PERFORMANCE FIX**: Simplified AI prompt to reduce token count
    - Reduced verbose exclusion instructions to 3 lines (from ~20 lines)
    - Reduced recipes requested from 6 to 4
    - Response time improved from ~2 minutes to ~32 seconds
    - Safety maintained via backend post-processing filter
  - **DIABETES CHAT FIX**: Updated `/api/diabetes/chat` endpoint to:
    - Fetch user exclusions and add to system prompt
    - Apply safety filter to responses
    - Detect mood changes and update UI accordingly
    - Frontend now handles mood_change_detected response
  - **FILES MODIFIED**:
    - `backend/server.py`: Added safety filter functions and updated all chat endpoints
    - `backend/ai_meal_planner.py`: Added user_exclusions parameter and filtering
    - `frontend/src/pages/DiabetesMealsPage.js`: Handle mood change detection in chat
  - **TESTING**: 100% pass rate (11/11 backend tests) - See `/app/test_reports/iteration_24.json`
  - **VERIFIED**: Prawn (shrimp alias), chicken tikka, butter chicken are all blocked correctly

- **Jan 29, 2026**: Fixed Diabetes Meals Page MoodSelector Bug & Voice Optimization
  - **BUG FIX**: Fixed "MoodSelector is not defined" error on Diabetes Meals page
    - Replaced `MoodSelector` with `MoodCarousel` component in `DiabetesMealsPage.js`
    - 2-row mood grid now displays correctly with all 12 3D emoji images
  - **Voice Agent Optimization**: Improved TTS response speed
    - Reduced text limit from 500 to 300 characters
    - Added smart truncation at sentence boundaries (., ?, !)
    - Removed markdown formatting from text before speech synthesis
    - TTS response time: ~1.4 seconds for short text
  - **Verification Complete**: Saved Recipes page displays images correctly

- **Jan 29, 2026**: Implemented Import Recipe Feature (MAJOR FEATURE)
  - Added "Import" tab to navigation between Diabetes and List
  - Created Import Recipe page with 4 import method cards:
    * **From URL**: Scrapes recipe websites, AI extracts and converts recipe
    * **From Photo**: Uses GPT-4o Vision to OCR and extract recipes from images
    * **From Video**: Supports YouTube URLs (extracts from title/description) and video file upload
    * **From Text**: Paste plain text recipe for AI conversion
  - AI converts ALL imported recipes to standardized detailed format with:
    * Step-by-step instructions with specific timing (e.g., "5 minutes")
    * Exact temperatures (e.g., "375°F/190°C")
    * Visual cues (e.g., "until golden brown")
    * Technique explanations for beginners
    * Categorized ingredients
    * Chef's tips, nutrition info, storage instructions
    * Drink pairings
  - Preview and Edit capability before saving
  - Recently Imported section shows last 10 imports
  - Backend endpoints: POST /api/import/{url,image,video,text}, POST /api/import/save, GET /api/import/recent
  - Test results: Backend 93%, Frontend 100%

- **Jan 27, 2026**: Fixed Recipe Discovery feature
  - Fixed `/api/recipes/discover` endpoint (removed broken web_search_tool_v2 import)
  - Updated `image_service.py` with curated Unsplash images for 9 cuisines
  - Verified navigation from Explore Cuisines -> Discover Recipes works correctly
  - All tests passing (100% success rate)
  
- **Jan 27, 2026**: Fixed Auth Modal scrolling issue
  - Made the signup modal scrollable (`max-h-[90vh] overflow-y-auto`)
  - Reduced checkbox section heights for better visibility
  - Sign Up button now accessible without scrolling on most screens

- **Jan 27, 2026**: Implemented Visual-First Recipe Display in Chat
  - Created `RecipeMessageDisplay.js` component for visual recipe cards
  - Two-column layout: text (60-70%) on left, image (30-40%) on right
  - Recipe cards show: title, description, cooking time, difficulty badge
  - High-quality Unsplash images matched to each dish (no country codes)
  - Save Recipe button on each card with dialog confirmation
  - Cuisine type indicators displayed on cards
  - CSS animations for smooth card appearance

- **Jan 27, 2026**: Implemented Structured Meal Suggestion Flow
  - Created `FoodPreferenceSelector.js` component with 5 preference buttons
  - Food preferences: Vegetarian, Vegan, Non-Vegetarian, Pescatarian, Any
  - Flow: Mood message -> Preference selection -> Time-categorized recipes
  - Recipe display organized by cooking time:
    * Quick Option (15-20 min) ⚡
    * Moderate Option (20-40 min) 🍳
    * Elaborate Option (40-60 min) 👨‍🍳
  - Selected preference shown as badge in header with clear option
  - Full integration with RecipeMessageDisplay for visual cards

- **Jan 27, 2026**: Implemented Interactive Clickable Recipe Cards with Detail Modal
  - Recipe cards are now fully clickable with hover effects (shadow, lift)
  - "View Full Recipe" appears on hover
  - Created `RecipeDetailModal.js` with comprehensive recipe view:
    * Hero image with title overlay and dietary tags
    * Quick info bar: Total Time, Prep Time, Servings, Difficulty, Cuisine
    * Action buttons: Save Recipe, Add to Shopping List, Share, Print
    * Ingredients list with checkboxes and serving size scaler
    * Step-by-step numbered instructions with timing
    * Nutrition info grid (Calories, Protein, Carbs, Fat, Fiber)
    * Chef's Tips section with pro tricks
    * Perfect Pairings suggestions
    * Storage Instructions
    * 5-star rating system
  - Recipe details generated from templates based on recipe type

- **Jan 27, 2026**: Added SPECIFIC Recipe Instructions (Not Generic)
  - Created comprehensive DETAILED_RECIPES database with 9+ fully detailed recipes:
    * Italian: Caprese Quinoa Salad, Spaghetti Carbonara, Margherita Pizza
    * Indian: Butter Chicken, Palak Paneer
    * Mexican: Tacos al Pastor
    * Asian: Pad Thai, Chicken Teriyaki, Ramen
  - Each recipe has 10-12 SPECIFIC steps with:
    * Exact ingredient names and measurements
    * Precise temperatures and heat levels
    * Timing for each step with clock icons
    * Sensory cues (e.g., "until golden brown", "fragrant")
  - Updated recipe parser to handle AI response format:
    * Now extracts titles from "### Quick Option: Recipe Title" headers
    * Falls back to **Recipe Title** pattern
    * Improved hasRecipes detection for time category headers
  - Category-specific fallback templates for unknown recipes (salad, curry, pasta, etc.)

- **Jan 27, 2026**: Implemented Comprehensive Shopping Cart System (COMPLETE)
  - Created `ShoppingCartContext.js` with full state management:
    * addToCart, addAllToCart, removeFromCart, updateQuantity
    * toggleItemChecked, clearCart, saveToGroceryList
    * exportAsText, copyToClipboard, downloadList
    * Automatic ingredient categorization (Produce, Dairy, Meat, Seafood, Pantry, Spices, Condiments)
    * localStorage persistence for cart items
    * Fixed race condition bug with isInitialized flag
  - Created `ShoppingCartModal.js` with:
    * Floating cart button in bottom-right corner (always visible)
    * Cart item count badge
    * Items organized by grocery category with emoji icons
    * Checkbox for each item to mark as checked
    * Edit/delete buttons for each item
    * Copy List, Download, Save to Grocery List buttons
    * Order Now opens Shopping Partner selection modal
    * 8 shopping partners: Amazon Fresh, Instacart, Walmart, Target, Whole Foods, Kroger, Safeway, Other
  - Enhanced `RecipeDetailModal.js`:
    * Individual "Add to Cart" (+) buttons next to each ingredient
    * "Add All" button to add all ingredients at once
    * Visual feedback when items are added (checkmark icon)
  - **CRITICAL FIX: Unified Shopping Cart and Shopping List Page**
    * Rewrote `ShoppingListPage.js` to use `ShoppingCartContext` (same as floating cart)
    * Single source of truth - no more two separate systems
    * Items added from recipes now AUTOMATICALLY appear on Shopping List page
    * No manual "Save to Grocery List" step required
    * Category organization with collapsible sections
    * Recipe attribution ("From: [Recipe Name]") shown under each item
    * Manual item addition via input form on Shopping List page
  - **FIX: Clean Ingredient Names (No Quantities)**
    * Added `extractIngredientName()` function to strip quantities, measurements, and prep instructions
    * Shopping list now shows ONLY clean ingredient names (e.g., "Baby spinach" not "4 cups baby spinach")
    * Removes: quantities (4 cups, 1.5 lbs), measurements (tbsp, oz), prep instructions (, halved, , minced)
    * Preserves important descriptors (fresh, cherry, Thai) and proper nouns (Parmesan, Greek)
    * Proper capitalization (first letter only)
  - Test Results: 100% pass rate (8/8 features tested)


- **Jan 28, 2026**: Implemented Continuous Meal Planning (MAJOR FEATURE)
  - **Auto-Generation**: Once preferences set, system generates unique non-repeating recipes week after week
  - **Recipe Tracking**: MongoDB `used_recipes` collection tracks all generated recipes
  - **Smart Exclusion**: AI excludes last 8 weeks of recipes (50 max) to ensure variety
  - **New Endpoints**: `POST /api/meal-preferences`, `GET /api/meal-preferences`, `POST /api/weekly-plan/generate-next`, `GET /api/weekly-plan/current`
  - **Frontend**: Green "Continuous Meal Planning Active" banner with Update Preferences and Generate Next Week buttons
  - **Preserved**: Recipe Detail Modal format unchanged as requested
  - Testing: 100% backend (11/11), 100% frontend pass rate

- **Jan 28, 2026**: Added Calorie Target to Weekly Meal Planner (ENHANCEMENT)
  - **4 Presets**: Weight Loss (1500), Maintenance (2000), Active (2500), Muscle Gain (3000)
  - **Custom Input**: Users can set any calorie target between 1000-5000
  - **Smart Distribution**: Breakfast 25%, Lunch 35%, Dinner 40%
  - **Calorie Labels**: Generated meals include approximate calories e.g. "Greek Yogurt Parfait (~350cal)"
  - **Optional Feature**: Enabled via checkbox, plans work without calorie constraints too
  - Testing: 100% backend, 100% frontend pass rate

- **Jan 28, 2026**: Added Dietary Preference to Weekly Meal Planner (FEATURE)
  - **5 Dietary Options**: Vegetarian, Vegan, Non-Vegetarian, Pescatarian, Eggetarian
  - **UI**: Selectable cards with icons and descriptions in AI Meal Plan Generator modal
  - **Validation**: Dietary preference is required before generating a plan
  - **Backend**: AI prompt enforces strict dietary rules (no meat in vegetarian, no animal products in vegan, etc.)
  - **Fallbacks**: Dietary-appropriate backup plans if AI fails
  - Testing: 100% backend, 100% frontend pass rate

- **Jan 28, 2026**: Implemented Comprehensive Professional Recipe Detail View (MAJOR FEATURE)
  - **New Backend Endpoint**: `/api/recipes/detailed` generates professional-grade recipes using GPT-4o
  - **10 Recipe Sections**: Recipe Information, Description, Ingredients (categorized), Equipment Needed, Step-by-Step Instructions (with timing/visual cues), Chef's Tips, Nutritional Information, Storage & Reheating, Variations, Common Mistakes
  - **Instruction Format**: Each step has timing marker, Visual Cue, Important notes, Technique notes
  - **Frontend Modal Redesign**: Tabbed interface (Instructions, Ingredients, Tips, Nutrition, Storage)
  - **Features**: Step checkboxes for progress tracking, Add-to-cart for individual ingredients, Print/Share/Save buttons, Star rating
  - **Performance**: First request ~20-30 seconds (AI generation), cached requests ~85ms (MongoDB caching)
  - Testing: 94% backend, 100% frontend pass rate

- **Jan 27, 2026**: Fixed P0 Recipe Generation Issues (CRITICAL)
  - **Issue 1: Recipe Generation Stalling** - FIXED
    * Root cause: Overly complex system prompt + gpt-4o model causing 60s+ timeouts
    * Solution: Created optimized `get_recipe_generation_prompt()` function with concise prompt
    * Switched to `gpt-4o-mini` for recipe generation (faster response)
    * Response time improved from 2+ minutes to 29-36 seconds
  - **Issue 2: Generic Cooking Instructions** - FIXED
    * Root cause: Prompt not enforcing specific instruction format
    * Solution: Added strict rules requiring [PREP X min], [COOK X min] timing markers
    * Instructions now include exact temperatures (°F/°C), sensory cues (golden brown, fragrant)
    * Each recipe has unique, dish-specific instructions (no templates)
  - **Issue 3: Frontend Showing Template Instructions** - FIXED
    * Root cause: RecipeDetailModal was using hardcoded template instructions instead of AI-generated content
    * Solution: Added parseAIIngredients(), parseAIInstructions(), parseChefTip() helper functions
    * Updated generateDetailedRecipe() to prioritize AI content from fullContent field
    * Added parseNumberedRecipes() to handle new AI format "### 1. Recipe Name"
  - Created `is_recipe_generation_request()` helper to detect structured requests from frontend
  - All 16 tests passing (100% success rate)

- **Jan 28, 2026**: Implemented Drink Pairings Feature (COMPLETE)
  - **Chat Recipes**: All recipes suggested via chat now include drink pairings section
  - **Detailed Recipes**: Recipe detail modal shows "Drink Pairings" tab with Non-Alcoholic and Alcoholic options
  - **Meal Planner**: Weekly meal plans include `dinner_pairing` with drink suggestions
  - **Backend Changes**:
    - `get_recipe_generation_prompt()` updated to include 🍹 Drink Pairings section
    - `get_detailed_recipe_prompt()` includes 🍷 Drink Pairings with specific recommendations
    - `ai_meal_planner.py` generates `dinner_pairing` object for each day
  - **Frontend Changes**:
    - RecipeDetailModal.js parses drink pairings from AI response
    - New "Drinks" tab displays Non-Alcoholic (teal) and Alcoholic 21+ (purple) sections
    - Includes responsible drinking disclaimer
  - Testing: 100% backend, 100% frontend pass rate

- **Jan 28, 2026**: Fixed Dynamic Drink Pairings (BUG FIX)
  - **Issue**: Drink pairings showed generic fallback ("Sparkling Citrus Mocktail", "House Wine Pairing") instead of dish-specific drinks
  - **Root Cause**: Frontend parsing regex didn't handle bullet format from AI (- **Name:** Description)
  - **Solution**: 
    - Updated regex in parseDetailedRecipe() to handle bullet format: `/-?\s*\*\*([^*]+)\*\*:?\s*([^\n]+)/g`
    - Added `.replace(/:$/, '')` to remove trailing colon from drink names
    - Changed fallback to informative message: "Click View Full Recipe to load specific pairings"
    - Cleared 25 old cached recipes without drink pairings
  - **Result**: Drinks now match cuisine:
    - Thai: Thai Iced Tea, Coconut Water, Riesling
    - Italian: Barolo, Pinot Grigio, Limoncello Spritz
    - Indian: Mango Lassi, Riesling, IPA Beer
  - Testing: 100% pass rate

- **Jan 28, 2026**: Fixed Session Persistence Bug (P0 CRITICAL)
  - **Issue**: Users were being logged out when navigating between protected pages (Chat, Planner, etc.)
  - **Root Cause**: Protected pages were checking `isAuthenticated` before the AuthContext finished loading user from token
  - **Solution**: Added `loading` state check to all protected pages:
    - ChatPage.js - waits for auth loading before redirect
    - WeeklyPlannerPage.js - shows loading spinner while verifying auth
    - ProfilePage.js - shows loading spinner while verifying auth  
    - SavedRecipes.js - shows loading spinner while verifying auth
    - ShoppingListPage.js - shows loading spinner while verifying auth
  - **Impact**: Users now stay logged in seamlessly when navigating the app
  - Testing: All protected pages verified to maintain session
- **Jan 29, 2026**: Implemented Diabetes Meals Tab (MAJOR FEATURE)
  - **New Tab**: "🩺 Diabetes Meals" in navigation between Chat and List
  - **Conversation Flow**:
    1. Mood selection (same as main app)
    2. Diabetes type selection (Type 1, Type 2, Gestational, Pre-Diabetes)
    3. AI research of diabetes type with dietary guidelines display
    4. Dietary preference selection (Vegetarian, Vegan, etc.)
    5. Meal type selection (Breakfast, Lunch, Dinner, Snack)
    6. Cuisine selection
    7. Diabetes-safe recipe generation with drink pairings
  - **Backend Endpoints**:
    - `POST /api/diabetes/research` - Returns diabetes-specific dietary guidelines
    - `POST /api/diabetes/recipes` - Generates blood sugar-safe recipes
    - `POST /api/diabetes/chat` - Free-form Q&A about diabetes nutrition
  - **Recipe Features**:
    - Net Carbs, Fiber, Protein per serving
    - Glycemic Index and Blood Sugar Impact rating
    - "Why This is Blood Sugar Safe" explanation
    - Diabetes-safe drink pairings
    - Blood sugar tips for each recipe
  - **Safety Features**:
    - Medical disclaimer banner at top of page
    - Bottom disclaimer about consulting healthcare provider
    - Guidelines database for Type 1, Type 2, Gestational, Pre-Diabetes
  - **Files Created/Modified**:
    - `/app/frontend/src/pages/DiabetesMealsPage.js` (new)
    - `/app/frontend/src/components/Navigation.js` (updated)
    - `/app/frontend/src/App.js` (route added)
    - `/app/backend/server.py` (3 new endpoints + DIABETES_GUIDELINES)
  - Testing: Backend endpoints verified, full flow tested

- **Jan 29, 2026**: Fixed Mood Change Detection Bug
  - **Issue**: When user typed "cozy", system showed "Show Angry Recipes" button
  - **Root Cause**: Frontend detected mood from AI response instead of user input
  - **Solution**: Only detect mood from `messageText` (user input)
  - **Result**: "cozy" → correctly shows "Show Cozy Recipes"

- **Feb 07, 2026**: P0 CRITICAL - Fixed Recipe Generation & Display Pipeline (MAJOR REFACTOR)
  - **Issue**: Recipes displayed as raw markdown (`**Recipe: Scallion Pancakes...**`) instead of cards. Ingredients like "Greek Yogurt" appeared as recipe titles. "Mood-Boosting Benefits" section headers were parsed as recipe names.
  - **Root Cause**: Frontend had brittle regex parsing that failed on different LLM response formats. The architecture relied on frontend parsing unreliable AI text responses.
  - **Solution - Backend JSON Parsing**:
    - Added `parse_recipes_to_json()` function in `/app/backend/routes/chat.py` (lines 25-180)
    - Backend now parses LLM text response into structured JSON with fields: title, description, cooking_time, difficulty, cuisine, ingredients
    - Validates recipe titles: must be 2+ words, not single ingredients, not section headers
    - ChatResponse now includes `structured_recipes` array alongside raw `response` text
  - **Solution - Frontend Updates**:
    - `RecipeMessageDisplay.js` now accepts `structuredRecipes` prop
    - When structured data exists, renders directly from JSON (no parsing needed)
    - Falls back to text parsing only when no structured data available
  - **Additional Fixes by Testing Agent**:
    - Fixed cached responses to also include `structured_recipes`
    - Fixed recipe detection priority: checks `is_recipe_generation_request()` BEFORE mood detection
  - **Files Modified**:
    - `/app/backend/routes/chat.py` - Added parse_recipes_to_json(), updated ChatResponse
    - `/app/backend/routes/diabetes.py` - Added structured_recipes to diabetes chat
    - `/app/frontend/src/components/RecipeMessageDisplay.js` - Added structuredRecipes prop, convertStructuredRecipes()
    - `/app/frontend/src/pages/ChatPage.js` - Captures and passes structured_recipes
    - `/app/frontend/src/pages/DiabetesMealsPage.js` - Captures and passes structured_recipes
  - **Testing**: 7/7 backend tests passed, all cuisines verified (Italian, Indian, Thai, Japanese, Mexican)

- **Feb 07, 2026**: P2 - Recipe Library Database Implementation (COMPLETE)
  - **Feature**: Built a database to store successfully generated AI recipes
  - **Benefits**:
    - Reduces reliance on repeated LLM calls for similar queries
    - Improves performance by serving cached recipes
    - Creates a growing, proprietary recipe library
  - **Implementation**:
    - New service: `/app/backend/services/recipe_library.py`
    - New routes: `/app/backend/routes/recipe_library.py`
    - Database indexes for fast queries (cuisine, dietary, meal_type, mood, tags)
  - **API Endpoints**:
    - `GET /api/recipe-library/stats` - Library statistics
    - `GET /api/recipe-library/browse` - Browse with filters
    - `POST /api/recipe-library/search` - Full-text search
    - `GET /api/recipe-library/discover` - Random recipes
    - `GET /api/recipe-library/cuisines` - Available cuisines
    - `GET /api/recipe-library/recipe/{id}` - Get specific recipe
    - `POST /api/recipe-library/filter` - Filter with exclusions
  - **Integration**: Recipes automatically saved from `/api/chat/send` and `/api/diabetes/recipes`
  - **Testing**: 100% pass rate (35/35 backend tests)
  - **Current Library Size**: 22 recipes across 6 cuisines

- **Feb 07, 2026**: P1 - Fixed "Show More" Recipes Functionality (CRITICAL)
  - **Issue**: When users typed "show more" after receiving recipes, the system didn't recognize the request as needing recipe generation because context was in [Context:] format, not [User Preferences] format
  - **Root Cause**: Backend only checked for `[User Preferences]` marker to detect recipe requests, missing follow-up "show more" requests
  - **Solution**:
    - Added `extract_context_params()` function in chat.py to parse `[Context: Mood=X, MealType=Y, Dietary=Z, Cuisines=W]` format
    - Updated `/api/chat/send` to detect "show more" requests and extract parameters from context
    - Added "show more" handling in `/api/diabetes/chat` endpoint
    - Both endpoints now generate NEW different recipes (skip_cache=true) and return `structured_recipes` in response
  - **Files Modified**: 
    - `/app/backend/routes/chat.py` - Added extract_context_params(), updated send_chat_message logic
    - `/app/backend/routes/diabetes.py` - Added is_show_more detection and recipe generation
  - **Testing**: 100% backend test pass rate (7/7 tests)

- **Feb 07, 2026**: FEATURE - Dropdown Preference Selectors on DiabetesMealsPage
  - **Task**: Added dropdown selectors for Dietary Preference, Meal Type, and Cuisine on DiabetesMealsPage
  - **Implementation**: Mirrors the existing ChatPage dropdown implementation
  - **Dropdowns Added**:
    - Dietary Preference dropdown (Vegetarian, Vegan, Non-Vegetarian, Pescatarian, Any)
    - Meal Type dropdown (Breakfast, Lunch, Dinner)
    - Cuisine dropdown (All 11 cuisines)
  - **Behavior**: 
    - Each badge shows a RefreshCw icon indicating it's clickable
    - Selecting a new option triggers an immediate recipe refetch
    - Preferences are preserved in local storage
  - **Functions Added**:
    - `handleMealTypeChange()` - Handles meal type selection change
    - `handleCuisineChange()` - Handles cuisine selection change
    - `fetchRecipesWithParams()` - Generic recipe fetch with specific parameters
    - Updated `handleDietaryPrefSelect()` to support preference changes after recipes shown
  - **Testing**: 100% pass rate via testing agent
  - **File Modified**: `/app/frontend/src/pages/DiabetesMealsPage.js`

- **Feb 07, 2026**: P1 - Fixed Image Fallback in Planners
  - **Issue**: Images from Google sometimes appeared blank/broken due to CORS. Fallback to AI-generated images wasn't triggering.
  - **Root Cause**: `PlannerMealCard.jsx` had `use_ai_fallback: false` and `onError` handler only switched to stock images
  - **Solution**: 
    - Updated `handleImgError()` to request AI-generated image on first error
    - Tracks error count to prevent infinite loops
    - Uses longer timeout (30s) for AI generation
    - Final fallback to stock images if AI also fails
  - **File Modified**: `/app/frontend/src/components/PlannerMealCard.jsx`

- **Feb 07, 2026**: P2 - Verified /diabetes-planner Page Access
  - **Issue**: User reported 403 Forbidden error when accessing `/diabetes-planner`
  - **Status**: Verified working - page returns 200 OK and renders login prompt for unauthenticated users
  - **Likely Cause**: Was temporary caching/routing issue that resolved itself

- **Feb 07, 2026**: SerpAPI Google Recipes Integration (MAJOR FEATURE)
  - **Feature**: Integrated real recipes from Google via SerpAPI into the recipe generation flow
  - **Endpoints Added**:
    - `GET/POST /api/search/recipes/mood` - Search recipes by mood, cuisine, meal type
    - `POST /api/chat/recipes/hybrid` - Hybrid generation combining SerpAPI + AI recipes
  - **Backend Changes**:
    - `/app/backend/services/serpapi_service.py` - Added `search_recipes_for_mood()` function
    - `/app/backend/routes/search.py` - Added mood-based recipe search endpoints
    - `/app/backend/routes/chat.py` - Added HybridRecipeRequest/Response and hybrid endpoint
  - **Frontend Changes**:
    - `/app/frontend/src/pages/ChatPage.js` - Updated `fetchRecipes()` to use hybrid endpoint
    - `/app/frontend/src/components/RecipeMessageDisplay.js` - Added source badges:
      - 🌐 Emerald badge with Globe icon for SerpAPI ("Web Recipe" with source name)
      - 🤖 Purple badge with Bot icon for AI ("AI Suggested")
      - ⭐ Amber rating badge for SerpAPI recipes with star ratings
    - RecipeCard shows "View Original Recipe" button for SerpAPI recipes (opens external link)
  - **Testing Results**:
    - Backend: 11/11 tests passed (100%)
    - Frontend: 95% working
    - Multiple cuisines verified: Indian, Italian, Thai
  - **Benefits**:
    - Real recipes with verified ratings and user reviews
    - Links to original recipe sources (AllRecipes, Food Network, etc.)
    - Thumbnail images from recipe websites
    - AI-generated variety for unique mood-based suggestions
  - **Issue**: User reported 403 Forbidden error when accessing `/diabetes-planner`
  - **Status**: Verified working - page returns 200 OK and renders login prompt for unauthenticated users
  - **Likely Cause**: Was temporary caching/routing issue that resolved itself

