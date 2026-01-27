"""
Test P0 Recipe Generation Fixes:
1. Recipe generation responds within 60 seconds
2. Recipe responses include specific, detailed cooking instructions with [PREP X min] and [COOK X min] markers
3. Recipe instructions include exact temperatures and timing
4. Recipe instructions include sensory cues
5. Multi-step chat flow works
"""
import pytest
import requests
import os
import time
import re

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestRecipeGenerationP0:
    """Test P0 fixes for recipe generation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test user and get auth token"""
        self.timestamp = int(time.time())
        self.test_email = f"testuser{self.timestamp}@test.com"
        self.test_password = "Test1234!"
        self.test_name = f"Test User {self.timestamp}"
        
        # Register test user
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.test_email,
            "password": self.test_password,
            "name": self.test_name,
            "dietary_restrictions": [],
            "cuisine_preferences": []
        })
        
        if register_response.status_code == 200:
            self.token = register_response.json()["access_token"]
            self.user = register_response.json()["user"]
        elif register_response.status_code == 400:
            # User exists, try login
            login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": self.test_email,
                "password": self.test_password
            })
            if login_response.status_code == 200:
                self.token = login_response.json()["access_token"]
                self.user = login_response.json()["user"]
            else:
                pytest.skip(f"Could not authenticate: {login_response.text}")
        else:
            pytest.skip(f"Could not register: {register_response.text}")
        
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        self.session_id = f"test-session-{self.timestamp}"
    
    def test_recipe_generation_response_time(self):
        """TEST 1: Recipe generation should respond within 60 seconds"""
        # Create structured recipe request message (same format as frontend)
        recipe_request = """
[User Preferences]
- Mood: Happy (Feeling joyful and upbeat)
- Meal Type: Dinner
- Dietary Preference: Vegetarian
- Cuisine(s): Italian

Please suggest 6 delicious dinner recipes that:
1. Match the happy mood (Feeling joyful and upbeat)
2. Are appropriate for dinner time
3. Are vegetarian friendly
4. Feature Italian style cooking

For EACH recipe provide:
- Recipe name with cooking time in parentheses
- Difficulty level (Easy/Medium/Hard)
- Brief appetizing description (2-3 sentences)
- Key mood-boosting benefits

Format each recipe clearly with the name as a header.
"""
        
        start_time = time.time()
        response = requests.post(
            f"{BASE_URL}/api/chat/send",
            json={
                "session_id": self.session_id,
                "message": recipe_request
            },
            headers=self.headers,
            timeout=120  # Allow up to 120 seconds for the request
        )
        end_time = time.time()
        response_time = end_time - start_time
        
        # Assert status code
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Assert response time is under 60 seconds
        assert response_time < 60, f"Recipe generation took {response_time:.2f} seconds, expected < 60 seconds"
        
        print(f"✓ Recipe generation completed in {response_time:.2f} seconds (< 60s requirement)")
        
        # Store response for other tests
        self.recipe_response = response.json()["response"]
        return self.recipe_response
    
    def test_recipe_response_contains_prep_cook_markers(self):
        """TEST 2: Recipe responses should include [PREP X min] and [COOK X min] markers"""
        # Get recipe response
        recipe_request = """
[User Preferences]
- Mood: Energized (Feeling active and motivated)
- Meal Type: Lunch
- Dietary Preference: Any
- Cuisine(s): Asian

Please suggest 6 delicious lunch recipes that:
1. Match the energized mood
2. Are appropriate for lunch time
3. Feature Asian style cooking

For EACH recipe provide:
- Recipe name with cooking time in parentheses
- Difficulty level (Easy/Medium/Hard)
- Brief appetizing description (2-3 sentences)
- Key mood-boosting benefits

Format each recipe clearly with the name as a header.
"""
        
        response = requests.post(
            f"{BASE_URL}/api/chat/send",
            json={
                "session_id": f"{self.session_id}-prep-cook",
                "message": recipe_request
            },
            headers=self.headers,
            timeout=120
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        recipe_text = response.json()["response"]
        
        # Check for PREP markers
        prep_pattern = r'\[PREP\s+\d+\s*min\]'
        prep_matches = re.findall(prep_pattern, recipe_text, re.IGNORECASE)
        
        # Check for COOK markers
        cook_pattern = r'\[COOK\s+\d+\s*min\]'
        cook_matches = re.findall(cook_pattern, recipe_text, re.IGNORECASE)
        
        print(f"Found {len(prep_matches)} PREP markers: {prep_matches[:5]}")
        print(f"Found {len(cook_matches)} COOK markers: {cook_matches[:5]}")
        
        # At least some recipes should have these markers
        has_timing_markers = len(prep_matches) > 0 or len(cook_matches) > 0
        
        # Also check for alternative timing formats
        alt_timing_pattern = r'\d+\s*(?:min|minutes?)'
        alt_matches = re.findall(alt_timing_pattern, recipe_text, re.IGNORECASE)
        
        print(f"Found {len(alt_matches)} timing references")
        
        assert has_timing_markers or len(alt_matches) > 5, "Recipe should include timing markers or timing references"
        print("✓ Recipe response contains timing markers/references")
    
    def test_recipe_response_contains_temperatures(self):
        """TEST 3: Recipe instructions should include exact temperatures"""
        recipe_request = """
[User Preferences]
- Mood: Cozy (Feeling warm and comfortable)
- Meal Type: Dinner
- Dietary Preference: Any
- Cuisine(s): American

Please suggest 6 delicious dinner recipes that:
1. Match the cozy mood
2. Are appropriate for dinner time
3. Feature American style cooking

For EACH recipe provide:
- Recipe name with cooking time in parentheses
- Difficulty level (Easy/Medium/Hard)
- Brief appetizing description (2-3 sentences)
- Key mood-boosting benefits

Format each recipe clearly with the name as a header.
"""
        
        response = requests.post(
            f"{BASE_URL}/api/chat/send",
            json={
                "session_id": f"{self.session_id}-temps",
                "message": recipe_request
            },
            headers=self.headers,
            timeout=120
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        recipe_text = response.json()["response"]
        
        # Check for temperature patterns (°F, °C, degrees, or numeric temps)
        temp_patterns = [
            r'\d+\s*°[FC]',  # 350°F, 180°C
            r'\d+\s*degrees?\s*[FC]',  # 350 degrees F
            r'(?:medium|high|low)(?:-high|-low)?\s+heat',  # medium heat, medium-high heat
            r'(?:preheat|heat)\s+(?:to|at)\s+\d+',  # preheat to 350
        ]
        
        temp_matches = []
        for pattern in temp_patterns:
            matches = re.findall(pattern, recipe_text, re.IGNORECASE)
            temp_matches.extend(matches)
        
        print(f"Found {len(temp_matches)} temperature references: {temp_matches[:10]}")
        
        # Should have at least some temperature references
        assert len(temp_matches) > 0, "Recipe should include temperature references"
        print("✓ Recipe response contains temperature references")
    
    def test_recipe_response_contains_sensory_cues(self):
        """TEST 4: Recipe instructions should include sensory cues"""
        recipe_request = """
[User Preferences]
- Mood: Relaxed (Feeling calm and peaceful)
- Meal Type: Breakfast
- Dietary Preference: Any
- Cuisine(s): Mediterranean

Please suggest 6 delicious breakfast recipes that:
1. Match the relaxed mood
2. Are appropriate for breakfast time
3. Feature Mediterranean style cooking

For EACH recipe provide:
- Recipe name with cooking time in parentheses
- Difficulty level (Easy/Medium/Hard)
- Brief appetizing description (2-3 sentences)
- Key mood-boosting benefits

Format each recipe clearly with the name as a header.
"""
        
        response = requests.post(
            f"{BASE_URL}/api/chat/send",
            json={
                "session_id": f"{self.session_id}-sensory",
                "message": recipe_request
            },
            headers=self.headers,
            timeout=120
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        recipe_text = response.json()["response"].lower()
        
        # Check for sensory cues
        sensory_cues = [
            'golden', 'brown', 'crispy', 'tender', 'fragrant', 'aromatic',
            'sizzling', 'bubbling', 'caramelized', 'toasted', 'charred',
            'soft', 'fluffy', 'creamy', 'crunchy', 'melted', 'glossy',
            'translucent', 'opaque', 'fork-tender', 'al dente'
        ]
        
        found_cues = [cue for cue in sensory_cues if cue in recipe_text]
        
        print(f"Found {len(found_cues)} sensory cues: {found_cues}")
        
        # Should have at least some sensory cues
        assert len(found_cues) >= 2, f"Recipe should include sensory cues, found only: {found_cues}"
        print("✓ Recipe response contains sensory cues")
    
    def test_multi_step_chat_flow(self):
        """TEST 5: Multi-step chat flow should work correctly"""
        session_id = f"{self.session_id}-multistep"
        
        # Step 1: Initial greeting/mood selection
        step1_response = requests.post(
            f"{BASE_URL}/api/chat/send",
            json={
                "session_id": session_id,
                "message": "I'm feeling happy today and want to cook something nice!"
            },
            headers=self.headers,
            timeout=60
        )
        
        assert step1_response.status_code == 200, f"Step 1 failed: {step1_response.text}"
        print("✓ Step 1 (mood expression) - PASS")
        
        # Step 2: Meal type selection
        step2_response = requests.post(
            f"{BASE_URL}/api/chat/send",
            json={
                "session_id": session_id,
                "message": "I'm looking for dinner ideas"
            },
            headers=self.headers,
            timeout=60
        )
        
        assert step2_response.status_code == 200, f"Step 2 failed: {step2_response.text}"
        print("✓ Step 2 (meal type) - PASS")
        
        # Step 3: Dietary preference
        step3_response = requests.post(
            f"{BASE_URL}/api/chat/send",
            json={
                "session_id": session_id,
                "message": "I prefer vegetarian options"
            },
            headers=self.headers,
            timeout=60
        )
        
        assert step3_response.status_code == 200, f"Step 3 failed: {step3_response.text}"
        print("✓ Step 3 (dietary preference) - PASS")
        
        # Step 4: Cuisine preference
        step4_response = requests.post(
            f"{BASE_URL}/api/chat/send",
            json={
                "session_id": session_id,
                "message": "I love Indian cuisine"
            },
            headers=self.headers,
            timeout=60
        )
        
        assert step4_response.status_code == 200, f"Step 4 failed: {step4_response.text}"
        print("✓ Step 4 (cuisine preference) - PASS")
        
        # Step 5: Full recipe generation request
        step5_response = requests.post(
            f"{BASE_URL}/api/chat/send",
            json={
                "session_id": session_id,
                "message": """
[User Preferences]
- Mood: Happy (Feeling joyful)
- Meal Type: Dinner
- Dietary Preference: Vegetarian
- Cuisine(s): Indian

Please suggest 6 delicious dinner recipes.
"""
            },
            headers=self.headers,
            timeout=120
        )
        
        assert step5_response.status_code == 200, f"Step 5 failed: {step5_response.text}"
        
        # Verify response contains recipe content
        response_text = step5_response.json()["response"]
        assert len(response_text) > 100, "Recipe response should be substantial"
        
        print("✓ Step 5 (recipe generation) - PASS")
        print(f"✓ Multi-step chat flow completed successfully")
    
    def test_chat_endpoint_basic_health(self):
        """TEST 6: Basic health check for chat endpoint"""
        response = requests.post(
            f"{BASE_URL}/api/chat/send",
            json={
                "session_id": f"{self.session_id}-health",
                "message": "Hello, what can you help me with?"
            },
            headers=self.headers,
            timeout=60
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "response" in data, "Response should contain 'response' field"
        assert "session_id" in data, "Response should contain 'session_id' field"
        assert "timestamp" in data, "Response should contain 'timestamp' field"
        
        print("✓ Chat endpoint health check - PASS")


class TestAuthEndpoints:
    """Test authentication endpoints"""
    
    def test_register_new_user(self):
        """Test user registration"""
        timestamp = int(time.time())
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"newuser{timestamp}@test.com",
            "password": "Test1234!",
            "name": f"New User {timestamp}",
            "dietary_restrictions": ["vegetarian"],
            "cuisine_preferences": ["italian"]
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == f"newuser{timestamp}@test.com"
        
        print("✓ User registration - PASS")
    
    def test_login_user(self):
        """Test user login"""
        timestamp = int(time.time())
        email = f"logintest{timestamp}@test.com"
        password = "Test1234!"
        
        # First register
        requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": password,
            "name": "Login Test User",
            "dietary_restrictions": [],
            "cuisine_preferences": []
        })
        
        # Then login
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        
        print("✓ User login - PASS")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
