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

## Upcoming Tasks (Backlog)

### P1 - High Priority
- [ ] Add more recipes to the curated database
- [ ] Improve voice agent response speed (optimize TTS)

### P2 - Medium Priority
- [ ] Auto-detect browser language for voice default
- [ ] Recipe rating and review system enhancements
- [ ] Meal prep reminders and notifications

### P3 - Low Priority  
- [ ] Server.py refactoring into modular routers
- [ ] Real-time web search for recipes (when API available)

## Changelog
- **Jan 27, 2026**: Fixed Recipe Discovery feature
  - Fixed `/api/recipes/discover` endpoint (removed broken web_search_tool_v2 import)
  - Updated `image_service.py` with curated Unsplash images for 9 cuisines
  - Verified navigation from Explore Cuisines -> Discover Recipes works correctly
  - All tests passing (100% success rate)
