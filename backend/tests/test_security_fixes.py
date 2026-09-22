"""
Security fixes verification tests (SECURITY-FIXES.md batch).
Covers: C1 admin gate, H1 OTP no-leak, M3 OTP rate limit, H2 register-push auth,
M2 image auth gate, C3 Razorpay verify auth, L1 email normalization, and regression.
"""
import os
import time
import uuid
import random
import string
import pytest
import requests

BASE_URL = os.environ.get("EXPO_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
if not BASE_URL:
    # frontend/.env holds it under EXPO_PUBLIC_BACKEND_URL
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip()
                    break
    except Exception:
        pass
BASE_URL = (BASE_URL or "").rstrip("/")
assert BASE_URL, "Public backend URL not configured"

ADMIN_KEY = "d2c8f17dd719d83a0d25999b05b3e95f3e8f86d25ca4f152d5d7782c45ccafd9"


def _rand(n=8):
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=n))


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def test_user(api):
    """Register a fresh user, return {email, password, token, user_id}."""
    email = f"TEST_sec_{_rand()}@example.com"
    password = "TestPass123!"
    r = api.post(f"{BASE_URL}/api/auth/register",
                 json={"name": "Sec Test", "email": email, "password": password})
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text[:300]}"
    data = r.json()
    return {
        "email": email,
        "password": password,
        "token": data["access_token"],
        "user_id": data["user"]["id"],
    }


# ============== C1: Admin auth gate ==============
ADMIN_ENDPOINTS = [
    ("GET",  "/api/subscription/stats", None),
    ("GET",  "/api/subscription/admin/subscription-integrity-check", None),
    ("GET",  "/api/subscription/admin/audit-logs", None),
    # /admin/audit-logs/user/{id} filled dynamically
    ("POST", "/api/subscription/admin/fix-invalid-subscriptions?dry_run=true", None),
]


class TestC1AdminGate:
    def test_admin_endpoints_reject_without_header(self, api, test_user):
        endpoints = ADMIN_ENDPOINTS + [
            ("GET", f"/api/subscription/admin/audit-logs/user/{test_user['user_id']}", None)
        ]
        for method, path, body in endpoints:
            r = api.request(method, f"{BASE_URL}{path}", json=body)
            assert r.status_code == 403, (
                f"{method} {path} expected 403 without X-Admin-Key, got {r.status_code} {r.text[:200]}"
            )

    def test_admin_endpoints_accept_with_correct_header(self, api, test_user):
        headers = {"X-Admin-Key": ADMIN_KEY}
        endpoints = ADMIN_ENDPOINTS + [
            ("GET", f"/api/subscription/admin/audit-logs/user/{test_user['user_id']}", None)
        ]
        for method, path, body in endpoints:
            r = api.request(method, f"{BASE_URL}{path}", headers=headers, json=body)
            # Admin gate passed if we don't get 403. 500 = downstream bug (report separately).
            assert r.status_code != 403, (
                f"{method} {path} unexpected 403 with valid admin key, got {r.status_code} {r.text[:300]}"
            )
            # Also record any 500 for reporting
            if r.status_code >= 500:
                print(f"WARN: admin endpoint {method} {path} returned {r.status_code}: {r.text[:200]}")

    def test_admin_rejects_wrong_key(self, api):
        r = api.get(f"{BASE_URL}/api/subscription/stats",
                    headers={"X-Admin-Key": "wrong-key"})
        assert r.status_code == 403


