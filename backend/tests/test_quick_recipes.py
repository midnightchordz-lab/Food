"""
Tests for POST /api/quick-recipes/generate (10-minute meals).

Contract:
- Requires auth (Bearer JWT). Unauth -> 403.
- count>8 or count<1 -> 400.
- Success 200: {recipes:[{name,timing,total_minutes,cuisine,difficulty,ingredients,instructions,pro_tip}], speed_tips[], count}.
- Every recipe must have total_minutes<=10 and non-empty ingredients+instructions.
"""
import os
import time
import uuid
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

QR = f"{BASE_URL}/api/quick-recipes/generate"
REGISTER = f"{BASE_URL}/api/auth/register"
LOGIN = f"{BASE_URL}/api/auth/login"


@pytest.fixture(scope="module")
def auth_token():
    """Register a fresh user and return its JWT token."""
    ts = int(time.time())
    email = f"qk_test+{ts}@example.com"
    password = "Test1234"
    r = requests.post(REGISTER, json={"email": email, "password": password, "name": "Quick Tester"}, timeout=30)
    if r.status_code not in (200, 201):
        # Try login (maybe user exists somehow)
        r = requests.post(LOGIN, json={"email": email, "password": password}, timeout=30)
    assert r.status_code in (200, 201), f"Auth setup failed: {r.status_code} {r.text[:300]}"
    data = r.json()
    token = data.get("access_token") or data.get("token") or (data.get("user") or {}).get("access_token")
    assert token, f"No token in response: {data}"
    return token


@pytest.fixture
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


# --- Auth ---
class TestAuth:
    def test_unauthenticated_returns_403(self):
        r = requests.post(QR, json={"count": 3, "dietary": "vegetarian", "cuisine": "indian"}, timeout=15)
        assert r.status_code in (401, 403), f"Expected 401/403 got {r.status_code} {r.text[:200]}"


# --- Validation ---
class TestValidation:
    def test_count_too_high_returns_400(self, auth_headers):
        r = requests.post(QR, headers=auth_headers, json={"count": 9, "dietary": "vegetarian", "cuisine": "indian"}, timeout=15)
        assert r.status_code == 400, f"Expected 400 got {r.status_code} {r.text[:200]}"

    def test_count_zero_returns_400(self, auth_headers):
        r = requests.post(QR, headers=auth_headers, json={"count": 0, "dietary": "vegetarian", "cuisine": "indian"}, timeout=15)
        assert r.status_code == 400, f"Expected 400 got {r.status_code} {r.text[:200]}"


# --- Success (main contract) ---
class TestQuickRecipeGeneration:
    def test_generates_3_valid_10min_recipes(self, auth_headers):
        payload = {
            "count": 3,
            "dietary": "vegetarian",
            "cuisine": "indian",
            "mood": "energizing",
            "ingredients": ["onion", "tomato", "green chili"],
            "equipment": "basic",
        }
        r = requests.post(QR, headers=auth_headers, json=payload, timeout=120)
        assert r.status_code == 200, f"Failed: {r.status_code} {r.text[:400]}"
        data = r.json()

        # Top-level shape
        assert "recipes" in data, f"Missing 'recipes': {list(data.keys())}"
        assert "speed_tips" in data
        assert "count" in data
        assert isinstance(data["recipes"], list)
        assert isinstance(data["speed_tips"], list)
        assert data["count"] == len(data["recipes"])
        assert data["count"] >= 1, "Expected at least 1 recipe"

        # Per-recipe fields
        for i, rec in enumerate(data["recipes"]):
            assert "name" in rec and rec["name"], f"Recipe {i} missing name"
            assert "timing" in rec and rec["timing"], f"Recipe {i} missing timing"
            assert "total_minutes" in rec, f"Recipe {i} missing total_minutes"
            assert isinstance(rec["total_minutes"], int), f"Recipe {i} total_minutes not int"
            assert rec["total_minutes"] <= 10, f"Recipe {i} exceeds 10 min: {rec['total_minutes']} ({rec['name']})"
            assert rec["total_minutes"] >= 1
            assert "cuisine" in rec and rec["cuisine"]
            assert "difficulty" in rec and rec["difficulty"]
            assert "ingredients" in rec and isinstance(rec["ingredients"], list) and len(rec["ingredients"]) > 0, (
                f"Recipe {i} has empty ingredients"
            )
            assert "instructions" in rec and isinstance(rec["instructions"], list) and len(rec["instructions"]) > 0, (
                f"Recipe {i} has empty instructions"
            )
            assert "pro_tip" in rec  # may be empty string but must be present

    def test_generates_with_defaults_only(self, auth_headers):
        """Minimal payload should still work."""
        r = requests.post(QR, headers=auth_headers, json={"count": 2}, timeout=120)
        assert r.status_code == 200, f"Failed: {r.status_code} {r.text[:400]}"
        data = r.json()
        assert len(data["recipes"]) >= 1
        for rec in data["recipes"]:
            assert rec["total_minutes"] <= 10


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
