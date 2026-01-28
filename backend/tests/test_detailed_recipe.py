"""
Test suite for /api/recipes/detailed endpoint
Tests comprehensive recipe generation with professional-grade instructions
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user credentials
TEST_EMAIL = f"testdetailed{int(time.time())}@test.com"
TEST_PASSWORD = "Test1234!"
TEST_NAME = "Test Detailed User"


class TestDetailedRecipeEndpoint:
    """Tests for /api/recipes/detailed endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Register and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "name": TEST_NAME
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        # If user exists, try login
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Could not authenticate")
    
    def test_detailed_recipe_endpoint_returns_200(self, auth_token):
        """Test that endpoint returns 200 status"""
        response = requests.post(
            f"{BASE_URL}/api/recipes/detailed",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "recipe_title": "Spaghetti Carbonara",
                "cuisine": "Italian",
                "meal_type": "Dinner",
                "dietary_pref": "Any"
            },
            timeout=60
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    def test_response_contains_recipe_field(self, auth_token):
        """Test response has recipe field"""
        response = requests.post(
            f"{BASE_URL}/api/recipes/detailed",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "recipe_title": "Spaghetti Carbonara",
                "cuisine": "Italian",
                "meal_type": "Dinner",
                "dietary_pref": "Any"
            },
            timeout=60
        )
        data = response.json()
        assert "recipe" in data, "Response should contain 'recipe' field"
        assert isinstance(data["recipe"], str), "Recipe should be a string"
        assert len(data["recipe"]) > 500, "Recipe content should be substantial"
    
    def test_response_contains_cached_field(self, auth_token):
        """Test response has cached field"""
        response = requests.post(
            f"{BASE_URL}/api/recipes/detailed",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "recipe_title": "Spaghetti Carbonara",
                "cuisine": "Italian",
                "meal_type": "Dinner",
                "dietary_pref": "Any"
            },
            timeout=60
        )
        data = response.json()
        assert "cached" in data, "Response should contain 'cached' field"
        assert isinstance(data["cached"], bool), "Cached should be boolean"
    
    def test_recipe_contains_recipe_information_section(self, auth_token):
        """Test recipe has Recipe Information section"""
        response = requests.post(
            f"{BASE_URL}/api/recipes/detailed",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "recipe_title": "Pad Thai",
                "cuisine": "Thai",
                "meal_type": "Dinner",
                "dietary_pref": "Any"
            },
            timeout=60
        )
        recipe = response.json()["recipe"]
        assert "## Recipe Information" in recipe, "Recipe should have Recipe Information section"
        assert "**Cuisine:**" in recipe, "Should have Cuisine field"
        assert "**Meal Type:**" in recipe, "Should have Meal Type field"
        assert "**Difficulty:**" in recipe, "Should have Difficulty field"
        assert "**Servings:**" in recipe, "Should have Servings field"
        assert "**Prep Time:**" in recipe, "Should have Prep Time field"
        assert "**Cook Time:**" in recipe, "Should have Cook Time field"
        assert "**Total Time:**" in recipe, "Should have Total Time field"
    
    def test_recipe_contains_description_section(self, auth_token):
        """Test recipe has Description section"""
        response = requests.post(
            f"{BASE_URL}/api/recipes/detailed",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "recipe_title": "Pad Thai",
                "cuisine": "Thai",
                "meal_type": "Dinner",
                "dietary_pref": "Any"
            },
            timeout=60
        )
        recipe = response.json()["recipe"]
        assert "## Description" in recipe, "Recipe should have Description section"
    
    def test_recipe_contains_ingredients_section(self, auth_token):
        """Test recipe has Ingredients section with categories"""
        response = requests.post(
            f"{BASE_URL}/api/recipes/detailed",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "recipe_title": "Pad Thai",
                "cuisine": "Thai",
                "meal_type": "Dinner",
                "dietary_pref": "Any"
            },
            timeout=60
        )
        recipe = response.json()["recipe"]
        assert "Ingredients" in recipe, "Recipe should have Ingredients section"
        # Check for ingredient categories
        assert "**For the" in recipe or "**Main" in recipe, "Should have ingredient categories"
    
    def test_recipe_contains_equipment_section(self, auth_token):
        """Test recipe has Equipment section"""
        response = requests.post(
            f"{BASE_URL}/api/recipes/detailed",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "recipe_title": "Pad Thai",
                "cuisine": "Thai",
                "meal_type": "Dinner",
                "dietary_pref": "Any"
            },
            timeout=60
        )
        recipe = response.json()["recipe"]
        assert "Equipment" in recipe, "Recipe should have Equipment section"
    
    def test_recipe_contains_instructions_with_timing(self, auth_token):
        """Test recipe has Step-by-Step Instructions with timing markers"""
        response = requests.post(
            f"{BASE_URL}/api/recipes/detailed",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "recipe_title": "Pad Thai",
                "cuisine": "Thai",
                "meal_type": "Dinner",
                "dietary_pref": "Any"
            },
            timeout=60
        )
        recipe = response.json()["recipe"]
        assert "Instructions" in recipe, "Recipe should have Instructions section"
        # Check for step format with timing
        assert "**Step 1**" in recipe, "Should have Step 1"
        assert "minutes" in recipe.lower() or "min" in recipe.lower(), "Steps should have timing"
    
    def test_recipe_contains_visual_cues(self, auth_token):
        """Test recipe instructions have Visual Cues"""
        response = requests.post(
            f"{BASE_URL}/api/recipes/detailed",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "recipe_title": "Pad Thai",
                "cuisine": "Thai",
                "meal_type": "Dinner",
                "dietary_pref": "Any"
            },
            timeout=60
        )
        recipe = response.json()["recipe"]
        assert "*Visual Cue:*" in recipe or "Visual Cue:" in recipe, "Instructions should have Visual Cues"
    
    def test_recipe_contains_chefs_tips(self, auth_token):
        """Test recipe has Chef's Tips section"""
        response = requests.post(
            f"{BASE_URL}/api/recipes/detailed",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "recipe_title": "Pad Thai",
                "cuisine": "Thai",
                "meal_type": "Dinner",
                "dietary_pref": "Any"
            },
            timeout=60
        )
        recipe = response.json()["recipe"]
        assert "Chef's Tips" in recipe or "Chef Tips" in recipe, "Recipe should have Chef's Tips section"
    
    def test_recipe_contains_nutritional_info(self, auth_token):
        """Test recipe has Nutritional Information section"""
        response = requests.post(
            f"{BASE_URL}/api/recipes/detailed",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "recipe_title": "Pad Thai",
                "cuisine": "Thai",
                "meal_type": "Dinner",
                "dietary_pref": "Any"
            },
            timeout=60
        )
        recipe = response.json()["recipe"]
        assert "Nutritional" in recipe or "Nutrition" in recipe, "Recipe should have Nutritional Information"
        assert "Calories" in recipe, "Should have Calories"
        assert "Protein" in recipe, "Should have Protein"
    
    def test_recipe_contains_storage_section(self, auth_token):
        """Test recipe has Storage & Reheating section"""
        response = requests.post(
            f"{BASE_URL}/api/recipes/detailed",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "recipe_title": "Pad Thai",
                "cuisine": "Thai",
                "meal_type": "Dinner",
                "dietary_pref": "Any"
            },
            timeout=60
        )
        recipe = response.json()["recipe"]
        assert "Storage" in recipe, "Recipe should have Storage section"
    
    def test_recipe_contains_variations(self, auth_token):
        """Test recipe has Variations section"""
        response = requests.post(
            f"{BASE_URL}/api/recipes/detailed",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "recipe_title": "Pad Thai",
                "cuisine": "Thai",
                "meal_type": "Dinner",
                "dietary_pref": "Any"
            },
            timeout=60
        )
        recipe = response.json()["recipe"]
        assert "Variations" in recipe, "Recipe should have Variations section"
    
    def test_recipe_contains_common_mistakes(self, auth_token):
        """Test recipe has Common Mistakes to Avoid section"""
        response = requests.post(
            f"{BASE_URL}/api/recipes/detailed",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "recipe_title": "Pad Thai",
                "cuisine": "Thai",
                "meal_type": "Dinner",
                "dietary_pref": "Any"
            },
            timeout=60
        )
        recipe = response.json()["recipe"]
        assert "Mistakes" in recipe or "mistakes" in recipe, "Recipe should have Common Mistakes section"
    
    def test_caching_returns_cached_true_on_second_request(self, auth_token):
        """Test that second request for same recipe returns cached=true"""
        # First request
        response1 = requests.post(
            f"{BASE_URL}/api/recipes/detailed",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "recipe_title": "Butter Chicken",
                "cuisine": "Indian",
                "meal_type": "Dinner",
                "dietary_pref": "Any"
            },
            timeout=60
        )
        
        # Second request - should be cached
        start_time = time.time()
        response2 = requests.post(
            f"{BASE_URL}/api/recipes/detailed",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "recipe_title": "Butter Chicken",
                "cuisine": "Indian",
                "meal_type": "Dinner",
                "dietary_pref": "Any"
            },
            timeout=60
        )
        elapsed = time.time() - start_time
        
        data = response2.json()
        assert data["cached"] == True, "Second request should return cached=true"
        assert elapsed < 5, f"Cached request should be fast, took {elapsed}s"
    
    def test_requires_authentication(self):
        """Test that endpoint requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/recipes/detailed",
            json={
                "recipe_title": "Test Recipe",
                "cuisine": "Italian",
                "meal_type": "Dinner",
                "dietary_pref": "Any"
            }
        )
        assert response.status_code in [401, 403], "Should require authentication"
    
    def test_invalid_token_returns_401(self):
        """Test that invalid token returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/recipes/detailed",
            headers={"Authorization": "Bearer invalid_token"},
            json={
                "recipe_title": "Test Recipe",
                "cuisine": "Italian",
                "meal_type": "Dinner",
                "dietary_pref": "Any"
            }
        )
        assert response.status_code == 401, "Invalid token should return 401"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
