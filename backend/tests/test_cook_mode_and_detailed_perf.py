"""
Backend regression tests for the two follow-up fixes:
  (A) Cook Mode uses POST /api/mobile-voice/tts one-shot per step (no auth,
      returns a served /api/audio/file/... URL). Verify determinism/caching
      so calling twice with the same text does not fail and returns a URL.
  (B) POST /api/recipes/detailed:
        - first call for a fresh title => 200, {recipe: <markdown>, cached: false}
        - second call with the same title => cached: true and near-instant.
      Underlying model was switched to gpt-4o-mini for latency.

Recipe list / discover should not itself call /api/recipe-image/ai-generate;
that's a pure frontend change, so we only assert the discover endpoint returns
Unsplash-style image URLs (images.unsplash.com), never a locally-served
/api/recipe-image/... url.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL") or "").rstrip("/")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL / EXPO_BACKEND_URL must be set"

API = f"{BASE_URL}/api"


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def auth_token():
    """Register a fresh user and return an access token."""
    email = f"ck_test+{int(time.time())}_{uuid.uuid4().hex[:6]}@example.com"
    password = "Test1234"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": password, "name": "Cook Tester", "full_name": "Cook Tester",
    }, timeout=30)
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"no token in register response: {data}"
    return token


@pytest.fixture
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


# ============ BUG A: mobile-voice TTS (used by /cook) ============
class TestCookModeTTS:

    def test_tts_returns_audio_url(self):
        """POST /api/mobile-voice/tts returns a /api/audio/file/*.mp3 URL for a step."""
        r = requests.post(f"{API}/mobile-voice/tts", json={
            "text": "Step 1: Chop the onions finely and set aside.",
            "voice": "nova",
        }, timeout=60)
        assert r.status_code == 200, f"tts failed: {r.status_code} {r.text}"
        body = r.json()
        assert "url" in body
        assert body["url"].startswith("/api/audio/file/"), body
        assert body["url"].endswith(".mp3"), body

    def test_tts_is_cached_and_fast_second_time(self):
        """A repeat call for identical text returns the same URL quickly (disk cache)."""
        payload = {"text": f"Boil water. run {uuid.uuid4().hex[:6]}", "voice": "nova"}
        r1 = requests.post(f"{API}/mobile-voice/tts", json=payload, timeout=60)
        assert r1.status_code == 200
        url1 = r1.json()["url"]

        t0 = time.time()
        r2 = requests.post(f"{API}/mobile-voice/tts", json=payload, timeout=60)
        elapsed = time.time() - t0
        assert r2.status_code == 200
        url2 = r2.json()["url"]
        assert url1 == url2, "same text should return the same cache filename"
        # cached should be much faster (< 2s local disk hit) but keep tolerant
        assert elapsed < 5.0, f"cached tts too slow: {elapsed:.2f}s"

    def test_tts_different_steps_return_different_urls(self):
        """Cook mode calls tts once per step; each unique step must yield its own file."""
        stamp = uuid.uuid4().hex[:6]
        steps = [
            f"Step one {stamp}: preheat the oven to 200 celsius.",
            f"Step two {stamp}: whisk eggs with milk.",
            f"Step three {stamp}: pour into the pan.",
        ]
        urls = []
        for s in steps:
            r = requests.post(f"{API}/mobile-voice/tts", json={"text": s, "voice": "nova"}, timeout=60)
            assert r.status_code == 200, r.text
            urls.append(r.json()["url"])
        assert len(set(urls)) == 3, f"expected 3 unique tts urls, got {urls}"

    def test_tts_empty_text_400(self):
        r = requests.post(f"{API}/mobile-voice/tts", json={"text": "  "}, timeout=15)
        assert r.status_code == 400

    def test_tts_audio_file_served(self):
        """The URL returned should actually be served (audio/mpeg)."""
        r = requests.post(f"{API}/mobile-voice/tts", json={
            "text": "Add a pinch of salt to taste.", "voice": "nova"
        }, timeout=60)
        assert r.status_code == 200
        url = r.json()["url"]
        # url is /api/audio/file/... so we hit BASE_URL + url
        full = f"{BASE_URL}{url}"
        h = requests.get(full, timeout=30)
        assert h.status_code == 200, f"audio file 404: {full}"
        ctype = h.headers.get("content-type", "")
        assert "audio" in ctype or "mpeg" in ctype, ctype
        assert len(h.content) > 200, "audio body too small"


# ============ PERF B: /api/recipes/detailed switched to gpt-4o-mini + cached ============
class TestDetailedRecipePerf:

    def test_first_call_generates_then_second_returns_cached(self, auth_headers):
        # Use a unique title so we exercise both the fresh-generate and the cache path
        title = f"Perf Test Curry {uuid.uuid4().hex[:8]}"

        t0 = time.time()
        r1 = requests.post(f"{API}/recipes/detailed", headers=auth_headers, json={
            "recipe_title": title,
            "cuisine": "Indian",
            "meal_type": "Dinner",
            "dietary_pref": "Any",
        }, timeout=90)
        gen_elapsed = time.time() - t0
        assert r1.status_code == 200, f"generate failed: {r1.status_code} {r1.text}"
        d1 = r1.json()
        assert "recipe" in d1 and isinstance(d1["recipe"], str) and len(d1["recipe"]) > 100
        assert d1.get("cached") is False

        t1 = time.time()
        r2 = requests.post(f"{API}/recipes/detailed", headers=auth_headers, json={
            "recipe_title": title,
            "cuisine": "Indian",
            "meal_type": "Dinner",
            "dietary_pref": "Any",
        }, timeout=30)
        cached_elapsed = time.time() - t1
        assert r2.status_code == 200, r2.text
        d2 = r2.json()
        assert d2.get("cached") is True, f"second call not cached: {d2}"
        # content must be identical from the cache
        assert d2["recipe"] == d1["recipe"]
        assert cached_elapsed < 3.0, f"cached call too slow: {cached_elapsed:.2f}s"
        # sanity: cached call is meaningfully faster
        assert cached_elapsed < gen_elapsed, (cached_elapsed, gen_elapsed)

    def test_detailed_recipe_has_numbered_steps_for_cook_mode(self, auth_headers):
        """Cook Mode's parseSteps() needs numbered `1. ...` lines. The prompt should return them."""
        title = f"Cook Steps Sanity {uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/recipes/detailed", headers=auth_headers, json={
            "recipe_title": title,
            "cuisine": "Italian",
            "meal_type": "Dinner",
            "dietary_pref": "Any",
        }, timeout=90)
        assert r.status_code == 200
        md = r.json()["recipe"]
        # count numbered lines
        numbered = [ln for ln in md.split("\n") if ln.strip() and ln.lstrip().split(".")[0].strip().isdigit()]
        assert len(numbered) >= 3, f"expected >=3 numbered steps, got {len(numbered)}. Full md:\n{md[:800]}"


# ============ PERF B: no per-card ai image (indirect check) ============
class TestDiscoverImagesAreCDN:
    """
    The frontend RecipeCard no longer calls /api/recipe-image/ai-generate for
    listing. Backend discover/known-recipe endpoints should return CDN images
    (images.unsplash.com or /api/image-proxy) — never require an AI call.
    """

    def test_discover_returns_cdn_images(self, auth_headers):
        r = requests.post(f"{API}/recipes/discover", headers=auth_headers, json={
            "cuisine": "Italian", "count": 4,
        }, timeout=45)
        assert r.status_code == 200, r.text
        body = r.json()
        recipes = body.get("recipes") or []
        assert len(recipes) >= 1, body
        for rec in recipes:
            url = rec.get("image_url") or ""
            assert url, f"missing image_url: {rec}"
            # must NOT be an AI-generated file path
            assert "/recipe-image/ai-generate" not in url, url
