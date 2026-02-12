"""
Test Feature Gating System - Tests subscription-based feature access control
Tests for:
- Diabetes Module gating (Chef Pro only)
- Recipe Import gating (Premium only)
- Voice features gating (Premium only)
- Recipe search limit tracking
- Subscription info endpoints
- Razorpay webhook handling
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

# Get backend URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://delivery-options-ui.preview.emergentagent.com"

class TestSetup:
    """Setup utilities for tests"""
    
    @staticmethod
    def register_user(email: str = None, password: str = "TestPass123!"):
        """Register a new user and return auth token"""
        if not email:
            email = f"test_gating_{uuid.uuid4().hex[:8]}@test.com"
        
        # Try to register
        register_resp = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": password,
            "name": "Test User"
        })
        
        if register_resp.status_code == 200:
            return register_resp.json().get("access_token")
        
        # If user exists, login instead
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        
        if login_resp.status_code == 200:
            return login_resp.json().get("access_token")
        
        return None

    @staticmethod
    def get_auth_headers(token: str):
        """Return headers with auth token"""
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }


class TestDiabetesModuleGating:
    """Test feature gating for Diabetes Module - requires Chef Pro"""
    
    def setup_method(self):
        """Setup for each test"""
        self.token = TestSetup.register_user()
        self.headers = TestSetup.get_auth_headers(self.token)
    
    def test_diabetes_research_blocked_for_free_user(self):
        """Free users should get 403 when accessing /api/diabetes/research"""
        response = requests.post(
            f"{BASE_URL}/api/diabetes/research",
            headers=self.headers,
            json={"diabetes_type": "type2", "session_id": str(uuid.uuid4())}
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        data = response.json()
        assert data.get("detail", {}).get("error") == "feature_locked", f"Expected feature_locked error, got: {data}"
        assert "diabetes_module" in str(data), "Response should mention diabetes_module"
        assert "chef_pro" in str(data).lower(), "Response should suggest Chef Pro upgrade"
        print(f"✅ Diabetes /research correctly blocked for free user: {data.get('detail', {}).get('message')}")
    
    def test_diabetes_recipes_blocked_for_free_user(self):
        """Free users should get 403 when accessing /api/diabetes/recipes"""
        response = requests.post(
            f"{BASE_URL}/api/diabetes/recipes",
            headers=self.headers,
            json={
                "session_id": str(uuid.uuid4()),
                "mood": "happy",
                "diabetes_type": "type2",
                "diabetes_label": "Type 2 Diabetes",
                "dietary_pref": "vegetarian",
                "meal_type": "dinner",
                "cuisines": "Italian"
            }
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        data = response.json()
        assert data.get("detail", {}).get("error") == "feature_locked"
        print(f"✅ Diabetes /recipes correctly blocked for free user")
    
    def test_diabetes_chat_blocked_for_free_user(self):
        """Free users should get 403 when accessing /api/diabetes/chat"""
        response = requests.post(
            f"{BASE_URL}/api/diabetes/chat",
            headers=self.headers,
            json={
                "session_id": str(uuid.uuid4()),
                "message": "What foods should I eat?",
                "context": {"diabetesType": "type2"}
            }
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        data = response.json()
        assert data.get("detail", {}).get("error") == "feature_locked"
        print(f"✅ Diabetes /chat correctly blocked for free user")
    
    def test_diabetes_weekly_plan_generate_blocked_for_free_user(self):
        """Free users should get 403 when accessing /api/diabetes/weekly-plan/generate"""
        response = requests.post(
            f"{BASE_URL}/api/diabetes/weekly-plan/generate",
            headers=self.headers,
            json={
                "diabetes_type": "type2",
                "dietary_preference": "vegetarian"
            }
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        data = response.json()
        assert data.get("detail", {}).get("error") == "feature_locked"
        print(f"✅ Diabetes /weekly-plan/generate correctly blocked for free user")


class TestRecipeImportGating:
    """Test feature gating for Recipe Import - requires Premium"""
    
    def setup_method(self):
        """Setup for each test"""
        self.token = TestSetup.register_user()
        self.headers = TestSetup.get_auth_headers(self.token)
    
    def test_import_url_blocked_for_free_user(self):
        """Free users should get 403 when accessing /api/import/url"""
        response = requests.post(
            f"{BASE_URL}/api/import/url",
            headers=self.headers,
            json={"url": "https://www.example.com/recipe"}
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        data = response.json()
        assert data.get("detail", {}).get("error") == "feature_locked"
        assert "recipe_import" in str(data), "Response should mention recipe_import"
        assert "premium" in str(data).lower(), "Response should suggest Premium upgrade"
        print(f"✅ Import /url correctly blocked for free user: {data.get('detail', {}).get('message')}")
    
    def test_import_image_blocked_for_free_user(self):
        """Free users should get 403 when accessing /api/import/image"""
        # Create a small test image (1x1 pixel PNG base64)
        test_image_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        
        response = requests.post(
            f"{BASE_URL}/api/import/image",
            headers=self.headers,
            json={
                "image_data": test_image_base64,
                "filename": "test_recipe.png"
            }
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        data = response.json()
        assert data.get("detail", {}).get("error") == "feature_locked"
        assert "ai_photo_recognition" in str(data), "Response should mention ai_photo_recognition"
        print(f"✅ Import /image correctly blocked for free user")
    
    def test_import_video_blocked_for_free_user(self):
        """Free users should get 403 when accessing /api/import/video"""
        response = requests.post(
            f"{BASE_URL}/api/import/video",
            headers=self.headers,
            json={"video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        data = response.json()
        assert data.get("detail", {}).get("error") == "feature_locked"
        assert "video_import" in str(data), "Response should mention video_import"
        assert "chef_pro" in str(data).lower(), "Response should suggest Chef Pro upgrade"
        print(f"✅ Import /video correctly blocked for free user")
    
    def test_import_text_blocked_for_free_user(self):
        """Free users should get 403 when accessing /api/import/text"""
        response = requests.post(
            f"{BASE_URL}/api/import/text",
            headers=self.headers,
            json={
                "recipe_text": "Ingredients: 2 cups flour, 1 cup sugar. Instructions: Mix together and bake at 350F for 30 minutes."
            }
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        data = response.json()
        assert data.get("detail", {}).get("error") == "feature_locked"
        print(f"✅ Import /text correctly blocked for free user")


class TestVoiceFeaturesGating:
    """Test feature gating for Voice features - requires Premium"""
    
    def setup_method(self):
        """Setup for each test"""
        self.token = TestSetup.register_user()
        self.headers = TestSetup.get_auth_headers(self.token)
    
    def test_voice_transcribe_blocked_for_free_user(self):
        """Free users should get 403 when accessing /api/voice/transcribe"""
        # Create minimal audio file for testing
        # Note: This is a minimal valid WAV header - just for testing the gating, not actual transcription
        files = {
            'audio': ('test.wav', b'\x00' * 100, 'audio/wav')
        }
        headers = {"Authorization": f"Bearer {self.token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/voice/transcribe",
            headers=headers,
            files=files
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        data = response.json()
        assert data.get("detail", {}).get("error") == "feature_locked"
        assert "voice_cooking" in str(data), "Response should mention voice_cooking"
        assert "premium" in str(data).lower(), "Response should suggest Premium upgrade"
        print(f"✅ Voice /transcribe correctly blocked for free user")
    
    def test_voice_synthesize_blocked_for_free_user(self):
        """Free users should get 403 when accessing /api/voice/synthesize"""
        response = requests.post(
            f"{BASE_URL}/api/voice/synthesize",
            headers=self.headers,
            json={
                "text": "Add salt to taste",
                "mood": "happy",
                "language": "en"
            }
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        data = response.json()
        assert data.get("detail", {}).get("error") == "feature_locked"
        print(f"✅ Voice /synthesize correctly blocked for free user")


class TestSubscriptionEndpoints:
    """Test subscription info and feature check endpoints"""
    
    def setup_method(self):
        """Setup for each test"""
        self.token = TestSetup.register_user()
        self.headers = TestSetup.get_auth_headers(self.token)
    
    def test_subscription_current_returns_free_plan(self):
        """New users should be on free plan by default"""
        response = requests.get(
            f"{BASE_URL}/api/subscription/current",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("success") == True
        assert "subscription" in data
        subscription = data["subscription"]
        assert subscription.get("plan_id") == "free", f"Expected free plan, got: {subscription.get('plan_id')}"
        assert "features" in subscription
        print(f"✅ /subscription/current correctly returns free plan for new user")
    
    def test_check_feature_recipe_search_limit(self):
        """Check recipe search limit for free user"""
        response = requests.get(
            f"{BASE_URL}/api/subscription/check-feature/recipe_search",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("success") == True
        assert data.get("feature") == "recipe_search"
        # Free users have 5 searches/day limit
        assert data.get("limit") == 5, f"Expected limit 5, got: {data.get('limit')}"
        assert "remaining" in data
        assert "used" in data
        print(f"✅ /check-feature/recipe_search returns correct limit info: limit={data.get('limit')}, remaining={data.get('remaining')}")
    
    def test_check_feature_diabetes_module_blocked(self):
        """Diabetes module should be blocked for free users"""
        response = requests.get(
            f"{BASE_URL}/api/subscription/check-feature/diabetes_module",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("success") == True
        assert data.get("allowed") == False, "Free users should not have diabetes_module access"
        assert data.get("upgrade_required") == True
        print(f"✅ /check-feature/diabetes_module correctly shows blocked for free user")
    
    def test_check_feature_premium_recipes_blocked(self):
        """Premium recipes should be blocked for free users"""
        response = requests.get(
            f"{BASE_URL}/api/subscription/check-feature/premium_recipes",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("success") == True
        assert data.get("allowed") == False
        print(f"✅ /check-feature/premium_recipes correctly shows blocked for free user")
    
    def test_check_feature_recipe_import_blocked(self):
        """Recipe import should be blocked for free users"""
        response = requests.get(
            f"{BASE_URL}/api/subscription/check-feature/recipe_import",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("success") == True
        assert data.get("allowed") == False
        assert data.get("upgrade_required") == True
        print(f"✅ /check-feature/recipe_import correctly shows blocked for free user")


class TestRazorpayWebhook:
    """Test Razorpay webhook endpoint"""
    
    def test_razorpay_webhook_accepts_post(self):
        """Razorpay webhook should accept POST requests"""
        # Note: Without valid signature, this should return 400 or 500, not 404 or 405
        response = requests.post(
            f"{BASE_URL}/api/subscription/razorpay/webhook",
            headers={"Content-Type": "application/json"},
            json={"event": "payment.captured", "payload": {}}
        )
        
        # Webhook exists and processes requests (will fail signature validation)
        # Should NOT be 404 (not found) or 405 (method not allowed)
        assert response.status_code != 404, "Webhook endpoint should exist"
        assert response.status_code != 405, "Webhook should accept POST"
        print(f"✅ Razorpay webhook endpoint exists and accepts POST (status: {response.status_code})")
    
    def test_razorpay_config_endpoint(self):
        """Razorpay config endpoint should return public key info"""
        response = requests.get(f"{BASE_URL}/api/subscription/razorpay/config")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("success") == True
        assert "key_id" in data
        assert "configured" in data
        print(f"✅ Razorpay config endpoint works: configured={data.get('configured')}")


class TestSubscriptionPlans:
    """Test subscription plans endpoint"""
    
    def test_get_subscription_plans(self):
        """Should return all available subscription plans"""
        response = requests.get(f"{BASE_URL}/api/subscription/plans")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("success") == True
        assert "plans" in data
        
        plans = data["plans"]
        assert len(plans) >= 4, f"Expected at least 4 plans, got {len(plans)}"
        
        # Verify expected plans exist
        plan_ids = [p["plan_id"] for p in plans]
        assert "free" in plan_ids, "Free plan should exist"
        assert "premium_monthly" in plan_ids, "Premium monthly should exist"
        assert "chef_pro_monthly" in plan_ids, "Chef Pro monthly should exist"
        
        # Verify free plan has correct features
        free_plan = next((p for p in plans if p["plan_id"] == "free"), None)
        assert free_plan is not None
        assert free_plan["features"]["recipe_search_limit"] == 5
        assert free_plan["features"]["diabetes_module"] == False
        assert free_plan["features"]["recipe_import"] == False
        assert free_plan["features"]["voice_guided_cooking"] == False
        
        print(f"✅ /subscription/plans returns {len(plans)} plans with correct features")


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
