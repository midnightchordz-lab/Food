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
- [x] Shopping List screen (Profile → screen): manual add, check/uncheck, remove, clear-checked, persistence (GET/POST /api/shopping-list) + add-from-saved-recipe cart button (POST /api/recipes/{id}/add-to-shopping-list) — 2026-09-21.
- [x] Exclusion Badge on Discover header (shows active exclusions, taps to editor) and exclusions now injected into AI recipe generation prompt — 2026-09-21.
- [x] Fixed query-key collision crash: profile.tsx no longer overwrites the ['saved-recipes'] array cache with a count.
- [x] RevenueCat in-app subscriptions (Emergent-managed) — 2026-09-21: paywall (/paywall) with Monthly $9.99 + Annual $79.99, `pro` entitlement, identity binding (explicit identityBound flag), purchase + restore (cache seeded onSuccess), Profile upgrade card, and free-tier gating (2 recipe regenerations then paywall). Verified end-to-end on RC Test Store. State in /app/memory/revenuecat.md. Real store purchases need user store-side setup (App Store/Play IAP products + credentials).
- [x] 7-day free trial on the annual plan (RevenueCat P1W); paywall shows trial via product introPrice (real store builds only — web Test Store doesn't expose it) — 2026-09-21.
- [x] Premium-gated AI recipe photos: subscribers get AI-generated food photos; free users see a stock placeholder + "AI photo · Premium" badge (client-side gate via useSubscription) — 2026-09-21.
- [x] Recipe Import (Premium): Saved '+' → /import screen; import from link or pasted text via unguarded /api/mobile-import/url|text (AI convert), preview, save via /api/import/save. Gated client-side on RevenueCat isSubscribed (free users see paywall lock) — 2026-09-21.
- [x] Trial badge "7 days free" on Profile Premium card for non-subscribers — 2026-09-21.
- [x] Premium Planner: free users see a 2-day preview + upgrade lock card; subscribers get full 7 days (client-side gate) — 2026-09-21.
- [x] Meal Plan → List: subscribers' "Add week to shopping list" appends all plan meals to /api/shopping-list — 2026-09-21.
- [x] Import from Photo (Premium): Import screen 'Photo' tab (camera/library via expo-image-picker + permissions) → /api/mobile-import/image (AI vision) — 2026-09-21.
- [x] Recipe Ratings: 5-star row on Saved cards (POST /api/recipes/{id}/rate, GET /api/recipes/my-ratings); Saved list sorts highest-rated first — 2026-09-21.
- [x] Import Photo Polish: captured photo is stored (disk, served under /api/recipe-image/img) and becomes the recipe's image — shown in the import preview and on the saved card. /import/save now honors a provided image_url; RecipeCard resolves relative /api image URLs — 2026-09-21.
- [x] Rating Filter: Saved tab has "All" / "4★ & up" filter chips (with top-rated count); top-rated filter shows only recipes rated ≥4 (`app/(tabs)/saved.tsx`) — 2026-06.
- [x] Meal Plan → Recipe: planner meal rows are tappable → open full recipe detail (`/recipe`) with the meal name as title (`app/(tabs)/planner.tsx`) — 2026-06.
- [x] Weekly Plan Reminders (push): Emergent-managed push relay (`routes/push.py`: /api/register-push + send_push). Scheduler (`services/scheduled_tasks.py`) sends a Sunday 10:00 UTC "plan your week" nudge to all registered users. Frontend registers device on auth + tap-routing/denied-nudge in `app/_layout.tsx`. Requires deploy + native build to actually deliver (Expo Go/web cannot). EMERGENT_PUSH_KEY=placeholder in backend .env (deployer injects real key) — 2026-06.

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
