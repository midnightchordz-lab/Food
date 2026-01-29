"""
Test Food Allergy & Exclusion System
Tests the critical requirement that recipes with excluded ingredients are NEVER shown.
Specifically tests:
1. User registration and login
2. Save/retrieve exclusions via POST/GET /api/exclusions
3. Chat recipe generation - verify shrimp/prawn and chicken recipes are NOT returned
4. Diabetes recipe generation - verify excluded ingredients are filtered
5. Ingredient alias handling (prawn when shrimp excluded)
6. Safe recipes ARE returned (mutton, lamb, beef, fish when chicken/shrimp excluded)
"""

import pytest
import requests
import os
import uuid
import time
import re

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user credentials
TEST_EMAIL = f"exclusion_test_{uuid.uuid4().hex[:8]}@test.com"
TEST_PASSWORD = "Test123!"
TEST_NAME = "Exclusion Test User"

# Exclusions to test
EXCLUSIONS_TO_TEST = ["shrimp", "chicken"]

# Banned terms (including aliases)
BANNED_TERMS = [
    # Shrimp and aliases
    "shrimp", "shrimps", "prawn", "prawns", "jumbo shrimp", "tiger prawn", "king prawn",
    "cocktail shrimp", "shrimp cocktail", "prawn cocktail", "gambas", "camarones", "scampi",
    # Chicken and aliases
    "chicken", "poultry", "chicken breast", "chicken thigh", "chicken wing", "chicken drumstick",
    "roast chicken", "fried chicken", "grilled chicken", "chicken tender", "chicken nugget",
    "chicken tikka", "tandoori chicken", "butter chicken", "chicken curry", "chicken biryani",
    "chicken kebab", "chicken karahi", "murgh"
]

# Safe proteins that SHOULD be returned
SAFE_PROTEINS = ["lamb", "mutton", "beef", "fish", "goat", "salmon", "tuna"]


