"""
Regression Test Suite for MoodFood API Refactoring
Tests all modular routers after server.py was split into 8 separate router files:
- auth.py, exclusions.py, chat.py, recipes.py, meal_planning.py, diabetes.py, import_recipe.py, voice.py
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

# Base URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = f"refactor_test_{uuid.uuid4().hex[:8]}@test.com"
TEST_PASSWORD = "TestPass123"
TEST_NAME = "Refactor Test User"

# Shared state for tests
class TestState:
    token = None
    user_id = None
    session_id = str(uuid.uuid4())


class TestHealthCheck:
    """Test public health endpoint"""
    
    def test_health_check_returns_200(self):
        """Health check should return 200 with version 2.0.0"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["version"] == "2.0.0"
        print(f"✓ Health check passed: {data}")


class TestVoiceLanguages:
    """Test public voice languages endpoint"""
    
    def test_voice_languages_returns_200(self):
        """Voice languages endpoint should return supported languages"""
        response = requests.get(f"{BASE_URL}/api/voice/languages")
        assert response.status_code == 200
        data = response.json()
        assert "languages" in data
        assert isinstance(data["languages"], dict)
        print(f"✓ Voice languages returned: {len(data['languages'])} languages")


class TestAuthRoutes:
    """Test authentication routes from auth.py"""
    
    def test_register_new_user(self):
        """POST /api/auth/register should create user and return token"""
        payload = {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "name": TEST_NAME,
            "dietary_restrictions": ["vegetarian"],
            "cuisine_preferences": ["Italian", "Indian"]
        }
        response = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        assert response.status_code == 200, f"Registration failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL
        assert data["user"]["name"] == TEST_NAME
        
        # Store token for subsequent tests
        TestState.token = data["access_token"]
        TestState.user_id = data["user"]["id"]
        print(f"✓ User registered: {TEST_EMAIL}, token obtained")
    
    def test_register_duplicate_email_fails(self):
        """POST /api/auth/register with existing email should return 400"""
        payload = {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "name": "Duplicate User"
        }
        response = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        assert response.status_code == 400
        assert "already registered" in response.json().get("detail", "").lower()
        print("✓ Duplicate email registration correctly rejected")
    
    def test_login_valid_credentials(self):
        """POST /api/auth/login with valid credentials should return token"""
        payload = {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        }
        response = requests.post(f"{BASE_URL}/api/auth/login", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL
        
        # Update token
        TestState.token = data["access_token"]
        print(f"✓ Login successful for {TEST_EMAIL}")
    
    def test_login_invalid_credentials(self):
        """POST /api/auth/login with wrong password should return 401"""
        payload = {
            "email": TEST_EMAIL,
            "password": "WrongPassword123"
        }
        response = requests.post(f"{BASE_URL}/api/auth/login", json=payload)
        assert response.status_code == 401
        print("✓ Invalid credentials correctly rejected")
    
    def test_get_current_user(self):
        """GET /api/auth/me should return current user info"""
        headers = {"Authorization": f"Bearer {TestState.token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["email"] == TEST_EMAIL
        assert data["name"] == TEST_NAME
        print(f"✓ GET /api/auth/me returned user: {data['email']}")
    
    def test_get_me_without_token_fails(self):
        """GET /api/auth/me without token should return 403"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 403
        print("✓ Unauthenticated /api/auth/me correctly rejected")


class TestPhoneOTPRoutes:
    """Test phone OTP routes from auth.py"""
    
    def test_send_otp_valid_phone(self):
        """POST /api/auth/phone/send-otp should send OTP"""
        payload = {"phone_number": "+15551234567"}
        response = requests.post(f"{BASE_URL}/api/auth/phone/send-otp", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "pending"
        # In demo mode, OTP is returned
        if "demo_otp" in data:
            print(f"✓ OTP sent (demo mode): {data['demo_otp']}")
        else:
            print(f"✓ OTP sent via SMS")
    
    def test_send_otp_invalid_phone_format(self):
        """POST /api/auth/phone/send-otp with invalid format should return 400"""
        payload = {"phone_number": "1234567"}  # Missing + prefix
        response = requests.post(f"{BASE_URL}/api/auth/phone/send-otp", json=payload)
        assert response.status_code == 400
        assert "E.164" in response.json().get("detail", "")
        print("✓ Invalid phone format correctly rejected")
    
    def test_verify_otp_no_otp_sent(self):
        """POST /api/auth/phone/verify-otp without sending OTP first should fail"""
        payload = {
            "phone_number": "+15559999999",
            "code": "123456"
        }
        response = requests.post(f"{BASE_URL}/api/auth/phone/verify-otp", json=payload)
        assert response.status_code == 400
        assert "No OTP found" in response.json().get("detail", "")
        print("✓ Verify OTP without sending correctly rejected")


class TestExclusionsRoutes:
    """Test food exclusions routes from exclusions.py"""
    
    def test_get_exclusions_empty(self):
        """GET /api/exclusions should return empty exclusions for new user"""
        headers = {"Authorization": f"Bearer {TestState.token}"}
        response = requests.get(f"{BASE_URL}/api/exclusions", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "excluded_ingredients" in data
        assert "common_allergens" in data
        print(f"✓ GET /api/exclusions returned: {len(data.get('excluded_ingredients', []))} exclusions")
    
    def test_create_exclusions(self):
        """POST /api/exclusions should save user exclusions"""
        headers = {"Authorization": f"Bearer {TestState.token}"}
        payload = {
            "excluded_ingredients": [
                {"name": "peanuts", "category": "allergy", "severity": "severe"},
                {"name": "shellfish", "category": "allergy", "severity": "moderate"}
            ]
        }
        response = requests.post(f"{BASE_URL}/api/exclusions", json=payload, headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "exclusions" in data
        assert len(data["exclusions"]["excluded_ingredient_names"]) == 2
        print(f"✓ Exclusions created: {data['exclusions']['excluded_ingredient_names']}")
    
    def test_get_exclusions_after_create(self):
        """GET /api/exclusions should return saved exclusions"""
        headers = {"Authorization": f"Bearer {TestState.token}"}
        response = requests.get(f"{BASE_URL}/api/exclusions", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "peanuts" in data["excluded_ingredient_names"]
        assert "shellfish" in data["excluded_ingredient_names"]
        print(f"✓ Exclusions retrieved: {data['excluded_ingredient_names']}")
    
    def test_update_exclusions_add(self):
        """PUT /api/exclusions should add new exclusions"""
        headers = {"Authorization": f"Bearer {TestState.token}"}
        payload = {
            "add_ingredients": [
                {"name": "dairy", "category": "intolerance", "severity": "moderate"}
            ]
        }
        response = requests.put(f"{BASE_URL}/api/exclusions", json=payload, headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "dairy" in data["exclusions"]["excluded_ingredient_names"]
        print(f"✓ Exclusion added: dairy")
    
    def test_delete_exclusion(self):
        """DELETE /api/exclusions/{ingredient} should remove exclusion"""
        headers = {"Authorization": f"Bearer {TestState.token}"}
        response = requests.delete(f"{BASE_URL}/api/exclusions/dairy", headers=headers)
        assert response.status_code == 200
        print("✓ Exclusion deleted: dairy")
    
    def test_exclusions_without_auth_fails(self):
        """GET /api/exclusions without auth should return 403"""
        response = requests.get(f"{BASE_URL}/api/exclusions")
        assert response.status_code == 403
        print("✓ Unauthenticated exclusions access correctly rejected")


class TestChatRoutes:
    """Test chat routes from chat.py"""
    
    def test_send_chat_message(self):
        """POST /api/chat/send should return AI response"""
        headers = {"Authorization": f"Bearer {TestState.token}"}
        payload = {
            "session_id": TestState.session_id,
            "message": "Hello, I'm feeling happy today. What should I eat?"
        }
        response = requests.post(f"{BASE_URL}/api/chat/send", json=payload, headers=headers, timeout=60)
        assert response.status_code == 200
        
        data = response.json()
        assert "response" in data
        assert "session_id" in data
        assert data["session_id"] == TestState.session_id
        print(f"✓ Chat response received: {len(data['response'])} chars")
    
    def test_get_chat_history(self):
        """GET /api/chat/history/{session_id} should return chat history"""
        headers = {"Authorization": f"Bearer {TestState.token}"}
        response = requests.get(f"{BASE_URL}/api/chat/history/{TestState.session_id}", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "messages" in data
        assert len(data["messages"]) >= 2  # At least user + assistant message
        print(f"✓ Chat history retrieved: {len(data['messages'])} messages")
    
    def test_chat_without_auth_fails(self):
        """POST /api/chat/send without auth should return 403"""
        payload = {
            "session_id": "test",
            "message": "Hello"
        }
        response = requests.post(f"{BASE_URL}/api/chat/send", json=payload)
        assert response.status_code == 403
        print("✓ Unauthenticated chat correctly rejected")


class TestRecipesRoutes:
    """Test recipe routes from recipes.py"""
    
    def test_save_recipe(self):
        """POST /api/recipes/save should save a recipe"""
        headers = {"Authorization": f"Bearer {TestState.token}"}
        payload = {
            "title": "Test Pasta Recipe",
            "content": "## Test Pasta\n\n**Ingredients:**\n- Pasta\n- Tomato sauce\n\n**Instructions:**\n1. Boil pasta\n2. Add sauce",
            "cuisine": "Italian",
            "meal_type": "Dinner",
            "cooking_time": "30 minutes"
        }
        response = requests.post(f"{BASE_URL}/api/recipes/save", json=payload, headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "recipe" in data or "id" in data
        print(f"✓ Recipe saved: {payload['title']}")
    
    def test_get_saved_recipes(self):
        """GET /api/recipes/saved should return saved recipes"""
        headers = {"Authorization": f"Bearer {TestState.token}"}
        response = requests.get(f"{BASE_URL}/api/recipes/saved", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "recipes" in data
        assert len(data["recipes"]) >= 1
        print(f"✓ Saved recipes retrieved: {len(data['recipes'])} recipes")
    
    def test_recipes_without_auth_fails(self):
        """GET /api/recipes/saved without auth should return 403"""
        response = requests.get(f"{BASE_URL}/api/recipes/saved")
        assert response.status_code == 403
        print("✓ Unauthenticated recipes access correctly rejected")


class TestShoppingListRoutes:
    """Test shopping list routes from meal_planning.py"""
    
    def test_get_shopping_list(self):
        """GET /api/shopping-list should return shopping list"""
        headers = {"Authorization": f"Bearer {TestState.token}"}
        response = requests.get(f"{BASE_URL}/api/shopping-list", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        # Should return list or empty structure
        print(f"✓ Shopping list retrieved")
    
    def test_add_shopping_item(self):
        """POST /api/shopping-list/items should add item"""
        headers = {"Authorization": f"Bearer {TestState.token}"}
        payload = {
            "name": "Tomatoes",
            "quantity": "2 lbs",
            "category": "Produce"
        }
        response = requests.post(f"{BASE_URL}/api/shopping-list/items", json=payload, headers=headers)
        # Accept 200 or 201
        assert response.status_code in [200, 201]
        print(f"✓ Shopping item added: {payload['name']}")
    
    def test_shopping_list_without_auth_fails(self):
        """GET /api/shopping-list without auth should return 403"""
        response = requests.get(f"{BASE_URL}/api/shopping-list")
        assert response.status_code == 403
        print("✓ Unauthenticated shopping list access correctly rejected")


class TestWeeklyPlanRoutes:
    """Test weekly plan routes from meal_planning.py"""
    
    def test_get_weekly_plan(self):
        """GET /api/weekly-plan should return weekly plan"""
        headers = {"Authorization": f"Bearer {TestState.token}"}
        response = requests.get(f"{BASE_URL}/api/weekly-plan", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        # Should return plan or empty structure
        print(f"✓ Weekly plan retrieved")
    
    def test_weekly_plan_without_auth_fails(self):
        """GET /api/weekly-plan without auth should return 403"""
        response = requests.get(f"{BASE_URL}/api/weekly-plan")
        assert response.status_code == 403
        print("✓ Unauthenticated weekly plan access correctly rejected")


class TestMealPreferencesRoutes:
    """Test meal preferences routes from meal_planning.py"""
    
    def test_save_meal_preferences(self):
        """POST /api/meal-preferences should save preferences"""
        headers = {"Authorization": f"Bearer {TestState.token}"}
        payload = {
            "mood": "happy",
            "dietary_preference": "vegetarian",
            "calorie_target": 2000,
            "cuisine_preferences": ["Italian", "Indian"],
            "focus_areas": ["protein"],
            "is_active": False  # Don't generate plan
        }
        response = requests.post(f"{BASE_URL}/api/meal-preferences", json=payload, headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "preferences" in data or "message" in data
        print(f"✓ Meal preferences saved")
    
    def test_get_meal_preferences(self):
        """GET /api/meal-preferences should return preferences"""
        headers = {"Authorization": f"Bearer {TestState.token}"}
        response = requests.get(f"{BASE_URL}/api/meal-preferences", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "preferences" in data
        print(f"✓ Meal preferences retrieved")
    
    def test_meal_preferences_without_auth_fails(self):
        """GET /api/meal-preferences without auth should return 403"""
        response = requests.get(f"{BASE_URL}/api/meal-preferences")
        assert response.status_code == 403
        print("✓ Unauthenticated meal preferences access correctly rejected")


class TestDiabetesRoutes:
    """Test diabetes routes from diabetes.py"""
    
    def test_diabetes_research(self):
        """POST /api/diabetes/research should return guidelines"""
        headers = {"Authorization": f"Bearer {TestState.token}"}
        payload = {
            "diabetes_type": "type2",
            "session_id": TestState.session_id
        }
        response = requests.post(f"{BASE_URL}/api/diabetes/research", json=payload, headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "summary" in data
        assert "guidelines" in data
        assert "maxCarbsPerMeal" in data["guidelines"]
        print(f"✓ Diabetes research returned guidelines for type2")
    
    def test_diabetes_research_type1(self):
        """POST /api/diabetes/research for type1 should return correct guidelines"""
        headers = {"Authorization": f"Bearer {TestState.token}"}
        payload = {
            "diabetes_type": "type1",
            "session_id": TestState.session_id
        }
        response = requests.post(f"{BASE_URL}/api/diabetes/research", json=payload, headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "Type 1" in data["summary"]
        print(f"✓ Diabetes research returned guidelines for type1")
    
    def test_diabetes_without_auth_fails(self):
        """POST /api/diabetes/research without auth should return 403"""
        payload = {
            "diabetes_type": "type2",
            "session_id": "test"
        }
        response = requests.post(f"{BASE_URL}/api/diabetes/research", json=payload)
        assert response.status_code == 403
        print("✓ Unauthenticated diabetes access correctly rejected")


class TestVoiceRoutes:
    """Test voice routes from voice.py"""
    
    def test_voice_languages_public(self):
        """GET /api/voice/languages should be public"""
        response = requests.get(f"{BASE_URL}/api/voice/languages")
        assert response.status_code == 200
        
        data = response.json()
        assert "languages" in data
        assert "en" in data["languages"]
        print(f"✓ Voice languages (public): {list(data['languages'].keys())[:5]}...")
    
    def test_voice_mood_info(self):
        """GET /api/voice/mood-info should return mood voice config"""
        headers = {"Authorization": f"Bearer {TestState.token}"}
        response = requests.get(f"{BASE_URL}/api/voice/mood-info", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "moods" in data
        print(f"✓ Voice mood info returned: {list(data['moods'].keys())[:5]}...")


class TestAuthorizationConsistency:
    """Test that all protected endpoints consistently require auth"""
    
    @pytest.mark.parametrize("endpoint,method", [
        ("/api/auth/me", "GET"),
        ("/api/exclusions", "GET"),
        ("/api/chat/send", "POST"),
        ("/api/recipes/saved", "GET"),
        ("/api/shopping-list", "GET"),
        ("/api/weekly-plan", "GET"),
        ("/api/meal-preferences", "GET"),
        ("/api/diabetes/research", "POST"),
        ("/api/voice/mood-info", "GET"),
    ])
    def test_protected_endpoint_requires_auth(self, endpoint, method):
        """All protected endpoints should return 403 without auth"""
        if method == "GET":
            response = requests.get(f"{BASE_URL}{endpoint}")
        else:
            response = requests.post(f"{BASE_URL}{endpoint}", json={})
        
        assert response.status_code == 403, f"{method} {endpoint} should require auth, got {response.status_code}"
        print(f"✓ {method} {endpoint} correctly requires auth")


# Run tests in order
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
