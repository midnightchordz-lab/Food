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
- [x] Voice AI Chef (Premium): recipe detail has "Cook hands-free" → `/app/cook.tsx` step-by-step narration (Play/Pause, Prev/Next, auto-advance). TTS via unguarded `POST /api/mobile-voice/tts` (OpenAI tts-1 through Emergent LLM key, cached mp3 served by /api/audio/file). Playback via expo-audio. Gated client-side on RevenueCat isSubscribed (free → paywall). Background/locked-screen audio needs a native build — 2026-06.
- [x] Diabetes Planner tab (Premium): new `Health` tab (`app/(tabs)/health.tsx`) → diabetes-type + dietary selectors → `POST /api/mobile-diabetes/plan` (routes/mobile_diabetes.py) returns a 7-day plan with per-meal net-carb estimate + server-computed blood-sugar flag (safe/caution/spike vs the type's carb ceiling). Summary (avg carbs/day, target/meal), colour legend, per-meal carb badges. Gated client-side on RevenueCat isSubscribed (free → upgrade lock) — 2026-06.
- [x] Snap-a-dish photo → recipe (Premium): Discover header quick-action "Snap a dish" deep-links to `/import?tab=photo` (import screen now honours an initial `tab` param). Camera/library photo → `/api/mobile-import/image` identifies the finished dish and builds a full recipe (captured photo persisted as the recipe image) — 2026-06.
- [x] Fridge Scanner (Premium): Discover quick-action "Scan my fridge" → `/app/fridge.tsx`. Camera/library photo → unguarded `POST /api/mobile-fridge/scan` (routes/mobile_fridge.py, gpt-4o-mini vision, base64 in) returns detected ingredient chips + 3 suggested recipes (tap → full recipe detail). Gated client-side on RevenueCat isSubscribed (free → upgrade lock) — 2026-06.
- [x] Fridge suggestions open the full recipe instantly (reuse scan-provided instructions via /recipe `content` param; fallback to /recipes/detailed when empty) — 2026-06.
- [x] Planner regenerate bug fixed: `/weekly-plan/generate` now deletes+replaces the week's plan (was inserting duplicates; `/weekly-plan/current` read the stale original), so changing dietary and regenerating now updates recipes — 2026-06.
- [x] Planner multiple diets (#4) + per-day diets (#5): dietary chips are multi-select and a "Customise diet by day" section sets `day_specific_preferences`; posted as `dietary_preference: string[]` + `day_specific_preferences` to `/weekly-plan/generate` (backend ai_meal_planner already supports both) — 2026-06.
- [x] Performance (#1/#6): replaced retired `source.unsplash.com` (which hangs) in `foodImage()` with fast direct Unsplash CDN photos (keyword/deterministic pick) + expo-image `cachePolicy="memory-disk"` on recipe/mood images — 2026-06.
- [x] Phone OTP sign-in (#2): welcome screen "Continue with phone" → `/auth/phone/send-otp` + `/auth/phone/verify-otp` (existing Twilio-backed endpoints; demo OTP surfaced via toast when SMS unavailable). AuthContext.sendPhoneOtp/phoneLogin store the returned JWT — 2026-06.
- [x] Cook-mode step skipping fixed: auto-advance now fires once per step on the false→true edge of `didJustFinish` (was resetting a flag on every index change, so a lingering finished-status cascaded straight to the last step). `wasFinishedRef` is set true when a new step starts playing so stale status can't re-trigger (`app/cook.tsx`) — 2026-06.
- [x] Speed (#1/#6 round 2): (a) recipe list cards NO LONGER trigger a per-card Gemini image gen — they use the fast CDN `foodImage` immediately (removed `useRecipeImage` from `RecipeCard`); AI photo now only on the recipe DETAIL hero and only for premium (`recipe.tsx`, gated on isSubscribed). (b) `/recipes/detailed` switched gpt-4o → gpt-4o-mini (~2x faster; results are DB-cached so repeat opens are instant) — 2026-06.
- [x] Recipe image accuracy upgrade: `gen_image.py` now uses a strict, accuracy-first prompt (EXACT dish, 45° overhead, restaurant plating) + a `SPECS_DB` of ~20 per-dish visual specs (biryani/pad thai/ramen/pho/sushi/pizza/burger/taco/carbonara/butter chicken/etc., substring-matched) with a generic fallback; recipe ingredients are passed into the prompt (`GenerateImageRequest.ingredients`, `useRecipeImage(...ingredients)`, `recipe.tsx` parses `p.ingredients`). Disk-cache + `/api/recipe-image/img/{hash}.png` serving unchanged. Verified: Hyderabadi Biryani renders an accurate, high-quality biryani; cached recall ~0.15s — 2026-06.
- [x] Image validation + regeneration (IMAGE_VALIDATION_PROMPT doc): `/recipe-image/ai-generate` now runs a self-validate loop — the model generates + outputs "VALIDATION: VERIFIED/REJECTED"; on REJECTED it regenerates once with escalated MUST-SHOW guidance (max 2 attempts) and always saves the best image so the user still gets one. Enhanced butter chicken/green curry specs (MUST SHOW / MUST NOT). Response gained additive `validated` flag (frontend still reads `url`; no breakage). Verified via image analysis: Butter Chicken → creamy curry (not steak), Prawn Biryani → layered saffron rice w/ prawns (not grilled fish); cached recall ~0.25s; generic dish still works — 2026-06.
- [x] Emergent-managed Google sign-in (#auth): "Continue with Google" on welcome screen. Backend `routes/google_auth.py` `POST /api/auth/session` {session_id} → exchanges with `demobackend.emergentagent.com` (X-Session-ID) → upserts user by email → returns our app JWT (same shape as login; reuses `/auth/me` + `get_current_user`). Frontend: `WebBrowser.openAuthSessionAsync` (mobile) / `window.location` redirect (web); `AuthContext.googleLogin` + a mount effect processes `session_id` from the redirect (web URL, mobile cold-start + hot `url` listener), guarded by a Set; welcome navigates to tabs when `user` is set. Verified: invalid session_id → 401; button renders. Apple Sign-In already integrated (iOS, `/auth/apple`) — 2026-06.
- [x] Quick Recipes "Use my ingredients" + Add-to-shopping-list: quick.tsx now has a pantry input (type ingredients → chips) passed as `ingredients` to `/quick-recipes/generate` (tailors the meals). Recipe detail (`recipe.tsx`) has an "Add ingredients to shopping list" button that merges the recipe's ingredients (from provided ingredients or parsed from the content's Ingredients section) into `/shopping-list` (GET+merge+POST, dedupe by name). Verified backend: list POST/GET works; quick recipes honour typed ingredients — 2026-06.
- [x] Admin hardening follow-ups — 2026-06:
  - Fixed `run_bulk_premium_correction` KeyError('id') — malformed subscription docs (missing id/user_id/plan_id) are now skipped; `/subscription/admin/fix-invalid-subscriptions` returns 200 (self-tested).
  - Replaced the shared `X-Admin-Key` secret with per-user admin roles: added `is_admin` to the User model, `require_admin_user` dependency (DB-authoritative, 403 non-admin / 401 no-token), idempotent `bootstrap_admins()` from `ADMIN_BOOTSTRAP_EMAILS` on startup, and `scripts/promote_admin.py` CLI. Admin endpoints now log the acting admin. Old X-Admin-Key rejected. Admin acct: `admin@moodfood.app`.
- [x] Security hardening batch (SECURITY-FIXES.md, all 12 findings) — 2026-06, backend-tested 15/15:
  - C1: admin auth (`require_admin` X-Admin-Key gate in `deps.py`) on `/subscription/stats` + 4 `/subscription/admin/*` endpoints.
  - C2: SSRF-guarded image proxy (`_is_safe_url`, https-only, blocks private/loopback/metadata IPs, no blind redirects, 10MB cap) in `image_generation.py`.
  - C3: Razorpay verify-payment now derives the granted plan from the paid order (rejects plan/amount mismatch + double-processing) in `subscription.py`.
  - H1: `/auth/phone/send-otp` fails closed (no `demo_otp` leak); debug return gated behind `AUTH_DEBUG_RETURN_OTP`.
  - H2: `/register-push` requires auth and derives user_id from JWT (frontend `push.ts` drops user_id, sends Bearer via new `getAuthToken`).
  - M1: CORS no longer wildcard-with-credentials (`server.py` reads explicit `CORS_ORIGINS`, dev fallback = localhost).
  - M2: `/recipe-image/ai-generate` (+ `/fast`,`/batch`,`/generate`,`/generate-batch`) now require auth; ai-generate has a 30/user/day cap.
  - M3: per-phone OTP rate limit (`check_rate_limit`, 5/hr) on both auth.py and twilio_routes.py send-otp.
  - M4: Razorpay webhook fails closed without `RAZORPAY_WEBHOOK_SECRET` + constant-time signature compare.
  - L1: email lowercased/trimmed in register + login.
  - L3: audio file-serve validates filename & resolves path before filesystem access.
  - New env vars: `ADMIN_API_KEY`, `AUTH_DEBUG_RETURN_OTP=true` (dev-only), `RAZORPAY_WEBHOOK_SECRET` (empty), `CORS_ORIGINS` set explicitly.
- [x] Diabetes Planner — Carb Detail + Swap Meal + Discover polish — 2026-06:
  - Carb Detail: opening a diabetes meal now passes `carbs`+`flag`; recipe screen shows a coloured net-carb banner ("Xg net carbs · Steady/Watch/Spike risk") under the title (`app/recipe.tsx`).
  - Swap Meal: each Health-tab meal has a shuffle button → `POST /mobile-diabetes/swap` {day, meal_type} generates a fresh carb-friendly alternative (avoiding the week's existing dishes of that type), updates the stored plan + avg, returns updated plan (slot validated before the LLM call). Backend tested 9/9 (`routes/mobile_diabetes.py`, `app/(tabs)/health.tsx`).
  - Discover polish: mood cards softened (rounded `radius.xl`, soft shadow, no hard border), image gets a gradient overlay + top-right mood icon, and a new reusable `PressableScale` (reanimated spring) gives gentle tap animation on mood cards (`app/(tabs)/index.tsx`, `src/components/PressableScale.tsx`).
- [x] Diabetes Planner meal tap → full recipe: each meal row in the Health tab is now a Pressable (with chevron) that opens `/recipe` with the meal name/type/dietary, fetching the complete detailed recipe + instructions via `/recipes/detailed` (`app/(tabs)/health.tsx`) — 2026-06.
- [x] Welcome screen polish: brand + tagline now anchored over the hero image (300px, dual-stop dark→transparent→bg gradient), badge moved to hero top; added a feature-pill row (Mood-matched / AI recipes / Weekly plans) and reworked social sign-in into a clean 2-up grid (Google + Phone) with Apple below — no functional changes (`app/welcome.tsx`) — 2026-06.
- [x] Quick Recipes (≤10 min): `POST /api/quick-recipes/generate` (routes/quick_recipes.py, gpt-4o-mini, JSON output, honours exclusions, enforces total_minutes ≤10) returns structured recipes {name,timing,total_minutes,cuisine,difficulty,ingredients,instructions,pro_tip} + speed_tips. Frontend `app/quick.tsx` (dietary + cuisine chips → generate → RecipeCards → tap opens /recipe with content built from steps + ingredients for the accurate AI photo). Entry: "10-minute meals" banner on Discover. Images NOT generated inline (kept fast); cards use CDN foodImage, detail generates the AI photo — 2026-06.

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
