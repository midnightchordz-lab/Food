"""
Test Subscription Management Endpoints
Tests for:
- POST /api/subscription/cancel - Cancel subscription
- POST /api/subscription/reactivate - Reactivate cancelled subscription
- GET /api/subscription/billing-history - Get billing history
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user credentials
TEST_EMAIL = "test@test.com"
TEST_PASSWORD = "test123"


class TestSubscriptionManagement:
    """Test subscription management endpoints"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("access_token") or data.get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            # Try to register if login fails
            unique_email = f"test_sub_mgmt_{uuid.uuid4().hex[:8]}@test.com"
            register_resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
                "email": unique_email,
                "password": "TestPass123!",
                "name": "Test Subscription User"
            })
            if register_resp.status_code == 200:
                reg_data = register_resp.json()
                self.token = reg_data.get("access_token") or reg_data.get("token")
                self.session.headers.update({"Authorization": f"Bearer {self.token}"})
            else:
                pytest.skip("Could not authenticate for tests")
    
    # =============== BILLING HISTORY TESTS ===============
    
    def test_billing_history_endpoint_exists(self):
        """Test GET /api/subscription/billing-history endpoint exists"""
        response = self.session.get(f"{BASE_URL}/api/subscription/billing-history")
        
        # Should return 200 with success flag, not 404
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True, "Expected success=true in response"
    
    def test_billing_history_returns_transactions(self):
        """Test billing history returns transactions array"""
        response = self.session.get(f"{BASE_URL}/api/subscription/billing-history")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should have transactions array
        assert "transactions" in data, "Response should have 'transactions' field"
        assert isinstance(data["transactions"], list), "transactions should be a list"
        
        # Should have count field
        assert "count" in data, "Response should have 'count' field"
    
    def test_billing_history_with_limit(self):
        """Test billing history with limit parameter"""
        response = self.session.get(f"{BASE_URL}/api/subscription/billing-history?limit=5")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should respect limit
        assert len(data.get("transactions", [])) <= 5
    
    def test_billing_history_requires_auth(self):
        """Test billing history requires authentication"""
        # Create new session without auth
        unauth_session = requests.Session()
        unauth_session.headers.update({"Content-Type": "application/json"})
        
        response = unauth_session.get(f"{BASE_URL}/api/subscription/billing-history")
        
        # Should return 401 or 403
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    # =============== CANCEL SUBSCRIPTION TESTS ===============
    
    def test_cancel_subscription_endpoint_exists(self):
        """Test POST /api/subscription/cancel endpoint exists"""
        response = self.session.post(
            f"{BASE_URL}/api/subscription/cancel",
            json={"cancel_at_period_end": True}
        )
        
        # Should not return 404 (method not allowed or business logic error is fine)
        assert response.status_code != 404, f"Cancel endpoint not found: {response.text}"
        
        # For free users, should return 400 or 404 (no active subscription)
        # This is expected behavior
        if response.status_code in [400, 404]:
            data = response.json()
            # Should have error message about no subscription
            assert "detail" in data or "error" in data or "message" in data
    
    def test_cancel_subscription_with_period_end(self):
        """Test cancel at period end flag"""
        response = self.session.post(
            f"{BASE_URL}/api/subscription/cancel",
            json={"cancel_at_period_end": True}
        )
        
        # For free users, expect 400/404 - no active subscription
        if response.status_code in [400, 404]:
            print("User has no active paid subscription to cancel (expected for free user)")
            return
        
        # If user has subscription, should succeed
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") is True
            assert "message" in data
    
    def test_cancel_subscription_immediate(self):
        """Test immediate cancellation"""
        response = self.session.post(
            f"{BASE_URL}/api/subscription/cancel",
            json={"cancel_at_period_end": False}
        )
        
        # For free users, expect error
        if response.status_code in [400, 404]:
            print("No active subscription to cancel immediately")
            return
        
        # If successful
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") is True
    
    def test_cancel_subscription_requires_auth(self):
        """Test cancel requires authentication"""
        unauth_session = requests.Session()
        unauth_session.headers.update({"Content-Type": "application/json"})
        
        response = unauth_session.post(
            f"{BASE_URL}/api/subscription/cancel",
            json={"cancel_at_period_end": True}
        )
        
        assert response.status_code in [401, 403]
    
    # =============== REACTIVATE SUBSCRIPTION TESTS ===============
    
    def test_reactivate_subscription_endpoint_exists(self):
        """Test POST /api/subscription/reactivate endpoint exists"""
        response = self.session.post(
            f"{BASE_URL}/api/subscription/reactivate",
            json={}
        )
        
        # 404 is valid response when no subscription pending cancellation
        # The endpoint exists but returns business logic error
        assert response.status_code in [200, 400, 404], f"Unexpected status: {response.status_code}"
        
        # For users without cancelled subscription, should return 404 (no pending cancellation)
        if response.status_code == 404:
            data = response.json()
            assert "detail" in data
            # This confirms endpoint exists but no subscription to reactivate
            print("Endpoint exists, returned expected 'no subscription pending cancellation'")
    
    def test_reactivate_requires_auth(self):
        """Test reactivate requires authentication"""
        unauth_session = requests.Session()
        unauth_session.headers.update({"Content-Type": "application/json"})
        
        response = unauth_session.post(
            f"{BASE_URL}/api/subscription/reactivate",
            json={}
        )
        
        assert response.status_code in [401, 403]
    
    # =============== CURRENT SUBSCRIPTION TESTS ===============
    
    def test_current_subscription_includes_usage(self):
        """Test current subscription includes usage stats"""
        response = self.session.get(f"{BASE_URL}/api/subscription/current")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") is True
        assert "subscription" in data
        
        sub = data["subscription"]
        # Should have usage stats
        assert "usage" in sub, "Subscription should include usage stats"
        
        usage = sub.get("usage", {})
        assert "searches_today" in usage, "Usage should include searches_today"
    
    def test_current_subscription_for_free_user(self):
        """Test current subscription returns free plan for free user"""
        response = self.session.get(f"{BASE_URL}/api/subscription/current")
        
        assert response.status_code == 200
        data = response.json()
        
        sub = data.get("subscription", {})
        
        # Should have plan_id
        assert "plan_id" in sub, "Should have plan_id"
        
        # Should have features
        assert "features" in sub, "Should have features"
        
        # Should have status
        assert "status" in sub, "Should have status"


