import requests
import sys
import json
from datetime import datetime

class MoodMealPlannerAPITester:
    def __init__(self, base_url="https://food-for-mood-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.session_id = f"test-session-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        self.user_id = "test-user"

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                except:
                    print(f"   Response: {response.text[:200]}...")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:500]}")

            return success, response.json() if response.text else {}

        except requests.exceptions.Timeout:
            print(f"❌ Failed - Request timeout (30s)")
            return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_chat_send(self):
        """Test sending a chat message"""
        success, response = self.run_test(
            "Chat Send Message",
            "POST",
            "chat/send",
            200,
            data={
                "session_id": self.session_id,
                "message": "I'm feeling stressed and tired. What should I cook?"
            }
        )
        return success, response

    def test_chat_history(self):
        """Test getting chat history"""
        success, response = self.run_test(
            "Chat History",
            "GET",
            f"chat/history/{self.session_id}",
            200
        )
        return success, response

    def test_save_recipe(self):
        """Test saving a recipe"""
        sample_recipe = {
            "title": "Stress-Relief Comfort Bowl",
            "description": "A nourishing bowl with complex carbs and magnesium-rich ingredients",
            "ingredients": [
                "1 cup quinoa",
                "2 cups spinach",
                "1/2 avocado",
                "1 tbsp pumpkin seeds"
            ],
            "instructions": [
                "Cook quinoa according to package directions",
                "Sauté spinach until wilted",
                "Combine in bowl and top with avocado and seeds"
            ],
            "mood_tags": ["stressed", "tired", "comfort"],
            "prep_time": "10 minutes",
            "cook_time": "15 minutes",
            "complexity": "quick",
            "nutritional_highlights": "High in magnesium and complex carbohydrates for stress relief"
        }
        
        success, response = self.run_test(
            "Save Recipe",
            "POST",
            "recipes/save",
            200,
            data={
                "user_id": self.user_id,
                "recipe": sample_recipe
            }
        )
        return success, response

    def test_get_saved_recipes(self):
        """Test getting saved recipes"""
        success, response = self.run_test(
            "Get Saved Recipes",
            "GET",
            f"recipes/saved/{self.user_id}",
            200
        )
        return success, response

    def test_shopping_list_create(self):
        """Test creating/updating shopping list"""
        sample_items = [
            {"name": "Quinoa", "checked": False},
            {"name": "Spinach", "checked": False},
            {"name": "Avocado", "checked": True},
            {"name": "Pumpkin seeds", "checked": False}
        ]
        
        success, response = self.run_test(
            "Create Shopping List",
            "POST",
            "shopping-list",
            200,
            data={
                "user_id": self.user_id,
                "items": sample_items
            }
        )
        return success, response

    def test_shopping_list_get(self):
        """Test getting shopping list"""
        success, response = self.run_test(
            "Get Shopping List",
            "GET",
            f"shopping-list/{self.user_id}",
            200
        )
        return success, response

    def test_weekly_plan_create(self):
        """Test creating weekly plan"""
        sample_meals = {
            "Monday": {
                "breakfast": "Energizing smoothie bowl",
                "lunch": "Quinoa stress-relief bowl",
                "dinner": "Grilled salmon with vegetables"
            },
            "Tuesday": {
                "breakfast": "Oatmeal with berries",
                "lunch": "Chicken wrap",
                "dinner": "Pasta primavera"
            }
        }
        
        success, response = self.run_test(
            "Create Weekly Plan",
            "POST",
            "weekly-plan",
            200,
            data={
                "user_id": self.user_id,
                "week_start": "2024-01-01",
                "meals": sample_meals
            }
        )
        return success, response

    def test_weekly_plan_get(self):
        """Test getting weekly plans"""
        success, response = self.run_test(
            "Get Weekly Plans",
            "GET",
            f"weekly-plan/{self.user_id}",
            200
        )
        return success, response

def main():
    print("🧪 Starting Mood-Based Meal Planner API Tests")
    print("=" * 60)
    
    tester = MoodMealPlannerAPITester()
    
    # Test all endpoints
    tests = [
        ("Chat Send", tester.test_chat_send),
        ("Chat History", tester.test_chat_history),
        ("Save Recipe", tester.test_save_recipe),
        ("Get Saved Recipes", tester.test_get_saved_recipes),
        ("Create Shopping List", tester.test_shopping_list_create),
        ("Get Shopping List", tester.test_shopping_list_get),
        ("Create Weekly Plan", tester.test_weekly_plan_create),
        ("Get Weekly Plans", tester.test_weekly_plan_get)
    ]
    
    failed_tests = []
    
    for test_name, test_func in tests:
        try:
            success, response = test_func()
            if not success:
                failed_tests.append(test_name)
        except Exception as e:
            print(f"❌ {test_name} - Exception: {str(e)}")
            failed_tests.append(test_name)
    
    # Print results
    print("\n" + "=" * 60)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if failed_tests:
        print(f"❌ Failed tests: {', '.join(failed_tests)}")
        return 1
    else:
        print("✅ All tests passed!")
        return 0

if __name__ == "__main__":
    sys.exit(main())