"""
Backend tests for the Mobile Diabetes Planner endpoints:
  - POST /api/mobile-diabetes/plan
  - GET  /api/mobile-diabetes/plan
  - POST /api/mobile-diabetes/swap

Covers the AI-generated 7-day plan, per-meal shape validation, swap replaces a
single slot with a *different* dish, DB persistence via GET, avg_carbs_per_day
recomputation, 404 for invalid slots / no plan, and 401 for unauthenticated calls.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL (or EXPO_BACKEND_URL) must be set"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
MEAL_TYPES = ["Breakfast", "Lunch", "Dinner"]


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_user(session):
    """Register a fresh user and return (token, email)."""
    email = f"TEST_diab_swap_{uuid.uuid4().hex[:10]}@example.com"
    password = "Test1234!"
    payload = {"name": "Diab Swap Tester", "email": email, "password": password}
    r = session.post(f"{API}/auth/register", json=payload, timeout=30)
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"no token in register response: {data}"
    return {"token": token, "email": email, "password": password}


@pytest.fixture(scope="module")
def auth_headers(auth_user):
    return {"Authorization": f"Bearer {auth_user['token']}"}


@pytest.fixture(scope="module")
def generated_plan(session, auth_headers):
    """Generate a plan once and reuse for the swap tests (LLM call is slow)."""
    body = {"diabetes_type": "type2", "dietary_preference": "balanced"}
    r = session.post(f"{API}/mobile-diabetes/plan", json=body, headers=auth_headers, timeout=180)
    assert r.status_code == 200, f"plan generation failed: {r.status_code} {r.text}"
    data = r.json()
    assert data.get("has_plan") is True
    assert isinstance(data.get("plan"), dict)
    return data


# ---------- Helpers ----------
def _validate_plan_shape(plan: dict):
    """Assert the plan matches the documented shape."""
    assert plan.get("diabetes_type") == "type2"
    assert plan.get("dietary_preference") == "balanced"
    assert isinstance(plan.get("max_carbs_per_meal"), int) and plan["max_carbs_per_meal"] > 0
    assert isinstance(plan.get("avg_carbs_per_day"), int)
    days = plan.get("days")
    assert isinstance(days, list) and len(days) == 7, f"expected 7 days, got {len(days) if days else None}"
    seen_days = [d.get("day") for d in days]
    assert seen_days == DAYS, f"days out of order or missing: {seen_days}"
    for d in days:
        meals = d.get("meals")
        assert isinstance(meals, list) and len(meals) == 3, f"{d.get('day')} missing meals"
        types = [m.get("type") for m in meals]
        assert types == MEAL_TYPES, f"{d.get('day')} meal types wrong: {types}"
        for m in meals:
            assert isinstance(m.get("name"), str) and m["name"].strip(), "meal.name empty"
            assert isinstance(m.get("net_carbs"), int), f"net_carbs not int: {m.get('net_carbs')!r}"
            assert m.get("flag") in ("safe", "caution", "spike"), f"bad flag {m.get('flag')!r}"
            # note is required (string, allowed to be short)
            assert isinstance(m.get("note"), str)


# ---------- 401 (auth) tests ----------
class TestDiabetesAuthRequired:
    def test_post_plan_requires_auth(self, session):
        r = session.post(f"{API}/mobile-diabetes/plan", json={"diabetes_type": "type2"})
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"

    def test_get_plan_requires_auth(self, session):
        r = session.get(f"{API}/mobile-diabetes/plan")
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"

    def test_post_swap_requires_auth(self, session):
        r = session.post(f"{API}/mobile-diabetes/swap", json={"day": "Monday", "meal_type": "Breakfast"})
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"


# ---------- Swap without plan -> 404 ----------
class TestSwapWithoutPlan:
    def test_swap_returns_404_when_no_plan(self, session):
        """Register a brand-new user (no plan yet), swap must 404."""
        email = f"TEST_diab_noplan_{uuid.uuid4().hex[:10]}@example.com"
        r = session.post(f"{API}/auth/register",
                         json={"name": "NoPlan", "email": email, "password": "Test1234!"},
                         timeout=30)
        assert r.status_code in (200, 201)
        tok = (r.json().get("access_token") or r.json().get("token"))
        assert tok
        hdrs = {"Authorization": f"Bearer {tok}"}
        r2 = session.post(f"{API}/mobile-diabetes/swap",
                          json={"day": "Monday", "meal_type": "Breakfast"},
                          headers=hdrs, timeout=30)
        assert r2.status_code == 404, f"expected 404, got {r2.status_code} {r2.text}"


# ---------- Plan generation + GET ----------
class TestGeneratePlan:
    def test_plan_shape_and_values(self, generated_plan):
        _validate_plan_shape(generated_plan["plan"])

    def test_get_plan_returns_same_plan(self, session, auth_headers, generated_plan):
        r = session.get(f"{API}/mobile-diabetes/plan", headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("has_plan") is True
        # Compare canonical fields — plan structure should be identical (persisted)
        p1 = generated_plan["plan"]
        p2 = data.get("plan")
        assert p2 is not None
        assert p1["diabetes_type"] == p2["diabetes_type"]
        assert p1["dietary_preference"] == p2["dietary_preference"]
        assert p1["max_carbs_per_meal"] == p2["max_carbs_per_meal"]
        assert p1["avg_carbs_per_day"] == p2["avg_carbs_per_day"]
        # Days list should match by dish names
        for d1, d2 in zip(p1["days"], p2["days"]):
            assert d1["day"] == d2["day"]
            assert [m["name"] for m in d1["meals"]] == [m["name"] for m in d2["meals"]]


# ---------- Swap happy-path + invalid slot ----------
class TestSwapMeal:
    def test_swap_monday_breakfast_replaces_and_persists(self, session, auth_headers, generated_plan):
        plan = generated_plan["plan"]
        # find the original Monday Breakfast
        monday = next(d for d in plan["days"] if d["day"] == "Monday")
        orig_bf = next(m for m in monday["meals"] if m["type"] == "Breakfast")
        orig_name = orig_bf["name"]
        orig_avg = plan["avg_carbs_per_day"]

        r = session.post(f"{API}/mobile-diabetes/swap",
                         json={"day": "Monday", "meal_type": "Breakfast"},
                         headers=auth_headers, timeout=180)
        assert r.status_code == 200, f"swap failed: {r.status_code} {r.text}"
        body = r.json()
        assert "meal" in body and "plan" in body
        new_meal = body["meal"]

        # new meal shape
        assert new_meal.get("type") == "Breakfast"
        assert isinstance(new_meal.get("name"), str) and new_meal["name"].strip()
        assert isinstance(new_meal.get("net_carbs"), int)
        assert new_meal.get("flag") in ("safe", "caution", "spike")
        assert isinstance(new_meal.get("note"), str)

        # DIFFERENT name than the original Monday Breakfast
        assert new_meal["name"].strip().lower() != orig_name.strip().lower(), (
            f"swap did not change dish name (still '{orig_name}')"
        )

        # returned plan reflects the swap at Monday-Breakfast slot
        returned_plan = body["plan"]
        r_monday = next(d for d in returned_plan["days"] if d["day"] == "Monday")
        r_bf = next(m for m in r_monday["meals"] if m["type"] == "Breakfast")
        assert r_bf["name"] == new_meal["name"]
        assert r_bf["net_carbs"] == new_meal["net_carbs"]
        assert r_bf["flag"] == new_meal["flag"]

        # avg_carbs_per_day is recomputed (integer, may or may not differ; must be present + valid)
        assert isinstance(returned_plan.get("avg_carbs_per_day"), int)
        # Sanity: recompute expected avg from returned plan
        total = sum(m["net_carbs"] for d in returned_plan["days"] for m in d["meals"])
        assert returned_plan["avg_carbs_per_day"] == round(total / 7)

        # If net_carbs changed vs original, avg should change; either way it must reflect current state.
        # Persisted via GET:
        time.sleep(0.5)
        r2 = session.get(f"{API}/mobile-diabetes/plan", headers=auth_headers, timeout=30)
        assert r2.status_code == 200
        stored = r2.json()["plan"]
        s_bf = next(m for m in next(d for d in stored["days"] if d["day"] == "Monday")["meals"]
                    if m["type"] == "Breakfast")
        assert s_bf["name"] == new_meal["name"], "DB did not persist the swapped meal"
        assert stored["avg_carbs_per_day"] == returned_plan["avg_carbs_per_day"]

        # And avg_carbs_per_day is either different or, if the same, the difference in bf carbs is 0
        bf_delta = new_meal["net_carbs"] - orig_bf["net_carbs"]
        if bf_delta != 0:
            assert stored["avg_carbs_per_day"] != orig_avg or abs(bf_delta) < 7, (
                "avg_carbs_per_day should recompute after swap"
            )

    def test_swap_invalid_day_returns_404(self, session, auth_headers, generated_plan):
        r = session.post(f"{API}/mobile-diabetes/swap",
                         json={"day": "Funday", "meal_type": "Breakfast"},
                         headers=auth_headers, timeout=180)
        # Route calls LLM first, then fails to find slot -> 404 from server-side check.
        assert r.status_code == 404, f"expected 404, got {r.status_code} {r.text}"

    def test_swap_invalid_meal_type_returns_404(self, session, auth_headers, generated_plan):
        r = session.post(f"{API}/mobile-diabetes/swap",
                         json={"day": "Monday", "meal_type": "Brunch"},
                         headers=auth_headers, timeout=180)
        assert r.status_code == 404, f"expected 404, got {r.status_code} {r.text}"