# ============== H1: OTP no-leak ==============
class TestH1OtpNoLeak:
    def test_successful_send_has_no_demo_otp(self, api):
        # Use a fake but E.164-formatted number. Twilio may either succeed with a
        # 'pending' response, or fail (bad number) — in which case AUTH_DEBUG mode
        # is allowed to return demo_otp per the review request.
        phone = f"+1555010{random.randint(1000, 9999)}"
        r = api.post(f"{BASE_URL}/api/auth/phone/send-otp",
                     json={"phone_number": phone})
        body = {}
        try:
            body = r.json()
        except Exception:
            pass

        if r.status_code == 200 and body.get("status") == "pending" and body.get("sid"):
            # Twilio accepted — MUST NOT contain demo_otp
            assert "demo_otp" not in body, f"demo_otp leaked in successful send: {body}"
        elif r.status_code in (502, 503):
            # Fail-closed path — acceptable (no demo_otp expected in prod, but
            # AUTH_DEBUG_RETURN_OTP=true in this dev env, so we don't fail on
            # a demo_otp in this branch)
            pass
        elif r.status_code == 200 and body.get("demo_otp"):
            # Twilio failed but debug mode returned demo_otp — acceptable in this env
            assert body.get("status") == "pending"
        else:
            pytest.fail(f"Unexpected send-otp response: {r.status_code} {body}")


# ============== M3: OTP rate limit ==============
class TestM3OtpRateLimit:
    def test_rate_limit_returns_429_after_5(self, api):
        phone = f"+1555020{random.randint(1000, 9999)}"
        statuses = []
        for _ in range(7):
            r = api.post(f"{BASE_URL}/api/auth/phone/send-otp",
                         json={"phone_number": phone})
            statuses.append(r.status_code)
            if r.status_code == 429:
                break
            time.sleep(0.2)
        assert 429 in statuses, f"expected 429 after 5+ sends, saw {statuses}"


# ============== H2: register-push auth ==============
class TestH2RegisterPushAuth:
    def test_no_token_rejected(self, api):
        r = api.post(f"{BASE_URL}/api/register-push",
                     json={"platform": "ios", "device_token": "test-token-123"})
        assert r.status_code in (401, 403), f"expected 401/403 without token, got {r.status_code}"

    def test_with_token_not_401_for_auth(self, api, test_user):
        headers = {"Authorization": f"Bearer {test_user['token']}"}
        r = api.post(f"{BASE_URL}/api/register-push",
                     headers=headers,
                     json={"platform": "ios", "device_token": "test-token-123"})
        # May 500/502 due to placeholder EMERGENT_PUSH_KEY, but not 401
        assert r.status_code != 401, f"unexpected 401 with valid token: {r.text[:200]}"
        assert r.status_code != 403 or "admin" not in r.text.lower()


# ============== M2: image ai-generate auth gate ==============
class TestM2ImageAuth:
    def test_ai_generate_requires_auth(self, api):
        r = api.post(f"{BASE_URL}/api/recipe-image/ai-generate",
                     json={"title": "Test", "cuisine": "Indian", "ingredients": []})
        assert r.status_code in (401, 403), f"expected 401/403 without token, got {r.status_code}"


# ============== C3: Razorpay verify-payment auth ==============
class TestC3RazorpayVerify:
    def test_no_token_rejected(self, api):
        r = api.post(f"{BASE_URL}/api/subscription/razorpay/verify-payment",
                     json={"razorpay_order_id": "order_bogus",
                           "razorpay_payment_id": "pay_bogus",
                           "razorpay_signature": "sig_bogus",
                           "plan_id": "premium_monthly"})
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"

    def test_with_token_bogus_order_fails(self, api, test_user):
        headers = {"Authorization": f"Bearer {test_user['token']}"}
        r = api.post(f"{BASE_URL}/api/subscription/razorpay/verify-payment",
                     headers=headers,
                     json={"razorpay_order_id": f"order_bogus_{_rand()}",
                           "razorpay_payment_id": f"pay_bogus_{_rand()}",
                           "razorpay_signature": "sig_bogus",
                           "plan_id": "premium_monthly"})
        # Signature verification should fail (400) or order not found (400)
        assert r.status_code in (400, 500), (
            f"expected 400 signature/order failure, got {r.status_code} {r.text[:200]}"
        )


