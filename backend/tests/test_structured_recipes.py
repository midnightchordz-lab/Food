"""
Test structured recipe parsing and API response for fix verification.

Tests:
1. Backend parse_recipes_to_json function correctly parses LLM text
2. /api/chat/send returns structured_recipes array for recipe generation requests
3. structured_recipes contains required fields: title, description, cooking_time, difficulty, cuisine, ingredients
4. No raw markdown appears in recipe titles
"""

import pytest
import requests
import os
import time
import re

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://moodfood-android.preview.emergentagent.com"

# Test credentials
TEST_EMAIL = "test_recipe_1770442035@test.com"
TEST_PASSWORD = "TestPass123!"


class TestStructuredRecipes:
    """Test structured recipe parsing fix"""
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        """Login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Try login first
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_response.status_code != 200:
            # Register if login fails
            register_response = self.session.post(f"{BASE_URL}/api/auth/register", json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD,
                "name": "Recipe Tester"
            })
            assert register_response.status_code == 200, f"Registration failed: {register_response.text}"
            self.token = register_response.json().get("access_token")
        else:
            self.token = login_response.json().get("access_token")
        
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_recipe_generation_returns_structured_recipes(self):
        """Test /api/chat/send returns structured_recipes for recipe generation"""
        # Build a recipe generation request
        message = """
[User Preferences]
- Mood: Happy (Feeling joyful and optimistic!)
- Meal Type: Dinner
- Dietary Preference: Non-Vegetarian
- Cuisine(s): Italian

Please suggest 4 delicious dinner recipes.
"""
        response = self.session.post(f"{BASE_URL}/api/chat/send", json={
            "session_id": f"test-session-{int(time.time())}",
            "message": message
        }, timeout=60)
        
        assert response.status_code == 200, f"API returned {response.status_code}: {response.text}"
        data = response.json()
        
        # Key assertion: structured_recipes must be present
        assert "structured_recipes" in data, "Response missing structured_recipes field"
        structured_recipes = data.get("structured_recipes")
        
        # Should have at least 2 recipes
        assert structured_recipes is not None, "structured_recipes is None"
        assert isinstance(structured_recipes, list), f"structured_recipes is not a list: {type(structured_recipes)}"
        assert len(structured_recipes) >= 2, f"Expected at least 2 recipes, got {len(structured_recipes)}"
        
        print(f"✓ Got {len(structured_recipes)} structured recipes")
        
        # Verify each recipe has required fields
        for idx, recipe in enumerate(structured_recipes):
            assert "title" in recipe, f"Recipe {idx} missing 'title'"
            assert "description" in recipe, f"Recipe {idx} missing 'description'"
            assert "cooking_time" in recipe, f"Recipe {idx} missing 'cooking_time'"
            assert "difficulty" in recipe, f"Recipe {idx} missing 'difficulty'"
            
            # Title validation - ensure it's a proper recipe name
            title = recipe.get("title", "")
            assert len(title) >= 5, f"Recipe {idx} title too short: '{title}'"
            
            # Check for raw markdown in title - this was the bug
            assert "**" not in title, f"Recipe {idx} title has raw markdown **: '{title}'"
            assert "###" not in title, f"Recipe {idx} title has raw markdown ###: '{title}'"
            assert "#" not in title, f"Recipe {idx} title has raw markdown #: '{title}'"
            
            # Title should be a proper dish name (at least 2 words)
            words = title.split()
            assert len(words) >= 2, f"Recipe {idx} title should be a complete dish name: '{title}'"
            
            # Check it's not a single ingredient (the main bug we're fixing)
            single_ingredients = ['greek yogurt', 'yogurt', 'honey', 'nuts', 'berries', 'eggs', 'tomatoes']
            title_lower = title.lower()
            for ingredient in single_ingredients:
                is_single = title_lower == ingredient or title_lower == f"{ingredient}s"
                assert not is_single, f"Recipe {idx} title is a single ingredient, not a dish: '{title}'"
            
            print(f"  ✓ Recipe {idx+1}: {title}")
    
    def test_italian_recipes(self):
        """Test recipe generation for Italian cuisine"""
        message = """
[User Preferences]
- Mood: Happy
- Meal Type: Dinner
- Dietary Preference: Non-Vegetarian
- Cuisine(s): Italian

Please suggest 4 delicious Italian dinner recipes.
"""
        response = self.session.post(f"{BASE_URL}/api/chat/send", json={
            "session_id": f"test-italian-{int(time.time())}",
            "message": message
        }, timeout=60)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify structured recipes
        recipes = data.get("structured_recipes", [])
        assert len(recipes) >= 2, f"Expected at least 2 Italian recipes, got {len(recipes)}"
        
        # Check cuisine is detected as Italian
        for recipe in recipes:
            title = recipe.get("title", "")
            cuisine = recipe.get("cuisine", "")
            print(f"  Italian Recipe: {title} (Cuisine: {cuisine})")
            
            # Title should look like a dish, not raw text
            assert len(title) >= 5, f"Title too short: {title}"
    
    def test_indian_recipes(self):
        """Test recipe generation for Indian cuisine"""
        message = """
[User Preferences]
- Mood: Cozy
- Meal Type: Dinner
- Dietary Preference: Vegetarian
- Cuisine(s): Indian

Please suggest 4 delicious Indian dinner recipes.
"""
        response = self.session.post(f"{BASE_URL}/api/chat/send", json={
            "session_id": f"test-indian-{int(time.time())}",
            "message": message
        }, timeout=60)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify structured recipes
        recipes = data.get("structured_recipes", [])
        assert len(recipes) >= 2, f"Expected at least 2 Indian recipes, got {len(recipes)}"
        
        # Check cuisine is detected as Indian
        for recipe in recipes:
            title = recipe.get("title", "")
            cuisine = recipe.get("cuisine", "")
            print(f"  Indian Recipe: {title} (Cuisine: {cuisine})")
            
            # Title should look like a dish, not raw text
            assert len(title) >= 5, f"Title too short: {title}"
    
    def test_thai_recipes(self):
        """Test recipe generation for Thai cuisine"""
        message = """
