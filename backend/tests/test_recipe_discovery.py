"""
Test suite for Recipe Discovery API endpoints
Tests the /api/recipes/discover endpoint with various filters
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestRecipeDiscoveryAPI:
    """Tests for the Recipe Discovery API endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures - get auth token"""
        # Login to get token
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "test123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_discover_all_cuisines(self):
        """Test POST /api/recipes/discover returns recipes from all cuisines when no filter"""
        response = requests.post(
            f"{BASE_URL}/api/recipes/discover",
            headers=self.headers,
            json={"count": 12}
        )
        
        # Status assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "recipes" in data, "Response should contain 'recipes' key"
        recipes = data["recipes"]
        assert len(recipes) > 0, "Should return at least one recipe"
        
        # Check multiple cuisines are returned
        cuisines = set(r["cuisine"] for r in recipes)
        assert len(cuisines) > 1, f"Should return recipes from multiple cuisines, got: {cuisines}"
        print(f"Cuisines returned: {cuisines}")
    
    def test_discover_indian_cuisine_filter(self):
        """Test POST /api/recipes/discover with Indian cuisine filter"""
        response = requests.post(
            f"{BASE_URL}/api/recipes/discover",
            headers=self.headers,
            json={"cuisine": "Indian", "count": 12}
        )
        
        # Status assertion
        assert response.status_code == 200
        
        # Data assertions
        data = response.json()
        recipes = data["recipes"]
        assert len(recipes) > 0, "Should return Indian recipes"
        
        # All recipes should be Indian
        for recipe in recipes:
            assert recipe["cuisine"] == "Indian", f"Expected Indian cuisine, got {recipe['cuisine']}"
        
        # Check for expected Indian dishes
        titles = [r["title"] for r in recipes]
        indian_dishes = ["Butter Chicken", "Palak Paneer", "Chicken Biryani", "Dal Tadka", "Chole Bhature"]
        found_dishes = [d for d in indian_dishes if d in titles]
        assert len(found_dishes) > 0, f"Should find Indian dishes, got: {titles}"
        print(f"Indian dishes found: {found_dishes}")
    
    def test_discover_chinese_cuisine_filter(self):
        """Test POST /api/recipes/discover with Chinese cuisine filter"""
        response = requests.post(
            f"{BASE_URL}/api/recipes/discover",
            headers=self.headers,
            json={"cuisine": "Chinese", "count": 12}
        )
        
        assert response.status_code == 200
        data = response.json()
        recipes = data["recipes"]
        
        # All recipes should be Chinese
        for recipe in recipes:
            assert recipe["cuisine"] == "Chinese"
        
        # Check for expected Chinese dishes
        titles = [r["title"] for r in recipes]
        chinese_dishes = ["Kung Pao Chicken", "Mapo Tofu", "Dim Sum Dumplings", "Sweet and Sour Pork", "Fried Rice"]
        found_dishes = [d for d in chinese_dishes if d in titles]
        assert len(found_dishes) > 0, f"Should find Chinese dishes, got: {titles}"
        print(f"Chinese dishes found: {found_dishes}")
    
    def test_discover_italian_cuisine_filter(self):
        """Test POST /api/recipes/discover with Italian cuisine filter"""
        response = requests.post(
            f"{BASE_URL}/api/recipes/discover",
            headers=self.headers,
            json={"cuisine": "Italian", "count": 12}
        )
        
        assert response.status_code == 200
        data = response.json()
        recipes = data["recipes"]
        
        for recipe in recipes:
            assert recipe["cuisine"] == "Italian"
        
        titles = [r["title"] for r in recipes]
        italian_dishes = ["Spaghetti Carbonara", "Osso Buco", "Margherita Pizza", "Risotto alla Milanese", "Tiramisu"]
        found_dishes = [d for d in italian_dishes if d in titles]
        assert len(found_dishes) > 0
        print(f"Italian dishes found: {found_dishes}")
    
    def test_recipe_card_structure(self):
        """Test that recipe cards contain all required fields"""
        response = requests.post(
            f"{BASE_URL}/api/recipes/discover",
            headers=self.headers,
            json={"count": 5}
        )
        
        assert response.status_code == 200
        data = response.json()
        recipes = data["recipes"]
        
        required_fields = ["title", "description", "cooking_time", "difficulty", "image_url", "cuisine", "source_url"]
        
        for recipe in recipes:
            for field in required_fields:
                assert field in recipe, f"Recipe missing required field: {field}"
                assert recipe[field] is not None, f"Field {field} should not be None"
                assert recipe[field] != "", f"Field {field} should not be empty"
            
            # Validate difficulty values
            assert recipe["difficulty"] in ["Easy", "Medium", "Hard"], f"Invalid difficulty: {recipe['difficulty']}"
            
            # Validate cooking time format
            assert "min" in recipe["cooking_time"].lower(), f"Cooking time should contain 'min': {recipe['cooking_time']}"
            
            # Validate image URL is clean (no country codes)
            assert "unsplash.com" in recipe["image_url"], f"Image should be from Unsplash: {recipe['image_url']}"
            assert "?w=" in recipe["image_url"], f"Image URL should have width parameter"
        
        print(f"All {len(recipes)} recipes have valid structure")
    
    def test_image_urls_are_clean(self):
        """Test that image URLs are clean Unsplash URLs without country codes"""
        response = requests.post(
            f"{BASE_URL}/api/recipes/discover",
            headers=self.headers,
            json={"count": 12}
        )
        
        assert response.status_code == 200
        data = response.json()
        recipes = data["recipes"]
        
        for recipe in recipes:
            image_url = recipe["image_url"]
            
            # Check it's a valid Unsplash URL
            assert image_url.startswith("https://images.unsplash.com/"), f"Invalid image URL: {image_url}"
            
            # Check no country codes in URL (like /en-US/, /de-DE/, etc.)
            import re
            country_code_pattern = r'/[a-z]{2}-[A-Z]{2}/'
            assert not re.search(country_code_pattern, image_url), f"Image URL contains country code: {image_url}"
        
        print(f"All {len(recipes)} image URLs are clean")
    
    def test_all_cuisines_available(self):
        """Test that all 9 cuisines are available in the API"""
        expected_cuisines = ["Indian", "Chinese", "Italian", "Mexican", "Japanese", "Thai", "Mediterranean", "Korean", "French"]
        
        for cuisine in expected_cuisines:
            response = requests.post(
                f"{BASE_URL}/api/recipes/discover",
                headers=self.headers,
                json={"cuisine": cuisine, "count": 5}
            )
            
            assert response.status_code == 200, f"Failed for cuisine {cuisine}: {response.text}"
            data = response.json()
            recipes = data["recipes"]
            assert len(recipes) > 0, f"No recipes found for {cuisine}"
            
            # Verify all returned recipes are from the requested cuisine
            for recipe in recipes:
                assert recipe["cuisine"] == cuisine, f"Expected {cuisine}, got {recipe['cuisine']}"
        
        print(f"All {len(expected_cuisines)} cuisines are available")
    
    def test_discover_requires_authentication(self):
        """Test that /api/recipes/discover requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/recipes/discover",
            json={"count": 5}
        )
        
        # Should return 401 or 403 for unauthenticated request
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("Authentication required - test passed")
    
    def test_count_parameter(self):
        """Test that count parameter limits the number of recipes returned"""
        # Request 5 recipes
        response = requests.post(
            f"{BASE_URL}/api/recipes/discover",
            headers=self.headers,
            json={"count": 5}
        )
        
        assert response.status_code == 200
        data = response.json()
        recipes = data["recipes"]
        assert len(recipes) <= 5, f"Should return at most 5 recipes, got {len(recipes)}"
        
        # Request 20 recipes
        response = requests.post(
            f"{BASE_URL}/api/recipes/discover",
            headers=self.headers,
            json={"count": 20}
        )
        
        assert response.status_code == 200
        data = response.json()
        recipes = data["recipes"]
        assert len(recipes) <= 20, f"Should return at most 20 recipes, got {len(recipes)}"
        print(f"Count parameter working correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
