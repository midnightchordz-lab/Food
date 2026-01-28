"""
Test Calorie Target Feature for AI Weekly Meal Plan Generator
Tests the calorie_target parameter in /api/weekly-plan/generate endpoint
"""
import pytest
import requests
import os
import re
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = f"testcalorie{int(time.time())}@test.com"
TEST_PASSWORD = "Test1234!"
TEST_NAME = "Test Calorie User"


class TestCalorieTargetFeature:
    """Tests for Calorie Target feature in AI Weekly Meal Plan Generator"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Register a test user and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "name": TEST_NAME
        })
        if response.status_code == 400:  # User already exists
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            })
        assert response.status_code in [200, 201], f"Auth failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def extract_calories_from_meal(self, meal_name):
        """Extract calorie value from meal name like 'Greek Yogurt (~350cal)'"""
        match = re.search(r'\(~?(\d+)cal\)', meal_name)
        return int(match.group(1)) if match else None
    
    # ============== BACKEND API TESTS ==============
    
    def test_generate_plan_with_calorie_target_1500(self, auth_headers):
        """Test meal plan generation with 1500 calorie target (Weight Loss)"""
        response = requests.post(
            f"{BASE_URL}/api/weekly-plan/generate",
            headers=auth_headers,
            json={
                "mood": "energized",
                "dietary_preference": "vegetarian",
                "calorie_target": 1500
            },
            timeout=60
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify plan structure
        assert "plan" in data
        assert "meals" in data["plan"]
        meals = data["plan"]["meals"]
        
        # Check all 7 days present
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        for day in days:
            assert day in meals, f"Missing {day} in meal plan"
            assert "breakfast" in meals[day]
            assert "lunch" in meals[day]
            assert "dinner" in meals[day]
        
        # Verify calorie counts are included in meal names
        monday = meals["Monday"]
        breakfast_cal = self.extract_calories_from_meal(monday["breakfast"])
        lunch_cal = self.extract_calories_from_meal(monday["lunch"])
        dinner_cal = self.extract_calories_from_meal(monday["dinner"])
        
        assert breakfast_cal is not None, f"Breakfast missing calorie count: {monday['breakfast']}"
        assert lunch_cal is not None, f"Lunch missing calorie count: {monday['lunch']}"
        assert dinner_cal is not None, f"Dinner missing calorie count: {monday['dinner']}"
        
        # Verify calorie distribution (25% breakfast, 35% lunch, 40% dinner)
        # Allow 10% tolerance
        expected_breakfast = 1500 * 0.25  # 375
        expected_lunch = 1500 * 0.35  # 525
        expected_dinner = 1500 * 0.40  # 600
        
        assert abs(breakfast_cal - expected_breakfast) <= expected_breakfast * 0.15, \
            f"Breakfast calories {breakfast_cal} not close to expected {expected_breakfast}"
        assert abs(lunch_cal - expected_lunch) <= expected_lunch * 0.15, \
            f"Lunch calories {lunch_cal} not close to expected {expected_lunch}"
        assert abs(dinner_cal - expected_dinner) <= expected_dinner * 0.15, \
            f"Dinner calories {dinner_cal} not close to expected {expected_dinner}"
    
    def test_generate_plan_with_calorie_target_2000(self, auth_headers):
        """Test meal plan generation with 2000 calorie target (Maintenance)"""
        response = requests.post(
            f"{BASE_URL}/api/weekly-plan/generate",
            headers=auth_headers,
            json={
                "mood": "balanced",
                "dietary_preference": "non-vegetarian",
                "calorie_target": 2000
            },
            timeout=60
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        meals = data["plan"]["meals"]
        monday = meals["Monday"]
        
        # Verify calorie counts present
        breakfast_cal = self.extract_calories_from_meal(monday["breakfast"])
        lunch_cal = self.extract_calories_from_meal(monday["lunch"])
        dinner_cal = self.extract_calories_from_meal(monday["dinner"])
        
        assert breakfast_cal is not None, "Breakfast missing calorie count"
        assert lunch_cal is not None, "Lunch missing calorie count"
        assert dinner_cal is not None, "Dinner missing calorie count"
        
        # Verify distribution for 2000 cal (500, 700, 800)
        expected_breakfast = 2000 * 0.25  # 500
        expected_lunch = 2000 * 0.35  # 700
        expected_dinner = 2000 * 0.40  # 800
        
        assert abs(breakfast_cal - expected_breakfast) <= expected_breakfast * 0.15
        assert abs(lunch_cal - expected_lunch) <= expected_lunch * 0.15
        assert abs(dinner_cal - expected_dinner) <= expected_dinner * 0.15
    
    def test_generate_plan_with_calorie_target_2500(self, auth_headers):
        """Test meal plan generation with 2500 calorie target (Active)"""
        response = requests.post(
            f"{BASE_URL}/api/weekly-plan/generate",
            headers=auth_headers,
            json={
                "mood": "active",
                "dietary_preference": "pescatarian",
                "calorie_target": 2500
            },
            timeout=60
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        meals = data["plan"]["meals"]
        tuesday = meals["Tuesday"]
        
        # Verify calorie counts present
        breakfast_cal = self.extract_calories_from_meal(tuesday["breakfast"])
        lunch_cal = self.extract_calories_from_meal(tuesday["lunch"])
        dinner_cal = self.extract_calories_from_meal(tuesday["dinner"])
        
        assert breakfast_cal is not None, "Breakfast missing calorie count"
        assert lunch_cal is not None, "Lunch missing calorie count"
        assert dinner_cal is not None, "Dinner missing calorie count"
    
    def test_generate_plan_with_calorie_target_3000(self, auth_headers):
        """Test meal plan generation with 3000 calorie target (Muscle Gain)"""
        response = requests.post(
            f"{BASE_URL}/api/weekly-plan/generate",
            headers=auth_headers,
            json={
                "mood": "building muscle",
                "dietary_preference": "non-vegetarian",
                "calorie_target": 3000
            },
            timeout=60
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        meals = data["plan"]["meals"]
        wednesday = meals["Wednesday"]
        
        # Verify calorie counts present
        breakfast_cal = self.extract_calories_from_meal(wednesday["breakfast"])
        lunch_cal = self.extract_calories_from_meal(wednesday["lunch"])
        dinner_cal = self.extract_calories_from_meal(wednesday["dinner"])
        
        assert breakfast_cal is not None, "Breakfast missing calorie count"
        assert lunch_cal is not None, "Lunch missing calorie count"
        assert dinner_cal is not None, "Dinner missing calorie count"
        
        # Verify distribution for 3000 cal (750, 1050, 1200)
        expected_breakfast = 3000 * 0.25  # 750
        expected_lunch = 3000 * 0.35  # 1050
        expected_dinner = 3000 * 0.40  # 1200
        
        assert abs(breakfast_cal - expected_breakfast) <= expected_breakfast * 0.15
        assert abs(lunch_cal - expected_lunch) <= expected_lunch * 0.15
        assert abs(dinner_cal - expected_dinner) <= expected_dinner * 0.15
    
    def test_generate_plan_without_calorie_target(self, auth_headers):
        """Test meal plan generation WITHOUT calorie_target (optional feature)"""
        response = requests.post(
            f"{BASE_URL}/api/weekly-plan/generate",
            headers=auth_headers,
            json={
                "mood": "relaxed",
                "dietary_preference": "vegan"
                # No calorie_target - should work
            },
            timeout=60
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify plan generated successfully
        assert "plan" in data
        assert "meals" in data["plan"]
        meals = data["plan"]["meals"]
        
        # Check all 7 days present
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        for day in days:
            assert day in meals, f"Missing {day} in meal plan"
    
    def test_generate_plan_with_null_calorie_target(self, auth_headers):
        """Test meal plan generation with null calorie_target"""
        response = requests.post(
            f"{BASE_URL}/api/weekly-plan/generate",
            headers=auth_headers,
            json={
                "mood": "tired",
                "dietary_preference": "eggetarian",
                "calorie_target": None  # Explicitly null
            },
            timeout=60
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify plan generated successfully
        assert "plan" in data
        assert "meals" in data["plan"]
    
    def test_generate_plan_with_custom_calorie_target(self, auth_headers):
        """Test meal plan generation with custom calorie target (1800)"""
        response = requests.post(
            f"{BASE_URL}/api/weekly-plan/generate",
            headers=auth_headers,
            json={
                "mood": "focused",
                "dietary_preference": "vegetarian",
                "calorie_target": 1800  # Custom value
            },
            timeout=60
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        meals = data["plan"]["meals"]
        friday = meals["Friday"]
        
        # Verify calorie counts present
        breakfast_cal = self.extract_calories_from_meal(friday["breakfast"])
        lunch_cal = self.extract_calories_from_meal(friday["lunch"])
        dinner_cal = self.extract_calories_from_meal(friday["dinner"])
        
        assert breakfast_cal is not None, "Breakfast missing calorie count"
        assert lunch_cal is not None, "Lunch missing calorie count"
        assert dinner_cal is not None, "Dinner missing calorie count"
        
        # Verify distribution for 1800 cal (450, 630, 720)
        expected_breakfast = 1800 * 0.25  # 450
        expected_lunch = 1800 * 0.35  # 630
        expected_dinner = 1800 * 0.40  # 720
        
        assert abs(breakfast_cal - expected_breakfast) <= expected_breakfast * 0.20
        assert abs(lunch_cal - expected_lunch) <= expected_lunch * 0.20
        assert abs(dinner_cal - expected_dinner) <= expected_dinner * 0.20
    
    def test_endpoint_requires_authentication(self):
        """Test that endpoint requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/weekly-plan/generate",
            headers={"Content-Type": "application/json"},
            json={
                "mood": "test",
                "dietary_preference": "vegetarian",
                "calorie_target": 2000
            }
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