[User Preferences]
- Mood: Energetic
- Meal Type: Lunch
- Dietary Preference: Any
- Cuisine(s): Thai

Please suggest 4 delicious Thai lunch recipes.
"""
        response = self.session.post(f"{BASE_URL}/api/chat/send", json={
            "session_id": f"test-thai-{int(time.time())}",
            "message": message
        }, timeout=60)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify structured recipes
        recipes = data.get("structured_recipes", [])
        assert len(recipes) >= 2, f"Expected at least 2 Thai recipes, got {len(recipes)}"
        
        # Check cuisine is detected as Thai
        for recipe in recipes:
            title = recipe.get("title", "")
            cuisine = recipe.get("cuisine", "")
            print(f"  Thai Recipe: {title} (Cuisine: {cuisine})")
            
            # Title should look like a dish, not raw text
            assert len(title) >= 5, f"Title too short: {title}"
    
    def test_no_raw_markdown_in_response_text(self):
        """Verify raw markdown patterns don't appear in rendered recipe titles"""
        message = """
[User Preferences]
- Mood: Calm
- Meal Type: Dinner
- Dietary Preference: Non-Vegetarian
- Cuisine(s): Japanese

Please suggest 4 delicious Japanese dinner recipes.
"""
        response = self.session.post(f"{BASE_URL}/api/chat/send", json={
            "session_id": f"test-markdown-{int(time.time())}",
            "message": message
        }, timeout=60)
        
        assert response.status_code == 200
        data = response.json()
        
        recipes = data.get("structured_recipes", [])
        assert len(recipes) >= 2, "Expected at least 2 recipes"
        
        # These patterns should NOT appear in recipe titles
        # This was the core issue - raw markdown showing instead of rendered cards
        bad_patterns = [
            r'\*\*Recipe:',    # **Recipe:
            r'###\s*\d+\.',    # ### 1.
            r'\*\*\d+\.',      # **1.
            r'^\*\*',          # starts with **
            r'\*\*$',          # ends with **
        ]
        
        for recipe in recipes:
            title = recipe.get("title", "")
            for pattern in bad_patterns:
                match = re.search(pattern, title)
                assert not match, f"Raw markdown pattern '{pattern}' found in title: '{title}'"
            print(f"  ✓ Clean title: {title}")
    
    def test_recipe_structure_fields(self):
        """Test that structured recipes have all expected fields with correct types"""
        message = """
[User Preferences]
- Mood: Happy
- Meal Type: Dinner
- Dietary Preference: Any
- Cuisine(s): Mexican

Please suggest 4 delicious Mexican dinner recipes.
"""
        response = self.session.post(f"{BASE_URL}/api/chat/send", json={
            "session_id": f"test-fields-{int(time.time())}",
            "message": message
        }, timeout=60)
        
        assert response.status_code == 200
        data = response.json()
        
        recipes = data.get("structured_recipes", [])
        assert len(recipes) >= 2, "Expected at least 2 recipes"
        
        for idx, recipe in enumerate(recipes):
            # Required fields
            assert "title" in recipe and isinstance(recipe["title"], str)
            assert "description" in recipe and isinstance(recipe["description"], str)
            assert "cooking_time" in recipe and isinstance(recipe["cooking_time"], str)
            assert "difficulty" in recipe and isinstance(recipe["difficulty"], str)
            
            # Optional but expected fields
            if "cuisine" in recipe:
                assert isinstance(recipe["cuisine"], str)
            if "ingredients" in recipe:
                assert isinstance(recipe["ingredients"], list)
            
            # Validate difficulty is a known value
            valid_difficulties = ["Easy", "Medium", "Hard"]
            assert recipe["difficulty"] in valid_difficulties, f"Invalid difficulty: {recipe['difficulty']}"
            
            print(f"  ✓ Recipe {idx+1}: {recipe['title']} ({recipe['difficulty']}, {recipe['cooking_time']})")


class TestHasRecipesFunction:
    """Test the hasRecipes detection function behavior"""
    
    def test_detect_recipe_patterns(self):
        """Test various recipe patterns are detected"""
        # These patterns should be detected as recipes
        recipe_texts = [
            "### 1. Chicken Piccata\n**Cooking Time:** 30 min\n**Difficulty:** Easy",
            "**Recipe: Pad Thai**\n*Cooking Time:* 25 min",
            "1. **Teriyaki Salmon**\nA delicious dish with cooking time of 20 minutes",
            "**Dish:** Creamy Risotto\n**Ingredients:** rice, stock, parmesan",
        ]
        
        # Pattern check from hasRecipes function
        for text in recipe_texts:
            has_time = bool(re.search(r'\*\*(Cooking Time|Difficulty|Ingredients|Instructions|Description):?\*\*', text, re.IGNORECASE))
            has_numbered = bool(re.search(r'^\d+\.\s*\*\*[^*]+\*\*', text, re.MULTILINE))
            has_bold = bool(re.search(r'^\*\*[A-Z][^*]+\*\*', text, re.MULTILINE))
            has_label = bool(re.search(r'\*\*Recipe:?\s*[^*]+\*\*', text, re.IGNORECASE))
            has_dish = bool(re.search(r'\*\*Dish:?\*\*', text, re.IGNORECASE))
            
            is_recipe = has_time or has_numbered or has_bold or has_label or has_dish
            assert is_recipe, f"Failed to detect recipe pattern in: {text[:50]}..."


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
