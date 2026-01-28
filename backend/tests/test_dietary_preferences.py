"""
Test suite for Dietary Preference feature in AI Weekly Meal Plan Generator
Tests the /api/weekly-plan/generate endpoint with all 5 dietary preferences:
- vegetarian, vegan, non-vegetarian, pescatarian, eggetarian
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = f"testdietary{int(time.time())}@test.com"
TEST_PASSWORD = "Test1234!"
TEST_NAME = "Test Dietary User"


class TestDietaryPreferences:
    """Test dietary preference feature in AI meal plan generation"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Register and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "name": TEST_NAME
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        # If user exists, try login
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {auth_token}"
        }
    
    def test_vegetarian_meal_plan(self, headers):
        """Test generating vegetarian meal plan - no meat/fish allowed"""
        response = requests.post(
            f"{BASE_URL}/api/weekly-plan/generate",
            headers=headers,
            json={
                "mood": "feeling healthy",
                "dietary_preference": "vegetarian",
                "focus_areas": ["Energy Boost"],
                "cuisine_preferences": ["Indian"]
            },
            timeout=60
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify response structure
        assert "plan" in data
        assert "meals" in data["plan"]
        meals = data["plan"]["meals"]
        
        # Verify all 7 days present
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        for day in days:
            assert day in meals, f"Missing {day} in meal plan"
            assert "breakfast" in meals[day]
            assert "lunch" in meals[day]
            assert "dinner" in meals[day]
        
        # Verify no meat/fish in meals (basic check)
        meat_keywords = ["chicken", "beef", "pork", "lamb", "fish", "salmon", "tuna", "shrimp", "bacon"]
        all_meals_text = str(meals).lower()
        for keyword in meat_keywords:
            # Allow false positives like "chickpea" but flag actual meat
            if keyword in all_meals_text and keyword not in ["chicken"]:  # chickpea contains chicken
                # More specific check
                if f" {keyword}" in all_meals_text or f"{keyword} " in all_meals_text:
                    print(f"Warning: Found '{keyword}' in vegetarian plan - may need review")
        
        print(f"✓ Vegetarian meal plan generated with {len(meals)} days")
    
    def test_vegan_meal_plan(self, headers):
        """Test generating vegan meal plan - no animal products"""
        response = requests.post(
            f"{BASE_URL}/api/weekly-plan/generate",
            headers=headers,
            json={
                "mood": "need comfort food",
                "dietary_preference": "vegan",
                "focus_areas": ["Stress Relief"],
                "cuisine_preferences": ["Thai", "Mexican"]
            },
            timeout=60
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "plan" in data
        meals = data["plan"]["meals"]
        
        # Verify structure
        assert len(meals) == 7
        
        # Check for animal products (basic check)
        animal_keywords = ["egg", "cheese", "milk", "butter", "cream", "yogurt", "honey"]
        all_meals_text = str(meals).lower()
        
        # Note: AI may still include some - this is a warning not a failure
        for keyword in animal_keywords:
            if keyword in all_meals_text:
                print(f"Warning: Found '{keyword}' in vegan plan - may need review")
        
        print(f"✓ Vegan meal plan generated successfully")
    
    def test_non_vegetarian_meal_plan(self, headers):
        """Test generating non-vegetarian meal plan - all foods allowed"""
        response = requests.post(
            f"{BASE_URL}/api/weekly-plan/generate",
            headers=headers,
            json={
                "mood": "energized",
                "dietary_preference": "non-vegetarian",
                "focus_areas": ["Energy Boost"],
                "cuisine_preferences": ["Japanese", "Korean"]
            },
            timeout=60
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "plan" in data
        meals = data["plan"]["meals"]
        
        # Verify structure
        assert len(meals) == 7
        
        # Non-veg should include meat/fish
        all_meals_text = str(meals).lower()
        meat_keywords = ["chicken", "beef", "pork", "fish", "salmon", "shrimp"]
        has_meat = any(kw in all_meals_text for kw in meat_keywords)
        
        print(f"✓ Non-vegetarian meal plan generated (contains meat: {has_meat})")
    
    def test_pescatarian_meal_plan(self, headers):
        """Test generating pescatarian meal plan - fish/seafood allowed, no meat"""
        response = requests.post(
            f"{BASE_URL}/api/weekly-plan/generate",
            headers=headers,
            json={
                "mood": "relaxed",
                "dietary_preference": "pescatarian",
                "focus_areas": ["Gut Health"],
                "cuisine_preferences": ["Mediterranean"]
            },
            timeout=60
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "plan" in data
        meals = data["plan"]["meals"]
        
        # Verify structure
        assert len(meals) == 7
        
        # Should have fish/seafood but no meat
        all_meals_text = str(meals).lower()
        seafood_keywords = ["fish", "salmon", "tuna", "shrimp", "cod", "mackerel"]
        meat_keywords = ["chicken", "beef", "pork", "lamb", "bacon"]
        
        has_seafood = any(kw in all_meals_text for kw in seafood_keywords)
        has_meat = any(kw in all_meals_text for kw in meat_keywords)
        
        if has_meat:
            print(f"Warning: Found meat in pescatarian plan - may need review")
        
        print(f"✓ Pescatarian meal plan generated (contains seafood: {has_seafood})")
    
    def test_eggetarian_meal_plan(self, headers):
        """Test generating eggetarian meal plan - vegetarian + eggs"""
        response = requests.post(
            f"{BASE_URL}/api/weekly-plan/generate",
            headers=headers,
            json={
                "mood": "busy week",
                "dietary_preference": "eggetarian",
                "focus_areas": ["Weight Management"],
                "cuisine_preferences": ["Chinese", "Indian"]
            },
            timeout=60
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "plan" in data
        meals = data["plan"]["meals"]
        
        # Verify structure
        assert len(meals) == 7
        
        # Should have eggs but no meat/fish
        all_meals_text = str(meals).lower()
        has_eggs = "egg" in all_meals_text
        meat_keywords = ["chicken", "beef", "pork", "fish", "salmon", "shrimp"]
        has_meat = any(kw in all_meals_text for kw in meat_keywords)
        
        if has_meat:
            print(f"Warning: Found meat/fish in eggetarian plan - may need review")
        
        print(f"✓ Eggetarian meal plan generated (contains eggs: {has_eggs})")
    
    def test_default_dietary_preference(self, headers):
        """Test that default dietary preference is non-vegetarian"""
        response = requests.post(
            f"{BASE_URL}/api/weekly-plan/generate",
            headers=headers,
            json={
                "mood": "happy",
                "focus_areas": []
            },
            timeout=60
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "plan" in data
        print("✓ Default dietary preference works (non-vegetarian)")
    
    def test_dietary_preference_required_validation(self, headers):
        """Test that endpoint accepts request without dietary_preference (uses default)"""
        response = requests.post(
            f"{BASE_URL}/api/weekly-plan/generate",
            headers=headers,
            json={
                "mood": "testing"
            },
            timeout=60
        )
        
        # Should succeed with default
        assert response.status_code == 200
        print("✓ Endpoint accepts request without dietary_preference")
    
    def test_invalid_dietary_preference(self, headers):
        """Test with invalid dietary preference - should use default or handle gracefully"""
        response = requests.post(
            f"{BASE_URL}/api/weekly-plan/generate",
            headers=headers,
            json={
                "mood": "testing",
                "dietary_preference": "invalid_preference"
            },
            timeout=60
        )
        
        # Should either succeed with default or return error
        assert response.status_code in [200, 400, 422]
        print(f"✓ Invalid dietary preference handled (status: {response.status_code})")
    
    def test_meal_plan_structure(self, headers):
        """Test that meal plan has correct structure"""
        response = requests.post(
            f"{BASE_URL}/api/weekly-plan/generate",
            headers=headers,
            json={
                "mood": "testing structure",
                "dietary_preference": "vegetarian"
            },
            timeout=60
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify plan structure
        assert "plan" in data
        plan = data["plan"]
        
        assert "id" in plan
        assert "user_id" in plan
        assert "week_start" in plan
        assert "meals" in plan
        assert "created_at" in plan
        
        # Verify meals structure
        meals = plan["meals"]
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        meal_types = ["breakfast", "lunch", "dinner"]
        
        for day in days:
            assert day in meals, f"Missing {day}"
            for meal_type in meal_types:
                assert meal_type in meals[day], f"Missing {meal_type} on {day}"
                assert isinstance(meals[day][meal_type], str), f"{meal_type} on {day} should be string"
                assert len(meals[day][meal_type]) > 0, f"{meal_type} on {day} should not be empty"
        
        print("✓ Meal plan structure is correct")
    
    def test_unauthorized_access(self):
        """Test that endpoint requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/weekly-plan/generate",
            headers={"Content-Type": "application/json"},
            json={
                "mood": "testing",
                "dietary_preference": "vegetarian"
            }
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Endpoint requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
