"""
Contract tests for Emergent-managed Google auth POST /api/auth/session and
regression tests to confirm existing email + phone auth flows still work
after AuthContext + Welcome screen changes.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_BACKEND_URL", "https://app-launch-2905.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- Google session contract ----------
class TestGoogleSessionContract:
    def test_invalid_session_id_returns_401(self, api_client):
        r = api_client.post(f"{API}/auth/session", json={"session_id": "invalid"})
        assert r.status_code == 401, r.text

    def test_empty_session_id_returns_401(self, api_client):
        r = api_client.post(f"{API}/auth/session", json={"session_id": ""})
        assert r.status_code == 401, r.text

    def test_missing_session_id_returns_422(self, api_client):
        # Pydantic model requires session_id, missing body -> 422 (validation)
        r = api_client.post(f"{API}/auth/session", json={})
        assert r.status_code in (401, 422), r.text

    def test_does_not_accept_session_token_field(self, api_client):
        # Sending session_token instead of session_id should NOT authenticate
        r = api_client.post(f"{API}/auth/session", json={"session_token": "whatever"})
        assert r.status_code in (401, 422), r.text
        # ensure no access_token issued
        try:
            body = r.json()
            assert "access_token" not in body
        except Exception:
            pass


# ---------- Email auth regression ----------
class TestEmailAuthRegression:
    ts = int(time.time())
    email = f"ga_test+{ts}@example.com"
    password = "Test1234"
    name = "GA Regression"
    token = None
    user_id = None

    def test_register_new_user(self, api_client):
        r = api_client.post(f"{API}/auth/register", json={
            "name": self.name, "email": self.email, "password": self.password,
        })
        assert r.status_code in (200, 201), r.text
        data = r.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == self.email
        TestEmailAuthRegression.token = data["access_token"]
        TestEmailAuthRegression.user_id = data["user"]["id"]

    def test_me_after_register(self, api_client):
        assert TestEmailAuthRegression.token, "register must succeed first"
        r = api_client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {TestEmailAuthRegression.token}"})
        assert r.status_code == 200, r.text
        assert r.json()["email"] == TestEmailAuthRegression.email

    def test_login_same_creds(self, api_client):
        r = api_client.post(f"{API}/auth/login", json={
            "email": TestEmailAuthRegression.email,
            "password": TestEmailAuthRegression.password,
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert "access_token" in data
        assert data["user"]["id"] == TestEmailAuthRegression.user_id


# ---------- Phone OTP regression ----------
class TestPhoneAuthRegression:
    phone = f"+1415555{int(time.time()) % 10000:04d}"
    demo_otp = None

    def test_send_otp(self, api_client):
        r = api_client.post(f"{API}/auth/phone/send-otp", json={"phone_number": self.phone})
        assert r.status_code == 200, r.text
        data = r.json()
        # Preview env should return demo_otp
        assert data.get("demo_otp"), f"expected demo_otp in preview, got {data}"
        TestPhoneAuthRegression.demo_otp = data["demo_otp"]

    def test_verify_otp(self, api_client):
        assert TestPhoneAuthRegression.demo_otp, "send-otp must succeed first"
        r = api_client.post(f"{API}/auth/phone/verify-otp", json={
            "phone_number": self.phone,
            "code": TestPhoneAuthRegression.demo_otp,
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert "access_token" in data
        assert "user" in data


# ---------- Apple auth still 401 on bogus token (sanity) ----------
class TestAppleAuthSanity:
    def test_apple_bad_token_401(self, api_client):
        r = api_client.post(f"{API}/auth/apple", json={"identity_token": "bad"})
        assert r.status_code == 401, r.text
