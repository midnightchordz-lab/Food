"""
Focused pytest for review request (iteration 125):
 1) POST /api/trial/activate self-heal path.
 2) POST /api/quick-recipes/generate-validated -> instructions >= 5 detailed steps.
 3) POST /api/quick-recipes/generate -> instructions >= 5 detailed steps.
 4) POST /api/recipes/detailed -> markdown has '## Step-by-Step Instructions' and multiple '**Step N**' blocks.

Uses external EXPO_BACKEND_URL. Uses MongoDB direct access to simulate
user_subscriptions desync while trial_end_date on the user doc is still in the
future.
"""

import os
import re
import time
import uuid
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("EXPO_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "https://app-launch-2905.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

# Load backend env for MongoDB access
def _load_env():
    env = {}
    try:
        with open("/app/backend/.env") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip("'").strip('"')
    except Exception:
        pass
    return env

_ENV = _load_env()
MONGO_URL = _ENV.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = _ENV.get("DB_NAME", "moodfood_production")


@pytest.fixture(scope="module")
def mongo_db():
    client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
    return client[DB_NAME]


@pytest.fixture(scope="module")
def registered_user():
    """Register a fresh account so we get a JWT + fresh trial state."""
    email = f"qa_iter125_{uuid.uuid4().hex[:10]}@example.com"
    password = "Test1234!"
    r = requests.post(f"{API}/auth/register", json={
        "email": email,
        "password": password,
        "name": "QA Iter125",
    }, timeout=30)
    assert r.status_code in (200, 201), f"Register failed {r.status_code}: {r.text[:400]}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    user = data.get("user") or {}
    user_id = user.get("id") or user.get("_id") or data.get("user_id")
    # Some backends require separate login
    if not token:
        rl = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
        assert rl.status_code == 200
        token = rl.json().get("access_token") or rl.json().get("token")
        user_id = user_id or (rl.json().get("user") or {}).get("id")
    assert token, f"No token in register/login response: {data}"
    return {"email": email, "password": password, "token": token, "user_id": user_id}


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# =============== 1) TRIAL ACTIVATE — FRESH + SELF-HEAL ===============

class TestTrialActivate:
    def test_activate_for_fresh_account_returns_premium(self, registered_user):
        r = requests.post(f"{API}/trial/activate", json={"platform": "android"},
                          headers=_auth_headers(registered_user["token"]), timeout=30)
        assert r.status_code == 200, f"activate status={r.status_code} body={r.text[:500]}"
        body = r.json()
        assert body.get("success") is True
        assert body.get("premium") is True, f"Expected premium=True on fresh account, got: {body}"
        assert body.get("trial_used") is False, f"Expected trial_used=False, got: {body}"

    def test_subscription_current_reports_premium_trialing(self, registered_user):
        r = requests.get(f"{API}/subscription/current",
                         headers=_auth_headers(registered_user["token"]), timeout=30)
        assert r.status_code == 200, r.text[:400]
        sub = (r.json() or {}).get("subscription") or {}
        assert sub.get("plan_id") and sub.get("plan_id") != "free", f"plan_id should not be free: {sub}"
        assert sub.get("status") in ("trialing", "active"), f"status should be trialing/active: {sub}"

    def test_activate_self_heal_after_desync(self, registered_user, mongo_db):
        """Delete user_subscriptions doc but keep user's trial_end_date in future.
        /trial/activate MUST re-activate (not push to payment)."""
        uid = registered_user["user_id"]
        assert uid, "Need user_id for direct DB access"

        # Confirm user doc has future trial_end_date
        udoc = mongo_db.users.find_one({"id": uid})
        assert udoc is not None, "User not found in DB"
        assert udoc.get("trial_end_date"), "trial_end_date should be set after activation"

        # Simulate desync: wipe user_subscriptions for this user
        res = mongo_db.user_subscriptions.delete_many({"user_id": uid})
        assert res.deleted_count >= 1, "Expected at least 1 subscription doc to delete"

        # Call activate again
        r = requests.post(f"{API}/trial/activate", json={"platform": "android"},
                          headers=_auth_headers(registered_user["token"]), timeout=30)
        assert r.status_code == 200, f"activate self-heal status={r.status_code} body={r.text[:500]}"
        body = r.json()
        assert body.get("premium") is True, f"Self-heal MUST return premium=True, got: {body}"
        assert body.get("trial_used") is False, f"Self-heal MUST NOT return trial_used=True, got: {body}"
        reason = (body.get("reason") or "").lower()
        assert "re-activated" in reason or "already active" in reason, f"Unexpected reason: {body}"

        # Verify subscription record recreated
        r2 = requests.get(f"{API}/subscription/current",
                          headers=_auth_headers(registered_user["token"]), timeout=30)
        assert r2.status_code == 200
        sub = (r2.json() or {}).get("subscription") or {}
        assert sub.get("plan_id") and sub.get("plan_id") != "free", f"After self-heal plan_id should not be free: {sub}"
        assert sub.get("status") in ("trialing", "active"), sub


# =============== 2) QUICK RECIPES — DETAILED INSTRUCTIONS ===============

def _step_is_detailed(step: str) -> bool:
    """A 'detailed' step: a full sentence >= 6 words and >= 30 chars."""
    s = str(step).strip()
    return len(s) >= 30 and len(s.split()) >= 6


class TestQuickRecipeInstructions:
    def test_generate_validated_has_detailed_steps(self, registered_user):
        payload = {
            "count": 2, "dietary": "balanced", "cuisine": "italian",
            "mood": "energizing", "ingredients": [], "equipment": "basic",
        }
        r = requests.post(f"{API}/quick-recipes/generate-validated", json=payload,
                          headers=_auth_headers(registered_user["token"]), timeout=180)
        assert r.status_code == 200, f"generate-validated status={r.status_code} body={r.text[:500]}"
        body = r.json()
        recipes = body.get("recipes", [])
        assert len(recipes) >= 1, f"No recipes returned: {body}"
        for i, rec in enumerate(recipes):
            steps = rec.get("instructions", [])
            assert len(steps) >= 5, f"Recipe {i} '{rec.get('name')}' has only {len(steps)} steps: {steps}"
            detailed = [s for s in steps if _step_is_detailed(s)]
            assert len(detailed) >= 5, (
                f"Recipe {i} '{rec.get('name')}' does not have >=5 detailed steps. "
                f"Steps: {steps}"
            )

    def test_generate_has_detailed_steps(self, registered_user):
        payload = {
            "count": 2, "dietary": "balanced", "cuisine": "indian",
            "mood": "energizing", "ingredients": [], "equipment": "basic",
        }
        r = requests.post(f"{API}/quick-recipes/generate", json=payload,
                          headers=_auth_headers(registered_user["token"]), timeout=120)
        assert r.status_code == 200, f"generate status={r.status_code} body={r.text[:500]}"
        body = r.json()
        recipes = body.get("recipes", [])
        assert len(recipes) >= 1, f"No recipes returned: {body}"
        for i, rec in enumerate(recipes):
            steps = rec.get("instructions", [])
            assert len(steps) >= 5, f"Recipe {i} '{rec.get('name')}' has only {len(steps)} steps: {steps}"
            detailed = [s for s in steps if _step_is_detailed(s)]
            assert len(detailed) >= 5, (
                f"Recipe {i} '{rec.get('name')}' does not have >=5 detailed steps. "
                f"Steps: {steps}"
            )


# =============== 3) DETAILED RECIPE MARKDOWN ===============

class TestDetailedRecipeInstructions:
    def test_detailed_recipe_has_step_by_step_section(self, registered_user, mongo_db):
        # Clear any cache for this title so we exercise LLM generation with new prompt
        title = f"Chicken Stir Fry {uuid.uuid4().hex[:6]}"
        try:
            mongo_db.detailed_recipes.delete_many({"title_lower": title.lower().strip()})
        except Exception:
            pass

        payload = {
            "recipe_title": title, "cuisine": "Chinese",
            "meal_type": "Dinner", "dietary_pref": "Any",
        }
        r = requests.post(f"{API}/recipes/detailed", json=payload,
                          headers=_auth_headers(registered_user["token"]), timeout=120)
        assert r.status_code == 200, f"detailed status={r.status_code} body={r.text[:500]}"
        md = (r.json() or {}).get("recipe", "")
        assert isinstance(md, str) and md, "Empty recipe markdown"
        # Header may include an emoji (e.g. '## 📋 Step-by-Step Instructions')
        assert re.search(r"##\s*[^\n]*Step-by-Step Instructions", md), (
            "Missing '## Step-by-Step Instructions' header. Preview:\n" + md[:1200]
        )
        step_blocks = re.findall(r"\*\*Step\s+\d+", md)
        assert len(step_blocks) >= 3, (
            f"Expected multiple '**Step N**' blocks, found {len(step_blocks)}. Preview:\n" + md[:1500]
        )
