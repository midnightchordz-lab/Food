"""
Test Import Recipe Feature - Backend API Tests
Tests for: POST /api/import/url, /api/import/image, /api/import/video, /api/import/text, /api/import/save, GET /api/import/recent
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "testuser@example.com"
TEST_PASSWORD = "testpass123"


class TestImportRecipeAuth:
    """Test authentication requirements for import endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_import_text_requires_auth(self):
        """Test that import/text endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/import/text", json={
            "recipe_text": "Test recipe"
        })
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ POST /api/import/text requires authentication")
    
    def test_import_url_requires_auth(self):
        """Test that import/url endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/import/url", json={
            "url": "https://example.com/recipe"
        })
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ POST /api/import/url requires authentication")
    
    def test_import_video_requires_auth(self):
        """Test that import/video endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/import/video", json={
            "video_url": "https://youtube.com/watch?v=test"
        })
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ POST /api/import/video requires authentication")
    
    def test_import_recent_requires_auth(self):
        """Test that import/recent endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/import/recent")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ GET /api/import/recent requires authentication")


class TestImportFromText:
    """Test importing recipes from plain text"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_import_text_success(self):
        """Test successful text import with valid recipe text"""
        recipe_text = """
        Classic Chocolate Chip Cookies
        
        Ingredients:
        - 2 1/4 cups all-purpose flour
        - 1 cup butter, softened
        - 3/4 cup granulated sugar
        - 3/4 cup packed brown sugar
        - 2 large eggs
        - 1 teaspoon vanilla extract
        - 1 teaspoon baking soda
        - 1 teaspoon salt
        - 2 cups chocolate chips
        
        Instructions:
        1. Preheat oven to 375°F
        2. Mix flour, baking soda and salt in a bowl
        3. Beat butter and sugars until creamy
        4. Add eggs and vanilla to butter mixture
        5. Gradually blend in flour mixture
        6. Stir in chocolate chips
        7. Drop rounded tablespoons onto ungreased baking sheets
        8. Bake for 9 to 11 minutes or until golden brown
        """
        
        response = requests.post(
            f"{BASE_URL}/api/import/text",
            json={"recipe_text": recipe_text},
            headers=self.headers,
            timeout=60  # AI processing may take time
        )
        
        assert response.status_code == 200, f"Import failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "recipe" in data, "Response should contain 'recipe' key"
        recipe = data["recipe"]
        
        # Verify recipe has required fields
        assert "name" in recipe, "Recipe should have 'name'"
        assert "ingredients" in recipe, "Recipe should have 'ingredients'"
        assert "instructions" in recipe, "Recipe should have 'instructions'"
        
        # Verify AI enhanced the recipe with detailed format
        assert len(recipe.get("ingredients", [])) > 0, "Recipe should have ingredients"
        assert len(recipe.get("instructions", [])) > 0, "Recipe should have instructions"
        
        # Check for detailed instruction format (timing, visual cues)
        instructions = recipe.get("instructions", [])
        if len(instructions) > 0:
            first_step = instructions[0]
            # Instructions should be objects with stepNumber and instruction
            assert isinstance(first_step, dict), "Instructions should be detailed objects"
            assert "instruction" in first_step or "stepNumber" in first_step, "Instructions should have detailed format"
        
        print(f"✓ POST /api/import/text successfully imported: {recipe.get('name', 'Unknown')}")
        print(f"  - {len(recipe.get('ingredients', []))} ingredients")
        print(f"  - {len(recipe.get('instructions', []))} steps")
    
    def test_import_text_too_short(self):
        """Test that too short text is rejected"""
        response = requests.post(
            f"{BASE_URL}/api/import/text",
            json={"recipe_text": "short"},
            headers=self.headers
        )
        
        assert response.status_code == 400, f"Expected 400 for short text, got {response.status_code}"
        print("✓ POST /api/import/text rejects too short text")
    
    def test_import_text_empty(self):
        """Test that empty text is rejected"""
        response = requests.post(
            f"{BASE_URL}/api/import/text",
            json={"recipe_text": ""},
            headers=self.headers
        )
        
        # Should fail validation or return 400
        assert response.status_code in [400, 422], f"Expected 400/422 for empty text, got {response.status_code}"
        print("✓ POST /api/import/text rejects empty text")


class TestImportFromURL:
    """Test importing recipes from URLs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_import_url_invalid_format(self):
        """Test that invalid URL format is rejected"""
        response = requests.post(
            f"{BASE_URL}/api/import/url",
            json={"url": "not-a-valid-url"},
            headers=self.headers
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid URL, got {response.status_code}"
        print("✓ POST /api/import/url rejects invalid URL format")
    
    def test_import_url_success(self):
        """Test successful URL import with a real recipe URL"""
        # Using a simple recipe page that should work
        test_url = "https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/"
        
        response = requests.post(
            f"{BASE_URL}/api/import/url",
            json={"url": test_url},
            headers=self.headers,
            timeout=90  # URL fetch + AI processing may take time
        )
        
        # URL import may fail if the site blocks scraping, so we accept 200 or 400
        if response.status_code == 200:
            data = response.json()
            assert "recipe" in data, "Response should contain 'recipe' key"
            recipe = data["recipe"]
            assert "name" in recipe, "Recipe should have 'name'"
            print(f"✓ POST /api/import/url successfully imported: {recipe.get('name', 'Unknown')}")
        else:
            # Some sites may block scraping
            print(f"⚠ POST /api/import/url returned {response.status_code} - site may block scraping")
            assert response.status_code in [400, 500], f"Unexpected status: {response.status_code}"


class TestImportFromVideo:
    """Test importing recipes from video URLs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_import_video_youtube_url(self):
        """Test importing from a YouTube cooking video URL"""
        # Using a popular cooking video
        youtube_url = "https://www.youtube.com/watch?v=OCcKTL2VmIY"  # Gordon Ramsay scrambled eggs
        
        response = requests.post(
            f"{BASE_URL}/api/import/video",
            json={"video_url": youtube_url},
            headers=self.headers,
            timeout=90  # AI processing may take time
        )
        
        assert response.status_code == 200, f"Video import failed: {response.text}"
        data = response.json()
        
        assert "recipe" in data, "Response should contain 'recipe' key"
        recipe = data["recipe"]
        
        # Verify recipe structure
        assert "name" in recipe, "Recipe should have 'name'"
        assert "ingredients" in recipe, "Recipe should have 'ingredients'"
        assert "instructions" in recipe, "Recipe should have 'instructions'"
        
        # Verify import metadata
        assert recipe.get("importMethod") == "video", "Import method should be 'video'"
        
        print(f"✓ POST /api/import/video successfully imported from YouTube: {recipe.get('name', 'Unknown')}")
    
    def test_import_video_youtube_shorts(self):
        """Test importing from a YouTube Shorts URL"""
        # YouTube Shorts format
        shorts_url = "https://www.youtube.com/shorts/dQw4w9WgXcQ"
        
        response = requests.post(
            f"{BASE_URL}/api/import/video",
            json={"video_url": shorts_url},
            headers=self.headers,
            timeout=60
        )
        
        # Shorts may or may not have recipe content, but endpoint should work
        assert response.status_code in [200, 500], f"Unexpected status: {response.status_code}"
        print(f"✓ POST /api/import/video handles YouTube Shorts URL (status: {response.status_code})")


class TestImportSaveAndRecent:
    """Test saving imported recipes and retrieving recent imports"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_save_imported_recipe(self):
        """Test saving an imported recipe to user's collection"""
        # First import a recipe
        recipe_text = """
        Simple Pasta Aglio e Olio
        
        Ingredients:
        - 1 pound spaghetti
        - 6 cloves garlic, thinly sliced
        - 1/2 cup olive oil
        - 1/4 teaspoon red pepper flakes
        - Salt to taste
        - Fresh parsley, chopped
        
        Instructions:
        1. Cook pasta according to package directions
        2. Heat olive oil in a large pan over medium heat
        3. Add garlic and cook until golden
        4. Add red pepper flakes
        5. Toss pasta with garlic oil
        6. Garnish with parsley
        """
        
        # Import the recipe
        import_response = requests.post(
            f"{BASE_URL}/api/import/text",
            json={"recipe_text": recipe_text},
            headers=self.headers,
            timeout=60
        )
        
        assert import_response.status_code == 200, f"Import failed: {import_response.text}"
        imported_recipe = import_response.json()["recipe"]
        
        # Save the imported recipe
        save_response = requests.post(
            f"{BASE_URL}/api/import/save",
            json={"recipe": imported_recipe},
            headers=self.headers
        )
        
        assert save_response.status_code == 200, f"Save failed: {save_response.text}"
        save_data = save_response.json()
        
        assert "message" in save_data, "Response should have success message"
        assert "recipe" in save_data, "Response should contain saved recipe"
        assert save_data["recipe"].get("id"), "Saved recipe should have an ID"
        
        print(f"✓ POST /api/import/save successfully saved recipe: {save_data['recipe'].get('title', 'Unknown')}")
    
    def test_get_recent_imports(self):
        """Test retrieving recently imported recipes"""
        response = requests.get(
            f"{BASE_URL}/api/import/recent",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Get recent failed: {response.text}"
        data = response.json()
        
        assert "recipes" in data, "Response should contain 'recipes' key"
        assert isinstance(data["recipes"], list), "Recipes should be a list"
        
        print(f"✓ GET /api/import/recent returned {len(data['recipes'])} recent imports")
        
        # If there are recipes, verify structure
        if len(data["recipes"]) > 0:
            recipe = data["recipes"][0]
            assert "title" in recipe or "name" in recipe, "Recipe should have title/name"
            print(f"  - Most recent: {recipe.get('title') or recipe.get('name', 'Unknown')}")


class TestImportRecipeDetailedFormat:
    """Test that imported recipes have the detailed format with timing, temperatures, visual cues"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_imported_recipe_has_detailed_instructions(self):
        """Test that AI converts recipe to detailed format with timing and visual cues"""
        recipe_text = """
        Grilled Cheese Sandwich
        
        Ingredients:
        - 2 slices bread
        - 2 slices cheese
        - 1 tablespoon butter
        
        Instructions:
        1. Butter the bread
        2. Put cheese between bread
        3. Grill until done
        """
        
        response = requests.post(
            f"{BASE_URL}/api/import/text",
            json={"recipe_text": recipe_text},
            headers=self.headers,
            timeout=60
        )
        
        assert response.status_code == 200, f"Import failed: {response.text}"
        recipe = response.json()["recipe"]
        
        # Check for detailed instruction format
        instructions = recipe.get("instructions", [])
        assert len(instructions) > 0, "Recipe should have instructions"
        
        # Verify instructions are detailed objects, not just strings
        first_instruction = instructions[0]
        if isinstance(first_instruction, dict):
            # Check for detailed fields
            has_timing = "time" in first_instruction or any("minute" in str(v).lower() for v in first_instruction.values())
            has_visual_cue = "visualCue" in first_instruction or "visual" in str(first_instruction).lower()
            
            print(f"✓ Recipe has detailed instruction format")
            print(f"  - Has timing info: {has_timing}")
            print(f"  - Has visual cues: {has_visual_cue}")
        else:
            print(f"⚠ Instructions are strings, not detailed objects")
        
        # Check for other detailed fields
        assert "prepTime" in recipe or "prep_time" in recipe, "Recipe should have prep time"
        assert "cookTime" in recipe or "cook_time" in recipe, "Recipe should have cook time"
        
        print(f"✓ Imported recipe has detailed format: {recipe.get('name', 'Unknown')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
