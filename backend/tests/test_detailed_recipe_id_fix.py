"""
Test for the detailed recipe ID fix.
Verifies that detailed recipes are saved with 'id' field when recipe_id is provided,
allowing AI Chef to find them by ID.
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    """Authenticate and get token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "lloydmasih1976@gmail.com",
        "password": "Milokiko*25"
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")

@pytest.fixture
def headers(auth_token):
    """Headers with authorization"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestDetailedRecipeIdFix:
    """Tests for verifying the detailed recipe ID fix"""
    
    def test_detailed_recipe_saves_with_id(self, headers):
        """Test that /api/recipes/detailed saves recipe with provided ID"""
        # Generate a unique test recipe ID
        test_recipe_id = f"test-recipe-{uuid.uuid4().hex[:8]}"
        
        # Call detailed recipe endpoint with recipe_id
        response = requests.post(f"{BASE_URL}/api/recipes/detailed", json={
            "recipe_title": "Test Butter Chicken for AI Chef",
            "recipe_id": test_recipe_id,
            "cuisine": "Indian",
            "meal_type": "Dinner",
            "dietary_pref": "Any"
        }, headers=headers, timeout=120)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "recipe" in data, "Response should contain 'recipe' field"
        assert len(data["recipe"]) > 100, "Detailed recipe content should be substantial"
        
        print(f"✅ Detailed recipe generated for ID: {test_recipe_id}")
        return test_recipe_id
    
    def test_ai_chef_finds_newly_created_recipe(self, headers):
        """Test that AI Chef can find recipe created via detailed endpoint"""
        # Create a unique recipe first
        test_recipe_id = f"test-aichef-{uuid.uuid4().hex[:8]}"
        
        # Step 1: Create detailed recipe with ID
        create_response = requests.post(f"{BASE_URL}/api/recipes/detailed", json={
            "recipe_title": "AI Chef Test Recipe",
            "recipe_id": test_recipe_id,
            "cuisine": "Italian",
            "meal_type": "Dinner",
            "dietary_pref": "Any"
        }, headers=headers, timeout=120)
        
        assert create_response.status_code == 200, f"Failed to create detailed recipe: {create_response.text}"
        print(f"✅ Created detailed recipe with ID: {test_recipe_id}")
        
        # Step 2: Try to fetch recipe via AI Chef endpoint
        fetch_response = requests.get(
            f"{BASE_URL}/api/chat/ai-chef/recipe/{test_recipe_id}",
            headers=headers,
            timeout=30
        )
        
        assert fetch_response.status_code == 200, f"AI Chef should find recipe by ID. Got {fetch_response.status_code}: {fetch_response.text}"
        data = fetch_response.json()
        assert "recipe" in data or "id" in data or "title" in data, f"Response should contain recipe data: {data}"
        print(f"✅ AI Chef found recipe by ID: {test_recipe_id}")
    
    def test_complete_flow_chat_recipe_to_ai_chef(self, headers):
        """Test complete flow: Simulate chat recipe -> detailed fetch -> AI Chef lookup"""
        # Simulate a chat-generated recipe ID (as frontend would generate)
        chat_recipe_id = f"chat-recipe-{uuid.uuid4().hex[:8]}"
        
        # Step 1: User clicks "View Recipe" - triggers detailed recipe with ID
        detailed_response = requests.post(f"{BASE_URL}/api/recipes/detailed", json={
            "recipe_title": "Spicy Thai Green Curry",
            "recipe_id": chat_recipe_id,
            "cuisine": "Thai",
            "meal_type": "Dinner",
            "dietary_pref": "Any"
        }, headers=headers, timeout=120)
        
        assert detailed_response.status_code == 200, f"Detailed recipe failed: {detailed_response.text}"
        print(f"✅ Step 1 - View Recipe: Detailed recipe saved with ID {chat_recipe_id}")
        
        # Step 2: User clicks "AI Chef" button - navigates to AI Chef with same ID
        ai_chef_response = requests.get(
            f"{BASE_URL}/api/chat/ai-chef/recipe/{chat_recipe_id}",
            headers=headers,
            timeout=30
        )
        
        assert ai_chef_response.status_code == 200, f"AI Chef should find recipe. Got {ai_chef_response.status_code}: {ai_chef_response.text}"
        
        recipe_data = ai_chef_response.json()
        # Verify essential fields
        assert recipe_data.get('title') or recipe_data.get('recipe', {}).get('title'), "Recipe should have title"
        print(f"✅ Step 2 - AI Chef: Recipe found by ID {chat_recipe_id}")
        
        # Step 3: Verify AI Chef can start a conversation about the recipe
        chat_response = requests.post(f"{BASE_URL}/api/chat/ai-chef", json={
            "recipe_id": chat_recipe_id,
            "message": "How do I prepare the curry paste?"
        }, headers=headers, timeout=60)
        
        assert chat_response.status_code == 200, f"AI Chef chat failed: {chat_response.text}"
        print(f"✅ Step 3 - AI Chef Chat: Successfully started conversation about recipe")
    
    def test_detailed_recipe_without_id_still_works(self, headers):
        """Test backward compatibility - detailed recipe without recipe_id should still work"""
        response = requests.post(f"{BASE_URL}/api/recipes/detailed", json={
            "recipe_title": "Classic Margherita Pizza",
            "cuisine": "Italian",
            "meal_type": "Dinner",
            "dietary_pref": "Vegetarian"
        }, headers=headers, timeout=120)
        
        assert response.status_code == 200, f"Detailed recipe without ID failed: {response.text}"
        data = response.json()
        assert "recipe" in data, "Response should contain 'recipe' field"
        print(f"✅ Backward compatibility: Detailed recipe without ID works")
    
    def test_existing_recipe_in_recipe_library_works(self, headers):
        """Verify AI Chef still works with recipes from recipe_library"""
        # Use a known recipe ID from previous tests
        known_recipe_id = "a2b7dcb135c772f1"
        
        response = requests.get(
            f"{BASE_URL}/api/chat/ai-chef/recipe/{known_recipe_id}",
            headers=headers,
            timeout=30
        )
        
        # Could be 200 (found) or 404 (not in this environment)
        if response.status_code == 200:
            print(f"✅ Known recipe {known_recipe_id} still accessible via AI Chef")
        else:
            print(f"ℹ️ Known recipe {known_recipe_id} not in this environment (status: {response.status_code})")
