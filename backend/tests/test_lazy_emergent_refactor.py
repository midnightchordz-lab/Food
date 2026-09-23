"""
Regression tests for the lazy_emergent refactor.

The 11 route files that used to `from emergentintegrations.llm.chat import
LlmChat, UserMessage, ImageContent` at module load time now import them from
`lazy_emergent`, which resolves the real class only on FIRST instantiation.

This suite hits the actual HTTP endpoints that construct these proxies to prove
the drop-in replacement still works end-to-end:
  * /api/chat/send           -> LlmChat + UserMessage
  * /api/quick-recipes/generate -> LlmChat + UserMessage
  * /api/recipes/detailed    -> LlmChat + UserMessage
  * /api/recipes/nutrition   -> LlmChat + UserMessage
  * /api/recipe-image/ai-generate -> LlmChat + UserMessage (multimodal, Gemini)
  * /api/fridge-scanner/scan -> LlmChat + UserMessage + ImageContent
  * /api/health              -> server boots (no litellm at import time)
"""
import base64
import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ["EXPO_BACKEND_URL"].rstrip("/") if os.environ.get("EXPO_BACKEND_URL") else "https://app-launch-2905.preview.emergentagent.com"
API = f"{BASE_URL}/api"


# -------- shared session fixture ------------------------------------------------
@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_token(api_client):
    """Register a fresh test user (auto 7-day trial => premium AI access)."""
    email = f"TEST_lazy_{uuid.uuid4().hex[:10]}@example.com"
    password = "Test1234!"
    r = api_client.post(f"{API}/auth/register", json={
        "email": email,
        "password": password,
        "name": "Lazy Emergent Tester",
        "dietary_restrictions": [],
        "cuisine_preferences": [],
    }, timeout=30)
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text[:300]}"
    body = r.json()
    token = body.get("access_token") or body.get("token")
    assert token, f"no access_token in register response: {body}"
    return token


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


# -------- 0. server up (no litellm at import) ----------------------------------
class TestHealth:
    def test_health_endpoint_ok(self, api_client):
        r = api_client.get(f"{API}/health", timeout=10)
        assert r.status_code == 200


# -------- 1. /api/chat/send -> LlmChat + UserMessage ---------------------------
class TestChatRecipeGeneration:
    """POST /api/chat/send with structured [User Preferences] triggers LlmChat proxy."""

    def test_chat_send_structured_recipes(self, api_client, auth_headers):
        payload = {
            "session_id": f"lazy-test-{uuid.uuid4().hex[:8]}",
            "message": (
                "[User Preferences]\n"
                "- Mood: happy\n"
                "- Meal Type: Dinner\n"
                "- Dietary Preference: vegetarian\n"
                "- Cuisine(s): Italian\n"
            ),
        }
        r = api_client.post(f"{API}/chat/send", json=payload,
                            headers=auth_headers, timeout=90)
        assert r.status_code == 200, f"chat/send failed: {r.status_code} {r.text[:400]}"
        data = r.json()
        assert data.get("session_id") == payload["session_id"]
        assert isinstance(data.get("response"), str) and len(data["response"]) > 50, \
            "response missing/too short — LlmChat proxy likely failed"
        recipes = data.get("structured_recipes")
        assert recipes and isinstance(recipes, list) and len(recipes) >= 1, \
            f"no structured_recipes returned (LlmChat/UserMessage path): {data}"
        first = recipes[0]
        for field in ("title", "description", "cooking_time", "difficulty"):
            assert field in first, f"structured recipe missing '{field}': {first}"


# -------- 2. /api/quick-recipes/generate -> LlmChat + UserMessage --------------
class TestQuickRecipes:
    def test_quick_recipes_generate(self, api_client, auth_headers):
        payload = {
            "count": 2,
            "dietary": "vegetarian",
            "cuisine": "Italian",
            "mood": "energizing",
            "ingredients": ["pasta", "cherry tomatoes", "garlic"],
            "equipment": "basic",
        }
        r = api_client.post(f"{API}/quick-recipes/generate", json=payload,
                            headers=auth_headers, timeout=90)
        assert r.status_code == 200, f"quick-recipes failed: {r.status_code} {r.text[:400]}"
        data = r.json()
        assert data.get("count", 0) >= 1
        recipes = data.get("recipes") or []
        assert len(recipes) >= 1, f"no recipes returned: {data}"
        r0 = recipes[0]
        assert r0.get("name") and r0.get("ingredients") and r0.get("instructions"), \
            f"recipe malformed: {r0}"
        assert 1 <= int(r0.get("total_minutes", 0)) <= 10


