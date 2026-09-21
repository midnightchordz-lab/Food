# MoodFood — Test Credentials

## Email / Password (works everywhere incl. Expo Go, web preview)
Register any new account from the Welcome screen, or use:
- Email: `mobtest@example.com`
- Password: `Test1234`

(If login fails, the account may not exist yet in this DB — just register a fresh one; registration also starts a 7-day trial automatically.)

## Apple Sign In
- iOS only, requires a real Apple ID on a physical device / TestFlight build.
- Cannot be tested in Expo Go's simulator or on web/Android.
- Backend route: `POST /api/auth/apple` (verifies identity token vs Apple JWKS).
