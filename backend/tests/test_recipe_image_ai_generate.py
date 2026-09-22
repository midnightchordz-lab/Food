"""
Tests for the /api/recipe-image/ai-generate endpoint (Gemini Nano Banana).

Contract to verify:
- POST /api/recipe-image/ai-generate with {title, cuisine, ingredients:[...]}
  returns {url:'/api/recipe-image/img/<hash>.png', cached:false} on first call
  and {cached:true} on an immediate second identical call.
- GET the returned url returns HTTP 200 with content-type image/png.
- Works when `ingredients` is omitted (defaults to []).
"""
import os
import time
import uuid
import requests
import pytest

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
# Fallback: try reading directly from frontend/.env (in case env var not exported)
if not BASE_URL:
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        pass

AI = f"{BASE_URL}/api/recipe-image/ai-generate"


def _unique_title(prefix: str) -> str:
    return f"TEST_{prefix}_{uuid.uuid4().hex[:8]}"


# --- Contract: with ingredients array ---
class TestAIGenerateWithIngredients:
    def test_first_call_generates_and_second_is_cached(self):
        title = _unique_title("Biryani")
        payload = {
            "title": title,
            "cuisine": "Indian",
            "ingredients": ["basmati rice", "chicken", "saffron", "yogurt", "onions"],
        }

        r1 = requests.post(AI, json=payload, timeout=90)
        assert r1.status_code == 200, f"First call failed: {r1.status_code} {r1.text[:300]}"
        d1 = r1.json()
        assert "url" in d1 and "cached" in d1
        assert d1["url"].startswith("/api/recipe-image/img/") and d1["url"].endswith(".png")
        assert d1["cached"] is False, f"Expected cached=false on first call, got {d1}"

        # Immediate second identical call
        r2 = requests.post(AI, json=payload, timeout=30)
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["url"] == d1["url"], "URL differs between calls"
        assert d2["cached"] is True, f"Expected cached=true on second call, got {d2}"

        # GET the image
        img = requests.get(f"{BASE_URL}{d1['url']}", timeout=30)
        assert img.status_code == 200
        assert img.headers.get("content-type", "").startswith("image/png")
        assert len(img.content) > 500, "Image bytes look too small"


# --- Contract: without ingredients (defaults to []) ---
class TestAIGenerateWithoutIngredients:
    def test_omitting_ingredients_still_works(self):
        title = _unique_title("Pad_Thai")
        payload = {"title": title, "cuisine": "Thai"}  # no `ingredients` key

        r = requests.post(AI, json=payload, timeout=90)
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        d = r.json()
        assert d["url"].startswith("/api/recipe-image/img/") and d["url"].endswith(".png")
        assert d["cached"] in (True, False)

        img = requests.get(f"{BASE_URL}{d['url']}", timeout=30)
        assert img.status_code == 200
        assert img.headers.get("content-type", "").startswith("image/png")


# --- Cache key stability: same title+cuisine yields same URL regardless of ingredients ---
class TestCacheKeyStability:
    def test_same_title_cuisine_returns_same_url(self):
        title = _unique_title("Ramen")
        p1 = {"title": title, "cuisine": "Japanese", "ingredients": ["noodles", "pork"]}
        p2 = {"title": title, "cuisine": "Japanese", "ingredients": ["different", "ingredients"]}

        r1 = requests.post(AI, json=p1, timeout=90)
        assert r1.status_code == 200
        r2 = requests.post(AI, json=p2, timeout=30)
        assert r2.status_code == 200
        assert r1.json()["url"] == r2.json()["url"]
        assert r2.json()["cached"] is True


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
