"""
Backend tests for the refresh-token rotation system.

Coverage:
- REGRESSION: register, login return access + refresh tokens (access has type=access, ~30 min exp)
- REGRESSION: /auth/me works with access token; wrong password -> 401
- REGRESSION: phone OTP flow -> access + refresh
- ROTATION: /auth/refresh returns NEW access + NEW refresh
- REUSE DETECTION: old refresh reused -> 401; all sessions revoked (child also 401); auth_events written
- CONCURRENCY: two simultaneous /auth/refresh -> exactly one 200 + one 401
- LOGOUT: /auth/logout revokes the presented refresh
- TOKEN TYPE SEPARATION: refresh token cannot be used as bearer
- BACKWARDS COMPAT: legacy JWT without 'type' claim accepted by /auth/me
- REGRESSION: public /subscription/plans 200; /auth/me 200 w/ fresh access
"""
import os
import uuid
import time
import threading
import pytest
import requests
import jwt as pyjwt
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient


# ---- Config ----
BASE_URL = os.environ.get("EXPO_BACKEND_URL", "https://app-launch-2905.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# Read JWT secret + Mongo config directly from backend/.env (allowed for this test)
def _load_env():
    env = {}
    with open("/app/backend/.env") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    return env

_ENV = _load_env()
JWT_SECRET = _ENV["JWT_SECRET_KEY"]
MONGO_URL = _ENV["MONGO_URL"]
DB_NAME = _ENV["DB_NAME"]


@pytest.fixture(scope="module")
def mongo():
    c = MongoClient(MONGO_URL)
    return c[DB_NAME]


@pytest.fixture
def api():
    s = requests.Session()
    s.headers["Content-Type"] = "application/json"
    return s


def _register(api, email=None, password="Test1234!"):
    email = email or f"TEST_{uuid.uuid4().hex[:12]}@example.com"
    r = api.post(f"{API}/auth/register", json={
        "email": email, "password": password, "name": "TEST User"
    }, timeout=30)
    return r, email, password


# ============ REGRESSION: REGISTER ============

class TestRegisterRegression:
    def test_register_returns_token_pair(self, api):
        r, email, pwd = _register(api)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "access_token" in data and data["access_token"]
        assert "refresh_token" in data and data["refresh_token"]
        assert data.get("token_type") == "bearer"
        assert data.get("user") and data["user"].get("email") == email.lower()

        # Access token decodes with type='access' and ~30 min expiry
        payload = pyjwt.decode(data["access_token"], JWT_SECRET, algorithms=["HS256"])
        assert payload.get("type") == "access"
        assert payload.get("sub") == data["user"]["id"]
        # exp ~ 30 min from now
        exp = payload["exp"]
        now = datetime.now(timezone.utc).timestamp()
        delta = exp - now
        assert 25 * 60 <= delta <= 35 * 60, f"access token exp delta={delta}s (want ~1800s)"

        # trial should be present for new user
        assert data.get("trial") is not None, "trial info missing after auto-start"
        assert data["trial"].get("active") is True

        # Refresh token format: '<uuid>.<secret>'
        tok = data["refresh_token"]
        assert "." in tok
        tid = tok.split(".", 1)[0]
        assert len(tid) == 36  # uuid4

    def test_duplicate_email_rejected(self, api):
        r, email, pwd = _register(api)
        assert r.status_code == 200
        r2 = api.post(f"{API}/auth/register", json={"email": email, "password": pwd, "name": "x"})
        assert r2.status_code == 400


# ============ REGRESSION: LOGIN ============

class TestLoginRegression:
    def test_login_returns_pair_and_me_works(self, api):
        r, email, pwd = _register(api)
        assert r.status_code == 200

        lr = api.post(f"{API}/auth/login", json={"email": email, "password": pwd})
        assert lr.status_code == 200, lr.text
        d = lr.json()
        assert d.get("access_token") and d.get("refresh_token")
        assert d["refresh_token"] != r.json()["refresh_token"], "login should mint a fresh refresh"

        me = api.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {d['access_token']}"})
        assert me.status_code == 200
        assert me.json().get("email") == email.lower()

    def test_login_wrong_password_returns_401(self, api):
        r, email, _ = _register(api)
        assert r.status_code == 200
        bad = api.post(f"{API}/auth/login", json={"email": email, "password": "WrongPassword!!"})
        assert bad.status_code == 401


# ============ REGRESSION: PHONE OTP ============

class TestPhoneOtpRegression:
    def test_phone_otp_returns_pair(self, api):
        phone = f"+1555{uuid.uuid4().int % 10_000_000:07d}"
        send = api.post(f"{API}/auth/phone/send-otp", json={"phone_number": phone})
        # Twilio may 502 to invalid number; AUTH_DEBUG_RETURN_OTP=true should yield demo_otp
        if send.status_code != 200:
            pytest.skip(f"send-otp {send.status_code}: {send.text}")
        body = send.json()
        otp = body.get("demo_otp")
        if not otp:
            pytest.skip("Twilio real send (no demo_otp exposed); cannot verify without SMS pickup")
        v = api.post(f"{API}/auth/phone/verify-otp", json={"phone_number": phone, "code": otp})
        assert v.status_code == 200, v.text
        d = v.json()
        assert d.get("access_token") and d.get("refresh_token")
        assert d.get("is_new_user") is True

        me = api.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {d['access_token']}"})
        assert me.status_code == 200


# ============ ROTATION ============

class TestRotation:
    def test_refresh_returns_new_pair(self, api):
        r, email, pwd = _register(api)
        first = r.json()
        rr = api.post(f"{API}/auth/refresh", json={"refresh_token": first["refresh_token"]})
        assert rr.status_code == 200, rr.text
        new = rr.json()
        assert new["access_token"] and new["refresh_token"]
        # NOTE: access tokens issued in the same second have identical bytes
        # (payload = sub + exp(seconds) + type only, no iat/jti). The refresh
        # token IS rotated — that's the security-critical property.
        assert new["refresh_token"] != first["refresh_token"], "refresh must be rotated"

        # new access works on /auth/me
        me = api.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {new['access_token']}"})
        assert me.status_code == 200

        # Double-check by refreshing again after 1.1s → new access differs
        time.sleep(1.1)
        rr2 = api.post(f"{API}/auth/refresh", json={"refresh_token": new["refresh_token"]})
        assert rr2.status_code == 200
        assert rr2.json()["access_token"] != new["access_token"]
        assert rr2.json()["refresh_token"] != new["refresh_token"]


# ============ REUSE DETECTION ============

class TestReuseDetection:
    def test_reused_refresh_revokes_all_sessions_and_logs_event(self, api, mongo):
        r, email, pwd = _register(api)
        first = r.json()
        user_id = first["user"]["id"]
        old_refresh = first["refresh_token"]

        # Rotate once → get child
        rr = api.post(f"{API}/auth/refresh", json={"refresh_token": old_refresh})
        assert rr.status_code == 200
        child_refresh = rr.json()["refresh_token"]

        # Reuse old → 401 with reuse message
        reuse = api.post(f"{API}/auth/refresh", json={"refresh_token": old_refresh})
        assert reuse.status_code == 401, reuse.text
        assert "reuse" in reuse.text.lower(), reuse.text

        # Child now revoked (all sessions killed)
        child_after = api.post(f"{API}/auth/refresh", json={"refresh_token": child_refresh})
        assert child_after.status_code == 401, child_after.text

        # auth_events row written
        # small wait to allow write
        time.sleep(0.3)
        evt = mongo.auth_events.find_one({"user_id": user_id, "event": "refresh_token_reuse"})
        assert evt is not None, "expected auth_events doc with event='refresh_token_reuse'"


# ============ CONCURRENCY ============

class TestConcurrency:
    def test_two_simultaneous_refresh_one_wins(self, api):
        r, _, _ = _register(api)
        rt = r.json()["refresh_token"]

        results = []

        def _do():
            try:
                resp = requests.post(f"{API}/auth/refresh",
                                     json={"refresh_token": rt},
                                     headers={"Content-Type": "application/json"},
                                     timeout=30)
                results.append(resp.status_code)
            except Exception as e:
                results.append(str(e))

        t1 = threading.Thread(target=_do)
        t2 = threading.Thread(target=_do)
        t1.start(); t2.start()
        t1.join(); t2.join()

        codes = sorted(results)
        assert codes == [200, 401], f"expected exactly one 200 + one 401, got {codes}"


# ============ LOGOUT ============

class TestLogout:
    def test_logout_revokes_presented_refresh(self, api):
        r, _, _ = _register(api)
        rt = r.json()["refresh_token"]

        lo = api.post(f"{API}/auth/logout", json={"refresh_token": rt})
        assert lo.status_code == 200, lo.text

        after = api.post(f"{API}/auth/refresh", json={"refresh_token": rt})
        assert after.status_code == 401


# ============ TOKEN TYPE SEPARATION ============

class TestTokenTypeSeparation:
    def test_refresh_token_not_usable_as_bearer(self, api):
        r, _, _ = _register(api)
        rt = r.json()["refresh_token"]
        # Refresh token is opaque 'id.secret' — not a JWT → jwt.decode fails → 401
        me = api.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {rt}"})
        assert me.status_code == 401


# ============ BACKWARDS COMPAT ============

class TestBackwardsCompat:
    def test_legacy_jwt_without_type_claim_accepted(self, api):
        r, email, _ = _register(api)
        user_id = r.json()["user"]["id"]

        # Mint a legacy token: no 'type' claim, signed w/ JWT_SECRET_KEY, future exp
        payload = {
            "sub": user_id,
            "exp": datetime.now(timezone.utc) + timedelta(days=30),
        }
        legacy = pyjwt.encode(payload, JWT_SECRET, algorithm="HS256")

        me = api.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {legacy}"})
        assert me.status_code == 200, f"legacy token rejected: {me.status_code} {me.text}"
        assert me.json().get("id") == user_id


# ============ REGRESSION: PROTECTED + PUBLIC ============

class TestProtectedRegression:
    def test_subscription_plans_public(self, api):
        r = api.get(f"{API}/subscription/plans")
        assert r.status_code == 200

    def test_me_with_fresh_access(self, api):
        r, email, _ = _register(api)
        at = r.json()["access_token"]
        me = api.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {at}"})
        assert me.status_code == 200
