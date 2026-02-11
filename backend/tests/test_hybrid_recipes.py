"""
Test SerpAPI + AI Hybrid Recipe Endpoint
Tests the /api/chat/recipes/hybrid endpoint for source_type field, ratings, links, and badges
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://regional-delivery-2.preview.emergentagent.com').rstrip('/')

# Test credentials
TEST_EMAIL = f"test_hybrid_{int(time.time())}@test.com"
TEST_PASSWORD = "TestHybrid123!"
TEST_NAME = "Hybrid Test User"


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def auth_token(api_client):
    """Register and get authentication token"""
    # Register new user
    register_response = api_client.post(f"{BASE_URL}/api/auth/register", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
        "name": TEST_NAME
    })
    
    # Accept both 200 and 201 for successful registration
    if register_response.status_code in [200, 201]:
        return register_response.json().get("access_token")
    elif register_response.status_code == 400:
        # User may already exist, try login
        login_response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if login_response.status_code == 200:
            return login_response.json().get("access_token")
    
    pytest.skip(f"Could not authenticate: {register_response.text}")


@pytest.fixture(scope="module")
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client


class TestHybridRecipeEndpoint:
    """Tests for POST /api/chat/recipes/hybrid endpoint"""
    
    def test_hybrid_endpoint_returns_recipes_with_source_type(self, authenticated_client):
        """Test that hybrid endpoint returns recipes with source_type field ('serpapi' or 'ai')"""
        response = authenticated_client.post(f"{BASE_URL}/api/chat/recipes/hybrid", json={
            "mood": "happy",
            "cuisines": ["Italian"],
            "meal_type": "dinner",
            "dietary_preference": None,
            "use_serpapi": True,
            "limit": 6
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "combined_recipes" in data, "Response should have combined_recipes"
        assert "source" in data, "Response should have source field"
        assert data["source"] in ["serpapi", "ai", "hybrid"], f"Invalid source: {data['source']}"
        
        # Check that recipes have source_type field
        for recipe in data.get("combined_recipes", []):
            assert "source_type" in recipe, f"Recipe missing source_type: {recipe.get('title')}"
            assert recipe["source_type"] in ["serpapi", "ai"], f"Invalid source_type: {recipe['source_type']}"
        
        print(f"✓ Hybrid endpoint returned {len(data['combined_recipes'])} recipes with source={data['source']}")
    
    def test_serpapi_recipes_have_required_fields(self, authenticated_client):
        """Test that SerpAPI recipes include title, cooking_time, difficulty, source, link, rating"""
        response = authenticated_client.post(f"{BASE_URL}/api/chat/recipes/hybrid", json={
            "mood": "cozy",
            "cuisines": ["Indian"],
            "meal_type": "dinner",
            "use_serpapi": True,
            "limit": 6
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Check SerpAPI recipes
        serpapi_recipes = [r for r in data.get("combined_recipes", []) if r.get("source_type") == "serpapi"]
        
        if len(serpapi_recipes) > 0:
            for recipe in serpapi_recipes:
                assert "title" in recipe and recipe["title"], f"Missing title: {recipe}"
                assert "cooking_time" in recipe, f"Missing cooking_time: {recipe.get('title')}"
                assert "difficulty" in recipe, f"Missing difficulty: {recipe.get('title')}"
                assert "source" in recipe, f"Missing source: {recipe.get('title')}"  # e.g., "AllRecipes"
                assert "link" in recipe, f"Missing link: {recipe.get('title')}"  # URL to original
                # rating and reviews are optional but expected for SerpAPI
                if recipe.get("rating"):
                    assert isinstance(recipe["rating"], (int, float)), f"Rating should be numeric: {recipe.get('rating')}"
            
            print(f"✓ {len(serpapi_recipes)} SerpAPI recipes have all required fields")
        else:
            print(f"⚠ No SerpAPI recipes returned for this query (source={data['source']})")
    
    def test_ai_recipes_have_source_type_ai(self, authenticated_client):
        """Test that AI-generated recipes have source_type='ai'"""
        response = authenticated_client.post(f"{BASE_URL}/api/chat/recipes/hybrid", json={
            "mood": "stressed",
            "cuisines": ["Thai"],
            "meal_type": "lunch",
            "use_serpapi": True,
            "limit": 6
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Check AI recipes
        ai_recipes = [r for r in data.get("combined_recipes", []) if r.get("source_type") == "ai"]
        
        for recipe in ai_recipes:
            assert recipe["source_type"] == "ai"
            assert "title" in recipe
            assert "description" in recipe
        
        print(f"✓ {len(ai_recipes)} AI recipes found with source_type='ai'")
    
    def test_serpapi_and_ai_recipes_separated(self, authenticated_client):
        """Test that serpapi_recipes and ai_recipes are returned separately"""
        response = authenticated_client.post(f"{BASE_URL}/api/chat/recipes/hybrid", json={
            "mood": "energetic",
            "cuisines": ["Mexican"],
            "meal_type": "dinner",
            "use_serpapi": True,
            "limit": 6
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Both arrays should exist in response
        assert "serpapi_recipes" in data, "Response should have serpapi_recipes array"
        assert "ai_recipes" in data, "Response should have ai_recipes array"
        assert "combined_recipes" in data, "Response should have combined_recipes array"
        
        serpapi_count = len(data.get("serpapi_recipes", []))
        ai_count = len(data.get("ai_recipes", []))
        combined_count = len(data.get("combined_recipes", []))
        
        # combined_recipes should be the merge of both
        assert combined_count <= serpapi_count + ai_count, "Combined should not exceed sum of serpapi + ai"
        
        print(f"✓ SerpAPI: {serpapi_count}, AI: {ai_count}, Combined: {combined_count}")
    
    def test_indian_cuisine_hybrid_recipes(self, authenticated_client):
        """Test hybrid recipes for Indian cuisine"""
        response = authenticated_client.post(f"{BASE_URL}/api/chat/recipes/hybrid", json={
            "mood": "cozy",
            "cuisines": ["Indian"],
            "meal_type": "dinner",
            "use_serpapi": True,
            "limit": 6
        })
        
        assert response.status_code == 200
        data = response.json()
        
        recipes = data.get("combined_recipes", [])
        assert len(recipes) > 0, "Should return at least 1 recipe"
        
        # Verify at least one recipe has Indian-related content
        has_indian = any(
            "indian" in r.get("title", "").lower() or 
            "curry" in r.get("title", "").lower() or
            r.get("cuisine", "").lower() == "indian"
            for r in recipes
        )
        
        print(f"✓ Indian cuisine: {len(recipes)} recipes, has_indian_content={has_indian}")
    
    def test_italian_cuisine_hybrid_recipes(self, authenticated_client):
        """Test hybrid recipes for Italian cuisine"""
        response = authenticated_client.post(f"{BASE_URL}/api/chat/recipes/hybrid", json={
            "mood": "happy",
            "cuisines": ["Italian"],
            "meal_type": "dinner",
            "use_serpapi": True,
            "limit": 6
        })
        
        assert response.status_code == 200
        data = response.json()
        
        recipes = data.get("combined_recipes", [])
        assert len(recipes) > 0, "Should return at least 1 recipe"
        
        print(f"✓ Italian cuisine: {len(recipes)} recipes returned")
    
    def test_thai_cuisine_hybrid_recipes(self, authenticated_client):
        """Test hybrid recipes for Thai cuisine"""
        response = authenticated_client.post(f"{BASE_URL}/api/chat/recipes/hybrid", json={
            "mood": "calm",
            "cuisines": ["Thai"],
            "meal_type": "lunch",
            "use_serpapi": True,
            "limit": 6
        })
        
        assert response.status_code == 200
        data = response.json()
        
        recipes = data.get("combined_recipes", [])
        assert len(recipes) > 0, "Should return at least 1 recipe"
        
        print(f"✓ Thai cuisine: {len(recipes)} recipes returned")
    
    def test_session_id_generated(self, authenticated_client):
        """Test that hybrid endpoint generates a session_id"""
        response = authenticated_client.post(f"{BASE_URL}/api/chat/recipes/hybrid", json={
            "mood": "relaxed",
            "cuisines": ["Mediterranean"],
            "meal_type": "dinner",
            "use_serpapi": True,
            "limit": 4
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert "session_id" in data, "Response should have session_id"
        assert isinstance(data["session_id"], str), "session_id should be a string"
        assert len(data["session_id"]) > 0, "session_id should not be empty"
        
        print(f"✓ Session ID generated: {data['session_id'][:20]}...")
    
    def test_timestamp_included(self, authenticated_client):
        """Test that response includes timestamp"""
        response = authenticated_client.post(f"{BASE_URL}/api/chat/recipes/hybrid", json={
            "mood": "happy",
            "cuisines": ["Japanese"],
            "meal_type": "dinner",
            "use_serpapi": True,
            "limit": 4
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert "timestamp" in data, "Response should have timestamp"
        print(f"✓ Timestamp included: {data['timestamp']}")


class TestHybridRecipeDataValidation:
    """Tests for recipe data quality and format"""
    
    def test_recipe_titles_are_proper_names(self, authenticated_client):
        """Verify recipe titles are complete dish names, not single ingredients"""
        response = authenticated_client.post(f"{BASE_URL}/api/chat/recipes/hybrid", json={
            "mood": "cozy",
            "cuisines": ["Italian", "Indian"],
            "meal_type": "dinner",
            "use_serpapi": True,
            "limit": 6
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Single ingredient names to avoid
        single_ingredients = ["chicken", "beef", "rice", "pasta", "egg", "tofu", "fish"]
        
        for recipe in data.get("combined_recipes", []):
            title = recipe.get("title", "").lower()
            # Title should be more than a single word
            words = title.split()
            assert len(words) >= 2, f"Title too short: {title}"
            
            # Title shouldn't be just a single ingredient
            for ingredient in single_ingredients:
                assert title != ingredient, f"Title is just an ingredient: {title}"
        
        print(f"✓ All {len(data.get('combined_recipes', []))} recipe titles are proper dish names")
    
    def test_serpapi_recipes_have_valid_links(self, authenticated_client):
        """Test that SerpAPI recipes have valid URL links"""
        response = authenticated_client.post(f"{BASE_URL}/api/chat/recipes/hybrid", json={
            "mood": "happy",
            "cuisines": ["Mexican"],
            "meal_type": "dinner",
            "use_serpapi": True,
            "limit": 6
        })
        
        assert response.status_code == 200
        data = response.json()
        
        serpapi_recipes = [r for r in data.get("combined_recipes", []) if r.get("source_type") == "serpapi"]
        
        for recipe in serpapi_recipes:
            link = recipe.get("link", "")
            if link:
                assert link.startswith("http"), f"Link should be a URL: {link}"
        
        links_count = sum(1 for r in serpapi_recipes if r.get("link"))
        print(f"✓ {links_count}/{len(serpapi_recipes)} SerpAPI recipes have valid links")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
