"""
Regression tests for Sign in with Apple server-side token revocation on
account deletion (Apple Guideline 5.1.1(v)).

Environment for this run: APPLE_TEAM_ID / APPLE_KEY_ID / APPLE_PRIVATE_KEY are
intentionally empty in /app/backend/.env, so `_apple_revocation_configured()`
returns False and `revoke_apple_token()` must be a graceful no-op. These tests
therefore verify:

  1. POST /api/auth/apple still accepts an optional `authorization_code` field
     without breaking the existing 401 behavior on a fake identity_token
     (pydantic model accepts the new field).
  2. The email/password web-deletion flow POST /api/account-deletion/request
     still works end-to-end. This exercises `purge_user_data()` which now runs
     an Apple-revoke step first; with no `apple_refresh_token` on the user and
     no Apple creds configured, it must not raise.
  3. The authenticated in-app deletion DELETE /api/auth/account still works
     and subsequent /auth/me returns 401.
  4. Basic auth (register/login) still works and auto-starts a trial.
"""

import os
import uuid
import pytest
import requests

# EXPO_BACKEND_URL is the public URL user hits (frontend .env keeps
# EXPO_PUBLIC_BACKEND_URL). Try both for robustness.
BASE_URL = (
    os.environ.get("EXPO_BACKEND_URL")
    or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or "https://app-launch-2905.preview.emergentagent.com"
).rstrip("/")

FAKE_APPLE_JWT = (
    # header {"alg":"RS256","kid":"nope"}
    "eyJhbGciOiJSUzI1NiIsImtpZCI6Im5vcGUifQ."
    # payload {"sub":"000","aud":"in.moodfood.app","iss":"https://appleid.apple.com"}
    "eyJzdWIiOiIwMDAiLCJhdWQiOiJpbi5tb29kZm9vZC5hcHAiLCJpc3MiOiJodHRwczovL2FwcGxlaWQuYXBwbGUuY29tIn0."
    "signature-not-valid"
)


@pytest.fixture
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _fresh_email():
    return f"TEST_apple_reg_{uuid.uuid4().hex[:10]}@example.com"


# --------------------------------------------------------------------------- #
# 1) POST /api/auth/apple accepts optional authorization_code (no 422/500).   #
# --------------------------------------------------------------------------- #

class TestAppleEndpointContract:
    def test_apple_without_authorization_code_still_401(self, api):
        """Old contract: identity_token only -> 401 on a fake token (not 422/500)."""
        r = api.post(f"{BASE_URL}/api/auth/apple", json={"identity_token": FAKE_APPLE_JWT})
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text}"
        body = r.json()
        assert "detail" in body
        # Must be one of the graceful failure messages, never a generic 500.
        assert body["detail"] in (
            "Invalid Apple token",
            "Apple key not found",
            "Could not verify Apple token",
        ), body

    def test_apple_with_authorization_code_still_401(self, api):
        """New field accepted by pydantic: still 401 on fake token, not 422/500."""
        r = api.post(
            f"{BASE_URL}/api/auth/apple",
            json={
                "identity_token": FAKE_APPLE_JWT,
                "authorization_code": "fake_auth_code_should_not_be_exchanged",
                "name": "QA Apple",
                "email": "qa_apple@example.com",
            },
        )
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text}"
        body = r.json()
        assert "detail" in body
        assert body["detail"] in (
            "Invalid Apple token",
            "Apple key not found",
            "Could not verify Apple token",
        ), body

    def test_apple_missing_identity_token_is_422(self, api):
        """Sanity: pydantic still requires identity_token."""
        r = api.post(f"{BASE_URL}/api/auth/apple", json={"authorization_code": "x"})
        assert r.status_code == 422, f"Expected 422, got {r.status_code}: {r.text}"


# --------------------------------------------------------------------------- #
# 2) Web deletion (email/password) still works — exercises purge_user_data    #
#    which now attempts Apple revoke first (must be a no-op).                 #
# --------------------------------------------------------------------------- #

