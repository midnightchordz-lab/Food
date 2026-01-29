# MoodFood - Mood-Based Meal Planning App

## Overview
A mood-based recipe discovery application where users receive personalized meal suggestions based on their current emotional state, dietary preferences, meal type, and cuisine choices.

## Core Features

### 1. Authentication System (COMPLETE - Updated Jan 27, 2026)
- JWT-based user authentication
- **Email Login**: Traditional email/password registration and login
- **Phone Number Login (Phase 3)**: SMS OTP verification
  - Country code selector (10+ countries)
  - Phone number input with formatting
  - 6-digit OTP verification
  - Demo mode: OTP shown in toast when Twilio not configured
  - New user profile setup after first verification
- User registration with dietary preferences and cuisine preferences
- Login/logout functionality

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

### Backend (FastAPI)
- **server.py**: Main application with all API endpoints
- **image_service.py**: Curated Unsplash images for recipes
- **voice_service.py**: STT/TTS integration
- **pdf_generator.py**: Shopping list PDF export
- **ai_meal_planner.py**: AI meal plan generation

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

### P1 - High Priority
- [ ] Complete Phone Authentication (requires Twilio API keys)
- [ ] Persist Meal Plans & Subscriptions to backend
- [ ] Verify image display for previously saved recipes
- [ ] Improve voice agent response speed (optimize TTS)

### P2 - Medium Priority
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