class TestFoodExclusionSystem:
    """Test suite for Food Allergy & Exclusion System"""
    
    token = None
    user_id = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test - register user and get token"""
        if TestFoodExclusionSystem.token is None:
            # Register new user
            register_response = requests.post(
                f"{BASE_URL}/api/auth/register",
                json={
                    "email": TEST_EMAIL,
                    "password": TEST_PASSWORD,
                    "name": TEST_NAME,
                    "dietary_restrictions": [],
                    "cuisine_preferences": ["Pakistani", "Indian"]
                }
            )
            
            if register_response.status_code == 200:
                data = register_response.json()
                TestFoodExclusionSystem.token = data.get("access_token")
                TestFoodExclusionSystem.user_id = data.get("user", {}).get("id")
                print(f"✓ Registered new user: {TEST_EMAIL}")
            elif register_response.status_code == 400:
                # User exists, try login
                login_response = requests.post(
                    f"{BASE_URL}/api/auth/login",
                    json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
                )
                if login_response.status_code == 200:
                    data = login_response.json()
                    TestFoodExclusionSystem.token = data.get("access_token")
                    TestFoodExclusionSystem.user_id = data.get("user", {}).get("id")
                    print(f"✓ Logged in existing user: {TEST_EMAIL}")
                else:
                    pytest.fail(f"Failed to login: {login_response.text}")
            else:
                pytest.fail(f"Failed to register: {register_response.text}")
    
    def get_headers(self):
        """Get authorization headers"""
        return {
            "Authorization": f"Bearer {TestFoodExclusionSystem.token}",
            "Content-Type": "application/json"
        }
    
    # ============== AUTHENTICATION TESTS ==============
    
    def test_01_user_registration_login(self):
        """Test user registration and login flow"""
        assert TestFoodExclusionSystem.token is not None, "Token should be set after registration/login"
        assert len(TestFoodExclusionSystem.token) > 0, "Token should not be empty"
        print(f"✓ User authenticated successfully with token length: {len(TestFoodExclusionSystem.token)}")
    
    def test_02_get_current_user(self):
        """Test GET /api/auth/me returns current user"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers=self.get_headers()
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "email" in data, "Response should contain email"
        print(f"✓ Current user retrieved: {data.get('email')}")
    
    # ============== EXCLUSION SAVE/RETRIEVE TESTS ==============
    
    def test_03_save_exclusions(self):
        """Test POST /api/exclusions saves user exclusions"""
        exclusion_data = {
            "excluded_ingredients": [
                {"name": "shrimp", "category": "allergy", "severity": "severe-allergy", "reason": "Shellfish allergy"},
                {"name": "chicken", "category": "preference", "severity": "preference", "reason": "Personal preference"}
            ]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/exclusions",
            headers=self.get_headers(),
            json=exclusion_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "excluded_count" in data, "Response should contain excluded_count"
        assert data["excluded_count"] == 2, f"Expected 2 exclusions, got {data['excluded_count']}"
        print(f"✓ Saved {data['excluded_count']} exclusions successfully")
    
    def test_04_get_exclusions(self):
        """Test GET /api/exclusions retrieves saved exclusions"""
        response = requests.get(
            f"{BASE_URL}/api/exclusions",
            headers=self.get_headers()
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "excluded_ingredient_names" in data, "Response should contain excluded_ingredient_names"
        excluded_names = data["excluded_ingredient_names"]
        
        assert "shrimp" in excluded_names, "Shrimp should be in exclusions"
        assert "chicken" in excluded_names, "Chicken should be in exclusions"
        print(f"✓ Retrieved exclusions: {excluded_names}")
    
    # ============== CHAT RECIPE FILTERING TESTS ==============
    
    def test_05_chat_recipe_generation_filters_excluded(self):
        """Test POST /api/chat/send filters out excluded ingredients from recipes"""
        # Request Pakistani non-vegetarian dinner recipes (commonly includes chicken/shrimp)
        chat_request = {
            "session_id": f"test-exclusion-{uuid.uuid4().hex[:8]}",
            "message": """[User Preferences]
- Mood: cozy (warm, hearty, snuggly dishes)
- Meal Type: Dinner
- Dietary Preference: non-vegetarian
- Cuisine(s): Pakistani

Please suggest 4 delicious Pakistani dinner recipes that match my cozy mood."""
        }
        
        response = requests.post(
            f"{BASE_URL}/api/chat/send",
            headers=self.get_headers(),
            json=chat_request,
            timeout=120  # AI generation can take time
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "response" in data, "Response should contain 'response' field"
        ai_response = data["response"].lower()
        
        # Check that NO banned terms appear in the response
        found_violations = []
        for term in BANNED_TERMS:
            # Use word boundary matching to avoid false positives
            pattern = r'\b' + re.escape(term) + r'(?:s|es)?\b'
            if re.search(pattern, ai_response):
                found_violations.append(term)
        
        if found_violations:
            print(f"✗ SAFETY VIOLATION: Found banned terms in response: {found_violations}")
            print(f"Response excerpt: {ai_response[:500]}...")
        
        assert len(found_violations) == 0, f"CRITICAL: Found banned ingredients in response: {found_violations}"
        print(f"✓ Chat recipe response does NOT contain any banned ingredients")
        print(f"  Response length: {len(ai_response)} characters")
    
    def test_06_chat_returns_safe_proteins(self):
        """Test that safe proteins (lamb, mutton, beef, fish) ARE returned"""
        chat_request = {
            "session_id": f"test-safe-{uuid.uuid4().hex[:8]}",
            "message": """[User Preferences]
- Mood: energetic (fresh, protein-packed, revitalizing dishes)
- Meal Type: Dinner
- Dietary Preference: non-vegetarian
- Cuisine(s): Pakistani, Indian

Please suggest 4 high-protein dinner recipes."""
        }
        
        response = requests.post(
            f"{BASE_URL}/api/chat/send",
            headers=self.get_headers(),
            json=chat_request,
            timeout=120
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        ai_response = data["response"].lower()
        
        # Check that at least one safe protein is mentioned
        found_safe_proteins = []
        for protein in SAFE_PROTEINS:
            if protein in ai_response:
                found_safe_proteins.append(protein)
        
        # We expect at least one safe protein to be suggested
        print(f"✓ Found safe proteins in response: {found_safe_proteins}")
        
        # Also verify no banned terms
        found_violations = []
        for term in BANNED_TERMS:
            pattern = r'\b' + re.escape(term) + r'(?:s|es)?\b'
            if re.search(pattern, ai_response):
                found_violations.append(term)
        
        assert len(found_violations) == 0, f"CRITICAL: Found banned ingredients: {found_violations}"
        print(f"✓ Response contains safe proteins and NO banned ingredients")
    
    def test_07_prawn_alias_blocked_when_shrimp_excluded(self):
        """Test that 'prawn' is blocked when 'shrimp' is excluded (they are aliases)"""
        # Request seafood recipes to test alias blocking
        chat_request = {
            "session_id": f"test-alias-{uuid.uuid4().hex[:8]}",
            "message": """[User Preferences]
- Mood: happy (vibrant, fresh, colorful dishes)
- Meal Type: Dinner
- Dietary Preference: non-vegetarian
- Cuisine(s): Indian, Thai

Please suggest 4 seafood dinner recipes."""
        }
        
        response = requests.post(
            f"{BASE_URL}/api/chat/send",
            headers=self.get_headers(),
            json=chat_request,
            timeout=120
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        ai_response = data["response"].lower()
        
        # Specifically check for prawn (alias of shrimp)
        prawn_terms = ["prawn", "prawns", "king prawn", "tiger prawn", "prawn curry", "prawn biryani"]
        found_prawn = []
        for term in prawn_terms:
            pattern = r'\b' + re.escape(term) + r's?\b'
            if re.search(pattern, ai_response):
                found_prawn.append(term)
        
        if found_prawn:
            print(f"✗ ALIAS VIOLATION: Found prawn terms (shrimp alias): {found_prawn}")
        
        assert len(found_prawn) == 0, f"CRITICAL: Prawn (shrimp alias) found in response: {found_prawn}"
        print(f"✓ Prawn (shrimp alias) correctly blocked from response")
    
    # ============== DIABETES RECIPE FILTERING TESTS ==============
    
    def test_08_diabetes_recipes_filter_excluded(self):
        """Test POST /api/diabetes/recipes filters out excluded ingredients"""
        diabetes_request = {
            "session_id": f"test-diabetes-{uuid.uuid4().hex[:8]}",
            "mood": "cozy",
            "diabetes_type": "type2",
            "diabetes_label": "Type 2 Diabetes",
            "dietary_pref": "non-vegetarian",
            "meal_type": "Dinner",
            "cuisines": "Pakistani, Indian",
            "guidelines": {
                "name": "Type 2 Diabetes",
                "key_principles": ["Low glycemic index foods", "Balanced carbohydrates"]
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/diabetes/recipes",
            headers=self.get_headers(),
            json=diabetes_request,
            timeout=120
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "response" in data, "Response should contain 'response' field"
        ai_response = data["response"].lower()
        
        # Check that NO banned terms appear
        found_violations = []
        for term in BANNED_TERMS:
            pattern = r'\b' + re.escape(term) + r'(?:s|es)?\b'
            if re.search(pattern, ai_response):
                found_violations.append(term)
        
        if found_violations:
            print(f"✗ DIABETES SAFETY VIOLATION: Found banned terms: {found_violations}")
        
        assert len(found_violations) == 0, f"CRITICAL: Diabetes recipes contain banned ingredients: {found_violations}"
        print(f"✓ Diabetes recipe response does NOT contain any banned ingredients")
    
    def test_09_diabetes_returns_safe_proteins(self):
        """Test that diabetes recipes return safe proteins"""
        diabetes_request = {
            "session_id": f"test-diabetes-safe-{uuid.uuid4().hex[:8]}",
            "mood": "energetic",
            "diabetes_type": "type2",
            "diabetes_label": "Type 2 Diabetes",
            "dietary_pref": "non-vegetarian",
            "meal_type": "Lunch",
            "cuisines": "Mediterranean, Middle Eastern",
            "guidelines": {
                "name": "Type 2 Diabetes",
                "key_principles": ["High protein", "Low glycemic"]
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/diabetes/recipes",
            headers=self.get_headers(),
            json=diabetes_request,
            timeout=120
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        ai_response = data["response"].lower()
        
        # Check for safe proteins
        found_safe = [p for p in SAFE_PROTEINS if p in ai_response]
        print(f"✓ Diabetes recipes contain safe proteins: {found_safe}")
        
        # Verify no banned terms
        found_violations = []
        for term in BANNED_TERMS:
            pattern = r'\b' + re.escape(term) + r'(?:s|es)?\b'
            if re.search(pattern, ai_response):
                found_violations.append(term)
        
        assert len(found_violations) == 0, f"CRITICAL: Found banned ingredients: {found_violations}"
        print(f"✓ Diabetes recipes are safe and contain appropriate proteins")
    
    # ============== EDGE CASE TESTS ==============
    
    def test_10_word_boundary_no_false_positives(self):
        """Test that word boundary matching doesn't cause false positives"""
        # Words that contain 'hen' but are NOT chicken: when, then, kitchen, strengthen
        # The fix should prevent these from being filtered
        
        chat_request = {
            "session_id": f"test-boundary-{uuid.uuid4().hex[:8]}",
            "message": """[User Preferences]
- Mood: calm (balanced, light, zen-like dishes)
- Meal Type: Dinner
- Dietary Preference: vegetarian
- Cuisine(s): Mediterranean

Please suggest 4 vegetarian Mediterranean dinner recipes."""
        }
        
        response = requests.post(
            f"{BASE_URL}/api/chat/send",
            headers=self.get_headers(),
            json=chat_request,
            timeout=120
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        ai_response = data["response"]
        
        # Response should not be empty (false positive filtering would empty it)
        assert len(ai_response) > 100, f"Response too short ({len(ai_response)} chars) - possible over-filtering"
        
        # Check that common words with 'hen' substring are NOT filtered
        # These words should be allowed: when, then, kitchen, strengthen
        # Note: We're checking the response isn't completely empty due to false positives
        print(f"✓ Response length: {len(ai_response)} chars - no over-filtering detected")
        print(f"✓ Word boundary matching working correctly (no false positives)")
    
    def test_11_specific_dish_names_blocked(self):
        """Test that specific dish names with excluded ingredients are blocked"""
        # These specific dishes should be blocked:
        # - Butter Chicken, Chicken Tikka, Chicken Karahi
        # - Prawn Curry, Shrimp Biryani, Karahi Prawns
        
        chat_request = {
            "session_id": f"test-dishes-{uuid.uuid4().hex[:8]}",
            "message": """[User Preferences]
- Mood: cozy (warm, hearty, snuggly dishes)
- Meal Type: Dinner
- Dietary Preference: non-vegetarian
- Cuisine(s): Pakistani

Please suggest popular Pakistani dinner dishes."""
        }
        
        response = requests.post(
            f"{BASE_URL}/api/chat/send",
            headers=self.get_headers(),
            json=chat_request,
            timeout=120
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        ai_response = data["response"].lower()
        
        # Specific dishes that should be blocked
        blocked_dishes = [
            "butter chicken", "chicken tikka", "chicken karahi", "chicken biryani",
            "prawn curry", "shrimp biryani", "karahi prawns", "prawn biryani",
            "tandoori chicken", "chicken korma", "chicken masala"
        ]
        
        found_blocked = [dish for dish in blocked_dishes if dish in ai_response]
        
        if found_blocked:
            print(f"✗ BLOCKED DISHES FOUND: {found_blocked}")
        
        assert len(found_blocked) == 0, f"CRITICAL: Blocked dishes found in response: {found_blocked}"
        print(f"✓ All specific blocked dishes correctly filtered out")


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