class TestWebAccountDeletionRegression:
    def test_register_then_delete_via_web_flow(self, api):
        email = _fresh_email()
        password = "Test1234!"

        # Register
        reg = api.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": email,
                "password": password,
                "name": "QA Delete",
                "dietary_restrictions": [],
                "cuisine_preferences": [],
            },
        )
        assert reg.status_code == 200, f"register failed: {reg.status_code} {reg.text}"
        data = reg.json()
        assert "access_token" in data
        assert data["user"]["email"] == email.lower()

        # Wrong password -> 400 (must NOT delete)
        bad = api.post(
            f"{BASE_URL}/api/account-deletion/request",
            json={"email": email, "password": "WrongPass!"},
        )
        assert bad.status_code == 400, f"expected 400, got {bad.status_code}: {bad.text}"

        # Correct password -> 200, purge_user_data runs Apple no-op then deletes
        ok = api.post(
            f"{BASE_URL}/api/account-deletion/request",
            json={"email": email, "password": password},
        )
        assert ok.status_code == 200, f"delete failed: {ok.status_code} {ok.text}"
        body = ok.json()
        assert body.get("success") is True
        assert "permanently deleted" in body.get("message", "").lower()

        # After deletion, login must fail (401)
        relogin = api.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email, "password": password},
        )
        assert relogin.status_code == 401, f"user still logs in after delete: {relogin.status_code}"

    def test_deletion_page_html_reachable(self, api):
        r = api.get(f"{BASE_URL}/api/account-deletion")
        assert r.status_code == 200
        assert "text/html" in r.headers.get("content-type", "").lower()
        assert "Delete your" in r.text and "MoodFood" in r.text


# --------------------------------------------------------------------------- #
# 3) Authenticated in-app DELETE /api/auth/account still works.               #
# --------------------------------------------------------------------------- #

class TestInAppAccountDeletionRegression:
    def test_register_delete_account_then_me_is_401(self, api):
        email = _fresh_email()
        password = "Test1234!"

        reg = api.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": email,
                "password": password,
                "name": "QA InApp",
                "dietary_restrictions": [],
                "cuisine_preferences": [],
            },
        )
        assert reg.status_code == 200, reg.text
        token = reg.json()["access_token"]
        auth = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

        # /auth/me works before deletion
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=auth)
        assert me.status_code == 200, me.text
        assert me.json()["email"] == email.lower()

        # Delete account
        delete = requests.delete(f"{BASE_URL}/api/auth/account", headers=auth)
        assert delete.status_code == 200, f"delete failed: {delete.status_code} {delete.text}"
        assert delete.json().get("success") is True

        # After deletion, /auth/me must be 401
        me_after = requests.get(f"{BASE_URL}/api/auth/me", headers=auth)
        assert me_after.status_code == 401, (
            f"/auth/me must reject after delete, got {me_after.status_code}: {me_after.text}"
        )


# --------------------------------------------------------------------------- #
# 4) Basic auth still works + trial auto-start unchanged.                     #
# --------------------------------------------------------------------------- #

class TestBasicAuthRegression:
    def test_register_returns_trial_payload(self, api):
        email = _fresh_email()
        password = "Test1234!"
        reg = api.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": email,
                "password": password,
                "name": "QA Trial",
                "dietary_restrictions": [],
                "cuisine_preferences": [],
            },
        )
        assert reg.status_code == 200, reg.text
        body = reg.json()
        assert body.get("access_token")
        assert body.get("refresh_token")
        user = body.get("user") or {}
        # Trial should be started for a brand new email/password user
        trial = body.get("trial") or user.get("trial")
        assert trial is not None, f"expected trial to be auto-started, got: {body}"
        assert trial.get("active") is True
        assert trial.get("daysRemaining", 0) >= 1

        # Login also works and issues a fresh pair
        login = api.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email, "password": password},
        )
        assert login.status_code == 200, login.text
        lbody = login.json()
        assert lbody.get("access_token")
        assert lbody.get("user", {}).get("email") == email.lower()

        # Cleanup: delete this test user via web flow
        cleanup = api.post(
            f"{BASE_URL}/api/account-deletion/request",
            json={"email": email, "password": password},
        )
        assert cleanup.status_code == 200

    def test_login_wrong_password_401(self, api):
        r = api.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "no_such_user_" + uuid.uuid4().hex[:8] + "@example.com", "password": "x"},
        )
        assert r.status_code == 401, r.text
