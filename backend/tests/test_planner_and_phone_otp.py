"""
Backend regression tests for iteration 111:
  * BUG #3   POST /api/weekly-plan/generate REPLACES the week's plan
             (regenerate must not leave the stale first doc behind).
  * FEATURE #4/#5  /weekly-plan/generate accepts:
             - dietary_preference as an array e.g. ["vegetarian", "non-vegetarian"]
             - day_specific_preferences dict e.g. {"Monday": "vegetarian", ...}
             and returns a 200 plan with 7 days x 3 meals.
  * AUTH #2  POST /api/auth/phone/send-otp returns demo_otp when SMS is
             unavailable in this preview, and /verify-otp completes the login.
"""
import os
import time
import pytest
import requests


BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL / EXPO_BACKEND_URL must be set"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
MEAL_TYPES = ["breakfast", "lunch", "dinner"]


# ---------- shared fixtures ----------
@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_headers(api_client):
    """Register a fresh email/password account and return Bearer headers."""
    ts = int(time.time())
    email = f"pl_test+{ts}@example.com"
    r = api_client.post(
        f"{API}/auth/register",
        json={"name": "Planner Test", "email": email, "password": "Test1234"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- helpers ----------
def _collect_meal_names(meals: dict) -> set:
    names = set()
    for day, day_meals in (meals or {}).items():
        if not isinstance(day_meals, dict):
            continue
        for mt, v in day_meals.items():
            if isinstance(v, str):
                names.add(v.split("(~")[0].strip())
    return names


def _assert_full_week_plan(meals: dict):
    """Plan must have all 7 weekdays and each day must have b/l/d meals."""
    lower_keys = {k.lower(): v for k, v in (meals or {}).items()}
    for d in DAYS:
        day_meals = meals.get(d) or lower_keys.get(d.lower())
        assert isinstance(day_meals, dict), f"missing meals for {d}: {meals!r}"
        for mt in MEAL_TYPES:
            v = day_meals.get(mt)
            assert isinstance(v, str) and len(v) > 2, f"{d}/{mt} missing/short: {v!r}"


# ============== BUG #3: regenerate REPLACES the plan ==============
class TestWeeklyPlanReplacement:
    """Second generate for the same week must OVERWRITE the first."""

    def test_regenerate_replaces_week_plan(self, api_client, auth_headers):
        # First generation: non-vegetarian
        r1 = api_client.post(
            f"{API}/weekly-plan/generate",
            headers=auth_headers,
            json={
                "mood": "cozy",
                "dietary_preference": ["non-vegetarian"],
                "focus_areas": [],
                "cuisine_preferences": [],
            },
            timeout=180,
        )
        assert r1.status_code == 200, r1.text
        plan_v1 = r1.json().get("plan", {})
        meals_v1 = plan_v1.get("meals") or {}
        assert meals_v1, "first generation returned empty meals"
        week_start_v1 = plan_v1.get("week_start")
        assert week_start_v1

        # Read /current to be sure it's stored
        rc = api_client.get(f"{API}/weekly-plan/current", headers=auth_headers, timeout=30)
        assert rc.status_code == 200, rc.text
        cur1 = rc.json()
        assert cur1["has_plan"] is True
        assert cur1["plan"]["week_start"] == week_start_v1
        names_v1_current = _collect_meal_names(cur1["plan"]["meals"])
        assert names_v1_current, "no meals visible in /current after first gen"

        # Second generation for the SAME week: vegetarian
        r2 = api_client.post(
            f"{API}/weekly-plan/generate",
            headers=auth_headers,
            json={
                "mood": "cozy",
                "dietary_preference": ["vegetarian"],
                "focus_areas": [],
                "cuisine_preferences": [],
            },
            timeout=180,
        )
        assert r2.status_code == 200, r2.text
        plan_v2 = r2.json().get("plan", {})
        meals_v2 = plan_v2.get("meals") or {}
        assert meals_v2
        assert plan_v2["week_start"] == week_start_v1, "week_start drifted"
        assert plan_v2["id"] != plan_v1["id"], "new plan should have a new id"

        # /current must now return the SECOND plan (regenerate replaces)
        rc2 = api_client.get(f"{API}/weekly-plan/current", headers=auth_headers, timeout=30)
        assert rc2.status_code == 200
        cur2 = rc2.json()
        assert cur2["has_plan"] is True
        assert cur2["plan"]["id"] == plan_v2["id"], (
            "regenerate did not replace: /current still returns old plan"
        )

        # And only ONE plan doc should exist for this week
        rlist = api_client.get(f"{API}/weekly-plan", headers=auth_headers, timeout=30)
        assert rlist.status_code == 200
        plans = rlist.json().get("plans", [])
        same_week = [p for p in plans if p.get("week_start") == week_start_v1]
        assert len(same_week) == 1, (
            f"Expected exactly 1 plan for week {week_start_v1}, got {len(same_week)}"
        )

        # Meals should have changed (very loose sanity: not identical set)
        names_v2 = _collect_meal_names(meals_v2)
        assert names_v2, "second generation returned empty meals"
        # Not asserting strict inequality (AI could theoretically repeat),
        # but overlap should not be 100% for a diet flip.
        overlap_ratio = (
            len(names_v1_current & names_v2) / max(len(names_v1_current | names_v2), 1)
        )
        assert overlap_ratio < 1.0, (
            f"regenerate produced an identical set of meals — likely stale plan. "
            f"v1={sorted(names_v1_current)} v2={sorted(names_v2)}"
        )


# ============== FEATURE #4/#5: multi-select + day-specific diets ==============
class TestMultiSelectAndDayPrefs:
    def test_generate_accepts_array_and_day_specific(self, api_client, auth_headers):
        r = api_client.post(
            f"{API}/weekly-plan/generate",
            headers=auth_headers,
            json={
                "mood": "cozy",
                "dietary_preference": ["vegetarian", "non-vegetarian"],
                "focus_areas": [],
                "cuisine_preferences": [],
                "day_specific_preferences": {
                    "Monday": "vegetarian",
                    "Friday": "non-vegetarian",
                },
            },
            timeout=180,
        )
        assert r.status_code == 200, r.text
        plan = r.json().get("plan", {})
        meals = plan.get("meals") or {}
        _assert_full_week_plan(meals)


# ============== AUTH #2: phone OTP ==============
class TestPhoneOtp:
    def test_send_otp_returns_demo_otp_and_verify_succeeds(self, api_client):
        # Use a unique phone number to avoid colliding with an existing user.
        # +1555 range is safe for demo.
        phone = f"+1555000{int(time.time()) % 10000:04d}"

        r = api_client.post(
            f"{API}/auth/phone/send-otp",
            json={"phone_number": phone},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("status") == "pending"
        # SMS is not available in preview -> backend must expose demo_otp
        demo_otp = body.get("demo_otp")
        assert demo_otp and len(str(demo_otp)) == 6, f"demo_otp missing in send-otp response: {body}"

        # Verify
        v = api_client.post(
            f"{API}/auth/phone/verify-otp",
            json={"phone_number": phone, "code": str(demo_otp)},
            timeout=30,
        )
        assert v.status_code == 200, v.text
        vb = v.json()
        assert vb.get("access_token")
        assert vb.get("token_type") == "bearer"
        assert vb.get("user", {}).get("phone_number") == phone
        assert vb.get("is_new_user") is True

        # Token should authenticate /auth/me
        me = api_client.get(
            f"{API}/auth/me",
            headers={"Authorization": f"Bearer {vb['access_token']}"},
            timeout=30,
        )
        assert me.status_code == 200, me.text
        assert me.json().get("phone_number") == phone

    def test_send_otp_rejects_bad_format(self, api_client):
        r = api_client.post(
            f"{API}/auth/phone/send-otp",
            json={"phone_number": "1234"},
            timeout=15,
        )
        assert r.status_code == 400, r.text

    def test_verify_otp_wrong_code(self, api_client):
        phone = f"+1555111{int(time.time()) % 10000:04d}"
        r = api_client.post(f"{API}/auth/phone/send-otp", json={"phone_number": phone}, timeout=15)
        assert r.status_code == 200
        v = api_client.post(
            f"{API}/auth/phone/verify-otp",
            json={"phone_number": phone, "code": "000000"},
            timeout=15,
        )
        assert v.status_code == 400
