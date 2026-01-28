"""
Test Continuous Meal Planning Feature
- POST /api/meal-preferences saves user meal preferences with is_active flag
- GET /api/meal-preferences returns saved preferences
- POST /api/weekly-plan/generate-next generates plan for next week using saved preferences
- Already-used recipes are excluded from new plans (no repetition)
- Existing plan detection - returns 'already_exists: true' if plan exists for that week
"""

import pytest
import requests
import os
import time
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestContinuousMealPlanning:
    """Test continuous meal planning endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test user and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Create unique test user
        timestamp = int(time.time())
        self.test_email = f"testcontinuous{timestamp}@test.com"
        self.test_password = "Test1234!"
        
        # Register user
        register_response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.test_email,
            "password": self.test_password,
            "name": "Test Continuous User"
        })
        
        if register_response.status_code == 200:
            token = register_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            # Try login if user exists
            login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
                "email": self.test_email,
                "password": self.test_password
            })
            if login_response.status_code == 200:
                token = login_response.json().get("access_token")
                self.session.headers.update({"Authorization": f"Bearer {token}"})
            else:
                pytest.skip("Could not authenticate test user")
        
        yield
        
        # Cleanup - no explicit cleanup needed as test data is isolated by user
    
    def test_save_meal_preferences(self):
        """Test POST /api/meal-preferences saves preferences correctly"""
        preferences = {
            "dietary_preference": "vegetarian",
            "calorie_target": 2000,
            "focus_areas": ["Weight Management", "Energy Boost"],
            "cuisine_preferences": ["Italian", "Indian"],
            "mood": "balanced",
            "is_active": True
        }
        
        response = self.session.post(f"{BASE_URL}/api/meal-preferences", json=preferences)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data
        assert "preferences" in data
        
        saved_prefs = data["preferences"]
        assert saved_prefs["dietary_preference"] == "vegetarian"
        assert saved_prefs["calorie_target"] == 2000
        assert saved_prefs["is_active"] == True
        assert "Weight Management" in saved_prefs["focus_areas"]
        assert "Italian" in saved_prefs["cuisine_preferences"]
        
        print(f"✓ Meal preferences saved successfully: {saved_prefs['dietary_preference']}, {saved_prefs['calorie_target']} cal")
    
    def test_get_meal_preferences(self):
        """Test GET /api/meal-preferences returns saved preferences"""
        # First save preferences
        preferences = {
            "dietary_preference": "non-vegetarian",
            "calorie_target": 2500,
            "focus_areas": ["Muscle Gain"],
            "cuisine_preferences": ["Mexican", "Thai"],
            "mood": "energized",
            "is_active": True
        }
        
        save_response = self.session.post(f"{BASE_URL}/api/meal-preferences", json=preferences)
        assert save_response.status_code == 200
        
        # Now get preferences
        response = self.session.get(f"{BASE_URL}/api/meal-preferences")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "preferences" in data
        
        prefs = data["preferences"]
        assert prefs is not None
        assert prefs["dietary_preference"] == "non-vegetarian"
        assert prefs["calorie_target"] == 2500
        assert prefs["is_active"] == True
        
        print(f"✓ Retrieved meal preferences: {prefs['dietary_preference']}, active={prefs['is_active']}")
    
    def test_get_meal_preferences_empty(self):
        """Test GET /api/meal-preferences returns null when no preferences set"""
        # Create a new user without preferences
        timestamp = int(time.time()) + 1000
        new_email = f"testnopref{timestamp}@test.com"
        
        new_session = requests.Session()
        new_session.headers.update({"Content-Type": "application/json"})
        
        register_response = new_session.post(f"{BASE_URL}/api/auth/register", json={
            "email": new_email,
            "password": "Test1234!",
            "name": "Test No Pref User"
        })
        
        if register_response.status_code == 200:
            token = register_response.json().get("access_token")
            new_session.headers.update({"Authorization": f"Bearer {token}"})
            
            response = new_session.get(f"{BASE_URL}/api/meal-preferences")
            assert response.status_code == 200
            
            data = response.json()
            assert data["preferences"] is None
            
            print("✓ No preferences returns null as expected")
    
    def test_save_preferences_with_is_active_false(self):
        """Test saving preferences with is_active=False"""
        preferences = {
            "dietary_preference": "vegan",
            "calorie_target": 1800,
            "focus_areas": [],
            "cuisine_preferences": [],
            "mood": "relaxed",
            "is_active": False
        }
        
        response = self.session.post(f"{BASE_URL}/api/meal-preferences", json=preferences)
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["preferences"]["is_active"] == False
        
        print("✓ Preferences saved with is_active=False")
    
    def test_generate_next_week_requires_preferences(self):
        """Test POST /api/weekly-plan/generate-next requires saved preferences"""
        # Create new user without preferences
        timestamp = int(time.time()) + 2000
        new_email = f"testnextweek{timestamp}@test.com"
        
        new_session = requests.Session()
        new_session.headers.update({"Content-Type": "application/json"})
        
        register_response = new_session.post(f"{BASE_URL}/api/auth/register", json={
            "email": new_email,
            "password": "Test1234!",
            "name": "Test Next Week User"
        })
        
        if register_response.status_code == 200:
            token = register_response.json().get("access_token")
            new_session.headers.update({"Authorization": f"Bearer {token}"})
            
            response = new_session.post(f"{BASE_URL}/api/weekly-plan/generate-next")
            
            # Should return 400 because no preferences set
            assert response.status_code == 400, f"Expected 400, got {response.status_code}"
            assert "No meal preferences found" in response.json().get("detail", "")
            
            print("✓ Generate next week correctly requires preferences")
    
    def test_generate_next_week_requires_active_preferences(self):
        """Test POST /api/weekly-plan/generate-next requires is_active=True"""
        # Save preferences with is_active=False
        preferences = {
            "dietary_preference": "vegetarian",
            "calorie_target": 2000,
            "focus_areas": [],
            "cuisine_preferences": [],
            "mood": "balanced",
            "is_active": False
        }
        
        save_response = self.session.post(f"{BASE_URL}/api/meal-preferences", json=preferences)
        assert save_response.status_code == 200
        
        # Try to generate next week
        response = self.session.post(f"{BASE_URL}/api/weekly-plan/generate-next")
        
        # Should return 400 because is_active is False
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "not active" in response.json().get("detail", "").lower()
        
        print("✓ Generate next week correctly requires is_active=True")
    
    def test_generate_next_week_success(self):
        """Test POST /api/weekly-plan/generate-next generates plan successfully"""
        # First save active preferences
        preferences = {
            "dietary_preference": "vegetarian",
            "calorie_target": 2000,
            "focus_areas": ["Energy Boost"],
            "cuisine_preferences": ["Italian", "Indian"],
            "mood": "energized",
            "is_active": True
        }
        
        save_response = self.session.post(f"{BASE_URL}/api/meal-preferences", json=preferences)
        assert save_response.status_code == 200
        
        # Generate next week plan
        response = self.session.post(f"{BASE_URL}/api/weekly-plan/generate-next")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "plan" in data
        assert "message" in data
        
        plan = data["plan"]
        assert "meals" in plan
        assert "week_start" in plan
        
        # Verify meals structure
        meals = plan["meals"]
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        for day in days:
            assert day in meals, f"Missing {day} in meals"
            assert "breakfast" in meals[day]
            assert "lunch" in meals[day]
            assert "dinner" in meals[day]
        
        print(f"✓ Next week plan generated successfully for week starting {plan['week_start']}")
        print(f"  Sample meal: {meals['Monday']['breakfast']}")
    
    def test_generate_next_week_already_exists(self):
        """Test POST /api/weekly-plan/generate-next returns already_exists if plan exists"""
        # First save active preferences
        preferences = {
            "dietary_preference": "non-vegetarian",
            "calorie_target": 2200,
            "focus_areas": [],
            "cuisine_preferences": ["Mexican"],
            "mood": "balanced",
            "is_active": True
        }
        
        save_response = self.session.post(f"{BASE_URL}/api/meal-preferences", json=preferences)
        assert save_response.status_code == 200
        
        # Generate next week plan first time
        first_response = self.session.post(f"{BASE_URL}/api/weekly-plan/generate-next")
        assert first_response.status_code == 200
        
        first_data = first_response.json()
        # First call might be new or already exist
        
        # Generate again - should return already_exists
        second_response = self.session.post(f"{BASE_URL}/api/weekly-plan/generate-next")
        assert second_response.status_code == 200
        
        second_data = second_response.json()
        assert second_data.get("already_exists") == True, "Expected already_exists=True on second call"
        
        print("✓ Generate next week correctly returns already_exists=True for existing plan")
    
    def test_meal_preferences_update(self):
        """Test that updating preferences overwrites previous ones"""
        # Save initial preferences
        initial_prefs = {
            "dietary_preference": "vegetarian",
            "calorie_target": 1500,
            "focus_areas": ["Weight Management"],
            "cuisine_preferences": ["Italian"],
            "mood": "calm",
            "is_active": True
        }
        
        response1 = self.session.post(f"{BASE_URL}/api/meal-preferences", json=initial_prefs)
        assert response1.status_code == 200
        
        # Update preferences
        updated_prefs = {
            "dietary_preference": "vegan",
            "calorie_target": 2500,
            "focus_areas": ["Muscle Gain", "Energy Boost"],
            "cuisine_preferences": ["Thai", "Japanese"],
            "mood": "energized",
            "is_active": True
        }
        
        response2 = self.session.post(f"{BASE_URL}/api/meal-preferences", json=updated_prefs)
        assert response2.status_code == 200
        
        # Verify update
        get_response = self.session.get(f"{BASE_URL}/api/meal-preferences")
        assert get_response.status_code == 200
        
        prefs = get_response.json()["preferences"]
        assert prefs["dietary_preference"] == "vegan"
        assert prefs["calorie_target"] == 2500
        assert "Thai" in prefs["cuisine_preferences"]
        
        print("✓ Preferences correctly updated/overwritten")
    
    def test_current_week_plan_endpoint(self):
        """Test GET /api/weekly-plan/current returns current week plan and preferences"""
        # Save preferences first
        preferences = {
            "dietary_preference": "pescatarian",
            "calorie_target": 1800,
            "focus_areas": ["Gut Health"],
            "cuisine_preferences": ["Japanese", "Mediterranean"],
            "mood": "balanced",
            "is_active": True
        }
        
        save_response = self.session.post(f"{BASE_URL}/api/meal-preferences", json=preferences)
        assert save_response.status_code == 200
        
        # Get current week plan
        response = self.session.get(f"{BASE_URL}/api/weekly-plan/current")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "week_start" in data
        assert "has_plan" in data
        assert "has_preferences" in data
        assert "preferences" in data
        
        # Preferences should be present
        assert data["has_preferences"] == True
        assert data["preferences"]["dietary_preference"] == "pescatarian"
        
        print(f"✓ Current week endpoint working: week_start={data['week_start']}, has_plan={data['has_plan']}")
    
    def test_authentication_required(self):
        """Test that all endpoints require authentication"""
        unauthenticated_session = requests.Session()
        unauthenticated_session.headers.update({"Content-Type": "application/json"})
        
        # Test meal-preferences POST
        response1 = unauthenticated_session.post(f"{BASE_URL}/api/meal-preferences", json={
            "dietary_preference": "vegetarian",
            "is_active": True
        })
        assert response1.status_code in [401, 403], f"Expected 401/403, got {response1.status_code}"
        
        # Test meal-preferences GET
        response2 = unauthenticated_session.get(f"{BASE_URL}/api/meal-preferences")
        assert response2.status_code in [401, 403], f"Expected 401/403, got {response2.status_code}"
        
        # Test generate-next POST
        response3 = unauthenticated_session.post(f"{BASE_URL}/api/weekly-plan/generate-next")
        assert response3.status_code in [401, 403], f"Expected 401/403, got {response3.status_code}"
        
        # Test current GET
        response4 = unauthenticated_session.get(f"{BASE_URL}/api/weekly-plan/current")
        assert response4.status_code in [401, 403], f"Expected 401/403, got {response4.status_code}"
        
        print("✓ All endpoints correctly require authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
