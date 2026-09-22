# MoodFood — Test Credentials

## Email / Password (works everywhere incl. Expo Go, web preview)
Register any new account from the Welcome screen, or use:
- Email: `mobtest@example.com`
- Password: `Test1234`

(If login fails, the account may not exist yet in this DB — just register a fresh one; registration also starts a 7-day trial automatically.)

## Admin account (per-user admin role) — 2026-06
- Email: `admin@moodfood.app`
- Password: `Admin@12345`
- `is_admin: true` (promoted via ADMIN_BOOTSTRAP_EMAILS on startup + scripts.promote_admin).
- Grants access to `/api/subscription/stats` and `/api/subscription/admin/*` (403 for non-admins, 401 without token). The old shared `X-Admin-Key` header no longer works.
- To promote another existing account: `cd /app/backend && python -m scripts.promote_admin <email>` (add `--revoke` to demote).

## Apple Sign In
- iOS only, requires a real Apple ID on a physical device / TestFlight build.
- Cannot be tested in Expo Go's simulator or on web/Android.
- Backend route: `POST /api/auth/apple` (verifies identity token vs Apple JWKS).

## Google Auth (Emergent-managed) — 2026-06
- Endpoint: POST /api/auth/session { session_id } -> exchanges with Emergent, upserts user by email, returns app JWT.
- Cannot be tested headlessly (needs real Google login via auth.emergentagent.com). Invalid session_id -> 401 (verified).
- Test accounts: use any Google account at runtime; users are upserted by email into `users`.
