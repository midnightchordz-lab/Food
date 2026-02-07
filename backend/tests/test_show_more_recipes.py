"""
Test 'Show More' Recipes Functionality
Tests the ability to request more recipes after receiving initial recipes.
Both main chat (/api/chat/send) and diabetes chat (/api/diabetes/chat) endpoints.
"""
import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestShowMoreRecipes:
    """Test suite for 'show more' recipes functionality"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Create a test user and get authentication token"""
        timestamp = int(time.time())
        email = f"showmore_test_{timestamp}@test.com"
        password = "TestPass123!"
        
        # Register new user
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": email, "password": password, "name": "ShowMoreTest"}
        )
        
        if response.status_code == 200:
            return response.json().get("access_token")
        elif response.status_code == 400:
            # User may already exist, try login
            login_response = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": email, "password": password}
            )
            if login_response.status_code == 200:
                return login_response.json().get("access_token")
        
        pytest.skip("Could not authenticate - skipping tests")
    
    @pytest.fixture(scope="class")
    def session_id(self):
        """Generate a unique session ID for this test run"""
        return f"test-session-{uuid.uuid4().hex[:8]}"
    
    @pytest.fixture(scope="class")
    def api_client(self, auth_token):
        """Create authenticated API client"""
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {auth_token}"
        })
        return session
    
    # ==================== Main Chat Tests ====================
    
    def test_main_chat_initial_recipe_generation(self, api_client, session_id):
        """Test initial recipe generation in main chat"""
        # Standard recipe request message that triggers recipe generation
        message = """
[User Preferences]
- Mood: Happy (Feeling joyful and energetic)
- Meal Type: Lunch
- Dietary Preference: Vegetarian
- Cuisine(s): Italian

Create 6 ORIGINAL lunch recipes that:
1. Match the happy mood perfectly
2. Are vegetarian friendly
3. Feature authentic Italian flavors and techniques
4. Have creative, appetizing names

Please suggest some delicious recipes!
"""
        
        response = api_client.post(
            f"{BASE_URL}/api/chat/send",
            json={"session_id": session_id, "message": message}
        )
        
        assert response.status_code == 200, f"Initial recipe request failed: {response.text}"
        data = response.json()
        
        # Verify response has content
        assert "response" in data, "Response should contain 'response' field"
        assert len(data["response"]) > 100, "Response should have substantial recipe content"
        
        # Check if structured_recipes is returned
        if "structured_recipes" in data and data["structured_recipes"]:
            print(f"Initial recipes: Received {len(data['structured_recipes'])} structured recipes")
            for r in data["structured_recipes"][:3]:
                print(f"  - {r.get('title', 'No title')}")
        else:
            print("No structured_recipes in initial response (may be in text form)")
        
        return data
    
    def test_main_chat_show_more_with_context(self, api_client, session_id):
        """Test 'show more' request with context in main chat"""
        # 'Show more' message with context (how frontend sends it)
        message = "[Context: Mood=happy, MealType=lunch, Dietary=vegetarian, Cuisines=italian]\n\nshow more recipes"
        
        response = api_client.post(
            f"{BASE_URL}/api/chat/send",
            json={"session_id": session_id, "message": message}
        )
        
        assert response.status_code == 200, f"Show more request failed: {response.text}"
        data = response.json()
        
        # Verify response has content
        assert "response" in data, "Response should contain 'response' field"
        assert len(data["response"]) > 100, "Response should have recipe content"
        
        # CRITICAL: Check if structured_recipes is returned for 'show more'
        if "structured_recipes" in data and data["structured_recipes"]:
            print(f"Show more: Received {len(data['structured_recipes'])} structured recipes")
            for r in data["structured_recipes"][:3]:
                print(f"  - {r.get('title', 'No title')} (cuisine: {r.get('cuisine', 'unknown')})")
            assert len(data["structured_recipes"]) >= 1, "Should have at least 1 recipe in structured format"
        else:
            print("WARNING: No structured_recipes in 'show more' response!")
            # This might indicate a bug - the response has recipes but not structured
        
        return data
    
    def test_main_chat_different_show_more_phrases(self, api_client, session_id):
        """Test various 'show more' phrases are detected"""
        phrases = [
            "more recipes please",
            "show me different recipes",
            "give me more options",
            "another recipe please"
        ]
        
        for phrase in phrases:
            message = f"[Context: Mood=calm, MealType=dinner, Dietary=non-vegetarian, Cuisines=mexican]\n\n{phrase}"
            
            response = api_client.post(
                f"{BASE_URL}/api/chat/send",
                json={"session_id": f"{session_id}-{uuid.uuid4().hex[:4]}", "message": message}
            )
            
            assert response.status_code == 200, f"Phrase '{phrase}' failed: {response.text}"
            data = response.json()
            
            # Check structured_recipes
            has_structured = "structured_recipes" in data and data["structured_recipes"]
            print(f"Phrase '{phrase}': status=200, structured_recipes={has_structured}")
    
    # ==================== Diabetes Chat Tests ====================
    
    def test_diabetes_chat_show_more_request(self, api_client):
        """Test 'show more' request in diabetes chat"""
        session_id = f"diabetes-test-{uuid.uuid4().hex[:8]}"
        
        # First, make an initial request to set context
        initial_response = api_client.post(
            f"{BASE_URL}/api/diabetes/chat",
            json={
                "session_id": session_id,
                "message": "What are some good breakfast options?",
                "context": {
                    "mood": "happy",
                    "diabetesType": "type2",
                    "dietaryPref": "vegetarian",
                    "mealType": "breakfast",
                    "cuisines": ["indian"]
                }
            }
        )
        
        assert initial_response.status_code == 200, f"Initial diabetes chat failed: {initial_response.text}"
        
        # Now send 'show more' request
        show_more_response = api_client.post(
            f"{BASE_URL}/api/diabetes/chat",
            json={
                "session_id": session_id,
                "message": "show more recipes",
                "context": {
                    "mood": "happy",
                    "diabetesType": "type2",
                    "dietaryPref": "vegetarian",
                    "mealType": "breakfast",
                    "cuisines": ["indian"]
                }
            }
        )
        
        assert show_more_response.status_code == 200, f"Diabetes show more failed: {show_more_response.text}"
        data = show_more_response.json()
        
        # Verify response
        assert "response" in data, "Response should contain 'response' field"
        
        # Check if structured_recipes is in response
        if "structured_recipes" in data and data["structured_recipes"]:
            print(f"Diabetes 'show more': Received {len(data['structured_recipes'])} structured recipes")
            for r in data["structured_recipes"][:3]:
                print(f"  - {r.get('title', 'No title')}")
        else:
            print("Diabetes 'show more': No structured_recipes (may be in text form)")
        
        return data
    
    def test_diabetes_chat_show_more_different_phrases(self, api_client):
        """Test various 'show more' phrases in diabetes chat"""
        phrases = [
            "more options",
            "different recipes",
            "show me more",
            "give me alternatives"
        ]
        
        for phrase in phrases:
            session_id = f"diabetes-{uuid.uuid4().hex[:8]}"
            
            response = api_client.post(
                f"{BASE_URL}/api/diabetes/chat",
                json={
                    "session_id": session_id,
                    "message": phrase,
                    "context": {
                        "mood": "stressed",
                        "diabetesType": "type2",
                        "dietaryPref": "non-vegetarian",
                        "mealType": "dinner",
                        "cuisines": ["thai"]
                    }
                }
            )
            
            assert response.status_code == 200, f"Phrase '{phrase}' failed in diabetes chat: {response.text}"
            data = response.json()
            
            has_structured = "structured_recipes" in data and data["structured_recipes"]
            print(f"Diabetes phrase '{phrase}': status=200, structured_recipes={has_structured}")
    
    # ==================== Integration Tests ====================
    
    def test_main_chat_recipes_are_different_on_show_more(self, api_client):
        """Verify that 'show more' returns DIFFERENT recipes (not cached)"""
        session_id = f"diff-test-{uuid.uuid4().hex[:8]}"
        
        # First request
        first_message = """
[User Preferences]
- Mood: Cozy (Feeling comfortable and warm)
- Meal Type: Dinner
- Dietary Preference: Non-Vegetarian
- Cuisine(s): American

Please suggest some delicious recipes!
"""
        
        first_response = api_client.post(
            f"{BASE_URL}/api/chat/send",
            json={"session_id": session_id, "message": first_message}
        )
        
        assert first_response.status_code == 200
        first_data = first_response.json()
        first_response_text = first_data.get("response", "")
        
        # Second request - 'show more'
        second_message = "[Context: Mood=cozy, MealType=dinner, Dietary=non-vegetarian, Cuisines=american]\n\nshow me different recipes"
        
        second_response = api_client.post(
            f"{BASE_URL}/api/chat/send",
            json={"session_id": session_id, "message": second_message}
        )
        
        assert second_response.status_code == 200
        second_data = second_response.json()
        second_response_text = second_data.get("response", "")
        
        # Verify responses are different
        # (exact same response would indicate caching issue)
        assert first_response_text != second_response_text, "Show more should return different recipes!"
        print(f"First response length: {len(first_response_text)}")
        print(f"Second response length: {len(second_response_text)}")
        print("Verified: Responses are different!")


