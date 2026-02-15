"""
AI Chef Feature Backend Tests
Tests the new AI Chef cooking assistant endpoints:
- POST /api/chat/ai-chef/chat - Conversation handling
- GET /api/chat/ai-chef/recipe/{id} - Recipe fetching for AI Chef
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://hands-free-chef.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "demouser@example.com"
TEST_PASSWORD = "password123"


class TestAuth:
    """Authentication endpoint tests"""
    
    def test_login_success(self):
        """Test successful login with demo credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data or "token" in data, "Token not in response"
        return data.get("access_token") or data.get("token")


class TestAIChefEndpoints:
    """AI Chef feature endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("access_token") or data.get("token")
            self.headers = {
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json"
            }
        else:
            pytest.skip("Authentication failed - skipping AI Chef tests")
    
    def test_ai_chef_chat_next_command(self):
        """Test AI Chef chat with 'next' navigation command"""
        payload = {
            "message": "next",
            "recipe_context": {
                "title": "Test Recipe",
                "servings": "4",
                "ingredients": ["ingredient 1", "ingredient 2"],
                "instructions": ["Step 1: Do this", "Step 2: Do that", "Step 3: Finish"]
            },
            "conversation_history": [],
            "current_step": 0
        }
        
        response = requests.post(
            f"{BASE_URL}/api/chat/ai-chef/chat",
            json=payload,
            headers=self.headers
        )
        
        assert response.status_code == 200, f"AI Chef chat failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "text" in data, "Response missing 'text' field"
        assert "step" in data, "Response missing 'step' field"
        assert "emotion" in data, "Response missing 'emotion' field"
        
        # Verify navigation worked (step should advance)
        assert data["step"] == 1, f"Expected step 1, got {data['step']}"
        assert data["navigation"] == "next", f"Expected navigation='next', got {data.get('navigation')}"
    
    def test_ai_chef_chat_back_command(self):
        """Test AI Chef chat with 'back' navigation command"""
        payload = {
            "message": "back",
            "recipe_context": {
                "title": "Test Recipe",
                "servings": "4",
                "ingredients": ["ingredient 1", "ingredient 2"],
                "instructions": ["Step 1: Do this", "Step 2: Do that", "Step 3: Finish"]
            },
            "conversation_history": [],
            "current_step": 2
        }
        
        response = requests.post(
            f"{BASE_URL}/api/chat/ai-chef/chat",
            json=payload,
            headers=self.headers
        )
        
        assert response.status_code == 200, f"AI Chef chat failed: {response.text}"
        data = response.json()
        
        # Verify navigation worked (step should go back)
        assert data["step"] == 1, f"Expected step 1, got {data['step']}"
        assert data["navigation"] == "back", f"Expected navigation='back', got {data.get('navigation')}"
    
    def test_ai_chef_chat_repeat_command(self):
        """Test AI Chef chat with 'repeat' command"""
        payload = {
            "message": "repeat",
            "recipe_context": {
                "title": "Test Recipe",
                "servings": "4",
                "ingredients": ["ingredient 1", "ingredient 2"],
                "instructions": ["Step 1: Do this", "Step 2: Do that"]
            },
            "conversation_history": [],
            "current_step": 0
        }
        
        response = requests.post(
            f"{BASE_URL}/api/chat/ai-chef/chat",
            json=payload,
            headers=self.headers
        )
        
        assert response.status_code == 200, f"AI Chef chat failed: {response.text}"
        data = response.json()
        
        # Verify step didn't change
        assert data["step"] == 0, f"Expected step 0, got {data['step']}"
        assert data["navigation"] == "repeat", f"Expected navigation='repeat', got {data.get('navigation')}"
    
    def test_ai_chef_chat_at_last_step(self):
        """Test AI Chef chat 'next' at last step returns 'complete'"""
        payload = {
            "message": "next",
            "recipe_context": {
                "title": "Test Recipe",
                "servings": "4",
                "ingredients": ["ingredient 1"],
                "instructions": ["Step 1: Do this", "Step 2: Final"]
            },
            "conversation_history": [],
            "current_step": 1  # Already at last step
        }
        
        response = requests.post(
            f"{BASE_URL}/api/chat/ai-chef/chat",
            json=payload,
            headers=self.headers
        )
        
        assert response.status_code == 200, f"AI Chef chat failed: {response.text}"
        data = response.json()
        
        # Verify completion state
        assert data["navigation"] == "complete", f"Expected navigation='complete', got {data.get('navigation')}"
        assert "complete" in data["text"].lower() or "finish" in data["text"].lower(), "Completion message expected"
    
    def test_ai_chef_chat_at_first_step_back(self):
        """Test AI Chef chat 'back' at first step stays at step 0"""
        payload = {
            "message": "back",
            "recipe_context": {
                "title": "Test Recipe",
                "servings": "4",
                "ingredients": ["ingredient 1"],
                "instructions": ["Step 1: Do this", "Step 2: Do that"]
            },
            "conversation_history": [],
            "current_step": 0  # Already at first step
        }
        
        response = requests.post(
            f"{BASE_URL}/api/chat/ai-chef/chat",
            json=payload,
            headers=self.headers
        )
        
        assert response.status_code == 200, f"AI Chef chat failed: {response.text}"
        data = response.json()
        
        # Verify step didn't go negative
        assert data["step"] == 0, f"Expected step 0, got {data['step']}"
        assert data["navigation"] == "stay", f"Expected navigation='stay', got {data.get('navigation')}"
    
    def test_ai_chef_chat_question(self):
        """Test AI Chef chat with a cooking question (uses AI)"""
        payload = {
            "message": "How long should I boil pasta?",
            "recipe_context": {
                "title": "Pasta Dish",
                "servings": "4",
                "ingredients": ["pasta", "sauce", "cheese"],
                "instructions": ["Step 1: Boil pasta", "Step 2: Add sauce"]
            },
            "conversation_history": [],
            "current_step": 0
        }
        
        response = requests.post(
            f"{BASE_URL}/api/chat/ai-chef/chat",
            json=payload,
            headers=self.headers,
            timeout=30  # AI calls may take longer
        )
        
        assert response.status_code == 200, f"AI Chef chat failed: {response.text}"
        data = response.json()
        
        # Verify response has text (AI generated)
        assert "text" in data, "Response missing 'text' field"
        assert len(data["text"]) > 10, "AI response too short"
        # Step should not change for questions
        assert data["step"] == 0, f"Expected step 0, got {data['step']}"
        # Navigation should be None for questions
        assert data["navigation"] is None, f"Expected navigation=None, got {data.get('navigation')}"
    
    def test_ai_chef_chat_unauthorized(self):
        """Test AI Chef chat without auth token returns 401"""
        payload = {
            "message": "next",
            "recipe_context": {"title": "Test", "instructions": ["Step 1"]},
            "conversation_history": [],
            "current_step": 0
        }
        
        response = requests.post(
            f"{BASE_URL}/api/chat/ai-chef/chat",
            json=payload,
            headers={"Content-Type": "application/json"}  # No auth token
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"


class TestRecipeGeneration:
    """Test recipe generation to ensure recipes exist for AI Chef"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("access_token") or data.get("token")
            self.headers = {
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json"
            }
        else:
            pytest.skip("Authentication failed")
    
    def test_generate_recipes_for_mood(self):
        """Test generating recipes (needed for AI Chef to have recipes)"""
        payload = {
            "session_id": "test-ai-chef-session",
            "message": """[User Preferences]
- Mood: Happy (feeling joyful and upbeat)
- Meal Type: Dinner
- Dietary Preference: Vegetarian
- Cuisine(s): Indian"""
        }
        
        response = requests.post(
            f"{BASE_URL}/api/chat/send",
            json=payload,
            headers=self.headers,
            timeout=60  # AI generation takes time
        )
        
        assert response.status_code == 200, f"Recipe generation failed: {response.text}"
        data = response.json()
        
        # Check for structured recipes in response
        assert "response" in data, "Response missing 'response' field"
        
        # Check for structured_recipes if present
        if "structured_recipes" in data and data["structured_recipes"]:
            recipes = data["structured_recipes"]
            assert len(recipes) > 0, "No recipes returned"
            
            # Verify first recipe has required fields
            first_recipe = recipes[0]
            assert "title" in first_recipe, "Recipe missing 'title'"
            print(f"Generated recipe: {first_recipe.get('title')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
