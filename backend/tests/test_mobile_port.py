"""
Backend tests for MoodFood mobile port.
Covers: auth (register/login/me), chat with structured recipes,
recipes save+list, weekly-plan get+generate, shopping-list, AI recipe image (Gemini Nano Banana),
Apple Sign In invalid token path.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://ebb5d914-6d3f-4818-8f3a-6df8560cba39.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def test_user(session):
    """Register a fresh test user and return credentials + token + user."""
    email = f"TEST_mobport_{uuid.uuid4().hex[:8]}@example.com"
    password = "TestPass1234"
    payload = {"email": email, "password": password, "name": "TEST Mob Port"}
    r = session.post(f"{API}/auth/register", json=payload, timeout=30)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text[:400]}"
    data = r.json()
    assert "access_token" in data and data["access_token"], "no access_token"
    assert "user" in data and data["user"], "no user object"
    assert data["user"]["email"] == email
    return {
        "email": email, "password": password,
        "token": data["access_token"], "user": data["user"],
    }


@pytest.fixture(scope="module")
def auth_headers(test_user):
    return {"Authorization": f"Bearer {test_user['token']}", "Content-Type": "application/json"}


# ---------------- AUTH ----------------

class TestAuth:
    def test_health(self, session):
        r = session.get(f"{API}/health", timeout=15)
        assert r.status_code == 200
        assert r.json().get("status") == "healthy"

    def test_login_success(self, session, test_user):
        r = session.post(f"{API}/auth/login", json={
            "email": test_user["email"], "password": test_user["password"]
        }, timeout=15)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d.get("access_token")
        assert d.get("user", {}).get("email") == test_user["email"]

    def test_login_invalid(self, session, test_user):
        r = session.post(f"{API}/auth/login", json={
            "email": test_user["email"], "password": "WrongPass!!"
        }, timeout=15)
        assert r.status_code == 401

    def test_me_with_token(self, session, auth_headers, test_user):
        r = session.get(f"{API}/auth/me", headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d.get("email") == test_user["email"]
        assert d.get("id") == test_user["user"]["id"]

    def test_me_without_token(self, session):
        r = session.get(f"{API}/auth/me", timeout=15)
        assert r.status_code in (401, 403)


# ---------------- CHAT (structured recipes) ----------------

class TestChat:
    def test_send_with_user_preferences(self, session, auth_headers):
        msg = (
            "[User Preferences] Mood: happy | Dietary: vegetarian | "
            "Cuisines: italian, indian\n\nSuggest 4 quick lunch recipes."
        )
        r = session.post(
            f"{API}/chat/send",
            headers=auth_headers,
            json={"session_id": f"test-{uuid.uuid4().hex[:8]}", "message": msg},
            timeout=90,
        )
        assert r.status_code == 200, f"chat/send failed: {r.status_code} {r.text[:400]}"
        d = r.json()
        assert "response" in d, "missing response field"
        assert "structured_recipes" in d, "missing structured_recipes"
        recipes = d["structured_recipes"]
        assert isinstance(recipes, list) and len(recipes) >= 1, f"expected recipes, got {recipes}"
        # Ideally 4 recipes
        if len(recipes) != 4:
            print(f"WARNING: expected 4 recipes, got {len(recipes)}")
        for rec in recipes:
            assert "title" in rec and rec["title"], f"missing title: {rec}"
            assert "description" in rec, f"missing description: {rec}"
            assert "cuisine" in rec, f"missing cuisine: {rec}"


# ---------------- RECIPES save + list ----------------

class TestRecipes:
    saved_id = None

    def test_save_recipe(self, session, auth_headers):
        payload = {
            "recipe": {
                "title": "TEST Mobile Pasta",
                "description": "TEST recipe from mob port suite",
                "cuisine_type": "italian",
                "ingredients": ["pasta", "tomato", "basil"],
                "instructions": ["boil", "mix", "serve"],
                "mood_tags": ["happy", "comfort"],
                "prep_time": "10 min",
                "cook_time": "15 min",
                "complexity": "easy",
                "nutritional_highlights": "carbs + antioxidants",
                "dietary_info": ["vegetarian"],
            }
        }
        r = session.post(f"{API}/recipes/save", headers=auth_headers, json=payload, timeout=30)
        assert r.status_code in (200, 201), f"save failed: {r.status_code} {r.text[:300]}"
        d = r.json()
        # accept various shapes
        assert d, "empty response"

    def test_list_saved(self, session, auth_headers):
        r = session.get(f"{API}/recipes/saved", headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        # Response could be list or object with list
        items = d if isinstance(d, list) else d.get("recipes") or d.get("saved") or d.get("items") or []
        assert isinstance(items, list), f"expected list, got {type(d)}: {str(d)[:200]}"
        # At least one saved recipe should be present
        titles = []
        for it in items:
            if isinstance(it, dict):
                titles.append(it.get("title") or (it.get("recipe") or {}).get("title"))
        assert any(t and "TEST Mobile Pasta" in t for t in titles), \
            f"saved recipe not found in list; got titles={titles[:5]}"


# ---------------- WEEKLY PLAN ----------------

class TestWeeklyPlan:
    def test_get_current(self, session, auth_headers):
        r = session.get(f"{API}/weekly-plan/current", headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert isinstance(d, dict), "expected object"

    def test_generate_plan(self, session, auth_headers):
        r = session.post(
            f"{API}/weekly-plan/generate",
            headers=auth_headers,
            json={"mood": "happy", "dietary_preference": "vegetarian"},
            timeout=180,
        )
        assert r.status_code in (200, 201), f"generate failed: {r.status_code} {r.text[:400]}"
        d = r.json()
        assert d, "empty response"
        # try to detect plan structure
        plan_like = (
            "plan" in d or "week" in d or "days" in d or "meals" in d or
            "monday" in {k.lower() for k in d.keys()}
        )
        assert plan_like, f"generated plan lacks expected fields: keys={list(d.keys())[:10]}"


# ---------------- SHOPPING LIST ----------------

class TestShopping:
    def test_get_shopping_list(self, session, auth_headers):
        r = session.get(f"{API}/shopping-list", headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        # accept list or dict with items
        assert isinstance(d, (list, dict)), f"unexpected type {type(d)}"


# ---------------- AI RECIPE IMAGE (Gemini Nano Banana) ----------------

class TestRecipeImage:
    def test_generate_and_fetch(self, session):
        payload = {
            "title": "TEST Margherita Pizza",
            "cuisine": "italian",
            "description": "classic tomato, mozzarella, basil pizza",
        }
        t0 = time.time()
        r = session.post(f"{API}/recipe-image/ai-generate", json=payload, timeout=120)
        elapsed = time.time() - t0
        assert r.status_code == 200, f"gen failed ({elapsed:.1f}s): {r.status_code} {r.text[:300]}"
        d = r.json()
        assert "url" in d and d["url"].startswith("/api/recipe-image/img/"), f"bad url: {d}"
        # fetch it
        r2 = session.get(f"{BASE_URL}{d['url']}", timeout=30)
        assert r2.status_code == 200, f"image fetch failed: {r2.status_code}"
        ctype = r2.headers.get("content-type", "")
        assert "image/png" in ctype, f"unexpected content-type: {ctype}"
        assert len(r2.content) > 500, f"image too small: {len(r2.content)} bytes"


# ---------------- APPLE SIGN IN (invalid token) ----------------

class TestAppleAuth:
    def test_invalid_identity_token_returns_401(self, session):
        r = session.post(
            f"{API}/auth/apple",
            json={"identity_token": "not.a.real.jwt", "name": "TEST Apple"},
            timeout=30,
        )
        assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text[:200]}"
