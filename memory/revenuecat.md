# RevenueCat — integrated (2026-09-21)
This file is a memory for interacting with the user's RevenueCat account via the integration proxy later.

## Identifiers (from /setup response — verbatim)
- rc_project_id: proj8cda2dbe
- apple_app_id: app5382a4983f
- play_app_id: app9a1ec75d61
- entitlement_lookup_key: pro
- offering_lookup_key: default
- Packages (package -> product_id, current price):
  - $rc_monthly -> prod649d26d000  ($9.99 / P1M, trial: none)
  - $rc_annual  -> prod406f501191  ($79.99 / P1Y, trial: none)
- Dashboard: https://app.revenuecat.com/projects/proj8cda2dbe

SDK keys live in /app/frontend/.env (EXPO_PUBLIC_REVENUECAT_*). Never store key/token values here.

## Status check (project_state must be >= project_created; else re-fetch playbook)
AUTH header: `Authorization: Bearer <emergent key>` (do NOT store the value here)
GET $INTEGRATION_PROXY_URL/internal/revenuecat/projects/17c84d90-1fc0-4c30-a1a8-8ca26b428988/status

## Product updates (integration proxy ONLY — never the RevenueCat REST API)
- Upsert price/duration/trial or add package:
  POST $INTEGRATION_PROXY_URL/internal/revenuecat/projects/17c84d90-1fc0-4c30-a1a8-8ca26b428988/products
  body: {"products":[{"package":"$rc_monthly","price":14.99,"currency":"USD","period":"P1M","trial":"P1W","prices":[{"amount_micros":14990000,"currency":"USD"}]}]}
  (amount_micros = price × 1,000,000; omit "trial" for none)
- Remove package:
  DELETE $INTEGRATION_PROXY_URL/internal/revenuecat/projects/17c84d90-1fc0-4c30-a1a8-8ca26b428988/products/%24rc_monthly
- Recover identifiers / repopulate .env: re-run the idempotent /setup call.

## Going LIVE (USER does these — needed only for real store purchases; Test Store needs none)
1. Upload App Store Connect API key (.p8) + Google Play service-account JSON to the RevenueCat dashboard.
2. Set up payment profiles in App Store Connect & Play Console.
3. Create matching IAP products using the SAME product IDs from the RevenueCat dashboard (monthly/annual).
4. Make a release build, test via TestFlight / Play internal testing, then submit for review.
All steps are in the FAQ section of the payments panel.
