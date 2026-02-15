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

### 2026-02-15 - Fork Session
- **FIXED**: Network connectivity verified in new environment
- **FIXED**: `LlmChat` initialization bug in `/app/backend/routes/chat.py` line 1253
  - Changed from incorrect `model=`, `system_prompt=` to correct `system_message=`, `.with_model()`
- **TESTED**: Recipe generation endpoint working (6 recipes returned)

### 2026-02-15 - AI Chef Feature Complete
- **IMPLEMENTED**: Secure backend AI Chef endpoints
  - `/api/chat/ai-chef/chat` - Handles voice commands and AI conversations
  - `/api/chat/ai-chef/recipe/{id}` - Fetches recipes with markdown instruction parsing
- **IMPLEMENTED**: Frontend AI Chef button in RecipeDetailModal (violet, Mic icon)
- **IMPLEMENTED**: ConversationEngine now uses backend API (secure, no frontend keys)
- **TESTED**: All flows working - step navigation, AI questions, recipe loading
- **PARSING**: Added markdown parsing for instructions from `full_content` field

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

### Pending Verification
- Android native build
- Voice features on real devices
- AI Chef feature (missing API keys + UI entry point)

---

## Prioritized Backlog

### P0 - Critical
- [x] Network connectivity restoration
- [x] Recipe generation bug fix

### P1 - High Priority
- [ ] Complete AI Chef Feature Integration
  - Add ElevenLabs API keys to frontend/.env
  - Add navigation button to RecipeDetailPage.jsx
- [ ] Android build verification

### P2 - Medium Priority
- [ ] Implement Ingredient Encyclopedia Page
- [ ] Address iOS app requirements
- [ ] ElevenLabs TTS quota notification UI

### P3 - Low Priority
- [ ] Ingredient Detail Page (dynamic route)
- [ ] Voice engine optimization on real devices

---

## Architecture

```
/app
├── backend/
│   ├── server.py
│   ├── routes/
│   │   ├── chat.py (recipes, AI chat)
│   │   ├── recipes.py
│   │   ├── diabetes.py
│   │   └── fridge_scanner.py
│   └── services/
├── frontend/
│   ├── src/
│   │   ├── App.js (routing)
│   │   ├── features-premium/ai-chef/ (isolated feature)
│   │   ├── lib/speechController.js (voice engine hub)
│   │   ├── services/AndroidVoiceEngine.js
│   │   └── pages/
│   └── capacitor.config.json
├── android/ (native project)
└── ios/ (native project)
```

## Key API Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/chat/recipes/hybrid` - Recipe generation
- `POST /api/fridge/scan` - Fridge scanning

## Test Credentials
- Email: `demouser@example.com`
- Password: `password123`
