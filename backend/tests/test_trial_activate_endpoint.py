"""
Tests for POST /api/trial/activate - the one-tap trial activation used by the
paywall CTA on Android.

Covers:
- Brand-new user (trial wiped): activate -> premium=true, reason "Trial started",
  and GET /api/subscription/current then shows plan_id=premium_monthly, status=trialing
- User with an already-active trial: activate -> premium=true, reason
  "Trial already active" (NOT wrongly trial_used=true)
- Idempotency: calling activate twice does not error or create duplicates
- POST /api/recipe-image/ai-generate returns 200 with url; 2nd identical call is cached
- The image is actually served at the returned /api/recipe-image/img/<key>.png URL
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_BACKEND_URL", "https://app-launch-2905.preview.emergentagent.com").rstrip("/")


def _register(email: str, name: str = "TEST Trial Activate") -> dict:
    r = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={
            "email": email,
            "password": "Test1234",
            "name": name,
            "dietary_restrictions": [],
            "cuisine_preferences": [],
        },
        timeout=30,
    )
    assert r.status_code == 200, f"register failed {r.status_code}: {r.text}"
    return r.json()


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ------------------------------------------------------------------
# Trial activate endpoint
# ------------------------------------------------------------------
class TestTrialActivate:
    """POST /api/trial/activate"""

    @pytest.fixture(scope="class")
    def fresh_user(self):
        # Fresh user auto-starts a trial on register — we need to fake a
        # "trial removed" state so that /activate actually starts a NEW trial
        # and returns reason "Trial started".
        email = f"TEST_activate_fresh_{uuid.uuid4().hex[:10]}@example.com"
        data = _register(email)
        token = data["access_token"]

        # Reset trial state via mongo directly (test-only): clear user trial flags
        # and delete their auto-created subscription, so /activate has to run the
        # "Trial started" branch.
        import pymongo
        client = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        dbname = os.environ.get("DB_NAME", "moodfood_production")
        db = client[dbname]
        # NOTE: backend normalises email to lowercase on register
        db.users.update_one(
            {"id": data["user"]["id"]},
            {"$set": {"has_used_trial": False, "trial_active": False,
                       "trial_start_date": None, "trial_end_date": None,
                       "entitlement_tier": "free"}},
        )
        db.user_subscriptions.delete_many({"user_id": data["user"]["id"]})
        client.close()

        return {"token": token, "email": email, "user_id": data["user"]["id"]}

    def test_activate_starts_trial_for_fresh_user(self, fresh_user):
        r = requests.post(
            f"{BASE_URL}/api/trial/activate",
            json={"platform": "android"},
            headers=_headers(fresh_user["token"]),
            timeout=30,
        )
        assert r.status_code == 200, f"{r.status_code}: {r.text}"
        body = r.json()
        assert body["success"] is True
        assert body["premium"] is True, f"premium should be true: {body}"
        assert body["trial_used"] is False, f"trial_used should NOT be true for fresh user: {body}"
        assert body["reason"] == "Trial started", f"reason='{body.get('reason')}'"
        assert body["days_remaining"] == 7
        assert body.get("trial_ends"), "trial_ends must be set"

    def test_subscription_current_reflects_trialing_after_activate(self, fresh_user):
        r = requests.get(
            f"{BASE_URL}/api/subscription/current",
            headers=_headers(fresh_user["token"]),
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        sub = body.get("subscription", {})
        assert sub.get("plan_id") == "premium_monthly", f"plan_id={sub.get('plan_id')} sub={sub}"
        assert sub.get("status") == "trialing", f"status={sub.get('status')} sub={sub}"

    def test_activate_idempotent_second_call_reports_active(self, fresh_user):
        r = requests.post(
            f"{BASE_URL}/api/trial/activate",
            json={"platform": "android"},
            headers=_headers(fresh_user["token"]),
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["premium"] is True
        assert body["trial_used"] is False, f"MUST NOT wrongly report trial_used=true: {body}"
        assert body["reason"] == "Trial already active", f"reason={body['reason']}"

    def test_activate_idempotent_no_duplicate_subscriptions(self, fresh_user):
        # 3rd call should still be a no-op and not spawn duplicate rows
        r = requests.post(
            f"{BASE_URL}/api/trial/activate",
            json={"platform": "android"},
            headers=_headers(fresh_user["token"]),
            timeout=30,
        )
        assert r.status_code == 200
        # Verify only one active/trialing subscription exists
        import pymongo
        client = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        db = client[os.environ.get("DB_NAME", "moodfood_production")]
        n = db.user_subscriptions.count_documents({
            "user_id": fresh_user["user_id"],
            "status": {"$in": ["active", "trialing"]},
        })
        client.close()
        assert n == 1, f"Expected exactly 1 active/trialing sub, got {n}"


class TestTrialActivateAlreadyActive:
    """A user whose trial is already active (fresh register auto-starts one)
    should get premium=true + reason 'Trial already active' — NOT trial_used."""

    @pytest.fixture(scope="class")
    def just_registered(self):
        email = f"TEST_activate_new_{uuid.uuid4().hex[:10]}@example.com"
        data = _register(email)
        return data["access_token"]

    def test_activate_on_already_active_user(self, just_registered):
        r = requests.post(
            f"{BASE_URL}/api/trial/activate",
            json={"platform": "android"},
            headers=_headers(just_registered),
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["premium"] is True, body
        assert body["trial_used"] is False, f"MUST be false when user has active trial: {body}"
        assert body["reason"] == "Trial already active", body


# ------------------------------------------------------------------
# AI recipe image generation
# ------------------------------------------------------------------
class TestRecipeImageAIGenerate:
    """POST /api/recipe-image/ai-generate → returns url; 2nd call cached; image served."""

    @pytest.fixture(scope="class")
    def token(self):
        email = f"TEST_img_{uuid.uuid4().hex[:10]}@example.com"
        return _register(email)["access_token"]

    def test_generate_returns_url(self, token):
        # Use a unique title so we exercise cache-miss on the first call.
        title = f"TEST Pad Thai {uuid.uuid4().hex[:6]}"
        r = requests.post(
            f"{BASE_URL}/api/recipe-image/ai-generate",
            json={"title": title, "cuisine": "Thai", "ingredients": ["rice noodles", "egg"]},
            headers=_headers(token),
            timeout=90,
        )
        assert r.status_code == 200, f"{r.status_code}: {r.text}"
        body = r.json()
        assert "url" in body and body["url"].startswith("/api/recipe-image/img/"), body
        pytest._last_title = title
        pytest._last_url = body["url"]

    def test_generated_image_is_served(self, token):
        assert getattr(pytest, "_last_url", None), "prior test did not set _last_url"
        full = f"{BASE_URL}{pytest._last_url}"
        r = requests.get(full, timeout=30)
        assert r.status_code == 200, f"image not served: {r.status_code}"
        assert r.headers.get("content-type", "").startswith("image/"), r.headers
        assert len(r.content) > 500, "image bytes suspiciously small"

    def test_second_identical_call_is_cached_and_fast(self, token):
        title = getattr(pytest, "_last_title", None)
        assert title, "prior test did not set _last_title"
        t0 = time.time()
        r = requests.post(
            f"{BASE_URL}/api/recipe-image/ai-generate",
            json={"title": title, "cuisine": "Thai", "ingredients": ["rice noodles", "egg"]},
            headers=_headers(token),
            timeout=30,
        )
        dt = time.time() - t0
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("cached") is True, f"expected cached=true, got {body}"
        assert dt < 5.0, f"cached hit should be fast, took {dt:.2f}s"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
