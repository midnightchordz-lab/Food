"""
Test Subscription System - Pricing, plans, and subscription management
Tests all 6 subscription tiers: Free, Premium Monthly, Premium Annual, Chef Pro Monthly, Chef Pro Annual, Family Plan
"""
import pytest
import requests
import os
import uuid
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user credentials
TEST_EMAIL = f"test_sub_{uuid.uuid4().hex[:8]}@test.com"
TEST_PASSWORD = "TestPass123!"
TEST_NAME = "Test Subscriber"


class TestSubscriptionPlans:
    """Test GET /api/subscription/plans endpoint"""
    
    def test_get_all_subscription_plans(self):
        """Verify all 6 subscription plans are returned with correct pricing"""
        response = requests.get(f"{BASE_URL}/api/subscription/plans")
        
        # Status assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Data assertions
        data = response.json()
        assert data["success"] is True
        assert "plans" in data
        
        plans = data["plans"]
        assert len(plans) == 6, f"Expected 6 plans, got {len(plans)}"
        
        # Verify plan IDs
        plan_ids = [p["plan_id"] for p in plans]
        expected_ids = ["free", "premium_monthly", "premium_annual", "chef_pro_monthly", "chef_pro_annual", "family_annual"]
        for expected_id in expected_ids:
            assert expected_id in plan_ids, f"Missing plan: {expected_id}"
    
    def test_free_plan_details(self):
        """Verify Free plan has correct pricing ($0) and features"""
        response = requests.get(f"{BASE_URL}/api/subscription/plans")
        data = response.json()
        
        free_plan = next((p for p in data["plans"] if p["plan_id"] == "free"), None)
        assert free_plan is not None, "Free plan not found"
        
        # Verify Free plan pricing
        assert free_plan["pricing_usd"] == 0
        assert free_plan["billing_cycle"] == "free"
        assert free_plan["display_name"] == "Free Forever"
        
        # Verify Free plan features
        features = free_plan["features"]
        assert features["recipe_search_limit"] == 5
        assert features["premium_recipes_access"] is False
        assert features["ad_free"] is False
        assert features["ai_photo_recognition_enabled"] is False
    
    def test_premium_monthly_plan_details(self):
        """Verify Premium Monthly plan has correct pricing ($9.99)"""
        response = requests.get(f"{BASE_URL}/api/subscription/plans")
        data = response.json()
        
        premium = next((p for p in data["plans"] if p["plan_id"] == "premium_monthly"), None)
        assert premium is not None, "Premium Monthly plan not found"
        
        assert premium["pricing_usd"] == 9.99
        assert premium["billing_cycle"] == "monthly"
        assert premium["trial_period_days"] == 7
        
        features = premium["features"]
        assert features["recipe_search_limit"] == -1  # Unlimited
        assert features["premium_recipes_access"] is True
        assert features["ad_free"] is True
    
    def test_premium_annual_plan_details(self):
        """Verify Premium Annual plan has correct pricing ($79.99)"""
        response = requests.get(f"{BASE_URL}/api/subscription/plans")
        data = response.json()
        
        premium_annual = next((p for p in data["plans"] if p["plan_id"] == "premium_annual"), None)
        assert premium_annual is not None, "Premium Annual plan not found"
        
        assert premium_annual["pricing_usd"] == 79.99
        assert premium_annual["billing_cycle"] == "annual"
        assert premium_annual["badge"] == "popular"
        assert premium_annual["savings_percent"] == 33
    
    def test_chef_pro_monthly_plan_details(self):
        """Verify Chef Pro Monthly plan has correct pricing ($19.99)"""
        response = requests.get(f"{BASE_URL}/api/subscription/plans")
        data = response.json()
        
        chef_pro = next((p for p in data["plans"] if p["plan_id"] == "chef_pro_monthly"), None)
        assert chef_pro is not None, "Chef Pro Monthly plan not found"
        
        assert chef_pro["pricing_usd"] == 19.99
        assert chef_pro["billing_cycle"] == "monthly"
        
        features = chef_pro["features"]
        assert features["ai_image_generation_enabled"] is True
        assert features["diabetes_module"] is True
        assert features["video_import"] is True
    
    def test_chef_pro_annual_plan_details(self):
        """Verify Chef Pro Annual plan has correct pricing ($179.99)"""
        response = requests.get(f"{BASE_URL}/api/subscription/plans")
        data = response.json()
        
        chef_pro_annual = next((p for p in data["plans"] if p["plan_id"] == "chef_pro_annual"), None)
        assert chef_pro_annual is not None, "Chef Pro Annual plan not found"
        
        assert chef_pro_annual["pricing_usd"] == 179.99
        assert chef_pro_annual["billing_cycle"] == "annual"
        assert chef_pro_annual["badge"] == "best_value"
        assert chef_pro_annual["savings_percent"] == 25
    
    def test_family_plan_details(self):
        """Verify Family Plan has correct pricing ($139.99)"""
        response = requests.get(f"{BASE_URL}/api/subscription/plans")
        data = response.json()
        
        family_plan = next((p for p in data["plans"] if p["plan_id"] == "family_annual"), None)
        assert family_plan is not None, "Family Plan not found"
        
        assert family_plan["pricing_usd"] == 139.99
        assert family_plan["billing_cycle"] == "annual"
        
        features = family_plan["features"]
        assert features["family_members"] == 5


