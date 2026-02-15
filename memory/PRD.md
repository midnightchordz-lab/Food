# Recipe Loader App - Product Requirements Document

## Original Problem Statement
A Capacitor-based hybrid cooking app with React frontend and FastAPI backend, featuring:
- Recipe generation with AI (OpenAI)
- Voice-controlled hands-free cooking mode
- Fridge scanner for ingredient detection
- Meal planning with dietary preferences
- Premium AI Chef feature

## User Personas
- Home cooks wanting recipe inspiration
- Users with dietary restrictions (diabetes, allergies)
- Mobile users needing hands-free cooking guidance

## Core Requirements
1. Recipe discovery and generation
2. Hands-free voice-controlled cooking
3. User authentication and preferences
4. Subscription/entitlement system (free/premium)

## Tech Stack
- **Frontend**: React + Capacitor (hybrid mobile app)
- **Backend**: FastAPI + MongoDB
- **Voice**: Web Speech API + Capacitor plugins + Custom Android Voice Engine
- **AI**: OpenAI via emergentintegrations library
- **TTS**: ElevenLabs (premium), browser fallback

---

## Changelog

### 2026-02-15 - AI Chef Production Fix (Current Session)
- **COMPLETED**: AI Chef Error Handling Refactor
  - Updated `AIChefMode.jsx` with production-grade error handling
  - Added error type classification (NOT_FOUND, NETWORK, SERVER, UNKNOWN)
  - Implemented user-friendly error screens with contextual icons and messages
  - Added retry functionality for network/server errors
  - Added comprehensive data-testid attributes for testing
- **TESTED**: All error scenarios verified working
  - Invalid recipe ID → 404 → "Recipe Not Found" screen with 🔍 icon
  - Network errors → "Connection Issue" screen with 📡 icon  
  - Server errors → "Server Error" screen with 🔧 icon
  - Go Back button correctly navigates
  - Valid recipes load successfully with start screen

### 2026-02-15 - Fork Session (Earlier)
- **FIXED**: Network connectivity verified in new environment
- **FIXED**: `LlmChat` initialization bug in `/app/backend/routes/chat.py` line 1253
- **FIXED**: Recipe IDs now generated and included in all response paths
- **FIXED**: Hybrid/SerpAPI recipes now saved to library for AI Chef access
- **ADDED**: On-demand instruction generation for recipes without steps

### Previous Session Completions
- App Logo Implementation (Android/iOS icons and splash screens)
- Mobile Voice Compatibility Layer (`mobileVoiceCompat.js`, `mobileSpeechRecognition.js`)
- Production Android Voice Engine (`AndroidVoiceEngine.js`)
- Isolated AI Chef Feature structure (`frontend/src/features-premium/ai-chef/`)

---

## Current Status

### Working Features
- User authentication (register/login)
- Recipe generation via `/api/chat/recipes/hybrid`
- SerpAPI recipe search
- Voice engine architecture (untested on device)
- **AI Chef Feature (Production Ready)**
  - Recipe loading from multiple collections
  - Error handling with retry logic
  - Start cooking screen
  - Step-by-step navigation
  - Voice commands support

### Pending Verification
- Android native build
- Voice features on real devices

---

## Prioritized Backlog

### P0 - Critical
- [x] Network connectivity restoration
- [x] Recipe generation bug fix
- [x] AI Chef Error Handling Production Fix

### P1 - High Priority
- [ ] Android build verification
- [ ] Implement Ingredient Encyclopedia Page
- [ ] Address iOS app requirements query

### P2 - Medium Priority
- [ ] ElevenLabs TTS quota notification UI
- [ ] Ingredient Detail Page (dynamic route `/ingredients/:id`)

### P3 - Low Priority
- [ ] Voice engine optimization on real devices

---

## Architecture

```
/app
├── backend/
│   ├── server.py
│   ├── routes/
│   │   ├── chat.py (recipes, AI chat, AI Chef endpoints)
│   │   ├── recipes.py
│   │   ├── diabetes.py
│   │   └── fridge_scanner.py
│   └── services/
├── frontend/
│   ├── src/
│   │   ├── App.js (routing, includes /recipes/:id/ai-chef route)
│   │   ├── features-premium/ai-chef/
│   │   │   ├── AIChefMode.jsx (main component - UPDATED)
│   │   │   ├── AIChef.css (styles - UPDATED)
│   │   │   ├── ConversationEngine.js
│   │   │   ├── EmotionalNarrator.js
│   │   │   └── VoiceRecognition.js
│   │   ├── components/RecipeDetailModal.js (has AI Chef button)
│   │   ├── lib/speechController.js
│   │   └── pages/
│   └── capacitor.config.json
├── android/ (native project)
└── ios/ (native project)
```

## Key API Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/chat/recipes/hybrid` - Recipe generation
- `GET /api/chat/ai-chef/recipe/{recipe_id}` - Get recipe for AI Chef
- `POST /api/chat/ai-chef/chat` - AI Chef conversation
- `POST /api/fridge/scan` - Fridge scanning

## Test Credentials
- Email: `demouser@example.com`
- Password: `password123`

## Test Reports
- `/app/test_reports/iteration_88.json` - AI Chef Error Handling Tests (All Passing)
