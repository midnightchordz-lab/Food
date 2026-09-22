"""
Tests for the Validation-First Two-Step Parallel Pipeline:
  POST /api/quick-recipes/generate-validated

Contract:
- Requires auth (Bearer JWT). Unauth -> 401/403.
- count<1 or count>5 -> 400.
- Success 200: {recipes:[{name,timing,total_minutes<=10,cuisine,difficulty,ingredients,
                          instructions,pro_tip,image_url,image_validated,validation_proof}],
                count, all_validated, validation_enabled, timestamp}
- image_url must serve a real PNG image (200 + image/* content-type).

Regression:
- Legacy POST /api/quick-recipes/generate still returns 200 with recipes[] + speed_tips[]
  and NO image fields.

Uses small count (<=2) to keep LLM cost/time and per-user 30/day image cap in check.
"""
import os
import time
import requests
import pytest

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        pass

assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL missing"

VALIDATED = f"{BASE_URL}/api/quick-recipes/generate-validated"
LEGACY = f"{BASE_URL}/api/quick-recipes/generate"
REGISTER = f"{BASE_URL}/api/auth/register"
LOGIN = f"{BASE_URL}/api/auth/login"

# Generous timeout — pipeline runs 2 image generations in parallel via Gemini.
GEN_TIMEOUT = 120


@pytest.fixture(scope="module")
def auth_token():
    """Register a fresh user (isolated 30/day image cap) and return its JWT."""
    ts = int(time.time())
    email = f"qkval_test+{ts}@example.com"
    password = "Test1234"
    r = requests.post(REGISTER, json={"email": email, "password": password, "name": "Validated Tester"}, timeout=30)
    if r.status_code not in (200, 201):
        r = requests.post(LOGIN, json={"email": email, "password": password}, timeout=30)
    assert r.status_code in (200, 201), f"Auth setup failed: {r.status_code} {r.text[:300]}"
    data = r.json()
    token = data.get("access_token") or data.get("token") or (data.get("user") or {}).get("access_token")
    assert token, f"No token in response: {data}"
    return token


@pytest.fixture
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


# --- Auth enforcement ---
class TestAuth:
    def test_no_token_returns_401_or_403(self):
        r = requests.post(VALIDATED, json={"count": 2, "dietary": "non-vegetarian",
                                           "cuisine": "indian", "mood": "comfort",
                                           "ingredients": [], "equipment": "basic"}, timeout=15)
        assert r.status_code in (401, 403), f"Expected 401/403 got {r.status_code} {r.text[:200]}"


# --- Count bounds ---
class TestCountBounds:
    def test_count_zero_returns_400(self, auth_headers):
        r = requests.post(VALIDATED, headers=auth_headers,
                          json={"count": 0, "dietary": "non-vegetarian", "cuisine": "indian",
                                "mood": "comfort", "ingredients": [], "equipment": "basic"},
                          timeout=15)
        assert r.status_code == 400, f"Expected 400 got {r.status_code} {r.text[:200]}"

    def test_count_six_returns_400(self, auth_headers):
        r = requests.post(VALIDATED, headers=auth_headers,
                          json={"count": 6, "dietary": "non-vegetarian", "cuisine": "indian",
                                "mood": "comfort", "ingredients": [], "equipment": "basic"},
                          timeout=15)
        assert r.status_code == 400, f"Expected 400 got {r.status_code} {r.text[:200]}"


# --- Main contract ---
class TestGenerateValidatedContract:
    """Runs the full validation pipeline once with count=2 and asserts contract + images."""

    @pytest.fixture(scope="class")
    def response_data(self, auth_token):
        headers = {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
        payload = {
            "count": 2,
            "dietary": "non-vegetarian",
            "cuisine": "indian",
            "mood": "comfort",
            "ingredients": [],
            "equipment": "basic",
        }
        r = requests.post(VALIDATED, headers=headers, json=payload, timeout=GEN_TIMEOUT)
        assert r.status_code == 200, f"Failed: {r.status_code} {r.text[:500]}"
        return r.json()

    def test_top_level_shape(self, response_data):
        d = response_data
        for key in ("recipes", "count", "all_validated", "validation_enabled", "timestamp"):
            assert key in d, f"Missing top-level key '{key}'; got {list(d.keys())}"
        assert isinstance(d["recipes"], list)
        assert d["count"] == len(d["recipes"])
        assert d["count"] >= 1
        assert isinstance(d["all_validated"], bool)
        assert d["validation_enabled"] is True

    def test_each_recipe_has_required_fields(self, response_data):
        for i, rec in enumerate(response_data["recipes"]):
            for key in ("name", "timing", "total_minutes", "cuisine", "difficulty",
                        "ingredients", "instructions", "pro_tip",
                        "image_url", "image_validated", "validation_proof"):
                assert key in rec, f"Recipe {i} missing '{key}'; got {list(rec.keys())}"
            assert isinstance(rec["name"], str) and rec["name"]
            assert isinstance(rec["timing"], str) and rec["timing"]
            assert isinstance(rec["total_minutes"], int)
            assert 1 <= rec["total_minutes"] <= 10, f"Recipe {i} total={rec['total_minutes']}"
            assert isinstance(rec["ingredients"], list) and len(rec["ingredients"]) > 0
            assert isinstance(rec["instructions"], list) and len(rec["instructions"]) > 0
            assert isinstance(rec["image_validated"], bool)
            assert isinstance(rec["validation_proof"], str) and rec["validation_proof"]

    def test_image_url_shape(self, response_data):
        for i, rec in enumerate(response_data["recipes"]):
            url = rec.get("image_url")
            assert url, f"Recipe {i} missing image_url"
            assert url.startswith("/api/recipe-image/img/") and url.endswith(".png"), (
                f"Recipe {i} bad image_url: {url}"
            )

    def test_image_urls_serve_actual_images(self, response_data):
        for i, rec in enumerate(response_data["recipes"]):
            url = rec["image_url"]
            r = requests.get(f"{BASE_URL}{url}", timeout=30)
            assert r.status_code == 200, f"Recipe {i} image not served: {r.status_code} for {url}"
            ctype = r.headers.get("content-type", "")
            assert ctype.startswith("image/"), f"Recipe {i} unexpected content-type: {ctype}"
            assert len(r.content) > 100, f"Recipe {i} image too small ({len(r.content)}B)"


# --- Regression: legacy endpoint still works ---
class TestLegacyGenerateRegression:
    def test_legacy_generate_still_works(self, auth_headers):
        payload = {
            "count": 2,
            "dietary": "non-vegetarian",
            "cuisine": "indian",
            "mood": "comfort",
            "ingredients": [],
            "equipment": "basic",
        }
        r = requests.post(LEGACY, headers=auth_headers, json=payload, timeout=90)
        assert r.status_code == 200, f"Legacy failed: {r.status_code} {r.text[:400]}"
        data = r.json()
        assert "recipes" in data and isinstance(data["recipes"], list) and len(data["recipes"]) >= 1
        assert "speed_tips" in data and isinstance(data["speed_tips"], list)
        assert "count" in data
        # Legacy MUST NOT include image fields.
        for rec in data["recipes"]:
            assert "image_url" not in rec, "Legacy /generate should not include image_url"
            assert "image_validated" not in rec, "Legacy /generate should not include image_validated"
            assert rec["total_minutes"] <= 10


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
