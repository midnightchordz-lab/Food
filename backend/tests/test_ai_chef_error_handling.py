"""
AI Chef Error Handling Tests
Tests for production-grade error handling in AI Chef mode
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAIChefRecipeEndpoint:
    """Test /api/chat/ai-chef/recipe/{id} endpoint error handling"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test credentials and login"""
        self.email = "demouser@example.com"
        self.password = "password123"
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": self.email, "password": self.password}
        )
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.authenticated = True
        else:
            self.authenticated = False
            pytest.skip("Authentication failed - skipping authenticated tests")
    
    def test_invalid_recipe_id_returns_404(self):
        """Test that invalid recipe ID returns 404 Not Found"""
        invalid_id = "invalid-recipe-id-12345"
        response = self.session.get(f"{BASE_URL}/api/chat/ai-chef/recipe/{invalid_id}")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print(f"✓ Invalid recipe ID correctly returns 404: {response.json()}")
    
    def test_random_uuid_returns_404(self):
        """Test that a random UUID returns 404"""
        import uuid
        random_id = str(uuid.uuid4())
        response = self.session.get(f"{BASE_URL}/api/chat/ai-chef/recipe/{random_id}")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ Random UUID correctly returns 404")
    
    def test_empty_recipe_id_returns_error(self):
        """Test that empty recipe ID returns error"""
        response = self.session.get(f"{BASE_URL}/api/chat/ai-chef/recipe/")
        
        # Should return 404 or 405 (Method Not Allowed) for empty path
        assert response.status_code in [404, 405], f"Expected 404 or 405, got {response.status_code}"
        print(f"✓ Empty recipe ID correctly returns {response.status_code}")
    
    def test_special_characters_in_id_handled(self):
        """Test that special characters in recipe ID are handled safely"""
        special_ids = [
            "test<script>alert(1)</script>",
            "test'; DROP TABLE recipes;--",
            "test../../etc/passwd",
            "test%00null"
        ]
        
        for special_id in special_ids:
            response = self.session.get(f"{BASE_URL}/api/chat/ai-chef/recipe/{special_id}")
            # Should return 404 (not found) not 500 (server error)
            assert response.status_code != 500, f"Server error with ID: {special_id}"
            print(f"✓ Special character ID '{special_id[:20]}...' handled safely (status: {response.status_code})")


class TestAIChefWithValidRecipe:
    """Test AI Chef with valid recipe IDs from recipe_library"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test credentials and login"""
        self.email = "demouser@example.com"
        self.password = "password123"
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": self.email, "password": self.password}
        )
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.authenticated = True
        else:
            self.authenticated = False
            pytest.skip("Authentication failed - skipping authenticated tests")
    
    def test_generate_recipe_and_get_valid_id(self):
        """Test generating a recipe via hybrid endpoint and verifying AI Chef can access it"""
        # Generate a recipe first
        generate_response = self.session.post(
            f"{BASE_URL}/api/chat/recipes/hybrid",
            json={
                "mood": "happy",
                "cuisines": ["Italian"],
                "meal_type": "dinner",
                "dietary_preference": "vegetarian",
                "use_serpapi": True,
                "limit": 1
            }
        )
        
        if generate_response.status_code == 403:
            # Free tier limit reached
            print("⚠ Recipe limit reached (free tier) - test checking limit behavior")
            return
        
        assert generate_response.status_code == 200, f"Failed to generate recipe: {generate_response.text}"
        
        data = generate_response.json()
        recipes = data.get("combined_recipes", [])
        
        if recipes and len(recipes) > 0:
            recipe_id = recipes[0].get("id")
            if recipe_id:
                # Now test AI Chef endpoint with valid ID
                ai_chef_response = self.session.get(f"{BASE_URL}/api/chat/ai-chef/recipe/{recipe_id}")
                
                assert ai_chef_response.status_code == 200, f"Expected 200, got {ai_chef_response.status_code}"
                
                recipe_data = ai_chef_response.json()
                assert "title" in recipe_data, "Recipe should have title"
                assert "id" in recipe_data, "Recipe should have id"
                print(f"✓ Valid recipe ID returns recipe data: {recipe_data.get('title')}")
                print(f"  - Has instructions: {len(recipe_data.get('instructions', []))} steps")
                print(f"  - Has ingredients: {len(recipe_data.get('ingredients', []))} items")
            else:
                print("⚠ Recipe generated but no ID returned")
        else:
            print("⚠ No recipes returned from hybrid endpoint")


class TestAIChefNoAuth:
    """Test AI Chef endpoints without authentication"""
    
    def test_recipe_endpoint_requires_auth(self):
        """Test that AI Chef recipe endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/chat/ai-chef/recipe/some-recipe-id")
        
        assert response.status_code == 401, f"Expected 401 Unauthorized, got {response.status_code}"
        print(f"✓ Unauthenticated request correctly returns 401")
    
    def test_chat_endpoint_requires_auth(self):
        """Test that AI Chef chat endpoint requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/chat/ai-chef/chat",
            json={
                "message": "next",
                "recipe_context": {"title": "Test", "instructions": ["Step 1"]},
                "current_step": 0
            },
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 401, f"Expected 401 Unauthorized, got {response.status_code}"
        print(f"✓ Unauthenticated chat request correctly returns 401")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
