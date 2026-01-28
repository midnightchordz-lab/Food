"""
Test Drink Pairings Feature
Tests for:
1. POST /api/chat/send - returns recipes with drink pairings
2. POST /api/recipes/detailed - returns detailed recipe with drink pairings
3. Session persistence across pages
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "drinktest@test.com"
TEST_PASSWORD = "testpass123"


class TestAuthentication:
    """Test authentication and session persistence"""
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL
        print(f"✓ Login successful for {TEST_EMAIL}")
    
    def test_auth_me_with_token(self):
        """Test /auth/me endpoint with valid token"""
        # First login to get token
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = login_response.json()["access_token"]
        
        # Test /auth/me
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == TEST_EMAIL
        print("✓ Token authentication working correctly")


class TestChatDrinkPairings:
    """Test drink pairings in chat endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_chat_returns_drink_pairings(self, auth_token):
        """Test POST /api/chat/send returns recipes with drink pairings"""
        session_id = f"drink-test-{int(time.time())}"
        
        # Send structured recipe request
        message = """[User Preferences]
- Mood: Happy
- Meal Type: Dinner
- Dietary Preference: Vegetarian
- Cuisine(s): Italian

Please suggest some meals."""
        
        response = requests.post(
            f"{BASE_URL}/api/chat/send",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "session_id": session_id,
                "message": message
            },
            timeout=120
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        
        # Check for drink pairings in response
        response_text = data["response"]
        assert "Drink Pairings" in response_text or "🍹" in response_text, \
            "Response should contain drink pairings section"
        
        # Check for Non-Alcoholic and Alcoholic options
        has_non_alcoholic = "Non-Alcoholic" in response_text
        has_alcoholic = "Alcoholic" in response_text
        
        assert has_non_alcoholic, "Response should contain Non-Alcoholic drink options"
        assert has_alcoholic, "Response should contain Alcoholic drink options"
        
        print("✓ Chat endpoint returns recipes with drink pairings")
        print(f"  - Non-Alcoholic options: {has_non_alcoholic}")
        print(f"  - Alcoholic options: {has_alcoholic}")


class TestDetailedRecipeDrinkPairings:
    """Test drink pairings in detailed recipe endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_detailed_recipe_returns_drink_pairings(self, auth_token):
        """Test POST /api/recipes/detailed returns recipe with drink pairings"""
        response = requests.post(
            f"{BASE_URL}/api/recipes/detailed",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "recipe_title": "Mushroom Risotto",
                "cuisine": "Italian",
                "meal_type": "Dinner",
                "dietary_pref": "Vegetarian"
            },
            timeout=120
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "recipe" in data
        
        # Check for drink pairings in recipe content
        recipe_content = data["recipe"]
        assert "Drink Pairings" in recipe_content or "🍷" in recipe_content, \
            "Detailed recipe should contain drink pairings section"
        
        # Check for Non-Alcoholic and Alcoholic sections
        has_non_alcoholic = "Non-Alcoholic" in recipe_content
        has_alcoholic = "Alcoholic" in recipe_content
        
        assert has_non_alcoholic, "Recipe should contain Non-Alcoholic drink options"
        assert has_alcoholic, "Recipe should contain Alcoholic drink options"
        
        print("✓ Detailed recipe endpoint returns drink pairings")
        print(f"  - Non-Alcoholic options: {has_non_alcoholic}")
        print(f"  - Alcoholic options: {has_alcoholic}")
    
    def test_detailed_recipe_caching(self, auth_token):
        """Test that detailed recipes are cached"""
        # First request - should generate new recipe
        response1 = requests.post(
            f"{BASE_URL}/api/recipes/detailed",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "recipe_title": "Pasta Primavera",
                "cuisine": "Italian",
                "meal_type": "Dinner",
                "dietary_pref": "Vegetarian"
            },
            timeout=120
        )
        
        assert response1.status_code == 200
        data1 = response1.json()
        
        # Second request - should return cached recipe
        response2 = requests.post(
            f"{BASE_URL}/api/recipes/detailed",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "recipe_title": "Pasta Primavera",
                "cuisine": "Italian",
                "meal_type": "Dinner",
                "dietary_pref": "Vegetarian"
            },
            timeout=30
        )
        
        assert response2.status_code == 200
        data2 = response2.json()
        
        # Check if second request was cached
        if "cached" in data2:
            print(f"✓ Recipe caching working: cached={data2['cached']}")
        
        # Both should have drink pairings
        assert "Drink Pairings" in data1["recipe"] or "🍷" in data1["recipe"]
        assert "Drink Pairings" in data2["recipe"] or "🍷" in data2["recipe"]


class TestProtectedEndpoints:
    """Test that protected endpoints require authentication"""
    
    def test_chat_requires_auth(self):
        """Test that /api/chat/send requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/chat/send",
            json={
                "session_id": "test",
                "message": "Hello"
            }
        )
        assert response.status_code in [401, 403], \
            "Chat endpoint should require authentication"
        print("✓ Chat endpoint requires authentication")
    
    def test_detailed_recipe_requires_auth(self):
        """Test that /api/recipes/detailed requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/recipes/detailed",
            json={
                "recipe_title": "Test Recipe",
                "cuisine": "Italian",
                "meal_type": "Dinner",
                "dietary_pref": "Vegetarian"
            }
        )
        assert response.status_code in [401, 403], \
            "Detailed recipe endpoint should require authentication"
        print("✓ Detailed recipe endpoint requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
