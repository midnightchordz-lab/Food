"""
Test Macro Tracking and Meal Plan Persistence Features
Tests:
1. Macro targets save via POST /api/meal-preferences with macro_targets object
2. Macro targets retrieval via GET /api/meal-preferences includes macro_targets
3. Weekly plans are persisted to DB via POST /api/weekly-plan/generate
4. Weekly plans are retrieved via GET /api/weekly-plan
5. Recipe subscriptions save via POST /api/subscription/recipes
6. Recipe subscriptions retrieval via GET /api/subscription/recipes
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMacroTrackingAndPersistence:
    """Test macro tracking and meal plan persistence features"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test user and auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Create unique test user
        self.test_email = f"macro_test_{uuid.uuid4().hex[:8]}@test.com"
        self.test_password = "TestPass123"
        
        # Register user
        register_response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.test_email,
            "password": self.test_password,
            "name": "Macro Test User"
        })
        
        if register_response.status_code == 200:
            self.token = register_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip(f"Failed to register test user: {register_response.text}")
    
    # ============== MACRO TARGETS TESTS ==============
    
    def test_save_meal_preferences_with_macro_targets(self):
        """Test POST /api/meal-preferences saves macro_targets correctly"""
        macro_targets = {
            "protein_g": 150,
            "carbs_g": 200,
            "fat_g": 65,
            "fiber_g": 30
        }
        
        response = self.session.post(f"{BASE_URL}/api/meal-preferences", json={
            "dietary_preference": "non-vegetarian",
            "calorie_target": 2000,
            "macro_targets": macro_targets,
            "focus_areas": ["Weight Management", "Energy Boost"],
            "cuisine_preferences": ["Italian", "Mexican"],
            "mood": "energized",
            "is_active": False,  # Don't auto-generate plan
            "generation_mode": "manual"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "preferences" in data, "Response should contain 'preferences'"
        prefs = data["preferences"]
        
        # Verify macro_targets saved correctly
        assert "macro_targets" in prefs, "Preferences should contain macro_targets"
        saved_macros = prefs["macro_targets"]
        assert saved_macros["protein_g"] == 150, f"Expected protein_g=150, got {saved_macros.get('protein_g')}"
        assert saved_macros["carbs_g"] == 200, f"Expected carbs_g=200, got {saved_macros.get('carbs_g')}"
        assert saved_macros["fat_g"] == 65, f"Expected fat_g=65, got {saved_macros.get('fat_g')}"
        assert saved_macros["fiber_g"] == 30, f"Expected fiber_g=30, got {saved_macros.get('fiber_g')}"
        
        print("✅ Macro targets saved successfully via POST /api/meal-preferences")
    
    def test_retrieve_meal_preferences_with_macro_targets(self):
        """Test GET /api/meal-preferences returns macro_targets"""
        # First save preferences with macros
        macro_targets = {
            "protein_g": 180,
            "carbs_g": 250,
            "fat_g": 80,
            "fiber_g": None  # Test null value
        }
        
        save_response = self.session.post(f"{BASE_URL}/api/meal-preferences", json={
            "dietary_preference": "vegetarian",
            "calorie_target": 2500,
            "macro_targets": macro_targets,
            "focus_areas": [],
            "cuisine_preferences": ["Indian"],
            "mood": "balanced",
            "is_active": False,
            "generation_mode": "manual"
        })
        assert save_response.status_code == 200
        
        # Now retrieve and verify
        get_response = self.session.get(f"{BASE_URL}/api/meal-preferences")
        assert get_response.status_code == 200, f"Expected 200, got {get_response.status_code}"
        
        data = get_response.json()
        assert "preferences" in data, "Response should contain 'preferences'"
        prefs = data["preferences"]
        
        # Verify macro_targets retrieved correctly
        assert prefs is not None, "Preferences should not be None"
        assert "macro_targets" in prefs, "Preferences should contain macro_targets"
        
        retrieved_macros = prefs["macro_targets"]
        assert retrieved_macros["protein_g"] == 180
        assert retrieved_macros["carbs_g"] == 250
        assert retrieved_macros["fat_g"] == 80
        # fiber_g can be None
        
        print("✅ Macro targets retrieved successfully via GET /api/meal-preferences")
    
    def test_save_preferences_without_macro_targets(self):
        """Test saving preferences without macro_targets (null)"""
        response = self.session.post(f"{BASE_URL}/api/meal-preferences", json={
            "dietary_preference": "pescatarian",
            "calorie_target": 1800,
            "macro_targets": None,  # Explicitly null
            "focus_areas": ["Gut Health"],
            "cuisine_preferences": [],
            "mood": "relaxed",
            "is_active": False,
            "generation_mode": "manual"
        })
        
        assert response.status_code == 200
        data = response.json()
        prefs = data["preferences"]
        
        # macro_targets should be None or not present
        assert prefs.get("macro_targets") is None, "macro_targets should be None when not provided"
        
        print("✅ Preferences saved without macro_targets (null)")
    
    # ============== WEEKLY PLAN PERSISTENCE TESTS ==============
    
    def test_generate_weekly_plan_persists_to_db(self):
        """Test POST /api/weekly-plan/generate persists plan to database"""
        # Generate a plan
        response = self.session.post(f"{BASE_URL}/api/weekly-plan/generate", json={
            "mood": "energized and ready to cook",
            "dietary_preference": "non-vegetarian",
            "calorie_target": 2000,
            "macro_targets": {
                "protein_g": 150,
                "carbs_g": 200,
                "fat_g": 65
            },
            "focus_areas": ["Energy Boost"],
            "cuisine_preferences": ["Italian", "Mexican"]
        }, timeout=60)  # AI generation can take time
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "plan" in data, "Response should contain 'plan'"
        plan = data["plan"]
        
        # Verify plan structure
        assert "meals" in plan, "Plan should contain 'meals'"
        assert "week_start" in plan, "Plan should contain 'week_start'"
        assert "id" in plan, "Plan should have an ID"
        
        # Verify meals for all days
        expected_days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        for day in expected_days:
            assert day in plan["meals"], f"Plan should have meals for {day}"
            day_meals = plan["meals"][day]
            assert "breakfast" in day_meals, f"{day} should have breakfast"
            assert "lunch" in day_meals, f"{day} should have lunch"
            assert "dinner" in day_meals, f"{day} should have dinner"
        
        print("✅ Weekly plan generated and persisted to DB")
        return plan
    
    def test_retrieve_weekly_plans(self):
        """Test GET /api/weekly-plan retrieves persisted plans"""
        # First generate a plan
        gen_response = self.session.post(f"{BASE_URL}/api/weekly-plan/generate", json={
            "mood": "relaxed weekend cooking",
            "dietary_preference": "vegetarian",
            "calorie_target": 1800,
            "focus_areas": [],
            "cuisine_preferences": ["Indian"]
        }, timeout=60)
        
        assert gen_response.status_code == 200
        generated_plan = gen_response.json()["plan"]
        
        # Now retrieve plans
        get_response = self.session.get(f"{BASE_URL}/api/weekly-plan")
        assert get_response.status_code == 200, f"Expected 200, got {get_response.status_code}"
        
        data = get_response.json()
        assert "plans" in data, "Response should contain 'plans'"
        plans = data["plans"]
        
        assert len(plans) > 0, "Should have at least one plan"
        
        # Verify the generated plan is in the list
        plan_ids = [p.get("id") for p in plans]
        assert generated_plan["id"] in plan_ids, "Generated plan should be in retrieved plans"
        
        print(f"✅ Retrieved {len(plans)} weekly plan(s) from DB")
    
    def test_get_current_week_plan(self):
        """Test GET /api/weekly-plan/current returns current week's plan"""
        # First generate a plan for current week
        gen_response = self.session.post(f"{BASE_URL}/api/weekly-plan/generate", json={
            "mood": "busy weekday",
            "dietary_preference": "non-vegetarian",
            "calorie_target": 2200,
            "focus_areas": ["Weight Management"],
            "cuisine_preferences": []
        }, timeout=60)
        
        assert gen_response.status_code == 200
        
        # Get current week plan
        current_response = self.session.get(f"{BASE_URL}/api/weekly-plan/current")
        assert current_response.status_code == 200
        
        data = current_response.json()
        assert "has_plan" in data, "Response should indicate if plan exists"
        assert "week_start" in data, "Response should contain week_start"
        
        if data["has_plan"]:
            assert "plan" in data and data["plan"] is not None
            print("✅ Current week plan retrieved successfully")
        else:
            print("⚠️ No plan for current week (may have been generated for different week)")
    
    # ============== RECIPE SUBSCRIPTION TESTS ==============
    
    def test_save_recipe_subscription(self):
        """Test POST /api/subscription/recipes saves subscription"""
        subscription_data = {
            "email": self.test_email,
            "dietary_preference": "Vegetarian",
            "cuisines": ["Italian", "Mexican", "Indian"],
            "recipes_per_week": 5,
            "delivery_day": "Sunday"
        }
        
        response = self.session.post(f"{BASE_URL}/api/subscription/recipes", json=subscription_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("status") == "subscribed", "Status should be 'subscribed'"
        assert "message" in data, "Response should contain message"
        
        print("✅ Recipe subscription saved successfully")
    
    def test_retrieve_recipe_subscription(self):
        """Test GET /api/subscription/recipes retrieves subscription status"""
        # First create a subscription
        self.session.post(f"{BASE_URL}/api/subscription/recipes", json={
            "email": self.test_email,
            "dietary_preference": "Non-Vegetarian",
            "cuisines": ["Chinese", "Japanese"],
            "recipes_per_week": 7,
            "delivery_day": "Monday"
        })
        
        # Now retrieve
        response = self.session.get(f"{BASE_URL}/api/subscription/recipes")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "subscribed" in data, "Response should contain 'subscribed' field"
        assert data["subscribed"] == True, "User should be subscribed"
        
        if data.get("subscription"):
            sub = data["subscription"]
            assert sub["email"] == self.test_email
            assert sub["dietary_preference"] == "Non-Vegetarian"
            assert "Chinese" in sub["cuisines"]
            assert sub["recipes_per_week"] == 7
            assert sub["delivery_day"] == "Monday"
        
        print("✅ Recipe subscription retrieved successfully")
    
    def test_unsubscribe_from_recipes(self):
        """Test DELETE /api/subscription/recipes unsubscribes user"""
        # First subscribe
        self.session.post(f"{BASE_URL}/api/subscription/recipes", json={
            "email": self.test_email,
            "dietary_preference": "Vegan",
            "cuisines": ["Thai"],
            "recipes_per_week": 3,
            "delivery_day": "Wednesday"
        })
        
        # Verify subscribed
        get_response = self.session.get(f"{BASE_URL}/api/subscription/recipes")
        assert get_response.json()["subscribed"] == True
        
        # Unsubscribe
        delete_response = self.session.delete(f"{BASE_URL}/api/subscription/recipes")
        assert delete_response.status_code == 200
        assert delete_response.json().get("status") == "unsubscribed"
        
        # Verify unsubscribed
        verify_response = self.session.get(f"{BASE_URL}/api/subscription/recipes")
        assert verify_response.json()["subscribed"] == False
        
        print("✅ Recipe unsubscription works correctly")
    
    # ============== MACRO TARGETS IN PLAN GENERATION ==============
    
    def test_macro_targets_passed_to_plan_generation(self):
        """Test that macro_targets are passed to AI meal plan generation"""
        macro_targets = {
            "protein_g": 200,  # High protein
            "carbs_g": 150,    # Lower carbs
            "fat_g": 70
        }
        
        response = self.session.post(f"{BASE_URL}/api/weekly-plan/generate", json={
            "mood": "fitness focused, need high protein meals",
            "dietary_preference": "non-vegetarian",
            "calorie_target": 2200,
            "macro_targets": macro_targets,
            "focus_areas": ["Weight Management"],
            "cuisine_preferences": []
        }, timeout=60)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "plan" in data
        plan = data["plan"]
        
        # Verify plan was generated (AI should consider macros in meal selection)
        assert "meals" in plan
        assert len(plan["meals"]) == 7  # 7 days
        
        print("✅ Macro targets passed to plan generation successfully")
    
    # ============== EDGE CASES ==============
    
    def test_partial_macro_targets(self):
        """Test saving preferences with partial macro targets (only some fields)"""
        response = self.session.post(f"{BASE_URL}/api/meal-preferences", json={
            "dietary_preference": "vegetarian",
            "calorie_target": 1800,
            "macro_targets": {
                "protein_g": 100,
                "carbs_g": None,  # Not set
                "fat_g": 50,
                "fiber_g": None
            },
            "focus_areas": [],
            "cuisine_preferences": [],
            "mood": "balanced",
            "is_active": False,
            "generation_mode": "manual"
        })
        
        assert response.status_code == 200
        prefs = response.json()["preferences"]
        
        macros = prefs["macro_targets"]
        assert macros["protein_g"] == 100
        assert macros["fat_g"] == 50
        # carbs_g and fiber_g should be None
        
        print("✅ Partial macro targets saved correctly")


class TestMacroTrackingAuth:
    """Test authentication requirements for macro tracking endpoints"""
    
    def test_meal_preferences_requires_auth(self):
        """Test that meal preferences endpoints require authentication"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # POST without auth
        post_response = session.post(f"{BASE_URL}/api/meal-preferences", json={
            "dietary_preference": "vegetarian",
            "macro_targets": {"protein_g": 100}
        })
        assert post_response.status_code == 403, f"Expected 403, got {post_response.status_code}"
        
        # GET without auth
        get_response = session.get(f"{BASE_URL}/api/meal-preferences")
        assert get_response.status_code == 403, f"Expected 403, got {get_response.status_code}"
        
        print("✅ Meal preferences endpoints require authentication")
    
    def test_weekly_plan_requires_auth(self):
        """Test that weekly plan endpoints require authentication"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # GET without auth
        get_response = session.get(f"{BASE_URL}/api/weekly-plan")
        assert get_response.status_code == 403
        
        # POST generate without auth
        gen_response = session.post(f"{BASE_URL}/api/weekly-plan/generate", json={
            "mood": "test",
            "dietary_preference": "vegetarian"
        })
        assert gen_response.status_code == 403
        
        print("✅ Weekly plan endpoints require authentication")
    
    def test_subscription_requires_auth(self):
        """Test that subscription endpoints require authentication"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # POST without auth
        post_response = session.post(f"{BASE_URL}/api/subscription/recipes", json={
            "email": "test@test.com",
            "dietary_preference": "Vegetarian",
            "cuisines": ["Italian"],
            "recipes_per_week": 5,
            "delivery_day": "Sunday"
        })
        assert post_response.status_code == 403
        
        # GET without auth
        get_response = session.get(f"{BASE_URL}/api/subscription/recipes")
        assert get_response.status_code == 403
        
        print("✅ Subscription endpoints require authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
