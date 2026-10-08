"""
Tests for new features: dietary_preference, grace messaging, reactivate subscription
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://app-launch-2905.preview.emergentagent.com').rstrip('/')


@pytest.fixture(scope="module")
def auth_token():
    """Get auth token for reviewer account"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "reviewer@moodfood.app",
        "password": "Review@MoodFood2026"
    })
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["access_token"]


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestDietaryPreference:
    """Tests for dietary_preference field on profile"""

    def test_update_dietary_preference_vegetarian(self, auth_headers):
        resp = requests.put(f"{BASE_URL}/api/auth/profile", json={"dietary_preference": "vegetarian"}, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("dietary_preference") == "vegetarian", f"Expected vegetarian, got: {data.get('dietary_preference')}"

    def test_update_dietary_preference_vegan(self, auth_headers):
        resp = requests.put(f"{BASE_URL}/api/auth/profile", json={"dietary_preference": "vegan"}, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json().get("dietary_preference") == "vegan"

    def test_update_dietary_preference_non_vegetarian(self, auth_headers):
        resp = requests.put(f"{BASE_URL}/api/auth/profile", json={"dietary_preference": "non-vegetarian"}, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json().get("dietary_preference") == "non-vegetarian"

    def test_dietary_preference_persists_in_me(self, auth_headers):
        """After setting, GET /me should return the field"""
        requests.put(f"{BASE_URL}/api/auth/profile", json={"dietary_preference": "halal"}, headers=auth_headers)
        me_resp = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert me_resp.status_code == 200
        assert me_resp.json().get("dietary_preference") == "halal"

    def test_other_fields_not_affected(self, auth_headers):
        """Setting dietary_preference should not affect other fields"""
        resp = requests.put(f"{BASE_URL}/api/auth/profile", json={"dietary_preference": "jain"}, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("email") == "reviewer@moodfood.app"
        assert "dietary_restrictions" in data


class TestReactivateSubscription:
    """Tests for POST /subscription/reactivate"""

    def test_cancel_and_reactivate_flow(self, auth_headers):
        # First cancel (schedule)
        cancel_resp = requests.post(f"{BASE_URL}/api/subscription/cancel-v2",
                                    json={"cancel_at_period_end": True}, headers=auth_headers)
        assert cancel_resp.status_code == 200

        # Verify cancel_at_period_end=true
        sub_resp = requests.get(f"{BASE_URL}/api/subscription/current", headers=auth_headers)
        assert sub_resp.json()["subscription"]["cancel_at_period_end"] is True

        # Reactivate
        react_resp = requests.post(f"{BASE_URL}/api/subscription/reactivate", headers=auth_headers)
        assert react_resp.status_code == 200
        assert react_resp.json()["success"] is True

        # Verify cancel_at_period_end=false
        sub_resp2 = requests.get(f"{BASE_URL}/api/subscription/current", headers=auth_headers)
        assert sub_resp2.json()["subscription"]["cancel_at_period_end"] is False

    def test_reactivate_with_no_pending_cancellation_returns_error(self, auth_headers):
        """Reactivate when not pending cancellation should return error"""
        resp = requests.post(f"{BASE_URL}/api/subscription/reactivate", headers=auth_headers)
        assert resp.status_code == 404
        assert "No subscription pending cancellation" in resp.json()["detail"]


class TestSubscriptionCurrentEndpoint:
    """Tests for subscription endpoint structure (needed for grace messaging)"""

    def test_subscription_has_cancel_at_period_end_field(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/subscription/current", headers=auth_headers)
        assert resp.status_code == 200
        sub = resp.json()["subscription"]
        assert "cancel_at_period_end" in sub

    def test_subscription_has_period_end_field(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/subscription/current", headers=auth_headers)
        sub = resp.json()["subscription"]
        assert "current_period_end" in sub or "periodEnd" in sub
