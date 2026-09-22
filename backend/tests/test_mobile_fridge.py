"""Tests for Mobile Fridge Scanner: POST /api/mobile-fridge/scan."""
import os
import time
import base64
import io
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL missing"
BASE_URL = BASE_URL.rstrip("/")

TS = int(time.time())


@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_token(api_client):
    email = f"fr_test+{TS}@example.com"
    payload = {"email": email, "password": "Test1234", "name": "Fridge Tester"}
    r = api_client.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=30)
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok, f"no token in register response: {r.text}"
    return tok


def _small_jpeg_b64() -> str:
    """Return a real food photo (Unsplash) if available, else synth."""
    path = "/tmp/fridge.jpg"
    if os.path.exists(path) and os.path.getsize(path) > 5000:
        with open(path, "rb") as f:
            return base64.b64encode(f.read()).decode()
    from PIL import Image
    img = Image.new("RGB", (320, 240), (200, 200, 200))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=70)
    return base64.b64encode(buf.getvalue()).decode()


# --- Auth behaviour ---
class TestFridgeAuth:
    def test_scan_requires_auth(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/mobile-fridge/scan", json={"image_data": "abc"}, timeout=20)
        # No Authorization header -> HTTPBearer returns 403
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code} {r.text}"

    def test_scan_bad_token(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/mobile-fridge/scan",
            json={"image_data": "abc"},
            headers={"Authorization": "Bearer not-a-real-token"},
            timeout=20,
        )
        assert r.status_code in (401, 403)


# --- Contract ---
class TestFridgeContract:
    def test_scan_returns_ingredients_and_recipes(self, api_client, auth_token):
        img_b64 = _small_jpeg_b64()
        r = api_client.post(
            f"{BASE_URL}/api/mobile-fridge/scan",
            json={"image_data": img_b64},
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=90,
        )
        # AI can return 422 if nothing recognised; accept 200 OR the specific 422 message
        if r.status_code == 422:
            pytest.skip(f"AI could not detect ingredients in synthetic image: {r.text}")
        assert r.status_code == 200, f"unexpected status: {r.status_code} {r.text}"
        data = r.json()
        # top-level shape
        assert "scan_id" in data and isinstance(data["scan_id"], str) and len(data["scan_id"]) > 8
        assert "ingredients" in data and isinstance(data["ingredients"], list)
        assert "recipes" in data and isinstance(data["recipes"], list)
        assert len(data["ingredients"]) >= 1
        assert len(data["recipes"]) >= 1
        # ingredient shape
        ing = data["ingredients"][0]
        assert "name" in ing and isinstance(ing["name"], str)
        assert "category" in ing
        # recipe shape (per contract in review)
        rec = data["recipes"][0]
        for k in ("title", "description", "cooking_time", "difficulty", "ingredients_used", "missing_ingredients", "instructions"):
            assert k in rec, f"recipe missing key {k}: {rec}"
        assert isinstance(rec["ingredients_used"], list)
        assert isinstance(rec["instructions"], list)
        # no mongo _id leaking
        assert "_id" not in data

        # NEW (iteration_110): fridge -> instant /recipe path depends on
        # every returned recipe carrying a non-empty instructions[] of strings.
        for idx, rr in enumerate(data["recipes"]):
            assert isinstance(rr.get("instructions"), list), f"recipe[{idx}] instructions not a list: {rr}"
            assert len(rr["instructions"]) >= 1, f"recipe[{idx}] has empty instructions[]"
            for j, step in enumerate(rr["instructions"]):
                assert isinstance(step, str) and step.strip(), (
                    f"recipe[{idx}].instructions[{j}] not a non-empty string: {step!r}"
                )

    def test_scan_empty_image_400(self, api_client, auth_token):
        r = api_client.post(
            f"{BASE_URL}/api/mobile-fridge/scan",
            json={"image_data": ""},
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=20,
        )
        assert r.status_code == 400, f"expected 400, got {r.status_code} {r.text}"

    def test_scan_invalid_base64(self, api_client, auth_token):
        r = api_client.post(
            f"{BASE_URL}/api/mobile-fridge/scan",
            json={"image_data": "!!!not-base64!!!"},
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=30,
        )
        # base64.b64decode is lenient; may reach AI stage which then 422s or 502s.
        assert r.status_code in (400, 422, 502)
