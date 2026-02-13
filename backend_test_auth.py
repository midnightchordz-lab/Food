import requests
import sys
import json
from datetime import datetime

class AuthenticatedMealPlannerAPITester:
    def __init__(self, base_url="https://recipe-voice-sync.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.session_id = f"test-session-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        self.token = None
        self.user_data = None
        self.test_email = f"test-{datetime.now().strftime('%H%M%S')}@example.com"
        self.test_password = "testpass123"
        self.test_name = "Test User"

    def run_test(self, name, method, endpoint, expected_status, data=None, auth_required=True):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if auth_required and self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        if auth_required:
            print(f"   Auth: {'✓' if self.token else '✗'}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    # Truncate long responses for readability
                    if len(str(response_data)) > 300:
                        print(f"   Response: {json.dumps(response_data, indent=2)[:300]}...")
                    else:
                        print(f"   Response: {json.dumps(response_data, indent=2)}")
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

    def test_user_registration(self):
        """Test user registration with dietary restrictions"""
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data={
                "email": self.test_email,
                "password": self.test_password,
                "name": self.test_name,
                "dietary_restrictions": ["Vegetarian", "Gluten-Free"]
            },
            auth_required=False
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_data = response['user']
            print(f"   ✓ Token received: {self.token[:20]}...")
            print(f"   ✓ User ID: {self.user_data['id']}")
            print(f"   ✓ Dietary restrictions: {self.user_data['dietary_restrictions']}")
        
        return success, response

    def test_user_login(self):
        """Test user login"""
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data={
                "email": self.test_email,
                "password": self.test_password
            },
            auth_required=False
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_data = response['user']
            print(f"   ✓ Login successful, token: {self.token[:20]}...")
        
        return success, response

    def test_get_current_user(self):
        """Test getting current user profile"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        return success, response

    def test_update_profile(self):
        """Test updating user profile"""
        success, response = self.run_test(
            "Update Profile",
            "PUT",
            "auth/profile",
            200,
            data={
                "name": "Updated Test User",
                "dietary_restrictions": ["Vegan", "Nut-Free"]
            }
        )
        return success, response

    def test_chat_with_dietary_restrictions(self):
        """Test chat with dietary restrictions in system message"""
        success, response = self.run_test(
            "Chat with Dietary Restrictions",
            "POST",
            "chat/send",
            200,
            data={
                "session_id": self.session_id,
                "message": "I'm feeling stressed and need a quick meal. What do you recommend?"
            }
        )
        
        if success and 'response' in response:
            ai_response = response['response'].lower()
            # Check if AI respects dietary restrictions
            if 'vegan' in ai_response or 'plant-based' in ai_response:
                print(f"   ✓ AI response respects dietary restrictions")
            else:
                print(f"   ⚠ AI response may not fully respect dietary restrictions")
        
        return success, response

    def test_chat_history(self):
        """Test getting chat history for authenticated user"""
        success, response = self.run_test(
            "Chat History",
            "GET",
            f"chat/history/{self.session_id}",
            200
        )
        return success, response

    def test_save_recipe(self):
        """Test saving a recipe for authenticated user"""
        sample_recipe = {
            "title": "Vegan Stress-Relief Bowl",
            "description": "A nourishing plant-based bowl with stress-reducing nutrients",
            "ingredients": [
                "1 cup quinoa",
                "2 cups spinach",
                "1/2 avocado",
                "1 tbsp pumpkin seeds",
                "1 tbsp tahini"
            ],
            "instructions": [
                "Cook quinoa according to package directions",
                "Sauté spinach until wilted",
                "Combine in bowl and top with avocado, seeds, and tahini"
            ],
            "mood_tags": ["stressed", "comfort", "nourishing"],
            "prep_time": "10 minutes",
            "cook_time": "15 minutes",
            "complexity": "quick",
            "nutritional_highlights": "High in magnesium and plant-based protein for stress relief",
            "dietary_info": ["Vegan", "Gluten-Free"]
        }
        
        success, response = self.run_test(
            "Save Recipe",
            "POST",
            "recipes/save",
            200,
            data={"recipe": sample_recipe}
        )
        
        if success and 'recipe_id' in response:
            self.saved_recipe_id = response['recipe_id']
            print(f"   ✓ Recipe saved with ID: {self.saved_recipe_id}")
        
        return success, response

    def test_get_saved_recipes(self):
        """Test getting saved recipes for authenticated user"""
        success, response = self.run_test(
            "Get Saved Recipes",
            "GET",
            "recipes/saved",
            200
        )
        
        if success and 'recipes' in response:
            recipe_count = len(response['recipes'])
            print(f"   ✓ Found {recipe_count} saved recipes")
        
        return success, response

    def test_add_recipe_to_shopping_list(self):
        """Test adding recipe ingredients to shopping list"""
        # First save a recipe to get an ID
        if not hasattr(self, 'saved_recipe_id'):
            self.test_save_recipe()
        
        if hasattr(self, 'saved_recipe_id'):
            success, response = self.run_test(
                "Add Recipe to Shopping List",
                "POST",
                f"recipes/{self.saved_recipe_id}/add-to-shopping-list",
                200
            )
            
            if success and 'items_added' in response:
                print(f"   ✓ Added {response['items_added']} ingredients to shopping list")
            
            return success, response
        else:
            print("❌ No saved recipe ID available for shopping list test")
            return False, {}

    def test_get_shopping_list(self):
        """Test getting shopping list for authenticated user"""
        success, response = self.run_test(
            "Get Shopping List",
            "GET",
            "shopping-list",
            200
        )
        
        if success and 'items' in response:
            item_count = len(response['items'])
            print(f"   ✓ Shopping list has {item_count} items")
        
        return success, response

    def test_create_shopping_list(self):
        """Test creating/updating shopping list"""
        sample_items = [
            {"name": "Organic Quinoa", "checked": False},
            {"name": "Fresh Spinach", "checked": False},
            {"name": "Ripe Avocado", "checked": True},
            {"name": "Raw Pumpkin Seeds", "checked": False}
        ]
        
        success, response = self.run_test(
            "Create Shopping List",
            "POST",
            "shopping-list",
            200,
            data={"items": sample_items}
        )
        return success, response

    def test_create_weekly_plan(self):
        """Test creating weekly plan for authenticated user"""
        sample_meals = {
            "Monday": {
                "breakfast": "Vegan smoothie bowl with berries",
                "lunch": "Quinoa stress-relief bowl",
                "dinner": "Lentil curry with brown rice"
            },
            "Tuesday": {
                "breakfast": "Overnight oats with almond milk",
                "lunch": "Buddha bowl with tahini dressing",
                "dinner": "Stuffed bell peppers with quinoa"
            }
        }
        
        success, response = self.run_test(
            "Create Weekly Plan",
            "POST",
            "weekly-plan",
            200,
            data={
                "week_start": "2024-08-26",
                "meals": sample_meals
            }
        )
        return success, response

    def test_get_weekly_plans(self):
        """Test getting weekly plans for authenticated user"""
        success, response = self.run_test(
            "Get Weekly Plans",
            "GET",
            "weekly-plan",
            200
        )
        
        if success and 'plans' in response:
            plan_count = len(response['plans'])
            print(f"   ✓ Found {plan_count} weekly plans")
        
        return success, response

    def test_unauthorized_access(self):
        """Test that endpoints require authentication"""
        # Temporarily remove token
        original_token = self.token
        self.token = None
        
        success, response = self.run_test(
            "Unauthorized Access Test",
            "GET",
            "recipes/saved",
            401,  # Expect 401 Unauthorized
            auth_required=True
        )
        
        # Restore token
        self.token = original_token
        
        if success:
            print("   ✓ Properly rejected unauthorized request")
        
        return success, response

def main():
    print("🧪 Starting Authenticated Mood-Based Meal Planner API Tests")
    print("=" * 70)
    
    tester = AuthenticatedMealPlannerAPITester()
    
    # Test authentication flow first
    auth_tests = [
        ("User Registration", tester.test_user_registration),
        ("Get Current User", tester.test_get_current_user),
        ("Update Profile", tester.test_update_profile),
        ("Unauthorized Access", tester.test_unauthorized_access)
    ]
    
    # Test authenticated endpoints
    feature_tests = [
        ("Chat with Dietary Restrictions", tester.test_chat_with_dietary_restrictions),
        ("Chat History", tester.test_chat_history),
        ("Save Recipe", tester.test_save_recipe),
        ("Get Saved Recipes", tester.test_get_saved_recipes),
        ("Add Recipe to Shopping List", tester.test_add_recipe_to_shopping_list),
        ("Get Shopping List", tester.test_get_shopping_list),
        ("Create Shopping List", tester.test_create_shopping_list),
        ("Create Weekly Plan", tester.test_create_weekly_plan),
        ("Get Weekly Plans", tester.test_get_weekly_plans)
    ]
    
    all_tests = auth_tests + feature_tests
    failed_tests = []
    
    for test_name, test_func in all_tests:
        try:
            success, response = test_func()
            if not success:
                failed_tests.append(test_name)
        except Exception as e:
            print(f"❌ {test_name} - Exception: {str(e)}")
            failed_tests.append(test_name)
    
    # Print results
    print("\n" + "=" * 70)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if failed_tests:
        print(f"❌ Failed tests: {', '.join(failed_tests)}")
        return 1
    else:
        print("✅ All authentication and feature tests passed!")
        return 0

if __name__ == "__main__":
    sys.exit(main())