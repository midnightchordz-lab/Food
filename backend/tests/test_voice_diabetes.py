"""Backend tests for Voice AI Chef (TTS) and Diabetes Planner (mobile)."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://app-launch-2905.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth(api):
    ts = int(time.time())
    email = f"cv_test+{ts}@example.com"
    password = "Test1234"
    r = api.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": password, "name": "CV Test"})
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    body = r.json()
    token = body.get("access_token") or body.get("token")
    assert token, f"no token in register response: {body}"
    return {"email": email, "password": password, "token": token, "headers": {"Authorization": f"Bearer {token}"}}


# ---------- Voice / TTS ----------

class TestMobileVoiceTTS:
    def test_tts_returns_url_and_audio_file_is_served(self, api):
        r = api.post(f"{BASE_URL}/api/mobile-voice/tts", json={"text": "Preheat the oven to 400 degrees Fahrenheit.", "voice": "nova"})
        assert r.status_code == 200, f"tts failed: {r.status_code} {r.text}"
        data = r.json()
        assert "url" in data and isinstance(data["url"], str)
        url = data["url"]
        assert url.startswith("/api/audio/file/") and url.endswith(".mp3")
        # fetch the audio
        r2 = requests.get(f"{BASE_URL}{url}", timeout=30)
        assert r2.status_code == 200, f"audio file fetch failed: {r2.status_code}"
        ct = r2.headers.get("content-type", "")
        assert "audio" in ct.lower() or ct.lower().endswith("mpeg"), f"unexpected content-type: {ct}"
        assert len(r2.content) > 500, "audio content suspiciously small"

    def test_tts_defaults_voice_when_invalid(self, api):
        r = api.post(f"{BASE_URL}/api/mobile-voice/tts", json={"text": "Whisk gently for 30 seconds.", "voice": "not-a-voice"})
        assert r.status_code == 200
        assert r.json().get("url", "").startswith("/api/audio/file/")

    def test_tts_empty_text_400(self, api):
        r = api.post(f"{BASE_URL}/api/mobile-voice/tts", json={"text": "", "voice": "nova"})
        assert r.status_code == 400


# ---------- Diabetes Planner ----------

class TestMobileDiabetes:
    def test_plan_requires_auth(self, api):
        r = api.post(f"{BASE_URL}/api/mobile-diabetes/plan", json={"diabetes_type": "type2", "dietary_preference": "vegetarian"})
        assert r.status_code in (401, 403), f"expected auth required, got {r.status_code}"

    def test_get_plan_empty_for_new_user(self, api, auth):
        r = api.get(f"{BASE_URL}/api/mobile-diabetes/plan", headers=auth["headers"])
        assert r.status_code == 200
        body = r.json()
        assert body.get("has_plan") is False
        assert body.get("plan") is None

    def test_generate_plan_and_shape(self, api, auth):
        r = api.post(
            f"{BASE_URL}/api/mobile-diabetes/plan",
            json={"diabetes_type": "type2", "dietary_preference": "vegetarian"},
            headers=auth["headers"],
            timeout=120,
        )
        assert r.status_code == 200, f"generate failed: {r.status_code} {r.text}"
        body = r.json()
        assert body.get("has_plan") is True
        plan = body.get("plan")
        assert plan and isinstance(plan, dict)
        assert plan.get("max_carbs_per_meal") and isinstance(plan["max_carbs_per_meal"], int)
        assert plan.get("avg_carbs_per_day") is not None
        days = plan.get("days")
        assert isinstance(days, list) and len(days) == 7, f"expected 7 days, got {len(days) if isinstance(days, list) else 'N/A'}"
        allowed_flags = {"safe", "caution", "spike"}
        expected_day_names = {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}
        assert {d["day"] for d in days} == expected_day_names
        for d in days:
            meals = d.get("meals")
            assert isinstance(meals, list) and len(meals) == 3, f"day {d.get('day')} has {len(meals) if isinstance(meals,list) else 'N/A'} meals"
            types_seen = [m["type"] for m in meals]
            assert types_seen == ["Breakfast", "Lunch", "Dinner"], f"unexpected meal ordering: {types_seen}"
            for m in meals:
                assert isinstance(m.get("name"), str) and m["name"]
                assert isinstance(m.get("net_carbs"), int)
                assert m.get("flag") in allowed_flags
                assert "note" in m

    def test_get_plan_returns_saved(self, api, auth):
        r = api.get(f"{BASE_URL}/api/mobile-diabetes/plan", headers=auth["headers"])
        assert r.status_code == 200
        body = r.json()
        assert body.get("has_plan") is True
        assert body.get("plan") and isinstance(body["plan"].get("days"), list) and len(body["plan"]["days"]) == 7