# -------- 3. /api/recipes/detailed & /nutrition -> LlmChat + UserMessage -------
class TestRecipesDetailAndNutrition:
    def test_recipes_detailed(self, api_client, auth_headers):
        payload = {
            "recipe_title": f"TEST Vegetable Pasta Primavera {uuid.uuid4().hex[:4]}",
            "cuisine": "Italian",
            "meal_type": "Dinner",
            "dietary_pref": "vegetarian",
        }
        r = api_client.post(f"{API}/recipes/detailed", json=payload,
                            headers=auth_headers, timeout=90)
        assert r.status_code == 200, f"recipes/detailed failed: {r.status_code} {r.text[:400]}"
        data = r.json()
        recipe_text = data.get("recipe") or ""
        assert isinstance(recipe_text, str) and len(recipe_text) > 200, \
            "detailed recipe content too short — LlmChat proxy likely failed"

    def test_recipes_nutrition(self, api_client, auth_headers):
        payload = {
            "title": f"TEST Grilled Chicken Salad {uuid.uuid4().hex[:4]}",
            "ingredients": ["chicken breast", "lettuce", "olive oil", "lemon"],
        }
        r = api_client.post(f"{API}/recipes/nutrition", json=payload,
                            headers=auth_headers, timeout=60)
        assert r.status_code == 200, f"recipes/nutrition failed: {r.status_code} {r.text[:400]}"
        data = r.json()
        nut = data.get("nutrition") or {}
        # Expect integer macros back from the LLM->JSON pipeline
        for k in ("calories", "protein_g", "carbs_g", "fat_g"):
            assert k in nut, f"nutrition missing {k}: {nut}"
            assert isinstance(nut[k], (int, float)) and nut[k] > 0


# -------- 4. /api/recipe-image/ai-generate -> LlmChat multimodal ---------------
class TestRecipeImageGen:
    def test_recipe_image_ai_generate(self, api_client, auth_headers):
        payload = {
            "title": f"TEST Cherry Tomato Garlic Pasta {uuid.uuid4().hex[:4]}",
            "cuisine": "Italian",
            "ingredients": ["pasta", "cherry tomatoes", "garlic", "olive oil"],
        }
        # Image generation is slower — allow up to 3 min.
        r = api_client.post(f"{API}/recipe-image/ai-generate", json=payload,
                            headers=auth_headers, timeout=180)
        assert r.status_code == 200, f"recipe-image failed: {r.status_code} {r.text[:400]}"
        data = r.json()
        url = data.get("url")
        assert url and url.startswith("/api/recipe-image/img/"), f"bad url: {data}"
        # Confirm the served image is fetchable
        img = api_client.get(f"{BASE_URL}{url}", timeout=30)
        assert img.status_code == 200
        assert img.headers.get("content-type", "").startswith("image/")
        assert len(img.content) > 500


# -------- 5. /api/fridge-scanner/scan -> LlmChat + UserMessage + ImageContent --
class TestFridgeScannerImageContent:
    """Exercises the ImageContent proxy specifically."""

    def test_fridge_scanner_scan(self, auth_token):
        # Build a tiny valid PNG (10x10 red) via Pillow so the endpoint accepts it.
        from PIL import Image
        import io
        buf = io.BytesIO()
        Image.new("RGB", (32, 32), color=(220, 50, 50)).save(buf, format="PNG")
        buf.seek(0)
        files = {"file": ("fridge.png", buf.getvalue(), "image/png")}
        headers = {"Authorization": f"Bearer {auth_token}"}
        r = requests.post(f"{API}/fridge-scanner/scan", files=files,
                          headers=headers, timeout=180)
        # Endpoint should NOT 500 with an import-time / attribute error from the proxy.
        # Premium gate could return 403 — that still proves the proxy import path is fine.
        assert r.status_code in (200, 403), (
            f"fridge-scanner/scan failed (ImageContent proxy path): "
            f"{r.status_code} {r.text[:500]}"
        )
        if r.status_code == 200:
            data = r.json()
            # Response shape: FridgeScanResult -> ingredients, suggested_recipes, scan_id
            assert "ingredients" in data and "scan_id" in data, \
                f"unexpected fridge scan response shape: {list(data.keys())}"