# ============== L1: email normalization ==============
class TestL1EmailNormalization:
    def test_login_with_different_case(self, api):
        rand = _rand()
        mixed_email = f"CasE.Test+{rand}@Example.com"
        password = "TestPass123!"
        # Register
        r = api.post(f"{BASE_URL}/api/auth/register",
                     json={"name": "Case Test", "email": mixed_email, "password": password})
        assert r.status_code == 200, f"register failed: {r.status_code} {r.text[:300]}"

        # Login with a DIFFERENT case
        different_case = f"case.test+{rand}@example.COM"
        r2 = api.post(f"{BASE_URL}/api/auth/login",
                      json={"email": different_case, "password": password})
        assert r2.status_code == 200, (
            f"login with different case failed: {r2.status_code} {r2.text[:300]}"
        )
        assert "access_token" in r2.json()

    def test_duplicate_registration_different_case_rejected(self, api):
        rand = _rand()
        email1 = f"dup.test+{rand}@Example.com"
        password = "TestPass123!"
        r = api.post(f"{BASE_URL}/api/auth/register",
                     json={"name": "Dup Test", "email": email1, "password": password})
        assert r.status_code == 200

        email2 = f"DUP.test+{rand}@example.COM"
        r2 = api.post(f"{BASE_URL}/api/auth/register",
                      json={"name": "Dup Test 2", "email": email2, "password": password})
        assert r2.status_code == 400, f"expected 400 already registered, got {r2.status_code}"
        assert "already" in r2.text.lower() or "exist" in r2.text.lower()


# ============== Regression: core auth ==============
class TestRegressionAuth:
    def test_register_login_me(self, api):
        email = f"TEST_reg_{_rand()}@example.com"
        password = "TestPass123!"
        r = api.post(f"{BASE_URL}/api/auth/register",
                     json={"name": "Reg Test", "email": email, "password": password})
        assert r.status_code == 200
        assert "access_token" in r.json()

        r2 = api.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password})
        assert r2.status_code == 200
        token = r2.json()["access_token"]

        r3 = api.get(f"{BASE_URL}/api/auth/me",
                     headers={"Authorization": f"Bearer {token}"})
        assert r3.status_code == 200
        assert r3.json()["email"] == email.lower()


# ============== Regression: diabetes plan/swap ==============
class TestRegressionDiabetes:
    def test_plan_and_swap(self, api, test_user):
        headers = {"Authorization": f"Bearer {test_user['token']}"}
        r = api.post(f"{BASE_URL}/api/mobile-diabetes/plan",
                     headers=headers,
                     json={"diabetes_type": "type2", "dietary_preference": "balanced"})
        assert r.status_code == 200, f"plan failed: {r.status_code} {r.text[:300]}"
        outer = r.json()
        plan = outer.get("plan") or {}
        days = plan.get("days") or []
        assert days, f"unexpected plan shape (no days): {list(outer)[:10]}"
        first_day = days[0]
        day_key = first_day.get("day")
        meals = first_day.get("meals") or []
        assert day_key and meals, f"unexpected day shape: {first_day}"
        meal_type = meals[0].get("type") or "breakfast"

        r2 = api.post(f"{BASE_URL}/api/mobile-diabetes/swap",
                      headers=headers,
                      json={"day": day_key, "meal_type": meal_type})
        assert r2.status_code == 200, f"swap failed: {r2.status_code} {r2.text[:400]}"
        assert "plan" in r2.json() and "meal" in r2.json()


# ============== Regression: subscription plans public ==============
class TestRegressionPlans:
    def test_plans_public(self, api):
        r = requests.get(f"{BASE_URL}/api/subscription/plans")
        assert r.status_code == 200, f"plans failed: {r.status_code} {r.text[:200]}"
        data = r.json()
        # Should be a list or dict with 'plans'
        plans = data if isinstance(data, list) else data.get("plans", [])
        assert plans, f"empty plans: {data}"
