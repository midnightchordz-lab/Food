"""
Tests for the two new enhancements:
1. Quick Recipes 'Use My Ingredients' - POST /api/quick-recipes/generate with ingredients
2. Add to List - POST /api/shopping-list (dedupe/merge) + GET /api/shopping-list
Also includes regression checks for the classic quick-recipes flow (no ingredients).
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_BACKEND_URL", "https://app-launch-2905.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def auth_token():
    """Register a fresh user, return bearer token."""
    ts = int(time.time())
    email = f"ing_test+{ts}@example.com"
    password = "Test1234"
    r = requests.post(f"{API}/auth/register", json={
        "email": email,
        "password": password,
        "name": "Ing Tester",
        "dietary_restrictions": [],
        "cuisine_preferences": [],
    }, timeout=30)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"no token in response: {data}"
    return token


@pytest.fixture(scope="module")
def headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


# ---------- Quick Recipes: with ingredients ----------

class TestQuickRecipesWithIngredients:
    def test_generate_tailored_to_ingredients(self, headers):
        r = requests.post(f"{API}/quick-recipes/generate", headers=headers, json={
            "count": 3,
            "dietary": "balanced",
            "cuisine": "mediterranean",
            "mood": "energizing",
            "ingredients": ["eggs", "spinach", "feta"],
            "equipment": "basic",
        }, timeout=90)
        assert r.status_code == 200, f"quick gen failed: {r.status_code} {r.text}"
        body = r.json()
        assert "recipes" in body and isinstance(body["recipes"], list)
        assert len(body["recipes"]) >= 1
        # Each recipe within 10 min & required fields
        for rec in body["recipes"]:
            assert rec["total_minutes"] <= 10
            assert rec["name"] and isinstance(rec["ingredients"], list) and len(rec["ingredients"]) >= 1
            assert isinstance(rec["instructions"], list) and len(rec["instructions"]) >= 1
        # At least one of the provided ingredients should appear in at least one recipe's ingredients
        blob = " ".join(
            (i if isinstance(i, str) else "") for rec in body["recipes"] for i in rec["ingredients"]
        ).lower()
        assert any(k in blob for k in ["egg", "spinach", "feta"]), f"provided ingredients not reflected: {blob[:400]}"

    def test_generate_without_ingredients_regression(self, headers):
        r = requests.post(f"{API}/quick-recipes/generate", headers=headers, json={
            "count": 3,
            "dietary": "balanced",
            "cuisine": "international",
            "mood": "energizing",
            "ingredients": [],
            "equipment": "basic",
        }, timeout=90)
        assert r.status_code == 200, f"regression gen failed: {r.status_code} {r.text}"
        body = r.json()
        assert len(body["recipes"]) >= 1
        for rec in body["recipes"]:
            assert rec["total_minutes"] <= 10


# ---------- Shopping List: create, dedupe, persistence ----------

class TestShoppingListAddToList:
    def test_empty_list_initially(self, headers):
        r = requests.get(f"{API}/shopping-list", headers=headers, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body.get("items", []), list)

    def test_post_then_get_persistence(self, headers):
        items = [
            {"name": "TEST_spinach 200g", "checked": False},
            {"name": "TEST_feta 100g", "checked": False},
            {"name": "TEST_eggs 4", "checked": False},
        ]
        r = requests.post(f"{API}/shopping-list", headers=headers, json={"items": items}, timeout=15)
        assert r.status_code == 200, f"post failed: {r.status_code} {r.text}"
        # verify GET
        g = requests.get(f"{API}/shopping-list", headers=headers, timeout=15)
        assert g.status_code == 200
        names = [str(i.get("name", "")) for i in g.json().get("items", [])]
        for n in ["TEST_spinach 200g", "TEST_feta 100g", "TEST_eggs 4"]:
            assert n in names, f"missing {n} in {names}"

    def test_dedupe_merge_case_insensitive(self, headers):
        """Frontend does: fetch -> merge dedupe by lower(name) -> POST full list back."""
        existing = requests.get(f"{API}/shopping-list", headers=headers, timeout=15).json().get("items", [])
        current = [{"name": i["name"], "checked": bool(i.get("checked"))} for i in existing]
        new_ings = ["TEST_SPINACH 200g", "TEST_tomato 3", "TEST_Olive Oil"]  # first is duplicate (case-insensitive)
        names_lower = {str(i["name"]).lower() for i in current}
        additions = [{"name": n, "checked": False} for n in new_ings if n.lower() not in names_lower]
        # exactly 2 new (TEST_SPINACH duplicate)
        assert len(additions) == 2, f"expected 2 additions after dedupe, got {additions}"
        merged = current + additions
        r = requests.post(f"{API}/shopping-list", headers=headers, json={"items": merged}, timeout=15)
        assert r.status_code == 200
        # confirm no duplicate spinach entries created
        names = [str(i["name"]) for i in requests.get(f"{API}/shopping-list", headers=headers, timeout=15).json().get("items", [])]
        spin_count = sum(1 for n in names if n.lower() == "test_spinach 200g")
        assert spin_count == 1, f"duplicate spinach entries: {names}"
        assert "TEST_tomato 3" in names
        assert "TEST_Olive Oil" in names

    def test_tap_again_no_new_additions(self, headers):
        """Simulate a second tap: all ingredients already present -> additions len == 0."""
        existing = requests.get(f"{API}/shopping-list", headers=headers, timeout=15).json().get("items", [])
        current = [{"name": i["name"], "checked": bool(i.get("checked"))} for i in existing]
        # try to add ingredients that already exist
        try_ings = [n["name"] for n in current[:3]]
        names_lower = {str(i["name"]).lower() for i in current}
        additions = [{"name": n, "checked": False} for n in try_ings if n.lower() not in names_lower]
        assert len(additions) == 0, "expected no additions when items already exist"

    def test_auth_required(self):
        r = requests.get(f"{API}/shopping-list", timeout=15)
        assert r.status_code in (401, 403), f"expected 401/403 unauth, got {r.status_code}"
        r2 = requests.post(f"{API}/shopping-list", json={"items": []}, timeout=15)
        assert r2.status_code in (401, 403)
        r3 = requests.post(f"{API}/quick-recipes/generate", json={"count": 1}, timeout=15)
        assert r3.status_code in (401, 403)
