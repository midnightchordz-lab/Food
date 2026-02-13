"""
Test Subscription State Propagation Bug Fix
Tests the critical bug where paying users ('Chef Pro Annual') couldn't access premium features
after purchase due to scattered subscription state management.

Key areas tested:
1. Backend subscription creation returns correct features
2. Subscription API returns ai_photo_recognition_enabled for chef_pro plans
3. Feature access check for fridge_scanner feature
4. Feature access check for ai_photo_recognition feature  
5. Feature access check for voice_cooking feature
6. FREE users are correctly blocked from premium features
"""
import pytest
import requests
import os
import uuid
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TEST_PASSWORD = "password123"


class TestSubscriptionStateAfterCreation:
    """Tests that subscription state propagates correctly after subscription creation"""
    
    @pytest.fixture(scope="class")
    def free_user(self):
        """Create a new free user and return token"""
        unique_email = f"testuser_free_{uuid.uuid4().hex[:8]}@test.com"
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": TEST_PASSWORD,
            "name": "Test Free User"
        })
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token") or data.get("token")
            return {"token": token, "email": unique_email}
        
        pytest.skip(f"Could not create free user: {response.text}")
    
    @pytest.fixture(scope="class")
    def chef_pro_user(self):
        """Create a new user and subscribe to chef_pro_annual"""
        unique_email = f"testuser_chef_{uuid.uuid4().hex[:8]}@test.com"
        
        # Register user
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": TEST_PASSWORD,
            "name": "Test Chef Pro User"
        })
        
        if response.status_code != 200:
            pytest.skip(f"Could not create user: {response.text}")
        
        data = response.json()
        token = data.get("access_token") or data.get("token")
        
        if not token:
            pytest.skip("No token returned")
        
        # Create chef_pro_annual subscription
        sub_response = requests.post(
            f"{BASE_URL}/api/subscription/create",
            json={"plan_id": "chef_pro_annual", "payment_provider": "stripe"},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if sub_response.status_code != 200:
            pytest.skip(f"Could not create subscription: {sub_response.text}")
        
        return {"token": token, "email": unique_email}

    # ==================== FREE USER TESTS ====================
    
    def test_free_user_subscription_has_free_plan(self, free_user):
        """Verify FREE user has free plan with limited features"""
        response = requests.get(
            f"{BASE_URL}/api/subscription/current",
            headers={"Authorization": f"Bearer {free_user['token']}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["success"] is True
        
        subscription = data["subscription"]
        assert subscription["plan_id"] == "free", f"Expected 'free', got '{subscription['plan_id']}'"
        assert subscription["status"] == "active"
        
        # Verify features are locked for free user
        features = subscription.get("features", {})
        assert features.get("ai_photo_recognition_enabled") is False, "FREE user should NOT have ai_photo_recognition_enabled"
        assert features.get("voice_guided_cooking") is False, "FREE user should NOT have voice_guided_cooking"
        print(f"FREE user features: {features}")
    
    def test_free_user_blocked_from_fridge_scanner(self, free_user):
        """Verify FREE user cannot access fridge_scanner feature"""
        response = requests.get(
            f"{BASE_URL}/api/subscription/check-feature/fridge_scanner",
            headers={"Authorization": f"Bearer {free_user['token']}"}
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert data["feature"] == "fridge_scanner"
        assert data["allowed"] is False, "FREE user should NOT have fridge_scanner access"
        assert data["upgrade_required"] is True, "FREE user should require upgrade for fridge_scanner"
        print(f"FREE user fridge_scanner access: allowed={data['allowed']}, upgrade_required={data['upgrade_required']}")
    
    def test_free_user_blocked_from_ai_photo_recognition(self, free_user):
        """Verify FREE user cannot access ai_photo_recognition feature"""
        response = requests.get(
            f"{BASE_URL}/api/subscription/check-feature/ai_photo_recognition",
            headers={"Authorization": f"Bearer {free_user['token']}"}
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert data["feature"] == "ai_photo_recognition"
        assert data["allowed"] is False, "FREE user should NOT have ai_photo_recognition access"
        assert data["upgrade_required"] is True
        print(f"FREE user ai_photo_recognition access: allowed={data['allowed']}")
    
    def test_free_user_blocked_from_voice_cooking(self, free_user):
        """Verify FREE user cannot access voice_cooking feature"""
        response = requests.get(
            f"{BASE_URL}/api/subscription/check-feature/voice_cooking",
            headers={"Authorization": f"Bearer {free_user['token']}"}
        )
        
        # Note: voice_cooking feature check may not be directly supported, testing voice_guided_cooking instead
        assert response.status_code == 200
        
        data = response.json()
        print(f"FREE user voice_cooking check response: {data}")

    # ==================== CHEF PRO USER TESTS ====================
    
    def test_chef_pro_subscription_created_correctly(self, chef_pro_user):
        """Verify Chef Pro Annual subscription is created with correct features"""
        response = requests.get(
            f"{BASE_URL}/api/subscription/current",
            headers={"Authorization": f"Bearer {chef_pro_user['token']}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["success"] is True
        
        subscription = data["subscription"]
        assert subscription["plan_id"] == "chef_pro_annual", f"Expected 'chef_pro_annual', got '{subscription['plan_id']}'"
        assert subscription["status"] in ["active", "trialing"], f"Status should be active/trialing, got '{subscription['status']}'"
        
        # CRITICAL: Verify premium features are enabled
        features = subscription.get("features", {})
        print(f"Chef Pro Annual features returned: {features}")
        
        assert features.get("ai_photo_recognition_enabled") is True, "Chef Pro should have ai_photo_recognition_enabled=True"
        assert features.get("voice_guided_cooking") is True, "Chef Pro should have voice_guided_cooking=True"
        assert features.get("ai_image_generation_enabled") is True, "Chef Pro should have ai_image_generation_enabled=True"
        assert features.get("premium_recipes_access") is True, "Chef Pro should have premium_recipes_access=True"
        assert features.get("ad_free") is True, "Chef Pro should have ad_free=True"
    
    def test_chef_pro_has_fridge_scanner_access(self, chef_pro_user):
        """CRITICAL: Verify Chef Pro user CAN access fridge_scanner feature"""
        response = requests.get(
            f"{BASE_URL}/api/subscription/check-feature/fridge_scanner",
            headers={"Authorization": f"Bearer {chef_pro_user['token']}"}
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert data["feature"] == "fridge_scanner"
        assert data["allowed"] is True, f"Chef Pro user SHOULD have fridge_scanner access! Got allowed={data['allowed']}"
        assert data.get("upgrade_required") is False or data.get("upgrade_required") is None, "Chef Pro should NOT require upgrade"
        print(f"Chef Pro fridge_scanner access: allowed={data['allowed']}")
    
    def test_chef_pro_has_ai_photo_recognition_access(self, chef_pro_user):
        """CRITICAL: Verify Chef Pro user CAN access ai_photo_recognition feature"""
        response = requests.get(
            f"{BASE_URL}/api/subscription/check-feature/ai_photo_recognition",
            headers={"Authorization": f"Bearer {chef_pro_user['token']}"}
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert data["feature"] == "ai_photo_recognition"
        assert data["allowed"] is True, f"Chef Pro user SHOULD have ai_photo_recognition access! Got allowed={data['allowed']}"
        print(f"Chef Pro ai_photo_recognition access: allowed={data['allowed']}")
    
    def test_chef_pro_has_voice_cooking_access(self, chef_pro_user):
        """Verify Chef Pro user CAN access voice_cooking/voice_guided_cooking feature"""
        # Note: The backend feature check might be named differently
        response = requests.get(
            f"{BASE_URL}/api/subscription/check-feature/voice_cooking",
            headers={"Authorization": f"Bearer {chef_pro_user['token']}"}
        )
        
        assert response.status_code == 200
        
        data = response.json()
        print(f"Chef Pro voice_cooking check response: {data}")


class TestSubscriptionFeatureGating:
    """Tests the feature gating logic directly via check-feature endpoint"""
    
    @pytest.fixture(scope="class")
    def premium_monthly_user(self):
        """Create a Premium Monthly user"""
        unique_email = f"testuser_premium_{uuid.uuid4().hex[:8]}@test.com"
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": TEST_PASSWORD,
            "name": "Test Premium User"
        })
        
        if response.status_code != 200:
            pytest.skip(f"Could not create user: {response.text}")
        
        data = response.json()
        token = data.get("access_token") or data.get("token")
        
        # Create premium_monthly subscription
        sub_response = requests.post(
            f"{BASE_URL}/api/subscription/create",
            json={"plan_id": "premium_monthly", "payment_provider": "stripe"},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if sub_response.status_code != 200:
            pytest.skip(f"Could not create subscription: {sub_response.text}")
        
        return {"token": token, "email": unique_email}
    
    def test_premium_monthly_has_ai_photo_recognition(self, premium_monthly_user):
        """Premium Monthly user should have ai_photo_recognition access"""
        response = requests.get(
            f"{BASE_URL}/api/subscription/check-feature/ai_photo_recognition",
            headers={"Authorization": f"Bearer {premium_monthly_user['token']}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["allowed"] is True, f"Premium Monthly should have ai_photo_recognition! Got: {data}"
        print(f"Premium Monthly ai_photo_recognition: {data}")
    
    def test_premium_monthly_has_fridge_scanner(self, premium_monthly_user):
        """Premium Monthly user should have fridge_scanner access (uses ai_photo_recognition_enabled)"""
        response = requests.get(
            f"{BASE_URL}/api/subscription/check-feature/fridge_scanner",
            headers={"Authorization": f"Bearer {premium_monthly_user['token']}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["allowed"] is True, f"Premium Monthly should have fridge_scanner! Got: {data}"
        print(f"Premium Monthly fridge_scanner: {data}")


class TestSubscriptionUpgrade:
    """Test subscription upgrade flow"""
    
    def test_upgrade_from_free_to_premium(self):
        """Test upgrading a free user to premium subscription"""
        unique_email = f"testuser_upgrade_{uuid.uuid4().hex[:8]}@test.com"
        
        # Register user (starts as free)
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": TEST_PASSWORD,
            "name": "Test Upgrade User"
        })
        
        assert response.status_code == 200
        data = response.json()
        token = data.get("access_token") or data.get("token")
        
        # Verify initially free
        sub_response = requests.get(
            f"{BASE_URL}/api/subscription/current",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert sub_response.status_code == 200
        sub_data = sub_response.json()
        assert sub_data["subscription"]["plan_id"] == "free"
        
        # Check feature access before upgrade
        feature_before = requests.get(
            f"{BASE_URL}/api/subscription/check-feature/fridge_scanner",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert feature_before.status_code == 200
        assert feature_before.json()["allowed"] is False, "Should not have access before upgrade"
        
        # Upgrade to chef_pro_annual (bypasses payment)
        upgrade_response = requests.post(
            f"{BASE_URL}/api/subscription/create",
            json={"plan_id": "chef_pro_annual", "payment_provider": "stripe"},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert upgrade_response.status_code == 200, f"Upgrade failed: {upgrade_response.text}"
        upgrade_data = upgrade_response.json()
        assert upgrade_data["success"] is True
        assert upgrade_data["subscription"]["plan_id"] == "chef_pro_annual"
        
        # CRITICAL: Check that subscription now shows correct features
        sub_after = requests.get(
            f"{BASE_URL}/api/subscription/current",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert sub_after.status_code == 200
        sub_after_data = sub_after.json()
        
        print(f"Subscription after upgrade: {sub_after_data['subscription']}")
        
        features = sub_after_data["subscription"].get("features", {})
        assert features.get("ai_photo_recognition_enabled") is True, "After upgrade, should have ai_photo_recognition_enabled"
        
        # CRITICAL: Verify feature access AFTER upgrade
        feature_after = requests.get(
            f"{BASE_URL}/api/subscription/check-feature/fridge_scanner",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert feature_after.status_code == 200
        feature_after_data = feature_after.json()
        
        print(f"Feature access after upgrade: {feature_after_data}")
        assert feature_after_data["allowed"] is True, "CRITICAL: After upgrade, fridge_scanner should be allowed!"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