class TestSubscriptionAuth:
    """Test subscription endpoints requiring authentication"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Create test user and get auth token"""
        # Register new user
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "name": TEST_NAME
        })
        
        if register_response.status_code == 200:
            data = register_response.json()
            if "token" in data:
                return data["token"]
        
        # If registration fails (user exists), try login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            if "token" in data:
                return data["token"]
        
        pytest.skip("Could not authenticate test user")
    
    def test_get_current_subscription_free_by_default(self, auth_token):
        """GET /api/subscription/current - Returns free plan by default"""
        response = requests.get(
            f"{BASE_URL}/api/subscription/current",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert "subscription" in data
        
        subscription = data["subscription"]
        assert subscription["plan_id"] == "free"
        assert subscription["status"] == "active"
        assert "usage" in subscription
    
    def test_get_current_subscription_unauthorized(self):
        """GET /api/subscription/current - Returns 401 without token"""
        response = requests.get(f"{BASE_URL}/api/subscription/current")
        
        # Should return 401 or 403 for unauthorized access
        assert response.status_code in [401, 403, 422]
    
    def test_check_feature_recipe_search(self, auth_token):
        """GET /api/subscription/check-feature/recipe_search - Check feature access"""
        response = requests.get(
            f"{BASE_URL}/api/subscription/check-feature/recipe_search",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert data["feature"] == "recipe_search"
        assert "allowed" in data
        assert "limit" in data
        
        # Free users have 5 searches/day limit
        assert data["limit"] == 5
    
    def test_check_feature_premium_recipes(self, auth_token):
        """GET /api/subscription/check-feature/premium_recipes - Should be restricted for free user"""
        response = requests.get(
            f"{BASE_URL}/api/subscription/check-feature/premium_recipes",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert data["feature"] == "premium_recipes"
        assert data["allowed"] is False
        assert data["upgrade_required"] is True
    
    def test_check_feature_diabetes_module(self, auth_token):
        """GET /api/subscription/check-feature/diabetes_module - Should be restricted for free user"""
        response = requests.get(
            f"{BASE_URL}/api/subscription/check-feature/diabetes_module",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert data["feature"] == "diabetes_module"
        assert data["allowed"] is False
        assert data["upgrade_required"] is True


class TestSubscriptionCreation:
    """Test subscription create/cancel endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token_for_subscription(self):
        """Create unique test user for subscription tests"""
        unique_email = f"test_sub_create_{uuid.uuid4().hex[:8]}@test.com"
        
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": TEST_PASSWORD,
            "name": "Test Sub Creator"
        })
        
        if register_response.status_code == 200:
            data = register_response.json()
            if "token" in data:
                return data["token"]
        
        pytest.skip("Could not create test user for subscription")
    
    def test_create_subscription_premium_monthly(self, auth_token_for_subscription):
        """POST /api/subscription/create - Create Premium Monthly subscription"""
        response = requests.post(
            f"{BASE_URL}/api/subscription/create",
            json={
                "plan_id": "premium_monthly",
                "payment_provider": "stripe"
            },
            headers={"Authorization": f"Bearer {auth_token_for_subscription}"}
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert "subscription" in data
        assert data["subscription"]["plan_id"] == "premium_monthly"
        assert data["subscription"]["status"] in ["active", "trialing"]
    
    def test_create_subscription_free_plan_rejected(self, auth_token_for_subscription):
        """POST /api/subscription/create - Cannot subscribe to free plan"""
        response = requests.post(
            f"{BASE_URL}/api/subscription/create",
            json={
                "plan_id": "free",
                "payment_provider": "stripe"
            },
            headers={"Authorization": f"Bearer {auth_token_for_subscription}"}
        )
        
        assert response.status_code == 400
        
        data = response.json()
        assert "detail" in data
        assert "free" in data["detail"].lower()
    
    def test_create_subscription_invalid_plan(self, auth_token_for_subscription):
        """POST /api/subscription/create - Invalid plan returns error"""
        response = requests.post(
            f"{BASE_URL}/api/subscription/create",
            json={
                "plan_id": "invalid_plan",
                "payment_provider": "stripe"
            },
            headers={"Authorization": f"Bearer {auth_token_for_subscription}"}
        )
        
        assert response.status_code == 400


class TestSubscriptionCancellation:
    """Test subscription cancellation"""
    
    @pytest.fixture(scope="class")
    def user_with_subscription(self):
        """Create user with active subscription"""
        unique_email = f"test_cancel_{uuid.uuid4().hex[:8]}@test.com"
        
        # Register user
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": TEST_PASSWORD,
            "name": "Test Canceller"
        })
        
        if register_response.status_code != 200:
            pytest.skip("Could not create test user")
        
        data = register_response.json()
        token = data.get("token")
        
        if not token:
            pytest.skip("No token returned")
        
        # Create subscription
        create_response = requests.post(
            f"{BASE_URL}/api/subscription/create",
            json={"plan_id": "chef_pro_monthly", "payment_provider": "stripe"},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if create_response.status_code != 200:
            pytest.skip("Could not create subscription")
        
        return token
    
    def test_cancel_subscription(self, user_with_subscription):
        """POST /api/subscription/cancel - Cancel subscription"""
        response = requests.post(
            f"{BASE_URL}/api/subscription/cancel",
            json={"cancel_immediately": True},
            headers={"Authorization": f"Bearer {user_with_subscription}"}
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert "message" in data
    
    def test_cancel_subscription_no_active_subscription(self):
        """POST /api/subscription/cancel - Error when no active subscription"""
        unique_email = f"test_no_sub_{uuid.uuid4().hex[:8]}@test.com"
        
        # Register user without subscription
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": TEST_PASSWORD,
            "name": "Test No Sub"
        })
        
        if register_response.status_code != 200:
            pytest.skip("Could not create test user")
        
        token = register_response.json().get("token")
        
        response = requests.post(
            f"{BASE_URL}/api/subscription/cancel",
            json={"cancel_immediately": True},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 400


class TestTransactions:
    """Test transaction history endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for transaction tests"""
        unique_email = f"test_txn_{uuid.uuid4().hex[:8]}@test.com"
        
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": TEST_PASSWORD,
            "name": "Test Txn User"
        })
        
        if register_response.status_code == 200:
            return register_response.json().get("token")
        
        pytest.skip("Could not authenticate")
    
    def test_get_transactions_empty(self, auth_token):
        """GET /api/subscription/transactions - Returns empty list for new user"""
        response = requests.get(
            f"{BASE_URL}/api/subscription/transactions",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert "transactions" in data
        assert isinstance(data["transactions"], list)


class TestSubscriptionStats:
    """Test subscription stats endpoint"""
    
    def test_get_subscription_stats(self):
        """GET /api/subscription/stats - Returns subscription statistics"""
        response = requests.get(f"{BASE_URL}/api/subscription/stats")
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert "stats" in data
        
        stats = data["stats"]
        assert "total_subscribers" in stats
        assert "mrr" in stats
        assert "arr" in stats


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
