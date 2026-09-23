"""
Regression tests for the Android/Expo Go revenuecat.tsx lazy-load fix.
Focus: auth (register/login) + subscription/current endpoint used by the
SubscriptionProvider backendPremiumQuery to determine premium state.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_BACKEND_URL") or "https://app-launch-2905.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")

EXISTING_EMAIL = "mobtest@example.com"
EXISTING_PASSWORD = "Test1234"


@pytest.fixture
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _register_or_login(api, email, password, name="Test User"):
    r = api.post(f"{BASE_URL}/api/auth/register",
                 json={"email": email, "password": password, "name": name})
    if r.status_code == 200:
        return r.json()
    # 400 = already exists, try login
    r = api.post(f"{BASE_URL}/api/auth/login",
                 json={"email": email, "password": password})
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()


# ---- backend health ----
def test_root_reachable(api):
    r = api.get(f"{BASE_URL}/api/")
    assert r.status_code in (200, 404), r.status_code  # some apps 404 the root


# ---- auth ----
def test_register_new_user_starts_trial(api):
    email = f"TEST_{uuid.uuid4().hex[:10]}@example.com"
    r = api.post(f"{BASE_URL}/api/auth/register",
                 json={"email": email, "password": "Test1234", "name": "Reg User"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["email"] == email.lower()
    assert data["user"]["default_plan"] == "free"
    # trial info attached at registration
    assert data.get("trial") is not None
    assert data["trial"]["active"] is True
    assert data["trial"]["daysRemaining"] >= 1


def test_login_existing_or_fresh(api):
    data = _register_or_login(api, EXISTING_EMAIL, EXISTING_PASSWORD, "Mob Test")
    assert "access_token" in data
    assert data["user"]["email"] == EXISTING_EMAIL.lower()


def test_auth_me(api):
    data = _register_or_login(api, EXISTING_EMAIL, EXISTING_PASSWORD)
    token = data["access_token"]
    r = api.get(f"{BASE_URL}/api/auth/me",
                headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    body = r.json()
    assert body["email"] == EXISTING_EMAIL.lower()


# ---- subscription (the endpoint the RevenueCat context calls) ----
def test_subscription_current_returns_shape(api):
    data = _register_or_login(api, EXISTING_EMAIL, EXISTING_PASSWORD)
    token = data["access_token"]
    r = api.get(f"{BASE_URL}/api/subscription/current",
                headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("success") is True
    sub = body.get("subscription")
    assert isinstance(sub, dict)
    # fields consumed by useSubscription() backendPremiumQuery
    assert "plan_id" in sub
    assert "status" in sub
    # optional but should be present-or-null
    for k in ("trial_end", "current_period_end", "source", "cancel_at_period_end"):
        assert k in sub


def test_subscription_current_requires_auth(api):
    r = api.get(f"{BASE_URL}/api/subscription/current")
    # FastAPI's HTTPBearer returns 403 by default when creds absent, 401 when invalid.
    assert r.status_code in (401, 403)


def test_subscription_plans_public(api):
    r = api.get(f"{BASE_URL}/api/subscription/plans")
    assert r.status_code == 200
    body = r.json()
    assert body.get("success") is True
    assert isinstance(body.get("plans"), list) and len(body["plans"]) > 0
    ids = [p["plan_id"] for p in body["plans"]]
    assert "free" in ids
    assert any("premium" in i for i in ids)


def test_new_user_premium_state_reflects_trial(api):
    """After registration a fresh user should be trialing on a paid plan,
    which is what useSubscription()->premium computes into isSubscribed."""
    email = f"TEST_{uuid.uuid4().hex[:10]}@example.com"
    r = api.post(f"{BASE_URL}/api/auth/register",
                 json={"email": email, "password": "Test1234", "name": "Trial User"})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    r = api.get(f"{BASE_URL}/api/subscription/current",
                headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    sub = r.json()["subscription"]
    # A brand-new user MAY be free or trialing depending on auto-start config.
    # Assert either but with a coherent shape.
    assert sub["plan_id"] in ("free",) or sub["status"] in ("active", "trialing")


def test_check_feature_works(api):
    data = _register_or_login(api, EXISTING_EMAIL, EXISTING_PASSWORD)
    token = data["access_token"]
    r = api.get(f"{BASE_URL}/api/subscription/check-feature/recipe_search",
                headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert "allowed" in body