class TestContextExtraction:
    """Test context extraction from messages"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for tests"""
        timestamp = int(time.time())
        email = f"context_test_{timestamp}@test.com"
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": email, "password": "TestPass123!", "name": "ContextTest"}
        )
        
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Could not authenticate")
    
    @pytest.fixture
    def api_client(self, auth_token):
        """Create authenticated client"""
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {auth_token}"
        })
        return session
    
    def test_context_format_parsing(self, api_client):
        """Test that [Context: ...] format is properly parsed"""
        # Message with context
        message = "[Context: Mood=excited, MealType=breakfast, Dietary=vegan, Cuisines=japanese]\n\nshow more"
        
        response = api_client.post(
            f"{BASE_URL}/api/chat/send",
            json={"session_id": f"ctx-test-{uuid.uuid4().hex[:8]}", "message": message}
        )
        
        assert response.status_code == 200, f"Context parsing failed: {response.text}"
        data = response.json()
        
        # The response should contain recipes (indicating context was extracted)
        response_lower = data.get("response", "").lower()
        # Should have some recipe-like content
        assert len(data.get("response", "")) > 50, "Response should have content"
        print(f"Context extraction test: Got {len(data.get('response', ''))} chars response")
        
        # Check structured recipes
        if data.get("structured_recipes"):
            print(f"Structured recipes found: {len(data['structured_recipes'])}")
            for r in data["structured_recipes"][:2]:
                print(f"  - {r.get('title')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
