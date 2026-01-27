# Chef Feels - Mood-Based Meal Planning App

## Overview
A compassionate nutritional expert AI application that suggests meals based on user's mood. The app provides recipes, shopping lists, and weekly plans with a warm, empathetic tone.

## Core Features

### 1. Authentication System (COMPLETE)
- JWT-based user authentication
- User registration with dietary preferences and cuisine preferences
- Login/logout functionality

### 2. Mood-Based Chat (COMPLETE)
- AI-powered chat with OpenAI GPT-4o
- Mood detection and empathetic responses
- Recipe suggestions based on emotional state
- Global cuisine coverage (Indian, Chinese, Italian, Mexican, Japanese, Thai, Mediterranean, Korean, French)

### 3. Recipe Discovery (COMPLETE - Jan 27, 2026)
- **Explore Cuisines Page**: Browse 9 regional cuisines with beautiful cards
- **Discover Recipes Page**: View curated authentic recipes organized by cuisine
- Features:
  - Search functionality
  - Cuisine filter dropdown
  - Difficulty level filter (Easy, Medium, Hard)
  - Clean recipe cards with title, description, cooking time, difficulty, image
  - "View Full Recipe" button links to external recipe sources
  - High-quality Unsplash images (no watermarks/country codes)
- Navigation: Explore Cuisines -> Click "Explore Recipes" -> Discover Recipes Page (NOT chat redirect)

### 4. Recipe Saving & Collection (COMPLETE)
- Save recipes from chat conversations
- View saved recipes in collection
- Recipe cards with images, mood tags, cooking times
- Recipe detail modal with ingredients and instructions

### 5. Shopping List (COMPLETE)
- Add recipe ingredients to shopping list
- Checkable items
- PDF export functionality

### 6. Weekly Meal Planner (COMPLETE)
- AI-generated weekly meal plans
- Based on mood and cuisine preferences
- Save and view plans

### 7. Voice Assistant (COMPLETE)
- Speech-to-Text with OpenAI Whisper
- Text-to-Speech with OpenAI TTS
- Multi-language support (English, Hindi, Chinese, Spanish, French, Japanese, Korean, Thai, Arabic, Italian, Portuguese, Vietnamese)
- Mood-responsive voice tones

## Technical Architecture

### Backend (FastAPI)
- **server.py**: Main application with all API endpoints
- **image_service.py**: Curated Unsplash images for recipes
- **voice_service.py**: STT/TTS integration
- **pdf_generator.py**: Shopping list PDF export
- **ai_meal_planner.py**: AI meal plan generation

### Frontend (React)
- **Pages**: LandingPage, ChatPage, SavedRecipes, ShoppingListPage, WeeklyPlannerPage, ProfilePage, ExploreCuisinesPage, DiscoverRecipesPage, CuisineRecipesPage
- **Components**: Navigation, AuthModal, VoiceButton, RecipeRating, RecipeSearchFilter
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

## Upcoming Tasks (Backlog)

### P1 - High Priority
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

