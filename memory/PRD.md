# MoodFood Mobile — Product Requirements Document

## Original Problem Statement
Convert the existing MoodFood web application (GitHub: midnightchordz-lab/Food) into a native
mobile app on the new Emergent (Expo) platform, reusing the existing FastAPI + MongoDB backend.
Mid-build additions requested by user: (1) AI recipe image generation (Gemini Nano Banana),
(2) Sign in with Apple, alongside existing email/password auth.

## Architecture
- **Backend**: Existing full MoodFood FastAPI + MongoDB backend (ported as-is into /app/backend,
  all original routers running: auth, chat, recipes, meal_planning, diabetes, family, voice,
  shopping, subscription, twilio, fridge_scanner, etc.). Runs on :8001, all routes under /api.
- **Frontend**: NEW Expo SDK 57 app (expo-router) in /app/frontend replacing the old React web app
  (backed up at /app/web_frontend_old). Brand theme (Warm Bone / Sage / Terracotta, Cormorant
  Garamond + Manrope fonts) preserved in src/theme.ts.
- **New backend routers**: routes/gen_image.py (Gemini `gemini-3.1-flash-image-preview` recipe
  photos, disk-cached, served under /api), routes/apple_auth.py (Apple JWKS verify → our JWT).

## User Personas
- Home cooks who want meal ideas matched to how they feel (stressed, cozy, energetic, etc.).
- Users wanting weekly meal plans and a saved recipe collection.

## Core Requirements (static)
- Mood → meal type → dietary → cuisine guided flow → 4 AI recipe suggestions.
- Save recipes; view saved collection.
- Weekly AI meal planner.
- Full detailed recipe view (AI-generated, markdown rendered).
- Email/password auth + Apple Sign In (iOS).
- AI-generated food photo per recipe.

## Implemented (2026-09-21)
- [x] Expo SDK 57 scaffold, expo-router, brand theme + fonts, safe-area, toasts, tabs (NativeTabs on iOS 26+).
- [x] Auth: email/password (register/login/me) with persisted token; Apple Sign In (iOS-only button + backend verify).
- [x] Discover: mood grid + guided wizard → POST /api/chat/send → structured recipes.
- [x] Recipe cards with AI-generated photos (Gemini Nano Banana), Unsplash placeholder while plating.
- [x] Recipe detail modal: POST /api/recipes/detailed with markdown renderer + save.
- [x] Saved tab (GET /api/recipes/saved), pull-to-refresh.
- [x] Planner tab (GET/POST /api/weekly-plan) with mood + dietary selectors.
- [x] Profile tab (user info, saved count, sign out).
- [x] Backend tested: 13/13 endpoints pass.
- [x] Food Exclusions & Allergies editor (Profile → screen; GET/POST /api/exclusions) — 2026-09-21. Also fixed a legacy `userId` unique index on user_exclusions (now `user_id`, migrated on startup).

## Backlog
### P1
- Wire food/exclusions preferences into Discover chips display (editor DONE).
- Shopping list screen (backend ready: /api/shopping-list, add-to-list from recipe).
- Recipe import (URL/photo/text) — backend routes/import_recipe.py exists.
### P2
- Diabetes-friendly planner tab (backend routes/diabetes.py).
- Voice AI chef (ElevenLabs) — backend voice.py; needs native build.
- Family plan + invites (backend family.py).
- Subscription / premium gating (Razorpay) — backend subscription.py.
### P3
- Fridge scanner (camera) — backend fridge_scanner.py.
- Ingredient encyclopedia.

## Notes
- Apple Sign In works only on a real iOS build/device (not Expo Go, Android, or web).
- AI images cached on backend disk by md5(title|cuisine); for production scale, move to object storage.
- Test creds: /app/memory/test_credentials.md. Apple testing: /app/auth_testing.md.
