# Apple Sign In — Testing Notes

## Config
- `app.json`: `expo.ios.usesAppleSignIn: true`, `bundleIdentifier: in.moodfood.app`
- Backend `.env`: `APPLE_AUDIENCES=in.moodfood.app,host.exp.Exponent`
- Route: `POST /api/auth/apple` → verifies `identity_token` (RS256 vs https://appleid.apple.com/auth/keys),
  upserts user by `sub` into `users`, returns `{access_token, token_type, user, is_new_user}`.

## Manual test (real device required)
1. Build/dev-client on a real iPhone, tap the Apple button on Welcome.
2. Complete Face ID / Apple ID prompt.
3. App should land on the tabs; `/api/auth/me` returns the user.

## Backend sanity (no device)
- `POST /api/auth/apple` with `{"identity_token":"bad"}` → 401 (verified working).
- A valid token's `aud` must be in APPLE_AUDIENCES or it 401s.

## Notes
- Name/email are only provided by Apple on the FIRST sign-in — persisted immediately.
- Users keyed on `apple_sub` (email may be a private relay or absent).