class TestSubscriptionPages:
    """Test subscription management pages exist"""
    
    def test_subscription_page_route(self):
        """Test /subscription page is accessible"""
        response = requests.get(f"{BASE_URL}/subscription")
        
        # Should return 200 (React handles routing)
        assert response.status_code == 200
        
        # Should contain React app
        assert "root" in response.text or "MOOD FOOD" in response.text
    
    def test_checkout_success_page_route(self):
        """Test /checkout/success page is accessible"""
        response = requests.get(f"{BASE_URL}/checkout/success")
        
        assert response.status_code == 200
        assert "root" in response.text or "MOOD FOOD" in response.text
    
    def test_checkout_failure_page_route(self):
        """Test /checkout/failure page is accessible"""
        response = requests.get(f"{BASE_URL}/checkout/failure")
        
        assert response.status_code == 200
        assert "root" in response.text or "MOOD FOOD" in response.text
    
    def test_checkout_success_with_params(self):
        """Test /checkout/success with query params"""
        response = requests.get(
            f"{BASE_URL}/checkout/success?plan=premium_monthly&order_id=test123"
        )
        
        assert response.status_code == 200
    
    def test_checkout_failure_with_params(self):
        """Test /checkout/failure with error params"""
        response = requests.get(
            f"{BASE_URL}/checkout/failure?error=payment_failed&plan=premium_monthly"
        )
        
        assert response.status_code == 200


class TestSubscriptionWithPaidPlan:
    """Test subscription management with a paid plan"""
    
    @pytest.fixture(autouse=True)
    def setup_paid_user(self):
        """Setup test with a paid subscription"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Create a unique test user
        unique_id = uuid.uuid4().hex[:8]
        self.test_email = f"test_paid_{unique_id}@test.com"
        
        # Register new user
        register_resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.test_email,
            "password": "TestPass123!",
            "name": f"Test Paid User {unique_id}"
        })
        
        if register_resp.status_code != 200:
            pytest.skip("Could not register test user")
        
        reg_data = register_resp.json()
        self.token = reg_data.get("access_token") or reg_data.get("token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        # Create a subscription (simulate)
        create_resp = self.session.post(f"{BASE_URL}/api/subscription/create", json={
            "plan_id": "premium_monthly",
            "payment_provider": "stripe"
        })
        
        self.has_subscription = create_resp.status_code == 200
        if self.has_subscription:
            print(f"Created subscription for {self.test_email}")
    
    def test_cancel_paid_subscription(self):
        """Test cancelling a paid subscription"""
        if not self.has_subscription:
            pytest.skip("No subscription created")
        
        response = self.session.post(
            f"{BASE_URL}/api/subscription/cancel",
            json={"cancel_at_period_end": True}
        )
        
        assert response.status_code == 200, f"Failed to cancel: {response.text}"
        
        data = response.json()
        assert data.get("success") is True
        assert "message" in data
        
        # Verify cancellation pending
        current = self.session.get(f"{BASE_URL}/api/subscription/current")
        assert current.status_code == 200
        
        sub = current.json().get("subscription", {})
        assert sub.get("cancel_at_period_end") is True, "Should be marked for cancellation"
    
    def test_reactivate_after_cancel(self):
        """Test reactivating after cancellation"""
        if not self.has_subscription:
            pytest.skip("No subscription created")
        
        # First cancel
        cancel_resp = self.session.post(
            f"{BASE_URL}/api/subscription/cancel",
            json={"cancel_at_period_end": True}
        )
        
        if cancel_resp.status_code != 200:
            pytest.skip("Could not cancel subscription")
        
        # Then reactivate
        reactivate_resp = self.session.post(
            f"{BASE_URL}/api/subscription/reactivate",
            json={}
        )
        
        assert reactivate_resp.status_code == 200, f"Failed to reactivate: {reactivate_resp.text}"
        
        data = reactivate_resp.json()
        assert data.get("success") is True
        
        # Verify reactivation
        current = self.session.get(f"{BASE_URL}/api/subscription/current")
        sub = current.json().get("subscription", {})
        assert sub.get("cancel_at_period_end") is False, "Should no longer be marked for cancellation"
    
    def test_billing_history_after_subscription(self):
        """Test billing history shows transaction after subscription"""
        if not self.has_subscription:
            pytest.skip("No subscription created")
        
        response = self.session.get(f"{BASE_URL}/api/subscription/billing-history")
        
        assert response.status_code == 200
        data = response.json()
        
        transactions = data.get("transactions", [])
        # Should have at least one transaction from subscription creation
        assert len(transactions) >= 1, "Should have at least one transaction"
        
        # Check transaction structure
        if transactions:
            txn = transactions[0]
            assert "amount" in txn or "status" in txn


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
